import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";

const ADMIN_EMAILS = ["scott.merlis1@gmail.com", "s@a.com"] as const;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function isAdminEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return ADMIN_EMAILS.some((adminEmail) => adminEmail === normalizedEmail);
}

async function loadWhitelistFromDb(): Promise<string[]> {
  const db = await getDb();
  const results = await db.query<[{ email?: string; isActive?: boolean }[]]>(
    `SELECT email, isActive FROM app_access_whitelist WHERE isActive = true`
  );
  const dbEmails = (results?.[0] ?? [])
    .map((entry) => typeof entry.email === "string" ? normalizeEmail(entry.email) : "")
    .filter((email) => email.includes("@"));
  return Array.from(new Set([...ADMIN_EMAILS, ...dbEmails])).sort();
}

export const accessRouter = createTRPCRouter({
  getWhitelist: publicProcedure.query(async () => {
    try {
      const whitelist = await loadWhitelistFromDb();
      console.log("[AccessAPI] Loaded whitelist", { count: whitelist.length });
      return { whitelist };
    } catch (error) {
      console.error("[AccessAPI] Failed to load whitelist:", error);
      return { whitelist: [...ADMIN_EMAILS] };
    }
  }),

  checkFreeUseAccess: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const normalizedEmail = normalizeEmail(input.email);
      try {
        const whitelist = await loadWhitelistFromDb();
        const isWhitelisted = whitelist.includes(normalizedEmail);
        console.log("[AccessAPI] Checked free use access", { email: normalizedEmail, isWhitelisted });
        return {
          isWhitelisted,
          subscriptionLevel: isWhitelisted ? "Free Use of App" : null,
          isAdmin: isAdminEmail(normalizedEmail),
        };
      } catch (error) {
        console.error("[AccessAPI] Failed to check free use access:", error);
        const isAdmin = isAdminEmail(normalizedEmail);
        return {
          isWhitelisted: isAdmin,
          subscriptionLevel: isAdmin ? "Free Use of App" : null,
          isAdmin,
        };
      }
    }),

  addToWhitelist: publicProcedure
    .input(z.object({ adminEmail: z.string().email(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      const adminEmail = normalizeEmail(input.adminEmail);
      const email = normalizeEmail(input.email);
      if (!isAdminEmail(adminEmail)) {
        throw new Error("ADMIN_ONLY");
      }

      const db = await getDb();
      const now = new Date().toISOString();
      const existingResults = await db.query<[{ email?: string }[]]>(
        `SELECT email FROM app_access_whitelist WHERE email = $email LIMIT 1`,
        { email }
      );
      const exists = (existingResults?.[0]?.length ?? 0) > 0;

      if (exists) {
        await db.query(
          `UPDATE app_access_whitelist SET isActive = true, addedBy = $adminEmail, subscriptionLevel = $subscriptionLevel, updatedAt = $updatedAt WHERE email = $email`,
          { email, adminEmail, subscriptionLevel: "Free Use of App", updatedAt: now }
        );
      } else {
        await db.query(
          `CREATE app_access_whitelist CONTENT $data`,
          {
            data: {
              email,
              isActive: true,
              addedBy: adminEmail,
              subscriptionLevel: "Free Use of App",
              createdAt: now,
              updatedAt: now,
            },
          }
        );
      }

      console.log("[AccessAPI] Added free use whitelist email", { email, adminEmail });
      return { success: true, email, subscriptionLevel: "Free Use of App" };
    }),

  removeFromWhitelist: publicProcedure
    .input(z.object({ adminEmail: z.string().email(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      const adminEmail = normalizeEmail(input.adminEmail);
      const email = normalizeEmail(input.email);
      if (!isAdminEmail(adminEmail)) {
        throw new Error("ADMIN_ONLY");
      }
      if (isAdminEmail(email)) {
        throw new Error("Cannot remove admin email from whitelist");
      }

      const db = await getDb();
      await db.query(
        `UPDATE app_access_whitelist SET isActive = false, removedBy = $adminEmail, updatedAt = $updatedAt WHERE email = $email`,
        { email, adminEmail, updatedAt: new Date().toISOString() }
      );
      console.log("[AccessAPI] Removed free use whitelist email", { email, adminEmail });
      return { success: true, email };
    }),
});
