import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { EASY_SEAS_TOKENS as T, SEA_PASS_COLORS, type EasySeasThemeMode } from '@/constants/easySeasDesignSystem';
import { RelationshipFlow } from '@/components/ui/RelationshipFlow';
import { PremiumVoyageArtwork } from '@/components/ui/PremiumVoyageArtwork';
import { useExperience } from '@/state/ExperienceProvider';

const themes: EasySeasThemeMode[] = ['system', 'light', 'dark', 'high-contrast'];

export default function ExperienceSettings() {
  const router = useRouter();
  const { preferences: prefs, colors, textScale, minimumControlSize, updatePreferences } = useExperience();
  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.head}>
      <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Back" style={{ minWidth: minimumControlSize, minHeight: minimumControlSize, justifyContent: 'center' }}><ArrowLeft color={T.color.deepNavy} /></TouchableOpacity>
      <View><Text style={s.eyebrow}>APPEARANCE & ACCESSIBILITY</Text><Text style={[s.title, { fontSize: 21 * textScale }]}>Easy Seas Experience</Text></View>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      <PremiumVoyageArtwork ship="Easy Seas" destination="Premium voyage context" kind="ship" />
      <Text style={[s.section, { color: colors.accent, fontSize: 14 * textScale }]}>Theme</Text>
      <View style={s.rowWrap}>{themes.map((theme) => <TouchableOpacity key={theme} onPress={() => void updatePreferences({ theme })} style={[s.choice, { minHeight: minimumControlSize, backgroundColor: colors.surface, borderColor: colors.border }, prefs.theme === theme && s.choiceOn]} accessibilityRole="radio" accessibilityState={{ selected: prefs.theme === theme }}><Text style={[s.choiceText, { color: colors.text, fontSize: 14 * textScale }, prefs.theme === theme && s.choiceTextOn]}>{theme}</Text></TouchableOpacity>)}</View>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Setting label="Reduced motion" value={prefs.reducedMotion} onChange={(reducedMotion) => void updatePreferences({ reducedMotion })} />
        <Setting label="Larger controls" value={prefs.largeControls} onChange={(largeControls) => void updatePreferences({ largeControls })} />
        <Setting label="Simplified information density" value={prefs.density === 'simplified'} onChange={(value) => void updatePreferences({ density: value ? 'simplified' : 'comfortable' })} />
        <Setting label="Extra-large text" value={prefs.textScale === 'extra-large'} onChange={(value) => void updatePreferences({ textScale: value ? 'extra-large' : 'system' })} />
        <Setting label="Color-blind-safe charts" value={prefs.chartMode === 'color-blind-safe'} onChange={(value) => void updatePreferences({ chartMode: value ? 'color-blind-safe' : 'tier' })} />
      </View>
      <Text style={[s.section, { color: colors.accent, fontSize: 14 * textScale }]}>Tier palette</Text>
      <View style={s.palette}>{Object.values(SEA_PASS_COLORS).flatMap((group) => Object.values(group)).map((color, index) => <View key={`${color}-${index}`} style={[s.swatch, { backgroundColor: color }]} accessibilityLabel={`Tier color ${color}`} />)}</View>
      <Text style={[s.section, { color: colors.accent, fontSize: 14 * textScale }]}>Evidence relationship preview</Text>
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><RelationshipFlow nodes={[{ id: 'play', label: 'Casino play', value: '6,500 pts', confidence: 'exact' }, { id: 'cert', label: 'Certificate', value: 'A03', confidence: 'inferred' }, { id: 'sailing', label: 'Eligible sailing', confidence: 'exact' }, { id: 'booking', label: 'Booked value', confidence: 'estimated' }]} /></View>
      <View style={s.success}><CheckCircle2 color={T.color.success} /><Text style={s.successText}>Original Easy Seas logos, signature graphics, tab count, tab order, and working actions are not replaced by these preferences.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function Setting({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors, textScale, minimumControlSize } = useExperience();
  return <View style={[s.setting, { minHeight: Math.max(52, minimumControlSize), borderBottomColor: colors.border }]}><Text style={[s.settingText, { color: colors.text, fontSize: 15 * textScale }]}>{label}</Text><Switch value={value} onValueChange={onChange} accessibilityLabel={label} /></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 }, head: { backgroundColor: T.color.surface, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: T.color.border }, eyebrow: { color: '#0E7FA7', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: T.color.deepNavy, fontWeight: '900' }, content: { padding: 16, paddingBottom: 50 }, section: { fontWeight: '900', marginTop: 19, marginBottom: 9 }, rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { justifyContent: 'center', paddingHorizontal: 13, borderRadius: T.radius.pill, borderWidth: 1 }, choiceOn: { backgroundColor: T.color.navy }, choiceText: { textTransform: 'capitalize', fontWeight: '800' }, choiceTextOn: { color: '#FFFFFF' }, card: { borderRadius: T.radius.lg, borderWidth: 1, padding: 14 }, setting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 }, settingText: { fontWeight: '700', flex: 1 }, palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, swatch: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#FFFFFF' }, success: { backgroundColor: '#E5F4EF', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, marginTop: 18 }, successText: { flex: 1, color: '#225B4C', lineHeight: 18, fontWeight: '600' },
});
