import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { containsKnownForeignPersonalData, filterRecordsForOwner, isOwnerScopeForEmail, stampRecordsForOwner } from "@/lib/storage/dataOwnership";
import { dedupeBookedCruises, dedupeCalendarEvents, dedupeCasinoOffers, dedupeCruises } from "@/lib/dataIdentity";

const UserDataSchema = z.object({
  email: z.string().email(),
  ownerScopeId: z.string().min(3).optional(),
  cruises: z.array(z.any()).optional(),
  bookedCruises: z.array(z.any()).optional(),
  casinoOffers: z.array(z.any()).optional(),
  calendarEvents: z.array(z.any()).optional(),
  casinoSessions: z.array(z.any()).optional(),
  userProfiles: z.array(z.any()).optional(),
  currentUserId: z.string().nullable().optional(),
  clubRoyaleProfile: z.any().optional(),
  settings: z.any().optional(),
  userPoints: z.number().optional(),
  certificates: z.array(z.any()).optional(),
  alerts: z.array(z.any()).optional(),
  alertRules: z.array(z.any()).optional(),
  slotAtlas: z.array(z.any()).optional(),
  machineEncyclopedia: z.array(z.any()).optional(),
  loyaltyData: z.any().optional(),
  bankrollData: z.any().optional(),
  celebrityData: z.any().optional(),
  dismissedAlertIds: z.array(z.string()).optional(),
  dismissedAlertEntities: z.array(z.string()).optional(),
  bankrollLimits: z.array(z.any()).optional(),
  bankrollAlerts: z.array(z.any()).optional(),
  crewRecognitionEntries: z.array(z.any()).optional(),
  crewRecognitionSailings: z.array(z.any()).optional(),
  userSlotMachines: z.array(z.any()).optional(),
  deckPlanLocations: z.array(z.any()).optional(),
  favoriteStaterooms: z.array(z.any()).optional(),
  sailingWeatherCache: z.record(z.string(), z.any()).optional(),
  casinoOpenHours: z.record(z.string(), z.any()).optional(),
  compItems: z.array(z.any()).optional(),
  w2gRecords: z.array(z.any()).optional(),
});

function prepareOwnedDataArray(value: any[] | undefined, fallback: any[] | undefined, ownerScopeId: string, email: string, label: string): any[] {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return stampRecordsForOwner(filterRecordsForOwner(source, ownerScopeId, email, label), ownerScopeId, email);
}

function prepareOwnedCruises(value: any[] | undefined, fallback: any[] | undefined, ownerScopeId: string, email: string, label: string): any[] {
  return dedupeCruises(prepareOwnedDataArray(value, fallback, ownerScopeId, email, label), label);
}

function prepareOwnedBookedCruises(value: any[] | undefined, fallback: any[] | undefined, ownerScopeId: string, email: string, label: string): any[] {
  return dedupeBookedCruises(prepareOwnedDataArray(value, fallback, ownerScopeId, email, label), label);
}

function prepareOwnedCasinoOffers(value: any[] | undefined, fallback: any[] | undefined, ownerScopeId: string, email: string, label: string): any[] {
  return dedupeCasinoOffers(prepareOwnedDataArray(value, fallback, ownerScopeId, email, label), label);
}

function prepareOwnedCalendarEvents(value: any[] | undefined, fallback: any[] | undefined, ownerScopeId: string, email: string, label: string): any[] {
  return dedupeCalendarEvents(prepareOwnedDataArray(value, fallback, ownerScopeId, email, label), label);
}

function prepareStringArray(value: any[] | undefined, fallback: any[] | undefined): string[] {
  const source = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
  return Array.from(new Set(source.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)));
}

function sanitizeForeignValue<T>(value: T | undefined, fallback: T | undefined, email: string, label: string): T | undefined {
  const source = value !== undefined ? value : fallback;
  if (source === undefined || source === null) {
    return source;
  }

  if (containsKnownForeignPersonalData(source, email)) {
    console.warn('[API] Dropped user-identifiable data outside active user scope:', { email, label });
    return undefined;
  }

  return source;
}

