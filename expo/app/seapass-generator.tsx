import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Download, FileDown, RefreshCcw, Shield, Ship } from 'lucide-react-native';
import { SeaPassWebPass } from '@/components/seapass/SeaPassWebPass';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BORDER_RADIUS, COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { SEA_PASS_APPROVED_SCREENSHOT_URL, SEA_PASS_DEFAULTS, SEA_PASS_VIEWBOX, type SeaPassWebPassData } from '@/lib/seaPassWebPass';
import { exportSeaPassPdf, exportSeaPassPng } from '@/lib/seapassExport';
import { useAuth } from '@/state/AuthProvider';

interface SeaPassFieldConfig {
  key: keyof SeaPassWebPassData;
  label: string;
  placeholder: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
}

const FIELD_CONFIGS: SeaPassFieldConfig[] = [
  {
    key: 'time',
    label: 'Boarding Time',
    placeholder: SEA_PASS_DEFAULTS.time,
    keyboardType: 'default',
    autoCapitalize: 'none',
  },
  {
    key: 'date',
    label: 'Sailing Date',
    placeholder: SEA_PASS_DEFAULTS.date,
    keyboardType: 'default',
    autoCapitalize: 'words',
  },
  {
    key: 'deck',
    label: 'Deck',
    placeholder: SEA_PASS_DEFAULTS.deck,
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
  },
  {
    key: 'stateroom',
    label: 'Stateroom',
    placeholder: SEA_PASS_DEFAULTS.stateroom,
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
  },
  {
    key: 'muster',
    label: 'Muster Station',
    placeholder: SEA_PASS_DEFAULTS.muster,
    keyboardType: 'default',
    autoCapitalize: 'characters',
  },
  {
    key: 'reservation',
    label: 'Reservation Number',
    placeholder: SEA_PASS_DEFAULTS.reservation,
    keyboardType: 'number-pad',
    autoCapitalize: 'none',
  },
  {
    key: 'ship',
    label: 'Ship Code',
    placeholder: SEA_PASS_DEFAULTS.ship,
    keyboardType: 'default',
    autoCapitalize: 'characters',
  },
];

function normalizeSeaPassFieldValue(key: keyof SeaPassWebPassData, value: string): string {
  if (key === 'ship' || key === 'muster') {
    return value.toUpperCase();
  }

  return value;
}

