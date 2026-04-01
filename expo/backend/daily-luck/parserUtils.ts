type JsonRecord = Record<string, unknown>;

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

export function collapseWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

export function stripTags(value: string): string {
  return collapseWhitespace(value.replace(/<[^>]+>/g, ' '));
}

function getMetaContent(html: string, attribute: 'name' | 'property', key: string): string {
  const pattern = new RegExp(`<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${key}["'][^>]*>`, 'i');
  const match = html.match(pattern) ?? html.match(reversePattern);
  return match?.[1] ? collapseWhitespace(match[1]) : '';
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? collapseWhitespace(match[1]) : '';
}

function extractParagraphs(html: string): string[] {
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripTags(match[1] ?? ''))
    .filter((text) => text.length >= 40);

  return Array.from(new Set(paragraphs)).slice(0, 5);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectJsonRecords(value: unknown): JsonRecord[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonRecords(item));
  }

  if (typeof value === 'object') {
    const record = value as JsonRecord;
    const graphValue = record['@graph'];
    return [record, ...collectJsonRecords(graphValue)];
  }

  return [];
}

function extractJsonLdRecords(html: string): JsonRecord[] {
  const scripts = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  const records = scripts.flatMap((match) => collectJsonRecords(safeJsonParse((match[1] ?? '').trim())));
  return records;
}

function getStringField(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? collapseWhitespace(value) : '';
}

function getNestedStringField(record: JsonRecord, key: string, nestedKey: string): string {
  const nestedValue = record[key];
  if (!nestedValue || typeof nestedValue !== 'object' || Array.isArray(nestedValue)) {
    return '';
  }

  const nestedRecord = nestedValue as JsonRecord;
  return typeof nestedRecord[nestedKey] === 'string' ? collapseWhitespace(String(nestedRecord[nestedKey])) : '';
}

function findBestJsonLdText(records: JsonRecord[]): string {
  for (const record of records) {
    const articleBody = getStringField(record, 'articleBody');
    if (articleBody.length >= 80) {
      return articleBody;
    }
  }

  for (const record of records) {
    const description = getStringField(record, 'description');
    if (description.length >= 60) {
      return description;
    }
  }

  return '';
}

export function extractFirstSentence(value: string): string {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);

  return sentences[0] ?? value.trim();
}

export function extractVisibleDateText(value: string): string {
  const monthRegex = '(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},\\s+\\d{4}';
  const shortMonthRegex = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?\\s+\\d{1,2},\\s+\\d{4}';
  const weekdayRegex = '(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\\s+';
  const patterns = [
    new RegExp(`${weekdayRegex}${monthRegex}`, 'i'),
    new RegExp(monthRegex, 'i'),
    new RegExp(shortMonthRegex, 'i'),
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
    /\b202\d\b/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[0]) {
      return collapseWhitespace(match[0]);
    }
  }

  return '';
}

export function normalizeDateTextToIso(value: string): string | undefined {
  const normalizedValue = collapseWhitespace(value);
  if (!normalizedValue) {
    return undefined;
  }

  const isoMatch = normalizedValue.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = normalizedValue.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    return `${slashMatch[3]}-${String(slashMatch[1]).padStart(2, '0')}-${String(slashMatch[2]).padStart(2, '0')}`;
  }

  const monthMatch = normalizedValue.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),\s+(\d{4})/i);
  if (monthMatch) {
    const rawMonth = monthMatch[1].toLowerCase().replace('.', '');
    const monthMap: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };
    const month = monthMap[rawMonth];
    if (month) {
      return `${monthMatch[3]}-${String(month).padStart(2, '0')}-${String(monthMatch[2]).padStart(2, '0')}`;
    }
  }

  const yearMatch = normalizedValue.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return undefined;
}

function extractVisibleText(html: string): string {
  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  return stripTags(cleanedHtml);
}

export interface ParsedArticlePayload {
  title: string;
  mainText: string;
  excerpt: string;
  visibleDateText: string;
  sourceDateText: string;
  detectedDateIso?: string;
  author?: string;
  publishedTime?: string;
  articleType?: string;
}

export function parseArticlePayload(html: string): ParsedArticlePayload {
  const records = extractJsonLdRecords(html);
  const paragraphs = extractParagraphs(html);
  const metaDescription = getMetaContent(html, 'name', 'description') || getMetaContent(html, 'property', 'og:description');
  const title = extractTitle(html) || getMetaContent(html, 'property', 'og:title');
  const jsonLdText = findBestJsonLdText(records);
  const paragraphText = collapseWhitespace(paragraphs.join(' '));
  const visibleText = extractVisibleText(html);
  const mainText = jsonLdText || paragraphText || metaDescription || visibleText;
  const excerpt = extractFirstSentence(mainText || metaDescription || visibleText);
  const visibleDateText = extractVisibleDateText(`${title} ${mainText} ${visibleText}`);
  const publishedTime = records.map((record) => getStringField(record, 'datePublished')).find(Boolean) || getMetaContent(html, 'property', 'article:published_time') || getMetaContent(html, 'name', 'date');
  const sourceDateText = visibleDateText || publishedTime || extractVisibleDateText(title) || '';
  const detectedDateIso = normalizeDateTextToIso(sourceDateText);
  const author = records.map((record) => getNestedStringField(record, 'author', 'name') || getStringField(record, 'author')).find(Boolean) || getMetaContent(html, 'name', 'author');
  const articleType = records.map((record) => getStringField(record, '@type')).find(Boolean);

  return {
    title,
    mainText,
    excerpt,
    visibleDateText,
    sourceDateText,
    detectedDateIso,
    author: author || undefined,
    publishedTime: publishedTime || undefined,
    articleType: articleType || undefined,
  };
}

export function sameDay(requestedDate: string, sourceDateIso: string | undefined): boolean {
  if (!sourceDateIso) {
    return false;
  }

  return requestedDate === sourceDateIso;
}

export function sameYear(requestedDate: string, sourceDateIso: string | undefined): boolean {
  if (!sourceDateIso) {
    return false;
  }

  return requestedDate.slice(0, 4) === sourceDateIso.slice(0, 4);
}

export function getRequestedDateYear(requestedDate: string): string {
  return requestedDate.slice(0, 4);
}

export function buildYearDateText(year: string): string {
  const yearNumber = Number(year);
  if (!Number.isFinite(yearNumber)) {
    return '';
  }

  return String(yearNumber);
}

export function listMonthTokens(): readonly string[] {
  return MONTH_NAMES;
}
