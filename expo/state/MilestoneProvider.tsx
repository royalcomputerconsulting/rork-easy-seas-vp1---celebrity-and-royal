import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useLoyalty } from './LoyaltyProvider';
import { useUser, type UserProfile } from './UserProvider';
import { useAuth } from './AuthProvider';
import { ALL_STORAGE_KEYS, getUserScopedKey } from '@/lib/storage/storageKeys';
import { getTierByPoints } from '@/constants/clubRoyaleTiers';
import { getLevelByNights } from '@/constants/crownAnchor';
import { getCelebrityCaptainsClubLevelByPoints } from '@/constants/celebrityCaptainsClub';
import {
  buildTierSnapshotKey,
  createEmptyMilestoneState,
  getAllMilestonePrograms,
  getTierRank,
  isWithinCelebrationWindow,
  type MilestoneEvent,
  type MilestoneProgram,
  type MilestoneStorageState,
} from '@/lib/milestones/loyaltyMilestones';

export interface ProfileTierBadge {
  program: MilestoneProgram;
  label: string;
  tier: string;
  color: string;
}

interface LiveLoyaltySnapshot {
  clubRoyaleTier: string;
  crownAnchorLevel: string;
  captainsClubTier: string | null;
  venetianSocietyTier: string | null;
}

interface MilestoneState {
  pendingCelebration: MilestoneEvent | null;
  dismissCelebration: () => void;
  getActiveBanner: (profileId: string | null | undefined) => MilestoneEvent | null;
  getProfileBadges: (profileId: string | null | undefined) => ProfileTierBadge[];
}

/**
 * Resolves a profile's current tier for a given loyalty program. For the
 * currently-active profile, Club Royale / Crown & Anchor / Captain's Club /
 * Venetian Society prefer the live, fully-computed loyalty state (which already
 * applies manual-entry priority and sync data). For any other linked profile
 * (or when no live value is available), the profile's own stored fields are
 * used so each traveler's badges reflect their own record.
 */
function resolveProfileTier(
  program: MilestoneProgram,
  profile: UserProfile,
  isActiveProfile: boolean,
  live: LiveLoyaltySnapshot,
): string | null {
  switch (program) {
    case 'clubRoyale':
      if (isActiveProfile && live.clubRoyaleTier) return live.clubRoyaleTier;
      return profile.clubRoyaleTier?.trim() || getTierByPoints(profile.clubRoyalePoints || 0);
    case 'crownAnchor':
      if (isActiveProfile && live.crownAnchorLevel) return live.crownAnchorLevel;
      return profile.crownAnchorLevel?.trim() || getLevelByNights(profile.loyaltyPoints || 0);
    case 'celebrityCaptainsClub': {
      if (isActiveProfile && live.captainsClubTier) return live.captainsClubTier;
      const points = profile.celebrityCaptainsClubPoints;
      return typeof points === 'number' && points > 0 ? getCelebrityCaptainsClubLevelByPoints(points) : null;
    }
    case 'celebrityBlueChip':
      return profile.celebrityBlueChipTier?.trim() || null;
    case 'silversea':
      if (isActiveProfile && live.venetianSocietyTier) return live.venetianSocietyTier;
      return profile.silverseaVenetianTier?.trim() || null;
    default:
      return null;
  }
}

