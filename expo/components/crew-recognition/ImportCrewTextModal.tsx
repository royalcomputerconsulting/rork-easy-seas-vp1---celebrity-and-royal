import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { X, FileText, Upload, Info } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { crewWorkbookBytesToCsv, isCrewWorkbookFile } from '@/lib/crewRecognitionWorkbook';

interface ImportCrewTextModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (text: string) => Promise<{
    importedCount: number;
    skippedCount: number;
    shipName: string;
    sailDate: string;
    sailingCount: number;
    format: 'csv' | 'text';
    warnings: string[];
  }>;
}

const EXAMPLE_TEXT = `Ship: Radiance of the Seas
Sailing: 2026-09-26
John Smith | Casino | Dealer | Outstanding service
Jane Doe | Dining | Waiter

Ship: Celebrity Equinox
Sailing: 2026-10-03; 2026-11-07
Maria Garcia | Beverage | Bartender`;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof globalThis.atob === 'function'
    ? globalThis.atob(base64)
    : base64.replace(/[^A-Za-z0-9+/=]/g, '').replace(/=+$/, '').split('').reduce((output, _char, index, source) => {
      if (index % 4 === 1) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const encoded1 = chars.indexOf(source[index - 1]);
        const encoded2 = chars.indexOf(source[index]);
        const encoded3 = chars.indexOf(source[index + 1] ?? 'A');
        const encoded4 = chars.indexOf(source[index + 2] ?? 'A');
        output += String.fromCharCode((encoded1 << 2) | (encoded2 >> 4));
        if (source[index + 1] !== undefined) output += String.fromCharCode(((encoded2 & 15) << 4) | (encoded3 >> 2));
        if (source[index + 2] !== undefined) output += String.fromCharCode(((encoded3 & 3) << 6) | encoded4);
      }
      return output;
    }, '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readPickedFileAsText(uri: string): Promise<string> {
  try {
    return await LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.UTF8 });
  } catch (fileSystemError) {
    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch {
      throw fileSystemError;
    }
  }
}

async function readPickedFileAsBytes(uri: string): Promise<Uint8Array> {
  try {
    const base64 = await LegacyFileSystem.readAsStringAsync(uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
    if (!base64) throw new Error('The selected workbook returned no bytes.');
    return base64ToUint8Array(base64);
  } catch (fileSystemError) {
    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      throw fileSystemError;
    }
  }
}

export function ImportCrewTextModal({ visible, onClose, onImport }: ImportCrewTextModalProps) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const handleImport = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Empty List', 'Please paste or type a crew list before importing.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await onImport(trimmed);
      const warningLine = result.warnings.length ? `\n⚠ ${result.warnings.length} row warning(s)` : '';
      Alert.alert(
        'Import Complete',
        `Read ${result.format.toUpperCase()} data across ${result.sailingCount} sailing record(s).\n\n✅ Imported: ${result.importedCount} crew recognition rows\n⏭ Skipped (duplicates): ${result.skippedCount}${warningLine}`,
        [{ text: 'OK', onPress: () => { setText(''); onClose(); } }]
      );
    } catch (err) {
      Alert.alert('Import Failed', err instanceof Error ? err.message : 'Unknown error. Please check the format and try again.');
    } finally {
      setIsImporting(false);
    }
  }, [text, onImport, onClose]);

  const handlePickFile = useCallback(async () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
        input.onchange = async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          if (isCrewWorkbookFile(file.name, file.type)) {
            const parsed = crewWorkbookBytesToCsv(await file.arrayBuffer());
            setText(parsed.csv);
            Alert.alert('Workbook Ready', `Loaded ${parsed.rowCount} crew registry row(s) from “${parsed.sheetName}”. Review the preview, then tap Import.`);
          } else {
            setText(await file.text());
          }
        };
        input.click();
      } catch {
        Alert.alert('Error', 'Could not open file picker.');
      }
      return;
    }

    try {
      const pickDocument = DocumentPicker.getDocumentAsync;
      if (typeof pickDocument !== 'function') {
        throw new Error('Document picker is not available in this build. Rebuild the app after reinstalling expo-document-picker.');
      }
      const result = await pickDocument({
        type: [
          'text/csv',
          'text/plain',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (isCrewWorkbookFile(asset.name, asset.mimeType)) {
        const bytes = await readPickedFileAsBytes(asset.uri);
        const parsed = crewWorkbookBytesToCsv(bytes);
        setText(parsed.csv);
        Alert.alert('Workbook Ready', `Loaded ${parsed.rowCount} crew registry row(s) from “${parsed.sheetName}”. Review the preview, then tap Import.`);
      } else {
        const content = await readPickedFileAsText(asset.uri);
        if (content) setText(content);
      }
    } catch (error) {
      Alert.alert('Could not read crew file', error instanceof Error ? error.message : 'The selected file could not be opened. Try saving it as .xlsx or UTF-8 CSV and select it again.');
    }
  }, []);

  const handleClose = useCallback(() => {
    setText('');
    setShowExample(false);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <FileText size={22} color={COLORS.primary} />
            <Text style={styles.title}>Import Crew Registry</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.infoBox}>
              <Info size={14} color="#0369A1" />
              <Text style={styles.infoText}>
                Import one Excel, CSV, or text file containing multiple ships and sailings. Excel automatically reads the Master Registry sheet. Tables accept Ship, Crew Member, Department, Role / Location, and All Sailing Dates.
              </Text>
              <TouchableOpacity onPress={() => setShowExample(v => !v)} style={styles.exampleToggle}>
                <Text style={styles.exampleToggleText}>{showExample ? 'Hide example' : 'See example'}</Text>
              </TouchableOpacity>
            </View>

            {showExample && (
              <View style={styles.exampleBox}>
                <Text style={styles.exampleText}>{EXAMPLE_TEXT}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.fileButton} onPress={handlePickFile} activeOpacity={0.7}>
                <Upload size={16} color={COLORS.primary} />
                <Text style={styles.fileButtonText}>Pick Excel, CSV, or Text File</Text>
              </TouchableOpacity>
              <Text style={styles.orText}>or paste below</Text>
            </View>

            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={setText}
              placeholder={`Ship: Radiance of the Seas\nSailing: 2026-09-26\nJohn Smith | Casino | Dealer\n\nShip: Celebrity Equinox\nSailing: 2026-10-03\nJane Doe | Dining | Waiter`}
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
              autoCapitalize="words"
            />

            {text.trim().length > 0 && (
              <Text style={styles.lineCount}>
                {text.trim().split('\n').filter(l => l.trim()).length} lines detected
              </Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={isImporting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importButton, (isImporting || !text.trim()) && styles.importButtonDisabled]}
              onPress={handleImport}
              disabled={isImporting || !text.trim()}
            >
              {isImporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.importButtonText}>Import Crew</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  body: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(3,105,161,0.07)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
    flexWrap: 'wrap',
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#0369A1',
    lineHeight: 18,
  },
  exampleToggle: {
    paddingTop: 2,
  },
  exampleToggleText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#0369A1',
    fontWeight: '700' as const,
    textDecorationLine: 'underline',
  },
  exampleBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3,105,161,0.2)',
  },
  exampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#0369A1',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(3,105,161,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(3,105,161,0.2)',
  },
  fileButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.primary,
    fontWeight: '600' as const,
  },
  orText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
    minHeight: 180,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  lineCount: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  importButton: {
    flex: 2,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
