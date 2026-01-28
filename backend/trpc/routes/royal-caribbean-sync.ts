import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const OfferRowSchema = z.object({
  sourcePage: z.string(),
  offerName: z.string(),
  offerCode: z.string(),
  offerExpirationDate: z.string(),
  offerType: z.string(),
  shipName: z.string(),
  sailingDate: z.string(),
  itinerary: z.string(),
  departurePort: z.string(),
  cabinType: z.string(),
  numberOfGuests: z.string(),
  perks: z.string(),
  loyaltyLevel: z.string(),
  loyaltyPoints: z.string(),
});

const BookedCruiseRowSchema = z.object({
  sourcePage: z.string(),
  shipName: z.string(),
  sailingStartDate: z.string(),
  sailingEndDate: z.string(),
  sailingDates: z.string(),
  itinerary: z.string(),
  departurePort: z.string(),
  cabinType: z.string(),
  cabinNumberOrGTY: z.string(),
  bookingId: z.string(),
  status: z.string(),
  loyaltyLevel: z.string(),
  loyaltyPoints: z.string(),
});

const LoyaltyDataSchema = z.object({
  crownAndAnchorLevel: z.string().optional(),
  crownAndAnchorPoints: z.string().optional(),
  clubRoyaleTier: z.string().optional(),
  clubRoyalePoints: z.string().optional(),
});

const ROYAL_CARIBBEAN_CONFIG = {
  royal_caribbean: {
    loginUrl: "https://www.royalcaribbean.com/api/auth/login",
    offersApiUrl: "https://www.royalcaribbean.com/api/club-royale/offers",
    upcomingApiUrl: "https://www.royalcaribbean.com/api/account/upcoming-cruises",
    holdsApiUrl: "https://www.royalcaribbean.com/api/account/courtesy-holds",
    loyaltyApiUrl: "https://www.royalcaribbean.com/api/loyalty/status",
  },
  celebrity: {
    loginUrl: "https://www.celebritycruises.com/api/auth/login",
    offersApiUrl: "https://www.celebritycruises.com/api/blue-chip-club/offers",
    upcomingApiUrl: "https://www.celebritycruises.com/api/account/upcoming-cruises",
    holdsApiUrl: "https://www.celebritycruises.com/api/account/courtesy-holds",
    loyaltyApiUrl: "https://www.celebritycruises.com/api/loyalty/status",
  },
};

async function attemptLogin(
  username: string,
  password: string,
  cruiseLine: "royal_caribbean" | "celebrity"
): Promise<{ success: boolean; sessionCookies?: string; error?: string }> {
  const config = ROYAL_CARIBBEAN_CONFIG[cruiseLine];
  
  console.log(`[WebSync] Attempting login for ${cruiseLine}...`);
  
  try {
    const response = await fetch(config.loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": cruiseLine === "celebrity" 
          ? "https://www.celebritycruises.com" 
          : "https://www.royalcaribbean.com",
      },
      body: JSON.stringify({
        username,
        password,
        rememberMe: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[WebSync] Login failed with status ${response.status}: ${errorText}`);
      return {
        success: false,
        error: response.status === 401 
          ? "Invalid username or password" 
          : `Login failed (${response.status}). The cruise line may be blocking automated access.`,
      };
    }

    const cookies = response.headers.get("set-cookie") || "";
    console.log(`[WebSync] Login successful, received cookies`);
    
    return {
      success: true,
      sessionCookies: cookies,
    };
  } catch (error) {
    console.error(`[WebSync] Login error:`, error);
    return {
      success: false,
      error: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}. The website may be blocking automated access.`,
    };
  }
}

async function fetchWithSession(
  url: string,
  cookies: string,
  cruiseLine: "royal_caribbean" | "celebrity"
): Promise<any> {
  const origin = cruiseLine === "celebrity" 
    ? "https://www.celebritycruises.com" 
    : "https://www.royalcaribbean.com";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Cookie": cookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": origin,
      "Referer": origin,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
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
    .mutation(async ({ input }) => {
      console.log(`[WebSync] Starting web sync for ${input.cruiseLine}`);
      
      const loginResult = await attemptLogin(
        input.username,
        input.password,
        input.cruiseLine
      );

      if (!loginResult.success) {
        return {
          success: false,
          error: loginResult.error || "Login failed",
          offers: [],
          bookedCruises: [],
          loyaltyData: null,
        };
      }

      const config = ROYAL_CARIBBEAN_CONFIG[input.cruiseLine];
      const cookies = loginResult.sessionCookies || "";
      
      let offers: z.infer<typeof OfferRowSchema>[] = [];
      let bookedCruises: z.infer<typeof BookedCruiseRowSchema>[] = [];
      let loyaltyData: z.infer<typeof LoyaltyDataSchema> | null = null;
      const errors: string[] = [];

      try {
        console.log(`[WebSync] Fetching offers...`);
        const offersData = await fetchWithSession(config.offersApiUrl, cookies, input.cruiseLine);
        if (Array.isArray(offersData)) {
          offers = offersData;
        } else if (offersData?.offers) {
          offers = offersData.offers;
        }
        console.log(`[WebSync] Fetched ${offers.length} offers`);
      } catch (error) {
        console.error(`[WebSync] Failed to fetch offers:`, error);
        errors.push(`Failed to fetch offers: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      try {
        console.log(`[WebSync] Fetching upcoming cruises...`);
        const upcomingData = await fetchWithSession(config.upcomingApiUrl, cookies, input.cruiseLine);
        const upcomingCruises = Array.isArray(upcomingData) ? upcomingData : (upcomingData?.cruises || []);
        bookedCruises.push(...upcomingCruises.map((c: any) => ({ ...c, status: "Upcoming" })));
        console.log(`[WebSync] Fetched ${upcomingCruises.length} upcoming cruises`);
      } catch (error) {
        console.error(`[WebSync] Failed to fetch upcoming cruises:`, error);
        errors.push(`Failed to fetch upcoming cruises: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      try {
        console.log(`[WebSync] Fetching courtesy holds...`);
        const holdsData = await fetchWithSession(config.holdsApiUrl, cookies, input.cruiseLine);
        const holds = Array.isArray(holdsData) ? holdsData : (holdsData?.holds || []);
        bookedCruises.push(...holds.map((c: any) => ({ ...c, status: "Courtesy Hold" })));
        console.log(`[WebSync] Fetched ${holds.length} courtesy holds`);
      } catch (error) {
        console.error(`[WebSync] Failed to fetch courtesy holds:`, error);
        errors.push(`Failed to fetch courtesy holds: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      return {
        success: true,
        error: errors.length > 0 ? errors.join("; ") : null,
        offers,
        bookedCruises,
        loyaltyData,
        message: `Successfully authenticated. Retrieved ${offers.length} offers and ${bookedCruises.length} cruises.`,
      };
    }),

  checkStatus: publicProcedure.query(() => {
    return {
      available: true,
      message: "Web sync service is available. Note: Direct API access may be limited by cruise line security measures.",
    };
  }),
});
