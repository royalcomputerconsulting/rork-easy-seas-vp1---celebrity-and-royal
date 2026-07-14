import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Deep-linkable address for the Cruise Value section of the Casino
 * dashboard, e.g. /casino/cruise-value. Redirects into the real Casino
 * screen with the matching internal tab selected so the URL is
 * shareable and survives a refresh on web.
 */
export default function CruiseValueRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/(tabs)/analytics', params: { tab: 'value' } } as any);
  }, [router]);
  return null;
}
