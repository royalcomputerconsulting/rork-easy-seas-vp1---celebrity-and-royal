import type { Cruise, BookedCruise, CasinoOffer } from '@/types/models';
import { getDaysUntil, createDateFromString, isDateInPast } from '@/lib/date';
import { calculateCruiseValue } from '@/lib/valueCalculator';

export interface RecommendationScore {
  cruise: Cruise;
  totalScore: number;
  breakdown: {
    pointsPotential: number;
    valueScore: number;
    urgencyScore: number;
    portPreference: number;
    seaDaysBonus: number;
    cabinValueScore: number;
    guestEfficiency: number;
  };
  reasons: string[];
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  expiryDays?: number;
}

export interface RecommendationConfig {
  preferredPorts: string[];
  avoidedPorts: string[];
  minSeaDays?: number;
  preferTransatlantic?: boolean;
  maxBudget?: number;
  preferredCabinTypes?: string[];
}

const PREFERRED_PORTS = [
  'los angeles',
  'long beach',
  'san diego',
  'san francisco',
  'seattle',
  'vancouver',
  'galveston',
  'new orleans',
  'san pedro',
  'ensenada',
];

const EAST_COAST_PORTS = [
  'miami',
  'fort lauderdale',
  'port canaveral',
  'orlando',
  'tampa',
  'jacksonville',
  'charleston',
  'baltimore',
  'new york',
  'bayonne',
  'boston',
  'cape liberty',
];

const CABIN_VALUE_RANK: Record<string, number> = {
  'penthouse suite': 100,
  'royal suite': 95,
  "owner's suite 2br": 90,
  'grand suite 2br': 85,
  "owner's suite": 80,
  'grand suite': 75,
  'junior suite': 70,
  'suite gty': 65,
  'suite': 65,
  'balcony': 50,
  'balcony gty': 45,
  'oceanview': 35,
  'oceanview gty': 30,
  'interior': 20,
  'interior gty': 15,
};

export function calculateSeaDays(cruise: Cruise): number {
  if (cruise.seaDays !== undefined) {
    return cruise.seaDays;
  }
  
  if (cruise.casinoOpenDays !== undefined) {
    return cruise.casinoOpenDays;
  }
  
  if (cruise.itinerary && cruise.itinerary.length > 0) {
    return cruise.itinerary.filter(day => day.isSeaDay).length;
  }
  
  const destination = (cruise.destination || cruise.itineraryName || '').toLowerCase();
  const nights = cruise.nights || 0;
  
  if (destination.includes('transatlantic') || destination.includes('atlantic crossing')) {
    return Math.ceil(nights * 0.7);
  }
  
  if (destination.includes('repositioning') || destination.includes('transpacific')) {
    return Math.ceil(nights * 0.65);
  }
  
  if (destination.includes('hawaii') || destination.includes('alaska')) {
    return Math.ceil(nights * 0.35);
  }
  
  if (destination.includes('caribbean') || destination.includes('bahamas')) {
    return Math.ceil(nights * 0.3);
  }
  
  if (destination.includes('europe') || destination.includes('mediterranean')) {
    return Math.ceil(nights * 0.25);
  }
  
  return Math.ceil(nights * 0.3);
}

export function isPreferredPort(port: string): boolean {
  const normalizedPort = (port || '').toLowerCase().trim();
  return PREFERRED_PORTS.some(p => normalizedPort.includes(p));
}

export function isEastCoastPort(port: string): boolean {
  const normalizedPort = (port || '').toLowerCase().trim();
  return EAST_COAST_PORTS.some(p => normalizedPort.includes(p));
}

export function getCabinValueScore(cabinType: string): number {
  const normalized = (cabinType || '').toLowerCase().trim();
  
  for (const [type, score] of Object.entries(CABIN_VALUE_RANK)) {
    if (normalized.includes(type) || type.includes(normalized)) {
      return score;
    }
  }
  
  return 40;
}

