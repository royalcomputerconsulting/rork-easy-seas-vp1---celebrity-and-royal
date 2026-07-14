import type { BookedCruise, CasinoOffer, Anomaly, AlertPriority } from '@/types/models';

const CABIN_TIER_ORDER: { pattern: RegExp; tier: number; label: string }[] = [
  { pattern: /interior\s*gty/i, tier: 1, label: 'Interior GTY' },
  { pattern: /interior|virtual\s*balcony/i, tier: 2, label: 'Interior' },
  { pattern: /ocean\s*view\s*gty|ov\s*gty|ov\s*mid\s*gty/i, tier: 3, label: 'Oceanview GTY' },
  { pattern: /ocean\s*view|oceanview|^ov\b/i, tier: 4, label: 'Oceanview' },
  { pattern: /balcony\s*gty|ov\s*balcony\s*gty/i, tier: 5, label: 'Balcony GTY' },
  { pattern: /balcony|ov\s*balcony|spacious\s*ov\s*balcony/i, tier: 6, label: 'Balcony' },
  { pattern: /suite\s*gty/i, tier: 7, label: 'Suite GTY' },
  { pattern: /junior\s*suite|jr\s*suite/i, tier: 8, label: 'Junior Suite' },
  { pattern: /grand\s*suite(?!\s*2br)/i, tier: 9, label: 'Grand Suite' },
  { pattern: /owner.*suite(?!\s*2br)/i, tier: 10, label: "Owner's Suite" },
  { pattern: /grand\s*suite\s*2br/i, tier: 11, label: 'Grand Suite 2BR' },
  { pattern: /owner.*suite\s*2br/i, tier: 12, label: "Owner's Suite 2BR" },
  { pattern: /royal\s*suite/i, tier: 13, label: 'Royal Suite' },
  { pattern: /penthouse/i, tier: 14, label: 'Penthouse Suite' },
];

const GTY_FALLBACK_TIER = 5;

export interface CabinTierInfo {
  tier: number;
  label: string;
}

export function getCabinTier(cabinType: string | undefined): CabinTierInfo {
  if (!cabinType || cabinType.trim() === '') {
    return { tier: GTY_FALLBACK_TIER, label: 'Unknown' };
  }

  const normalized = cabinType.trim();

  if (/^\s*gty\s*$/i.test(normalized)) {
    return { tier: GTY_FALLBACK_TIER, label: 'GTY (Balcony GTY)' };
  }

  for (const entry of CABIN_TIER_ORDER) {
    if (entry.pattern.test(normalized)) {
      return { tier: entry.tier, label: entry.label };
    }
  }

  if (/balcony/i.test(normalized)) return { tier: 6, label: 'Balcony' };
  if (/ocean|ov/i.test(normalized)) return { tier: 4, label: 'Oceanview' };
  if (/suite/i.test(normalized)) return { tier: 7, label: 'Suite GTY' };
  if (/interior/i.test(normalized)) return { tier: 2, label: 'Interior' };

  return { tier: GTY_FALLBACK_TIER, label: 'Unknown' };
}

export function getHigherCabinTypes(currentTier: number): CabinTierInfo[] {
  return CABIN_TIER_ORDER
    .filter(entry => entry.tier > currentTier)
    .map(entry => ({ tier: entry.tier, label: entry.label }));
}

export interface UpgradeOpportunity {
  bookedCruiseId: string;
  bookedShipName: string;
  bookedSailDate: string;
  bookedCabinType: string;
  bookedCabinTier: number;
  upgradeCabinType: string;
  upgradeCabinTier: number;
  upgradePrice: number;
  previousUpgradePrice?: number;
  priceDrop?: number;
  priceDropPercent?: number;
  taxesFees: number;
  offerId?: string;
  offerName?: string;
  destination: string;
  nights: number;
}

function getOfferPriceForTier(offer: CasinoOffer, tierLabel: string): number | null {
  const label = tierLabel.toLowerCase();

  if (label.includes('interior')) return offer.interiorPrice || null;
  if (label.includes('oceanview') || label.includes('ocean view')) return offer.oceanviewPrice || null;
  if (label.includes('balcony')) return offer.balconyPrice || null;
  if (label.includes('junior suite') || label.includes('jr suite')) return offer.juniorSuitePrice || null;
  if (label.includes('grand suite')) return offer.grandSuitePrice || null;
  if (label.includes('suite')) return offer.suitePrice || null;

  return null;
}

