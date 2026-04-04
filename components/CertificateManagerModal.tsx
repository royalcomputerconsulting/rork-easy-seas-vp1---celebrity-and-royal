import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Save,
  CircleDollarSign,
  Ticket,
  Gift,
  Award,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';

export type CertificateType = 'fpp' | 'nextCruise' | 'obc' | 'freeplay' | 'discount';

export interface Certificate {
  id: string;
  type: CertificateType;
  label: string;
  value: number;
  description?: string;
  expiryDate?: string;
  usedOnCruise?: string;
  status: 'available' | 'used' | 'expired';
}

interface CertificateManagerModalProps {
  visible: boolean;
  onClose: () => void;
  certificates: Certificate[];
  onAddCertificate: (cert: Omit<Certificate, 'id'>) => void;
  onUpdateCertificate: (id: string, cert: Partial<Certificate>) => void;
  onDeleteCertificate: (id: string) => void;
}

const CERTIFICATE_TYPES: { type: CertificateType; label: string; icon: typeof CircleDollarSign }[] = [
  { type: 'fpp', label: 'Free Play Points', icon: CircleDollarSign },
  { type: 'nextCruise', label: 'Next Cruise', icon: Ticket },
  { type: 'obc', label: 'Onboard Credit', icon: Gift },
  { type: 'freeplay', label: 'Casino Free Play', icon: Sparkles },
  { type: 'discount', label: 'Discount', icon: Award },
];

