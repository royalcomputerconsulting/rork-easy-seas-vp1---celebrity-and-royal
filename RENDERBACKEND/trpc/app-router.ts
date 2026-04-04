import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  createId,
  getSailingMonth,
  getSailingYear,
  mutateDatabase,
  normalizeEmail,
  normalizeOptionalString,
  normalizeText,
  readDatabase,
  type CrewMemberRecord,
  type RecognitionEntryRecord,
  type SailingRecord,
  type UserProfileRecord,
} from '../store.js';
import { createTRPCRouter, publicProcedure } from './create-context.js';

const departmentEnum = z.enum([
  'Casino',
  'Dining',
  'Housekeeping',
  'Guest Relations',
  'Activities',
  'Spa',
  'Retail',
  'Beverage',
  'Loyalty',
  'Public Areas',
  'Other',
]);

const userDataSchema = z.object({
  email: z.string().email(),
  cruises: z.array(z.unknown()).optional(),
  bookedCruises: z.array(z.unknown()).optional(),
  casinoOffers: z.array(z.unknown()).optional(),
  calendarEvents: z.array(z.unknown()).optional(),
  casinoSessions: z.array(z.unknown()).optional(),
  clubRoyaleProfile: z.unknown().optional(),
  settings: z.unknown().optional(),
  userPoints: z.number().optional(),
  certificates: z.array(z.unknown()).optional(),
  alerts: z.array(z.unknown()).optional(),
  alertRules: z.array(z.unknown()).optional(),
  slotAtlas: z.array(z.unknown()).optional(),
  loyaltyData: z.unknown().optional(),
  bankrollData: z.unknown().optional(),
  celebrityData: z.unknown().optional(),
  crewRecognitionEntries: z.array(z.unknown()).optional(),
  crewRecognitionSailings: z.array(z.unknown()).optional(),
});

type UserDataInput = z.infer<typeof userDataSchema>;

type CrewImportRow = {
  crewName: string;
  department: string;
  roleTitle?: string;
  notes?: string;
  shipName?: string;
  startDate?: string;
  endDate?: string;
};

type CruisePricing = {
  bookingId: string;
  shipName: string;
  sailDate: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  source: 'icruise' | 'cruisesheet' | 'royalcaribbean' | 'web';
  url: string;
  lastUpdated: string;
  confidence: 'high' | 'medium' | 'low';
};

type CruiseDeal = {
  bookingId: string;
  shipName: string;
  sailDate: string;
  source: 'icruise' | 'cruisesheet';
  price: number;
  cabinType: string;
  url: string;
  nights: number;
  departurePort: string;
};

type RoyalSyncResponse = {
  success: boolean;
  error: string | null;
  offers: unknown[];
  bookedCruises: unknown[];
  loyaltyData: Record<string, string> | null;
  message: string | null;
};

const dailyLuckProviderOrder = ['chineseDaily', 'westernDaily', 'skyToday', 'loveDaily', 'yearlyChinese'] as const;
type DailyLuckProviderKey = typeof dailyLuckProviderOrder[number];

function getNowIso(): string {
  return new Date().toISOString();
}

function buildUserProfile(input: UserDataInput, existingData: UserProfileRecord | undefined, updatedAt: string): UserProfileRecord {
  return {
    email: normalizeEmail(input.email),
    cruises: input.cruises ?? existingData?.cruises ?? [],
    bookedCruises: input.bookedCruises ?? existingData?.bookedCruises ?? [],
    casinoOffers: input.casinoOffers ?? existingData?.casinoOffers ?? [],
    calendarEvents: input.calendarEvents ?? existingData?.calendarEvents ?? [],
    casinoSessions: input.casinoSessions ?? existingData?.casinoSessions ?? [],
    clubRoyaleProfile: input.clubRoyaleProfile ?? existingData?.clubRoyaleProfile,
    settings: input.settings ?? existingData?.settings,
    userPoints: input.userPoints ?? existingData?.userPoints ?? 0,
    certificates: input.certificates ?? existingData?.certificates ?? [],
    alerts: input.alerts ?? existingData?.alerts ?? [],
    alertRules: input.alertRules ?? existingData?.alertRules ?? [],
    slotAtlas: input.slotAtlas ?? existingData?.slotAtlas ?? [],
    loyaltyData: input.loyaltyData ?? existingData?.loyaltyData,
    bankrollData: input.bankrollData ?? existingData?.bankrollData,
    celebrityData: input.celebrityData ?? existingData?.celebrityData,
    crewRecognitionEntries: input.crewRecognitionEntries ?? existingData?.crewRecognitionEntries ?? [],
    crewRecognitionSailings: input.crewRecognitionSailings ?? existingData?.crewRecognitionSailings ?? [],
    updatedAt,
    createdAt: existingData?.createdAt ?? updatedAt,
  };
}

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(9, Math.round(value)));
}

function getLuckTone(score: number): string {
  if (score >= 8) return 'strong';
  if (score >= 6) return 'supportive';
  if (score >= 4) return 'balanced';
  return 'cautious';
}

function getLuckLevel(score: number): string {
  if (score >= 8) return 'High';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Mixed';
  return 'Low';
}

function deriveWesternSign(birthDate: string): string {
  const parsed = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return 'aries';
  }

  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  return 'pisces';
}

