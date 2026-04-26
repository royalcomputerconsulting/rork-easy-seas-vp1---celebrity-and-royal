import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { isOwnerScopeForEmail } from "@/lib/storage/dataOwnership";

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
  slotAtlas?: any[];
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

      const existingData = existingResults?.[0]?.[0];
      
      const dataToSave: StoredUserData = {
        email: normalizedEmail,
        ownerScopeId,
        cruises: input.cruises ?? existingData?.cruises ?? [],
        bookedCruises: input.bookedCruises ?? existingData?.bookedCruises ?? [],
        casinoOffers: input.casinoOffers ?? existingData?.casinoOffers ?? [],
        calendarEvents: input.calendarEvents ?? existingData?.calendarEvents ?? [],
        casinoSessions: input.casinoSessions ?? existingData?.casinoSessions ?? [],
        userProfiles: input.userProfiles ?? existingData?.userProfiles ?? [],
        currentUserId: input.currentUserId ?? existingData?.currentUserId ?? null,
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
        dismissedAlertIds: input.dismissedAlertIds ?? existingData?.dismissedAlertIds ?? [],
        dismissedAlertEntities: input.dismissedAlertEntities ?? existingData?.dismissedAlertEntities ?? [],
        bankrollLimits: input.bankrollLimits ?? existingData?.bankrollLimits ?? [],
        bankrollAlerts: input.bankrollAlerts ?? existingData?.bankrollAlerts ?? [],
        crewRecognitionEntries: input.crewRecognitionEntries ?? existingData?.crewRecognitionEntries ?? [],
        crewRecognitionSailings: input.crewRecognitionSailings ?? existingData?.crewRecognitionSailings ?? [],
        userSlotMachines: input.userSlotMachines ?? existingData?.userSlotMachines ?? [],
        deckPlanLocations: input.deckPlanLocations ?? existingData?.deckPlanLocations ?? [],
        favoriteStaterooms: input.favoriteStaterooms ?? existingData?.favoriteStaterooms ?? [],
        sailingWeatherCache: input.sailingWeatherCache ?? existingData?.sailingWeatherCache ?? {},
        casinoOpenHours: input.casinoOpenHours ?? existingData?.casinoOpenHours ?? {},
        compItems: input.compItems ?? existingData?.compItems ?? [],
        w2gRecords: input.w2gRecords ?? existingData?.w2gRecords ?? [],
        updatedAt: now,
        createdAt: existingData?.createdAt ?? now,
      };

      if (existingData) {
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

      if (results && results[0] && results[0].length > 0) {
        const data = results[0][0];
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
