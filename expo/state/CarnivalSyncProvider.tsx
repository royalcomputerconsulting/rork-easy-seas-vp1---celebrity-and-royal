import { useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  CarnivalSyncProvider as CarnivalSyncRuntimeProvider,
  useRoyalCaribbeanSync,
} from './RoyalCaribbeanSyncProvider';
import { useAuth } from './AuthProvider';
import { useUser } from './UserProvider';

interface LocalCarnivalSyncAccess {
  enabled: boolean;
  reason: string;
}

function getLocalCarnivalSyncAccess(
  isAuthenticated: boolean,
  profileId: string | null | undefined,
): LocalCarnivalSyncAccess {
  if (!isAuthenticated || !String(profileId ?? '').trim()) {
    return {
      enabled: false,
      reason: 'Sign in and select an EasySeas profile to sync Carnival data.',
    };
  }

  return {
    enabled: true,
    reason: 'Carnival sync is available for this signed-in profile.',
  };
}

/**
 * Carnival screens receive only Carnival operations. The legacy runtime stays
 * behind this boundary while its transport code is progressively extracted.
 */
export function CarnivalSyncProvider({ children }: { children: ReactNode }) {
  return <CarnivalSyncRuntimeProvider>{children}</CarnivalSyncRuntimeProvider>;
}

export function useCarnivalSync() {
  const runtime = useRoyalCaribbeanSync();
  const { isAuthenticated } = useAuth();
  const { currentUser } = useUser();
  const carnivalSyncAccess = getLocalCarnivalSyncAccess(isAuthenticated, currentUser?.id);
  const requireCarnivalAccess = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!carnivalSyncAccess.enabled) {
      throw new Error(carnivalSyncAccess.reason);
    }
    return operation();
  }, [carnivalSyncAccess.enabled, carnivalSyncAccess.reason]);
  const runIngestion = useCallback(
    () => requireCarnivalAccess(runtime.runIngestion),
    [requireCarnivalAccess, runtime.runIngestion],
  );
  const resumeCarnivalSync = useCallback(
    () => requireCarnivalAccess(runtime.resumeCarnivalSync),
    [requireCarnivalAccess, runtime.resumeCarnivalSync],
  );

  return {
    state: runtime.state,
    webViewRef: runtime.webViewRef,
    config: runtime.config,
    openLogin: runtime.openLogin,
    runIngestion,
    resumeCarnivalSync,
    syncToApp: runtime.syncToApp,
    cancelSync: runtime.cancelSync,
    handleWebViewMessage: runtime.handleWebViewMessage,
    addLog: runtime.addLog,
    getSyncLogs: runtime.getSyncLogs,
    extendedLoyaltyData: runtime.extendedLoyaltyData,
    webViewUrl: runtime.webViewUrl,
    onPageLoaded: runtime.onPageLoaded,
    carnivalSyncAccess,
  };
}