function deriveChineseSign(birthDate: string): string {
  const parsed = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return 'rat';
  }

  const signs = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'] as const;
  const normalizedYear = parsed.getUTCFullYear() - 1900;
  const sign = signs[((normalizedYear % signs.length) + signs.length) % signs.length];
  return sign;
}

function buildSourceBreakdown(providerKey: DailyLuckProviderKey, score: number, input: { date: string; westernSign: string; chineseSign: string; }): {
  score: number;
  tone: string;
  reason: string;
  sourceUrl: string;
  sourceDateText: string;
  visibleDateText: string;
  detectedDateIso: string;
  isStale: boolean;
  title: string;
  excerpt: string;
  mainText: string;
  status: 'ok';
} {
  const tone = getLuckTone(score);
  const labelMap: Record<DailyLuckProviderKey, string> = {
    chineseDaily: 'Chinese daily outlook',
    westernDaily: 'Western daily outlook',
    skyToday: 'Sky conditions',
    loveDaily: 'Relationship weather',
    yearlyChinese: 'Yearly Chinese modifier',
  };

  const title = labelMap[providerKey];
  const reason = `${title} reads ${tone} for ${input.date}. ${input.westernSign} and ${input.chineseSign} signals stay aligned enough to keep decisions steady.`;

  return {
    score,
    tone,
    reason,
    sourceUrl: '',
    sourceDateText: input.date,
    visibleDateText: input.date,
    detectedDateIso: input.date,
    isStale: false,
    title,
    excerpt: reason,
    mainText: reason,
    status: 'ok',
  };
}

function buildDailyLuckAnalysis(input: {
  date: string;
  birthDate: string;
  birthplace?: string;
  displayName?: string;
  westernSign?: string;
  chineseSign?: string;
}): {
  date: string;
  profile: {
    displayName?: string;
    westernSign: string;
    chineseSign: string;
    birthDate: string;
    birthplace: string;
  };
  luckScore: number;
  luckLevel: string;
  confidence: number;
  summary: string;
  breakdown: Record<DailyLuckProviderKey, ReturnType<typeof buildSourceBreakdown>>;
  playStyle: {
    strategy: string;
    avoid: string[];
    favor: string[];
  };
  uiCard: {
    score: number;
    label: string;
    oneLiner: string;
  };
  sourceOrder: DailyLuckProviderKey[];
  plainEnglish: string;
} {
  const westernSign = input.westernSign ?? deriveWesternSign(input.birthDate);
  const chineseSign = input.chineseSign ?? deriveChineseSign(input.birthDate);
  const seed = `${input.date}|${input.birthDate}|${westernSign}|${chineseSign}`;

  const chineseDailyScore = clampScore((hashToPositiveInt(`${seed}|chinese`) % 5) + 3);
  const westernDailyScore = clampScore((hashToPositiveInt(`${seed}|western`) % 5) + 3);
  const skyTodayScore = clampScore((hashToPositiveInt(`${seed}|sky`) % 5) + 3);
  const loveDailyScore = clampScore((hashToPositiveInt(`${seed}|love`) % 5) + 3);
  const yearlyChineseScore = clampScore((hashToPositiveInt(`${seed}|yearly`) % 5) + 3);

  const rawAverage = (chineseDailyScore + westernDailyScore + skyTodayScore + loveDailyScore + yearlyChineseScore) / 5;
  const luckScore = clampScore(rawAverage);
  const luckLevel = getLuckLevel(luckScore);
  const confidence = 72 + (hashToPositiveInt(`${seed}|confidence`) % 19);

  const breakdown: Record<DailyLuckProviderKey, ReturnType<typeof buildSourceBreakdown>> = {
    chineseDaily: buildSourceBreakdown('chineseDaily', chineseDailyScore, { date: input.date, westernSign, chineseSign }),
    westernDaily: buildSourceBreakdown('westernDaily', westernDailyScore, { date: input.date, westernSign, chineseSign }),
    skyToday: buildSourceBreakdown('skyToday', skyTodayScore, { date: input.date, westernSign, chineseSign }),
    loveDaily: buildSourceBreakdown('loveDaily', loveDailyScore, { date: input.date, westernSign, chineseSign }),
    yearlyChinese: buildSourceBreakdown('yearlyChinese', yearlyChineseScore, { date: input.date, westernSign, chineseSign }),
  };

  const summary = `Luck level ${luckLevel.toLowerCase()} for ${input.date}. Move with intention, protect your margin, and lean into small high-confidence wins.`;
  const oneLiner = luckScore >= 7
    ? 'Green light for measured action and confident timing.'
    : luckScore >= 5
      ? 'Balanced day: pick your spots and avoid forcing outcomes.'
      : 'Cautious day: keep decisions simple and protect energy.';

  return {
    date: input.date,
    profile: {
      displayName: normalizeOptionalString(input.displayName),
      westernSign,
      chineseSign,
      birthDate: input.birthDate,
      birthplace: normalizeOptionalString(input.birthplace) ?? 'Unknown',
    },
    luckScore,
    luckLevel,
    confidence,
    summary,
    breakdown,
    playStyle: {
      strategy: luckScore >= 7 ? 'Press small advantages and stay selective.' : luckScore >= 5 ? 'Favor measured action over emotion.' : 'Reduce risk and wait for cleaner signals.',
      avoid: luckScore >= 7 ? ['Overcommitting late in the day'] : ['Impulse decisions', 'Overextending socially'],
      favor: luckScore >= 7 ? ['Short bursts of action', 'Clear priorities'] : luckScore >= 5 ? ['Planning', 'Incremental progress'] : ['Rest', 'Simple routines'],
    },
    uiCard: {
      score: luckScore,
      label: `${luckLevel} day`,
      oneLiner,
    },
    sourceOrder: [...dailyLuckProviderOrder],
    plainEnglish: `${oneLiner} Confidence ${confidence}%.`,
  };
}

