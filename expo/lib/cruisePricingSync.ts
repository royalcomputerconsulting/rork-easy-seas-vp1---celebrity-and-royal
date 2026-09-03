import { createDateFromString, formatDate } from './date';

export interface CruisePricing {
  bookingId: string;
  shipName: string;
  sailDate: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  portTaxesFees?: number;
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

export interface PricingCatalogRow extends Record<string, unknown> { id?: string; shipName?: string; sailDate?: string }
export interface PricingSyncOptions { catalog?: PricingCatalogRow[]; signal?: AbortSignal; concurrency?: number }
const numeric=(...values:unknown[])=>{for(const value of values){const number=Number(value);if(Number.isFinite(number)&&number>0)return number}return undefined};
const normalized=(value:unknown)=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function pricingFromCatalog(cruise:CruiseInput,catalog:PricingCatalogRow[]):CruisePricing|null{const matches=catalog.filter(row=>normalized(row.shipName)===normalized(cruise.shipName)&&String(row.sailDate??'').slice(0,10)===cruise.sailDate.slice(0,10));for(const row of matches){const interiorPrice=numeric(row.interiorPrice,row.interior,row.insidePrice),oceanviewPrice=numeric(row.oceanviewPrice,row.oceanViewPrice,row.oceanview),balconyPrice=numeric(row.balconyPrice,row.balcony),suitePrice=numeric(row.suitePrice,row.suite),portTaxesFees=numeric(row.portTaxesFees,row.taxes,row.taxesFees);if(interiorPrice||oceanviewPrice||balconyPrice||suitePrice)return{bookingId:cruise.id,shipName:cruise.shipName,sailDate:cruise.sailDate,interiorPrice,oceanviewPrice,balconyPrice,suitePrice,portTaxesFees,source:'royalcaribbean',url:String(row.sourceUrl??row.url??''),lastUpdated:String(row.pricingVerifiedAt??row.updatedAt??new Date().toISOString()),confidence:row.pricingVerified===true||row.verified===true?'high':'medium'}}return null}

// Live pricing is populated by the signed-in cruise-line sync. This module no
// longer imports an AI SDK into Metro or fabricates prices when authoritative
// provider data is unavailable.
const pricingSchema = {};
async function generateObject(_input: unknown): Promise<any | null> {
  console.log('[CruisePricing] AI price estimation is disabled; waiting for authoritative provider pricing.');
  return null;
}

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

const searchCruisePricing = async (cruise: CruiseInput, catalog: PricingCatalogRow[] = []): Promise<CruisePricing | null> => {
  try {
    const captured = pricingFromCatalog(cruise, catalog);
    if (captured) return captured;
    const sailDateObj = createDateFromString(cruise.sailDate);
    if (Number.isNaN(sailDateObj.getTime())) {
      console.warn('[CruisePricing] Skipping pricing search with an invalid sailing day:', cruise.sailDate);
      return null;
    }
    const monthYear = sailDateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const formattedDate = formatDate(cruise.sailDate, 'long');
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
- Port Taxes & Fees: government taxes, port charges, and fees per person

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
        portTaxesFees: result.portTaxesFees > 0 ? result.portTaxesFees : undefined,
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
  onProgress?: (progress: SyncProgress) => void,
  options: PricingSyncOptions = {},
) => {
  console.log(`[CruisePricing] Starting web price search for ${cruises.length} cruises`);

  const allPricing: CruisePricing[] = [];
  const errors: string[] = [];

  let cursor=0;
  const workers=Array.from({length:Math.max(1,Math.min(4,Math.floor(options.concurrency??2),cruises.length||1))},async()=>{while(true){if(options.signal?.aborted)throw new Error('PRICING_SYNC_CANCELLED');const i=cursor++;if(i>=cruises.length)return;const cruise=cruises[i];

    onProgress?.({
      current: i + 1,
      total: cruises.length,
      shipName: cruise.shipName,
      status: 'searching',
    });

    try {
      const pricing = await searchCruisePricing(cruise, options.catalog ?? []);

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
    }}});
  await Promise.all(workers);

  console.log(`[CruisePricing] Search complete: ${allPricing.length}/${cruises.length} cruises with pricing`);

  return {
    pricing: allPricing,
    syncedCount: cruises.length,
    successCount: allPricing.length,
    errors,
  };
};
