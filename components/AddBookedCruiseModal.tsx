import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Ship, Calendar, MapPin, Hash, Home } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import type { BookedCruise, CabinCategory } from '@/types/models';

interface AddBookedCruiseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (cruise: BookedCruise) => void;
}

const CABIN_TYPES: CabinCategory[] = [
  'Interior',
  'Oceanview',
  'Balcony',
  'Junior Suite',
  'Grand Suite',
  'Owner\'s Suite',
];

export function AddBookedCruiseModal({ visible, onClose, onSave }: AddBookedCruiseModalProps) {
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

  const handleSave = () => {
    if (!shipName || !sailDate || !returnDate || !nights) {
      return;
    }

    const newCruise: BookedCruise = {
      id: `cruise-${Date.now()}`,
      shipName: shipName.trim(),
      sailDate: sailDate.trim(),
      returnDate: returnDate.trim(),
      nights: parseInt(nights) || 0,
      destination: destination.trim() || 'Caribbean',
      departurePort: departurePort.trim() || 'Unknown',
      reservationNumber: reservationNumber.trim() || undefined,
      cabinNumber: cabinNumber.trim() || undefined,
      cabinType: cabinType,
      price: price ? parseFloat(price) : undefined,
      totalPrice: price ? parseFloat(price) : undefined,
      freePlay: freePlay ? parseFloat(freePlay) : undefined,
      freeOBC: freeOBC ? parseFloat(freeOBC) : undefined,
      offerCode: offerCode.trim() || undefined,
      status: 'booked',
      completionState: 'upcoming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('[AddBookedCruiseModal] Creating new cruise:', newCruise);
    onSave(newCruise);
    handleClose();
  };

  const handleClose = () => {
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
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#001F3F', '#003D5C']}
            style={styles.modalHeader}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerIconBadge}>
                <Ship size={24} color={COLORS.white} />
              </View>
              <Text style={styles.modalTitle}>Add Cruise</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Cruise Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ship Name *</Text>
                <View style={styles.inputWrapper}>
                  <Ship size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={shipName}
                    onChangeText={setShipName}
                    placeholder="e.g., Symphony of the Seas"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Sail Date * (MM/DD/YYYY)</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={sailDate}
                    onChangeText={setSailDate}
                    placeholder="01/15/2026"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Return Date * (MM/DD/YYYY)</Text>
                <View style={styles.inputWrapper}>
                  <Calendar size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={returnDate}
                    onChangeText={setReturnDate}
                    placeholder="01/22/2026"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nights *</Text>
                <View style={styles.inputWrapper}>
                  <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={nights}
                    onChangeText={setNights}
                    placeholder="7"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Destination</Text>
                <View style={styles.inputWrapper}>
                  <MapPin size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={destination}
                    onChangeText={setDestination}
                    placeholder="e.g., Caribbean"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Departure Port</Text>
                <View style={styles.inputWrapper}>
                  <MapPin size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={departurePort}
                    onChangeText={setDeparturePort}
                    placeholder="e.g., Miami, FL"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Booking Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reservation Number</Text>
                <View style={styles.inputWrapper}>
                  <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={reservationNumber}
                    onChangeText={setReservationNumber}
                    placeholder="e.g., 1234567"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cabin Number</Text>
                <View style={styles.inputWrapper}>
                  <Home size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={cabinNumber}
                    onChangeText={setCabinNumber}
                    placeholder="e.g., 8234"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cabin Type</Text>
                <View style={styles.cabinTypeGrid}>
                  {CABIN_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.cabinTypeButton,
                        cabinType === type && styles.cabinTypeButtonActive,
                      ]}
                      onPress={() => setCabinType(type)}
                    >
                      <Text
                        style={[
                          styles.cabinTypeText,
                          cabinType === type && styles.cabinTypeTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Price</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Offer Code</Text>
                <View style={styles.inputWrapper}>
                  <Hash size={16} color={COLORS.navyDeep} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={offerCode}
                    onChangeText={setOfferCode}
                    placeholder="e.g., COMP2024"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>FreePlay (FP)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={freePlay}
                    onChangeText={setFreePlay}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Onboard Credit (OBC)</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.input, styles.priceInput]}
                    value={freeOBC}
                    onChangeText={setFreeOBC}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!shipName || !sailDate || !returnDate || !nights) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!shipName || !sailDate || !returnDate || !nights}
            >
              <LinearGradient
                colors={
                  !shipName || !sailDate || !returnDate || !nights
                    ? ['#999', '#999']
                    : [COLORS.navyDeep, '#003D5C']
                }
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>Add Cruise</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  formSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '700' as const,
    color: COLORS.navyDeep,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
  },
  currencySymbol: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: '600' as const,
    marginRight: SPACING.xs,
  },
  priceInput: {
    marginLeft: 0,
  },
  cabinTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  cabinTypeButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.1)',
  },
  cabinTypeButtonActive: {
    backgroundColor: COLORS.navyDeep,
    borderColor: COLORS.navyDeep,
  },
  cabinTypeText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.navyDeep,
    fontWeight: '600' as const,
  },
  cabinTypeTextActive: {
    color: COLORS.white,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
    backgroundColor: COLORS.white,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '600' as const,
    color: COLORS.navyDeep,
  },
  saveButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '700' as const,
    color: COLORS.white,
  },
});