function buildRoyalSyncUnavailableResponse(cruiseLine: 'royal_caribbean' | 'celebrity' | 'carnival'): RoyalSyncResponse {
  const brandName = cruiseLine === 'celebrity'
    ? 'Celebrity Cruises'
    : cruiseLine === 'carnival'
      ? 'Carnival Cruise Line'
      : 'Royal Caribbean';

  return {
    success: false,
    error: `Web sync is not enabled for ${brandName} in this backend package yet.`,
    offers: [],
    bookedCruises: [],
    loyaltyData: null,
    message: 'Manual import and local sync continue to work.',
  };
}

function parseCsvRows(csvText: string): CrewImportRow[] {
  const lines = csvText.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((header) => header.trim().replace(/^[\uFEFF"']+/g, '').replace(/["']+$/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim().replace(/^["']+/g, '').replace(/["']+$/g, ''));
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return {
      crewName: row['Crew_Name'] || row['crew_name'] || row['Crew Name'] || '',
      department: row['Department'] || row['department'] || '',
      roleTitle: row['Role'] || row['role'] || row['Role_Title'] || row['roleTitle'] || undefined,
      notes: row['Notes'] || row['notes'] || undefined,
      shipName: row['Ship'] || row['ship'] || row['Ship_Name'] || row['shipName'] || undefined,
      startDate: row['Start_Date'] || row['start_date'] || row['Start Date'] || undefined,
      endDate: row['End_Date'] || row['end_date'] || row['End Date'] || undefined,
    };
  });
}

function getCrewMembersForUser(userId: string, crewMembers: Record<string, CrewMemberRecord>): CrewMemberRecord[] {
  return Object.values(crewMembers)
    .filter((crewMember) => crewMember.userId === userId && !crewMember.isDeleted)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function getSailingsForUser(userId: string, sailings: Record<string, SailingRecord>): SailingRecord[] {
  return Object.values(sailings)
    .filter((sailing) => sailing.userId === userId)
    .sort((left, right) => right.sailStartDate.localeCompare(left.sailStartDate));
}

function getRecognitionEntriesForUser(userId: string, recognitionEntries: Record<string, RecognitionEntryRecord>): RecognitionEntryRecord[] {
  return Object.values(recognitionEntries)
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => right.sailStartDate.localeCompare(left.sailStartDate));
}

function findCrewMemberByName(userId: string, fullName: string, crewMembers: Record<string, CrewMemberRecord>): CrewMemberRecord | undefined {
  const normalizedTarget = normalizeText(fullName);
  return Object.values(crewMembers).find((crewMember) => {
    return crewMember.userId === userId && !crewMember.isDeleted && normalizeText(crewMember.fullName) === normalizedTarget;
  });
}

function findSailingByIdentity(userId: string, shipName: string, sailStartDate: string, sailings: Record<string, SailingRecord>): SailingRecord | undefined {
  const normalizedShipName = normalizeText(shipName);
  return Object.values(sailings).find((sailing) => {
    return sailing.userId === userId
      && normalizeText(sailing.shipName) === normalizedShipName
      && sailing.sailStartDate === sailStartDate;
  });
}

function findRecognitionEntryByCrewAndSailing(crewMemberId: string, sailingId: string, recognitionEntries: Record<string, RecognitionEntryRecord>): RecognitionEntryRecord | undefined {
  return Object.values(recognitionEntries).find((entry) => entry.crewMemberId === crewMemberId && entry.sailingId === sailingId);
}

function buildEntriesWithCrew(
  entries: RecognitionEntryRecord[],
  crewMembers: Record<string, CrewMemberRecord>,
): Array<RecognitionEntryRecord & { fullName: string; crewNotes?: string }> {
  return entries.map((entry) => {
    const crewMember = crewMembers[entry.crewMemberId];
    return {
      ...entry,
      fullName: crewMember?.fullName ?? 'Unknown',
      crewNotes: crewMember?.notes,
    };
  });
}

function importCrewRows(
  rows: CrewImportRow[],
  userId: string,
  crewMembers: Record<string, CrewMemberRecord>,
  sailings: Record<string, SailingRecord>,
  recognitionEntries: Record<string, RecognitionEntryRecord>,
): { importedCount: number } {
  const now = getNowIso();
  let importedCount = 0;

  rows.forEach((row) => {
    if (!row.crewName.trim() || !row.department.trim()) {
      return;
    }

    let crewMember = findCrewMemberByName(userId, row.crewName, crewMembers);

    if (!crewMember) {
      crewMember = {
        id: createId('crew'),
        fullName: row.crewName.trim(),
        department: row.department.trim(),
        roleTitle: normalizeOptionalString(row.roleTitle),
        notes: normalizeOptionalString(row.notes),
        userId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      crewMembers[crewMember.id] = crewMember;
      importedCount += 1;
      console.log('[CrewRecognition] Created crew member from import:', { userId, fullName: crewMember.fullName });
    } else {
      const updatedRoleTitle = normalizeOptionalString(row.roleTitle);
      const updatedNotes = normalizeOptionalString(row.notes);
      if (updatedRoleTitle && !crewMember.roleTitle) {
        crewMember.roleTitle = updatedRoleTitle;
      }
      if (updatedNotes && !crewMember.notes) {
        crewMember.notes = updatedNotes;
      }
      crewMember.updatedAt = now;
    }

    if (!row.shipName?.trim() || !row.startDate?.trim()) {
      return;
    }

    let sailing = findSailingByIdentity(userId, row.shipName, row.startDate.trim(), sailings);

    if (!sailing) {
      sailing = {
        id: createId('sailing'),
        shipName: row.shipName.trim(),
        sailStartDate: row.startDate.trim(),
        sailEndDate: row.endDate?.trim() || row.startDate.trim(),
        userId,
        createdAt: now,
        updatedAt: now,
      };
      sailings[sailing.id] = sailing;
      console.log('[CrewRecognition] Created sailing from import:', { userId, shipName: sailing.shipName, sailStartDate: sailing.sailStartDate });
    }

    const existingEntry = findRecognitionEntryByCrewAndSailing(crewMember.id, sailing.id, recognitionEntries);
    if (existingEntry) {
      return;
    }

    const entry: RecognitionEntryRecord = {
      id: createId('entry'),
      crewMemberId: crewMember.id,
      sailingId: sailing.id,
      shipName: sailing.shipName,
      sailStartDate: sailing.sailStartDate,
      sailEndDate: sailing.sailEndDate,
      sailingMonth: getSailingMonth(sailing.sailStartDate),
      sailingYear: getSailingYear(sailing.sailStartDate),
      department: row.department.trim(),
      roleTitle: normalizeOptionalString(row.roleTitle),
      sourceText: 'Imported from CSV',
      userId,
      createdAt: now,
      updatedAt: now,
    };

    recognitionEntries[entry.id] = entry;
    console.log('[CrewRecognition] Created recognition entry from import:', { userId, entryId: entry.id, crewMemberId: entry.crewMemberId, sailingId: entry.sailingId });
  });

  return { importedCount };
}

const exampleRouter = createTRPCRouter({
  hi: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => {
      return {
        hello: input.name,
        date: new Date(),
      };
    }),
});

const dataRouter = createTRPCRouter({
  saveUserData: publicProcedure
    .input(z.object({
      userId: z.string(),
      bookedCruises: z.array(z.unknown()),
      casinoOffers: z.array(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      const now = getNowIso();

      await mutateDatabase('saveUserData', (database) => {
        const existing = database.simpleUserData[input.userId];
        database.simpleUserData[input.userId] = {
          userId: input.userId,
          bookedCruises: input.bookedCruises,
          casinoOffers: input.casinoOffers,
          updatedAt: now,
          createdAt: existing?.createdAt ?? now,
        };
      });

      console.log('[Data] Saved simple user data:', { userId: input.userId, cruises: input.bookedCruises.length, offers: input.casinoOffers.length });
      return { success: true, updatedAt: now };
    }),

  getUserData: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const record = database.simpleUserData[input.userId];
      const found = Boolean(record);
      console.log('[Data] Loaded simple user data:', { userId: input.userId, found });

      return {
        bookedCruises: record?.bookedCruises ?? [],
        casinoOffers: record?.casinoOffers ?? [],
        updatedAt: record?.updatedAt ?? null,
      };
    }),

  saveAllUserData: publicProcedure
    .input(userDataSchema)
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const now = getNowIso();

      await mutateDatabase('saveAllUserData', (database) => {
        const existing = database.userProfiles[normalizedEmail];
        database.userProfiles[normalizedEmail] = buildUserProfile({ ...input, email: normalizedEmail }, existing, now);
      });

      console.log('[Data] Saved full user profile:', { email: normalizedEmail });
      return { success: true, updatedAt: now };
    }),

  getAllUserData: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const database = await readDatabase();
      const data = database.userProfiles[normalizedEmail] ?? null;
      console.log('[Data] Loaded full user profile:', { email: normalizedEmail, found: Boolean(data) });

      return {
        found: Boolean(data),
        data,
      };
    }),

  deleteUserData: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      await mutateDatabase('deleteUserData', (database) => {
        delete database.userProfiles[normalizedEmail];
      });

      console.log('[Data] Deleted user profile:', { email: normalizedEmail });
      return { success: true };
    }),

  checkEmailExists: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const database = await readDatabase();
      const exists = Boolean(database.userProfiles[normalizedEmail]);
      console.log('[Data] Checked email exists:', { email: normalizedEmail, exists });
      return { exists };
    }),
});

