import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { getAllStoredData, importAllData, type FullAppDataBundle } from '../dataBundle/bundleOperations';

export async function exportAllDataToFile(): Promise<{
  success: boolean;
  fileName?: string;
  error?: string;
}> {
  try {
    console.log('[DataFileIO] Exporting all data to file...');
    
    const bundle = await getAllStoredData();
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

    const { File: ExpoFile, Paths: ExpoPaths } = await import('expo-file-system');
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

export async function importAllDataFromFile(): Promise<{
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
      const { File: ExpoFile2 } = await import('expo-file-system');
      const file = new ExpoFile2(asset.uri);
      content = await file.text();
    }

    let bundle: FullAppDataBundle;
    try {
      bundle = JSON.parse(content) as FullAppDataBundle;
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

    if (!bundle.version || typeof bundle.version !== 'string') {
      console.warn('[DataFileIO] Old backup format detected, attempting migration...');
      if (!bundle.cruises && !bundle.bookedCruises && !bundle.casinoOffers) {
        return { 
          success: false, 
          error: 'Invalid backup file format. Please use an EasySeas backup file.' 
        };
      }
      bundle.version = '2.0.0';
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

    if (!Array.isArray(bundle.cruises)) bundle.cruises = [];
    if (!Array.isArray(bundle.bookedCruises)) bundle.bookedCruises = [];
    if (!Array.isArray(bundle.casinoOffers)) bundle.casinoOffers = [];
    if (!Array.isArray(bundle.calendarEvents)) bundle.calendarEvents = [];
    if (!Array.isArray(bundle.casinoSessions)) bundle.casinoSessions = [];
    if (!Array.isArray(bundle.certificates)) bundle.certificates = [];
    if (!Array.isArray(bundle.users)) bundle.users = [];
    if (!bundle.machines) bundle.machines = { encyclopedia: [], atlasIds: [] };
    if (!Array.isArray(bundle.machines.encyclopedia)) bundle.machines.encyclopedia = [];
    if (!Array.isArray(bundle.machines.atlasIds)) bundle.machines.atlasIds = [];

    const importResult = await importAllData(bundle);
    
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
