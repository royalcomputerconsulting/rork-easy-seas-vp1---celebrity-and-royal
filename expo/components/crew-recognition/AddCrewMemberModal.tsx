import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { X, User, Anchor, FileText, Upload, Users, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { DEPARTMENTS, type Department } from '@/types/crew-recognition';
import type { Sailing } from '@/types/crew-recognition';
import type { BookedCruise } from '@/types/models';

interface AddCrewMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fullName: string;
    department: string;
    roleTitle?: string;
    notes?: string;
    sailingId?: string;
  }) => Promise<void>;
  onEnsureSailing: (data: {
    shipName: string;
    sailStartDate: string;
    sailEndDate: string;
    nights?: number;
  }) => Promise<string>;
  sailings: Sailing[];
  bookedCruises?: BookedCruise[];
}

type EntryMode = 'single' | 'batch';

interface ParsedCrewMember {
  fullName: string;
  department: Department;
  roleTitle?: string;
  notes?: string;
}

function findCurrentAboardSailing(sailings: Sailing[], bookedCruises: BookedCruise[]): Sailing | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const sailing of sailings) {
    const start = new Date(`${sailing.sailStartDate}T00:00:00`);
    const end = new Date(`${sailing.sailEndDate}T23:59:59`);
    if (today >= start && today <= end) {
      return sailing;
    }
  }

  for (const cruise of bookedCruises) {
    if (!cruise.sailDate || !cruise.returnDate) continue;
    const start = new Date(`${cruise.sailDate}T00:00:00`);
    const end = new Date(`${cruise.returnDate}T23:59:59`);
    if (today >= start && today <= end) {
      const matchingSailing = sailings.find(
        (s) => s.shipName === cruise.shipName && s.sailStartDate === cruise.sailDate,
      );
      if (matchingSailing) return matchingSailing;
    }
  }

  return null;
}

function normalizeShipName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseHeaderLine(line: string): { shipName: string; startMonth: number; startDay: number } | null {
  const trimmedLine = line.trim();
  const match = trimmedLine.match(/^(.*?)\s+(\d{1,2})\/(\d{1,2})(?:\s*-\s*(?:(\d{1,2})\/)?(\d{1,2}))?$/);
  if (!match) {
    return null;
  }

  const shipName = match[1]?.trim() ?? '';
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);

  if (!shipName || Number.isNaN(startMonth) || Number.isNaN(startDay)) {
    return null;
  }

  return { shipName, startMonth, startDay };
}

function findSailingFromHeader(headerLine: string, sailings: Sailing[]): Sailing | null {
  const parsedHeader = parseHeaderLine(headerLine);
  if (!parsedHeader) {
    return null;
  }

  const normalizedHeaderShip = normalizeShipName(parsedHeader.shipName);

  return sailings.find((sailing) => {
    const normalizedSailingShip = normalizeShipName(sailing.shipName);
    const shipMatch =
      normalizedSailingShip.includes(normalizedHeaderShip) ||
      normalizedHeaderShip.includes(normalizedSailingShip);

    if (!shipMatch) {
      return false;
    }

    const sailingDate = new Date(`${sailing.sailStartDate}T00:00:00`);
    return (
      sailingDate.getMonth() + 1 === parsedHeader.startMonth &&
      sailingDate.getDate() === parsedHeader.startDay
    );
  }) ?? null;
}

function findBookedCruiseFromHeader(headerLine: string, bookedCruises: BookedCruise[]): BookedCruise | null {
  const parsedHeader = parseHeaderLine(headerLine);
  if (!parsedHeader) {
    return null;
  }

  const normalizedHeaderShip = normalizeShipName(parsedHeader.shipName);

  return bookedCruises.find((cruise) => {
    if (!cruise.shipName || !cruise.sailDate) {
      return false;
    }

    const normalizedCruiseShip = normalizeShipName(cruise.shipName);
    const shipMatch =
      normalizedCruiseShip.includes(normalizedHeaderShip) ||
      normalizedHeaderShip.includes(normalizedCruiseShip);

    if (!shipMatch) {
      return false;
    }

    const sailDate = new Date(`${cruise.sailDate}T00:00:00`);
    return sailDate.getMonth() + 1 === parsedHeader.startMonth && sailDate.getDate() === parsedHeader.startDay;
  }) ?? null;
}

