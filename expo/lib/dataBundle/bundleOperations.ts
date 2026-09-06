import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { 
  Cruise, 
  CasinoOffer, 
  BookedCruise, 
  CalendarEvent, 
  ClubRoyaleProfile,
  MachineEncyclopediaEntry,
  CompItem,
  W2GRecord,
  SlotMachine,
  DeckPlanLocation,
} from '@/types/models';
import type { UserProfile } from '@/state/UserProvider';
import type { BankrollAlert, BankrollLimit } from '@/state/BankrollProvider';
import type { Certificate } from '@/components/CertificateManagerModal';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { CasinoOpenHoursData } from '@/components/ui/CasinoOpenHoursCard';
import type { RecognitionEntryWithCrew, Sailing } from '@/types/crew-recognition';
import type { ProvenanceLink } from '@/types/provenance';
import { ALL_STORAGE_KEYS, GLOBAL_KEYS, getUserScopedKey, type AppSettings } from '../storage/storageKeys';
import { quotaSafeGetItem, quotaSafeSetItem, quotaSafeSetJsonItem } from '../storage/quotaSafeStorage';
import {
  dedupeBookedCruises,
  dedupeCalendarEvents,
  dedupeCasinoOffers,
  dedupeByIdentity,
} from '../dataIdentity';
import { generateCruiseCalendarEvents } from '../calendar/cruiseEvents';
import { applyFoundationFields } from '../dataFoundation';
import { isKnownCasinoProfile } from '../knownProfileFallback';
import { normalizeCruisesWithCasinoEconomics } from '../casinoCruiseEconomics';
import { getBookedCruiseCasinoPoints, normalizeCruiseCasinoPerformance } from '../casinoPointTruth';
import { buildAskMyDataOverview, type AskMyDataOverview } from '../askMyDataOverview';
import { cruiseInventoryRepository } from '../cruiseInventory/CruiseInventoryRepository';
import { getCruiseInventoryOwnerScope } from '../cruiseInventory/cruiseCanonicalIdentity';
import {
  CERTIFICATE_DOCUMENT_STORE_KEY,
  PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY,
  type CertificateDocumentRecord,
} from '../certificates/certificateDocumentStore';
import { collapseOfferSailingRowsToOfferInstances } from '../offers/offerInstanceIdentity';
import { buildAgentSeaSourceManifest, type AgentSeaSourceManifest } from '../agentSea/sourceRegistry';
import { exportUserPreferenceStorage, restoreUserPreferenceStorage } from '../experience/experiencePreferences';
import {
  hydrateHighVolumeDomain,
  listHighVolumeDomain,
  listHighVolumeDomainByOwnerPrefix,
  replaceHighVolumeDomain,
} from '../database/highVolumeRepository';
import { listAllProvenanceLinks, storeProvenanceLinks } from '../database/HealthTrustDatabase';

const CURRENT_MACHINE_ENCYCLOPEDIA_KEY = 'easyseas_machine_encyclopedia_v2_262_only';
const CURRENT_MY_SLOT_ATLAS_KEY = 'easyseas_my_slot_atlas_v2_262_only';
const CASINO_OPEN_HOURS_STORAGE_PREFIX = `${ALL_STORAGE_KEYS.CASINO_OPEN_HOURS}_`;
const CREW_PROFILE_KEY_SEGMENT = '::profile::';
export const AGENT_SEA_SOURCE_MANIFEST_KEY = '@easyseas_agent_sea_source_manifest_v3';

async function embedRetainedCertificateBytesForBackup(
  documents: CertificateDocumentRecord[],
): Promise<CertificateDocumentRecord[]> {
  let fileSystem: {
    EncodingType?: { Base64?: string };
    readAsStringAsync?: (uri: string, options?: { encoding?: string }) => Promise<string>;
  } | null = null;
  try {
    fileSystem = require('expo-file-system/legacy');
  } catch {
    fileSystem = null;
  }

  const portable: CertificateDocumentRecord[] = [];
  // Sequential reads deliberately bound peak memory for a library containing
  // many large Royal PDFs. Save All may take longer, but navigation remains
  // responsive and every retained document becomes device-portable.
  for (const document of documents) {
    if (document.bytesBase64 || !document.provenance?.documentArchiveUri) {
      portable.push(document);
      continue;
    }
    if (typeof fileSystem?.readAsStringAsync !== 'function') throw new Error(`Certificate PDF ${document.id} cannot be embedded into this portable backup in the current runtime.`);
    try {
      const bytesBase64 = await fileSystem.readAsStringAsync(document.provenance.documentArchiveUri, {
        encoding: fileSystem.EncodingType?.Base64 ?? 'base64',
      });
      portable.push({ ...document, bytesBase64 });
    } catch (error) {
      throw new Error(`Certificate PDF ${document.id} could not be embedded into the portable backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return portable;
}

function getCrewProfileScopedBaseKey(baseKey: string, profileId: string): string {
  return `${baseKey}${CREW_PROFILE_KEY_SEGMENT}${profileId}`;
}

function normalizeImportKeyPart(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function dedupeByIdOrPayload<T extends object>(items: T[], label: string): T[] {
  return dedupeByIdentity(items, (item) => {
    const record = item as Record<string, unknown>;
    const id = normalizeImportKeyPart(record.id);
    return id ? `id:${id}` : `payload:${normalizeImportKeyPart(JSON.stringify(item))}`;
  }, label);
}

function normalizeBackupImportEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

export interface DataProfileGate {
  activeProfileId?: string | null;
  activeProfileEmail?: string | null;
  authenticatedEmail?: string | null;
}

interface ResolvedDataProfileGate {
  activeProfileId: string | null;
  activeProfileEmail: string | null;
  authenticatedEmail: string | null;
  hasGate: boolean;
}

function normalizeProfileId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveDataProfileGate(email: string | null | undefined, gate?: DataProfileGate): ResolvedDataProfileGate {
  const activeProfileId = normalizeProfileId(gate?.activeProfileId);
  // The account email selects the scoped storage namespace; it must not
  // silently become a profile filter. Full Save All / Load All intentionally
  // passes no active profile so every primary and secondary record survives.
  const activeProfileEmail = normalizeBackupImportEmail(gate?.activeProfileEmail);
  const authenticatedEmail = normalizeBackupImportEmail(gate?.authenticatedEmail) ?? normalizeBackupImportEmail(email);

  return {
    activeProfileId,
    activeProfileEmail,
    authenticatedEmail,
    hasGate: Boolean(activeProfileId || activeProfileEmail),
  };
}

function recordString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function recordEmail(value: unknown): string | null {
  return normalizeBackupImportEmail(recordString(value));
}

function userMatchesProfileGate(user: UserProfile, gate: ResolvedDataProfileGate): boolean {
  if (!gate.hasGate) return true;
  if (gate.activeProfileId && user.id === gate.activeProfileId) return true;

  const profileEmails = [user.email, user.celebrityEmail, user.silverseaEmail]
    .map((value) => normalizeBackupImportEmail(value))
    .filter((value): value is string => value !== null);

  return Boolean(gate.activeProfileEmail && profileEmails.includes(gate.activeProfileEmail));
}

function recordMatchesProfileGate(record: unknown, gate: ResolvedDataProfileGate, allowUnownedRecords: boolean): boolean {
  if (!gate.hasGate || !record || typeof record !== 'object') return true;

  const data = record as Record<string, unknown>;
  const ownerProfileId = recordString(data.ownerProfileId);
  const ownerProfileEmail = recordEmail(ownerProfileId);
  const ownerIds = [ownerProfileId].filter((value): value is string => value !== null && !value.includes('@'));
  const ownerEmails = [
    ownerProfileEmail,
    recordEmail(data.sourceEmail),
    recordEmail(data.dataOwnerEmail),
    recordEmail(data.ownerEmail),
    recordEmail(data.email),
    recordEmail(data.userId),
  ].filter((value): value is string => value !== null && value !== 'guest' && value !== 'local');
  const hasOwnershipClue = ownerIds.length > 0 || ownerEmails.length > 0 || Boolean(recordString(data.dataOwnerScopeId));

  if (gate.activeProfileId && ownerIds.length > 0) {
    return ownerIds.includes(gate.activeProfileId);
  }

  if (gate.activeProfileId && ownerIds.length === 0 && ownerProfileEmail && gate.activeProfileEmail) {
    return ownerProfileEmail === gate.activeProfileEmail;
  }

  if (gate.activeProfileEmail && ownerEmails.includes(gate.activeProfileEmail)) return true;

  return !hasOwnershipClue && allowUnownedRecords;
}

function filterRecordsForProfileGate<T extends object>(
  records: T[],
  label: string,
  gate: ResolvedDataProfileGate,
  allowUnownedRecords: boolean,
): T[] {
  if (!gate.hasGate) return records;

  const filteredRecords = records.filter((record) => recordMatchesProfileGate(record, gate, allowUnownedRecords));
  if (filteredRecords.length !== records.length) {
    console.warn('[DataBundle] Profile gate removed records outside active profile scope:', {
      label,
      original: records.length,
      filtered: filteredRecords.length,
      removed: records.length - filteredRecords.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return filteredRecords;
}

function filterRecordMapForProfileGate<T>(records: Record<string, T>, label: string, gate: ResolvedDataProfileGate): Record<string, T> {
  if (!gate.hasGate) return records;

  const entries = Object.entries(records).filter(([, value]) => recordMatchesProfileGate(value, gate, true));
  if (entries.length !== Object.keys(records).length) {
    console.warn('[DataBundle] Profile gate removed map entries outside active profile scope:', {
      label,
      original: Object.keys(records).length,
      filtered: entries.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return Object.fromEntries(entries);
}

function getActiveProfileFallbackId(gate: ResolvedDataProfileGate): string | null {
  return gate.activeProfileId ?? gate.activeProfileEmail;
}

function getActiveProfileFallbackEmail(gate: ResolvedDataProfileGate, email: string | null | undefined): string | null {
  return gate.activeProfileEmail ?? normalizeBackupImportEmail(email);
}

async function mergeWithExistingOutsideProfileGate<T extends object>(
  storageKey: string,
  importedRecords: T[],
  gate: ResolvedDataProfileGate,
  label: string,
  existingRecordsOverride?: T[],
): Promise<T[]> {
  if (!gate.hasGate) return importedRecords;

  const existingRecords = existingRecordsOverride
    ?? parseStoredArray<T>(await quotaSafeGetItem(storageKey), `${label} existing records`);
  const preservedRecords = existingRecords.filter((record) => !recordMatchesProfileGate(record, gate, true));

  if (preservedRecords.length > 0) {
    console.log('[DataBundle] Preserved records outside active profile during backup restore:', {
      label,
      preserved: preservedRecords.length,
      imported: importedRecords.length,
      activeProfileId: gate.activeProfileId,
      activeProfileEmail: gate.activeProfileEmail,
    });
  }

  return [...preservedRecords, ...importedRecords];
}

function adoptBackupRecordsForActiveAccount<T extends object>(records: T[], email: string | null | undefined, gate?: ResolvedDataProfileGate): T[] {
  const normalizedEmail = normalizeBackupImportEmail(email);
  const activeProfileId = gate?.activeProfileId ?? null;
  const activeProfileEmail = gate?.hasGate ? gate.activeProfileEmail : null;
  const syncedAt = new Date().toISOString();

  return records.map((record) => {
    const nextRecord = { ...(record as Record<string, unknown>) };
    delete nextRecord.dataOwnerScopeId;

    if (normalizedEmail) {
      nextRecord.dataOwnerEmail = normalizedEmail;
      nextRecord.dataOwnerSyncedAt = syncedAt;
    } else {
      delete nextRecord.dataOwnerEmail;
      delete nextRecord.dataOwnerSyncedAt;
    }

    if (activeProfileId) {
      nextRecord.ownerProfileId = activeProfileId;
    }

    if (activeProfileEmail) {
      nextRecord.sourceEmail = activeProfileEmail;
    }

    return nextRecord as T;
  });
}

async function loadStoredEntriesByPrefix(prefix: string, email: string | null | undefined): Promise<Record<string, unknown>> {
  const normalizedEmail = normalizeBackupImportEmail(email);
  const allKeys = await AsyncStorage.getAllKeys();
  const matchingKeys = allKeys.filter((key) => {
    if (!key.startsWith(prefix)) return false;
    return normalizedEmail ? key.endsWith(`::${normalizedEmail}`) : true;
  });

  const entries = await Promise.all(
    matchingKeys.map(async (key) => {
      const value = await quotaSafeGetItem(key);
      if (value === null) return null;
      try {
        return [key, JSON.parse(value)] as const;
      } catch (error) {
        console.error('[DataBundle] Error parsing dynamic storage entry:', { key, error });
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, unknown] => entry !== null));
}

async function loadCrewRecognitionRows<T extends object>(
  baseKey: string,
  email: string | null | undefined,
  gate: ResolvedDataProfileGate,
  label: string,
): Promise<T[]> {
  const normalizedEmail = normalizeBackupImportEmail(email);
  const keysToRead = new Set<string>();
  const legacyKey = getUserScopedKey(baseKey, normalizedEmail);

  if (gate.activeProfileId) {
    keysToRead.add(getUserScopedKey(getCrewProfileScopedBaseKey(baseKey, gate.activeProfileId), normalizedEmail));
    keysToRead.add(legacyKey);
  } else {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${baseKey}${CREW_PROFILE_KEY_SEGMENT}`;
    allKeys
      .filter((key) => key.startsWith(prefix) && (normalizedEmail ? key.endsWith(`::${normalizedEmail}`) : true))
      .forEach((key) => keysToRead.add(key));
    keysToRead.add(legacyKey);
  }

  const collections = await Promise.all(
    Array.from(keysToRead).map(async (key) => parseStoredArray<T>(await quotaSafeGetItem(key), `${label} ${key}`)),
  );
  const rows = collections.flat();
  return dedupeByIdOrPayload(rows, label);
}

function getCrewRecordProfileId(record: unknown, fallbackProfileId: string | null): string {
  if (record && typeof record === 'object') {
    const data = record as Record<string, unknown>;
    const ownerProfileId = recordString(data.ownerProfileId);
    const userId = recordString(data.userId);
    if (ownerProfileId && ownerProfileId !== 'local' && ownerProfileId !== 'guest') return ownerProfileId;
    if (userId && userId !== 'local' && userId !== 'guest') return userId;
  }
  return fallbackProfileId || 'primary';
}

async function saveCrewRecognitionRowsByProfile<T extends object>(
  baseKey: string,
  incomingRows: T[],
  existingRows: T[],
  email: string | null | undefined,
  gate: ResolvedDataProfileGate,
  label: string,
): Promise<number> {
  const fallbackProfileId = gate.activeProfileId ?? null;
  const byProfile = new Map<string, T[]>();
  incomingRows.forEach((row) => {
    const profileId = getCrewRecordProfileId(row, fallbackProfileId);
    byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), row]);
  });

  if (byProfile.size === 0 && existingRows.length > 0) {
    return 0;
  }

  await Promise.all(Array.from(byProfile.entries()).map(async ([profileId, profileRows]) => {
    const targetKey = getUserScopedKey(getCrewProfileScopedBaseKey(baseKey, profileId), email ?? null);
    const stampedRows = profileRows.map((row) => ({
      ...(row as Record<string, unknown>),
      ownerProfileId: profileId,
      userId: profileId,
    })) as T[];
    const dedupedRows = dedupeByIdOrPayload(stampedRows, `${label}:${profileId}`);
    const repositoryOwner = `${String(email || 'local-default').toLowerCase().trim()}::profile::${profileId}`;
    const repositoryDomain = baseKey === ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS
      ? 'crew_sailings'
      : 'crew_recognition';
    await Promise.all([
      quotaSafeSetJsonItem(targetKey, dedupedRows),
      replaceHighVolumeDomain(repositoryOwner, repositoryDomain, dedupedRows, targetKey),
    ]);
  }));

  return incomingRows.length;
}

