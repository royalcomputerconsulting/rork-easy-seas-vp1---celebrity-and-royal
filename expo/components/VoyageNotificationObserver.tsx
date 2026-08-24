import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCoreData } from '@/state/CoreDataProvider';
import { useAppState } from '@/state/AppStateProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { buildVoyageNotificationPlan } from '@/lib/notifications/cruiseNotificationPlan';
import { cancelAllVoyageNotifications, reconcileVoyageNotifications } from '@/lib/notifications/localVoyageNotifications';

function getResponseRoute(response: Notifications.NotificationResponse | null): string | null {
  const route = response?.notification.request.content.data?.route;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

export function VoyageNotificationObserver() {
  const router = useRouter();
  const { bookedCruises, casinoOffers } = useCoreData();
  const { settings } = useAppState();
  const { searchableCertificates } = useCertificates();
  const handledResponseRef = useRef<string | null>(null);
  const planSignatureRef = useRef<string | null>(null);
  const notificationPlan = useMemo(() => buildVoyageNotificationPlan({
    bookedCruises,
    offers: casinoOffers,
    certificates: searchableCertificates,
    horizonDays: 180,
    maxItems: 32,
  }), [bookedCruises, casinoOffers, searchableCertificates]);

  useEffect(() => {
    const enabled = settings.dailySummaryNotifications === true;
    const signature = enabled
      ? notificationPlan.map((item) => `${item.id}:${item.triggerAt}`).join('|')
      : 'disabled';
    if (planSignatureRef.current === signature) return;
    planSignatureRef.current = signature;

    const timeout = setTimeout(() => {
      const operation = enabled
        ? reconcileVoyageNotifications(notificationPlan)
        : cancelAllVoyageNotifications().then((cancelled) => ({ scheduled: 0, cancelled, permissionGranted: false }));
      void operation.then((result) => {
        console.log('[VoyageNotifications] Local reminder plan reconciled:', {
          enabled,
          planned: notificationPlan.length,
          ...result,
        });
      }).catch((error) => {
        console.warn('[VoyageNotifications] Local reminder reconciliation failed without affecting app data:', error);
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [notificationPlan, settings.dailySummaryNotifications]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const openResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const identifier = response.notification.request.identifier;
      if (handledResponseRef.current === identifier) return;
      const route = getResponseRoute(response);
      if (!route) return;
      handledResponseRef.current = identifier;
      router.push(route as never);
    };

    void Notifications.getLastNotificationResponseAsync().then(openResponse).catch((error) => {
      console.warn('[VoyageNotifications] Could not read the launch notification response:', error);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, [router]);

  return null;
}
