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
  webLogin: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        cruiseLine: z.enum(["royal_caribbean", "celebrity"]),
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
      
      const response: WebSyncResponse = {
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