function resolveImportedDynamicKey(key: string, prefix: string, email: string | null | undefined): string | null {
  if (!key.startsWith(prefix)) return null;
  const unscopedKey = key.includes('::') ? key.slice(0, key.indexOf('::')) : key;
  return getUserScopedKey(unscopedKey, email ?? null);
}

function parseStoredArray<T>(rawValue: string | null, label: string): T[] {
  try {
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch (error) {
    console.error(`[DataBundle] Error parsing ${label}:`, error);
    return [];
  }
}

export interface FullAppDataBundle {
  version: string;
  exportDate: string;
  profileGate?: {
    authenticatedEmail?: string | null;
    activeProfileId?: string | null;
    activeProfileEmail?: string | null;
  };
  cruises: Cruise[];
  bookedCruises: BookedCruise[];
  casinoOffers: CasinoOffer[];
  calendarEvents: CalendarEvent[];
  casinoSessions: CasinoSession[];
  certificates: Certificate[];
  /** Shared public Club Royale monthly PDFs plus their complete parsed sailing rows. */
  certificateDocuments: CertificateDocumentRecord[];
  /** Rebuildable source/index manifest used to verify Agent SEA and Cert Summary after restore. */
  agentSeaSourceManifest?: AgentSeaSourceManifest;
  /** Field-level source evidence for every profile in this account plus shared provider facts. */
  provenanceLinks?: ProvenanceLink[];
  /** Owner-scoped layout, accessibility, inbox, watchlist, and disclosure preferences. */
  userPreferences?: Record<string, unknown>;
  clubRoyaleProfile: ClubRoyaleProfile | null;
  settings: AppSettings | null;
  loyaltyData: {
    manualClubRoyalePoints: number | null;
    manualCrownAnchorPoints: number | null;
    userPoints: number | null;
  };
  extendedLoyaltyData?: Record<string, unknown> | null;
  userProfile: {
    name: string;
    email?: string;
    crownAnchorNumber: string;
    clubRoyalePoints: number;
    loyaltyPoints: number;
    celebrityEmail?: string;
    celebrityCaptainsClubNumber?: string;
    celebrityCaptainsClubPoints?: number;
    celebrityBlueChipPoints?: number;
    preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
  } | null;
  users: UserProfile[];
  playingHours?: import('@/state/UserProvider').PlayingHours;
  machines: {
    encyclopedia: MachineEncyclopediaEntry[];
    atlasIds: string[];
    userMachines?: SlotMachine[];
    deckLocations?: DeckPlanLocation[];
  };
  crewRecognition: {
    entries: RecognitionEntryWithCrew[];
    sailings: Sailing[];
  };
  casinoData?: {
    sessions: CasinoSession[];
    bankrollLimits: BankrollLimit[];
    bankrollAlerts: BankrollAlert[];
    casinoOpenHours: Record<string, CasinoOpenHoursData>;
    compItems: CompItem[];
    w2gRecords: W2GRecord[];
    casinoPointSummary?: {
      totalCasinoPoints: number;
      totalCasinoCoinIn: number;
      cruisesWithCasinoPoints: number;
    };
    askMyDataOverview?: AskMyDataOverview;
  };
  metadata: {
    totalCruises: number;
    totalBooked: number;
    totalOffers: number;
    totalEvents: number;
    totalCertificates: number;
    totalCertificateDocuments?: number;
    totalCertificateSailingRows?: number;
    totalSessions: number;
    totalMachines: number;
    totalCrewEntries: number;
    totalBankrollLimits?: number;
    totalCasinoOpenHours?: number;
    totalCompItems?: number;
    totalW2GRecords?: number;
    totalCasinoPoints?: number;
    totalCasinoCoinIn?: number;
    cruisesWithCasinoPoints?: number;
  };
}

export async function getAllStoredData(email?: string | null, profileGate?: DataProfileGate): Promise<FullAppDataBundle> {
  const resolvedGate = resolveDataProfileGate(email, profileGate);
  console.log('[DataBundle] Getting all stored data for email/profile gate:', {
    email: email || '(none)',
    activeProfileId: resolvedGate.activeProfileId,
    activeProfileEmail: resolvedGate.activeProfileEmail,
  });
  
  const sk = (baseKey: string): string => {
    if (GLOBAL_KEYS.has(baseKey)) return baseKey;
    return getUserScopedKey(baseKey, email ?? null);
  };

  try {
    const inventoryOwnerScope = getCruiseInventoryOwnerScope(email);
    const sqliteCruises: Cruise[] = [];
    try {
      const inventoryCounts = await cruiseInventoryRepository.getCounts(inventoryOwnerScope);
      if (inventoryCounts.total > 0) {
        await cruiseInventoryRepository.exportAllSourceRows((batch) => {
          sqliteCruises.push(...batch);
        }, 500, inventoryOwnerScope);
      }
    } catch (inventoryError) {
      console.warn('[DataBundle] SQLite catalog export unavailable; using retained legacy catalog:', inventoryError);
    }
    const repositoryOwner = String(email || 'local-default').toLowerCase().trim();
    const crewAccountPrefix = `${repositoryOwner}::profile::`;
    const crewRepositoryOwner = `${crewAccountPrefix}${resolvedGate.activeProfileId || repositoryOwner}`;
    const [
      repositoryBooked,
      repositoryOffers,
      repositoryEvents,
      repositorySessions,
      repositoryCertificates,
      repositoryMachines,
      repositoryAtlas,
      repositoryCrewEntries,
      repositoryCrewSailings,
    ] = await Promise.all([
      hydrateHighVolumeDomain<BookedCruise>(repositoryOwner, 'booked_cruises'),
      hydrateHighVolumeDomain<CasinoOffer>(repositoryOwner, 'casino_offers'),
      hydrateHighVolumeDomain<CalendarEvent>(repositoryOwner, 'calendar_events'),
      hydrateHighVolumeDomain<CasinoSession>(repositoryOwner, 'casino_sessions'),
      hydrateHighVolumeDomain<Certificate>(repositoryOwner, 'certificates'),
      hydrateHighVolumeDomain<MachineEncyclopediaEntry>(repositoryOwner, 'machine_encyclopedia'),
      hydrateHighVolumeDomain<string>(repositoryOwner, 'slot_atlas'),
      resolvedGate.activeProfileId
        ? listHighVolumeDomain<RecognitionEntryWithCrew>(crewRepositoryOwner, 'crew_recognition')
        : listHighVolumeDomainByOwnerPrefix<RecognitionEntryWithCrew>(crewAccountPrefix, 'crew_recognition'),
      resolvedGate.activeProfileId
        ? listHighVolumeDomain<Sailing>(crewRepositoryOwner, 'crew_sailings')
        : listHighVolumeDomainByOwnerPrefix<Sailing>(crewAccountPrefix, 'crew_sailings'),
    ]);
    const scopedUsersKey = email
      ? getUserScopedKey(ALL_STORAGE_KEYS.USERS, email.toLowerCase().trim())
      : ALL_STORAGE_KEYS.USERS;
    const extendedLoyaltyKey = sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA);

    const [
      cruisesData,
      bookedData,
      offersData,
      eventsData,
      sessionsData,
      certificatesData,
      publicCertificateDocumentsData,
      legacyCertificateDocumentsData,
      profileData,
      settingsData,
      manualClubRoyale,
      manualCrownAnchor,
      userPoints,
      scopedUsersData,
      machineEncyclopediaData,
      myAtlasData,
      currentMachineEncyclopediaData,
      currentMyAtlasData,
      crewEntriesData,
      crewSailingsData,
      extendedLoyaltyRaw,
      bankrollLimitsData,
      bankrollAlertsData,
      userSlotMachinesData,
      deckPlanLocationsData,
      compItemsData,
      w2gRecordsData,
    ] = await Promise.all([
      sqliteCruises.length > 0 ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CRUISES)),
      repositoryBooked.length ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES)),
      repositoryOffers.length ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS)),
      repositoryEvents.length ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS)),
      repositorySessions.length ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS)),
      repositoryCertificates.length ? Promise.resolve(null) : quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CERTIFICATES)),
      quotaSafeGetItem(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY),
      quotaSafeGetItem(getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, email ?? null)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.SETTINGS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.USER_POINTS)),
      quotaSafeGetItem(scopedUsersKey),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS)),
      repositoryMachines.length ? Promise.resolve(null) : quotaSafeGetItem(getUserScopedKey(CURRENT_MACHINE_ENCYCLOPEDIA_KEY, email ?? null)),
      repositoryAtlas.length ? Promise.resolve(null) : quotaSafeGetItem(getUserScopedKey(CURRENT_MY_SLOT_ATLAS_KEY, email ?? null)),
      repositoryCrewEntries.length ? Promise.resolve(repositoryCrewEntries) : loadCrewRecognitionRows<RecognitionEntryWithCrew>(ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES, email ?? null, resolvedGate, 'crew recognition entries'),
      repositoryCrewSailings.length ? Promise.resolve(repositoryCrewSailings) : loadCrewRecognitionRows<Sailing>(ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS, email ?? null, resolvedGate, 'crew recognition sailings'),
      quotaSafeGetItem(extendedLoyaltyKey),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.COMP_ITEMS)),
      quotaSafeGetItem(sk(ALL_STORAGE_KEYS.W2G_RECORDS)),
    ]);

    const usersData = scopedUsersData;
    console.log('[DataBundle] Users lookup: scopedKey=', scopedUsersKey, 'found=', !!scopedUsersData);

    let cruises: Cruise[] = [];
    let bookedCruises: BookedCruise[] = [];
    let casinoOffers: CasinoOffer[] = [];
    let calendarEvents: CalendarEvent[] = [];
    let casinoSessions: CasinoSession[] = [];
    let certificates: Certificate[] = [];
    let certificateDocuments: CertificateDocumentRecord[] = [];
    let clubRoyaleProfile: ClubRoyaleProfile | null = null;
    let settings: AppSettings | null = null;
    let users: UserProfile[] = [];
    let machineEncyclopedia: MachineEncyclopediaEntry[] = [];
    let myAtlasIds: string[] = [];
    let userSlotMachines: SlotMachine[] = [];
    let deckPlanLocations: DeckPlanLocation[] = [];
    let crewEntries: RecognitionEntryWithCrew[] = [];
    let crewSailings: Sailing[] = [];
    let bankrollLimits: BankrollLimit[] = [];
    let bankrollAlerts: BankrollAlert[] = [];
    let compItems: CompItem[] = [];
    let w2gRecords: W2GRecord[] = [];
    let casinoOpenHours: Record<string, CasinoOpenHoursData> = {};
    let provenanceLinks: ProvenanceLink[] = [];
    
    try {
      cruises = sqliteCruises.length > 0 ? sqliteCruises : (cruisesData ? JSON.parse(cruisesData) : []);
      if (!Array.isArray(cruises)) cruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing cruises:', e);
      cruises = [];
    }

    try {
      bookedCruises = repositoryBooked.length ? repositoryBooked : (bookedData ? JSON.parse(bookedData) : []);
      if (!Array.isArray(bookedCruises)) bookedCruises = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing booked cruises:', e);
      bookedCruises = [];
    }

    try {
      casinoOffers = repositoryOffers.length ? repositoryOffers : (offersData ? JSON.parse(offersData) : []);
      if (!Array.isArray(casinoOffers)) casinoOffers = [];
      console.log('[DataBundle] Including all casino offers in full backup:', casinoOffers.length);
    } catch (e) {
      console.error('[DataBundle] Error parsing casino offers:', e);
      casinoOffers = [];
    }

    try {
      calendarEvents = repositoryEvents.length ? repositoryEvents : (eventsData ? JSON.parse(eventsData) : []);
      if (!Array.isArray(calendarEvents)) calendarEvents = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing calendar events:', e);
      calendarEvents = [];
    }

    try {
      casinoSessions = repositorySessions.length ? repositorySessions : (sessionsData ? JSON.parse(sessionsData) : []);
      if (!Array.isArray(casinoSessions)) casinoSessions = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing casino sessions:', e);
      casinoSessions = [];
    }

    try {
      certificates = repositoryCertificates.length ? repositoryCertificates : (certificatesData ? JSON.parse(certificatesData) : []);
      if (!Array.isArray(certificates)) certificates = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing certificates:', e);
      certificates = [];
    }

    try {
      const publicDocuments = parseStoredArray<CertificateDocumentRecord>(publicCertificateDocumentsData, 'shared certificate documents');
      const legacyDocuments = parseStoredArray<CertificateDocumentRecord>(legacyCertificateDocumentsData, 'legacy certificate documents');
      const byIdentity = new Map<string, CertificateDocumentRecord>();
      [...publicDocuments, ...legacyDocuments].forEach((document) => {
        const identity = `${document.documentHash}|${document.originalUrl}`;
        const existing = byIdentity.get(identity);
        if (!existing || document.parseHistory.length > existing.parseHistory.length || document.storedAt > existing.storedAt) byIdentity.set(identity, document);
      });
      certificateDocuments = await embedRetainedCertificateBytesForBackup(Array.from(byIdentity.values()));
    } catch (e) {
      console.error('[DataBundle] Error parsing shared certificate documents:', e);
      certificateDocuments = [];
    }

    try {
      clubRoyaleProfile = profileData ? JSON.parse(profileData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing club profile:', e);
      clubRoyaleProfile = null;
    }

    try {
      settings = settingsData ? JSON.parse(settingsData) : null;
    } catch (e) {
      console.error('[DataBundle] Error parsing settings:', e);
      settings = null;
    }

    try {
      users = usersData ? JSON.parse(usersData) : [];
      if (!Array.isArray(users)) users = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing users:', e);
      users = [];
    }

    try {
      const provenanceOwners = [...new Set([
        email?.toLowerCase().trim(),
        ...users.map((user) => user.id),
      ].filter((value): value is string => Boolean(value)))];
      const provenanceCollections = Platform.OS === 'web'
        ? []
        : await Promise.all(
          provenanceOwners.map((owner) => listAllProvenanceLinks(owner)),
        );
      const byId = new Map<string, ProvenanceLink>();
      provenanceCollections.flat().forEach((link) => {
        if (!resolvedGate.hasGate || link.ownerId === null || link.ownerId === resolvedGate.activeProfileId || link.ownerId === resolvedGate.activeProfileEmail) {
          byId.set(link.id, link);
        }
      });
      provenanceLinks = Array.from(byId.values());
    } catch (error) {
      // Provenance must not make a traditional backup impossible on an older
      // installation whose trust database has not migrated yet. The manifest
      // records the absence and the observer will rebuild links after restore.
      console.warn('[DataBundle] Field provenance was not available for this backup:', error);
      provenanceLinks = [];
    }

    try {
      const activeMachineData = currentMachineEncyclopediaData ?? machineEncyclopediaData;
      machineEncyclopedia = repositoryMachines.length
        ? repositoryMachines
        : (activeMachineData ? JSON.parse(activeMachineData) : []);
      if (!Array.isArray(machineEncyclopedia)) machineEncyclopedia = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing machine encyclopedia:', e);
      machineEncyclopedia = [];
    }

    try {
      const activeAtlasData = currentMyAtlasData ?? myAtlasData;
      myAtlasIds = repositoryAtlas.length
        ? repositoryAtlas
        : (activeAtlasData ? JSON.parse(activeAtlasData) : []);
      if (!Array.isArray(myAtlasIds)) myAtlasIds = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing atlas IDs:', e);
      myAtlasIds = [];
    }

    userSlotMachines = parseStoredArray<SlotMachine>(userSlotMachinesData, 'user slot machines');
    deckPlanLocations = parseStoredArray<DeckPlanLocation>(deckPlanLocationsData, 'deck plan locations');
    bankrollLimits = parseStoredArray<BankrollLimit>(bankrollLimitsData, 'bankroll limits');
    bankrollAlerts = parseStoredArray<BankrollAlert>(bankrollAlertsData, 'bankroll alerts');
    compItems = parseStoredArray<CompItem>(compItemsData, 'comp items');
    w2gRecords = parseStoredArray<W2GRecord>(w2gRecordsData, 'W-2G records');

    try {
      casinoOpenHours = await loadStoredEntriesByPrefix(CASINO_OPEN_HOURS_STORAGE_PREFIX, email ?? null) as Record<string, CasinoOpenHoursData>;
    } catch (e) {
      console.error('[DataBundle] Error loading casino open hours:', e);
      casinoOpenHours = {};
    }

    try {
      crewEntries = Array.isArray(crewEntriesData) ? crewEntriesData : (crewEntriesData ? JSON.parse(crewEntriesData) : []);
      if (!Array.isArray(crewEntries)) crewEntries = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing crew entries:', e);
      crewEntries = [];
    }

    try {
      crewSailings = Array.isArray(crewSailingsData) ? crewSailingsData : (crewSailingsData ? JSON.parse(crewSailingsData) : []);
      if (!Array.isArray(crewSailings)) crewSailings = [];
    } catch (e) {
      console.error('[DataBundle] Error parsing crew sailings:', e);
      crewSailings = [];
    }

    // A Save All launched immediately after upgrading may be the first code
    // path to encounter legacy profile-partitioned crew data. Mirror it before
    // the export is declared complete so the next startup no longer needs to
    // scan or parse every legacy profile key.
    if (repositoryCrewEntries.length === 0 && crewEntries.length > 0) {
      await saveCrewRecognitionRowsByProfile(
        ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES,
        crewEntries,
        crewEntries,
        email ?? null,
        resolvedGate,
        'crewRecognitionEntries export migration',
      );
    }
    if (repositoryCrewSailings.length === 0 && crewSailings.length > 0) {
      await saveCrewRecognitionRowsByProfile(
        ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS,
        crewSailings,
        crewSailings,
        email ?? null,
        resolvedGate,
        'crewRecognitionSailings export migration',
      );
    }

    const clubRoyalePoints = manualClubRoyale ? parseInt(manualClubRoyale, 10) : 0;
    const loyaltyPoints = manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : 0;

    let extendedLoyaltyData: Record<string, unknown> | null = null;
    try {
      if (extendedLoyaltyRaw) {
        extendedLoyaltyData = JSON.parse(extendedLoyaltyRaw) as Record<string, unknown>;
        console.log('[DataBundle] Found extended loyalty data with keys:', Object.keys(extendedLoyaltyData));
      }
    } catch (e) {
      console.error('[DataBundle] Error parsing extended loyalty data:', e);
    }

    // Cruise and offer inventories are shared account data. Do not apply the
    // active traveler/profile gate here: the primary and secondary users must
    // both see the same synced Royal/Celebrity/Carnival offer inventory.
    //
    // Available-cruise exports are deliberately lossless. Multiple rows may
    // describe the same physical sailing under different playerOfferId,
    // cabin, guest, or category eligibility and must survive backup/restore.
    bookedCruises = normalizeCruisesWithCasinoEconomics(
      dedupeBookedCruises(bookedCruises, 'export booked cruises').map(normalizeCruiseCasinoPerformance),
      { includeKnownAnnualFacts: isKnownCasinoProfile(email) },
    );
    casinoOffers = collapseOfferSailingRowsToOfferInstances(
      dedupeCasinoOffers(casinoOffers, 'export casino offers'),
    );
    calendarEvents = dedupeCalendarEvents(filterRecordsForProfileGate(calendarEvents, 'export calendar events', resolvedGate, true), 'export calendar events');
    casinoSessions = filterRecordsForProfileGate(casinoSessions, 'export casino sessions', resolvedGate, true);
    certificates = filterRecordsForProfileGate(certificates, 'export certificates', resolvedGate, true);
    // Include ALL users stored under this account's key - the second user belongs to the primary account holder.
    // Only filter when a specific activeProfileId is requested (single-profile export).
    if (resolvedGate.activeProfileId) {
      users = users.filter((user) => userMatchesProfileGate(user, resolvedGate));
    }
    console.log('[DataBundle] Including users in export:', users.length, users.map(u => ({ id: u.id, name: u.name, isOwner: u.isOwner })));
    const ownerUser = users.find(u => u.id === resolvedGate.activeProfileId) || users.find(u => u.isOwner) || users[0];
    const userProfile = ownerUser ? {
      name: ownerUser.name || '',
      email: ownerUser.email || '',
      crownAnchorNumber: ownerUser.crownAnchorNumber || '',
      clubRoyalePoints,
      loyaltyPoints,
      celebrityEmail: ownerUser.celebrityEmail || '',
      celebrityCaptainsClubNumber: ownerUser.celebrityCaptainsClubNumber || '',
      celebrityCaptainsClubPoints: ownerUser.celebrityCaptainsClubPoints || 0,
      celebrityBlueChipPoints: ownerUser.celebrityBlueChipPoints || 0,
      preferredBrand: ownerUser.preferredBrand || 'royal',
    } : null;
    const playingHours = ownerUser?.playingHours;
    machineEncyclopedia = filterRecordsForProfileGate(machineEncyclopedia, 'export machine encyclopedia', resolvedGate, true);
    userSlotMachines = filterRecordsForProfileGate(userSlotMachines, 'export user slot machines', resolvedGate, true);
    deckPlanLocations = filterRecordsForProfileGate(deckPlanLocations, 'export deck plan locations', resolvedGate, true);
    // Crew recognition is already isolated by the authenticated account's
    // scoped storage key. A selected Royal/Celebrity profile is not ownership
    // evidence for a crew member, so applying the cruise profile gate here
    // incorrectly removed the complete registry from Save All.
    bankrollLimits = filterRecordsForProfileGate(bankrollLimits, 'export bankroll limits', resolvedGate, true);
    bankrollAlerts = filterRecordsForProfileGate(bankrollAlerts, 'export bankroll alerts', resolvedGate, true);
    compItems = filterRecordsForProfileGate(compItems, 'export comp items', resolvedGate, true);
    w2gRecords = filterRecordsForProfileGate(w2gRecords, 'export W-2G records', resolvedGate, true);
    casinoOpenHours = filterRecordMapForProfileGate(casinoOpenHours, 'export casino open hours', resolvedGate);
    const totalCasinoPoints = bookedCruises.reduce((sum, cruise) => sum + getBookedCruiseCasinoPoints(cruise), 0);
    const casinoPointSummary = {
      totalCasinoPoints,
      totalCasinoCoinIn: totalCasinoPoints * 5,
      cruisesWithCasinoPoints: bookedCruises.filter((cruise) => getBookedCruiseCasinoPoints(cruise) > 0).length,
    };
    const askMyDataOverview = buildAskMyDataOverview({
      bookedCruises,
      casinoSessions,
      currentTier: clubRoyaleProfile?.tier ?? null,
      currentPoints: clubRoyalePoints,
      pointBalanceSource: 'backup-export',
      useKnownAnnualReportFacts: isKnownCasinoProfile(email),
    });
    const preferenceOwners = [...new Set([
      email?.toLowerCase().trim(),
      ...users.map((user) => user.id),
    ].filter((value): value is string => Boolean(value)))];
    const userPreferences = Object.assign(
      {},
      ...(await Promise.all(preferenceOwners.map((owner) => exportUserPreferenceStorage(owner)))),
    );

    const bundle: FullAppDataBundle = {
      version: '3.0.0',
      exportDate: new Date().toISOString(),
      profileGate: resolvedGate.hasGate ? {
        authenticatedEmail: resolvedGate.authenticatedEmail,
        activeProfileId: resolvedGate.activeProfileId,
        activeProfileEmail: resolvedGate.activeProfileEmail,
      } : undefined,
      cruises,
      bookedCruises,
      casinoOffers,
      calendarEvents,
      casinoSessions,
      certificates,
      certificateDocuments,
      agentSeaSourceManifest: buildAgentSeaSourceManifest({
        cruises,
        offers: casinoOffers,
        certificates,
        certificateDocuments,
        bookedCruises,
        calendarEvents,
        casinoCount: casinoSessions.length,
        crewCount: crewEntries.length,
        casinoRecords: casinoSessions,
        crewRecords: crewEntries,
        provenanceLinks,
      }),
      provenanceLinks,
      userPreferences,
      clubRoyaleProfile,
      settings,
      loyaltyData: {
        manualClubRoyalePoints: manualClubRoyale ? parseInt(manualClubRoyale, 10) : null,
        manualCrownAnchorPoints: manualCrownAnchor ? parseInt(manualCrownAnchor, 10) : null,
        userPoints: userPoints ? parseInt(userPoints, 10) : null,
      },
      extendedLoyaltyData,
      userProfile,
      users,
      playingHours,
      machines: {
        encyclopedia: machineEncyclopedia,
        atlasIds: myAtlasIds,
        userMachines: userSlotMachines,
        deckLocations: deckPlanLocations,
      },
      crewRecognition: {
        entries: crewEntries,
        sailings: crewSailings,
      },
      casinoData: {
        sessions: casinoSessions,
        bankrollLimits,
        bankrollAlerts,
        casinoOpenHours,
        compItems,
        w2gRecords,
        casinoPointSummary,
        askMyDataOverview,
      },
      metadata: {
        totalCruises: cruises.length,
        totalBooked: bookedCruises.length,
        totalOffers: casinoOffers.length,
        totalEvents: calendarEvents.length,
        totalCertificates: certificates.length,
        totalCertificateDocuments: certificateDocuments.length,
        totalCertificateSailingRows: certificateDocuments.reduce((total, document) => total + (document.parseHistory.at(-1)?.result.sailings.length ?? 0), 0),
        totalSessions: casinoSessions.length,
        totalMachines: myAtlasIds.length || machineEncyclopedia.length,
        totalCrewEntries: crewEntries.length,
        totalBankrollLimits: bankrollLimits.length,
        totalCasinoOpenHours: Object.keys(casinoOpenHours).length,
        totalCompItems: compItems.length,
        totalW2GRecords: w2gRecords.length,
        totalCasinoPoints: casinoPointSummary.totalCasinoPoints,
        totalCasinoCoinIn: casinoPointSummary.totalCasinoCoinIn,
        cruisesWithCasinoPoints: casinoPointSummary.cruisesWithCasinoPoints,
      },
    };

    await quotaSafeSetJsonItem(AGENT_SEA_SOURCE_MANIFEST_KEY, bundle.agentSeaSourceManifest);
    console.log('[DataBundle] Retrieved data:', bundle.metadata);
    console.log('[DataBundle] User profile:', userProfile);
    return bundle;
  } catch (error) {
    console.error('[DataBundle] Error getting all data:', error);
    throw error;
  }
}

