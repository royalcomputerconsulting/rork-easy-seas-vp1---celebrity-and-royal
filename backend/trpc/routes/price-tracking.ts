import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";

const PriceSnapshotSchema = z.object({
  cruiseKey: z.string(),
  shipName: z.string(),
  sailDate: z.string(),
  nights: z.number(),
  destination: z.string(),
  cabinType: z.string(),
  prices: z.object({
    interior: z.number().optional(),
    oceanview: z.number().optional(),
    balcony: z.number().optional(),
    suite: z.number().optional(),
    juniorSuite: z.number().optional(),
    grandSuite: z.number().optional(),
  }),
  taxesFees: z.number().optional(),
  freePlay: z.number().optional(),
  obc: z.number().optional(),
  offerCode: z.string().optional(),
  offerName: z.string().optional(),
  offerId: z.string().optional(),
  source: z.enum(["offer", "cruise", "manual", "sync"]),
});

export const priceTrackingRouter = createTRPCRouter({
  recordSnapshot: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        snapshot: PriceSnapshotSchema,
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const today = new Date().toISOString().split("T")[0];

      const existing = await db.query<any[][]>(
        `SELECT * FROM price_snapshot WHERE userId = $userId AND cruiseKey = $cruiseKey AND capturedDate = $capturedDate LIMIT 1`,
        { userId: input.userId, cruiseKey: input.snapshot.cruiseKey, capturedDate: today }
      );

      const existingRecords = existing?.[0] || [];
      if (existingRecords.length > 0) {
        const record = existingRecords[0];
        const updated = await db.merge(record.id, {
          ...input.snapshot,
          updatedAt: new Date().toISOString(),
        });
        console.log("[PriceTracking] Updated existing snapshot for", input.snapshot.cruiseKey, "on", today);
        return { action: "updated" as const, record: updated };
      }

      const record = await db.create("price_snapshot", {
        userId: input.userId,
        ...input.snapshot,
        capturedDate: today,
        capturedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      console.log("[PriceTracking] Created new snapshot for", input.snapshot.cruiseKey, "on", today);
      return { action: "created" as const, record };
    }),

  bulkRecordSnapshots: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        snapshots: z.array(PriceSnapshotSchema),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const today = new Date().toISOString().split("T")[0];
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const snapshot of input.snapshots) {
        try {
          const existing = await db.query<any[][]>(
            `SELECT * FROM price_snapshot WHERE userId = $userId AND cruiseKey = $cruiseKey AND capturedDate = $capturedDate LIMIT 1`,
            { userId: input.userId, cruiseKey: snapshot.cruiseKey, capturedDate: today }
          );

          const existingRecords = existing?.[0] || [];
          if (existingRecords.length > 0) {
            await db.merge(existingRecords[0].id, {
              ...snapshot,
              updatedAt: new Date().toISOString(),
            });
            updated++;
          } else {
            await db.create("price_snapshot", {
              userId: input.userId,
              ...snapshot,
              capturedDate: today,
              capturedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            });
            created++;
          }
        } catch (error) {
          console.error("[PriceTracking] Error recording snapshot for", snapshot.cruiseKey, error);
          skipped++;
        }
      }

      console.log(`[PriceTracking] Bulk record: ${created} created, ${updated} updated, ${skipped} skipped`);
      return { created, updated, skipped };
    }),

  getHistory: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cruiseKey: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let query = `SELECT * FROM price_snapshot WHERE userId = $userId AND cruiseKey = $cruiseKey`;
      const params: Record<string, string> = {
        userId: input.userId,
        cruiseKey: input.cruiseKey,
      };

      if (input.startDate) {
        query += ` AND capturedDate >= $startDate`;
        params.startDate = input.startDate;
      }
      if (input.endDate) {
        query += ` AND capturedDate <= $endDate`;
        params.endDate = input.endDate;
      }

      query += ` ORDER BY capturedDate ASC`;

      const result = await db.query<any[][]>(query, params);
      return result?.[0] || [];
    }),

  getHistoryForAllCruises: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cruiseKeys: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let query: string;
      let params: Record<string, any>;

      if (input.cruiseKeys && input.cruiseKeys.length > 0) {
        query = `SELECT * FROM price_snapshot WHERE userId = $userId AND cruiseKey IN $cruiseKeys ORDER BY capturedDate ASC`;
        params = { userId: input.userId, cruiseKeys: input.cruiseKeys };
      } else {
        query = `SELECT * FROM price_snapshot WHERE userId = $userId ORDER BY capturedDate ASC`;
        params = { userId: input.userId };
      }

      const result = await db.query<any[][]>(query, params);
      return result?.[0] || [];
    }),

  getLatestSnapshots: publicProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db.query<any[][]>(
        `SELECT * FROM price_snapshot WHERE userId = $userId ORDER BY capturedDate DESC`,
        { userId: input.userId }
      );

      const records = result?.[0] || [];
      const latestByCruise = new Map<string, any>();
      for (const record of records) {
        if (!latestByCruise.has(record.cruiseKey)) {
          latestByCruise.set(record.cruiseKey, record);
        }
      }
      return Array.from(latestByCruise.values());
    }),

  getPriceDrops: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        minDropPercent: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db.query<any[][]>(
        `SELECT * FROM price_snapshot WHERE userId = $userId ORDER BY cruiseKey, capturedDate ASC`,
        { userId: input.userId }
      );

      const records = result?.[0] || [];
      const byCruise = new Map<string, any[]>();
      for (const record of records) {
        const list = byCruise.get(record.cruiseKey) || [];
        list.push(record);
        byCruise.set(record.cruiseKey, list);
      }

      const drops: any[] = [];
      for (const [cruiseKey, snapshots] of byCruise.entries()) {
        if (snapshots.length < 2) continue;
        const first = snapshots[0];
        const latest = snapshots[snapshots.length - 1];

        const cabinTypes = ["interior", "oceanview", "balcony", "suite"] as const;
        for (const cabin of cabinTypes) {
          const firstPrice = first.prices?.[cabin];
          const latestPrice = latest.prices?.[cabin];
          if (firstPrice && latestPrice && latestPrice < firstPrice) {
            const dropAmount = firstPrice - latestPrice;
            const dropPercent = (dropAmount / firstPrice) * 100;
            if (dropPercent >= input.minDropPercent) {
              drops.push({
                cruiseKey,
                shipName: latest.shipName,
                sailDate: latest.sailDate,
                cabinType: cabin,
                firstPrice,
                latestPrice,
                dropAmount,
                dropPercent,
                firstDate: first.capturedDate,
                latestDate: latest.capturedDate,
                snapshotCount: snapshots.length,
              });
            }
          }
        }
      }

      return drops.sort((a, b) => b.dropPercent - a.dropPercent);
    }),

  deleteHistory: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        cruiseKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (input.cruiseKey) {
        await db.query(
          `DELETE price_snapshot WHERE userId = $userId AND cruiseKey = $cruiseKey`,
          { userId: input.userId, cruiseKey: input.cruiseKey }
        );
        console.log("[PriceTracking] Deleted history for", input.cruiseKey);
      } else {
        await db.query(
          `DELETE price_snapshot WHERE userId = $userId`,
          { userId: input.userId }
        );
        console.log("[PriceTracking] Deleted all history for user", input.userId);
      }
      return { success: true };
    }),
});
