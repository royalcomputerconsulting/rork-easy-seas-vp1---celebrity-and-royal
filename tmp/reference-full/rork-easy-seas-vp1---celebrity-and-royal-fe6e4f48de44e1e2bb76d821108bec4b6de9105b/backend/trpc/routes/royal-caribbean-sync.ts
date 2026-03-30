import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

interface OfferRow {
  sourcePage: string;
  offerName: string;
  offerCode: string;
  offerExpirationDate: string;
  offerType: string;
  shipName: string;
  sailingDate: string;
  itinerary: string;
  departurePort: string;
  cabinType: string;
  numberOfGuests: string;
  perks: string;
  loyaltyLevel: string;
  loyaltyPoints: string;
}

interface BookedCruiseRow {
  sourcePage: string;
  shipName: string;
  sailingStartDate: string;
  sailingEndDate: string;
  sailingDates: string;
  itinerary: string;
  departurePort: string;
  cabinType: string;
  cabinNumberOrGTY: string;
  bookingId: string;
  status: string;
  loyaltyLevel: string;
  loyaltyPoints: string;
}

interface LoyaltyData {
  crownAndAnchorLevel?: string;
  crownAndAnchorPoints?: string;
  clubRoyaleTier?: string;
  clubRoyalePoints?: string;
}

interface WebSyncResponse {
  success: boolean;
  error: string | null;
  offers: OfferRow[];
  bookedCruises: BookedCruiseRow[];
  loyaltyData: LoyaltyData | null;
  message: string | null;
}

export const royalCaribbeanSyncRouter = createTRPCRouter({
  cookieSync: publicProcedure
    .input(
      z.object({
        cookies: z.string().min(1),
        cruiseLine: z.enum(["royal_caribbean", "celebrity", "carnival"]),
      })
    )
    .mutation(async ({ input }): Promise<WebSyncResponse> => {
      console.log(`[CookieSync] Starting cookie-based sync for ${input.cruiseLine}`);
      console.log(`[CookieSync] Cookies length: ${input.cookies.length}`);
      
      const brandName = input.cruiseLine === 'celebrity'
        ? 'Celebrity Cruises'
        : input.cruiseLine === 'carnival'
          ? 'Carnival Cruise Line'
          : 'Royal Caribbean';
      const response: WebSyncResponse = {
        success: false,
        error: `Cookie-based sync for ${brandName} is not enabled on this deployment yet. ` +
               `The backend still needs to be configured to process authenticated browser sessions securely. ` +
               `Please use the Easy Seas browser extension or the mobile in-app browser for now.`,
        offers: [],
        bookedCruises: [],
        loyaltyData: null,
        message: null,
      };
      
      return response;
    }),

  webLogin: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        cruiseLine: z.enum(["royal_caribbean", "celebrity", "carnival"]),
      })
    )
    .mutation(async ({ input }): Promise<WebSyncResponse> => {
      console.log(`[WebSync] Starting web sync for ${input.cruiseLine}`);
      console.log(`[WebSync] Username provided: ${input.username.substring(0, 3)}***`);
      
      // Royal Caribbean and Celebrity Cruises do not have public APIs
      // Their websites use session-based authentication with CSRF tokens
      // and are protected against automated access.
      // 
      // Direct server-to-server authentication is not possible because:
      // 1. CORS policies block cross-origin requests
      // 2. Authentication requires browser cookies and CSRF tokens
      // 3. The APIs are not documented or publicly available
      // 4. Rate limiting and bot detection are in place
      //
      // The proper solution is to use the mobile app's WebView (which works)
      // or the browser extension for web users.
      
      console.log(`[WebSync] Direct API access is not available for ${input.cruiseLine}`);
      console.log(`[WebSync] Royal Caribbean does not provide a public API for third-party authentication`);
      
      const brandName = input.cruiseLine === 'celebrity'
        ? 'Celebrity Cruises'
        : input.cruiseLine === 'carnival'
          ? 'Carnival Cruise Line'
          : 'Royal Caribbean';
      const response: WebSyncResponse = {
        success: false,
        error: `Web-based sync is not available for ${brandName} on this deployment. ` +
               `Use one of these alternatives:\n\n` +
               `• Browser Extension: Install the Easy Seas™ extension and sync on the website\n` +
               `• Mobile App: Use the in-app browser to log in directly\n` +
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
      message: "Direct web sync is not available on this deployment. Please use the Easy Seas browser extension or the mobile in-app browser instead.",
    };
  }),
});
