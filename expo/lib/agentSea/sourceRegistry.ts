import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';
import type { Certificate } from '@/components/CertificateManagerModal';
import type { CertificateDocumentRecord } from '@/lib/certificates/certificateDocumentStore';
import type { ProvenanceLink } from '@/types/provenance';
import { formatProvenanceCitation, provenanceCitation } from '@/lib/provenance/provenance';
import { buildLocalCertificateSailingIndex } from '@/lib/certificates/certificateSailingIndex';
import {
  buildCertificateSummaryReport,
  filterCertificateSummaryOptions,
  flattenCertificateSummaryOptions,
  sortCertificateSummaryOptions,
  type CertificateSummaryFilter,
} from '@/lib/certificates/certificateSummary';

export const AGENT_SEA_SOURCE_REGISTRY_VERSION = '4.0.0';

export type AgentSeaSourceType =
  | 'available_cruise' | 'offer' | 'certificate' | 'certificate_sailing'
  | 'booked_cruise' | 'completed_cruise' | 'casino' | 'crew'
  | 'calendar' | 'itinerary' | 'weather' | 'loyalty' | 'finance'
  | 'provenance';

export interface AgentSeaSourceDescriptor {
  recordType: AgentSeaSourceType;
  id: string;
  ownerProfileId: string | null;
  program: string | null;
  status: string;
  provenance: string;
  freshness: string | null;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  scope: 'shared' | 'private';
  citations?: string[];
}

export interface AgentSeaSourceManifest {
  version: string;
  generatedAt: string;
  counts: Partial<Record<AgentSeaSourceType, number>>;
  sourceCount: number;
  certificateSummary: {
    certificateCount: number;
    eligibleOptionCount: number;
    physicalSailingCount: number;
    distributionSignature?: string;
  };
}

function certificatesWithDocumentEvidence(input: RegistryInput): Certificate[] {
  const generated = (input.certificateDocuments ?? []).map((document) => {
    const latest = document.parseHistory.at(-1)?.result;
    const sailings = latest?.sailings ?? [];
    const code = latest?.earnedCertificateFace?.certificateCode ?? sailings[0]?.certificateCode ?? document.originalUrl.match(/(\d{4}[AC][A-Z0-9]+)/i)?.[1]?.toUpperCase();
    return {
      id: `agent-sea-document-${document.id}`,
      type: 'freeplay' as const,
      label: code ?? 'Downloaded certificate',
      value: 0,
      description: `${sailings.length} locally parsed sailing rows`,
      status: 'available' as const,
      certificateCode: code,
      sourcePdfUrl: document.originalUrl,
      sourceDocumentArchiveUri: document.provenance.documentArchiveUri ?? undefined,
      sourceDocumentHash: document.documentHash,
      parserSource: 'device' as const,
      parserStatus: latest?.status,
      parsedSailings: sailings,
    } satisfies Certificate;
  });
  const byEvidence = new Map<string, Certificate>();
  [...(input.certificates ?? []), ...generated].forEach((certificate) => {
    const identity = String(certificate.sourceDocumentHash ?? certificate.id);
    const current = byEvidence.get(identity);
    if (!current || (certificate.parsedSailings?.length ?? 0) > (current.parsedSailings?.length ?? 0)) byEvidence.set(identity, certificate);
  });
  return Array.from(byEvidence.values());
}

type RegistryInput = {
  /** Active private profile whose evidence Agent SEA is allowed to cite. */
  ownerId?: string | null;
  cruises?: Cruise[];
  offers?: CasinoOffer[];
  certificates?: Certificate[];
  certificateDocuments?: CertificateDocumentRecord[];
  bookedCruises?: BookedCruise[];
  calendarEvents?: CalendarEvent[];
  casinoCount?: number;
  crewCount?: number;
  weatherCount?: number;
  casinoRecords?: unknown[];
  crewRecords?: unknown[];
  weatherRecords?: unknown[];
  loyaltyRecords?: unknown[];
  financialRecords?: unknown[];
  provenanceRecords?: unknown[];
  generatedAt?: string;
  provenanceLinks?: ProvenanceLink[];
};

