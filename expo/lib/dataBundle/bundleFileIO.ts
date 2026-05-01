import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllStoredData, importAllData, type FullAppDataBundle } from '../dataBundle/bundleOperations';

type LegacyFullDataBundle = Partial<FullAppDataBundle> & {
  offers?: unknown;
  booked?: unknown;
  calendar?: unknown;
  profile?: unknown;
  localData?: {
    cruises?: unknown;
    booked?: unknown;
    bookedCruises?: unknown;
    offers?: unknown;
    casinoOffers?: unknown;
    calendar?: unknown;
    calendarEvents?: unknown;
  };
};

function normalizeImportedArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeImportedBackup(rawBundle: LegacyFullDataBundle): FullAppDataBundle {
  const localData = rawBundle.localData;
  const cruises = normalizeImportedArray<FullAppDataBundle['cruises'][number]>(
    rawBundle.cruises ?? localData?.cruises
  );
  const bookedCruises = normalizeImportedArray<FullAppDataBundle['bookedCruises'][number]>(
    rawBundle.bookedCruises ?? rawBundle.booked ?? localData?.bookedCruises ?? localData?.booked
  );
  const casinoOffers = normalizeImportedArray<FullAppDataBundle['casinoOffers'][number]>(
    rawBundle.casinoOffers ?? rawBundle.offers ?? localData?.casinoOffers ?? localData?.offers
  );
  const calendarEvents = normalizeImportedArray<FullAppDataBundle['calendarEvents'][number]>(
    rawBundle.calendarEvents ?? rawBundle.calendar ?? localData?.calendarEvents ?? localData?.calendar
  );
  const casinoSessions = normalizeImportedArray<FullAppDataBundle['casinoSessions'][number]>(rawBundle.casinoSessions);
  const certificates = normalizeImportedArray<FullAppDataBundle['certificates'][number]>(rawBundle.certificates);
  const users = normalizeImportedArray<FullAppDataBundle['users'][number]>(rawBundle.users);
  const machineData = rawBundle.machines && typeof rawBundle.machines === 'object' ? rawBundle.machines : undefined;
  const crewRecognition = rawBundle.crewRecognition && typeof rawBundle.crewRecognition === 'object' ? rawBundle.crewRecognition : undefined;

  return {
    ...rawBundle,
    version: typeof rawBundle.version === 'string' ? rawBundle.version : '2.0.0',
    exportDate: typeof rawBundle.exportDate === 'string' ? rawBundle.exportDate : new Date().toISOString(),
    cruises,
    bookedCruises,
    casinoOffers,
    calendarEvents,
    casinoSessions,
    certificates,
    clubRoyaleProfile: rawBundle.clubRoyaleProfile ?? (rawBundle.profile as FullAppDataBundle['clubRoyaleProfile'] | undefined) ?? null,
    settings: rawBundle.settings ?? null,
    loyaltyData: rawBundle.loyaltyData ?? {
      manualClubRoyalePoints: rawBundle.userProfile?.clubRoyalePoints ?? null,
      manualCrownAnchorPoints: rawBundle.userProfile?.loyaltyPoints ?? null,
      userPoints: rawBundle.userProfile?.loyaltyPoints ?? null,
    },
    extendedLoyaltyData: rawBundle.extendedLoyaltyData ?? null,
    userProfile: rawBundle.userProfile ?? null,
    users,
    machines: {
      encyclopedia: normalizeImportedArray<FullAppDataBundle['machines']['encyclopedia'][number]>(machineData?.encyclopedia),
      atlasIds: normalizeImportedArray<string>(machineData?.atlasIds),
    },
    crewRecognition: {
      entries: normalizeImportedArray<FullAppDataBundle['crewRecognition']['entries'][number]>(crewRecognition?.entries),
      sailings: normalizeImportedArray<FullAppDataBundle['crewRecognition']['sailings'][number]>(crewRecognition?.sailings),
    },
    metadata: {
      totalCruises: cruises.length,
      totalBooked: bookedCruises.length,
      totalOffers: casinoOffers.length,
      totalEvents: calendarEvents.length,
      totalCertificates: certificates.length,
      totalSessions: casinoSessions.length,
      totalMachines: normalizeImportedArray<string>(machineData?.atlasIds).length,
      totalCrewEntries: normalizeImportedArray<FullAppDataBundle['crewRecognition']['entries'][number]>(crewRecognition?.entries).length,
    },
  };
}

