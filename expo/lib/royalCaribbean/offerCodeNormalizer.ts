/**
 * Centralized normalization for Royal Caribbean / Celebrity casino offer codes.
 *
 * Royal codes appear in at least four families:
 *   - 26BCP105        (year 2 + brand 3 letters + 3 digits)
 *   - 26JUL104        (year 2 + month 3 letters + 3 digits)
 *   - 26TOC208        (Celebrity Top of Class)
 *   - 2605C03A        (year 4 + 1 letter + 2 digits + 1 letter — monthly certificate format)
 *
 * Royal's DOM frequently fuses the next cabin word onto the code, so
 *   "26BCP105Exterior" / "26JUL104Oceanview" / "2605C03AB" must all collapse to
 *   their canonical short form. Without a single normalizer the same offer was
 *   counted 2-3 times across DOM, network, and replay sweeps.
 *
 * IMPORTANT: every place that compares, dedupes, or groups Royal/Celebrity offer
 * codes MUST call `normalizeCasinoOfferCode` so the sync stays self-consistent.
 */

/**
 * Canonical Royal/Celebrity casino offer codes we have observed in CSVs/logs.
 * Adding a new code here automatically makes the suffix-stripping safe for
 * known families (e.g. 26BCP105A → 26BCP105). Unknown codes still pass through
 * with their full text intact so we never silently drop a new offer family.
 */
export const KNOWN_CASINO_OFFER_CODES: readonly string[] = [
  '26BCP105',
  '26JUL104',
  '26VTY104',
  '26WCR403',
  '26TOC208',
  '2605C03A',
];

const KNOWN_CASINO_OFFER_CODE_SET: ReadonlySet<string> = new Set(KNOWN_CASINO_OFFER_CODES);

/** Year-prefixed Royal/Celebrity casino offer pattern (matches the canonical core only). */
const ROYAL_OFFER_BASE_PATTERN = /^(26[A-Z]{2,4}\d{2,5}|2\d{3}[A-Z]\d{2}[A-Z])/;

function cleanOfferCode(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Collapse known suffix variants down to their canonical form.
 * Examples:
 *   26BCP105B     → 26BCP105
 *   26BCP105E     → 26BCP105   (Exterior tail)
 *   26BCP105O     → 26BCP105   (Oceanview tail)
 *   2605C03AB     → 2605C03A
 *   26TOC208A     → 26TOC208
 *   26WCR403B     → 26WCR403
 *   Unknown22XYZ  → UNKNOWN22XYZ (left as-is)
 */
export function normalizeCasinoOfferCode(rawCode: string | undefined | null): string {
  const code = cleanOfferCode(rawCode);
  if (!code) {
    return '';
  }

  // Direct hit: already canonical.
  if (KNOWN_CASINO_OFFER_CODE_SET.has(code)) {
    return code;
  }

  // Try stripping a single trailing letter and look up again. This collapses
  // "26BCP105E" → "26BCP105" without affecting unknown codes that legitimately
  // end in a letter (their full form passes through below).
  if (code.length > 4) {
    const stripped = code.slice(0, -1);
    if (KNOWN_CASINO_OFFER_CODE_SET.has(stripped)) {
      return stripped;
    }
  }

  // Generic family-aware suffix strip. Pull the leading canonical chunk that
  // matches the Royal/Celebrity offer pattern; the part after is treated as
  // DOM noise (cabin word, marketing letter, etc.).
  const family = code.match(ROYAL_OFFER_BASE_PATTERN);
  if (family) {
    const base = family[1];
    // Preserve a single legitimate trailing letter for codes that actually use
    // it (e.g. 2605C03A already ends with A). For 26XXXNNN style codes Royal's
    // canonical form is the 8-char chunk, so anything beyond it is noise.
    if (KNOWN_CASINO_OFFER_CODE_SET.has(base)) {
      return base;
    }
    // For 26BCP105 family codes (year 2 + 3 letters + 3 digits) any extra
    // trailing letters in the DOM mean cabin word fusion — collapse to base.
    if (/^26[A-Z]{2,4}\d{2,5}$/.test(base) && code.length > base.length) {
      return base;
    }
  }

  return code;
}

/** Returns true when two raw offer codes refer to the same canonical Royal offer. */
export function isSameCasinoOfferCode(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  const normalizedA = normalizeCasinoOfferCode(a);
  const normalizedB = normalizeCasinoOfferCode(b);
  if (!normalizedA || !normalizedB) {
    return false;
  }
  return normalizedA === normalizedB;
}

/**
 * Regex used by step1_offers DOM scraping to find offer codes on the visible
 * page. Kept here so the two sweep regexes stay in lock-step with the
 * normalizer's expectations.
 */
export const ROYAL_OFFER_DOM_REGEX_SOURCE = '(?:\\d{4}[A-Z]\\d{2}[A-Z]?|\\d{2}[A-Z]{2,8}\\d{2,5}[A-Z]?)';
