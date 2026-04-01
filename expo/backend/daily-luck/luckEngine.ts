import type {
  DailyLuckActionStyle,
  DailyLuckAnalysisResponse,
  DailyLuckClassification,
  DailyLuckDomain,
  DailyLuckInput,
  DailyLuckProviderKey,
  DailyLuckSourceBreakdown,
  DailyLuckToneClass,
} from '@/types/daily-luck';
import { fetchLiveHoroscopeSources, type ProviderFetchResult } from './horoscopeProvider';

const POSITIVE_WORDS = [
  'support',
  'supportive',
  'favorable',
  'favourable',
  'opportunity',
  'opportunities',
  'growth',
  'confidence',
  'clarity',
  'harmon',
  'reward',
  'luck',
  'romance',
  'love',
  'good',
  'strong',
  'success',
  'aligned',
  'abundance',
  'thriving',
] as const;

const CAUTIONARY_WORDS = [
  'patience',
  'careful',
  'caution',
  'measured',
  'boundaries',
  'boundary',
  'discern',
  'timing',
  'pace',
  'pacing',
  'steady',
  'observe',
  'watch',
  'vet',
  'restraint',
  'quiet',
] as const;

const RESTRICTIVE_WORDS = [
  'restrict',
  'delay',
  'blocked',
  'conflict',
  'tension',
  'risk',
  'impulsive',
  'avoid',
  'overcommit',
  'overreach',
  'stress',
  'difficult',
  'problem',
  'setback',
  'loss',
  'pressure',
] as const;

const ACT_NOW_WORDS = ['act', 'move', 'seize', 'begin', 'start', 'advance', 'pursue', 'push', 'speak up'] as const;
const MEASURED_ACTION_WORDS = ['measured', 'patience', 'timing', 'steady', 'deliberate', 'discern', 'pace', 'pacing', 'boundaries', 'calm'] as const;
const WAIT_OBSERVE_WORDS = ['wait', 'pause', 'observe', 'reflect', 'hold', 'retreat', 'defer', 'stillness', 'inner'] as const;

const DOMAIN_KEYWORDS: Record<DailyLuckDomain, readonly string[]> = {
  money: ['money', 'cash', 'spend', 'financial', 'value', 'profit', 'business'],
  social: ['social', 'friends', 'network', 'community', 'conversation', 'communication'],
  emotional: ['emotion', 'heart', 'feelings', 'mood', 'emotional'],
  career: ['career', 'work', 'job', 'professional', 'ambition', 'boss'],
  relationships: ['relationship', 'love', 'romance', 'partner', 'dating', 'intimacy'],
  home: ['home', 'family', 'domestic', 'household'],
  intuition: ['intuition', 'inner', 'dream', 'spiritual', 'instinct', 'gut'],
};

const PROVIDER_ORDER: DailyLuckProviderKey[] = ['chineseDaily', 'westernDaily', 'skyToday', 'loveDaily', 'yearlyChinese'];
const TOTAL_WEIGHT = 1;
const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 30;

interface CachedResponse {
  expiresAt: number;
  response: DailyLuckAnalysisResponse;
}

function getGlobalResponseCache(): Map<string, CachedResponse> {
  const globalScope = globalThis as typeof globalThis & { __easySeasDailyLuckResponseCache?: Map<string, CachedResponse> };
  if (!globalScope.__easySeasDailyLuckResponseCache) {
    globalScope.__easySeasDailyLuckResponseCache = new Map<string, CachedResponse>();
  }

  return globalScope.__easySeasDailyLuckResponseCache;
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  const lowerText = text.toLowerCase();
  return keywords.reduce((count, keyword) => (lowerText.includes(keyword) ? count + 1 : count), 0);
}

function deriveToneClass(positiveHits: number, cautionaryHits: number, restrictiveHits: number): DailyLuckToneClass {
  if (restrictiveHits >= positiveHits + 2 || restrictiveHits >= 4) {
    return 'restrictive';
  }

  if (cautionaryHits > positiveHits) {
    return 'cautionary';
  }

  if (positiveHits >= cautionaryHits + restrictiveHits + 1) {
    return 'positive';
  }

  return 'neutral';
}

function deriveActionStyle(text: string): DailyLuckActionStyle {
  const actNowHits = countKeywordHits(text, ACT_NOW_WORDS);
  const measuredHits = countKeywordHits(text, MEASURED_ACTION_WORDS);
  const waitHits = countKeywordHits(text, WAIT_OBSERVE_WORDS);

  if (waitHits > actNowHits && waitHits >= measuredHits) {
    return 'wait-observe';
  }

  if (measuredHits >= actNowHits) {
    return 'measured action';
  }

  return 'act now';
}

