import { z } from "zod";
import { getDb } from "../../db.js";
import { createTRPCRouter, publicProcedure } from "../create-context.js";

const UserDataSchema = z.object({
  email: z.string().email(),
  bookedCruises: z.array(z.any()).optional(),
  casinoOffers: z.array(z.any()).optional(),
  calendarEvents: z.array(z.any()).optional(),
  casinoSessions: z.array(z.any()).optional(),
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
});

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
      
      const results = await db.query(
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
      const now = new Date().toISOString();
      
      console.log('[API] Saving all user data for:', normalizedEmail);

      const existingResults = await db.query(
        `SELECT * FROM user_profiles WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      const existingData = existingResults?.[0]?.[0];
      
      const dataToSave = {
        email: normalizedEmail,
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
        updatedAt: now,
        createdAt: existingData?.createdAt ?? now,
      };

      if (existingData) {
        await db.query(
          `UPDATE user_profiles SET 
            bookedCruises = $bookedCruises,
            casinoOffers = $casinoOffers,
            calendarEvents = $calendarEvents,
            casinoSessions = $casinoSessions,
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
            updatedAt = $updatedAt
          WHERE email = $email`,
          dataToSave
        );
        console.log('[API] Updated existing user profile:', normalizedEmail);
      } else {
        await db.query(
          `CREATE user_profiles CONTENT $data`,
          { data: dataToSave }
        );
        console.log('[API] Created new user profile:', normalizedEmail);
      }

      console.log('[API] Saved all user data:', {
        email: normalizedEmail,
        cruises: dataToSave.bookedCruises?.length ?? 0,
        offers: dataToSave.casinoOffers?.length ?? 0,
        events: dataToSave.calendarEvents?.length ?? 0,
        sessions: dataToSave.casinoSessions?.length ?? 0,
      });

      return { success: true, updatedAt: now };
    }),

  getAllUserData: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      
      console.log('[API] Loading all user data for:', normalizedEmail);

      const results = await db.query(
        `SELECT * FROM user_profiles WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      if (results && results[0] && results[0].length > 0) {
        const data = results[0][0];
        console.log('[API] Found user data:', {
          email: normalizedEmail,
          cruises: data.bookedCruises?.length ?? 0,
          offers: data.casinoOffers?.length ?? 0,
          events: data.calendarEvents?.length ?? 0,
          sessions: data.casinoSessions?.length ?? 0,
          updatedAt: data.updatedAt,
        });
        return {
          found: true,
          data: {
            bookedCruises: data.bookedCruises ?? [],
            casinoOffers: data.casinoOffers ?? [],
            calendarEvents: data.calendarEvents ?? [],
            casinoSessions: data.casinoSessions ?? [],
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

      const results = await db.query(
        `SELECT email FROM user_profiles WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      const exists = results && results[0] && results[0].length > 0;
      console.log('[API] Email exists check:', { email: normalizedEmail, exists });
      
      return { exists };
    }),
});
