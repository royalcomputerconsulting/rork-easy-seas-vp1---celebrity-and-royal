import type { InstantCertificateSailing } from './instantCertificateSummaries';

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function money(value: string): number | null {
  const match = value.match(/\$\s*([0-9][0-9,]*(?:\.\d{2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function parseNights(text: string): number | null {
  const match = text.match(/\b(\d{1,2})\s*(?:N|NIGHT|NIGHTS)\b/i);
  return match ? Number(match[1]) : null;
}

function parseDate(text: string): string {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }
  const month = text.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (month) {
    const months: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
    return `${month[3]}-${months[month[1].slice(0, 3).toUpperCase()]}-${month[2].padStart(2, '0')}`;
  }
  return '';
}

function parseCabin(text: string): InstantCertificateSailing['stateroomCategory'] {
  const upper = text.toUpperCase();
  if (upper.includes('JUNIOR SUITE')) return 'junior-suite';
  if (upper.includes('SUITE')) return 'suite';
  if (upper.includes('BALCONY')) return 'balcony';
  if (upper.includes('OCEAN VIEW') || upper.includes('OCEANVIEW')) return 'oceanview';
  if (upper.includes('INTERIOR') || upper.includes('INSIDE')) return 'interior';
  return 'unknown';
}

function parseGuestCoverage(text: string): InstantCertificateSailing['guestCoverage'] {
  const upper = text.toUpperCase();
  if (upper.includes('CRUISE FARE FOR 2') || upper.includes('CRUISE FARE FOR TWO')) return 'cruise-fare-for-2';
  if (upper.includes('CRUISE FARE FOR 1') || upper.includes('CRUISE FARE FOR ONE')) return 'cruise-fare-for-1';
  return 'unknown';
}

function parseShip(line: string): string {
  const match = line.match(/([A-Z][A-Z'\s&.-]+?)(?:\s+OF\s+THE\s+SEAS)?(?=\s+(?:\d{1,2}\s*(?:N|NIGHT)|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|20\d{2}|\d{1,2}\/\d{1,2}\/))/i);
  if (match?.[1]) return clean(match[1].replace(/\bOF THE SEAS\b/i, 'Of The Seas'));
  const ship = line.match(/\b([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+){0,3}\s+OF\s+THE\s+SEAS)\b/i);
  return clean(ship?.[1] ?? '');
}

function parseDeparturePort(line: string): string {
  const match = line.match(/(?:FROM|DEPARTS?|DEPARTURE PORT)\s+([A-Z][A-Z\s.,'-]+?)(?:\s{2,}|\s+\d{1,2}\s*(?:N|NIGHT)|\s+INTERIOR|\s+OCEAN|\s+BALCONY|\s+SUITE|$)/i);
  return clean(match?.[1] ?? '');
}

function parseOfferType(line: string): string {
  const coverage = parseGuestCoverage(line);
  if (coverage === 'cruise-fare-for-2') return 'Cruise Fare For 2 Guests';
  if (coverage === 'cruise-fare-for-1') return 'Cruise Fare For 1 Guest';
  return clean(line.match(/(CRUISE FARE[^$]+|FREEPLAY|FREE PLAY)/i)?.[1] ?? 'Instant Reward Certificate');
}

function parseItinerary(line: string): string {
  const match = line.match(/(?:NIGHT|NIGHTS|N)\s+([A-Z][A-Z\s,&.'/-]+?)(?:\s+INTERIOR|\s+OCEAN|\s+BALCONY|\s+JUNIOR|\s+SUITE|\s+GTY|\s+CRUISE FARE|\s+FREEPLAY|$)/i);
  return clean(match?.[1] ?? '');
}

function looksLikeSailingLine(line: string): boolean {
  const upper = line.toUpperCase();
  const hasAnchor = /\b(NIGHT|NIGHTS|\d{1,2}N|INTERIOR|OCEANVIEW|OCEAN VIEW|BALCONY|JUNIOR SUITE|SUITE|GTY|CRUISE FARE FOR|FREEPLAY|FREE PLAY)\b/.test(upper);
  const hasDate = Boolean(parseDate(line));
  return hasAnchor && (hasDate || /\bOF THE SEAS\b/i.test(line) || /\b\d{1,2}\s*(?:N|NIGHT|NIGHTS)\b/i.test(line));
}

export function parseInstantCertificateDetailText(input: { text: string; offerCode: string }): { sailings: InstantCertificateSailing[]; warnings: string[] } {
  const text = String(input.text ?? '');
  const warnings: string[] = [];
  if (!text.trim()) return { sailings: [], warnings: ['Detail PDF text was empty. Preserve cached data if available.'] };

  const rawLines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const lines: string[] = [];
  for (const line of rawLines) {
    if (looksLikeSailingLine(line)) lines.push(line);
  }
  if (!lines.length) {
    const synthetic = clean(text);
    if (looksLikeSailingLine(synthetic)) lines.push(synthetic);
  }
  if (!lines.length) warnings.push('No sailing rows were detected by certificate detail anchors.');

  const sailings = lines.map((line): InstantCertificateSailing => {
    const stateroomCategory = parseCabin(line);
    const freeplay = /FREE\s*PLAY|FREEPLAY/i.test(line) ? money(line) : null;
    const obcMatch = line.match(/(?:OBC|ONBOARD CREDIT)[^$]{0,15}\$\s*([0-9][0-9,]*)/i);
    return {
      offerCode: input.offerCode,
      shipName: parseShip(line),
      departurePort: parseDeparturePort(line),
      sailDate: parseDate(line),
      itinerary: parseItinerary(line),
      nights: parseNights(line),
      stateroomType: stateroomCategory === 'unknown' ? '' : stateroomCategory,
      stateroomCategory,
      isGuarantee: /\bGTY\b|GUARANTEE/i.test(line),
      offerType: parseOfferType(line),
      guestCoverage: parseGuestCoverage(line),
      nextCruiseBonusFreeplay: freeplay,
      nextCruiseObc: obcMatch ? Number(obcMatch[1].replace(/,/g, '')) : null,
      taxesFeeText: clean(line.match(/(?:TAXES|FEES)[^.;]*/i)?.[0] ?? ''),
      rawText: line,
    };
  });

  for (const sailing of sailings) {
    if (!sailing.shipName) warnings.push(`Sailing row missing ship name: ${sailing.rawText.slice(0, 120)}`);
    if (!sailing.sailDate) warnings.push(`Sailing row missing sail date: ${sailing.rawText.slice(0, 120)}`);
    if (!sailing.nights) warnings.push(`Sailing row missing nights: ${sailing.rawText.slice(0, 120)}`);
  }

  return { sailings, warnings };
}

export function mergeDetailSailingsWithCache<T extends { sailings: InstantCertificateSailing[]; detailStatus?: string; warnings?: string[] }>(latest: T, cached?: T): T {
  if (latest.sailings?.length) return latest;
  if (!cached?.sailings?.length) return latest;
  return {
    ...latest,
    sailings: cached.sailings,
    detailStatus: 'error',
    warnings: [...(latest.warnings ?? []), 'Preserved cached detail sailings because the latest parse produced zero rows.'],
  } as T;
}
