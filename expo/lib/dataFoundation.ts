import type {
  BookedCruise,
  CalendarEvent,
  CasinoOffer,
  CasinoProgram,
  Cruise,
  ImportReconciliationSummary,
  ImportReviewStatus,
  OfferArchiveStatus,
  TravelBrand,
} from '@/types/models';

export type PhaseOneRecord = Cruise | BookedCruise | CasinoOffer | CalendarEvent | Record<string, unknown>;

type WithFoundationFields = {
  ownerProfileId?: string;
  sourceEmail?: string;
  brand?: TravelBrand | string;
  casinoProgram?: CasinoProgram;
  archiveStatus?: OfferArchiveStatus;
  importStatus?: ImportReviewStatus;
  reconciliationStatus?: ImportReviewStatus;
  cruiseSource?: Cruise['cruiseSource'];
  offerSource?: CasinoOffer['offerSource'];
  status?: string;
  expires?: string;
  expiryDate?: string;
  offerExpiryDate?: string;
  offerExpiry?: string;
  updatedAt?: string;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

export function normalizeEmail(value: unknown): string | undefined {
  const normalized = normalizeLower(value);
  return normalized.includes('@') ? normalized : undefined;
}

export function normalizeBrand(value: unknown): TravelBrand | undefined {
  const normalized = normalizeLower(value);
  if (!normalized) return undefined;
  if (normalized.includes('royal') || normalized.includes('club royale') || normalized.includes('crown') || normalized.includes('rcl')) return 'royal';
  if (normalized.includes('celebrity') || normalized.includes('captain') || normalized.includes('blue chip')) return 'celebrity';
  if (normalized.includes('carnival') || normalized.includes('vifp') || normalized.includes('players club')) return 'carnival';
  if (normalized.includes('silversea') || normalized.includes('venetian')) return 'silversea';
  return undefined;
}

export function normalizeCasinoProgram(value: unknown, brand?: TravelBrand | string): CasinoProgram {
  const normalized = normalizeLower(value);
  if (normalized.includes('club royale')) return 'clubRoyale';
  if (normalized.includes('blue chip')) return 'blueChip';
  if (normalized.includes('players club')) return 'playersClub';
  if (normalized.includes('venetian')) return 'venetianSociety';
  const normalizedBrand = normalizeBrand(brand);
  if (normalizedBrand === 'royal') return 'clubRoyale';
  if (normalizedBrand === 'celebrity') return 'blueChip';
  if (normalizedBrand === 'carnival') return 'playersClub';
  if (normalizedBrand === 'silversea') return 'venetianSociety';
  return 'unknown';
}

export function inferRecordBrand(record: WithFoundationFields): TravelBrand | undefined {
  return normalizeBrand(record.brand)
    ?? normalizeBrand(record.cruiseSource)
    ?? normalizeBrand(record.offerSource)
    ?? normalizeBrand((record as Record<string, unknown>).shipName)
    ?? normalizeBrand((record as Record<string, unknown>).title)
    ?? normalizeBrand((record as Record<string, unknown>).description);
}

export function getFoundationOwnerKey(record: WithFoundationFields): string {
  const ownerProfileId = normalizeLower(record.ownerProfileId);
  const sourceEmail = normalizeLower(record.sourceEmail);
  const brand = normalizeLower(record.brand ?? record.cruiseSource ?? record.offerSource);
  const casinoProgram = normalizeLower(record.casinoProgram);
  return [ownerProfileId, sourceEmail, brand, casinoProgram].join('|');
}

export function getOfferArchiveStatus(offer: WithFoundationFields, now: Date = new Date()): OfferArchiveStatus {
  const explicitArchiveStatus = offer.archiveStatus;
  if (explicitArchiveStatus === 'archived' || explicitArchiveStatus === 'reviewNeeded' || explicitArchiveStatus === 'replaced') {
    return explicitArchiveStatus;
  }

  const normalizedStatus = normalizeLower(offer.status);
  if (normalizedStatus === 'archived') return 'archived';
  if (normalizedStatus === 'reviewneeded' || normalizedStatus === 'review needed') return 'reviewNeeded';
  if (normalizedStatus === 'replaced') return 'replaced';
  if (normalizedStatus === 'expired') return 'expired';

  const expiry = normalizeString(offer.expires ?? offer.expiryDate ?? offer.offerExpiryDate ?? offer.offerExpiry);
  if (!expiry) return 'reviewNeeded';

  const expiryTime = new Date(expiry).getTime();
  if (Number.isNaN(expiryTime)) return 'reviewNeeded';

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiryTime - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 14) return 'expiringSoon';
  return 'active';
}

