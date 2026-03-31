import type { 
  BookedCruise, 
  Cruise, 
  CasinoOffer, 
  ClubRoyaleProfile,
  ClubRoyaleTier,
  CrownAnchorLevel,
  AnalyticsData,
} from '@/types/models';
import { CLUB_ROYALE_TIERS, CROWN_ANCHOR_LEVELS, DOLLARS_PER_POINT } from '@/types/models';
import { getCruisesByStatus } from './lifecycleManager';
import { calculateCabinRetailValue, getCabinValueByType } from '@/mocks/bookedCruises';
import { ROYAL_CARIBBEAN_SHIPS, type ShipInfo } from '@/constants/shipInfo';
import { createDateFromString, getDaysUntil, formatDate } from '@/lib/date';

export interface PlayerContext {
  profile: {
    name: string;
    memberId?: string;
    tier: ClubRoyaleTier;
    tierPoints: number;
    nextTier?: ClubRoyaleTier;
    pointsToNextTier: number;
    progressToNextTier: number;
    crownAnchorLevel: CrownAnchorLevel;
    loyaltyNights: number;
    nextLoyaltyLevel?: CrownAnchorLevel;
    nightsToNextLevel: number;
  };
  portfolio: {
    totalCruises: number;
    upcomingCruises: number;
    completedCruises: number;
    inProgressCruises: number;
    totalNights: number;
    totalSpent: number;
    totalSaved: number;
    portfolioROI: number;
  };
  casino: {
    totalPointsEarned: number;
    totalCoinIn: number;
    netWinLoss: number;
    avgPointsPerCruise: number;
    avgCoinInPerCruise: number;
  };
  preferences: {
    favoriteShip?: string;
    favoriteCabinType?: string;
    favoriteDestination?: string;
    averageNightsPerCruise: number;
  };
}

export interface ShipContext {
  shipName: string;
  shipClass: string;
  passengerCapacity?: number;
  yearBuilt?: number;
  deckCount?: number;
  grossTonnage?: number;
  userHistory: {
    totalCruises: number;
    totalNights: number;
    lastSailed?: string;
    averageROI?: number;
  };
  upcomingCruises: {
    sailDate: string;
    nights: number;
    destination: string;
    cabinType?: string;
  }[];
  availableOffers: {
    offerCode: string;
    cabinType?: string;
    expiresIn?: number;
  }[];
}

export interface OfferContext {
  offerCode: string;
  offerName: string;
  offerType: string;
  cabinType?: string;
  guestCount: number;
  value: {
    freePlay: number;
    obc: number;
    tradeInValue: number;
    estimatedCabinValue: number;
    totalEstimatedValue: number;
  };
  expiry: {
    date?: string;
    daysRemaining?: number;
    isExpiringSoon: boolean;
  };
  eligibleCruises: {
    shipName: string;
    sailDate: string;
    nights: number;
    destination: string;
  }[];
  comparison: {
    betterThanAverage: boolean;
    valueRank?: number;
    percentileRank?: number;
  };
}

export interface CruiseContext {
  cruise: BookedCruise | Cruise;
  value: {
    retailValue: number;
    amountPaid: number;
    savings: number;
    roi: number;
    coveragePercent: number;
  };
  casino: {
    openDays: number;
    estimatedCoinIn: number;
    estimatedPoints: number;
  };
  timeline: {
    daysUntilDeparture: number;
    status: 'upcoming' | 'in-progress' | 'completed';
    isImminient: boolean;
  };
  itinerary: {
    ports: string[];
    seaDays: number;
    portDays: number;
  };
}