function value(record: unknown, key: string): unknown {
  return record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined;
}

function descriptor(recordType: AgentSeaSourceType, record: unknown, index: number, shared: boolean, provenanceLinks: ProvenanceLink[] = [], activeOwnerId?: string | null): AgentSeaSourceDescriptor {
  const id = String(value(record, 'id') ?? value(record, 'certificateCode') ?? `${recordType}-${index}`);
  const owner = shared ? null : (String(value(record, 'ownerProfileId') ?? value(record, 'userId') ?? value(record, 'ownerId') ?? '').trim() || activeOwnerId || null);
  const program = String(value(record, 'casinoProgram') ?? value(record, 'program') ?? value(record, 'provider') ?? '').trim() || null;
  const status = String(value(record, 'status') ?? value(record, 'completionState') ?? 'available');
  const freshness = String(value(record, 'updatedAt') ?? value(record, 'parsedAt') ?? value(record, 'syncedAt') ?? value(record, 'observedAt') ?? '').trim() || null;
  const provenance = String(value(record, 'parserSource') ?? value(record, 'source') ?? value(record, 'sourceType') ?? value(record, 'provider') ?? 'local-storage');
  const validation = String(value(record, 'validationStatus') ?? value(record, 'parserStatus') ?? '').toLowerCase();
  const recordedConfidence = String(value(record, 'confidence') ?? '').toLowerCase();
  const confidence = validation.includes('fail') || validation.includes('quarantine') || recordedConfidence === 'low' || recordedConfidence === 'missing'
    ? 'low'
    : validation || recordedConfidence === 'exact' || recordedConfidence === 'high'
      ? 'high'
      : recordedConfidence === 'estimated'
        ? 'low'
        : 'medium';
  const citations = provenanceLinks
    .filter((link) => link.entityId === id && (shared ? link.ownerId === null : owner !== null && link.ownerId === owner))
    .slice(0, 8)
    .map((link) => formatProvenanceCitation(provenanceCitation(link, link.field)));
  return { recordType, id, ownerProfileId: owner, program, status, provenance, freshness, confidence, scope: shared ? 'shared' : 'private', citations };
}

export function buildAgentSeaSourceRegistry(input: RegistryInput): AgentSeaSourceDescriptor[] {
  const rows: AgentSeaSourceDescriptor[] = [];
  const add = (type: AgentSeaSourceType, records: unknown[], shared: boolean) => records.forEach((record, index) => rows.push(descriptor(type, record, index, shared, input.provenanceLinks, input.ownerId)));
  add('available_cruise', input.cruises ?? [], true);
  add('offer', input.offers ?? [], true);
  const certificateEvidence = certificatesWithDocumentEvidence(input);
  add('certificate', certificateEvidence, true);
  const options = flattenCertificateSummaryOptions(buildLocalCertificateSailingIndex(certificateEvidence));
  add('certificate_sailing', options, true);
  const booked = input.bookedCruises ?? [];
  add('booked_cruise', booked.filter((row) => row.status !== 'completed' && row.completionState !== 'completed'), false);
  add('completed_cruise', booked.filter((row) => row.status === 'completed' || row.completionState === 'completed'), false);
  add('itinerary', booked.filter((row) => Array.isArray(row.itinerary) ? row.itinerary.length > 0 : Boolean(value(row, 'itinerary'))), false);
  add('calendar', input.calendarEvents ?? [], false);
  add('casino', input.casinoRecords ?? [], false);
  add('crew', input.crewRecords ?? [], false);
  add('weather', input.weatherRecords ?? [], false);
  add('loyalty', input.loyaltyRecords ?? [], false);
  add('finance', input.financialRecords ?? [], false);
  add('provenance', input.provenanceRecords ?? [], false);
  for (let index = (input.casinoRecords ?? []).length; index < (input.casinoCount ?? 0); index += 1) rows.push(descriptor('casino', { id: `casino-count-${index}`, source: 'count-only' }, index, false, input.provenanceLinks, input.ownerId));
  for (let index = (input.crewRecords ?? []).length; index < (input.crewCount ?? 0); index += 1) rows.push(descriptor('crew', { id: `crew-count-${index}`, source: 'count-only' }, index, false, input.provenanceLinks, input.ownerId));
  for (let index = (input.weatherRecords ?? []).length; index < (input.weatherCount ?? 0); index += 1) rows.push(descriptor('weather', { id: `weather-count-${index}`, source: 'count-only' }, index, false, input.provenanceLinks, input.ownerId));
  return rows;
}

