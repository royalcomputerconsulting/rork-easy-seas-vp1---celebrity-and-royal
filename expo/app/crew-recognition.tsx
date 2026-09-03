import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Users } from 'lucide-react-native';
import { CrewRecognitionSection } from '@/components/crew-recognition/CrewRecognitionSection';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function CrewRecognitionScreen() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Back to Calendar" testID="crew-recognition-back">
            <ChevronLeft size={22} color="#17324D" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CALENDAR & PEOPLE</Text>
            <Text style={styles.title}>Crew Recognition</Text>
          </View>
          <View style={styles.icon}><Users size={19} color="#FFFFFF" /></View>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ResponsiveContainer>
            <Text style={styles.intro}>Keep crew names, ships, departments, recognition history, survey follow-ups, and imports together under the Calendar experience.</Text>
            <CrewRecognitionSection />
          </ResponsiveContainer>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDF7F6' },
  safe: { flex: 1 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#CFE0E3', backgroundColor: '#FFFFFF' },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4F5' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: '#167C80' },
  title: { marginTop: 2, fontSize: 23, lineHeight: 28, fontWeight: '800', color: '#17324D' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#167C80' },
  content: { padding: 16, paddingBottom: 80 },
  intro: { marginBottom: 14, paddingHorizontal: 2, fontSize: 13, lineHeight: 19, color: '#536575' },
});