export function getPlayerContext(
  profile: ClubRoyaleProfile | undefined,
  bookedCruises: BookedCruise[],
  analytics?: AnalyticsData
): PlayerContext {
  console.log('[IntelligenceAPI] Building player context');

  const currentPoints = profile?.tierPoints || 0;
  const currentTier = (profile?.tier as ClubRoyaleTier) || 'Choice';
  const loyaltyNights = profile?.lifetimeNights || 0;
  const crownAnchorLevel = (profile?.crownAnchorLevel as CrownAnchorLevel) || 'Gold';

  const tierThresholds = Object.entries(CLUB_ROYALE_TIERS)
    .map(([tier, data]) => ({ tier: tier as ClubRoyaleTier, threshold: data.threshold }))
    .sort((a, b) => a.threshold - b.threshold);

  const currentTierIndex = tierThresholds.findIndex(t => t.tier === currentTier);
  const nextTierInfo = currentTierIndex < tierThresholds.length - 1 
    ? tierThresholds[currentTierIndex + 1] 
    : null;

  const pointsToNextTier = nextTierInfo ? Math.max(0, nextTierInfo.threshold - currentPoints) : 0;
  const currentTierThreshold = tierThresholds[currentTierIndex]?.threshold || 0;
  const nextTierThreshold = nextTierInfo?.threshold || currentTierThreshold;
  const progressToNextTier = nextTierInfo 
    ? ((currentPoints - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100
    : 100;

  const loyaltyThresholds = Object.entries(CROWN_ANCHOR_LEVELS)
    .map(([level, data]) => ({ level: level as CrownAnchorLevel, nights: data.cruiseNights }))
    .sort((a, b) => a.nights - b.nights);

  const currentLevelIndex = loyaltyThresholds.findIndex(l => l.level === crownAnchorLevel);
  const nextLevelInfo = currentLevelIndex < loyaltyThresholds.length - 1
    ? loyaltyThresholds[currentLevelIndex + 1]
    : null;

  const nightsToNextLevel = nextLevelInfo ? Math.max(0, nextLevelInfo.nights - loyaltyNights) : 0;

  const cruisesByStatus = getCruisesByStatus(bookedCruises);

  const totalSpent = bookedCruises.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
  const totalRetail = bookedCruises.reduce((sum, c) => {
    const retail = c.retailValue || calculateCabinRetailValue(c.cabinType || 'Balcony', c.nights || 0);
    return sum + retail;
  }, 0);
  const totalSaved = totalRetail - totalSpent;
  const portfolioROI = totalSpent > 0 ? ((totalSaved / totalSpent) * 100) : 0;

  const completedCruises = cruisesByStatus.completed;
  const totalPointsEarned = completedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
  const totalCoinIn = totalPointsEarned * DOLLARS_PER_POINT;
  const netWinLoss = completedCruises.reduce((sum, c) => sum + (c.winnings || 0), 0);
  const avgPointsPerCruise = completedCruises.length > 0 ? totalPointsEarned / completedCruises.length : 0;
  const avgCoinInPerCruise = completedCruises.length > 0 ? totalCoinIn / completedCruises.length : 0;

  const shipCounts: Record<string, number> = {};
  const cabinCounts: Record<string, number> = {};
  const destCounts: Record<string, number> = {};
  let totalNightsSum = 0;

  bookedCruises.forEach(c => {
    if (c.shipName) shipCounts[c.shipName] = (shipCounts[c.shipName] || 0) + 1;
    if (c.cabinType) cabinCounts[c.cabinType] = (cabinCounts[c.cabinType] || 0) + 1;
    if (c.destination) destCounts[c.destination] = (destCounts[c.destination] || 0) + 1;
    totalNightsSum += c.nights || 0;
  });

  const favoriteShip = Object.entries(shipCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favoriteCabinType = Object.entries(cabinCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favoriteDestination = Object.entries(destCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const averageNightsPerCruise = bookedCruises.length > 0 ? totalNightsSum / bookedCruises.length : 0;

  return {
    profile: {
      name: profile?.memberName || 'Guest',
      memberId: profile?.memberId,
      tier: currentTier,
      tierPoints: currentPoints,
      nextTier: nextTierInfo?.tier,
      pointsToNextTier,
      progressToNextTier,
      crownAnchorLevel,
      loyaltyNights,
      nextLoyaltyLevel: nextLevelInfo?.level,
      nightsToNextLevel,
    },
    portfolio: {
      totalCruises: bookedCruises.length,
      upcomingCruises: cruisesByStatus.upcoming.length,
      completedCruises: cruisesByStatus.completed.length,
      inProgressCruises: cruisesByStatus.inProgress.length,
      totalNights: totalNightsSum,
      totalSpent,
      totalSaved,
      portfolioROI,
    },
    casino: {
      totalPointsEarned,
      totalCoinIn,
      netWinLoss,
      avgPointsPerCruise,
      avgCoinInPerCruise,
    },
    preferences: {
      favoriteShip,
      favoriteCabinType,
      favoriteDestination,
      averageNightsPerCruise,
    },
  };
}

export function getShipContext(
  shipName: string,
  bookedCruises: BookedCruise[],
  cruises: Cruise[],
  offers: CasinoOffer[]
): ShipContext {
  console.log(`[IntelligenceAPI] Building ship context for: ${shipName}`);

  const shipInfo = Object.values(ROYAL_CARIBBEAN_SHIPS).find((s: ShipInfo) => 
    s.name.toLowerCase() === shipName.toLowerCase() ||
    s.name.toLowerCase().includes(shipName.toLowerCase())
  );

  const userCruisesOnShip = bookedCruises.filter(c => 
    c.shipName?.toLowerCase() === shipName.toLowerCase()
  );

  const totalCruises = userCruisesOnShip.length;
  const totalNights = userCruisesOnShip.reduce((sum, c) => sum + (c.nights || 0), 0);
  const lastSailed = userCruisesOnShip
    .filter(c => c.completionState === 'completed')
    .sort((a, b) => createDateFromString(b.sailDate).getTime() - createDateFromString(a.sailDate).getTime())[0]
    ?.sailDate;

  const completedOnShip = userCruisesOnShip.filter(c => c.completionState === 'completed');
  let averageROI: number | undefined;
  if (completedOnShip.length > 0) {
    const totalSpent = completedOnShip.reduce((sum, c) => sum + (c.totalPrice || c.price || 0), 0);
    const totalRetail = completedOnShip.reduce((sum, c) => {
      return sum + (c.retailValue || calculateCabinRetailValue(c.cabinType || 'Balcony', c.nights || 0));
    }, 0);
    averageROI = totalSpent > 0 ? ((totalRetail - totalSpent) / totalSpent) * 100 : 0;
  }

  const upcomingCruises = cruises
    .filter(c => 
      c.shipName?.toLowerCase() === shipName.toLowerCase() &&
      getDaysUntil(c.sailDate) > 0
    )
    .slice(0, 5)
    .map(c => ({
      sailDate: c.sailDate,
      nights: c.nights || 0,
      destination: c.destination || c.itineraryName || 'Caribbean',
      cabinType: c.cabinType,
    }));

  const availableOffers = offers
    .filter(o => o.shipName?.toLowerCase() === shipName.toLowerCase())
    .slice(0, 5)
    .map(o => ({
      offerCode: o.offerCode || o.id,
      cabinType: o.roomType,
      expiresIn: o.expires ? getDaysUntil(o.expires) : undefined,
    }));

  return {
    shipName,
    shipClass: shipInfo?.class || 'Unknown',
    passengerCapacity: shipInfo?.passengerCapacity,
    yearBuilt: shipInfo?.yearBuilt,
    
    grossTonnage: shipInfo?.grossTonnage,
    userHistory: {
      totalCruises,
      totalNights,
      lastSailed,
      averageROI,
    },
    upcomingCruises,
    availableOffers,
  };
}

export function getOfferContext(
  offer: CasinoOffer,
  cruises: Cruise[],
  allOffers: CasinoOffer[]
): OfferContext {
  console.log(`[IntelligenceAPI] Building offer context for: ${offer.offerCode || offer.id}`);

  const cabinType = offer.roomType || 'Balcony';
  const cabinInfo = getCabinValueByType(cabinType);
  const estimatedCabinValue = cabinInfo.basePrice * 2;

  const freePlay = offer.freePlay || offer.freeplayAmount || 0;
  const obc = offer.OBC || offer.obcAmount || 0;
  const tradeInValue = offer.tradeInValue || 0;
  const totalEstimatedValue = estimatedCabinValue + freePlay + obc + tradeInValue;

  const expiryDate = offer.expires || offer.expiryDate;
  const daysRemaining = expiryDate ? getDaysUntil(expiryDate) : undefined;
  const isExpiringSoon = daysRemaining !== undefined && daysRemaining <= 14 && daysRemaining > 0;

  const eligibleCruises = cruises
    .filter(c => c.offerCode === offer.offerCode || (offer.cruiseIds && offer.cruiseIds.includes(c.id)))
    .slice(0, 5)
    .map(c => ({
      shipName: c.shipName || '',
      sailDate: c.sailDate,
      nights: c.nights || 0,
      destination: c.destination || c.itineraryName || 'Caribbean',
    }));

  const allOfferValues = allOffers
    .map(o => {
      const fp = o.freePlay || o.freeplayAmount || 0;
      const ob = o.OBC || o.obcAmount || 0;
      const tv = o.tradeInValue || 0;
      const cv = getCabinValueByType(o.roomType || 'Balcony').basePrice * 2;
      return fp + ob + tv + cv;
    })
    .sort((a, b) => b - a);

  const valueRank = allOfferValues.findIndex(v => v <= totalEstimatedValue) + 1;
  const percentileRank = allOffers.length > 0 
    ? ((allOffers.length - valueRank) / allOffers.length) * 100
    : 0;

  const avgValue = allOfferValues.reduce((sum, v) => sum + v, 0) / (allOfferValues.length || 1);
  const betterThanAverage = totalEstimatedValue > avgValue;

  return {
    offerCode: offer.offerCode || offer.id,
    offerName: offer.offerName || offer.title,
    offerType: offer.offerType,
    cabinType: offer.roomType,
    guestCount: offer.guests || 2,
    value: {
      freePlay,
      obc,
      tradeInValue,
      estimatedCabinValue,
      totalEstimatedValue,
    },
    expiry: {
      date: expiryDate,
      daysRemaining,
      isExpiringSoon,
    },
    eligibleCruises,
    comparison: {
      betterThanAverage,
      valueRank,
      percentileRank,
    },
  };
}

export function getCruiseContext(cruise: BookedCruise | Cruise): CruiseContext {
  console.log(`[IntelligenceAPI] Building cruise context for: ${cruise.shipName} - ${cruise.sailDate}`);

  const cabinType = cruise.cabinType || 'Balcony';
  const nights = cruise.nights || 0;
  const retailValue = (cruise as BookedCruise).retailValue || calculateCabinRetailValue(cabinType, nights);
  const amountPaid = cruise.totalPrice || cruise.price || 0;
  const savings = retailValue - amountPaid;
  const roi = amountPaid > 0 ? (savings / amountPaid) * 100 : 0;
  const coveragePercent = retailValue > 0 ? ((retailValue - amountPaid) / retailValue) * 100 : 0;

  const casinoOpenDays = (cruise as BookedCruise).casinoOpenDays || Math.ceil(nights * 0.7);
  const estimatedPointsPerNight = 500;
  const estimatedPoints = nights * estimatedPointsPerNight;
  const estimatedCoinIn = estimatedPoints * DOLLARS_PER_POINT;

  const daysUntilDeparture = getDaysUntil(cruise.sailDate);
  let status: 'upcoming' | 'in-progress' | 'completed' = 'upcoming';
  if (daysUntilDeparture < 0) {
    const daysAfterReturn = -daysUntilDeparture - nights;
    status = daysAfterReturn > 0 ? 'completed' : 'in-progress';
  }
  const isImminient = daysUntilDeparture > 0 && daysUntilDeparture <= 7;

  const ports = cruise.ports || [];
  const seaDays = (cruise as BookedCruise).seaDays || Math.floor(nights * 0.3);
  const portDays = (cruise as BookedCruise).portDays || nights - seaDays;

  return {
    cruise,
    value: {
      retailValue,
      amountPaid,
      savings,
      roi,
      coveragePercent,
    },
    casino: {
      openDays: casinoOpenDays,
      estimatedCoinIn,
      estimatedPoints,
    },
    timeline: {
      daysUntilDeparture,
      status,
      isImminient,
    },
    itinerary: {
      ports,
      seaDays,
      portDays,
    },
  };
}

export function formatPlayerContextForAgent(context: PlayerContext): string {
  const lines: string[] = [
    `**Player Profile: ${context.profile.name}**`,
    '',
    `**Loyalty Status:**`,
    `- Club Royale: ${context.profile.tier} (${context.profile.tierPoints.toLocaleString()} points)`,
    `- Crown & Anchor: ${context.profile.crownAnchorLevel} (${context.profile.loyaltyNights} nights)`,
  ];

  if (context.profile.nextTier) {
    lines.push(`- Progress to ${context.profile.nextTier}: ${context.profile.progressToNextTier.toFixed(1)}% (${context.profile.pointsToNextTier.toLocaleString()} points needed)`);
  }

  lines.push('');
  lines.push('**Portfolio Summary:**');
  lines.push(`- Total Cruises: ${context.portfolio.totalCruises} (${context.portfolio.upcomingCruises} upcoming, ${context.portfolio.completedCruises} completed)`);
  lines.push(`- Total Nights: ${context.portfolio.totalNights}`);
  lines.push(`- Total Spent: $${context.portfolio.totalSpent.toLocaleString()}`);
  lines.push(`- Total Saved: $${context.portfolio.totalSaved.toLocaleString()}`);
  lines.push(`- Portfolio ROI: ${context.portfolio.portfolioROI.toFixed(1)}%`);

  if (context.casino.totalPointsEarned > 0) {
    lines.push('');
    lines.push('**Casino Performance:**');
    lines.push(`- Total Points Earned: ${context.casino.totalPointsEarned.toLocaleString()}`);
    lines.push(`- Total Coin-In: $${context.casino.totalCoinIn.toLocaleString()}`);
    lines.push(`- Net Win/Loss: ${context.casino.netWinLoss >= 0 ? '+' : ''}$${context.casino.netWinLoss.toLocaleString()}`);
  }

  if (context.preferences.favoriteShip) {
    lines.push('');
    lines.push('**Preferences:**');
    lines.push(`- Favorite Ship: ${context.preferences.favoriteShip}`);
    if (context.preferences.favoriteCabinType) lines.push(`- Preferred Cabin: ${context.preferences.favoriteCabinType}`);
    if (context.preferences.favoriteDestination) lines.push(`- Favorite Destination: ${context.preferences.favoriteDestination}`);
  }

  return lines.join('\n');
}

export function formatShipContextForAgent(context: ShipContext): string {
  const lines: string[] = [
    `**Ship: ${context.shipName}**`,
    `Class: ${context.shipClass}`,
  ];

  if (context.passengerCapacity) lines.push(`Capacity: ${context.passengerCapacity.toLocaleString()} passengers`);
  if (context.yearBuilt) lines.push(`Year Built: ${context.yearBuilt}`);

  lines.push('');
  lines.push('**Your History with this Ship:**');
  lines.push(`- Cruises: ${context.userHistory.totalCruises}`);
  lines.push(`- Nights: ${context.userHistory.totalNights}`);
  if (context.userHistory.lastSailed) lines.push(`- Last Sailed: ${formatDate(context.userHistory.lastSailed, 'medium')}`);
  if (context.userHistory.averageROI !== undefined) lines.push(`- Avg ROI: ${context.userHistory.averageROI.toFixed(1)}%`);

  if (context.upcomingCruises.length > 0) {
    lines.push('');
    lines.push(`**Upcoming Sailings (${context.upcomingCruises.length}):**`);
    context.upcomingCruises.forEach(c => {
      lines.push(`- ${formatDate(c.sailDate, 'short')}: ${c.nights} nights to ${c.destination}`);
    });
  }

  if (context.availableOffers.length > 0) {
    lines.push('');
    lines.push(`**Available Offers (${context.availableOffers.length}):**`);
    context.availableOffers.forEach(o => {
      const expiry = o.expiresIn !== undefined ? ` (expires in ${o.expiresIn} days)` : '';
      lines.push(`- ${o.offerCode}: ${o.cabinType || 'Multiple cabins'}${expiry}`);
    });
  }

  return lines.join('\n');
}

export function formatOfferContextForAgent(context: OfferContext): string {
  const lines: string[] = [
    `**Offer: ${context.offerCode}**`,
    `Name: ${context.offerName}`,
    `Type: ${context.offerType}`,
    context.cabinType ? `Cabin: ${context.cabinType}` : '',
    `Guests: ${context.guestCount}`,
    '',
    '**Value Breakdown:**',
    `- Estimated Cabin Value: $${context.value.estimatedCabinValue.toLocaleString()}`,
  ].filter(Boolean);

  if (context.value.freePlay > 0) lines.push(`- FreePlay: $${context.value.freePlay}`);
  if (context.value.obc > 0) lines.push(`- OBC: $${context.value.obc}`);
  if (context.value.tradeInValue > 0) lines.push(`- Trade-In: $${context.value.tradeInValue}`);
  lines.push(`- **Total Estimated Value: $${context.value.totalEstimatedValue.toLocaleString()}**`);

  if (context.expiry.date) {
    lines.push('');
    lines.push('**Expiry:**');
    lines.push(`- Date: ${formatDate(context.expiry.date, 'medium')}`);
    if (context.expiry.daysRemaining !== undefined) {
      lines.push(`- Days Remaining: ${context.expiry.daysRemaining}`);
    }
    if (context.expiry.isExpiringSoon) {
      lines.push('⚠️ **EXPIRING SOON - Action Required**');
    }
  }

  lines.push('');
  lines.push('**Comparison:**');
  lines.push(`- ${context.comparison.betterThanAverage ? '✅ Better than average offer' : '⚠️ Below average offer'}`);
  if (context.comparison.valueRank) lines.push(`- Rank: #${context.comparison.valueRank}`);
  if (context.comparison.percentileRank !== undefined) lines.push(`- Top ${(100 - context.comparison.percentileRank).toFixed(0)}% of offers`);

  if (context.eligibleCruises.length > 0) {
    lines.push('');
    lines.push(`**Eligible Cruises (${context.eligibleCruises.length}):**`);
    context.eligibleCruises.forEach(c => {
      lines.push(`- ${c.shipName}: ${formatDate(c.sailDate, 'short')} (${c.nights} nights to ${c.destination})`);
    });
  }

  return lines.join('\n');
}
