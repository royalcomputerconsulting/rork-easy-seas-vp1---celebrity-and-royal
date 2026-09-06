import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, RotateCcw } from 'lucide-react-native';
import { DARK_ROYAL_COLORS as CASINO_DASHBOARD_COLORS, darkRoyalDashboardStyles as casinoDashboardStyles } from '@/constants/darkRoyalTheme';
import { useCasinoSettings, type CasinoViewMode } from '@/state/CasinoSettingsProvider';

const VIEW_MODES: { key: CasinoViewMode; label: string; hint: string }[] = [
  { key: 'combined', label: 'Combined', hint: 'Show every number, actual and estimated together (default).' },
  { key: 'actual-only', label: 'Actual Only', hint: 'Hide estimated/generated figures; show only confirmed real records.' },
  { key: 'estimated-only', label: 'Estimated Only', hint: 'Show only estimated/projected figures, useful for planning.' },
];

function NumberField({ label, hint, value, onChange, suffix }: { label: string; hint: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  const [text, setText] = useState(String(value));
  return (
    <View style={styles.fieldRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldHint}>{hint}</Text>
      </View>
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => {
            const parsed = parseFloat(text);
            if (!Number.isNaN(parsed)) {
              onChange(parsed);
              setText(String(parsed));
            } else {
              setText(String(value));
            }
          }}
          keyboardType="decimal-pad"
          style={styles.fieldInput}
          testID={`casino-settings-input-${label}`}
        />
        {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

export default function CasinoSettingsScreen() {
  const router = useRouter();
  const { settings, viewMode, updateSettings, resetSettings, setViewMode } = useCasinoSettings();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="casino-settings-back">
          <ChevronLeft size={22} color={CASINO_DASHBOARD_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={casinoDashboardStyles.screenTitle}>Casino Settings</Text>
        <TouchableOpacity onPress={() => resetSettings()} style={styles.resetButton} testID="casino-settings-reset">
          <RotateCcw size={16} color={CASINO_DASHBOARD_COLORS.textSecondary} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Data View</Text>
        <View style={[casinoDashboardStyles.card, { marginBottom: 20 }]}>
          {VIEW_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              style={styles.viewModeRow}
              activeOpacity={0.75}
              onPress={() => setViewMode(mode.key)}
              testID={`casino-view-mode-${mode.key}`}
            >
              <View style={[styles.radioOuter, viewMode === mode.key && styles.radioOuterActive]}>
                {viewMode === mode.key ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>{mode.label}</Text>
                <Text style={styles.fieldHint}>{mode.hint}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Assumptions Used In Calculations</Text>
        <View style={casinoDashboardStyles.card}>
          <NumberField
            label="Point Dollar Value"
            hint="Estimated dollar value assigned to each Club Royale point."
            value={settings.pointDollarValue}
            onChange={(v) => updateSettings({ pointDollarValue: v })}
            suffix="$/pt"
          />
          <NumberField
            label="VOOM Daily Price"
            hint="Default internet package price per day, per device."
            value={settings.voomDailyPrice}
            onChange={(v) => updateSettings({ voomDailyPrice: v })}
            suffix="$/day"
          />
          <NumberField
            label="VOOM Device Count"
            hint="Default number of devices connected per cruise."
            value={settings.voomDeviceCount}
            onChange={(v) => updateSettings({ voomDeviceCount: v })}
          />
          <NumberField
            label="Default Points Per Hour"
            hint="Used to estimate play hours when no session data exists."
            value={settings.defaultPointsPerHour}
            onChange={(v) => updateSettings({ defaultPointsPerHour: v })}
            suffix="pts/hr"
          />
          <NumberField
            label="Default Casino Hours/Day"
            hint="Assumed casino play hours per casino-open day."
            value={settings.defaultCasinoHoursPerDay}
            onChange={(v) => updateSettings({ defaultCasinoHoursPerDay: v })}
            suffix="hrs"
          />
          <NumberField
            label="Default House Edge"
            hint="Used for theoretical-loss and risk calculations."
            value={settings.defaultHouseEdge}
            onChange={(v) => updateSettings({ defaultHouseEdge: v })}
            suffix="(0-1)"
          />
          <NumberField
            label="Default Stop-Loss"
            hint="Suggested per-session stop-loss amount for planning tools."
            value={settings.defaultStopLoss}
            onChange={(v) => updateSettings({ defaultStopLoss: v })}
            suffix="$"
          />
          <NumberField
            label="Signature $75 OBC Amount"
            hint="Per-eligible-cruise onboard credit amount."
            value={settings.signatureObcAmount}
            onChange={(v) => updateSettings({ signatureObcAmount: v })}
            suffix="$"
          />
        </View>

        <View style={[casinoDashboardStyles.card, styles.switchCard]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.fieldLabel}>Count FreePlay In Total Value</Text>
            <Text style={styles.fieldHint}>When off, FreePlay is shown as informational only and excluded from totals.</Text>
          </View>
          <Switch
            value={settings.countFreePlayInValue}
            onValueChange={(v) => updateSettings({ countFreePlayInValue: v })}
            trackColor={{ true: CASINO_DASHBOARD_COLORS.royalBlue, false: CASINO_DASHBOARD_COLORS.border }}
            testID="casino-settings-freeplay-toggle"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CASINO_DASHBOARD_COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  resetButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  resetText: { color: CASINO_DASHBOARD_COLORS.textSecondary, fontSize: 12.5, fontWeight: '700' as const },
  content: { padding: 16, paddingBottom: 60, gap: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CASINO_DASHBOARD_COLORS.border,
  },
  fieldLabel: { fontSize: 14, fontWeight: '700' as const, color: CASINO_DASHBOARD_COLORS.textPrimary },
  fieldHint: { fontSize: 11.5, color: CASINO_DASHBOARD_COLORS.textSecondary, marginTop: 2, lineHeight: 15 },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldInput: {
    minWidth: 70,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700' as const,
    color: CASINO_DASHBOARD_COLORS.textPrimary,
    borderWidth: 1,
    borderColor: CASINO_DASHBOARD_COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  fieldSuffix: { fontSize: 11, color: CASINO_DASHBOARD_COLORS.textSecondary },
  viewModeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: CASINO_DASHBOARD_COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: CASINO_DASHBOARD_COLORS.royalBlue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: CASINO_DASHBOARD_COLORS.royalBlue },
  switchCard: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
});
