import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Download, ClipboardList } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { trpc } from '@/lib/trpc';
import { exportSurveyToText } from '@/lib/csv-export';
import type { Sailing } from '@/types/crew-recognition';

interface SurveyListModalProps {
  visible: boolean;
  onClose: () => void;
  sailings: Sailing[];
}

export function SurveyListModal({ visible, onClose, sailings }: SurveyListModalProps) {
  const [selectedSailingId, setSelectedSailingId] = useState('');
  const [showSailingPicker, setShowSailingPicker] = useState(false);

  const surveyListQuery = trpc.crewRecognition.getSurveyList.useQuery(
    { sailingId: selectedSailingId },
    {
      enabled: !!selectedSailingId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  const selectedSailing = sailings.find(s => s.id === selectedSailingId);
  const surveyList = surveyListQuery.data || [];

  const handleExport = () => {
    if (surveyList.length === 0 || !selectedSailing) {
      return;
    }

    const filename = `survey-${selectedSailing.shipName.replace(/\s+/g, '-')}-${selectedSailing.sailStartDate}.txt`;

    exportSurveyToText(
      selectedSailing.shipName,
      selectedSailing.sailStartDate,
      surveyList,
      filename
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <ClipboardList size={24} color={COLORS.primary} />
            <Text style={styles.title}>Survey List</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.selector}>
              <Text style={styles.selectorLabel}>Select Sailing</Text>
              <TouchableOpacity
                style={styles.selectorPicker}
                onPress={() => setShowSailingPicker(!showSailingPicker)}
              >
                <Text
                  style={
                    selectedSailingId
                      ? styles.selectorPickerText
                      : styles.selectorPickerPlaceholder
                  }
                >
                  {selectedSailing
                    ? `${selectedSailing.shipName} - ${selectedSailing.sailStartDate}`
                    : 'Choose a sailing'}
                </Text>
              </TouchableOpacity>
              {showSailingPicker && (
                <ScrollView style={styles.pickerOptions} nestedScrollEnabled>
                  {sailings.map(sailing => (
                    <TouchableOpacity
                      key={sailing.id}
                      style={styles.pickerOption}
                      onPress={() => {
                        setSelectedSailingId(sailing.id);
                        setShowSailingPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>
                        {sailing.shipName} - {sailing.sailStartDate} to {sailing.sailEndDate}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {selectedSailingId && (
              <>
                <View style={styles.actions}>
                  <Text style={styles.countText}>
                    {surveyList.length} crew member{surveyList.length !== 1 ? 's' : ''}
                  </Text>
                  <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                    <Download size={16} color="#fff" />
                    <Text style={styles.exportButtonText}>Export Survey</Text>
                  </TouchableOpacity>
                </View>

                {surveyListQuery.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                ) : surveyList.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <ClipboardList size={48} color={COLORS.textTertiary} />
                    <Text style={styles.emptyText}>No crew members found</Text>
                    <Text style={styles.emptySubtext}>
                      Add recognition entries for this sailing
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.list}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.nameColumn]}>Name</Text>
                      <Text style={[styles.tableHeaderCell, styles.deptColumn]}>Department</Text>
                      <Text style={[styles.tableHeaderCell, styles.roleColumn]}>Role</Text>
                      <Text style={[styles.tableHeaderCell, styles.countColumn]}>Mentions</Text>
                    </View>
                    {surveyList.map((item, index) => (
                      <View
                        key={`${item.fullName}-${index}`}
                        style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}
                      >
                        <Text style={[styles.tableCell, styles.nameColumn]}>
                          {item.fullName}
                        </Text>
                        <Text style={[styles.tableCell, styles.deptColumn]}>
                          {item.department}
                        </Text>
                        <Text style={[styles.tableCell, styles.roleColumn]}>
                          {item.roleTitle || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCell, styles.countColumn]}>
                          {item.mentionCount}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
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
    maxWidth: 700,
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
    padding: SPACING.lg,
  },
  selector: {
    marginBottom: SPACING.lg,
  },
  selectorLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  selectorPicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: '#fff',
  },
  selectorPickerText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.text,
  },
  selectorPickerPlaceholder: {
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
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  countText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  list: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    maxHeight: 400,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  tableHeaderCell: {
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowEven: {
    backgroundColor: COLORS.bgSecondary,
  },
  tableCell: {
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.text,
  },
  nameColumn: {
    flex: 2,
  },
  deptColumn: {
    flex: 1.5,
  },
  roleColumn: {
    flex: 1.5,
  },
  countColumn: {
    flex: 0.8,
  },
});
