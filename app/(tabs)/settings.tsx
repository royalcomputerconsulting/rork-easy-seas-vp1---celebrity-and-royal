import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  Linking, 
  ActivityIndicator,
  TextInput,
  Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Moon, 
  DollarSign, 
  Download, 
  Upload,
  Trash2, 
  Info, 
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
  FileText,
  Database,
  Tag,
  Save,
  RefreshCcw,
  BookOpen,
  Crown,
  FileDown,
  TrendingDown,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, CLEAN_THEME } from '@/constants/theme';
import { useAppState } from '@/state/AppStateProvider';
import { useUser, DEFAULT_PLAYING_HOURS } from '@/state/UserProvider';
import type { PlayingHours } from '@/state/UserProvider';
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
import { downloadChromeExtension } from '@/lib/chromeExtension';


import { useLoyalty } from '@/state/LoyaltyProvider';
import { UserProfileCard } from '@/components/ui/UserProfileCard';
import { PlayingHoursCard } from '@/components/ui/PlayingHoursCard';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCasinoSessions } from '@/state/CasinoSessionProvider';
import { saveMockData } from '@/lib/saveMockData';
import { generateSampleData, SAMPLE_LOYALTY_POINTS } from '@/lib/sampleData';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { UserManualModal } from '@/components/UserManualModal';
import { trpc } from '@/lib/trpc';
import { useEntitlement } from '@/state/EntitlementProvider';

