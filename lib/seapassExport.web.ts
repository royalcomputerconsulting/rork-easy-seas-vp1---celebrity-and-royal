import { buildSeaPassPrintHtml, getSeaPassExportBaseName, type SeaPassWebPassData } from '@/lib/seaPassWebPass';

export async function exportSeaPassPng(
  input: Partial<SeaPassWebPassData>,
  _captureTarget?: unknown,
): Promise<string> {
  const fileName = `${getSeaPassExportBaseName(input)}.png`;
  console.log('[SeaPassExport:web] PNG export not fully supported on web', { fileName });
  return `PNG export is best supported on mobile devices.`;
}

export async function exportSeaPassPdf(input: Partial<SeaPassWebPassData>): Promise<string> {
  console.log('[SeaPassExport:web] Opening print dialog for PDF export', { input });
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=1600');

  if (!popup) {
    throw new Error('Pop-up blocked. Please allow pop-ups and try again.');
  }

  popup.document.open();
  popup.document.write(buildSeaPassPrintHtml(input));
  popup.document.close();
  popup.focus();

  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      popup.print();
      resolve();
    }, 250);
  });

  return 'Opened the browser print dialog. Choose Save as PDF to export.';
}
