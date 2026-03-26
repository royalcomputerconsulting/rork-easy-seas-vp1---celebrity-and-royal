import type { Cruise, BookedCruise, CasinoOffer, ClubRoyaleTier } from '@/types/models';
import { calculateCruiseValue, calculatePortfolioValue, calculateROIFromValue } from '@/lib/valueCalculator';
import { formatDate, getDaysUntil, createDateFromString, isDateInPast } from '@/lib/date';
import { CLUB_ROYALE_TIERS } from '@/types/models';
import { 
  getRecommendedCruises, 
  getRecommendationSummary,
  calculateSeaDays,
  isPreferredPort,
} from '@/lib/recommendationEngine';

export interface AgentToolContext {
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  offers: CasinoOffer[];
  userPoints: number;
  currentTier: ClubRoyaleTier;
  slotMachines?: any[];
  myAtlasMachines?: any[];
  globalLibrary?: any[];
  encyclopedia?: any[];
  deckMappings?: any[];
  casinoSessions?: any[];
  getSessionAnalytics?: () => any;
  getMachineAnalytics?: (machineId: string) => any;
}

export interface CruiseSearchInput {
  shipName?: string;
  destination?: string;
  minNights?: number;
  maxNights?: number;
  cabinType?: 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';
  maxPrice?: number;
  dateRange?: {
    start?: string;
    end?: string;
  };
  onlyAvailable?: boolean;
  sortBy?: 'date' | 'price' | 'nights' | 'value';
  limit?: number;
}

export interface BookingAnalysisInput {
  cruiseId?: string;
  includeROI?: boolean;
  includeValueBreakdown?: boolean;
  compareWithPortfolio?: boolean;
}

export interface PortfolioOptimizerInput {
  targetTier?: 'Choice' | 'Prime' | 'Signature' | 'Masters';
  budgetMax?: number;
  timeframeMonths?: number;
  prioritize?: 'roi' | 'points' | 'value' | 'nights';
  maxCruises?: number;
}

export interface TierProgressInput {
  includeProjections?: boolean;
  targetTier?: 'Choice' | 'Prime' | 'Signature' | 'Masters';
}

export interface OfferAnalysisInput {
  offerId?: string;
  includeExpiring?: boolean;
  expiryDays?: number;
  sortBy?: 'value' | 'expiry' | 'freeplay' | 'cabin';
}

export function executeCruiseSearch(input: CruiseSearchInput, context: AgentToolContext): string {
  console.log('[AgentTools] Cruise search input:', input);
  
  let results = [...context.cruises];
  
  if (input.onlyAvailable) {
    const bookedIds = new Set(context.bookedCruises.map(b => b.id));
    results = results.filter(c => !bookedIds.has(c.id) && !isDateInPast(c.sailDate));
  }
  
  if (input.shipName) {
    const shipQuery = input.shipName.toLowerCase();
    results = results.filter(c => c.shipName?.toLowerCase().includes(shipQuery));
  }
  
  if (input.destination) {
    const destQuery = input.destination.toLowerCase();
    results = results.filter(c => 
      c.destination?.toLowerCase().includes(destQuery) ||
      c.itineraryName?.toLowerCase().includes(destQuery) ||
      c.ports?.some(p => p.toLowerCase().includes(destQuery))
    );
  }
  
  if (input.minNights !== undefined) {
    results = results.filter(c => c.nights >= input.minNights!);
  }
  
  if (input.maxNights !== undefined) {
    results = results.filter(c => c.nights <= input.maxNights!);
  }
  
  if (input.cabinType) {
    results = results.filter(c => c.cabinType?.includes(input.cabinType!));
  }
  
  if (input.maxPrice !== undefined) {
    results = results.filter(c => (c.price || 0) <= input.maxPrice!);
  }
  
  if (input.dateRange) {
    if (input.dateRange.start) {
      const startDate = createDateFromString(input.dateRange.start);
      results = results.filter(c => createDateFromString(c.sailDate) >= startDate);
    }
    if (input.dateRange.end) {
      const endDate = createDateFromString(input.dateRange.end);
      results = results.filter(c => createDateFromString(c.sailDate) <= endDate);
    }
  }
  
  const sortBy = input.sortBy || 'date';
  results.sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return createDateFromString(a.sailDate).getTime() - createDateFromString(b.sailDate).getTime();
      case 'price':
        return (a.price || 0) - (b.price || 0);
      case 'nights':
        return b.nights - a.nights;
      case 'value':
        return (b.totalValue || b.retailValue || 0) - (a.totalValue || a.retailValue || 0);
      default:
        return 0;
    }
  });
  
  const limit = input.limit || 10;
  results = results.slice(0, limit);
  
  if (results.length === 0) {
    return 'No cruises found matching your criteria. Try broadening your search parameters.';
  }
  
  const lines = [`Found ${results.length} cruise${results.length !== 1 ? 's' : ''}:\n`];
  
  results.forEach((cruise, index) => {
    const daysUntil = getDaysUntil(cruise.sailDate);
    lines.push(`${index + 1}. **${cruise.shipName}** - ${cruise.destination || cruise.itineraryName || 'Caribbean'}`);
    lines.push(`   📅 ${formatDate(cruise.sailDate, 'medium')} (${daysUntil} days away)`);
    lines.push(`   🌙 ${cruise.nights} nights from ${cruise.departurePort}`);
    if (cruise.cabinType) lines.push(`   🛏️ ${cruise.cabinType}`);
    if (cruise.price) lines.push(`   💰 $${cruise.price.toLocaleString()}`);
    if (cruise.offerCode) lines.push(`   🎰 Offer: ${cruise.offerCode}`);
    if (cruise.casinoOpenDays) lines.push(`   🎲 ${cruise.casinoOpenDays} casino-open days`);
    lines.push('');
  });
  
  console.log('[AgentTools] Cruise search results:', results.length);
  
  return lines.join('\n');
}

