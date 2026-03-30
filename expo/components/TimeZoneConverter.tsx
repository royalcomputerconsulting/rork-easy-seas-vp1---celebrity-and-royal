import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import {
  Globe,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  ArrowRightLeft,
  CalendarClock,
  MapPin,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { TIMEZONE_LIST, type TimeZoneEntry } from '@/constants/timezones';

const STORAGE_KEY_LOCAL = '@tz_local_zone';
const STORAGE_KEY_REMOTE = '@tz_remote_zone';

function getTimeInZone(tz: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--:--';
  }
}

function getDateInZone(tz: string): string {
  try {
    return new Date().toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function getOffsetDifference(localOffset: number, remoteOffset: number): string {
  try {
    const diffHours = remoteOffset - localOffset;
    const sign = diffHours >= 0 ? '+' : '';
    if (diffHours % 1 === 0) {
      return `${sign}${diffHours}h`;
    }
    const hours = Math.trunc(diffHours);
    const mins = Math.abs(Math.round((diffHours % 1) * 60));
    return `${sign}${hours}h ${mins}m`;
  } catch {
    return '??';
  }
}

function convertMeetingTime(
  time: string,
  fromTz: string,
  toTz: string
): string {
  try {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 'Invalid time';

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const now = new Date();
    const fromStr = now.toLocaleString('en-US', { timeZone: fromTz });
    const fromDate = new Date(fromStr);
    fromDate.setHours(hours, minutes, 0, 0);

    const toStr = now.toLocaleString('en-US', { timeZone: toTz });
    const toDate = new Date(toStr);

    const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: fromTz }));
    const diffMs = toDate.getTime() - nowLocal.getTime();

    const resultDate = new Date(fromDate.getTime() + diffMs);

    return resultDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Error';
  }
}

interface TimeZonePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tz: TimeZoneEntry) => void;
  title: string;
}

