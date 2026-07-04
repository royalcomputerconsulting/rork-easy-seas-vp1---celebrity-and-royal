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
  FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
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
  MailQuestion,
  X,
  Activity,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { isDateInPast } from '@/lib/date';
import { isActiveBookedCruise, isCompletedBookedCruise } from '@/lib/bookedCruiseStatus';
import { useAppState } from '@/state/AppStateProvider';
import { useUser } from '@/state/UserProvider';
import { 
  pickAndReadFile, 
  parseOffersCSV, 
  parseICSFile, 
  parseBookedCSV,
  generateOffersCSV, 
  generateCalendarICS,
  generateBookedCSV,
  exportFile,
  downloadFromURL,
  healImportedData
} from '@/lib/importExport';
import {
  clearAllAppData,
  exportAllDataToFile,
  importAllDataFromFile,
} from '@/lib/dataManager';
import { getUserScopedKey, ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { quotaSafeGetItem } from '@/lib/storage/quotaSafeStorage';
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
import { RENDER_BACKEND_URL, isCloudBackupEnabled, trpc } from '@/lib/trpc';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise, ImportReconciliationSummary } from '@/types/models';
import { getCalendarEventsWithGeneratedCruiseEvents, getDayAgendaEventCountForYear } from '@/lib/calendar/cruiseEvents';
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
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { saveMockData } from '@/lib/saveMockData';
import { generateSampleData, SAMPLE_LOYALTY_POINTS } from '@/lib/sampleData';
import { ADMIN_EMAILS, useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { UserManualModal } from '@/components/UserManualModal';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useEntitlement } from '@/state/EntitlementProvider';
import { useCrewRecognition } from '@/state/CrewRecognitionProvider';
import { useUserDataSync } from '@/state/UserDataSyncProvider';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { getManagedSecondProfile } from '@/lib/intelligenceFilters';
import { buildDiagnosticExport, clearDiagnosticEvents, recordDiagnosticEvent } from '@/lib/diagnosticLogger';
import { getDoubleOccupancyRoomRetailValue } from '@/lib/valueCalculator';

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

type PendingSmartImportReview = {
  title: string;
  fileName: string;
  summary: ImportReconciliationSummary;
  rows: SmartImportReviewRow[];
  applyLabel: string;
  onApply: () => Promise<void>;
};

