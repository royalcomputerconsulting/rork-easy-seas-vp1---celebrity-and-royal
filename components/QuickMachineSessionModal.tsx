import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useCasinoSessions, type Denomination } from '@/state/CasinoSessionProvider';
import { useSlotMachineLibrary } from '@/state/SlotMachineLibraryProvider';
import { useCruiseStore } from '@/state/CruiseStore';
import type { MachineEncyclopediaEntry, BookedCruise } from '@/types/models';
import { Play, Square, X, Check, Clock, DollarSign } from 'lucide-react-native';

interface QuickMachineSessionModalProps {
  visible: boolean;
  onClose: () => void;
  cruiseId?: string;
  shipName?: string;
}

export default function QuickMachineSessionModal({
  visible,
  onClose,
  cruiseId,
  shipName,
}: QuickMachineSessionModalProps) {
  const { addSession } = useCasinoSessions();
  const { myAtlasMachines, getMachinesForShip } = useSlotMachineLibrary();
  const { bookedCruises } = useCruiseStore();

  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<MachineEncyclopediaEntry | null>(null);
  const [selectedCruise, setSelectedCruise] = useState<BookedCruise | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [buyIn, setBuyIn] = useState<string>('');
  const [cashOut, setCashOut] = useState<string>('');
  const [denomination, setDenomination] = useState<Denomination>(0.01);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const availableMachines = useMemo(() => {
    if (shipName) {
      return getMachinesForShip(shipName);
    }
    if (selectedCruise) {
      return getMachinesForShip(selectedCruise.shipName);
    }
    return myAtlasMachines;
  }, [shipName, selectedCruise, myAtlasMachines, getMachinesForShip]);

  const upcomingCruises = useMemo(() => {
    return bookedCruises.filter(c => c.completionState !== 'completed');
  }, [bookedCruises]);

  const handleStartRecording = useCallback(() => {
    setStartTime(new Date());
    setIsRecording(true);
  }, []);

  const handleStopRecording = useCallback(() => {
    if (!startTime) return;
    
    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    setDurationMinutes(duration.toString());
    setIsRecording(false);
  }, [startTime]);

  const handleSave = useCallback(async () => {
    if (!selectedMachine) {
      Alert.alert('Error', 'Please select a machine');
      return;
    }

    if (!durationMinutes || parseInt(durationMinutes) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }

    const buyInNum = buyIn ? parseFloat(buyIn) : 0;
    const cashOutNum = cashOut ? parseFloat(cashOut) : 0;
    const winLoss = buyInNum > 0 || cashOutNum > 0 ? cashOutNum - buyInNum : undefined;

    setIsSaving(true);
    
    try {
      const now = new Date();
      const sessionCruiseId = cruiseId || selectedCruise?.id;
      
      await addSession({
        date: now.toISOString().split('T')[0],
        cruiseId: sessionCruiseId,
        machineId: selectedMachine.id,
        machineName: selectedMachine.machineName,
        startTime: startTime ? startTime.toISOString() : new Date(now.getTime() - parseInt(durationMinutes) * 60000).toISOString(),
        endTime: now.toISOString(),
        durationMinutes: parseInt(durationMinutes),
        buyIn: buyInNum || undefined,
        cashOut: cashOutNum || undefined,
        winLoss,
        denomination,
        machineType: 'penny-slots',
        notes,
      });

      Alert.alert('Success', 'Session saved successfully!');
      
      setIsRecording(false);
      setStartTime(null);
      setSelectedMachine(null);
      setSelectedCruise(null);
      setDurationMinutes('');
      setBuyIn('');
      setCashOut('');
      setDenomination(0.01);
      setNotes('');
      onClose();
    } catch (error) {
      console.error('[QuickMachineSession] Error saving session:', error);
      Alert.alert('Error', 'Failed to save session');
    } finally {
      setIsSaving(false);
    }
  }, [selectedMachine, durationMinutes, buyIn, cashOut, denomination, notes, cruiseId, selectedCruise, startTime, addSession, onClose]);

  const handleClose = useCallback(() => {
    setIsRecording(false);
    setStartTime(null);
    setSelectedMachine(null);
    setSelectedCruise(null);
    setDurationMinutes('');
    setBuyIn('');
    setCashOut('');
    setDenomination(0.01);
    setNotes('');
    onClose();
  }, [onClose]);

  const winLoss = useMemo(() => {
    const buyInNum = buyIn ? parseFloat(buyIn) : 0;
    const cashOutNum = cashOut ? parseFloat(cashOut) : 0;
    if (buyInNum === 0 && cashOutNum === 0) return null;
    return cashOutNum - buyInNum;
  }, [buyIn, cashOut]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Quick Session Entry</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!cruiseId && upcomingCruises.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Cruise (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {upcomingCruises.map((cruise) => (
                    <TouchableOpacity
                      key={cruise.id}
                      style={[
                        styles.cruiseChip,
                        selectedCruise?.id === cruise.id && styles.cruiseChipSelected,
                      ]}
                      onPress={() => setSelectedCruise(cruise)}
                    >
                      <Text
                        style={[
                          styles.cruiseChipText,
                          selectedCruise?.id === cruise.id && styles.cruiseChipTextSelected,
                        ]}
                      >
                        {cruise.shipName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.label}>Select Machine *</Text>
              <ScrollView style={styles.machineList} nestedScrollEnabled>
                {availableMachines.length === 0 ? (
                  <Text style={styles.noMachines}>No machines available</Text>
                ) : (
                  availableMachines.map((machine) => (
                    <TouchableOpacity
                      key={machine.id}
                      style={[
                        styles.machineItem,
                        selectedMachine?.id === machine.id && styles.machineItemSelected,
                      ]}
                      onPress={() => setSelectedMachine(machine)}
                    >
                      <View style={styles.machineInfo}>
                        <Text style={styles.machineName}>{machine.machineName}</Text>
                        <Text style={styles.machineManufacturer}>{machine.manufacturer}</Text>
                      </View>
                      {selectedMachine?.id === machine.id && (
                        <Check size={20} color="#10b981" />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Time Tracking</Text>
              {!isRecording && !startTime && (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={handleStartRecording}
                >
                  <Play size={20} color="#fff" />
                  <Text style={styles.startButtonText}>Start Timer</Text>
                </TouchableOpacity>
              )}

              {isRecording && (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={handleStopRecording}
                >
                  <Square size={20} color="#fff" />
                  <Text style={styles.stopButtonText}>Stop Timer</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.orText}>or enter manually</Text>
              
              <View style={styles.inputRow}>
                <Clock size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Duration (minutes)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Denomination</Text>
              <View style={styles.denomRow}>
                {[0.01, 0.05, 0.25, 1].map((denom) => (
                  <TouchableOpacity
                    key={denom}
                    style={[
                      styles.denomChip,
                      denomination === denom && styles.denomChipSelected,
                    ]}
                    onPress={() => setDenomination(denom as Denomination)}
                  >
                    <Text
                      style={[
                        styles.denomChipText,
                        denomination === denom && styles.denomChipTextSelected,
                      ]}
                    >
                      {denom < 1 ? `${denom * 100}¢` : `$${denom}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Results</Text>
              <View style={styles.inputRow}>
                <DollarSign size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Buy-In"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={buyIn}
                  onChangeText={setBuyIn}
                />
              </View>

              <View style={styles.inputRow}>
                <DollarSign size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Cash-Out"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={cashOut}
                  onChangeText={setCashOut}
                />
              </View>

              {winLoss !== null && (
                <View style={[styles.winLossContainer, winLoss >= 0 ? styles.winContainer : styles.lossContainer]}>
                  <Text style={styles.winLossLabel}>Net Result:</Text>
                  <Text style={[styles.winLossValue, winLoss >= 0 ? styles.winValue : styles.lossValue]}>
                    {winLoss >= 0 ? '+' : ''} ${winLoss.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any notes about the session..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save Session'}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    maxHeight: 500,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  cruiseChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  cruiseChipSelected: {
    backgroundColor: '#3b82f6',
  },
  cruiseChipText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  cruiseChipTextSelected: {
    color: '#fff',
  },
  machineList: {
    maxHeight: 200,
  },
  machineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 8,
  },
  machineItemSelected: {
    backgroundColor: '#10b98120',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  machineManufacturer: {
    fontSize: 12,
    color: '#9ca3af',
  },
  noMachines: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  orText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  textArea: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  denomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  denomChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  denomChipSelected: {
    backgroundColor: '#3b82f6',
  },
  denomChipText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  denomChipTextSelected: {
    color: '#fff',
  },
  winLossContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  winContainer: {
    backgroundColor: '#10b98120',
  },
  lossContainer: {
    backgroundColor: '#ef444420',
  },
  winLossLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  winLossValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  winValue: {
    color: '#10b981',
  },
  lossValue: {
    color: '#ef4444',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
