import { httpLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

export const RENDER_BACKEND_URL = "https://rork-easy-seas-vp1-2nep.onrender.com";

export const isRenderBackendAvailable = () => {
  return true;
};

const RENDER_ROUTED_PREFIXES = [
  'calendar.',
  'royalCaribbeanSync.',
  'example.',
  'data.',
  'cruiseDeals.',
  'crewRecognition.',
  'dailyLuck.',
];

const isRenderRoutedProcedure = (path: string): boolean => {
  return RENDER_ROUTED_PREFIXES.some(prefix => path.startsWith(prefix));
};

const API_SUFFIX = '/api';
const TRPC_SUFFIX = '/trpc';

const trimTrailingSlash = (value: string): string => {
  return value.replace(/\/+$/, '');
};

const getHealthUrlCandidates = (baseUrl: string): string[] => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  if (!normalizedBaseUrl || normalizedBaseUrl === 'https://fallback.local') {
    return [];
  }

  const candidates = [`${normalizedBaseUrl}/`];

  if (normalizedBaseUrl.endsWith(API_SUFFIX)) {
    candidates.push(`${normalizedBaseUrl.slice(0, -API_SUFFIX.length)}/`);
  } else {
    candidates.push(`${normalizedBaseUrl}${API_SUFFIX}`);
    candidates.push(`${normalizedBaseUrl}${API_SUFFIX}/`);
  }

  return candidates.filter((candidate, index, list) => {
    return list.indexOf(candidate) === index;
  });
};

const getSystemTrpcBaseCandidates = (baseUrl: string): string[] => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  if (!normalizedBaseUrl || normalizedBaseUrl === 'https://fallback.local') {
    return [];
  }

  const candidates = [`${normalizedBaseUrl}${TRPC_SUFFIX}`];

  if (normalizedBaseUrl.endsWith(API_SUFFIX)) {
    candidates.push(`${normalizedBaseUrl.slice(0, -API_SUFFIX.length)}${TRPC_SUFFIX}`);
  } else {
    candidates.push(`${normalizedBaseUrl}${API_SUFFIX}${TRPC_SUFFIX}`);
  }

  return candidates.filter((candidate, index, list) => {
    return list.indexOf(candidate) === index;
  });
};

const getRenderTrpcBaseCandidates = (): string[] => {
  return [`${RENDER_BACKEND_URL}${TRPC_SUFFIX}`];
};

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  if (!url) {
    return "https://fallback.local";
  }

  return url;
};

let _backendReachable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 120_000;
const HEALTH_CHECK_TIMEOUT = 5_000;
let _healthCheckPromise: Promise<boolean> | null = null;

type HealthTarget = {
  baseUrl: string;
  label: string;
};

const getHealthTargets = (): HealthTarget[] => {
  const baseUrl = getBaseUrl();
  const targets: HealthTarget[] = [];

  if (baseUrl !== "https://fallback.local") {
    targets.push({ baseUrl, label: 'System' });
  }

  targets.push({ baseUrl: RENDER_BACKEND_URL, label: 'Render' });

  return targets.filter((target, index, list) => {
    return list.findIndex(candidate => candidate.baseUrl === target.baseUrl) === index;
  });
};