export async function importAllData(bundle: FullAppDataBundle, email?: string | null, profileGate?: DataProfileGate): Promise<{
  success: boolean;
  imported: {
    cruises: number;
    bookedCruises: number;
    casinoOffers: number;
    calendarEvents: number;
    casinoSessions: number;
    certificates: number;
    certificateDocuments: number;
    machines: number;
    crewRecognitionEntries: number;
    bankrollLimits: number;
    casinoOpenHours: number;
    compItems: number;
    w2gRecords: number;
  };
  errors: string[];
}> {
  const resolvedGate = resolveDataProfileGate(email, profileGate ?? bundle.profileGate);
  const activeProfileFallbackId = getActiveProfileFallbackId(resolvedGate);
  const activeProfileFallbackEmail = getActiveProfileFallbackEmail(resolvedGate, email);
  const sharedInventoryFallbackEmail = normalizeBackupImportEmail(email);
  console.log('[DataBundle] Importing all data for email/profile gate:', {
    email: email || '(none)',
    activeProfileId: resolvedGate.activeProfileId,
    activeProfileEmail: resolvedGate.activeProfileEmail,
  });
  const errors: string[] = [];
  const importTimestamp = new Date().toISOString();
  const imported = {
    cruises: 0,
    bookedCruises: 0,
    casinoOffers: 0,
    calendarEvents: 0,
    casinoSessions: 0,
    certificates: 0,
    certificateDocuments: 0,
    machines: 0,
    crewRecognitionEntries: 0,
    bankrollLimits: 0,
    casinoOpenHours: 0,
    compItems: 0,
    w2gRecords: 0,
  };

  let preflightInventoryCounts: Awaited<ReturnType<typeof cruiseInventoryRepository.getCounts>> | null = null;
  if ((bundle.cruises?.length ?? 0) > 0) {
    try {
      preflightInventoryCounts = await cruiseInventoryRepository.getCounts(getCruiseInventoryOwnerScope(email));
    } catch (error) {
      const message = `Cruise catalog storage is unavailable; no backup records were changed: ${error}`;
      console.error('[DataBundle] Backup import preflight failed:', error);
      return { success: false, imported, errors: [message] };
    }
  }

  const sk = (baseKey: string): string => {
    if (GLOBAL_KEYS.has(baseKey)) return baseKey;
    return getUserScopedKey(baseKey, email ?? null);
  };
  const repositoryOwner = String(email || 'local-default').toLowerCase().trim();

  let importedBookedForCalendar: BookedCruise[] = [];

  try {
    if (bundle.cruises && Array.isArray(bundle.cruises)) {
      const incomingCruiseRows = bundle.cruises;
      const inventoryOwnerScope = getCruiseInventoryOwnerScope(email);
      const currentInventoryCounts = preflightInventoryCounts;
      const existingInventoryTotal = currentInventoryCounts?.sourceTotal ?? currentInventoryCounts?.total ?? 0;
      if (incomingCruiseRows.length === 0 && existingInventoryTotal > 0) {
        console.warn('[DataBundle] Skipped empty cruise restore to preserve existing SQLite cruise inventory:', {
          existingInventoryTotal,
          ownerScope: inventoryOwnerScope,
        });
        imported.cruises = 0;
      } else {
      const adoptedCruises = adoptBackupRecordsForActiveAccount(incomingCruiseRows, email);
      const foundationCruises = applyFoundationFields(adoptedCruises, {
        fallbackOwnerProfileId: null,
        fallbackSourceEmail: sharedInventoryFallbackEmail,
        markUnassigned: true,
      });
      if (incomingCruiseRows.length > 0 && foundationCruises.length === 0 && existingInventoryTotal > 0) {
        console.warn('[DataBundle] Skipped profile-filtered empty cruise restore to preserve existing SQLite cruise inventory:', {
          incomingCruises: incomingCruiseRows.length,
          existingInventoryTotal,
          ownerScope: inventoryOwnerScope,
        });
        imported.cruises = 0;
      } else {
      await cruiseInventoryRepository.replaceCatalog(foundationCruises, {
        ownerScopeId: inventoryOwnerScope,
        runId: `backup-import-${importTimestamp}`,
        batchSize: 500,
        yieldBetweenBatches: true,
      });
      await cruiseInventoryRepository.setMetadata(`legacy_catalog_retained:${inventoryOwnerScope}`, JSON.stringify({
        retainedForRollbackOnly: true,
        authoritativeStore: 'sqlite',
        importedAt: importTimestamp,
      }));
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.cruises = foundationCruises.length;
      console.log('[DataBundle] Imported cruises:', imported.cruises);
      }
      }
    }
  } catch (error) {
    console.error('[DataBundle] Failed to import cruise catalog:', error);
    errors.push(`Failed to import cruises: ${error}`);
  }

  try {
    if (bundle.bookedCruises && Array.isArray(bundle.bookedCruises)) {
      const adoptedBooked = adoptBackupRecordsForActiveAccount(bundle.bookedCruises, email);
      const foundationBooked = applyFoundationFields(adoptedBooked, {
        fallbackOwnerProfileId: null,
        fallbackSourceEmail: sharedInventoryFallbackEmail,
        markUnassigned: true,
      });
      const dedupedBooked = dedupeBookedCruises(foundationBooked, 'backup booked cruises');
      const enrichedBooked = normalizeCruisesWithCasinoEconomics(
        dedupedBooked.map(normalizeCruiseCasinoPerformance),
        { includeKnownAnnualFacts: isKnownCasinoProfile(email) },
      );
      importedBookedForCalendar = enrichedBooked;
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'booked_cruises', enrichedBooked, sk(ALL_STORAGE_KEYS.BOOKED_CRUISES)),
        quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES), enrichedBooked),
      ]);
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.bookedCruises = enrichedBooked.length;
      console.log('[DataBundle] Imported booked cruises:', imported.bookedCruises);
    }
  } catch (error) {
    errors.push(`Failed to import booked cruises: ${error}`);
  }

  try {
    if (bundle.casinoOffers && Array.isArray(bundle.casinoOffers)) {
      const incomingOffers = bundle.casinoOffers;
      const repositoryExistingOffers = await hydrateHighVolumeDomain<CasinoOffer>(repositoryOwner, 'casino_offers');
      const existingOffers = repositoryExistingOffers.length
        ? repositoryExistingOffers
        : parseStoredArray<CasinoOffer>(await quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS)), 'backup casino offers existing records');
      if (incomingOffers.length === 0 && existingOffers.length > 0) {
        console.warn('[DataBundle] Skipped empty casino-offer restore to preserve existing offers:', {
          existingOffers: existingOffers.length,
        });
        imported.casinoOffers = 0;
      } else {
      const adoptedOffers = adoptBackupRecordsForActiveAccount(incomingOffers, email);
      const foundationOffers = applyFoundationFields(adoptedOffers, {
        fallbackOwnerProfileId: null,
        fallbackSourceEmail: sharedInventoryFallbackEmail,
        markUnassigned: true,
      });
      if (incomingOffers.length > 0 && foundationOffers.length === 0 && existingOffers.length > 0) {
        console.warn('[DataBundle] Skipped profile-filtered empty casino-offer restore to preserve existing offers:', {
          incomingOffers: incomingOffers.length,
          existingOffers: existingOffers.length,
        });
        imported.casinoOffers = 0;
      } else {
      const dedupedOffers = collapseOfferSailingRowsToOfferInstances(
        dedupeCasinoOffers(foundationOffers, 'backup casino offers'),
      );
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'casino_offers', dedupedOffers, sk(ALL_STORAGE_KEYS.CASINO_OFFERS)),
        quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS), dedupedOffers),
      ]);
      await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
      imported.casinoOffers = dedupedOffers.length;
      console.log('[DataBundle] Imported casino offers:', imported.casinoOffers);
      }
      }
    }
  } catch (error) {
    errors.push(`Failed to import casino offers: ${error}`);
  }

  try {
    if (bundle.calendarEvents && Array.isArray(bundle.calendarEvents)) {
      const generatedCruiseEvents = generateCruiseCalendarEvents(importedBookedForCalendar);
      const gatedCalendarEvents = filterRecordsForProfileGate(bundle.calendarEvents, 'backup calendar events', resolvedGate, true);
      const adoptedCalendarEvents = adoptBackupRecordsForActiveAccount(gatedCalendarEvents, email, resolvedGate);
      const adoptedGeneratedCruiseEvents = adoptBackupRecordsForActiveAccount(generatedCruiseEvents, email, resolvedGate);
      const foundationEvents = applyFoundationFields([...adoptedCalendarEvents, ...adoptedGeneratedCruiseEvents], {
        fallbackOwnerProfileId: activeProfileFallbackId,
        fallbackSourceEmail: activeProfileFallbackEmail,
        markUnassigned: true,
      });
      const dedupedEvents = dedupeCalendarEvents(foundationEvents, 'backup calendar events');
      const existingEvents = await hydrateHighVolumeDomain<CalendarEvent>(repositoryOwner, 'calendar_events');
      const mergedEvents = await mergeWithExistingOutsideProfileGate(
        sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS),
        dedupedEvents,
        resolvedGate,
        'backup calendar events',
        existingEvents.length ? existingEvents : undefined,
      );
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'calendar_events', mergedEvents, sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS)),
        quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS), mergedEvents),
      ]);
      imported.calendarEvents = dedupedEvents.length;
      console.log('[DataBundle] Imported calendar events:', {
        importedCalendarEvents: bundle.calendarEvents.length,
        generatedCruiseEvents: generatedCruiseEvents.length,
        savedEvents: imported.calendarEvents,
      });
    }
  } catch (error) {
    errors.push(`Failed to import calendar events: ${error}`);
  }

  try {
    const sourceSessions = bundle.casinoData?.sessions ?? bundle.casinoSessions;
    if (sourceSessions && Array.isArray(sourceSessions)) {
      const gatedSessions = filterRecordsForProfileGate(sourceSessions, 'casinoSessions', resolvedGate, true);
      const adoptedSessions = adoptBackupRecordsForActiveAccount(gatedSessions, email, resolvedGate);
      const dedupedSessions = dedupeByIdOrPayload(adoptedSessions, 'casinoSessions');
      const existingSessions = await hydrateHighVolumeDomain<CasinoSession>(repositoryOwner, 'casino_sessions');
      const mergedSessions = await mergeWithExistingOutsideProfileGate(
        sk(ALL_STORAGE_KEYS.CASINO_SESSIONS),
        dedupedSessions,
        resolvedGate,
        'casinoSessions',
        existingSessions.length ? existingSessions : undefined,
      );
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'casino_sessions', mergedSessions, sk(ALL_STORAGE_KEYS.CASINO_SESSIONS)),
        quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CASINO_SESSIONS), mergedSessions),
      ]);
      imported.casinoSessions = dedupedSessions.length;
      console.log('[DataBundle] Imported casino sessions:', imported.casinoSessions);
    }
  } catch (error) {
    errors.push(`Failed to import casino sessions: ${error}`);
  }

  try {
    if (bundle.certificates && Array.isArray(bundle.certificates)) {
      const gatedCertificates = filterRecordsForProfileGate(bundle.certificates, 'certificates', resolvedGate, true);
      const adoptedCertificates = adoptBackupRecordsForActiveAccount(gatedCertificates, email, resolvedGate);
      const dedupedCertificates = dedupeByIdOrPayload(adoptedCertificates, 'certificates');
      const existingCertificates = await hydrateHighVolumeDomain<Certificate>(repositoryOwner, 'certificates');
      const mergedCertificates = await mergeWithExistingOutsideProfileGate(
        sk(ALL_STORAGE_KEYS.CERTIFICATES),
        dedupedCertificates,
        resolvedGate,
        'certificates',
        existingCertificates.length ? existingCertificates : undefined,
      );
      await Promise.all([
        replaceHighVolumeDomain(repositoryOwner, 'certificates', mergedCertificates, sk(ALL_STORAGE_KEYS.CERTIFICATES)),
        quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CERTIFICATES), mergedCertificates),
      ]);
      imported.certificates = dedupedCertificates.length;
      console.log('[DataBundle] Imported certificates:', imported.certificates);
    }
  } catch (error) {
    errors.push(`Failed to import certificates: ${error}`);
  }

  try {
    if (bundle.certificateDocuments && Array.isArray(bundle.certificateDocuments)) {
      const existing = parseStoredArray<CertificateDocumentRecord>(await quotaSafeGetItem(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY), 'existing shared certificate documents');
      const byIdentity = new Map<string, CertificateDocumentRecord>();
      [...existing, ...bundle.certificateDocuments].forEach((document) => {
        const identity = `${document.documentHash}|${document.originalUrl}`;
        const current = byIdentity.get(identity);
        if (!current || document.parseHistory.length > current.parseHistory.length || document.storedAt > current.storedAt) byIdentity.set(identity, document);
      });
      const merged = Array.from(byIdentity.values());
      await quotaSafeSetJsonItem(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY, merged);
      imported.certificateDocuments = bundle.certificateDocuments.length;
      console.log('[DataBundle] Imported shared Club Royale certificate documents:', imported.certificateDocuments);
    }
  } catch (error) {
    errors.push(`Failed to import shared certificate documents: ${error}`);
  }

  try {
    if (bundle.clubRoyaleProfile) {
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.CLUB_PROFILE), bundle.clubRoyaleProfile);
      console.log('[DataBundle] Imported club profile');
    }
  } catch (error) {
    errors.push(`Failed to import club profile: ${error}`);
  }

  try {
    if (bundle.settings) {
      await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.SETTINGS), bundle.settings);
      console.log('[DataBundle] Imported settings');
    }
  } catch (error) {
    errors.push(`Failed to import settings: ${error}`);
  }

  try {
    if (bundle.loyaltyData) {
      if (bundle.loyaltyData.manualClubRoyalePoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.MANUAL_CLUB_ROYALE_POINTS), 
          bundle.loyaltyData.manualClubRoyalePoints.toString()
        );
      }
      if (bundle.loyaltyData.manualCrownAnchorPoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.MANUAL_CROWN_ANCHOR_POINTS), 
          bundle.loyaltyData.manualCrownAnchorPoints.toString()
        );
      }
      if (bundle.loyaltyData.userPoints !== null) {
        await AsyncStorage.setItem(
          sk(ALL_STORAGE_KEYS.USER_POINTS), 
          bundle.loyaltyData.userPoints.toString()
        );
      }
      console.log('[DataBundle] Imported loyalty data');
    }
  } catch (error) {
    errors.push(`Failed to import loyalty data: ${error}`);
  }

  try {
    if (bundle.extendedLoyaltyData && typeof bundle.extendedLoyaltyData === 'object') {
      await quotaSafeSetJsonItem(
        sk(ALL_STORAGE_KEYS.EXTENDED_LOYALTY_DATA),
        bundle.extendedLoyaltyData
      );
      console.log('[DataBundle] Imported extended loyalty data:', Object.keys(bundle.extendedLoyaltyData));
    }
  } catch (error) {
    errors.push(`Failed to import extended loyalty data: ${error}`);
  }

  try {
    let usersToImport: UserProfile[] | null = null;
    
    if (bundle.users && Array.isArray(bundle.users) && bundle.users.length > 0) {
      console.log('[DataBundle] Found users array with', bundle.users.length, 'users');
      console.log('[DataBundle] Users data:', JSON.stringify(bundle.users.map(u => ({ id: u.id, name: u.name, crownAnchorNumber: u.crownAnchorNumber, birthdate: u.birthdate, playingHours: !!u.playingHours }))));
      // Include ALL users from the bundle - the second user belongs to the primary account holder.
      // Only filter when a specific activeProfileId is requested (single-profile import).
      if (resolvedGate.activeProfileId) {
        usersToImport = bundle.users.filter((user) => userMatchesProfileGate(user, resolvedGate));
      } else {
        usersToImport = bundle.users;
      }
    } else if (bundle.userProfile && (bundle.userProfile.name || bundle.userProfile.crownAnchorNumber)) {
      console.log('[DataBundle] No users array, creating from userProfile:', JSON.stringify(bundle.userProfile));
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: `user_${Date.now()}`,
        name: bundle.userProfile.name || '',
        email: bundle.userProfile.email || '',
        isOwner: true,
        crownAnchorNumber: bundle.userProfile.crownAnchorNumber || '',
        celebrityEmail: bundle.userProfile.celebrityEmail,
        celebrityCaptainsClubNumber: bundle.userProfile.celebrityCaptainsClubNumber,
        celebrityCaptainsClubPoints: bundle.userProfile.celebrityCaptainsClubPoints,
        celebrityBlueChipPoints: bundle.userProfile.celebrityBlueChipPoints,
        preferredBrand: bundle.userProfile.preferredBrand,
        playingHours: bundle.playingHours,
        createdAt: now,
        updatedAt: now,
      };
      usersToImport = [newUser];
      console.log('[DataBundle] Created user from userProfile:', newUser.name, 'C&A:', newUser.crownAnchorNumber, 'with playing hours');
    } else {
      console.log('[DataBundle] No user data to import - neither users array nor userProfile with data');
    }
    
    if (usersToImport && usersToImport.length > 0) {
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      
      if (normalizedEmail) {
        usersToImport = usersToImport.map(u => ({
          ...u,
          id: resolvedGate.activeProfileId ?? u.id,
          email: resolvedGate.activeProfileEmail ?? normalizedEmail,
          isOwner: resolvedGate.activeProfileId ? true : u.isOwner,
        }));
      }

      const scopedUsersKey = normalizedEmail
        ? getUserScopedKey(ALL_STORAGE_KEYS.USERS, normalizedEmail)
        : ALL_STORAGE_KEYS.USERS;
      const scopedCurrentUserKey = normalizedEmail
        ? getUserScopedKey(ALL_STORAGE_KEYS.CURRENT_USER, normalizedEmail)
        : ALL_STORAGE_KEYS.CURRENT_USER;

      const existingUsers = parseStoredArray<UserProfile>(await AsyncStorage.getItem(scopedUsersKey), 'existing users');
      const preservedUsers = resolvedGate.hasGate
        ? existingUsers.filter((user) => !userMatchesProfileGate(user, resolvedGate))
        : [];
      const mergedUsers = [...preservedUsers, ...usersToImport];

      await quotaSafeSetJsonItem(scopedUsersKey, mergedUsers);
      console.log('[DataBundle] Successfully imported', usersToImport.length, 'active-profile users to scoped storage key:', scopedUsersKey);
      console.log('[DataBundle] Imported users:', JSON.stringify(usersToImport.map(u => ({ id: u.id, name: u.name, email: u.email, crownAnchorNumber: u.crownAnchorNumber, birthdate: u.birthdate, hasPlayingHours: !!u.playingHours }))));
      
      const ownerUser = usersToImport.find(u => u.id === resolvedGate.activeProfileId) || usersToImport.find(u => u.isOwner) || usersToImport[0];
      if (ownerUser) {
        await AsyncStorage.setItem(scopedCurrentUserKey, ownerUser.id);
        console.log('[DataBundle] Set current user to:', ownerUser.id, ownerUser.name);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing users:', error);
    errors.push(`Failed to import users: ${error}`);
  }

  try {
    if (bundle.machines) {
      if (bundle.machines.encyclopedia && Array.isArray(bundle.machines.encyclopedia)) {
        const gatedMachineEntries = filterRecordsForProfileGate(bundle.machines.encyclopedia, 'machineEncyclopedia', resolvedGate, true);
        const adoptedMachineEntries = adoptBackupRecordsForActiveAccount(gatedMachineEntries, email, resolvedGate);
        const dedupedMachineEntries = dedupeByIdOrPayload(adoptedMachineEntries, 'machineEncyclopedia');
        const existingMachines = await hydrateHighVolumeDomain<MachineEncyclopediaEntry>(repositoryOwner, 'machine_encyclopedia');
        const mergedMachineEntries = await mergeWithExistingOutsideProfileGate(
          sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA),
          dedupedMachineEntries,
          resolvedGate,
          'machineEncyclopedia',
          existingMachines.length ? existingMachines : undefined,
        );
        await Promise.all([
          replaceHighVolumeDomain(repositoryOwner, 'machine_encyclopedia', mergedMachineEntries, getUserScopedKey(CURRENT_MACHINE_ENCYCLOPEDIA_KEY, email ?? null)),
          quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.MACHINE_ENCYCLOPEDIA), mergedMachineEntries),
          quotaSafeSetJsonItem(getUserScopedKey(CURRENT_MACHINE_ENCYCLOPEDIA_KEY, email ?? null), mergedMachineEntries),
        ]);
        imported.machines = dedupedMachineEntries.length;
        console.log('[DataBundle] Imported machine encyclopedia:', dedupedMachineEntries.length);
      }
      if (bundle.machines.atlasIds && Array.isArray(bundle.machines.atlasIds)) {
        const dedupedAtlasIds = Array.from(new Set(bundle.machines.atlasIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
        await Promise.all([
          replaceHighVolumeDomain(repositoryOwner, 'slot_atlas', dedupedAtlasIds, getUserScopedKey(CURRENT_MY_SLOT_ATLAS_KEY, email ?? null)),
          quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.MY_SLOT_ATLAS), dedupedAtlasIds),
          quotaSafeSetJsonItem(getUserScopedKey(CURRENT_MY_SLOT_ATLAS_KEY, email ?? null), dedupedAtlasIds),
        ]);
        imported.machines = imported.machines || dedupedAtlasIds.length;
        console.log('[DataBundle] Imported slot atlas:', dedupedAtlasIds.length, 'machines');
      }
      if (bundle.machines.userMachines && Array.isArray(bundle.machines.userMachines)) {
        const gatedUserMachines = filterRecordsForProfileGate(bundle.machines.userMachines, 'userSlotMachines', resolvedGate, true);
        const adoptedUserMachines = adoptBackupRecordsForActiveAccount(gatedUserMachines, email, resolvedGate);
        const dedupedUserMachines = dedupeByIdOrPayload(adoptedUserMachines, 'userSlotMachines');
        const mergedUserMachines = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES), dedupedUserMachines, resolvedGate, 'userSlotMachines');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.USER_SLOT_MACHINES), mergedUserMachines);
        console.log('[DataBundle] Imported user slot machines:', dedupedUserMachines.length);
      }
      if (bundle.machines.deckLocations && Array.isArray(bundle.machines.deckLocations)) {
        const gatedDeckLocations = filterRecordsForProfileGate(bundle.machines.deckLocations, 'deckPlanLocations', resolvedGate, true);
        const adoptedDeckLocations = adoptBackupRecordsForActiveAccount(gatedDeckLocations, email, resolvedGate);
        const dedupedDeckLocations = dedupeByIdOrPayload(adoptedDeckLocations, 'deckPlanLocations');
        const mergedDeckLocations = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS), dedupedDeckLocations, resolvedGate, 'deckPlanLocations');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.DECK_PLAN_LOCATIONS), mergedDeckLocations);
        console.log('[DataBundle] Imported deck plan locations:', dedupedDeckLocations.length);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing machines:', error);
    errors.push(`Failed to import machines: ${error}`);
  }

  try {
    if (bundle.crewRecognition) {
      if (bundle.crewRecognition.entries && Array.isArray(bundle.crewRecognition.entries)) {
        const incomingCrewEntries = bundle.crewRecognition.entries;
        const existingCrewEntries = await loadCrewRecognitionRows<RecognitionEntryWithCrew>(
          ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES,
          email ?? null,
          resolvedGate,
          'crewRecognitionEntries existing records',
        );
        if (incomingCrewEntries.length === 0 && existingCrewEntries.length > 0) {
          console.warn('[DataBundle] Skipped empty crew recognition entry restore to preserve existing crew registry:', {
            existingCrewEntries: existingCrewEntries.length,
          });
        } else {
          const adoptedCrewEntries = incomingCrewEntries;
          const dedupedCrewEntries = dedupeByIdOrPayload(adoptedCrewEntries, 'crewRecognitionEntries');
          imported.crewRecognitionEntries = await saveCrewRecognitionRowsByProfile(
            ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES,
            dedupedCrewEntries,
            existingCrewEntries,
            email ?? null,
            resolvedGate,
            'crewRecognitionEntries',
          );
          console.log('[DataBundle] Imported crew recognition entries:', imported.crewRecognitionEntries);
        }
      }
      if (bundle.crewRecognition.sailings && Array.isArray(bundle.crewRecognition.sailings)) {
        const incomingCrewSailings = bundle.crewRecognition.sailings;
        const existingCrewSailings = await loadCrewRecognitionRows<Sailing>(
          ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS,
          email ?? null,
          resolvedGate,
          'crewRecognitionSailings existing records',
        );
        if (incomingCrewSailings.length === 0 && existingCrewSailings.length > 0) {
          console.warn('[DataBundle] Skipped empty crew sailing restore to preserve existing crew registry:', {
            existingCrewSailings: existingCrewSailings.length,
          });
        } else {
          const adoptedCrewSailings = incomingCrewSailings;
          const dedupedCrewSailings = dedupeByIdOrPayload(adoptedCrewSailings, 'crewRecognitionSailings');
          await saveCrewRecognitionRowsByProfile(
            ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS,
            dedupedCrewSailings,
            existingCrewSailings,
            email ?? null,
            resolvedGate,
            'crewRecognitionSailings',
          );
          console.log('[DataBundle] Imported crew recognition sailings:', dedupedCrewSailings.length);
        }
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing crew recognition:', error);
    errors.push(`Failed to import crew recognition: ${error}`);
  }

  try {
    if (bundle.casinoData) {
      if (bundle.casinoData.bankrollLimits && Array.isArray(bundle.casinoData.bankrollLimits)) {
        const gatedBankrollLimits = filterRecordsForProfileGate(bundle.casinoData.bankrollLimits, 'bankrollLimits', resolvedGate, true);
        const adoptedBankrollLimits = adoptBackupRecordsForActiveAccount(gatedBankrollLimits, email, resolvedGate);
        const dedupedBankrollLimits = dedupeByIdOrPayload(adoptedBankrollLimits, 'bankrollLimits');
        const mergedBankrollLimits = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS), dedupedBankrollLimits, resolvedGate, 'bankrollLimits');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.BANKROLL_LIMITS), mergedBankrollLimits);
        imported.bankrollLimits = dedupedBankrollLimits.length;
        console.log('[DataBundle] Imported bankroll limits:', imported.bankrollLimits);
      }

      if (bundle.casinoData.bankrollAlerts && Array.isArray(bundle.casinoData.bankrollAlerts)) {
        const gatedBankrollAlerts = filterRecordsForProfileGate(bundle.casinoData.bankrollAlerts, 'bankrollAlerts', resolvedGate, true);
        const adoptedBankrollAlerts = adoptBackupRecordsForActiveAccount(gatedBankrollAlerts, email, resolvedGate);
        const dedupedBankrollAlerts = dedupeByIdOrPayload(adoptedBankrollAlerts, 'bankrollAlerts');
        const mergedBankrollAlerts = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS), dedupedBankrollAlerts, resolvedGate, 'bankrollAlerts');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.BANKROLL_ALERTS), mergedBankrollAlerts);
        console.log('[DataBundle] Imported bankroll alerts:', dedupedBankrollAlerts.length);
      }

      if (bundle.casinoData.compItems && Array.isArray(bundle.casinoData.compItems)) {
        const gatedCompItems = filterRecordsForProfileGate(bundle.casinoData.compItems, 'compItems', resolvedGate, true);
        const adoptedCompItems = adoptBackupRecordsForActiveAccount(gatedCompItems, email, resolvedGate);
        const dedupedCompItems = dedupeByIdOrPayload(adoptedCompItems, 'compItems');
        const mergedCompItems = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.COMP_ITEMS), dedupedCompItems, resolvedGate, 'compItems');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.COMP_ITEMS), mergedCompItems);
        imported.compItems = dedupedCompItems.length;
        console.log('[DataBundle] Imported comp items:', imported.compItems);
      }

      if (bundle.casinoData.w2gRecords && Array.isArray(bundle.casinoData.w2gRecords)) {
        const gatedW2GRecords = filterRecordsForProfileGate(bundle.casinoData.w2gRecords, 'w2gRecords', resolvedGate, true);
        const adoptedW2GRecords = adoptBackupRecordsForActiveAccount(gatedW2GRecords, email, resolvedGate);
        const dedupedW2GRecords = dedupeByIdOrPayload(adoptedW2GRecords, 'w2gRecords');
        const mergedW2GRecords = await mergeWithExistingOutsideProfileGate(sk(ALL_STORAGE_KEYS.W2G_RECORDS), dedupedW2GRecords, resolvedGate, 'w2gRecords');
        await quotaSafeSetJsonItem(sk(ALL_STORAGE_KEYS.W2G_RECORDS), mergedW2GRecords);
        imported.w2gRecords = dedupedW2GRecords.length;
        console.log('[DataBundle] Imported W-2G records:', imported.w2gRecords);
      }

      if (bundle.casinoData.casinoOpenHours && typeof bundle.casinoData.casinoOpenHours === 'object') {
        const gatedCasinoOpenHours = filterRecordMapForProfileGate(bundle.casinoData.casinoOpenHours, 'casinoOpenHours', resolvedGate);
        const saveOpenHoursEntries = Object.entries(gatedCasinoOpenHours).map(async ([key, value]) => {
          const scopedKey = resolveImportedDynamicKey(key, CASINO_OPEN_HOURS_STORAGE_PREFIX, email ?? null);
          if (!scopedKey) return;
          await quotaSafeSetJsonItem(scopedKey, value);
        });
        await Promise.all(saveOpenHoursEntries);
        imported.casinoOpenHours = Object.keys(gatedCasinoOpenHours).length;
        console.log('[DataBundle] Imported casino open-hours records:', imported.casinoOpenHours);
      }
    }
  } catch (error) {
    console.error('[DataBundle] Error importing casino detail data:', error);
    errors.push(`Failed to import casino detail data: ${error}`);
  }

  try {
    if (bundle.userPreferences && typeof bundle.userPreferences === 'object') {
      const preferenceOwners = [...new Set([
        email?.toLowerCase().trim(),
        ...(bundle.users ?? []).map((user) => user.id),
      ].filter((value): value is string => Boolean(value)))];
      const restoredCounts = await Promise.all(
        preferenceOwners.map((owner) => restoreUserPreferenceStorage(owner, bundle.userPreferences ?? {})),
      );
      console.log('[DataBundle] Restored owner-scoped user preferences:', restoredCounts.reduce((sum, count) => sum + count, 0));
    }
  } catch (error) {
    errors.push(`Failed to restore user preferences: ${error}`);
  }

  try {
    if (Array.isArray(bundle.provenanceLinks) && bundle.provenanceLinks.length > 0) {
      const allowedPrivateOwners = new Set([
        email?.toLowerCase().trim(),
        ...(bundle.users ?? []).map((user) => user.id),
        resolvedGate.activeProfileId,
        resolvedGate.activeProfileEmail,
      ].filter((value): value is string => Boolean(value)));
      const safeLinks = bundle.provenanceLinks.filter((link) =>
        link.ownerId === null || allowedPrivateOwners.has(link.ownerId),
      );
      if (Platform.OS !== 'web') await storeProvenanceLinks(safeLinks);
      console.log('[DataBundle] Restored field provenance links:', safeLinks.length);
    }
  } catch (error) {
    errors.push(`Failed to restore field provenance: ${error}`);
  }

  try {
    await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.LAST_SYNC), importTimestamp);
    await quotaSafeSetItem(sk(ALL_STORAGE_KEYS.HAS_IMPORTED_DATA), 'true');
    const [restoredInventoryCounts, restoredOfferInstances] = await Promise.all([
      cruiseInventoryRepository.getCounts(getCruiseInventoryOwnerScope(email)),
      hydrateHighVolumeDomain<CasinoOffer>(repositoryOwner, 'casino_offers'),
    ]);
    if ((bundle.cruises?.length ?? 0) > 0 && imported.cruises > 0 && restoredInventoryCounts.sourceTotal !== imported.cruises) {
      throw new Error(`Cruise catalog readback incomplete: committed ${imported.cruises} option rows but the active repository returned ${restoredInventoryCounts.sourceTotal}.`);
    }
    if ((bundle.casinoOffers?.length ?? 0) > 0 && imported.casinoOffers > 0 && restoredOfferInstances.length !== imported.casinoOffers) {
      throw new Error(`Offer catalog readback incomplete: committed ${imported.casinoOffers} offer instances but the active repository returned ${restoredOfferInstances.length}.`);
    }
    const restoredCertificates = parseStoredArray<Certificate>(await quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CERTIFICATES)), 'restored certificates');
    const restoredDocuments = parseStoredArray<CertificateDocumentRecord>(await quotaSafeGetItem(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY), 'restored shared certificate documents');
    const rebuiltManifest = buildAgentSeaSourceManifest({
      cruises: bundle.cruises ?? [],
      offers: bundle.casinoOffers ?? [],
      certificates: restoredCertificates,
      certificateDocuments: restoredDocuments,
      bookedCruises: bundle.bookedCruises ?? [],
      calendarEvents: bundle.calendarEvents ?? [],
      casinoCount: bundle.casinoData?.sessions?.length ?? bundle.casinoSessions?.length ?? 0,
      crewCount: bundle.crewRecognition?.entries?.length ?? 0,
      casinoRecords: bundle.casinoData?.sessions ?? bundle.casinoSessions ?? [],
      crewRecords: bundle.crewRecognition?.entries ?? [],
      provenanceLinks: bundle.provenanceLinks ?? [],
      generatedAt: importTimestamp,
    });
    await quotaSafeSetJsonItem(AGENT_SEA_SOURCE_MANIFEST_KEY, rebuiltManifest);
    const expected = bundle.agentSeaSourceManifest?.certificateSummary;
    if (expected && (
      rebuiltManifest.certificateSummary.certificateCount !== expected.certificateCount
      || rebuiltManifest.certificateSummary.eligibleOptionCount !== expected.eligibleOptionCount
      || rebuiltManifest.certificateSummary.physicalSailingCount !== expected.physicalSailingCount
      || (expected.distributionSignature != null && rebuiltManifest.certificateSummary.distributionSignature !== expected.distributionSignature)
    )) {
      throw new Error(`Certificate index readback incomplete: expected ${expected.certificateCount} codes/${expected.eligibleOptionCount} options/${expected.physicalSailingCount} physical sailings but restored ${rebuiltManifest.certificateSummary.certificateCount}/${rebuiltManifest.certificateSummary.eligibleOptionCount}/${rebuiltManifest.certificateSummary.physicalSailingCount}; distribution match=${rebuiltManifest.certificateSummary.distributionSignature === expected.distributionSignature}.`);
    }
    console.log('[DataBundle] Marked imported backup as latest local state:', importTimestamp);
  } catch (error) {
    errors.push(`Failed to finalize import timestamp: ${error}`);
  }

  const success = errors.length === 0;
  console.log('[DataBundle] Import complete:', { success, imported, errorCount: errors.length });
  
  return { success, imported, errors };
}

