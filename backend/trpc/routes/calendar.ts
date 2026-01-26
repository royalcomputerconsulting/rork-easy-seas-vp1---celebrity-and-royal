import { z } from "zod";
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
        console.log('[Calendar API] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          console.error('[Calendar API] Fetch failed:', response.status, response.statusText);
          const errorBody = await response.text().catch(() => 'Unable to read error body');
          console.error('[Calendar API] Error body:', errorBody.substring(0, 500));
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();
        console.log('[Calendar API] Fetched', content.length, 'characters');
        console.log('[Calendar API] Content preview:', content.substring(0, 200));

        if (!content.includes('BEGIN:VCALENDAR') && !content.includes('BEGIN:VEVENT')) {
          console.error('[Calendar API] Invalid content - not ICS format');
          console.error('[Calendar API] Content starts with:', content.substring(0, 500));
          throw new Error('Invalid ICS file format - not a valid calendar file. The URL may require authentication or returned HTML instead of calendar data.');
        }

        return { content };
      } catch (error) {
        console.error('[Calendar API] Error fetching ICS:', error);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Request timed out after 30 seconds. The server may be slow or unreachable.');
          }
          if (error.message.includes('fetch')) {
            throw new Error(`Network error: Unable to connect to the URL. Please check the URL is correct and accessible.`);
          }
        }
        
        throw error;
      }
    }),
});
