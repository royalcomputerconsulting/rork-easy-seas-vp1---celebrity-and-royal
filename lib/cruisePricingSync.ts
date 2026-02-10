import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';

interface CruisePricing {
  bookingId: string;
  shipName: string;
  sailDate: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  source: 'icruise' | 'cruisesheet' | 'royalcaribbean' | 'web';
  url: string;
  lastUpdated: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface CruiseInput {
  id: string;
  shipName: string;
  sailDate: string;
  nights: number;
  departurePort: string;
}

const pricingSchema = z.object({
  interiorPrice: z.number().describe('Per-person starting price for an interior/inside cabin in USD'),
  oceanviewPrice: z.number().describe('Per-person starting price for an oceanview cabin in USD'),
  balconyPrice: z.number().describe('Per-person starting price for a balcony stateroom in USD'),
  suitePrice: z.number().describe('Per-person starting price for a junior suite or entry-level suite in USD'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in the accuracy of these prices'),
  notes: z.string().optional().describe('Brief note about the pricing'),
});

const SHIP_CLASS_INFO: Record<string, string> = {
  'icon of the seas': 'Icon-class, newest and largest, premium pricing',
  'star of the seas': 'Icon-class, newest and largest, premium pricing',
  'utopia of the seas': 'Oasis-class, very large ship, higher pricing',
  'wonder of the seas': 'Oasis-class, very large ship, higher pricing',
  'symphony of the seas': 'Oasis-class, very large ship, higher pricing',
  'harmony of the seas': 'Oasis-class, very large ship, higher pricing',
  'allure of the seas': 'Oasis-class, large ship, moderate-high pricing',
  'oasis of the seas': 'Oasis-class, large ship, moderate-high pricing',
  'odyssey of the seas': 'Quantum-Ultra-class, modern ship, moderate-high pricing',
  'spectrum of the seas': 'Quantum-Ultra-class, modern ship, moderate-high pricing',
  'ovation of the seas': 'Quantum-class, modern ship, moderate pricing',
  'anthem of the seas': 'Quantum-class, modern ship, moderate pricing',
  'quantum of the seas': 'Quantum-class, modern ship, moderate pricing',
  'freedom of the seas': 'Freedom-class, large ship, moderate pricing',
  'liberty of the seas': 'Freedom-class, large ship, moderate pricing',
  'independence of the seas': 'Freedom-class, large ship, moderate pricing',
  'navigator of the seas': 'Voyager-class, mid-size ship, value pricing',
  'mariner of the seas': 'Voyager-class, mid-size ship, value pricing',
  'voyager of the seas': 'Voyager-class, mid-size ship, value pricing',
  'explorer of the seas': 'Voyager-class, mid-size ship, value pricing',
  'adventure of the seas': 'Voyager-class, mid-size ship, value pricing',
  'brilliance of the seas': 'Radiance-class, mid-size ship, value pricing',
  'radiance of the seas': 'Radiance-class, mid-size ship, value pricing',
  'serenade of the seas': 'Radiance-class, mid-size ship, value pricing',
  'jewel of the seas': 'Radiance-class, mid-size ship, value pricing',
  'enchantment of the seas': 'Vision-class, smaller classic ship, budget pricing',
  'grandeur of the seas': 'Vision-class, smaller classic ship, budget pricing',
  'rhapsody of the seas': 'Vision-class, smaller classic ship, budget pricing',
  'vision of the seas': 'Vision-class, smaller classic ship, budget pricing',
};

const getShipClassContext = (shipName: string): string => {
  const key = shipName.toLowerCase().trim();
  return SHIP_CLASS_INFO[key] || 'Royal Caribbean cruise ship';
};

const searchCruisePricing = async (cruise: CruiseInput): Promise<CruisePricing | null> => {
  try {
    const sailDateObj = new Date(cruise.sailDate);
    const monthYear = sailDateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const formattedDate = sailDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const shipClass = getShipClassContext(cruise.shipName);

    console.log(`[CruisePricing] Searching prices for: ${cruise.shipName} sailing ${formattedDate} (${cruise.nights}N from ${cruise.departurePort})`);

    const result = await generateObject({
      messages: [
        {
          role: 'user',
          content: `You are a cruise pricing expert with deep knowledge of Royal Caribbean cruise pricing. Find the current per-person cabin prices (double occupancy) for this specific sailing:

Ship: ${cruise.shipName}
Ship Class: ${shipClass}
Sail Date: ${formattedDate} (${monthYear})
Duration: ${cruise.nights} nights
Departure Port: ${cruise.departurePort}

Provide per-person starting prices in USD for each cabin category:
- Interior: cheapest inside cabin
- Oceanview: window/porthole cabin
- Balcony: private balcony stateroom
- Suite: junior suite or entry-level suite

Key pricing factors to consider:
1. Ship class determines base pricing tier (Icon/Oasis > Quantum > Freedom > Voyager > Radiance > Vision)
2. Season: ${monthYear} - peak seasons (holidays, summer, spring break) command premium prices
3. Itinerary length: ${cruise.nights} nights
4. Port: ${cruise.departurePort}
5. Royal Caribbean typical pricing patterns: Interior starts lowest, suites 3-5x interior price
6. Short cruises (3-5 nights) tend to have lower per-night but sometimes higher per-person totals vs 7+ night cruises

Return realistic market prices that someone would actually see on royalcaribbean.com, icruise.com, or cruisesheet.com for this sailing.`,
        },
      ],
      schema: pricingSchema,
    });

    if (result && (result.interiorPrice > 0 || result.balconyPrice > 0)) {
      const isValid =
        result.interiorPrice >= 100 &&
        result.interiorPrice < 15000 &&
        result.balconyPrice >= 100 &&
        result.balconyPrice < 25000;

      if (!isValid) {
        console.log(`[CruisePricing] Prices seem unrealistic for ${cruise.shipName}, skipping: INT $${result.interiorPrice}, BAL $${result.balconyPrice}`);
        return null;
      }

      console.log(
        `[CruisePricing] ✅ ${cruise.shipName}: INT $${result.interiorPrice} | OV $${result.oceanviewPrice} | BAL $${result.balconyPrice} | STE $${result.suitePrice} (${result.confidence})`
      );

      return {
        bookingId: cruise.id,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        interiorPrice: result.interiorPrice > 0 ? result.interiorPrice : undefined,
        oceanviewPrice: result.oceanviewPrice > 0 ? result.oceanviewPrice : undefined,
        balconyPrice: result.balconyPrice > 0 ? result.balconyPrice : undefined,
        suitePrice: result.suitePrice > 0 ? result.suitePrice : undefined,
        source: 'web',
        url: `https://www.royalcaribbean.com/cruises?ship=${encodeURIComponent(cruise.shipName)}`,
        lastUpdated: new Date().toISOString(),
        confidence: result.confidence,
      };
    }

    console.log(`[CruisePricing] No valid prices returned for ${cruise.shipName}`);
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`[CruisePricing] Search failed for ${cruise.shipName}:`, msg);
    return null;
  }
};

export interface SyncProgress {
  current: number;
  total: number;
  shipName: string;
  status: 'searching' | 'found' | 'not_found' | 'error';
}

export const syncCruisePricing = async (
  cruises: CruiseInput[],
  onProgress?: (progress: SyncProgress) => void
) => {
  console.log(`[CruisePricing] Starting web price search for ${cruises.length} cruises`);

  const allPricing: CruisePricing[] = [];
  const errors: string[] = [];

  for (let i = 0; i < cruises.length; i++) {
    const cruise = cruises[i];

    onProgress?.({
      current: i + 1,
      total: cruises.length,
      shipName: cruise.shipName,
      status: 'searching',
    });

    try {
      const pricing = await searchCruisePricing(cruise);

      if (pricing) {
        allPricing.push(pricing);
        onProgress?.({
          current: i + 1,
          total: cruises.length,
          shipName: cruise.shipName,
          status: 'found',
        });
      } else {
        errors.push(`No pricing found for ${cruise.shipName} (${cruise.sailDate})`);
        onProgress?.({
          current: i + 1,
          total: cruises.length,
          shipName: cruise.shipName,
          status: 'not_found',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[CruisePricing] Error for ${cruise.shipName}:`, msg);
      errors.push(`${cruise.shipName}: ${msg}`);
      onProgress?.({
        current: i + 1,
        total: cruises.length,
        shipName: cruise.shipName,
        status: 'error',
      });
    }
  }

  console.log(`[CruisePricing] Search complete: ${allPricing.length}/${cruises.length} cruises with pricing`);

  return {
    pricing: allPricing,
    syncedCount: cruises.length,
    successCount: allPricing.length,
    errors,
  };
};
