import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  FileText,
  Plus,
  X,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { formatCurrency } from '@/lib/format';

export interface W2GRecord {
  id: string;
  date: string;
  amount: number;
  withheld: number;
  description: string;
  cruiseId?: string;
  cruiseName?: string;
  createdAt: string;
}

interface W2GTrackerProps {
  records: W2GRecord[];
  onAddRecord: (record: Omit<W2GRecord, 'id' | 'createdAt'>) => void;
  onRemoveRecord: (id: string) => void;
}

export function W2GTracker({ records, onAddRecord, onRemoveRecord }: W2GTrackerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAmount, setNewAmount] = useState('');
  const [newWithheld, setNewWithheld] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCruiseName, setNewCruiseName] = useState('');

  const totalWinnings = records.reduce((sum, record) => sum + record.amount, 0);
  const totalWithheld = records.reduce((sum, record) => sum + record.withheld, 0);

  const handleAddRecord = () => {
    const amount = parseFloat(newAmount);
    const withheld = parseFloat(newWithheld);

    if (isNaN(amount) || amount <= 0) return;

    onAddRecord({
      date: newDate,
      amount,
      withheld: isNaN(withheld) ? 0 : withheld,
      description: newDescription.trim() || 'Slot Machine Jackpot',
      cruiseName: newCruiseName.trim() || undefined,
    });

    setNewAmount('');
    setNewWithheld('');
    setNewDescription('');
    setNewCruiseName('');
    setShowAddModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <LinearGradient
        colors={MARBLE_TEXTURES.lightBlue.gradientColors}
        locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
        style={styles.container}
      >
        <View style={styles.header}>
          <FileText size={20} color={COLORS.navyDeep} />
          <Text style={styles.title}>W-2G Tax Tracker</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Reportable</Text>
              <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                {formatCurrency(totalWinnings)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Withheld</Text>
              <Text style={[styles.summaryValue, { color: COLORS.error }]}>
                {formatCurrency(totalWithheld)}
              </Text>
            </View>
          </View>
          <View style={styles.infoBox}>
            <AlertCircle size={14} color={COLORS.warning} />
            <Text style={styles.infoText}>
              Track W-2G forms ($1,200+ slot wins, $1,500+ keno, $5,000+ poker)
            </Text>
          </View>
        </View>

        {records.length > 0 && (
          <ScrollView style={styles.recordsList} showsVerticalScrollIndicator={false}>
            {records
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((record) => (
                <View key={record.id} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <View style={styles.recordDateContainer}>
                      <Calendar size={14} color={COLORS.navyDeep} />
                      <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onRemoveRecord(record.id)}
                      style={styles.removeButton}
                      activeOpacity={0.7}
                    >
                      <X size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.recordDescription}>{record.description}</Text>
                  {record.cruiseName && (
                    <Text style={styles.recordCruise}>{record.cruiseName}</Text>
                  )}

                  <View style={styles.recordAmounts}>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Winnings</Text>
                      <Text style={[styles.amountValue, { color: COLORS.success }]}>
                        {formatCurrency(record.amount)}
                      </Text>
                    </View>
                    {record.withheld > 0 && (
                      <>
                        <View style={styles.amountDivider} />
                        <View style={styles.amountItem}>
                          <Text style={styles.amountLabel}>Withheld</Text>
                          <Text style={[styles.amountValue, { color: COLORS.error }]}>
                            {formatCurrency(record.withheld)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              ))}
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Plus size={18} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add W-2G Record</Text>
        </TouchableOpacity>

        {records.length === 0 && (
          <View style={styles.emptyState}>
            <FileText size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No W-2G records yet</Text>
            <Text style={styles.emptySubtext}>Add gambling winnings that require tax reporting</Text>
          </View>
        )}
      </LinearGradient>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add W-2G Record</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                <X size={24} color={COLORS.navyDeep} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={newDate}
                onChangeText={setNewDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.formLabel}>Winning Amount *</Text>
              <View style={styles.valueInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.valueInput}
                  value={newAmount}
                  onChangeText={setNewAmount}
                  placeholder="1200.00"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.formLabel}>Federal Tax Withheld</Text>
              <View style={styles.valueInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.valueInput}
                  value={newWithheld}
                  onChangeText={setNewWithheld}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>

              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="e.g., Slot Machine Jackpot"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.formLabel}>Cruise/Location (Optional)</Text>
              <TextInput
                style={styles.input}
                value={newCruiseName}
                onChangeText={setNewCruiseName}
                placeholder="e.g., Harmony of the Seas"
                placeholderTextColor={COLORS.textSecondary}
              />

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setNewAmount('');
                    setNewWithheld('');
                    setNewDescription('');
                    setNewCruiseName('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!newAmount || parseFloat(newAmount) <= 0) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleAddRecord}
                  disabled={!newAmount || parseFloat(newAmount) <= 0}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveButtonText}>Add Record</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.15)',
    marginHorizontal: SPACING.sm,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  infoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    lineHeight: 16,
  },
  recordsList: {
    maxHeight: 300,
    marginBottom: SPACING.md,
  },
  recordCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  recordDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  recordDate: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  recordDescription: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  recordCruise: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  recordAmounts: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  amountItem: {
    flex: 1,
    alignItems: 'center',
  },
  amountDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 31, 63, 0.1)',
    marginHorizontal: SPACING.sm,
  },
  amountLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginTop: SPACING.sm,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    ...SHADOW.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  formLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    marginBottom: SPACING.sm,
  },
  valueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    marginBottom: SPACING.sm,
  },
  currencySymbol: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    paddingLeft: SPACING.sm,
  },
  valueInput: {
    flex: 1,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  saveButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
