import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { getCertificateMonthAvailability } from '@/lib/certificates/certificateCatalog';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function useCertificateMonthAvailability(publicationWindowDays = 10) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      const next = new Date();
      setToday((current) => dayKey(current) === dayKey(next) ? current : next);
    };
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return useMemo(
    () => getCertificateMonthAvailability(today, publicationWindowDays),
    [publicationWindowDays, today],
  );
}