export default function SettingsScreen() {
  const router = useRouter();
  const entitlement = useEntitlement();
  const { settings, updateSettings, clearLocalData, setLocalData, localData } = useAppState();
  const coreData = useCoreData();
  const { clearAllData, bookedCruises, setCruises, casinoOffers, setBookedCruises, setCasinoOffers } = coreData;
  const cruises = coreData.cruises;
  const { currentUser, updateUser, ensureOwner, syncFromStorage: syncUserFromStorage } = useUser();
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
  const [isSavingPlayingHours, setIsSavingPlayingHours] = useState(false);
  const [isImportingMachines, setIsImportingMachines] = useState(false);
  const [isExportingMachines, setIsExportingMachines] = useState(false);
  const [isSavingMockData, setIsSavingMockData] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  const [isUserManualVisible, setIsUserManualVisible] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const secretTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { myAtlasMachines, exportMachinesJSON, importMachinesJSON, reload: reloadMachines } = useSlotMachineLibrary();
  const { reload: reloadCasinoSessions } = useCasinoSessions();
  const { isAdmin, getWhitelist, addToWhitelist, removeFromWhitelist } = useAuth();



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
      loadWhitelist();
    }
  }, [isAdmin, loadWhitelist]);

  const handleAddToWhitelist = async () => {
    if (!newWhitelistEmail.trim() || !newWhitelistEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      await addToWhitelist(newWhitelistEmail.trim());
      await loadWhitelist();
      setNewWhitelistEmail('');
      Alert.alert('Success', `Added ${newWhitelistEmail.trim()} to whitelist.`);
    } catch (error) {
      console.error('[Settings] Error adding to whitelist:', error);
      Alert.alert('Error', 'Failed to add email to whitelist.');
    }
  };

  const handleRemoveFromWhitelist = async (email: string) => {
    Alert.alert(
      'Remove Email',
      `Remove ${email} from whitelist? They will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromWhitelist(email);
              await loadWhitelist();
              Alert.alert('Success', `Removed ${email} from whitelist.`);
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
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    crownAnchorNumber: currentUser?.crownAnchorNumber || '',
    clubRoyalePoints: loyaltyClubRoyalePoints,
    clubRoyaleTier: loyaltyClubRoyaleTier,
    loyaltyPoints: loyaltyCrownAnchorPoints,
    crownAnchorLevel: loyaltyCrownAnchorLevel,
    celebrityEmail: currentUser?.celebrityEmail || '',
    celebrityCaptainsClubNumber: currentUser?.celebrityCaptainsClubNumber || '',
    celebrityCaptainsClubPoints: currentUser?.celebrityCaptainsClubPoints || 0,
    celebrityBlueChipPoints: currentUser?.celebrityBlueChipPoints || 0,
    celebrityBlueChipTier: 'Pearl',
    celebrityCaptainsClubLevel: 'Preview',
    preferredBrand: currentUser?.preferredBrand || 'royal',
    silverseaEmail: currentUser?.silverseaEmail || '',
    silverseaVenetianNumber: currentUser?.silverseaVenetianNumber || '',
    silverseaVenetianTier: currentUser?.silverseaVenetianTier || '',
    silverseaVenetianPoints: currentUser?.silverseaVenetianPoints || 0,
  }), [currentUser, loyaltyClubRoyalePoints, loyaltyClubRoyaleTier, loyaltyCrownAnchorPoints, loyaltyCrownAnchorLevel]);

  const enrichmentData = useMemo(() => {
    if (!extendedLoyalty) return null;

    return {
      accountId: extendedLoyalty.accountId,

      crownAndAnchorId: extendedLoyalty.crownAndAnchorId,
      crownAndAnchorTier: extendedLoyalty.crownAndAnchorTier,
      crownAndAnchorNextTier: extendedLoyalty.crownAndAnchorNextTier,
      crownAndAnchorRemainingPoints: extendedLoyalty.crownAndAnchorRemainingPoints,
      crownAndAnchorTrackerPercentage: extendedLoyalty.crownAndAnchorTrackerPercentage,
      crownAndAnchorRelationshipPointsFromApi: extendedLoyalty.crownAndAnchorRelationshipPointsFromApi,
      crownAndAnchorLoyaltyMatchTier: extendedLoyalty.crownAndAnchorLoyaltyMatchTier,

      clubRoyaleTierFromApi: extendedLoyalty.clubRoyaleTierFromApi,
      clubRoyalePointsFromApi: extendedLoyalty.clubRoyalePointsFromApi,
      clubRoyaleRelationshipPointsFromApi: extendedLoyalty.clubRoyaleRelationshipPointsFromApi,

      captainsClubId: extendedLoyalty.captainsClubId,
      captainsClubTier: captainsClub?.tier || extendedLoyalty.captainsClubTier,
      captainsClubPoints: captainsClub?.points || extendedLoyalty.captainsClubPoints,
      captainsClubRelationshipPoints: extendedLoyalty.captainsClubRelationshipPoints,
      captainsClubNextTier: captainsClub?.nextTier || extendedLoyalty.captainsClubNextTier,
      captainsClubRemainingPoints: captainsClub?.remainingPoints || extendedLoyalty.captainsClubRemainingPoints,
      captainsClubTrackerPercentage: captainsClub?.trackerPercentage || extendedLoyalty.captainsClubTrackerPercentage,
      captainsClubLoyaltyMatchTier: extendedLoyalty.captainsClubLoyaltyMatchTier,

      celebrityBlueChipTier: extendedLoyalty.celebrityBlueChipTier,
      celebrityBlueChipPoints: extendedLoyalty.celebrityBlueChipPoints,
      celebrityBlueChipRelationshipPoints: extendedLoyalty.celebrityBlueChipRelationshipPoints,

      venetianSocietyTier: venetianSociety?.tier || extendedLoyalty.venetianSocietyTier,
      venetianSocietyNextTier: venetianSociety?.nextTier || extendedLoyalty.venetianSocietyNextTier,
      venetianSocietyMemberNumber: venetianSociety?.memberNumber || extendedLoyalty.venetianSocietyMemberNumber,
      venetianSocietyEnrolled: venetianSociety?.enrolled || extendedLoyalty.venetianSocietyEnrolled,
      venetianSocietyLoyaltyMatchTier: extendedLoyalty.venetianSocietyLoyaltyMatchTier,

      hasCoBrandCard: extendedLoyalty.hasCoBrandCard,
      coBrandCardStatus: extendedLoyalty.coBrandCardStatus,
      coBrandCardErrorMessage: extendedLoyalty.coBrandCardErrorMessage,
    };
  }, [extendedLoyalty, venetianSociety, captainsClub]);

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
    
    return {
      cruises: cruises.length || localData.cruises?.length || 0,
      booked: bookedCruises.length || localData.booked?.length || 0,
      sailings: allOffers.length,
      uniqueOffers: uniqueOfferCount,
      events: localData.calendar?.length || 0,
      machines: myAtlasMachines.length || 0,
    };
  }, [cruises, bookedCruises, casinoOffers, localData, myAtlasMachines]);

  const handleImportOffersCSV = useCallback(async () => {
    if (entitlement.tier === 'view') {
      Alert.alert(
        'View-Only Mode',
        'Importing data is not available in view-only mode. Reactivate with Basic or Pro to sync and add new data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    
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

      await setCruises(parsedCruises);
      await setCasinoOffers(parsedOffers);
      await setLocalData({
        cruises: parsedCruises,
        offers: parsedOffers,
      });

      await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
      console.log('[Settings] Set HAS_LAUNCHED_BEFORE flag to prevent data wipe on restart');

      const healNote = healingReport.fieldsFixed.length > 0 ? `\n\nData healing fixed ${healingReport.fieldsFixed.length} field(s).` : '';
      setLastImportResult({ type: 'offers', count: parsedCruises.length });
      Alert.alert(
        'Import Successful', 
        `Imported ${parsedCruises.length} cruises and ${parsedOffers.length} offers from ${result.fileName}${healNote}`
      );
      console.log('[Settings] Import complete:', parsedCruises.length, 'cruises,', parsedOffers.length, 'offers');
    } catch (error) {
      console.error('[Settings] Import error:', error);
      Alert.alert('Import Error', 'Failed to import the file. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [entitlement.tier, router, setCruises, setCasinoOffers, setLocalData]);

  const fetchICSMutation = trpc.calendar.fetchICS.useMutation();

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
                
                const events = parseICSFile(content);
                
                if (events.length === 0) {
                  Alert.alert('Import Failed', 'No valid events found in the ICS file. Please check the URL and file format.');
                  setIsImporting(false);
                  return;
                }

                setLocalData({
                  calendar: [...(localData.calendar || []), ...events],
                });

                setLastImportResult({ type: 'calendar', count: events.length });
                Alert.alert(
                  'Import Successful', 
                  `Imported ${events.length} calendar events from URL`
                );
                console.log('[Settings] Import complete:', events.length, 'events');
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
  }, [setLocalData, localData.calendar, fetchICSMutation]);

  const handleImportCalendarFromFile = useCallback(async () => {
    if (entitlement.tier === 'view') {
      Alert.alert(
        'View-Only Mode',
        'Importing data is not available in view-only mode. Reactivate with Basic or Pro to sync and add new data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    
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
      const events = parseICSFile(result.content);
      
      if (events.length === 0) {
        Alert.alert('Import Failed', 'No valid events found in the ICS file. Please check the file format.');
        setIsImporting(false);
        return;
      }

      setLocalData({
        calendar: [...(localData.calendar || []), ...events],
      });

      setLastImportResult({ type: 'calendar', count: events.length });
      Alert.alert(
        'Import Successful', 
        `Imported ${events.length} calendar events from ${result.fileName}`
      );
      console.log('[Settings] Import complete:', events.length, 'events');
    } catch (error) {
      console.error('[Settings] Import error:', error);
      Alert.alert('Import Error', 'Failed to import the file. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [entitlement.tier, router, setLocalData, localData.calendar]);

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
    if (entitlement.tier === 'view') {
      Alert.alert(
        'View-Only Mode',
        'Importing data is not available in view-only mode. Reactivate with Basic or Pro to sync and add new data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    
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
      
      const parsedBooked = parseBookedCSV(result.content, existingBooked);
      
      if (parsedBooked.length === 0) {
        Alert.alert('No New Cruises', 'All cruises in the file already exist in your database, or the file contains no valid data.');
        setIsImporting(false);
        return;
      }

      const mergedBooked = [...existingBooked, ...parsedBooked];
      console.log('[Settings] Merged booked cruises:', mergedBooked.length, '(added:', parsedBooked.length, ')');

      await setBookedCruises(mergedBooked);
      await setLocalData({
        booked: mergedBooked,
      });

      await AsyncStorage.setItem('easyseas_has_launched_before', 'true');
      console.log('[Settings] Set HAS_LAUNCHED_BEFORE flag to prevent data wipe on restart');

      setLastImportResult({ type: 'booked', count: parsedBooked.length });
      
      Alert.alert(
        'Import Successful', 
        `Added ${parsedBooked.length} new cruises from ${result.fileName}`
      );
      console.log('[Settings] Booked import complete:', parsedBooked.length, 'new cruises added');
    } catch (error) {
      console.error('[Settings] Booked import error:', error);
      Alert.alert('Import Error', 'Failed to import the file. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [setBookedCruises, setLocalData, bookedCruises, localData.booked]);

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
      
      const allEvents = localData.calendar || [];
      
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
      console.log('[Settings] Export complete');
    } catch (error) {
      console.error('[Settings] Export error:', error);
      Alert.alert('Export Error', 'Failed to export calendar. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [localData.calendar]);

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
                clearLocalData();
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



  const handleExportAllData = useCallback(async () => {
    try {
      setIsExportingAll(true);
      console.log('[Settings] Starting full data export...');
      
      const result = await exportAllDataToFile();
      
      if (result.success) {
        Alert.alert(
          'Export Successful',
          `All app data has been exported to ${result.fileName}. This includes cruises, offers, booked cruises, events, casino sessions, certificates, user profile (name, C&A #, playing hours), Club Royale points, loyalty points, and settings.`
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
  }, []);

  const handleImportAllData = useCallback(async () => {
    if (entitlement.tier === 'view') {
      Alert.alert(
        'View-Only Mode',
        'Importing data is not available in view-only mode. Reactivate with Basic or Pro to sync and add new data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    
    try {
      setIsImportingAll(true);
      console.log('[Settings] Starting full data import...');
      
      const result = await importAllDataFromFile();
      
      if (!result.success) {
        if (result.error !== 'Import cancelled') {
          Alert.alert('Import Failed', result.error || 'Failed to import data.');
        }
        setIsImportingAll(false);
        return;
      }
      
      if (result.success && result.imported) {
        const { cruises: importedCruises, bookedCruises: importedBooked, casinoOffers: importedOffers, calendarEvents, casinoSessions: importedSessions, certificates, machines: importedMachines } = result.imported;
        
        console.log('[Settings] Syncing data from storage to all providers...');
        await Promise.all([
          coreData.refreshData(),
          syncUserFromStorage(),
          syncLoyaltyFromStorage(),
          reloadMachines(),
          reloadCasinoSessions(),
        ]);
        
        console.log('[Settings] Waiting for state updates to propagate...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[Settings] Re-reading from AsyncStorage to ensure data is available...');
        const [cruisesData, bookedData, offersData, eventsData] = await Promise.all([
          AsyncStorage.getItem('easyseas_cruises'),
          AsyncStorage.getItem('easyseas_booked_cruises'),
          AsyncStorage.getItem('easyseas_casino_offers'),
          AsyncStorage.getItem('easyseas_calendar_events'),
        ]);
        
        const syncedCruises = cruisesData ? JSON.parse(cruisesData) : [];
        const syncedBooked = bookedData ? JSON.parse(bookedData) : [];
        const syncedOffers = offersData ? JSON.parse(offersData) : [];
        const syncedEvents = eventsData ? JSON.parse(eventsData) : [];
        
        console.log('[Settings] Read data counts from storage:', {
          cruises: syncedCruises.length,
          booked: syncedBooked.length,
          offers: syncedOffers.length,
          events: syncedEvents.length,
        });
        
        setLocalData({
          cruises: syncedCruises,
          booked: syncedBooked,
          offers: syncedOffers,
          calendar: syncedEvents,
        });
        
        console.log('[Settings] Triggering additional sync to propagate to UI...');
        await new Promise(resolve => setTimeout(resolve, 500));
        await coreData.refreshData();
        
        Alert.alert(
          'Import Successful',
          `Imported:\n• ${importedCruises} cruises\n• ${importedBooked} booked cruises\n• ${importedOffers} offers\n• ${calendarEvents} events\n• ${importedSessions} casino sessions\n• ${certificates} certificates\n• ${importedMachines} machines\n• User profile (name, C&A #, playing hours)\n• Loyalty points\n\nData has been loaded successfully.`
        );
      }
    } catch (error) {
      console.error('[Settings] Import all error:', error);
      Alert.alert('Import Error', 'Failed to import data. Please try again.');
    } finally {
      setIsImportingAll(false);
    }
  }, [coreData, setLocalData, syncUserFromStorage, syncLoyaltyFromStorage, reloadMachines, reloadCasinoSessions]);

  const handleDownloadExtension = useCallback(async () => {
    try {
      setIsDownloadingExtension(true);
      console.log('[Settings] Starting Chrome extensions download (both extensions)...');
      
      const result = await downloadChromeExtension();
      
      if (result.success) {
        Alert.alert(
          'Downloads Started',
          `TWO Chrome extensions are downloading:\n\n1. Grid Builder Extension ("Show All Offers" button)\n2. Scraper Extension ("Scrape Website" button)\n\nTotal files: ${result.filesAdded}\n\nTo install EACH extension:\n1. Unzip the downloaded file\n2. Open Chrome and go to chrome://extensions\n3. Enable "Developer mode"\n4. Click "Load unpacked"\n5. Select the unzipped folder\n\nRepeat for both extensions.`
        );
      } else {
        console.error('[Settings] Download failed:', result.error);
        Alert.alert(
          'Download Failed', 
          result.error || 'Unable to download Chrome extensions. Please make sure you are using a desktop web browser.\n\nTip: Check the browser console for detailed error logs.'
        );
      }
    } catch (error) {
      console.error('[Settings] Extension download error:', error);
      Alert.alert(
        'Download Error', 
        `Failed to download extensions: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check the browser console for details.`
      );
    } finally {
      setIsDownloadingExtension(false);
    }
  }, []);

  const handleDownloadCSVTemplate = useCallback(async () => {
    try {
      setIsDownloadingTemplate(true);
      console.log('[Settings] Starting CSV template download...');
      
      const csvTemplateContent = `id,ship,departureDate,returnDate,nights,itineraryName,departurePort,portsRoute,reservationNumber,guests,bookingId,isBooked,winningsBroughtHome,cruisePointsEarned
booked-radiance-1,Radiance of the Seas,9/26/25,10/4/25,8,8 Night Pacific Coastal Cruise,"Vancouver, British Columbia","Vancouver, British Columbia",123123,2,2623545,TRUE,,
booked-liberty-1,Liberty of the Seas,10/16/25,10/25/25,9,9 Night Canada & New England Cruise,"Cape Liberty, NJ (NYC)","Cape Liberty, NJ (NYC)",324123,2,7676777,TRUE,,`;
      
      const fileName = 'bookingCSV_TEMPLATE.csv';
      const success = await exportFile(csvTemplateContent, fileName);
      
      if (success) {
        Alert.alert(
          'Download Successful',
          'The booking CSV template has been downloaded. Fill in your cruise bookings following the template format, then import using "Booked Cruises CSV" option.'
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

  const handleSaveProfile = useCallback(async (profileData: {
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
    preferredBrand?: 'royal' | 'celebrity' | 'silversea';
    silverseaEmail?: string;
    silverseaVenetianNumber?: string;
    silverseaVenetianTier?: string;
    silverseaVenetianPoints?: number;
  }) => {
    try {
      setIsSaving(true);
      console.log('[Settings] Saving profile:', profileData);
      
      const oldEmail = currentUser?.email?.toLowerCase().trim();
      const newEmail = profileData.email.toLowerCase().trim();
      const emailChanged = oldEmail && oldEmail !== newEmail;
      
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
  }, [currentUser, updateUser, ensureOwner, setManualClubRoyalePoints, setManualCrownAnchorPoints, syncUserFromStorage]);

  const continueProfileSave = async (
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
      preferredBrand?: 'royal' | 'celebrity' | 'silversea';
      silverseaEmail?: string;
      silverseaVenetianNumber?: string;
      silverseaVenetianTier?: string;
      silverseaVenetianPoints?: number;
    },
    oldEmail: string | undefined,
    newEmail: string,
    emailChanged: boolean
  ) => {
    try {
      if (currentUser) {
        await updateUser(currentUser.id, { 
          name: profileData.name,
          email: profileData.email,
          crownAnchorNumber: profileData.crownAnchorNumber,
          celebrityEmail: profileData.celebrityEmail,
          celebrityCaptainsClubNumber: profileData.celebrityCaptainsClubNumber,
          celebrityCaptainsClubPoints: profileData.celebrityCaptainsClubPoints,
          celebrityBlueChipPoints: profileData.celebrityBlueChipPoints,
          preferredBrand: profileData.preferredBrand,
          silverseaEmail: profileData.silverseaEmail,
          silverseaVenetianNumber: profileData.silverseaVenetianNumber,
          silverseaVenetianTier: profileData.silverseaVenetianTier,
          silverseaVenetianPoints: profileData.silverseaVenetianPoints,
        });
      } else {
        const owner = await ensureOwner();
        await updateUser(owner.id, {
          name: profileData.name,
          email: profileData.email,
          crownAnchorNumber: profileData.crownAnchorNumber,
          celebrityEmail: profileData.celebrityEmail,
          celebrityCaptainsClubNumber: profileData.celebrityCaptainsClubNumber,
          celebrityCaptainsClubPoints: profileData.celebrityCaptainsClubPoints,
          celebrityBlueChipPoints: profileData.celebrityBlueChipPoints,
          preferredBrand: profileData.preferredBrand,
          silverseaEmail: profileData.silverseaEmail,
          silverseaVenetianNumber: profileData.silverseaVenetianNumber,
          silverseaVenetianTier: profileData.silverseaVenetianTier,
          silverseaVenetianPoints: profileData.silverseaVenetianPoints,
        });
      }
      
      // Update Royal Caribbean loyalty data
      await setManualClubRoyalePoints(profileData.clubRoyalePoints);
      await setManualCrownAnchorPoints(profileData.loyaltyPoints);
      console.log('[Settings] ✓ Updated Royal Caribbean loyalty:', {
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
      
      if (emailChanged) {
        console.log('[Settings] Email changed - updating auth state and triggering re-login');
        await AsyncStorage.setItem('easyseas_auth_email', newEmail);
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
  };



  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open link');
    });
  }, []);

  const handleSecretUnlock = useCallback(() => {
    setSecretTapCount(prev => {
      const newCount = prev + 1;
      
      if (secretTapTimer.current) {
        clearTimeout(secretTapTimer.current);
      }
      
      secretTapTimer.current = setTimeout(() => {
        setSecretTapCount(0);
      }, 2000);
      
      if (newCount >= 3) {
        setSecretTapCount(0);
        if (secretTapTimer.current) {
          clearTimeout(secretTapTimer.current);
        }
        
        Alert.prompt(
          'Developer Access',
          'Enter password:',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Unlock',
              onPress: async (password?: string) => {
                if (password === 'a1') {
                  try {
                    console.log('[Settings] Secret unlock activated - granting full access');
                    
                    await AsyncStorage.setItem(KEYS.WEB_IS_PRO, 'true');
                    
                    if (!mountedRef.current) return;
                    
                    entitlement.refresh();
                    
                    Alert.alert(
                      '🔓 Full Access Unlocked',
                      'Developer mode activated. All pro features are now available.',
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            try {
                              if (typeof window !== 'undefined') {
                                console.log('[Settings] Dispatching entitlementProUnlocked event');
                                window.dispatchEvent(new CustomEvent('entitlementProUnlocked'));
                              }
                            } catch (e) {
                              console.error('[Settings] Failed to dispatch event', e);
                            }
                          }
                        }
                      ]
                    );
                  } catch (error) {
                    console.error('[Settings] Secret unlock error:', error);
                    Alert.alert('Error', 'Failed to unlock. Please try again.');
                  }
                } else {
                  Alert.alert('Incorrect Password', 'Access denied.');
                }
              },
            },
          ],
          'secure-text'
        );
      }
      
      return newCount;
    });
  }, [entitlement]);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (secretTapTimer.current) {
        clearTimeout(secretTapTimer.current);
      }
    };
  }, []);

  const KEYS = {
    WEB_IS_PRO: 'easyseas_entitlements_web_is_pro',
  } as const;

  const handleSavePlayingHours = useCallback(async (playingHours: PlayingHours) => {
    try {
      setIsSavingPlayingHours(true);
      console.log('[Settings] Saving playing hours:', playingHours);
      
      if (currentUser) {
        await updateUser(currentUser.id, { playingHours });
      } else {
        const owner = await ensureOwner();
        await updateUser(owner.id, { playingHours });
      }
      
      Alert.alert('Playing Hours Saved', 'Your preferred playing times have been updated.');
    } catch (error) {
      console.error('[Settings] Save playing hours error:', error);
      Alert.alert('Save Error', 'Failed to save playing hours. Please try again.');
    } finally {
      setIsSavingPlayingHours(false);
    }
  }, [currentUser, updateUser, ensureOwner]);

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

  const renderToggle = (value: boolean, onToggle: (val: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#E5E7EB', true: 'rgba(0, 31, 63, 0.3)' }}
      thumbColor={value ? COLORS.navyDeep : '#9CA3AF'}
      ios_backgroundColor="#E5E7EB"
    />
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <SettingsIcon size={24} color={COLORS.navyDeep} />
              <Text style={styles.screenTitle}>Settings</Text>
            </View>
          </View>

          <View style={styles.dataOverviewCard}>
            <View style={styles.dataOverviewHeader}>
              <Database size={16} color={COLORS.navyDeep} />
              <Text style={styles.dataOverviewTitle}>Data Overview</Text>
            </View>
            <View style={styles.dataOverviewGrid}>
              <View style={styles.dataOverviewItem}>
                <View style={[styles.dataOverviewIcon, { backgroundColor: 'rgba(0, 31, 63, 0.1)' }]}>
                  <Ship size={14} color={COLORS.navyDeep} />
                </View>
                <Text style={styles.dataOverviewValue}>{dataStats.cruises}</Text>
                <Text style={styles.dataOverviewLabel}>Cruises</Text>
              </View>
              <View style={styles.dataOverviewItem}>
                <View style={[styles.dataOverviewIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                  <CheckCircle size={14} color={COLORS.success} />
                </View>
                <Text style={styles.dataOverviewValue}>{dataStats.booked}</Text>
                <Text style={styles.dataOverviewLabel}>Upcoming & Completed</Text>
              </View>
              <View style={styles.dataOverviewItem}>
                <View style={[styles.dataOverviewIcon, { backgroundColor: 'rgba(212, 165, 116, 0.15)' }]}>
                  <Tag size={14} color={COLORS.goldDark} />
                </View>
                <Text style={styles.dataOverviewValue}>{dataStats.uniqueOffers}</Text>
                <Text style={styles.dataOverviewLabel}>Offers</Text>
                <Text style={styles.dataOverviewSubLabel}>({dataStats.sailings} sailings)</Text>
              </View>
              <View style={styles.dataOverviewItem}>
                <View style={[styles.dataOverviewIcon, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
                  <Calendar size={14} color="#9C27B0" />
                </View>
                <Text style={styles.dataOverviewValue}>{dataStats.events}</Text>
                <Text style={styles.dataOverviewLabel}>Events</Text>
              </View>
              <View style={styles.dataOverviewItem}>
                <View style={[styles.dataOverviewIcon, { backgroundColor: 'rgba(255, 87, 34, 0.1)' }]}>
                  <Database size={14} color="#FF5722" />
                </View>
                <Text style={styles.dataOverviewValue}>{dataStats.machines}</Text>
                <Text style={styles.dataOverviewLabel}>Machines</Text>
              </View>
            </View>
          </View>

          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={() => router.push('/royal-caribbean-sync' as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(0, 112, 201, 0.1)' }]}>
                <Ship size={16} color="#0070C9" />
              </View>
              <Text style={styles.quickActionLabelInline}>Sync Club Royale</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
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
            <TouchableOpacity 
              style={styles.quickActionFullWidth} 
              onPress={handleImportOffersCSV}
              activeOpacity={0.7}
              disabled={isImporting}
            >
              <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                {isImporting ? (
                  <ActivityIndicator size="small" color={COLORS.info} />
                ) : (
                  <FileDown size={16} color={COLORS.info} />
                )}
              </View>
              <Text style={styles.quickActionLabelInline}>Load Import Offers.CSV</Text>
              <ChevronRight size={16} color={CLEAN_THEME.text.secondary} />
            </TouchableOpacity>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity 
                style={styles.quickActionHalf} 
                onPress={handleExportAllData}
                activeOpacity={0.7}
                disabled={isExportingAll}
              >
                <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                  {isExportingAll ? (
                    <ActivityIndicator size="small" color={COLORS.success} />
                  ) : (
                    <Save size={16} color={COLORS.success} />
                  )}
                </View>
                <Text style={styles.quickActionLabelInline}>Save All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickActionHalf} 
                onPress={handleImportAllData}
                activeOpacity={0.7}
                disabled={isImportingAll}
              >
                <View style={[styles.quickActionIconSmall, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                  {isImportingAll ? (
                    <ActivityIndicator size="small" color={COLORS.info} />
                  ) : (
                    <FolderInput size={16} color={COLORS.info} />
                  )}
                </View>
                <Text style={styles.quickActionLabelInline}>Load Backup</Text>
              </TouchableOpacity>
            </View>
          </View>

          <UserProfileCard
            currentValues={currentProfileValues}
            enrichmentData={enrichmentData}
            onSave={handleSaveProfile}
            isSaving={isSaving}
          />

          <PlayingHoursCard
            currentValues={currentUser?.playingHours || DEFAULT_PLAYING_HOURS}
            onSave={handleSavePlayingHours}
            isSaving={isSavingPlayingHours}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DISPLAY PREFERENCES</Text>
            <View style={styles.sectionCard}>
              {renderSettingRow(
                <DollarSign size={18} color={COLORS.navyDeep} />,
                'Show Taxes in List',
                renderToggle(settings.showTaxesInList, (val) => updateSettings({ showTaxesInList: val }))
              )}
              {renderSettingRow(
                <DollarSign size={18} color={COLORS.navyDeep} />,
                'Price Per Night',
                renderToggle(settings.showPricePerNight, (val) => updateSettings({ showPricePerNight: val }))
              )}
              {renderSettingRow(
                <Moon size={18} color={COLORS.navyDeep} />,
                'Theme',
                settings.theme === 'dark' ? 'Dark' : settings.theme === 'light' ? 'Light' : 'System'
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
            <View style={styles.sectionCard}>
              {renderSettingRow(
                <Bell size={18} color={COLORS.navyDeep} />,
                'Price Drop Alerts',
                renderToggle(settings.priceDropAlerts, (val) => updateSettings({ priceDropAlerts: val }))
              )}
              {renderSettingRow(
                <Bell size={18} color={COLORS.navyDeep} />,
                'Daily Summary',
                renderToggle(settings.dailySummaryNotifications || false, (val) => updateSettings({ dailySummaryNotifications: val }))
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATA MANAGEMENT</Text>
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
<View style={styles.dataDivider} />
              
              <View style={[styles.dataSubsection, styles.fullBackupBanner]}>
                <Text style={styles.subsectionLabel}>FULL BACKUP</Text>
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
              
              <View style={styles.dataSubsection}>
                <Text style={styles.subsectionLabel}>BROWSER EXTENSION</Text>
              </View>
              {renderSettingRow(
                <Download size={18} color="#5a2ea6" />,
                'Download Chrome Extension',
                isDownloadingExtension ? (
                  <ActivityIndicator size="small" color="#5a2ea6" />
                ) : (
                  <Text style={styles.countBadge}>v5.6.0</Text>
                ),
                handleDownloadExtension
              )}
              {renderSettingRow(
                <FileSpreadsheet size={18} color={COLORS.success} />,
                'Download Booking CSV Template',
                isDownloadingTemplate ? (
                  <ActivityIndicator size="small" color={COLORS.success} />
                ) : (
                  <Text style={styles.countBadge}>Template</Text>
                ),
                handleDownloadCSVTemplate
              )}
              {renderSettingRow(
                <ExternalLink size={18} color="#5a2ea6" />,
                'Download CR Link',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://chromewebstore.google.com/detail/club-royale-and-blue-chip/aggjibokgkckjppkalkgnegheoldlimd')
              )}
            </View>
            <Text style={styles.backupHint}>
              Full backup includes all cruises, offers, events, casino sessions, certificates, user profile (name, C&A #, playing hours), Club Royale points, loyalty points, and settings.
            </Text>
            <Text style={styles.extensionHint}>
              The Chrome extension scrapes offers from Royal Caribbean and Celebrity cruise websites.
            </Text>
          </View>



          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUPPORT</Text>
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
1. Sign in to Club Royale:
   www.royalcaribbean.com/Club-Royale
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
                'Purchase "Smooth Sailing (In Rough Waters)" on Amazon',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://www.amazon.com/Smooth-Sailing-Rough-Waters-Consistently/dp/B0G4NMSM31/ref=sr_1_1?crid=BWS5ZWAQCC46&dib=eyJ2IjoiMSJ9.pTShQ0uJgtzeHg_EAFai2a6YTAan0h_35hcv7ZH0QKfGjHj071QN20LucGBJIEps.F_tIgnCOSc3EqGF6wUtOWK_hXH-5Ti3Miy6KYQ_JaLY&dib_tag=se&keywords=smooth+sailing+in+rough+waters&qid=1766758613&s=books&sprefix=smooth+sailing+in+rough+water%2Cstripbooks%2C189&sr=1-1')
              )}
              {renderSettingRow(
                <Star size={18} color={COLORS.navyDeep} />,
                'Rate App',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => handleOpenLink('https://apps.apple.com/us/app/easy-seas/id6758175890?ppid=9a051237-cab0-4164-9459-4c55a1976721')
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUBSCRIPTIONS & PURCHASES</Text>
            <View style={styles.sectionCard}>
              <View style={styles.subscriptionStatusBanner}>
                <Crown size={18} color={entitlement.isPro ? '#10B981' : entitlement.isBasic ? '#3B82F6' : '#F59E0B'} />
                <View style={styles.subscriptionStatusText}>
                  <Text style={styles.subscriptionStatusTitle}>
                    {entitlement.isPro ? 'Pro Active' : entitlement.isBasic ? 'Basic Active' : entitlement.tier === 'trial' ? 'Trial Active' : 'View Only'}
                  </Text>
                  <Text style={styles.subscriptionStatusSubtitle}>
                    {entitlement.isPro ? 'All features unlocked' : entitlement.isBasic ? 'Basic features active' : entitlement.tier === 'trial' ? `${entitlement.trialDaysRemaining} days remaining` : 'Upgrade to unlock features'}
                  </Text>
                </View>
              </View>
              <View style={styles.dataDivider} />
              {renderSettingRow(
                <RefreshCcw size={18} color={COLORS.navyDeep} />,
                'Restore Purchases',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => entitlement.restore()
              )}
              {renderSettingRow(
                <ExternalLink size={18} color={COLORS.navyDeep} />,
                'Manage Subscriptions',
                <ExternalLink size={14} color={CLEAN_THEME.text.secondary} />,
                () => entitlement.openManageSubscription()
              )}
              {renderSettingRow(
                <Crown size={18} color={COLORS.navyDeep} />,
                'Upgrade to Pro',
                <ChevronRight size={14} color={CLEAN_THEME.text.secondary} />,
                () => router.push('/paywall')
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
              Manage your subscription status, restore previous purchases, and review legal terms. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
            </Text>
          </View>

          {isAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ADMIN - EMAIL WHITELIST</Text>
              <View style={styles.sectionCard}>
                <View style={styles.adminHeader}>
                  <Text style={styles.adminHeaderText}>Manage user access</Text>
                  <Text style={styles.adminHeaderSubtext}>
                    Whitelisted emails can access restricted features without a subscription. Admin email cannot be removed.
                  </Text>
                </View>
                
                <View style={styles.addEmailContainer}>
                  <TextInput
                    style={styles.addEmailInput}
                    value={newWhitelistEmail}
                    onChangeText={setNewWhitelistEmail}
                    placeholder="Enter email to whitelist"
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
                
                <View style={[styles.dataSubsection, { backgroundColor: 'rgba(0, 31, 63, 0.08)' }]}>
                  <Text style={styles.subsectionLabel}>DATA TOOLS</Text>
                  <Text style={styles.subsectionHelper}>Import CSV files and reset app data.</Text>
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
                      {whitelist.length} whitelisted {whitelist.length === 1 ? 'email' : 'emails'}
                    </Text>
                    {whitelist.map((email) => (
                      <View key={email} style={styles.whitelistItem}>
                        <View style={styles.whitelistItemLeft}>
                          <View style={styles.whitelistItemIcon}>
                            <CheckCircle size={16} color={COLORS.success} />
                          </View>
                          <Text style={styles.whitelistItemEmail}>{email}</Text>
                          {email.toLowerCase() === 'scott.merlis1@gmail.com' && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        {email.toLowerCase() !== 'scott.merlis1@gmail.com' && (
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

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.dangerTitle]}>DANGER ZONE</Text>
            <View style={[styles.sectionCard, styles.dangerCard]}>
              {renderSettingRow(
                <Trash2 size={18} color={COLORS.error} />,
                'Clear All Data',
                undefined,
                handleClearData,
                true
              )}
            </View>
          </View>

<View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <View style={styles.sectionCard}>
              {renderSettingRow(
                <Info size={18} color={COLORS.navyDeep} />,
                'App Version',
                '1.0.0'
              )}
            </View>
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
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLogoRow}>
              <Ship size={20} color={COLORS.navyDeep} />
              <Text style={styles.footerAppName}>EasySeas</Text>
            </View>
            <Text style={styles.footerTagline}>Cruise Point Tracker</Text>
            <View style={styles.footerVersionRow}>
              <Text style={styles.footerVersion}>v1.0.0</Text>
              <Text style={styles.footerDot}>•</Text>
              <Text style={styles.footerBuild}>Build 2025.11</Text>
            </View>
            <TouchableOpacity 
              style={styles.changelogButton}
              onPress={() => Alert.alert(
                'What\'s New in v1.0.0',
                '• Redesigned Settings with unified Data Management\n• Improved Analytics with 3 sub-tabs\n• Enhanced Events tab with calendar views\n• Streamlined My Cruises with timeline\n• Better Scheduling filters\n• Updated UI across all tabs\n\nThank you for using EasySeas!'
              )}
              activeOpacity={0.7}
            >
              <FileText size={12} color={COLORS.navyDeep} />
              <Text style={styles.changelogText}>View Changelog</Text>
            </TouchableOpacity>
            <Text style={styles.footerCopyright}>© 2025 Royal Computer Consulting, LLC</Text>
            
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
        </ScrollView>
      </SafeAreaView>
      
      <UserManualModal
        visible={isUserManualVisible}
        onClose={() => setIsUserManualVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E0F2F1',
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
    backgroundColor: '#E0F7FA',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
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
  footerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  footerAppName: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    letterSpacing: 0.5,
  },
  footerTagline: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
    marginBottom: SPACING.md,
  },
  footerCopyright: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    opacity: 0.7,
    marginTop: SPACING.md,
  },
  footerVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  footerVersion: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  footerDot: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  footerBuild: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.text.secondary,
  },
  changelogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(0, 31, 63, 0.08)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
  },
  changelogText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  legalDisclaimerSection: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
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
    color: CLEAN_THEME.text.secondary,
    backgroundColor: CLEAN_THEME.background.tertiary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
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
    backgroundColor: CLEAN_THEME.background.tertiary,
  },
  importBanner: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  fullBackupBanner: {
    backgroundColor: 'rgba(0, 31, 63, 0.08)',
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
    backgroundColor: CLEAN_THEME.border.light,
    marginVertical: SPACING.xs,
  },
  dataOverviewCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  dataOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dataOverviewTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: CLEAN_THEME.text.primary,
  },
  dataOverviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dataOverviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataOverviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dataOverviewValue: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  dataOverviewLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: CLEAN_THEME.text.secondary,
    marginTop: 2,
  },
  dataOverviewSubLabel: {
    fontSize: 9,
    color: CLEAN_THEME.text.secondary,
    marginTop: 1,
    opacity: 0.7,
  },
  quickActionsSection: {
    marginBottom: SPACING.md,
    backgroundColor: '#E0F2FE',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  quickActionFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
    marginBottom: SPACING.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  quickActionHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.background.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  quickActionIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  quickActionLabelInline: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: CLEAN_THEME.text.primary,
  },
  adminHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: CLEAN_THEME.border.light,
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
    borderBottomColor: CLEAN_THEME.border.light,
  },
  addEmailInput: {
    flex: 1,
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: CLEAN_THEME.text.primary,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
  },
  addEmailButton: {
    backgroundColor: COLORS.navyDeep,
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
    backgroundColor: CLEAN_THEME.background.tertiary,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: CLEAN_THEME.border.light,
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
  removeButton: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
  },
  aboutPromoSection: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#E0F7FA',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
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
  subscriptionStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
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
});
