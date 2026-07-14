import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Ship, Calendar, MapPin, Hash, Home, CheckCircle, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type { BookedCruise, CabinCategory, Cruise } from '@/types/models';
import { getDoubleOccupancyRoomRetailValue } from '@/lib/valueCalculator';

interface AddBookedCruiseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (cruise: BookedCruise) => void;
  onSaveAvailable?: (cruise: Cruise) => void;
}

const CABIN_TYPES: CabinCategory[] = [
  'Interior',
  'Oceanview',
  'Balcony',
  'Junior Suite',
  'Grand Suite',
  'Owner\'s Suite',
];

type ManualCruiseType = 'booked' | 'available';

function calculateReturnDate(sailDate: string, nights: string): string {
  const rawNights = parseInt(nights, 10);
  if (!sailDate || !Number.isFinite(rawNights) || rawNights <= 0) return '';
  const parts = sailDate.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!parts) return '';
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const year = parseInt(parts[3].length === 2 ? `20${parts[3]}` : parts[3], 10);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + rawNights);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

export function AddBookedCruiseModal({ visible, onClose, onSave, onSaveAvailable }: AddBookedCruiseModalProps) {
  const [manualCruiseType, setManualCruiseType] = useState<ManualCruiseType>('booked');
  const [shipName, setShipName] = useState('');
  const [sailDate, setSailDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [nights, setNights] = useState('');
  const [destination, setDestination] = useState('');
  const [departurePort, setDeparturePort] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');
  const [cabinNumber, setCabinNumber] = useState('');
  const [cabinType, setCabinType] = useState<CabinCategory>('Balcony');
  const [price, setPrice] = useState('');
  const [freePlay, setFreePlay] = useState('');
  const [freeOBC, setFreeOBC] = useState('');
  const [offerCode, setOfferCode] = useState('');

  const inferredReturnDate = useMemo(() => returnDate.trim() || calculateReturnDate(sailDate, nights), [returnDate, sailDate, nights]);
  const requiredFieldsReady = Boolean(shipName.trim() && sailDate.trim() && nights.trim() && (manualCruiseType === 'available' || inferredReturnDate.trim()));

  const resetForm = () => {
    setManualCruiseType('booked');
    setShipName('');
    setSailDate('');
    setReturnDate('');
    setNights('');
    setDestination('');
    setDeparturePort('');
    setReservationNumber('');
    setCabinNumber('');
    setCabinType('Balcony');
    setPrice('');
    setFreePlay('');
    setFreeOBC('');
    setOfferCode('');
  };

  const handleSave = () => {
    if (!requiredFieldsReady) return;

    const parsedPerPersonRetailPrice = price ? parseFloat(price) : undefined;
    const parsedRoomRetailPrice = getDoubleOccupancyRoomRetailValue(parsedPerPersonRetailPrice);
    const parsedNights = parseInt(nights, 10) || 0;
    const baseCruise: Cruise = {
      id: `${manualCruiseType}-cruise-${Date.now()}`,
      shipName: shipName.trim(),
      sailDate: sailDate.trim(),
      returnDate: inferredReturnDate.trim(),
      nights: parsedNights,
      destination: destination.trim() || 'Caribbean',
      departurePort: departurePort.trim() || 'Unknown',
      cabinType,
      price: parsedPerPersonRetailPrice,
      totalPrice: parsedRoomRetailPrice,
      retailValue: parsedRoomRetailPrice,
      totalRetailCost: parsedRoomRetailPrice,
      originalPrice: parsedRoomRetailPrice,
      freePlay: freePlay ? parseFloat(freePlay) : undefined,
      freeOBC: freeOBC ? parseFloat(freeOBC) : undefined,
      offerCode: offerCode.trim() || undefined,
      status: manualCruiseType === 'available' ? 'available' : 'booked',
      cruiseSource: 'royal',
      brand: 'royal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (manualCruiseType === 'available') {
      console.log('[AddBookedCruiseModal] Creating available cruise:', baseCruise);
      onSaveAvailable?.(baseCruise);
      handleClose();
      return;
    }

    const newBookedCruise: BookedCruise = {
      ...baseCruise,
      reservationNumber: reservationNumber.trim() || undefined,
      cabinNumber: cabinNumber.trim() || undefined,
      status: 'booked',
      completionState: 'upcoming',
    };

    console.log('[AddBookedCruiseModal] Creating booked cruise:', newBookedCruise);
    onSave(newBookedCruise);
    handleClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#001F3F', '#003D5C']} style={styles.modalHeader}>
            <View style={styles.headerRow}>
              <View style={styles.headerIconBadge}>
                <Ship size={24} color={COLORS.white} />
              </View>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.modalTitle}>Add Cruise</Text>
                <Text style={styles.modalSubtitle}>Choose whether this is already booked or just an available sailing.</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentInner}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>What are you adding?</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeButton, manualCruiseType === 'booked' && styles.typeButtonActive]}
                  onPress={() => setManualCruiseType('booked')}
                >
                  <CheckCircle size={16} color={manualCruiseType === 'booked' ? COLORS.white : COLORS.navyDeep} />
                  <Text style={[styles.typeButtonText, manualCruiseType === 'booked' && styles.typeButtonTextActive]}>Booked Cruise</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, manualCruiseType === 'available' && styles.typeButtonActive]}
                  onPress={() => setManualCruiseType('available')}
                >
                  <Search size={16} color={manualCruiseType === 'available' ? COLORS.white : COLORS.navyDeep} />
                  <Text style={[styles.typeButtonText, manualCruiseType === 'available' && styles.typeButtonTextActive]}>Available Cruise</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                Booked cruises go to My Cruises. Available cruises go to the offer/scheduling inventory for future comparison.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Cruise Details</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ship Name *</Text>
                <View style={styles.inputWrapper}>
                  <Ship size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={shipName} onChangeText={setShipName} placeholder="e.g., Symphony of the Seas" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sail Date * (MM/DD/YYYY)</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={sailDate} onChangeText={setSailDate} placeholder="01/15/2026" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Return Date {manualCruiseType === 'booked' ? '*' : '(optional)'}</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={returnDate} onChangeText={setReturnDate} placeholder={calculateReturnDate(sailDate, nights) || '01/22/2026'} placeholderTextColor={COLORS.textSecondary} />
                </View>
                {Boolean(!returnDate.trim() && calculateReturnDate(sailDate, nights)) && <Text style={styles.helperText}>Will auto-calculate as {calculateReturnDate(sailDate, nights)} from nights.</Text>}
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nights *</Text>
                <View style={styles.inputWrapper}>
                  <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={nights} onChangeText={setNights} placeholder="7" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Destination</Text>
                <View style={styles.inputWrapper}>
                  <MapPin size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="e.g., Caribbean" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Departure Port</Text>
                <View style={styles.inputWrapper}>
                  <MapPin size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={departurePort} onChangeText={setDeparturePort} placeholder="e.g., Miami, FL" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>
            </View>

            {manualCruiseType === 'booked' && (
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Booking Information</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Reservation Number</Text>
                  <View style={styles.inputWrapper}>
                    <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                    <TextInput style={styles.input} value={reservationNumber} onChangeText={setReservationNumber} placeholder="e.g., 1234567" placeholderTextColor={COLORS.textSecondary} />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Cabin Number</Text>
                  <View style={styles.inputWrapper}>
                    <Home size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                    <TextInput style={styles.input} value={cabinNumber} onChangeText={setCabinNumber} placeholder="e.g., 8234" placeholderTextColor={COLORS.textSecondary} />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Value / Offer Details</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cabin Type</Text>
                <View style={styles.cabinTypeGrid}>
                  {CABIN_TYPES.map((type) => (
                    <TouchableOpacity key={type} style={[styles.cabinTypeButton, cabinType === type && styles.cabinTypeButtonActive]} onPress={() => setCabinType(type)}>
                      <Text style={[styles.cabinTypeText, cabinType === type && styles.cabinTypeTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Retail Price</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput style={[styles.input, styles.priceInput]} value={price} onChangeText={setPrice} placeholder="Imported cabin retail value" placeholderTextColor={COLORS.textSecondary} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Offer Code</Text>
                <View style={styles.inputWrapper}>
                  <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput style={styles.input} value={offerCode} onChangeText={setOfferCode} placeholder="e.g., 26RCL703" placeholderTextColor={COLORS.textSecondary} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>FreePlay (FP)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput style={[styles.input, styles.priceInput]} value={freePlay} onChangeText={setFreePlay} placeholder="0.00" placeholderTextColor={COLORS.textSecondary} keyboardType="decimal-pad" />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Onboard Credit (OBC)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput style={[styles.input, styles.priceInput]} value={freeOBC} onChangeText={setFreeOBC} placeholder="0.00" placeholderTextColor={COLORS.textSecondary} keyboardType="decimal-pad" />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, !requiredFieldsReady && styles.saveButtonDisabled]} onPress={handleSave} disabled={!requiredFieldsReady}>
              <LinearGradient colors={!requiredFieldsReady ? ['#999', '#999'] : [COLORS.navyDeep, '#003D5C']} style={styles.saveButtonGradient}>
                <Text style={styles.saveButtonText}>Add {manualCruiseType === 'available' ? 'Available Cruise' : 'Booked Cruise'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.xl : SPACING.md },
  modalContainer: { flex: 1, maxHeight: '94%', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden' },
  modalHeader: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerIconBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitleGroup: { flex: 1 },
  modalTitle: { fontSize: TYPOGRAPHY.fontSizeXL, fontWeight: '700' as const, color: COLORS.white },
  modalSubtitle: { marginTop: 2, fontSize: TYPOGRAPHY.fontSizeXS, color: 'rgba(255,255,255,0.82)' },
  closeButton: { padding: SPACING.xs },
  modalContent: { flex: 1 },
  modalContentInner: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  formSection: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: '700' as const, color: COLORS.navyDeep, marginBottom: SPACING.md },
  helperText: { marginTop: SPACING.xs, fontSize: TYPOGRAPHY.fontSizeXS, color: COLORS.textSecondary, lineHeight: 18 },
  typeSelectorRow: { flexDirection: 'row', gap: SPACING.sm },
  typeButton: { flex: 1, minHeight: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: 'rgba(0, 31, 63, 0.15)', backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACING.xs, paddingHorizontal: SPACING.sm },
  typeButtonActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  typeButtonText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.navyDeep, fontWeight: '700' as const, textAlign: 'center' },
  typeButtonTextActive: { color: COLORS.white },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '600' as const, color: COLORS.navyDeep, marginBottom: SPACING.xs },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: 'rgba(0, 31, 63, 0.1)' },
  inputIcon: { marginRight: SPACING.sm },
  input: { flex: 1, fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.navyDeep, paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm, minHeight: 44 },
  currencySymbol: { fontSize: TYPOGRAPHY.fontSizeMD, color: COLORS.navyDeep, fontWeight: '600' as const, marginRight: SPACING.xs },
  priceInput: { marginLeft: 0 },
  cabinTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cabinTypeButton: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: 'rgba(0, 31, 63, 0.1)' },
  cabinTypeButtonActive: { backgroundColor: COLORS.navyDeep, borderColor: COLORS.navyDeep },
  cabinTypeText: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.navyDeep, fontWeight: '600' as const },
  cabinTypeTextActive: { color: COLORS.white },
  modalFooter: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(0, 31, 63, 0.1)', backgroundColor: COLORS.white },
  cancelButton: { flex: 1, minHeight: 52, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontSize: TYPOGRAPHY.fontSizeMD, fontWeight: '600' as const, color: COLORS.navyDeep },
  saveButton: { flex: 1.35, minHeight: 52, borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonGradient: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm },
  saveButtonText: { fontSize: TYPOGRAPHY.fontSizeSM, fontWeight: '700' as const, color: COLORS.white, textAlign: 'center' },
});
