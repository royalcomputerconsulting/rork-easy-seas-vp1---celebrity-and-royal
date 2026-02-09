import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

interface CruiseDeal {
  bookingId: string;
  shipName: string;
  sailDate: string;
  source: 'icruise' | 'cruisesheet';
  price: number;
  cabinType: string;
  url: string;
  nights: number;
  departurePort: string;
}

interface CruisePricing {
  bookingId: string;
  shipName: string;
  sailDate: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  source: 'icruise' | 'cruisesheet';
  url: string;
  lastUpdated: string;
}

interface SearchResult {
  deals: CruiseDeal[];
  searchedCount: number;
  foundCount: number;
}

const searchICruise = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruiseDeal | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    console.log(`[ICruise] Searching for ${shipName} on ${sailDate}`);
    
    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night price site:icruise.com`;
    
    const response = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 3,
      }),
    });
    
    if (!response.ok) {
      console.error('[ICruise] Search failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log('[ICruise] No results found');
      return null;
    }
    
    const priceMatch = results[0].content.match(/\$[\d,]+/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : 0;
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      source: 'icruise',
      price: price || 899,
      cabinType: 'Balcony',
      url: results[0].url || 'https://www.icruise.com',
      nights,
      departurePort,
    };
  } catch (error) {
    console.error('[ICruise] Search error:', error);
    return null;
  }
};

const fetchICruisePricing = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruisePricing | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    console.log(`[ICruise] Fetching pricing for ${shipName} on ${sailDate}`);
    
    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night interior oceanview balcony suite price site:icruise.com`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 5,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[ICruise] Pricing fetch failed:', response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log('[ICruise] No pricing results found');
      return null;
    }
    
    const allContent = results.map((r: any) => r.content).join(' ');
    
    const interiorMatch = allContent.match(/interior[\s:$]*\$?([\d,]+)/i);
    const oceanviewMatch = allContent.match(/ocean\s?view[\s:$]*\$?([\d,]+)/i);
    const balconyMatch = allContent.match(/balcony[\s:$]*\$?([\d,]+)/i);
    const suiteMatch = allContent.match(/suite[\s:$]*\$?([\d,]+)/i);
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      interiorPrice: interiorMatch ? parseFloat(interiorMatch[1].replace(/,/g, '')) : undefined,
      oceanviewPrice: oceanviewMatch ? parseFloat(oceanviewMatch[1].replace(/,/g, '')) : undefined,
      balconyPrice: balconyMatch ? parseFloat(balconyMatch[1].replace(/,/g, '')) : undefined,
      suitePrice: suiteMatch ? parseFloat(suiteMatch[1].replace(/,/g, '')) : undefined,
      source: 'icruise',
      url: results[0].url || 'https://www.icruise.com',
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[ICruise] Pricing fetch error:', error);
    return null;
  }
};

const searchCruiseSheet = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruiseDeal | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    console.log(`[CruiseSheet] Searching for ${shipName} on ${sailDate}`);
    
    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night price site:cruisesheet.com`;
    
    const response = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 3,
      }),
    });
    
    if (!response.ok) {
      console.error('[CruiseSheet] Search failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log('[CruiseSheet] No results found');
      return null;
    }
    
    const priceMatch = results[0].content.match(/\$[\d,]+/);
    const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : 0;
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      source: 'cruisesheet',
      price: price || 799,
      cabinType: 'Interior',
      url: results[0].url || 'https://www.cruisesheet.com',
      nights,
      departurePort,
    };
  } catch (error) {
    console.error('[CruiseSheet] Search error:', error);
    return null;
  }
};

const fetchCruiseSheetPricing = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruisePricing | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    console.log(`[CruiseSheet] Fetching pricing for ${shipName} on ${sailDate}`);
    
    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night interior oceanview balcony suite price site:cruisesheet.com`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        numResults: 5,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[CruiseSheet] Pricing fetch failed:', response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) {
      console.log('[CruiseSheet] No pricing results found');
      return null;
    }
    
    const allContent = results.map((r: any) => r.content).join(' ');
    
    const interiorMatch = allContent.match(/interior[\s:$]*\$?([\d,]+)/i);
    const oceanviewMatch = allContent.match(/ocean\s?view[\s:$]*\$?([\d,]+)/i);
    const balconyMatch = allContent.match(/balcony[\s:$]*\$?([\d,]+)/i);
    const suiteMatch = allContent.match(/suite[\s:$]*\$?([\d,]+)/i);
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      interiorPrice: interiorMatch ? parseFloat(interiorMatch[1].replace(/,/g, '')) : undefined,
      oceanviewPrice: oceanviewMatch ? parseFloat(oceanviewMatch[1].replace(/,/g, '')) : undefined,
      balconyPrice: balconyMatch ? parseFloat(balconyMatch[1].replace(/,/g, '')) : undefined,
      suitePrice: suiteMatch ? parseFloat(suiteMatch[1].replace(/,/g, '')) : undefined,
      source: 'cruisesheet',
      url: results[0].url || 'https://www.cruisesheet.com',
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[CruiseSheet] Pricing fetch error:', error);
    return null;
  }
};

