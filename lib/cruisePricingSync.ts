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

const syncViaRenderDirect = async (
  cruises: {
    id: string;
    shipName: string;
    sailDate: string;
    nights: number;
    departurePort: string;
  }[]
): Promise<{ pricing: CruisePricing[]; syncedCount: number } | null> => {
  try {
    console.log(`[CruisePricing] Attempting direct Render backend call: ${RENDER_BACKEND_URL}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${RENDER_BACKEND_URL}/trpc/cruiseDeals.syncPricingForBookedCruises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          cruises,
          searchApiUrl: process.env.EXPO_PUBLIC_TOOLKIT_URL || undefined,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[CruisePricing] Direct Render call returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.result?.data?.json ?? data?.result?.data ?? data;

    if (!result || !Array.isArray(result.pricing)) {
      console.log('[CruisePricing] Unexpected response from direct Render call:', JSON.stringify(data).substring(0, 300));
      return null;
    }

    console.log(`[CruisePricing] Direct Render call returned ${result.pricing.length} pricing records`);
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
    console.log('[CruisePricing] Direct Render fallback failed:', msg);
    return null;
  }
};

const syncViaBackend = async (
  cruises: {
    id: string;
    shipName: string;
    sailDate: string;
    nights: number;
    departurePort: string;
  }[]
): Promise<{ pricing: CruisePricing[]; syncedCount: number } | null> => {
  try {
    const searchApiUrl = process.env.EXPO_PUBLIC_TOOLKIT_URL || undefined;
    console.log(`[CruisePricing] Attempting sync via backend (tRPC), searchApiUrl: ${searchApiUrl ? 'provided' : 'not available'}`);

    const result = await trpcClient.cruiseDeals.syncPricingForBookedCruises.mutate({
      cruises,
      searchApiUrl,
    });

    if (!result || !Array.isArray(result.pricing)) {
      console.log('[CruisePricing] Unexpected response from backend:', JSON.stringify(result).substring(0, 200));
      return null;
    }

    console.log(`[CruisePricing] Backend returned ${result.pricing.length} pricing records`);
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
    console.log('[CruisePricing] Backend sync failed:', msg);
    return null;
  }
};

export const syncCruisePricing = async (cruises: {
  id: string;
  shipName: string;
  sailDate: string;
  nights: number;
  departurePort: string;
}[]) => {
  console.log(`[CruisePricing] Starting sync for ${cruises.length} cruises`);

  const backendResult = await syncViaBackend(cruises);
  if (backendResult && backendResult.pricing.length > 0) {
    const cruisesWithPricing = new Set(backendResult.pricing.map(p => p.bookingId));
    console.log(`[CruisePricing] Backend sync successful: ${backendResult.pricing.length} pricing records from ${cruisesWithPricing.size}/${cruises.length} cruises`);
    return {
      pricing: backendResult.pricing,
      syncedCount: backendResult.syncedCount,
      successCount: cruisesWithPricing.size,
      errors: [] as string[],
    };
  }

  console.log('[CruisePricing] Backend tRPC unavailable or returned no data, falling back to direct Render backend call...');

  const directRenderResult = await syncViaRenderDirect(cruises);
  if (directRenderResult && directRenderResult.pricing.length > 0) {
    const cruisesWithPricing = new Set(directRenderResult.pricing.map(p => p.bookingId));
    console.log(`[CruisePricing] Direct Render fallback successful: ${directRenderResult.pricing.length} pricing records from ${cruisesWithPricing.size}/${cruises.length} cruises`);
    return {
      pricing: directRenderResult.pricing,
      syncedCount: directRenderResult.syncedCount,
      successCount: cruisesWithPricing.size,
      errors: [] as string[],
    };
  }

  console.log('[CruisePricing] All pricing sources exhausted. No pricing data available.');
  return {
    pricing: [],
    syncedCount: cruises.length,
    successCount: 0,
    errors: ['No pricing data could be retrieved from any source. The backend may be temporarily unavailable.'],
  };
};
