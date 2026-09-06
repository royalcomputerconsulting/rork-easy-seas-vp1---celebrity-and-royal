import { normalizeDateOnly, todayDateOnly, diffDays } from '@/lib/dates/appDate';

export type FutureValueWalletItem = {
  id: string;
  type: 'nextcruise' | 'fcc' | 'annual-cruise' | 'crown-anchor-certificate' | 'instant-certificate' | 'obc' | 'unknown';
  label: string;
  amount: number;
  expirationDate?: string;
  assignedCruiseId?: string;
  status: 'available' | 'assigned' | 'applied' | 'used' | 'expired' | 'unknown';
  source: 'manual' | 'invoice' | 'club-royale' | 'crown-anchor' | 'nextcruise' | 'fcc' | 'unknown';
  notes?: string;
};

export function summarizeFutureValueWallet(items: FutureValueWalletItem[], today = todayDateOnly()) {
  const normalized = items.map(item => {
    const expirationDate = normalizeDateOnly(item.expirationDate);
    const daysRemaining = expirationDate ? diffDays(today, expirationDate) : null;
    const status = daysRemaining !== null && daysRemaining < 0 ? 'expired' : item.status;
    return { ...item, expirationDate: expirationDate ?? item.expirationDate, status, daysRemaining };
  });
  return {
    items: normalized,
    totalAvailable: normalized.filter(item => item.status === 'available').reduce((sum, item) => sum + item.amount, 0),
    totalAssigned: normalized.filter(item => item.status === 'assigned' || item.status === 'applied').reduce((sum, item) => sum + item.amount, 0),
    expiringSoon: normalized.filter(item => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 30),
    expired: normalized.filter(item => item.status === 'expired'),
    warnings: ['Expired values remain visible for audit/history instead of being deleted.'],
  };
}