export function executeBookingAnalysis(input: BookingAnalysisInput, context: AgentToolContext): string {
  console.log('[AgentTools] Booking analysis input:', input);
  
  if (input.cruiseId) {
    const cruise = context.bookedCruises.find(c => c.id === input.cruiseId) ||
                   context.cruises.find(c => c.id === input.cruiseId);
    
    if (!cruise) {
      return `Cruise with ID ${input.cruiseId} not found.`;
    }
    
    const valueBreakdown = calculateCruiseValue(cruise);
    const winnings = (cruise as BookedCruise).winnings || 0;
    const roiCalc = calculateROIFromValue(
      valueBreakdown.totalRetailValue,
      winnings,
      valueBreakdown.amountPaid
    );
    
    const portfolioValue = calculatePortfolioValue(context.bookedCruises);
    
    const lines = [
      `## Analysis: ${cruise.shipName}`,
      `📅 ${formatDate(cruise.sailDate, 'medium')} • ${cruise.nights} nights`,
      `📍 ${cruise.destination || cruise.itineraryName || 'Caribbean'}`,
      `🛏️ Cabin: ${cruise.cabinType || 'Not specified'}${(cruise as BookedCruise).cabinNumber ? ` (${(cruise as BookedCruise).cabinNumber})` : ''}`,
      '',
    ];
    
    if (input.includeValueBreakdown) {
      lines.push('### Value Breakdown');
      lines.push(`• Cabin Value: $${valueBreakdown.cabinValue.toLocaleString()} × 2 = $${valueBreakdown.cabinValueForTwo.toLocaleString()}`);
      lines.push(`• Taxes & Fees: $${valueBreakdown.taxesFees.toLocaleString()}`);
      if (valueBreakdown.freePlayValue > 0) lines.push(`• FreePlay: $${valueBreakdown.freePlayValue.toLocaleString()}`);
      if (valueBreakdown.obcValue > 0) lines.push(`• OBC: $${valueBreakdown.obcValue.toLocaleString()}`);
      lines.push(`• **Total Retail Value: $${valueBreakdown.totalRetailValue.toLocaleString()}**`);
      lines.push(`• Amount Paid: $${valueBreakdown.amountPaid.toLocaleString()}`);
      lines.push(`• **Net Value: $${valueBreakdown.netValue.toLocaleString()}**`);
      lines.push(`• Coverage: ${(valueBreakdown.coverageFraction * 100).toFixed(0)}%`);
      if (valueBreakdown.isFullyComped) lines.push('✅ **FULLY COMPED**');
      lines.push('');
    }
    
    if (input.includeROI) {
      lines.push('### ROI Analysis');
      lines.push(`• ROI: $${roiCalc.roi.toLocaleString()} (${roiCalc.roiPercentage.toFixed(1)}%)`);
      lines.push(`• Winnings: $${winnings.toLocaleString()}`);
      lines.push('');
    }
    
    if (input.compareWithPortfolio) {
      lines.push('### Portfolio Comparison');
      lines.push(`• Portfolio Avg ROI: ${portfolioValue.avgROI.toFixed(1)}%`);
      lines.push(`• This Cruise: ${roiCalc.roiPercentage > portfolioValue.avgROI ? '📈 Above average' : '📉 Below average'} (${Math.abs(roiCalc.roiPercentage - portfolioValue.avgROI).toFixed(1)}% difference)`);
    }
    
    return lines.join('\n');
  }
  
  const portfolioValue = calculatePortfolioValue(context.bookedCruises);
  
  const lines = [
    '## Portfolio Summary',
    `• Total Cruises: ${context.bookedCruises.length}`,
    `• Total Retail Value: $${portfolioValue.totalRetailValue.toLocaleString()}`,
    `• Total Amount Paid: $${portfolioValue.totalAmountPaid.toLocaleString()}`,
    `• **Total Savings: $${portfolioValue.totalSavings.toLocaleString()}**`,
    `• Total Points: ${portfolioValue.totalPoints.toLocaleString()}`,
    `• Average ROI: ${portfolioValue.avgROI.toFixed(1)}%`,
    `• Total Coin-In: $${portfolioValue.totalCoinIn.toLocaleString()}`,
  ];
  
  return lines.join('\n');
}

export function executePortfolioOptimizer(input: PortfolioOptimizerInput, context: AgentToolContext): string {
  console.log('[AgentTools] Portfolio optimizer input:', input);
  
  const currentPoints = context.userPoints;
  const currentTier = context.currentTier;
  const targetTier = input.targetTier || 'Signature';
  const targetPoints = CLUB_ROYALE_TIERS[targetTier as ClubRoyaleTier]?.threshold || 25001;
  const pointsNeeded = Math.max(0, targetPoints - currentPoints);
  
  const bookedIds = new Set(context.bookedCruises.map(b => b.id));
  let availableCruises = context.cruises.filter(c => 
    !bookedIds.has(c.id) && !isDateInPast(c.sailDate)
  );
  
  if (input.budgetMax) {
    availableCruises = availableCruises.filter(c => (c.price || 0) <= input.budgetMax!);
  }
  
  if (input.timeframeMonths) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + input.timeframeMonths);
    availableCruises = availableCruises.filter(c => 
      createDateFromString(c.sailDate) <= endDate
    );
  }
  
  const scoredCruises = availableCruises.map(cruise => {
    const valueBreakdown = calculateCruiseValue(cruise);
    const estimatedPoints = Math.round((cruise.nights || 0) * 500);
    
    let score = 0;
    const prioritize = input.prioritize || 'value';
    
    switch (prioritize) {
      case 'roi':
        score = valueBreakdown.coverageFraction * 100 + (cruise.casinoOpenDays || 0) * 5;
        break;
      case 'points':
        score = estimatedPoints + (cruise.casinoOpenDays || 0) * 100;
        break;
      case 'value':
        score = valueBreakdown.netValue + valueBreakdown.freePlayValue * 2;
        break;
      case 'nights':
        score = cruise.nights * 100;
        break;
    }
    
    if (cruise.offerCode) score += 200;
    if (valueBreakdown.isFullyComped) score += 500;
    
    return {
      cruise,
      score,
      valueBreakdown,
      estimatedPoints,
    };
  });
  
  scoredCruises.sort((a, b) => b.score - a.score);
  
  const maxCruises = input.maxCruises || 5;
  const recommendations = scoredCruises.slice(0, maxCruises);
  
  if (recommendations.length === 0) {
    return 'No cruises available matching your optimization criteria. Try adjusting your budget or timeframe.';
  }
  
  let cumulativePoints = currentPoints;
  let cumulativeCost = 0;
  
  const lines = [
    '## Portfolio Optimization Recommendations',
    '',
    `**Current Status:** ${currentTier} tier with ${currentPoints.toLocaleString()} points`,
    `**Target:** ${targetTier} tier (${targetPoints.toLocaleString()} points)`,
    `**Points Needed:** ${pointsNeeded.toLocaleString()}`,
    '',
    '### Recommended Cruises',
    '',
  ];
  
  recommendations.forEach((rec, index) => {
    cumulativePoints += rec.estimatedPoints;
    cumulativeCost += rec.valueBreakdown.amountPaid;
    
    lines.push(`**${index + 1}. ${rec.cruise.shipName}** - ${rec.cruise.destination || rec.cruise.itineraryName}`);
    lines.push(`   📅 ${formatDate(rec.cruise.sailDate, 'medium')} • ${rec.cruise.nights} nights`);
    lines.push(`   💰 Est. Cost: $${rec.valueBreakdown.amountPaid.toLocaleString()} | Coverage: ${(rec.valueBreakdown.coverageFraction * 100).toFixed(0)}%`);
    lines.push(`   🎯 Est. Points: +${rec.estimatedPoints.toLocaleString()} (Running total: ${cumulativePoints.toLocaleString()})`);
    if (rec.cruise.offerCode) lines.push(`   🎰 Offer: ${rec.cruise.offerCode}`);
    if (rec.cruise.casinoOpenDays) lines.push(`   🎲 ${rec.cruise.casinoOpenDays} casino days`);
    lines.push('');
  });
  
  const totalEstimatedPoints = recommendations.reduce((sum, r) => sum + r.estimatedPoints, 0);
  const wouldReachTarget = cumulativePoints >= targetPoints;
  
  lines.push('### Projected Outcome');
  lines.push(`• Total Est. Points: +${totalEstimatedPoints.toLocaleString()}`);
  lines.push(`• Projected Total: ${cumulativePoints.toLocaleString()} points`);
  lines.push(`• Total Est. Cost: $${cumulativeCost.toLocaleString()}`);
  
  if (wouldReachTarget) {
    lines.push(`\n✨ **Following these recommendations would help you reach ${targetTier} tier!**`);
  } else {
    const stillNeeded = targetPoints - cumulativePoints;
    lines.push(`\n⚠️ You'd still need ${stillNeeded.toLocaleString()} more points to reach ${targetTier}.`);
  }
  
  return lines.join('\n');
}