export function getGuestEfficiencyScore(cruise: Cruise): number {
  const guests = cruise.guests || 2;
  
  if (guests === 2) return 100;
  if (guests === 1) return 50;
  if (guests === 3) return 75;
  if (guests >= 4) return 60;
  
  return 70;
}

export function calculatePointsPotential(cruise: Cruise): number {
  const seaDays = calculateSeaDays(cruise);
  const nights = cruise.nights || 0;
  
  let score = 0;
  
  score += seaDays * 15;
  
  if (seaDays >= 5) {
    score += 30;
  }
  
  const seaDayRatio = nights > 0 ? seaDays / nights : 0;
  if (seaDayRatio >= 0.5) {
    score += 25;
  } else if (seaDayRatio >= 0.35) {
    score += 15;
  }
  
  const destination = (cruise.destination || cruise.itineraryName || '').toLowerCase();
  if (destination.includes('transatlantic') || destination.includes('repositioning')) {
    score += 40;
  }
  
  return Math.min(score, 100);
}

export function calculateValueScore(cruise: Cruise): number {
  const valueBreakdown = calculateCruiseValue(cruise);
  let score = 0;
  
  const totalValue = valueBreakdown.totalRetailValue + valueBreakdown.freePlayValue + valueBreakdown.obcValue;
  
  if (totalValue >= 10000) score += 50;
  else if (totalValue >= 5000) score += 40;
  else if (totalValue >= 3000) score += 30;
  else if (totalValue >= 1500) score += 20;
  else score += 10;
  
  if (valueBreakdown.freePlayValue > 0) {
    score += Math.min(valueBreakdown.freePlayValue / 100, 20);
  }
  
  if (valueBreakdown.obcValue > 0) {
    score += Math.min(valueBreakdown.obcValue / 50, 15);
  }
  
  if (cruise.tradeInValue && cruise.tradeInValue > 0) {
    score += Math.min(cruise.tradeInValue / 100, 15);
  }
  
  return Math.min(score, 100);
}

export function calculateUrgencyScore(cruise: Cruise, offers: CasinoOffer[]): { score: number; expiryDays?: number; level: 'critical' | 'high' | 'medium' | 'low' } {
  let expiryDays: number | undefined;
  
  if (cruise.offerExpiry) {
    expiryDays = getDaysUntil(cruise.offerExpiry);
  } else if (cruise.offerCode) {
    const matchingOffer = offers.find(o => o.offerCode === cruise.offerCode);
    if (matchingOffer) {
      const expiry = matchingOffer.expires || matchingOffer.expiryDate;
      if (expiry) {
        expiryDays = getDaysUntil(expiry);
      }
    }
  }
  
  if (expiryDays === undefined || expiryDays < 0) {
    return { score: 10, level: 'low' };
  }
  
  if (expiryDays <= 3) {
    return { score: 100, expiryDays, level: 'critical' };
  }
  if (expiryDays <= 7) {
    return { score: 80, expiryDays, level: 'high' };
  }
  if (expiryDays <= 14) {
    return { score: 60, expiryDays, level: 'medium' };
  }
  if (expiryDays <= 30) {
    return { score: 40, expiryDays, level: 'medium' };
  }
  
  return { score: 20, expiryDays, level: 'low' };
}

export function calculatePortPreferenceScore(cruise: Cruise): number {
  // All ports are valid - no preference given to specific ports
  // Any departure port is equally acceptable
  return 100;
}

