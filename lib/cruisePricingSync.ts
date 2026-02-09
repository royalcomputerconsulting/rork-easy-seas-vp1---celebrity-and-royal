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

    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night interior oceanview balcony suite price site:icruise.com`;

    console.log(`[ICruise] Searching: ${searchQuery}`);

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
      console.error('[ICruise] Search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[ICruise] No results found');
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

    const searchQuery = `${shipName} cruise ${month} ${day} ${year} ${departurePort} ${nights} night interior oceanview balcony suite price site:cruisesheet.com`;

    console.log(`[CruiseSheet] Searching: ${searchQuery}`);

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
      console.error('[CruiseSheet] Search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log('[CruiseSheet] No results found');
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
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[CruiseSheet] Request timed out');
    } else {
      console.error('[CruiseSheet] Error:', error);
    }
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

  if (!process.env.EXPO_PUBLIC_TOOLKIT_URL) {
    throw new Error('Web search service not configured. The EXPO_PUBLIC_TOOLKIT_URL environment variable is missing.');
  }

  const testResponse = await fetch(`${process.env.EXPO_PUBLIC_TOOLKIT_URL}/api/web-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'test', numResults: 1 }),
  }).catch(() => null);

  if (!testResponse || !testResponse.ok) {
    throw new Error(
      'Web search API is not available. The pricing sync feature requires a working web search endpoint at the toolkit URL. ' +
      'Please contact support to enable this feature, or manually update cruise prices in the app.'
    );
  }

  const allPricing: CruisePricing[] = [];
  const errors: string[] = [];

  for (const cruise of cruises) {
    try {
      console.log(`[CruisePricing] Fetching ${cruise.shipName} - ${cruise.sailDate}`);

      const iCruisePricing = await fetchPricingFromICruise(
        cruise.shipName,
        cruise.sailDate,
        cruise.nights,
        cruise.departurePort
      );

      if (iCruisePricing) {
        iCruisePricing.bookingId = cruise.id;
        allPricing.push(iCruisePricing);
      }

      const cruiseSheetPricing = await fetchPricingFromCruiseSheet(
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
      const msg = `${cruise.shipName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[CruisePricing] Error - ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`[CruisePricing] Sync complete: ${allPricing.length} pricing records`);

  if (errors.length > 0) {
    console.log(`[CruisePricing] Errors: ${errors.join('; ')}`);
  }

  return {
    pricing: allPricing,
    syncedCount: cruises.length,
    errors,
  };
};