export default function SettingsScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();
  const { clearLocalData, setLocalData, localData } = useAppState();
  const coreData = useCoreData();
  const { clearAllData, bookedCruises, setCruises, casinoOffers, setBookedCruises, setCasinoOffers } = coreData;
  const cruises = coreData.cruises;
  const {
    currentUser,
    updateUser,
    addUser,
    ensureOwner,
    syncFromStorage: syncUserFromStorage,
    isLoading: isUserLoading,
    users,
  } = useUser();
  const {
    clubRoyalePoints: loyaltyClubRoyalePoints,
    crownAnchorPoints: loyaltyCrownAnchorPoints,
    crownAnchorLevel: loyaltyCrownAnchorLevel,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    setManualClubRoyalePoints,
    setManualCrownAnchorPoints,
    syncFromStorage: syncLoyaltyFromStorage,
    extendedLoyalty,
    venetianSociety,
    captainsClub,
  } = useLoyalty();
  
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<{ type: string; count: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [isDownloadingExtension, setIsDownloadingExtension] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDownloadingSeaPass, setIsDownloadingSeaPass] = useState(false);
  const [isExportingDiagnostics, setIsExportingDiagnostics] = useState(false);

  const [isImportingMachines, setIsImportingMachines] = useState(false);
  const [isExportingMachines, setIsExportingMachines] = useState(false);
  const [isSavingMockData, setIsSavingMockData] = useState(false);
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

  const { myAtlasMachines, exportMachinesJSON, importMachinesJSON, reload: reloadMachines } = useSlotMachineLibrary();
  const { reload: reloadCasinoSessions } = useCasinoSessions();
  const { isAdmin, getWhitelist, addToWhitelist, removeFromWhitelist, updateEmail, authenticatedEmail } = useAuth();
  const { stats: crewStats } = useCrewRecognition();
  const { forceSyncNow: forceProfileSyncNow } = useUserDataSync();
  const { selectedProfileId, setSelectedProfileId } = useIntelligenceFilters();
  const linkedProfileEnsuredRef = useRef(false);
  // Which profile the Edit Profile card in Settings is showing/editing. This is intentionally a
  // dedicated, local piece of state -- it used to reuse the shared cross-tab `selectedProfileId`
  // intelligence filter, which meant toggling "User" / "Second User" here also silently changed
  // the data-filtering scope on the Offers/Cruises/Casino tabs, and the toggle itself was
  // unreliable because it depended on that shared filter settling into the right value. Keeping
  // it local guarantees the toggle always switches immediately and never leaks into other tabs.
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const normalizedAuthenticatedEmail = useMemo(() => normalizeAccountEmail(authenticatedEmail), [authenticatedEmail]);
  const activeUserProfiles = useMemo(() => users.filter((profile) => profile.active !== false), [users]);
  const primaryProfileUser = useMemo(() => {
    if (currentUser) {
      return currentUser;
    }

    return activeUserProfiles.find((profile) => profile.isOwner || normalizeAccountEmail(profile.email) === normalizedAuthenticatedEmail)
      ?? activeUserProfiles[0]
      ?? null;
  }, [activeUserProfiles, currentUser, normalizedAuthenticatedEmail]);
  const linkedSecondProfile = useMemo(() => getManagedSecondProfile(activeUserProfiles), [activeUserProfiles]);
  const selectedSettingsProfile = useMemo(() => {
    if (editingProfileId) {
      const explicitProfile = activeUserProfiles.find((profile) => profile.id === editingProfileId);
      if (explicitProfile) {
        return explicitProfile;
      }
    }

    return primaryProfileUser;
  }, [activeUserProfiles, editingProfileId, primaryProfileUser]);
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
      setEditingProfileId(linkedSecondProfile?.id ?? null);
      return;
    }

    setEditingProfileId(primaryProfileUser?.id ?? null);
  }, [linkedSecondProfile?.id, primaryProfileUser?.id]);

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

  const currentProfileValues = useMemo(() => ({
    name: profileDisplayUser?.name || '',
    email: profileDisplayUser?.email || authenticatedEmail || '',
    crownAnchorNumber: profileDisplayUser?.crownAnchorNumber || '',
    clubRoyalePoints: isPrimaryProfileSelected ? loyaltyClubRoyalePoints : (profileDisplayUser?.clubRoyalePoints ?? 0),
    clubRoyaleTier: isPrimaryProfileSelected ? loyaltyClubRoyaleTier : (profileDisplayUser?.clubRoyaleTier || ''),
    loyaltyPoints: isPrimaryProfileSelected ? loyaltyCrownAnchorPoints : (profileDisplayUser?.loyaltyPoints ?? 0),
    crownAnchorLevel: isPrimaryProfileSelected ? loyaltyCrownAnchorLevel : (profileDisplayUser?.crownAnchorLevel || ''),
    celebrityEmail: profileDisplayUser?.celebrityEmail || '',
    celebrityCaptainsClubNumber: profileDisplayUser?.celebrityCaptainsClubNumber || '',
    celebrityCaptainsClubPoints: profileDisplayUser?.celebrityCaptainsClubPoints || 0,
    celebrityBlueChipPoints: profileDisplayUser?.celebrityBlueChipPoints || 0,
    celebrityBlueChipTier: profileDisplayUser?.celebrityBlueChipTier || 'Pearl',
    celebrityCaptainsClubLevel: 'Preview',
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
  }), [
    authenticatedEmail,
    loyaltyClubRoyalePoints,
    loyaltyClubRoyaleTier,
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
      captainsClubPoints: captainsClub?.points || extendedLoyalty?.captainsClubPoints,
      captainsClubRelationshipPoints: extendedLoyalty?.captainsClubRelationshipPoints,
      captainsClubNextTier: captainsClub?.nextTier || extendedLoyalty?.captainsClubNextTier,
      captainsClubRemainingPoints: captainsClub?.remainingPoints || extendedLoyalty?.captainsClubRemainingPoints,
      captainsClubTrackerPercentage: captainsClub?.trackerPercentage || extendedLoyalty?.captainsClubTrackerPercentage,
      captainsClubLoyaltyMatchTier: extendedLoyalty?.captainsClubLoyaltyMatchTier,

      celebrityBlueChipTier: extendedLoyalty?.celebrityBlueChipTier,
      celebrityBlueChipPoints: extendedLoyalty?.celebrityBlueChipPoints,
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
  }, [captainsClub, extendedLoyalty, isPrimaryProfileSelected, isProfileDisplayReady, profileDisplayUser, venetianSociety]);

  const dataStats = useMemo(() => {
    const allOffers = casinoOffers.length > 0 ? casinoOffers : (localData.offers || []);
    // Count unique offers by offerCode - this is the true unique identifier for an offer
    // Multiple sailings can share the same offerCode (e.g., 2601C05 applies to multiple cruises)
    const uniqueOfferCodes = new Set(allOffers.map(o => o.offerCode).filter(Boolean));
    const uniqueOfferCount = uniqueOfferCodes.size || allOffers.length;
    
    console.log('[Settings] Data stats calculation:', {
      totalOffers: allOffers.length,
      uniqueOfferCodes: Array.from(uniqueOfferCodes),
      uniqueCount: uniqueOfferCount,
    });
    
    const allBooked = bookedCruises.length > 0 ? bookedCruises : (localData.booked || []);
    const upcoming = allBooked.filter(c => isActiveBookedCruise(c)).length;
    const completed = allBooked.filter(c => isCompletedBookedCruise(c)).length;
    const dayAgendaEventsThisYear = getDayAgendaEventCountForYear(
      allBooked,
      [...(localData.calendar || []), ...(localData.tripit || [])],
      new Date().getFullYear()
    );

    return {
      cruises: cruises.length || localData.cruises?.length || 0,
      booked: upcoming,
      upcoming,
      completed,
      sailings: allOffers.length,
      uniqueOffers: uniqueOfferCount,
      events: dayAgendaEventsThisYear,
      machines: myAtlasMachines.length || 0,
      crewMembers: crewStats?.crewMemberCount || 0,
    };
  }, [cruises, bookedCruises, casinoOffers, localData, myAtlasMachines, crewStats]);

  const importAssignmentReviewCount = useMemo(() => {
    const reviewItems = getImportAssignmentReviewItems({
      offers: casinoOffers.length > 0 ? casinoOffers : (localData.offers || []),
      cruises: cruises.length > 0 ? cruises : (localData.cruises || []),
      bookedCruises: bookedCruises.length > 0 ? bookedCruises : (localData.booked || []),
      calendarEvents: localData.calendar || [],
      users,
    });
    return reviewItems.length;
  }, [bookedCruises, casinoOffers, cruises, localData.booked, localData.calendar, localData.cruises, localData.offers, users]);

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

      const existingCruises = cruises.length > 0 ? cruises : (localData.cruises || []);
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
      const healNote = healingReport.fieldsFixed.length > 0 ? `\n\nData healing fixed ${healingReport.fieldsFixed.length} field(s).` : '';
      const reconciliationNote = reviewNeededCount > 0 || overlapCount > 0 || suggestedArchiveCount > 0
        ? `\n\nReconciliation: ${reviewNeededCount} item(s) need review, ${overlapCount} overlapping sailing(s) were preserved, ${suggestedArchiveCount} missing row(s) were flagged instead of deleted.`
        : '';
      const assignmentNote = assignmentReviewCount > 0 ? `\n\nImport Assignment: ${assignmentReviewCount} item(s) need account/profile assignment.` : '';
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
        }),
        applyLabel: `Apply ${parsedCruises.length + parsedOffers.length} row(s)`,
        onApply: async () => {
          try {
            setIsImporting(true);
            console.log('[Settings] Applying reviewed offers import:', { fileName: result.fileName, cruises: parsedCruises.length, offers: parsedOffers.length });
            await setCruises(mergedCruises);
            await setCasinoOffers(mergedOffers);
            await setLocalData({ cruises: mergedCruises, offers: mergedOffers });
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
            setLastImportResult({ type: 'offers', count: parsedCruises.length });
            setPendingSmartImportReview(null);
            Alert.alert(
              'Import Applied',
              `${sourceLabel} import updated ${parsedCruises.length} cruises and ${parsedOffers.length} offers from ${result.fileName}.${healNote}${reconciliationNote}${assignmentNote}`,
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
            Alert.alert('Apply Failed', 'The reviewed import could not be applied. Please try again.');
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
  }, [authenticatedEmail, casinoOffers, cruises, currentUser?.email, currentUser?.id, localData.cruises, localData.offers, normalizedAuthenticatedEmail, router, setCruises, setCasinoOffers, setLocalData, users]);

  const fetchICSMutation = trpc.calendar.fetchICS.useMutation();
  const saveCalendarFeedMutation = trpc.calendar.saveCalendarFeed.useMutation();

  useEffect(() => {
    const loadFeedToken = async () => {
      try {
        const stored = await AsyncStorage.getItem('easyseas_calendar_feed_token');
        if (stored) {
          setCalendarFeedToken(stored);
          setCalendarFeedUrl(`${RENDER_BACKEND_URL}/api/calendar-feed/${stored}`);
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

      const feedUrl = `${RENDER_BACKEND_URL}/api/calendar-feed/${token}`;
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
                      console.log('[Settings] Applying reviewed calendar URL import:', { url: trimmedUrl, events: events.length });
                      await setLocalData({ calendar: mergedEvents });
                      setLastImportResult({ type: 'calendar', count: events.length });
                      setPendingSmartImportReview(null);
                      Alert.alert(
                        'Import Applied',
                        `Imported ${events.length} calendar events from URL${calendarAssignmentReviewCount > 0 ? `. ${calendarAssignmentReviewCount} event(s) need account assignment review.` : ''}`,
                        calendarAssignmentReviewCount > 0
                          ? [
                              { text: 'Later', style: 'cancel' },
                              { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                            ]
                          : undefined
                      );
                    } catch (applyError) {
                      console.error('[Settings] Failed to apply reviewed calendar URL import:', applyError);
                      Alert.alert('Apply Failed', 'The reviewed calendar import could not be applied. Please try again.');
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
                  `Failed to fetch calendar from URL.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the URL and try again.`
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
            console.log('[Settings] Applying reviewed calendar file import:', { fileName: result.fileName, events: events.length });
            await setLocalData({ calendar: mergedEvents });
            setLastImportResult({ type: 'calendar', count: events.length });
            setPendingSmartImportReview(null);
            Alert.alert(
              'Import Applied',
              `Imported ${events.length} calendar events from ${result.fileName}${calendarAssignmentReviewCount > 0 ? `. ${calendarAssignmentReviewCount} event(s) need account assignment review.` : ''}`,
              calendarAssignmentReviewCount > 0
                ? [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Review Assignments', onPress: () => router.push('/import-review' as any) },
                  ]
                : undefined
            );
          } catch (applyError) {
            console.error('[Settings] Failed to apply reviewed calendar file import:', applyError);
            Alert.alert('Apply Failed', 'The reviewed calendar import could not be applied. Please try again.');
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
        ? ` ${bookedMergeResult.reconciliation.reviewNeededItems} item(s) need review and ${bookedMergeResult.reconciliation.duplicateOverlappingSailings} overlapping sailing(s) were preserved.`
        : '';
      const bookedAssignmentNote = bookedAssignmentReviewCount > 0 ? ` ${bookedAssignmentReviewCount} item(s) need account assignment review.` : '';
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
        applyLabel: `Apply ${parsedBooked.length} booked row(s)`,
        onApply: async () => {
          try {
            setIsImporting(true);
            console.log('[Settings] Applying reviewed booked import:', { fileName: result.fileName, bookedRows: parsedBooked.length });
            await setBookedCruises(mergedBooked);
            await setLocalData({ booked: mergedBooked });
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
            setLastImportResult({ type: 'booked', count: parsedBooked.length });
            setPendingSmartImportReview(null);
            Alert.alert(
              'Import Applied',
              `${sourceLabel} booked cruises updated from ${result.fileName}. Imported ${parsedBooked.length} cruise row(s).${bookedReconciliationNote}${bookedAssignmentNote}`,
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
            Alert.alert('Apply Failed', 'The reviewed booked import could not be applied. Please try again.');
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

      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
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

      let workbook: XLSX.WorkBook;
      try {
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const arrayBuffer = await response.arrayBuffer();
          workbook = XLSX.read(arrayBuffer, { type: 'array' });
        } else {
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
          workbook = XLSX.read(base64, { type: 'base64' });
        }
      } catch (parseError) {
        console.error('[Settings] XLSX parse error:', parseError);
        Alert.alert('Parse Error', 'Could not parse the XLSX file. Make sure it is a valid Excel or CSV file.');
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
      const colPrice = findCol(['retail price', 'retail value', 'total retail', 'cruise fare', 'fare', 'price', 'cost'], ['paid', 'amount paid', 'net', 'tax']);
      const colPaid = findCol(['price paid', 'paid', 'amount paid', 'net paid', 'out of pocket'], ['retail']);
      const colTaxes = findCol(['port taxes', 'taxes and fees', 'taxes & fees', 'taxes', 'fees', 'port charges']);
      const colWinnings = findCol(['winnings', 'casino win']);
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

        if (!shipName && !sailDateRaw) continue;

        const parseDate = (raw: string): string => {
          if (!raw) return new Date().toISOString().split('T')[0];
          const num = Number(raw);
          if (!isNaN(num) && num > 10000 && num < 100000) {
            const d = new Date((num - 25569) * 86400 * 1000);
            return d.toISOString().split('T')[0];
          }
          const dateMatch = raw.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{2,4})/);
          if (dateMatch) {
            let [, a, b, c] = dateMatch;
            if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`;
            return `${c.length === 2 ? '20'+c : c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`;
          }
          try { return new Date(raw).toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; }
        };

        const sailDate = parseDate(sailDateRaw);
        const nights = parseInt(nightsRaw) || 7;
        let returnDate = returnDateRaw ? parseDate(returnDateRaw) : '';
        if (!returnDate) {
          const sailObj = new Date(sailDate);
          sailObj.setDate(sailObj.getDate() + nights);
          returnDate = sailObj.toISOString().split('T')[0];
        }

        const isDuplicate = existingBooked.some(
          c => c.shipName === (shipName || 'Unknown Ship') && c.sailDate === sailDate
        ) || importedCruises.some(
          c => c.shipName === (shipName || 'Unknown Ship') && c.sailDate === sailDate
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
        const itineraryLabel = destination || fullItinerary || `${nights} Night Cruise`;
        const perPersonRetailPrice = price ? parseFloat(price.replace(/[^0-9.]/g, '')) || undefined : undefined;
        const roomRetailPrice = getDoubleOccupancyRoomRetailValue(perPersonRetailPrice);
        const paidAmount = paid ? parseFloat(paid.replace(/[^0-9.]/g, '')) || undefined : undefined;
        const taxesAmount = taxes ? parseFloat(taxes.replace(/[^0-9.]/g, '')) || undefined : undefined;

        const cruise: BookedCruise = {
          id: `completed-xlsx-${Date.now()}-${i}`,
          shipName: shipName || 'Unknown Ship',
          sailDate,
          returnDate,
          nights,
          destination: destination || fullItinerary || 'Caribbean',
          itineraryName: itineraryLabel,
          departurePort: departurePort || '',
          ports: portsList.length > 0 ? portsList : undefined,
          itineraryRaw: fullItinerary ? [fullItinerary] : undefined,
          reservationNumber: reservationNumber || undefined,
          cabinType: cabinType || 'Balcony',
          guests: parseInt(guests) || 2,
          guestNames: [],
          price: perPersonRetailPrice,
          totalPrice: roomRetailPrice !== undefined ? roomRetailPrice + (taxesAmount ?? 0) : undefined,
          retailValue: roomRetailPrice,
          totalRetailCost: roomRetailPrice,
          originalPrice: roomRetailPrice,
          pricePaid: paidAmount,
          amountPaid: paidAmount,
          netEffectivePaid: paidAmount,
          taxes: taxesAmount,
          taxesFeesEstimate: taxesAmount,
          totalCasinoDiscount: roomRetailPrice !== undefined && paidAmount !== undefined ? Math.max(0, roomRetailPrice + (taxesAmount ?? 0) - paidAmount) : undefined,
          winnings: winnings ? parseFloat(winnings.replace(/[^0-9.]/g, '')) || undefined : undefined,
          notes: notesVal || (program ? `Program: ${program}` : undefined),
          status: 'completed',
          completionState: 'completed',
          cruiseSource,
          sourceEmail,
          importStatus: sourceEmail ? 'unassigned' : undefined,
          reconciliationStatus: sourceEmail ? 'reviewNeeded' : undefined,
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
          `No new completed cruises were found. ${skippedCount > 0 ? `${skippedCount} row(s) were duplicates or unrecognized.` : 'The file columns could not be recognized.'}\n\nExpected columns: Ship, Start Date, End Date, Nights, Cruise/Itinerary, Start Port.`
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
      const merged = [...existingBooked, ...preparedImportedCruises];
      const completedSummary = createSimpleReconciliationSummary({
        addedRows: preparedImportedCruises.length,
        updatedRows: 0,
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
        applyLabel: `Apply ${preparedImportedCruises.length} completed row(s)`,
        onApply: async () => {
          try {
            setIsImporting(true);
            console.log('[Settings] Applying reviewed completed cruises import:', { fileName: asset.name, completedRows: preparedImportedCruises.length });
            await setBookedCruises(merged);
            await setLocalData({ booked: merged });
            await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
            setLastImportResult({ type: 'completed', count: importedCruises.length });
            setPendingSmartImportReview(null);
            Alert.alert(
              'Import Applied',
              `Imported ${importedCruises.length} completed cruise${importedCruises.length !== 1 ? 's' : ''} from ${asset.name}.${completedAssignmentReviewCount > 0 ? ` ${completedAssignmentReviewCount} item(s) need account assignment review.` : ''}`,
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
            Alert.alert('Apply Failed', 'The reviewed completed-cruise import could not be applied. Please try again.');
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

  const handleExportOffersCSV = useCallback(async () => {
    try {
      setIsExporting(true);
      console.log('[Settings] Starting offers CSV export');
      
      const allCruises = localData.cruises.length > 0 ? localData.cruises : cruises;
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
  }, [localData.cruises, localData.offers, cruises, casinoOffers]);

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
      'Are you sure you want to delete ALL app data including:\n\n• Cruises & Offers\n• Booked Cruises\n• Calendar Events\n• Certificates\n• User Profile (Name, C&A #)\n• Club Royale Points\n• Loyalty Points\n• Settings & Preferences\n\nSample demo data will be added so you can explore the app.\n\nThis action cannot be undone.',
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
                  celebrityCaptainsClubPoints: SAMPLE_LOYALTY_POINTS.clubRoyale,
                  celebrityBlueChipPoints: SAMPLE_LOYALTY_POINTS.clubRoyale,
                  silverseaEmail: '',
                  silverseaVenetianNumber: '',
                  silverseaVenetianTier: '',
                  silverseaVenetianPoints: SAMPLE_LOYALTY_POINTS.clubRoyale,
                });
                
                console.log('[Settings] Setting loyalty points to 1 for all three cruise lines (sample data)...');
                await setManualClubRoyalePoints(SAMPLE_LOYALTY_POINTS.clubRoyale);
                await setManualCrownAnchorPoints(SAMPLE_LOYALTY_POINTS.crownAnchor);
                console.log('[Settings] ✓ Royal Caribbean: Club Royale & Crown & Anchor reset to 1');
                console.log('[Settings] ✓ Celebrity: Captain\'s Club & Blue Chip reset to 1');
                console.log('[Settings] ✓ Silversea: Venetian Society reset to 1');
                
                console.log('[Settings] Generating sample demo data...');
                const sampleData = generateSampleData();
                
                console.log('[Settings] Populating sample cruises, offers, and events...');
                await setBookedCruises(sampleData.bookedCruises);
                await setCasinoOffers(sampleData.casinoOffers);
                await setLocalData({
                  booked: sampleData.bookedCruises,
                  offers: sampleData.casinoOffers,
                  calendar: sampleData.calendarEvents,
                });
                
                console.log('[Settings] Re-syncing loyalty provider from storage...');
                await syncLoyaltyFromStorage();
                
                Alert.alert(
                  'Data Reset Complete', 
                  `Successfully cleared ${result.clearedKeys.length} data stores.\n\nSample demo data has been added:\n• 3 sample cruises (1 completed, 2 booked)\n• 2 sample casino offers\n• 1 sample calendar event\n• Crown & Anchor: 1 point\n• Club Royale: 1 point\n\nDelete the sample data and import your real data to get started!`
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




  const handleExportDiagnosticLogs = useCallback(async () => {
    try {
      setIsExportingDiagnostics(true);
      const snapshot = {
        version: '9.10.89',
        exportedAt: new Date().toISOString(),
        counts: {
          availableCruises: cruises.length,
          bookedCruises: bookedCruises.length,
          offers: casinoOffers.length,
          completedCruises: bookedCruises.filter(c => isCompletedBookedCruise(c)).length,
        },
        activeUser: currentUser?.email || authenticatedEmail || null,
        dataMode: isCloudBackupEnabled() ? 'cloud-backup-enabled' : 'local-first-self-contained',
      };
      recordDiagnosticEvent({ level: 'info', category: 'ADMIN', event: 'EXPORT_DIAGNOSTIC_LOGS', message: 'Admin exported diagnostic logs', data: snapshot });
      const content = await buildDiagnosticExport(snapshot);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const success = await exportFile(content, `easyseas_diagnostic_logs_${stamp}.txt`);
      Alert.alert(success ? 'Export Successful' : 'Export Info', success ? 'Diagnostic logs exported.' : 'Diagnostic log file was created, but sharing may not be available on this device.');
    } catch (error) {
      console.error('[Settings] Diagnostic log export error:', error);
      Alert.alert('Export Error', 'Failed to export diagnostic logs.');
    } finally {
      setIsExportingDiagnostics(false);
    }
  }, [authenticatedEmail, bookedCruises, casinoOffers, cruises.length, currentUser?.email]);

  const handleClearDiagnosticLogs = useCallback(async () => {
    await clearDiagnosticEvents();
    Alert.alert('Diagnostic Logs Cleared', 'The local diagnostic log buffer has been cleared.');
  }, []);

  const handleExportAllData = useCallback(async () => {
    try {
      setIsExportingAll(true);
      console.log('[Settings] Starting full data export...');
      
      const result = await exportAllDataToFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: currentUser?.id ?? null,
        activeProfileEmail: currentUser?.email ?? authenticatedEmail ?? null,
      });
      
      if (result.success) {
        Alert.alert(
          'Export Successful',
          result.summaryText ?? `All app data has been exported to ${result.fileName ?? 'backup file'}.`
        );
      } else {
        Alert.alert('Export Failed', result.error || 'Failed to export data.');
      }
    } catch (error) {
      console.error('[Settings] Export all error:', error);
      Alert.alert('Export Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExportingAll(false);
    }
  }, [authenticatedEmail, currentUser?.email, currentUser?.id]);

  const handleImportAllData = useCallback(async () => {
    try {
      setIsImportingAll(true);
      console.log('[Settings] Starting full data import...');
      
      const result = await importAllDataFromFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: currentUser?.id ?? null,
        activeProfileEmail: currentUser?.email ?? authenticatedEmail ?? null,
      });
      
      if (!result.success) {
        if (result.error !== 'Import cancelled') {
          Alert.alert('Import Failed', result.error || 'Failed to import data.');
        }
        setIsImportingAll(false);
        return;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      
      if (result.success && result.imported) {
        const { cruises: importedCruises, bookedCruises: importedBooked, casinoOffers: importedOffers, calendarEvents, casinoSessions: importedSessions, certificates, machines: importedMachines } = result.imported;
        
        console.log('[Settings] Syncing data from storage to all providers...');
        await Promise.all([
          syncUserFromStorage(),
          syncLoyaltyFromStorage(),
          reloadMachines(),
          reloadCasinoSessions(),
        ]);
        
        console.log('[Settings] Waiting for provider syncs to settle...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const sk = (baseKey: string) => getUserScopedKey(baseKey, authenticatedEmail ?? null);
        console.log('[Settings] Re-reading from AsyncStorage using scoped keys for user:', authenticatedEmail);
        const [cruisesData, bookedData, offersData, eventsData] = await Promise.all([
          quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CRUISES)),
          quotaSafeGetItem(sk(ALL_STORAGE_KEYS.BOOKED_CRUISES)),
          quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CASINO_OFFERS)),
          quotaSafeGetItem(sk(ALL_STORAGE_KEYS.CALENDAR_EVENTS)),
        ]);
        
        const syncedCruises = cruisesData ? JSON.parse(cruisesData) : [];
        const syncedBooked = bookedData ? JSON.parse(bookedData) : [];
        const syncedOffers = offersData ? JSON.parse(offersData) : [];
        const syncedEvents = eventsData ? JSON.parse(eventsData) : [];
        
        console.log('[Settings] Read data counts from scoped storage:', {
          cruises: syncedCruises.length,
          booked: syncedBooked.length,
          offers: syncedOffers.length,
          events: syncedEvents.length,
        });
        
        await setLocalData({
          cruises: syncedCruises,
          booked: syncedBooked,
          offers: syncedOffers,
          calendar: syncedEvents,
        });
        
        console.log('[Settings] Triggering final refresh to propagate to UI...');
        await new Promise(resolve => setTimeout(resolve, 300));
        await coreData.refreshData();
        await coreData.syncToBackend();
        await forceProfileSyncNow();
        
        try {
          if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'undefined') {
            window.dispatchEvent(new Event('cloudDataRestored'));
            console.log('[Settings] Dispatched cloudDataRestored event for crew recognition reload');
          }
        } catch (e) {
          console.log('[Settings] Could not dispatch cloudDataRestored event:', e);
        }
        
        Alert.alert(
          'Import Successful',
          `Imported:\n• ${importedCruises} cruises\n• ${importedBooked} booked cruises\n• ${importedOffers} offers\n• ${calendarEvents} events\n• ${importedSessions} casino sessions\n• ${certificates} certificates\n• ${importedMachines} machines\n• Crew members\n• User profile (name, C&A #, playing hours)\n• Loyalty points\n\nData has been loaded successfully.`
        );
      }
    } catch (error) {
      console.error('[Settings] Import all error:', error);
      Alert.alert('Import Error', 'Failed to import data. Please try again.');
    } finally {
      setIsImportingAll(false);
    }
  }, [authenticatedEmail, coreData, currentUser?.email, currentUser?.id, forceProfileSyncNow, reloadCasinoSessions, reloadMachines, setLocalData, syncLoyaltyFromStorage, syncUserFromStorage]);

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
        `Failed to download extension: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check the browser console for details.`
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
        `Failed to download SeaPass Generator: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      
      console.log('[Settings] Email change check:', { oldEmail, newEmail, emailChanged });
      
      if (emailChanged) {
        if (isAdmin) {
          return new Promise<void>((resolve) => {
            Alert.prompt(
              'Admin Email Verification',
              'You are an admin. Please enter the password to change your email:',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    setIsSaving(false);
                    resolve();
                  },
                },
                {
                  text: 'Verify',
                  onPress: async (password?: string) => {
                    if (password !== 'a1') {
                      Alert.alert('Invalid Password', 'The password you entered is incorrect.');
                      setIsSaving(false);
                      resolve();
                      return;
                    }
                    await continueProfileSave(profileData, oldEmail, newEmail, !!emailChanged);
                    resolve();
                  },
                },
              ],
              'secure-text'
            );
          });
        } else {
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

      await updateUser(editableUser.id, { 
          name: profileData.name,
          email: profileData.email,
          crownAnchorNumber: profileData.crownAnchorNumber,
          clubRoyalePoints: profileData.clubRoyalePoints,
          clubRoyaleTier: profileData.clubRoyaleTier,
          crownAnchorLevel: profileData.crownAnchorLevel,
          loyaltyPoints: profileData.loyaltyPoints,
          celebrityEmail: profileData.celebrityEmail,
          celebrityCaptainsClubNumber: profileData.celebrityCaptainsClubNumber,
          celebrityCaptainsClubPoints: profileData.celebrityCaptainsClubPoints,
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
        });
      
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
      await forceProfileSyncNow();
      
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
        Alert.alert('Profile Saved', 'Your profile has been updated successfully.');
      }
    } catch (error) {
      console.error('[Settings] continueProfileSave error:', error);
      Alert.alert('Save Error', 'Failed to save profile. Please try again.');
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
          'The file does not contain valid JSON. Please check the file and try again.\n\nError: ' + (jsonError instanceof Error ? jsonError.message : 'Unknown error')
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
        'Failed to import the file.\n\nError: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n\nPlease check the file format and try again.'
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

  const handleSaveMockData = useCallback(async () => {
    try {
      setIsSavingMockData(true);
      console.log('[Settings] Starting mock data save...');
      
      const result = await saveMockData();
      
      if (result.success) {
        Alert.alert(
          'Mock Data Saved',
          result.message
        );
      } else {
        Alert.alert('Save Failed', result.message);
      }
    } catch (error) {
      console.error('[Settings] Save mock data error:', error);
      Alert.alert('Save Error', 'Failed to save mock data. Please try again.');
    } finally {
      setIsSavingMockData(false);
    }
  }, []);

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

  const renderSectionHeader = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    gradientColors: [string, string] = ['#0369A1', '#0284C7']
  ) => (
    <LinearGradient
      colors={gradientColors}
      style={styles.sectionGradientHeader}
    >
      <View style={styles.sectionHeaderContent}>
        <View style={styles.sectionHeaderIcon}>
          {icon}
        </View>
        <View>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
        </View>
      </View>
    </LinearGradient>
  );

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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          contentContainerStyle={styles.scrollContent}
        >
          <ResponsiveContainer>
            <View style={styles.header}>
            <View style={styles.titleRow}>
              <SettingsIcon size={24} color={COLORS.navyDeep} />
              <Text style={styles.screenTitle}>Settings</Text>
            </View>
          </View>

          <View style={styles.dataOverviewCard}>
            <LinearGradient
              colors={['#0369A1', '#0284C7'] as [string, string]}
              style={styles.dataOverviewHeader}
            >
              <View style={styles.dataOverviewHeaderContent}>
                <View style={styles.dataOverviewIconBadge}>
                  <Anchor size={18} color={COLORS.white} />
                </View>
                <View style={styles.dataOverviewTitleGroup}>
                  <Text style={styles.dataOverviewTitle}>Data Overview</Text>
                  <Text style={styles.dataOverviewSubtitle}>{dataStats.cruises} cruises in system</Text>
                </View>
              </View>
            </LinearGradient>
            <View style={styles.dataOverviewBody}>
              <View style={styles.dataOverviewStatsRow}>
                <View style={styles.dataOverviewStatCard}>
                  <Anchor size={14} color="#0369A1" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.cruises}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Total Cruises</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <View style={styles.dataOverviewUpcomingCompletedRow}>
                    <Text style={styles.dataOverviewMiniStat}>{dataStats.upcoming} up</Text>
                    <Text style={styles.dataOverviewMiniStatDivider}>/</Text>
                    <Text style={styles.dataOverviewMiniStat}>{dataStats.completed} done</Text>
                  </View>
                  <Text style={styles.dataOverviewStatValue}>{dataStats.booked}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Booked</Text>
                </View>
                <View style={styles.dataOverviewStatCard}>
                  <Award size={14} color="#D97706" />
                  <Text style={styles.dataOverviewStatValue}>{dataStats.uniqueOffers}</Text>
                  <Text style={styles.dataOverviewStatLabel}>Offers</Text>
                </View>
              </View>
              <View style={styles.dataOverviewGrid}>
                <View style={styles.dataOverviewGridCard}>
                  <View style={[styles.dataOverviewGridIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                    <Calendar size={13} color="#9C27B0" />
                  </View>
                  <Text style={styles.dataOverviewGridValue}>{dataStats.events}</Text>
                  <Text style={styles.dataOverviewGridLabel}>Events</Text>
                </View>
                <View style={styles.dataOverviewGridCard}>
                  <View style={[styles.dataOverviewGridIcon, { backgroundColor: 'rgba(255, 87, 34, 0.1)' }]}>
                    <Database size={13} color="#FF5722" />
                  </View>
                  <Text style={styles.dataOverviewGridValue}>{dataStats.machines}</Text>
                  <Text style={styles.dataOverviewGridLabel}>Machines</Text>
                </View>
                <View style={styles.dataOverviewGridCard}>
                  <View style={[styles.dataOverviewGridIcon, { backgroundColor: 'rgba(0, 150, 136, 0.1)' }]}>
                    <Users size={13} color="#009688" />
                  </View>
                  <Text style={styles.dataOverviewGridValue}>{dataStats.crewMembers}</Text>
                  <Text style={styles.dataOverviewGridLabel}>Crew</Text>
                </View>
              </View>
            </View>
          </View>

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
            profileId={profileDisplayUser?.id ?? null}
          />

          <View style={[styles.sectionCard, { marginTop: SPACING.md, marginBottom: SPACING.md }]}>
            {renderSectionHeader(<Ship size={18} color={COLORS.white} />, 'Quick Actions', 'One-tap sync & pricing shortcuts')}
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
            {isAdmin && (
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={() => router.push('/carnival-sync' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(204, 34, 50, 0.1)' }]}>
                <Anchor size={16} color="#CC2232" />
              </View>
              <Text style={styles.quickActionLabelInline}>Sync Carnival Cruises</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={() => router.push('/pricing-summary' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                <TrendingDown size={16} color="#4CAF50" />
              </View>
              <Text style={styles.quickActionLabelInline}>Pricing Summary & History</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            </View>
          </View>

          <CollapsibleSection
            title="Data Management"
            subtitle="Import, export, backup & calendar feed"
            icon={<Database size={18} color="#FFFFFF" />}
            defaultExpanded={false}
          >
          <View style={styles.section}>
            <View style={styles.sectionCard}>
              <View style={[styles.dataSubsection, styles.importBanner]}>
                <Text style={styles.subsectionLabel}>IMPORT</Text>
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

              <View style={styles.dataDivider} />

              <View style={[styles.dataSubsection, styles.fullBackupBanner]}>
                <Text style={styles.subsectionLabel}>EXPORT</Text>
                <Text style={styles.subsectionHelper}>Export your cruises, bookings, and events as CSV or ICS files.</Text>
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

              <View style={styles.dataDivider} />

              <View style={[styles.dataSubsection, styles.calendarFeedBanner]}>
                <Text style={styles.subsectionLabel}>FULL BACKUP</Text>
                <Text style={styles.subsectionHelper}>Export everything or restore your entire vault in one flow.</Text>
              </View>
              {renderSettingRow(
                <FolderArchive size={18} color={COLORS.success} />,
                'Export All App Data',
                isExportingAll ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : (
                  <Text style={styles.countBadge}>
                    Complete
                  </Text>
                ),
                handleExportAllData
              )}
              {renderSettingRow(
                <FolderInput size={18} color={COLORS.info} />,
                'Restore from Backup',
                isImportingAll ? (
                  <ActivityIndicator size="small" color={COLORS.navyDeep} />
                ) : undefined,
                handleImportAllData
              )}
              {renderSettingRow(
                <Save size={18} color="#9C27B0" />,
                'Save as Mock Data',
                isSavingMockData ? (
                  <ActivityIndicator size="small" color="#9C27B0" />
                ) : (
                  <Text style={styles.countBadge}>
                    .ts files
                  </Text>
                ),
                handleSaveMockData
              )}

              <View style={styles.dataDivider} />

              <View style={[styles.dataSubsection, styles.calendarFeedBanner]}>
                <Text style={styles.subsectionLabel}>CALENDAR FEED</Text>
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
              
              <View style={styles.dataSubsection}>
                <Text style={styles.subsectionLabel}>DOWNLOADS</Text>
                <Text style={styles.subsectionHelper}>Companion tools for scraping and importing your data.</Text>
              </View>
              {renderSettingRow(
                <Download size={18} color="#5a2ea6" />,
                'Download Chrome Extension',
                isDownloadingExtension ? (
                  <ActivityIndicator size="small" color="#5a2ea6" />
                ) : (
                  <Text style={styles.countBadge}>v1.0.0</Text>
                ),
                handleDownloadExtension
              )}
              {renderSettingRow(
                <FileSpreadsheet size={18} color={COLORS.success} />,
                'Download Booked CSV Template',
                isDownloadingTemplate ? (
                  <ActivityIndicator size="small" color={COLORS.success} />
                ) : (
                  <Text style={styles.countBadge}>Template</Text>
                ),
                handleDownloadCSVTemplate
              )}

            </View>
            <Text style={styles.backupHint}>
              Full backup includes all cruises, offers, events, casino sessions, certificates, user profile (name, C&A #, playing hours), casino program points, loyalty points, and settings.
            </Text>
            <Text style={styles.extensionHint}>
              The Chrome extension automatically syncs offers, bookings, and loyalty data from Royal Caribbean and Celebrity cruise websites.
            </Text>
          </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Support & Learning"
            subtitle="Help Center, user manual & system guide"
            icon={<HelpCircle size={18} color="#FFFFFF" />}
            defaultExpanded={false}
          >
          <View style={styles.sectionCard}>
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
          </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Subscription & Legal"
            subtitle="Plan status, purchases, privacy & terms"
            icon={<Crown size={18} color="#FFFFFF" />}
            defaultExpanded={false}
          >
          <View style={styles.sectionCard}>
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
          </CollapsibleSection>

          {isAdmin && (
            <CollapsibleSection
              title="Admin"
              subtitle="Whitelist, machines, SeaPass & data tools"
              icon={<Shield size={18} color="#FFFFFF" />}
              defaultExpanded={false}
            >
              <View style={styles.sectionCard}>
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(2, 132, 199, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>ADMIN FUNCTIONS</Text>
                  <Text style={styles.subsectionHelper}>Internal QA/diagnostic tools, admin-only.</Text>
                </View>
                {renderSettingRow(
                  <Activity size={18} color={COLORS.navyDeep} />,
                  'Data Health',
                  <Text style={styles.countBadge}>Admin</Text>,
                  () => router.push('/data-health' as any)
                )}
                <View style={styles.dataDivider} />
                {renderSettingRow(
                  <FileDown size={18} color={COLORS.navyDeep} />,
                  isExportingDiagnostics ? 'Exporting Diagnostic Logs...' : 'Export Diagnostic Logs',
                  <Text style={styles.countBadge}>Admin</Text>,
                  handleExportDiagnosticLogs,
                  isExportingDiagnostics
                )}
                {renderSettingRow(
                  <Trash2 size={18} color="#EF4444" />,
                  'Clear Diagnostic Logs',
                  <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                  handleClearDiagnosticLogs
                )}

                <View style={styles.dataDivider} />

                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(3, 105, 161, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>FREE USE WHITELIST</Text>
                  <Text style={styles.subsectionHelper}>Add any user email here to grant Free Use of App access. Only scott.merlis1@gmail.com and s@a.com are admins and cannot be removed.</Text>
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
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          ) : (
                            <View style={styles.freeUseBadge}>
                              <Text style={styles.freeUseBadgeText}>FREE USE</Text>
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

                <View style={styles.dataDivider} />
                
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(255, 87, 34, 0.1)' }]}>
                  <Text style={styles.subsectionLabel}>MACHINES DATA</Text>
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

                <View style={styles.dataDivider} />
                
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(75, 0, 130, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>SEAPASS GENERATOR</Text>
                  <Text style={styles.subsectionHelper}>Generate Royal Caribbean web SeaPass cards.</Text>
                </View>
                {renderSettingRow(
                  <Ship size={18} color="#4F2A95" />,
                  'SeaPass Web Generator',
                  undefined,
                  () => router.push('/seapass-generator' as any)
                )}
                {renderSettingRow(
                  <Download size={18} color="#4F2A95" />,
                  'Download SeaPass Generator',
                  isDownloadingSeaPass ? (
                    <ActivityIndicator size="small" color="#4F2A95" />
                  ) : (
                    <Text style={styles.countBadge}>v1.0.0</Text>
                  ),
                  handleDownloadSeaPassGenerator
                )}

                <View style={styles.dataDivider} />

                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(0, 31, 63, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>DATA TOOLS</Text>
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
                  'Import Completed Cruises (.xlsx)',
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
                  <RefreshCcw size={18} color={COLORS.error} />,
                  'Reset All Data',
                  undefined,
                  handleClearData,
                  true
                )}
              </View>
            </CollapsibleSection>
          )}

<View style={styles.section}>
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
              <View style={styles.dataDivider} />
              {renderSettingRow(
                <Star size={18} color={COLORS.navyDeep} />,
                'Rate App',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://apps.apple.com/us/app/easy-seas/id6758175890?ppid=9a051237-cab0-4164-9459-4c55a1976721')
              )}
              {renderSettingRow(
                <BookOpen size={18} color={COLORS.navyDeep} />,
                "Check out Scott Astin's Other Books",
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://www.amazon.com/stores/Scott-Astin/author/B0GCQ1S8MH')
              )}
              {renderSettingRow(
                <BookOpen size={18} color={COLORS.navyDeep} />,
                'Purchase "Smooth Sailing (In Rough Waters)" on Amazon',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://www.amazon.com/Smooth-Sailing-Rough-Waters-Consistently/dp/B0G4NMSM31/ref=sr_1_1?crid=BWS5ZWAQCC46&dib=eyJ2IjoiMSJ9.pTShQ0uJgtzeHg_EAFai2a6YTAan0h_35hcv7ZH0QKfGjHj071QN20LucGBJIEps.F_tIgnCOSc3EqGF6wUtOWK_hXH-5Ti3Miy6KYQ_JaLY&dib_tag=se&keywords=smooth+sailing+in+rough+waters&qid=1766758613&s=books&sprefix=smooth+sailing+in+rough+water%2Cstripbooks%2C189&sr=1-1')
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerHeroCard}>
              <View style={styles.footerHeroOverlay}>
                <Text style={styles.footerHeroTitle}>Easy Seas™</Text>
                <Text style={styles.footerHeroSubtitle}>Manage your Nautical Lifestyle™</Text>
              </View>
            </View>

            <Text style={styles.footerCopyright}>© Easy Seas Ventures LLC</Text>
            
            <View style={styles.legalDisclaimerSection}>
              <Text style={styles.legalDisclaimerTitle}>LEGAL DISCLAIMER</Text>
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
          </View>
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
      
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

            <FlatList
              style={styles.smartImportRowsScroll}
              contentContainerStyle={styles.smartImportRowsContent}
              data={pendingSmartImportReview?.rows ?? []}
              renderItem={({ item }) => renderSmartImportReviewRow(item)}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={true}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              updateCellsBatchingPeriod={32}
              removeClippedSubviews={Platform.OS !== 'web'}
            />

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
    backgroundColor: '#EFF6FF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 120,
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
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    overflow: 'hidden',
    ...SHADOW.sm,
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
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    ...SHADOW.sm,
  },
  dataOverviewHeader: {
    padding: SPACING.sm,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataOverviewTitleGroup: {
    flex: 1,
  },
  dataOverviewTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    letterSpacing: 0.3,
  },
  dataOverviewSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  dataOverviewBody: {
    padding: SPACING.sm,
  },
  dataOverviewStatsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dataOverviewStatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  dataOverviewStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  dataOverviewStatLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  dataOverviewUpcomingCompletedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  dataOverviewMiniStat: {
    fontSize: 9,
    color: '#64748B',
  },
  dataOverviewMiniStatDivider: {
    fontSize: 9,
    color: '#94A3B8',
  },
  dataOverviewGrid: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  dataOverviewGridCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  dataOverviewGridIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  dataOverviewGridValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  dataOverviewGridLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center' as const,
  },
  quickActionsSection: {
    marginBottom: SPACING.md,
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
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
    backgroundColor: '#4CAF50',
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
    fontFamily: undefined,
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
    textTransform: 'uppercase' as const,
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
  quickActionsBody: {
    padding: 12,
    paddingTop: 14,
    gap: 0,
  },
});