function TimeZonePickerModal({ visible, onClose, onSelect, title }: TimeZonePickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return TIMEZONE_LIST;
    const q = search.toLowerCase();
    return TIMEZONE_LIST.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.city.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<string, TimeZoneEntry[]> = {};
    filtered.forEach((tz) => {
      if (!groups[tz.region]) groups[tz.region] = [];
      groups[tz.region].push(tz);
    });
    return groups;
  }, [filtered]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={modalStyles.searchContainer}>
            <Search size={16} color="rgba(255,255,255,0.5)" />
            <TextInput
              style={modalStyles.searchInput}
              placeholder="Search city or region..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={modalStyles.list} showsVerticalScrollIndicator={false}>
            {Object.entries(grouped).map(([region, tzList]) => (
              <View key={region}>
                <Text style={modalStyles.regionHeader}>{region}</Text>
                {tzList.map((tz) => (
                  <TouchableOpacity
                    key={tz.value}
                    style={modalStyles.tzItem}
                    onPress={() => {
                      onSelect(tz);
                      onClose();
                      setSearch('');
                    }}
                    activeOpacity={0.7}
                  >
                    <MapPin size={14} color="rgba(255,255,255,0.5)" />
                    <Text style={modalStyles.tzLabel}>{tz.label}</Text>
                    <Text style={modalStyles.tzTime}>{getTimeInZone(tz.value)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {filtered.length === 0 ? (
              <Text style={modalStyles.noResults}>No time zones found</Text>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function TimeZoneConverter() {
  const [expanded, setExpanded] = useState(false);
  const [localTz, setLocalTz] = useState<TimeZoneEntry>(TIMEZONE_LIST[0]);
  const [remoteTz, setRemoteTz] = useState<TimeZoneEntry>(TIMEZONE_LIST[8]);
  const [localTime, setLocalTime] = useState('');
  const [remoteTime, setRemoteTime] = useState('');
  const [localDate, setLocalDate] = useState('');
  const [remoteDate, setRemoteDate] = useState('');
  const [showLocalPicker, setShowLocalPicker] = useState(false);
  const [showRemotePicker, setShowRemotePicker] = useState(false);
  const [meetingTimeInput, setMeetingTimeInput] = useState('');
  const [meetingFrom, setMeetingFrom] = useState<'local' | 'remote'>('remote');
  const [convertedMeetingTime, setConvertedMeetingTime] = useState('');
  const [expandAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const loadSaved = async () => {
      try {
        const savedLocal = await AsyncStorage.getItem(STORAGE_KEY_LOCAL);
        const savedRemote = await AsyncStorage.getItem(STORAGE_KEY_REMOTE);
        if (savedLocal) {
          const found = TIMEZONE_LIST.find((t) => t.value === savedLocal);
          if (found) setLocalTz(found);
        } else {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const found = TIMEZONE_LIST.find((t) => t.value === userTz);
          if (found) setLocalTz(found);
        }
        if (savedRemote) {
          const found = TIMEZONE_LIST.find((t) => t.value === savedRemote);
          if (found) setRemoteTz(found);
        }
      } catch (e) {
        console.log('[TimeZone] Error loading saved zones:', e);
      }
    };
    void loadSaved();
  }, []);

  useEffect(() => {
    const update = () => {
      setLocalTime(getTimeInZone(localTz.value));
      setRemoteTime(getTimeInZone(remoteTz.value));
      setLocalDate(getDateInZone(localTz.value));
      setRemoteDate(getDateInZone(remoteTz.value));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [localTz, remoteTz]);

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [expanded, expandAnim]);

  const offset = useMemo(
    () => getOffsetDifference(localTz.offset, remoteTz.offset),
    [localTz, remoteTz]
  );

  const handleSelectLocal = useCallback(
    (tz: TimeZoneEntry) => {
      setLocalTz(tz);
      AsyncStorage.setItem(STORAGE_KEY_LOCAL, tz.value).catch(() => {});
    },
    []
  );

  const handleSelectRemote = useCallback(
    (tz: TimeZoneEntry) => {
      setRemoteTz(tz);
      AsyncStorage.setItem(STORAGE_KEY_REMOTE, tz.value).catch(() => {});
    },
    []
  );

  const handleConvertMeeting = useCallback(() => {
    if (!meetingTimeInput.trim()) {
      setConvertedMeetingTime('');
      return;
    }
    const fromZone = meetingFrom === 'local' ? localTz.value : remoteTz.value;
    const toZone = meetingFrom === 'local' ? remoteTz.value : localTz.value;
    const result = convertMeetingTime(meetingTimeInput.trim(), fromZone, toZone);
    setConvertedMeetingTime(result);
  }, [meetingTimeInput, meetingFrom, localTz, remoteTz]);

  useEffect(() => {
    if (meetingTimeInput.trim()) {
      handleConvertMeeting();
    }
  }, [meetingFrom, localTz, remoteTz, meetingTimeInput, handleConvertMeeting]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const swapZones = useCallback(() => {
    const temp = localTz;
    setLocalTz(remoteTz);
    setRemoteTz(temp);
    AsyncStorage.setItem(STORAGE_KEY_LOCAL, remoteTz.value).catch(() => {});
    AsyncStorage.setItem(STORAGE_KEY_REMOTE, temp.value).catch(() => {});
  }, [localTz, remoteTz]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconBadge}>
            <Globe size={16} color="#00ACC1" />
          </View>
          <Text style={styles.headerTitle}>Time Zone Converter</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.offsetChip}>
            <Text style={styles.offsetChipText}>{offset}</Text>
          </View>
          {expanded ? (
            <ChevronUp size={18} color="rgba(255,255,255,0.6)" />
          ) : (
            <ChevronDown size={18} color="rgba(255,255,255,0.6)" />
          )}
        </View>
      </TouchableOpacity>

      {!expanded ? (
        <View style={styles.collapsedPreview}>
          <View style={styles.previewClock}>
            <Text style={styles.previewLabel}>{localTz.city}</Text>
            <Text style={styles.previewTime}>{localTime}</Text>
          </View>
          <ArrowRightLeft size={14} color="rgba(255,255,255,0.3)" />
          <View style={styles.previewClock}>
            <Text style={styles.previewLabel}>{remoteTz.city}</Text>
            <Text style={styles.previewTime}>{remoteTime}</Text>
          </View>
        </View>
      ) : null}

      {expanded ? (
        <View style={styles.expandedContent}>
          <View style={styles.dualClockRow}>
            <TouchableOpacity
              style={styles.clockCard}
              onPress={() => setShowLocalPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.clockLabelRow}>
                <MapPin size={12} color="#00ACC1" />
                <Text style={styles.clockLabel}>YOUR LOCATION</Text>
              </View>
              <Text style={styles.clockCity}>{localTz.city}</Text>
              <Text style={styles.clockTime}>{localTime}</Text>
              <Text style={styles.clockDate}>{localDate}</Text>
              <View style={styles.changeBtnRow}>
                <Text style={styles.changeText}>Change</Text>
                <ChevronDown size={12} color="#00ACC1" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.swapBtn} onPress={swapZones} activeOpacity={0.7}>
              <ArrowRightLeft size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clockCard}
              onPress={() => setShowRemotePicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.clockLabelRow}>
                <Globe size={12} color="#F59E0B" />
                <Text style={styles.clockLabelRemote}>SET TO</Text>
              </View>
              <Text style={styles.clockCity}>{remoteTz.city}</Text>
              <Text style={styles.clockTimeRemote}>{remoteTime}</Text>
              <Text style={styles.clockDate}>{remoteDate}</Text>
              <View style={styles.changeBtnRow}>
                <Text style={styles.changeTextRemote}>Change</Text>
                <ChevronDown size={12} color="#F59E0B" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.offsetBanner}>
            <Clock size={14} color="#FFFFFF" />
            <Text style={styles.offsetBannerText}>
              {`${remoteTz.city} is `}
              <Text style={styles.offsetBannerHighlight}>{offset}</Text>
              {` from ${localTz.city}`}
            </Text>
          </View>

          <View style={styles.meetingSection}>
            <View style={styles.meetingSectionHeader}>
              <CalendarClock size={14} color="#00ACC1" />
              <Text style={styles.meetingSectionTitle}>Meeting Time Converter</Text>
            </View>

            <View style={styles.meetingInputRow}>
              <TextInput
                style={styles.meetingInput}
                placeholder="e.g. 2:30 PM"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={meetingTimeInput}
                onChangeText={(text) => {
                  setMeetingTimeInput(text);
                }}
                onSubmitEditing={handleConvertMeeting}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.convertBtn}
                onPress={handleConvertMeeting}
                activeOpacity={0.7}
              >
                <Text style={styles.convertBtnText}>Convert</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.meetingFromRow}>
              <Text style={styles.meetingFromLabel}>Meeting is in:</Text>
              <TouchableOpacity
                style={[
                  styles.meetingFromChip,
                  meetingFrom === 'local' && styles.meetingFromChipActive,
                ]}
                onPress={() => setMeetingFrom('local')}
              >
                <Text
                  style={[
                    styles.meetingFromChipText,
                    meetingFrom === 'local' && styles.meetingFromChipTextActive,
                  ]}
                >
                  {localTz.city}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.meetingFromChip,
                  meetingFrom === 'remote' && styles.meetingFromChipActiveRemote,
                ]}
                onPress={() => setMeetingFrom('remote')}
              >
                <Text
                  style={[
                    styles.meetingFromChipText,
                    meetingFrom === 'remote' && styles.meetingFromChipTextActive,
                  ]}
                >
                  {remoteTz.city}
                </Text>
              </TouchableOpacity>
            </View>

            {convertedMeetingTime !== '' && meetingTimeInput.trim() !== '' ? (
              <View style={styles.meetingResult}>
                <View style={styles.meetingResultRow}>
                  <View style={styles.meetingResultSide}>
                    <Text style={styles.meetingResultLabel}>
                      {meetingFrom === 'local' ? localTz.city : remoteTz.city}
                    </Text>
                    <Text style={styles.meetingResultTime}>{meetingTimeInput.trim()}</Text>
                  </View>
                  <View style={styles.meetingResultArrow}>
                    <ArrowRightLeft size={14} color="rgba(255,255,255,0.4)" />
                  </View>
                  <View style={styles.meetingResultSide}>
                    <Text style={styles.meetingResultLabel}>
                      {meetingFrom === 'local' ? remoteTz.city : localTz.city}
                    </Text>
                    <Text style={styles.meetingResultTimeHighlight}>
                      {convertedMeetingTime}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <TimeZonePickerModal
        visible={showLocalPicker}
        onClose={() => setShowLocalPicker(false)}
        onSelect={handleSelectLocal}
        title="Select Your Location"
      />
      <TimeZonePickerModal
        visible={showRemotePicker}
        onClose={() => setShowRemotePicker(false)}
        onSelect={handleSelectRemote}
        title="Set Destination Time Zone"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 172, 193, 0.25)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 172, 193, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  offsetChip: {
    backgroundColor: 'rgba(0, 172, 193, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
  },
  offsetChipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#00ACC1',
  },
  collapsedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  previewClock: {
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  previewTime: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  expandedContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  dualClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  clockCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  clockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  clockLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#00ACC1',
    letterSpacing: 1,
  },
  clockLabelRemote: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F59E0B',
    letterSpacing: 1,
  },
  clockCity: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  clockTime: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#00ACC1',
    marginBottom: 2,
  },
  clockTimeRemote: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#F59E0B',
    marginBottom: 2,
  },
  clockDate: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  changeBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#00ACC1',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  changeTextRemote: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#F59E0B',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offsetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  offsetBannerText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: 'rgba(255,255,255,0.7)',
  },
  offsetBannerHighlight: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  meetingSection: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  meetingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  meetingSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  meetingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  meetingInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  convertBtn: {
    backgroundColor: '#00ACC1',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
  },
  convertBtnText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  meetingFromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  meetingFromLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
  },
  meetingFromChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  meetingFromChipActive: {
    backgroundColor: 'rgba(0, 172, 193, 0.2)',
    borderColor: '#00ACC1',
  },
  meetingFromChipActiveRemote: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  meetingFromChipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  meetingFromChipTextActive: {
    color: '#FFFFFF',
  },
  meetingResult: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(0, 172, 193, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 172, 193, 0.2)',
  },
  meetingResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingResultSide: {
    flex: 1,
    alignItems: 'center',
  },
  meetingResultLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  meetingResultTime: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#FFFFFF',
  },
  meetingResultArrow: {
    paddingHorizontal: SPACING.sm,
  },
  meetingResultTimeHighlight: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#00ACC1',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1A2F4A',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: SPACING.lg,
  },
  regionHeader: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  tzItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tzLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: '#FFFFFF',
  },
  tzTime: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  noResults: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: TYPOGRAPHY.fontSizeSM,
    paddingVertical: SPACING.xxl,
  },
});