export function scoreCruiseForRecommendation(
  cruise: Cruise,
  offers: CasinoOffer[],
  config?: RecommendationConfig
): RecommendationScore {
  const reasons: string[] = [];
  
  const pointsPotential = calculatePointsPotential(cruise);
  const seaDays = calculateSeaDays(cruise);
  if (pointsPotential >= 60) {
    reasons.push(`High points potential (${seaDays} casino days)`);
  }
  
  const valueScore = calculateValueScore(cruise);
  const valueBreakdown = calculateCruiseValue(cruise);
  if (valueScore >= 50) {
    reasons.push(`Great value ($${valueBreakdown.totalRetailValue.toLocaleString()} retail)`);
  }
  
  const urgency = calculateUrgencyScore(cruise, offers);
  if (urgency.expiryDays !== undefined && urgency.expiryDays <= 14) {
    reasons.push(`Offer expires in ${urgency.expiryDays} days!`);
  }
  
  const portPreference = calculatePortPreferenceScore(cruise);
  if (portPreference >= 80) {
    reasons.push(`Preferred port: ${cruise.departurePort}`);
  }
  
  const cabinValueScore = getCabinValueScore(cruise.cabinType || '');
  if (cabinValueScore >= 50) {
    reasons.push(`${cruise.cabinType || 'Balcony'} cabin included`);
  }
  
  const guestEfficiency = getGuestEfficiencyScore(cruise);
  if (guestEfficiency >= 90) {
    reasons.push('2-person offer (best value)');
  }
  
  const seaDaysBonus = seaDays >= 5 ? 20 : seaDays >= 3 ? 10 : 0;
  
  const weights = {
    pointsPotential: 0.25,
    valueScore: 0.25,
    urgencyScore: 0.20,
    portPreference: 0.12,
    cabinValueScore: 0.08,
    guestEfficiency: 0.05,
    seaDaysBonus: 0.05,
  };
  
  const totalScore = 
    pointsPotential * weights.pointsPotential +
    valueScore * weights.valueScore +
    urgency.score * weights.urgencyScore +
    portPreference * weights.portPreference +
    cabinValueScore * weights.cabinValueScore +
    guestEfficiency * weights.guestEfficiency +
    seaDaysBonus * weights.seaDaysBonus;
  
  const destination = (cruise.destination || cruise.itineraryName || '').toLowerCase();
  if (destination.includes('transatlantic')) {
    reasons.unshift('⭐ Transatlantic crossing - maximum casino time');
  }
  
  return {
    cruise,
    totalScore,
    breakdown: {
      pointsPotential,
      valueScore,
      urgencyScore: urgency.score,
      portPreference,
      seaDaysBonus,
      cabinValueScore,
      guestEfficiency,
    },
    reasons,
    urgencyLevel: urgency.level,
    expiryDays: urgency.expiryDays,
  };
}

