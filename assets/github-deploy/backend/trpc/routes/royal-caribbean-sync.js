import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context.js";

export const royalCaribbeanSyncRouter = createTRPCRouter({
  webLogin: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        cruiseLine: z.enum(["royal_caribbean", "celebrity"]),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[WebSync] Starting web sync for ${input.cruiseLine}`);
      console.log(`[WebSync] Username provided: ${input.username.substring(0, 3)}***`);
      
      console.log(`[WebSync] Direct API access is not available for ${input.cruiseLine}`);
      console.log(`[WebSync] Royal Caribbean does not provide a public API for third-party authentication`);
      
      const response = {
        success: false,
        error: `Web-based sync is not available for ${input.cruiseLine === 'celebrity' ? 'Celebrity Cruises' : 'Royal Caribbean'}. ` +
               `Their website does not provide a public API for third-party authentication. ` +
               `Please use one of these alternatives:\n\n` +
               `• Mobile App: Use the in-app browser to log in directly\n` +
               `• Browser Extension: Install Easy Seas™ extension and scrape from their website\n` +
               `• Manual Import: Export data from the website and import via CSV`,
        offers: [],
        bookedCruises: [],
        loyaltyData: null,
        message: null,
      };
      
      return response;
    }),

  checkStatus: publicProcedure.query(() => {
    return {
      available: false,
      message: "Direct web sync is not available. Royal Caribbean and Celebrity Cruises do not provide public APIs for third-party authentication. Please use the mobile app or browser extension instead.",
    };
  }),
});
