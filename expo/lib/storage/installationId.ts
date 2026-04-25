import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALLATION_ID_KEY = 'easyseas_installation_id_v1';
let cachedInstallationId: string | null = null;
let pendingInstallationId: Promise<string> | null = null;

function createInstallationId(): string {
  const randomPart = Math.random().toString(36).slice(2, 12);
  const timePart = Date.now().toString(36);
  return `install_${timePart}_${randomPart}`;
}

export async function getInstallationId(): Promise<string> {
  if (cachedInstallationId) {
    return cachedInstallationId;
  }

  if (pendingInstallationId) {
    return pendingInstallationId;
  }

  pendingInstallationId = (async () => {
    try {
      const storedValue = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
      if (storedValue && storedValue.trim().length > 0) {
        cachedInstallationId = storedValue.trim();
        return cachedInstallationId;
      }

      const nextInstallationId = createInstallationId();
      await AsyncStorage.setItem(INSTALLATION_ID_KEY, nextInstallationId);
      cachedInstallationId = nextInstallationId;
      console.log('[InstallationId] Created app installation scope:', nextInstallationId);
      return nextInstallationId;
    } catch (error) {
      const fallbackInstallationId = createInstallationId();
      cachedInstallationId = fallbackInstallationId;
      console.error('[InstallationId] Failed to read installation id, using runtime fallback:', error);
      return fallbackInstallationId;
    } finally {
      pendingInstallationId = null;
    }
  })();

  return pendingInstallationId;
}

export function buildOwnerScopeId(email: string, installationId: string): string {
  return `${email.toLowerCase().trim()}::${installationId.trim()}`;
}
