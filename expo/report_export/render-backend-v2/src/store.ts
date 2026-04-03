import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface SimpleUserDataRecord {
  userId: string;
  bookedCruises: unknown[];
  casinoOffers: unknown[];
  updatedAt: string;
  createdAt: string;
}

export interface UserProfileRecord {
  email: string;
  cruises: unknown[];
  bookedCruises: unknown[];
  casinoOffers: unknown[];
  calendarEvents: unknown[];
  casinoSessions: unknown[];
  clubRoyaleProfile?: unknown;
  settings?: unknown;
  userPoints: number;
  certificates: unknown[];
  alerts: unknown[];
  alertRules: unknown[];
  slotAtlas: unknown[];
  loyaltyData?: unknown;
  bankrollData?: unknown;
  celebrityData?: unknown;
  crewRecognitionEntries: unknown[];
  crewRecognitionSailings: unknown[];
  updatedAt: string;
  createdAt: string;
}

export interface CalendarFeedRecord {
  email: string;
  token: string;
  icsContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrewMemberRecord {
  id: string;
  fullName: string;
  department: string;
  roleTitle?: string;
  notes?: string;
  userId: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SailingRecord {
  id: string;
  shipName: string;
  sailStartDate: string;
  sailEndDate: string;
  nights?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecognitionEntryRecord {
  id: string;
  crewMemberId: string;
  sailingId: string;
  shipName: string;
  sailStartDate: string;
  sailEndDate: string;
  sailingMonth: string;
  sailingYear: number;
  department: string;
  roleTitle?: string;
  sourceText?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EasySeasDatabase {
  version: number;
  updatedAt: string;
  simpleUserData: Record<string, SimpleUserDataRecord>;
  userProfiles: Record<string, UserProfileRecord>;
  calendarFeeds: Record<string, CalendarFeedRecord>;
  crewMembers: Record<string, CrewMemberRecord>;
  sailings: Record<string, SailingRecord>;
  recognitionEntries: Record<string, RecognitionEntryRecord>;
}

const DEFAULT_DATABASE: EasySeasDatabase = {
  version: 2,
  updatedAt: new Date(0).toISOString(),
  simpleUserData: {},
  userProfiles: {},
  calendarFeeds: {},
  crewMembers: {},
  sailings: {},
  recognitionEntries: {},
};

let cachedDatabase: EasySeasDatabase | null = null;
let databasePathPromise: Promise<string> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function cloneDefaultDatabase(): EasySeasDatabase {
  return {
    version: DEFAULT_DATABASE.version,
    updatedAt: DEFAULT_DATABASE.updatedAt,
    simpleUserData: {},
    userProfiles: {},
    calendarFeeds: {},
    crewMembers: {},
    sailings: {},
    recognitionEntries: {},
  };
}

function getNowIso(): string {
  return new Date().toISOString();
}

async function resolveDataDirectory(): Promise<string> {
  const configuredDir = process.env.EASY_SEAS_DATA_DIR?.trim() || process.env.DATA_DIR?.trim();
  const directory = configuredDir ? path.resolve(configuredDir) : path.resolve(process.cwd(), 'data');
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

async function getDatabasePath(): Promise<string> {
  if (!databasePathPromise) {
    databasePathPromise = resolveDataDirectory().then((directory) => path.join(directory, 'easy-seas-db.json'));
  }

  return databasePathPromise;
}

async function persistDatabase(database: EasySeasDatabase, label: string): Promise<void> {
  const filePath = await getDatabasePath();
  const tempPath = `${filePath}.tmp`;
  const serialized = JSON.stringify(database, null, 2);

  await fs.writeFile(tempPath, serialized, 'utf8');
  await fs.rename(tempPath, filePath);
  console.log('[Store] Database persisted:', { label, filePath, bytes: serialized.length, updatedAt: database.updatedAt });
}

function normalizeLoadedDatabase(rawValue: unknown): EasySeasDatabase {
  if (!rawValue || typeof rawValue !== 'object') {
    return cloneDefaultDatabase();
  }

  const rawRecord = rawValue as Partial<EasySeasDatabase>;

  return {
    version: typeof rawRecord.version === 'number' ? rawRecord.version : DEFAULT_DATABASE.version,
    updatedAt: typeof rawRecord.updatedAt === 'string' ? rawRecord.updatedAt : getNowIso(),
    simpleUserData: rawRecord.simpleUserData && typeof rawRecord.simpleUserData === 'object' ? rawRecord.simpleUserData : {},
    userProfiles: rawRecord.userProfiles && typeof rawRecord.userProfiles === 'object' ? rawRecord.userProfiles : {},
    calendarFeeds: rawRecord.calendarFeeds && typeof rawRecord.calendarFeeds === 'object' ? rawRecord.calendarFeeds : {},
    crewMembers: rawRecord.crewMembers && typeof rawRecord.crewMembers === 'object' ? rawRecord.crewMembers : {},
    sailings: rawRecord.sailings && typeof rawRecord.sailings === 'object' ? rawRecord.sailings : {},
    recognitionEntries: rawRecord.recognitionEntries && typeof rawRecord.recognitionEntries === 'object' ? rawRecord.recognitionEntries : {},
  };
}

async function loadDatabase(): Promise<EasySeasDatabase> {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  const filePath = await getDatabasePath();

  try {
    const rawText = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(rawText) as unknown;
    cachedDatabase = normalizeLoadedDatabase(parsed);
    console.log('[Store] Database loaded from disk:', { filePath, updatedAt: cachedDatabase.updatedAt });
    return cachedDatabase;
  } catch (error) {
    const normalizedMessage = error instanceof Error ? error.message : String(error);

    if ('code' in (error as NodeJS.ErrnoException) && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      cachedDatabase = cloneDefaultDatabase();
      cachedDatabase.updatedAt = getNowIso();
      await persistDatabase(cachedDatabase, 'initialize');
      console.log('[Store] Created new database file:', { filePath });
      return cachedDatabase;
    }

    console.error('[Store] Failed to load database:', normalizedMessage);
    throw error;
  }
}

export async function readDatabase(): Promise<EasySeasDatabase> {
  return loadDatabase();
}

export async function mutateDatabase<T>(label: string, mutator: (database: EasySeasDatabase) => T | Promise<T>): Promise<T> {
  const wrappedOperation = async (): Promise<T> => {
    const database = await loadDatabase();
    const result = await mutator(database);
    database.updatedAt = getNowIso();
    await persistDatabase(database, label);
    return result;
  };

  const operation = mutationQueue.then(wrappedOperation, wrappedOperation);
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeOptionalString(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getSailingMonth(date: string): string {
  return date.slice(0, 7);
}

export function getSailingYear(date: string): number {
  const parsed = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