export async function getDataSummary(): Promise<{
  cruises: number;
  bookedCruises: number;
  offers: number;
  events: number;
  casinoSessions: number;
  certificates: number;
  hasProfile: boolean;
  hasSettings: boolean;
  hasLoyaltyData: boolean;
  machines: number;
  crewRecognitionEntries: number;
  bankrollLimits: number;
  casinoOpenHours: number;
  compItems: number;
  w2gRecords: number;
}> {
  try {
    const bundle = await getAllStoredData();
    return {
      cruises: bundle.metadata.totalCruises,
      bookedCruises: bundle.metadata.totalBooked,
      offers: bundle.metadata.totalOffers,
      events: bundle.metadata.totalEvents,
      casinoSessions: bundle.metadata.totalSessions,
      certificates: bundle.metadata.totalCertificates,
      hasProfile: bundle.clubRoyaleProfile !== null,
      hasSettings: bundle.settings !== null,
      hasLoyaltyData: bundle.loyaltyData.manualClubRoyalePoints !== null || 
                      bundle.loyaltyData.manualCrownAnchorPoints !== null,
      machines: bundle.metadata.totalMachines,
      crewRecognitionEntries: bundle.metadata.totalCrewEntries,
      bankrollLimits: bundle.metadata.totalBankrollLimits ?? 0,
      casinoOpenHours: bundle.metadata.totalCasinoOpenHours ?? 0,
      compItems: bundle.metadata.totalCompItems ?? 0,
      w2gRecords: bundle.metadata.totalW2GRecords ?? 0,
    };
  } catch (error) {
    console.error('[DataBundle] Error getting data summary:', error);
    return {
      cruises: 0,
      bookedCruises: 0,
      offers: 0,
      events: 0,
      casinoSessions: 0,
      certificates: 0,
      hasProfile: false,
      hasSettings: false,
      hasLoyaltyData: false,
      machines: 0,
      crewRecognitionEntries: 0,
      bankrollLimits: 0,
      casinoOpenHours: 0,
      compItems: 0,
      w2gRecords: 0,
    };
  }
}
