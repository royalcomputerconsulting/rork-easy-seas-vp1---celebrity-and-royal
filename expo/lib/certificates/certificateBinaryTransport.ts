import { Platform } from 'react-native';

export const CERTIFICATE_BINARY_TRANSPORT_VERSION = 'v1.3.0-browser-compatible-bounded-io';

const APPROVED_HOSTS = new Set(['www.royalcaribbean.com', 'royalcaribbean.com']);
const PDF_PATH_PREFIX = '/content/dam/royal/resources/pdf/casino/offers/';
const DEFAULT_TIMEOUT_MS = 20_000;
const NATIVE_FILESYSTEM_TIMEOUT_MS = 12_000;
const NATIVE_FILE_OPERATION_TIMEOUT_MS = 4_000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
}

export interface CertificateBinaryDownload {
  bytes: Uint8Array;
  contentType: string | null;
  resolvedUrl: string;
  temporaryFileUri: string | null;
  transport: 'expo-file-system' | 'fetch-array-buffer' | 'fetch-blob';
}

type LegacyFileSystemModule = {
  cacheDirectory?: string | null;
  documentDirectory?: string | null;
  EncodingType?: { Base64?: string };
  makeDirectoryAsync?: (uri: string, options?: { intermediates?: boolean }) => Promise<void>;
  downloadAsync?: (
    uri: string,
    fileUri: string,
    options?: { headers?: Record<string, string> },
  ) => Promise<{ uri: string; status?: number; headers?: Record<string, string>; mimeType?: string | null }>;
  readAsStringAsync?: (uri: string, options?: { encoding?: string }) => Promise<string>;
  copyAsync?: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync?: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists?: boolean; size?: number }>;
};

function normalizeCertificateUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(String(rawUrl ?? '').trim());
    if (url.protocol !== 'https:') return null;
    if (!APPROVED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (!url.pathname.toLowerCase().startsWith(PDF_PATH_PREFIX)) return null;
    if (!url.pathname.toLowerCase().endsWith('.pdf')) return null;
    return url;
  } catch {
    return null;
  }
}

export function isApprovedCertificatePdfUrl(rawUrl: string): boolean {
  return normalizeCertificateUrl(rawUrl) !== null;
}

export function assertApprovedCertificatePdfUrl(rawUrl: string): URL {
  const url = normalizeCertificateUrl(rawUrl);
  if (!url) throw new Error('Certificate URL must be an approved Royal Caribbean HTTPS PDF URL.');
  return url;
}

export function decodeBase64Bytes(value: string): Uint8Array {
  const normalized = String(value ?? '').replace(/\s/g, '');
  if (!normalized) return new Uint8Array();

  const globalBuffer = (globalThis as typeof globalThis & {
    Buffer?: { from(input: string, encoding: string): Uint8Array };
  }).Buffer;
  if (globalBuffer?.from) return new Uint8Array(globalBuffer.from(normalized, 'base64'));

  const atobFunction = (globalThis as typeof globalThis & { atob?: (input: string) => string }).atob;
  if (typeof atobFunction === 'function') {
    const binary = atobFunction(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
    return bytes;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const output: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const first = alphabet.indexOf(normalized[index]);
    const second = alphabet.indexOf(normalized[index + 1]);
    const thirdCharacter = normalized[index + 2] ?? '=';
    const fourthCharacter = normalized[index + 3] ?? '=';
    const third = thirdCharacter === '=' ? 0 : alphabet.indexOf(thirdCharacter);
    const fourth = fourthCharacter === '=' ? 0 : alphabet.indexOf(fourthCharacter);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new Error('Certificate PDF base64 payload is invalid.');
    output.push((first << 2) | (second >>> 4));
    if (thirdCharacter !== '=') output.push(((second & 0x0f) << 4) | (third >>> 2));
    if (fourthCharacter !== '=') output.push(((third & 0x03) << 6) | fourth);
  }
  return new Uint8Array(output);
}

function getLegacyFileSystem(): LegacyFileSystemModule | null {
  try {
    const fileSystem = require('expo-file-system/legacy') as LegacyFileSystemModule;
    const baseDirectory = fileSystem.cacheDirectory ?? fileSystem.documentDirectory;
    if (
      !baseDirectory ||
      typeof fileSystem.downloadAsync !== 'function' ||
      typeof fileSystem.readAsStringAsync !== 'function' ||
      typeof fileSystem.makeDirectoryAsync !== 'function'
    ) {
      return null;
    }
    return fileSystem;
  } catch {
    return null;
  }
}

function safeFileToken(value: string): string {
  return String(value ?? 'certificate').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'certificate';
}

function readHeader(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null;
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1] ?? null;
}