function SeaPassGeneratorScreen() {
  const { width } = useWindowDimensions();
  const previewCaptureRef = useRef<View | null>(null);
  const exportCaptureRef = useRef<View | null>(null);
  const [formData, setFormData] = useState<SeaPassWebPassData>({ ...SEA_PASS_DEFAULTS });
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const isWideLayout = width >= 1080;
  const previewWidth = useMemo(() => {
    if (isWideLayout) {
      return 500;
    }

    return Math.min(Math.max(width - 48, 280), 520);
  }, [isWideLayout, width]);

  useEffect(() => {
    console.log('[SeaPassGenerator] Screen mounted');
    if (Platform.OS !== 'web') {
      Image.prefetch(SEA_PASS_APPROVED_SCREENSHOT_URL)
        .then((didLoad) => {
          console.log('[SeaPassGenerator] Approved SeaPass shell prefetched', { didLoad });
        })
        .catch((error: unknown) => {
          console.log('[SeaPassGenerator] Could not prefetch SeaPass shell (non-critical)', error instanceof Error ? error.message : String(error));
        });
    }
  }, []);

  useEffect(() => {
    console.log('[SeaPassGenerator] Form updated', formData);
  }, [formData]);

  const handleFieldChange = useCallback((key: keyof SeaPassWebPassData, value: string) => {
    const normalizedValue = normalizeSeaPassFieldValue(key, value);
    console.log('[SeaPassGenerator] Field changed', { key, value: normalizedValue });
    setFormData((current) => ({
      ...current,
      [key]: normalizedValue,
    }));
  }, []);

  const handleReset = useCallback(() => {
    console.log('[SeaPassGenerator] Resetting form to defaults');
    setFormData({ ...SEA_PASS_DEFAULTS });
  }, []);

  const handleExportPng = useCallback(async () => {
    try {
      console.log('[SeaPassGenerator] Starting PNG export');
      setIsExportingPng(true);
      const captureTarget = Platform.OS === 'web'
        ? previewCaptureRef.current
        : exportCaptureRef.current ?? previewCaptureRef.current;
      const resultMessage = await exportSeaPassPng(formData, captureTarget);
      Alert.alert('PNG Export Ready', resultMessage);
    } catch (error) {
      console.error('[SeaPassGenerator] PNG export failed', error);
      Alert.alert('PNG Export Failed', error instanceof Error ? error.message : 'Unable to export the SeaPass as PNG right now.');
    } finally {
      setIsExportingPng(false);
    }
  }, [formData]);

  const handleExportPdf = useCallback(async () => {
    try {
      console.log('[SeaPassGenerator] Starting PDF export');
      setIsExportingPdf(true);
      const resultMessage = await exportSeaPassPdf(formData);
      Alert.alert('PDF Export Ready', resultMessage);
    } catch (error) {
      console.error('[SeaPassGenerator] PDF export failed', error);
      Alert.alert('PDF Export Failed', error instanceof Error ? error.message : 'Unable to export or print the SeaPass as PDF right now.');
    } finally {
      setIsExportingPdf(false);
    }
  }, [formData]);

  return (
    <View style={styles.screen} testID="seapass-generator.screen">
      <Stack.Screen
        options={{
          title: 'SeaPass Generator',
          headerStyle: { backgroundColor: '#4F2A95' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700',
          },
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.hiddenExportStage} pointerEvents="none">
          <View ref={exportCaptureRef} collapsable={false} style={styles.hiddenExportCaptureFrame} testID="seapass-generator.export-capture-target">
            <SeaPassWebPass
              time={formData.time}
              date={formData.date}
              deck={formData.deck}
              stateroom={formData.stateroom}
              muster={formData.muster}
              reservation={formData.reservation}
              ship={formData.ship}
              width={SEA_PASS_VIEWBOX.width}
              style={styles.hiddenExportPass}
              testID="seapass-generator.export-pass"
            />
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="seapass-generator.scroll"
        >
          <View style={[styles.contentGrid, isWideLayout && styles.contentGridWide]}>
            <View style={[styles.previewPanel, isWideLayout && styles.previewPanelWide]}>
              <View style={styles.previewHeaderCard}>
                <View style={styles.previewHeaderIconWrap}>
                  <Ship size={18} color="#FFFFFF" />
                </View>
                <View style={styles.previewHeaderTextWrap}>
                  <Text style={styles.previewEyebrow}>Locked Version 2 Web SeaPass</Text>
                  <Text style={styles.previewTitle}>Live Preview</Text>
                  <Text style={styles.previewSubtitle}>The web SeaPass updates instantly as you edit the admin form below.</Text>
                </View>
              </View>

              <View style={styles.previewSurface}>
                <View ref={previewCaptureRef} collapsable={false} style={styles.previewCaptureFrame} testID="seapass-generator.capture-target">
                  <SeaPassWebPass
                    time={formData.time}
                    date={formData.date}
                    deck={formData.deck}
                    stateroom={formData.stateroom}
                    muster={formData.muster}
                    reservation={formData.reservation}
                    ship={formData.ship}
                    width={previewWidth}
                    style={styles.previewPass}
                    testID="seapass-generator.preview"
                  />
                </View>
              </View>
            </View>

            <View style={[styles.formPanel, isWideLayout && styles.formPanelWide]}>
              <View style={styles.formCard}>
                <View style={styles.formCardHeader}>
                  <Text style={styles.formCardTitle}>SeaPass Web Generator</Text>
                  <Text style={styles.formCardSubtitle}>Admin-only generator for the finalized Royal Caribbean web SeaPass.</Text>
                </View>

                <View style={styles.lockedInfoCard}>
                  <View style={styles.lockedBadge}>
                    <Shield size={14} color="#5A319F" />
                    <Text style={styles.lockedBadgeText}>Locked Elements</Text>
                  </View>
                  <Text style={styles.lockedInfoText}>Scott Merlis • DIAMOND PLUS • SIGNATURE • LOS ANGELES, CALIFORNIA</Text>
                </View>

                <View style={styles.fieldsGrid}>
                  {FIELD_CONFIGS.map((field) => (
                    <View key={field.key} style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput
                        value={formData[field.key]}
                        onChangeText={(value) => handleFieldChange(field.key, value)}
                        placeholder={field.placeholder}
                        placeholderTextColor="#9AA3B2"
                        keyboardType={field.keyboardType}
                        autoCapitalize={field.autoCapitalize}
                        autoCorrect={false}
                        style={styles.input}
                        testID={`seapass-generator.input.${field.key}`}
                      />
                    </View>
                  ))}
                </View>

                <Pressable style={styles.resetButton} onPress={handleReset} testID="seapass-generator.reset">
                  <RefreshCcw size={16} color={COLORS.navyDeep} />
                  <Text style={styles.resetButtonText}>Reset to Defaults</Text>
                </Pressable>
              </View>

              <View style={styles.exportCard}>
                <Text style={styles.exportTitle}>Export</Text>
                <Text style={styles.exportSubtitle}>Share a PNG image or open a PDF/print flow from this exact web pass layout.</Text>

                <View style={styles.exportActions}>
                  <Pressable
                    style={[styles.exportButton, styles.primaryButton, isExportingPng && styles.exportButtonDisabled]}
                    onPress={handleExportPng}
                    disabled={isExportingPng}
                    testID="seapass-generator.export-png"
                  >
                    {isExportingPng ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Download size={18} color="#FFFFFF" />
                    )}
                    <Text style={styles.primaryButtonText}>Export PNG</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.exportButton, styles.secondaryButton, isExportingPdf && styles.exportButtonDisabled]}
                    onPress={handleExportPdf}
                    disabled={isExportingPdf}
                    testID="seapass-generator.export-pdf"
                  >
                    {isExportingPdf ? (
                      <ActivityIndicator size="small" color={COLORS.navyDeep} />
                    ) : (
                      <FileDown size={18} color={COLORS.navyDeep} />
                    )}
                    <Text style={styles.secondaryButtonText}>{Platform.OS === 'web' ? 'Print / Save PDF' : 'Export / Print PDF'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function SeaPassGeneratorScreenWrapper() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'SeaPass Generator',
            headerStyle: { backgroundColor: '#4F2A95' },
            headerTintColor: '#FFFFFF',
          }}
        />
        <View style={styles.adminGate} testID="seapass-generator.admin-only">
          <View style={styles.adminGateIconWrap}>
            <Shield size={28} color="#5A319F" />
          </View>
          <Text style={styles.adminGateTitle}>Admin Only</Text>
          <Text style={styles.adminGateText}>SeaPass Web Generator is restricted to admin users.</Text>
          <Pressable style={styles.adminGateButton} onPress={() => router.back()} testID="seapass-generator.go-back">
            <Text style={styles.adminGateButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <SeaPassGeneratorScreen />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#EEF2F7',
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  contentGrid: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    gap: SPACING.lg,
  },
  contentGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewPanel: {
    gap: SPACING.md,
  },
  previewPanelWide: {
    flex: 1.02,
  },
  formPanel: {
    gap: SPACING.md,
  },
  formPanelWide: {
    flex: 0.98,
  },
  previewHeaderCard: {
    borderRadius: 28,
    backgroundColor: '#1C2140',
    padding: SPACING.xl,
    flexDirection: 'row',
    gap: SPACING.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },
  previewHeaderIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#5A319F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderTextWrap: {
    flex: 1,
  },
  previewEyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.74)',
    marginBottom: 6,
  },
  previewTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewSubtitle: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.78)',
  },
  previewSurface: {
    borderRadius: 30,
    backgroundColor: '#DCE6F2',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  previewCaptureFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE6F2',
  },
  previewPass: {
    maxWidth: 520,
  },
  hiddenExportStage: {
    position: 'absolute',
    left: -20000,
    top: 0,
  },
  hiddenExportCaptureFrame: {
    width: SEA_PASS_VIEWBOX.width,
    backgroundColor: '#FFFFFF',
  },
  hiddenExportPass: {
    width: SEA_PASS_VIEWBOX.width,
    maxWidth: SEA_PASS_VIEWBOX.width,
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF2',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  formCardHeader: {
    gap: 6,
  },
  formCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#152033',
  },
  formCardSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: '#61708B',
  },
  lockedInfoCard: {
    borderRadius: 18,
    backgroundColor: '#F6F1FF',
    borderWidth: 1,
    borderColor: '#E7D8FF',
    padding: SPACING.md,
    gap: 8,
  },
  lockedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lockedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5A319F',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lockedInfoText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: '#4A5370',
  },
  fieldsGrid: {
    gap: SPACING.md,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#53627C',
  },
  input: {
    height: 54,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D9E1EC',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 16,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#152033',
  },
  resetButton: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: '#D9E1EC',
    backgroundColor: '#F6F8FB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600',
    color: COLORS.navyDeep,
  },
  exportCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EAF2',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  exportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#152033',
  },
  exportSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: '#61708B',
  },
  exportActions: {
    gap: SPACING.sm,
  },
  exportButton: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: SPACING.lg,
  },
  exportButtonDisabled: {
    opacity: 0.72,
  },
  primaryButton: {
    backgroundColor: '#4F2A95',
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#EEF3FB',
    borderWidth: 1,
    borderColor: '#D8E2F0',
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700',
    color: COLORS.navyDeep,
  },
  adminGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: '#EEF2F7',
  },
  adminGateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4ECFF',
    marginBottom: SPACING.lg,
  },
  adminGateTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#172033',
  },
  adminGateText: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSizeMD,
    lineHeight: 24,
    color: '#5E6C86',
    textAlign: 'center',
    maxWidth: 360,
  },
  adminGateButton: {
    marginTop: SPACING.xl,
    minWidth: 180,
    minHeight: 50,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#4F2A95',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  adminGateButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
