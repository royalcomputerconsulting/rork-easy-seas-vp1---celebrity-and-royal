import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { buildSeaPassPrintHtml, getSeaPassExportBaseName, SEA_PASS_VIEWBOX, type SeaPassWebPassData } from '@/lib/seaPassWebPass';

type CaptureTarget = Parameters<typeof captureRef>[0];

export async function exportSeaPassPng(
  input: Partial<SeaPassWebPassData>,
  captureTarget?: CaptureTarget | null,
): Promise<string> {
  if (!captureTarget) {
    throw new Error('Preview unavailable. Please wait for the pass to finish rendering.');
  }

  console.log('[SeaPassExport:native] Capturing PNG', { input });

  const uri = await captureRef(captureTarget, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width: SEA_PASS_VIEWBOX.width,
    height: SEA_PASS_VIEWBOX.height,
  });

  console.log('[SeaPassExport:native] PNG created', { uri });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      dialogTitle: 'Export SeaPass PNG',
      mimeType: 'image/png',
      UTI: 'public.png',
    });
    return 'SeaPass PNG ready to share.';
  }

  return `SeaPass PNG saved to ${uri}`;
}

export async function exportSeaPassPdf(input: Partial<SeaPassWebPassData>): Promise<string> {
  const html = buildSeaPassPrintHtml(input);
  const fileName = `${getSeaPassExportBaseName(input)}.pdf`;

  console.log('[SeaPassExport:native] Generating PDF', { fileName, input });

  const result = await Print.printToFileAsync({
    html,
    width: SEA_PASS_VIEWBOX.width,
    height: SEA_PASS_VIEWBOX.height,
    base64: false,
  });

  console.log('[SeaPassExport:native] PDF created', result);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      dialogTitle: 'Export SeaPass PDF',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return `SeaPass PDF ready to share as ${fileName}.`;
  }

  await Print.printAsync({ uri: result.uri });
  return 'Opened the print dialog for the generated SeaPass PDF.';
}