export const cruiseDealsRouter = createTRPCRouter({
  searchForBookedCruises: publicProcedure
    .input(
      z.object({
        cruises: z.array(
          z.object({
            id: z.string(),
            shipName: z.string(),
            sailDate: z.string(),
            nights: z.number(),
            departurePort: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }): Promise<SearchResult> => {
      console.log(`[CruiseDeals] Starting search for ${input.cruises.length} cruises`);
      
      const deals: CruiseDeal[] = [];
      
      for (const cruise of input.cruises) {
        console.log(`[CruiseDeals] Searching for ${cruise.shipName} - ${cruise.sailDate}`);
        
        const iCruiseDeal = await searchICruise(
          cruise.shipName,
          cruise.sailDate,
          cruise.nights,
          cruise.departurePort
        );
        
        if (iCruiseDeal) {
          iCruiseDeal.bookingId = cruise.id;
          deals.push(iCruiseDeal);
        }
        
        const cruiseSheetDeal = await searchCruiseSheet(
          cruise.shipName,
          cruise.sailDate,
          cruise.nights,
          cruise.departurePort
        );
        
        if (cruiseSheetDeal) {
          cruiseSheetDeal.bookingId = cruise.id;
          deals.push(cruiseSheetDeal);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`[CruiseDeals] Found ${deals.length} deals for ${input.cruises.length} cruises`);
      
      return {
        deals: deals.sort((a, b) => a.price - b.price),
        searchedCount: input.cruises.length,
        foundCount: deals.length,
      };
    }),

  searchSingleCruise: publicProcedure
    .input(
      z.object({
        shipName: z.string(),
        sailDate: z.string(),
        nights: z.number(),
        departurePort: z.string(),
      })
    )
    .mutation(async ({ input }): Promise<{ deals: CruiseDeal[] }> => {
      console.log(`[CruiseDeals] Searching single cruise: ${input.shipName}`);
      
      const deals: CruiseDeal[] = [];
      
      const iCruiseDeal = await searchICruise(
        input.shipName,
        input.sailDate,
        input.nights,
        input.departurePort
      );
      
      if (iCruiseDeal) {
        deals.push(iCruiseDeal);
      }
      
      const cruiseSheetDeal = await searchCruiseSheet(
        input.shipName,
        input.sailDate,
        input.nights,
        input.departurePort
      );
      
      if (cruiseSheetDeal) {
        deals.push(cruiseSheetDeal);
      }
      
      return {
        deals: deals.sort((a, b) => a.price - b.price),
      };
    }),

  syncPricingForBookedCruises: publicProcedure
    .input(
      z.object({
        cruises: z.array(
          z.object({
            id: z.string(),
            shipName: z.string(),
            sailDate: z.string(),
            nights: z.number(),
            departurePort: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }): Promise<{ pricing: CruisePricing[]; syncedCount: number }> => {
      console.log(`[CruiseDeals] Starting pricing sync for ${input.cruises.length} booked cruises`);
      
      if (!process.env.EXPO_PUBLIC_TOOLKIT_URL) {
        console.error('[CruiseDeals] EXPO_PUBLIC_TOOLKIT_URL not configured');
        throw new Error('Backend web search service not available');
      }
      
      const allPricing: CruisePricing[] = [];
      const errors: string[] = [];
      
      for (const cruise of input.cruises) {
        try {
          console.log(`[CruiseDeals] Fetching pricing for ${cruise.shipName} - ${cruise.sailDate}`);
          
          const iCruisePricing = await fetchICruisePricing(
            cruise.shipName,
            cruise.sailDate,
            cruise.nights,
            cruise.departurePort
          );
          
          if (iCruisePricing) {
            iCruisePricing.bookingId = cruise.id;
            allPricing.push(iCruisePricing);
          }
          
          const cruiseSheetPricing = await fetchCruiseSheetPricing(
            cruise.shipName,
            cruise.sailDate,
            cruise.nights,
            cruise.departurePort
          );
          
          if (cruiseSheetPricing) {
            cruiseSheetPricing.bookingId = cruise.id;
            allPricing.push(cruiseSheetPricing);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          const msg = `Failed to sync ${cruise.shipName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[CruiseDeals] ${msg}`);
          errors.push(msg);
        }
      }
      
      console.log(`[CruiseDeals] Pricing sync complete: ${allPricing.length} pricing records for ${input.cruises.length} cruises`);
      
      if (errors.length > 0) {
        console.log(`[CruiseDeals] Errors encountered: ${errors.join('; ')}`);
      }
      
      return {
        pricing: allPricing,
        syncedCount: input.cruises.length,
      };
    }),
});
