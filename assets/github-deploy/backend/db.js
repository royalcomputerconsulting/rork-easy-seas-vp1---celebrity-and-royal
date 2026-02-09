import Surreal from 'surrealdb.js';

let db = null;
let isConnecting = false;
let lastConnectionTime = 0;
const CONNECTION_TIMEOUT = 5000;
const CONNECTION_RETRY_DELAY = 1000;

async function createConnection() {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    throw new Error('Database configuration missing');
  }

  const newDb = new Surreal();
  
  const connectPromise = newDb.connect(endpoint, {
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

async function testConnection(dbInstance) {
  try {
    await dbInstance.query('SELECT * FROM user_profiles LIMIT 1');
    return true;
  } catch (error) {
    console.log('[DB] Connection test failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function getDb() {
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
    db = null;
    console.error('[DB] Failed to connect:', error instanceof Error ? error.message : String(error));
    throw new Error('Database connection failed: ' + (error instanceof Error ? error.message : String(error)));
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