export function executeTierProgress(input: TierProgressInput, context: AgentToolContext): string {
  console.log('[AgentTools] Tier progress input:', input);
  
  const currentPoints = context.userPoints;
  const currentTier = context.currentTier;
  
  const tiers: { tier: ClubRoyaleTier; threshold: number }[] = [
    { tier: 'Choice', threshold: 0 },
    { tier: 'Prime', threshold: 2501 },
    { tier: 'Signature', threshold: 25001 },
    { tier: 'Masters', threshold: 100001 },
  ];
  
  const currentTierIndex = tiers.findIndex(t => t.tier === currentTier);
  const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  
  // Get all completed cruises
  const allCompletedCruises = context.bookedCruises.filter(c => {
    const isCompleted = c.completionState === 'completed' || c.status === 'completed';
    if (!isCompleted && c.returnDate) {
      const returnDate = createDateFromString(c.returnDate);
      const today = new Date();
      return returnDate < today;
    }
    return isCompleted;
  });
  
  // Total earned points from ALL completed cruises
  const totalEarnedFromCompleted = allCompletedCruises
    .reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
  
  console.log('[AgentTools] All completed cruises:', allCompletedCruises.length, 'Total earned points:', totalEarnedFromCompleted);
  
  // Filter to last 90 days for recent performance
  const completedCruisesInLast90Days = allCompletedCruises
    .filter(c => {
      const returnDate = createDateFromString(c.returnDate);
      const today = new Date();
      const daysAgo = Math.floor((today.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysAgo >= 0 && daysAgo <= 90;
    });
  
  const completedPoints = completedCruisesInLast90Days
    .reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0);
  
  console.log('[AgentTools] Completed cruises in last 90 days:', completedCruisesInLast90Days.length, 'Points:', completedPoints);
  
  // Log individual completed cruises for debugging
  allCompletedCruises.forEach(c => {
    console.log(`[AgentTools] Completed: ${c.shipName} - ${c.sailDate} - earnedPoints: ${c.earnedPoints}, casinoPoints: ${c.casinoPoints}`);
  });
  
  const upcomingCruises = context.bookedCruises.filter(c => c.completionState === 'upcoming');
  const bookedPoints = upcomingCruises
    .reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || Math.round(c.nights * 500)), 0);
  
  const progressToNext = nextTier
    ? ((currentPoints - tiers[currentTierIndex].threshold) / (nextTier.threshold - tiers[currentTierIndex].threshold)) * 100
    : 100;
  
  const avgPointsPerCruise = context.bookedCruises.length > 0
    ? context.bookedCruises.reduce((sum, c) => sum + (c.earnedPoints || c.casinoPoints || 0), 0) / context.bookedCruises.length
    : 2000;
  
  const lines = [
    '## Club Royale Tier Progress',
    '',
    `**Current Tier:** ${currentTier} ${CLUB_ROYALE_TIERS[currentTier]?.color || '🔵'}`,
    `**Current Points:** ${currentPoints.toLocaleString()}`,
    '',
  ];
  
  if (nextTier) {
    const pointsToNext = nextTier.threshold - currentPoints;
    lines.push(`### Progress to ${nextTier.tier}`);
    lines.push(`• Target: ${nextTier.threshold.toLocaleString()} points`);
    lines.push(`• Points Needed: ${pointsToNext.toLocaleString()}`);
    lines.push(`• Progress: ${progressToNext.toFixed(1)}%`);
    lines.push(`• Progress Bar: ${'█'.repeat(Math.floor(progressToNext / 5))}${'░'.repeat(20 - Math.floor(progressToNext / 5))} ${progressToNext.toFixed(0)}%`);
    lines.push('');
  } else {
    lines.push('🎉 **Congratulations! You have reached Masters tier - the highest level!**');
    lines.push('');
  }
  
  const upcomingCount = upcomingCruises.length;
  const completedCount = completedCruisesInLast90Days.length;
  
  // Show lifetime completed stats first
  const lifetimeNights = allCompletedCruises.reduce((sum, c) => sum + c.nights, 0);
  
  if (allCompletedCruises.length > 0 && totalEarnedFromCompleted > 0) {
    lines.push('### Lifetime Completed Cruises');
    lines.push(`• Total Completed: ${allCompletedCruises.length} cruises`);
    lines.push(`• Total Points Earned: ${totalEarnedFromCompleted.toLocaleString()}`);
    lines.push(`• Total Nights: ${lifetimeNights}`);
    lines.push(`• Avg Points per Night: ${Math.round(totalEarnedFromCompleted / lifetimeNights).toLocaleString()}`);
    lines.push('');
  }
  
  lines.push('### Recent Performance (Last 90 Days)');
  if (completedCount > 0) {
    lines.push(`• Completed Cruises: ${completedCount}`);
    lines.push(`• Points Earned: ${completedPoints.toLocaleString()}`);
    const totalNights = completedCruisesInLast90Days.reduce((sum, c) => sum + c.nights, 0);
    lines.push(`• Total Nights: ${totalNights}`);
    if (completedPoints > 0 && totalNights > 0) {
      lines.push(`• Avg Points per Night: ${Math.round(completedPoints / totalNights).toLocaleString()}`);
    } else {
      lines.push(`• Avg Points per Night: N/A (no points data recorded)`);
    }
  } else {
    lines.push('• No completed cruises in the last 90 days');
  }
  lines.push('');
  
  lines.push('### Booked Cruises Contribution');
  lines.push(`• Upcoming Cruises: ${upcomingCount}`);
  lines.push(`• Estimated Points from Booked: ${bookedPoints.toLocaleString()}`);
  lines.push(`• Projected Total After Booked: ${(currentPoints + bookedPoints).toLocaleString()}`);
  
  if (input.includeProjections && nextTier) {
    const pointsStillNeeded = Math.max(0, nextTier.threshold - currentPoints - bookedPoints);
    const cruisesNeeded = Math.ceil(pointsStillNeeded / (avgPointsPerCruise || 2000));
    
    const avgNightsPerCruise = context.bookedCruises.length > 0
      ? context.bookedCruises.reduce((sum, c) => sum + c.nights, 0) / context.bookedCruises.length
      : 5;
    
    const estimatedMonths = Math.ceil(cruisesNeeded / 2);
    
    lines.push('');
    lines.push('### Projections');
    lines.push(`• Points Still Needed: ${pointsStillNeeded.toLocaleString()}`);
    lines.push(`• Est. Additional Cruises Needed: ${cruisesNeeded}`);
    lines.push(`• Est. Additional Nights Needed: ${Math.ceil(cruisesNeeded * avgNightsPerCruise)}`);
    lines.push(`• Est. Timeframe: ${estimatedMonths} month${estimatedMonths !== 1 ? 's' : ''}`);
  }
  
  if (input.targetTier) {
    const targetTierInfo = tiers.find(t => t.tier === input.targetTier);
    if (targetTierInfo) {
      const pointsToTarget = Math.max(0, targetTierInfo.threshold - currentPoints);
      const cruisesToTarget = Math.ceil(pointsToTarget / (avgPointsPerCruise || 2000));
      
      lines.push('');
      lines.push(`### Path to ${input.targetTier}`);
      
      if (pointsToTarget <= 0) {
        lines.push(`✅ You have already achieved ${input.targetTier} tier!`);
      } else {
        lines.push(`• Target Threshold: ${targetTierInfo.threshold.toLocaleString()} points`);
        lines.push(`• Points Needed: ${pointsToTarget.toLocaleString()}`);
        lines.push(`• Est. Cruises to Reach: ${cruisesToTarget}`);
      }
    }
  }
  
  return lines.join('\n');
}

