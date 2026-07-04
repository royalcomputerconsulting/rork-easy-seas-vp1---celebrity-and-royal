import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  Cruise, 
  CasinoOffer, 
  BookedCruise, 
  CalendarEvent, 
  ClubRoyaleProfile,
  MachineEncyclopediaEntry,
  CompItem,
  W2GRecord,
  SlotMachine,
  DeckPlanLocation,
} from '@/types/models';
import type { UserProfile } from '@/state/UserProvider';
import type { BankrollAlert, BankrollLimit } from '@/state/BankrollProvider';
import type { Certificate } from '@/components/CertificateManagerModal';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { CasinoOpenHoursData } from '@/components/ui/CasinoOpenHoursCard';
import type { RecognitionEntryWithCrew, Sailing } from '@/types/crew-recognition';
import { ALL_STORAGE_KEYS, GLOBAL_KEYS, getUserScopedKey, type AppSettings } from '../storage/storageKeys';
import { quotaSafeGetItem, quotaSafeSetItem, quotaSafeSetJsonItem } from '../storage/quotaSafeStorage';
import { applyKnownRetailValuesToBooked } from '../dataEnrichment/retailValueEnrichment';
import {
  dedupeBookedCruises,
  dedupeCalendarEvents,
  dedupeCasinoOffers,
  dedupeCruises,
  dedupeByIdentity,
} from '../dataIdentity';
import { generateCruiseCalendarEvents } from '../calendar/cruiseEvents';
import { applyFoundationFields } from '../dataFoundation';
import { isKnownCasinoProfile } from '../knownProfileFallback';
import { normalizeCruisesWithCasinoEconomics } from '../casinoCruiseEconomics';
import { getBookedCruiseCasinoPoints, normalizeCruiseCasinoPerformance } from '../casinoPointTruth';
import { buildAskMyDataOverview, type AskMyDataOverview } from '../askMyDataOverview';

const CURRENT_MACHINE_ENCYCLOPEDIA_KEY = 'easyseas_machine_encyclopedia_v2_262_only';
const CURRENT_MY_SLOT_ATLAS_KEY = 'easyseas_my_slot_atlas_v2_262_only';
const CASINO_OPEN_HOURS_STORAGE_PREFIX = `${ALL_STORAGE_KEYS.CASINO_OPEN_HOURS}_`;

function normalizeImportKeyPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function dedupeByIdOrPayload<T extends object>(items: T[], label: string): T[] {
  return dedupeByIdentity(items, (item) => {
    const record = item as Record<string, unknown>;
    const id = normalizeImportKeyPart(record.id);
    return id ? `id:${id}` : `payload:${normalizeImportKeyPart(JSON.stringify(item))}`;
  }, label);
}

function normalizeBackupImportEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

export interface DataProfileGate {
  activeProfileId?: string | null;
  activeProfileEmail?: string | null;
  authenticatedEmail?: string | null;
}

interface ResolvedDataProfileGate {
  activeProfileId: string | null;
  activeProfileEmail: string | null;
  authenticatedEmail: string | null;
  hasGate: boolean;
}

function normalizeProfileId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDataProfileGate(email: string | null | undefined, gate?: DataProfileGate): ResolvedDataProfileGate {
  const activeProfileId = normalizeProfileId(gate?.activeProfileId);
  const activeProfileEmail = normalizeBackupImportEmail(gate?.activeProfileEmail) ?? normalizeBackupImportEmail(email);
  const authenticatedEmail = normalizeBackupImportEmail(gate?.authenticatedEmail) ?? normalizeBackupImportEmail(email);

  return {
    activeProfileId,
    activeProfileEmail,
    authenticatedEmail,
    hasGate: Boolean(activeProfileId || activeProfileEmail),
  };
}

function recordString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function recordEmail(value: unknown): string | null {
  return normalizeBackupImportEmail(recordString(value));
}

function userMatchesProfileGate(user: UserProfile, gate: ResolvedDataProfileGate): boolean {
  if (!gate.hasGate) return true;
  if (gate.activeProfileId && user.id === gate.activeProfileId) return true;

  const profileEmails = [user.email, user.celebrityEmail, user.silverseaEmail]
    .map((value) => normalizeBackupImportEmail(value))
    .filter((value): value is string => value !== null);

  return Boolean(gate.activeProfileEmail && profileEmails.includes(gate.activeProfileEmail));
}

function recordMatchesProfileGate(record: unknown, gate: ResolvedDataProfileGate, allowUnownedRecords: boolean): boolean {
  if (!gate.hasGate || !record || typeof record !== 'object') return true;

  const data = record as Record<string, unknown>;
  const ownerProfileId = recordString(data.ownerProfileId);
  const ownerProfileEmail = recordEmail(ownerProfileId);
  const ownerIds = [ownerProfileId].filter((value): value is string => value !== null && !value.includes('@'));
  const ownerEmails = [
    ownerProfileEmail,
    recordEmail(data.sourceEmail),
    recordEmail(data.dataOwnerEmail),
    recordEmail(data.ownerEmail),
    recordEmail(data.email),
    recordEmail(data.userId),
  ].filter((value): value is string => value !== null && value !== 'guest' && value !== 'local');
  const hasOwnershipClue = ownerIds.length > 0 || ownerEmails.length > 0 || Boolean(recordString(data.dataOwnerScopeId));

  if (gate.activeProfileId && ownerIds.length > 0) {
    return ownerIds.includes(gate.activeProfileId);
  }

  if (gate.activeProfileId && ownerIds.length === 0 && ownerProfileEmail && gate.activeProfileEmail) {
    return ownerProfileEmail === gate.activeProfileEmail;
  }

  if (gate.activeProfileEmail && ownerEmails.includes(gate.activeProfileEmail)) return true;

  return !hasOwnershipClue && allowUnownedRecords;
}

