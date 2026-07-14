import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Deep-linkable address for the History & Insights section, e.g.
 * /casino/history-insights. Redirects into the real Casino screen with
 * the matching internal tab selected.
 */
export default function HistoryInsightsRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/(tabs)/analytics', params: { tab: 'history' } } as any);
  }, [router]);
  return null;
}
