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
  source: 'icruise' | 'cruisesheet' | 'web';
  url: string;
  lastUpdated: string;
}

interface SearchResult {
  deals: CruiseDeal[];
  searchedCount: number;
  foundCount: number;
}

const getSearchApiUrl = (passedUrl?: string): string | null => {
  const url = passedUrl || process.env.EXPO_PUBLIC_TOOLKIT_URL || null;
  console.log(`[CruiseDeals] getSearchApiUrl: passedUrl=${passedUrl ? 'yes' : 'no'}, env=${process.env.EXPO_PUBLIC_TOOLKIT_URL ? 'yes' : 'no'}, resolved=${url ? 'yes' : 'no'}`);
  return url;
};

const extractPricesFromText = (text: string): {
  interior?: number;
  oceanview?: number;
  balcony?: number;
  suite?: number;
} => {
  const prices: { interior?: number; oceanview?: number; balcony?: number; suite?: number } = {};

  const interiorPatterns = [
    /interior[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /inside[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /interior\s+(?:cabin|stateroom|room)[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
  ];

  const oceanviewPatterns = [
    /ocean\s?view[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /outside[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
  ];

  const balconyPatterns = [
    /balcony[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /verandah?[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
  ];

  const suitePatterns = [
    /suite[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
    /junior\s+suite[\s:]*(?:from\s*)?\$?([\d,]+)/gi,
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

  const normalizedText = text.toLowerCase();
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

const webSearch = async (apiUrl: string, query: string, numResults: number = 5): Promise<any[]> => {
  try {
    console.log(`[CruiseDeals] Web search: "${query.substring(0, 80)}..."`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(`${apiUrl}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, numResults }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[CruiseDeals] Web search HTTP ${response.status}: ${errText.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const results = data.results || [];
    console.log(`[CruiseDeals] Web search returned ${results.length} results`);
    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[CruiseDeals] Web search timed out');
    } else {
      console.error('[CruiseDeals] Web search error:', error);
    }
    return [];
  }
};

const fetchPricingWithSearch = async (
  apiUrl: string,
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string,
  site: string,
  source: 'icruise' | 'cruisesheet' | 'web'
): Promise<CruisePricing | null> => {
  const dateObj = new Date(sailDate);
  const month = dateObj.toLocaleString('en-US', { month: 'long' });
  const year = dateObj.getFullYear();

  const cleanShipName = shipName
    .replace(/\s+of\s+the\s+Seas/i, '')
    .replace(/Royal Caribbean\s*/i, '')
    .trim();

  const queries = site
    ? [
        `${cleanShipName} cruise ${month} ${year} ${departurePort} ${nights} night price site:${site}`,
        `${shipName} ${month} ${year} cruise pricing site:${site}`,
        `${cleanShipName} ${month} ${year} interior balcony suite price site:${site}`,
      ]
    : [
        `${shipName} cruise ${month} ${year} ${departurePort} ${nights} night interior balcony suite price`,
        `Royal Caribbean ${cleanShipName} ${month} ${year} cruise pricing per person`,
      ];

  for (const query of queries) {
    const results = await webSearch(apiUrl, query, 8);

    if (results.length === 0) continue;

    const allContent = results.map((r: any) => `${r.title || ''} ${r.content || ''}`).join(' ');
    const prices = extractPricesFromText(allContent);

    if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
      console.log(`[CruiseDeals] [${source}] Extracted prices for ${shipName}:`, prices);
      return {
        bookingId: '',
        shipName,
        sailDate,
        interiorPrice: prices.interior,
        oceanviewPrice: prices.oceanview,
        balconyPrice: prices.balcony,
        suitePrice: prices.suite,
        source,
        url: results[0]?.url || (site ? `https://www.${site}` : ''),
        lastUpdated: new Date().toISOString(),
      };
    }

    console.log(`[CruiseDeals] [${source}] No prices extracted from query: "${query.substring(0, 60)}..."`);
  }

  return null;
};

const directScrapeSite = async (
  shipName: string,
  sailDate: string,
  nights: number,
  site: 'icruise.com' | 'cruisesheet.com',
  source: 'icruise' | 'cruisesheet'
): Promise<CruisePricing | null> => {
  try {
    const cleanShipName = shipName
      .replace(/\s+of\s+the\s+Seas/i, '')
      .replace(/Royal Caribbean\s*/i, '')
      .trim();

    const slug = cleanShipName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const urls = site === 'icruise.com'
      ? [
          `https://www.icruise.com/cruises/royal-caribbean/${slug}-of-the-seas`,
          `https://www.icruise.com/cruises/royal-caribbean/${slug}`,
        ]
      : [
          `https://www.cruisesheet.com/cruise/royal-caribbean/${slug}-of-the-seas`,
          `https://www.cruisesheet.com/cruise/royal-caribbean/${slug}`,
        ];

    for (const url of urls) {
      try {
        console.log(`[CruiseDeals] [${source}] Direct scrape attempt: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`[CruiseDeals] [${source}] Direct scrape ${url} returned ${response.status}`);
          continue;
        }

        const html = await response.text();
        const prices = extractPricesFromText(html);

        if (prices.interior || prices.oceanview || prices.balcony || prices.suite) {
          console.log(`[CruiseDeals] [${source}] Direct scrape found prices:`, prices);
          return {
            bookingId: '',
            shipName,
            sailDate,
            interiorPrice: prices.interior,
            oceanviewPrice: prices.oceanview,
            balconyPrice: prices.balcony,
            suitePrice: prices.suite,
            source,
            url,
            lastUpdated: new Date().toISOString(),
          };
        }

        console.log(`[CruiseDeals] [${source}] Direct scrape returned HTML but no prices found`);
      } catch (err) {
        console.log(`[CruiseDeals] [${source}] Direct scrape error for ${url}:`, err instanceof Error ? err.message : err);
      }
    }

    return null;
  } catch (error) {
    console.error(`[CruiseDeals] [${source}] Direct scrape failed:`, error);
    return null;
  }
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
    const [icruiseResult, cruisesheetResult] = await Promise.allSettled([
      fetchPricingWithSearch(apiUrl, shipName, sailDate, nights, departurePort, 'icruise.com', 'icruise'),
      fetchPricingWithSearch(apiUrl, shipName, sailDate, nights, departurePort, 'cruisesheet.com', 'cruisesheet'),
    ]);

    if (icruiseResult.status === 'fulfilled' && icruiseResult.value) {
      results.push(icruiseResult.value);
    }
    if (cruisesheetResult.status === 'fulfilled' && cruisesheetResult.value) {
      results.push(cruisesheetResult.value);
    }

    if (results.length === 0) {
      console.log(`[CruiseDeals] Site-specific searches found nothing, trying general web search...`);
      const webResult = await fetchPricingWithSearch(apiUrl, shipName, sailDate, nights, departurePort, '', 'web');
      if (webResult) results.push(webResult);
    }
  }

  if (results.length === 0) {
    console.log(`[CruiseDeals] Web search found nothing, trying direct scrape...`);
    const [icruiseDirect, cruisesheetDirect] = await Promise.allSettled([
      directScrapeSite(shipName, sailDate, nights, 'icruise.com', 'icruise'),
      directScrapeSite(shipName, sailDate, nights, 'cruisesheet.com', 'cruisesheet'),
    ]);

    if (icruiseDirect.status === 'fulfilled' && icruiseDirect.value) {
      results.push(icruiseDirect.value);
    }
    if (cruisesheetDirect.status === 'fulfilled' && cruisesheetDirect.value) {
      results.push(cruisesheetDirect.value);
    }
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
    .mutation(async ({ input }): Promise<SearchResult> => {
      console.log(`[CruiseDeals] Starting search for ${input.cruises.length} cruises`);
      const apiUrl = getSearchApiUrl(input.searchApiUrl);

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
    .mutation(async ({ input }): Promise<{ deals: CruiseDeal[] }> => {
      console.log(`[CruiseDeals] Searching single cruise: ${input.shipName}`);
      const apiUrl = getSearchApiUrl(input.searchApiUrl);

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
      const apiUrl = getSearchApiUrl(input.searchApiUrl);

      if (!apiUrl) {
        console.log('[CruiseDeals] No web search API URL available, will attempt direct scraping only');
      }

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