export function executeOfferAnalysis(input: OfferAnalysisInput, context: AgentToolContext): string {
  console.log('[AgentTools] Offer analysis input:', input);
  
  let offers = [...context.offers];
  
  if (input.offerId) {
    const offer = offers.find(o => o.id === input.offerId);
    if (!offer) {
      return `Offer with ID ${input.offerId} not found.`;
    }
    
    const cruisesForOffer = context.cruises.filter(c => 
      c.offerCode === offer.offerCode
    );
    
    const expiryDate = offer.expires || offer.expiryDate;
    const daysUntil = expiryDate ? getDaysUntil(expiryDate) : null;
    
    const lines = [
      `## Offer: ${offer.offerCode || offer.id}`,
      '',
      `**Name:** ${offer.offerName || offer.title}`,
      `**Type:** ${offer.classification || offer.offerType}`,
      `**Cabin:** ${offer.roomType || 'Not specified'}`,
      '',
    ];
    
    if (expiryDate) {
      lines.push(`**Expires:** ${formatDate(expiryDate, 'medium')} (${daysUntil} days)`);
    }
    
    lines.push('');
    lines.push('### Perks');
    if (offer.freePlay) lines.push(`• FreePlay: $${offer.freePlay}`);
    if (offer.OBC) lines.push(`• OBC: $${offer.OBC}`);
    if (offer.tradeInValue) lines.push(`• Trade-In Value: $${offer.tradeInValue}`);
    if (offer.totalValue) lines.push(`• **Total Value: $${offer.totalValue}**`);
    
    lines.push('');
    lines.push(`### Eligible Cruises (${cruisesForOffer.length})`);
    
    if (cruisesForOffer.length === 0) {
      lines.push('No cruises currently linked to this offer.');
    } else {
      cruisesForOffer.slice(0, 5).forEach(c => {
        lines.push(`• ${c.shipName} - ${formatDate(c.sailDate, 'short')} (${c.nights} nights)`);
      });
      if (cruisesForOffer.length > 5) {
        lines.push(`• ...and ${cruisesForOffer.length - 5} more`);
      }
    }
    
    return lines.join('\n');
  }
  
  if (input.includeExpiring) {
    const expiryDays = input.expiryDays || 14;
    offers = offers.filter(o => {
      const expiryDate = o.expires || o.expiryDate;
      if (!expiryDate) return false;
      const days = getDaysUntil(expiryDate);
      return days > 0 && days <= expiryDays;
    });
  }
  
  const sortBy = input.sortBy || 'expiry';
  offers.sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return (b.totalValue || 0) - (a.totalValue || 0);
      case 'expiry':
        const daysA = (a.expires || a.expiryDate) ? getDaysUntil(a.expires || a.expiryDate!) : 9999;
        const daysB = (b.expires || b.expiryDate) ? getDaysUntil(b.expires || b.expiryDate!) : 9999;
        return daysA - daysB;
      case 'freeplay':
        return (b.freePlay || 0) - (a.freePlay || 0);
      case 'cabin':
        const cabinOrder: Record<string, number> = {
          'Suite': 4, 'Balcony': 3, 'Oceanview': 2, 'Interior': 1
        };
        return (cabinOrder[b.roomType || ''] || 0) - (cabinOrder[a.roomType || ''] || 0);
      default:
        return 0;
    }
  });
  
  const displayOffers = offers.slice(0, 10);
  
  if (displayOffers.length === 0) {
    return 'No offers found matching your criteria.';
  }
  
  const expiringCount = offers.filter(o => {
    const days = (o.expires || o.expiryDate) ? getDaysUntil(o.expires || o.expiryDate!) : null;
    return days !== null && days <= 7;
  }).length;
  
  const lines = [
    '## Casino Offers Analysis',
    '',
    `**Total Offers:** ${context.offers.length}`,
    `**Matching:** ${offers.length}`,
  ];
  
  if (expiringCount > 0) {
    lines.push(`**⚠️ Expiring Within 7 Days:** ${expiringCount}`);
  }
  
  lines.push('');
  lines.push('### Offers');
  lines.push('');
  
  displayOffers.forEach((offer, index) => {
    const expiryDate = offer.expires || offer.expiryDate;
    const daysUntil = expiryDate ? getDaysUntil(expiryDate) : null;
    
    let urgencyIcon = '🟢';
    if (daysUntil !== null) {
      if (daysUntil <= 3) urgencyIcon = '🔴';
      else if (daysUntil <= 7) urgencyIcon = '🟠';
      else if (daysUntil <= 14) urgencyIcon = '🟡';
    }
    
    lines.push(`${index + 1}. ${urgencyIcon} **${offer.offerCode || 'Offer'}** - ${offer.offerName || offer.title}`);
    lines.push(`   Type: ${offer.classification || offer.offerType} | Cabin: ${offer.roomType || 'N/A'}`);
    
    const perks: string[] = [];
    if (offer.freePlay) perks.push(`FP: $${offer.freePlay}`);
    if (offer.OBC) perks.push(`OBC: $${offer.OBC}`);
    if (perks.length > 0) lines.push(`   Perks: ${perks.join(' | ')}`);
    
    if (daysUntil !== null) {
      lines.push(`   Expires: ${daysUntil} days`);
    }
    lines.push('');
  });
  
  if (expiringCount > 0) {
    lines.push(`\n⚠️ **Action Required:** ${expiringCount} offer${expiringCount !== 1 ? 's' : ''} expiring within 7 days! Review them soon.`);
  }
  
  return lines.join('\n');
}

