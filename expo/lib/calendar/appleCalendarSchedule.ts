import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const APPLE_CALENDAR_SELECTION_PREFIX = '@easyseas/apple-calendar-selection/v1';

type NativeCalendarRecord = {
  id: string;
  title: string;
  color?: string | null;
  allowsModifications?: boolean;
};

type NativeCalendarEvent = {
  id: string;
  calendarId: string;
  title?: string | null;
  location?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  allDay?: boolean;
};

type NativeCalendarModule = {
  EntityTypes: { EVENT: unknown };
  isAvailableAsync?: () => Promise<boolean>;
  getCalendarPermissionsAsync: () => Promise<{ status: string; canAskAgain?: boolean }>;
  requestCalendarPermissionsAsync: () => Promise<{ status: string; canAskAgain?: boolean }>;
  getCalendarsAsync: (entityType: unknown) => Promise<NativeCalendarRecord[]>;
  getEventsAsync: (calendarIds: string[], startDate: Date, endDate: Date) => Promise<NativeCalendarEvent[]>;
  openEventInCalendarAsync: (params: { id: string; instanceStartDate?: Date }) => Promise<unknown>;
};

export interface AppleCalendarDescriptor {
  id: string;
  title: string;
  color: string | null;
  allowsModifications: boolean;
}

export interface AppleCalendarAgendaEvent {
  id: string;
  calendarId: string;
  calendarTitle: string;
  calendarColor: string;
  title: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}

export type AppleCalendarPermissionState = 'granted' | 'denied' | 'unavailable';

function selectionStorageKey(ownerProfileId?: string | null): string {
  return `${APPLE_CALENDAR_SELECTION_PREFIX}::${ownerProfileId?.trim() || '__no_profile__'}`;
}

function getNativeCalendarModule(): NativeCalendarModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // Runtime load keeps web exports safe; EAS installs this native module from
    // package.json and adds the iOS EventKit usage text from app.json.
    return require('expo-calendar') as NativeCalendarModule;
  } catch {
    return null;
  }
}

function coerceDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function selectedDayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

export async function loadAppleCalendarSelection(ownerProfileId?: string | null): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(selectionStorageKey(ownerProfileId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)))
      : [];
  } catch {
    return [];
  }
}

export async function saveAppleCalendarSelection(ownerProfileId: string | null | undefined, calendarIds: string[]): Promise<void> {
  const normalizedIds = Array.from(new Set(calendarIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    await AsyncStorage.removeItem(selectionStorageKey(ownerProfileId));
    return;
  }
  await AsyncStorage.setItem(selectionStorageKey(ownerProfileId), JSON.stringify(normalizedIds));
}

export async function getAppleCalendarPermissionState(): Promise<AppleCalendarPermissionState> {
  const calendar = getNativeCalendarModule();
  if (!calendar) return 'unavailable';
  const available = calendar.isAvailableAsync ? await calendar.isAvailableAsync() : true;
  if (!available) return 'unavailable';
  const permission = await calendar.getCalendarPermissionsAsync();
  return permission.status === 'granted' ? 'granted' : 'denied';
}

/** Requests access only after an explicit user action. */
export async function requestAppleCalendarPermission(): Promise<AppleCalendarPermissionState> {
  const calendar = getNativeCalendarModule();
  if (!calendar) return 'unavailable';
  const available = calendar.isAvailableAsync ? await calendar.isAvailableAsync() : true;
  if (!available) return 'unavailable';
  const existing = await calendar.getCalendarPermissionsAsync();
  if (existing.status === 'granted') return 'granted';
  const requested = await calendar.requestCalendarPermissionsAsync();
  return requested.status === 'granted' ? 'granted' : 'denied';
}

export async function listAppleEventCalendars(): Promise<AppleCalendarDescriptor[]> {
  const calendar = getNativeCalendarModule();
  if (!calendar) return [];
  const permission = await getAppleCalendarPermissionState();
  if (permission !== 'granted') return [];
  const calendars = await calendar.getCalendarsAsync(calendar.EntityTypes.EVENT);
  return calendars
    .filter((item) => Boolean(item.id && item.title))
    .map((item) => ({
      id: item.id,
      title: item.title,
      color: item.color ?? null,
      allowsModifications: item.allowsModifications === true,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

/**
 * Reads only the requested local day. Event data stays in EventKit and is not
 * added to the Easy Seas backup, CoreData calendar records, or Agent SEA data.
 */
export async function readAppleCalendarDay(
  day: Date,
  selectedCalendarIds: string[],
  knownCalendars: AppleCalendarDescriptor[] = [],
): Promise<AppleCalendarAgendaEvent[]> {
  if (selectedCalendarIds.length === 0) return [];
  const calendar = getNativeCalendarModule();
  if (!calendar || await getAppleCalendarPermissionState() !== 'granted') return [];
  const { start, end } = selectedDayBounds(day);
  const calendarNames = new Map(knownCalendars.map((item) => [item.id, item]));
  const events = await calendar.getEventsAsync(selectedCalendarIds, start, end);
  const resolvedEvents: AppleCalendarAgendaEvent[] = [];
  for (const event of events) {
    const startDate = coerceDate(event.startDate);
    const endDate = coerceDate(event.endDate);
    if (!startDate || !endDate || !event.id) continue;
    const sourceCalendar = calendarNames.get(event.calendarId);
    const location = event.location?.trim();
    resolvedEvents.push({
      id: event.id,
      calendarId: event.calendarId,
      calendarTitle: sourceCalendar?.title ?? 'Apple Calendar',
      calendarColor: sourceCalendar?.color ?? '#0E7FA7',
      title: event.title?.trim() || 'Untitled event',
      ...(location ? { location } : {}),
      startDate,
      endDate,
      allDay: event.allDay === true,
    });
  }
  return resolvedEvents.sort((left, right) => Number(right.allDay) - Number(left.allDay) || left.startDate.getTime() - right.startDate.getTime());
}

/** Opens Apple’s native event sheet; Easy Seas does not write or edit the event itself. */
export async function openAppleCalendarEvent(event: AppleCalendarAgendaEvent): Promise<boolean> {
  const calendar = getNativeCalendarModule();
  if (!calendar) return false;
  await calendar.openEventInCalendarAsync({ id: event.id, instanceStartDate: event.startDate });
  return true;
}
