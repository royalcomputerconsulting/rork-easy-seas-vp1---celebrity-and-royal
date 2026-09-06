import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Linking, 
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  Modal,
  Switch,
  LayoutAnimation,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload,
  Trash2, 
  ChevronRight,
  Ship,
  ExternalLink,
  HelpCircle,
  Shield,
  Star,
  FileSpreadsheet,
  Calendar,
  CheckCircle,
  FolderArchive,
  FolderInput,
  Database,
  Save,
  RefreshCcw,
  BookOpen,
  Crown,
  FileDown,
  TrendingDown,
  Users,
  Award,
  Anchor,
  Link2,
  Copy,
  Rss,
  Mail,
  MailQuestion,
  Search,
  X,
  Bell,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import { OperationStatusCard, type OperationFeedback } from '@/components/ui/OperationStatusCard';
import { addCalendarDateDays, isDateInPast, toCalendarDateOnly } from '@/lib/date';
import { isActiveBookedCruise, isCompletedBookedCruise } from '@/lib/bookedCruiseStatus';
import { useAppState } from '@/state/AppStateProvider';
import { useUser } from '@/state/UserProvider';
import { useExperience } from '@/state/ExperienceProvider';
import { 
  pickAndReadFile, 
  parseOffersCSV, 
  parseICSFile, 
  parseBookedCSV,
  generateOffersCSV, 
  generateCalendarICS,
  generateBookedCSV,
  exportFile,
  exportBase64File,
  downloadFromURL,
  healImportedData
} from '@/lib/importExport';
import {
  clearAllAppData,
  exportAllDataToFile,
  importAllDataFromFile,
} from '@/lib/dataManager';
import { getUserScopedKey, ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { quotaSafeGetItem, quotaSafeGetJsonItem } from '@/lib/storage/quotaSafeStorage';
import { verifyBookedCruiseSyncReadback, verifySyncReadback } from '@/lib/sync/syncRunIntegrity';
import { downloadScraperExtension } from '@/lib/chromeExtension';
import { downloadSeaPassGenerator } from '@/lib/seapassGeneratorDownload';
import { generateCalendarFeed, generateFeedToken } from '@/lib/calendar/feedGenerator';
import {
  getImportedSource,
  getImportedSourceLabel,
  mergeImportedBookedCruisesWithReconciliation,
  mergeImportedCruisesWithReconciliation,
  mergeImportedOffersWithReconciliation,
} from '@/lib/importMerge';
import { BACKEND_BASE_URL, isBackendReachable, isCloudBackupEnabled, resetBackendHealthCache, trpc } from '@/lib/trpc';
import { buildDiagnosticExport, recordDiagnosticEvent } from '@/lib/diagnosticLogger';
import { flushDiagnosticJournal, readDiagnosticJournal } from '@/lib/storage/diagnosticJournal';
import { EASYSEAS_DIAGNOSTIC_VERSION } from '@/lib/appVersion';
import { buildCurrentUserSessionLog } from '@/lib/sessionLogExport';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { WorkBook } from 'xlsx';
import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise, ImportReconciliationSummary } from '@/types/models';
import { getCalendarEventsWithGeneratedCruiseEvents } from '@/lib/calendar/cruiseEvents';
import { getImportAssignmentReviewItems } from '@/lib/importAssignmentReview';
import { applyFoundationFields } from '@/lib/dataFoundation';
import {
  buildBookedImportReviewRows,
  buildCalendarImportReviewRows,
  buildOffersImportReviewRows,
  combineReconciliationSummaries,
  createSimpleReconciliationSummary,
  getSmartImportActionLabel,
  type SmartImportReviewRow,
} from '@/lib/importReconciliationReview';

import { useLoyalty } from '@/state/LoyaltyProvider';
import { UserProfileCard } from '@/components/ui/UserProfileCard';

import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { ADMIN_EMAILS, useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { UserManualModal } from '@/components/UserManualModal';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useEntitlement } from '@/state/EntitlementProvider';
import { useCruiseInventory } from '@/hooks/useCruiseInventory';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { emitAppDataEvent } from '@/lib/appDataEvents';
import { useUserDataSync } from '@/state/UserDataSyncProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { getSecondProfileForUnassignedRecords } from '@/lib/intelligenceFilters';
import { ANNUAL_CASINO_REPORT_FACTS } from '@/lib/casinoAnnualReportFacts';
import { SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID } from '@/lib/casino/ownerScopedCasinoHistory';
import { mergeCompletedCruiseHistory } from '@/lib/imports/completedCruiseHistoryMerge';
import { getCasinoCruiseKey } from '@/lib/casinoPointTruth';
import { beginPerformanceSpan, recordPerformanceCount, recordProviderRender } from '@/lib/performance/performanceDiagnostics';
import { cancelAllVoyageNotifications, requestVoyageNotificationPermission } from '@/lib/notifications/localVoyageNotifications';
import { getMarketingOfferInstanceKey, selectAuthoritativeOfferInstances } from '@/lib/offers/offerInstanceIdentity';
import { useCertificates } from '@/state/CertificatesProvider';
import type { UserProfile } from '@/state/UserProvider';

const SCOTT_ASTIN_ALL_BOOKS_URL = 'https://www.amazon.com/stores/author/B0GCQ1S8MH/allbooks?ingress=0&visitId=98cbd411-ac37-4176-92a2-2012b4dd4d59&ccs_id=bcdef9fc-5bc0-4290-9b29-ecfd567751f9';
const ONLY_ON_A_CRUISE_SHIP_URL = 'https://www.amazon.com/dp/B0GYRDTS6L';
const SMOOTH_SAILING_URL = 'https://www.amazon.com/dp/B0G4NG1L2M';

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function normalizeAccountEmail(email: string | null | undefined): string | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  return normalizedEmail.length > 0 ? normalizedEmail : null;
}

function isAdminAccountEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim() as typeof ADMIN_EMAILS[number]);
}

function getOfferInstanceStats(primaryOffers: CasinoOffer[], fallbackOffers: CasinoOffer[], primaryHydrated: boolean): { rows: CasinoOffer[]; uniqueCount: number; keys: string[] } {
  const rows = selectAuthoritativeOfferInstances(primaryOffers, fallbackOffers, primaryHydrated);
  const keys = rows.map(getMarketingOfferInstanceKey);
  return { rows, uniqueCount: rows.length, keys };
}

type OverviewProvider = 'royal' | 'celebrity' | 'carnival';