const calendarRouter = createTRPCRouter({
  saveCalendarFeed: publicProcedure
    .input(z.object({
      email: z.string().email(),
      token: z.string().min(16),
      icsContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const now = getNowIso();

      await mutateDatabase('saveCalendarFeed', (database) => {
        const existing = database.calendarFeeds[normalizedEmail];
        database.calendarFeeds[normalizedEmail] = {
          email: normalizedEmail,
          token: input.token,
          icsContent: input.icsContent,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
      });

      console.log('[Calendar] Saved calendar feed:', { email: normalizedEmail, tokenPrefix: input.token.slice(0, 8) });
      return { success: true, updatedAt: now };
    }),

  getCalendarFeedByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const feed = Object.values(database.calendarFeeds).find((record) => record.token === input.token) ?? null;
      console.log('[Calendar] Looked up feed by token:', { tokenPrefix: input.token.slice(0, 8), found: Boolean(feed) });

      return {
        found: Boolean(feed),
        icsContent: feed?.icsContent ?? null,
        updatedAt: feed?.updatedAt ?? null,
      };
    }),

  getCalendarFeedToken: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      const database = await readDatabase();
      const feed = database.calendarFeeds[normalizedEmail] ?? null;
      console.log('[Calendar] Looked up feed token by email:', { email: normalizedEmail, found: Boolean(feed) });

      return {
        found: Boolean(feed),
        token: feed?.token ?? null,
        updatedAt: feed?.updatedAt ?? null,
      };
    }),

  deleteCalendarFeed: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      await mutateDatabase('deleteCalendarFeed', (database) => {
        delete database.calendarFeeds[normalizedEmail];
      });

      console.log('[Calendar] Deleted calendar feed:', { email: normalizedEmail });
      return { success: true };
    }),

  fetchICS: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      console.log('[Calendar] Fetching ICS:', { url: input.url });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(input.url, {
          method: 'GET',
          headers: {
            Accept: 'text/calendar, text/plain, application/octet-stream, */*',
            'User-Agent': 'EasySeasBackend/2.0',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `HTTP ${response.status}: ${response.statusText}` });
        }

        const content = await response.text();
        const lower = content.toLowerCase();
        if (lower.includes('<html') || lower.includes('<!doctype')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The URL returned HTML instead of a calendar file.',
          });
        }

        if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VEVENT')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The URL did not return a valid ICS payload.',
          });
        }

        console.log('[Calendar] ICS fetched successfully:', { length: content.length });
        return { content };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          throw new TRPCError({ code: 'TIMEOUT', message: 'The ICS fetch timed out.' });
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error('[Calendar] ICS fetch failed:', message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to fetch ICS: ${message}` });
      }
    }),
});

const crewRecognitionRouter = createTRPCRouter({
  getCSVContent: publicProcedure.query(async () => {
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'g131hcw7cxhvg2godfob0';
    const csvUrl = `https://rork.app/pa/${projectId}/Crew_Recognition.csv`;
    console.log('[CrewRecognition] Fetching CSV asset:', { csvUrl });

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      if (!content.trim()) {
        throw new Error('CSV asset was empty');
      }
      return { content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[CrewRecognition] Failed to fetch CSV asset:', message);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to load CSV asset: ${message}` });
    }
  }),

  syncFromCSV: publicProcedure
    .input(z.object({
      csvText: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const rows = parseCsvRows(input.csvText);
      if (rows.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'CSV file is empty or invalid.' });
      }

      const result = await mutateDatabase('crewRecognition.syncFromCSV', (database) => {
        return importCrewRows(rows, input.userId, database.crewMembers, database.sailings, database.recognitionEntries);
      });

      console.log('[CrewRecognition] CSV sync complete:', { userId: input.userId, rows: rows.length, importedCount: result.importedCount });
      return { success: true, importedCount: result.importedCount };
    }),

  getCrewMembers: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      department: z.string().optional(),
      userId: z.string(),
    }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const normalizedSearch = normalizeText(input.search);
      const normalizedDepartment = normalizeText(input.department);

      const crewMembers = getCrewMembersForUser(input.userId, database.crewMembers).filter((crewMember) => {
        if (normalizedSearch && !normalizeText(crewMember.fullName).includes(normalizedSearch)) {
          return false;
        }
        if (normalizedDepartment && normalizeText(crewMember.department) !== normalizedDepartment) {
          return false;
        }
        return true;
      });

      console.log('[CrewRecognition] Loaded crew members:', { userId: input.userId, count: crewMembers.length });
      return crewMembers;
    }),

  createCrewMember: publicProcedure
    .input(z.object({
      fullName: z.string().min(1),
      department: departmentEnum,
      roleTitle: z.string().optional(),
      notes: z.string().optional(),
      sailingId: z.string().optional(),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await mutateDatabase('crewRecognition.createCrewMember', (database) => {
        const existing = findCrewMemberByName(input.userId, input.fullName, database.crewMembers);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'A crew member with this name already exists.' });
        }

        const now = getNowIso();
        const crewMember: CrewMemberRecord = {
          id: createId('crew'),
          fullName: input.fullName.trim(),
          department: input.department,
          roleTitle: normalizeOptionalString(input.roleTitle),
          notes: normalizeOptionalString(input.notes),
          userId: input.userId,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        database.crewMembers[crewMember.id] = crewMember;

        if (input.sailingId) {
          const sailing = database.sailings[input.sailingId];
          if (sailing && sailing.userId === input.userId) {
            const existingEntry = findRecognitionEntryByCrewAndSailing(crewMember.id, sailing.id, database.recognitionEntries);
            if (!existingEntry) {
              const entry: RecognitionEntryRecord = {
                id: createId('entry'),
                crewMemberId: crewMember.id,
                sailingId: sailing.id,
                shipName: sailing.shipName,
                sailStartDate: sailing.sailStartDate,
                sailEndDate: sailing.sailEndDate,
                sailingMonth: getSailingMonth(sailing.sailStartDate),
                sailingYear: getSailingYear(sailing.sailStartDate),
                department: input.department,
                roleTitle: normalizeOptionalString(input.roleTitle),
                sourceText: undefined,
                userId: input.userId,
                createdAt: now,
                updatedAt: now,
              };
              database.recognitionEntries[entry.id] = entry;
            }
          }
        }

        return crewMember;
      });

      console.log('[CrewRecognition] Created crew member:', { userId: input.userId, id: result.id, fullName: result.fullName });
      return result;
    }),

  updateCrewMember: publicProcedure
    .input(z.object({
      id: z.string(),
      fullName: z.string().min(1),
      department: departmentEnum,
      roleTitle: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updated = await mutateDatabase('crewRecognition.updateCrewMember', (database) => {
        const crewMember = database.crewMembers[input.id];
        if (!crewMember) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Crew member not found.' });
        }

        crewMember.fullName = input.fullName.trim();
        crewMember.department = input.department;
        crewMember.roleTitle = normalizeOptionalString(input.roleTitle);
        crewMember.notes = normalizeOptionalString(input.notes);
        crewMember.updatedAt = getNowIso();
        return crewMember;
      });

      console.log('[CrewRecognition] Updated crew member:', { id: updated.id, fullName: updated.fullName });
      return updated;
    }),

  deleteCrewMember: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await mutateDatabase('crewRecognition.deleteCrewMember', (database) => {
        const crewMember = database.crewMembers[input.id];
        if (!crewMember) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Crew member not found.' });
        }

        const hasEntries = Object.values(database.recognitionEntries).some((entry) => entry.crewMemberId === input.id);
        if (hasEntries) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot delete crew member with existing recognition entries.' });
        }

        crewMember.isDeleted = true;
        crewMember.updatedAt = getNowIso();
      });

      console.log('[CrewRecognition] Deleted crew member:', { id: input.id });
      return { success: true };
    }),

  getRecognitionEntries: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      shipNames: z.array(z.string()).optional(),
      month: z.string().optional(),
      year: z.number().optional(),
      departments: z.array(z.string()).optional(),
      roleTitle: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
      userId: z.string(),
    }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const normalizedSearch = normalizeText(input.search);
      const normalizedRoleTitle = normalizeText(input.roleTitle);
      const normalizedShipNames = (input.shipNames ?? []).map((value) => normalizeText(value));
      const normalizedDepartments = (input.departments ?? []).map((value) => normalizeText(value));
      const crewMembers = getCrewMembersForUser(input.userId, database.crewMembers);
      const crewMemberIdsBySearch = normalizedSearch
        ? new Set(
            crewMembers
              .filter((crewMember) => normalizeText(crewMember.fullName).includes(normalizedSearch))
              .map((crewMember) => crewMember.id),
          )
        : null;

      const filtered = getRecognitionEntriesForUser(input.userId, database.recognitionEntries).filter((entry) => {
        if (crewMemberIdsBySearch && !crewMemberIdsBySearch.has(entry.crewMemberId)) {
          return false;
        }
        if (normalizedShipNames.length > 0 && !normalizedShipNames.includes(normalizeText(entry.shipName))) {
          return false;
        }
        if (input.month && entry.sailingMonth !== input.month) {
          return false;
        }
        if (typeof input.year === 'number' && entry.sailingYear !== input.year) {
          return false;
        }
        if (normalizedDepartments.length > 0 && !normalizedDepartments.includes(normalizeText(entry.department))) {
          return false;
        }
        if (normalizedRoleTitle && !normalizeText(entry.roleTitle).includes(normalizedRoleTitle)) {
          return false;
        }
        if (input.startDate && entry.sailStartDate < input.startDate) {
          return false;
        }
        if (input.endDate && entry.sailEndDate > input.endDate) {
          return false;
        }
        return true;
      });

      const total = filtered.length;
      const startIndex = Math.max(0, (input.page - 1) * input.pageSize);
      const pagedEntries = filtered.slice(startIndex, startIndex + input.pageSize);
      const entries = buildEntriesWithCrew(pagedEntries, database.crewMembers);

      console.log('[CrewRecognition] Loaded recognition entries:', { userId: input.userId, total, returned: entries.length, page: input.page, pageSize: input.pageSize });
      return { entries, total };
    }),

  createRecognitionEntry: publicProcedure
    .input(z.object({
      crewMemberId: z.string(),
      sailingId: z.string(),
      department: departmentEnum,
      roleTitle: z.string().optional(),
      sourceText: z.string().optional(),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const entry = await mutateDatabase('crewRecognition.createRecognitionEntry', (database) => {
        const sailing = database.sailings[input.sailingId];
        if (!sailing || sailing.userId !== input.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Sailing not found.' });
        }

        const crewMember = database.crewMembers[input.crewMemberId];
        if (!crewMember || crewMember.userId !== input.userId || crewMember.isDeleted) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Crew member not found.' });
        }

        const existing = findRecognitionEntryByCrewAndSailing(input.crewMemberId, input.sailingId, database.recognitionEntries);
        if (existing) {
          return existing;
        }

        const now = getNowIso();
        const createdEntry: RecognitionEntryRecord = {
          id: createId('entry'),
          crewMemberId: input.crewMemberId,
          sailingId: input.sailingId,
          shipName: sailing.shipName,
          sailStartDate: sailing.sailStartDate,
          sailEndDate: sailing.sailEndDate,
          sailingMonth: getSailingMonth(sailing.sailStartDate),
          sailingYear: getSailingYear(sailing.sailStartDate),
          department: input.department,
          roleTitle: normalizeOptionalString(input.roleTitle),
          sourceText: normalizeOptionalString(input.sourceText),
          userId: input.userId,
          createdAt: now,
          updatedAt: now,
        };
        database.recognitionEntries[createdEntry.id] = createdEntry;
        return createdEntry;
      });

      console.log('[CrewRecognition] Created recognition entry:', { id: entry.id, crewMemberId: entry.crewMemberId, sailingId: entry.sailingId });
      return entry;
    }),

  updateRecognitionEntry: publicProcedure
    .input(z.object({
      id: z.string(),
      sailingId: z.string().optional(),
      department: departmentEnum.optional(),
      roleTitle: z.string().optional(),
      sourceText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updated = await mutateDatabase('crewRecognition.updateRecognitionEntry', (database) => {
        const entry = database.recognitionEntries[input.id];
        if (!entry) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recognition entry not found.' });
        }

        if (input.sailingId) {
          const sailing = database.sailings[input.sailingId];
          if (!sailing || sailing.userId !== entry.userId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Sailing not found.' });
          }
          entry.sailingId = sailing.id;
          entry.shipName = sailing.shipName;
          entry.sailStartDate = sailing.sailStartDate;
          entry.sailEndDate = sailing.sailEndDate;
          entry.sailingMonth = getSailingMonth(sailing.sailStartDate);
          entry.sailingYear = getSailingYear(sailing.sailStartDate);
        }

        if (input.department) {
          entry.department = input.department;
        }
        if (input.roleTitle !== undefined) {
          entry.roleTitle = normalizeOptionalString(input.roleTitle);
        }
        if (input.sourceText !== undefined) {
          entry.sourceText = normalizeOptionalString(input.sourceText);
        }
        entry.updatedAt = getNowIso();
        return entry;
      });

      console.log('[CrewRecognition] Updated recognition entry:', { id: updated.id });
      return updated;
    }),

  deleteRecognitionEntry: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await mutateDatabase('crewRecognition.deleteRecognitionEntry', (database) => {
        if (!database.recognitionEntries[input.id]) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Recognition entry not found.' });
        }
        delete database.recognitionEntries[input.id];
      });

      console.log('[CrewRecognition] Deleted recognition entry:', { id: input.id });
      return { success: true };
    }),

  syncBatch: publicProcedure
    .input(z.object({
      rows: z.array(z.object({
        crewName: z.string(),
        department: z.string(),
        roleTitle: z.string(),
        notes: z.string(),
        shipName: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      })),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await mutateDatabase('crewRecognition.syncBatch', (database) => {
        return importCrewRows(input.rows, input.userId, database.crewMembers, database.sailings, database.recognitionEntries);
      });

      console.log('[CrewRecognition] Batch sync complete:', { userId: input.userId, rows: input.rows.length, importedCount: result.importedCount });
      return { success: true, importedCount: result.importedCount };
    }),

  getSailings: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const sailings = getSailingsForUser(input.userId, database.sailings);
      console.log('[CrewRecognition] Loaded sailings:', { userId: input.userId, count: sailings.length });
      return sailings;
    }),

  createSailing: publicProcedure
    .input(z.object({
      shipName: z.string().min(1),
      sailStartDate: z.string(),
      sailEndDate: z.string(),
      nights: z.number().optional(),
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const sailing = await mutateDatabase('crewRecognition.createSailing', (database) => {
        const existing = findSailingByIdentity(input.userId, input.shipName, input.sailStartDate, database.sailings);
        if (existing) {
          return existing;
        }

        const now = getNowIso();
        const createdSailing: SailingRecord = {
          id: createId('sailing'),
          shipName: input.shipName.trim(),
          sailStartDate: input.sailStartDate,
          sailEndDate: input.sailEndDate,
          nights: input.nights,
          userId: input.userId,
          createdAt: now,
          updatedAt: now,
        };
        database.sailings[createdSailing.id] = createdSailing;
        return createdSailing;
      });

      console.log('[CrewRecognition] Created sailing:', { userId: input.userId, id: sailing.id, shipName: sailing.shipName });
      return sailing;
    }),

  getSurveyList: publicProcedure
    .input(z.object({ sailingId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const entries = getRecognitionEntriesForUser(input.userId, database.recognitionEntries).filter((entry) => entry.sailingId === input.sailingId);
      const grouped = new Map<string, number>();

      entries.forEach((entry) => {
        const current = grouped.get(entry.crewMemberId) ?? 0;
        grouped.set(entry.crewMemberId, current + 1);
      });

      const surveyList = Array.from(grouped.entries()).map(([crewMemberId, mentionCount]) => {
        const crewMember = database.crewMembers[crewMemberId];
        const firstEntry = entries.find((entry) => entry.crewMemberId === crewMemberId);
        return {
          fullName: crewMember?.fullName ?? 'Unknown',
          department: firstEntry?.department ?? crewMember?.department ?? 'Unknown',
          roleTitle: firstEntry?.roleTitle ?? crewMember?.roleTitle,
          mentionCount,
        };
      }).sort((left, right) => left.fullName.localeCompare(right.fullName));

      console.log('[CrewRecognition] Built survey list:', { userId: input.userId, sailingId: input.sailingId, count: surveyList.length });
      return surveyList;
    }),

  getStats: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const database = await readDatabase();
      const crewMemberCount = getCrewMembersForUser(input.userId, database.crewMembers).length;
      const recognitionEntryCount = getRecognitionEntriesForUser(input.userId, database.recognitionEntries).length;
      console.log('[CrewRecognition] Loaded stats:', { userId: input.userId, crewMemberCount, recognitionEntryCount });
      return { crewMemberCount, recognitionEntryCount };
    }),
});

