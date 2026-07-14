import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

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
  confidence: 'high' | 'medium' | 'low';
}

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

const SHIP_SLUGS: Record<string, string> = {
  'adventure of the seas': 'adventure-of-the-seas',
  'allure of the seas': 'allure-of-the-seas',
  'anthem of the seas': 'anthem-of-the-seas',
  'brilliance of the seas': 'brilliance-of-the-seas',
  'enchantment of the seas': 'enchantment-of-the-seas',
  'explorer of the seas': 'explorer-of-the-seas',
  'freedom of the seas': 'freedom-of-the-seas',
  'grandeur of the seas': 'grandeur-of-the-seas',
  'harmony of the seas': 'harmony-of-the-seas',
  'icon of the seas': 'icon-of-the-seas',
  'independence of the seas': 'independence-of-the-seas',
  'jewel of the seas': 'jewel-of-the-seas',
  'liberty of the seas': 'liberty-of-the-seas',
  'mariner of the seas': 'mariner-of-the-seas',
  'navigator of the seas': 'navigator-of-the-seas',
  'oasis of the seas': 'oasis-of-the-seas',
  'odyssey of the seas': 'odyssey-of-the-seas',
  'ovation of the seas': 'ovation-of-the-seas',
  'quantum of the seas': 'quantum-of-the-seas',
  'radiance of the seas': 'radiance-of-the-seas',
  'rhapsody of the seas': 'rhapsody-of-the-seas',
  'serenade of the seas': 'serenade-of-the-seas',
  'spectrum of the seas': 'spectrum-of-the-seas',
  'star of the seas': 'star-of-the-seas',
  'symphony of the seas': 'symphony-of-the-seas',
  'utopia of the seas': 'utopia-of-the-seas',
  'vision of the seas': 'vision-of-the-seas',
  'voyager of the seas': 'voyager-of-the-seas',
  'wonder of the seas': 'wonder-of-the-seas',
};

