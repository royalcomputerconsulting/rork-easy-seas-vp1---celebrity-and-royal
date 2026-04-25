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
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface ImportCrewTextModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (text: string) => Promise<{ importedCount: number; skippedCount: number; shipName: string; sailDate: string }>;
}

const EXAMPLE_TEXT = `Radiance of the Seas 09-26-2025\nJohn Smith\nJane Doe\nBob Johnson\nMaria Garcia`;

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
      Alert.alert(
        'Import Complete',
        `Ship: ${result.shipName}${result.sailDate ? `\nSailing: ${result.sailDate}` : ''}\n\n✅ Imported: ${result.importedCount} crew members\n⏭ Skipped (duplicates): ${result.skippedCount}`,
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
        input.accept = '.txt,text/plain';
        input.onchange = async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const content = ev.target?.result as string;
            if (content) setText(content);
          };
          reader.readAsText(file);
        };
        input.click();
      } catch {
        Alert.alert('Error', 'Could not open file picker.');
      }
      return;
    }

    try {
      const DocumentPicker = (await import('expo-document-picker')).default;
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const content = await response.text();
      if (content) setText(content);
    } catch {
      Alert.alert('Error', 'Could not read the selected file.');
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
            <Text style={styles.title}>Import Crew List</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.infoBox}>
              <Info size={14} color="#0369A1" />
              <Text style={styles.infoText}>
                Line 1: Ship name + sailing date{'\n'}
                Lines 2+: One crew member per line
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
                <Text style={styles.fileButtonText}>Pick .txt File</Text>
              </TouchableOpacity>
              <Text style={styles.orText}>or paste below</Text>
            </View>

            <TextInput
              style={styles.textArea}
              value={text}
              onChangeText={setText}
              placeholder={`Radiance of the Seas 09-26-2025\nJohn Smith\nJane Doe\n...`}
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