export function getRecommendedCruises(
  cruises: Cruise[],
  bookedCruises: BookedCruise[],
  offers: CasinoOffer[],
  options?: {
    limit?: number;
    config?: RecommendationConfig;
    excludeConflicts?: boolean;
    bookedDates?: Set<string>;
  }
): RecommendationScore[] {
  const { limit = 15, config, excludeConflicts = true, bookedDates } = options || {};
  
  const bookedIds = new Set(bookedCruises.map(b => b.id));
  
  let availableCruises = cruises.filter(c => 
    !isDateInPast(c.sailDate) && 
    !bookedIds.has(c.id)
  );
  
  if (excludeConflicts && bookedDates && bookedDates.size > 0) {
    availableCruises = availableCruises.filter(cruise => {
      const sailDate = createDateFromString(cruise.sailDate);
      const returnDate = createDateFromString(cruise.returnDate);
      let currentDate = new Date(sailDate);
      while (currentDate <= returnDate) {
        if (bookedDates.has(currentDate.toISOString().split('T')[0])) {
          return false;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return true;
    });
  }
  
  console.log(`[RecommendationEngine] Scoring ${availableCruises.length} available cruises`);
  
  const scoredCruises = availableCruises.map(cruise => 
    scoreCruiseForRecommendation(cruise, offers, config)
  );
  
  scoredCruises.sort((a, b) => {
    if (a.urgencyLevel === 'critical' && b.urgencyLevel !== 'critical') return -1;
    if (b.urgencyLevel === 'critical' && a.urgencyLevel !== 'critical') return 1;
    
    if (a.urgencyLevel === 'high' && b.urgencyLevel === 'low') return -1;
    if (b.urgencyLevel === 'high' && a.urgencyLevel === 'low') return 1;
    
    return b.totalScore - a.totalScore;
  });
  
  const topRecommendations = scoredCruises.slice(0, limit);
  
  console.log('[RecommendationEngine] Top recommendations:', topRecommendations.map(r => ({
    ship: r.cruise.shipName,
    destination: r.cruise.destination,
    score: r.totalScore.toFixed(1),
    urgency: r.urgencyLevel,
    reasons: r.reasons.slice(0, 2),
  })));
  
  return topRecommendations;
}

export function formatRecommendationForAgent(recommendation: RecommendationScore): string {
  const { cruise, totalScore, breakdown, reasons, urgencyLevel, expiryDays } = recommendation;
  
  const lines = [
    `**${cruise.shipName}** - ${cruise.destination || cruise.itineraryName}`,
    `📅 ${cruise.sailDate} • ${cruise.nights} nights from ${cruise.departurePort}`,
    `🎯 Score: ${totalScore.toFixed(0)}/100`,
  ];
  
  if (urgencyLevel === 'critical') {
    lines.push(`🚨 URGENT: Expires in ${expiryDays} days!`);
  } else if (urgencyLevel === 'high') {
    lines.push(`⚠️ Expiring soon: ${expiryDays} days`);
  }
  
  const seaDays = calculateSeaDays(cruise);
  lines.push(`🎲 ${seaDays} casino/sea days (${Math.round(seaDays / cruise.nights * 100)}% of cruise)`);
  
  if (cruise.cabinType) {
    lines.push(`🛏️ ${cruise.cabinType}`);
  }
  
  if (reasons.length > 0) {
    lines.push('');
    lines.push('**Why recommended:**');
    reasons.forEach(reason => {
      lines.push(`• ${reason}`);
    });
  }
  
  lines.push('');
  lines.push(`Score breakdown: Points ${breakdown.pointsPotential.toFixed(0)} | Value ${breakdown.valueScore.toFixed(0)} | Port ${breakdown.portPreference.toFixed(0)}`);
  
  return lines.join('\n');
}

export function getRecommendationSummary(recommendations: RecommendationScore[]): string {
  if (recommendations.length === 0) {
    return 'No cruises available for recommendations.';
  }
  
  const criticalCount = recommendations.filter(r => r.urgencyLevel === 'critical').length;
  const highUrgencyCount = recommendations.filter(r => r.urgencyLevel === 'high').length;
  const preferredPortCount = recommendations.filter(r => r.breakdown.portPreference >= 80).length;
  const highValueCount = recommendations.filter(r => r.breakdown.valueScore >= 50).length;
  const transatlanticCount = recommendations.filter(r => 
    (r.cruise.destination || '').toLowerCase().includes('transatlantic')
  ).length;
  
  const lines = [
    `## Cruise Recommendations Summary`,
    `Found **${recommendations.length}** recommended cruises`,
    '',
  ];
  
  if (criticalCount > 0) {
    lines.push(`🚨 **${criticalCount}** offers expiring within 3 days!`);
  }
  if (highUrgencyCount > 0) {
    lines.push(`⚠️ **${highUrgencyCount}** offers expiring within 7 days`);
  }
  if (transatlanticCount > 0) {
    lines.push(`⭐ **${transatlanticCount}** transatlantic crossings available`);
  }
  if (preferredPortCount > 0) {
    lines.push(`🌊 **${preferredPortCount}** from West Coast/preferred ports`);
  }
  if (highValueCount > 0) {
    lines.push(`💎 **${highValueCount}** high-value cruises`);
  }
  
  return lines.join('\n');
}
