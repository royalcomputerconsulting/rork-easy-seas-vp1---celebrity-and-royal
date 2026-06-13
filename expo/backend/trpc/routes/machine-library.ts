import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";

const MAX_SHARED_MACHINE_BATCH = 1200;

const USER_SPECIFIC_KEYS = new Set([
  "isInMyAtlas",
  "addedToAtlasAt",
  "isFavorite",
  "favoritedAt",
  "userNotes",
  "images",
  "shipAssignments",
  "ownerProfileId",
  "sourceEmail",
  "createdBy",
]);

function normalizeText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getMachineKey(machine: Record<string, unknown>): string | null {
  const header = typeof machine.header === "object" && machine.header !== null ? machine.header as Record<string, unknown> : {};
  const existingId = normalizeText(machine.globalMachineId) ?? normalizeText(machine.machineId) ?? normalizeText(machine.id);
  if (existingId) return existingId;

  const name = normalizeText(machine.machineName) ?? normalizeText(machine.name) ?? normalizeText(header.machineName);
  const manufacturer = normalizeText(machine.manufacturer) ?? normalizeText(header.manufacturer);
  if (!name) return null;

  return `${slugify(manufacturer ?? "other")}-${slugify(name)}`;
}

function sanitizeSharedMachine(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  const header = typeof source.header === "object" && source.header !== null ? source.header as Record<string, unknown> : {};
  const machineKey = getMachineKey(source);
  const machineName = normalizeText(source.machineName) ?? normalizeText(source.name) ?? normalizeText(header.machineName);

  if (!machineKey || !machineName) return null;

  const sanitized: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (USER_SPECIFIC_KEYS.has(key)) return;
    if (value === undefined) return;
    sanitized[key] = value;
  });

  sanitized.id = machineKey;
  sanitized.globalMachineId = machineKey;
  sanitized.machineName = machineName;
  sanitized.name = machineName;
  sanitized.manufacturer = normalizeText(source.manufacturer) ?? normalizeText(header.manufacturer) ?? "Other";

  if (source.releaseYear !== undefined || source.release_year !== undefined || header.releaseYear !== undefined) {
    sanitized.releaseYear = source.releaseYear ?? source.release_year ?? header.releaseYear;
  }

  sanitized.updatedAt = normalizeText(source.updatedAt) ?? new Date().toISOString();
  return sanitized;
}

function mergeSources(existingSources: unknown, source: string): string[] {
  const current = Array.isArray(existingSources)
    ? existingSources.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  return Array.from(new Set([...current, source]));
}

export const machineLibraryRouter = createTRPCRouter({
  getAll: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      const results = await db.query<[{ machine?: Record<string, unknown>; isActive?: boolean }[]]>(
        `SELECT machine, isActive FROM slot_machine_library WHERE isActive != false ORDER BY updatedAt DESC`
      );
      const machines = (results?.[0] ?? [])
        .filter((record) => record.isActive !== false && record.machine && typeof record.machine === "object")
        .map((record) => record.machine as Record<string, unknown>);

      console.log("[MachineLibraryAPI] Loaded shared slot machine library", { count: machines.length });
      return { machines, count: machines.length };
    } catch (error) {
      console.error("[MachineLibraryAPI] Failed to load shared slot machine library:", error);
      return { machines: [], count: 0 };
    }
  }),

  upsertMany: publicProcedure
    .input(z.object({
      machines: z.array(z.any()).max(MAX_SHARED_MACHINE_BATCH),
      source: z.string().min(1).max(64).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const source = input.source ?? "import";
      const now = new Date().toISOString();
      const sanitizedMachines = input.machines
        .map(sanitizeSharedMachine)
        .filter((machine): machine is Record<string, unknown> => machine !== null);

      const uniqueMachines = new Map<string, Record<string, unknown>>();
      sanitizedMachines.forEach((machine) => {
        const key = getMachineKey(machine);
        if (key) uniqueMachines.set(key, machine);
      });

      let added = 0;
      let updated = 0;

      for (const [machineKey, machine] of uniqueMachines.entries()) {
        const existingResults = await db.query<[{ sources?: string[] }[]]>(
          `SELECT sources FROM slot_machine_library WHERE machineKey = $machineKey LIMIT 1`,
          { machineKey }
        );
        const existing = existingResults?.[0]?.[0];
        const sources = mergeSources(existing?.sources, source);
        const record = {
          machineKey,
          machine: {
            ...machine,
            updatedAt: now,
          },
          sources,
          isActive: true,
          updatedAt: now,
        };

        if (existing) {
          await db.query(
            `UPDATE slot_machine_library SET machine = $machine, sources = $sources, isActive = true, updatedAt = $updatedAt WHERE machineKey = $machineKey`,
            record
          );
          updated++;
        } else {
          await db.query(
            `CREATE slot_machine_library CONTENT $data`,
            { data: { ...record, createdAt: now } }
          );
          added++;
        }
      }

      console.log("[MachineLibraryAPI] Upserted shared slot machines", {
        received: input.machines.length,
        sanitized: uniqueMachines.size,
        added,
        updated,
      });

      return { success: true, added, updated, count: uniqueMachines.size };
    }),
});
