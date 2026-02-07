import Surreal from 'surrealdb.js';

let db: Surreal | null = null;

export async function getDb() {
  if (db) {
    return db;
  }

  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  if (!endpoint || !namespace || !token) {
    console.log('[DB] Database configuration missing - running in offline mode');
    throw new Error('Database configuration missing');
  }

  try {
    db = new Surreal();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 3000)
    );
    
    const connectPromise = db.connect(endpoint, {
      namespace,
      database: 'easyseas',
      auth: token,
    }).catch((err) => {
      console.log('[DB] Connection error caught:', err?.message || 'Unknown error');
      throw err;
    });
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    console.log('[DB] Connected to SurrealDB');
    return db;
  } catch (error) {
    console.log('[DB] Failed to connect to database:', error instanceof Error ? error.message : 'Unknown error');
    db = null;
    throw error;
  }
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
    console.log('[DB] Disconnected from SurrealDB');
  }
}