export function findUpgradeOpportunities(
  bookedCruises: BookedCruise[],
  casinoOffers: CasinoOffer[],
  previousUpgradePrices?: Map<string, number>
): UpgradeOpportunity[] {
  const opportunities: UpgradeOpportunity[] = [];
  const now = new Date();

  const upcomingBooked = bookedCruises.filter(c => {
    const sailDate = new Date(c.sailDate);
    return sailDate > now && (c.status === 'booked' || c.completionState === 'upcoming' || c.status === 'Courtesy Hold');
  });

  console.log('[UpgradeMonitor] Checking', upcomingBooked.length, 'upcoming booked cruises against', casinoOffers.length, 'offers');

  for (const booked of upcomingBooked) {
    const bookedTier = getCabinTier(booked.cabinType);
    const higherTiers = getHigherCabinTypes(bookedTier.tier);

    const matchingOffers = casinoOffers.filter(offer => {
      if (!offer.shipName || !offer.sailingDate) return false;
      const shipMatch = offer.shipName.toLowerCase().trim() === booked.shipName.toLowerCase().trim();
      const dateMatch = offer.sailingDate === booked.sailDate;
      return shipMatch && dateMatch;
    });

    for (const offer of matchingOffers) {
      for (const higherTier of higherTiers) {
        const upgradePrice = getOfferPriceForTier(offer, higherTier.label);
        if (!upgradePrice || upgradePrice <= 0) continue;

        const upgradeKey = `${booked.id}_${higherTier.label}`;
        const previousPrice = previousUpgradePrices?.get(upgradeKey);
        let priceDrop: number | undefined;
        let priceDropPercent: number | undefined;

        if (previousPrice && previousPrice > upgradePrice) {
          priceDrop = previousPrice - upgradePrice;
          priceDropPercent = (priceDrop / previousPrice) * 100;
        }

        opportunities.push({
          bookedCruiseId: booked.id,
          bookedShipName: booked.shipName,
          bookedSailDate: booked.sailDate,
          bookedCabinType: booked.cabinType || 'Unknown',
          bookedCabinTier: bookedTier.tier,
          upgradeCabinType: higherTier.label,
          upgradeCabinTier: higherTier.tier,
          upgradePrice,
          previousUpgradePrice: previousPrice,
          priceDrop,
          priceDropPercent,
          taxesFees: offer.taxesFees || offer.portCharges || 0,
          offerId: offer.id,
          offerName: offer.offerName || offer.title,
          destination: offer.itineraryName || booked.destination || 'Unknown',
          nights: offer.nights || booked.nights || 0,
        });
      }
    }

    if (matchingOffers.length === 0) {
      for (const offer of casinoOffers) {
        if (!offer.shipName || !offer.sailingDate) continue;
        const shipMatch = offer.shipName.toLowerCase().trim() === booked.shipName.toLowerCase().trim();
        if (!shipMatch) continue;

        const offerDate = new Date(offer.sailingDate);
        const bookedDate = new Date(booked.sailDate);
        const daysDiff = Math.abs(offerDate.getTime() - bookedDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 3) continue;

        for (const higherTier of higherTiers) {
          const upgradePrice = getOfferPriceForTier(offer, higherTier.label);
          if (!upgradePrice || upgradePrice <= 0) continue;

          const upgradeKey = `${booked.id}_${higherTier.label}`;
          const previousPrice = previousUpgradePrices?.get(upgradeKey);
          let priceDrop: number | undefined;
          let priceDropPercent: number | undefined;

          if (previousPrice && previousPrice > upgradePrice) {
            priceDrop = previousPrice - upgradePrice;
            priceDropPercent = (priceDrop / previousPrice) * 100;
          }

          opportunities.push({
            bookedCruiseId: booked.id,
            bookedShipName: booked.shipName,
            bookedSailDate: booked.sailDate,
            bookedCabinType: booked.cabinType || 'Unknown',
            bookedCabinTier: bookedTier.tier,
            upgradeCabinType: higherTier.label,
            upgradeCabinTier: higherTier.tier,
            upgradePrice,
            previousUpgradePrice: previousPrice,
            priceDrop,
            priceDropPercent,
            taxesFees: offer.taxesFees || offer.portCharges || 0,
            offerId: offer.id,
            offerName: offer.offerName || offer.title,
            destination: offer.itineraryName || booked.destination || 'Unknown',
            nights: offer.nights || booked.nights || 0,
          });
        }
      }
    }
  }

  console.log('[UpgradeMonitor] Found', opportunities.length, 'upgrade opportunities,', 
    opportunities.filter(o => o.priceDrop).length, 'with price drops');
  return opportunities;
}