export function CertificateManagerModal({
  visible,
  onClose,
  certificates,
  onAddCertificate,
  onUpdateCertificate,
  onDeleteCertificate,
}: CertificateManagerModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newType, setNewType] = useState<CertificateType>('fpp');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newExpiry, setNewExpiry] = useState('');

  const resetForm = useCallback(() => {
    setNewType('fpp');
    setNewLabel('');
    setNewValue('');
    setNewDescription('');
    setNewExpiry('');
    setIsAdding(false);
    setEditingId(null);
  }, []);

  const formatDateToISO = (dateStr: string): string | undefined => {
    if (!dateStr) return undefined;
    const mmddyyyy = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (mmddyyyy) {
      const [, mm, dd, yyyy] = mmddyyyy;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const formatDateToMMDDYYYY = (dateStr: string): string => {
    if (!dateStr) return '';
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return `${mm}-${dd}-${yyyy}`;
    }
    return dateStr;
  };

  const validateDateFormat = (dateStr: string): boolean => {
    if (!dateStr) return true;
    return /^(\d{1,2})-(\d{1,2})-(\d{4})$/.test(dateStr);
  };

  const handleAdd = useCallback(() => {
    if (!newValue || parseFloat(newValue) <= 0) {
      Alert.alert('Invalid Value', 'Please enter a valid certificate value.');
      return;
    }

    if (newExpiry && !validateDateFormat(newExpiry)) {
      Alert.alert('Invalid Date Format', 'Please enter date as MM-DD-YYYY (e.g., 12-31-2025)');
      return;
    }

    const typeInfo = CERTIFICATE_TYPES.find(t => t.type === newType);
    const label = newLabel || typeInfo?.label || 'Certificate';

    onAddCertificate({
      type: newType,
      label,
      value: parseFloat(newValue),
      description: newDescription || undefined,
      expiryDate: formatDateToISO(newExpiry),
      status: 'available',
    });

    resetForm();
    console.log('[CertificateManager] Certificate added:', { type: newType, value: newValue });
  }, [newType, newLabel, newValue, newDescription, newExpiry, onAddCertificate, resetForm]);

  const handleEdit = useCallback((cert: Certificate) => {
    setEditingId(cert.id);
    setNewType(cert.type);
    setNewLabel(cert.label);
    setNewValue(cert.value.toString());
    setNewDescription(cert.description || '');
    setNewExpiry(cert.expiryDate ? formatDateToMMDDYYYY(cert.expiryDate) : '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !newValue || parseFloat(newValue) <= 0) {
      Alert.alert('Invalid Value', 'Please enter a valid certificate value.');
      return;
    }

    if (newExpiry && !validateDateFormat(newExpiry)) {
      Alert.alert('Invalid Date Format', 'Please enter date as MM-DD-YYYY (e.g., 12-31-2025)');
      return;
    }

    onUpdateCertificate(editingId, {
      type: newType,
      label: newLabel || CERTIFICATE_TYPES.find(t => t.type === newType)?.label || 'Certificate',
      value: parseFloat(newValue),
      description: newDescription || undefined,
      expiryDate: formatDateToISO(newExpiry),
    });

    resetForm();
    console.log('[CertificateManager] Certificate updated:', editingId);
  }, [editingId, newType, newLabel, newValue, newDescription, newExpiry, onUpdateCertificate, resetForm]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      'Delete Certificate',
      'Are you sure you want to delete this certificate?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            onDeleteCertificate(id);
            console.log('[CertificateManager] Certificate deleted:', id);
          }
        },
      ]
    );
  }, [onDeleteCertificate]);

  const handleToggleStatus = useCallback((cert: Certificate) => {
    const nextStatus = cert.status === 'available' ? 'used' : 'available';
    onUpdateCertificate(cert.id, { status: nextStatus });
    console.log('[CertificateManager] Certificate status toggled:', cert.id, nextStatus);
  }, [onUpdateCertificate]);

  const getCertIcon = (type: CertificateType) => {
    const typeInfo = CERTIFICATE_TYPES.find(t => t.type === type);
    return typeInfo?.icon || Award;
  };

  const renderCertificateItem = (cert: Certificate) => {
    const Icon = getCertIcon(cert.type);
    const isEditing = editingId === cert.id;

    if (isEditing) {
      return (
        <View key={cert.id} style={styles.editForm}>
          <View style={styles.typeSelector}>
            {CERTIFICATE_TYPES.map((typeOption) => {
              const TypeIcon = typeOption.icon;
              return (
                <TouchableOpacity
                  key={typeOption.type}
                  style={[
                    styles.typeOption,
                    newType === typeOption.type && styles.typeOptionSelected,
                  ]}
                  onPress={() => setNewType(typeOption.type)}
                  activeOpacity={0.7}
                >
                  <TypeIcon 
                    size={16} 
                    color={newType === typeOption.type ? COLORS.navyDeep : COLORS.beigeWarm} 
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Label (optional)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newLabel}
            onChangeText={setNewLabel}
          />

          <TextInput
            style={styles.input}
            placeholder="Value ($)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newValue}
            onChangeText={setNewValue}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newDescription}
            onChangeText={setNewDescription}
          />

          <TextInput
            style={styles.input}
            placeholder="Expiry Date (MM-DD-YYYY)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newExpiry}
            onChangeText={setNewExpiry}
          />

          <View style={styles.editActions}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={resetForm}
              activeOpacity={0.7}
            >
              <X size={16} color={COLORS.white} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveEdit}
              activeOpacity={0.7}
            >
              <Save size={16} color={COLORS.navyDeep} />
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View 
        key={cert.id} 
        style={[
          styles.certItem, 
          cert.status === 'used' && styles.certItemUsed
        ]}
      >
        <TouchableOpacity 
          style={styles.statusToggle}
          onPress={() => handleToggleStatus(cert)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.statusCheckbox,
            cert.status === 'used' && styles.statusCheckboxChecked,
          ]}>
            {cert.status === 'used' && <Check size={12} color={COLORS.navyDeep} />}
          </View>
        </TouchableOpacity>

        <View style={styles.certIconContainer}>
          <Icon size={18} color={cert.status === 'used' ? 'rgba(255,215,0,0.5)' : COLORS.goldAccent} />
        </View>

        <View style={styles.certInfo}>
          <Text style={[styles.certLabel, cert.status === 'used' && styles.certLabelUsed]}>
            {cert.label}
          </Text>
          <View style={styles.certMeta}>
            <Text style={styles.certValue}>${cert.value}</Text>
            {cert.expiryDate && (
              <Text style={styles.certExpiry}>Exp: {formatDateToMMDDYYYY(cert.expiryDate)}</Text>
            )}
          </View>
          {cert.description && (
            <Text style={styles.certDescription} numberOfLines={1}>{cert.description}</Text>
          )}
        </View>

        <View style={styles.certActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEdit(cert)}
            activeOpacity={0.7}
          >
            <Edit3 size={16} color={COLORS.beigeWarm} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(cert.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const availableCount = certificates.filter(c => c.status === 'available').length;
  const usedCount = certificates.filter(c => c.status === 'used').length;
  const totalValue = certificates.filter(c => c.status === 'available').reduce((sum, c) => sum + c.value, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0, 31, 63, 0.98)', 'rgba(0, 61, 92, 0.95)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Sparkles size={24} color={COLORS.goldAccent} />
            <Text style={styles.headerTitle}>Manage Certificates</Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{availableCount}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{usedCount}</Text>
            <Text style={styles.statLabel}>Used</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              ${totalValue.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isAdding && (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>Add New Certificate</Text>
              
              <View style={styles.typeSelector}>
                {CERTIFICATE_TYPES.map((typeOption) => {
                  const TypeIcon = typeOption.icon;
                  return (
                    <TouchableOpacity
                      key={typeOption.type}
                      style={[
                        styles.typeOption,
                        newType === typeOption.type && styles.typeOptionSelected,
                      ]}
                      onPress={() => setNewType(typeOption.type)}
                      activeOpacity={0.7}
                    >
                      <TypeIcon 
                        size={16} 
                        color={newType === typeOption.type ? COLORS.navyDeep : COLORS.beigeWarm} 
                      />
                      <Text style={[
                        styles.typeOptionText,
                        newType === typeOption.type && styles.typeOptionTextSelected,
                      ]}>
                        {typeOption.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Label (optional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newLabel}
                onChangeText={setNewLabel}
              />

              <TextInput
                style={styles.input}
                placeholder="Value ($) *"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newValue}
                onChangeText={setNewValue}
                keyboardType="numeric"
              />

              <TextInput
                style={styles.input}
                placeholder="Description (optional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newDescription}
                onChangeText={setNewDescription}
              />

              <TextInput
                style={styles.input}
                placeholder="Expiry Date (MM-DD-YYYY)"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newExpiry}
                onChangeText={setNewExpiry}
              />

              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={resetForm}
                  activeOpacity={0.7}
                >
                  <X size={16} color={COLORS.white} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={handleAdd}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={COLORS.navyDeep} />
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {certificates.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Award size={48} color={COLORS.beigeWarm} />
              </View>
              <Text style={styles.emptyTitle}>No Certificates</Text>
              <Text style={styles.emptyText}>
                Add your casino certificates to track and manage them.
              </Text>
            </View>
          ) : (
            <View style={styles.certList}>
              {certificates.map(renderCertificateItem)}
            </View>
          )}
        </ScrollView>

        {!isAdding && !editingId && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => setIsAdding(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.beigeWarm, COLORS.goldDark]}
              style={styles.fabGradient}
            >
              <Plus size={24} color={COLORS.navyDeep} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navyDeep,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.2)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 165, 116, 0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
  },
  statValue: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.beigeWarm,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  addForm: {
    backgroundColor: 'rgba(0, 31, 63, 0.8)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.beigeWarm,
    ...SHADOW.lg,
  },
  editForm: {
    backgroundColor: 'rgba(0, 31, 63, 0.8)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.beigeWarm,
  },
  formTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.beigeWarm,
    marginBottom: SPACING.md,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.2)',
  },
  typeOptionSelected: {
    backgroundColor: COLORS.beigeWarm,
    borderColor: COLORS.beigeWarm,
  },
  typeOptionText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.beigeWarm,
  },
  typeOptionTextSelected: {
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.md,
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.beigeWarm,
    borderRadius: BORDER_RADIUS.md,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  certList: {
    gap: SPACING.sm,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 116, 0.1)',
  },
  certItemUsed: {
    opacity: 0.6,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusToggle: {
    padding: SPACING.xs,
  },
  statusCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.beigeWarm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCheckboxChecked: {
    backgroundColor: COLORS.beigeWarm,
  },
  certIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  certInfo: {
    flex: 1,
  },
  certLabel: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  certLabelUsed: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.5)',
  },
  certMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  certValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  certExpiry: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
  },
  certDescription: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  certActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    right: 24,
    borderRadius: 28,
    ...SHADOW.lg,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