const cruiseDealsRouter = createTRPCRouter({
  searchForBookedCruises: publicProcedure
    .input(z.object({
      cruises: z.array(z.object({
        id: z.string(),
        shipName: z.string(),
        sailDate: z.string(),
        nights: z.number(),
        departurePort: z.string(),
      })),
      searchApiUrl: z.string().optional(),
    }))
    .mutation(async ({ input }): Promise<{ deals: CruiseDeal[]; searchedCount: number; foundCount: number }> => {
      console.log('[CruiseDeals] Search requested for booked cruises:', { count: input.cruises.length, searchApiUrl: normalizeOptionalString(input.searchApiUrl) ?? null });
      return {
        deals: [],
        searchedCount: input.cruises.length,
        foundCount: 0,
      };
    }),

  searchSingleCruise: publicProcedure
    .input(z.object({
      shipName: z.string(),
      sailDate: z.string(),
      nights: z.number(),
      departurePort: z.string(),
      searchApiUrl: z.string().optional(),
    }))
    .mutation(async ({ input }): Promise<{ deals: CruiseDeal[] }> => {
      console.log('[CruiseDeals] Single cruise search requested:', { shipName: input.shipName, sailDate: input.sailDate, searchApiUrl: normalizeOptionalString(input.searchApiUrl) ?? null });
      return { deals: [] };
    }),

  syncPricingForBookedCruises: publicProcedure
    .input(z.object({
      cruises: z.array(z.object({
        id: z.string(),
        shipName: z.string(),
        sailDate: z.string(),
        nights: z.number(),
        departurePort: z.string(),
      })),
      searchApiUrl: z.string().optional(),
    }))
    .mutation(async ({ input }): Promise<{ pricing: CruisePricing[]; syncedCount: number }> => {
      console.log('[CruiseDeals] Pricing sync requested:', { count: input.cruises.length, searchApiUrl: normalizeOptionalString(input.searchApiUrl) ?? null });
      return {
        pricing: [],
        syncedCount: input.cruises.length,
      };
    }),
});