export interface RecommendationInput {
  limit?: number;
  prioritize?: 'points' | 'value' | 'urgency' | 'port';
  includeExpiring?: boolean;
}

export function executeRecommendations(input: RecommendationInput, context: AgentToolContext): string {
  console.log('[AgentTools] Recommendations input:', input);
  
  const bookedDates = new Set<string>();
  context.bookedCruises.forEach(cruise => {
    const sailDate = createDateFromString(cruise.sailDate);
    const returnDate = createDateFromString(cruise.returnDate);
    let currentDate = new Date(sailDate);
    while (currentDate <= returnDate) {
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const year = String(currentDate.getFullYear());
      bookedDates.add(`${month}-${day}-${year}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });
  
  const recommendations = getRecommendedCruises(
    context.cruises,
    context.bookedCruises,
    context.offers,
    {
      limit: input.limit || 10,
      excludeConflicts: true,
      bookedDates,
    }
  );
  
  if (recommendations.length === 0) {
    return 'No cruises available for recommendations. Try importing more cruise data.';
  }
  
  const summary = getRecommendationSummary(recommendations);
  
  const lines = [
    summary,
    '',
    '### Top Recommendations',
    '',
  ];
  
  recommendations.slice(0, input.limit || 10).forEach((rec, index) => {
    const seaDays = calculateSeaDays(rec.cruise);
    const isPreferred = isPreferredPort(rec.cruise.departurePort || '');
    
    let urgencyBadge = '';
    if (rec.urgencyLevel === 'critical') {
      urgencyBadge = '🚨 EXPIRING SOON: ';
    } else if (rec.urgencyLevel === 'high') {
      urgencyBadge = '⚠️ ';
    }
    
    lines.push(`**${index + 1}. ${urgencyBadge}${rec.cruise.shipName}**`);
    lines.push(`   📍 ${rec.cruise.destination || rec.cruise.itineraryName} from ${rec.cruise.departurePort}${isPreferred ? ' ⭐' : ''}`);
    lines.push(`   📅 ${formatDate(rec.cruise.sailDate, 'medium')} • ${rec.cruise.nights} nights`);
    lines.push(`   🎲 ${seaDays} casino/sea days (${Math.round(seaDays / (rec.cruise.nights || 1) * 100)}% of cruise)`);
    if (rec.cruise.cabinType) {
      lines.push(`   🛏️ ${rec.cruise.cabinType}`);
    }
    lines.push(`   🎯 Score: ${rec.totalScore.toFixed(0)}/100`);
    
    if (rec.reasons.length > 0) {
      lines.push(`   ✨ ${rec.reasons[0]}`);
    }
    
    if (rec.expiryDays !== undefined && rec.expiryDays <= 14) {
      lines.push(`   ⏰ Offer expires in ${rec.expiryDays} days`);
    }
    
    lines.push('');
  });
  
  lines.push('---');
  lines.push('**Scoring factors:** Points potential (25%) | Value (25%) | Urgency (20%) | Port preference (12%) | Cabin (8%) | 2-person (5%) | Sea days (5%)');
  lines.push('');
  lines.push('*⭐ = Preferred port (West Coast, Galveston)*');
  
  return lines.join('\n');
}

export interface SlotMachineSearchInput {
  query?: string;
  manufacturer?: string;
  persistenceType?: 'True' | 'Pseudo' | 'None';
  hasMustHitBy?: boolean;
  shipName?: string;
  limit?: number;
}

export interface SlotMachineAPInput {
  machineId?: string;
  includeConditions?: boolean;
  includeBankroll?: boolean;
}

export interface MachineRecommendationInput {
  cruiseId?: string;
  shipName?: string;
  prioritize?: 'ap-potential' | 'win-rate' | 'points-per-hour' | 'volatility';
  maxVolatility?: 'Medium' | 'Medium-High' | 'High' | 'Very High';
  onlyAPMachines?: boolean;
  limit?: number;
}

export function executeSlotMachineSearch(input: SlotMachineSearchInput, context: AgentToolContext): string {
  console.log('[AgentTools] Slot machine search input:', input);
  
  const machines = context.slotMachines || [];
  let results = [...machines];
  
  if (input.query) {
    const query = input.query.toLowerCase();
    results = results.filter(m => 
      m.machineName?.toLowerCase().includes(query) ||
      m.manufacturer?.toLowerCase().includes(query) ||
      m.gameSeries?.toLowerCase().includes(query) ||
      m.theme?.toLowerCase().includes(query)
    );
  }
  
  if (input.manufacturer) {
    results = results.filter(m => m.manufacturer === input.manufacturer);
  }
  
  if (input.persistenceType) {
    results = results.filter(m => m.apMetadata?.persistenceType === input.persistenceType);
  }
  
  if (input.hasMustHitBy !== undefined) {
    results = results.filter(m => m.apMetadata?.hasMustHitBy === input.hasMustHitBy);
  }
  
  if (input.shipName) {
    const mappings = context.deckMappings || [];
    const machineIdsOnShip = new Set(
      mappings
        .filter(m => m.shipName === input.shipName && m.isActive)
        .map(m => m.machineId)
    );
    results = results.filter(m => machineIdsOnShip.has(m.id));
  }
  
  const limit = input.limit || 10;
  results = results.slice(0, limit);
  
  if (results.length === 0) {
    return 'No slot machines found matching your criteria.';
  }
  
  const lines = [`Found ${results.length} slot machine${results.length !== 1 ? 's' : ''}:\n`];
  
  results.forEach((machine, index) => {
    lines.push(`${index + 1}. **${machine.machineName}** - ${machine.manufacturer}`);
    lines.push(`   Series: ${machine.gameSeries || 'N/A'}`);
    lines.push(`   Volatility: ${machine.volatility}`);
    
    if (machine.apMetadata) {
      lines.push(`   🎯 Persistence: ${machine.apMetadata.persistenceType}`);
      if (machine.apMetadata.hasMustHitBy) {
        lines.push(`   💎 Must-Hit-By: Yes`);
      }
      if (machine.apMetadata.expectedAPReturn) {
        lines.push(`   💰 Expected AP Return: ${machine.apMetadata.expectedAPReturn}`);
      }
    }
    
    if (input.shipName && context.deckMappings) {
      const mapping = context.deckMappings.find(
        m => m.machineId === machine.id && m.shipName === input.shipName && m.isActive
      );
      if (mapping) {
        lines.push(`   📍 Location: ${mapping.deckName} - ${mapping.zoneName} - Slot #${mapping.slotNumber}`);
      }
    }
    
    lines.push('');
  });
  
  return lines.join('\n');
}

