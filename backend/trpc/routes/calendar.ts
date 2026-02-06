import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const calendarRouter = createTRPCRouter({
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
