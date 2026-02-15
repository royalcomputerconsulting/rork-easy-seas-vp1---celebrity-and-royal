import type { Cruise, CasinoOffer } from '@/types/models';

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

  const offerByCode = new Map<string, CasinoOffer>();
  const offersByCruiseKey = new Map<string, CasinoOffer[]>();

  for (const offer of offers) {
    if (offer.offerCode) {
      offerByCode.set(offer.offerCode.trim().toUpperCase(), offer);
    }
    if (offer.shipName && offer.sailingDate) {
      const key = buildCruiseKey(offer.shipName, offer.sailingDate);
      if (!offersByCruiseKey.has(key)) offersByCruiseKey.set(key, []);
      offersByCruiseKey.get(key)!.push(offer);
    }
  }

  const cruisesByOfferCode = new Map<string, Cruise[]>();
  for (const cruise of cruises) {
    if (cruise.offerCode) {
      const code = cruise.offerCode.trim().toUpperCase();
      if (!cruisesByOfferCode.has(code)) cruisesByOfferCode.set(code, []);
      cruisesByOfferCode.get(code)!.push(cruise);
    }
  }

  const healedCruises = cruises.map(cruise => {
    const healed = { ...cruise };
    let wasHealed = false;

    if (!healed.offerCode || !healed.offerName) {
      const cruiseKey = buildCruiseKey(healed.shipName, healed.sailDate);
      const matchingOffers = offersByCruiseKey.get(cruiseKey);

      if (matchingOffers && matchingOffers.length > 0) {
        const bestOffer = matchingOffers[0];

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

    if (!healed.offerName && healed.offerCode) {
      const offer = offerByCode.get(healed.offerCode.trim().toUpperCase());
      if (offer && (offer.offerName || offer.title)) {
        healed.offerName = offer.offerName || offer.title;
        report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerName', from: '', to: healed.offerName || '' });
        wasHealed = true;
        console.log(`[DataHealing] Cruise ${healed.shipName}: filled offerName from offer registry -> ${healed.offerName}`);
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
      const cruiseKey = buildCruiseKey(healed.shipName, healed.sailDate);
      const matchingOffers = offersByCruiseKey.get(cruiseKey);
      if (matchingOffers && matchingOffers.length > 0) {
        const expiry = matchingOffers[0].expiryDate || matchingOffers[0].expires || matchingOffers[0].offerExpiryDate;
        if (expiry) {
          healed.offerExpiry = expiry;
          report.fieldsFixed.push({ entity: `cruise:${healed.id}`, field: 'offerExpiry', from: '', to: expiry });
          wasHealed = true;
        }
      }
    }

    if (!healed.interiorPrice && !healed.oceanviewPrice && !healed.balconyPrice && !healed.suitePrice) {
      const cruiseKey = buildCruiseKey(healed.shipName, healed.sailDate);
      const matchingOffers = offersByCruiseKey.get(cruiseKey);
      if (matchingOffers && matchingOffers.length > 0) {
        const o = matchingOffers[0];
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
      if (healed.offerCode) {
        const matchingCruises = cruisesByOfferCode.get(healed.offerCode.trim().toUpperCase());
        if (matchingCruises && matchingCruises.length > 0) {
          const c = matchingCruises[0];
          if (c.offerName && c.offerName !== c.offerCode) {
            healed.offerName = c.offerName;
            healed.title = c.offerName;
            report.fieldsFixed.push({ entity: `offer:${healed.id}`, field: 'offerName', from: '', to: c.offerName });
            wasHealed = true;
            console.log(`[DataHealing] Offer ${healed.offerCode}: filled offerName from cruise -> ${c.offerName}`);
          }
        }
      }
    }

    if (!healed.shipName || !healed.sailingDate) {
      if (healed.cruiseIds && healed.cruiseIds.length > 0) {
        const linkedCruise = healedCruises.find(c => healed.cruiseIds?.includes(c.id));
        if (linkedCruise) {
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
      if (healed.offerCode) {
        const matchingCruises = cruisesByOfferCode.get(healed.offerCode.trim().toUpperCase());
        if (matchingCruises && matchingCruises.length > 0) {
          const c = matchingCruises[0];
          if (c.interiorPrice) healed.interiorPrice = c.interiorPrice;
          if (c.oceanviewPrice) healed.oceanviewPrice = c.oceanviewPrice;
          if (c.balconyPrice) healed.balconyPrice = c.balconyPrice;
          if (c.suitePrice) healed.suitePrice = c.suitePrice;
          if (c.taxes) healed.taxesFees = c.taxes;
          if (healed.interiorPrice || healed.balconyPrice) {
            wasHealed = true;
            console.log(`[DataHealing] Offer ${healed.offerCode}: filled pricing from cruise`);
          }
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
