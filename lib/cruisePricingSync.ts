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
  maxRetries = 2
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed');
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

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      const msg = `${cruise.shipName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[CruisePricing] Error - ${msg}`);
      errors.push(msg);
    }
  }

  return { pricing: allPricing, errors };
};

export const syncCruisePricing = async (cruises: Array<{
  id: string;
  shipName: string;
  sailDate: string;
  nights: number;
  departurePort: string;
}>) => {
  console.log(`[CruisePricing] Starting sync for ${cruises.length} cruises`);

  if (!process.env.EXPO_PUBLIC_TOOLKIT_URL) {
    throw new Error('Web search service not configured. The EXPO_PUBLIC_TOOLKIT_URL environment variable is missing.');
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
    
    console.log('[CruisePricing] ✓ Web search API is available');
  } catch (error) {
    console.error('[CruisePricing] Web search API test failed:', error);
    throw new Error(
      'Web search API is not available. The pricing sync feature requires a working web search endpoint. ' +
      'Please ensure the toolkit URL is configured correctly, or manually update cruise prices in the app.'
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
      console.log('[CruisePricing] Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
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
