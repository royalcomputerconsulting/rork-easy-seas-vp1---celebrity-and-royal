import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Deep-linkable address for the Simulator section, e.g. /casino/simulator.
 * The simulator lives inside the History & Simulator internal tab, so this
 * redirects there.
 */
export default function SimulatorRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace({ pathname: '/(tabs)/analytics', params: { tab: 'history' } } as any);
  }, [router]);
  return null;
}