interface StoredUserData {
  email: string;
  ownerScopeId?: string;
  cruises?: any[];
  bookedCruises?: any[];
  casinoOffers?: any[];
  calendarEvents?: any[];
  casinoSessions?: any[];
  userProfiles?: any[];
  currentUserId?: string | null;
  clubRoyaleProfile?: any;
  settings?: any;
  userPoints?: number;
  certificates?: any[];
  alerts?: any[];
  alertRules?: any[];
  slotAtlas?: string[];
  machineEncyclopedia?: any[];
  loyaltyData?: any;
  bankrollData?: any;
  celebrityData?: any;
  dismissedAlertIds?: string[];
  dismissedAlertEntities?: string[];
  bankrollLimits?: any[];
  bankrollAlerts?: any[];
  crewRecognitionEntries?: any[];
  crewRecognitionSailings?: any[];
  userSlotMachines?: any[];
  deckPlanLocations?: any[];
  favoriteStaterooms?: any[];
  sailingWeatherCache?: Record<string, any>;
  casinoOpenHours?: Record<string, any>;
  compItems?: any[];
  w2gRecords?: any[];
  updatedAt: string;
  createdAt?: string;
  [key: string]: any;
}

export const dataRouter = createTRPCRouter({
  saveUserData: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        bookedCruises: z.array(z.any()),
        casinoOffers: z.array(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const result = await db.create("user_data", {
        userId: input.userId,
        bookedCruises: input.bookedCruises,
        casinoOffers: input.casinoOffers,
        updatedAt: new Date().toISOString(),
      });

      console.log('[API] Saved user data:', {
        userId: input.userId,
        cruises: input.bookedCruises.length,
        offers: input.casinoOffers.length,
      });

      return { success: true, id: result };
    }),

  getUserData: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      
      const results = await db.query<[{ bookedCruises: any[]; casinoOffers: any[]; updatedAt: string }[]]>(
        `SELECT * FROM user_data WHERE userId = $userId ORDER BY updatedAt DESC LIMIT 1`,
        { userId: input.userId }
      );

      console.log('[API] Loading user data:', {
        userId: input.userId,
        found: results?.[0]?.length > 0,
      });

      if (results && results[0] && results[0].length > 0) {
        const data = results[0][0];
        return {
          bookedCruises: data.bookedCruises || [],
          casinoOffers: data.casinoOffers || [],
          updatedAt: data.updatedAt,
        };
      }

      return {
        bookedCruises: [],
        casinoOffers: [],
        updatedAt: null,
      };
    }),

  saveAllUserData: publicProcedure
    .input(UserDataSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      const ownerScopeId = input.ownerScopeId?.trim() || '';
      if (!ownerScopeId || !isOwnerScopeForEmail(ownerScopeId, normalizedEmail)) {
        console.log('[API] Refusing cloud save with invalid owner scope:', { email: normalizedEmail, ownerScopeId: ownerScopeId || 'missing' });
        throw new Error('OWNER_SCOPE_REQUIRED');
      }
      const now = new Date().toISOString();
      
      console.log('[API] Saving all user data for:', { email: normalizedEmail, ownerScopeId });

      const existingResults = await db.query<[StoredUserData[]]>(
        `SELECT * FROM user_profiles WHERE ownerScopeId = $ownerScopeId AND email = $email LIMIT 1`,
        { ownerScopeId, email: normalizedEmail }
      );

      const exactExistingData: StoredUserData | undefined = existingResults?.[0]?.[0];
      let existingData: StoredUserData | undefined = exactExistingData;

      if (!existingData) {
        const fallbackResults = await db.query<[StoredUserData[]]>(
          `SELECT * FROM user_profiles WHERE email = $email ORDER BY updatedAt DESC LIMIT 5`,
          { email: normalizedEmail }
        );
        existingData = fallbackResults?.[0]?.find((record) => isOwnerScopeForEmail(record?.ownerScopeId, normalizedEmail));
        if (existingData) {
          console.log('[API] Found same-email profile under prior owner scope; carrying data into current scope:', {
            email: normalizedEmail,
            previousOwnerScopeId: existingData.ownerScopeId,
            currentOwnerScopeId: ownerScopeId,
          });
        }
      }
      
      const userProfiles = prepareOwnedDataArray(input.userProfiles, existingData?.userProfiles, ownerScopeId, normalizedEmail, 'api-save user profiles');
      const userProfileIds = new Set(userProfiles.map((profile) => typeof profile?.id === 'string' ? profile.id : null).filter((id): id is string => id !== null));
      const currentUserId = input.currentUserId ?? existingData?.currentUserId ?? null;

      const dataToSave: StoredUserData = {
        email: normalizedEmail,
        ownerScopeId,
        cruises: prepareOwnedCruises(input.cruises, existingData?.cruises, ownerScopeId, normalizedEmail, 'api-save available cruises'),
        bookedCruises: prepareOwnedBookedCruises(input.bookedCruises, existingData?.bookedCruises, ownerScopeId, normalizedEmail, 'api-save booked cruises'),
        casinoOffers: prepareOwnedCasinoOffers(input.casinoOffers, existingData?.casinoOffers, ownerScopeId, normalizedEmail, 'api-save casino offers'),
        calendarEvents: prepareOwnedCalendarEvents(input.calendarEvents, existingData?.calendarEvents, ownerScopeId, normalizedEmail, 'api-save calendar events'),
        casinoSessions: prepareOwnedDataArray(input.casinoSessions, existingData?.casinoSessions, ownerScopeId, normalizedEmail, 'api-save casino sessions'),
        userProfiles,
        currentUserId: currentUserId && (userProfileIds.size === 0 || userProfileIds.has(currentUserId)) ? currentUserId : null,
        clubRoyaleProfile: sanitizeForeignValue(input.clubRoyaleProfile, existingData?.clubRoyaleProfile, normalizedEmail, 'api-save clubRoyaleProfile'),
        settings: sanitizeForeignValue(input.settings, existingData?.settings, normalizedEmail, 'api-save settings'),
        userPoints: input.userPoints ?? existingData?.userPoints ?? 0,
        certificates: prepareOwnedDataArray(input.certificates, existingData?.certificates, ownerScopeId, normalizedEmail, 'api-save certificates'),
        alerts: prepareOwnedDataArray(input.alerts, existingData?.alerts, ownerScopeId, normalizedEmail, 'api-save alerts'),
        alertRules: prepareOwnedDataArray(input.alertRules, existingData?.alertRules, ownerScopeId, normalizedEmail, 'api-save alert rules'),
        slotAtlas: prepareStringArray(input.slotAtlas, existingData?.slotAtlas),
        machineEncyclopedia: prepareOwnedDataArray(input.machineEncyclopedia, existingData?.machineEncyclopedia, ownerScopeId, normalizedEmail, 'api-save machine encyclopedia'),
        loyaltyData: sanitizeForeignValue(input.loyaltyData, existingData?.loyaltyData, normalizedEmail, 'api-save loyaltyData'),
        bankrollData: sanitizeForeignValue(input.bankrollData, existingData?.bankrollData, normalizedEmail, 'api-save bankrollData'),
        celebrityData: sanitizeForeignValue(input.celebrityData, existingData?.celebrityData, normalizedEmail, 'api-save celebrityData'),
        dismissedAlertIds: input.dismissedAlertIds ?? existingData?.dismissedAlertIds ?? [],
        dismissedAlertEntities: input.dismissedAlertEntities ?? existingData?.dismissedAlertEntities ?? [],
        bankrollLimits: prepareOwnedDataArray(input.bankrollLimits, existingData?.bankrollLimits, ownerScopeId, normalizedEmail, 'api-save bankroll limits'),
        bankrollAlerts: prepareOwnedDataArray(input.bankrollAlerts, existingData?.bankrollAlerts, ownerScopeId, normalizedEmail, 'api-save bankroll alerts'),
        crewRecognitionEntries: prepareOwnedDataArray(input.crewRecognitionEntries, existingData?.crewRecognitionEntries, ownerScopeId, normalizedEmail, 'api-save crew entries'),
        crewRecognitionSailings: prepareOwnedDataArray(input.crewRecognitionSailings, existingData?.crewRecognitionSailings, ownerScopeId, normalizedEmail, 'api-save crew sailings'),
        userSlotMachines: prepareOwnedDataArray(input.userSlotMachines, existingData?.userSlotMachines, ownerScopeId, normalizedEmail, 'api-save user slot machines'),
        deckPlanLocations: prepareOwnedDataArray(input.deckPlanLocations, existingData?.deckPlanLocations, ownerScopeId, normalizedEmail, 'api-save deck plan locations'),
        favoriteStaterooms: prepareOwnedDataArray(input.favoriteStaterooms, existingData?.favoriteStaterooms, ownerScopeId, normalizedEmail, 'api-save favorite staterooms'),
        sailingWeatherCache: sanitizeForeignValue(input.sailingWeatherCache, existingData?.sailingWeatherCache, normalizedEmail, 'api-save sailingWeatherCache') ?? {},
        casinoOpenHours: sanitizeForeignValue(input.casinoOpenHours, existingData?.casinoOpenHours, normalizedEmail, 'api-save casinoOpenHours') ?? {},
        compItems: prepareOwnedDataArray(input.compItems, existingData?.compItems, ownerScopeId, normalizedEmail, 'api-save comp items'),
        w2gRecords: prepareOwnedDataArray(input.w2gRecords, existingData?.w2gRecords, ownerScopeId, normalizedEmail, 'api-save W-2G records'),
        updatedAt: now,
        createdAt: existingData?.createdAt ?? now,
      };

      if (exactExistingData) {
        await db.query(
          `UPDATE user_profiles SET 
            cruises = $cruises,
            bookedCruises = $bookedCruises,
            casinoOffers = $casinoOffers,
            calendarEvents = $calendarEvents,
            casinoSessions = $casinoSessions,
            userProfiles = $userProfiles,
            currentUserId = $currentUserId,
            clubRoyaleProfile = $clubRoyaleProfile,
            settings = $settings,
            userPoints = $userPoints,
            certificates = $certificates,
            alerts = $alerts,
            alertRules = $alertRules,
            slotAtlas = $slotAtlas,
            machineEncyclopedia = $machineEncyclopedia,
            loyaltyData = $loyaltyData,
            bankrollData = $bankrollData,
            celebrityData = $celebrityData,
            dismissedAlertIds = $dismissedAlertIds,
            dismissedAlertEntities = $dismissedAlertEntities,
            bankrollLimits = $bankrollLimits,
            bankrollAlerts = $bankrollAlerts,
            crewRecognitionEntries = $crewRecognitionEntries,
            crewRecognitionSailings = $crewRecognitionSailings,
            userSlotMachines = $userSlotMachines,
            deckPlanLocations = $deckPlanLocations,
            favoriteStaterooms = $favoriteStaterooms,
            sailingWeatherCache = $sailingWeatherCache,
            casinoOpenHours = $casinoOpenHours,
            compItems = $compItems,
            w2gRecords = $w2gRecords,
            ownerScopeId = $ownerScopeId,
            updatedAt = $updatedAt
          WHERE ownerScopeId = $ownerScopeId AND email = $email`,
          dataToSave as Record<string, unknown>
        );
        console.log('[API] Updated existing user profile:', normalizedEmail);
      } else {
        await db.query(
          `CREATE user_profiles CONTENT $data`,
          { data: dataToSave as Record<string, unknown> }
        );
        console.log('[API] Created new user profile:', normalizedEmail);
      }

      console.log('[API] Saved all user data:', {
        email: normalizedEmail,
        availableCruises: dataToSave.cruises?.length ?? 0,
        cruises: dataToSave.bookedCruises?.length ?? 0,
        offers: dataToSave.casinoOffers?.length ?? 0,
        events: dataToSave.calendarEvents?.length ?? 0,
        sessions: dataToSave.casinoSessions?.length ?? 0,
      });

      return { success: true, updatedAt: now };
    }),

  getAllUserData: publicProcedure
    .input(z.object({ email: z.string().email(), ownerScopeId: z.string().min(3).optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      const ownerScopeId = input.ownerScopeId?.trim() || '';
      
      console.log('[API] Loading all user data for:', { email: normalizedEmail, ownerScopeId: ownerScopeId || 'missing' });

      if (!ownerScopeId || !isOwnerScopeForEmail(ownerScopeId, normalizedEmail)) {
        console.log('[API] Refusing cloud restore with invalid owner scope:', { email: normalizedEmail, ownerScopeId: ownerScopeId || 'missing' });
        return {
          found: false,
          data: null,
        };
      }

      const results = await db.query<[StoredUserData[]]>(
        `SELECT * FROM user_profiles WHERE ownerScopeId = $ownerScopeId AND email = $email LIMIT 1`,
        { ownerScopeId, email: normalizedEmail }
      );

      let rawData: StoredUserData | undefined = results?.[0]?.[0];

      if (!rawData) {
        const fallbackResults = await db.query<[StoredUserData[]]>(
          `SELECT * FROM user_profiles WHERE email = $email ORDER BY updatedAt DESC LIMIT 5`,
          { email: normalizedEmail }
        );
        rawData = fallbackResults?.[0]?.find((record) => isOwnerScopeForEmail(record?.ownerScopeId, normalizedEmail));
        if (rawData) {
          console.log('[API] Found user data under prior owner scope; restoring into current scope:', {
            email: normalizedEmail,
            previousOwnerScopeId: rawData.ownerScopeId,
            currentOwnerScopeId: ownerScopeId,
          });
        }
      }

      if (rawData) {
        const data: StoredUserData = {
          ...rawData,
          email: normalizedEmail,
          ownerScopeId,
          cruises: prepareOwnedCruises(rawData.cruises, undefined, ownerScopeId, normalizedEmail, 'api-restore available cruises'),
          bookedCruises: prepareOwnedBookedCruises(rawData.bookedCruises, undefined, ownerScopeId, normalizedEmail, 'api-restore booked cruises'),
          casinoOffers: prepareOwnedCasinoOffers(rawData.casinoOffers, undefined, ownerScopeId, normalizedEmail, 'api-restore casino offers'),
          calendarEvents: prepareOwnedCalendarEvents(rawData.calendarEvents, undefined, ownerScopeId, normalizedEmail, 'api-restore calendar events'),
          casinoSessions: prepareOwnedDataArray(rawData.casinoSessions, undefined, ownerScopeId, normalizedEmail, 'api-restore casino sessions'),
          userProfiles: prepareOwnedDataArray(rawData.userProfiles, undefined, ownerScopeId, normalizedEmail, 'api-restore user profiles'),
          clubRoyaleProfile: sanitizeForeignValue(rawData.clubRoyaleProfile, undefined, normalizedEmail, 'api-restore clubRoyaleProfile'),
          settings: sanitizeForeignValue(rawData.settings, undefined, normalizedEmail, 'api-restore settings'),
          loyaltyData: sanitizeForeignValue(rawData.loyaltyData, undefined, normalizedEmail, 'api-restore loyaltyData'),
          bankrollData: sanitizeForeignValue(rawData.bankrollData, undefined, normalizedEmail, 'api-restore bankrollData'),
          celebrityData: sanitizeForeignValue(rawData.celebrityData, undefined, normalizedEmail, 'api-restore celebrityData'),
          certificates: prepareOwnedDataArray(rawData.certificates, undefined, ownerScopeId, normalizedEmail, 'api-restore certificates'),
          alerts: prepareOwnedDataArray(rawData.alerts, undefined, ownerScopeId, normalizedEmail, 'api-restore alerts'),
          alertRules: prepareOwnedDataArray(rawData.alertRules, undefined, ownerScopeId, normalizedEmail, 'api-restore alert rules'),
          slotAtlas: prepareStringArray(rawData.slotAtlas, undefined),
          machineEncyclopedia: prepareOwnedDataArray(rawData.machineEncyclopedia, undefined, ownerScopeId, normalizedEmail, 'api-restore machine encyclopedia'),
          bankrollLimits: prepareOwnedDataArray(rawData.bankrollLimits, undefined, ownerScopeId, normalizedEmail, 'api-restore bankroll limits'),
          bankrollAlerts: prepareOwnedDataArray(rawData.bankrollAlerts, undefined, ownerScopeId, normalizedEmail, 'api-restore bankroll alerts'),
          crewRecognitionEntries: prepareOwnedDataArray(rawData.crewRecognitionEntries, undefined, ownerScopeId, normalizedEmail, 'api-restore crew entries'),
          crewRecognitionSailings: prepareOwnedDataArray(rawData.crewRecognitionSailings, undefined, ownerScopeId, normalizedEmail, 'api-restore crew sailings'),
          userSlotMachines: prepareOwnedDataArray(rawData.userSlotMachines, undefined, ownerScopeId, normalizedEmail, 'api-restore user slot machines'),
          deckPlanLocations: prepareOwnedDataArray(rawData.deckPlanLocations, undefined, ownerScopeId, normalizedEmail, 'api-restore deck plan locations'),
          favoriteStaterooms: prepareOwnedDataArray(rawData.favoriteStaterooms, undefined, ownerScopeId, normalizedEmail, 'api-restore favorite staterooms'),
          sailingWeatherCache: sanitizeForeignValue(rawData.sailingWeatherCache, undefined, normalizedEmail, 'api-restore sailingWeatherCache') ?? {},
          casinoOpenHours: sanitizeForeignValue(rawData.casinoOpenHours, undefined, normalizedEmail, 'api-restore casinoOpenHours') ?? {},
          compItems: prepareOwnedDataArray(rawData.compItems, undefined, ownerScopeId, normalizedEmail, 'api-restore comp items'),
          w2gRecords: prepareOwnedDataArray(rawData.w2gRecords, undefined, ownerScopeId, normalizedEmail, 'api-restore W-2G records'),
        };
        const restoredUserProfileIds = new Set((data.userProfiles ?? []).map((profile) => typeof profile?.id === 'string' ? profile.id : null).filter((id): id is string => id !== null));
        data.currentUserId = data.currentUserId && (restoredUserProfileIds.size === 0 || restoredUserProfileIds.has(data.currentUserId)) ? data.currentUserId : null;
        console.log('[API] Found user data:', {
          email: normalizedEmail,
          ownerScopeId,
          availableCruises: data.cruises?.length ?? 0,
          cruises: data.bookedCruises?.length ?? 0,
          offers: data.casinoOffers?.length ?? 0,
          events: data.calendarEvents?.length ?? 0,
          sessions: data.casinoSessions?.length ?? 0,
          updatedAt: data.updatedAt,
        });
        return {
          found: true,
          data: {
            cruises: data.cruises ?? [],
            bookedCruises: data.bookedCruises ?? [],
            casinoOffers: data.casinoOffers ?? [],
            calendarEvents: data.calendarEvents ?? [],
            casinoSessions: data.casinoSessions ?? [],
            userProfiles: data.userProfiles ?? [],
            currentUserId: data.currentUserId ?? null,
            clubRoyaleProfile: data.clubRoyaleProfile,
            settings: data.settings,
            userPoints: data.userPoints ?? 0,
            certificates: data.certificates ?? [],
            alerts: data.alerts ?? [],
            alertRules: data.alertRules ?? [],
            slotAtlas: data.slotAtlas ?? [],
            machineEncyclopedia: data.machineEncyclopedia ?? [],
            loyaltyData: data.loyaltyData,
            bankrollData: data.bankrollData,
            celebrityData: data.celebrityData,
            dismissedAlertIds: data.dismissedAlertIds ?? [],
            dismissedAlertEntities: data.dismissedAlertEntities ?? [],
            bankrollLimits: data.bankrollLimits ?? [],
            bankrollAlerts: data.bankrollAlerts ?? [],
            crewRecognitionEntries: data.crewRecognitionEntries ?? [],
            crewRecognitionSailings: data.crewRecognitionSailings ?? [],
            userSlotMachines: data.userSlotMachines ?? [],
            deckPlanLocations: data.deckPlanLocations ?? [],
            favoriteStaterooms: data.favoriteStaterooms ?? [],
            sailingWeatherCache: data.sailingWeatherCache ?? {},
            casinoOpenHours: data.casinoOpenHours ?? {},
            compItems: data.compItems ?? [],
            w2gRecords: data.w2gRecords ?? [],
            ownerScopeId: data.ownerScopeId,
            updatedAt: data.updatedAt,
            createdAt: data.createdAt,
          },
        };
      }

      console.log('[API] No user data found for:', normalizedEmail);
      return {
        found: false,
        data: null,
      };
    }),

  deleteUserData: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      
      console.log('[API] Deleting all user data for:', normalizedEmail);

      await db.query(
        `DELETE FROM user_profiles WHERE email = $email`,
        { email: normalizedEmail }
      );

      console.log('[API] Deleted user data for:', normalizedEmail);
      return { success: true };
    }),

  checkEmailExists: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      
      console.log('[API] Checking if email exists:', normalizedEmail);

      const results = await db.query<[StoredUserData[]]>(
        `SELECT email FROM user_profiles WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      const exists = results && results[0] && results[0].length > 0;
      console.log('[API] Email exists check:', { email: normalizedEmail, exists });
      
      return { exists };
    }),
});