export async function exportAllDataToFile(email?: string | null): Promise<{
  success: boolean;
  fileName?: string;
  error?: string;
}> {
  try {
    console.log('[DataFileIO] Exporting all data to file for email:', email || '(none)');
    
    const bundle = await getAllStoredData(email);
    const jsonContent = JSON.stringify(bundle, null, 2);
    
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const timestamp = `${month}.${day}.${year}`;
    
    const fileName = `Easy Seas - Backup ${timestamp}.json`;

    if (Platform.OS === 'web') {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[DataFileIO] Web download initiated');
      return { success: true, fileName };
    }

    const file = new ExpoFile(ExpoPaths.cache, fileName);
    await file.write(jsonContent);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: `Export ${fileName}`,
      });
    }

    console.log('[DataFileIO] File exported successfully');
    return { success: true, fileName };
  } catch (error) {
    console.error('[DataFileIO] Export error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function importAllDataFromFile(email?: string | null): Promise<{
  success: boolean;
  imported?: {
    cruises: number;
    bookedCruises: number;
    casinoOffers: number;
    calendarEvents: number;
    casinoSessions: number;
    certificates: number;
    machines: number;
  };
  error?: string;
}> {
  try {
    console.log('[DataFileIO] Opening file picker for import...');

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('[DataFileIO] File picker cancelled');
      return { success: false, error: 'Import cancelled' };
    }

    const asset = result.assets[0];
    console.log(`[DataFileIO] File selected: ${asset.name}`);

    let content: string;
    if (Platform.OS === 'web') {
      console.log('[DataFileIO] Reading web file, URI:', asset.uri);
      
      if (asset.uri.startsWith('blob:')) {
        const response = await fetch(asset.uri);
        content = await response.text();
      } else if (asset.uri.startsWith('data:')) {
        const base64Data = asset.uri.split(',')[1];
        content = atob(base64Data);
      } else {
        const response = await fetch(asset.uri);
        content = await response.text();
      }
      
      console.log('[DataFileIO] Web file read successfully, length:', content.length);
    } else {
      const expoFile = new ExpoFile(asset.uri);
      content = await expoFile.text();
    }

    let bundle: FullAppDataBundle;
    try {
      const parsedBundle = JSON.parse(content) as LegacyFullDataBundle;
      bundle = normalizeImportedBackup(parsedBundle);
    } catch (parseError) {
      console.error('[DataFileIO] JSON parse error:', parseError);
      return { 
        success: false, 
        error: 'Invalid JSON format. Please use a valid EasySeas backup file.' 
      };
    }

    if (!bundle || typeof bundle !== 'object') {
      return { 
        success: false, 
        error: 'Invalid backup file format. File does not contain valid data.' 
      };
    }

    if (
      bundle.cruises.length === 0 &&
      bundle.bookedCruises.length === 0 &&
      bundle.casinoOffers.length === 0 &&
      bundle.calendarEvents.length === 0 &&
      bundle.casinoSessions.length === 0 &&
      bundle.certificates.length === 0 &&
      bundle.users.length === 0 &&
      bundle.machines.atlasIds.length === 0 &&
      bundle.crewRecognition.entries.length === 0 &&
      !bundle.clubRoyaleProfile &&
      !bundle.userProfile
    ) {
      return {
        success: false,
        error: 'Invalid backup file format. Please use an EasySeas backup file.'
      };
    }

    console.log('[DataFileIO] Import validation passed. Bundle version:', bundle.version);
    console.log('[DataFileIO] Bundle contains:', {
      cruises: bundle.cruises?.length || 0,
      bookedCruises: bundle.bookedCruises?.length || 0,
      casinoOffers: bundle.casinoOffers?.length || 0,
      calendarEvents: bundle.calendarEvents?.length || 0,
      casinoSessions: bundle.casinoSessions?.length || 0,
      certificates: bundle.certificates?.length || 0,
      users: bundle.users?.length || 0,
      machines: bundle.machines?.atlasIds?.length || 0,
    });

    const importResult = await importAllData(bundle, email ?? null);
    
    if (importResult.errors.length > 0) {
      console.log('[DataFileIO] Import completed with errors:', importResult.errors);
    }

    return { 
      success: true, 
      imported: importResult.imported 
    };
  } catch (error) {
    console.error('[DataFileIO] Import error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
