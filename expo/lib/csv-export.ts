import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

function getWritableExportDirectory(): string | null {
  const fsAny = FileSystem as unknown as {
    documentDirectory?: string | null;
    cacheDirectory?: string | null;
    Paths?: { document?: { uri?: string }; cache?: { uri?: string } };
  };

  const candidates = [
    fsAny.documentDirectory,
    fsAny.cacheDirectory,
    fsAny.Paths?.document?.uri,
    fsAny.Paths?.cache?.uri,
  ];

  const match = candidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);
  if (!match) return null;
  return match.endsWith('/') ? match : `${match}/`;
}

async function saveAndShareText(content: string, filename: string, mimeType: string): Promise<void> {
  const cleanName = safeFilename(filename);

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const baseDir = getWritableExportDirectory();
  if (!baseDir) {
    throw new Error('No writable export area is available on this device. Update Easy Seas permissions or use the Share Sheet export fallback after restarting the app.');
  }

  const fileUri = `${baseDir}${cleanName}`;
  await FileSystem.writeAsStringAsync(fileUri, content, { encoding: (FileSystem.EncodingType?.UTF8 ?? 'utf8') as FileSystem.EncodingType });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: cleanName, UTI: mimeType.includes('csv') ? 'public.comma-separated-values-text' : 'public.plain-text' });
  } else {
    console.log(`[Export] File saved but sharing is unavailable: ${fileUri}`);
  }
}

export async function exportToCSV(
  data: any[],
  headers: { key: string; label: string }[],
  filename: string
): Promise<void> {
  if (data.length === 0) {
    console.log('No data to export');
    return;
  }

  const csvHeaders = headers.map(h => h.label).join(',');
  const csvRows = data.map(row => {
    return headers.map(h => {
      const value = row[h.key];
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      const escaped = stringValue.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  await saveAndShareText(csvContent, filename, 'text/csv;charset=utf-8;');
  console.log(`Exported ${data.length} rows to ${filename}`);
}

export async function exportSurveyToText(
  shipName: string,
  sailDate: string,
  crewMembers: Array<{ fullName: string; roleTitle?: string; department: string; mentionCount?: number }>,
  filename: string
): Promise<void> {
  if (crewMembers.length === 0) {
    console.log('No crew members to export');
    return;
  }

  const textLines: string[] = [];
  textLines.push(
    `On ${shipName}, for SAILING DATE: ${sailDate}, the following crew members gave exceptional and outstanding service and show every example of displaying "The Royal Way":`
  );
  textLines.push('');

  crewMembers.forEach(member => {
    const role = member.roleTitle || member.department;
    textLines.push(`${member.fullName} - ${role}`);
  });

  const textContent = textLines.join('\n');
  await saveAndShareText(textContent, filename, 'text/plain;charset=utf-8;');
  console.log(`Exported survey for ${shipName} on ${sailDate} to ${filename}`);
}
