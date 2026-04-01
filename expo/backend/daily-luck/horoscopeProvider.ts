import type { DailyLuckInput, DailyLuckProviderKey } from '@/types/daily-luck';
import { deriveChineseSignFromBirthDate, deriveWesternSignFromBirthDate, normalizeSignSlug } from '@/lib/dailyLuck/signs';
import { buildYearDateText, parseArticlePayload, sameDay, sameYear } from './parserUtils';

export interface ProviderFetchResult {
  providerKey: DailyLuckProviderKey;
  label: string;
  weight: number;
  sourceUrl: string;
  title: string;
  mainText: string;
  excerpt: string;
  visibleDateText: string;
  sourceDateText: string;
  detectedDateIso?: string;
  isStale: boolean;
  author?: string;
  publishedTime?: string;
  articleType?: string;
  confidencePenalty: number;
  status: 'ok' | 'error';
  errorMessage?: string;
}

type FreshnessMode = 'day' | 'year';

interface ProviderDefinition {
  key: DailyLuckProviderKey;
  label: string;
  weight: number;
  freshnessMode: FreshnessMode;
  getUrls: (input: ResolvedDailyLuckInput) => string[];
}

export interface ResolvedDailyLuckInput {
  date: string;
  westernSign: string;
  chineseSign: string;
  birthDate: string;
  birthplace: string;
  displayName?: string;
  skyTodayUrl?: string;
}

type CachedHtml = {
  html: string;
  expiresAt: number;
};

const DEFAULT_SKY_TODAY_URL = 'https://www.astrology.com/article/daily-astrology';
const HTML_CACHE_TTL_MS = 1000 * 60 * 30;
const FETCH_TIMEOUT_MS = 1000 * 15;
const RESPONSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; EasySeasDailyLuck/1.0; +https://astrology.com)',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

const providerDefinitions: ProviderDefinition[] = [
  {
    key: 'chineseDaily',
    label: 'Chinese daily horoscope',
    weight: 0.25,
    freshnessMode: 'day',
    getUrls: (input) => [`https://www.astrology.com/horoscope/daily-chinese/${input.chineseSign}.html`],
  },
  {
    key: 'westernDaily',
    label: 'Western daily horoscope',
    weight: 0.25,
    freshnessMode: 'day',
    getUrls: (input) => [`https://www.astrology.com/horoscope/daily/${input.westernSign}.html`],
  },
  {
    key: 'skyToday',
    label: 'Sky today',
    weight: 0.2,
    freshnessMode: 'day',
    getUrls: (input) => {
      const primary = input.skyTodayUrl && input.skyTodayUrl.trim().length > 0 ? input.skyTodayUrl.trim() : DEFAULT_SKY_TODAY_URL;
      if (primary === DEFAULT_SKY_TODAY_URL) {
        return [DEFAULT_SKY_TODAY_URL];
      }
      return [primary, DEFAULT_SKY_TODAY_URL];
    },
  },
  {
    key: 'loveDaily',
    label: 'Daily love horoscope',
    weight: 0.1,
    freshnessMode: 'day',
    getUrls: (input) => [`https://www.astrology.com/horoscope/daily-love/${input.westernSign}.html`],
  },
  {
    key: 'yearlyChinese',
    label: 'Chinese yearly overview',
    weight: 0.2,
    freshnessMode: 'year',
    getUrls: (input) => {
      const requestedYear = input.date.slice(0, 4);
      const requestedUrl = `https://www.astrology.com/us/horoscope/yearly-chinese-overview-${requestedYear}.aspx?sign=${input.chineseSign}`;
      if (requestedYear === '2026') {
        return [requestedUrl];
      }
      return [requestedUrl, `https://www.astrology.com/us/horoscope/yearly-chinese-overview-2026.aspx?sign=${input.chineseSign}`];
    },
  },
];

function getGlobalHtmlCache(): Map<string, CachedHtml> {
  const globalScope = globalThis as typeof globalThis & { __easySeasDailyLuckHtmlCache?: Map<string, CachedHtml> };
  if (!globalScope.__easySeasDailyLuckHtmlCache) {
    globalScope.__easySeasDailyLuckHtmlCache = new Map<string, CachedHtml>();
  }

  return globalScope.__easySeasDailyLuckHtmlCache;
}