export const [MilestoneProvider, useMilestones] = createContextHook((): MilestoneState => {
  const { authenticatedEmail } = useAuth();
  const { users, currentUser, isLoading: usersLoading } = useUser();
  const loyalty = useLoyalty();

  const storageKeyRef = useRef(getUserScopedKey(ALL_STORAGE_KEYS.MILESTONE_TIER_STATE, authenticatedEmail));
  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(ALL_STORAGE_KEYS.MILESTONE_TIER_STATE, authenticatedEmail);
  }, [authenticatedEmail]);

  const [milestoneState, setMilestoneState] = useState<MilestoneStorageState>(createEmptyMilestoneState());
  const hasLoadedRef = useRef(false);
  const loadedEmailRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    hasLoadedRef.current = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKeyRef.current);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<MilestoneStorageState>;
          setMilestoneState({
            version: parsed.version ?? 1,
            lastKnownTiers: parsed.lastKnownTiers ?? {},
            pendingCelebrations: Array.isArray(parsed.pendingCelebrations) ? parsed.pendingCelebrations : [],
            latestByProfile: parsed.latestByProfile ?? {},
          });
        } else {
          setMilestoneState(createEmptyMilestoneState());
        }
      } catch (error) {
        console.error('[MilestoneProvider] Failed to load milestone state:', error);
        setMilestoneState(createEmptyMilestoneState());
      } finally {
        if (!cancelled) {
          hasLoadedRef.current = true;
          loadedEmailRef.current = authenticatedEmail;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticatedEmail]);

  const persist = useCallback((next: MilestoneStorageState) => {
    AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(next)).catch((error) => {
      console.error('[MilestoneProvider] Failed to persist milestone state:', error);
    });
  }, []);

  const liveClubRoyaleTier = loyalty.clubRoyaleTier;
  const liveCrownAnchorLevel = loyalty.crownAnchorLevel;
  const liveCaptainsClubTier = loyalty.captainsClub?.tier ?? null;
  const liveVenetianSocietyTier = loyalty.venetianSociety?.tier ?? null;

  useEffect(() => {
    if (!hasLoadedRef.current || usersLoading || loyalty.isLoading) return;
    if (loadedEmailRef.current !== authenticatedEmail) return;

    const activeProfiles = users.filter((profile) => profile.active !== false);
    if (activeProfiles.length === 0) return;

    const live: LiveLoyaltySnapshot = {
      clubRoyaleTier: liveClubRoyaleTier,
      crownAnchorLevel: liveCrownAnchorLevel,
      captainsClubTier: liveCaptainsClubTier,
      venetianSocietyTier: liveVenetianSocietyTier,
    };

    let changed = false;
    const nextLastKnownTiers = { ...milestoneState.lastKnownTiers };
    const nextPending = [...milestoneState.pendingCelebrations];
    const nextLatestByProfile = { ...milestoneState.latestByProfile };
    const now = new Date().toISOString();

    for (const profile of activeProfiles) {
      const isActiveProfile = profile.id === currentUser?.id;
      const displayName = profile.displayName?.trim() || profile.name?.trim() || 'You';

      for (const programInfo of getAllMilestonePrograms()) {
        const tier = resolveProfileTier(programInfo.program, profile, isActiveProfile, live);
        if (!tier) continue;

        const rank = getTierRank(programInfo.program, tier);
        if (rank === null) continue;

        const snapshotKey = buildTierSnapshotKey(profile.id, programInfo.program);
        const previousTier = nextLastKnownTiers[snapshotKey];

        if (previousTier === undefined) {
          // First time we've ever seen this profile+program -- seed the baseline
          // silently. This is "current state discovery", not a real upgrade.
          nextLastKnownTiers[snapshotKey] = tier;
          changed = true;
          continue;
        }

        if (previousTier === tier) continue;

        const previousRank = getTierRank(programInfo.program, previousTier);
        nextLastKnownTiers[snapshotKey] = tier;
        changed = true;

        if (previousRank !== null && rank > previousRank) {
          const event: MilestoneEvent = {
            id: `${snapshotKey}::${now}`,
            profileId: profile.id,
            profileName: displayName,
            program: programInfo.program,
            tier,
            previousTier,
            achievedAt: now,
          };
          nextPending.push(event);
          nextLatestByProfile[profile.id] = event;
          console.log('[MilestoneProvider] Milestone reached:', event);
        }
      }
    }

    if (changed) {
      const next: MilestoneStorageState = {
        version: 1,
        lastKnownTiers: nextLastKnownTiers,
        pendingCelebrations: nextPending,
        latestByProfile: nextLatestByProfile,
      };
      setMilestoneState(next);
      persist(next);
    }
  }, [
    users,
    currentUser?.id,
    usersLoading,
    loyalty.isLoading,
    authenticatedEmail,
    liveClubRoyaleTier,
    liveCrownAnchorLevel,
    liveCaptainsClubTier,
    liveVenetianSocietyTier,
    milestoneState.lastKnownTiers,
    milestoneState.pendingCelebrations,
    milestoneState.latestByProfile,
    persist,
  ]);

  const dismissCelebration = useCallback(() => {
    setMilestoneState((prev) => {
      if (prev.pendingCelebrations.length === 0) return prev;
      const next: MilestoneStorageState = {
        ...prev,
        pendingCelebrations: prev.pendingCelebrations.slice(1),
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const getActiveBanner = useCallback((profileId: string | null | undefined): MilestoneEvent | null => {
    if (!profileId) return null;
    const latest = milestoneState.latestByProfile[profileId];
    if (!latest) return null;
    return isWithinCelebrationWindow(latest.achievedAt) ? latest : null;
  }, [milestoneState.latestByProfile]);

  const getProfileBadges = useCallback((profileId: string | null | undefined): ProfileTierBadge[] => {
    if (!profileId) return [];
    const profile = users.find((candidate) => candidate.id === profileId);
    if (!profile) return [];

    const isActiveProfile = profile.id === currentUser?.id;
    const live: LiveLoyaltySnapshot = {
      clubRoyaleTier: liveClubRoyaleTier,
      crownAnchorLevel: liveCrownAnchorLevel,
      captainsClubTier: liveCaptainsClubTier,
      venetianSocietyTier: liveVenetianSocietyTier,
    };

    return getAllMilestonePrograms().reduce<ProfileTierBadge[]>((badges, programInfo) => {
      const tier = resolveProfileTier(programInfo.program, profile, isActiveProfile, live);
      if (!tier || getTierRank(programInfo.program, tier) === null) return badges;
      badges.push({
        program: programInfo.program,
        label: programInfo.label,
        tier,
        color: programInfo.colorFor(tier),
      });
      return badges;
    }, []);
  }, [users, currentUser?.id, liveClubRoyaleTier, liveCrownAnchorLevel, liveCaptainsClubTier, liveVenetianSocietyTier]);

  const pendingCelebration = milestoneState.pendingCelebrations[0] ?? null;

  return useMemo(() => ({
    pendingCelebration,
    dismissCelebration,
    getActiveBanner,
    getProfileBadges,
  }), [pendingCelebration, dismissCelebration, getActiveBanner, getProfileBadges]);
});