const checkHealthTarget = async (target: HealthTarget): Promise<boolean> => {
  const candidateUrls = getHealthUrlCandidates(target.baseUrl);

  for (const candidateUrl of candidateUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      const res = await fetch(candidateUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        console.log(`[tRPC] ${target.label} backend health check passed via`, candidateUrl);
        return true;
      }

      console.log(`[tRPC] ${target.label} backend returned non-ok status from ${candidateUrl}:`, res.status);
    } catch (error) {
      console.log(`[tRPC] ${target.label} backend unreachable at ${candidateUrl}:`, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return false;
};

const checkBackendHealth = async (): Promise<boolean> => {
  const now = Date.now();
  if (_backendReachable !== null && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return _backendReachable;
  }

  if (_healthCheckPromise) return _healthCheckPromise;

  _healthCheckPromise = (async () => {
    const targets = getHealthTargets();

    for (const target of targets) {
      const reachable = await checkHealthTarget(target);
      if (reachable) {
        _backendReachable = true;
        _lastHealthCheck = Date.now();
        return true;
      }
    }

    _backendReachable = false;
    _lastHealthCheck = Date.now();
    console.log('[tRPC] All backends unreachable - operating in offline mode');
    return false;
  })().finally(() => {
    _healthCheckPromise = null;
  });

  return _healthCheckPromise;
};

export const isBackendAvailable = (): boolean => {
  const baseUrl = getBaseUrl();
  if (baseUrl === "https://fallback.local") return false;
  if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) return false;
  return true;
};

export const isWebSyncAvailable = (): boolean => {
  return true;
};

export const isBackendReachable = async (): Promise<boolean> => {
  return checkBackendHealth();
};

export const resetBackendHealthCache = () => {
  _backendReachable = null;
  _lastHealthCheck = 0;
  _healthCheckPromise = null;
};

let _trpcClient: ReturnType<typeof trpc.createClient> | null = null;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let _lastErrorLogTime = 0;
const ERROR_LOG_THROTTLE = 30_000;
const BACKEND_NOT_FOUND_CODE_PATTERN = /"code"\s*:\s*"not_found"/i;
const TRPC_PROCEDURE_NOT_FOUND_PATTERN = /"code"\s*:\s*"NOT_FOUND"/;
const BACKEND_NOT_FOUND_MESSAGE = 'The requested resource was not found';

const isTrpcProcedureNotFound = (value: string): boolean => {
  return value.includes('No procedure found on path') || TRPC_PROCEDURE_NOT_FOUND_PATTERN.test(value);
};

const isMisroutedProcedureNotFound = (value: string): boolean => {
  return value.includes('No procedure found on path "trpc/') || value.includes('No procedure found on path "trpc.');
};

const isBackendNotFoundPayload = (value: string): boolean => {
  if (isTrpcProcedureNotFound(value)) {
    return false;
  }
  return BACKEND_NOT_FOUND_CODE_PATTERN.test(value) || value.includes(BACKEND_NOT_FOUND_MESSAGE);
};

const normalizeBackendResponseError = async (response: Response): Promise<Error | null> => {
  if (response.ok) {
    return null;
  }

  try {
    const responseBody = await response.clone().text();
    const trimmedResponseBody = responseBody.trim();

    if (isMisroutedProcedureNotFound(responseBody)) {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
      console.log('[tRPC] Backend endpoint is misrouted - operating in offline mode');
      return new Error('BACKEND_OFFLINE');
    }

    if (isTrpcProcedureNotFound(responseBody)) {
      console.log('[tRPC] Procedure not found on backend (stale deploy) - passing through as normal tRPC error');
      return null;
    }

    const isUnavailableResponse =
      isBackendNotFoundPayload(responseBody) ||
      (response.status === 404 && trimmedResponseBody === '404 Not Found') ||
      (response.status === 403 && responseBody.includes('Access Denied'));

    if (isUnavailableResponse) {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
      console.log('[tRPC] Backend endpoint returned an unavailable response - operating in offline mode');
      return new Error('BACKEND_OFFLINE');
    }
  } catch (error) {
    console.log('[tRPC] Failed reading backend error response:', error instanceof Error ? error.message : String(error));
  }

  return null;
};

const getFetchUrlString = (url: RequestInfo | URL): string => {
  if (typeof url === 'string') {
    return url;
  }

  if (url instanceof URL) {
    return url.toString();
  }

  if ('url' in url && typeof url.url === 'string') {
    return url.url;
  }

  throw new Error('INVALID_REQUEST_URL');
};

const getTrpcRequestUrlCandidates = (requestUrl: string, candidateBases: string[]): string[] => {
  if (candidateBases.length === 0) {
    return [requestUrl];
  }

  const matchingBase = candidateBases.find((candidateBase) => requestUrl.startsWith(candidateBase));
  if (matchingBase) {
    const suffix = requestUrl.slice(matchingBase.length);
    return candidateBases.map((candidateBase) => `${candidateBase}${suffix}`).filter((candidateUrl, index, list) => {
      return list.indexOf(candidateUrl) === index;
    });
  }

  const trpcIndex = requestUrl.indexOf(TRPC_SUFFIX);
  if (trpcIndex === -1) {
    return [requestUrl];
  }

  const suffix = requestUrl.slice(trpcIndex + TRPC_SUFFIX.length);
  const candidateUrls = candidateBases.map((candidateBase) => `${candidateBase}${suffix}`);
  candidateUrls.push(requestUrl);

  return candidateUrls.filter((candidateUrl, index, list) => {
    return list.indexOf(candidateUrl) === index;
  });
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit | undefined,
  maxRetries = 1
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const existingSignal = options?.signal;
      if (existingSignal?.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Request was cancelled', 'AbortError');
      }
      
      existingSignal?.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timeoutId);
      });
      
      const requestHeaders = new Headers(options?.headers);
      requestHeaders.set('Accept', 'application/json');

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: requestHeaders,
      });
      
      clearTimeout(timeoutId);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
        
        if (attempt < maxRetries) {
          await sleep(waitTime);
          continue;
        }
      }
      
      const normalizedError = await normalizeBackendResponseError(response);
      if (normalizedError) {
        throw normalizedError;
      }

      if (response.ok) {
        _backendReachable = true;
        _lastHealthCheck = Date.now();
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (lastError.message === 'BACKEND_OFFLINE') {
        break;
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        await sleep(waitTime);
      }
    }
  }
  
  if (lastError) {
    const msg = lastError.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('Network request failed') || lastError.name === 'AbortError') {
      _backendReachable = false;
      _lastHealthCheck = Date.now();
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
};

