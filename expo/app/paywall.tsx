import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PaywallScreen() {
  const router = useRouter();

  useEffect(() => {
    console.log('[Paywall] Redirecting annual paywall to monthly paywall');
    router.replace('/paywall-monthly' as any);
  }, [router]);

  return null;
}