function deriveDomains(text: string): DailyLuckDomain[] {
  const lowerText = text.toLowerCase();
  const scoredDomains = (Object.keys(DOMAIN_KEYWORDS) as DailyLuckDomain[])
    .map((domain) => ({
      domain,
      hits: DOMAIN_KEYWORDS[domain].reduce((count, keyword) => (lowerText.includes(keyword) ? count + 1 : count), 0),
    }))
    .filter((item) => item.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 3)
    .map((item) => item.domain);

  return scoredDomains.length > 0 ? scoredDomains : ['intuition'];
}

function toneToSignal(tone: DailyLuckToneClass, positiveHits: number, cautionaryHits: number): -2 | -1 | 0 | 1 | 2 {
  if (tone === 'restrictive') {
    return -2;
  }

  if (tone === 'cautionary') {
    return positiveHits > 0 ? -1 : -1;
  }

  if (tone === 'positive') {
    return positiveHits >= cautionaryHits + 3 ? 2 : 1;
  }

  return 0;
}

function buildDisplayTone(source: ProviderFetchResult, classification: DailyLuckClassification): string {
  if (source.providerKey === 'loveDaily' && classification.tone === 'positive') {
    return 'romantic-aligned';
  }

  if (source.providerKey === 'skyToday' && classification.tone === 'positive' && classification.affectedDomains.includes('emotional')) {
    return 'emotionally strong';
  }

  if (source.providerKey === 'yearlyChinese' && classification.actionStyle === 'measured action') {
    return 'structured-growth';
  }

  if (classification.tone === 'positive' && classification.actionStyle === 'measured action') {
    return 'measured';
  }

  if (classification.tone === 'cautionary' && classification.actionStyle === 'measured action') {
    return 'cautious-positive';
  }

  if (classification.tone === 'positive') {
    return 'positive';
  }

  if (classification.tone === 'restrictive') {
    return 'restrictive';
  }

  return 'neutral';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function sourceSignalToScore(signal: -2 | -1 | 0 | 1 | 2): number {
  switch (signal) {
    case -2:
      return 2;
    case -1:
      return 4;
    case 1:
      return 7;
    case 2:
      return 8;
    default:
      return 5;
  }
}

function buildClassification(source: ProviderFetchResult): DailyLuckClassification {
  const text = `${source.title} ${source.mainText} ${source.excerpt}`;
  const positiveHits = countKeywordHits(text, POSITIVE_WORDS);
  const cautionaryHits = countKeywordHits(text, CAUTIONARY_WORDS);
  const restrictiveHits = countKeywordHits(text, RESTRICTIVE_WORDS);
  const tone = deriveToneClass(positiveHits, cautionaryHits, restrictiveHits);
  const actionStyle = deriveActionStyle(text);
  const affectedDomains = deriveDomains(text);
  const signal = toneToSignal(tone, positiveHits, cautionaryHits);

  return {
    tone,
    actionStyle,
    affectedDomains,
    signal,
    positiveHits,
    cautionaryHits,
    restrictiveHits,
  };
}

function buildReason(source: ProviderFetchResult): string {
  const excerpt = source.excerpt || source.mainText;
  if (!excerpt) {
    return 'This source could not return readable live copy for the requested date.';
  }

  const cleaned = excerpt.replace(/\s+/g, ' ').trim();
  const baseReason = cleaned.length > 190 ? `${cleaned.slice(0, 187).trim()}...` : cleaned;

  if (source.isStale && source.sourceDateText) {
    return `The source appears stale for ${source.sourceDateText}, so its influence was discounted. ${baseReason}`;
  }

  return baseReason;
}

function toBreakdown(source: ProviderFetchResult): DailyLuckSourceBreakdown {
  if (source.status === 'error') {
    return {
      score: 5,
      tone: 'unavailable',
      reason: 'This source could not be fetched live for this request, so it did not strongly move the score.',
      sourceUrl: source.sourceUrl,
      sourceDateText: '',
      visibleDateText: '',
      detectedDateIso: undefined,
      isStale: false,
      status: 'error',
      errorMessage: source.errorMessage,
    };
  }

  const classification = buildClassification(source);
  const displayTone = buildDisplayTone(source, classification);
  const reason = buildReason(source);

  return {
    score: sourceSignalToScore(classification.signal),
    tone: displayTone,
    reason,
    sourceUrl: source.sourceUrl,
    sourceDateText: source.sourceDateText,
    visibleDateText: source.visibleDateText,
    detectedDateIso: source.detectedDateIso,
    isStale: source.isStale,
    title: source.title,
    author: source.author,
    publishedTime: source.publishedTime,
    excerpt: source.excerpt,
    mainText: source.mainText,
    classification,
    status: 'ok',
  };
}

function getLuckLevel(score: number): string {
  if (score <= 2.4) {
    return 'Very Unlucky Day';
  }

  if (score <= 4.4) {
    return 'Low-Luck Day';
  }

  if (score < 5.6) {
    return 'Neutral Day';
  }

  if (score < 7.6) {
    return 'Controlled Advantage Day';
  }

  if (score < 8.6) {
    return 'Very Lucky Day';
  }

  return 'Peak Alignment Day';
}

function getUiLabel(score: number): string {
  if (score <= 2.4) {
    return 'Very Unlucky';
  }

  if (score <= 4.4) {
    return 'Low Luck';
  }

  if (score < 5.6) {
    return 'Neutral';
  }

  if (score < 7.6) {
    return 'Controlled Advantage';
  }

  if (score < 8.6) {
    return 'Very Lucky';
  }

  return 'Peak Alignment';
}

function buildOneLiner(score: number, dominantAction: DailyLuckActionStyle): string {
  if (score >= 8.6) {
    return 'Momentum is real, but keep it clean.';
  }

  if (dominantAction === 'wait-observe') {
    return 'Wait, observe, then strike.';
  }

  if (dominantAction === 'measured action') {
    return 'Move when the pattern confirms itself.';
  }

  return 'Act while the window is open.';
}

function buildSummary(
  score: number,
  dominantAction: DailyLuckActionStyle,
  domains: DailyLuckDomain[],
  relationshipWeight: number,
  moneyWeight: number,
  conflictDetected: boolean,
): string {
  const leadingDomains = domains.slice(0, 2);
  const domainText = leadingDomains.length > 0 ? leadingDomains.join(' and ') : 'intuition';

  if (conflictDetected) {
    return 'The sources do not fully agree, so today looks usable but conditional. Follow the reading that favors timing over force.';
  }

  if (dominantAction !== 'act now') {
    if (relationshipWeight > moneyWeight) {
      return 'Today rewards patience, authenticity, and acting only when the pattern is clear. Emotional and relationship energy reads stronger than money or risk-taking.';
    }

    return `Today rewards patience, authenticity, and acting only when the pattern is clear. The strongest themes sit around ${domainText}.`;
  }

  return `Today supports direct movement, especially where ${domainText} are concerned, but only if you stay selective about what deserves your energy.`;
}

function buildPlayStyle(score: number, dominantAction: DailyLuckActionStyle, domains: DailyLuckDomain[]): { strategy: string; avoid: string[]; favor: string[] } {
  if (dominantAction === 'wait-observe') {
    return {
      strategy: 'Wait for confirmation before acting',
      avoid: ['impulsive risk', 'flashy opportunities', 'forcing outcomes'],
      favor: ['pattern recognition', 'measured action', 'trusted environments'],
    };
  }

  if (dominantAction === 'measured action') {
    return {
      strategy: score >= 7 ? 'Take the clean opening, not the loudest one' : 'Move slowly and keep your standards high',
      avoid: ['overcommitting early', 'rushing timing', 'emotionally noisy decisions'],
      favor: ['discernment', 'steady pacing', domains[0] ?? 'intuition'],
    };
  }

  return {
    strategy: 'Act while momentum is supportive, but keep the scope realistic',
    avoid: ['chaotic multitasking', 'ego-driven bets', 'ignoring red flags'],
    favor: ['clear action', 'confident communication', domains[0] ?? 'career'],
  };
}

function buildPlainEnglish(date: string, score: number, luckLevel: string, breakdown: Record<DailyLuckProviderKey, DailyLuckSourceBreakdown>, summary: string, playStyle: { strategy: string; avoid: string[]; favor: string[] }, dominantAction: DailyLuckActionStyle): string {
  const lines = [
    `Daily Luck Score for ${date}`,
    `Score: ${score} / 9`,
    `Label: ${luckLevel}`,
    'Why each source influenced the score',
    `- Chinese daily: ${breakdown.chineseDaily.reason}`,
    `- Western daily: ${breakdown.westernDaily.reason}`,
    `- Sky today: ${breakdown.skyToday.reason}`,
    `- Love daily: ${breakdown.loveDaily.reason}`,
    `- Chinese yearly overview: ${breakdown.yearlyChinese.reason}`,
    'What it means today',
    summary,
    'Recommended approach',
    `${playStyle.strategy}. Favor ${playStyle.favor.join(', ')}. Avoid ${playStyle.avoid.join(', ')}.`,
    'Best mode for the day',
    dominantAction === 'wait-observe' ? 'Quiet timing mode' : dominantAction === 'measured action' ? 'Controlled advantage mode' : 'Action window mode',
  ];

  return lines.join('\n');
}

function createCacheKey(input: DailyLuckInput): string {
  return JSON.stringify({
    date: input.date,
    westernSign: input.westernSign ?? '',
    chineseSign: input.chineseSign ?? '',
    birthDate: input.birthDate,
    birthplace: input.birthplace ?? '',
    displayName: input.displayName ?? '',
    skyTodayUrl: input.skyTodayUrl ?? '',
  });
}

export async function analyzeDailyLuck(input: DailyLuckInput): Promise<DailyLuckAnalysisResponse> {
  const cacheKey = createCacheKey(input);
  const cache = getGlobalResponseCache();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  const { input: resolvedInput, sources } = await fetchLiveHoroscopeSources(input);
  const breakdown = {} as Record<DailyLuckProviderKey, DailyLuckSourceBreakdown>;
  let weightedSignalTotal = 0;
  let availableWeight = 0;
  let weightedStalePenalty = 0;
  let errorCount = 0;
  const actionWeights: Record<DailyLuckActionStyle, number> = {
    'act now': 0,
    'measured action': 0,
    'wait-observe': 0,
  };
  const domainWeights = new Map<DailyLuckDomain, number>();
  const successfulSignals: number[] = [];
  let relationshipWeight = 0;
  let moneyWeight = 0;

  for (const source of sources) {
    const sourceBreakdown = toBreakdown(source);
    breakdown[source.providerKey] = sourceBreakdown;

    if (source.status !== 'ok' || !sourceBreakdown.classification) {
      errorCount += 1;
      continue;
    }

    const { classification } = sourceBreakdown;
    weightedSignalTotal += classification.signal * source.weight;
    availableWeight += source.weight;
    actionWeights[classification.actionStyle] += source.weight;
    successfulSignals.push(classification.signal);

    classification.affectedDomains.forEach((domain) => {
      domainWeights.set(domain, (domainWeights.get(domain) ?? 0) + source.weight);
      if (domain === 'relationships' || domain === 'emotional') {
        relationshipWeight += source.weight;
      }
      if (domain === 'money' || domain === 'career') {
        moneyWeight += source.weight;
      }
    });

    if (source.isStale) {
      weightedStalePenalty += source.weight;
    }
  }

  const normalizedSignal = availableWeight > 0 ? weightedSignalTotal / availableWeight : 0;
  const maxSignal = successfulSignals.length > 0 ? Math.max(...successfulSignals) : 0;
  const minSignal = successfulSignals.length > 0 ? Math.min(...successfulSignals) : 0;
  const conflictDetected = maxSignal - minSignal >= 3;
  let luckScore = 5 + normalizedSignal * 1.8;
  if (luckScore > 8.6 && conflictDetected) {
    luckScore = 8.4;
  }
  if (luckScore > 8.6 && weightedStalePenalty > 0.25) {
    luckScore = 8.3;
  }
  const roundedLuckScore = roundToOne(clamp(luckScore, 1, 9));
  const sortedActions = Object.entries(actionWeights).sort((left, right) => right[1] - left[1]);
  const dominantAction = (sortedActions[0]?.[0] as DailyLuckActionStyle | undefined) ?? 'measured action';
  const dominantDomains = Array.from(domainWeights.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([domain]) => domain);
  const summary = buildSummary(roundedLuckScore, dominantAction, dominantDomains, relationshipWeight, moneyWeight, conflictDetected);
  const playStyle = buildPlayStyle(roundedLuckScore, dominantAction, dominantDomains);
  const missingWeight = TOTAL_WEIGHT - availableWeight;
  const confidence = roundToOne(
    clamp(
      0.58 + availableWeight * 0.36 - missingWeight * 0.18 - weightedStalePenalty * 0.16 - errorCount * 0.05,
      0.35,
      0.98,
    ),
  );
  const luckLevel = getLuckLevel(roundedLuckScore);
  const uiLabel = getUiLabel(roundedLuckScore);
  const plainEnglish = buildPlainEnglish(resolvedInput.date, roundedLuckScore, luckLevel, breakdown, summary, playStyle, dominantAction);

  const response: DailyLuckAnalysisResponse = {
    date: resolvedInput.date,
    profile: {
      displayName: resolvedInput.displayName,
      westernSign: resolvedInput.westernSign,
      chineseSign: resolvedInput.chineseSign,
      birthDate: resolvedInput.birthDate,
      birthplace: resolvedInput.birthplace,
    },
    luckScore: roundedLuckScore,
    luckLevel,
    confidence,
    summary,
    breakdown,
    playStyle,
    uiCard: {
      score: roundedLuckScore,
      label: uiLabel,
      oneLiner: buildOneLiner(roundedLuckScore, dominantAction),
    },
    sourceOrder: PROVIDER_ORDER,
    plainEnglish,
  };

  cache.set(cacheKey, {
    expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
    response,
  });

  console.log('[DailyLuckEngine] Built live analysis:', {
    date: resolvedInput.date,
    westernSign: resolvedInput.westernSign,
    chineseSign: resolvedInput.chineseSign,
    luckScore: response.luckScore,
    confidence: response.confidence,
    availableWeight,
    errorCount,
  });

  return response;
}
