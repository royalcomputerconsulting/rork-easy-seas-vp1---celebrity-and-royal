import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { 
  validateFileSize, 
  validateRowCount, 
  validateImportContent,
  type ImportValidationError
} from '../importSchemas';

export async function pickAndReadFile(fileType: 'csv' | 'ics' | 'json'): Promise<{ content: string; fileName: string; warnings?: ImportValidationError[] } | null> {
  try {
    console.log(`[FileIO] Opening file picker for ${fileType}`);
    
    const mimeTypes = fileType === 'csv' 
      ? ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/vnd.ms-excel']
      : fileType === 'json'
      ? ['application/json', 'text/plain']
      : ['text/calendar', 'text/plain'];

    const result = await DocumentPicker.getDocumentAsync({
      type: mimeTypes,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('[FileIO] File picker cancelled');
      return null;
    }

    const asset = result.assets[0];
    console.log(`[FileIO] File selected: ${asset.name}, Size: ${asset.size}, URI: ${asset.uri}`);

    if (asset.size) {
      const sizeValidation = validateFileSize(asset.size);
      if (!sizeValidation.success) {
        console.error('[FileIO] File size validation failed:', sizeValidation.errors);
        const error: any = new Error(sizeValidation.errors[0]?.message || 'File size validation failed');
        error.validationErrors = sizeValidation.errors;
        throw error;
      }
    }

    let content: string;
    
    if (Platform.OS === 'web') {
      console.log('[FileIO] Reading web file, URI:', asset.uri);
      
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
      
      console.log('[FileIO] Web file read successfully, length:', content.length);
    } else {
      const file = new File(asset.uri);
      content = await file.text();
    }

    const contentValidation = validateImportContent(content, fileType);
    if (!contentValidation.success) {
      console.error('[FileIO] Content validation failed:', contentValidation.errors);
      const error: any = new Error(contentValidation.errors[0]?.message || 'File content validation failed');
      error.validationErrors = contentValidation.errors;
      throw error;
    }

    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const dataRowCount = Math.max(0, lines.length - 1);
    const rowValidation = validateRowCount(dataRowCount);
    if (!rowValidation.success) {
      console.error('[FileIO] Row count validation failed:', rowValidation.errors);
      const error: any = new Error(rowValidation.errors[0]?.message || 'Too many rows');
      error.validationErrors = rowValidation.errors;
      throw error;
    }

    console.log(`[FileIO] File validated successfully, ${dataRowCount} data rows`);
    return { 
      content, 
      fileName: asset.name, 
      warnings: [...contentValidation.warnings, ...rowValidation.warnings]
    };
  } catch (error) {
    console.error('[FileIO] Error picking/reading file:', error);
    throw error;
  }
}

export async function exportFile(content: string, fileName: string): Promise<boolean> {
  try {
    console.log(`[FileIO] Exporting file: ${fileName}`);

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[FileIO] Web download initiated');
      return true;
    }

    const file = new File(Paths.cache, fileName);
    file.write(content);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: fileName.endsWith('.ics') ? 'text/calendar' : fileName.endsWith('.json') ? 'application/json' : 'text/csv',
        dialogTitle: `Export ${fileName}`,
      });
      console.log('[FileIO] File shared successfully');
      return true;
    } else {
      console.log('[FileIO] Sharing not available');
      return false;
    }
  } catch (error) {
    console.error('[FileIO] Export error:', error);
    throw error;
  }
}
