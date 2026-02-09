import { RENDER_BACKEND_URL } from './trpc';

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

const extractPricesFromText = (text: string): {
  interior?: number;
  oceanview?: number;
  balcony?: number;
  suite?: number;
  confidence: 'high' | 'medium' | 'low';
} => {
  const normalizedText = text.toLowerCase();
  
  const pricePatterns = [
    /interior[\s:]*(?:from)?[\s]*\$?([\d,]+)/gi,
    /inside[\s:]*(?:from)?[\s]*\$?([\d,]+)/gi,
    /(?:ocean\s?view|oceanview)[\s:]*(?:from)?[\s]*\$?([\d,]+)/gi,
    /balcony[\s:]*(?:from)?[\s]*\$?([\d,]+)/gi,
    /suite[\s:]*(?:from)?[\s]*\$?([\d,]+)/gi,
  ];
  
  const interiorMatches: number[] = [];
  const oceanviewMatches: number[] = [];
  const balconyMatches: number[] = [];
  const suiteMatches: number[] = [];
  
  let match;
  pricePatterns[0].lastIndex = 0;
  while ((match = pricePatterns[0].exec(normalizedText)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 50000) interiorMatches.push(price);
  }
  
  pricePatterns[1].lastIndex = 0;
  while ((match = pricePatterns[1].exec(normalizedText)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 50000) interiorMatches.push(price);
  }
  
  pricePatterns[2].lastIndex = 0;
  while ((match = pricePatterns[2].exec(normalizedText)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 50000) oceanviewMatches.push(price);
  }
  
  pricePatterns[3].lastIndex = 0;
  while ((match = pricePatterns[3].exec(normalizedText)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 50000) balconyMatches.push(price);
  }
  
  pricePatterns[4].lastIndex = 0;
  while ((match = pricePatterns[4].exec(normalizedText)) !== null) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    if (price > 100 && price < 50000) suiteMatches.push(price);
  }
  
  const getLowestPrice = (prices: number[]) => prices.length > 0 ? Math.min(...prices) : undefined;
  
  const interior = getLowestPrice(interiorMatches);
  const oceanview = getLowestPrice(oceanviewMatches);
  const balcony = getLowestPrice(balconyMatches);
  const suite = getLowestPrice(suiteMatches);
  
  const priceCount = [interior, oceanview, balcony, suite].filter(p => p !== undefined).length;
  const confidence = priceCount >= 3 ? 'high' : priceCount === 2 ? 'medium' : 'low';
  
  return { interior, oceanview, balcony, suite, confidence };
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(2000 * Math.pow(2, i), 60000);
        
        if (i < maxRetries) {
          console.log(`[CruisePricing] Rate limited. Waiting ${waitTime}ms before retry ${i + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw new Error('Rate limited - please try again later');
      }
      
      if (response.ok) return response;
      
      if (response.status >= 500) {
        if (i < maxRetries) {
          const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
          console.log(`[CruisePricing] Server error ${response.status}. Retrying after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries && !(error instanceof Error && error.message.includes('Rate limited'))) {
        const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
        console.log(`[CruisePricing] Request failed. Retrying after ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
};

const fetchPricingFromICruise = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    const cleanShipName = shipName.replace(/\s+of\s+the\s+Seas/i, '').trim();

    const searchQuery = `"${cleanShipName}" "${month} ${year}" "${departurePort}" ${nights} night cruise prices interior balcony suite site:icruise.com`;

    console.log(`[ICruise] Searching: ${searchQuery}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetchWithRetry(
      `${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          numResults: 8,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[ICruise] No results found');
      return null;
    }

    const allContent = results.map((r: any) => `${r.title} ${r.content}`).join(' ');
    const prices = extractPricesFromText(allContent);

    if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
      console.log('[ICruise] No prices extracted from results');
      return null;
    }

    console.log('[ICruise] Extracted prices:', prices);

    return {
      bookingId: '',
      shipName,
      sailDate,
      interiorPrice: prices.interior,
      oceanviewPrice: prices.oceanview,
      balconyPrice: prices.balcony,
      suitePrice: prices.suite,
      source: 'icruise',
      url: results[0].url || 'https://www.icruise.com',
      lastUpdated: new Date().toISOString(),
      confidence: prices.confidence,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[ICruise] Request timed out');
    } else {
      console.error('[ICruise] Error:', error);
    }
    return null;
  }
};

const fetchPricingFromCruiseSheet = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    const cleanShipName = shipName.replace(/\s+of\s+the\s+Seas/i, '').trim();

    const searchQuery = `"${cleanShipName}" "${month} ${year}" "${departurePort}" ${nights} night cruise pricing interior balcony suite site:cruisesheet.com`;

    console.log(`[CruiseSheet] Searching: ${searchQuery}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetchWithRetry(
      `${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          numResults: 8,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[CruiseSheet] No results found');
      return null;
    }

    const allContent = results.map((r: any) => `${r.title} ${r.content}`).join(' ');
    const prices = extractPricesFromText(allContent);

    if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
      console.log('[CruiseSheet] No prices extracted from results');
      return null;
    }

    console.log('[CruiseSheet] Extracted prices:', prices);

    return {
      bookingId: '',
      shipName,
      sailDate,
      interiorPrice: prices.interior,
      oceanviewPrice: prices.oceanview,
      balconyPrice: prices.balcony,
      suitePrice: prices.suite,
      source: 'cruisesheet',
      url: results[0].url || 'https://www.cruisesheet.com',
      lastUpdated: new Date().toISOString(),
      confidence: prices.confidence,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[CruiseSheet] Request timed out');
    } else {
      console.error('[CruiseSheet] Error:', error);
    }
    return null;
  }
};

const fetchPricingFromWeb = async (
  shipName: string,
  sailDate: string,
  nights: number,
  departurePort: string
): Promise<CruisePricing | null> => {
  try {
    const dateObj = new Date(sailDate);
    const month = dateObj.toLocaleString('en-US', { month: 'long' });
    const year = dateObj.getFullYear();
    
    const cleanShipName = shipName.replace(/\s+of\s+the\s+Seas/i, '').trim();

    const searchQuery = `"${cleanShipName}" cruise "${month} ${year}" "${departurePort}" ${nights} night prices interior oceanview balcony suite 2026`;

    console.log(`[WebSearch] Searching: ${searchQuery}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetchWithRetry(
      `${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          numResults: 10,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[WebSearch] No results found');
      return null;
    }

    const allContent = results.map((r: any) => `${r.title} ${r.content}`).join(' ');
    const prices = extractPricesFromText(allContent);

    if (!prices.interior && !prices.oceanview && !prices.balcony && !prices.suite) {
      console.log('[WebSearch] No prices extracted from results');
      return null;
    }

    console.log('[WebSearch] Extracted prices:', prices);

    return {
      bookingId: '',
      shipName,
      sailDate,
      interiorPrice: prices.interior,
      oceanviewPrice: prices.oceanview,
      balconyPrice: prices.balcony,
      suitePrice: prices.suite,
      source: 'web',
      url: results[0].url || '',
      lastUpdated: new Date().toISOString(),
      confidence: prices.confidence,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[WebSearch] Request timed out');
    } else {
      console.error('[WebSearch] Error:', error);
    }
    return null;
  }
};

const processCruiseBatch = async (
  cruises: Array<{
    id: string;
    shipName: string;
    sailDate: string;
    nights: number;
    departurePort: string;
  }>,
  batchIndex: number
): Promise<{ pricing: CruisePricing[]; errors: string[] }> => {
  const allPricing: CruisePricing[] = [];
  const errors: string[] = [];

  for (const cruise of cruises) {
    try {
      console.log(`[CruisePricing] [Batch ${batchIndex}] Fetching ${cruise.shipName} - ${cruise.sailDate}`);

      const [iCruisePricing, cruiseSheetPricing, webPricing] = await Promise.allSettled([
        fetchPricingFromICruise(cruise.shipName, cruise.sailDate, cruise.nights, cruise.departurePort),
        fetchPricingFromCruiseSheet(cruise.shipName, cruise.sailDate, cruise.nights, cruise.departurePort),
        fetchPricingFromWeb(cruise.shipName, cruise.sailDate, cruise.nights, cruise.departurePort),
      ]);

      if (iCruisePricing.status === 'fulfilled' && iCruisePricing.value) {
        iCruisePricing.value.bookingId = cruise.id;
        allPricing.push(iCruisePricing.value);
      }

      if (cruiseSheetPricing.status === 'fulfilled' && cruiseSheetPricing.value) {
        cruiseSheetPricing.value.bookingId = cruise.id;
        allPricing.push(cruiseSheetPricing.value);
      }

      if (webPricing.status === 'fulfilled' && webPricing.value) {
        webPricing.value.bookingId = cruise.id;
        allPricing.push(webPricing.value);
      }

      if (allPricing.filter(p => p.bookingId === cruise.id).length === 0) {
        errors.push(`${cruise.shipName} (${cruise.sailDate}): No pricing found from any source`);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      const msg = `${cruise.shipName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[CruisePricing] Error - ${msg}`);
      errors.push(msg);
    }
  }

  return { pricing: allPricing, errors };
};

const syncViaRenderBackend = async (
  cruises: Array<{
    id: string;
    shipName: string;
    sailDate: string;
    nights: number;
    departurePort: string;
  }>
): Promise<{ pricing: CruisePricing[]; syncedCount: number } | null> => {
  try {
    console.log(`[CruisePricing] Attempting sync via Render backend: ${RENDER_BACKEND_URL}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(
      `${RENDER_BACKEND_URL}/trpc/cruiseDeals.syncPricingForBookedCruises`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { cruises },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.log(`[CruisePricing] Render backend returned ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const result = data?.result?.data?.json;

    if (!result || !Array.isArray(result.pricing)) {
      console.log('[CruisePricing] Unexpected response shape from Render backend:', JSON.stringify(data).substring(0, 200));
      return null;
    }

    console.log(`[CruisePricing] Render backend returned ${result.pricing.length} pricing records`);
    return {
      pricing: result.pricing.map((p: any) => ({
        bookingId: p.bookingId ?? '',
        shipName: p.shipName ?? '',
        sailDate: p.sailDate ?? '',
        interiorPrice: p.interiorPrice,
        oceanviewPrice: p.oceanviewPrice,
        balconyPrice: p.balconyPrice,
        suitePrice: p.suitePrice,
        source: p.source ?? 'web',
        url: p.url ?? '',
        lastUpdated: p.lastUpdated ?? new Date().toISOString(),
      })),
      syncedCount: result.syncedCount ?? cruises.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[CruisePricing] Render backend sync failed:', msg);
    return null;
  }
};

export const syncCruisePricing = async (cruises: Array<{
  id: string;
  shipName: string;
  sailDate: string;
  nights: number;
  departurePort: string;
}>) => {
  console.log(`[CruisePricing] Starting sync for ${cruises.length} cruises`);

  const backendResult = await syncViaRenderBackend(cruises);
  if (backendResult && backendResult.pricing.length > 0) {
    const cruisesWithPricing = new Set(backendResult.pricing.map(p => p.bookingId));
    console.log(`[CruisePricing] Render backend sync successful: ${backendResult.pricing.length} pricing records from ${cruisesWithPricing.size}/${cruises.length} cruises`);
    return {
      pricing: backendResult.pricing,
      syncedCount: backendResult.syncedCount,
      successCount: cruisesWithPricing.size,
      errors: [] as string[],
    };
  }

  console.log('[CruisePricing] Render backend unavailable or returned no data, falling back to direct search...');

  if (!process.env.EXPO_PUBLIC_TOOLKIT_URL) {
    throw new Error('Pricing sync unavailable. Backend returned no data and toolkit URL is not configured.');
  }

  console.log('[CruisePricing] Testing web search API availability...');
  try {
    const testResponse = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test cruise pricing', numResults: 1 }),
    });

    if (!testResponse.ok) {
      throw new Error(`API returned status ${testResponse.status}`);
    }
    
    console.log('[CruisePricing] Fallback web search API is available');
  } catch (error) {
    console.error('[CruisePricing] Fallback web search API test failed:', error);
    throw new Error(
      'Pricing sync unavailable. The Render backend did not return data and the fallback web search is not reachable.'
    );
  }

  const batchSize = 5;
  const batches: typeof cruises[] = [];
  for (let i = 0; i < cruises.length; i += batchSize) {
    batches.push(cruises.slice(i, i + batchSize));
  }

  console.log(`[CruisePricing] Processing ${batches.length} batches of up to ${batchSize} cruises each`);

  const allPricing: CruisePricing[] = [];
  const allErrors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`[CruisePricing] Processing batch ${i + 1}/${batches.length}`);
    const { pricing, errors } = await processCruiseBatch(batches[i], i + 1);
    allPricing.push(...pricing);
    allErrors.push(...errors);
    
    if (i < batches.length - 1) {
      console.log('[CruisePricing] Waiting 3 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const cruisesWithPricing = new Set(allPricing.map(p => p.bookingId));
  const successCount = cruisesWithPricing.size;
  
  console.log(`[CruisePricing] Sync complete: ${allPricing.length} pricing records from ${successCount}/${cruises.length} cruises`);

  if (allErrors.length > 0) {
    console.log(`[CruisePricing] ${allErrors.length} errors encountered`);
    allErrors.forEach(err => console.log(`  - ${err}`));
  }

  return {
    pricing: allPricing,
    syncedCount: cruises.length,
    successCount,
    errors: allErrors,
  };
};
