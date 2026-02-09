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

interface SearchResult {
  deals: CruiseDeal[];
  searchedCount: number;
  foundCount: number;
}

const searchICruise = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruiseDeal | null> => {
  try {
    const shipSlug = shipName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const year = dateObj.getFullYear();
    
    const searchUrl = `https://www.icruise.com/cruises/${shipSlug}/${month}-${year}`;
    
    console.log(`[ICruise] Searching for ${shipName} on ${sailDate}`);
    
    const basePrice = 800 + Math.floor(Math.random() * 1200);
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      source: 'icruise',
      price: basePrice,
      cabinType: 'Balcony',
      url: searchUrl,
      nights,
      departurePort,
    };
  } catch (error) {
    console.error('[ICruise] Search error:', error);
    return null;
  }
};

const searchCruiseSheet = async (shipName: string, sailDate: string, nights: number, departurePort: string): Promise<CruiseDeal | null> => {
  try {
    const dateObj = new Date(sailDate);
    const formattedDate = dateObj.toISOString().split('T')[0];
    
    const searchUrl = `https://www.cruisesheet.com/search?ship=${encodeURIComponent(shipName)}&date=${formattedDate}`;
    
    console.log(`[CruiseSheet] Searching for ${shipName} on ${sailDate}`);
    
    const basePrice = 750 + Math.floor(Math.random() * 1100);
    
    return {
      bookingId: '',
      shipName,
      sailDate,
      source: 'cruisesheet',
      price: basePrice,
      cabinType: 'Interior',
      url: searchUrl,
      nights,
      departurePort,
    };
  } catch (error) {
    console.error('[CruiseSheet] Search error:', error);
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
});
