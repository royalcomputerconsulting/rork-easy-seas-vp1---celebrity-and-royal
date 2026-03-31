import Surreal from "surrealdb.js";

const CLOUD_DB_NAME = "easyseas";
const CLOUD_USER_TABLE = "user_profiles";
const CLOUD_CONNECTION_TIMEOUT_MS = 6000;
const CLOUD_CONNECTION_RETRY_DELAY_MS = 250;
const CLOUD_HEALTH_CACHE_MS = 60_000;

export interface CloudUserDataRecord {
  email: string;
  cruises?: unknown[];
  bookedCruises?: unknown[];
  casinoOffers?: unknown[];
  calendarEvents?: unknown[];
  casinoSessions?: unknown[];
  clubRoyaleProfile?: unknown;
  settings?: unknown;
  userPoints?: number;
  certificates?: unknown[];
  alerts?: unknown[];
  alertRules?: unknown[];
  slotAtlas?: unknown[];
  loyaltyData?: unknown;
  bankrollData?: unknown;
  celebrityData?: unknown;
  crewRecognitionEntries?: unknown[];
  crewRecognitionSailings?: unknown[];
  updatedAt: string;
  createdAt?: string;
}

export interface CloudUserDataPayload {
  email: string;
  cruises?: unknown[];
  bookedCruises?: unknown[];
  casinoOffers?: unknown[];
  calendarEvents?: unknown[];
  casinoSessions?: unknown[];
  clubRoyaleProfile?: unknown;
  settings?: unknown;
  userPoints?: number;
  certificates?: unknown[];
  alerts?: unknown[];
  alertRules?: unknown[];
  slotAtlas?: unknown[];
  loyaltyData?: unknown;
  bankrollData?: unknown;
  celebrityData?: unknown;
  crewRecognitionEntries?: unknown[];
  crewRecognitionSailings?: unknown[];
}

export interface CloudUserDataQueryResult {
  found: boolean;
  data: CloudUserDataRecord | null;
}

let cloudDb: Surreal | null = null;
let isConnectingCloudDb = false;
let lastCloudHealthCheck = 0;
let lastCloudReachable: boolean | null = null;

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function getCloudConfig() {
  const endpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
  const namespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
  const token = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

  return {
    endpoint,
    namespace,
    token,
  };
}

export function isDirectCloudStoreConfigured(): boolean {
  const { endpoint, namespace, token } = getCloudConfig();
  return Boolean(endpoint && namespace && token);
}

async function waitForCloudConnectionTurn(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), CLOUD_CONNECTION_RETRY_DELAY_MS);
  });
}

async function createCloudConnection(): Promise<Surreal> {
  const { endpoint, namespace, token } = getCloudConfig();

  if (!endpoint || !namespace || !token) {
    throw new Error("DIRECT_CLOUD_STORE_NOT_CONFIGURED");
  }

  const db = new Surreal();

  const connectionPromise = db.connect(endpoint, {
    namespace,
    database: CLOUD_DB_NAME,
    auth: token,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("DIRECT_CLOUD_STORE_TIMEOUT"));
    }, CLOUD_CONNECTION_TIMEOUT_MS);
  });

  await Promise.race([connectionPromise, timeoutPromise]);
  console.log("[CloudStore] Direct cloud store connected");

  return db;
}

