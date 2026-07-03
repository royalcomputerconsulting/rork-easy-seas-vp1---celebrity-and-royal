import { getCertificateExpirationResult } from '../certificates/expiration';
import { buildCompletedCruiseCasinoValueRecords, isExtrapolatedCasinoSession } from '@/lib/cruise/completedCruiseHistory';
import { calculateCasinoStrengthRating, type CasinoStrengthRating } from '@/lib/casino/casinoStrengthRating';
import { estimateCoinInForPoints } from '@/lib/casino/pointsEarning';

export type EstimatedPlayerValueLabel = 'low' | 'developing' | 'strong' | 'premium' | 'elite' | 'unknown';

export type HostViewProfile = {
  userName: string;
  clubRoyaleTier: string;
  clubRoyalePoints: number;
  crownAnchorLevel: string;
  crownAnchorPoints: number;
  totalCruisesTracked: number;
  completedCruises: number;
  upcomingCruises: number;
  totalCasinoSessions: number;
  totalCoinIn: number;
  totalWinLoss: number;
  totalPointsEarned: number;
  avgPointsPerCruise: number;
  avgPointsPerCasinoDay: number;
  avgCoinInPerCruise: number;
  avgCoinInPerDay: number;
  avgBet: number;
  favoriteShips: string[];
  favoriteMachines: string[];
  estimatedPlayerValueLabel: EstimatedPlayerValueLabel;
  strengths: string[];
  risks: string[];
  hostTalkingPoints: string[];
  copySummary: string;
  casinoStrengthRating?: CasinoStrengthRating;
  completedCruiseRecordsTracked?: number;
  individualSessionsTracked?: number;
  extrapolatedSessionsTracked?: number;
};