async function downloadWithExpoFileSystem(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<CertificateBinaryDownload | null> {
  if (Platform.OS === 'web') return null;
  const fileSystem = getLegacyFileSystem();
  if (!fileSystem) return null;

  const cacheDirectory = fileSystem.cacheDirectory ?? fileSystem.documentDirectory;
  if (!cacheDirectory) return null;

  const downloadDirectory = `${cacheDirectory}easyseas-certificate-downloads/`;
  await withTimeout(
    fileSystem.makeDirectoryAsync!(downloadDirectory, { intermediates: true }),
    NATIVE_FILE_OPERATION_TIMEOUT_MS,
    'Preparing the certificate download folder timed out.',
  );
  const code = safeFileToken(url.pathname.split('/').pop()?.replace(/\.pdf$/i, '') ?? 'certificate');
  const destination = `${downloadDirectory}${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const nativeDownload = fileSystem.downloadAsync!(url.toString(), destination, { headers });
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Native certificate download timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  let result: Awaited<ReturnType<NonNullable<LegacyFileSystemModule['downloadAsync']>>>;
  try {
    result = await Promise.race([nativeDownload, timeout]);
  } catch (error) {
    // Cleanup must never delay the fetch fallback. Expo's legacy filesystem can
    // leave deleteAsync pending behind the same native operation that timed out.
    void fileSystem.deleteAsync?.(destination, { idempotent: true }).catch(() => undefined);
    // downloadAsync cannot be cancelled in every supported Expo runtime. A
    // second cleanup catches a late completion without holding the UI hostage.
    setTimeout(() => {
      void fileSystem.deleteAsync?.(destination, { idempotent: true }).catch(() => undefined);
    }, timeoutMs);
    throw error;
  } finally {
    if (timeoutHandle !== null) clearTimeout(timeoutHandle);
  }
  const status = Number(result.status ?? 200);
  if (status < 200 || status >= 300) {
    await fileSystem.deleteAsync?.(result.uri || destination, { idempotent: true }).catch(() => undefined);
    throw new Error(`Certificate download returned HTTP ${status}.`);
  }

  const encoding = fileSystem.EncodingType?.Base64 ?? 'base64';
  const base64 = await withTimeout(
    fileSystem.readAsStringAsync!(result.uri || destination, { encoding }),
    NATIVE_FILE_OPERATION_TIMEOUT_MS,
    'Reading the downloaded certificate PDF timed out.',
  );
  const bytes = decodeBase64Bytes(base64);
  if (bytes.length === 0) {
    await fileSystem.deleteAsync?.(result.uri || destination, { idempotent: true }).catch(() => undefined);
    throw new Error('Certificate download returned an empty PDF file.');
  }

  return {
    bytes,
    contentType: result.mimeType ?? readHeader(result.headers, 'content-type'),
    resolvedUrl: url.toString(),
    temporaryFileUri: result.uri || destination,
    transport: 'expo-file-system',
  };
}

async function responseToBytes(response: Response): Promise<{ bytes: Uint8Array; transport: 'fetch-array-buffer' | 'fetch-blob' }> {
  const responseWithArrayBuffer = response as Response & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof responseWithArrayBuffer.arrayBuffer === 'function') {
    return { bytes: new Uint8Array(await responseWithArrayBuffer.arrayBuffer()), transport: 'fetch-array-buffer' };
  }

  const responseWithBlob = response as Response & { blob?: () => Promise<Blob> };
  if (typeof responseWithBlob.blob === 'function') {
    const blob = await responseWithBlob.blob();
    const blobWithArrayBuffer = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof blobWithArrayBuffer.arrayBuffer === 'function') {
      return { bytes: new Uint8Array(await blobWithArrayBuffer.arrayBuffer()), transport: 'fetch-blob' };
    }

    const FileReaderConstructor = (globalThis as typeof globalThis & {
      FileReader?: new () => {
        result: string | ArrayBuffer | null;
        error: Error | null;
        onload: null | (() => void);
        onerror: null | (() => void);
        readAsArrayBuffer(value: Blob): void;
      };
    }).FileReader;
    if (FileReaderConstructor) {
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReaderConstructor();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(new Uint8Array(reader.result));
          else reject(new Error('Certificate PDF FileReader returned an invalid result.'));
        };
        reader.onerror = () => reject(reader.error ?? new Error('Certificate PDF FileReader failed.'));
        reader.readAsArrayBuffer(blob);
      });
      return { bytes, transport: 'fetch-blob' };
    }
  }

  throw new Error('This runtime cannot read a binary PDF response. The certificate was not parsed or stored.');
}

async function downloadWithFetch(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<CertificateBinaryDownload> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
    const resolvedUrl = response.url || url.toString();
    assertApprovedCertificatePdfUrl(resolvedUrl);
    if (!response.ok) throw new Error(`Certificate download returned HTTP ${response.status}.`);
    const binary = await withTimeout(
      responseToBytes(response),
      timeoutMs,
      `Reading the certificate PDF response timed out after ${timeoutMs}ms.`,
    );
    return {
      bytes: binary.bytes,
      contentType: response.headers.get('content-type'),
      resolvedUrl,
      temporaryFileUri: null,
      transport: binary.transport,
    };
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

export async function downloadCertificateBinary(
  rawUrl: string,
  options?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<CertificateBinaryDownload> {
  const url = assertApprovedCertificatePdfUrl(rawUrl);
  const headers = {
    Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Referer: 'https://www.royalcaribbean.com/',
    // Royal's CDN currently rejects some generic native download clients with
    // HTTP 403 while serving the same public PDF to a browser-compatible
    // request. This is public content; no cookie or backend credential is used.
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    ...(options?.headers ?? {}),
  };

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let nativeError: unknown = null;
  try {
    const nativeDownload = await downloadWithExpoFileSystem(
      url,
      headers,
      Math.min(timeoutMs, NATIVE_FILESYSTEM_TIMEOUT_MS),
    );
    if (nativeDownload) return nativeDownload;
  } catch (error) {
    nativeError = error;
  }

  try {
    return await downloadWithFetch(url, headers, timeoutMs);
  } catch (fetchError) {
    const nativeDetail = nativeError instanceof Error ? nativeError.message : nativeError ? String(nativeError) : 'native transport unavailable';
    const fetchDetail = fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Certificate PDF download failed. Native path: ${nativeDetail}. Fetch fallback: ${fetchDetail}.`);
  }
}