async function fetchHtml(url: string): Promise<string> {
  const cache = getGlobalHtmlCache();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.html;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: RESPONSE_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const html = await response.text();
    cache.set(url, {
      html,
      expiresAt: Date.now() + HTML_CACHE_TTL_MS,
    });
    return html;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('FETCH_TIMEOUT');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveStaleness(requestedDate: string, freshnessMode: FreshnessMode, detectedDateIso: string | undefined): boolean {
  if (!detectedDateIso) {
    return false;
  }

  if (freshnessMode === 'year') {
    return !sameYear(requestedDate, detectedDateIso);
  }

  return !sameDay(requestedDate, detectedDateIso);
}

function resolveConfidencePenalty(isStale: boolean, freshnessMode: FreshnessMode, detectedDateIso: string | undefined): number {
  if (isStale) {
    return freshnessMode === 'year' ? 0.12 : 0.18;
  }

  if (!detectedDateIso) {
    return 0.04;
  }

  return 0;
}

function toProviderError(definition: ProviderDefinition, sourceUrl: string, errorMessage: string): ProviderFetchResult {
  return {
    providerKey: definition.key,
    label: definition.label,
    weight: definition.weight,
    sourceUrl,
    title: '',
    mainText: '',
    excerpt: '',
    visibleDateText: '',
    sourceDateText: '',
    detectedDateIso: undefined,
    isStale: false,
    author: undefined,
    publishedTime: undefined,
    articleType: undefined,
    confidencePenalty: 0.22,
    status: 'error',
    errorMessage,
  };
}

async function fetchProvider(definition: ProviderDefinition, input: ResolvedDailyLuckInput): Promise<ProviderFetchResult> {
  const urls = definition.getUrls(input);

  for (const sourceUrl of urls) {
    try {
      const html = await fetchHtml(sourceUrl);
      const parsed = parseArticlePayload(html);
      const detectedDateIso = parsed.detectedDateIso || (definition.freshnessMode === 'year' ? `${input.date.slice(0, 4)}-01-01` : undefined);
      const sourceDateText = parsed.sourceDateText || (definition.freshnessMode === 'year' ? buildYearDateText(input.date.slice(0, 4)) : '');
      const isStale = resolveStaleness(input.date, definition.freshnessMode, detectedDateIso);
      const confidencePenalty = resolveConfidencePenalty(isStale, definition.freshnessMode, detectedDateIso);

      return {
        providerKey: definition.key,
        label: definition.label,
        weight: definition.weight,
        sourceUrl,
        title: parsed.title,
        mainText: parsed.mainText,
        excerpt: parsed.excerpt,
        visibleDateText: parsed.visibleDateText,
        sourceDateText,
        detectedDateIso,
        isStale,
        author: parsed.author,
        publishedTime: parsed.publishedTime,
        articleType: parsed.articleType,
        confidencePenalty,
        status: 'ok',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[DailyLuckProvider] Provider fetch failed:', {
        providerKey: definition.key,
        sourceUrl,
        errorMessage,
      });
      if (sourceUrl === urls[urls.length - 1]) {
        return toProviderError(definition, sourceUrl, errorMessage);
      }
    }
  }

  return toProviderError(definition, urls[0] ?? '', 'UNKNOWN_PROVIDER_FETCH_ERROR');
}

export function resolveDailyLuckInput(input: DailyLuckInput): ResolvedDailyLuckInput {
  const westernSign = normalizeSignSlug(input.westernSign) || deriveWesternSignFromBirthDate(input.birthDate) || 'aries';
  const chineseSign = normalizeSignSlug(input.chineseSign) || deriveChineseSignFromBirthDate(input.birthDate) || 'rooster';

  return {
    date: input.date,
    westernSign,
    chineseSign,
    birthDate: input.birthDate,
    birthplace: input.birthplace?.trim() ?? '',
    displayName: input.displayName?.trim() || undefined,
    skyTodayUrl: input.skyTodayUrl,
  };
}

export async function fetchLiveHoroscopeSources(input: DailyLuckInput): Promise<{ input: ResolvedDailyLuckInput; sources: ProviderFetchResult[] }> {
  const resolvedInput = resolveDailyLuckInput(input);
  const sources = await Promise.all(providerDefinitions.map((definition) => fetchProvider(definition, resolvedInput)));

  console.log('[DailyLuckProvider] Fetched live sources:', {
    date: resolvedInput.date,
    westernSign: resolvedInput.westernSign,
    chineseSign: resolvedInput.chineseSign,
    sourceCount: sources.length,
    successCount: sources.filter((source) => source.status === 'ok').length,
  });

  return {
    input: resolvedInput,
    sources,
  };
}
