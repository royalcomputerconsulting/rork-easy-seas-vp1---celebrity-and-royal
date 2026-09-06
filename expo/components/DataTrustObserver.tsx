import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useUser } from '@/state/UserProvider';
import { scheduleIntegrityScan } from '@/lib/integrity/integrityCenter';
import { persistProvenanceSnapshot } from '@/lib/provenance/domainProvenance';
import { HIGH_VOLUME_DOMAINS, migrateAllHighVolumeDomains } from '@/lib/database/highVolumeMigration';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { useFinancials } from '@/state/FinancialsProvider';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { useSailingWeather } from '@/state/SailingWeatherProvider';
import { useExperience } from '@/state/ExperienceProvider';

function normalizeOwner(value: unknown): string { return String(value ?? '').trim().toLowerCase(); }
function belongsToActiveProfile(record: Record<string, unknown>, allowedOwners: Set<string>): boolean {
  const owner = normalizeOwner(record.ownerId ?? record.ownerProfileId ?? record.userId);
  return !owner || allowedOwners.has(owner);
}

export function DataTrustObserver() {
  const { authenticatedEmail } = useAuth(); const { currentUser } = useUser(); const core = useCoreData(); const { searchableCertificates } = useCertificates(); const loyalty = useLoyalty(); const financials = useFinancials(); const crew = useCrewRecognition(); const weather = useSailingWeather(); const experience = useExperience(); const ownerId = currentUser?.id || authenticatedEmail?.toLowerCase().trim() || 'local-default';
  useEffect(() => {
    // expo-sqlite requires cross-origin isolation on web. Keep the native
    // SQLite trust center authoritative while the web build uses its durable
    // storage compatibility path instead of crashing a worker at startup.
    if (Platform.OS === 'web') return undefined;
    return scheduleIntegrityScan(async () => {
    // Native CoreData intentionally keeps the multi-thousand-row available
    // catalog out of React state. Read the indexed authority cooperatively for
    // this background scan so provenance and relationship checks never see an
    // artificial empty catalog after the SQLite cutover.
    const availableCruises = await core.getAllCruises();
    const allowedOwnerIds = [ownerId, currentUser?.id, currentUser?.email, authenticatedEmail].map(normalizeOwner).filter(Boolean);
    const allowedOwners = new Set(allowedOwnerIds);
    const profileCruises = (core.bookedCruises ?? []).filter((row) => belongsToActiveProfile(row as unknown as Record<string, unknown>, allowedOwners));
    const offerSailings = availableCruises.filter((row) => (row as any).offerId || (row as any).offerInstanceKey).map((row) => ({ id: row.id, offerId: (row as any).offerId ?? (row as any).offerInstanceKey, cruiseId: row.id }));
    const allCruises = [...profileCruises, ...availableCruises];
    const casino = profileCruises.map((row) => ({ ...(row as any), id: row.id, ownerId: (row as any).ownerProfileId ?? ownerId, points: (row as any).casinoPoints ?? (row as any).pointsEarned ?? 0, coinIn: (row as any).coinIn ?? 0 }));
    const loyaltyRecords = [
      { id: 'club-royale', program: 'Club Royale', tier: loyalty.clubRoyaleTier, points: loyalty.clubRoyalePoints, currentPoints: loyalty.clubRoyaleCurrentYearPoints, source: loyalty.clubRoyalePointsSource, syncedAt: currentUser?.clubRoyaleLastSyncAt, ownerId },
      { id: 'crown-anchor', program: 'Crown & Anchor', tier: loyalty.crownAnchorLevel, points: loyalty.crownAnchorPoints, source: currentUser?.clubRoyaleLastSyncAt ? 'provider sync' : 'saved profile', syncedAt: currentUser?.clubRoyaleLastSyncAt, ownerId },
      { id: 'blue-chip', program: 'Blue Chip Club', tier: loyalty.blueChip.tier, blueChipPoints: loyalty.blueChip.points, source: currentUser?.celebrityLastSyncAt ? 'provider sync' : 'saved profile', syncedAt: currentUser?.celebrityLastSyncAt, ownerId },
      { id: 'captains-club', program: "Captain's Club", tier: loyalty.captainsClub.tier, captainsClubPoints: loyalty.captainsClub.points, source: currentUser?.celebrityLastSyncAt ? 'provider sync' : 'saved profile', syncedAt: currentUser?.celebrityLastSyncAt, ownerId },
    ];
    const financialRecord = { id: 'financial-summary', ...financials.summary, paid: financials.summary.totalPaid, obc: financials.summary.totalOBC, freePlay: financials.summary.totalFreeplay, discountValue: financials.summary.totalSavings, source: 'derived calculation', calculationFormula: 'Summed from owner-scoped booked-cruise payments, receipts, OBC, FreePlay, and price evidence.', updatedAt: new Date().toISOString(), ownerId };
    const weatherRecords = weather.cachedForecasts.map((forecast) => ({ id: forecast.cacheKey, temperature: forecast.metrics.highTempF, windSpeed: forecast.metrics.maxWindMph, windDirection: forecast.metrics.dominantWindDirectionDegrees, waveHeight: forecast.metrics.maxWaveHeightFt, wavePeriod: forecast.metrics.maxWavePeriodSeconds, warning: forecast.advisories?.map((row) => row.title).join('; '), forecast: forecast.summary, source: `${forecast.weatherSourceLabel}; ${forecast.marineSourceLabel}`, provider: `${forecast.weatherSourceLabel}; ${forecast.marineSourceLabel}`, updatedAt: forecast.updatedAt }));
    const preferenceRecords = Object.entries(experience.preferences).map(([field, value]) => ({ id: `experience-${field}`, value, source: 'manual entry', updatedAt: new Date().toISOString(), ownerId }));
    const profileRecord = currentUser ? [{ ...(currentUser as any), id: currentUser.id, name: currentUser.displayName || currentUser.name, loyaltyNumber: currentUser.crownAnchorNumber, source: 'saved profile', ownerId }] : [];
    await persistProvenanceSnapshot({ cruise: allCruises as any[], offer: (core.casinoOffers ?? []) as any[], certificate: searchableCertificates as any[], casino, loyalty: loyaltyRecords as any[], financial: [financialRecord] as any[], weather: weatherRecords as any[], crew: crew.entries as any[], profile: profileRecord as any[], preference: preferenceRecords as any[] }, ownerId);
    return { ownerId, allowedOwnerIds, cruises: profileCruises as any[], catalogCruises: availableCruises as any[], offers: (core.casinoOffers ?? []) as any[], offerSailings, certificates: searchableCertificates as any[], casinoTotals: casino, loyalty: loyaltyRecords as any[] };
    }, () => {
      const key = `easyseas.healthTrust.lastScan.${encodeURIComponent(ownerId)}`;
      void SecureStore.setItemAsync(key, new Date().toISOString()).catch(() => undefined);
    });
  }, [core.bookedCruises, core.casinoOffers, core.getAllCruises, crew.entries, currentUser, experience.preferences, financials.summary, loyalty, ownerId, searchableCertificates, weather.cachedForecasts]);
  useEffect(() => {
    if (!authenticatedEmail || Platform.OS === 'web') return;
    // Existing cruise inventory is already SQLite-backed. Index every remaining
    // account/shared high-volume collection after startup settles. Profile-scoped
    // crew registries are discovered independently, in bounded batches.
    const timer = setTimeout(() => { void migrateAllHighVolumeDomains(authenticatedEmail.toLowerCase().trim(), undefined, HIGH_VOLUME_DOMAINS).catch((error) => console.warn('[DataTrust] Deferred local indexing will retry later:', error)); }, 4500);
    return () => clearTimeout(timer);
  }, [authenticatedEmail]);
  return null;
}
