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
    throw new Error('Database configuration missing');
  }

  db = new Surreal();
  
  await db.connect(endpoint, {
    namespace,
    database: 'easyseas',
    auth: token,
  });

  console.log('[DB] Connected to SurrealDB');
  return db;
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
    console.log('[DB] Disconnected from SurrealDB');
  }
}