export function buildAgentSeaProvenanceCitationBlock(descriptors: AgentSeaSourceDescriptor[]): string {
  const citations = descriptors.flatMap((descriptor) => descriptor.citations ?? []).filter(Boolean);
  return citations.length ? `Source evidence:\n${Array.from(new Set(citations)).slice(0, 30).map((citation) => `- ${citation}`).join('\n')}` : 'Source evidence: no field-level provenance has been recorded for these records yet.';
}

export function buildAgentSeaSourceManifest(input: RegistryInput): AgentSeaSourceManifest {
  const certificateEvidence = certificatesWithDocumentEvidence(input);
  const summary = buildCertificateSummaryReport(buildLocalCertificateSailingIndex(certificateEvidence));
  const booked = input.bookedCruises ?? [];
  const counts: Partial<Record<AgentSeaSourceType, number>> = {
    available_cruise: input.cruises?.length ?? 0,
    offer: input.offers?.length ?? 0,
    certificate: certificateEvidence.length,
    certificate_sailing: summary.totalOptions,
    booked_cruise: booked.filter((row) => row.status !== 'completed' && row.completionState !== 'completed').length,
    completed_cruise: booked.filter((row) => row.status === 'completed' || row.completionState === 'completed').length,
    itinerary: booked.filter((row) => Array.isArray(row.itinerary) ? row.itinerary.length > 0 : Boolean(value(row, 'itinerary'))).length,
    calendar: input.calendarEvents?.length ?? 0,
    casino: Math.max(input.casinoRecords?.length ?? 0, input.casinoCount ?? 0),
    crew: Math.max(input.crewRecords?.length ?? 0, input.crewCount ?? 0),
    weather: Math.max(input.weatherRecords?.length ?? 0, input.weatherCount ?? 0),
    loyalty: input.loyaltyRecords?.length ?? 0,
    finance: input.financialRecords?.length ?? 0,
    provenance: input.provenanceRecords?.length ?? 0,
  };
  const sourceCount = Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
  return {
    version: AGENT_SEA_SOURCE_REGISTRY_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    counts,
    sourceCount,
    certificateSummary: {
      certificateCount: summary.certificateCount,
      eligibleOptionCount: summary.totalOptions,
      physicalSailingCount: summary.physicalSailingCount,
      distributionSignature: summary.rows.map((row) => [row.certificateCode, row.points, row.totalOptions, row.physicalSailings, row.oneGuestOptions, row.twoGuestOptions, row.unknownGuestOptions].join(':')).sort().join('|'),
    },
  };
}

export type AgentSeaQuestionPlan = {
  sources: AgentSeaSourceType[];
  comparisonRequested: boolean;
  certificateOnly: boolean;
  reasons: string[];
};

