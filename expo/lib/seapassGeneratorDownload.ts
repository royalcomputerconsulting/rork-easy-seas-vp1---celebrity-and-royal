import { Platform } from 'react-native';
import JSZip from 'jszip';

const SEAPASS_GENERATOR_VERSION = '1.0.0';

function getSeaPassGeneratorFiles(): Record<string, string> {
  const files: Record<string, string> = {};

  files['README.md'] = `# SeaPass Generator Standalone Pack v${SEAPASS_GENERATOR_VERSION}

This folder is a complete rebuild pack for the SeaPass Generator feature.

## What this feature does
- Provides an admin-only /seapass-generator screen.
- Renders a locked Royal Caribbean-style SeaPass shell with editable overlays.
- Lets admins edit 7 live fields: time, date, deck, stateroom, muster, reservation, ship.
- Shows a live preview with the exact web pass composition.
- Exports PNG and PDF on native and web.
- Uses a backend proxy route for the approved shell image when needed.

## Folder contents
- code/ — source snapshots of the core feature files and direct supporting files.
- snippets/ — integration snippets for routing, settings entry, backend proxy wiring.
- REBUILD_GUIDE.md — step-by-step rebuild notes.
- ARCHITECTURE.md — runtime architecture and flow.

## Core source files
- code/expo/app/seapass-generator.tsx
- code/expo/components/seapass/SeaPassWebPass.tsx
- code/expo/lib/seaPassWebPass.ts
- code/expo/lib/seapassExport.ts
- code/expo/lib/seapassExport.web.ts

## Admin gating
The screen checks useAuth().isAdmin before rendering the tool.

## Asset references
- Approved shell source image:
  https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2odahwrylhqkr8gb1jwp4.png

## Environment usage
- EXPO_PUBLIC_RORK_API_BASE_URL
`;

  files['ARCHITECTURE.md'] = `# Architecture

## Top-level feature structure
The SeaPass Generator is split into 4 layers:

1. Screen/UI layer — code/expo/app/seapass-generator.tsx
2. Render component layer — code/expo/components/seapass/SeaPassWebPass.tsx
3. Rendering/export engine layer — code/expo/lib/seaPassWebPass.ts, seapassExport.ts, seapassExport.web.ts
4. Integration layer — auth gate, backend proxy, route/settings snippets

## Runtime flow
### Screen boot
- seapass-generator.tsx mounts.
- It prefetches the approved shell image.
- It initializes form state from SEA_PASS_DEFAULTS.

### Editing
- Admin edits one of 7 fields.
- handleFieldChange normalizes uppercase for ship and muster.
- Screen state updates. Preview re-renders immediately.

### Preview rendering
- SeaPassWebPass.tsx calls getSeaPassData(...).
- Then calls buildSeaPassSvgMarkup(...).
- The SVG string is rendered with SvgXml.

### Overlay logic
- Base visual = approved shell image.
- Dynamic values are placed only into masked overlay areas.
- Default values are treated as already baked into the shell image.
- Overlays render only when values differ from defaults.
- Special case: time and date behave as a pair.

### Export
- Native PNG: react-native-view-shot capture
- Native PDF: expo-print + expo-sharing
- Web PNG: SVG -> canvas -> PNG download
- Web PDF: popup window -> print dialog

## Required packages
- expo, expo-router, expo-print, expo-sharing
- lucide-react-native, react-native-svg, react-native-view-shot
`;

  files['REBUILD_GUIDE.md'] = `# Rebuild Guide

## 1. Restore the core files
Copy these files back into your app:
- code/expo/app/seapass-generator.tsx -> expo/app/seapass-generator.tsx
- code/expo/components/seapass/SeaPassWebPass.tsx -> expo/components/seapass/SeaPassWebPass.tsx
- code/expo/lib/seaPassWebPass.ts -> expo/lib/seaPassWebPass.ts
- code/expo/lib/seapassExport.ts -> expo/lib/seapassExport.ts
- code/expo/lib/seapassExport.web.ts -> expo/lib/seapassExport.web.ts
- code/expo/components/ErrorBoundary.tsx -> expo/components/ErrorBoundary.tsx

## 2. Reconnect routing
Use the snippets in snippets/route-integration.md.
Register the screen in expo/app/_layout.tsx as name="seapass-generator".
Add the settings/admin entry that pushes '/seapass-generator'.

## 3. Reconnect admin gating
The screen expects useAuth().isAdmin from your auth provider.

## 4. Reconnect the approved shell proxy
Use snippets/backend-seapass-proxy.ts.

## 5. Confirm environment setup
Required: EXPO_PUBLIC_RORK_API_BASE_URL

## 6. Confirm packages
expo-router, lucide-react-native, react-native-svg, expo-print, expo-sharing, react-native-view-shot

## 7. Visual rules to preserve
- Keep the approved shell image as the base layer.
- Only overlay changed values in their mapped mask areas.
- Preserve the top-right time/date paired rendering behavior.
- Keep the barcode caption format as reservation-stateroom.
- Preserve SEA_PASS_VIEWBOX at 1024 x 1536 for export fidelity.
`;

  files['snippets/route-integration.md'] = `# Route Integration Snippets

## expo/app/_layout.tsx

\`\`\`tsx
<Stack.Screen
  name="seapass-generator"
  options={{
    headerShown: true,
  }}
/>
\`\`\`

## expo/app/(tabs)/settings.tsx

\`\`\`tsx
{renderSettingRow(
  <Ticket size={18} color="#5A319F" />,
  'SeaPass Web Generator',
  'Locked Version 2 web pass',
  () => router.push('/seapass-generator' as any)
)}
\`\`\`
`;

  files['snippets/root-layout-seapass-screen.tsx'] = `<Stack.Screen
  name="seapass-generator"
  options={{
    headerShown: true,
  }}
/>`;

  files['snippets/settings-admin-entry.tsx'] = `{renderSettingRow(
  <Ticket size={18} color="#5A319F" />,
  'SeaPass Web Generator',
  'Locked Version 2 web pass',
  () => router.push('/seapass-generator' as any)
)}`;

  files['snippets/backend-seapass-proxy.ts'] = `const SEA_PASS_APPROVED_SHELL_SOURCE_URL = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/2odahwrylhqkr8gb1jwp4.png';

app.get('/seapass-approved-shell', async (c) => {
  console.log('[Hono] SeaPass approved shell proxy requested');

  try {
    const response = await fetch(SEA_PASS_APPROVED_SHELL_SOURCE_URL);

    if (!response.ok || !response.body) {
      console.error('[Hono] SeaPass approved shell proxy failed', {
        status: response.status,
      });
      return c.text('Unable to load approved SeaPass shell', 502);
    }

    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('content-type') ?? 'image/png');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[Hono] SeaPass approved shell proxy error', error);
    return c.text('Unable to load approved SeaPass shell', 502);
  }
});`;

  files['code/expo/components/ErrorBoundary.tsx'] = `import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

type ErrorBoundaryState = { hasError: boolean; errorMessage: string; errorStack?: string };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '', errorStack: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const message = error?.message || 'Unknown error';
    const stack = error?.stack || '';
    console.error('[ErrorBoundary] getDerivedStateFromError', message, stack);
    return { hasError: true, errorMessage: message, errorStack: stack };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] componentDidCatch', {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    });
  }

  handleReset = () => {
    console.log('[ErrorBoundary] Reset pressed');
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.errorMessage || 'An unexpected error occurred.'}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset} testID="error-reset-button">
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0B1023' },
  title: { fontSize: 22, fontWeight: '700', color: '#F5F0E8', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, color: '#8B95A8', marginBottom: 24, textAlign: 'center', lineHeight: 22 },
  button: { backgroundColor: '#D4C5A0', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#0B1023' },
});`;

  files['code/expo/components/seapass/SeaPassWebPass.tsx'] = `import React, { memo, useEffect, useState } from 'react';
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL,
  SEA_PASS_PREVIEW_BACKGROUND,
  SEA_PASS_VIEWBOX,
  buildSeaPassSvgMarkup,
  getSeaPassData,
  loadSeaPassApprovedImageAsDataUrl,
  type SeaPassWebPassData,
} from '@/lib/seaPassWebPass';

export interface SeaPassWebPassProps extends Partial<SeaPassWebPassData> {
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SeaPassWebPass = memo(function SeaPassWebPass({
  width = '100%',
  style,
  testID,
  ...input
}: SeaPassWebPassProps) {
  const data = getSeaPassData(input);
  const [imageHref, setImageHref] = useState<string>(SEA_PASS_APPROVED_SCREENSHOT_SOURCE_URL);

  useEffect(() => {
    let cancelled = false;
    console.log('[SeaPassWebPass] Loading approved shell image as data URL');
    loadSeaPassApprovedImageAsDataUrl()
      .then((dataUrl) => {
        if (!cancelled) {
          console.log('[SeaPassWebPass] Approved shell image loaded, length:', dataUrl.length);
          setImageHref(dataUrl);
        }
      })
      .catch((error) => {
        console.error('[SeaPassWebPass] Could not load shell as data URL, using direct URL', error);
      });
    return () => { cancelled = true; };
  }, []);

  const svgMarkup = buildSeaPassSvgMarkup(data, SEA_PASS_PREVIEW_BACKGROUND, imageHref);

  return (
    <View style={[styles.container, style, { width }]} testID={testID ?? 'seapass.preview'}>
      <View style={styles.aspectRatioFrame}>
        <SvgXml xml={svgMarkup} width="100%" height="100%" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EFF3F8',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#182030',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  aspectRatioFrame: {
    width: '100%',
    aspectRatio: 1024 / 1536,
    backgroundColor: '#EFF3F8',
  },
});

export default SeaPassWebPass;`;

  files['code/expo/lib/seapassExport.web.ts'] = `import { buildSeaPassPrintHtml, exportSeaPassPngOnWeb, getSeaPassExportBaseName, type SeaPassWebPassData } from '@/lib/seaPassWebPass';

export async function exportSeaPassPng(
  input: Partial<SeaPassWebPassData>,
  _captureTarget?: unknown,
): Promise<string> {
  const fileName = \\\`\\\${getSeaPassExportBaseName(input)}.png\\\`;
  console.log('[SeaPassExport:web] Exporting PNG', { fileName, input });
  await exportSeaPassPngOnWeb(input, fileName);
  return \\\`Downloaded \\\${fileName}\\\`;
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
    window.setTimeout(() => { popup.print(); resolve(); }, 250);
  });
  return 'Opened the browser print dialog. Choose Save as PDF to export.';
}`;

  files['code/expo/lib/seapassExport.ts'] = `import * as Print from 'expo-print';
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
    format: 'png', quality: 1, result: 'tmpfile',
    width: SEA_PASS_VIEWBOX.width, height: SEA_PASS_VIEWBOX.height,
  });
  console.log('[SeaPassExport:native] PNG created', { uri });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { dialogTitle: 'Export SeaPass PNG', mimeType: 'image/png', UTI: 'public.png' });
    return 'SeaPass PNG ready to share.';
  }
  return \\\`SeaPass PNG saved to \\\${uri}\\\`;
}

export async function exportSeaPassPdf(input: Partial<SeaPassWebPassData>): Promise<string> {
  const html = buildSeaPassPrintHtml(input);
  const fileName = \\\`\\\${getSeaPassExportBaseName(input)}.pdf\\\`;
  console.log('[SeaPassExport:native] Generating PDF', { fileName, input });
  const result = await Print.printToFileAsync({
    html, width: SEA_PASS_VIEWBOX.width, height: SEA_PASS_VIEWBOX.height, base64: false,
  });
  console.log('[SeaPassExport:native] PDF created', result);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, { dialogTitle: 'Export SeaPass PDF', mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    return \\\`SeaPass PDF ready to share as \\\${fileName}.\\\`;
  }
  await Print.printAsync({ uri: result.uri });
  return 'Opened the print dialog for the generated SeaPass PDF.';
}`;

  return files;
}

export async function downloadSeaPassGenerator(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[SeaPassDownload] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log(`[SeaPassDownload] Creating SeaPass Generator ZIP v${SEAPASS_GENERATOR_VERSION}...`);
    const ZipConstructor = (JSZip as any).default ?? JSZip;
    const zip = new ZipConstructor();
    const generatorFiles = getSeaPassGeneratorFiles();

    for (const [filename, content] of Object.entries(generatorFiles)) {
      zip.file(filename, content);
      console.log(`[SeaPassDownload] Added ${filename}`);
    }

    const fileCount = Object.keys(zip.files).length;
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `SeaPass_Generator_Standalone_v${SEAPASS_GENERATOR_VERSION}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    console.log(`[SeaPassDownload] SeaPass Generator v${SEAPASS_GENERATOR_VERSION} download initiated successfully`);
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[SeaPassDownload] Error creating SeaPass Generator ZIP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