function text(value: unknown, fallback = ''): string {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readPoints(item: any): number {
  return num(item?.pointsEarned ?? item?.casinoPoints ?? item?.points ?? item?.clubRoyalePoints ?? item?.tierCredits, 0);
}

function readWinLoss(item: any): number {
  return num(item?.winLoss ?? item?.netWinLoss ?? item?.netCasinoResult ?? item?.casinoWinLoss ?? item?.cashResult, 0);
}

function readCoinIn(item: any): number {
  const explicit = num(item?.cashCoinIn ?? item?.coinIn ?? item?.coin_in ?? item?.totalCoinIn, NaN);
  if (Number.isFinite(explicit)) return explicit;
  return estimateCoinInForPoints({ targetPoints: readPoints(item), brand: item?.brand ?? 'royal', gameCategory: item?.gameCategory ?? 'reel-slot' }).coinIn ?? 0;
}

function readAvgBet(item: any): number {
  return num(item?.avgBet ?? item?.averageBet ?? item?.bet ?? item?.denomination, 0);
}

function hasAnyField(item: any, fields: string[]): boolean {
  return Boolean(item && typeof item === 'object' && fields.some((field) => item[field] !== null && item[field] !== undefined && String(item[field]).trim() !== ''));
}

function shipName(item: any): string {
  return text(item?.shipName || item?.ship || item?.vesselName || item?.ship_name);
}

function machineName(item: any): string {
  return text(item?.machineName || item?.machine || item?.slotMachine || item?.gameName || item?.title || item?.name);
}

function topNames(names: string[], limit = 5): string[] {
  const counts = new Map<string, number>();
  names.filter(Boolean).forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

export function calculateFavoriteShips(cruises: any[], sessions?: any[]): string[] {
  return topNames([...(cruises ?? []).map(shipName), ...(sessions ?? []).map(shipName)], 5);
}

export function calculateFavoriteMachines(sessions: any[]): string[] {
  return topNames((sessions ?? []).map(machineName), 5);
}

export function estimatePlayerValueLabel(profile: Partial<HostViewProfile>): EstimatedPlayerValueLabel {
  const points = num(profile.totalPointsEarned, 0);
  const sessions = num(profile.totalCasinoSessions, 0);
  const cruises = num(profile.completedCruises, 0) + num(profile.upcomingCruises, 0);
  const tier = text(profile.clubRoyaleTier).toLowerCase();

  if (!points && !sessions && !cruises) return 'unknown';
  if (tier.includes('signature') || tier.includes('masters') || points >= 25000 || cruises >= 30) return 'elite';
  if (points >= 10000 || sessions >= 40 || cruises >= 15) return 'premium';
  if (points >= 3000 || sessions >= 15 || cruises >= 8) return 'strong';
  if (points >= 500 || sessions >= 3 || cruises >= 3) return 'developing';
  return 'low';
}

export function buildHostStrengths(profile: Partial<HostViewProfile>, input: any): string[] {
  const strengths: string[] = [];
  if (num(profile.totalCruisesTracked, 0) > 0) strengths.push('Player has consistent cruise activity tracked in EasySeas.');
  if (num(profile.upcomingCruises, 0) > 0) strengths.push('Player has upcoming sailings, making future offer placement useful.');
  if (num(profile.totalPointsEarned, 0) > 0) strengths.push('Player has casino point history that supports comp evaluation.');
  if (num(profile.totalCoinIn, 0) > 0) strengths.push('Player has measurable coin-in history.');
  if ((input?.offers ?? []).length > 0) strengths.push('Player responds to casino offer inventory and comp value.');
  if (!strengths.length) strengths.push('Profile can be built as more cruises, offers, and sessions are tracked.');
  return strengths;
}

export function buildHostRisks(profile: Partial<HostViewProfile>, input: any): string[] {
  const risks: string[] = [];
  const certificates = Array.isArray(input?.certificates) ? input.certificates : [];
  const expiringCount = certificates.filter((cert: any) => {
    const status = getCertificateExpirationResult(cert).status;
    return status === 'expires-today' || status === 'urgent' || status === 'expiring-soon' || status === 'expired';
  }).length;
  if (expiringCount > 0) risks.push('Some certificates are expired or expiring soon.');
  if (num(profile.totalCasinoSessions, 0) === 0) risks.push('Session history is incomplete, so average play value may be understated.');
  if (num((profile as any).extrapolatedSessionsTracked, 0) > 0) risks.push('Some sessions are extrapolated from cruise totals and should be treated as estimated, not exact session logs.');
  if (num(profile.completedCruises, 0) > 0 && num(profile.totalPointsEarned, 0) === 0) risks.push('Some completed cruises may be missing final casino closeout data.');
  if (num(profile.upcomingCruises, 0) > 0 && certificates.length === 0) risks.push('Upcoming cruises may not have certificates attached.');
  if (!risks.length) risks.push('No major host-view risks detected from the available local data.');
  return risks;
}

export function buildHostTalkingPoints(profile: Partial<HostViewProfile>, input: any): string[] {
  const points: string[] = [];
  points.push('Player has consistent Royal Caribbean cruise activity.');
  if (num(profile.upcomingCruises, 0) > 0) points.push('Player has multiple upcoming sailings, making future offer placement useful.');
  if (num(profile.totalCasinoSessions, 0) > 0 || num(profile.totalPointsEarned, 0) > 0) {
    points.push('Player has casino session and completed-cruise closeout history that supports meaningful comp evaluation.');
  }
  if (num((profile as any).individualSessionsTracked, 0) > 0 || num((profile as any).extrapolatedSessionsTracked, 0) > 0) {
    points.push(`Sessions tracked: ${num((profile as any).individualSessionsTracked, 0)} individual and ${num((profile as any).extrapolatedSessionsTracked, 0)} extrapolated.`);
  }
  if ((input?.offers ?? []).length > 0) points.push('Player responds well to balcony, suite, freeplay, and back-to-back value.');
  if ((profile.favoriteShips ?? []).length > 0) points.push(`Favorite ship pattern: ${(profile.favoriteShips ?? []).join(', ')}.`);
  return points;
}

export function buildCopyableHostSummary(profile: HostViewProfile): string {
  return [
    `${profile.userName} — Host View Summary`,
    `Club Royale: ${profile.clubRoyaleTier || 'Unknown'} (${profile.clubRoyalePoints} pts)`,
    `Crown & Anchor: ${profile.crownAnchorLevel || 'Unknown'} (${profile.crownAnchorPoints} pts)`,
    `Cruises tracked: ${profile.totalCruisesTracked} (${profile.completedCruises} completed, ${profile.upcomingCruises} upcoming)`,
    `Casino play: ${profile.totalPointsEarned} pts, $${Math.round(profile.totalCoinIn).toLocaleString()} coin-in, $${Math.round(profile.totalWinLoss).toLocaleString()} win/loss`,
    `Estimated player value: ${profile.estimatedPlayerValueLabel}`,
    profile.casinoStrengthRating ? `Casino Strength: ${profile.casinoStrengthRating.internalClassification} (${profile.casinoStrengthRating.strengthScore}/100)` : '',
    `Talking points: ${profile.hostTalkingPoints.join(' ')}`,
    `Watchouts: ${profile.risks.join(' ')}`,
  ].join('\n');
}

export function buildHostViewProfile(input: {
  userProfile?: any;
  bookedCruises?: any[];
  completedCruises?: any[];
  sessions?: any[];
  certificates?: any[];
  offers?: any[];
}): HostViewProfile {
  const userProfile = input.userProfile ?? {};
  const bookedCruises = Array.isArray(input.bookedCruises) ? input.bookedCruises : [];
  const completedCruises = Array.isArray(input.completedCruises) ? input.completedCruises : [];
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const allCruises = [...completedCruises, ...bookedCruises];
  const completedRecords = buildCompletedCruiseCasinoValueRecords({
    completedCruises,
    bookedCruises,
    sessions,
    includePastBooked: true,
  });
  const recordPoints = completedRecords.reduce((sum, record) => sum + num(record.pointsEarned, 0), 0);
  const recordCoinIn = completedRecords.reduce((sum, record) => sum + num(record.cashCoinIn, 0), 0);
  const recordWinLoss = completedRecords.reduce((sum, record) => sum + num(record.casinoWinLoss, 0), 0);
  // Completed cruise records are first-class casino/value records. Individual sessions and
  // extrapolated sessions are preserved for session analytics, but cruise closeout totals are
  // not double-counted when derived sessions came from the same cruise totals.
  const totalPointsEarned = recordPoints;
  const totalCoinIn = recordCoinIn;
  const totalWinLoss = recordWinLoss;
  const casinoDayCount = Math.max(1, sessions.length || completedRecords.reduce((sum, record) => sum + num(record.nights, 1), 0));
  const individualSessionsTracked = sessions.filter((session) => !isExtrapolatedCasinoSession(session)).length;
  const extrapolatedSessionsTracked = sessions.filter(isExtrapolatedCasinoSession).length;
  const avgBetValues = sessions.map(readAvgBet).filter((value) => value > 0);
  const avgBet = avgBetValues.length ? avgBetValues.reduce((sum, value) => sum + value, 0) / avgBetValues.length : 0;

  const partial: Partial<HostViewProfile> = {
    userName: text(userProfile.name || userProfile.fullName || userProfile.displayName, 'EasySeas Player'),
    clubRoyaleTier: text(userProfile.clubRoyaleTier || userProfile.casinoTier || userProfile.royalCasinoTier, 'Unknown'),
    clubRoyalePoints: num(userProfile.clubRoyalePoints || userProfile.casinoPoints || userProfile.tierCredits, 0),
    crownAnchorLevel: text(userProfile.crownAnchorLevel || userProfile.crownAndAnchorTier || userProfile.loyaltyTier, 'Unknown'),
    crownAnchorPoints: num(userProfile.crownAnchorPoints || userProfile.crownAndAnchorPoints || userProfile.loyaltyPoints, 0),
    totalCruisesTracked: allCruises.length,
    completedCruises: completedCruises.length,
    upcomingCruises: bookedCruises.length,
    totalCasinoSessions: sessions.length,
    totalCoinIn,
    totalWinLoss,
    totalPointsEarned,
    avgPointsPerCruise: completedCruises.length ? totalPointsEarned / completedCruises.length : 0,
    avgPointsPerCasinoDay: totalPointsEarned / casinoDayCount,
    avgCoinInPerCruise: completedCruises.length ? totalCoinIn / completedCruises.length : 0,
    avgCoinInPerDay: totalCoinIn / casinoDayCount,
    avgBet,
  };

  const favoriteShips = calculateFavoriteShips(allCruises, sessions);
  const favoriteMachines = calculateFavoriteMachines(sessions);
  const estimatedPlayerValueLabel = estimatePlayerValueLabel(partial);
  const casinoStrengthRating = calculateCasinoStrengthRating(input);
  const profileWithoutCopy = {
    userName: partial.userName ?? 'EasySeas Player',
    clubRoyaleTier: partial.clubRoyaleTier ?? 'Unknown',
    clubRoyalePoints: partial.clubRoyalePoints ?? 0,
    crownAnchorLevel: partial.crownAnchorLevel ?? 'Unknown',
    crownAnchorPoints: partial.crownAnchorPoints ?? 0,
    totalCruisesTracked: partial.totalCruisesTracked ?? 0,
    completedCruises: partial.completedCruises ?? 0,
    upcomingCruises: partial.upcomingCruises ?? 0,
    totalCasinoSessions: partial.totalCasinoSessions ?? 0,
    totalCoinIn: Math.round(partial.totalCoinIn ?? 0),
    totalWinLoss: Math.round(partial.totalWinLoss ?? 0),
    totalPointsEarned: Math.round(partial.totalPointsEarned ?? 0),
    avgPointsPerCruise: Math.round(partial.avgPointsPerCruise ?? 0),
    avgPointsPerCasinoDay: Math.round(partial.avgPointsPerCasinoDay ?? 0),
    avgCoinInPerCruise: Math.round(partial.avgCoinInPerCruise ?? 0),
    avgCoinInPerDay: Math.round(partial.avgCoinInPerDay ?? 0),
    avgBet: Number((partial.avgBet ?? 0).toFixed(2)),
    favoriteShips,
    favoriteMachines,
    estimatedPlayerValueLabel,
    strengths: [] as string[],
    risks: [] as string[],
    hostTalkingPoints: [] as string[],
    copySummary: '',
    casinoStrengthRating,
    completedCruiseRecordsTracked: completedRecords.length,
    individualSessionsTracked,
    extrapolatedSessionsTracked,
  };

  const completeProfile = {
    ...profileWithoutCopy,
    strengths: buildHostStrengths(profileWithoutCopy, input),
    risks: buildHostRisks(profileWithoutCopy, input),
    hostTalkingPoints: buildHostTalkingPoints(profileWithoutCopy, input),
  } as HostViewProfile;

  return {
    ...completeProfile,
    copySummary: buildCopyableHostSummary(completeProfile),
  };
}