function inferDepartmentFromText(details: string): Department {
  const normalized = details.toLowerCase();

  if (normalized.includes('casino') || normalized.includes('dealer') || normalized.includes('host')) return 'Casino';
  if (normalized.includes('waiter') || normalized.includes('restaurant') || normalized.includes('dining') || normalized.includes('cafe') || normalized.includes('table')) return 'Dining';
  if (normalized.includes('stateroom') || normalized.includes('housekeeping') || normalized.includes('attendant')) return 'Housekeeping';
  if (normalized.includes('guest relation') || normalized.includes('front desk')) return 'Guest Relations';
  if (normalized.includes('activity') || normalized.includes('activities')) return 'Activities';
  if (normalized.includes('spa')) return 'Spa';
  if (normalized.includes('retail') || normalized.includes('shop')) return 'Retail';
  if (normalized.includes('bar') || normalized.includes('beverage') || normalized.includes('drink')) return 'Beverage';
  if (normalized.includes('loyalty') || normalized.includes('nextcruise')) return 'Loyalty';
  if (normalized.includes('public area') || normalized.includes('cleaner') || normalized.includes('sanitation')) return 'Public Areas';

  return 'Other';
}

function looksLikeCrewName(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue || /\d/.test(trimmedValue) || trimmedValue.includes('#')) {
    return false;
  }

  const normalized = trimmedValue
    .replace(/[’']/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  return /^[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2}$/.test(normalized);
}

function isLikelyRoleDescriptor(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return (
    normalized.includes('#') ||
    /attendant|waiter|assistant|restaurant|cafe|bar|server|activities|activity|cleaner|housekeeping|public area|casino|dining|lounge|guest relations|host|table|park cafe|sabor|central park|mytime/.test(normalized)
  );
}

function buildParsedCrewMember(fullName: string, detailText: string): ParsedCrewMember | null {
  const normalizedName = fullName.trim();
  if (!normalizedName) {
    return null;
  }

  const normalizedDetails = detailText.trim();
  return {
    fullName: normalizedName,
    department: inferDepartmentFromText(normalizedDetails),
    roleTitle: normalizedDetails || undefined,
    notes: normalizedDetails || undefined,
  };
}

function parseCrewMemberLine(line: string): ParsedCrewMember[] {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return [];
  }

  const parts = trimmedLine.split('-').map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return [];
  }

  if (parts.length > 1) {
    const lastSegment = parts[parts.length - 1] ?? '';
    const leadingSegments = parts.slice(0, -1);

    if (isLikelyRoleDescriptor(lastSegment) && leadingSegments.every(looksLikeCrewName)) {
      return leadingSegments
        .map((name) => buildParsedCrewMember(name, lastSegment))
        .filter((member): member is ParsedCrewMember => member !== null);
    }

    if (parts.every(looksLikeCrewName)) {
      return parts
        .map((name) => buildParsedCrewMember(name, ''))
        .filter((member): member is ParsedCrewMember => member !== null);
    }
  }

  const [firstSegment, ...remainingSegments] = parts;
  const parsedMember = buildParsedCrewMember(firstSegment ?? '', remainingSegments.join(' - '));
  return parsedMember ? [parsedMember] : [];
}

async function readTextFile(): Promise<{ content: string; fileName: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'text/csv'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  console.log('[AddCrewMember] Selected crew import file:', asset.name, asset.uri);

  let content = '';
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    content = await response.text();
  } else {
    content = await FileSystem.readAsStringAsync(asset.uri);
  }

  return {
    content,
    fileName: asset.name,
  };
}

