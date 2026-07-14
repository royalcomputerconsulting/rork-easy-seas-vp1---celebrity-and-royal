import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Deep-linkable address for the Casino Action Center section, e.g.
 * /casino/action-center. Redirects into the real Casino screen with the
 * matching internal tab selected.
 */
export default function ActionCenterRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/(tabs)/analytics', params: { tab: 'action' } } as any);
  }, [router]);
  return null;
}
