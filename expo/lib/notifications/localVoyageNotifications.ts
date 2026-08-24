import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { VoyageNotificationPlanItem } from './cruiseNotificationPlan';
import { isEasySeasVoyageNotificationId } from './cruiseNotificationPlan';

const CHANNEL_ID = 'voyage-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Voyage reminders',
    description: 'Check-in, final payment, sailing, offer, and certificate reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#0F766E',
  });
}

export async function requestVoyageNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return requested.granted;
}

export async function reconcileVoyageNotifications(plan: VoyageNotificationPlanItem[]): Promise<{ scheduled: number; cancelled: number; permissionGranted: boolean }> {
  if (Platform.OS === 'web') return { scheduled: 0, cancelled: 0, permissionGranted: false };
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { scheduled: 0, cancelled: 0, permissionGranted: false };
  await ensureAndroidChannel();

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Map(scheduled
    .filter((request) => isEasySeasVoyageNotificationId(request.identifier))
    .map((request) => [request.identifier, request]));
  const desiredIds = new Set(plan.map((item) => item.id));
  let cancelledCount = 0;
  let scheduledCount = 0;

  for (const request of existing.values()) {
    const desired = plan.find((item) => item.id === request.identifier);
    const storedTriggerAt = typeof request.content.data?.triggerAt === 'string' ? request.content.data.triggerAt : null;
    if (!desiredIds.has(request.identifier) || storedTriggerAt !== desired?.triggerAt) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
      existing.delete(request.identifier);
      cancelledCount += 1;
    }
  }

  for (const item of plan) {
    if (existing.has(item.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: item.title,
        body: item.body,
        data: {
          route: item.route,
          entityId: item.entityId,
          kind: item.kind,
          triggerAt: item.triggerAt,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(item.triggerAt),
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
    scheduledCount += 1;
  }

  return { scheduled: scheduledCount, cancelled: cancelledCount, permissionGranted: true };
}

export async function cancelAllVoyageNotifications(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const owned = scheduled.filter((request) => isEasySeasVoyageNotificationId(request.identifier));
  await Promise.all(owned.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  return owned.length;
}
