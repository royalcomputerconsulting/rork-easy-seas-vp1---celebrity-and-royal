import type { Cruise, CasinoOffer } from '@/types/models';
import { findSingleMaterialOffer } from './itineraryIntegrity';

export interface HealingReport {
  cruisesHealed: number;
  offersHealed: number;
  fieldsFixed: { entity: string; field: string; from: string; to: string }[];
  orphanedCruises: number;
  orphanedOffers: number;
}

function extractOfferCodeFromText(text: string): string | null {
  if (!text) return null;
  const codePatterns = [
    /\b(\d{4}[A-Z]\d{2,3}[A-Z]?)\b/,
    /\b([A-Z]{2,6}\d{4,8})\b/,
    /\b(\d{2,4}[A-Z]{1,3}\d{2,4})\b/,
    /(?:code|offer)[:\s]+([A-Z0-9]{4,12})/i,
    /\b([A-Z0-9]{4,12})\b/,
  ];

  for (const pattern of codePatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 4 && match[1].length <= 15) {
      const candidate = match[1];
      if (/\d/.test(candidate) && /[A-Z]/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function normalizeShipForMatching(shipName: string): string {
  return (shipName || '')
    .toLowerCase()
    .replace(/\s+of\s+the\s+seas\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDateForMatching(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();

  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}-${isoMatch[1]}`;
  }

  const mmddyyyyDash = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mmddyyyyDash) {
    return `${mmddyyyyDash[1].padStart(2, '0')}-${mmddyyyyDash[2].padStart(2, '0')}-${mmddyyyyDash[3]}`;
  }

  const mmddyyyySlash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mmddyyyySlash) {
    const year = mmddyyyySlash[3].length === 2 ? '20' + mmddyyyySlash[3] : mmddyyyySlash[3];
    return `${mmddyyyySlash[1].padStart(2, '0')}-${mmddyyyySlash[2].padStart(2, '0')}-${year}`;
  }

  return cleaned;
}

function extractNightsFromItinerary(itinerary: string): number | null {
  if (!itinerary) return null;
  const match = itinerary.match(/(\d+)\s*[-]?\s*night/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > 0 && n <= 365) return n;
  }
  return null;
}

function buildCruiseKey(shipName: string, sailDate: string): string {
  return `${normalizeShipForMatching(shipName)}|${normalizeDateForMatching(sailDate)}`;
}

function hasKnownTextConflict(left: unknown, right: unknown): boolean {
  const normalizedLeft = String(left ?? '').trim().toLowerCase();
  const normalizedRight = String(right ?? '').trim().toLowerCase();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft !== normalizedRight);
}

function hasKnownNumberConflict(left: unknown, right: unknown): boolean {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber;
}

export function healImportedData(
  cruises: Cruise[],
  offers: CasinoOffer[]
): { cruises: Cruise[]; offers: CasinoOffer[]; report: HealingReport } {
  console.log('[DataHealing] Starting data healing pass...');
  console.log('[DataHealing] Input:', cruises.length, 'cruises,', offers.length, 'offers');

  const report: HealingReport = {
    cruisesHealed: 0,
    offersHealed: 0,
    fieldsFixed: [],
    orphanedCruises: 0,
    orphanedOffers: 0,
  };

  const normalizeOfferCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const offersByCode = new Map<string, CasinoOffer[]>();
  const offersByCruiseId = new Map<string, CasinoOffer[]>();
  offers.forEach((offer) => {
    const code = normalizeOfferCode(offer.offerCode);
    if (code) offersByCode.set(code, [...(offersByCode.get(code) ?? []), offer]);
    const linkedIds = new Set([offer.cruiseId, ...(offer.cruiseIds ?? [])].filter((id): id is string => Boolean(id)));
    linkedIds.forEach((id) => offersByCruiseId.set(id, [...(offersByCruiseId.get(id) ?? []), offer]));
  });

  const findIndexedMaterialOffer = (cruise: Cruise): CasinoOffer | undefined => {
    const directLinks = offersByCruiseId.get(cruise.id) ?? [];
    if (directLinks.length === 1) return directLinks[0];
    if (directLinks.length > 1) return undefined;
    return findSingleMaterialOffer(cruise, offersByCode.get(normalizeOfferCode(cruise.offerCode)) ?? []);
  };

  const healedCruises = cruises.map(cruise => {
    const healed = { ...cruise };
    let wasHealed = false;
    const bestOffer = findIndexedMaterialOffer(healed);

    if (!healed.offerCode || !healed.offerName) {
      if (bestOffer) {

        if (!healed.offerCode && bestOffer.offerCode) {
          const oldVal = healed.offerCode || '';
          healed.offerCode = bestOffer.offerCode;
          report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerCode', from: oldVal, to: healed.offerCode });
          wasHealed = true;
          console.log(`[DataHealing] Cruise ${healed.shipName} ${healed.sailDate}: filled offerCode from matching offer -> ${healed.offerCode}`);
        }

        if (!healed.offerName && (bestOffer.offerName || bestOffer.title)) {
          const oldVal = healed.offerName || '';
          healed.offerName = bestOffer.offerName || bestOffer.title;
          report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerName', from: oldVal, to: healed.offerName || '' });
          wasHealed = true;
          console.log(`[DataHealing] Cruise ${healed.shipName} ${healed.sailDate}: filled offerName from matching offer -> ${healed.offerName}`);
        }
      }
    }

    if (!healed.offerCode && healed.offerName) {
      const extracted = extractOfferCodeFromText(healed.offerName);
      if (extracted) {
        healed.offerCode = extracted;
        report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerCode', from: '', to: extracted });
        wasHealed = true;
        console.log(`[DataHealing] Cruise ${healed.shipName}: extracted offerCode from offerName -> ${extracted}`);
      }
    }

    if (!healed.nights && healed.itineraryName) {
      const extracted = extractNightsFromItinerary(healed.itineraryName);
      if (extracted) {
        healed.nights = extracted;
        report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'nights', from: '0', to: String(extracted) });
        wasHealed = true;
      }
    }
    if (!healed.nights && healed.destination) {
      const extracted = extractNightsFromItinerary(healed.destination);
      if (extracted) {
        healed.nights = extracted;
        report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'nights', from: '0', to: String(extracted) });
        wasHealed = true;
      }
    }

    if (healed.sailDate && healed.nights && !healed.returnDate) {
      try {
        const normalized = normalizeDateForMatching(healed.sailDate);
        const parts = normalized.match(/(\d{2})-(\d{2})-(\d{4})/);
        if (parts) {
          const d = new Date(parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          d.setDate(d.getDate() + healed.nights);
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          healed.returnDate = `${m}-${dy}-${d.getFullYear()}`;
          report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'returnDate', from: '', to: healed.returnDate });
          wasHealed = true;
        }
      } catch {
        // skip
      }
    }

    if (!healed.offerExpiry) {
      const matchingOffer = bestOffer;
      if (matchingOffer) {
        const expiry = matchingOffer.expiryDate || matchingOffer.expires || matchingOffer.offerExpiryDate;
        if (expiry) {
          healed.offerExpiry = expiry;
          report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerExpiry', from: '', to: expiry });
          wasHealed = true;
        }
      }
    }

    if (!healed.interiorPrice && !healed.oceanviewPrice && !healed.balconyPrice && !healed.suitePrice) {
      const o = bestOffer;
      if (o) {
        if (o.interiorPrice) healed.interiorPrice = o.interiorPrice;
        if (o.oceanviewPrice) healed.oceanviewPrice = o.oceanviewPrice;
        if (o.balconyPrice) healed.balconyPrice = o.balconyPrice;
        if (o.suitePrice) healed.suitePrice = o.suitePrice;
        if (o.taxesFees) healed.taxes = o.taxesFees;
        if (healed.interiorPrice || healed.balconyPrice) {
          wasHealed = true;
          console.log(`[DataHealing] Cruise ${healed.shipName}: filled pricing from matching offer`);
        }
      }
    }

    if (wasHealed) report.cruisesHealed++;
    return healed;
  });

  const healedCruisesById = new Map(healedCruises.map((cruise) => [cruise.id, cruise]));

  const healedOffers = offers.map(offer => {
    const healed = { ...offer };
    let wasHealed = false;

    if (!healed.offerCode) {
      if (healed.title) {
        const extracted = extractOfferCodeFromText(healed.title);
        if (extracted) {
          healed.offerCode = extracted;
          report.fieldsFixed.push({ entity: `offer:${healed.id}`, field: 'offerCode', from: '', to: extracted });
          wasHealed = true;
          console.log(`[DataHealing] Offer ${healed.id}: extracted offerCode from title -> ${extracted}`);
        }
      }
    }

    if (!healed.offerName || healed.offerName === healed.offerCode) {
      const explicitlyLinkedCruises = healed.cruiseIds?.length
        ? healed.cruiseIds.map((id) => healedCruisesById.get(id)).filter((cruise): cruise is Cruise => Boolean(cruise))
        : [];
      const candidateNames = Array.from(new Set(explicitlyLinkedCruises
        .map((cruise) => cruise.offerName)
        .filter((name): name is string => Boolean(name && name !== healed.offerCode))));
      if (candidateNames.length === 1) {
        healed.offerName = candidateNames[0];
        healed.title = candidateNames[0];
        report.fieldsFixed.push({ entity: `offer:${healed.id}`, field: 'offerName', from: '', to: candidateNames[0] });
        wasHealed = true;
        console.log(`[DataHealing] Offer ${healed.offerCode}: filled offerName from explicitly linked cruise -> ${candidateNames[0]}`);
      }
    }

    if (!healed.shipName || !healed.sailingDate) {
      if (healed.cruiseIds && healed.cruiseIds.length > 0) {
        const linkedCruises = healed.cruiseIds.map((id) => healedCruisesById.get(id)).filter((cruise): cruise is Cruise => Boolean(cruise));
        if (linkedCruises.length === 1) {
          const linkedCruise = linkedCruises[0];
          if (!healed.shipName && linkedCruise.shipName) {
            healed.shipName = linkedCruise.shipName;
            wasHealed = true;
          }
          if (!healed.sailingDate && linkedCruise.sailDate) {
            healed.sailingDate = linkedCruise.sailDate;
            wasHealed = true;
          }
        }
      }
    }

    if (!healed.interiorPrice && !healed.oceanviewPrice && !healed.balconyPrice && !healed.suitePrice) {
      const linkedCruises = healed.cruiseIds?.length
        ? healed.cruiseIds.map((id) => healedCruisesById.get(id)).filter((cruise): cruise is Cruise => Boolean(cruise))
        : [];
      if (linkedCruises.length === 1) {
        const linkedCruise = linkedCruises[0];
        if (linkedCruise.interiorPrice) healed.interiorPrice = linkedCruise.interiorPrice;
        if (linkedCruise.oceanviewPrice) healed.oceanviewPrice = linkedCruise.oceanviewPrice;
        if (linkedCruise.balconyPrice) healed.balconyPrice = linkedCruise.balconyPrice;
        if (linkedCruise.suitePrice) healed.suitePrice = linkedCruise.suitePrice;
        if (linkedCruise.taxes) healed.taxesFees = linkedCruise.taxes;
        if (healed.interiorPrice || healed.balconyPrice) {
          wasHealed = true;
          console.log(`[DataHealing] Offer ${healed.offerCode}: filled pricing from explicitly linked cruise`);
        }
      }
    }

    if (wasHealed) report.offersHealed++;
    return healed;
  });

  report.orphanedCruises = healedCruises.filter(c => !c.offerCode && !c.offerName).length;
  report.orphanedOffers = healedOffers.filter(o => !o.offerCode).length;

  console.log('[DataHealing] Healing complete:', {
    cruisesHealed: report.cruisesHealed,
    offersHealed: report.offersHealed,
    fieldsFixed: report.fieldsFixed.length,
    orphanedCruises: report.orphanedCruises,
    orphanedOffers: report.orphanedOffers,
  });

  return { cruises: healedCruises, offers: healedOffers, report };
}
