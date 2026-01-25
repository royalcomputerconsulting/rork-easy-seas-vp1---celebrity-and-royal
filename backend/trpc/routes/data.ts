import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";

const BookedCruiseSchema = z.any();
const CasinoOfferSchema = z.any();

export const dataRouter = createTRPCRouter({
  saveUserData: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        bookedCruises: z.array(BookedCruiseSchema),
        casinoOffers: z.array(CasinoOfferSchema),
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
});