const fetchWithTrpcUrlFallback = async (
  candidateUrls: string[],
  options: RequestInit | undefined,
  label: 'System' | 'Render'
): Promise<Response> => {
  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (let index = 0; index < candidateUrls.length; index++) {
    const candidateUrl = candidateUrls[index];
    try {
      const response = await fetchWithRetry(candidateUrl, options);
      if (response.status === 404 && index < candidateUrls.length - 1) {
        console.log(`[tRPC:${label}] Endpoint candidate returned 404, retrying alternate path:`, candidateUrl);
        lastResponse = response;
        continue;
      }

      return response;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;

      if (normalizedError.message === 'BACKEND_OFFLINE' && index < candidateUrls.length - 1) {
        console.log(`[tRPC:${label}] Endpoint candidate unavailable, retrying alternate path:`, candidateUrl);
        continue;
      }

      throw normalizedError;
    }
  }

  if (lastResponse) {
    const normalizedError = await normalizeBackendResponseError(lastResponse);
    if (normalizedError) {
      throw normalizedError;
    }

    if (!lastResponse.ok && (lastResponse.status === 403 || lastResponse.status === 404)) {
      try {
        const body = await lastResponse.clone().text();
        if (isTrpcProcedureNotFound(body)) {
          console.log(`[tRPC:${label}] Procedure not found (stale deploy) - returning response as-is`);
          return lastResponse;
        }
      } catch { }
      _backendReachable = false;
      _lastHealthCheck = Date.now();
      console.log(`[tRPC:${label}] All endpoint candidates returned an unavailable response - operating in offline mode`);
      throw new Error('BACKEND_OFFLINE');
    }

    return lastResponse;
  }

  throw lastError ?? new Error('Fetch failed after retries');
};

export const getTrpcClient = () => {
  if (!_trpcClient) {
    const baseUrl = getBaseUrl();
    console.log('[tRPC] Initializing client - System backend:', baseUrl, '| Render backend:', RENDER_BACKEND_URL);
    _trpcClient = trpc.createClient({
      links: [
        splitLink({
          condition: (op) => isRenderRoutedProcedure(op.path),
          true: httpLink({
            url: `${RENDER_BACKEND_URL}/trpc`,
            transformer: superjson,
            fetch: async (url, options) => {
              const requestUrl = getFetchUrlString(url);

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 12000);

              try {
                const existingSignal = options?.signal;
                if (existingSignal?.aborted) {
                  clearTimeout(timeoutId);
                  throw new DOMException('Request was cancelled', 'AbortError');
                }
                existingSignal?.addEventListener('abort', () => {
                  controller.abort();
                });

                const requestHeaders = new Headers(options?.headers);
                requestHeaders.set('Accept', 'application/json');

                const response = await fetch(requestUrl, {
                  ...options,
                  signal: controller.signal,
                  headers: requestHeaders,
                });
                clearTimeout(timeoutId);

                const normalizedError = await normalizeBackendResponseError(response);
                if (normalizedError) {
                  throw normalizedError;
                }

                return response;
              } catch (error) {
                clearTimeout(timeoutId);
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.log('[tRPC:Render] Request failed:', errorMsg);
                throw error;
              }
            },
          }),
          false: httpLink({
            url: `${baseUrl}/trpc`,
            transformer: superjson,
            fetch: async (url, options) => {
              if (baseUrl === "https://fallback.local") {
                throw new Error("BACKEND_NOT_CONFIGURED");
              }

              if (_backendReachable === false && Date.now() - _lastHealthCheck < HEALTH_CHECK_INTERVAL) {
                throw new Error("BACKEND_OFFLINE");
              }
              
              try {
                const requestUrl = getFetchUrlString(url);
                const systemCandidateUrls = getTrpcRequestUrlCandidates(
                  requestUrl,
                  getSystemTrpcBaseCandidates(baseUrl)
                );

                try {
                  const response = await fetchWithTrpcUrlFallback(systemCandidateUrls, options, 'System');
                  return response;
                } catch (error) {
                  const normalizedError = error instanceof Error ? error : new Error(String(error));

                  if (normalizedError.message === 'BACKEND_OFFLINE') {
                    const renderCandidateUrls = getTrpcRequestUrlCandidates(
                      requestUrl,
                      getRenderTrpcBaseCandidates()
                    );
                    const hasAlternateRenderCandidate = renderCandidateUrls.some((candidateUrl) => {
                      return !systemCandidateUrls.includes(candidateUrl);
                    });

                    if (hasAlternateRenderCandidate) {
                      console.log('[tRPC:System] System backend unavailable, falling back to Render backend');
                      return fetchWithTrpcUrlFallback(renderCandidateUrls, options, 'Render');
                    }
                  }

                  throw normalizedError;
                }
              } catch (error) {
                const now = Date.now();
                if (now - _lastErrorLogTime > ERROR_LOG_THROTTLE) {
                  _lastErrorLogTime = now;
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  console.log('[tRPC:System] Request failed:', errorMsg, '- operating in offline mode');
                }
                throw error;
              }
            },
          }),
        }),
      ],
    });
  }
  return _trpcClient;
};

export const trpcClient = new Proxy({} as ReturnType<typeof trpc.createClient>, {
  get(target, prop) {
    return getTrpcClient()[prop as keyof ReturnType<typeof trpc.createClient>];
  },
});
