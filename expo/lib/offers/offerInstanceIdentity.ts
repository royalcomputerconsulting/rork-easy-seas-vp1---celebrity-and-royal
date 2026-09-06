import type { CasinoOffer, Cruise } from '@/types/models';

type MarketingOfferIdentityInput = Partial<CasinoOffer> & Partial<Pick<Cruise,
  'brand' | 'cruiseSource' | 'offerCategory' | 'cabinType'
>>;

export interface OfferDetailsRouteParams extends Record<string, string> {
  offerId: string;
  offerCode: string;
  offerInstanceKey: string;
  expectedCruiseCount: string;
  openDecoded: string;
}

function text(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) ?? '';
}

/**
 * Identity for a marketing offer instance, deliberately excluding ship and
 * sailing date. A single offer can contain thousands of eligible sailings;
 * those rows must never inflate the Settings/Offers count. Provider offer IDs
 * remain strongest so two genuine offers sharing a marketing code stay apart.
 */
export function getMarketingOfferInstanceKey(offer: MarketingOfferIdentityInput): string {
  const providerInstanceId = firstText(
    offer.playerOfferId,
    offer.offerInstanceId,
    (offer as Partial<CasinoOffer>).carnivalOfferId,
  );
  if (providerInstanceId) return `instance:${providerInstanceId}`;

  const offerCode = text(offer.offerCode);
  const offerName = firstText(offer.offerName, offer.title);
  const expiry = firstText(
    (offer as Partial<CasinoOffer>).expiryDate,
    (offer as Partial<CasinoOffer>).expires,
    (offer as Partial<CasinoOffer>).offerExpiryDate,
  );
  const provider = firstText(offer.sourceProvider, offer.offerSource, offer.brand, offer.cruiseSource);
  const materialVariant = [
    firstText(offer.offerType, offer.category, offer.offerCategory),
    firstText(offer.roomType, offer.cabinType),
    firstText(offer.guestsInfo, offer.guests),
  ].join('|');

  if (offerCode || offerName) {
    return `marketing:${[provider, offerCode, offerName, expiry, materialVariant].join('|')}`;
  }

  return `id:${text(offer.id)}`;
}

export function buildOfferDetailsParams(
  offer: MarketingOfferIdentityInput,
  options?: { expectedCruiseCount?: number; openDecoded?: boolean },
): OfferDetailsRouteParams {
  return {
    offerId: String(offer.id ?? '').trim(),
    offerCode: String(offer.offerCode ?? '').trim(),
    offerInstanceKey: getMarketingOfferInstanceKey(offer),
    expectedCruiseCount: Number.isFinite(options?.expectedCruiseCount)
      ? String(Math.max(0, Number(options?.expectedCruiseCount)))
      : '',
    openDecoded: options?.openDecoded ? '1' : '',
  };
}

export function buildOfferDetailsPath(
  offer: MarketingOfferIdentityInput,
  options?: { expectedCruiseCount?: number; openDecoded?: boolean },
): string {
  const params = buildOfferDetailsParams(offer, options);
  const search = Object.entries(params)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `/offer-details${search ? `?${search}` : ''}`;
}

export function resolveOfferDetailsInstance<T extends CasinoOffer>(
  offers: readonly T[],
  params: Partial<OfferDetailsRouteParams> & { id?: string },
): T | undefined {
  const unique = offers.filter((offer, index, rows) => index === rows.findIndex((candidate) => candidate.id === offer.id));
  const requestedId = text(params.offerId ?? params.id);
  if (requestedId) {
    const idMatches = unique.filter((offer) => text(offer.id) === requestedId);
    if (idMatches.length === 1) return idMatches[0];
  }
  const requestedInstance = text(params.offerInstanceKey);
  if (requestedInstance) {
    const instanceMatches = unique.filter((offer) => text(getMarketingOfferInstanceKey(offer)) === requestedInstance);
    if (instanceMatches.length === 1) return instanceMatches[0];
  }
  const requestedCode = text(params.offerCode);
  if (!requestedCode) return undefined;
  const codeMatches = unique.filter((offer) => text(offer.offerCode) === requestedCode);
  return codeMatches.length === 1 ? codeMatches[0] : undefined;
}

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Collapses offer-sailing rows while retaining the richest observed fields. */
export function collapseOfferSailingRowsToOfferInstances<T extends CasinoOffer>(rows: T[]): T[] {
  const instances = new Map<string, T>();
  rows.filter(Boolean).forEach((row) => {
    const key = getMarketingOfferInstanceKey(row);
    const existing = instances.get(key);
    if (!existing) {
      instances.set(key, row);
      return;
    }

    const merged: Record<string, unknown> = { ...(existing as unknown as Record<string, unknown>) };
    Object.entries(row as unknown as Record<string, unknown>).forEach(([field, value]) => {
      if (!isMeaningful(merged[field]) && isMeaningful(value)) merged[field] = value;
    });
    instances.set(key, merged as T);
  });
  return Array.from(instances.values());
}

/**
 * Selects the one offer snapshot UI counts are allowed to use. The legacy
 * AppState copy is a startup compatibility fallback only; once CoreData has
 * completed hydration it must never be merged back into the authoritative
 * snapshot or old backup/sync rows can inflate the visible offer count.
 */
export function selectAuthoritativeOfferInstances<T extends CasinoOffer>(
  primaryRows: readonly T[],
  legacyFallbackRows: readonly T[],
  primaryHydrated: boolean,
): T[] {
  const primary = collapseOfferSailingRowsToOfferInstances([...primaryRows]);
  if (primaryHydrated || primary.length > 0) return primary;
  return collapseOfferSailingRowsToOfferInstances([...legacyFallbackRows]);
}
