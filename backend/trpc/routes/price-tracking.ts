import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";

const PriceRecordSchema = z.object({
  cruiseKey: z.string(),
  shipName: z.string(),
  sailDate: z.string(),
  nights: z.number(),
  destination: z.string(),
  cabinType: z.string(),
  price: z.number(),
  taxesFees: z.number(),
  totalPrice: z.number(),
  freePlay: z.number().optional(),
  obc: z.number().optional(),
  offerCode: z.string().optional(),
  offerName: z.string().optional(),
  offerId: z.string().optional(),
  source: z.enum(["offer", "cruise", "manual"]),
});

export const priceTrackingRouter = createTRPCRouter({
  savePriceRecords: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        records: z.array(PriceRecordSchema),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      const now = new Date().toISOString();

      let savedCount = 0;

      for (const record of input.records) {
        const existingResults = await db.query<[{ id: string; totalPrice: number; recordedAt: string }[]]>(
          `SELECT id, totalPrice, recordedAt FROM price_history 
           WHERE email = $email AND cruiseKey = $cruiseKey 
           ORDER BY recordedAt DESC LIMIT 1`,
          { email: normalizedEmail, cruiseKey: record.cruiseKey }
        );

        const existing = existingResults?.[0]?.[0];

        if (existing) {
          const timeDiff = new Date(now).getTime() - new Date(existing.recordedAt).getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);
          if (hoursDiff < 24 && Math.abs(existing.totalPrice - record.totalPrice) < 1) {
            continue;
          }
        }

        await db.query(
          `CREATE price_history CONTENT $data`,
          {
            data: {
              email: normalizedEmail,
              ...record,
              recordedAt: now,
            } as Record<string, unknown>,
          }
        );
        savedCount++;
      }

      console.log("[API] Saved price records:", {
        email: normalizedEmail,
        total: input.records.length,
        saved: savedCount,
        skippedDuplicates: input.records.length - savedCount,
      });

      return { success: true, savedCount };
    }),

  getPriceHistory: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        cruiseKey: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();

      let query: string;
      let params: Record<string, unknown>;

      if (input.cruiseKey) {
        query = `SELECT * FROM price_history WHERE email = $email AND cruiseKey = $cruiseKey ORDER BY recordedAt DESC`;
        params = { email: normalizedEmail, cruiseKey: input.cruiseKey };
      } else {
        query = `SELECT * FROM price_history WHERE email = $email ORDER BY recordedAt DESC`;
        params = { email: normalizedEmail };
      }

      const results = await db.query<[any[]]>(query, params);
      const records = results?.[0] ?? [];

      console.log("[API] Loaded price history:", {
        email: normalizedEmail,
        cruiseKey: input.cruiseKey ?? "all",
        count: records.length,
      });

      return { records };
    }),

  getPriceDrops: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();

      const results = await db.query<[any[]]>(
        `SELECT cruiseKey, shipName, sailDate, destination, cabinType, totalPrice, recordedAt, offerName, offerId
         FROM price_history 
         WHERE email = $email 
         ORDER BY cruiseKey, recordedAt DESC`,
        { email: normalizedEmail }
      );

      const allRecords = results?.[0] ?? [];

      const grouped = new Map<string, any[]>();
      for (const record of allRecords) {
        const key = record.cruiseKey;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
      }

      const drops: any[] = [];
      for (const [cruiseKey, records] of grouped) {
        if (records.length < 2) continue;
        const latest = records[0];
        const previous = records[1];
        if (latest.totalPrice < previous.totalPrice) {
          const priceDrop = previous.totalPrice - latest.totalPrice;
          const priceDropPercent = (priceDrop / previous.totalPrice) * 100;
          drops.push({
            cruiseKey,
            shipName: latest.shipName,
            sailDate: latest.sailDate,
            destination: latest.destination,
            cabinType: latest.cabinType,
            previousPrice: previous.totalPrice,
            currentPrice: latest.totalPrice,
            priceDrop,
            priceDropPercent,
            previousRecordedAt: previous.recordedAt,
            currentRecordedAt: latest.recordedAt,
            offerId: latest.offerId,
            offerName: latest.offerName,
          });
        }
      }

      drops.sort((a, b) => b.priceDropPercent - a.priceDropPercent);

      console.log("[API] Price drops:", {
        email: normalizedEmail,
        totalRecords: allRecords.length,
        uniqueCruises: grouped.size,
        dropsFound: drops.length,
      });

      return { drops };
    }),

  clearPriceHistory: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();

      await db.query(
        `DELETE FROM price_history WHERE email = $email`,
        { email: normalizedEmail }
      );

      console.log("[API] Cleared price history for:", normalizedEmail);
      return { success: true };
    }),
});