export function AddCrewMemberModal({ visible, onClose, onSubmit, onEnsureSailing, sailings, bookedCruises = [] }: AddCrewMemberModalProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('single');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [roleTitle, setRoleTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [importedFileName, setImportedFileName] = useState<string>('');
  const [sailingId, setSailingId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [showSailingPicker, setShowSailingPicker] = useState(false);
  const [autoLinked, setAutoLinked] = useState(false);

  const currentAboardSailing = useMemo(
    () => findCurrentAboardSailing(sailings, bookedCruises),
    [sailings, bookedCruises],
  );

  const batchLines = useMemo(() => {
    return bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [bulkText]);

  const batchHeaderLine = batchLines[0] ?? '';

  const parsedBatchMembers = useMemo(() => {
    if (entryMode !== 'batch') {
      return [];
    }

    return batchLines.slice(1).flatMap((line) => parseCrewMemberLine(line));
  }, [batchLines, entryMode]);

  const matchedBatchSailing = useMemo(() => {
    if (entryMode !== 'batch' || !batchHeaderLine) {
      return null;
    }

    return findSailingFromHeader(batchHeaderLine, sailings);
  }, [batchHeaderLine, entryMode, sailings]);

  const matchedBatchCruise = useMemo(() => {
    if (entryMode !== 'batch' || !batchHeaderLine) {
      return null;
    }

    return findBookedCruiseFromHeader(batchHeaderLine, bookedCruises);
  }, [batchHeaderLine, bookedCruises, entryMode]);

  const selectedSailing = useMemo(() => {
    return sailings.find((s) => s.id === sailingId) ?? null;
  }, [sailingId, sailings]);

  useEffect(() => {
    if (visible && currentAboardSailing && sailingId === '' && entryMode === 'single') {
      console.log('[AddCrewMember] Auto-linking to current sailing:', currentAboardSailing.shipName, currentAboardSailing.sailStartDate);
      setSailingId(currentAboardSailing.id);
      setAutoLinked(true);
    }
  }, [visible, currentAboardSailing, sailingId, entryMode]);

  useEffect(() => {
    if (entryMode !== 'batch' || !matchedBatchSailing) {
      return;
    }

    console.log('[AddCrewMember] Auto-matched batch import sailing:', matchedBatchSailing.shipName, matchedBatchSailing.sailStartDate);
    setSailingId(matchedBatchSailing.id);
    setAutoLinked(true);
  }, [entryMode, matchedBatchSailing]);

  const resetForm = useCallback(() => {
    setEntryMode('single');
    setFullName('');
    setDepartment('');
    setRoleTitle('');
    setNotes('');
    setBulkText('');
    setImportedFileName('');
    setSailingId('');
    setAutoLinked(false);
    setShowDepartmentPicker(false);
    setShowSailingPicker(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleFileImport = useCallback(async () => {
    setIsImportingFile(true);
    try {
      const fileResult = await readTextFile();
      if (!fileResult) {
        return;
      }

      console.log('[AddCrewMember] Crew file imported:', fileResult.fileName, 'chars:', fileResult.content.length);
      setEntryMode('batch');
      setBulkText(fileResult.content);
      setImportedFileName(fileResult.fileName);
    } catch (error) {
      console.error('[AddCrewMember] Failed to import crew file:', error);
      Alert.alert('Import failed', 'Unable to read that text file. Please try another file.');
    } finally {
      setIsImportingFile(false);
    }
  }, []);

  const handleSingleSubmit = useCallback(async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter a full name');
      return;
    }

    if (!department) {
      Alert.alert('Error', 'Please select a department');
      return;
    }

    await onSubmit({
      fullName: fullName.trim(),
      department,
      roleTitle: roleTitle.trim() || undefined,
      notes: notes.trim() || undefined,
      sailingId: sailingId || undefined,
    });
  }, [department, fullName, notes, onSubmit, roleTitle, sailingId]);

  const handleBatchSubmit = useCallback(async () => {
    if (batchLines.length < 2) {
      Alert.alert('Error', 'Paste a crew list with the sailing header on the first line and at least one crew member below it.');
      return;
    }

    if (!parseHeaderLine(batchHeaderLine)) {
      Alert.alert('Missing sailing header', 'The first line must contain the ship and sailing date, for example: Harmony 3/1-8');
      return;
    }

    let resolvedSailingId = matchedBatchSailing?.id ?? sailingId;
    if (!resolvedSailingId && matchedBatchCruise?.shipName && matchedBatchCruise.sailDate && matchedBatchCruise.returnDate) {
      resolvedSailingId = await onEnsureSailing({
        shipName: matchedBatchCruise.shipName,
        sailStartDate: matchedBatchCruise.sailDate,
        sailEndDate: matchedBatchCruise.returnDate,
        nights: matchedBatchCruise.nights,
      });
      setSailingId(resolvedSailingId);
      setAutoLinked(true);
    }

    if (!resolvedSailingId) {
      Alert.alert('Sailing not found', 'The first line must match one of your sailings, or select the sailing manually before importing.');
      return;
    }

    if (parsedBatchMembers.length === 0) {
      Alert.alert('Error', 'No valid crew member lines were found below the sailing header.');
      return;
    }

    console.log('[AddCrewMember] Importing batch crew list:', {
      count: parsedBatchMembers.length,
      sailingId: resolvedSailingId,
      importedFileName,
    });

    for (const member of parsedBatchMembers) {
      await onSubmit({
        fullName: member.fullName,
        department: member.department,
        roleTitle: member.roleTitle,
        notes: member.notes,
        sailingId: resolvedSailingId,
      });
    }

    Alert.alert('Crew imported', `${parsedBatchMembers.length} crew member${parsedBatchMembers.length === 1 ? '' : 's'} added to this sailing.`);
  }, [batchHeaderLine, batchLines.length, importedFileName, matchedBatchCruise, matchedBatchSailing?.id, onEnsureSailing, onSubmit, parsedBatchMembers, sailingId]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      if (entryMode === 'single') {
        await handleSingleSubmit();
      } else {
        await handleBatchSubmit();
      }
      handleClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add crew member';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [entryMode, handleBatchSubmit, handleClose, handleSingleSubmit]);

  const batchPreviewCount = parsedBatchMembers.length;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <User size={24} color={COLORS.primary} />
            <Text style={styles.title}>Add Crew Member</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} testID="close-add-crew-modal">
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeButton, entryMode === 'single' && styles.modeButtonActive]}
                onPress={() => setEntryMode('single')}
                activeOpacity={0.8}
                testID="crew-mode-single"
              >
                <User size={16} color={entryMode === 'single' ? COLORS.white : COLORS.primary} />
                <Text style={[styles.modeButtonText, entryMode === 'single' && styles.modeButtonTextActive]}>One person</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, entryMode === 'batch' && styles.modeButtonActive]}
                onPress={() => setEntryMode('batch')}
                activeOpacity={0.8}
                testID="crew-mode-batch"
              >
                <Users size={16} color={entryMode === 'batch' ? COLORS.white : COLORS.primary} />
                <Text style={[styles.modeButtonText, entryMode === 'batch' && styles.modeButtonTextActive]}>Paste list</Text>
              </TouchableOpacity>
            </View>

            {entryMode === 'single' ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter full name"
                    placeholderTextColor={COLORS.textTertiary}
                    testID="crew-full-name-input"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Department *</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => setShowDepartmentPicker((prev) => !prev)}
                    activeOpacity={0.8}
                    testID="crew-department-picker"
                  >
                    <Text style={department ? styles.pickerText : styles.pickerPlaceholder}>
                      {department || 'Select department'}
                    </Text>
                  </TouchableOpacity>
                  {showDepartmentPicker ? (
                    <View style={styles.pickerOptions}>
                      {DEPARTMENTS.map((dept) => (
                        <TouchableOpacity
                          key={dept}
                          style={styles.pickerOption}
                          onPress={() => {
                            setDepartment(dept);
                            setShowDepartmentPicker(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.pickerOptionText}>{dept}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Role Title</Text>
                  <TextInput
                    style={styles.input}
                    value={roleTitle}
                    onChangeText={setRoleTitle}
                    placeholder="e.g., Stateroom attendant"
                    placeholderTextColor={COLORS.textTertiary}
                    testID="crew-role-input"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Additional notes"
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    numberOfLines={3}
                    testID="crew-notes-input"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.batchHelpCard}>
                  <View style={styles.batchHelpHeader}>
                    <FileText size={16} color="#0369A1" />
                    <Text style={styles.batchHelpTitle}>Paste a sailing list or import a text file</Text>
                  </View>
                  <Text style={styles.batchHelpText}>
                    First line: ship and sailing date. Example: Harmony 3/1-8{`\n`}
                    Following lines: Name - role / notes. You can also put several names on one line and end with the shared role.
                  </Text>
                  <TouchableOpacity
                    style={[styles.fileImportButton, isImportingFile && styles.fileImportButtonDisabled]}
                    onPress={() => void handleFileImport()}
                    disabled={isImportingFile}
                    activeOpacity={0.8}
                    testID="crew-import-file"
                  >
                    {isImportingFile ? (
                      <ActivityIndicator size="small" color="#0369A1" />
                    ) : (
                      <Upload size={16} color="#0369A1" />
                    )}
                    <Text style={styles.fileImportButtonText}>{importedFileName || 'Import text file'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Crew List *</Text>
                  <TextInput
                    style={[styles.input, styles.batchTextArea]}
                    value={bulkText}
                    onChangeText={setBulkText}
                    placeholder={"Harmony 3/1-8\nRidwan - stateroom attendant #8572\nPudji - stateroom attendant\nAimee - Apple - Novita - Angelo - Arta - pitawa - park cafe"}
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    textAlignVertical="top"
                    testID="crew-bulk-input"
                  />
                  <Text style={styles.batchFooterText}>
                    {batchPreviewCount} crew member{batchPreviewCount === 1 ? '' : 's'} ready to import
                  </Text>
                </View>
                {matchedBatchCruise && !matchedBatchSailing ? (
                  <View style={styles.autoLinkedBadge}>
                    <Ship size={12} color="#0369A1" />
                    <Text style={styles.autoLinkedText}>
                      Header matched your booked cruise for {matchedBatchCruise.shipName}. The sailing will be created and linked automatically when you import.
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>{entryMode === 'batch' ? 'Matched Sailing *' : 'Link to Sailing (Optional)'}</Text>
              {autoLinked && selectedSailing ? (
                <View style={styles.autoLinkedBadge}>
                  <Anchor size={12} color="#0369A1" />
                  <Text style={styles.autoLinkedText}>
                    {entryMode === 'batch' ? 'Matched from header and linked to this sailing' : 'Auto-linked — currently aboard this sailing'}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.picker, autoLinked && selectedSailing && styles.pickerAutoLinked]}
                onPress={() => {
                  setShowSailingPicker((prev) => !prev);
                  setAutoLinked(false);
                }}
                activeOpacity={0.8}
                testID="crew-sailing-picker"
              >
                <Text style={sailingId ? styles.pickerText : styles.pickerPlaceholder}>
                  {selectedSailing
                    ? `${selectedSailing.shipName} - ${selectedSailing.sailStartDate}`
                    : entryMode === 'batch'
                      ? 'Select sailing or paste a matching header'
                      : 'Select sailing'}
                </Text>
              </TouchableOpacity>
              {showSailingPicker ? (
                <ScrollView style={styles.pickerOptions} nestedScrollEnabled>
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      setSailingId('');
                      setShowSailingPicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pickerOptionText}>None</Text>
                  </TouchableOpacity>
                  {sailings.map((sailing) => (
                    <TouchableOpacity
                      key={sailing.id}
                      style={styles.pickerOption}
                      onPress={() => {
                        setSailingId(sailing.id);
                        setShowSailingPicker(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pickerOptionText}>
                        {sailing.shipName} - {sailing.sailStartDate}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={isSubmitting}
              activeOpacity={0.8}
              testID="submit-add-crew"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{entryMode === 'single' ? 'Add Crew Member' : 'Import Crew List'}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
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
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  contentContainer: {
    paddingVertical: SPACING.lg,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    backgroundColor: 'rgba(3, 105, 161, 0.06)',
  },
  modeButtonActive: {
    backgroundColor: '#0369A1',
    borderColor: '#0369A1',
  },
  modeButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: '#0369A1',
  },
  modeButtonTextActive: {
    color: COLORS.white,
  },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  batchTextArea: {
    minHeight: 180,
  },
  picker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  pickerPlaceholder: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textTertiary,
  },
  pickerOptions: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 200,
    backgroundColor: '#fff',
  },
  pickerOption: {
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
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
    padding: SPACING.sm,
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
  submitButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: '#fff',
  },
  autoLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  autoLinkedText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#0369A1',
    flex: 1,
  },
  pickerAutoLinked: {
    borderColor: '#0369A1',
    backgroundColor: 'rgba(3, 105, 161, 0.04)',
  },
  batchHelpCard: {
    backgroundColor: 'rgba(3, 105, 161, 0.06)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.14)',
    gap: SPACING.sm,
  },
  batchHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  batchHelpTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.text,
    flex: 1,
  },
  batchHelpText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  fileImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.22)',
  },
  fileImportButtonDisabled: {
    opacity: 0.6,
  },
  fileImportButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: '#0369A1',
  },
  batchFooterText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
