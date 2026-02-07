import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, X } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';

export default function EditMachineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getMachineById, updateMachine } = useSlotMachineLibrary();

  const machine = getMachineById(id as string);

  const [userNotes, setUserNotes] = useState(machine?.userNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!machine) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Machine not found</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <X color={COLORS.white} size={20} strokeWidth={2} />
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateMachine(machine.id, { userNotes });
      if (Platform.OS === 'web') {
        alert('Machine updated successfully!');
      } else {
        Alert.alert('Success', 'Machine updated successfully!');
      }
      router.back();
    } catch (error) {
      console.error('Error saving machine:', error);
      if (Platform.OS === 'web') {
        alert('Failed to save machine. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save machine. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Machine',
          headerShown: true,
          headerBackTitle: 'Cancel',
          headerTitleStyle: {
            fontWeight: '700' as const,
            fontSize: 18,
          },
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{machine.machineName}</Text>
            <Text style={styles.subtitle}>{machine.manufacturer}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Notes</Text>
            <Text style={styles.helperText}>
              Add your personal notes, observations, and strategies for this machine.
            </Text>
            <TextInput
              style={styles.textArea}
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder="Enter your notes here..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Note: You can only edit your personal notes. Machine details from the
              global library cannot be modified.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <X color={COLORS.textDarkGrey} size={20} strokeWidth={2} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <Save color={COLORS.white} size={20} strokeWidth={2} />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 110,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: COLORS.navyDeep,
    minHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoBox: {
    backgroundColor: '#E8F8F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.money,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.navyDeep,
    lineHeight: 20,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.bgSecondary,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.textDarkGrey,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navyDeep,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
