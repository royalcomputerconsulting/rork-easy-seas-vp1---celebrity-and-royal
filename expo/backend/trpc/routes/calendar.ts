import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getDb } from "@/backend/db";

export const calendarRouter = createTRPCRouter({
  saveCalendarFeed: publicProcedure
    .input(z.object({
      email: z.string().email(),
      token: z.string().min(16),
      icsContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();
      const now = new Date().toISOString();

      console.log('[Calendar API] Saving calendar feed for:', normalizedEmail, 'token:', input.token.slice(0, 8) + '...');

      const existing = await db.query<[{ id: string }[]]>(
        `SELECT id FROM calendar_feeds WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      if (existing?.[0]?.length > 0) {
        await db.query(
          `UPDATE calendar_feeds SET token = $token, icsContent = $icsContent, updatedAt = $updatedAt WHERE email = $email`,
          { email: normalizedEmail, token: input.token, icsContent: input.icsContent, updatedAt: now }
        );
        console.log('[Calendar API] Updated existing calendar feed');
      } else {
        await db.query(
          `CREATE calendar_feeds CONTENT $data`,
          { data: { email: normalizedEmail, token: input.token, icsContent: input.icsContent, createdAt: now, updatedAt: now } as Record<string, unknown> }
        );
        console.log('[Calendar API] Created new calendar feed');
      }

      return { success: true, updatedAt: now };
    }),

  getCalendarFeedByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      console.log('[Calendar API] Looking up feed by token:', input.token.slice(0, 8) + '...');

      const results = await db.query<[{ icsContent: string; updatedAt: string }[]]>(
        `SELECT icsContent, updatedAt FROM calendar_feeds WHERE token = $token LIMIT 1`,
        { token: input.token }
      );

      if (results?.[0]?.length > 0) {
        console.log('[Calendar API] Feed found, content length:', results[0][0].icsContent?.length);
        return { found: true, icsContent: results[0][0].icsContent, updatedAt: results[0][0].updatedAt };
      }

      console.log('[Calendar API] Feed not found for token');
      return { found: false, icsContent: null, updatedAt: null };
    }),

  getCalendarFeedToken: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();

      const results = await db.query<[{ token: string; updatedAt: string }[]]>(
        `SELECT token, updatedAt FROM calendar_feeds WHERE email = $email LIMIT 1`,
        { email: normalizedEmail }
      );

      if (results?.[0]?.length > 0) {
        return { found: true, token: results[0][0].token, updatedAt: results[0][0].updatedAt };
      }

      return { found: false, token: null, updatedAt: null };
    }),

  deleteCalendarFeed: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const normalizedEmail = input.email.toLowerCase().trim();

      await db.query(
        `DELETE FROM calendar_feeds WHERE email = $email`,
        { email: normalizedEmail }
      );

      console.log('[Calendar API] Deleted calendar feed for:', normalizedEmail);
      return { success: true };
    }),

  fetchICS: publicProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      console.log('[Calendar API] Fetching ICS from URL:', input.url);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(input.url, {
          method: 'GET',
          headers: {
            'Accept': 'text/calendar, text/plain, application/octet-stream, */*',
            'User-Agent': 'Mozilla/5.0 (compatible; EasySeas/1.0; Calendar Sync)',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        console.log('[Calendar API] Response status:', response.status, response.statusText);
        
        const headersObj: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
        console.log('[Calendar API] Response headers:', headersObj);

        if (!response.ok) {
          console.error('[Calendar API] Fetch failed:', response.status, response.statusText);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `HTTP ${response.status}: ${response.statusText}`,
          });
        }

        const content = await response.text();
        console.log('[Calendar API] Fetched', content.length, 'characters');
        console.log('[Calendar API] Content preview:', content.substring(0, 200));

        // Check if content is HTML (login page, error page, etc.)
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('<!doctype') || lowerContent.includes('<html') || lowerContent.includes('<head>')) {
          console.error('[Calendar API] Received HTML instead of ICS');
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The URL returned an HTML page instead of calendar data. This usually means the URL requires authentication. Please try downloading the .ics file manually and importing it.',
          });
        }

        if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VEVENT')) {
          console.error('[Calendar API] Invalid content - not ICS format');
          console.error('[Calendar API] Content starts with:', content.substring(0, 200));
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid ICS file format. The URL did not return valid calendar data.',
          });
        }

        return { content };
      } catch (error) {
        console.error('[Calendar API] Error fetching ICS:', error);
        
        // Re-throw TRPCErrors as-is
        if (error instanceof TRPCError) {
          throw error;
        }
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new TRPCError({
              code: 'TIMEOUT',
              message: 'Request timed out after 30 seconds.',
            });
          }
          // Sanitize error message to avoid JSON parsing issues
          const sanitizedMessage = error.message
            .replace(/[<>]/g, '')
            .substring(0, 200);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch: ${sanitizedMessage}`,
          });
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unknown error occurred while fetching calendar data.',
        });
      }
    }),
});