const royalCaribbeanSyncRouter = createTRPCRouter({
  cookieSync: publicProcedure
    .input(z.object({
      cookies: z.string().min(1),
      cruiseLine: z.enum(['royal_caribbean', 'celebrity', 'carnival']),
    }))
    .mutation(async ({ input }) => {
      console.log('[RoyalSync] Cookie sync requested:', { cruiseLine: input.cruiseLine, cookieLength: input.cookies.length });
      return buildRoyalSyncUnavailableResponse(input.cruiseLine);
    }),

  webLogin: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      cruiseLine: z.enum(['royal_caribbean', 'celebrity', 'carnival']),
    }))
    .mutation(async ({ input }) => {
      console.log('[RoyalSync] Web login requested:', { cruiseLine: input.cruiseLine, usernamePrefix: input.username.slice(0, 3) });
      return buildRoyalSyncUnavailableResponse(input.cruiseLine);
    }),

  checkStatus: publicProcedure.query(() => {
    console.log('[RoyalSync] Status check requested');
    return {
      available: false,
      message: 'Direct web sync is not enabled in this backend package yet.',
    };
  }),
});

const dailyLuckRouter = createTRPCRouter({
  getLive: publicProcedure
    .input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      westernSign: z.string().min(2).optional(),
      chineseSign: z.string().min(2).optional(),
      birthDate: z.string().min(6),
      birthplace: z.string().optional(),
      displayName: z.string().optional(),
      skyTodayUrl: z.string().url().optional(),
    }))
    .query(async ({ input }) => {
      console.log('[DailyLuck] Live analysis requested:', { date: input.date, westernSign: input.westernSign ?? null, chineseSign: input.chineseSign ?? null, hasSkyTodayUrl: Boolean(input.skyTodayUrl) });
      return buildDailyLuckAnalysis(input);
    }),
});

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
  royalCaribbeanSync: royalCaribbeanSyncRouter,
  cruiseDeals: cruiseDealsRouter,
  crewRecognition: crewRecognitionRouter,
  dailyLuck: dailyLuckRouter,
});

export type AppRouter = typeof appRouter;
