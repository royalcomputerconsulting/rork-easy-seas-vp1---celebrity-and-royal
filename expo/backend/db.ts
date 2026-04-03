import Surreal from 'surrealdb.js';

let db: Surreal | null = null;
let isConnecting = false;
let lastConnectionTime = 0;
const CONNECTION_TIMEOUT = 5000;
const CONNECTION_RETRY_DELAY = 1000;
const RPC_SUFFIX = '/rpc';
const DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE';

function normalizeEndpoint(endpoint: string): string {
  const trimmedEndpoint = endpoint.trim().replace(/\/+$/, '');

  if (!trimmedEndpoint) {
    return trimmedEndpoint;
  }

  if (trimmedEndpoint.endsWith(RPC_SUFFIX)) {
    return trimmedEndpoint;
  }

  return `${trimmedEndpoint}${RPC_SUFFIX}`;
}

function getDatabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch {
      return '[unserializable error object]';
    }
  }

  return String(error);
}

function normalizeDatabaseConnectionError(error: unknown): Error {
  const errorMessage = getDatabaseErrorMessage(error);
  const normalizedMessage = errorMessage.toLowerCase();
  const isNotFoundResponse =
    errorMessage.includes('"code":"not_found"') ||
    errorMessage.includes('The requested resource was not found');
  const isUnsupportedVersionResponse =
    errorMessage.includes('reported by the engine is not supported by this library') &&
    isNotFoundResponse;
  const isVersionRetrievalFailure =
    errorMessage.includes('VersionRetrievalFailure') ||
    errorMessage.includes('Failed to retrieve remote version');
  const isNetworkFailure =
    error instanceof TypeError ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('networkerror') ||
    normalizedMessage.includes('load failed') ||
    normalizedMessage.includes('aborterror') ||
    normalizedMessage.includes('connection') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('err_network');

  if (isUnsupportedVersionResponse || isNotFoundResponse || isVersionRetrievalFailure || isNetworkFailure) {
    return new Error(DATABASE_UNAVAILABLE);
  }

  return error instanceof Error ? error : new Error(errorMessage);
}

async function createConnection(): Promise<Surreal> {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    throw new Error('Database configuration missing');
  }

  const newDb = new Surreal();
  
  const connectPromise = newDb.connect(normalizeEndpoint(endpoint), {
    namespace,
    database: 'easyseas',
    auth: token,
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Database connection timeout')), CONNECTION_TIMEOUT);
  });

  await Promise.race([connectPromise, timeoutPromise]);
  
  console.log('[DB] Connected to SurrealDB');
  return newDb;
}

async function testConnection(dbInstance: Surreal): Promise<boolean> {
  try {
    await dbInstance.query('SELECT * FROM user_profiles LIMIT 1');
    return true;
  } catch (error) {
    console.log('[DB] Connection test failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function getDb(): Promise<Surreal> {
  if (isConnecting) {
    console.log('[DB] Connection in progress, waiting...');
    await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
    return getDb();
  }

  if (db) {
    const timeSinceLastConnection = Date.now() - lastConnectionTime;
    if (timeSinceLastConnection < 60000) {
      return db;
    }
    
    const isHealthy = await testConnection(db);
    if (isHealthy) {
      lastConnectionTime = Date.now();
      return db;
    }
    
    console.log('[DB] Connection unhealthy, reconnecting...');
    try {
      await db.close();
    } catch (error) {
      console.log('[DB] Error closing stale connection:', error instanceof Error ? error.message : String(error));
    }
    db = null;
  }

  isConnecting = true;
  try {
    db = await createConnection();
    lastConnectionTime = Date.now();
    return db;
  } catch (error) {
    const normalizedError = normalizeDatabaseConnectionError(error);
    db = null;

    if (normalizedError.message === DATABASE_UNAVAILABLE) {
      console.log('[DB] Database unavailable - endpoint unreachable or did not return a supported SurrealDB RPC response');
      throw normalizedError;
    }

    console.error('[DB] Failed to connect:', normalizedError.message);
    throw new Error('Database connection failed: ' + normalizedError.message);
  } finally {
    isConnecting = false;
  }
}

export async function closeDb() {
  if (db) {
    try {
      await db.close();
      console.log('[DB] Disconnected from SurrealDB');
    } catch (error) {
      console.log('[DB] Error during disconnect:', error instanceof Error ? error.message : String(error));
    } finally {
      db = null;
      lastConnectionTime = 0;
    }
  }
}