async function testCloudConnection(db: Surreal): Promise<boolean> {
  try {
    await db.query(`SELECT email FROM ${CLOUD_USER_TABLE} LIMIT 1`);
    return true;
  } catch (error) {
    console.log("[CloudStore] Direct cloud store healthcheck failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function getCloudDb(): Promise<Surreal> {
  if (isConnectingCloudDb) {
    await waitForCloudConnectionTurn();
    return getCloudDb();
  }

  if (cloudDb) {
    const isCacheFresh = Date.now() - lastCloudHealthCheck < CLOUD_HEALTH_CACHE_MS;
    if (isCacheFresh && lastCloudReachable !== false) {
      return cloudDb;
    }

    const healthy = await testCloudConnection(cloudDb);
    lastCloudHealthCheck = Date.now();
    lastCloudReachable = healthy;

    if (healthy) {
      return cloudDb;
    }

    try {
      await cloudDb.close();
    } catch (error) {
      console.log("[CloudStore] Failed closing stale direct cloud connection:", error instanceof Error ? error.message : String(error));
    }

    cloudDb = null;
  }

  isConnectingCloudDb = true;
  try {
    cloudDb = await createCloudConnection();
    lastCloudHealthCheck = Date.now();
    lastCloudReachable = true;
    return cloudDb;
  } catch (error) {
    cloudDb = null;
    lastCloudReachable = false;
    lastCloudHealthCheck = Date.now();
    console.error("[CloudStore] Direct cloud store connection failed:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    isConnectingCloudDb = false;
  }
}

export async function isDirectCloudStoreReachable(): Promise<boolean> {
  if (!isDirectCloudStoreConfigured()) {
    return false;
  }

  try {
    await getCloudDb();
    return true;
  } catch (error) {
    console.log("[CloudStore] Direct cloud store unavailable:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

function buildCloudUserDataRecord(
  input: CloudUserDataPayload,
  existingData: CloudUserDataRecord | undefined,
  updatedAt: string
): CloudUserDataRecord {
  return {
    email: normalizeEmail(input.email),
    cruises: input.cruises ?? existingData?.cruises ?? [],
    bookedCruises: input.bookedCruises ?? existingData?.bookedCruises ?? [],
    casinoOffers: input.casinoOffers ?? existingData?.casinoOffers ?? [],
    calendarEvents: input.calendarEvents ?? existingData?.calendarEvents ?? [],
    casinoSessions: input.casinoSessions ?? existingData?.casinoSessions ?? [],
    clubRoyaleProfile: input.clubRoyaleProfile ?? existingData?.clubRoyaleProfile,
    settings: input.settings ?? existingData?.settings,
    userPoints: input.userPoints ?? existingData?.userPoints ?? 0,
    certificates: input.certificates ?? existingData?.certificates ?? [],
    alerts: input.alerts ?? existingData?.alerts ?? [],
    alertRules: input.alertRules ?? existingData?.alertRules ?? [],
    slotAtlas: input.slotAtlas ?? existingData?.slotAtlas ?? [],
    loyaltyData: input.loyaltyData ?? existingData?.loyaltyData,
    bankrollData: input.bankrollData ?? existingData?.bankrollData,
    celebrityData: input.celebrityData ?? existingData?.celebrityData,
    crewRecognitionEntries: input.crewRecognitionEntries ?? existingData?.crewRecognitionEntries ?? [],
    crewRecognitionSailings: input.crewRecognitionSailings ?? existingData?.crewRecognitionSailings ?? [],
    updatedAt,
    createdAt: existingData?.createdAt ?? updatedAt,
  };
}

export async function getCloudUserDataFallback(email: string): Promise<CloudUserDataQueryResult> {
  const db = await getCloudDb();
  const normalizedEmail = normalizeEmail(email);

  console.log("[CloudStore] Loading user data directly from cloud store for:", normalizedEmail);

  const results = await db.query<[CloudUserDataRecord[]]>(
    `SELECT * FROM ${CLOUD_USER_TABLE} WHERE email = $email LIMIT 1`,
    { email: normalizedEmail }
  );

  const data = results?.[0]?.[0] ?? null;

  if (!data) {
    console.log("[CloudStore] No direct cloud data found for:", normalizedEmail);
    return {
      found: false,
      data: null,
    };
  }

  console.log("[CloudStore] Direct cloud data found:", {
    email: normalizedEmail,
    availableCruises: data.cruises?.length ?? 0,
    cruises: data.bookedCruises?.length ?? 0,
    offers: data.casinoOffers?.length ?? 0,
    events: data.calendarEvents?.length ?? 0,
    sessions: data.casinoSessions?.length ?? 0,
    crewEntries: data.crewRecognitionEntries?.length ?? 0,
    crewSailings: data.crewRecognitionSailings?.length ?? 0,
  });

  return {
    found: true,
    data,
  };
}

export async function saveCloudUserDataFallback(input: CloudUserDataPayload): Promise<{ success: boolean; updatedAt: string }> {
  const db = await getCloudDb();
  const normalizedEmail = normalizeEmail(input.email);
  const updatedAt = new Date().toISOString();

  console.log("[CloudStore] Saving user data directly to cloud store for:", normalizedEmail);

  const existingResults = await db.query<[CloudUserDataRecord[]]>(
    `SELECT * FROM ${CLOUD_USER_TABLE} WHERE email = $email LIMIT 1`,
    { email: normalizedEmail }
  );

  const existingData = existingResults?.[0]?.[0];
  const dataToSave = buildCloudUserDataRecord({
    ...input,
    email: normalizedEmail,
  }, existingData, updatedAt);

  if (existingData) {
    await db.query(
      `UPDATE ${CLOUD_USER_TABLE} SET 
        cruises = $cruises,
        bookedCruises = $bookedCruises,
        casinoOffers = $casinoOffers,
        calendarEvents = $calendarEvents,
        casinoSessions = $casinoSessions,
        clubRoyaleProfile = $clubRoyaleProfile,
        settings = $settings,
        userPoints = $userPoints,
        certificates = $certificates,
        alerts = $alerts,
        alertRules = $alertRules,
        slotAtlas = $slotAtlas,
        loyaltyData = $loyaltyData,
        bankrollData = $bankrollData,
        celebrityData = $celebrityData,
        crewRecognitionEntries = $crewRecognitionEntries,
        crewRecognitionSailings = $crewRecognitionSailings,
        updatedAt = $updatedAt
      WHERE email = $email`,
      dataToSave as unknown as Record<string, unknown>
    );
    console.log("[CloudStore] Direct cloud user profile updated:", normalizedEmail);
  } else {
    await db.query(
      `CREATE ${CLOUD_USER_TABLE} CONTENT $data`,
      { data: dataToSave as unknown as Record<string, unknown> }
    );
    console.log("[CloudStore] Direct cloud user profile created:", normalizedEmail);
  }

  return {
    success: true,
    updatedAt,
  };
}