export function applyFoundationFields<T extends PhaseOneRecord>(
  records: T[],
  options: {
    fallbackOwnerProfileId?: string | null;
    fallbackSourceEmail?: string | null;
    fallbackBrand?: TravelBrand | string | null;
    fallbackCasinoProgram?: CasinoProgram | null;
    markUnassigned?: boolean;
  },
): T[] {
  const fallbackEmail = normalizeEmail(options.fallbackSourceEmail);
  const fallbackBrand = normalizeBrand(options.fallbackBrand);

  return records.map((record) => {
    const item = record as T & WithFoundationFields;
    const inferredBrand = inferRecordBrand(item) ?? fallbackBrand;
    const sourceEmail = normalizeEmail(item.sourceEmail) ?? fallbackEmail;
    const ownerProfileId = normalizeString(item.ownerProfileId) || normalizeString(options.fallbackOwnerProfileId) || sourceEmail;
    const casinoProgram = item.casinoProgram ?? options.fallbackCasinoProgram ?? normalizeCasinoProgram((item as Record<string, unknown>).casinoProgram, inferredBrand);
    const importStatus: ImportReviewStatus = ownerProfileId
      ? (item.importStatus ?? 'assigned')
      : (options.markUnassigned ? 'unassigned' : item.importStatus ?? 'reviewNeeded');

    const nextRecord: T & WithFoundationFields = {
      ...item,
      ownerProfileId: ownerProfileId || undefined,
      sourceEmail,
      brand: inferredBrand ?? item.brand,
      casinoProgram,
      importStatus,
      reconciliationStatus: item.reconciliationStatus ?? importStatus,
    };

    if ('offerType' in nextRecord || 'offerCode' in nextRecord) {
      nextRecord.archiveStatus = getOfferArchiveStatus(nextRecord);
    }

    return nextRecord;
  });
}

export function createEmptyReconciliationSummary(): ImportReconciliationSummary {
  return {
    addedRows: 0,
    updatedRows: 0,
    removedMissingRows: 0,
    suggestedArchiveRows: 0,
    changedOffers: 0,
    duplicateOverlappingSailings: 0,
    reviewNeededItems: 0,
    errors: [],
  };
}

export function buildReconciliationSummary<T>(
  existingItems: T[],
  importedItems: T[],
  mergedItems: T[],
  getIdentityKey: (item: T) => string,
): ImportReconciliationSummary {
  const existingKeys = new Set(existingItems.map(getIdentityKey));
  const importedKeys = new Set(importedItems.map(getIdentityKey));
  const summary = createEmptyReconciliationSummary();

  importedKeys.forEach((key) => {
    if (existingKeys.has(key)) {
      summary.updatedRows += 1;
    } else {
      summary.addedRows += 1;
    }
  });

  existingKeys.forEach((key) => {
    if (!importedKeys.has(key)) {
      summary.removedMissingRows += 1;
      summary.suggestedArchiveRows += 1;
    }
  });

  const sailingBuckets = new Map<string, Set<string>>();
  mergedItems.forEach((item) => {
    const record = item as Record<string, unknown>;
    const ship = normalizeLower(record.shipName);
    const sailDate = normalizeString(record.sailDate ?? record.sailingDate).split('T')[0];
    if (!ship || !sailDate) return;
    const sailingKey = `${ship}|${sailDate}`;
    const ownerKey = getFoundationOwnerKey(record as WithFoundationFields);
    const bucket = sailingBuckets.get(sailingKey) ?? new Set<string>();
    bucket.add(ownerKey);
    sailingBuckets.set(sailingKey, bucket);
  });

  sailingBuckets.forEach((owners) => {
    if (owners.size > 1) {
      summary.duplicateOverlappingSailings += 1;
    }
  });

  mergedItems.forEach((item) => {
    const record = item as WithFoundationFields;
    if (record.importStatus === 'reviewNeeded' || record.importStatus === 'unassigned' || record.reconciliationStatus === 'reviewNeeded' || record.archiveStatus === 'reviewNeeded') {
      summary.reviewNeededItems += 1;
    }
  });

  return summary;
}