export function planAgentSeaQuestion(question: string): AgentSeaQuestionPlan {
  const q = question.toLowerCase();
  const sources = new Set<AgentSeaSourceType>();
  const reasons: string[] = [];
  const comparisonRequested = /compare|versus|vs\.?|difference|booked and|past and/.test(q);
  const explicitCertificateInventory = /certificate|cert\b|points? level|one guest|two guests|1 guest|2 guests/.test(q)
    || (/(?:next|this|current) month/.test(q) && /available|offer|sailing|cruise/.test(q));
  const personalCruiseHistory = /(?:last|latest|previous|most recent)\s+(?:(?:\w+\s+){0,4})?(?:cruise|sailing|voyage)|completed|past cruise|sailed/.test(q);
  const casinoPerformance = /casino|points? earned|earned?\s+points?|points?\s+(?:did|do|have|got|get)|coin.?in|theoretical|adt|win|loss|roi|return on investment/.test(q);
  if (explicitCertificateInventory) { sources.add('certificate'); sources.add('certificate_sailing'); reasons.push('certificate inventory terms'); }
  if (/available|offer|deal|comp cruise/.test(q)) { sources.add('offer'); sources.add('available_cruise'); reasons.push('offer/availability terms'); }
  if (/booked|reservation|upcoming cruise/.test(q)) { sources.add('booked_cruise'); reasons.push('booked-cruise terms'); }
  if (personalCruiseHistory) { sources.add('completed_cruise'); reasons.push('completed-cruise terms'); }
  if (casinoPerformance) { sources.add('casino'); reasons.push('casino terms'); }
  if (casinoPerformance && personalCruiseHistory) {
    sources.add('certificate');
    reasons.push('earned-certificate evidence may corroborate completed-cruise casino points');
  }
  if (/crew|recognition|employee/.test(q)) { sources.add('crew'); reasons.push('crew terms'); }
  if (/calendar|agenda|when/.test(q)) { sources.add('calendar'); reasons.push('calendar terms'); }
  if (/itinerary|port|route/.test(q)) { sources.add('itinerary'); reasons.push('itinerary terms'); }
  if (/weather|wave|wind|storm|hurricane/.test(q)) { sources.add('weather'); reasons.push('weather terms'); }
  if (/loyalty|tier|club royale|blue chip|crown\s*&?\s*anchor|captain'?s club/.test(q)) { sources.add('loyalty'); reasons.push('loyalty terms'); }
  if (/finance|financial|payment|paid|cost|price|retail|savings|obc|freeplay|free play/.test(q)) { sources.add('finance'); reasons.push('financial terms'); }
  if (/provenance|source|evidence|where .*come from|how .*calculated|formula|confidence/.test(q)) { sources.add('provenance'); reasons.push('provenance terms'); }
  if (!sources.size) { sources.add('available_cruise'); sources.add('offer'); sources.add('certificate'); sources.add('certificate_sailing'); sources.add('booked_cruise'); sources.add('completed_cruise'); reasons.push('broad natural-language question'); }
  const certificateOnly = explicitCertificateInventory
    && sources.has('certificate_sailing')
    && !comparisonRequested
    && !personalCruiseHistory
    && !casinoPerformance
    && !/booked|reservation/.test(q);
  if (certificateOnly) { sources.delete('booked_cruise'); sources.delete('completed_cruise'); }
  return { sources: Array.from(sources), comparisonRequested, certificateOnly, reasons };
}

function monthKey(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildCertificateToolFilter(question: string): CertificateSummaryFilter {
  const q = question.toLowerCase();
  const filter: CertificateSummaryFilter = {};
  if (/next month/.test(q)) filter.certificateMonths = [monthKey(1)];
  else if (/this month|current month/.test(q)) filter.certificateMonths = [monthKey(0)];
  if (/\b(?:1|one)[ -]?guest/.test(q)) filter.guestCounts = [1];
  if (/\b(?:2|two)[ -]?guest/.test(q)) filter.guestCounts = [2];
  if (/europe|mediterranean|greece|italy|spain|norway/.test(q)) filter.regions = ['Europe'];
  if (/bahamas|perfect day|cococay|nassau/.test(q)) filter.regions = ['Bahamas & Perfect Day'];
  const shipNames = ['Icon', 'Star', 'Utopia', 'Wonder', 'Harmony', 'Oasis', 'Allure', 'Symphony', 'Quantum', 'Ovation', 'Anthem', 'Spectrum', 'Freedom', 'Independence', 'Liberty', 'Navigator', 'Mariner', 'Voyager', 'Adventure', 'Explorer', 'Radiance', 'Brilliance', 'Serenade', 'Jewel', 'Vision', 'Rhapsody', 'Grandeur', 'Enchantment'];
  const ships = shipNames.filter((name) => new RegExp(`\\b${name.toLowerCase()}\\b`).test(q));
  if (ships.length) filter.shipNames = ships;
  const classes = ['Icon', 'Oasis', 'Quantum', 'Freedom', 'Voyager', 'Radiance', 'Vision'];
  const matchedClasses = classes.filter((name) => new RegExp(`\\b${name.toLowerCase()} class\\b`).test(q));
  if (matchedClasses.length) filter.shipClasses = matchedClasses;
  const cabins = ['interior', 'ocean view', 'oceanview', 'balcony', 'suite', 'junior suite', 'grand suite'];
  const matchedCabins = cabins.filter((name) => q.includes(name));
  if (matchedCabins.length) filter.cabinLabels = Array.from(new Set(matchedCabins.map((name) => name === 'oceanview' ? 'Ocean View' : name.replace(/\b\w/g, (letter) => letter.toUpperCase()))));
  const nights = q.match(/(?:exactly|for)?\s*(\d{1,2})[- ]night/);
  if (nights) filter.minimumNights = filter.maximumNights = Number(nights[1]);
  if (/\bgty\b/.test(q)) filter.gty = true;
  if (/non[- ]?gty/.test(q)) filter.gty = false;
  if (/nextcruise|next cruise/.test(q)) filter.hasNextCruiseBonus = true;
  const minimumPoints = q.match(/(?:at least|minimum|min|over)\s+([\d,]+)\s*points?/);
  if (minimumPoints) filter.minimumPoints = Number(minimumPoints[1].replace(/,/g, ''));
  const points = q.match(/(?:at|under|up to|maximum|max)\s+([\d,]+)\s*points?/);
  if (points) filter.maximumPoints = Number(points[1].replace(/,/g, ''));
  const dateRange = q.match(/(20\d{2}-\d{2}-\d{2}).*?(20\d{2}-\d{2}-\d{2})/);
  if (dateRange) { filter.startDate = dateRange[1]; filter.endDate = dateRange[2]; }
  const port = q.match(/(?:from|depart(?:ing|ure)? from)\s+([a-z .'-]+?)(?:\s+(?:in|on|under|with|for)|[,.?]|$)/);
  if (port?.[1]?.trim()) filter.departurePorts = [port[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase())];
  return filter;
}

export const executeCertificateSailingSearchTool = executeCertificateSummaryTool;

export function executeAgentSeaSourceManifestTool(question: string, manifest: AgentSeaSourceManifest): string {
  const plan = planAgentSeaQuestion(question);
  const requested = plan.sources.length > 0 ? plan.sources : (Object.keys(manifest.counts) as AgentSeaSourceType[]);
  const rows = requested.map((source) => `- ${source.replace(/_/g, ' ')}: ${(manifest.counts[source] ?? 0).toLocaleString()} indexed record(s)`);
  return [
    `Agent SEA source manifest ${manifest.version}, generated ${manifest.generatedAt}.`,
    `The active manifest contains ${manifest.sourceCount.toLocaleString()} bounded source descriptors. Shared inventory is limited to offers, available sailings, and downloaded certificate evidence; traveler records remain private to the active owner.`,
    rows.join('\n'),
    `Certificate index: ${manifest.certificateSummary.certificateCount.toLocaleString()} certificate(s), ${manifest.certificateSummary.eligibleOptionCount.toLocaleString()} eligible option row(s), ${manifest.certificateSummary.physicalSailingCount.toLocaleString()} physical ship/date sailing(s).`,
  ].join('\n\n');
}

let sourceIndexGeneration = 0;
let pendingIndexTimer: ReturnType<typeof setTimeout> | null = null;
let latestManifest: AgentSeaSourceManifest | null = null;
export function invalidateAgentSeaSourceIndex(_reason: string): number { sourceIndexGeneration += 1; latestManifest = null; if (pendingIndexTimer) { clearTimeout(pendingIndexTimer); pendingIndexTimer = null; } return sourceIndexGeneration; }
export function getCachedAgentSeaSourceManifest(): AgentSeaSourceManifest | null { return latestManifest; }
export function scheduleAgentSeaSourceManifestRebuild(input: RegistryInput, onBuilt?: (manifest: AgentSeaSourceManifest) => void): () => void {
  const generation = invalidateAgentSeaSourceIndex('source mutation');
  const rebuild = () => { const started = Date.now(); const manifest = buildAgentSeaSourceManifest(input); if (generation === sourceIndexGeneration) { latestManifest = manifest; onBuilt?.(manifest); } pendingIndexTimer = null; if (Date.now() - started > 50) console.info('[AgentSEA] Source manifest rebuilt after UI idle', { milliseconds: Date.now() - started, sourceCount: manifest.sourceCount }); };
  const idle = (globalThis as typeof globalThis & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => unknown }).requestIdleCallback;
  if (idle) {
    const handle = idle(rebuild, { timeout: 1200 });
    return () => {
      const cancelIdle = (globalThis as typeof globalThis & { cancelIdleCallback?: (idleHandle: unknown) => void }).cancelIdleCallback;
      if (cancelIdle) cancelIdle(handle);
      invalidateAgentSeaSourceIndex('cancelled idle rebuild');
    };
  }
  pendingIndexTimer = setTimeout(rebuild, 120);
  return () => { if (pendingIndexTimer) clearTimeout(pendingIndexTimer); pendingIndexTimer = null; };
}

export function executeCertificateSummaryTool(question: string, certificates: Certificate[]): { text: string; filter: CertificateSummaryFilter; optionIds: string[] } {
  const filter = buildCertificateToolFilter(question);
  const options = flattenCertificateSummaryOptions(buildLocalCertificateSailingIndex(certificates));
  const filtered = sortCertificateSummaryOptions(filterCertificateSummaryOptions(options, filter), 'soonest');
  const report = buildCertificateSummaryReport(buildLocalCertificateSailingIndex(certificates), filter);
  const rows = report.rows.slice(0, 20).map((row) => `- ${row.certificateCode}: ${row.points == null ? 'points not stated' : `${row.points.toLocaleString()} points`}; ${row.totalOptions.toLocaleString()} eligible option rows (${row.oneGuestOptions.toLocaleString()} one-guest, ${row.twoGuestOptions.toLocaleString()} two-guest); ${row.physicalSailings.toLocaleString()} physical sailings; ${row.shortestNights ?? '?'}–${row.longestNights ?? '?'} nights.`);
  const examples = filtered.slice(0, 12).map((row) => `- ${row.shipName} ${row.sailDate}: ${row.itinerary || 'itinerary not stated'}; ${row.cabinLabel || 'cabin not stated'}; ${row.guestCount == null ? 'guest count not stated' : `${row.guestCount} guest${row.guestCount === 1 ? '' : 's'}`}; ${row.certificateCode} (${row.points?.toLocaleString() ?? '?'} points); evidence${row.sourcePage == null ? '' : ` PDF page ${row.sourcePage}`}.`);
  return {
    filter,
    optionIds: filtered.map((row) => row.optionId),
    text: [
      `Certificate evidence only: ${report.totalOptions.toLocaleString()} eligible option rows across ${report.physicalSailingCount.toLocaleString()} physical ship/date sailings and ${report.certificateCount.toLocaleString()} certificate codes.`,
      `Included: downloaded, locally parsed certificate sailing rows. Excluded: booked cruises, completed cruises, and general available-cruise inventory unless explicitly requested.`,
      rows.join('\n') || 'No certificate-code totals match the requested filters.',
      examples.length ? `Matching sailing evidence:\n${examples.join('\n')}` : 'No downloaded certificate sailing rows match the requested filters.',
    ].join('\n\n'),
  };
}