export function executeSlotMachineAPAnalysis(input: SlotMachineAPInput, context: AgentToolContext): string {
  console.log('[AgentTools] Slot machine AP analysis input:', input);
  
  const machines = context.slotMachines || [];
  
  if (input.machineId) {
    const machine = machines.find(m => m.id === input.machineId);
    if (!machine) {
      return `Machine with ID ${input.machineId} not found.`;
    }
    
    const lines = [
      `## AP Analysis: ${machine.machineName}`,
      `**Manufacturer:** ${machine.manufacturer}`,
      `**Series:** ${machine.gameSeries || 'N/A'}`,
      `**Volatility:** ${machine.volatility}`,
      '',
    ];
    
    if (!machine.apMetadata) {
      lines.push('⚠️ **No AP data available for this machine.**');
      return lines.join('\n');
    }
    
    lines.push('### AP Characteristics');
    lines.push(`• Persistence Type: ${machine.apMetadata.persistenceType}`);
    lines.push(`• Must-Hit-By: ${machine.apMetadata.hasMustHitBy ? 'Yes' : 'No'}`);
    
    if (machine.apMetadata.bonusVolatility) {
      lines.push(`• Bonus Volatility: ${machine.apMetadata.bonusVolatility}`);
    }
    
    if (machine.apMetadata.expectedAPReturn) {
      lines.push(`• Expected AP Return: ${machine.apMetadata.expectedAPReturn}`);
    }
    
    if (input.includeConditions && machine.apMetadata.entryConditions) {
      lines.push('');
      lines.push('### Entry Conditions');
      machine.apMetadata.entryConditions.forEach((condition: string) => {
        lines.push(`• ${condition}`);
      });
    }
    
    if (input.includeConditions && machine.apMetadata.exitConditions) {
      lines.push('');
      lines.push('### Exit Conditions');
      machine.apMetadata.exitConditions.forEach((condition: string) => {
        lines.push(`• ${condition}`);
      });
    }
    
    if (input.includeBankroll && machine.apMetadata.recommendedBankroll) {
      lines.push('');
      lines.push('### Recommended Bankroll');
      lines.push(`• Min: ${machine.apMetadata.recommendedBankroll.min}`);
      lines.push(`• Max: ${machine.apMetadata.recommendedBankroll.max}`);
    }
    
    if (machine.apMetadata.mhbThresholds) {
      lines.push('');
      lines.push('### Must-Hit-By Thresholds');
      if (machine.apMetadata.mhbThresholds.minor) lines.push(`• Minor: ${machine.apMetadata.mhbThresholds.minor}`);
      if (machine.apMetadata.mhbThresholds.major) lines.push(`• Major: ${machine.apMetadata.mhbThresholds.major}`);
      if (machine.apMetadata.mhbThresholds.grand) lines.push(`• Grand: ${machine.apMetadata.mhbThresholds.grand}`);
      if (machine.apMetadata.mhbThresholds.mega) lines.push(`• Mega: ${machine.apMetadata.mhbThresholds.mega}`);
    }
    
    if (machine.apMetadata.resetValues) {
      lines.push('');
      lines.push('### Reset Values');
      if (machine.apMetadata.resetValues.minor) lines.push(`• Minor: ${machine.apMetadata.resetValues.minor}`);
      if (machine.apMetadata.resetValues.major) lines.push(`• Major: ${machine.apMetadata.resetValues.major}`);
      if (machine.apMetadata.resetValues.grand) lines.push(`• Grand: ${machine.apMetadata.resetValues.grand}`);
      if (machine.apMetadata.resetValues.mega) lines.push(`• Mega: ${machine.apMetadata.resetValues.mega}`);
    }
    
    if (machine.apMetadata.risks && machine.apMetadata.risks.length > 0) {
      lines.push('');
      lines.push('### Risks');
      machine.apMetadata.risks.forEach((risk: string) => {
        lines.push(`• ${risk}`);
      });
    }
    
    if (machine.apMetadata.notesAndTips) {
      lines.push('');
      lines.push('### Notes & Tips');
      lines.push(machine.apMetadata.notesAndTips);
    }
    
    return lines.join('\n');
  }
  
  const apMachines = machines.filter(m => 
    m.apMetadata && (m.apMetadata.persistenceType !== 'None' || m.apMetadata.hasMustHitBy)
  );
  
  const lines = [
    '## AP Machines Summary',
    '',
    `**Total AP Machines:** ${apMachines.length}`,
    '',
  ];
  
  const byPersistence = {
    'True': apMachines.filter(m => m.apMetadata?.persistenceType === 'True').length,
    'Pseudo': apMachines.filter(m => m.apMetadata?.persistenceType === 'Pseudo').length,
  };
  
  const withMHB = apMachines.filter(m => m.apMetadata?.hasMustHitBy).length;
  
  lines.push('### By Type');
  lines.push(`• True Persistence: ${byPersistence.True}`);
  lines.push(`• Pseudo Persistence: ${byPersistence.Pseudo}`);
  lines.push(`• Must-Hit-By: ${withMHB}`);
  lines.push('');
  lines.push('### Top AP Machines');
  
  apMachines.slice(0, 5).forEach((machine, index) => {
    lines.push(`${index + 1}. **${machine.machineName}** (${machine.apMetadata?.persistenceType}${machine.apMetadata?.hasMustHitBy ? ' + MHB' : ''})`);
  });
  
  return lines.join('\n');
}