function filterRecordsForProfileGate<T extends object>(
  records: T[],
  label: string,
  gate: ResolvedDataProfileGate,
  allowUnownedRecords: boolean,
): T[] {
  if (!gate.hasGate) return records;

  const filteredRecords = records.filter((record) => recordMatchesProfileGate(record, gate, allowUnownedRecords));
  if (filteredRecords.length !== records.length) {
    console.warn('[DataBundle] Profile gate removed records outside active profile scope:', {
      label,
      original: records.length,
      filtered: filteredRecords.length,
      removed: records.length - filteredRecords.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return filteredRecords;
}

function filterRecordMapForProfileGate<T>(records: Record<string, T>, label: string, gate: ResolvedDataProfileGate): Record<string, T> {
  if (!gate.hasGate) return records;

  const entries = Object.entries(records).filter(([, value]) => recordMatchesProfileGate(value, gate, true));
  if (entries.length !== Object.keys(records).length) {
    console.warn('[DataBundle] Profile gate removed map entries outside active profile scope:', {
      label,
      original: Object.keys(records).length,
      filtered: entries.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return Object.fromEntries(entries);
}

function getActiveProfileFallbackId(gate: ResolvedDataProfileGate): string | null {
  return gate.activeProfileId ?? gate.activeProfileEmail;
}

function getActiveProfileFallbackEmail(gate: ResolvedDataProfileGate, email: string | null | undefined): string | null {
  return gate.activeProfileEmail ?? normalizeBackupImportEmail(email);
}

async function mergeWithExistingOutsideProfileGate<T extends object>(
  storageKey: string,
  importedRecords: T[],
  gate: ResolvedDataProfileGate,
  label: string,
): Promise<T[]> {
  if (!gate.hasGate) return importedRecords;

  const existingRecords = parseStoredArray<T>(await AsyncStorage.getItem(storageKey), `${label} existing records`);
  const preservedRecords = existingRecords.filter((record) => !recordMatchesProfileGate(record, gate, true));

  if (preservedRecords.length > 0) {
    console.log('[DataBundle] Preserved records outside active profile during backup restore:', {
      label,
      preserved: preservedRecords.length,
      imported: importedRecords.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return [...preservedRecords, ...importedRecords];
}

function adoptBackupRecordsForActiveAccount<T extends object>(records: T[], email: string | null | undefined, gate?: ResolvedDataProfileGate): T[] {
  const normalizedEmail = normalizeBackupImportEmail(email);
  const activeProfileId = gate?.activeProfileId ?? null;
  const activeProfileEmail = gate?.activeProfileEmail ?? normalizedEmail;
  const syncedAt = new Date().toISOString();

  return records.map((record) => {
    const nextRecord = { ...(record as Record<string, unknown>) };
    delete nextRecord.dataOwnerScopeId;

    if (normalizedEmail) {
      nextRecord.dataOwnerEmail = normalizedEmail;
      nextRecord.dataOwnerSyncedAt = syncedAt;
    } else {
      delete nextRecord.dataOwnerEmail;
      delete nextRecord.dataOwnerSyncedAt;
    }

    if (activeProfileId) {
      nextRecord.ownerProfileId = activeProfileId;
    }

    if (activeProfileEmail) {
      nextRecord.sourceEmail = activeProfileEmail;
    }

    return nextRecord as T;
  });
}

async function loadStoredEntriesByPrefix(prefix: string, email: string | null | undefined): Promise<Record<string, unknown>> {
  const normalizedEmail = normalizeBackupImportEmail(email);
  const allKeys = await AsyncStorage.getAllKeys();
  const matchingKeys = allKeys.filter((key) => {
    if (!key.startsWith(prefix)) return false;
    return normalizedEmail ? key.endsWith(`::${normalizedEmail}`) : true;
  });

  const entries = await Promise.all(
    matchingKeys.map(async (key) => {
      const value = await quotaSafeGetItem(key);
      if (value === null) return null;
      try {
        return [key, JSON.parse(value)] as const;
      } catch (error) {
        console.error('[DataBundle] Error parsing dynamic storage entry:', { key, error });
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, unknown] => entry !== null));
}

function resolveImportedDynamicKey(key: string, prefix: string, email: string | null | undefined): string | null {
  if (!key.startsWith(prefix)) return null;
  const unscopedKey = key.includes('::') ? key.slice(0, key.indexOf('::')) : key;
  return getUserScopedKey(unscopedKey, email ?? null);
}

function parseStoredArray<T>(rawValue: string | null, label: string): T[] {
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch (error) {
    console.error(`[DataBundle] Error parsing ${label}:`, error);
    return [];
  }
}

export interface FullAppDataBundle {
  version: string;
  exportDate: string;
  profileGate?: {
    authenticatedEmail?: string | null;
    activeProfileId?: string | null;
    activeProfileEmail?: string | null;
  };
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  casinoOffers: CasinoOffer[];
  calendarEvents: CalendarEvent[];
  casinoSessions: CasinoSession[];
  certificates: Certificate[];
  clubRoyaleProfile: ClubRoyaleProfile | null;
  settings: AppSettings | null;
  loyaltyData: {
    manualClubRoyalePoints: number | null;
    manualCrownAnchorPoints: number | null;
    userPoints: number | null;
  };
  extendedLoyaltyData?: Record<string, unknown> | null;
  milestoneState?: Record<string, unknown> | null;
  userProfile: {
    name: string;
    email?: string;
    crownAnchorNumber: string;
    clubRoyalePoints: number;
    loyaltyPoints: number;
    celebrityEmail?: string;
    celebrityCaptainsClubNumber?: string;
    celebrityCaptainsClubPoints?: number;
    celebrityBlueChipPoints?: number;
    preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
  } | null;
  users: UserProfile[];
  playingHours?: import('@/state/UserProvider').PlayingHours;
  machines: {
    encyclopedia: MachineEncyclopediaEntry[];
    atlasIds: string[];
    userMachines?: SlotMachine[];
    deckLocations?: DeckPlanLocation[];
  };
  crewRecognition: {
    entries: RecognitionEntryWithCrew[];
    sailings: Sailing[];
  };
  casinoData?: {
    sessions: CasinoSession[];
    bankrollLimits: BankrollLimit[];
    bankrollAlerts: BankrollAlert[];
    casinoOpenHours: Record<string, CasinoOpenHoursData>;
    compItems: CompItem[];
    w2gRecords: W2GRecord[];
    casinoPointSummary?: {
      totalCasinoPoints: number;
      totalCasinoCoinIn: number;
      cruisesWithCasinoPoints: number;
    };
    askMyDataOverview?: AskMyDataOverview;
  };
  metadata: {
    totalCruises: number;
    totalBooked: number;
    totalOffers: number;
    totalEvents: number;
    totalCertificates: number;
    totalSessions: number;
    totalMachines: number;
    totalCrewEntries: number;
    totalBankrollLimits?: number;
    totalCasinoOpenHours?: number;
    totalCompItems?: number;
    totalW2GRecords?: number;
    totalCasinoPoints?: number;
    totalCasinoCoinIn?: number;
    cruisesWithCasinoPoints?: number;
  };
}

export async function getAllStoredData(email?: string | null, profileGate?: DataProfileGate): Promise<FullAppDataBundle> {
  const resolvedGate = resolveDataProfileGate(email, profileGate);
  console.log('[DataBundle] Getting all stored data for email/profile gate:', {
    email: email || '(none)',
    activeProfileId: resolvedGate.activeProfileId,
    activeProfileEmail: resolvedGate.activeProfileEmail,
  });
  
  const sk = (baseKey: string): string => {
    if (GLOBAL_KEYS.has(baseKey)) return baseKey;
    return getUserScopedKey(baseKey, email ?? null);
  };

  try {
    const scopedUsersKey = email
      ? getUserScopedKey(ALL_STORAGE_KEYS.USERS, email.toLowerCase().trim())
      : ALL_STORAGE_KEYS.USERS;
    const extendedLoyaltyKey = sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA);
    const milestoneStateKey = sk(ALL_STORAGE_KEYS.MILESTONE_TIER_STATE);

    const [
      cruisesData,
      bookedData,
      offersData,
      eventsData,
      sessionsData,
      certificatesData,
      profileData,
      settingsData,
      manualClubRoyale,
      manualCrownAnchor,
      userPoints,
      scopedUsersData,
      machineEncyclopediaData,
      myAtlasData,
      currentMachineEncyclopediaData,
      currentMyAtlasData,
      crewEntriesData,
      crewSailingsData,
      extendedLoyaltyRaw,
      bankrollLimitsData,
      bankrollAlertsData,
      userSlotMachinesData,
      deckPlanLocationsData,
      compItemsData,
      w2gRecordsData,
      milestoneStateRaw,
    ] = await Promise.all([
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CRUISES)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CERTIFICATES)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.SETTINGS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.USER_POINTS)),
      AsyncStorage.getItem(scopedUsersKey),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS)),
      AsyncStorage.getItem(getUserScopedKey(CURRENT_MACHINE_ENCYCLOPEDIA_KEY, email ?? null)),
      AsyncStorage.getItem(getUserScopedKey(CURRENT_MY_SLOT_ATLAS_KEY, email ?? null)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS)),
      quotaSafeGetItem(extendedLoyaltyKey),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.COMP_ITEMS)),
      AsyncStorage.getItem(sk(ALL_STORAGE_KEYS.W2G_RECORDS)),
      quotaSafeGetItem(milestoneStateKey),
    ]);

    const usersData = scopedUsersData;
    console.log('[DataBundle] Users lookup: scopedKey=', scopedUsersKey, 'found=', !!scopedUsersData);

    let cruises: Cruise[] = [];
    let bookedCruises: BookedCruise[] = [];
    let casinoOffers: CasinoOffer[] = [];
    let calendarEvents: CalendarEvent[] = [];
    let casinoSessions: CasinoSession[] = [];
    let certificates: Certificate[] = [];
    let clubRoyaleProfile: ClubRoyaleProfile | null = null;
    let settings: AppSettings | null = null;
    let users: UserProfile[] = [];
    let machineEncyclopedia: MachineEncyclopediaEntry[] = [];
    let myAtlasIds: string[] = [];
    let userSlotMachines: SlotMachine[] = [];
    let deckPlanLocations: DeckPlanLocation[] = [];
    let crewEntries: RecognitionEntryWithCrew[] = [];
    let crewSailings: Sailing[] = [];
    let bankrollLimits: BankrollLimit[] = [];
    let bankrollAlerts: BankrollAlert[] = [];
    let compItems: CompItem[] = [];
    let w2gRecords: W2GRecord[] = [];
    let casinoOpenHours: Record<string, CasinoOpenHoursData> = {};
    
    try {
      cruises = cruisesData ? JSON.parse(cruisesData) : [];
      if (!Array.isArray(cruises)) cruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing cruises:', e);
      cruises = [];
    }

    try {
      bookedCruises = bookedData ? JSON.parse(bookedData) : [];
      if (!Array.isArray(bookedCruises)) bookedCruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing booked cruises:', e);
      bookedCruises = [];
    }

    try {
      casinoOffers = offersData ? JSON.parse(offersData) : [];
      if (!Array.isArray(casinoOffers)) casinoOffers = [];
      console.log('[DataBundle] Including all casino offers in full backup:', casinoOffers.length);
    } catch (e) {
      console.error('[DataBundle] Error parsing casino offers:', e);
      casinoOffers = [];
    }

    try {
      calendarEvents = eventsData ? JSON.parse(eventsData) : [];
      if (!Array.isArray(calendarEvents)) calendarEvents = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing calendar events:', e);
      calendarEvents = [];
    }

    try {
      casinoSessions = sessionsData ? JSON.parse(sessionsData) : [];
      if (!Array.isArray(casinoSessions)) casinoSessions = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing casino sessions:', e);
      casinoSessions = [];
    }

    try {
      certificates = certificatesData ? JSON.parse(certificatesData) : [];
      if (!Array.isArray(certificates)) certificates = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing certificates:', e);
      certificates = [];
    }

    try {
      clubRoyaleProfile = profileData ? JSON.parse(profileData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing club profile:', e);
      clubRoyaleProfile = null;
    }

    try {
      settings = settingsData ? JSON.parse(settingsData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing settings:', e);
      settings = null;
    }

    try {
      users = usersData ? JSON.parse(usersData) : [];
      if (!Array.isArray(users)) users = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing users:', e);
      users = [];
    }

    try {
      const activeMachineData = currentMachineEncyclopediaData ?? machineEncyclopediaData;
      machineEncyclopedia = activeMachineData ? JSON.parse(activeMachineData) : [];
      if (!Array.isArray(machineEncyclopedia)) machineEncyclopedia = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing machine encyclopedia:', e);
      machineEncyclopedia = [];
    }

    try {
      const activeAtlasData = currentMyAtlasData ?? myAtlasData;
      myAtlasIds = activeAtlasData ? JSON.parse(activeAtlasData) : [];
      if (!Array.isArray(myAtlasIds)) myAtlasIds = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing atlas IDs:', e);
      myAtlasIds = [];
    }

    userSlotMachines = parseStoredArray<SlotMachine>(userSlotMachinesData, 'user slot machines');
    deckPlanLocations = parseStoredArray<DeckPlanLocation>(deckPlanLocationsData, 'deck plan locations');
    bankrollLimits = parseStoredArray<BankrollLimit>(bankrollLimitsData, 'bankroll limits');
    bankrollAlerts = parseStoredArray<BankrollAlert>(bankrollAlertsData, 'bankroll alerts');
    compItems = parseStoredArray<CompItem>(compItemsData, 'comp items');
    w2gRecords = parseStoredArray<W2GRecord>(w2gRecordsData, 'W-2G records');

    try {
      casinoOpenHours = await loadStoredEntriesByPrefix(CASINO_OPEN_HOURS_STORAGE_PREFIX, email ?? null) as Record<string, CasinoOpenHoursData>;
    } catch (e) {
      console.error('[DataBundle] Error loading casino open hours:', e);
      casinoOpenHours = {};
    }

    try {
      crewEntries = crewEntriesData ? JSON.parse(crewEntriesData) : [];
      if (!Array.isArray(crewEntries)) crewEntries = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing crew entries:', e);
      crewEntries = [];
    }

    try {
      crewSailings = crewSailingsData ? JSON.parse(crewSailingsData) : [];
      if (!Array.isArray(crewSailings)) crewSailings = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing crew sailings:', e);
      crewSailings = [];
    }

    const clubRoyalePoints = manualClubRoyale ? parseInt(manualClubRoyale, 10) : 0;
    const loyaltyPoints = manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : 0;

    let extendedLoyaltyData: Record<string, unknown> | null = null;
    try {
      if (extendedLoyaltyRaw) {
        extendedLoyaltyData = JSON.parse(extendedLoyaltyRaw) as Record<string, unknown>;
        console.log('[DataBundle] Found extended loyalty data with keys:', Object.keys(extendedLoyaltyData));
      }
    } catch (e) {
      console.error('[DataBundle] Error parsing extended loyalty data:', e);
    }

    let milestoneState: Record<string, unknown> | null = null;
    try {
      if (milestoneStateRaw) {
        milestoneState = JSON.parse(milestoneStateRaw) as Record<string, unknown>;
      }
    } catch (e) {
      console.error('[DataBundle] Error parsing milestone state:', e);
    }

    cruises = dedupeCruises(filterRecordsForProfileGate(cruises, 'export cruises', resolvedGate, true), 'export cruises');
    bookedCruises = normalizeCruisesWithCasinoEconomics(
      dedupeBookedCruises(filterRecordsForProfileGate(bookedCruises, 'export booked cruises', resolvedGate, true), 'export booked cruises').map(normalizeCruiseCasinoPerformance),
      { includeKnownAnnualFacts: isKnownCasinoProfile(email) },
    );
    casinoOffers = dedupeCasinoOffers(filterRecordsForProfileGate(casinoOffers, 'export casino offers', resolvedGate, true), 'export casino offers');
    calendarEvents = dedupeCalendarEvents(filterRecordsForProfileGate(calendarEvents, 'export calendar events', resolvedGate, true), 'export calendar events');
    casinoSessions = filterRecordsForProfileGate(casinoSessions, 'export casino sessions', resolvedGate, true);
    certificates = filterRecordsForProfileGate(certificates, 'export certificates', resolvedGate, true);
    // Include ALL users stored under this account's key - the second user belongs to the primary account holder.
    // Only filter when a specific activeProfileId is requested (single-profile export).
    if (resolvedGate.activeProfileId) {
      users = users.filter((user) => userMatchesProfileGate(user, resolvedGate));
    }
    console.log('[DataBundle] Including users in export:', users.length, users.map(u => ({ id: u.id, name: u.name, isOwner: u.isOwner })));
    const ownerUser = users.find(u => u.id === resolvedGate.activeProfileId) || users.find(u => u.isOwner) || users[0];
    const userProfile = ownerUser ? {
      name: ownerUser.name || '',
      email: ownerUser.email || '',
      crownAnchorNumber: ownerUser.crownAnchorNumber || '',
      clubRoyalePoints,
      loyaltyPoints,
      celebrityEmail: ownerUser.celebrityEmail || '',
      celebrityCaptainsClubNumber: ownerUser.celebrityCaptainsClubNumber || '',
      celebrityCaptainsClubPoints: ownerUser.celebrityCaptainsClubPoints || 0,
      celebrityBlueChipPoints: ownerUser.celebrityBlueChipPoints || 0,
      preferredBrand: ownerUser.preferredBrand || 'royal',
    } : null;
    const playingHours = ownerUser?.playingHours;
    machineEncyclopedia = filterRecordsForProfileGate(machineEncyclopedia, 'export machine encyclopedia', resolvedGate, true);
    userSlotMachines = filterRecordsForProfileGate(userSlotMachines, 'export user slot machines', resolvedGate, true);
    deckPlanLocations = filterRecordsForProfileGate(deckPlanLocations, 'export deck plan locations', resolvedGate, true);
    crewEntries = filterRecordsForProfileGate(crewEntries, 'export crew entries', resolvedGate, true);
    crewSailings = filterRecordsForProfileGate(crewSailings, 'export crew sailings', resolvedGate, true);
    bankrollLimits = filterRecordsForProfileGate(bankrollLimits, 'export bankroll limits', resolvedGate, true);
    bankrollAlerts = filterRecordsForProfileGate(bankrollAlerts, 'export bankroll alerts', resolvedGate, true);
    compItems = filterRecordsForProfileGate(compItems, 'export comp items', resolvedGate, true);
    w2gRecords = filterRecordsForProfileGate(w2gRecords, 'export W-2G records', resolvedGate, true);
    casinoOpenHours = filterRecordMapForProfileGate(casinoOpenHours, 'export casino open hours', resolvedGate);
    const totalCasinoPoints = bookedCruises.reduce((sum, cruise) => sum + getBookedCruiseCasinoPoints(cruise), 0);
    const casinoPointSummary = {
      totalCasinoPoints,
      totalCasinoCoinIn: totalCasinoPoints * 5,
      cruisesWithCasinoPoints: bookedCruises.filter((cruise) => getBookedCruiseCasinoPoints(cruise) > 0).length,
    };
    const askMyDataOverview = buildAskMyDataOverview({
      bookedCruises,
      casinoSessions,
      currentTier: clubRoyaleProfile?.tier ?? null,
      currentPoints: clubRoyalePoints,
      pointBalanceSource: 'backup-export',
      useKnownAnnualReportFacts: isKnownCasinoProfile(email),
    });

    const bundle: FullAppDataBundle = {
      version: '2.2.0',
      exportDate: new Date().toISOString(),
      profileGate: resolvedGate.hasGate ? {
        authenticatedEmail: resolvedGate.authenticatedEmail,
        activeProfileId: resolvedGate.activeProfileId,
        activeProfileEmail: resolvedGate.activeProfileEmail,
      } : undefined,
      cruises,
      bookedCruises,
      casinoOffers,
      calendarEvents,
      casinoSessions,
      certificates,
      clubRoyaleProfile,
      settings,
      loyaltyData: {
        manualClubRoyalePoints: manualClubRoyale ? parseInt(manualClubRoyale, 10) : null,
        manualCrownAnchorPoints: manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : null,
        userPoints: userPoints ? parseInt(userPoints, 10) : null,
      },
      extendedLoyaltyData,
      milestoneState,
      userProfile,
      users,
      playingHours,
      machines: {
        encyclopedia: machineEncyclopedia,
        atlasIds: myAtlasIds,
        userMachines: userSlotMachines,
        deckLocations: deckPlanLocations,
      },
      crewRecognition: {
        entries: crewEntries,
        sailings: crewSailings,
      },
      casinoData: {
        sessions: casinoSessions,
        bankrollLimits,
        bankrollAlerts,
        casinoOpenHours,
        compItems,
        w2gRecords,
        casinoPointSummary,
        askMyDataOverview,
      },
      metadata: {
        totalCruises: cruises.length,
        totalBooked: bookedCruises.length,
        totalOffers: casinoOffers.length,
        totalEvents: calendarEvents.length,
        totalCertificates: certificates.length,
        totalSessions: casinoSessions.length,
        totalMachines: myAtlasIds.length || machineEncyclopedia.length,
        totalCrewEntries: crewEntries.length,
        totalBankrollLimits: bankrollLimits.length,
        totalCasinoOpenHours: Object.keys(casinoOpenHours).length,
        totalCompItems: compItems.length,
        totalW2GRecords: w2gRecords.length,
        totalCasinoPoints: casinoPointSummary.totalCasinoPoints,
        totalCasinoCoinIn: casinoPointSummary.totalCasinoCoinIn,
        cruisesWithCasinoPoints: casinoPointSummary.cruisesWithCasinoPoints,
      },
    };

    console.log('[DataBundle] Retrieved data:', bundle.metadata);
    console.log('[DataBundle] User profile:', userProfile);
    return bundle;
  } catch (error) {
    console.error('[DataBundle] Error getting all data:', error);
    throw error;
  }
}

export async function importAllData(bundle: FullAppDataBundle, email?: string | null, profileGate?: DataProfileGate): Promise<{
  success: boolean;
  imported: {
    cruises: number;
    bookedCruises: number;
    casinoOffers: number;
    calendarEvents: number;
    casinoSessions: number;
    certificates: number;
    machines: number;
    crewRecognitionEntries: number;
    bankrollLimits: number;
    casinoOpenHours: number;
    compItems: number;
    w2gRecords: number;
  };
  errors: string[];
}> {
  const resolvedGate = resolveDataProfileGate(email, profileGate ?? bundle.profileGate);
  const activeProfileFallbackId = getActiveProfileFallbackId(resolvedGate);
  const activeProfileFallbackEmail = getActiveProfileFallbackEmail(resolvedGate, email);
  console.log('[DataBundle] Importing all data for email/profile gate:', {
    email: email || '(none)',
    activeProfileId: resolvedGate.activeProfileId,
    activeProfileEmail: resolvedGate.activeProfileEmail,
  });
  const errors: string[] = [];
  const importTimestamp = new Date().toISOString();
  const imported = {
    cruises: 0,
    bookedCruises: 0,
    casinoOffers: 0,
    calendarEvents: 0,
    casinoSessions: 0,
    certificates: 0,
    machines: 0,
    crewRecognitionEntries: 0,
    bankrollLimits: 0,
    casinoOpenHours: 0,
    compItems: 0,
    w2gRecords: 0,
  };

  const sk = (baseKey: string): string => {
    if (GLOBAL_KEYS.has(baseKey)) return baseKey;
    return getUserScopedKey(baseKey, email ?? null);
  };

  let importedBookedForCalendar: BookedCruise[] = [];

  try {
    if (bundle.cruises && Array.isArray(bundle.cruises)) {
      const gatedCruises = filterRecordsForProfileGate(bundle.cruises, 'backup cruises', resolvedGate, true);
      const adoptedCruises = adoptBackupRecordsForActiveAccount(gatedCruises, email, resolvedGate);
      const foundationCruises = applyFoundationFields(adoptedCruises, {
        fallbackOwnerProfileId: activeProfileFallbackId,
        fallbackSourceEmail: activeProfileFallbackEmail,
        markUnassigned: true,
      });
      const dedupedCruises = dedupeCruises(foundationCruises, 'backup cruises');
      const mergedCruises = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CRUISES), dedupedCruises, resolvedGate, 'backup cruises');
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CRUISES), mergedCruises);
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.cruises = dedupedCruises.length;
      console.log('[DataBundle] Imported cruises:', imported.cruises);
    }
  } catch (error) {
    errors.push(`Failed to import cruises: ${error}`);
  }

  try {
    if (bundle.bookedCruises && Array.isArray(bundle.bookedCruises)) {
      const gatedBooked = filterRecordsForProfileGate(bundle.bookedCruises, 'backup booked cruises', resolvedGate, true);
      const adoptedBooked = adoptBackupRecordsForActiveAccount(gatedBooked, email, resolvedGate);
      const foundationBooked = applyFoundationFields(adoptedBooked, {
        fallbackOwnerProfileId: activeProfileFallbackId,
        fallbackSourceEmail: activeProfileFallbackEmail,
        markUnassigned: true,
      });
      const dedupedBooked = dedupeBookedCruises(foundationBooked, 'backup booked cruises');
      const enrichedBooked = normalizeCruisesWithCasinoEconomics(
        applyKnownRetailValuesToBooked(dedupedBooked).map(normalizeCruiseCasinoPerformance),
        { includeKnownAnnualFacts: isKnownCasinoProfile(email) },
      );
      const mergedBooked = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES), enrichedBooked, resolvedGate, 'backup booked cruises');
      importedBookedForCalendar = enrichedBooked;
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES), mergedBooked);
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.bookedCruises = enrichedBooked.length;
      console.log('[DataBundle] Imported booked cruises:', imported.bookedCruises);
    }
  } catch (error) {
    errors.push(`Failed to import booked cruises: ${error}`);
  }

  try {
    if (bundle.casinoOffers && Array.isArray(bundle.casinoOffers)) {
      const gatedOffers = filterRecordsForProfileGate(bundle.casinoOffers, 'backup casino offers', resolvedGate, true);
      const adoptedOffers = adoptBackupRecordsForActiveAccount(gatedOffers, email, resolvedGate);
      const foundationOffers = applyFoundationFields(adoptedOffers, {
        fallbackOwnerProfileId: activeProfileFallbackId,
        fallbackSourceEmail: activeProfileFallbackEmail,
        markUnassigned: true,
      });
      const dedupedOffers = dedupeCasinoOffers(foundationOffers, 'backup casino offers');
      const mergedOffers = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CASINO_OFFERS), dedupedOffers, resolvedGate, 'backup casino offers');
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS), mergedOffers);
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.casinoOffers = dedupedOffers.length;
      console.log('[DataBundle] Imported casino offers:', imported.casinoOffers);
    }
  } catch (error) {
    errors.push(`Failed to import casino offers: ${error}`);
  }

  try {
    if (bundle.calendarEvents && Array.isArray(bundle.calendarEvents)) {
      const generatedCruiseEvents = generateCruiseCalendarEvents(importedBookedForCalendar);
      const gatedCalendarEvents = filterRecordsForProfileGate(bundle.calendarEvents, 'backup calendar events', resolvedGate, true);
      const adoptedCalendarEvents = adoptBackupRecordsForActiveAccount(gatedCalendarEvents, email, resolvedGate);
      const adoptedGeneratedCruiseEvents = adoptBackupRecordsForActiveAccount(generatedCruiseEvents, email, resolvedGate);
      const foundationEvents = applyFoundationFields([...adoptedCalendarEvents, ...adoptedGeneratedCruiseEvents], {
        fallbackOwnerProfileId: activeProfileFallbackId,
        fallbackSourceEmail: activeProfileFallbackEmail,
        markUnassigned: true,
      });
      const dedupedEvents = dedupeCalendarEvents(foundationEvents, 'backup calendar events');
      const mergedEvents = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS), dedupedEvents, resolvedGate, 'backup calendar events');
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS), mergedEvents);
      imported.calendarEvents = dedupedEvents.length;
      console.log('[DataBundle] Imported calendar events:', {
        importedCalendarEvents: bundle.calendarEvents.length,
        generatedCruiseEvents: generatedCruiseEvents.length,
        savedEvents: imported.calendarEvents,
      });
    }
  } catch (error) {
    errors.push(`Failed to import calendar events: ${error}`);
  }

  try {
    const sourceSessions = bundle.casinoData?.sessions ?? bundle.casinoSessions;
    if (sourceSessions && Array.isArray(sourceSessions)) {
      const gatedSessions = filterRecordsForProfileGate(sourceSessions, 'casinoSessions', resolvedGate, true);
      const adoptedSessions = adoptBackupRecordsForActiveAccount(gatedSessions, email, resolvedGate);
      const dedupedSessions = dedupeByIdOrPayload(adoptedSessions, 'casinoSessions');
      const mergedSessions = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS), dedupedSessions, resolvedGate, 'casinoSessions');
      await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS), JSON.stringify(mergedSessions));
      imported.casinoSessions = dedupedSessions.length;
      console.log('[DataBundle] Imported casino sessions:', imported.casinoSessions);
    }
  } catch (error) {
    errors.push(`Failed to import casino sessions: ${error}`);
  }

  try {
    if (bundle.certificates && Array.isArray(bundle.certificates)) {
      const gatedCertificates = filterRecordsForProfileGate(bundle.certificates, 'certificates', resolvedGate, true);
      const adoptedCertificates = adoptBackupRecordsForActiveAccount(gatedCertificates, email, resolvedGate);
      const dedupedCertificates = dedupeByIdOrPayload(adoptedCertificates, 'certificates');
      const mergedCertificates = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CERTIFICATES), dedupedCertificates, resolvedGate, 'certificates');
      await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CERTIFICATES), JSON.stringify(mergedCertificates));
      imported.certificates = dedupedCertificates.length;
      console.log('[DataBundle] Imported certificates:', imported.certificates);
    }
  } catch (error) {
    errors.push(`Failed to import certificates: ${error}`);
  }

  try {
    if (bundle.clubRoyaleProfile) {
      await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE), JSON.stringify(bundle.clubRoyaleProfile));
      console.log('[DataBundle] Imported club profile');
    }
  } catch (error) {
    errors.push(`Failed to import club profile: ${error}`);
  }

  try {
    if (bundle.settings) {
      await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.SETTINGS), JSON.stringify(bundle.settings));
      console.log('[DataBundle] Imported settings');
    }
  } catch (error) {
    errors.push(`Failed to import settings: ${error}`);
  }

  try {
    if (bundle.loyaltyData) {
      if (bundle.loyaltyData.manualClubRoyalePoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS), 
          bundle.loyaltyData.manualClubRoyalePoints.toString()
        );
      }
      if (bundle.loyaltyData.manualCrownAnchorPoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS), 
          bundle.loyaltyData.manualCrownAnchorPoints.toString()
        );
      }
      if (bundle.loyaltyData.userPoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.USER_POINTS), 
          bundle.loyaltyData.userPoints.toString()
        );
      }
      console.log('[DataBundle] Imported loyalty data');
    }
  } catch (error) {
    errors.push(`Failed to import loyalty data: ${error}`);
  }

  try {
    if (bundle.milestoneState && typeof bundle.milestoneState === 'object') {
      await quotaSafeSetJsonItem(
        sk(ALL_STORAGE_KEYS.MILESTONE_TIER_STATE),
        bundle.milestoneState
      );
      console.log('[DataBundle] Imported milestone tier state');
    }
  } catch (error) {
    errors.push(`Failed to import milestone tier state: ${error}`);
  }

  try {
    if (bundle.extendedLoyaltyData && typeof bundle.extendedLoyaltyData === 'object') {
      await quotaSafeSetJsonItem(
        sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA),
        bundle.extendedLoyaltyData
      );
      console.log('[DataBundle] Imported extended loyalty data:', Object.keys(bundle.extendedLoyaltyData));
    }
  } catch (error) {
    errors.push(`Failed to import extended loyalty data: ${error}`);
  }

  try {
    let usersToImport: UserProfile[] | null = null;
    
    if (bundle.users && Array.isArray(bundle.users) && bundle.users.length > 0) {
      console.log('[DataBundle] Found users array with', bundle.users.length, 'users');
      console.log('[DataBundle] Users data:', JSON.stringify(bundle.users.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber, birthdate: u.birthdate, playingHours: !!u.playingHours }))));
      // Include ALL users from the bundle - the second user belongs to the primary account holder.
      // Only filter when a specific activeProfileId is requested (single-profile import).
      if (resolvedGate.activeProfileId) {
        usersToImport = bundle.users.filter((user) => userMatchesProfileGate(user, resolvedGate));
      } else {
        usersToImport = bundle.users;
      }
    } else if (bundle.userProfile && (bundle.userProfile.name || bundle.userProfile.crownAnchorNumber)) {
      console.log('[DataBundle] No users array, creating from userProfile:', JSON.stringify(bundle.userProfile));
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: `user_${Date.now()}`,
        name: bundle.userProfile.name || '',
        email: bundle.userProfile.email || '',
        isOwner: true,
        crownAnchorNumber: bundle.userProfile.crownAnchorNumber || '',
        celebrityEmail: bundle.userProfile.celebrityEmail,
        celebrityCaptainsClubNumber: bundle.userProfile.celebrityCaptainsClubNumber,
        celebrityCaptainsClubPoints: bundle.userProfile.celebrityCaptainsClubPoints,
        celebrityBlueChipPoints: bundle.userProfile.celebrityBlueChipPoints,
        preferredBrand: bundle.userProfile.preferredBrand,
        playingHours: bundle.playingHours,
        createdAt: now,
        updatedAt: now,
      };
      usersToImport = [newUser];
      console.log('[DataBundle] Created user from userProfile:', newUser.name, 'C&A:', newUser.crownAnchorNumber, 'with playing hours');
    } else {
      console.log('[DataBundle] No user data to import - neither users array nor userProfile with data');
    }
    
    if (usersToImport && usersToImport.length > 0) {
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      
      if (normalizedEmail) {
        usersToImport = usersToImport.map(u => ({
          ...u,
          id: resolvedGate.activeProfileId ?? u.id,
          email: resolvedGate.activeProfileEmail ?? normalizedEmail,
          isOwner: resolvedGate.activeProfileId ? true : u.isOwner,
        }));
      }

      const scopedUsersKey = normalizedEmail
        ? getUserScopedKey(ALL_STORAGE_KEYS.USERS, normalizedEmail)
        : ALL_STORAGE_KEYS.USERS;
      const scopedCurrentUserKey = normalizedEmail
        ? getUserScopedKey(ALL_STORAGE_KEYS.CURRENT_USER, normalizedEmail)
        : ALL_STORAGE_KEYS.CURRENT_USER;

      const existingUsers = parseStoredArray<UserProfile>(await AsyncStorage.getItem(scopedUsersKey), 'existing users');
      const preservedUsers = resolvedGate.hasGate
        ? existingUsers.filter((user) => !userMatchesProfileGate(user, resolvedGate))
        : [];
      const mergedUsers = [...preservedUsers, ...usersToImport];

      await AsyncStorage.setItem(scopedUsersKey, JSON.stringify(mergedUsers));
      console.log('[DataBundle] Successfully imported', usersToImport.length, 'active-profile users to scoped storage key:', scopedUsersKey);
      console.log('[DataBundle] Imported users:', JSON.stringify(usersToImport.map(u => ({ id: u.id, name: u.name, email: u.email, crownAnchorNumber: u.crownAnchorNumber, birthdate: u.birthdate, hasPlayingHours: !!u.playingHours }))));
      
      const ownerUser = usersToImport.find(u => u.id === resolvedGate.activeProfileId) || usersToImport.find(u => u.isOwner) || usersToImport[0];
      if (ownerUser) {
        await AsyncStorage.setItem(scopedCurrentUserKey, ownerUser.id);
        console.log('[DataBundle] Set current user to:', ownerUser.id, ownerUser.name);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing users:', error);
    errors.push(`Failed to import users: ${error}`);
  }

  try {
    if (bundle.machines) {
      if (bundle.machines.encyclopedia && Array.isArray(bundle.machines.encyclopedia)) {
        const gatedMachineEntries = filterRecordsForProfileGate(bundle.machines.encyclopedia, 'machineEncyclopedia', resolvedGate, true);
        const adoptedMachineEntries = adoptBackupRecordsForActiveAccount(gatedMachineEntries, email, resolvedGate);
        const dedupedMachineEntries = dedupeByIdOrPayload(adoptedMachineEntries, 'machineEncyclopedia');
        const mergedMachineEntries = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA), dedupedMachineEntries, resolvedGate, 'machineEncyclopedia');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA), JSON.stringify(mergedMachineEntries));
        await AsyncStorage.setItem(getUserScopedKey(CURRENT_MACHINE_ENCYCLOPEDIA_KEY, email ?? null), JSON.stringify(mergedMachineEntries));
        imported.machines = dedupedMachineEntries.length;
        console.log('[DataBundle] Imported machine encyclopedia:', dedupedMachineEntries.length);
      }
      if (bundle.machines.atlasIds && Array.isArray(bundle.machines.atlasIds)) {
        const dedupedAtlasIds = Array.from(new Set(bundle.machines.atlasIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS), JSON.stringify(dedupedAtlasIds));
        await AsyncStorage.setItem(getUserScopedKey(CURRENT_MY_SLOT_ATLAS_KEY, email ?? null), JSON.stringify(dedupedAtlasIds));
        imported.machines = imported.machines || dedupedAtlasIds.length;
        console.log('[DataBundle] Imported slot atlas:', dedupedAtlasIds.length, 'machines');
      }
      if (bundle.machines.userMachines && Array.isArray(bundle.machines.userMachines)) {
        const gatedUserMachines = filterRecordsForProfileGate(bundle.machines.userMachines, 'userSlotMachines', resolvedGate, true);
        const adoptedUserMachines = adoptBackupRecordsForActiveAccount(gatedUserMachines, email, resolvedGate);
        const dedupedUserMachines = dedupeByIdOrPayload(adoptedUserMachines, 'userSlotMachines');
        const mergedUserMachines = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES), dedupedUserMachines, resolvedGate, 'userSlotMachines');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES), JSON.stringify(mergedUserMachines));
        console.log('[DataBundle] Imported user slot machines:', dedupedUserMachines.length);
      }
      if (bundle.machines.deckLocations && Array.isArray(bundle.machines.deckLocations)) {
        const gatedDeckLocations = filterRecordsForProfileGate(bundle.machines.deckLocations, 'deckPlanLocations', resolvedGate, true);
        const adoptedDeckLocations = adoptBackupRecordsForActiveAccount(gatedDeckLocations, email, resolvedGate);
        const dedupedDeckLocations = dedupeByIdOrPayload(adoptedDeckLocations, 'deckPlanLocations');
        const mergedDeckLocations = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS), dedupedDeckLocations, resolvedGate, 'deckPlanLocations');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS), JSON.stringify(mergedDeckLocations));
        console.log('[DataBundle] Imported deck plan locations:', dedupedDeckLocations.length);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing machines:', error);
    errors.push(`Failed to import machines: ${error}`);
  }

  try {
    if (bundle.crewRecognition) {
      if (bundle.crewRecognition.entries && Array.isArray(bundle.crewRecognition.entries)) {
        const gatedCrewEntries = filterRecordsForProfileGate(bundle.crewRecognition.entries, 'crewRecognitionEntries', resolvedGate, true);
        const adoptedCrewEntries = adoptBackupRecordsForActiveAccount(gatedCrewEntries, email, resolvedGate);
        const dedupedCrewEntries = dedupeByIdOrPayload(adoptedCrewEntries, 'crewRecognitionEntries');
        const mergedCrewEntries = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES), dedupedCrewEntries, resolvedGate, 'crewRecognitionEntries');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES), JSON.stringify(mergedCrewEntries));
        imported.crewRecognitionEntries = dedupedCrewEntries.length;
        console.log('[DataBundle] Imported crew recognition entries:', dedupedCrewEntries.length);
      }
      if (bundle.crewRecognition.sailings && Array.isArray(bundle.crewRecognition.sailings)) {
        const gatedCrewSailings = filterRecordsForProfileGate(bundle.crewRecognition.sailings, 'crewRecognitionSailings', resolvedGate, true);
        const adoptedCrewSailings = adoptBackupRecordsForActiveAccount(gatedCrewSailings, email, resolvedGate);
        const dedupedCrewSailings = dedupeByIdOrPayload(adoptedCrewSailings, 'crewRecognitionSailings');
        const mergedCrewSailings = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS), dedupedCrewSailings, resolvedGate, 'crewRecognitionSailings');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS), JSON.stringify(mergedCrewSailings));
        console.log('[DataBundle] Imported crew recognition sailings:', dedupedCrewSailings.length);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing crew recognition:', error);
    errors.push(`Failed to import crew recognition: ${error}`);
  }

  try {
    if (bundle.casinoData) {
      if (bundle.casinoData.bankrollLimits && Array.isArray(bundle.casinoData.bankrollLimits)) {
        const gatedBankrollLimits = filterRecordsForProfileGate(bundle.casinoData.bankrollLimits, 'bankrollLimits', resolvedGate, true);
        const adoptedBankrollLimits = adoptBackupRecordsForActiveAccount(gatedBankrollLimits, email, resolvedGate);
        const dedupedBankrollLimits = dedupeByIdOrPayload(adoptedBankrollLimits, 'bankrollLimits');
        const mergedBankrollLimits = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS), dedupedBankrollLimits, resolvedGate, 'bankrollLimits');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS), JSON.stringify(mergedBankrollLimits));
        imported.bankrollLimits = dedupedBankrollLimits.length;
        console.log('[DataBundle] Imported bankroll limits:', imported.bankrollLimits);
      }

      if (bundle.casinoData.bankrollAlerts && Array.isArray(bundle.casinoData.bankrollAlerts)) {
        const gatedBankrollAlerts = filterRecordsForProfileGate(bundle.casinoData.bankrollAlerts, 'bankrollAlerts', resolvedGate, true);
        const adoptedBankrollAlerts = adoptBackupRecordsForActiveAccount(gatedBankrollAlerts, email, resolvedGate);
        const dedupedBankrollAlerts = dedupeByIdOrPayload(adoptedBankrollAlerts, 'bankrollAlerts');
        const mergedBankrollAlerts = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS), dedupedBankrollAlerts, resolvedGate, 'bankrollAlerts');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS), JSON.stringify(mergedBankrollAlerts));
        console.log('[DataBundle] Imported bankroll alerts:', dedupedBankrollAlerts.length);
      }

      if (bundle.casinoData.compItems && Array.isArray(bundle.casinoData.compItems)) {
        const gatedCompItems = filterRecordsForProfileGate(bundle.casinoData.compItems, 'compItems', resolvedGate, true);
        const adoptedCompItems = adoptBackupRecordsForActiveAccount(gatedCompItems, email, resolvedGate);
        const dedupedCompItems = dedupeByIdOrPayload(adoptedCompItems, 'compItems');
        const mergedCompItems = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.COMP_ITEMS), dedupedCompItems, resolvedGate, 'compItems');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.COMP_ITEMS), JSON.stringify(mergedCompItems));
        imported.compItems = dedupedCompItems.length;
        console.log('[DataBundle] Imported comp items:', imported.compItems);
      }

      if (bundle.casinoData.w2gRecords && Array.isArray(bundle.casinoData.w2gRecords)) {
        const gatedW2GRecords = filterRecordsForProfileGate(bundle.casinoData.w2gRecords, 'w2gRecords', resolvedGate, true);
        const adoptedW2GRecords = adoptBackupRecordsForActiveAccount(gatedW2GRecords, email, resolvedGate);
        const dedupedW2GRecords = dedupeByIdOrPayload(adoptedW2GRecords, 'w2gRecords');
        const mergedW2GRecords = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.W2G_RECORDS), dedupedW2GRecords, resolvedGate, 'w2gRecords');
        await AsyncStorage.setItem(sk(ALL_STORAGE_KEYS.W2G_RECORDS), JSON.stringify(mergedW2GRecords));
        imported.w2gRecords = dedupedW2GRecords.length;
        console.log('[DataBundle] Imported W-2G records:', imported.w2gRecords);
      }

      if (bundle.casinoData.casinoOpenHours && typeof bundle.casinoData.casinoOpenHours === 'object') {
        const gatedCasinoOpenHours = filterRecordMapForProfileGate(bundle.casinoData.casinoOpenHours, 'casinoOpenHours', resolvedGate);
        const saveOpenHoursEntries = Object.entries(gatedCasinoOpenHours).map(async ([key, value]) => {
          const scopedKey = resolveImportedDynamicKey(key, CASINO_OPEN_HOURS_STORAGE_PREFIX, email ?? null);
          if (!scopedKey) return;
          await quotaSafeSetJsonItem(scopedKey, value);
        });
        await Promise.all(saveOpenHoursEntries);
        imported.casinoOpenHours = Object.keys(gatedCasinoOpenHours).length;
        console.log('[DataBundle] Imported casino open-hours records:', imported.casinoOpenHours);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing casino detail data:', error);
    errors.push(`Failed to import casino detail data: ${error}`);
  }

  try {
    await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.LAST_SYNC), importTimestamp);
    await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
    console.log('[DataBundle] Marked imported backup as latest local state:', importTimestamp);
  } catch (error) {
    errors.push(`Failed to finalize import timestamp: ${error}`);
  }

  const success = errors.length === 0;
  console.log('[DataBundle] Import complete:', { success, imported, errorCount: errors.length });
  
  return { success, imported, errors };
}

