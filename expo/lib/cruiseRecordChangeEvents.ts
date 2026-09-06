export type CruiseRecordChangeKind = 'created' | 'updated' | 'replaced' | 'removed';

export interface CruiseRecordChange {
  cruiseId: string;
  kind: CruiseRecordChangeKind;
  changedFields?: string[];
}

type CruiseRecordChangeListener = (change: CruiseRecordChange) => void;

const listeners = new Set<CruiseRecordChangeListener>();

/**
 * Keeps derived stores (weather, agenda and future calculation caches) in
 * sync without coupling the core-data provider to any UI provider.
 */
export function notifyCruiseRecordChanged(change: CruiseRecordChange): void {
  listeners.forEach((listener) => {
    try {
      listener(change);
    } catch (error) {
      console.warn('[CruiseRecordChangeEvents] Listener failed', error);
    }
  });
}

export function subscribeToCruiseRecordChanges(listener: CruiseRecordChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