export function executeMachineRecommendations(input: MachineRecommendationInput, context: AgentToolContext): string {
  console.log('[AgentTools] Machine recommendations input:', input);
  
  const machines = context.myAtlasMachines || context.slotMachines || [];
  const allMachines = context.globalLibrary || [];
  const sessionAnalytics = context.getSessionAnalytics ? context.getSessionAnalytics() : null;
  let targetShip = input.shipName;
  
  console.log('[AgentTools] Available data:', {
    myAtlasMachines: context.myAtlasMachines?.length || 0,
    globalLibrary: context.globalLibrary?.length || 0,
    slotMachines: context.slotMachines?.length || 0,
    sessions: context.casinoSessions?.length || 0,
    deckMappings: context.deckMappings?.length || 0,
  });
  
  if (input.cruiseId && !targetShip) {
    const cruise = context.bookedCruises.find(c => c.id === input.cruiseId) ||
                   context.cruises.find(c => c.id === input.cruiseId);
    if (cruise) {
      targetShip = cruise.shipName;
    }
  }
  
  if (!targetShip && machines.length === 0 && allMachines.length === 0) {
    return 'No slot machine data available. Please add machines to your Atlas first.';
  }
  
  if (!targetShip) {
    const lines = [
      '## Slot Machine Analysis',
      '',
      `**Total Machines in Atlas:** ${machines.length}`,
      `**Total Machines in Database:** ${allMachines.length}`,
      `**Casino Sessions Tracked:** ${context.casinoSessions?.length || 0}`,
      '',
    ];
    
    if (sessionAnalytics && sessionAnalytics.machinePerformance) {
      lines.push('### Top Performing Machines (By Your Sessions)');
      const topMachines = Object.values(sessionAnalytics.machinePerformance)
        .sort((a: any, b: any) => b.totalWinLoss - a.totalWinLoss)
        .slice(0, 5);
      
      topMachines.forEach((perf: any, index) => {
        lines.push(`${index + 1}. **${perf.machineName}**`);
        lines.push(`   • Win/Loss: ${perf.totalWinLoss.toLocaleString()} (avg: ${perf.avgWinLoss.toFixed(2)})`);
        lines.push(`   • Sessions: ${perf.sessions}`);
        lines.push(`   • Win Rate: ${perf.winRate.toFixed(1)}%`);
        lines.push(`   • Total Time: ${Math.round(perf.totalTimeMinutes / 60)} hours`);
        lines.push('');
      });
    }
    
    if (machines.length > 0) {
      lines.push('### Machines in Your Atlas');
      const apMachines = machines.filter((m: any) => 
        m.apMetadata && (m.apMetadata.persistenceType !== 'None' || m.apMetadata.hasMustHitBy)
      ).length;
      lines.push(`• Total: ${machines.length}`);
      lines.push(`• AP Machines: ${apMachines}`);
      lines.push('');
      lines.push('💡 **Tip:** Specify a ship name to get ship-specific recommendations.');
    }
    
    return lines.join('\n');
  }
  
  let availableMachines = [...machines, ...allMachines].filter((m, index, self) =>
    self.findIndex(t => t.id === m.id) === index
  );
  
  if (targetShip) {
    availableMachines = availableMachines.filter(m => 
      (m.shipSpecificNotes && m.shipSpecificNotes.some((note: any) => 
        note.shipName.toLowerCase().includes(targetShip!.toLowerCase())
      )) ||
      (context.deckMappings && context.deckMappings.some((mapping: any) => 
        mapping.machineId === m.id && mapping.shipName.toLowerCase().includes(targetShip!.toLowerCase())
      ))
    );
  }
  
  if (availableMachines.length === 0) {
    return `No machines found for ${targetShip}. The machine database may need to be updated.`;
  }
  
  if (input.onlyAPMachines) {
    availableMachines = availableMachines.filter(m => 
      m.apMetadata && (m.apMetadata.persistenceType !== 'None' || m.apMetadata.hasMustHitBy)
    );
  }
  
  if (input.maxVolatility) {
    const volatilityOrder = ['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High', 'Very High'];
    const maxIndex = volatilityOrder.indexOf(input.maxVolatility);
    availableMachines = availableMachines.filter(m => {
      const machineIndex = volatilityOrder.indexOf(m.volatility);
      return machineIndex <= maxIndex;
    });
  }
  
  interface ScoredMachine {
    machine: typeof machines[0];
    score: number;
    reasons: string[];
  }
  
  const scoredMachines: ScoredMachine[] = availableMachines.map(machine => {
    let score = 0;
    const reasons: string[] = [];
    
    const prioritize = input.prioritize || 'ap-potential';
    
    if (machine.apMetadata) {
      if (machine.apMetadata.persistenceType === 'True') {
        score += prioritize === 'ap-potential' ? 50 : 20;
        reasons.push('True persistence state');
      } else if (machine.apMetadata.persistenceType === 'Pseudo') {
        score += prioritize === 'ap-potential' ? 30 : 10;
        reasons.push('Pseudo-persistence');
      }
      
      if (machine.apMetadata.hasMustHitBy) {
        score += prioritize === 'ap-potential' ? 40 : 15;
        reasons.push('Must-hit-by progressives');
      }
      
      if (machine.apMetadata.expectedAPReturn && machine.apMetadata.expectedAPReturn > 0) {
        score += (machine.apMetadata.expectedAPReturn / 10) * (prioritize === 'ap-potential' ? 2 : 1);
        reasons.push(`${machine.apMetadata.expectedAPReturn}% expected return`);
      }
    }
    

    
    const volatilityScore: Record<string, number> = {
      'Low': 10,
      'Medium-Low': 8,
      'Medium': 6,
      'Medium-High': 4,
      'High': 2,
      'Very High': 1,
    };
    
    if (prioritize === 'volatility') {
      score += volatilityScore[machine.volatility] * 5;
      reasons.push(`${machine.volatility} volatility`);
    }
    
    if (machine.manufacturer === 'Aristocrat' || machine.manufacturer === 'Light & Wonder') {
      score += 10;
    }
    
    const shipNote = machine.shipSpecificNotes?.find((note: any) => 
      note.shipName.toLowerCase().includes(targetShip!.toLowerCase())
    );
    if (shipNote?.notes) {
      score += 5;
      if (shipNote.notes.toLowerCase().includes('entrance') || 
          shipNote.notes.toLowerCase().includes('bar')) {
        score += 8;
        reasons.push('Prime location on ship');
      }
    }
    
    if (context.getMachineAnalytics) {
      const machineStats = context.getMachineAnalytics(machine.id);
      if (machineStats) {
        const roiScore = Math.max(-50, Math.min(50, machineStats.roi));
        score += roiScore;
        
        if (machineStats.roi > 0) {
          reasons.push(`${machineStats.roi.toFixed(1)}% ROI (${machineStats.totalSessions} sessions)`);
        }
        
        if (machineStats.winRate > 60) {
          score += 20;
          reasons.push(`${machineStats.winRate.toFixed(1)}% win rate`);
        } else if (machineStats.winRate > 50) {
          score += 10;
        }
        
        if (machineStats.netWinLoss > 1000) {
          score += 15;
          reasons.push(`${machineStats.netWinLoss.toLocaleString()} total winnings`);
        }
      }
    }
    
    return { machine, score, reasons };
  });
  
  scoredMachines.sort((a, b) => b.score - a.score);
  
  const limit = input.limit || 5;
  const recommendations = scoredMachines.slice(0, limit);
  
  if (recommendations.length === 0) {
    return `No machines matching your criteria found on ${targetShip}.`;
  }
  
  const lines = [
    `## Slot Machine Recommendations for ${targetShip}`,
    '',
    `Found ${availableMachines.length} machine${availableMachines.length !== 1 ? 's' : ''} on this ship`,
    `Showing top ${recommendations.length} recommendation${recommendations.length !== 1 ? 's' : ''}`,
    '',
    '### Top Machines to Play',
    '',
  ];
  
  recommendations.forEach((rec, index) => {
    const machine = rec.machine;
    
    let apBadge = '';
    if (machine.apMetadata) {
      if (machine.apMetadata.persistenceType === 'True') {
        apBadge = '🎯 [TRUE AP] ';
      } else if (machine.apMetadata.hasMustHitBy) {
        apBadge = '💎 [MHB] ';
      } else if (machine.apMetadata.persistenceType === 'Pseudo') {
        apBadge = '⚡ [PSEUDO] ';
      }
    }
    
    lines.push(`**${index + 1}. ${apBadge}${machine.machineName}**`);
    lines.push(`   Manufacturer: ${machine.manufacturer} | Volatility: ${machine.volatility}`);
    
    if (machine.apMetadata) {
      if (machine.detailedProfile?.bestDenominationForAP) {
        lines.push(`   💰 Best Denom: ${machine.detailedProfile.bestDenominationForAP}`);
      }
      
      if (machine.detailedProfile?.apTriggers?.primary && machine.detailedProfile.apTriggers.primary.length > 0) {
        lines.push(`   ✅ Play When: ${machine.detailedProfile.apTriggers.primary[0]}`);
      }
      
      if (machine.detailedProfile?.walkAwayConditions?.conditions && machine.detailedProfile.walkAwayConditions.conditions.length > 0) {
        lines.push(`   ❌ Avoid: ${machine.detailedProfile.walkAwayConditions.conditions[0]}`);
      }
    }
    
    const shipNote = machine.shipSpecificNotes?.find((note: any) => 
      note.shipName.toLowerCase().includes(targetShip!.toLowerCase())
    );
    if (shipNote) {
      if (shipNote.deckLocation) {
        lines.push(`   📍 Location: ${shipNote.deckLocation}`);
      }
      if (shipNote.notes) {
        lines.push(`   📝 Note: ${shipNote.notes}`);
      }
    }
    
    if (rec.reasons.length > 0) {
      lines.push(`   🌟 Why: ${rec.reasons.slice(0, 2).join(', ')}`);
    }
    
    if (machine.detailedProfile?.simpleSummary) {
      const summary = machine.detailedProfile.simpleSummary;
      const truncated = summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
      lines.push(`   📖 ${truncated}`);
    }
    
    lines.push('');
  });
  
  const apCount = recommendations.filter(r => 
    r.machine.apMetadata && (r.machine.apMetadata.persistenceType !== 'None' || r.machine.apMetadata.hasMustHitBy)
  ).length;
  
  if (apCount > 0) {
    lines.push(`💡 **${apCount} of these machines have AP potential!**`);
    lines.push('Use the AP analysis tool to get detailed entry/exit conditions.');
  }
  
  if (sessionAnalytics && context.casinoSessions && context.casinoSessions.length > 0) {
    lines.push('');
    lines.push('### Your Session Stats');
    lines.push(`• Total Sessions: ${sessionAnalytics.totalSessions}`);
    lines.push(`• Net Win/Loss: ${sessionAnalytics.netWinLoss.toLocaleString()}`);
    lines.push(`• Win Rate: ${sessionAnalytics.winRate.toFixed(1)}%`);
    lines.push(`• Points/Hour: ${sessionAnalytics.pointsPerHour.toFixed(0)}`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('**Scoring factors:** Your session history & ROI, AP potential, persistence type, must-hit-by, win rate, ship location, manufacturer');
  lines.push('');
  lines.push(`**Data sources:** ${machines.length} Atlas machines, ${allMachines.length} database machines, ${context.casinoSessions?.length || 0} sessions`);
  
  return lines.join('\n');
}

export const AGENT_TOOL_DESCRIPTIONS = {
  searchCruises: 'Search for cruises based on various criteria like ship, destination, dates, price, and cabin type.',
  analyzeBooking: 'Analyze a specific cruise or all booked cruises. Provides ROI calculations, value breakdowns, and comparisons.',
  optimizePortfolio: 'Optimize cruise portfolio to achieve tier goals, maximize ROI, or stay within budget.',
  checkTierProgress: 'Calculate tier progress and projections. Shows current status and estimated timeline.',
  analyzeOffers: 'Analyze casino offers. Find expiring offers, compare values, and get recommendations.',
  getRecommendations: 'Get AI-powered cruise recommendations based on points potential, value, urgency, and port preferences.',
  searchSlotMachines: 'Search for slot machines by name, manufacturer, persistence type, or ship location.',
  analyzeSlotMachineAP: 'Get detailed AP (Advantage Play) analysis for slot machines including entry/exit conditions, bankroll requirements, and expected returns.',
  recommendMachines: 'Get personalized slot machine recommendations for a specific ship or cruise. Uses your session history, ROI data, win rates, AP potential, and machine locations to suggest the best machines to play.',
};