export async function getDataSummary(): Promise<{
  cruises: number;
  bookedCruises: number;
  offers: number;
  events: number;
  casinoSessions: number;
  certificates: number;
  hasProfile: boolean;
  hasSettings: boolean;
  hasLoyaltyData: boolean;
  machines: number;
  crewRecognitionEntries: number;
  bankrollLimits: number;
  casinoOpenHours: number;
  compItems: number;
  w2gRecords: number;
}> {
  try {
    const bundle = await getAllStoredData();
    return {
      cruises: bundle.metadata.totalCruises,
      bookedCruises: bundle.metadata.totalBooked,
      offers: bundle.metadata.totalOffers,
      events: bundle.metadata.totalEvents,
      casinoSessions: bundle.metadata.totalSessions,
      certificates: bundle.metadata.totalCertificates,
      hasProfile: bundle.clubRoyaleProfile !== null,
      hasSettings: bundle.settings !== null,
      hasLoyaltyData: bundle.loyaltyData.manualClubRoyalePoints !== null || 
                      bundle.loyaltyData.manualCrownAnchorPoints !== null,
      machines: bundle.metadata.totalMachines,
      crewRecognitionEntries: bundle.metadata.totalCrewEntries,
      bankrollLimits: bundle.metadata.totalBankrollLimits ?? 0,
      casinoOpenHours: bundle.metadata.totalCasinoOpenHours ?? 0,
      compItems: bundle.metadata.totalCompItems ?? 0,
      w2gRecords: bundle.metadata.totalW2GRecords ?? 0,
    };
  } catch (error) {
    console.error('[DataBundle] Error getting data summary:', error);
    return {
      cruises: 0,
      bookedCruises: 0,
      offers: 0,
      events: 0,
      casinoSessions: 0,
      certificates: 0,
      hasProfile: false,
      hasSettings: false,
      hasLoyaltyData: false,
      machines: 0,
      crewRecognitionEntries: 0,
      bankrollLimits: 0,
      casinoOpenHours: 0,
      compItems: 0,
      w2gRecords: 0,
    };
  }
}
