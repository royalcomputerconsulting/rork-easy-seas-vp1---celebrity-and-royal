import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalendarCheck2, CalendarDays, Check, ChevronRight, Link2, LockKeyhole, RefreshCcw, Unplug } from 'lucide-react-native';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';
import {
  type AppleCalendarAgendaEvent,
  type AppleCalendarDescriptor,
  getAppleCalendarPermissionState,
  listAppleEventCalendars,
  loadAppleCalendarSelection,
  openAppleCalendarEvent,
  readAppleCalendarDay,
  requestAppleCalendarPermission,
  saveAppleCalendarSelection,
} from '@/lib/calendar/appleCalendarSchedule';

interface AppleCalendarScheduleProps {
  agendaDate: Date;
  ownerProfileId?: string | null;
  embedded?: boolean;
  onEventsChange?: (events: AppleCalendarAgendaEvent[]) => void;
}

function eventTime(event: AppleCalendarAgendaEvent): string {
  if (event.allDay) return 'All day';
  const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(event.startDate)} – ${formatter.format(event.endDate)}`;
}

export function AppleCalendarSchedule({ agendaDate, ownerProfileId, embedded = false, onEventsChange }: AppleCalendarScheduleProps) {
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [calendars, setCalendars] = useState<AppleCalendarDescriptor[]>([]);
  const [events, setEvents] = useState<AppleCalendarAgendaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [draftCalendarIds, setDraftCalendarIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCalendars = useMemo(
    () => calendars.filter((calendar) => selectedCalendarIds.includes(calendar.id)),
    [calendars, selectedCalendarIds],
  );

  const refreshEvents = useCallback(async (calendarIds = selectedCalendarIds, calendarList = calendars) => {
    if (calendarIds.length === 0) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      setEvents(await readAppleCalendarDay(agendaDate, calendarIds, calendarList));
    } catch {
      setEvents([]);
      setMessage('Apple Calendar could not refresh this day. Your Easy Seas schedule is still available.');
    } finally {
      setIsLoading(false);
    }
  }, [agendaDate, calendars, selectedCalendarIds]);

  useEffect(() => {
    let active = true;
    void loadAppleCalendarSelection(ownerProfileId).then((selection) => {
      if (active) setSelectedCalendarIds(selection);
    });
    return () => { active = false; };
  }, [ownerProfileId]);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    onEventsChange?.(events);
  }, [events, onEventsChange]);

  const openCalendarChooser = useCallback(async () => {
    setIsSelecting(true);
    setMessage(null);
    try {
      const permission = await requestAppleCalendarPermission();
      if (permission === 'unavailable') {
        setMessage('Apple Calendar is available only in an iOS or Android app build.');
        return;
      }
      if (permission !== 'granted') {
        setMessage('Calendar access was not granted. You can enable it later in iOS Settings.');
        return;
      }
      const availableCalendars = await listAppleEventCalendars();
      if (availableCalendars.length === 0) {
        setMessage('No event calendars are available on this device.');
        return;
      }
      setCalendars(availableCalendars);
      const priorSelection = selectedCalendarIds.filter((id) => availableCalendars.some((calendar) => calendar.id === id));
      setDraftCalendarIds(priorSelection.length > 0 ? priorSelection : availableCalendars.map((calendar) => calendar.id));
      setIsPickerVisible(true);
    } catch {
      setMessage('Apple Calendar could not be connected right now.');
    } finally {
      setIsSelecting(false);
    }
  }, [selectedCalendarIds]);

  const saveSelection = useCallback(async () => {
    const selected = Array.from(new Set(draftCalendarIds));
    if (selected.length === 0) {
      setMessage('Choose at least one calendar, or use Disconnect to remove the connection.');
      return;
    }
    setIsSelecting(true);
    try {
      await saveAppleCalendarSelection(ownerProfileId, selected);
      setSelectedCalendarIds(selected);
      setIsPickerVisible(false);
      await refreshEvents(selected, calendars);
    } catch {
      setMessage('Your calendar selection could not be saved.');
    } finally {
      setIsSelecting(false);
    }
  }, [calendars, draftCalendarIds, ownerProfileId, refreshEvents]);

  const disconnect = useCallback(async () => {
    setIsSelecting(true);
    try {
      await saveAppleCalendarSelection(ownerProfileId, []);
      setSelectedCalendarIds([]);
      setEvents([]);
      setMessage('Apple Calendar is disconnected. No schedule data is retained in Easy Seas.');
    } finally {
      setIsSelecting(false);
    }
  }, [ownerProfileId]);

  const toggleCalendar = useCallback((calendarId: string) => {
    setDraftCalendarIds((previous) => previous.includes(calendarId)
      ? previous.filter((id) => id !== calendarId)
      : [...previous, calendarId]);
  }, []);

  const handleOpenEvent = useCallback(async (event: AppleCalendarAgendaEvent) => {
    try {
      const opened = await openAppleCalendarEvent(event);
      if (!opened) setMessage('Open this event from an iOS or Android app build.');
    } catch {
      setMessage('Apple Calendar could not open this event.');
    }
  }, []);

  return (
    <View style={embedded ? styles.embeddedSection : styles.section} testID="apple-calendar-schedule-section">
      {!embedded ? <ThemedSectionHeader
        tab="calendar"
        emoji="🗓️"
        title="Your schedule"
        subtitle="Personal calendar events remain on your device and sit alongside your Easy Seas plans."
        compact
        testID="apple-calendar-schedule-heading"
      /> : null}

      {selectedCalendarIds.length === 0 ? (
        <View style={styles.connectCard}>
          <View style={styles.connectIcon}><CalendarDays size={20} color="#0E7FA7" /></View>
          <View style={styles.connectCopy}>
            <Text style={styles.connectTitle}>Add Apple Calendar</Text>
            <Text style={styles.connectText}>Choose which calendars appear here. Easy Seas reads the displayed day only.</Text>
          </View>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={openCalendarChooser}
            disabled={isSelecting}
            accessibilityRole="button"
            accessibilityLabel="Connect Apple Calendar"
            testID="apple-calendar-connect"
          >
            {isSelecting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Link2 size={15} color="#FFFFFF" /><Text style={styles.connectButtonText}>Connect</Text></>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={embedded ? styles.embeddedCard : styles.scheduleCard}>
          <View style={styles.scheduleCardHeader}>
            <View style={styles.connectedSummary}>
              <View style={styles.connectedIcon}><CalendarCheck2 size={18} color="#0E7FA7" /></View>
              <View style={styles.connectedCopy}>
                <Text style={styles.connectedTitle}>Apple Calendar connected</Text>
                <Text style={styles.connectedMeta}>{selectedCalendarIds.length} selected {selectedCalendarIds.length === 1 ? 'calendar' : 'calendars'} · {events.length} {events.length === 1 ? 'event' : 'events'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void refreshEvents()}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Refresh personal calendar events"
              testID="apple-calendar-refresh"
            >
              <RefreshCcw size={17} color="#0E7FA7" />
            </TouchableOpacity>
          </View>

          {selectedCalendars.length > 0 ? (
            <TouchableOpacity style={styles.calendarSelector} onPress={openCalendarChooser} accessibilityRole="button" accessibilityLabel="Choose Apple calendars" testID="apple-calendar-choose">
              <Text style={styles.calendarSelectorText} numberOfLines={1}>{selectedCalendars.map((calendar) => calendar.title).join(' · ')}</Text>
              <ChevronRight size={16} color="#0E7FA7" />
            </TouchableOpacity>
          ) : null}

          {isLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color="#0E7FA7" /><Text style={styles.loadingText}>Refreshing your schedule</Text></View> : null}

          {!isLoading && events.length === 0 ? <Text style={styles.emptyText}>No selected Apple Calendar events for this day.</Text> : null}

          {!embedded ? events.map((event) => (
            <TouchableOpacity
              key={`${event.id}-${event.startDate.toISOString()}`}
              style={styles.eventRow}
              onPress={() => void handleOpenEvent(event)}
              accessibilityRole="button"
              accessibilityLabel={`Open Apple Calendar event ${event.title}`}
              testID={`apple-calendar-event-${event.id}`}
            >
              <View style={[styles.eventAccent, { backgroundColor: event.calendarColor }]} />
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{eventTime(event)} · {event.calendarTitle}{event.location ? ` · ${event.location}` : ''}</Text>
              </View>
              <ChevronRight size={18} color="#58717D" />
            </TouchableOpacity>
          )) : events.length > 0 ? <Text style={styles.embeddedNotice}>{events.length} personal {events.length === 1 ? 'event is' : 'events are'} placed in the agenda below.</Text> : null}

          <TouchableOpacity style={styles.disconnectButton} onPress={() => void disconnect()} disabled={isSelecting} accessibilityRole="button" accessibilityLabel="Disconnect Apple Calendar" testID="apple-calendar-disconnect">
            <Unplug size={14} color="#58717D" />
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {message ? <View style={styles.message}><LockKeyhole size={14} color="#58717D" /><Text style={styles.messageText}>{message}</Text></View> : null}

      <Modal visible={isPickerVisible} transparent animationType="slide" onRequestClose={() => setIsPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="apple-calendar-picker">
            <Text style={styles.modalEyebrow}>APPLE CALENDAR</Text>
            <Text style={styles.modalTitle}>Choose calendars</Text>
            <Text style={styles.modalText}>Easy Seas will read events only for the day you are viewing. Event details are not backed up or sent to Agent SEA.</Text>
            <ScrollView style={styles.calendarList} contentContainerStyle={styles.calendarListContent}>
              {calendars.map((calendar) => {
                const selected = draftCalendarIds.includes(calendar.id);
                return (
                  <TouchableOpacity key={calendar.id} style={styles.calendarOption} onPress={() => toggleCalendar(calendar.id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
                    <View style={[styles.colorDot, { backgroundColor: calendar.color || '#0E7FA7' }]} />
                    <Text style={styles.calendarOptionTitle}>{calendar.title}</Text>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check size={14} color="#FFFFFF" /> : null}</View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsPickerVisible(false)} accessibilityRole="button"><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => void saveSelection()} disabled={isSelecting} accessibilityRole="button" testID="apple-calendar-save-selection">
                {isSelecting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Show schedule</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.lg },
  embeddedSection: { borderTopWidth: 1, borderTopColor: '#E4EAEE' },
  connectCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#D5D5D0', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  connectIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F7F5' },
  connectCopy: { flex: 1, minWidth: 0 },
  connectTitle: { color: '#17324D', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18 },
  connectText: { marginTop: 2, color: '#58717D', fontSize: 12, lineHeight: 17 },
  connectButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 20, gap: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E7FA7' },
  connectButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  scheduleCard: { backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#D5D5D0', borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  embeddedCard: { backgroundColor: '#FFFDF9', overflow: 'hidden' },
  scheduleCardHeader: { padding: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  connectedSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  connectedIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F7F5' },
  connectedCopy: { flex: 1 },
  connectedTitle: { color: '#17324D', fontSize: 14, fontWeight: '800' },
  connectedMeta: { marginTop: 2, color: '#58717D', fontSize: 12 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B9DCE3', backgroundColor: '#F5FBFA' },
  calendarSelector: { minHeight: 38, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: '#D5D5D0', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#F5F5F4' },
  calendarSelectorText: { flex: 1, color: '#365461', fontSize: 12, fontWeight: '600' },
  loadingRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  loadingText: { color: '#58717D', fontSize: 12 },
  emptyText: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, color: '#58717D', fontSize: 13 },
  embeddedNotice: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, color: '#0E7FA7', fontSize: 12, fontWeight: '700' },
  eventRow: { minHeight: 58, marginHorizontal: SPACING.md, marginBottom: SPACING.xs, borderWidth: 1, borderColor: '#E3E7E6', borderRadius: BORDER_RADIUS.md, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF' },
  eventAccent: { width: 4, alignSelf: 'stretch' },
  eventCopy: { flex: 1, paddingVertical: 9, paddingHorizontal: SPACING.sm },
  eventTitle: { color: '#17324D', fontSize: 14, fontWeight: '800' },
  eventMeta: { marginTop: 2, color: '#58717D', fontSize: 11 },
  disconnectButton: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: SPACING.md, margin: SPACING.md, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  disconnectText: { color: '#58717D', fontSize: 12, fontWeight: '700' },
  message: { marginTop: SPACING.sm, flexDirection: 'row', gap: SPACING.xs, alignItems: 'flex-start', backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: '#D5D5D0', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm },
  messageText: { flex: 1, color: '#58717D', fontSize: 12, lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(14, 31, 47, 0.42)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '80%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACING.lg, backgroundColor: '#FFFDF9' },
  modalEyebrow: { color: '#0E7FA7', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  modalTitle: { marginTop: 4, color: '#17324D', fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 28 },
  modalText: { marginTop: SPACING.xs, color: '#58717D', fontSize: 13, lineHeight: 19 },
  calendarList: { maxHeight: 340, marginTop: SPACING.md },
  calendarListContent: { gap: SPACING.xs, paddingBottom: SPACING.sm },
  calendarOption: { minHeight: 52, paddingHorizontal: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: '#D5D5D0' },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  calendarOptionTitle: { flex: 1, color: '#17324D', fontSize: 14, fontWeight: '700' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#AAB7BC', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: '#0E7FA7', backgroundColor: '#0E7FA7' },
  modalActions: { marginTop: SPACING.md, flexDirection: 'row', gap: SPACING.sm },
  cancelButton: { flex: 1, minHeight: 48, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#B4C1C4' },
  cancelText: { color: '#365461', fontSize: 14, fontWeight: '800' },
  saveButton: { flex: 1.4, minHeight: 48, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E7FA7' },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