function getOverviewProvider(record: Pick<CasinoOffer, 'offerSource' | 'sourceProvider' | 'brand' | 'casinoProgram'>): OverviewProvider | null {
  const identity = [record.offerSource, record.sourceProvider, record.brand, record.casinoProgram]
    .map((value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    .join(' ');
  if (/carnival|playersclub/.test(identity)) return 'carnival';
  if (/celebrity|bluechip/.test(identity)) return 'celebrity';
  if (/royal|clubroyale/.test(identity)) return 'royal';
  return null;
}

function isCurrentOverviewOffer(offer: CasinoOffer, now = new Date()): boolean {
  const status = `${offer.status ?? ''} ${offer.archiveStatus ?? ''}`.toLowerCase();
  if (/expired|used|booked|archived|replaced|skipped/.test(status)) return false;
  const expiry = offer.expiryDate ?? offer.expires ?? offer.offerExpiryDate ?? offer.validUntil;
  if (!expiry) return true;
  const expiryTime = Date.parse(`${String(expiry).slice(0, 10)}T23:59:59`);
  return !Number.isFinite(expiryTime) || expiryTime >= now.getTime();
}

function getLocalCarnivalSyncAccess(
  isAuthenticated: boolean,
  profileId: string | null | undefined,
): { enabled: boolean; reason: string } {
  if (!isAuthenticated || !String(profileId ?? '').trim()) {
    return {
      enabled: false,
      reason: 'Sign in and select an EasySeas profile to sync Carnival data.',
    };
  }

  return {
    enabled: true,
    reason: 'Carnival sync is available for this signed-in profile.',
  };
}

type PendingSmartImportReview = {
  title: string;
  fileName: string;
  summary: ImportReconciliationSummary;
  rows: SmartImportReviewRow[];
  applyLabel: string;
  onApply: () => Promise<void>;
};

export default function SettingsScreen() {
  recordProviderRender('SettingsScreen');
  const router = useRouter();
  const { group: requestedSettingsGroup } = useLocalSearchParams<{ group?: string }>();
  const { colors: experienceColors, isDark } = useExperience();
  const entitlement = useEntitlement();
  const { clearLocalData, setLocalData, localData, settings, updateSettings } = useAppState();
  const coreData = useCoreData();
  const { clearAllData, bookedCruises, setCruises, casinoOffers, calendarEvents, setBookedCruises, setCasinoOffers, cruiseInventoryCount, getAllCruises } = coreData;
  const {
    totalCruises: inventoryAvailableCruises,
    totalSourceCruises: inventoryAvailableOptions,
    totalOfferSailingRelationships,
    totalPhysicalSailings: inventoryPhysicalSailings,
    counts: inventoryCounts,
  } = useCruiseInventory();
  const cruises = coreData.cruises;
  const {
    currentUser,
    updateUser,
    addUser,
    ensureOwner,
    syncFromStorage: syncUserFromStorage,
    isLoading: isUserLoading,
    users,
    switchUser,
  } = useUser();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    crownAnchorPoints: loyaltyCrownAnchorPoints,
    crownAnchorLevel: loyaltyCrownAnchorLevel,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    clubRoyaleTierValidThrough: loyaltyClubRoyaleTierValidThrough,
    setManualClubRoyalePoints,
    setManualCrownAnchorPoints,
    syncFromStorage: syncLoyaltyFromStorage,
    extendedLoyalty,
    venetianSociety,
    captainsClub,
    blueChip,
  } = useLoyalty();
  
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<{ type: string; count: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingCertificates, setIsExportingCertificates] = useState(false);
  const [certificateExportProgress, setCertificateExportProgress] = useState<{ percent: number; message: string } | null>(null);
  const [dataOperation, setDataOperation] = useState<OperationFeedback | null>(null);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [isImportingLegacyBackup, setIsImportingLegacyBackup] = useState(false);
  const [isDownloadingExtension, setIsDownloadingExtension] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDownloadingSeaPass, setIsDownloadingSeaPass] = useState(false);
  const [isCheckingCloudSync, setIsCheckingCloudSync] = useState(false);
  const [isExportingAppLog, setIsExportingAppLog] = useState(false);
  const [isExportingSessionLog, setIsExportingSessionLog] = useState(false);

  const [isImportingMachines, setIsImportingMachines] = useState(false);
  const [isExportingMachines, setIsExportingMachines] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [isUserManualVisible, setIsUserManualVisible] = useState(false);
  const [calendarFeedToken, setCalendarFeedToken] = useState<string | null>(null);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [isPublishingFeed, setIsPublishingFeed] = useState(false);
  const [feedLastUpdated, setFeedLastUpdated] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [pendingSmartImportReview, setPendingSmartImportReview] = useState<PendingSmartImportReview | null>(null);
  const [isCredentialEnrollmentVisible, setIsCredentialEnrollmentVisible] = useState(false);
  const [credentialPin, setCredentialPin] = useState('');
  const [credentialPinConfirmation, setCredentialPinConfirmation] = useState('');
  const [isEnrollingCredential, setIsEnrollingCredential] = useState(false);
  const [isUpdatingNotificationPreference, setIsUpdatingNotificationPreference] = useState(false);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const [activeSettingsGroup, setActiveSettingsGroup] = useState('Security');
  // UserProfileCard is a deliberately rich editor. Mounting it together with
  // every Settings tool exhausted the web renderer on tab entry. Keep the
  // Account summary lightweight and mount the editor only after a direct tap.
  const [isAccountDetailsVisible, setIsAccountDetailsVisible] = useState(true);

  const { myAtlasMachines, exportMachinesJSON, importMachinesJSON, reload: reloadMachines } = useSlotMachineLibrary();
  const { reload: reloadCasinoSessions } = useCasinoSessions();
  const {
    isAuthenticated,
    isAdmin,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    updateEmail,
    authenticatedEmail,
    requiresCredentialEnrollment,
    enrollDeviceCredential,
    logout,
  } = useAuth();
  const { stats: crewStats } = useCrewRecognition();
  const { searchableCertificates, loadSearchableCertificates } = useCertificates();
  const { forceSyncNow: forceProfileSyncNow, isSyncing: isCloudSyncing, lastSyncTime, syncError: cloudSyncError } = useUserDataSync();
  const { selectedProfileId, setSelectedProfileId } = useIntelligenceFilters();
  const linkedProfileEnsuredRef = useRef(false);
  const settingsScrollRef = useRef<ScrollView | null>(null);
  const settingsActionsYRef = useRef(0);

  const revealSettingsGroup = useCallback((group: string) => {
    setSettingsSearchQuery('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveSettingsGroup(group);
    requestAnimationFrame(() => {
      settingsScrollRef.current?.scrollTo({ y: Math.max(0, settingsActionsYRef.current - 8), animated: true });
    });
  }, []);

  useEffect(() => {
    if (requestedSettingsGroup === 'Admin' && isAdmin) setActiveSettingsGroup('Admin');
  }, [isAdmin, requestedSettingsGroup]);

  const normalizedAuthenticatedEmail = useMemo(() => normalizeAccountEmail(authenticatedEmail), [authenticatedEmail]);
  // Carnival sync is local to the signed-in EasySeas profile and must remain
  // available while the optional backend is offline.
  const carnivalSyncAccess = useMemo(
    () => getLocalCarnivalSyncAccess(isAuthenticated, currentUser?.id),
    [currentUser?.id, isAuthenticated],
  );
  const activeUserProfiles = useMemo(() => users.filter((profile) => profile.active !== false), [users]);
  const primaryProfileUser = useMemo(() => {
    if (currentUser) {
      return currentUser;
    }

    return activeUserProfiles.find((profile) => profile.isOwner || normalizeAccountEmail(profile.email) === normalizedAuthenticatedEmail)
      ?? activeUserProfiles[0]
      ?? null;
  }, [activeUserProfiles, currentUser, normalizedAuthenticatedEmail]);
  const linkedSecondProfile = useMemo(() => getSecondProfileForUnassignedRecords(activeUserProfiles), [activeUserProfiles]);
  const selectedSettingsProfile = useMemo(() => {
    if (selectedProfileId !== 'all' && selectedProfileId !== 'unassigned') {
      const explicitProfile = activeUserProfiles.find((profile) => profile.id === selectedProfileId);
      if (explicitProfile) {
        return explicitProfile;
      }
    }

    if (selectedProfileId === 'unassigned' && linkedSecondProfile) {
      return linkedSecondProfile;
    }

    return primaryProfileUser;
  }, [activeUserProfiles, linkedSecondProfile, primaryProfileUser, selectedProfileId]);
  const normalizedSelectedProfileEmail = useMemo(() => normalizeAccountEmail(selectedSettingsProfile?.email), [selectedSettingsProfile?.email]);
  const profileDisplayUser = useMemo(() => {
    if (!selectedSettingsProfile) {
      return null;
    }

    const isPrimaryProfile = selectedSettingsProfile.id === primaryProfileUser?.id;
    if (isPrimaryProfile && normalizedAuthenticatedEmail && normalizedSelectedProfileEmail && normalizedSelectedProfileEmail !== normalizedAuthenticatedEmail) {
      console.log('[Settings] Hiding stale profile values while account storage catches up:', {
        authenticatedEmail: normalizedAuthenticatedEmail,
        profileEmail: normalizedSelectedProfileEmail,
      });
      return null;
    }

    return selectedSettingsProfile;
  }, [normalizedAuthenticatedEmail, normalizedSelectedProfileEmail, primaryProfileUser?.id, selectedSettingsProfile]);
  const isPrimaryProfileSelected = profileDisplayUser?.id === primaryProfileUser?.id;
  const activeProfileSlot = linkedSecondProfile && profileDisplayUser?.id === linkedSecondProfile.id ? 'secondary' : 'primary';
  const isProfileDisplayReady = true;



  const loadWhitelist = useCallback(async () => {
    try {
      setIsLoadingWhitelist(true);
      const list = await getWhitelist();
      setWhitelist(list);
      console.log('[Settings] Loaded whitelist:', list);
    } catch (error) {
      console.error('[Settings] Error loading whitelist:', error);
    } finally {
      setIsLoadingWhitelist(false);
    }
  }, [getWhitelist]);

  useEffect(() => {
    if (isAdmin) {
      void loadWhitelist();
    }
  }, [isAdmin, loadWhitelist]);

  useEffect(() => {
    if (!authenticatedEmail || isUserLoading || currentUser) {
      return;
    }

    console.log('[Settings] Profile missing for authenticated email, ensuring owner profile:', authenticatedEmail);
    ensureOwner().catch((error) => {
      console.error('[Settings] Failed to ensure owner profile:', error);
    });
  }, [authenticatedEmail, currentUser, ensureOwner, isUserLoading]);

  useEffect(() => {
    if (isUserLoading || !authenticatedEmail || !primaryProfileUser || linkedSecondProfile || linkedProfileEnsuredRef.current) {
      return;
    }

    linkedProfileEnsuredRef.current = true;
    addUser({ name: 'Second User', email: authenticatedEmail })
      .then((createdProfile) => {
        console.log('[Settings] Created linked second profile for filtering:', createdProfile.id);
        if (selectedProfileId === 'unassigned') {
          setSelectedProfileId(createdProfile.id);
        }
      })
      .catch((error) => {
        linkedProfileEnsuredRef.current = false;
        console.error('[Settings] Failed to create linked second profile:', error);
      });
  }, [addUser, authenticatedEmail, isUserLoading, linkedSecondProfile, primaryProfileUser, selectedProfileId, setSelectedProfileId]);

  useEffect(() => {
    if (!linkedSecondProfile || linkedSecondProfile.name !== 'Unassigned') {
      return;
    }

    updateUser(linkedSecondProfile.id, {
      name: 'Second User',
      displayName: 'Second User',
      relationshipLabel: 'Second User',
    }).catch((error) => {
      console.error('[Settings] Failed to rename linked second profile:', error);
    });
  }, [linkedSecondProfile, updateUser]);

  const handleProfileSlotPress = useCallback((slot: 'primary' | 'secondary') => {
    if (slot === 'secondary') {
      const targetId = linkedSecondProfile?.id;
      setSelectedProfileId(targetId ?? 'unassigned');
      if (targetId) void switchUser(targetId);
      return;
    }

    if (primaryProfileUser) {
      setSelectedProfileId(primaryProfileUser.id);
      void switchUser(primaryProfileUser.id);
    }
  }, [linkedSecondProfile?.id, primaryProfileUser, setSelectedProfileId, switchUser]);

  const handleAddToWhitelist = async () => {
    if (!newWhitelistEmail.trim() || !newWhitelistEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      await addToWhitelist(newWhitelistEmail.trim());
      await loadWhitelist();
      setNewWhitelistEmail('');
      Alert.alert('Success', `${newWhitelistEmail.trim()} now has Free Use of App access.`);
    } catch (error) {
      console.error('[Settings] Error adding to whitelist:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add email to whitelist.');
    }
  };

  const handleRemoveFromWhitelist = async (email: string) => {
    Alert.alert(
      'Remove Email',
      `Remove Free Use of App access for ${email}? They will need an active subscription unless they are an admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromWhitelist(email);
              await loadWhitelist();
              Alert.alert('Success', `Removed Free Use of App access for ${email}.`);
            } catch (error) {
              console.error('[Settings] Error removing from whitelist:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to remove email from whitelist.');
            }
          },
        },
      ]
    );
  };

  const currentProfileValues = useMemo(() => {
    const hasManualProfileLoyalty = Boolean(profileDisplayUser?.loyaltyManualOverrideAt);
    const savedClubRoyalePoints = profileDisplayUser?.clubRoyalePoints ?? 0;
    const savedCrownAnchorPoints = profileDisplayUser?.loyaltyPoints ?? 0;
    const savedClubRoyaleTier = profileDisplayUser?.clubRoyaleTier || '';
    const savedCrownAnchorLevel = profileDisplayUser?.crownAnchorLevel || '';
    const displayedClubRoyalePoints = isPrimaryProfileSelected
      ? loyaltyClubRoyalePoints
      : savedClubRoyalePoints;
    const displayedCrownAnchorPoints = isPrimaryProfileSelected
      ? loyaltyCrownAnchorPoints
      : savedCrownAnchorPoints;

    return {
    name: profileDisplayUser?.name || '',
    email: profileDisplayUser?.email || authenticatedEmail || '',
    crownAnchorNumber: profileDisplayUser?.crownAnchorNumber || '',
    clubRoyalePoints: hasManualProfileLoyalty || displayedClubRoyalePoints > 0 ? displayedClubRoyalePoints : (isPrimaryProfileSelected ? loyaltyClubRoyalePoints : 0),
    clubRoyaleTier: isPrimaryProfileSelected ? loyaltyClubRoyaleTier : savedClubRoyaleTier,
    clubRoyaleTierValidThrough: isPrimaryProfileSelected
      ? loyaltyClubRoyaleTierValidThrough || profileDisplayUser?.clubRoyaleTierValidThrough || ''
      : profileDisplayUser?.clubRoyaleTierValidThrough || '',
    loyaltyPoints: hasManualProfileLoyalty || displayedCrownAnchorPoints > 0 ? displayedCrownAnchorPoints : (isPrimaryProfileSelected ? loyaltyCrownAnchorPoints : 0),
    crownAnchorLevel: isPrimaryProfileSelected ? loyaltyCrownAnchorLevel : savedCrownAnchorLevel,
    celebrityEmail: profileDisplayUser?.celebrityEmail || '',
    celebrityCaptainsClubNumber: profileDisplayUser?.celebrityCaptainsClubNumber || '',
    celebrityCaptainsClubPoints: isPrimaryProfileSelected
      ? (captainsClub?.points ?? profileDisplayUser?.celebrityCaptainsClubPoints ?? 0)
      : profileDisplayUser?.celebrityCaptainsClubPoints ?? 0,
    celebrityBlueChipPoints: isPrimaryProfileSelected
      ? (blueChip?.points ?? profileDisplayUser?.celebrityBlueChipPoints ?? 0)
      : profileDisplayUser?.celebrityBlueChipPoints ?? 0,
    celebrityBlueChipTier: isPrimaryProfileSelected
      ? (blueChip?.tier || extendedLoyalty?.celebrityBlueChipTier || profileDisplayUser?.celebrityBlueChipTier || 'Pearl')
      : (profileDisplayUser?.celebrityBlueChipTier || 'Pearl'),
    celebrityCaptainsClubLevel: isPrimaryProfileSelected
      ? (captainsClub?.tier || extendedLoyalty?.captainsClubTier || profileDisplayUser?.celebrityCaptainsClubTier || 'Preview')
      : (profileDisplayUser?.celebrityCaptainsClubTier || 'Preview'),
    preferredBrand: profileDisplayUser?.preferredBrand || 'royal',
    silverseaEmail: profileDisplayUser?.silverseaEmail || '',
    silverseaVenetianNumber: profileDisplayUser?.silverseaVenetianNumber || '',
    silverseaVenetianTier: profileDisplayUser?.silverseaVenetianTier || '',
    silverseaVenetianPoints: profileDisplayUser?.silverseaVenetianPoints || 0,
    carnivalVifpNumber: profileDisplayUser?.carnivalVifpNumber || '',
    carnivalVifpTier: profileDisplayUser?.carnivalVifpTier || '',
    carnivalPlayersClubTier: profileDisplayUser?.carnivalPlayersClubTier || '',
    carnivalPlayersClubPoints: profileDisplayUser?.carnivalPlayersClubPoints || 0,
    birthdate: profileDisplayUser?.birthdate || '',
  };
  }, [
    authenticatedEmail,
    blueChip,
    captainsClub,
    extendedLoyalty,
    loyaltyClubRoyalePoints,
    loyaltyClubRoyaleTier,
    loyaltyClubRoyaleTierValidThrough,
    loyaltyCrownAnchorLevel,
    isPrimaryProfileSelected,
    loyaltyCrownAnchorPoints,
    profileDisplayUser,
  ]);



  const enrichmentData = useMemo(() => {
    if (!isProfileDisplayReady || !isPrimaryProfileSelected) return null;
    if (!extendedLoyalty && !profileDisplayUser?.carnivalVifpNumber) return null;

    return {
      accountId: extendedLoyalty?.accountId,

      crownAndAnchorId: extendedLoyalty?.crownAndAnchorId,
      crownAndAnchorTier: extendedLoyalty?.crownAndAnchorTier,
      crownAndAnchorNextTier: extendedLoyalty?.crownAndAnchorNextTier,
      crownAndAnchorRemainingPoints: extendedLoyalty?.crownAndAnchorRemainingPoints,
      crownAndAnchorTrackerPercentage: extendedLoyalty?.crownAndAnchorTrackerPercentage,
      crownAndAnchorRelationshipPointsFromApi: extendedLoyalty?.crownAndAnchorRelationshipPointsFromApi,
      crownAndAnchorLoyaltyMatchTier: extendedLoyalty?.crownAndAnchorLoyaltyMatchTier,

      clubRoyaleTierFromApi: extendedLoyalty?.clubRoyaleTierFromApi,
      clubRoyalePointsFromApi: extendedLoyalty?.clubRoyalePointsFromApi,
      clubRoyaleRelationshipPointsFromApi: extendedLoyalty?.clubRoyaleRelationshipPointsFromApi,

      captainsClubId: extendedLoyalty?.captainsClubId,
      captainsClubTier: captainsClub?.tier || extendedLoyalty?.captainsClubTier,
      captainsClubPoints: captainsClub?.points ?? extendedLoyalty?.captainsClubPoints,
      captainsClubRelationshipPoints: extendedLoyalty?.captainsClubRelationshipPoints,
      captainsClubNextTier: captainsClub?.nextTier || extendedLoyalty?.captainsClubNextTier,
      captainsClubRemainingPoints: captainsClub?.remainingPoints || extendedLoyalty?.captainsClubRemainingPoints,
      captainsClubTrackerPercentage: captainsClub?.trackerPercentage || extendedLoyalty?.captainsClubTrackerPercentage,
      captainsClubLoyaltyMatchTier: extendedLoyalty?.captainsClubLoyaltyMatchTier,

      celebrityBlueChipTier: blueChip?.tier || extendedLoyalty?.celebrityBlueChipTier,
      celebrityBlueChipPoints: blueChip?.points ?? extendedLoyalty?.celebrityBlueChipPoints,
      celebrityBlueChipRelationshipPoints: extendedLoyalty?.celebrityBlueChipRelationshipPoints,

      venetianSocietyTier: venetianSociety?.tier || extendedLoyalty?.venetianSocietyTier,
      venetianSocietyNextTier: venetianSociety?.nextTier || extendedLoyalty?.venetianSocietyNextTier,
      venetianSocietyMemberNumber: venetianSociety?.memberNumber || extendedLoyalty?.venetianSocietyMemberNumber,
      venetianSocietyEnrolled: venetianSociety?.enrolled || extendedLoyalty?.venetianSocietyEnrolled,
      venetianSocietyLoyaltyMatchTier: extendedLoyalty?.venetianSocietyLoyaltyMatchTier,

      carnivalVifpTier: profileDisplayUser?.carnivalVifpTier,
      carnivalVifpNumber: profileDisplayUser?.carnivalVifpNumber,
      carnivalPlayersClubTier: profileDisplayUser?.carnivalPlayersClubTier,
      carnivalPlayersClubPoints: profileDisplayUser?.carnivalPlayersClubPoints,

      hasCoBrandCard: extendedLoyalty?.hasCoBrandCard,
      coBrandCardStatus: extendedLoyalty?.coBrandCardStatus,
      coBrandCardErrorMessage: extendedLoyalty?.coBrandCardErrorMessage,
    };
  }, [blueChip?.points, blueChip?.tier, captainsClub, extendedLoyalty, isPrimaryProfileSelected, isProfileDisplayReady, profileDisplayUser, venetianSociety]);

  const dataStats = useMemo(() => {
    const finishDataStatsDiagnostic = beginPerformanceSpan('SettingsScreen.dataStats', {
      cruisesLoadedIntoJS: cruises.length,
      localCruisesLoadedIntoJS: localData.cruises?.length ?? 0,
    });
    const offerStats = getOfferInstanceStats(casinoOffers, localData.offers || [], !coreData.isLoading);
    const allOffers = offerStats.rows;
    const uniqueOfferCount = offerStats.uniqueCount;
    const currentOffersByProvider = allOffers.reduce<Record<OverviewProvider, number>>((counts, offer) => {
      if (!isCurrentOverviewOffer(offer)) return counts;
      const provider = getOverviewProvider(offer);
      if (provider) counts[provider] += 1;
      return counts;
    }, { royal: 0, celebrity: 0, carnival: 0 });
    const currentOfferCount = currentOffersByProvider.royal + currentOffersByProvider.celebrity + currentOffersByProvider.carnival;
    
    console.log('[Settings] Data stats calculation:', {
      totalOffers: allOffers.length,
      providerOffers: casinoOffers.length,
      localOffers: localData.offers?.length ?? 0,
      // Never write every offer key to the console. A restored catalog can
      // contain thousands of rows and serializing that diagnostic was enough
      // to exhaust the web preview renderer when Settings opened.
      offerKeySample: offerStats.keys.slice(0, 5),
      omittedOfferKeys: Math.max(0, offerStats.keys.length - 5),
      uniqueCount: uniqueOfferCount,
    });
    
    const allBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
    const upcoming = allBooked.filter(c => isActiveBookedCruise(c)).length;
    const completed = allBooked.filter(c => isCompletedBookedCruise(c)).length;
    const royalBookedRecords = allBooked.filter((c) => {
      const source = String(c.cruiseSource ?? '').toLowerCase();
      const shipName = String(c.shipName ?? '').toLowerCase();
      return source === 'royal' || (!source && shipName.includes('of the seas'));
    });
    const royalBooked = royalBookedRecords.filter(c => isActiveBookedCruise(c)).length;
    const royalCompleted = royalBookedRecords.filter(c => isCompletedBookedCruise(c)).length;
    const storedEvents = calendarEvents.length > 0 ? calendarEvents : (localData.calendar || []);
    const eventRecords = [...storedEvents, ...(localData.tripit || [])];
    const eventCount = new Set(eventRecords.map((event, index) => String(event.id || `${event.title}-${event.startDate}-${index}`))).size;

    const result = {
      cruises: inventoryAvailableOptions || inventoryAvailableCruises || cruiseInventoryCount || cruises.length || 0,
      physicalSailings: inventoryPhysicalSailings,
      booked: upcoming,
      upcoming,
      completed,
      royalBooked,
      royalCompleted,
      royalImported: royalBookedRecords.length,
      sailings: totalOfferSailingRelationships || inventoryAvailableOptions || inventoryAvailableCruises || allOffers.length,
      uniqueOffers: currentOfferCount,
      events: eventCount,
      machines: myAtlasMachines.length || 0,
      crewMembers: crewStats?.crewMemberCount || 0,
      crewRecognitionEntries: crewStats?.recognitionEntryCount || 0,
      royalOffers: currentOffersByProvider.royal,
      celebrityOffers: currentOffersByProvider.celebrity,
      carnivalOffers: currentOffersByProvider.carnival,
      royalAvailable: inventoryCounts.byProvider.royal ?? 0,
      celebrityAvailable: inventoryCounts.byProvider.celebrity ?? 0,
      carnivalAvailable: inventoryCounts.byProvider.carnival ?? 0,
    };
    finishDataStatsDiagnostic({ aggregateCruiseCount: result.cruises });
    recordPerformanceCount('SettingsScreen.databaseQueryRows', 0, {
      note: 'legacy aggregate still derived from hydrated arrays',
    });
    return result;
  }, [coreData.isLoading, cruiseInventoryCount, cruises.length, bookedCruises, casinoOffers, calendarEvents, inventoryAvailableCruises, inventoryAvailableOptions, inventoryPhysicalSailings, inventoryCounts.byProvider, localData.booked, localData.calendar, localData.cruises?.length, localData.offers, localData.tripit, myAtlasMachines.length, crewStats, totalOfferSailingRelationships]);

  const importAssignmentReviewCount = useMemo(() => {
    const reviewItems = getImportAssignmentReviewItems({
      offers: casinoOffers.length > 0 ? casinoOffers : (localData.offers || []),
      // Master inventory is owner-scoped in SQLite and no longer participates
      // in a render-time assignment scan across every Settings render.
      cruises: [],
      bookedCruises: bookedCruises.length > 0 ? bookedCruises : (localData.booked || []),
      calendarEvents: localData.calendar || [],
      users,
    });
    return reviewItems.length;
  }, [bookedCruises, casinoOffers, localData.booked, localData.calendar, localData.offers, users]);

  const handleImportOffersCSV = useCallback(async () => {
    try {
      setIsImporting(true);
      setLastImportResult(null);
      console.log('[Settings] Starting offers CSV import');
      
      const result = await pickAndReadFile('csv');
      if (!result) {
        console.log('[Settings] Import cancelled');
        setIsImporting(false);
        return;
      }

      console.log('[Settings] File selected:', result.fileName);
      const { cruises: rawCruises, offers: rawOffers } = parseOffersCSV(result.content);
      
      if (rawCruises.length === 0) {
        Alert.alert('Import Failed', 'No valid cruise data found in the CSV file. Please check the file format.');
        setIsImporting(false);
        return;
      }

      console.log('[Settings] Running data healing pass...');
      const { cruises: parsedCruises, offers: parsedOffers, report: healingReport } = healImportedData(rawCruises, rawOffers);
      console.log('[Settings] Data healing complete:', {
        cruisesHealed: healingReport.cruisesHealed,
        offersHealed: healingReport.offersHealed,
        fieldsFixed: healingReport.fieldsFixed.length,
      });

      const existingCruises = await getAllCruises();
      const existingOffers = casinoOffers.length > 0 ? casinoOffers : (localData.offers || []);
      const importedSource = getImportedSource({ cruises: parsedCruises, offers: parsedOffers });
      const importOwnerOptions = {
        ownerProfileId: currentUser?.id ?? normalizedAuthenticatedEmail,
        sourceEmail: authenticatedEmail ?? currentUser?.email ?? normalizedAuthenticatedEmail,
        knownProfiles: users,
      };
      const cruisesMergeResult = mergeImportedCruisesWithReconciliation(existingCruises, parsedCruises, importOwnerOptions);
      const offersMergeResult = mergeImportedOffersWithReconciliation(existingOffers, parsedOffers, importOwnerOptions);
      const mergedCruises = cruisesMergeResult.merged;
      const mergedOffers = offersMergeResult.merged;
      const assignmentReviewCount = getImportAssignmentReviewItems({
        offers: mergedOffers,
        cruises: mergedCruises,
        bookedCruises: [],
        calendarEvents: [],
        users,
      }).length;
      const reviewNeededCount = cruisesMergeResult.reconciliation.reviewNeededItems + offersMergeResult.reconciliation.reviewNeededItems;
      const overlapCount = cruisesMergeResult.reconciliation.duplicateOverlappingSailings + offersMergeResult.reconciliation.duplicateOverlappingSailings;
      const suggestedArchiveCount = cruisesMergeResult.reconciliation.suggestedArchiveRows + offersMergeResult.reconciliation.suggestedArchiveRows;

      console.log('[Settings] Merged imported offers CSV:', {
        importedSource,
        existingCruises: existingCruises.length,
        existingOffers: existingOffers.length,
        parsedCruises: parsedCruises.length,
        parsedOffers: parsedOffers.length,
        mergedCruises: mergedCruises.length,
        mergedOffers: mergedOffers.length,
        cruiseReconciliation: cruisesMergeResult.reconciliation,
        offerReconciliation: offersMergeResult.reconciliation,
      });

      const sourceLabel = getImportedSourceLabel(importedSource);
      const healNote = healingReport.fieldsFixed.length > 0 ? `\n\nData healing repaired ${countLabel(healingReport.fieldsFixed.length, 'field')}.` : '';
      const reconciliationNote = reviewNeededCount > 0 || overlapCount > 0 || suggestedArchiveCount > 0
        ? `\n\nReconciliation: ${countLabel(reviewNeededCount, 'item')} need${reviewNeededCount === 1 ? 's' : ''} review, ${countLabel(overlapCount, 'overlapping sailing')} preserved, and ${countLabel(suggestedArchiveCount, 'missing row')} flagged instead of deleted.`
        : '';
      const assignmentNote = assignmentReviewCount > 0 ? `\n\nImport assignment: ${countLabel(assignmentReviewCount, 'item')} need${assignmentReviewCount === 1 ? 's' : ''} an account or profile assignment.` : '';
      setPendingSmartImportReview({
        title: `${sourceLabel} Offers Import Review`,
        fileName: result.fileName,
        summary: combineReconciliationSummaries([cruisesMergeResult.reconciliation, offersMergeResult.reconciliation]),
        rows: buildOffersImportReviewRows({
          existingCruises,
          importedCruises: parsedCruises,
          existingOffers,
          importedOffers: parsedOffers,
          mergedCruises,
          mergedOffers,
          maxRows: 250,
        }),
        applyLabel: `Apply ${countLabel(parsedCruises.length + parsedOffers.length, 'row')}`,
        onApply: async () => {
          try {
            setIsImporting(true);
            setDataOperation({
              id: 'import-offers',
              title: 'Import offers and sailings',
              status: 'running',
              message: 'Committing reviewed offer and eligible-sailing rows to this account.',
              current: 0,
              total: 2,
              committed: false,
              startedAt: new Date().toISOString(),
            });
            console.log('[Settings] Applying reviewed offers import:', { fileName: result.fileName, cruises: parsedCruises.length, offers: parsedOffers.length });
            await setCruises(mergedCruises);
            await setCasinoOffers(mergedOffers);
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');

            setDataOperation((current) => current?.id === 'import-offers'
              ? { ...current, current: 1, committed: true, message: 'Writes completed. Verifying eligible sailings and offer instances from durable storage.' }
              : current);
            const [persistedCruises, persistedOffers] = await Promise.all([
              getAllCruises(),
              quotaSafeGetJsonItem<CasinoOffer[]>(getUserScopedKey(ALL_STORAGE_KEYS.CASINO_OFFERS, authenticatedEmail), []),
            ]);
            const cruiseReadback = verifySyncReadback(parsedCruises, persistedCruises);
            const offerReadback = verifySyncReadback(parsedOffers, persistedOffers ?? []);
            if (!cruiseReadback.complete || !offerReadback.complete) {
              throw new Error(
                `Import readback was incomplete: ${cruiseReadback.matchedRows}/${cruiseReadback.expectedRows} sailing rows and ${offerReadback.matchedRows}/${offerReadback.expectedRows} offers were verified.`,
              );
            }
            setLastImportResult({ type: 'offers', count: cruiseReadback.matchedRows });
            setPendingSmartImportReview(null);
            setDataOperation((current) => current?.id === 'import-offers'
              ? {
                  ...current,
                  status: 'success',
                  current: 2,
                  committed: true,
                  completedAt: new Date().toISOString(),
                  message: `Verified ${cruiseReadback.matchedRows.toLocaleString()} eligible sailing rows and ${offerReadback.matchedRows.toLocaleString()} offers in this account.`,
                }
              : current);
            Alert.alert(
              'Import Applied',
              `${sourceLabel} import committed and verified ${cruiseReadback.matchedRows} cruises and ${offerReadback.matchedRows} offers from ${result.fileName}.${healNote}${reconciliationNote}${assignmentNote}`,
              assignmentReviewCount > 0
                ? [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                  ]
                : undefined
            );
            console.log('[Settings] Reviewed import applied:', parsedCruises.length, 'cruises,', parsedOffers.length, 'offers');
          } catch (applyError) {
            console.error('[Settings] Failed to apply reviewed offers import:', applyError);
            const message = applyError instanceof Error ? applyError.message : 'The reviewed import could not be applied.';
            setDataOperation((current) => current?.id === 'import-offers'
              ? { ...current, status: 'error', completedAt: new Date().toISOString(), message }
              : current);
            Alert.alert('Apply Failed', `${message} Existing saved data was not reported as successfully imported.`);
          } finally {
            setIsImporting(false);
          }
        },
      });
      console.log('[Settings] Prepared smart import review:', parsedCruises.length, 'cruises,', parsedOffers.length, 'offers');
    } catch (error) {
      console.error('[Settings] Import error:', error);
      
      let errorMessage = 'Failed to import the file. Please check the file format and try again.';
      
      if (error && typeof error === 'object' && 'validationErrors' in error) {
        const validationErrors = (error as any).validationErrors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          const firstError = validationErrors[0];
          errorMessage = firstError.message || errorMessage;
          if (firstError.suggestions && firstError.suggestions.length > 0) {
            errorMessage += '\n\nSuggestions:\n' + firstError.suggestions.join('\n');
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Import Error', errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [authenticatedEmail, casinoOffers, currentUser?.email, currentUser?.id, getAllCruises, localData.offers, normalizedAuthenticatedEmail, router, setCruises, setCasinoOffers, setLocalData, users]);

  const fetchICSMutation = trpc.calendar.fetchICS.useMutation();
  const saveCalendarFeedMutation = trpc.calendar.saveCalendarFeed.useMutation();

  useEffect(() => {
    const loadFeedToken = async () => {
      try {
        const stored = await AsyncStorage.getItem('easyseas_calendar_feed_token');
        if (stored) {
          setCalendarFeedToken(stored);
          setCalendarFeedUrl(`${BACKEND_BASE_URL}/api/calendar-feed/${stored}`);
          const lastUpdate = await AsyncStorage.getItem('easyseas_calendar_feed_updated');
          if (lastUpdate) setFeedLastUpdated(lastUpdate);
          console.log('[Settings] Loaded calendar feed token:', stored.slice(0, 8) + '...');
        }
      } catch (error) {
        console.error('[Settings] Error loading feed token:', error);
      }
    };
    void loadFeedToken();
  }, []);

  const handlePublishCalendarFeed = useCallback(async () => {
    const email = currentUser?.email;
    if (!email) {
      Alert.alert('Profile Required', 'Please set your email in your profile before publishing a calendar feed.');
      return;
    }

    try {
      setIsPublishingFeed(true);
      console.log('[Settings] Publishing calendar feed...');

      let token = calendarFeedToken;
      if (!token) {
        token = generateFeedToken();
        setCalendarFeedToken(token);
        await AsyncStorage.setItem('easyseas_calendar_feed_token', token);
        console.log('[Settings] Generated new feed token:', token.slice(0, 8) + '...');
      }

      const allBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
      const allEvents = localData.calendar || [];
      console.log('[Settings] Generating ICS from', allBooked.length, 'cruises and', allEvents.length, 'events');

      const icsContent = generateCalendarFeed(allBooked, allEvents);

      await saveCalendarFeedMutation.mutateAsync({
        email,
        token,
        icsContent,
      });

      const feedUrl = `${BACKEND_BASE_URL}/api/calendar-feed/${token}`;
      setCalendarFeedUrl(feedUrl);
      const now = new Date().toISOString();
      setFeedLastUpdated(now);
      await AsyncStorage.setItem('easyseas_calendar_feed_updated', now);

      console.log('[Settings] Calendar feed published successfully:', feedUrl);
      Alert.alert(
        'Calendar Feed Published',
        `Your calendar feed is live with ${allBooked.length} cruises.\n\nYou can now subscribe to this feed from any calendar app (Apple Calendar, Google Calendar, Outlook, etc.).\n\nTap "Copy URL" to copy the feed link.`
      );
    } catch (error) {
      console.error('[Settings] Publish feed error:', error);
      Alert.alert('Publish Failed', 'Failed to publish calendar feed. Please check your internet connection and try again.');
    } finally {
      setIsPublishingFeed(false);
    }
  }, [calendarFeedToken, currentUser, bookedCruises, localData, saveCalendarFeedMutation]);

  const handleCopyFeedUrl = useCallback(async () => {
    if (!calendarFeedUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(calendarFeedUrl);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      console.log('[Settings] Calendar feed URL copied to clipboard');
    } catch (error) {
      console.error('[Settings] Copy error:', error);
      Alert.alert('Feed URL', calendarFeedUrl);
    }
  }, [calendarFeedUrl]);

  const handleSubscribeToFeed = useCallback(() => {
    if (!calendarFeedUrl) return;
    const webcalUrl = calendarFeedUrl.replace(/^https?:\/\//, 'webcal://');
    console.log('[Settings] Opening webcal URL:', webcalUrl);
    Linking.openURL(webcalUrl).catch(() => {
      Alert.alert(
        'Subscribe to Calendar',
        `Copy this URL and add it as a calendar subscription in your calendar app:\n\n${calendarFeedUrl}`,
        [
          { text: 'Copy URL', onPress: handleCopyFeedUrl },
          { text: 'OK', style: 'cancel' },
        ]
      );
    });
  }, [calendarFeedUrl, handleCopyFeedUrl]);

  const handleRegenerateFeedToken = useCallback(() => {
    Alert.alert(
      'Regenerate Feed URL',
      'This will create a new unique URL for your calendar feed. Your old URL will stop working. Any calendar apps subscribed to the old URL will need to be updated.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            const newToken = generateFeedToken();
            setCalendarFeedToken(newToken);
            setCalendarFeedUrl(null);
            setFeedLastUpdated(null);
            await AsyncStorage.setItem('easyseas_calendar_feed_token', newToken);
            await AsyncStorage.removeItem('easyseas_calendar_feed_updated');
            console.log('[Settings] Regenerated feed token:', newToken.slice(0, 8) + '...');
            Alert.alert('Token Regenerated', 'Your feed URL has been reset. Tap "Publish Feed" to make it live with the new URL.');
          },
        },
      ]
    );
  }, []);

  const handleImportCalendarFromURL = useCallback(async () => {
    try {
      setIsImporting(true);
      setLastImportResult(null);
      console.log('[Settings] Starting calendar ICS import from URL');
      
      Alert.prompt(
        'Import Calendar from URL',
        'Enter the URL of the .ics calendar file (TripIt, Google Calendar, etc.):',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.log('[Settings] URL import cancelled');
              setIsImporting(false);
            },
          },
          {
            text: 'Import',
            onPress: async (url?: string) => {
              if (!url || !url.trim()) {
                Alert.alert('Invalid URL', 'Please enter a valid URL.');
                setIsImporting(false);
                return;
              }

              try {
                const trimmedUrl = url.trim();
                let content: string;
                
                // Try native download first (works better for authenticated URLs)
                console.log('[Settings] Attempting native download first:', trimmedUrl);
                const nativeResult = await downloadFromURL(trimmedUrl);
                
                if (nativeResult.success && nativeResult.content) {
                  console.log('[Settings] Native download successful, length:', nativeResult.content.length);
                  content = nativeResult.content;
                } else {
                  // Fall back to backend proxy
                  console.log('[Settings] Native download failed, trying backend proxy:', nativeResult.error);
                  const proxyResult = await fetchICSMutation.mutateAsync({ url: trimmedUrl });
                  content = proxyResult.content;
                }
                
                console.log('[Settings] Fetched', content.length, 'characters via backend');
                
                const events = applyFoundationFields(parseICSFile(content), {
                  fallbackOwnerProfileId: currentUser?.id ?? normalizedAuthenticatedEmail,
                  fallbackSourceEmail: authenticatedEmail ?? currentUser?.email ?? normalizedAuthenticatedEmail,
                  markUnassigned: true,
                  knownProfiles: users,
                });
                
                if (events.length === 0) {
                  Alert.alert('Import Failed', 'No valid events found in the ICS file. Please check the URL and file format.');
                  setIsImporting(false);
                  return;
                }

                const existingEvents = (localData.calendar || []) as CalendarEvent[];
                const mergedEvents = [...existingEvents, ...events];
                const calendarAssignmentReviewCount = getImportAssignmentReviewItems({
                  offers: [],
                  cruises: [],
                  bookedCruises: [],
                  calendarEvents: events,
                  users,
                }).length;
                const calendarSummary = createSimpleReconciliationSummary({
                  addedRows: events.length,
                  reviewNeededItems: calendarAssignmentReviewCount,
                });
                setPendingSmartImportReview({
                  title: 'Calendar Import Review',
                  fileName: trimmedUrl,
                  summary: calendarSummary,
                  rows: buildCalendarImportReviewRows({
                    existingEvents,
                    importedEvents: events as CalendarEvent[],
                    mergedEvents,
                  }),
                  applyLabel: `Apply ${events.length} event(s)`,
                  onApply: async () => {
                    try {
                      setIsImporting(true);
                      setDataOperation({
                        id: 'import-calendar',
                        title: 'Import calendar',
                        status: 'running',
                        message: 'Committing reviewed calendar events to this account.',
                        current: 0,
                        total: 2,
                        committed: false,
                        startedAt: new Date().toISOString(),
                      });
                      console.log('[Settings] Applying reviewed calendar URL import:', { url: trimmedUrl, events: events.length });
                      await setLocalData({ calendar: mergedEvents });
                      setDataOperation((current) => current?.id === 'import-calendar'
                        ? { ...current, current: 1, committed: true, message: 'Write completed. Verifying imported events from durable storage.' }
                        : current);
                      const persistedEvents = await quotaSafeGetJsonItem<CalendarEvent[]>(
                        getUserScopedKey(ALL_STORAGE_KEYS.CALENDAR_EVENTS, authenticatedEmail),
                        [],
                      ) ?? [];
                      const calendarReadback = verifySyncReadback(events, persistedEvents);
                      if (!calendarReadback.complete) {
                        throw new Error(`Calendar readback was incomplete: ${calendarReadback.matchedRows}/${calendarReadback.expectedRows} events were verified.`);
                      }
                      setLastImportResult({ type: 'calendar', count: calendarReadback.matchedRows });
                      setPendingSmartImportReview(null);
                      setDataOperation((current) => current?.id === 'import-calendar'
                        ? {
                            ...current,
                            status: 'success',
                            current: 2,
                            committed: true,
                            completedAt: new Date().toISOString(),
                            message: `Verified ${calendarReadback.matchedRows.toLocaleString()} calendar events in this account.`,
                          }
                        : current);
                      Alert.alert(
                        'Import Applied',
                        `Committed and verified ${calendarReadback.matchedRows} calendar events from URL${calendarAssignmentReviewCount > 0 ? `. ${calendarAssignmentReviewCount} event(s) need account assignment review.` : ''}`,
                        calendarAssignmentReviewCount > 0
                          ? [
                              { text: 'Later', style: 'cancel' },
                              { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                            ]
                          : undefined
                      );
                    } catch (applyError) {
                      console.error('[Settings] Failed to apply reviewed calendar URL import:', applyError);
                      const message = applyError instanceof Error ? applyError.message : 'The reviewed calendar import could not be applied.';
                      setDataOperation((current) => current?.id === 'import-calendar'
                        ? { ...current, status: 'error', completedAt: new Date().toISOString(), message }
                        : current);
                      Alert.alert('Apply Failed', `${message} Existing saved data was not reported as successfully imported.`);
                    } finally {
                      setIsImporting(false);
                    }
                  },
                });
                console.log('[Settings] Prepared calendar URL smart import review:', events.length, 'events');
              } catch (error) {
                console.error('[Settings] URL import error:', error);
                Alert.alert(
                  'Import Error', 
                  `The calendar feed could not be downloaded.\n\nDetails: ${error instanceof Error ? error.message : 'The server did not provide error details.'}\n\nCheck the calendar URL and then download the feed again.`
                );
              } finally {
                setIsImporting(false);
              }
            },
          },
        ],
        'plain-text',
        '',
        'url'
      );
    } catch (error) {
      console.error('[Settings] Import error:', error);
      Alert.alert('Import Error', 'Failed to start import. Please try again.');
      setIsImporting(false);
    }
  }, [authenticatedEmail, currentUser?.email, currentUser?.id, fetchICSMutation, localData.calendar, normalizedAuthenticatedEmail, router, setLocalData, users]);

  const handleImportCalendarFromFile = useCallback(async () => {
    try {
      setIsImporting(true);
      setLastImportResult(null);
      console.log('[Settings] Starting calendar ICS import from file');
      
      const result = await pickAndReadFile('ics');
      if (!result) {
        console.log('[Settings] Import cancelled');
        setIsImporting(false);
        return;
      }

      console.log('[Settings] File selected:', result.fileName);
      const events = applyFoundationFields(parseICSFile(result.content), {
        fallbackOwnerProfileId: currentUser?.id ?? normalizedAuthenticatedEmail,
        fallbackSourceEmail: authenticatedEmail ?? currentUser?.email ?? normalizedAuthenticatedEmail,
        markUnassigned: true,
        knownProfiles: users,
      });
      
      if (events.length === 0) {
        Alert.alert('Import Failed', 'No valid events found in the ICS file. Please check the file format.');
        setIsImporting(false);
        return;
      }

      const existingEvents = (localData.calendar || []) as CalendarEvent[];
      const mergedEvents = [...existingEvents, ...events];
      const calendarAssignmentReviewCount = getImportAssignmentReviewItems({
        offers: [],
        cruises: [],
        bookedCruises: [],
        calendarEvents: events,
        users,
      }).length;
      const calendarSummary = createSimpleReconciliationSummary({
        addedRows: events.length,
        reviewNeededItems: calendarAssignmentReviewCount,
      });
      setPendingSmartImportReview({
        title: 'Calendar Import Review',
        fileName: result.fileName,
        summary: calendarSummary,
        rows: buildCalendarImportReviewRows({
          existingEvents,
          importedEvents: events as CalendarEvent[],
          mergedEvents,
        }),
        applyLabel: `Apply ${events.length} event(s)`,
        onApply: async () => {
          try {
            setIsImporting(true);
            setDataOperation({
              id: 'import-calendar',
              title: 'Import calendar',
              status: 'running',
              message: 'Committing reviewed calendar events to this account.',
              current: 0,
              total: 2,
              committed: false,
              startedAt: new Date().toISOString(),
            });
            console.log('[Settings] Applying reviewed calendar file import:', { fileName: result.fileName, events: events.length });
            await setLocalData({ calendar: mergedEvents });
            setDataOperation((current) => current?.id === 'import-calendar'
              ? { ...current, current: 1, committed: true, message: 'Write completed. Verifying imported events from durable storage.' }
              : current);
            const persistedEvents = await quotaSafeGetJsonItem<CalendarEvent[]>(
              getUserScopedKey(ALL_STORAGE_KEYS.CALENDAR_EVENTS, authenticatedEmail),
              [],
            ) ?? [];
            const calendarReadback = verifySyncReadback(events, persistedEvents);
            if (!calendarReadback.complete) {
              throw new Error(`Calendar readback was incomplete: ${calendarReadback.matchedRows}/${calendarReadback.expectedRows} events were verified.`);
            }
            setLastImportResult({ type: 'calendar', count: calendarReadback.matchedRows });
            setPendingSmartImportReview(null);
            setDataOperation((current) => current?.id === 'import-calendar'
              ? {
                  ...current,
                  status: 'success',
                  current: 2,
                  committed: true,
                  completedAt: new Date().toISOString(),
                  message: `Verified ${calendarReadback.matchedRows.toLocaleString()} calendar events in this account.`,
                }
              : current);
            Alert.alert(
              'Import Applied',
              `Committed and verified ${calendarReadback.matchedRows} calendar events from ${result.fileName}${calendarAssignmentReviewCount > 0 ? `. ${calendarAssignmentReviewCount} event(s) need account assignment review.` : ''}`,
              calendarAssignmentReviewCount > 0
                ? [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                  ]
                : undefined
            );
          } catch (applyError) {
            console.error('[Settings] Failed to apply reviewed calendar file import:', applyError);
            const message = applyError instanceof Error ? applyError.message : 'The reviewed calendar import could not be applied.';
            setDataOperation((current) => current?.id === 'import-calendar'
              ? { ...current, status: 'error', completedAt: new Date().toISOString(), message }
              : current);
            Alert.alert('Apply Failed', `${message} Existing saved data was not reported as successfully imported.`);
          } finally {
            setIsImporting(false);
          }
        },
      });
      console.log('[Settings] Prepared calendar file smart import review:', events.length, 'events');
    } catch (error) {
      console.error('[Settings] Import error:', error);
      Alert.alert('Import Error', 'Failed to import the file. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [authenticatedEmail, currentUser?.email, currentUser?.id, localData.calendar, normalizedAuthenticatedEmail, router, setLocalData, users]);

  const handleImportCalendarICS = useCallback(() => {
    Alert.alert(
      'Import Calendar',
      'Choose import method:',
      [
        {
          text: 'From File',
          onPress: handleImportCalendarFromFile,
        },
        {
          text: 'From URL',
          onPress: handleImportCalendarFromURL,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  }, [handleImportCalendarFromFile, handleImportCalendarFromURL]);

  const handleImportBookedCSV = useCallback(async () => {
    try {
      setIsImporting(true);
      setLastImportResult(null);
      console.log('[Settings] Starting booked CSV import');
      
      const result = await pickAndReadFile('csv');
      if (!result) {
        console.log('[Settings] Import cancelled');
        setIsImporting(false);
        return;
      }

      console.log('[Settings] File selected:', result.fileName);
      
      const existingBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
      console.log('[Settings] Existing booked cruises:', existingBooked.length);
      
      const parsedBooked = parseBookedCSV(result.content, []);
      
      if (parsedBooked.length === 0) {
        Alert.alert('Import Failed', 'No valid booked cruise data was found in the CSV file.');
        setIsImporting(false);
        return;
      }

      const importedSource = getImportedSource({ bookedCruises: parsedBooked });
      const bookedMergeResult = mergeImportedBookedCruisesWithReconciliation(existingBooked, parsedBooked, {
        ownerProfileId: currentUser?.id ?? normalizedAuthenticatedEmail,
        sourceEmail: authenticatedEmail ?? currentUser?.email ?? normalizedAuthenticatedEmail,
        knownProfiles: users,
      });
      const mergedBooked = bookedMergeResult.merged;
      console.log('[Settings] Merged booked cruises:', {
        importedSource,
        existingBooked: existingBooked.length,
        parsedBooked: parsedBooked.length,
        mergedBooked: mergedBooked.length,
        reconciliation: bookedMergeResult.reconciliation,
      });

      const sourceLabel = getImportedSourceLabel(importedSource);
      const bookedAssignmentReviewCount = getImportAssignmentReviewItems({
        offers: [],
        cruises: [],
        bookedCruises: mergedBooked,
        calendarEvents: [],
        users,
      }).length;
      const bookedReconciliationNote = bookedMergeResult.reconciliation.reviewNeededItems > 0 || bookedMergeResult.reconciliation.duplicateOverlappingSailings > 0
        ? ` ${countLabel(bookedMergeResult.reconciliation.reviewNeededItems, 'item')} need${bookedMergeResult.reconciliation.reviewNeededItems === 1 ? 's' : ''} review, and ${countLabel(bookedMergeResult.reconciliation.duplicateOverlappingSailings, 'overlapping sailing')} ${bookedMergeResult.reconciliation.duplicateOverlappingSailings === 1 ? 'was' : 'were'} preserved.`
        : '';
      const bookedAssignmentNote = bookedAssignmentReviewCount > 0 ? ` ${countLabel(bookedAssignmentReviewCount, 'item')} need${bookedAssignmentReviewCount === 1 ? 's' : ''} account assignment review.` : '';
      setPendingSmartImportReview({
        title: `${sourceLabel} Booked Cruise Import Review`,
        fileName: result.fileName,
        summary: bookedMergeResult.reconciliation,
        rows: buildBookedImportReviewRows({
          existingBooked,
          importedBooked: parsedBooked,
          mergedBooked,
          kind: 'Booked Cruise',
        }),
        applyLabel: `Apply ${countLabel(parsedBooked.length, 'booked row')}`,
        onApply: async () => {
          try {
            setIsImporting(true);
            setDataOperation({
              id: 'import-booked',
              title: 'Import booked cruises',
              status: 'running',
              message: 'Committing reviewed booked-cruise rows to this account.',
              current: 0,
              total: 2,
              committed: false,
              startedAt: new Date().toISOString(),
            });
            console.log('[Settings] Applying reviewed booked import:', { fileName: result.fileName, bookedRows: parsedBooked.length });
            // setLocalData.booked is only an adapter around setBookedCruises.
            // Calling both persisted the same owner-scoped dataset twice and
            // could collide with SQLite-backed derived work on iOS.
            await setBookedCruises(mergedBooked);
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
            setDataOperation((current) => current?.id === 'import-booked'
              ? { ...current, current: 1, committed: true, message: 'Write completed. Verifying booked cruises from durable storage.' }
              : current);
            const persistedBooked = await quotaSafeGetJsonItem<BookedCruise[]>(
              getUserScopedKey(ALL_STORAGE_KEYS.BOOKED_CRUISES, authenticatedEmail),
              [],
            ) ?? [];
            const bookedReadback = verifyBookedCruiseSyncReadback(parsedBooked, persistedBooked);
            if (!bookedReadback.complete) {
              throw new Error(`Import readback was incomplete: ${bookedReadback.matchedRows}/${bookedReadback.expectedRows} booked cruises were verified.`);
            }
            setLastImportResult({ type: 'booked', count: bookedReadback.matchedRows });
            setPendingSmartImportReview(null);
            setDataOperation((current) => current?.id === 'import-booked'
              ? {
                  ...current,
                  status: 'success',
                  current: 2,
                  committed: true,
                  completedAt: new Date().toISOString(),
                  message: `Verified ${bookedReadback.matchedRows.toLocaleString()} booked cruise rows in this account.`,
                }
              : current);
            Alert.alert(
              'Import Applied',
              `${sourceLabel} booked cruises updated from ${result.fileName}. Committed and verified ${countLabel(bookedReadback.matchedRows, 'cruise row')}.${bookedReconciliationNote}${bookedAssignmentNote}`,
              bookedAssignmentReviewCount > 0
                ? [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                  ]
                : undefined
            );
            console.log('[Settings] Reviewed booked import applied:', parsedBooked.length, 'cruise rows imported');
          } catch (applyError) {
            console.error('[Settings] Failed to apply reviewed booked import:', applyError);
            const message = applyError instanceof Error ? applyError.message : 'The reviewed booked import could not be applied.';
            setDataOperation((current) => current?.id === 'import-booked'
              ? { ...current, status: 'error', completedAt: new Date().toISOString(), message }
              : current);
            Alert.alert('Apply Failed', `${message} Existing saved data was not reported as successfully imported.`);
          } finally {
            setIsImporting(false);
          }
        },
      });
      console.log('[Settings] Prepared smart booked import review:', parsedBooked.length, 'cruise rows');
    } catch (error) {
      console.error('[Settings] Booked import error:', error);
      
      let errorMessage = 'Failed to import the file. Please check the file format and try again.';
      
      if (error && typeof error === 'object' && 'validationErrors' in error) {
        const validationErrors = (error as any).validationErrors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          const firstError = validationErrors[0];
          errorMessage = firstError.message || errorMessage;
          if (firstError.suggestions && firstError.suggestions.length > 0) {
            errorMessage += '\n\nSuggestions:\n' + firstError.suggestions.join('\n');
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert('Import Error', errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [authenticatedEmail, bookedCruises, currentUser?.email, currentUser?.id, localData.booked, normalizedAuthenticatedEmail, router, setBookedCruises, setLocalData, users]);

  const handleImportCompletedCruisesXLSX = useCallback(async () => {
    try {
      setIsImporting(true);
      setLastImportResult(null);
      console.log('[Settings] Starting completed cruises XLSX import');

      const pickDocument = DocumentPicker.getDocumentAsync;
      if (typeof pickDocument !== 'function') {
        throw new Error('The iOS file picker is not available in this build. Please reinstall the current Easy Seas build and try again.');
      }

      const pickerResult = await pickDocument({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
          'text/comma-separated-values',
          'public.comma-separated-values-text',
          'public.delimited-values-text',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        console.log('[Settings] XLSX import cancelled');
        setIsImporting(false);
        return;
      }

      const asset = pickerResult.assets[0];
      console.log('[Settings] XLSX file selected:', asset.name, 'size:', asset.size);

      // XLSX is intentionally loaded only after the user selects a file.
      // Keeping the parser out of the initial Settings render prevents a large
      // restored data set plus the spreadsheet engine from exhausting memory.
      const XLSX = await import('xlsx');
      let workbook: WorkBook;
      try {
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const arrayBuffer = await response.arrayBuffer();
          workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
        } else {
          const isCsv = /\.csv$/i.test(asset.name ?? '') || /csv/i.test(asset.mimeType ?? '');
          if (isCsv) {
            const csvText = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
            workbook = XLSX.read(csvText, { type: 'string', raw: true });
          } else {
            const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
            workbook = XLSX.read(base64, { type: 'base64', raw: true });
          }
        }
      } catch (parseError) {
        console.error('[Settings] XLSX parse error:', parseError);
        const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
        Alert.alert('Parse Error', `Could not parse this Excel or CSV file. ${parseMessage}`);
        setIsImporting(false);
        return;
      }

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        Alert.alert('Empty File', 'The file has no sheets.');
        setIsImporting(false);
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      console.log('[Settings] Parsed XLSX rows:', rows.length);

      if (rows.length === 0) {
        Alert.alert('No Data', 'No data rows found in the file.');
        setIsImporting(false);
        return;
      }

      const importedCruises: BookedCruise[] = [];
      const existingBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
      const annualHistoryKeys = new Set(
        ANNUAL_CASINO_REPORT_FACTS.map((fact) => getCasinoCruiseKey(fact.ship, fact.sailDate)),
      );
      const activeGuestName = (currentUser?.displayName || currentUser?.name || '').trim();

      const headerKeys = rows.length > 0 ? Object.keys(rows[0] as Record<string, any>) : [];
      console.log('[Settings] XLSX column headers:', headerKeys);

      const findCol = (searchTerms: string[], excludeTerms?: string[]): string | null => {
        return headerKeys.find(k => {
          const lk = k.toLowerCase();
          const matches = searchTerms.some(t => lk.includes(t));
          if (!matches) return false;
          if (excludeTerms && excludeTerms.some(ex => lk.includes(ex))) return false;
          return true;
        }) || null;
      };

      const colShip = findCol(['ship', 'vessel']);
      const colSailDate = findCol(['start date', 'sail date', 'saildate', 'departure date', 'embark'], ['port']);
      const colReturnDate = findCol(['end date', 'return date', 'returndate', 'disembark'], ['port']);
      const colNights = findCol(['nights', 'duration']);
      const colItinerary = findCol(['cruise', 'itinerary', 'destination', 'route'], ['full itinerary', 'source']);
      const colFullItinerary = findCol(['full itinerary']);
      const colStartPort = findCol(['start port', 'departure port', 'homeport', 'embarkation port']);
      const colEndPort = findCol(['end port', 'disembarkation port']);
      const colPortsVisited = findCol(['ports visited', 'ports of call']);
      const colBrand = findCol(['brand', 'cruise line']);
      const colStatus = findCol(['status']);
      const colNotes = findCol(['notes', 'comments']);
      const colReservation = findCol(['reservation', 'booking', 'res']);
      const colCabin = findCol(['cabin', 'stateroom', 'room type']);
      const colGuests = findCol(['guests', 'pax', 'passengers']);
      const colCrownAnchorPoints = findCol(['crown & anchor points', 'crown anchor points', 'c&a points', 'loyalty points']);
      const colAssignedClubRoyalePoints = findCol(['assigned club royale points', 'final club royale points', 'allocated club royale points']);
      const colClubRoyalePoints = colAssignedClubRoyalePoints
        || findCol(['club royale casino points', 'casino points', 'club royale points', 'points earned'], ['original casino points', 'unallocated points', 'equal share']);
      const colCoinIn = findCol(['coin-in', 'coin in', 'coinin']);
      // A report column named "Coin-In Equivalent" is a points-based model,
      // even when every row contains a numeric value. Do not misrepresent it
      // as casino/provider-recorded coin-in merely because it was imported.
      const coinInHeaderIsModeled = Boolean(colCoinIn && /equivalent|\bmodel(?:ed|led)?\b|@\s*\$?\s*5|5\s*\/\s*point/i.test(colCoinIn));
      const colPrice = findCol(['retail price', 'retail value', 'total retail', 'cruise fare', 'fare', 'price', 'cost'], ['paid', 'amount paid', 'net', 'tax']);
      const colPaid = findCol(['price paid', 'paid', 'amount paid', 'net paid', 'out of pocket'], ['retail']);
      const colNetCash = findCol(['net cash', 'cash result', 'net result']);
      const colTaxes = findCol(['port taxes', 'taxes and fees', 'taxes & fees', 'taxes', 'fees', 'port charges']);
      const colWinnings = findCol(['winnings home', 'winnings', 'casino win']);
      const colDataQuality = findCol(['data quality', 'quality', 'status']);
      const colProgram = findCol(['program', 'charter']);
      const colSourceEmail = findCol(['source email', 'account email', 'owner email', 'traveler email', 'profile email', 'email']);

      console.log('[Settings] XLSX mapped columns:', {
        ship: colShip, sailDate: colSailDate, returnDate: colReturnDate,
        nights: colNights, itinerary: colItinerary, startPort: colStartPort,
        brand: colBrand, portsVisited: colPortsVisited,
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as Record<string, any>;
        const getCol = (col: string | null): string => {
          if (!col) return '';
          return String(row[col] ?? '').trim();
        };

        const shipName = getCol(colShip);
        const sailDateRaw = getCol(colSailDate);
        const returnDateRaw = getCol(colReturnDate);
        const nightsRaw = getCol(colNights);
        const destination = getCol(colItinerary);
        const fullItinerary = getCol(colFullItinerary);
        const departurePort = getCol(colStartPort);
        const _endPort = getCol(colEndPort);
        const portsVisited = getCol(colPortsVisited);
        const brand = getCol(colBrand);
        const _statusVal = getCol(colStatus);
        const notesVal = getCol(colNotes);
        const reservationNumber = getCol(colReservation);
        const cabinType = getCol(colCabin);
        const guests = getCol(colGuests);
        const price = getCol(colPrice);
        const paid = getCol(colPaid);
        const taxes = getCol(colTaxes);
        const winnings = getCol(colWinnings);
        const program = getCol(colProgram);
        const sourceEmail = normalizeAccountEmail(getCol(colSourceEmail)) ?? undefined;

        // Annual/grand-total rows are report summaries, not cruises. Importing
        // them as blank ships corrupts cruise counts and double-counts points.
        if (!shipName || !sailDateRaw || /\btotal\b/i.test(sailDateRaw)) continue;

        const parseDate = (raw: string): string => {
          if (!raw) return '';
          const num = Number(raw);
          if (!isNaN(num) && num > 10000 && num < 100000) {
            const d = new Date((num - 25569) * 86400 * 1000);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          }
          const dateMatch = raw.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{2,4})/);
          if (dateMatch) {
            let [, a, b, c] = dateMatch;
            const normalized = a.length === 4
              ? `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`
              : `${c.length === 2 ? '20'+c : c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`;
            return toCalendarDateOnly(normalized) ?? '';
          }
          return toCalendarDateOnly(raw) ?? '';
        };
        const parseSignedNumber = (raw: string): number | undefined => {
          if (!raw) return undefined;
          const cleaned = raw.replace(/[$,\s]/g, '').replace(/[()]/g, (match) => match === '(' ? '-' : '');
          const parsed = Number.parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
          return Number.isFinite(parsed) ? parsed : undefined;
        };

        const sailDate = parseDate(sailDateRaw);
        const parsedNights = parseInt(nightsRaw, 10);
        const nights = Number.isFinite(parsedNights) && parsedNights > 0 && parsedNights <= 365 ? parsedNights : 0;
        let returnDate = returnDateRaw ? parseDate(returnDateRaw) : '';
        if (!returnDate && sailDate && nights > 0) {
          returnDate = addCalendarDateDays(sailDate, nights) ?? '';
        }

        const parsedGuests = parseInt(guests, 10);
        const normalizedGuests = Number.isFinite(parsedGuests) && parsedGuests > 0 ? parsedGuests : undefined;
        const materialIdentity = [
          (reservationNumber || '').trim().toLowerCase(),
          (shipName || '').trim().toLowerCase(),
          sailDate,
          returnDate,
          (cabinType || '').trim().toLowerCase(),
          normalizedGuests ?? '',
          nights,
        ].join('|');

        const isDuplicate = importedCruises.some(
          c => [
            (c.reservationNumber || '').trim().toLowerCase(),
            c.shipName.trim().toLowerCase(),
            c.sailDate,
            c.returnDate || '',
            (c.cabinType || '').trim().toLowerCase(),
            c.guests ?? '',
            c.nights,
          ].join('|') === materialIdentity
        );

        if (isDuplicate) {
          console.log('[Settings] Skipping duplicate completed cruise:', shipName, sailDate);
          continue;
        }

        const brandLower = brand.toLowerCase();
        const cruiseSource: 'royal' | 'celebrity' | 'carnival' = 
          brandLower.includes('celebrity') ? 'celebrity' :
          brandLower.includes('carnival') ? 'carnival' : 'royal';

        const portsList = portsVisited ? portsVisited.split(',').map(p => p.trim()).filter(Boolean) : [];
        const itineraryLabel = destination || fullItinerary || (nights > 0 ? `${nights} Night Cruise` : '');
        // Completed-history exports define Retail Value as the total value for
        // the cruise, not a per-person advertised rate. Never double it here.
        const roomRetailPrice = parseSignedNumber(price);
        const paidAmount = parseSignedNumber(paid);
        const taxesAmount = parseSignedNumber(taxes);
        const crownAnchorPoints = parseSignedNumber(getCol(colCrownAnchorPoints));
        const casinoPoints = parseSignedNumber(getCol(colClubRoyalePoints));
        const explicitCoinIn = parseSignedNumber(getCol(colCoinIn));
        const coinIn = explicitCoinIn ?? (casinoPoints !== undefined ? casinoPoints * 5 : undefined);
        const winningsHome = parseSignedNumber(getCol(colWinnings));
        const netCash = parseSignedNumber(getCol(colNetCash));
        const dataQuality = getCol(colDataQuality);
        const assignmentStatus = getCol(colStatus);
        const casinoConfidence = dataQuality.toLowerCase().includes('estimated') ? 'estimated' : dataQuality ? 'actual' : 'mixed';

        const cruise: BookedCruise = {
          id: reservationNumber || `completed-xlsx-${Date.now()}-${i}`,
          shipName: shipName || '',
          sailDate,
          returnDate,
          nights,
          destination: destination || fullItinerary || '',
          itineraryName: itineraryLabel,
          departurePort: departurePort || '',
          ports: portsList.length > 0 ? portsList : undefined,
          itineraryRaw: fullItinerary ? [fullItinerary] : undefined,
          reservationNumber: reservationNumber || undefined,
          cabinType: cabinType || undefined,
          guests: normalizedGuests,
          guestNames: activeGuestName ? [activeGuestName] : [],
          price: roomRetailPrice,
          totalPrice: roomRetailPrice,
          retailValue: roomRetailPrice,
          totalRetailCost: roomRetailPrice,
          originalPrice: roomRetailPrice,
          pricePaid: paidAmount,
          amountPaid: paidAmount,
          netEffectivePaid: paidAmount,
          taxes: taxesAmount,
          taxesFeesEstimate: taxesAmount,
          totalCasinoDiscount: roomRetailPrice !== undefined && paidAmount !== undefined ? Math.max(0, roomRetailPrice + (taxesAmount ?? 0) - paidAmount) : undefined,
          pointsEarned: casinoPoints,
          earnedPoints: casinoPoints,
          casinoPoints,
          coinIn,
          coinInCalculationSource: explicitCoinIn !== undefined && !coinInHeaderIsModeled
            ? 'actual'
            : coinIn !== undefined
              ? 'club_royale_slot_points_estimate'
              : undefined,
          slotPointsConfirmed: coinIn !== undefined && (explicitCoinIn === undefined || coinInHeaderIsModeled) ? true : undefined,
          winnings: winningsHome,
          winningsBroughtHome: winningsHome,
          totalWinnings: winningsHome,
          netResult: netCash ?? winningsHome,
          cashResult: netCash,
          calculationConfidence: casinoConfidence,
          casinoHistoryImportId: annualHistoryKeys.has(getCasinoCruiseKey(shipName, sailDate))
            ? SCOTT_CONFIRMED_CASINO_HISTORY_IMPORT_ID
            : `completed-cruises-2025-2026:${reservationNumber || shipName}:${sailDate}`,
          casinoProgram: cruiseSource === 'royal' ? 'clubRoyale' : cruiseSource === 'celebrity' ? 'blueChip' : 'playersClub',
          notes: [notesVal, assignmentStatus, program ? `Program: ${program}` : ''].filter(Boolean).join(' ') || undefined,
          status: sailDate && returnDate && nights > 0 ? 'completed' : 'reviewNeeded',
          completionState: sailDate && returnDate && nights > 0 ? 'completed' : undefined,
          cruiseSource,
          sourceEmail,
          importStatus: sourceEmail ? 'unassigned' : undefined,
          reconciliationStatus: sourceEmail ? 'reviewNeeded' : undefined,
          validationStatus: sailDate && returnDate && nights > 0 ? 'valid' : 'quarantined',
          dataConfidence: sailDate && returnDate && nights > 0 ? 'verified' : 'partial',
          createdAt: new Date().toISOString(),
        };

        importedCruises.push(cruise);
        console.log(`[Settings] Parsed XLSX row ${i}: ${cruise.shipName} | ${cruise.sailDate} → ${cruise.returnDate} | ${cruise.nights}N | ${cruiseSource}`);
      }

      const skippedCount = rows.length - importedCruises.length;
      console.log('[Settings] XLSX import summary:', { total: rows.length, imported: importedCruises.length, skippedOrDuplicate: skippedCount });

      if (importedCruises.length === 0) {
        Alert.alert(
          'No New Cruises',
          `No completed cruises were found. ${skippedCount > 0 ? `${countLabel(skippedCount, 'row')} ${skippedCount === 1 ? 'was' : 'were'} duplicated or unrecognized.` : 'The file columns could not be recognized.'}\n\nSupported columns include Sail Date, Ship, Nights, Itinerary, Reservation, Crown & Anchor Points, Club Royale Casino Points, Coin-In Equivalent, Winnings Home, Retail Value, Amount Paid, and Net Cash.`
        );
        setIsImporting(false);
        return;
      }

      const preparedImportedCruises = applyFoundationFields(importedCruises, {
        fallbackOwnerProfileId: currentUser?.id ?? normalizedAuthenticatedEmail,
        fallbackSourceEmail: authenticatedEmail ?? currentUser?.email ?? normalizedAuthenticatedEmail,
        markUnassigned: true,
        knownProfiles: users,
      });
      const completedAssignmentReviewCount = getImportAssignmentReviewItems({
        offers: [],
        cruises: [],
        bookedCruises: preparedImportedCruises,
        calendarEvents: [],
        users,
      }).length;
      const completedMerge = mergeCompletedCruiseHistory(existingBooked, preparedImportedCruises);
      const { cruises: merged, addedCruises, updatedRows } = completedMerge;
      const completedSummary = createSimpleReconciliationSummary({
        addedRows: addedCruises.length,
        updatedRows,
        removedMissingRows: skippedCount,
        suggestedArchiveRows: 0,
        reviewNeededItems: completedAssignmentReviewCount,
      });

      setPendingSmartImportReview({
        title: 'Completed Cruise Import Review',
        fileName: asset.name,
        summary: completedSummary,
        rows: buildBookedImportReviewRows({
          existingBooked,
          importedBooked: preparedImportedCruises,
          mergedBooked: merged,
          kind: 'Completed Cruise',
        }),
        applyLabel: `Apply ${countLabel(addedCruises.length, 'new row')} + ${countLabel(updatedRows, 'updated row')}`,
        onApply: async () => {
          try {
            setIsImporting(true);
            console.log('[Settings] Applying reviewed completed cruises import:', { fileName: asset.name, completedRows: preparedImportedCruises.length });
            await setBookedCruises(merged);
            const bookedStorageKey = getUserScopedKey(ALL_STORAGE_KEYS.BOOKED_CRUISES, authenticatedEmail);
            const persistedBookedCruises = await quotaSafeGetJsonItem<BookedCruise[]>(
              bookedStorageKey,
              [],
              (value): value is BookedCruise[] => Array.isArray(value),
            );
            const importReadback = verifyBookedCruiseSyncReadback(preparedImportedCruises, persistedBookedCruises);
            if (!importReadback.complete) {
              throw new Error(
                `COMPLETED_HISTORY_READBACK_FAILED: expected=${importReadback.expectedRows} matched=${importReadback.matchedRows} missing=${importReadback.missingRows}`,
              );
            }
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
            recordDiagnosticEvent({
              level: 'success',
              category: 'SYNC_COMPLETED',
              event: 'completed_history_import_committed',
              message: 'Completed-cruise casino history was committed and verified by storage readback.',
              data: {
                fileName: asset.name,
                owner: currentUser?.id ?? normalizedAuthenticatedEmail,
                importedRows: preparedImportedCruises.length,
                addedRows: addedCruises.length,
                updatedRows,
                storedRows: importReadback.storedRows,
                matchedRows: importReadback.matchedRows,
              },
            });
            setLastImportResult({ type: 'completed', count: importedCruises.length });
            setPendingSmartImportReview(null);
            Alert.alert(
              'Import Applied',
              `Applied ${countLabel(addedCruises.length, 'new completed cruise row')} and ${countLabel(updatedRows, 'updated row')} from ${asset.name}.${completedAssignmentReviewCount > 0 ? ` ${countLabel(completedAssignmentReviewCount, 'item')} ${completedAssignmentReviewCount === 1 ? 'needs' : 'need'} account assignment review.` : ''}`,
              completedAssignmentReviewCount > 0
                ? [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                  ]
                : undefined
            );
            console.log('[Settings] Reviewed completed import applied:', importedCruises.length, 'new completed cruises');
          } catch (applyError) {
            console.error('[Settings] Failed to apply reviewed completed import:', applyError);
            recordDiagnosticEvent({
              level: 'error',
              category: 'SYNC_COMPLETED',
              event: 'completed_history_import_failed',
              message: 'Completed-cruise casino history did not pass commit/readback verification.',
              data: { fileName: asset.name, error: applyError instanceof Error ? applyError.message : String(applyError) },
            });
            Alert.alert('Apply Failed', 'The reviewed completed-cruise import did not pass its saved-data verification. Your prior records remain available; please export the diagnostic log and try again.');
          } finally {
            setIsImporting(false);
          }
        },
      });
      console.log('[Settings] Prepared completed cruises smart import review:', importedCruises.length, 'new completed cruises');
    } catch (error) {
      console.error('[Settings] XLSX import error:', error);
      Alert.alert('Import Error', 'Failed to import the XLSX file. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [authenticatedEmail, bookedCruises, currentUser?.email, currentUser?.id, localData.booked, normalizedAuthenticatedEmail, router, setBookedCruises, setLocalData, users]);

  const handleExportBookedCSV = useCallback(async () => {
    try {
      setIsExporting(true);
      console.log('[Settings] Starting booked CSV export');
      
      const allBooked = localData.booked?.length > 0 ? localData.booked : bookedCruises;
      
      if (allBooked.length === 0) {
        Alert.alert('No Data', 'No booked cruise data to export. Import data first.');
        setIsExporting(false);
        return;
      }

      const csvContent = generateBookedCSV(allBooked);
      const fileName = `easyseas_booked_${new Date().toISOString().split('T')[0]}.csv`;
      
      const success = await exportFile(csvContent, fileName);
      if (success) {
        Alert.alert('Export Successful', `Exported ${allBooked.length} booked cruises to ${fileName}`);
      } else {
        Alert.alert('Export Info', 'File saved but sharing may not be available on this device.');
      }
      console.log('[Settings] Booked export complete');
    } catch (error) {
      console.error('[Settings] Booked export error:', error);
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [localData.booked, bookedCruises]);

  const handleExportBookedXLSX = useCallback(async () => {
    try {
      setIsExporting(true);
      const source = localData.booked?.length > 0 ? localData.booked : bookedCruises;
      const allBooked = source.filter(cruise => isActiveBookedCruise(cruise) || isCompletedBookedCruise(cruise));
      if (!allBooked.length) return void Alert.alert('No Data', 'No booked or completed cruise data is available to export.');
      const XLSX = await import('xlsx');
      const rows = allBooked.map(cruise => Object.fromEntries(Object.entries(cruise).map(([key,value]) => [key, value != null && typeof value === 'object' ? JSON.stringify(value) : value ?? ''])));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Booked and Completed');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ exportedAt:new Date().toISOString(), records:rows.length, scope:'All booked and completed cruises', source:'EasySeas local storage' }]), 'Export Metadata');
      const base64 = XLSX.write(workbook, { type:'base64', bookType:'xlsx' });
      const fileName=`easyseas_booked_completed_${new Date().toISOString().slice(0,10)}.xlsx`;
      await exportBase64File(base64,fileName,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      Alert.alert('Export Successful',`Exported ${rows.length} booked/completed cruises with all saved fields to ${fileName}.`);
    } catch(error){console.error('[Settings] Booked XLSX export error:',error);Alert.alert('Export Error','Could not create the booked/completed workbook.');}
    finally{setIsExporting(false)}
  },[bookedCruises,localData.booked]);

  const handleExportOffersCSV = useCallback(async () => {
    try {
      setIsExporting(true);
      console.log('[Settings] Starting offers CSV export');
      
      const allCruises = await getAllCruises();
      const allOffers = localData.offers || casinoOffers;
      
      if (allCruises.length === 0) {
        Alert.alert('No Data', 'No cruise data to export. Import data first.');
        setIsExporting(false);
        return;
      }

      const csvContent = generateOffersCSV(allCruises, allOffers);
      const fileName = `easyseas_offers_${new Date().toISOString().split('T')[0]}.csv`;
      
      const success = await exportFile(csvContent, fileName);
      if (success) {
        Alert.alert('Export Successful', `Exported ${allCruises.length} cruises to ${fileName}`);
      } else {
        Alert.alert('Export Info', 'File saved but sharing may not be available on this device.');
      }
      console.log('[Settings] Export complete');
    } catch (error) {
      console.error('[Settings] Export error:', error);
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [localData.offers, casinoOffers, getAllCruises]);

  const handleExportCalendarICS = useCallback(async () => {
    try {
      setIsExporting(true);
      console.log('[Settings] Starting calendar ICS export');
      
      const allBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
      const allEvents = getCalendarEventsWithGeneratedCruiseEvents(
        allBooked,
        [...(localData.calendar || []), ...(localData.tripit || [])]
      );
      
      if (allEvents.length === 0) {
        Alert.alert('No Data', 'No calendar events to export. Import events first.');
        setIsExporting(false);
        return;
      }

      const icsContent = generateCalendarICS(allEvents);
      const fileName = `easyseas_calendar_${new Date().toISOString().split('T')[0]}.ics`;
      
      const success = await exportFile(icsContent, fileName);
      if (success) {
        Alert.alert('Export Successful', `Exported ${allEvents.length} events to ${fileName}`);
      } else {
        Alert.alert('Export Info', 'File saved but sharing may not be available on this device.');
      }
      console.log('[Settings] Export complete', {
        exportedEvents: allEvents.length,
        bookedCruises: allBooked.length,
      });
    } catch (error) {
      console.error('[Settings] Export error:', error);
      Alert.alert('Export Error', 'Failed to export calendar. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [bookedCruises, localData.booked, localData.calendar, localData.tripit]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete ALL app data including:\n\n• Cruises & Offers\n• Booked Cruises\n• Calendar Events\n• Certificates\n• User Profile (Name, C&A #)\n• Club Royale Points\n• Loyalty Points\n• Settings & Preferences\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Settings] Clearing all app data...');
              const result = await clearAllAppData();
              
              if (result.success) {
                await clearAllData();
                await clearLocalData();
                setLastImportResult(null);
                
                console.log('[Settings] Resetting user profile to blank for all cruise lines...');
                await syncUserFromStorage();
                const owner = await ensureOwner();
                await updateUser(owner.id, { 
                  name: '',
                  crownAnchorNumber: '',
                  celebrityEmail: '',
                  celebrityCaptainsClubNumber: '',
                  celebrityCaptainsClubPoints: 0,
                  celebrityBlueChipPoints: 0,
                  silverseaEmail: '',
                  silverseaVenetianNumber: '',
                  silverseaVenetianTier: '',
                  silverseaVenetianPoints: 0,
                });
                
                await setManualClubRoyalePoints(0);
                await setManualCrownAnchorPoints(0);
                
                console.log('[Settings] Re-syncing loyalty provider from storage...');
                await syncLoyaltyFromStorage();
                
                Alert.alert(
                  'Data Reset Complete', 
                  `Successfully cleared ${result.clearedKeys.length} data stores. Import or enter data when you are ready.`
                );
              } else {
                Alert.alert(
                  'Partial Clear', 
                  `Cleared ${result.clearedKeys.length} items with ${result.errors.length} errors.`
                );
              }
            } catch (error) {
              console.error('[Settings] Clear data error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          }
        },
      ]
    );
  }, [clearAllData, clearLocalData, syncUserFromStorage, ensureOwner, updateUser, setManualClubRoyalePoints, setManualCrownAnchorPoints, syncLoyaltyFromStorage, setBookedCruises, setCasinoOffers, setLocalData]);



  const handleExportAllData = useCallback(async () => {
    try {
      setIsExportingAll(true);
      setDataOperation({ id: 'save-all', title: 'Save all app data', status: 'running', message: 'Finishing pending cruise, casino, and profile writes before backup.', current: 0, total: 1, committed: false, startedAt: new Date().toISOString() });
      await coreData.flushPendingWrites();
      recordDiagnosticEvent({
        level: 'info',
        category: 'ADMIN',
        event: 'settings_export_all_pressed',
        message: 'Save All flushed pending writes and created a readable JSON backup',
        data: {
          bookedCruises: bookedCruises.length,
          offerRows: casinoOffers.length,
          certificateRows: searchableCertificates.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0),
        },
      });
      const result = await exportAllDataToFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: currentUser?.id ?? null,
        activeProfileEmail: currentUser?.email ?? authenticatedEmail ?? null,
      });
      if (!result.success) throw new Error(result.error || 'The JSON backup could not be created.');
      setDataOperation((current) => current?.id === 'save-all' ? { ...current, current: 1, committed: true, status: 'success', completedAt: new Date().toISOString(), message: result.summaryText ?? `${result.fileName ?? 'The JSON backup'} was created and opened in the iOS share sheet.` } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pending app writes could not be finalized.';
      setDataOperation((current) => current?.id === 'save-all' ? { ...current, status: 'error', committed: false, completedAt: new Date().toISOString(), message } : current);
      Alert.alert('Save All could not start', `${message} No backup was reported as complete.`);
    } finally {
      setIsExportingAll(false);
    }
  }, [authenticatedEmail, bookedCruises.length, casinoOffers.length, coreData, currentUser?.email, currentUser?.id, searchableCertificates]);

  const handleExportCertificates = useCallback(async () => {
    try {
      setIsExportingCertificates(true);
      setDataOperation({ id: 'certificate-export', title: 'Export certificates', status: 'running', message: 'Loading saved certificate results from this device.', current: 1, total: 100, committed: false, startedAt: new Date().toISOString() });
      setCertificateExportProgress({ percent: 1, message: 'Loading saved certificate results from this device…' });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const exportCertificates = await loadSearchableCertificates();
      const parsedRows = exportCertificates.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0);
      setCertificateExportProgress({
        percent: 4,
        message: `Loaded ${exportCertificates.length.toLocaleString()} certificates with ${parsedRows.toLocaleString()} parsed sailing rows.`,
      });
      setDataOperation((current) => current?.id === 'certificate-export' ? { ...current, current: 4, message: `Loaded ${exportCertificates.length.toLocaleString()} certificates with ${parsedRows.toLocaleString()} eligible sailing rows.` } : current);
      recordDiagnosticEvent({ level: 'info', category: 'ADMIN', event: 'settings_export_certificates_pressed', message: 'Certificate ZIP export pressed', data: {
        certificates: exportCertificates.length,
        parsedRows,
      } });
      // JSZip and the complete certificate result engine stay out of the
      // Settings startup bundle until export is explicitly requested.
      const { exportCertificateResultsZip } = await import('@/lib/certificates/certificateCsvZipExport');
      const result = await exportCertificateResultsZip(exportCertificates, new Date(), (progress) => {
        setCertificateExportProgress({ percent: progress.percent, message: progress.message });
        setDataOperation((current) => current?.id === 'certificate-export' ? { ...current, current: progress.percent, message: progress.message } : current);
      });
      if (!result.shared) {
        setDataOperation((current) => current?.id === 'certificate-export' ? { ...current, status: 'error', committed: true, current: 100, completedAt: new Date().toISOString(), message: 'The ZIP was created, but this device could not open a share destination.' } : current);
        Alert.alert('Export Unavailable', 'The certificate ZIP was created, but this device cannot open a share destination.');
        return;
      }
      setDataOperation((current) => current?.id === 'certificate-export' ? { ...current, status: 'success', committed: true, current: 100, completedAt: new Date().toISOString(), message: `${result.optionRowCount.toLocaleString()} eligible rows were packaged in ${result.fileName}.` } : current);
      Alert.alert(
        'Certificates Exported',
        `${result.certificateCount.toLocaleString()} downloaded certificate${result.certificateCount === 1 ? '' : 's'}, ${result.optionRowCount.toLocaleString()} eligible sailing row${result.optionRowCount === 1 ? '' : 's'}, and ${result.physicalSailingCount.toLocaleString()} unique ship-and-date sailing${result.physicalSailingCount === 1 ? '' : 's'} were packaged into ${result.csvFileCount.toLocaleString()} CSV file${result.csvFileCount === 1 ? '' : 's'} in ${result.fileName}.`,
      );
    } catch (error) {
      console.error('[Settings] Certificate export error:', error);
      recordDiagnosticEvent({ level: 'error', category: 'ERROR', event: 'settings_export_certificates_failed', message: 'Certificate ZIP export failed', data: { error: error instanceof Error ? error.message : String(error) } });
      setDataOperation((current) => current?.id === 'certificate-export' ? { ...current, status: 'error', committed: false, completedAt: new Date().toISOString(), message: error instanceof Error ? error.message : 'The certificate ZIP was not created.' } : current);
      Alert.alert('Certificate Export Failed', error instanceof Error ? error.message : 'The certificate results could not be exported.');
    } finally {
      setIsExportingCertificates(false);
      setCertificateExportProgress(null);
    }
  }, [loadSearchableCertificates]);

  const handleImportAllData = useCallback(async () => {
    try {
      setIsImportingAll(true);
      setDataOperation({ id: 'load-all', title: 'Load all app data', status: 'running', message: 'Opening a readable Easy Seas JSON backup. Existing data remains protected until the import commits.', current: 0, total: 1, committed: false, startedAt: new Date().toISOString() });
      await coreData.flushPendingWrites();
      recordDiagnosticEvent({
        level: 'info',
        category: 'ADMIN',
        event: 'settings_load_all_pressed',
        message: 'Load All flushed pending writes and opened the readable JSON restore workflow',
        data: { source: 'ios_file_picker' },
      });
      // Load All restores the complete account snapshot, including both saved
      // traveler profiles. The signed-in email selects the account namespace;
      // the currently displayed traveler must never become an import filter.
      const result = await importAllDataFromFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: null,
        activeProfileEmail: null,
      });
      if (!result.success || !result.imported) {
        if (result.error === 'Import cancelled') {
          setDataOperation((current) => current?.id === 'load-all' ? { ...current, status: 'cancelled', completedAt: new Date().toISOString(), message: 'No file was selected. Existing app data was unchanged.' } : current);
          return;
        }
        throw new Error(result.error || 'The selected backup did not contain readable Easy Seas data.');
      }
      await coreData.refreshData();
      emitAppDataEvent('cloudDataRestored');
      const totalImported = Object.values(result.imported).reduce((sum, count) => sum + count, 0);
      setDataOperation((current) => current?.id === 'load-all' ? { ...current, status: 'success', current: 1, committed: true, completedAt: new Date().toISOString(), message: `${totalImported.toLocaleString()} records were imported and verified in the live app.` } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The JSON backup could not be imported.';
      setDataOperation((current) => current?.id === 'load-all' ? { ...current, status: 'error', committed: false, completedAt: new Date().toISOString(), message } : current);
      Alert.alert('Load All could not finish', `${message} Existing saved data was preserved.`);
    } finally {
      setIsImportingAll(false);
    }
  }, [authenticatedEmail, coreData]);

  const handleImportLegacyBackup = useCallback(async () => {
    try {
      setIsImportingLegacyBackup(true);
      setDataOperation({
        id: 'legacy-backup-import',
        title: 'Import earlier Easy Seas backup',
        status: 'running',
        message: 'Opening the file picker. Existing owner-scoped data remains protected until the import commits.',
        current: 0,
        total: 1,
        committed: false,
        startedAt: new Date().toISOString(),
      });
      await coreData.flushPendingWrites();
      const result = await importAllDataFromFile(authenticatedEmail);
      if (!result.success || !result.imported) {
        if (result.error === 'Import cancelled') {
          setDataOperation((current) => current?.id === 'legacy-backup-import'
            ? { ...current, status: 'cancelled', completedAt: new Date().toISOString(), message: 'No file was selected. Existing app data was unchanged.' }
            : current);
          return;
        }
        throw new Error(result.error || 'The backup did not contain readable Easy Seas data.');
      }
      await coreData.refreshData();
      emitAppDataEvent('cloudDataRestored');
      const totalImported = Object.values(result.imported).reduce((sum, count) => sum + count, 0);
      setDataOperation((current) => current?.id === 'legacy-backup-import'
        ? {
            ...current,
            status: 'success',
            current: 1,
            committed: true,
            completedAt: new Date().toISOString(),
            message: `${totalImported.toLocaleString()} records were imported and published to the live app.`,
          }
        : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The earlier backup could not be imported.';
      setDataOperation((current) => current?.id === 'legacy-backup-import'
        ? { ...current, status: 'error', committed: false, completedAt: new Date().toISOString(), message }
        : current);
      Alert.alert('Earlier backup was not imported', `${message} Existing saved data was preserved.`);
    } finally {
      setIsImportingLegacyBackup(false);
    }
  }, [authenticatedEmail, coreData]);

  const handleDownloadExtension = useCallback(async () => {
    try {
      setIsDownloadingExtension(true);
      console.log('[Settings] Starting Sync Extension download...');
      
      const result = await downloadScraperExtension();
      
      if (result.success) {
        Alert.alert(
          'Download Started',
          `Easy Seas™ Auto-Sync Extension is downloading.\n\nThis extension automatically syncs casino offers, booked cruises, and loyalty data from Royal Caribbean & Celebrity Cruises websites.\n\nTo install:\n1. Unzip the downloaded file\n2. Open Chrome and go to chrome://extensions\n3. Enable "Developer mode"\n4. Click "Load unpacked"\n5. Select the unzipped folder\n\nAfter installation, navigate to the cruise line website, log in, and use the floating overlay to start an automated sync.`
        );
      } else {
        console.error('[Settings] Download failed:', result.error);
        Alert.alert(
          'Download Failed', 
          result.error || 'Unable to download the extension. Please make sure you are using a desktop web browser.\n\nTip: Check the browser console for detailed error logs.'
        );
      }
    } catch (error) {
      console.error('[Settings] Extension download error:', error);
      Alert.alert(
        'Download Error', 
        `The browser extension could not be downloaded: ${error instanceof Error ? error.message : 'The download service did not provide error details.'}\n\nKeep Easy Seas open and start the extension download again.`,
      );
    } finally {
      setIsDownloadingExtension(false);
    }
  }, []);

  const handleDownloadSeaPassGenerator = useCallback(async () => {
    try {
      setIsDownloadingSeaPass(true);
      console.log('[Settings] Starting SeaPass Generator download...');
      const result = await downloadSeaPassGenerator();
      if (result.success) {
        Alert.alert(
          'Download Started',
          `Standalone SeaPass Generator v1.0.0 is downloading.\n\nThis ZIP contains the complete SeaPass Generator feature pack including:\n- Core source files\n- Rebuild guide & architecture docs\n- Integration snippets\n- Backend proxy code\n\n${result.filesAdded} files included.`
        );
      } else {
        console.error('[Settings] SeaPass Generator download failed:', result.error);
        Alert.alert(
          'Download Failed',
          result.error || 'Unable to download the SeaPass Generator. Please make sure you are using a desktop web browser.'
        );
      }
    } catch (error) {
      console.error('[Settings] SeaPass Generator download error:', error);
      Alert.alert(
        'Download Error',
        `The SeaPass generator could not be downloaded: ${error instanceof Error ? error.message : 'The download service did not provide error details.'}`
      );
    } finally {
      setIsDownloadingSeaPass(false);
    }
  }, []);

  const handleDownloadCSVTemplate = useCallback(async () => {
    try {
      setIsDownloadingTemplate(true);
      console.log('[Settings] Starting CSV template download...');
      
      const csvTemplateContent = `id,ship,departureDate,returnDate,nights,itineraryName,departurePort,portsRoute,reservationNumber,guests,bookingId,isBooked,winningsBroughtHome,cruisePointsEarned
booked-radiance-1,Radiance of the Seas,09-26-2025,10-04-2025,8,8 Night Pacific Coastal Cruise,"Vancouver, British Columbia","Vancouver, British Columbia",123123,2,2623545,TRUE,,
booked-liberty-1,Liberty of the Seas,10-16-2025,10-25-2025,9,9 Night Canada & New England Cruise,"Cape Liberty, NJ (NYC)","Cape Liberty, NJ (NYC)",324123,2,7676777,TRUE,,`;
      
      const fileName = 'booked_template.csv';
      const success = await exportFile(csvTemplateContent, fileName);
      
      if (success) {
        Alert.alert(
          'Download Successful',
          'The Booked CSV template has been downloaded. Fill in your cruise bookings following the template format, then import using "Booked Cruises CSV" option.'
        );
      } else {
        Alert.alert('Download Info', 'File saved but sharing may not be available on this device.');
      }
    } catch (error) {
      console.error('[Settings] CSV template download error:', error);
      Alert.alert('Download Error', 'Failed to download template. Please try again.');
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, []);

  const handleSaveProfile = async (profileData: {
    name: string;
    email: string;
    crownAnchorNumber: string;
    clubRoyalePoints: number;
    clubRoyaleTier: string;
    clubRoyaleTierValidThrough?: string;
    loyaltyPoints: number;
    crownAnchorLevel: string;
    celebrityEmail?: string;
    celebrityCaptainsClubNumber?: string;
    celebrityCaptainsClubPoints: number;
    celebrityBlueChipPoints: number;
    celebrityBlueChipTier: string;
    celebrityCaptainsClubLevel: string;
    preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
    silverseaEmail?: string;
    silverseaVenetianNumber?: string;
    silverseaVenetianTier?: string;
    silverseaVenetianPoints?: number;
    carnivalVifpNumber?: string;
    carnivalVifpTier?: string;
    carnivalPlayersClubTier?: string;
    carnivalPlayersClubPoints?: number;
    birthdate?: string;
  }) => {
    try {
      setIsSaving(true);
      console.log('[Settings] Saving profile:', profileData);
      
      const oldEmail = profileDisplayUser?.email?.toLowerCase().trim() || authenticatedEmail?.toLowerCase().trim();
      const newEmail = profileData.email.toLowerCase().trim();
      const profileEmailChanged = Boolean(oldEmail && oldEmail !== newEmail);
      const emailChanged = isPrimaryProfileSelected && profileEmailChanged;
      const isChangingToReservedAdminEmail = profileEmailChanged && isAdminAccountEmail(newEmail) && !isAdminAccountEmail(oldEmail ?? '');
      const isChangingAdminAccountEmail = emailChanged && (isAdmin || isAdminAccountEmail(oldEmail ?? ''));
      
      console.log('[Settings] Email change check:', { oldEmail, newEmail, emailChanged });

      if (!newEmail || !newEmail.includes('@')) {
        Alert.alert('Invalid Email', 'Please enter a valid email address before saving your profile.');
        setIsSaving(false);
        return;
      }

      if (isChangingToReservedAdminEmail || isChangingAdminAccountEmail) {
        Alert.alert(
          'Admin Email Protected',
          'Admin email addresses cannot be claimed or changed from the profile editor. Please sign out and log in with the admin email and password instead.'
        );
        setIsSaving(false);
        return;
      }
      
      if (profileEmailChanged) {
        try {
          const emailCheck = { exists: false };
          if (emailCheck.exists) {
            Alert.alert(
              'Email Already Exists',
              'This email is already associated with another account. Please use a different email address.'
            );
            setIsSaving(false);
            return;
          }
        } catch (error) {
          console.error('[Settings] Error checking email uniqueness:', error);
          Alert.alert('Error', 'Failed to verify email. Please try again.');
          setIsSaving(false);
          return;
        }
      }
      
      await continueProfileSave(profileData, oldEmail, newEmail, !!emailChanged);
    } catch (error) {
      console.error('[Settings] Save error:', error);
      Alert.alert('Save Error', 'Failed to save profile. Please try again.');
      setIsSaving(false);
    }
  };

  async function continueProfileSave(
    profileData: {
      name: string;
      email: string;
      crownAnchorNumber: string;
      clubRoyalePoints: number;
      clubRoyaleTier: string;
      clubRoyaleTierValidThrough?: string;
      loyaltyPoints: number;
      crownAnchorLevel: string;
      celebrityEmail?: string;
      celebrityCaptainsClubNumber?: string;
      celebrityCaptainsClubPoints: number;
      celebrityBlueChipPoints: number;
      celebrityBlueChipTier: string;
      celebrityCaptainsClubLevel: string;
      preferredBrand?: 'royal' | 'celebrity' | 'silversea' | 'carnival';
      silverseaEmail?: string;
      silverseaVenetianNumber?: string;
      silverseaVenetianTier?: string;
      silverseaVenetianPoints?: number;
      carnivalVifpNumber?: string;
      carnivalVifpTier?: string;
      carnivalPlayersClubTier?: string;
      carnivalPlayersClubPoints?: number;
      birthdate?: string;
    },
    oldEmail: string | undefined,
    newEmail: string,
    emailChanged: boolean
  ) {
    try {
      const editableUser = profileDisplayUser ?? (await ensureOwner());

      const loyaltyConfirmationTimestamp = new Date().toISOString();
      const expectedProfileUpdates: Partial<UserProfile> = {
          name: profileData.name,
          email: profileData.email,
          crownAnchorNumber: profileData.crownAnchorNumber,
          clubRoyalePoints: profileData.clubRoyalePoints,
          clubRoyaleTier: profileData.clubRoyaleTier,
          clubRoyaleTierValidThrough: profileData.clubRoyaleTierValidThrough,
          clubRoyaleTierConfirmedAt: loyaltyConfirmationTimestamp,
          crownAnchorLevel: profileData.crownAnchorLevel,
          loyaltyPoints: profileData.loyaltyPoints,
          celebrityEmail: profileData.celebrityEmail,
          celebrityCaptainsClubNumber: profileData.celebrityCaptainsClubNumber,
          celebrityCaptainsClubPoints: profileData.celebrityCaptainsClubPoints,
          celebrityCaptainsClubTier: profileData.celebrityCaptainsClubLevel,
          celebrityBlueChipPoints: profileData.celebrityBlueChipPoints,
          celebrityBlueChipTier: profileData.celebrityBlueChipTier,
          preferredBrand: profileData.preferredBrand,
          silverseaEmail: profileData.silverseaEmail,
          silverseaVenetianNumber: profileData.silverseaVenetianNumber,
          silverseaVenetianTier: profileData.silverseaVenetianTier,
          silverseaVenetianPoints: profileData.silverseaVenetianPoints,
          carnivalVifpNumber: profileData.carnivalVifpNumber,
          carnivalVifpTier: profileData.carnivalVifpTier,
          carnivalPlayersClubTier: profileData.carnivalPlayersClubTier,
          carnivalPlayersClubPoints: profileData.carnivalPlayersClubPoints,
          birthdate: profileData.birthdate || undefined,
          loyaltyManualOverrideAt: loyaltyConfirmationTimestamp,
      };
      setDataOperation({
        id: 'profile-save',
        title: 'Save profile',
        status: 'running',
        message: 'Saving profile and loyalty values to this account.',
        current: 0,
        total: 2,
        committed: false,
        startedAt: new Date().toISOString(),
      });
      await updateUser(editableUser.id, expectedProfileUpdates);
      
      if (isPrimaryProfileSelected) {
        await setManualClubRoyalePoints(profileData.clubRoyalePoints);
        await setManualCrownAnchorPoints(profileData.loyaltyPoints);
      }
      console.log('[Settings] ✓ Updated Royal Caribbean loyalty:', {
        profileId: editableUser.id,
        clubRoyale: profileData.clubRoyalePoints,
        crownAnchor: profileData.loyaltyPoints
      });
      
      // Ensure Celebrity loyalty data is persisted
      console.log('[Settings] ✓ Updated Celebrity loyalty:', {
        captainsClub: profileData.celebrityCaptainsClubPoints,
        blueChip: profileData.celebrityBlueChipPoints
      });
      
      // Ensure Silversea loyalty data is persisted
      console.log('[Settings] ✓ Updated Silversea loyalty:', {
        venetianTier: profileData.silverseaVenetianTier,
        venetianPoints: profileData.silverseaVenetianPoints
      });
      
      console.log('[Settings] ✓ Updated Carnival loyalty:', {
        vifpNumber: profileData.carnivalVifpNumber,
        vifpTier: profileData.carnivalVifpTier,
        playersClubTier: profileData.carnivalPlayersClubTier,
        playersClubPoints: profileData.carnivalPlayersClubPoints
      });
      
      await syncUserFromStorage();
      if (isPrimaryProfileSelected) {
        await syncLoyaltyFromStorage();
      }
      setDataOperation((current) => current?.id === 'profile-save'
        ? { ...current, current: 1, committed: true, message: 'Write completed. Verifying the saved profile from owner-scoped storage.' }
        : current);
      const persistedProfileEmail = normalizeAccountEmail(emailChanged ? newEmail : (authenticatedEmail ?? profileData.email));
      const persistedProfiles = await quotaSafeGetJsonItem<UserProfile[]>(
        getUserScopedKey(ALL_STORAGE_KEYS.USERS, persistedProfileEmail),
        [],
      ) ?? [];
      const persistedProfile = persistedProfiles.find((profile) => profile.id === editableUser.id);
      const fieldsToVerify: Array<keyof UserProfile> = [
        'name',
        'email',
        'crownAnchorNumber',
        'clubRoyalePoints',
        'clubRoyaleTier',
        'loyaltyPoints',
        'crownAnchorLevel',
        'celebrityCaptainsClubPoints',
        'celebrityBlueChipPoints',
        'silverseaVenetianPoints',
        'carnivalPlayersClubPoints',
      ];
      const mismatchedProfileFields = fieldsToVerify.filter((field) => (
        String(persistedProfile?.[field] ?? '') !== String(expectedProfileUpdates[field] ?? '')
      ));
      if (!persistedProfile || mismatchedProfileFields.length > 0) {
        throw new Error(`Profile readback was incomplete${mismatchedProfileFields.length ? ` for ${mismatchedProfileFields.join(', ')}` : ''}.`);
      }
      setDataOperation((current) => current?.id === 'profile-save'
        ? {
            ...current,
            status: 'success',
            current: 2,
            committed: true,
            completedAt: new Date().toISOString(),
            message: 'Profile and loyalty values were committed and verified for this account.',
          }
        : current);
      if (emailChanged) {
        console.log('[Settings] Email changed - updating auth state and triggering re-login');
        await updateEmail(newEmail);
        await syncUserFromStorage();
        
        Alert.alert(
          'Email Updated', 
          'Your email address has been changed successfully. Your profile has been updated with the new email.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await syncUserFromStorage();
              }
            }
          ]
        );
      } else {
        Alert.alert('Profile Saved', 'Your profile and loyalty values were committed and verified successfully.');
      }
    } catch (error) {
      console.error('[Settings] continueProfileSave error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save profile.';
      setDataOperation((current) => current?.id === 'profile-save'
        ? { ...current, status: 'error', completedAt: new Date().toISOString(), message }
        : current);
      Alert.alert('Save Error', `${message} The profile was not reported as successfully saved.`);
    } finally {
      setIsSaving(false);
    }
  }



  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open link');
    });
  }, []);



  const handleImportMachinesJSON = useCallback(async () => {
    try {
      setIsImportingMachines(true);
      setLastImportResult(null);
      console.log('[Settings] Starting machines JSON import');
      
      const result = await pickAndReadFile('json');
      if (!result) {
        console.log('[Settings] Import cancelled');
        setIsImportingMachines(false);
        return;
      }

      console.log('[Settings] File selected:', result.fileName);
      console.log('[Settings] File size:', result.content.length, 'characters');
      
      try {
        JSON.parse(result.content);
        console.log('[Settings] JSON is valid');
      } catch (jsonError) {
        console.error('[Settings] Invalid JSON:', jsonError);
        Alert.alert(
          'Invalid JSON Format', 
          'The selected file is not a valid Easy Seas JSON export. Choose a Save All backup or a supported import file.\n\nDetails: ' + (jsonError instanceof Error ? jsonError.message : 'The parser did not provide error details.')
        );
        setIsImportingMachines(false);
        return;
      }
      
      const importResult = await importMachinesJSON(result.content);
      
      if (!importResult.success) {
        console.error('[Settings] Import failed:', importResult.error);
        Alert.alert(
          'Import Failed', 
          importResult.error || 'Failed to import machines data. Please check that the file contains an array of machine objects.'
        );
        setIsImportingMachines(false);
        return;
      }

      console.log('[Settings] Import successful, reloading machines...');
      await reloadMachines();
      setLastImportResult({ type: 'machines', count: importResult.count });
      Alert.alert(
        'Import Successful', 
        `Successfully imported ${importResult.count} machines from ${result.fileName}`
      );
      console.log('[Settings] Import complete:', importResult.count, 'machines');
    } catch (error) {
      console.error('[Settings] Import machines error:', error);
      Alert.alert(
        'Import Error', 
        'The selected file could not be imported. No saved records were removed.\n\nDetails: ' + (error instanceof Error ? error.message : 'The importer did not provide error details.') + '\n\nChoose the matching import action and select the file again.'
      );
    } finally {
      setIsImportingMachines(false);
    }
  }, [importMachinesJSON, reloadMachines]);

  const handleExportMachinesJSON = useCallback(async () => {
    try {
      setIsExportingMachines(true);
      console.log('[Settings] Starting machines JSON export with full verbose data...');
      
      if (myAtlasMachines.length === 0) {
        Alert.alert('No Data', 'No machines to export. Add machines to your atlas first.');
        setIsExportingMachines(false);
        return;
      }

      console.log('[Settings] Fetching full machine details for export...');
      const jsonContent = await exportMachinesJSON();
      const fileName = `easyseas_machines_${new Date().toISOString().split('T')[0]}.json`;
      
      console.log('[Settings] Writing export file...');
      const success = await exportFile(jsonContent, fileName);
      if (success) {
        Alert.alert(
          'Export Successful', 
          `Exported ${myAtlasMachines.length} machines with complete verbose data including:\n\n• AP Analysis & Summary\n• Core Mechanics\n• AP Triggers & Walk-Away Rules\n• Jackpot Reset Values\n• Ship Notes\n• Denominations\n\nFile: ${fileName}`
        );
      } else {
        Alert.alert('Export Info', 'File saved but sharing may not be available on this device.');
      }
      console.log('[Settings] Machines export complete');
    } catch (error) {
      console.error('[Settings] Machines export error:', error);
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExportingMachines(false);
    }
  }, [myAtlasMachines, exportMachinesJSON]);

  const handleSyncToCloud = useCallback(async () => {
    try {
      setIsCheckingCloudSync(true);
      const createCloudDriveBackup = async (reason: string) => {
        const result = await exportAllDataToFile(authenticatedEmail, {
          authenticatedEmail,
          activeProfileId: currentUser?.id ?? null,
          activeProfileEmail: currentUser?.email ?? authenticatedEmail ?? null,
        });
        if (!result.success) {
          throw new Error(result.error || 'The local backup file could not be created.');
        }
        Alert.alert(
          'Cloud Backup Ready',
          `${reason}\n\nThe complete Easy Seas backup was created as ${result.fileName ?? 'a JSON backup'}. In the iOS share sheet, choose Save to Files and select iCloud Drive.`,
        );
      };

      // Easy Seas remains fully local-first. When no service endpoint exists,
      // the button still performs a real, backend-free cloud backup through
      // iOS Files/iCloud Drive instead of presenting a permanently disabled
      // error. A configured service remains an optional faster sync path.
      if (!isCloudBackupEnabled() || !BACKEND_BASE_URL || !isAuthenticated || !authenticatedEmail) {
        await createCloudDriveBackup('No Easy Seas cloud service is configured, so the backend-free iCloud Drive path was used.');
        return;
      }

      // The user explicitly requested a new attempt; do not reuse a cached
      // offline result from an earlier voyage/network transition.
      resetBackendHealthCache();
      const reachable = await isBackendReachable();
      if (!reachable) {
        await createCloudDriveBackup('The optional Easy Seas cloud service was offline, so the backend-free iCloud Drive path was used.');
        return;
      }
      const synced = await forceProfileSyncNow();
      if (!synced) {
        Alert.alert('Cloud Sync Not Completed', cloudSyncError || 'The backup was not completed. Your local data remains unchanged.');
        return;
      }
      Alert.alert('Cloud Sync Complete', 'Your current local Easy Seas data was backed up successfully.');
    } catch (error) {
      Alert.alert('Cloud Sync Failed', `${error instanceof Error ? error.message : 'The backup could not be completed.'}\n\nYour local data remains unchanged.`);
    } finally {
      setIsCheckingCloudSync(false);
    }
  }, [authenticatedEmail, cloudSyncError, currentUser?.email, currentUser?.id, forceProfileSyncNow, isAuthenticated]);

  const handleExportOverallAppLog = useCallback(async () => {
    try {
      setIsExportingAppLog(true);
      recordDiagnosticEvent({
        level: 'info',
        category: 'ADMIN',
        event: 'OVERALL_APP_LOG_EXPORT',
        message: 'Admin requested overall app diagnostic export',
      });
      await flushDiagnosticJournal();
      const diagnostic = await buildDiagnosticExport({
        diagnosticVersion: EASYSEAS_DIAGNOSTIC_VERSION,
        platform: Platform.OS,
        isAuthenticated,
        isAdmin,
        activeProfileId: currentUser?.id ?? null,
        dataStats,
        cloudBackupConfigured: Boolean(BACKEND_BASE_URL && isCloudBackupEnabled()),
        cloudSyncInProgress: isCloudSyncing,
        lastCloudSyncTime: lastSyncTime,
        cloudSyncError,
      });
      const journal = await readDiagnosticJournal();
      const exportedAt = new Date().toISOString();
      const content = [
        `Easy Seas Overall App Log — ${EASYSEAS_DIAGNOSTIC_VERSION}`,
        `Exported: ${exportedAt}`,
        '',
        diagnostic,
        '',
        'Persistent Sync / Storage Journal:',
        journal || '[No persistent journal entries in this installation.]',
      ].join('\n');
      const fileName = `easyseas_overall_app_log_${exportedAt.replace(/[:.]/g, '-')}.log`;
      const success = await exportFile(content, fileName);
      Alert.alert(success ? 'App Log Exported' : 'Export Unavailable', success ? 'The overall app diagnostic log is ready to save or share.' : 'The app log could not be exported on this device.');
    } catch (error) {
      Alert.alert('Export Error', error instanceof Error ? error.message : 'The overall app log could not be exported.');
    } finally {
      setIsExportingAppLog(false);
    }
  }, [cloudSyncError, currentUser?.id, dataStats, isAdmin, isAuthenticated, isCloudSyncing, lastSyncTime]);

  const handleExportCurrentUserSessionLog = useCallback(async () => {
    try {
      setIsExportingSessionLog(true);
      recordDiagnosticEvent({
        level: 'info',
        category: 'ADMIN',
        event: 'CURRENT_USER_SESSION_LOG_EXPORT',
        message: 'Admin requested the current user session JSON log',
      });
      await flushDiagnosticJournal();
      const exportedAt = new Date().toISOString();
      const content = buildCurrentUserSessionLog({
        appVersion: EASYSEAS_DIAGNOSTIC_VERSION,
        platform: Platform.OS,
        user: {
          profileId: currentUser?.id ?? null,
          name: currentUser?.name ?? null,
          email: authenticatedEmail,
          isAdmin,
        },
        stateSnapshot: {
          dataStats,
          loyalty: {
            crownAnchorPoints: loyaltyCrownAnchorPoints,
            crownAnchorLevel: loyaltyCrownAnchorLevel,
            clubRoyalePoints: loyaltyClubRoyalePoints,
            clubRoyaleTier: loyaltyClubRoyaleTier,
          },
          sync: {
            cloudBackupConfigured: Boolean(BACKEND_BASE_URL && isCloudBackupEnabled()),
            isCloudSyncing,
            lastSyncTime,
            cloudSyncError,
          },
        },
      });
      // Verify the artifact is machine-readable before exposing it to sharing.
      JSON.parse(content);
      const fileName = `easyseas_user_session_${exportedAt.replace(/[:.]/g, '-')}.json`;
      const success = await exportFile(content, fileName);
      Alert.alert(
        success ? 'Session Log Exported' : 'Export Unavailable',
        success ? `The current user session log is ready to save or share.\n\nFile: ${fileName}` : 'The session log could not be exported on this device.',
      );
    } catch (error) {
      Alert.alert('Export Error', error instanceof Error ? error.message : 'The current user session log could not be exported.');
    } finally {
      setIsExportingSessionLog(false);
    }
  }, [authenticatedEmail, cloudSyncError, currentUser?.id, currentUser?.name, dataStats, isAdmin, isCloudSyncing, lastSyncTime, loyaltyClubRoyalePoints, loyaltyClubRoyaleTier, loyaltyCrownAnchorLevel, loyaltyCrownAnchorPoints]);

  const closeCredentialEnrollment = useCallback(() => {
    if (isEnrollingCredential) return;
    setCredentialPin('');
    setCredentialPinConfirmation('');
    setIsCredentialEnrollmentVisible(false);
  }, [isEnrollingCredential]);

  const handleCredentialEnrollment = useCallback(async () => {
    if (!/^\d{6}$/.test(credentialPin)) {
      Alert.alert('Six-Digit PIN Required', 'Enter exactly six numbers for your Easy Seas device PIN.');
      return;
    }
    if (credentialPin !== credentialPinConfirmation) {
      Alert.alert('PINs Do Not Match', 'Re-enter the same six-digit PIN in both fields.');
      return;
    }

    setIsEnrollingCredential(true);
    try {
      const enrolled = await enrollDeviceCredential(credentialPin);
      if (!enrolled) {
        Alert.alert('Could Not Enable Secure Access', 'Your local data is unchanged. Please try again.');
        return;
      }
      setCredentialPin('');
      setCredentialPinConfirmation('');
      setIsCredentialEnrollmentVisible(false);
      Alert.alert('Secure Access Enabled', 'Easy Seas will require this PIN or your device biometrics after you sign out or restart.');
    } finally {
      setIsEnrollingCredential(false);
    }
  }, [credentialPin, credentialPinConfirmation, enrollDeviceCredential]);

  const handleVoyageNotificationsToggle = useCallback(async (enabled: boolean) => {
    if (isUpdatingNotificationPreference) return;
    setIsUpdatingNotificationPreference(true);
    try {
      if (enabled) {
        const granted = await requestVoyageNotificationPermission();
        if (!granted) {
          Alert.alert(
            'Notifications Are Off',
            'Easy Seas did not receive notification permission. Nothing was scheduled, and all app data remains available in the app.',
          );
          updateSettings({ dailySummaryNotifications: false });
          return;
        }
        updateSettings({ dailySummaryNotifications: true });
        Alert.alert('Voyage Reminders Enabled', 'Easy Seas will schedule a bounded, deduplicated set of local reminders for saved cruise deadlines.');
        return;
      }

      updateSettings({ dailySummaryNotifications: false });
      await cancelAllVoyageNotifications();
    } catch (error) {
      console.warn('[Settings] Could not update local voyage reminders:', error);
      updateSettings({ dailySummaryNotifications: false });
      Alert.alert('Could Not Update Reminders', 'No app data was changed. Please try again.');
    } finally {
      setIsUpdatingNotificationPreference(false);
    }
  }, [isUpdatingNotificationPreference, updateSettings]);

  const renderSettingRow = (
    icon: React.ReactNode,
    label: string,
    value?: string | React.ReactNode,
    onPress?: () => void,
    isDanger?: boolean
  ) => (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        {icon}
        <Text style={[styles.settingLabel, isDanger && styles.dangerLabel]}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {typeof value === 'string' ? (
          <Text style={styles.settingValue}>{value}</Text>
        ) : (
          value
        )}
        {onPress && <ChevronRight size={18} color={isDanger ? COLORS.error : CLEAN_THEME.text.secondary} />}
      </View>
    </TouchableOpacity>
  );

  const renderExportActionRow = ({
    icon,
    label,
    detail,
    testID,
    busy,
    onPress,
    progress,
  }: {
    icon: React.ReactNode;
    label: string;
    detail: string;
    testID: string;
    busy: boolean;
    onPress: () => Promise<void>;
    progress?: { percent: number; message: string } | null;
  }) => (
    <TouchableOpacity
      style={[styles.exportActionRow, busy && styles.exportActionRowBusy]}
      onPress={() => { if (!busy) void onPress(); }}
      disabled={busy}
      activeOpacity={0.55}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ disabled: busy, busy }}
      testID={testID}
    >
      <View style={styles.exportActionIcon}>{busy ? <ActivityIndicator size="small" color="#0369A1" /> : icon}</View>
      <View style={styles.exportActionCopy} pointerEvents="none">
        <Text style={styles.exportActionLabel}>{busy ? `${label} · ${progress?.percent ?? 0}%` : label}</Text>
        <Text style={styles.exportActionDetail}>{busy ? (progress?.message || 'Preparing files. The share sheet will open when ready.') : detail}</Text>
      </View>
      <ChevronRight size={20} color="#0369A1" pointerEvents="none" />
    </TouchableOpacity>
  );

  const renderSectionHeader = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    gradientColors: [string, string] = ['#0369A1', '#0284C7']
  ) => {
    const emojiByTitle: Record<string, string> = {
      Account: '👤',
      Security: '🔐',
      Notifications: '🔔',
      Connections: '🔗',
      'About · Books by Scott Astin': '📚',
      'Data Import & Backup': '💾',
      Integrations: '🧩',
      'Appearance & Data Trust': '🎨',
      Help: '🛟',
      'Purchases & Legal': '⚖️',
      Admin: '🛡️',
      'Danger Zone': '⚠️',
    };
    const tone = title === 'Danger Zone'
      ? 'warning'
      : title === 'Security' || title === 'Appearance & Data Trust'
        ? 'success'
        : title === 'Notifications'
          ? 'info'
          : 'default';
    void gradientColors;
    return (
      <ThemedSectionHeader
        tab="settings"
        icon={icon}
        emoji={emojiByTitle[title]}
        title={title}
        subtitle={subtitle}
        tone={tone}
        style={styles.settingsThemedHeader}
        testID={`settings-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      />
    );
  };

  const renderSmartImportReviewRow = useCallback((row: SmartImportReviewRow) => (
    <View key={row.id} style={styles.smartImportRow} testID={`smart-import-review-row-${row.id}`}>
      <View style={styles.smartImportRowTop}>
        <View style={styles.smartImportKindPill}>
          <Text style={styles.smartImportKindText}>{row.kind}</Text>
        </View>
        <View style={[
          styles.smartImportActionPill,
          row.action === 'add' ? styles.smartImportActionAdd : row.action === 'update' ? styles.smartImportActionUpdate : row.action === 'preserve' ? styles.smartImportActionPreserve : styles.smartImportActionReview,
        ]}>
          <Text style={styles.smartImportActionText}>{getSmartImportActionLabel(row.action)}</Text>
        </View>
      </View>
      <Text style={styles.smartImportRowTitle} numberOfLines={1}>{row.title}</Text>
      <Text style={styles.smartImportRowSubtitle} numberOfLines={2}>{row.subtitle}</Text>
      <Text style={styles.smartImportRowMeta} numberOfLines={2}>{row.meta}</Text>
      {row.before ? <Text style={styles.smartImportDiffText} numberOfLines={2}>Before: {row.before}</Text> : null}
      {row.after ? <Text style={styles.smartImportDiffText} numberOfLines={2}>After: {row.after}</Text> : null}
      {row.fieldDiffs.length > 0 ? (
        <View style={styles.smartImportFieldDiffList}>
          {row.fieldDiffs.slice(0, 5).map((diff) => (
            <View key={`${row.id}-${diff.field}`} style={styles.smartImportFieldDiffRow}>
              <Text style={styles.smartImportFieldName}>{diff.field}</Text>
              <Text style={styles.smartImportFieldBefore} numberOfLines={1}>{diff.before || 'blank'}</Text>
              <ChevronRight size={12} color="#94A3B8" />
              <Text style={styles.smartImportFieldAfter} numberOfLines={1}>{diff.after || 'blank'}</Text>
            </View>
          ))}
          {row.fieldDiffs.length > 5 ? <Text style={styles.smartImportMoreDiffs}>+{row.fieldDiffs.length - 5} more changed field(s)</Text> : null}
        </View>
      ) : null}
    </View>
  ), []);

  const settingsSearchItems: Array<{
    id: string;
    group: string;
    label: string;
    detail: string;
    onPress: () => void;
  }> = [
    { id: 'account', group: 'Account', label: 'Traveler profiles', detail: 'Primary and second-user identity, loyalty, and owner scope', onPress: () => { setSettingsSearchQuery(''); setIsAccountDetailsVisible(true); } },
    { id: 'security', group: 'Security', label: requiresCredentialEnrollment ? 'Set device PIN' : 'Update device protection', detail: requiresCredentialEnrollment ? 'Protect locally stored reservations, loyalty, and casino data' : 'Protected on this device; tap to replace the local unlock PIN', onPress: () => setIsCredentialEnrollmentVisible(true) },
    { id: 'notifications', group: 'Notifications', label: 'Voyage notifications', detail: 'Check-in, payment, embarkation, offer, and certificate reminders', onPress: () => void handleVoyageNotificationsToggle(settings.dailySummaryNotifications !== true) },
    { id: 'royal-sync', group: 'Connections', label: 'Royal / Celebrity sync', detail: 'Refresh offers, cruises, loyalty, and casino status', onPress: () => router.push('/royal-caribbean-sync' as any) },
    { id: 'carnival-sync', group: 'Connections', label: 'Carnival sync', detail: carnivalSyncAccess.reason, onPress: () => carnivalSyncAccess.enabled ? router.push('/carnival-sync' as any) : Alert.alert('Carnival Sync', carnivalSyncAccess.reason) },
    { id: 'pricing', group: 'Connections', label: 'Get current pricing', detail: 'Refresh verified prices for booked and offered sailings', onPress: () => router.push('/import-cruises' as any) },
    { id: 'import-offers', group: 'Data Import & Backup', label: 'Import offers CSV', detail: 'Review and merge offer and eligible-sailing rows', onPress: () => void handleImportOffersCSV() },
    { id: 'import-booked', group: 'Data Import & Backup', label: 'Import booked cruises CSV', detail: 'Review and merge booked-cruise records', onPress: () => void handleImportBookedCSV() },
    { id: 'import-history', group: 'Data Import & Backup', label: 'Import completed casino history', detail: 'Load completed cruises from CSV or XLSX', onPress: () => void handleImportCompletedCruisesXLSX() },
    { id: 'crew-registry', group: 'Data Import & Backup', label: 'Crew registry & CSV import', detail: 'Open owner-scoped crew recognition and local CSV import', onPress: () => router.push('/crew-recognition' as any) },
    { id: 'save-all', group: 'Data Import & Backup', label: 'Save all app data', detail: 'Create a readable Easy Seas JSON backup', onPress: () => void handleExportAllData() },
    { id: 'load-all', group: 'Data Import & Backup', label: 'Restore from backup', detail: 'Load a readable Easy Seas JSON backup', onPress: () => void handleImportAllData() },
    { id: 'export-certs', group: 'Data Import & Backup', label: 'Export certificates ZIP', detail: 'Export master, summary, and per-certificate CSV files', onPress: () => void handleExportCertificates() },
    { id: 'extension', group: 'Integrations', label: 'Chrome sync extension', detail: 'Download the Royal / Celebrity browser sync extension', onPress: () => void handleDownloadExtension() },
    { id: 'booked-template', group: 'Integrations', label: 'Booked CSV template', detail: 'Download the current booked-cruise import template', onPress: () => void handleDownloadCSVTemplate() },
    { id: 'appearance', group: 'Appearance', label: 'Appearance & accessibility', detail: 'Theme, text size, contrast, motion, and density', onPress: () => router.push('/experience-settings' as any) },
    { id: 'trust', group: 'Data Trust', label: 'Data Trust Center', detail: 'Integrity, provenance, repairs, and restore diagnostics', onPress: () => router.push('/data-trust-center' as any) },
    { id: 'data-health', group: 'Data Trust', label: 'Data health', detail: 'Review calculations, conflicts, missing evidence, and repair candidates', onPress: () => router.push('/data-health' as any) },
    { id: 'relationships', group: 'Data Trust', label: 'Relationship explorer', detail: 'Trace exact, inferred, estimated, and unresolved links', onPress: () => router.push('/relationship-explorer' as any) },
    { id: 'action-inbox', group: 'Data Trust', label: 'Action inbox', detail: 'Open the deduplicated queue of data items that need attention', onPress: () => router.push('/action-inbox' as any) },
    { id: 'manual', group: 'Help', label: 'User manual', detail: 'Open the Easy Seas in-app manual', onPress: () => setIsUserManualVisible(true) },
    { id: 'learn', group: 'Help', label: 'Learn the system', detail: 'Cruise, casino, offer, and certificate guidance', onPress: () => router.push('/learn-system' as any) },
    { id: 'rate', group: 'Help', label: 'Rate Easy Seas', detail: 'Open the Easy Seas App Store page', onPress: () => void handleOpenLink('https://apps.apple.com/us/app/easy-seas/id6758175890?ppid=9a051237-cab0-4164-9459-4c55a1976721') },
    { id: 'purchase', group: 'Purchases', label: 'Subscriptions & purchases', detail: 'Purchase, restore, redeem, or manage access', onPress: () => router.push('/paywall-monthly' as any) },
    { id: 'restore-purchases', group: 'Purchases', label: 'Restore purchases', detail: 'Restore an existing App Store subscription or redeemed access', onPress: () => void entitlement.restore() },
    { id: 'redeem-code', group: 'Purchases', label: 'Redeem App Store code', detail: 'Redeem a subscription offer code', onPress: () => void entitlement.redeemOfferCode() },
    { id: 'manage-subscription', group: 'Purchases', label: 'Manage subscription', detail: 'Open Apple subscription management', onPress: () => void entitlement.openManageSubscription() },
    { id: 'privacy', group: 'About / Legal', label: 'Privacy policy', detail: 'Read the Easy Seas privacy policy', onPress: () => entitlement.openPrivacyPolicy() },
    { id: 'terms', group: 'About / Legal', label: 'Terms of use', detail: 'Read the End User License Agreement', onPress: () => entitlement.openTerms() },
    { id: 'lock-device', group: 'Danger Zone', label: 'Sign out & lock', detail: 'End this local session without deleting saved Easy Seas data', onPress: () => void logout() },
    ...(isAdmin ? [
      { id: 'admin-gmail-sync', group: 'Admin', label: 'Sync Gmail', detail: 'Preview owner Gmail bookings, cancellations, certificates, and receipts', onPress: () => router.push('/gmail-import' as any) },
      { id: 'admin-seapass', group: 'Admin', label: 'SeaPass Web Generator', detail: 'Private Royal Caribbean SeaPass creation and export', onPress: () => router.push('/seapass-generator' as any) },
      { id: 'admin-bookdrop', group: 'Admin', label: 'Launch BookDrop', detail: 'Private offline book-sharing workspace', onPress: () => router.push('/bookdrop' as any) },
      { id: 'admin-machine-import', group: 'Admin', label: 'Import machines JSON', detail: 'Load the private machine atlas', onPress: () => void handleImportMachinesJSON() },
      { id: 'admin-machine-export', group: 'Admin', label: 'Export machines JSON', detail: 'Save the complete private machine atlas', onPress: () => void handleExportMachinesJSON() },
      { id: 'admin-session-log', group: 'Admin', label: 'Export current session log', detail: 'Create the signed-in user diagnostic JSON', onPress: () => void handleExportCurrentUserSessionLog() },
      { id: 'admin-seapass-download', group: 'Admin', label: 'Download SeaPass source', detail: 'Export the standalone generator package', onPress: () => void handleDownloadSeaPassGenerator() },
      { id: 'admin-app-log', group: 'Admin', label: 'Export overall app log', detail: 'Create the complete administrator diagnostic report', onPress: () => void handleExportOverallAppLog() },
      { id: 'admin-reset', group: 'Admin', label: 'Reset all data', detail: 'Open the protected destructive reset workflow', onPress: handleClearData },
    ] : []),
  ];
  const normalizedSettingsSearch = settingsSearchQuery.trim().toLowerCase();
  const visibleSettingsSearchItems = normalizedSettingsSearch
    ? settingsSearchItems.filter((item) => `${item.group} ${item.label} ${item.detail}`.toLowerCase().includes(normalizedSettingsSearch))
    : [];
  const selectedSettingsActions = settingsSearchItems.filter((item) => item.group === activeSettingsGroup);
  const settingsShortcutItems = [
    { label: 'Security', emoji: '🔐', group: 'Security' },
    { label: 'Alerts', emoji: '🔔', group: 'Notifications' },
    { label: 'Integrations', emoji: '🧩', group: 'Integrations' },
    { label: 'Appearance', emoji: '🎨', group: 'Appearance' },
    { label: 'Help', emoji: '🛟', group: 'Help' },
    { label: 'Books & legal', emoji: '📚', group: 'About / Legal' },
    { label: 'Purchases', emoji: '💳', group: 'Purchases' },
    { label: 'Data trust', emoji: '🧭', group: 'Data Trust' },
    { label: 'Danger zone', emoji: '⚠️', group: 'Danger Zone' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: experienceColors.background }]}> 
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          ref={settingsScrollRef}
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          contentContainerStyle={styles.scrollContent}
        >
          <ResponsiveContainer>
            <TabIdentityBand tab="settings" compact dense detail={`${dataStats.cruises.toLocaleString()} cruises · ${dataStats.booked.toLocaleString()} booked`} />

          <View style={styles.dataOverviewCard}>
            <LinearGradient
              colors={['#FFFDF9', '#F3F6F7'] as [string, string]}
              style={styles.dataOverviewHeader}
            >
              <View style={styles.dataOverviewHeaderContent}>
                <View style={styles.dataOverviewIconBadge}>
                  <Anchor size={18} color="#0E7FA7" />
                </View>
                <View style={styles.dataOverviewTitleGroup}>
                  <Text style={styles.dataOverviewTitle}>Data Overview</Text>
                  <Text style={styles.dataOverviewSubtitle}>{coreData.isLoading ? 'Restoring saved data…' : `${dataStats.cruises.toLocaleString()} available cruises by brand`}</Text>
                </View>
              </View>
            </LinearGradient>
            <View style={styles.dataOverviewBody}>
              {coreData.isLoading ? (
                <View style={styles.dataOverviewLoading} testID="settings-data-overview-loading">
                  <ActivityIndicator color="#0E7FA7" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dataOverviewLoadingTitle}>Restoring saved cruises and offers</Text>
                    <Text style={styles.dataOverviewLoadingText}>Counts appear after the authoritative local repositories finish readback.</Text>
                  </View>
                </View>
              ) : (
                <>
              <View style={styles.dataOverviewStatsRow}>
                <View style={styles.dataOverviewStatCard}>
                  <Anchor size={14} color="#1C2F7A" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.royalAvailable.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Royal</Text>
                  <Text style={styles.dataOverviewMiniStat}>available</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Ship size={14} color="#0E7FA7" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.celebrityAvailable.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Celebrity</Text>
                  <Text style={styles.dataOverviewMiniStat}>available</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Ship size={14} color="#D87924" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.carnivalAvailable.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Carnival</Text>
                  <Text style={styles.dataOverviewMiniStat}>available</Text>
                </View>
              </View>
              <View style={styles.dataOverviewStatsRow} testID="settings-data-overview-booking-counts">
                <View style={styles.dataOverviewStatCard}>
                  <Calendar size={14} color="#0E7FA7" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.booked.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Currently booked</Text>
                  <Text style={styles.dataOverviewMiniStat}>all brands</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <CheckCircle size={14} color="#55742C" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.completed.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Completed</Text>
                  <Text style={styles.dataOverviewMiniStat}>all brands</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Award size={14} color="#E6B63D" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.uniqueOffers.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Current offers</Text>
                  <Text style={styles.dataOverviewMiniStat}>total</Text>
                </View>
              </View>
              <View style={styles.dataOverviewStatsRow} testID="settings-data-overview-offer-counts">
                <View style={styles.dataOverviewStatCard}>
                  <Crown size={14} color="#1C2F7A" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.royalOffers.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Royal offers</Text>
                  <Text style={styles.dataOverviewMiniStat}>current</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Star size={14} color="#0E7FA7" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.celebrityOffers.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Celebrity offers</Text>
                  <Text style={styles.dataOverviewMiniStat}>current</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Award size={14} color="#D87924" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.carnivalOffers.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Carnival offers</Text>
                  <Text style={styles.dataOverviewMiniStat}>current</Text>
                </View>
              </View>
              <View style={styles.dataOverviewStatsRow} testID="settings-data-overview-support-counts">
                <View style={styles.dataOverviewStatCard}>
                  <Calendar size={14} color="#3E84D9" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.events.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Events</Text>
                  <Text style={styles.dataOverviewMiniStat}>in system</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Database size={14} color="#822A25" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.machines.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Machines</Text>
                  <Text style={styles.dataOverviewMiniStat}>loaded</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Users size={14} color="#4EC0A5" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.crewMembers.toLocaleString()}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Unique crew</Text>
                  <Text style={styles.dataOverviewMiniStat}>{dataStats.crewRecognitionEntries.toLocaleString()} records</Text>
                </View>
              </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.settingsSearchCard} testID="settings-search-card" onLayout={(event) => { settingsActionsYRef.current = event.nativeEvent.layout.y; }}>
            <View style={styles.settingsSearchBar}>
              <Search size={18} color={COLORS.textMuted} />
              <TextInput
                value={settingsSearchQuery}
                onChangeText={setSettingsSearchQuery}
                placeholder="Search settings and actions"
                placeholderTextColor={COLORS.textMuted}
                style={styles.settingsSearchInput}
                returnKeyType="search"
                testID="settings-search-input"
              />
              {settingsSearchQuery ? (
                <TouchableOpacity onPress={() => setSettingsSearchQuery('')} style={styles.settingsSearchClear} testID="settings-search-clear" accessibilityLabel="Clear settings search">
                  <X size={18} color={COLORS.navyDeep} />
                </TouchableOpacity>
              ) : null}
            </View>
            {normalizedSettingsSearch ? (
              <View style={styles.settingsSearchResults} testID="settings-search-results">
                {visibleSettingsSearchItems.length ? visibleSettingsSearchItems.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.settingsSearchResult} onPress={item.onPress} accessibilityRole="button" testID={`settings-search-result-${item.id}`}>
                    <View style={styles.settingsSearchResultCopy}>
                      <Text style={styles.settingsSearchResultGroup}>{item.group}</Text>
                      <Text style={styles.settingsSearchResultLabel}>{item.label}</Text>
                      <Text style={styles.settingsSearchResultDetail}>{item.detail}</Text>
                    </View>
                    <ChevronRight size={18} color={COLORS.navyDeep} />
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.settingsSearchEmpty}>No matching setting. Try “backup,” “sync,” “appearance,” or “privacy.”</Text>
                )}
              </View>
            ) : (
              <View style={styles.settingsShortcutSection}>
                <View style={styles.settingsGroupSummary} testID="settings-group-summary">
                  {settingsShortcutItems.map((item) => {
                    const isActive = Boolean(item.group && activeSettingsGroup === item.group);
                    return <TouchableOpacity key={item.label} style={[styles.settingsGroupChip, isActive && styles.settingsGroupChipActive]} onPress={() => revealSettingsGroup(item.group)} accessibilityRole="button" accessibilityState={{ selected: isActive }} testID={`settings-shortcut-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                      <Text style={styles.settingsGroupChipEmoji}>{item.emoji}</Text>
                      <Text style={[styles.settingsGroupChipText, isActive && styles.settingsGroupChipTextActive]} numberOfLines={1}>{item.label}</Text>
                    </TouchableOpacity>
                  })}
                </View>
                <Text style={styles.settingsPinnedHintText} testID="settings-always-visible-hint">Profile, Connections, and Data Import stay visible below.</Text>
                {selectedSettingsActions.length ? <View style={styles.settingsSearchResults} testID="settings-selected-actions">
                  <Text style={styles.settingsSearchResultGroup}>{activeSettingsGroup.toUpperCase()}</Text>
                  {selectedSettingsActions.map((item) => <TouchableOpacity key={`selected-${item.id}`} style={styles.settingsSearchResult} onPress={item.onPress} accessibilityRole="button" testID={`settings-selected-action-${item.id}`}>
                    <View style={styles.settingsSearchResultCopy}><Text style={styles.settingsSearchResultLabel}>{item.label}</Text><Text style={styles.settingsSearchResultDetail}>{item.detail}</Text></View><ChevronRight size={18} color={COLORS.navyDeep} />
                  </TouchableOpacity>)}
                </View> : null}
              </View>
            )}
          </View>

          <View style={styles.section} testID="settings-account-section">
            <View style={styles.sectionCard}>
              {renderSectionHeader(<Users size={18} color={COLORS.white} />, 'Account', 'Traveler profiles, identity & owner scope')}
              {isAccountDetailsVisible ? <View style={styles.embeddedProfileCard}>
                <UserProfileCard
                  key={`profile-${profileDisplayUser?.id ?? normalizedAuthenticatedEmail ?? 'guest'}`}
                  currentValues={currentProfileValues}
                  enrichmentData={enrichmentData}
                  onSave={handleSaveProfile}
                  isSaving={isSaving}
                  primaryProfileLabel="User"
                  secondaryProfileLabel="Second User"
                  activeProfileSlot={activeProfileSlot}
                  onProfileSlotPress={handleProfileSlotPress}
                  showProfileSwitch={true}
                  compact
                />
              </View> : <TouchableOpacity
                style={styles.quickActionFullWidth}
                onPress={() => setIsAccountDetailsVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Open traveler profiles"
                testID="settings-open-account-details"
              >
                <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(3, 105, 161, 0.1)' }]}>
                  <Users size={16} color="#0369A1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickActionLabelInline}>Traveler profiles</Text>
                  <Text style={styles.secureAccessHint}>Open identity, loyalty, and primary/second-user controls.</Text>
                </View>
                <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
              </TouchableOpacity>}
            </View>
          </View>

          {false && activeSettingsGroup === 'Notifications' ? <View style={[styles.sectionCard, { marginBottom: SPACING.md }]} testID="voyage-notification-settings-card">
            {renderSectionHeader(<Bell size={18} color={COLORS.white} />, 'Notifications', 'Voyage reminders are local, actionable & deduplicated', ['#123D73', '#0E7FA7'])}
            <View style={styles.notificationPreferenceRow}>
              <View style={styles.notificationPreferenceIcon}>
                <Bell size={18} color={COLORS.info} />
              </View>
              <View style={styles.notificationPreferenceCopy}>
                <Text style={styles.settingLabel}>Cruise Deadline Reminders</Text>
                <Text style={styles.notificationPreferenceDetail}>Check-in, final payment, embarkation, offer expiry, and certificate expiry.</Text>
              </View>
              {isUpdatingNotificationPreference ? (
                <ActivityIndicator size="small" color={COLORS.info} />
              ) : (
                <Switch
                  value={settings.dailySummaryNotifications === true}
                  onValueChange={(value) => { void handleVoyageNotificationsToggle(value); }}
                  trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
                  thumbColor={settings.dailySummaryNotifications ? COLORS.info : '#F8FAFC'}
                  accessibilityLabel="Enable cruise deadline reminders"
                  testID="voyage-notifications-toggle"
                />
              )}
            </View>
            <Text style={styles.secureAccessHint}>
              Opt-in only. Easy Seas schedules at most 32 local reminders for the next 180 days, never books anything, and removes stale reminders after your data changes.
            </Text>
          </View> : null}

          <View style={[styles.sectionCard, { marginBottom: SPACING.md }]}> 
            {renderSectionHeader(<Ship size={18} color={COLORS.white} />, 'Connections', 'Cruise-line sync, pricing & cloud shortcuts')}
            <View style={styles.quickActionsBody}>
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={() => router.push('/royal-caribbean-sync' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(0, 112, 201, 0.1)' }]}>
                <Ship size={16} color="#0070C9" />
              </View>
              <Text style={styles.quickActionLabelInline}>Sync Royal / Celebrity Casino</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickActionFullWidth, !carnivalSyncAccess.enabled && { opacity: 0.55 }]} 
              onPress={() => {
                if (carnivalSyncAccess.enabled) {
                  router.push('/carnival-sync' as any);
                  return;
                }
                Alert.alert('Carnival Sync', carnivalSyncAccess.reason);
              }}
              activeOpacity={0.7}
              accessibilityState={{ disabled: !carnivalSyncAccess.enabled }}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(204, 34, 50, 0.1)' }]}>
                <Anchor size={16} color="#CC2232" />
              </View>
              <Text style={styles.quickActionLabelInline}>Sync Carnival Cruises</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            {isAdmin ? <TouchableOpacity
              style={styles.quickActionFullWidth}
              onPress={() => router.push('/gmail-import' as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sync Gmail"
              testID="settings-sync-gmail"
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(14, 127, 167, 0.12)' }]}> 
                <Mail size={16} color="#0E7FA7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickActionLabelInline}>Sync Gmail</Text>
                <Text style={styles.subsectionHelper}>Preview owner invoices, statements, cancellations, certificates, and bookings before applying.</Text>
              </View>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity> : null}
            <TouchableOpacity
              style={[styles.quickActionFullWidth, (isCheckingCloudSync || isCloudSyncing) && { opacity: 0.65 }]}
              onPress={() => void handleSyncToCloud()}
              activeOpacity={0.7}
              disabled={isCheckingCloudSync || isCloudSyncing}
              testID="settings-sync-to-cloud"
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(3, 105, 161, 0.1)' }]}>
                {isCheckingCloudSync || isCloudSyncing ? (
                  <ActivityIndicator size="small" color="#0369A1" />
                ) : (
                  <Upload size={16} color="#0369A1" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quickActionLabelInline}>Sync to cloud</Text>
                <Text style={styles.subsectionHelper}>
                  {lastSyncTime ? `Last backup ${new Date(lastSyncTime).toLocaleString()}` : 'Optional backup when internet and cloud service are available'}
                </Text>
              </View>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionFullWidth} onPress={() => router.push('/import-cruises' as any)} activeOpacity={0.7} testID="settings-get-all-current-pricing">
              <View style={[styles.quickActionIconSmall,{backgroundColor:'rgba(5,150,105,.1)'}]}><TrendingDown size={16} color="#059669"/></View>
              <View style={{flex:1}}><Text style={styles.quickActionLabelInline}>Get all current pricing</Text><Text style={styles.subsectionHelper}>Booked and completed cruises first, followed by saved eligible sailings; verified results only</Text></View><ChevronRight size={16} color={CLEAN_THEME.text.secondary}/>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={() => router.push('/pricing-summary' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                <TrendingDown size={16} color={COLORS.success} />
              </View>
              <Text style={styles.quickActionLabelInline}>Pricing summary and history</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            </View>
          </View>

          {false && activeSettingsGroup === 'About / Legal' ? <View style={styles.section} testID="settings-scott-astin-books">
            <View style={styles.sectionCard}>
              {renderSectionHeader(<BookOpen size={18} color={COLORS.white} />, 'About · Books by Scott Astin', 'Cruise stories, casino strategy & life at sea')}
              <Text style={styles.booksIntro}>
                Continue the Easy Seas journey with Scott’s books. Tap a cover to open its Amazon purchase page.
              </Text>
              <View style={styles.booksGrid}>
                <TouchableOpacity
                  style={styles.bookCard}
                  onPress={() => handleOpenLink(ONLY_ON_A_CRUISE_SHIP_URL)}
                  activeOpacity={0.82}
                  accessibilityRole="link"
                  accessibilityLabel="Buy Only On a Cruise Ship by Scott Astin on Amazon"
                  testID="settings-book-only-on-a-cruise-ship"
                >
                  <Image
                    source={require('../../assets/images/books/only-on-a-cruise-ship.png')}
                    style={styles.bookCover}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.bookTitle} numberOfLines={3}>Only On a Cruise Ship</Text>
                  <View style={styles.bookLinkRow}>
                    <Text style={styles.bookLinkText}>View on Amazon</Text>
                    <ExternalLink size={14} color={COLORS.info} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bookCard}
                  onPress={() => handleOpenLink(SMOOTH_SAILING_URL)}
                  activeOpacity={0.82}
                  accessibilityRole="link"
                  accessibilityLabel="Buy Smooth Sailing in Rough Waters by Scott Astin on Amazon"
                  testID="settings-book-smooth-sailing"
                >
                  <Image
                    source={require('../../assets/images/books/smooth-sailing-in-rough-waters.png')}
                    style={styles.bookCover}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.bookTitle} numberOfLines={3}>Smooth Sailing (In Rough Waters)</Text>
                  <View style={styles.bookLinkRow}>
                    <Text style={styles.bookLinkText}>View on Amazon</Text>
                    <ExternalLink size={14} color={COLORS.info} />
                  </View>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.allBooksButton}
                onPress={() => handleOpenLink(SCOTT_ASTIN_ALL_BOOKS_URL)}
                activeOpacity={0.82}
                accessibilityRole="link"
                accessibilityLabel="View all books by Scott Astin on Amazon"
                testID="settings-view-all-scott-astin-books"
              >
                <BookOpen size={18} color={COLORS.white} />
                <Text style={styles.allBooksButtonText}>View all Scott Astin books</Text>
                <ExternalLink size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View> : null}

          <View style={styles.section}>
            <View style={styles.sectionCard}>
              {renderSectionHeader(<Database size={18} color={COLORS.white} />, 'Data Import & Backup', 'Import, export, reconcile & restore your data')}
              {dataOperation ? (
                <View style={styles.operationStatusShell}>
                  <OperationStatusCard
                    operation={dataOperation}
                    onRetry={dataOperation.status === 'error' ? () => {
                      const operationId = dataOperation.id;
                      setDataOperation(null);
                      if (operationId === 'save-all') void handleExportAllData();
                      else if (operationId === 'load-all') void handleImportAllData();
                      else if (operationId === 'legacy-backup-import') void handleImportLegacyBackup();
                      else if (operationId === 'certificate-export') void handleExportCertificates();
                    } : undefined}
                    onDismiss={dataOperation.status !== 'running' ? () => setDataOperation(null) : undefined}
                  />
                  {dataOperation.status === 'error' || dataOperation.status === 'cancelled' || dataOperation.status === 'partial-success' ? <Text style={styles.subsectionHelper}>Existing app data was preserved. Review the operation details before retrying this specific action.</Text> : null}
                </View>
              ) : null}
              <View style={[styles.dataSubsection, styles.importBanner]}>
                <Text style={styles.subsectionLabel}>Import</Text>
                <Text style={styles.subsectionHelper}>Bring in new CSV manifests, booked logs, or calendar drops.</Text>
              </View>
              {renderSettingRow(
                <FileSpreadsheet size={18} color={COLORS.navyDeep} />,
                'Offers CSV',
                isImporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : lastImportResult?.type === 'offers' ? (
                  <View style={styles.successBadge}>
                    <CheckCircle size={12} color={COLORS.success} />
                    <Text style={styles.successText}>{lastImportResult.count}</Text>
                  </View>
                ) : undefined,
                handleImportOffersCSV
              )}
              {renderSettingRow(
                <Ship size={18} color={COLORS.navyDeep} />,
                'Booked Cruises CSV',
                isImporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : lastImportResult?.type === 'booked' ? (
                  <View style={styles.successBadge}>
                    <CheckCircle size={12} color={COLORS.success} />
                    <Text style={styles.successText}>{lastImportResult.count}</Text>
                  </View>
                ) : undefined,
                handleImportBookedCSV
              )}
              {renderSettingRow(
                <FolderInput size={18} color={COLORS.success} />,
                'Completed Cruises Casino History CSV/XLSX',
                isImporting ? (
                  <ActivityIndicator size="small" color={COLORS.success} />
                ) : lastImportResult?.type === 'completed' ? (
                  <View style={styles.successBadge}>
                    <CheckCircle size={12} color={COLORS.success} />
                    <Text style={styles.successText}>{lastImportResult.count}</Text>
                  </View>
                ) : undefined,
                handleImportCompletedCruisesXLSX
              )}
              {renderSettingRow(
                <Users size={18} color="#0F766E" />,
                'Crew Registry & CSV Import',
                <Text style={styles.countBadge}>{dataStats.crewMembers} crew</Text>,
                () => router.push('/crew-recognition' as any)
              )}
              {renderSettingRow(
                <Calendar size={18} color={COLORS.navyDeep} />,
                'Calendar (.ics)',
                isImporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : lastImportResult?.type === 'calendar' ? (
                  <View style={styles.successBadge}>
                    <CheckCircle size={12} color={COLORS.success} />
                    <Text style={styles.successText}>{lastImportResult.count}</Text>
                  </View>
                ) : undefined,
                handleImportCalendarICS
              )}
              {renderSettingRow(
                <MailQuestion size={18} color="#0F766E" />,
                'Import Assignment Review',
                importAssignmentReviewCount > 0 ? (
                  <Text style={styles.countBadge}>{importAssignmentReviewCount} review</Text>
                ) : (
                  <Text style={styles.countBadge}>Clear</Text>
                ),
                () => router.push('/import-review' as any)
              )}
              {renderExportActionRow({
                icon: <FolderArchive size={20} color={COLORS.navyDeep} />,
                label: 'Import earlier Easy Seas backup',
                detail: 'Restore an unencrypted JSON backup created by an earlier app version without replacing newer records.',
                testID: 'settings-import-earlier-backup',
                busy: isImportingLegacyBackup,
                onPress: handleImportLegacyBackup,
              })}
<View style={styles.dataDivider} />

              <View style={[styles.dataSubsection, styles.calendarFeedBanner]}>
                <Text style={styles.subsectionLabel}>Calendar feed</Text>
                <Text style={styles.subsectionHelper}>Publish your cruises as a subscribable calendar feed.</Text>
              </View>
              <View style={styles.calendarFeedSection}>
                <TouchableOpacity
                  style={styles.publishFeedButton}
                  onPress={handlePublishCalendarFeed}
                  activeOpacity={0.7}
                  disabled={isPublishingFeed}
                >
                  {isPublishingFeed ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Rss size={16} color={COLORS.white} />
                  )}
                  <Text style={styles.publishFeedButtonText}>
                    {calendarFeedUrl ? 'Update Feed' : 'Publish Feed'}
                  </Text>
                  {calendarFeedUrl && (
                    <View style={styles.feedLiveBadge}>
                      <View style={styles.feedLiveDot} />
                      <Text style={styles.feedLiveText}>Live</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {calendarFeedUrl && (
                  <>
                    <View style={styles.feedUrlContainer}>
                      <Link2 size={14} color={CLEAN_THEME.text.secondary} />
                      <Text style={styles.feedUrlText} numberOfLines={1} ellipsizeMode="middle">
                        {calendarFeedUrl}
                      </Text>
                    </View>
                    <View style={styles.feedActionsRow}>
                      <TouchableOpacity
                        style={[styles.feedActionButton, isCopied && styles.feedActionButtonActive]}
                        onPress={handleCopyFeedUrl}
                        activeOpacity={0.7}
                      >
                        {isCopied ? (
                          <CheckCircle size={14} color={COLORS.success} />
                        ) : (
                          <Copy size={14} color={COLORS.navyDeep} />
                        )}
                        <Text style={[styles.feedActionText, isCopied && styles.feedActionTextActive]}>
                          {isCopied ? 'Copied!' : 'Copy URL'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.feedActionButton}
                        onPress={handleSubscribeToFeed}
                        activeOpacity={0.7}
                      >
                        <Calendar size={14} color={COLORS.navyDeep} />
                        <Text style={styles.feedActionText}>Subscribe</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.feedActionButton}
                        onPress={handleRegenerateFeedToken}
                        activeOpacity={0.7}
                      >
                        <RefreshCcw size={14} color={COLORS.navyDeep} />
                        <Text style={styles.feedActionText}>New URL</Text>
                      </TouchableOpacity>
                    </View>
                    {feedLastUpdated && (
                      <Text style={styles.feedLastUpdated}>
                        Last published: {new Date(feedLastUpdated).toLocaleDateString()} at {new Date(feedLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    )}
                  </>
                )}

                {!calendarFeedUrl && (
                  <Text style={styles.feedHelperText}>
                    Publish your booked cruises and events as an .ics calendar feed that you can subscribe to from Apple Calendar, Google Calendar, Outlook, or any calendar app.
                  </Text>
                )}
              </View>

              <View style={styles.dataDivider} />
              
              <View style={[styles.dataSubsection, styles.fullBackupBanner]}>
                <Text style={styles.subsectionLabel}>Full backup</Text>
                <Text style={styles.subsectionHelper}>Export slices or recover your entire vault in one flow.</Text>
              </View>
              {renderSettingRow(
                <Upload size={18} color={COLORS.navyDeep} />,
                'Offers CSV',
                isExporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : (
                  <Text style={styles.countBadge}>
                    {dataStats.sailings} sailings
                  </Text>
                ),
                handleExportOffersCSV
              )}
              {renderSettingRow(
                <Ship size={18} color={COLORS.navyDeep} />,
                'Booked Cruises CSV',
                isExporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : (
                  <Text style={styles.countBadge}>
                    {dataStats.booked} booked
                  </Text>
                ),
                handleExportBookedCSV
              )}
              {renderSettingRow(<FileSpreadsheet size={18} color={COLORS.success} />,'Booked + Completed XLSX',isExporting?<ActivityIndicator size="small" color={COLORS.success}/>:<Text style={styles.countBadge}>All fields</Text>,handleExportBookedXLSX)}
              {renderSettingRow(
                <Download size={18} color={COLORS.navyDeep} />,
                'Calendar (.ics)',
                isExporting ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : (
                  <Text style={styles.countBadge}>
                    {dataStats.events} events
                  </Text>
                ),
                handleExportCalendarICS
              )}
              {renderExportActionRow({
                icon: <FolderArchive size={20} color="#B7791F" />,
                label: 'Export Certificates (.ZIP)',
                detail: 'Shared Club Royale certificate PDFs with parsed sailing rows, summaries, and one CSV per certificate',
                testID: 'settings-export-certificates-zip',
                busy: isExportingCertificates,
                progress: certificateExportProgress,
                onPress: handleExportCertificates,
              })}
              {renderExportActionRow({
                icon: <FolderArchive size={20} color={COLORS.success} />,
                label: 'Save All Data (.JSON)',
                detail: 'Readable complete backup you can store, inspect, and share',
                testID: 'settings-save-all',
                busy: isExportingAll,
                onPress: handleExportAllData,
              })}
              {renderExportActionRow({
                icon: <FolderInput size={20} color={COLORS.info} />,
                label: 'Load All Data (.JSON)',
                detail: 'Import a readable Easy Seas backup without deleting newer records',
                testID: 'settings-load-all',
                busy: isImportingAll,
                onPress: handleImportAllData,
              })}
            </View>
            <Text style={styles.backupHint}>
              The readable JSON backup includes all cruises, offers, events, casino sessions, personal certificates, shared downloaded Club Royale certificate records and parsed sailing rows, user profile, casino program points, loyalty points, crew recognition, provenance, relationships, preferences, and settings.
            </Text>
            <Text style={styles.extensionHint}>
              Save All includes shared offer and certificate documents plus each traveler’s private cruises, casino history, crew recognition, profile, preferences, and loyalty data.
            </Text>
          </View>

          <View style={[styles.sectionCard, { marginBottom: SPACING.md }]} testID="secure-access-settings-card">
            {renderSectionHeader(<Shield size={18} color={COLORS.white} />, 'Security', 'Protect local reservations, loyalty & casino data', ['#0F766E', '#0D9488'])}
            {renderSettingRow(
              <Shield size={18} color={requiresCredentialEnrollment ? '#B45309' : '#0F766E'} />,
              requiresCredentialEnrollment ? 'Set Device PIN' : 'Device Protection',
              requiresCredentialEnrollment ? (
                <Text style={[styles.countBadge, styles.credentialEnrollmentBadge]}>Action needed</Text>
              ) : (
                <View style={styles.credentialProtectedStatus}>
                  <CheckCircle size={14} color="#0F766E" />
                  <Text style={styles.credentialProtectedText}>Protected</Text>
                </View>
              ),
              () => setIsCredentialEnrollmentVisible(true),
            )}
            <Text style={styles.secureAccessHint}>
              Your Easy Seas data remains stored locally. The device PIN and biometric unlock protect access without requiring the optional cloud service.
            </Text>
          </View>

          {false && activeSettingsGroup === 'Integrations' ? <View style={styles.section} testID="settings-integrations-section">
            <View style={styles.sectionCard}>
              {renderSectionHeader(<Link2 size={18} color={COLORS.white} />, 'Integrations', 'Browser sync, calendar & companion tools')}
              {renderSettingRow(
                <Download size={18} color="#5a2ea6" />,
                'Download Chrome Sync Extension',
                isDownloadingExtension ? <ActivityIndicator size="small" color="#5a2ea6" /> : <Text style={styles.countBadge}>v1.0.0</Text>,
                handleDownloadExtension
              )}
              {renderSettingRow(
                <FileSpreadsheet size={18} color={COLORS.success} />,
                'Download Booked CSV Template',
                isDownloadingTemplate ? <ActivityIndicator size="small" color={COLORS.success} /> : <Text style={styles.countBadge}>Template</Text>,
                handleDownloadCSVTemplate
              )}
            </View>
            <Text style={styles.extensionHint}>
              The Chrome extension syncs offers, bookings, and loyalty data after you sign in to the cruise-line website. It never runs silently in Easy Seas.
            </Text>
          </View> : null}



          {false && activeSettingsGroup === 'Appearance' ? <View style={styles.section}>
            <View style={styles.sectionCard}>
              {renderSectionHeader(<Shield size={18} color={COLORS.white} />, 'Appearance & Data Trust', 'Theme, accessibility, provenance & integrity')}
              {renderSettingRow(
                <SettingsIcon size={18} color={COLORS.navyDeep} />,
                'Appearance & Accessibility',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/experience-settings' as any)
              )}
              {renderSettingRow(
                <Database size={18} color={COLORS.navyDeep} />,
                'Data Trust Center',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/data-trust-center' as any)
              )}
              {renderSettingRow(
                <Link2 size={18} color={COLORS.navyDeep} />,
                'Relationship Explorer',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/relationship-explorer' as any)
              )}
              {renderSettingRow(
                <CheckCircle size={18} color={COLORS.navyDeep} />,
                'Action Inbox',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/action-inbox' as any)
              )}
            </View>
          </View> : null}

          {false && activeSettingsGroup === 'Help' ? <View style={styles.section}>
            <View style={styles.sectionCard}>
              {renderSectionHeader(<HelpCircle size={18} color={COLORS.white} />, 'Help', 'Guides, learning, support & feedback')}
              {renderSettingRow(
                <HelpCircle size={18} color={COLORS.navyDeep} />,
                'Help Center',
                undefined,
                () => Alert.alert(
                  'Getting Started Guide',
                  `STEP 1: Install Chrome Extension
━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to Data Management section below
2. Click "Download Chrome Extension"
3. Extract the ZIP file to your Downloads folder
4. Open Chrome browser on your computer
5. Click the three vertical dots (⋮) → Extensions → Manage Extensions
6. Enable "Developer mode" (top right toggle)
7. Click "Load unpacked" button
8. Select the extracted Chrome extension folder

STEP 2: Scrape Your Offers
━━━━━━━━━━━━━━━━━━━━━━━━━
1. Sign in to the matching casino program:
   Royal Caribbean Club Royale or Celebrity Blue Chip
2. Look for two new buttons at the top of the page
3. Click "SHOW ALL OFFERS" button
4. Follow all prompts until you see the full grid
5. Click "EXPORT CSV" at the bottom
6. Note the number of rows in the spreadsheet
7. Click "SCRAPE WEBSITE" button
8. Wait 20-30 minutes for scraping to complete
   (Perfect time for a coffee break!)
9. The OFFERS.CSV file will download automatically

STEP 3: Import Your Data
━━━━━━━━━━━━━━━━━━━━━━━━━
1. Return to this Settings screen
2. Go to Data Management → Import section
3. Click "Offers CSV"
4. Select the OFFERS.CSV file you just downloaded
5. Wait for import to complete

STEP 4: Optional Calendar Import
━━━━━━━━━━━━━━━━━━━━━━━━━
1. Export your calendar as .ICS format
   (TripIt, Google Calendar, etc.)
2. Click "Calendar (.ics)" in Import section
3. Select your .ICS file
4. Your events will sync automatically

✓ You're all set! Start exploring your cruise data.`
                )
              )}
              {renderSettingRow(
                <BookOpen size={18} color={COLORS.navyDeep} />,
                'User Manual',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => setIsUserManualVisible(true)
              )}
              {renderSettingRow(
                <BookOpen size={18} color={COLORS.navyDeep} />,
                'Learn the System',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/learn-system' as any)
              )}
              {renderSettingRow(
                <Star size={18} color={COLORS.navyDeep} />,
                'Rate App',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://apps.apple.com/us/app/easy-seas/id6758175890?ppid=9a051237-cab0-4164-9459-4c55a1976721')
              )}
            </View>
          </View> : null}

          {false && activeSettingsGroup === 'Purchases' ? <View style={styles.section}>
            <View style={styles.sectionCard}>
              {renderSectionHeader(<Crown size={18} color={COLORS.white} />, 'Purchases & Legal', 'Manage access, purchases, privacy & terms')}
              <TouchableOpacity
                style={styles.subscriptionPromoCard}
                onPress={() => router.push('/paywall-monthly' as any)}
                activeOpacity={0.9}
                testID="settings.monthly-subscription-ad"
              >
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/dzxosciyi8toy1ie8chx3.png' }}
                  style={styles.subscriptionPromoImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <View style={styles.subscriptionStatusBanner}>
                <Crown size={18} color={
                  entitlement.subscriptionDisplayStatus === 'free_use' ? '#059669' :
                  entitlement.subscriptionDisplayStatus === 'monthly' || entitlement.subscriptionDisplayStatus === 'annual' ? '#3B82F6' :
                  entitlement.subscriptionDisplayStatus === 'grace_period' ? '#F59E0B' :
                  '#EF4444'
                } />
                <View style={styles.subscriptionStatusText}>
                  <Text style={styles.subscriptionStatusTitle}>
                    {entitlement.subscriptionDisplayStatus === 'free_use' ? (entitlement.subscriptionLevel ?? 'Free Use of App') :
                     entitlement.subscriptionDisplayStatus === 'annual' ? 'Annual Subscription' :
                     entitlement.subscriptionDisplayStatus === 'monthly' ? 'Monthly / Redeemed Access' :
                     entitlement.subscriptionDisplayStatus === 'grace_period' ? '5-Day Grace Period' :
                     'Subscription Expired'}
                  </Text>
                  <Text style={styles.subscriptionStatusSubtitle}>
                    {entitlement.subscriptionDisplayStatus === 'free_use' ? 'Admin-granted free access — all app features unlocked' :
                     entitlement.subscriptionDisplayStatus === 'annual' ? 'Annual plan or App Store redeemed access active — all features unlocked' :
                     entitlement.subscriptionDisplayStatus === 'monthly' ? 'Monthly plan or App Store redeemed access active — all features unlocked' :
                     entitlement.subscriptionDisplayStatus === 'grace_period' ? `${entitlement.trialDaysRemaining} day${entitlement.trialDaysRemaining !== 1 ? 's' : ''} remaining — full access` :
                     'Purchase a monthly subscription ($9.99/month) to continue'}
                  </Text>
                </View>
              </View>
              <View style={styles.dataDivider} />
              {renderSettingRow(
                <RefreshCcw size={18} color={COLORS.navyDeep} />,
                'Restore Purchases',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => { void entitlement.restore(); }
              )}
              {renderSettingRow(
                <Star size={18} color={COLORS.navyDeep} />,
                'Redeem App Store Code',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => { void entitlement.redeemOfferCode(); }
              )}
              {renderSettingRow(
                <ExternalLink size={18} color={COLORS.navyDeep} />,
                'Manage Subscriptions',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => { void entitlement.openManageSubscription(); }
              )}
              {renderSettingRow(
                <Calendar size={18} color={COLORS.navyDeep} />,
                'Purchase a Monthly Subscription',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/paywall-monthly' as any)
              )}
              <View style={styles.dataDivider} />
              {renderSettingRow(
                <Shield size={18} color={COLORS.navyDeep} />,
                'Privacy Policy',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => entitlement.openPrivacyPolicy()
              )}
              {renderSettingRow(
                <Shield size={18} color={COLORS.navyDeep} />,
                'Terms of Use (EULA)',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => entitlement.openTerms()
              )}
            </View>
            <Text style={styles.subscriptionHint}>
              Manage your subscription status, redeem App Store offer codes, restore previous purchases, and review legal terms. Whitelisted accounts show as Free Use of App and do not need a paid subscription.
            </Text>
          </View> : null}

          {isAdmin && activeSettingsGroup === 'Admin' && (
            <View style={styles.section}>
              <View style={styles.sectionCard}>
                {renderSectionHeader(<Shield size={18} color={COLORS.white} />, 'Admin', 'Email whitelist & data tools')}
                <View style={styles.adminHeader}>
                  <Text style={styles.adminHeaderText}>Manage user access</Text>
                  <Text style={styles.adminHeaderSubtext}>
                    Add any user email here to grant Free Use of App access. Only scott.merlis1@gmail.com and s@a.com are admins and cannot be removed.
                  </Text>
                </View>
                
                <View style={styles.addEmailContainer}>
                  <TextInput
                    style={styles.addEmailInput}
                    value={newWhitelistEmail}
                    onChangeText={setNewWhitelistEmail}
                    placeholder="Enter email for Free Use of App"
                    placeholderTextColor={CLEAN_THEME.text.secondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity 
                    style={styles.addEmailButton}
                    onPress={handleAddToWhitelist}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addEmailButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>

<View style={styles.dataDivider} />
                
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(255, 87, 34, 0.1)' }]}>
                  <Text style={styles.subsectionLabel}>Machine data</Text>
                  <Text style={styles.subsectionHelper}>Import/export machine library JSON files.</Text>
                </View>
                {renderSettingRow(
                  <Database size={18} color="#FF5722" />,
                  'Import Machines (.json)',
                  isImportingMachines ? (
                    <ActivityIndicator size="small" color="#FF5722" />
                  ) : lastImportResult?.type === 'machines' ? (
                    <View style={styles.successBadge}>
                      <CheckCircle size={12} color={COLORS.success} />
                      <Text style={styles.successText}>{lastImportResult.count}</Text>
                    </View>
                  ) : undefined,
                  handleImportMachinesJSON
                )}
                {renderSettingRow(
                  <Database size={18} color="#FF5722" />,
                  'Export Machines (.json)',
                  isExportingMachines ? (
                    <ActivityIndicator size="small" color="#FF5722" />
                  ) : (
                    <Text style={styles.countBadge}>
                      {dataStats.machines} machines
                    </Text>
                  ),
                  handleExportMachinesJSON
                )}
                {renderSettingRow(
                  <FileDown size={18} color="#FF5722" />,
                  'Export Current User Session Log (.json)',
                  isExportingSessionLog ? <ActivityIndicator size="small" color="#FF5722" /> : undefined,
                  () => void handleExportCurrentUserSessionLog()
                )}

                <View style={styles.dataDivider} />
                
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(75, 0, 130, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>SeaPass generator</Text>
                  <Text style={styles.subsectionHelper}>Generate Royal Caribbean web SeaPass cards.</Text>
                </View>
                {renderSettingRow(
                  <Ship size={18} color="#4F2A95" />,
                  'SeaPass Web Generator',
                  undefined,
                  () => router.push('/seapass-generator' as any)
                )}
                {renderSettingRow(
                  <Download size={18} color="#0070C9" />,
                  'Download SeaPass Generator',
                  isDownloadingSeaPass ? <ActivityIndicator size="small" color="#0070C9" /> : <Text style={styles.countBadge}>v1.0.0</Text>,
                  handleDownloadSeaPassGenerator
                )}
                {renderSettingRow(
                  <BookOpen size={18} color="#0E7FA7" />,
                  'LAUNCH BOOKDROP',
                  <Text style={styles.countBadge}>ADMIN USE ONLY</Text>,
                  () => router.push('/bookdrop' as any)
                )}

                <View style={styles.dataDivider} />

                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(0, 31, 63, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>Data tools</Text>
                  <Text style={styles.subsectionHelper}>Import CSV/XLSX files and reset app data.</Text>
                </View>
                {renderSettingRow(
                  <FileSpreadsheet size={18} color={COLORS.navyDeep} />,
                  'Import Offers CSV',
                  isImporting ? (
                    <ActivityIndicator size="small" color={COLORS.navyDeep} />
                  ) : lastImportResult?.type === 'offers' ? (
                    <View style={styles.successBadge}>
                      <CheckCircle size={12} color={COLORS.success} />
                      <Text style={styles.successText}>{lastImportResult.count}</Text>
                    </View>
                  ) : undefined,
                  handleImportOffersCSV
                )}
                {renderSettingRow(
                  <FolderInput size={18} color={COLORS.success} />,
                  'Import Completed Cruises Casino History CSV/XLSX',
                  isImporting ? (
                    <ActivityIndicator size="small" color={COLORS.success} />
                  ) : lastImportResult?.type === 'completed' ? (
                    <View style={styles.successBadge}>
                      <CheckCircle size={12} color={COLORS.success} />
                      <Text style={styles.successText}>{lastImportResult.count}</Text>
                    </View>
                  ) : undefined,
                  handleImportCompletedCruisesXLSX
                )}
                {renderSettingRow(
                  <FileDown size={18} color={COLORS.navyDeep} />,
                  'Export Overall App Log',
                  isExportingAppLog ? <ActivityIndicator size="small" color={COLORS.navyDeep} /> : undefined,
                  () => void handleExportOverallAppLog()
                )}
                {renderSettingRow(
                  <RefreshCcw size={18} color={COLORS.error} />,
                  'Reset All Data',
                  undefined,
                  handleClearData,
                  true
                )}

                <View style={styles.dataDivider} />

                {isLoadingWhitelist ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.navyDeep} />
                  </View>
                ) : (
                  <View style={styles.whitelistContainer}>
                    <Text style={styles.whitelistCount}>
                      {whitelist.length} Free Use of App {whitelist.length === 1 ? 'email' : 'emails'}
                    </Text>
                    {whitelist.map((email) => (
                      <View key={email} style={styles.whitelistItem}>
                        <View style={styles.whitelistItemLeft}>
                          <View style={styles.whitelistItemIcon}>
                            <CheckCircle size={16} color={COLORS.success} />
                          </View>
                          <Text style={styles.whitelistItemEmail}>{email}</Text>
                          {isAdminAccountEmail(email) ? (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>Admin</Text>
                            </View>
                          ) : (
                            <View style={styles.freeUseBadge}>
                              <Text style={styles.freeUseBadgeText}>Free use</Text>
                            </View>
                          )}
                        </View>
                        {!isAdminAccountEmail(email) && (
                          <TouchableOpacity
                            onPress={() => handleRemoveFromWhitelist(email)}
                            style={styles.removeButton}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={16} color={COLORS.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {false && activeSettingsGroup === 'Danger Zone' ? <View style={styles.section}>
            <View style={[styles.sectionCard, styles.dangerCard]}>
              {renderSectionHeader(<Trash2 size={18} color={COLORS.white} />, 'Danger Zone', 'Irreversible actions', ['#DC2626', '#B91C1C'])}
              {renderSettingRow(
                <Trash2 size={18} color={COLORS.error} />,
                'Clear All Data',
                undefined,
                handleClearData,
                true
              )}
            </View>
          </View> : null}

          {false && activeSettingsGroup === 'About / Legal' ? <View style={styles.section}>
            <View style={styles.aboutPromoSection}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/h9viq065jv5liw4sy78sl' }}
                style={styles.aboutBanner}
                resizeMode="cover"
              />
              <View style={styles.aboutQrRow}>
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/t70pmy9bqdf95tfyftktj' }}
                  style={styles.aboutQrCode}
                  resizeMode="contain"
                />
                <View style={styles.aboutQrText}>
                  <Text style={styles.aboutQrTitle}>Download Easy Seas</Text>
                  <Text style={styles.aboutQrSubtitle}>Scan the QR code to get the app on your device</Text>
                  <TouchableOpacity
                    onPress={() => handleOpenLink('https://apps.apple.com/us/app/easy-seas/id6758175890?ppid=9a051237-cab0-4164-9459-4c55a1976721')}
                    style={styles.aboutAppStoreButton}
                    activeOpacity={0.7}
                  >
                    <ExternalLink size={14} color="#FFFFFF" />
                    <Text style={styles.aboutAppStoreText}>App Store</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View> : null}

          {false && activeSettingsGroup === 'About / Legal' ? <View style={styles.footer}>
            <View style={styles.footerHeroCard}>
              <View style={styles.footerHeroOverlay}>
                <Text style={styles.footerHeroTitle}>Easy Seas™</Text>
                <Text style={styles.footerHeroSubtitle}>Manage your Nautical Lifestyle™</Text>
              </View>
            </View>

            <Text style={styles.footerCopyright}>© Easy Seas Ventures LLC</Text>
            
            <View style={styles.legalDisclaimerSection}>
              <Text style={styles.legalDisclaimerTitle}>Legal disclaimer</Text>
              <Text style={styles.legalDisclaimerText}>
                This application is provided for informational and entertainment purposes only. The creator of this application, Royal Computer Consulting, Scott Merlis, and any associated parties expressly disclaim all liability for any actions, decisions, or consequences resulting from the use of this application. Users assume all responsibility and risk associated with the use of this software.
                {"\n\n"}
                This application is not intended to be, nor should it be construed as, a gambling manual, guide, or instructional material. It does not provide gambling advice, strategies, or recommendations.
                {"\n\n"}
                If you or someone you know has a gambling problem, please seek help immediately:
                {"\n"}
                • National Council on Problem Gambling: 1-800-522-4700
                {"\n"}
                • Gamblers Anonymous: www.gamblersanonymous.org
                {"\n\n"}
                This application is provided &quot;AS IS&quot; without warranty of any kind. You use this application entirely at your own risk and discretion. No representations, warranties, or guarantees are made regarding the accuracy, reliability, completeness, or timeliness of any information provided.
                {"\n\n"}
                By using this application, you agree to indemnify, defend, and hold harmless the creator, Royal Computer Consulting, Scott Merlis, and all associated parties from any and all claims, damages, losses, liabilities, costs, and expenses arising from your use of this application.
                {"\n\n"}
                TRADEMARK NOTICE: All trademarks, service marks, trade names, trade dress, product names, ship names, and logos appearing in this application, including but not limited to &quot;Club Royale,&quot; &quot;Blue Chip Club,&quot; &quot;Royal Caribbean,&quot; &quot;Celebrity Cruises,&quot; and all associated cruise ship names, are the property of their respective owners. The creator and operator of this application, Royal Computer Consulting and Scott Merlis, have no affiliation, association, authorization, endorsement, or sponsorship with or by Royal Caribbean International, Celebrity Cruises, or any of their parent companies, subsidiaries, or affiliates. All such trademarks and proprietary information are used solely for descriptive and informational purposes.
              </Text>
            </View>
          </View> : null}
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isCredentialEnrollmentVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeCredentialEnrollment}
      >
        <View style={styles.credentialModalBackdrop}>
          <View style={styles.credentialModalCard} testID="device-pin-enrollment-modal">
            <View style={styles.credentialModalIcon}>
              <Shield size={26} color="#0F766E" />
            </View>
            <Text style={styles.credentialModalTitle}>{requiresCredentialEnrollment ? 'Protect Easy Seas' : 'Update Device PIN'}</Text>
            <Text style={styles.credentialModalCopy}>
              {requiresCredentialEnrollment
                ? 'Create a six-digit PIN for this device. Your cruises and casino records are not deleted or uploaded.'
                : 'Replace the six-digit PIN used to unlock Easy Seas on this device. Your saved data remains unchanged.'}
            </Text>
            <TextInput
              style={styles.credentialPinInput}
              value={credentialPin}
              onChangeText={(value) => setCredentialPin(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter six-digit PIN"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              secureTextEntry={true}
              maxLength={6}
              autoFocus={true}
              testID="device-pin-enrollment-input"
            />
            <TextInput
              style={styles.credentialPinInput}
              value={credentialPinConfirmation}
              onChangeText={(value) => setCredentialPinConfirmation(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Confirm six-digit PIN"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              secureTextEntry={true}
              maxLength={6}
              testID="device-pin-enrollment-confirmation"
            />
            <View style={styles.credentialModalActions}>
              <TouchableOpacity
                style={styles.credentialModalCancel}
                onPress={closeCredentialEnrollment}
                disabled={isEnrollingCredential}
                activeOpacity={0.8}
              >
                <Text style={styles.credentialModalCancelText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.credentialModalEnable, isEnrollingCredential && { opacity: 0.65 }]}
                onPress={() => { void handleCredentialEnrollment(); }}
                disabled={isEnrollingCredential}
                activeOpacity={0.8}
                testID="device-pin-enrollment-submit"
              >
                {isEnrollingCredential ? <ActivityIndicator size="small" color={COLORS.white} /> : <Shield size={16} color={COLORS.white} />}
                <Text style={styles.credentialModalEnableText}>{requiresCredentialEnrollment ? 'Enable' : 'Update PIN'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <UserManualModal
        visible={isUserManualVisible}
        onClose={() => setIsUserManualVisible(false)}
      />

      <Modal
        visible={pendingSmartImportReview !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPendingSmartImportReview(null)}
      >
        <View style={styles.smartImportModalBackdrop}>
          <View style={styles.smartImportModalCard} testID="smart-import-pre-apply-review">
            <View style={styles.smartImportModalHeader}>
              <View style={styles.smartImportHeaderIcon}>
                <FileSpreadsheet size={20} color="#A7F3D0" />
              </View>
              <View style={styles.smartImportHeaderCopy}>
                <Text style={styles.smartImportModalTitle}>{pendingSmartImportReview?.title ?? 'Smart Import Review'}</Text>
                <Text style={styles.smartImportModalSubtitle} numberOfLines={1}>{pendingSmartImportReview?.fileName ?? 'Pending file'}</Text>
              </View>
              <TouchableOpacity style={styles.smartImportCloseButton} onPress={() => setPendingSmartImportReview(null)} activeOpacity={0.75} testID="smart-import-review-close">
                <X size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.smartImportSummaryGrid}>
              <View style={styles.smartImportSummaryCell}>
                <Text style={styles.smartImportSummaryValue}>{pendingSmartImportReview?.summary.addedRows ?? 0}</Text>
                <Text style={styles.smartImportSummaryLabel}>Add</Text>
              </View>
              <View style={styles.smartImportSummaryCell}>
                <Text style={styles.smartImportSummaryValue}>{pendingSmartImportReview?.summary.updatedRows ?? 0}</Text>
                <Text style={styles.smartImportSummaryLabel}>Update</Text>
              </View>
              <View style={styles.smartImportSummaryCell}>
                <Text style={styles.smartImportSummaryValue}>{pendingSmartImportReview?.summary.reviewNeededItems ?? 0}</Text>
                <Text style={styles.smartImportSummaryLabel}>Review</Text>
              </View>
              <View style={styles.smartImportSummaryCell}>
                <Text style={styles.smartImportSummaryValue}>{pendingSmartImportReview?.summary.suggestedArchiveRows ?? 0}</Text>
                <Text style={styles.smartImportSummaryLabel}>Preserve</Text>
              </View>
            </View>

            <Text style={styles.smartImportReviewIntro}>Review each imported row before applying. Nothing is written until you tap Apply.</Text>

            <ScrollView style={styles.smartImportRowsScroll} contentContainerStyle={styles.smartImportRowsContent} showsVerticalScrollIndicator={true}>
              {(pendingSmartImportReview?.rows ?? []).map(renderSmartImportReviewRow)}
            </ScrollView>

            <View style={styles.smartImportFooter}>
              <TouchableOpacity style={styles.smartImportCancelButton} onPress={() => setPendingSmartImportReview(null)} activeOpacity={0.8} testID="smart-import-review-cancel">
                <Text style={styles.smartImportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smartImportApplyButton, isImporting && styles.smartImportApplyButtonDisabled]}
                onPress={() => { void pendingSmartImportReview?.onApply(); }}
                activeOpacity={0.86}
                disabled={isImporting || pendingSmartImportReview === null}
                testID="smart-import-review-apply"
              >
                {isImporting ? <ActivityIndicator size="small" color={COLORS.white} /> : <CheckCircle size={16} color={COLORS.white} />}
                <Text style={styles.smartImportApplyText}>{pendingSmartImportReview?.applyLabel ?? 'Apply Import'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F2',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 28,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.fontSizeHeader,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: -0.5,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
    letterSpacing: 1.5,
  },
  dangerTitle: {
    color: COLORS.error,
  },
  sectionCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  settingsThemedHeader: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: 0,
    borderBottomColor: '#D5D5D0',
  },
  operationStatusShell: {
    paddingHorizontal: SPACING.md,
  },
  booksIntro: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    color: '#66737F',
    fontFamily: TYPOGRAPHY.fontFamilyEditorial,
    fontSize: 15,
    lineHeight: 22,
  },
  booksGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  bookCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9E1E6',
    borderRadius: 14,
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    shadowColor: '#17324D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  bookCover: {
    width: '100%',
    height: 190,
    borderRadius: 7,
    backgroundColor: '#F7F9FA',
  },
  bookTitle: {
    alignSelf: 'stretch',
    minHeight: 58,
    marginTop: SPACING.sm,
    color: '#17324D',
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
  },
  bookLinkRow: {
    alignSelf: 'stretch',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D9E1E6',
    marginTop: 4,
  },
  bookLinkText: {
    flex: 1,
    color: COLORS.info,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  allBooksButton: {
    minHeight: 50,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: 12,
    backgroundColor: '#17324D',
  },
  allBooksButtonText: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  dangerCard: {
    borderColor: 'rgba(244, 67, 54, 0.3)',
    backgroundColor: '#FFF5F5',
  },
  profileLoadingCard: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    padding: SPACING.lg,
    ...SHADOW.sm,
  },
  profileLoadingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
  },
  profileLoadingCopy: {
    flex: 1,
  },
  profileLoadingTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  profileLoadingSubtitle: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 105, 161, 0.08)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
    flexShrink: 1,
  },
  settingLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  dangerLabel: {
    color: COLORS.error,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  settingValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  exportActionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 105, 161, 0.12)',
  },
  exportActionRowBusy: { backgroundColor: '#EFF6FF', opacity: 0.85 },
  quickActionBusy: { backgroundColor: '#EFF6FF', opacity: 0.82 },
  exportActionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: 'rgba(3, 105, 161, 0.15)' },
  exportActionCopy: { flex: 1, minWidth: 0 },
  exportActionLabel: { color: COLORS.navyDeep, fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '800' },
  exportActionDetail: { marginTop: 3, color: '#64748B', fontSize: TYPOGRAPHY.fontSizeXS, lineHeight: 16 },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: SPACING.lg,
  },
  footerHeroCard: {
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 160,
    width: '100%' as const,
    marginBottom: SPACING.md,
    ...SHADOW.lg,
  },
  footerHeroOverlay: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  footerHeroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: COLORS.white,
    letterSpacing: 1,
    textAlign: 'center' as const,
  },
  footerHeroSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: 'center' as const,
  },
  footerCopyright: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    opacity: 0.7,
    marginTop: SPACING.md,
  },

  legalDisclaimerSection: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(3, 105, 161, 0.15)',
    paddingHorizontal: SPACING.md,
  },
  legalDisclaimerTitle: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.error,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  legalDisclaimerText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 16,
    textAlign: 'left',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  successText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  countBadge: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#64748B',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.1)',
    overflow: 'hidden' as const,
  },
  backupHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.xs,
    fontStyle: 'italic' as const,
  },
  extensionHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#5a2ea6',
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
    fontStyle: 'italic' as const,
  },
  dataSubsection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: 'rgba(3, 105, 161, 0.05)',
  },
  importBanner: {
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
  },
  fullBackupBanner: {
    backgroundColor: 'rgba(3, 105, 161, 0.06)',
  },
  subsectionLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 1.5,
  },
  subsectionHelper: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    letterSpacing: 0.5,
  },
  dataDivider: {
    height: 1,
    backgroundColor: 'rgba(3, 105, 161, 0.1)',
    marginVertical: SPACING.xs,
  },
  dataOverviewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  dataOverviewHeader: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dataOverviewHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  dataOverviewIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F3F2',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataOverviewTitleGroup: {
    flex: 1,
  },
  dataOverviewTitle: {
    fontSize: 16,
    lineHeight: 18,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600',
    color: '#0F2247',
    letterSpacing: 0.3,
  },
  dataOverviewSubtitle: {
    fontSize: 9,
    color: '#58585B',
    marginTop: 2,
  },
  dataOverviewBody: {
    padding: 3,
  },
  dataOverviewLoading: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: '#FFFFFF',
  },
  dataOverviewLoadingTitle: {
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontSize: 16,
    color: '#0F2247',
  },
  dataOverviewLoadingText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#58585B',
  },
  dataOverviewStatsRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 0,
  },
  dataOverviewStatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 0,
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#D5D5D0',
  },
  dataOverviewStatValue: {
    fontSize: 14,
    lineHeight: 16,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: '#0F2247',
  },
  dataOverviewStatLabel: {
    fontSize: 8,
    color: '#58585B',
    textAlign: 'center',
  },
  dataOverviewUpcomingCompletedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  dataOverviewMiniStat: {
    fontSize: 7,
    color: '#64748B',
  },
  dataOverviewMiniStatDivider: {
    fontSize: 9,
    color: '#94A3B8',
  },
  dataOverviewGrid: {
    flexDirection: 'row',
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5D5D0',
  },
  dataOverviewGridCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 0,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#D5D5D0',
  },
  dataOverviewGridIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  dataOverviewGridValue: {
    fontSize: 13,
    lineHeight: 15,
    fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold,
    fontWeight: '600' as const,
    color: '#0F2247',
  },
  dataOverviewGridLabel: {
    fontSize: 8,
    color: '#58585B',
    marginTop: 2,
    textAlign: 'center' as const,
  },
  quickActionsSection: {
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  quickActionFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(3, 105, 161, 0.15)',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(3, 105, 161, 0.15)',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIconSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionLabelInline: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1E293B',
    letterSpacing: 0.1,
  },
  adminHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(3, 105, 161, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 105, 161, 0.12)',
  },
  adminHeaderText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  adminHeaderSubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    lineHeight: 16,
  },
  addEmailContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 105, 161, 0.1)',
  },
  addEmailInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  addEmailButton: {
    backgroundColor: '#0369A1',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEmailButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  whitelistContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  whitelistCount: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.sm,
  },
  whitelistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.12)',
  },
  whitelistItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  whitelistItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whitelistItemEmail: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    flex: 1,
  },
  adminBadge: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  adminBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  freeUseBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  freeUseBadgeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  removeButton: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
  },
  aboutPromoSection: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
    ...SHADOW.sm,
  },
  aboutBanner: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
  },
  aboutQrRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.md,
  },
  aboutQrCode: {
    width: 90,
    height: 90,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FFFFFF',
  },
  aboutQrText: {
    flex: 1,
  },
  aboutQrTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  aboutQrSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  aboutAppStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  aboutAppStoreText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  subscriptionPromoCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
    backgroundColor: '#DDEBFF',
    ...SHADOW.sm,
  },
  subscriptionPromoImage: {
    width: '100%',
    aspectRatio: 1,
  },
  subscriptionStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.12)',
  },
  subscriptionStatusText: {
    flex: 1,
  },
  subscriptionStatusTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  subscriptionStatusSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
  },
  subscriptionHint: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
    lineHeight: 16,
  },
  calendarFeedBanner: {
    backgroundColor: 'rgba(3, 105, 161, 0.1)',
  },
  calendarFeedSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  publishFeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0369A1',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
  },
  publishFeedButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  feedLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.round,
    marginLeft: 4,
  },
  feedLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  feedLiveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  feedUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.12)',
  },
  feedUrlText: {
    flex: 1,
    fontSize: 11,
    color: CLEAN_THEME.text.secondary,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  feedActionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  feedActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.12)',
  },
  feedActionButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  feedActionText: {
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  feedActionTextActive: {
    color: COLORS.success,
  },
  feedLastUpdated: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.sm,
    textAlign: 'center' as const,
  },
  feedHelperText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: SPACING.sm,
    lineHeight: 16,
  },
  sectionGradientHeader: {
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  sectionHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  sectionHeaderSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  smartImportModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  smartImportModalCard: {
    maxHeight: '88%',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  smartImportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.navyDeep,
  },
  smartImportHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.25)',
  },
  smartImportHeaderCopy: {
    flex: 1,
  },
  smartImportModalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  smartImportModalSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.74)',
  },
  smartImportCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  smartImportSummaryGrid: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  smartImportSummaryCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.12)',
  },
  smartImportSummaryValue: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  smartImportSummaryLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#64748B',
    letterSpacing: 0.6,
  },
  smartImportReviewIntro: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#475569',
    lineHeight: 19,
  },
  smartImportRowsScroll: {
    marginTop: SPACING.sm,
  },
  smartImportRowsContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  smartImportRow: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOW.sm,
  },
  smartImportRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  smartImportKindPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#E0F2FE',
  },
  smartImportKindText: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#075985',
  },
  smartImportActionPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
  },
  smartImportActionAdd: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  smartImportActionUpdate: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  smartImportActionPreserve: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  smartImportActionReview: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  smartImportActionText: {
    fontSize: 10,
    fontWeight: '900' as const,
    color: '#0F172A',
  },
  smartImportRowTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  smartImportRowSubtitle: {
    marginTop: 3,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#334155',
    lineHeight: 18,
  },
  smartImportRowMeta: {
    marginTop: 5,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  smartImportDiffText: {
    marginTop: 5,
    fontSize: 11,
    color: '#0F766E',
    lineHeight: 16,
  },
  smartImportFieldDiffList: {
    marginTop: SPACING.sm,
    gap: 5,
  },
  smartImportFieldDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
  },
  smartImportFieldName: {
    width: 82,
    fontSize: 10,
    fontWeight: '900' as const,
    color: COLORS.navyDeep,
  },
  smartImportFieldBefore: {
    flex: 1,
    fontSize: 10,
    color: '#64748B',
    textDecorationLine: 'line-through' as const,
  },
  smartImportFieldAfter: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#0F766E',
  },
  smartImportMoreDiffs: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#64748B',
  },
  smartImportFooter: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: COLORS.white,
  },
  smartImportCancelButton: {
    flex: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 13,
  },
  smartImportCancelText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#334155',
  },
  smartImportApplyButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#0F766E',
    paddingVertical: 13,
  },
  smartImportApplyButtonDisabled: {
    opacity: 0.7,
  },
  smartImportApplyText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  credentialEnrollmentBadge: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
  },
  notificationPreferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  notificationPreferenceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
  },
  notificationPreferenceCopy: {
    flex: 1,
  },
  notificationPreferenceDetail: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },
  credentialProtectedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  credentialProtectedText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0F766E',
  },
  secureAccessHint: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeXS,
    lineHeight: 17,
    color: '#475569',
  },
  credentialModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  credentialModalCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: COLORS.white,
    ...SHADOW.lg,
  },
  credentialModalIcon: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#CCFBF1',
  },
  credentialModalTitle: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  credentialModalCopy: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: '#475569',
  },
  credentialPinInput: {
    minHeight: 52,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    letterSpacing: 4,
    color: COLORS.navyDeep,
  },
  credentialModalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  credentialModalCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BORDER_RADIUS.md,
  },
  credentialModalCancelText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#334155',
  },
  credentialModalEnable: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#0F766E',
  },
  credentialModalEnableText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  settingsSearchCard: {
    marginBottom: 10,
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#D5D5D0',
    ...SHADOW.sm,
  },
  settingsSearchBar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: '#F5F5F4',
    borderWidth: 1,
    borderColor: '#D5D5D0',
  },
  settingsSearchInput: {
    flex: 1,
    minHeight: 40,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
  },
  settingsSearchClear: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPinnedHint: {
    marginTop: 10,
    paddingHorizontal: 3,
  },
  settingsPinnedHintTitle: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0E7FA7',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  settingsPinnedHintText: {
    marginTop: 7,
    fontSize: 10,
    lineHeight: 13,
    color: CLEAN_THEME.text.secondary,
    textAlign: 'center',
  },
  settingsShortcutSection: {
    marginTop: 8,
  },
  settingsGroupSummaryTitle: {
    marginTop: 10,
    paddingHorizontal: 3,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  settingsGroupSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  settingsGroupChip: {
    width: '32%',
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#B9C9C8',
  },
  settingsGroupChipActive: {
    backgroundColor: '#167C80',
    borderColor: '#167C80',
  },
  settingsGroupChipEmoji: {
    fontSize: 14,
    lineHeight: 16,
    marginBottom: 1,
  },
  settingsGroupChipText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    textAlign: 'center',
  },
  settingsGroupChipTextActive: {
    color: '#FFFFFF',
  },
  settingsSearchResults: {
    paddingTop: SPACING.sm,
    gap: 8,
  },
  settingsSearchResult: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#D5D5D0',
    backgroundColor: COLORS.white,
  },
  settingsSearchResultCopy: {
    flex: 1,
  },
  settingsSearchResultGroup: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#0E7FA7',
    letterSpacing: 0.7,
  },
  settingsSearchResultLabel: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  settingsSearchResultDetail: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: CLEAN_THEME.text.secondary,
  },
  settingsSearchEmpty: {
    paddingVertical: SPACING.md,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  embeddedProfileCard: {
    paddingTop: SPACING.xs,
  },
  quickActionsBody: {
    padding: 12,
    paddingTop: 14,
    gap: 0,
  },
});
