import { trpcClient, RENDER_BACKEND_URL } from './trpc';

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

const parsePricingResponse = (data: any): CruisePricing[] => {
  if (!data || !Array.isArray(data)) return [];
  return data.map((p: any) => ({
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
    confidence: p.confidence ?? 'medium',
  }));
};

const syncViaSystemBackend = async (
  cruises: CruiseInput[]
): Promise<{ pricing: CruisePricing[]; syncedCount: number } | null> => {
  try {
    const searchApiUrl = process.env.EXPO_PUBLIC_TOOLKIT_URL || undefined;
    console.log(`[CruisePricing] Tier 1: System backend (tRPC), toolkitUrl: ${searchApiUrl ? 'available' : 'not set'}`);

    const result = await trpcClient.cruiseDeals.syncPricingForBookedCruises.mutate({
      cruises,
      searchApiUrl,
    });

    if (!result || !Array.isArray(result.pricing)) {
      console.log('[CruisePricing] System backend returned unexpected format:', JSON.stringify(result).substring(0, 200));
      return null;
    }

    console.log(`[CruisePricing] System backend returned ${result.pricing.length} pricing records`);
    return {
      pricing: parsePricingResponse(result.pricing),
      syncedCount: result.syncedCount ?? cruises.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[CruisePricing] System backend sync failed:', msg);
    return null;
  }
};

const syncViaRenderDirect = async (
  cruises: CruiseInput[]
): Promise<{ pricing: CruisePricing[]; syncedCount: number } | null> => {
  try {
    console.log(`[CruisePricing] Tier 2: Direct Render backend call: ${RENDER_BACKEND_URL}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${RENDER_BACKEND_URL}/trpc/cruiseDeals.syncPricingForBookedCruises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          cruises,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[CruisePricing] Render backend returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.result?.data?.json ?? data?.result?.data ?? data;

    if (!result || !Array.isArray(result.pricing)) {
      console.log('[CruisePricing] Render backend unexpected response:', JSON.stringify(data).substring(0, 300));
      return null;
    }

    console.log(`[CruisePricing] Render backend returned ${result.pricing.length} pricing records`);
    return {
      pricing: parsePricingResponse(result.pricing),
      syncedCount: result.syncedCount ?? cruises.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[CruisePricing] Render backend fallback failed:', msg);
    return null;
  }
};

export const syncCruisePricing = async (cruises: CruiseInput[]) => {
  console.log(`[CruisePricing] Starting sync for ${cruises.length} cruises`);
  console.log(`[CruisePricing] Cruises: ${cruises.map(c => `${c.shipName} (${c.sailDate})`).join(', ')}`);

  const systemResult = await syncViaSystemBackend(cruises);
  if (systemResult && systemResult.pricing.length > 0) {
    const cruisesWithPricing = new Set(systemResult.pricing.map(p => p.bookingId));
    console.log(`[CruisePricing] System backend success: ${systemResult.pricing.length} records from ${cruisesWithPricing.size}/${cruises.length} cruises`);
    return {
      pricing: systemResult.pricing,
      syncedCount: systemResult.syncedCount,
      successCount: cruisesWithPricing.size,
      errors: [] as string[],
    };
  }

  console.log('[CruisePricing] System backend returned no data, trying Render backend...');

  const renderResult = await syncViaRenderDirect(cruises);
  if (renderResult && renderResult.pricing.length > 0) {
    const cruisesWithPricing = new Set(renderResult.pricing.map(p => p.bookingId));
    console.log(`[CruisePricing] Render backend success: ${renderResult.pricing.length} records from ${cruisesWithPricing.size}/${cruises.length} cruises`);
    return {
      pricing: renderResult.pricing,
      syncedCount: renderResult.syncedCount,
      successCount: cruisesWithPricing.size,
      errors: [] as string[],
    };
  }

  console.log('[CruisePricing] All pricing sources exhausted. No pricing data available.');
  return {
    pricing: [],
    syncedCount: cruises.length,
    successCount: 0,
    errors: [
      'Could not retrieve pricing from ICruise or CruiseSheet at this time.',
      'These sites may use anti-scraping protections that prevent automated price lookups.',
      'Try again later or check pricing manually at icruise.com or cruisesheet.com.',
    ],
  };
};
