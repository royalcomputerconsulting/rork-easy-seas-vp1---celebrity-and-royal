import { TIER_ORDER as CLUB_ROYALE_TIER_ORDER, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { LEVEL_ORDER as CROWN_ANCHOR_LEVEL_ORDER, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { CELEBRITY_LEVEL_ORDER, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { CELEBRITY_TIER_ORDER as BLUE_CHIP_TIER_ORDER, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { SILVERSEA_TIER_ORDER, SILVERSEA_VENETIAN_TIERS } from '@/constants/silverseaVenetianSociety';

/**
 * Every loyalty program that participates in milestone-celebration detection.
 * Carnival is intentionally excluded -- that program is admin-only and hidden
 * from regular users.
 */
export type MilestoneProgram =
  | 'clubRoyale'
  | 'crownAnchor'
  | 'celebrityCaptainsClub'
  | 'celebrityBlueChip'
  | 'silversea';

export interface MilestoneProgramInfo {
  program: MilestoneProgram;
  label: string;
  order: string[];
  colorFor: (tier: string) => string;
}

const PROGRAM_REGISTRY: Record<MilestoneProgram, MilestoneProgramInfo> = {
  clubRoyale: {
    program: 'clubRoyale',
    label: 'Club Royale',
    order: CLUB_ROYALE_TIER_ORDER,
    colorFor: (tier) => CLUB_ROYALE_TIERS[tier]?.color ?? '#6B7280',
  },
  crownAnchor: {
    program: 'crownAnchor',
    label: 'Crown & Anchor',
    order: CROWN_ANCHOR_LEVEL_ORDER,
    colorFor: (tier) => CROWN_ANCHOR_LEVELS[tier]?.color ?? '#6B7280',
  },
  celebrityCaptainsClub: {
    program: 'celebrityCaptainsClub',
    label: "Captain's Club",
    order: CELEBRITY_LEVEL_ORDER,
    colorFor: (tier) => CELEBRITY_CAPTAINS_CLUB_LEVELS[tier]?.color ?? '#6B7280',
  },
  celebrityBlueChip: {
    program: 'celebrityBlueChip',
    label: 'Blue Chip Club',
    order: BLUE_CHIP_TIER_ORDER,
    colorFor: (tier) => CELEBRITY_BLUE_CHIP_TIERS[tier]?.color ?? '#6B7280',
  },
  silversea: {
    program: 'silversea',
    label: 'Venetian Society',
    order: SILVERSEA_TIER_ORDER,
    colorFor: (tier) => SILVERSEA_VENETIAN_TIERS[tier]?.color ?? '#6B7280',
  },
};

export function getMilestoneProgramInfo(program: MilestoneProgram): MilestoneProgramInfo {
  return PROGRAM_REGISTRY[program];
}

export function getAllMilestonePrograms(): MilestoneProgramInfo[] {
  return Object.values(PROGRAM_REGISTRY);
}

/** Returns the rank (index) of a tier name within its program's order, or null if unrecognized. */
export function getTierRank(program: MilestoneProgram, tierName: string | null | undefined): number | null {
  if (!tierName) return null;
  const order = PROGRAM_REGISTRY[program].order;
  const index = order.indexOf(tierName);
  return index === -1 ? null : index;
}

export function getTierColor(program: MilestoneProgram, tierName: string | null | undefined): string {
  if (!tierName) return '#6B7280';
  return PROGRAM_REGISTRY[program].colorFor(tierName);
}

export function getProgramLabel(program: MilestoneProgram): string {
  return PROGRAM_REGISTRY[program].label;
}

/** A single stored "you leveled up" event, queued for a one-time celebration. */
export interface MilestoneEvent {
  id: string;
  profileId: string;
  profileName: string;
  program: MilestoneProgram;
  tier: string;
  previousTier: string | null;
  achievedAt: string;
}

/** Per-profile, per-program last-known tier snapshot, persisted to storage. */
export type MilestoneTierSnapshot = Record<string, string>;

export interface MilestoneStorageState {
  version: number;
  /** key: `${profileId}::${program}` -> last known tier name */
  lastKnownTiers: MilestoneTierSnapshot;
  /** Milestones the user hasn't seen the full-screen celebration for yet. */
  pendingCelebrations: MilestoneEvent[];
  /** Most recent milestone per profile, used to drive the 3-day banner/logo window. */
  latestByProfile: Record<string, MilestoneEvent>;
}

export function createEmptyMilestoneState(): MilestoneStorageState {
  return {
    version: 1,
    lastKnownTiers: {},
    pendingCelebrations: [],
    latestByProfile: {},
  };
}

export function buildTierSnapshotKey(profileId: string, program: MilestoneProgram): string {
  return `${profileId}::${program}`;
}

export const MILESTONE_BANNER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function isWithinCelebrationWindow(achievedAt: string, now: number = Date.now()): boolean {
  const achievedTime = new Date(achievedAt).getTime();
  if (!Number.isFinite(achievedTime)) return false;
  return now - achievedTime < MILESTONE_BANNER_WINDOW_MS;
}