const getShipSlug = (shipName: string): string => {
  const lower = shipName.toLowerCase().trim();
  if (SHIP_SLUGS[lower]) return SHIP_SLUGS[lower];
  return lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

const getShipShortName = (shipName: string): string => {
  return shipName
    .replace(/\s+of\s+the\s+Seas$/i, '')
    .replace(/^Royal Caribbean\s*/i, '')
    .trim();
};

const extractPricesFromText = (text: string): {
  interior?: number;
  oceanview?: number;
  balcony?: number;
  suite?: number;
} => {
  const prices: { interior?: number; oceanview?: number; balcony?: number; suite?: number } = {};
  const normalizedText = text.toLowerCase();

  const interiorPatterns = [
    /interior[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /inside[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /interior\s+(?:cabin|stateroom|room|guarantee)[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /(?:int|interior)\s*[\-:]\s*\$?([\d,]+)/gi,
  ];

  const oceanviewPatterns = [
    /ocean\s?view[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /outside[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /(?:ocn|ov)\s*[\-:]\s*\$?([\d,]+)/gi,
  ];

  const balconyPatterns = [
    /balcony[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /verandah?[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /(?:bal)\s*[\-:]\s*\$?([\d,]+)/gi,
  ];

  const suitePatterns = [
    /suite[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /junior\s+suite[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /(?:ste|js)\s*[\-:]\s*\$?([\d,]+)/gi,
  ];

  const findLowest = (patterns: RegExp[], source: string): number | undefined => {
    const found: number[] = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (val > 100 && val < 50000) found.push(val);
      }
    }
    return found.length > 0 ? Math.min(...found) : undefined;
  };

  prices.interior = findLowest(interiorPatterns, normalizedText);
  prices.oceanview = findLowest(oceanviewPatterns, normalizedText);
  prices.balcony = findLowest(balconyPatterns, normalizedText);
  prices.suite = findLowest(suitePatterns, normalizedText);

  if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
    const genericPrices: number[] = [];
    const genericPattern = /\$([\d,]+)/g;
    let match;
    while ((match = genericPattern.exec(text)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (val > 200 && val < 20000) genericPrices.push(val);
    }
    if (genericPrices.length > 0) {
      genericPrices.sort((a, b) => a - b);
      if (genericPrices.length >= 1) prices.interior = genericPrices[0];
      if (genericPrices.length >= 2) prices.balcony = genericPrices[Math.floor(genericPrices.length / 2)];
      if (genericPrices.length >= 3) prices.suite = genericPrices[genericPrices.length - 1];
    }
  }

  return prices;
};

const safeFetch = async (url: string, timeoutMs: number = 15000): Promise<string | null> => {
  try {
    console.log(`[CruiseDeals] Fetching: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[CruiseDeals] ${url} returned ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log(`[CruiseDeals] ${url} returned ${text.length} chars`);
    return text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('AbortError') || msg.includes('abort')) {
      console.log(`[CruiseDeals] ${url} timed out`);
    } else {
      console.log(`[CruiseDeals] ${url} fetch error: ${msg}`);
    }
    return null;
  }
};

const tryWebSearch = async (
  apiUrl: string,
  query: string,
  numResults: number = 5
): Promise<{ results: { url?: string; title?: string; content?: string }[] } | null> => {
  try {
    console.log(`[CruiseDeals] Web search: "${query.substring(0, 80)}..."`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${apiUrl}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[CruiseDeals] Web search returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return { results: data.results || [] };
  } catch (error) {
    console.log(`[CruiseDeals] Web search failed: ${error instanceof Error ? error.message : error}`);
    return null;
  }
};

const scrapeICruise = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  const slug = getShipSlug(shipName);

  const urls = [
    `https://www.icruise.com/cruiselines/royal-caribbean-${slug}-sailplan.html`,
    `https://www.icruise.com/cruises/royal-caribbean/${slug}`,
    `https://www.icruise.com/cruises/royal-caribbean-${slug}.html`,
    `https://m.icruise.com/cruise-lines/royal-caribbean-${slug}.html`,
    `https://lp.icruise.com/royal-caribbean-cruise-lines`,
  ];

  for (const url of urls) {
    const html = await safeFetch(url);
    if (!html) continue;

    const prices = extractPricesFromText(html);
    if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
      console.log(`[CruiseDeals] [icruise] Found prices from ${url}:`, prices);
      return {
        bookingId: '',
        shipName,
        sailDate,
        interiorPrice: prices.interior,
        oceanviewPrice: prices.oceanview,
        balconyPrice: prices.balcony,
        suitePrice: prices.suite,
        source: 'icruise',
        url,
        lastUpdated: new Date().toISOString(),
        confidence: 'medium',
      };
    }
  }

  console.log(`[CruiseDeals] [icruise] No prices found for ${shipName} from any URL`);
  return null;
};

const scrapeCruiseSheet = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  const slug = getShipSlug(shipName);

  const urls = [
    `https://cruisesheet.com/cruise-line/royal-caribbean/${slug}`,
    `https://cruisesheet.com/ship/${slug}`,
    `https://cruisesheet.com/cruise/royal-caribbean/${slug}`,
  ];

  for (const url of urls) {
    const html = await safeFetch(url);
    if (!html) continue;

    if (html.includes('Cloudflare') && html.includes('blocked')) {
      console.log(`[CruiseDeals] [cruisesheet] Blocked by Cloudflare at ${url}`);
      continue;
    }

    const prices = extractPricesFromText(html);
    if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
      console.log(`[CruiseDeals] [cruisesheet] Found prices from ${url}:`, prices);
      return {
        bookingId: '',
        shipName,
        sailDate,
        interiorPrice: prices.interior,
        oceanviewPrice: prices.oceanview,
        balconyPrice: prices.balcony,
        suitePrice: prices.suite,
        source: 'cruisesheet',
        url,
        lastUpdated: new Date().toISOString(),
        confidence: 'medium',
      };
    }
  }

  console.log(`[CruiseDeals] [cruisesheet] No prices found for ${shipName}`);
  return null;
};

const scrapeRoyalCaribbean = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  const slug = getShipSlug(shipName);
  const shortSlug = slug.replace(/-of-the-seas$/, '');

  const urls = [
    `https://www.royalcaribbean.com/cruises?ships=${encodeURIComponent(shipName)}&departurePort=${encodeURIComponent(departurePort)}`,
    `https://www.royalcaribbean.com/cruise-ships/${slug}`,
    `https://www.royalcaribbean.com/cruise-ships/${shortSlug}-of-the-seas`,
  ];

  for (const url of urls) {
    const html = await safeFetch(url);
    if (!html) continue;

    const prices = extractPricesFromText(html);
    if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
      console.log(`[CruiseDeals] [rc] Found prices from ${url}:`, prices);
      return {
        bookingId: '',
        shipName,
        sailDate,
        interiorPrice: prices.interior,
        oceanviewPrice: prices.oceanview,
        balconyPrice: prices.balcony,
        suitePrice: prices.suite,
        source: 'royalcaribbean',
        url,
        lastUpdated: new Date().toISOString(),
        confidence: 'medium',
      };
    }
  }

  console.log(`[CruiseDeals] [rc] No prices found for ${shipName}`);
  return null;
};

const searchWithToolkit = async (
  apiUrl: string,
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing[]> => {
  const results: CruisePricing[] = [];
  const dateObj = new Date(sailDate);
  const month = dateObj.toLocaleString('en-US', { month: 'long' });
  const year = dateObj.getFullYear();
  const shortName = getShipShortName(shipName);

  const queries = [
    `${shipName} cruise ${month} ${year} ${departurePort} ${nights} night interior balcony suite price site:icruise.com`,
    `${shipName} cruise ${month} ${year} ${departurePort} ${nights} night price site:cruisesheet.com`,
    `Royal Caribbean ${shortName} ${month} ${year} cruise pricing per person interior balcony suite`,
  ];

  for (const query of queries) {
    const searchData = await tryWebSearch(apiUrl, query, 8);
    if (!searchData || searchData.results.length === 0) continue;

    const allContent = searchData.results
      .map((r) => `${r.title || ''} ${r.content || ''}`)
      .join(' ');

    const prices = extractPricesFromText(allContent);
    if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
      const source = query.includes('icruise.com') ? 'icruise' as const
        : query.includes('cruisesheet.com') ? 'cruisesheet' as const
        : 'web' as const;

      console.log(`[CruiseDeals] [toolkit] Found prices via search for "${query.substring(0, 50)}":`, prices);
      results.push({
        bookingId: '',
        shipName,
        sailDate,
        interiorPrice: prices.interior,
        oceanviewPrice: prices.oceanview,
        balconyPrice: prices.balcony,
        suitePrice: prices.suite,
        source,
        url: searchData.results[0]?.url || '',
        lastUpdated: new Date().toISOString(),
        confidence: 'high',
      });
    }
  }

  return results;
};

const fetchPricingForCruise = async (
  apiUrl: string | null,
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing[]> => {
  const results: CruisePricing[] = [];

  if (apiUrl) {
    console.log(`[CruiseDeals] Strategy 1: Toolkit web search for ${shipName}`);
    const searchResults = await searchWithToolkit(apiUrl, shipName, sailDate, nights, departurePort);
    if (searchResults.length > 0) {
      results.push(...searchResults);
      console.log(`[CruiseDeals] Toolkit search found ${searchResults.length} pricing records`);
      return results;
    }
    console.log(`[CruiseDeals] Toolkit search returned no results, trying direct scraping...`);
  }

  console.log(`[CruiseDeals] Strategy 2: Direct scraping for ${shipName}`);
  const [icruiseResult, cruisesheetResult, rcResult] = await Promise.allSettled([
    scrapeICruise(shipName, sailDate, nights, departurePort),
    scrapeCruiseSheet(shipName, sailDate, nights, departurePort),
    scrapeRoyalCaribbean(shipName, sailDate, nights, departurePort),
  ]);

  if (icruiseResult.status === 'fulfilled' && icruiseResult.value) {
    results.push(icruiseResult.value);
  }
  if (cruisesheetResult.status === 'fulfilled' && cruisesheetResult.value) {
    results.push(cruisesheetResult.value);
  }
  if (rcResult.status === 'fulfilled' && rcResult.value) {
    results.push(rcResult.value);
  }

  if (results.length === 0) {
    console.log(`[CruiseDeals] All direct scraping failed for ${shipName}`);
  }

  return results;
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
        searchApiUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[CruiseDeals] Starting search for ${input.cruises.length} cruises`);
      const apiUrl = input.searchApiUrl || process.env.EXPO_PUBLIC_TOOLKIT_URL || null;
      console.log(`[CruiseDeals] API URL available: ${apiUrl ? 'yes' : 'no'}`);

      const deals: CruiseDeal[] = [];

      for (const cruise of input.cruises) {
        console.log(`[CruiseDeals] Searching for ${cruise.shipName} - ${cruise.sailDate}`);

        const pricingResults = await fetchPricingForCruise(
          apiUrl,
          cruise.shipName,
          cruise.sailDate,
          cruise.nights,
          cruise.departurePort
        );

        for (const pricing of pricingResults) {
          const lowestPrice = Math.min(
            ...[pricing.interiorPrice, pricing.oceanviewPrice, pricing.balconyPrice, pricing.suitePrice]
              .filter((p): p is number => p !== undefined)
          );

          if (lowestPrice && isFinite(lowestPrice)) {
            deals.push({
              bookingId: cruise.id,
              shipName: cruise.shipName,
              sailDate: cruise.sailDate,
              source: pricing.source as 'icruise' | 'cruisesheet',
              price: lowestPrice,
              cabinType: pricing.interiorPrice ? 'Interior' : pricing.balconyPrice ? 'Balcony' : 'Suite',
              url: pricing.url,
              nights: cruise.nights,
              departurePort: cruise.departurePort,
            });
          }
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
        searchApiUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(`[CruiseDeals] Searching single cruise: ${input.shipName}`);
      const apiUrl = input.searchApiUrl || process.env.EXPO_PUBLIC_TOOLKIT_URL || null;

      const pricingResults = await fetchPricingForCruise(
        apiUrl,
        input.shipName,
        input.sailDate,
        input.nights,
        input.departurePort
      );

      const deals: CruiseDeal[] = pricingResults.map(pricing => {
        const lowestPrice = Math.min(
          ...[pricing.interiorPrice, pricing.oceanviewPrice, pricing.balconyPrice, pricing.suitePrice]
            .filter((p): p is number => p !== undefined)
        );

        return {
          bookingId: '',
          shipName: input.shipName,
          sailDate: input.sailDate,
          source: pricing.source as 'icruise' | 'cruisesheet',
          price: isFinite(lowestPrice) ? lowestPrice : 0,
          cabinType: pricing.interiorPrice ? 'Interior' : pricing.balconyPrice ? 'Balcony' : 'Suite',
          url: pricing.url,
          nights: input.nights,
          departurePort: input.departurePort,
        };
      }).filter(d => d.price > 0);

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
        searchApiUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }): Promise<{ pricing: CruisePricing[]; syncedCount: number }> => {
      console.log(`[CruiseDeals] Starting pricing sync for ${input.cruises.length} booked cruises`);
      const apiUrl = input.searchApiUrl || process.env.EXPO_PUBLIC_TOOLKIT_URL || null;
      console.log(`[CruiseDeals] Toolkit URL: ${apiUrl ? 'available' : 'NOT available'}`);

      const allPricing: CruisePricing[] = [];
      const errors: string[] = [];

      for (const cruise of input.cruises) {
        try {
          console.log(`[CruiseDeals] Fetching pricing for ${cruise.shipName} - ${cruise.sailDate}`);

          const pricingResults = await fetchPricingForCruise(
            apiUrl,
            cruise.shipName,
            cruise.sailDate,
            cruise.nights,
            cruise.departurePort
          );

          for (const pricing of pricingResults) {
            pricing.bookingId = cruise.id;
            allPricing.push(pricing);
          }

          if (pricingResults.length === 0) {
            console.log(`[CruiseDeals] No pricing found for ${cruise.shipName} from any source`);
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