function generateId(): string {
  return `upgrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function convertUpgradeOpportunitiesToAnomalies(
  opportunities: UpgradeOpportunity[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const grouped = new Map<string, UpgradeOpportunity[]>();
  for (const opp of opportunities) {
    const key = opp.bookedCruiseId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(opp);
  }

  for (const [_cruiseId, opps] of grouped) {
    const withDrops = opps.filter(o => o.priceDrop && o.priceDropPercent && o.priceDropPercent >= 5);

    for (const opp of withDrops) {
      const dropPercent = opp.priceDropPercent!;
      let severity: AlertPriority = 'low';
      if (dropPercent >= 25) severity = 'critical';
      else if (dropPercent >= 15) severity = 'high';
      else if (dropPercent >= 10) severity = 'medium';

      const formattedSailDate = new Date(opp.bookedSailDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      anomalies.push({
        id: generateId(),
        type: 'price_drop',
        severity,
        title: `Upgrade Deal: ${opp.upgradeCabinType} dropped $${opp.priceDrop!.toFixed(0)} on ${opp.bookedShipName}`,
        description: `${opp.upgradeCabinType} cabin on your booked ${opp.bookedShipName} cruise (${formattedSailDate}) dropped from $${opp.previousUpgradePrice!.toFixed(0)} to $${opp.upgradePrice.toFixed(0)} (${dropPercent.toFixed(1)}% off). You're currently in ${opp.bookedCabinType}. This could be a great upgrade opportunity — contact Royal Caribbean to reprice or upgrade!`,
        detectedAt: new Date().toISOString(),
        dataPoints: {
          cruiseId: opp.bookedCruiseId,
          offerId: opp.offerId,
          metric: 'Upgrade Price',
          expectedValue: opp.previousUpgradePrice!,
          actualValue: opp.upgradePrice,
          deviation: -opp.priceDrop!,
          deviationPercent: -dropPercent,
          isBookedCruise: 1,
        },
        relatedEntityId: opp.offerId || opp.bookedCruiseId,
        relatedEntityType: 'offer',
      });
    }

    if (withDrops.length === 0 && opps.length > 0) {
      const bestDeal = opps.reduce((best, current) => {
        if (!best) return current;
        const bestTierDiff = current.upgradeCabinTier - current.bookedCabinTier;
        const currentTierDiff = best.upgradeCabinTier - best.bookedCabinTier;
        if (bestTierDiff === 1 && currentTierDiff !== 1) return current;
        if (currentTierDiff === 1 && bestTierDiff !== 1) return best;
        return current.upgradePrice < best.upgradePrice ? current : best;
      });

      if (bestDeal) {
        const formattedSailDate = new Date(bestDeal.bookedSailDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        anomalies.push({
          id: generateId(),
          type: 'price_drop',
          severity: 'info',
          title: `Upgrade Available: ${bestDeal.upgradeCabinType} on ${bestDeal.bookedShipName}`,
          description: `${bestDeal.upgradeCabinType} is available for $${bestDeal.upgradePrice.toFixed(0)} on your booked ${bestDeal.bookedShipName} cruise (${formattedSailDate}). You're currently in ${bestDeal.bookedCabinType}. We're now tracking this price for drops.`,
          detectedAt: new Date().toISOString(),
          dataPoints: {
            cruiseId: bestDeal.bookedCruiseId,
            offerId: bestDeal.offerId,
            metric: 'Upgrade Price Tracking',
            expectedValue: bestDeal.upgradePrice,
            actualValue: bestDeal.upgradePrice,
            deviation: 0,
            deviationPercent: 0,
            isBookedCruise: 1,
          },
          relatedEntityId: bestDeal.offerId || bestDeal.bookedCruiseId,
          relatedEntityType: 'offer',
        });
      }
    }
  }

  console.log('[UpgradeMonitor] Generated', anomalies.length, 'upgrade anomalies');
  return anomalies;
}