export async function archiveCertificateLocalFile(input: {
  temporaryFileUri: string | null;
  certificateCode: string;
  documentHash: string;
}): Promise<string | null> {
  if (Platform.OS === 'web' || !input.temporaryFileUri) return null;
  const fileSystem = getLegacyFileSystem();
  const root = fileSystem?.documentDirectory;
  if (!fileSystem || !root || typeof fileSystem.copyAsync !== 'function' || typeof fileSystem.makeDirectoryAsync !== 'function') {
    return input.temporaryFileUri;
  }

  const archiveDirectory = `${root}easyseas-certificate-pdfs/`;
  await withTimeout(
    fileSystem.makeDirectoryAsync(archiveDirectory, { intermediates: true }),
    NATIVE_FILE_OPERATION_TIMEOUT_MS,
    'Preparing the certificate archive folder timed out.',
  );
  const hashToken = safeFileToken(input.documentHash.replace(/^sha256:/i, '').slice(0, 20));
  const destination = `${archiveDirectory}${safeFileToken(input.certificateCode.toUpperCase())}-${hashToken}.pdf`;
  const existing = await withTimeout(
    fileSystem.getInfoAsync?.(destination).catch(() => ({ exists: false })) ?? Promise.resolve({ exists: false }),
    NATIVE_FILE_OPERATION_TIMEOUT_MS,
    'Checking the retained certificate PDF timed out.',
  );
  if (!existing?.exists) {
    await withTimeout(
      fileSystem.copyAsync({ from: input.temporaryFileUri, to: destination }),
      NATIVE_FILE_OPERATION_TIMEOUT_MS,
      'Saving the retained certificate PDF timed out.',
    );
  }
  if (input.temporaryFileUri !== destination) {
    void fileSystem.deleteAsync?.(input.temporaryFileUri, { idempotent: true }).catch(() => undefined);
  }
  return destination;
}

export async function removeTemporaryCertificateFile(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  const fileSystem = getLegacyFileSystem();
  await fileSystem?.deleteAsync?.(uri, { idempotent: true }).catch(() => undefined);
}
