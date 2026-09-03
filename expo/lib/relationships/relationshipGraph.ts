import type { MapEdge, MapNode } from '@/components/ui/InteractiveRelationshipMap';

type RelationshipRecord = Record<string, unknown>;
export type RelationshipCorrection = 'confirm' | 'reject';

export interface RelationshipGraph {
  nodes: MapNode[];
  edges: MapEdge[];
  completed: number;
  certificates: number;
  realized: number;
  corrections: number;
  eligibleSailings: number;
  bookings: number;
  unresolved: number;
  truncated: number;
}

const points = (row: RelationshipRecord): number =>
  Number(row.casinoPoints ?? row.pointsEarned ?? row.casinoPointsEarned ?? 0) || 0;
const date = (value: unknown): number => {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const id = (record: RelationshipRecord, fallback: string | number): string =>
  String(record.id ?? record.certificateCode ?? record.offerCode ?? fallback);

const text = (record: RelationshipRecord, ...keys: string[]): string => {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
};
const numeric = (record: RelationshipRecord, ...keys: string[]): number => {
  for (const key of keys) {
    const candidate = Number(record[key]);
    if (Number.isFinite(candidate)) return candidate;
  }
  return 0;
};
const numericEvidence = (record: RelationshipRecord, ...keys: string[]): number | null => {
  for (const key of keys) {
    const candidate = record[key];
    if (candidate === null || candidate === undefined || candidate === '') continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const certificateThresholdPoints = (record: RelationshipRecord): number => numeric(
  record,
  'pointsRequired',
  'pointRequirement',
  'thresholdPoints',
  'pointsEarnedEstimate',
  'points',
);
const recordOwner = (record: RelationshipRecord): string => text(record, 'ownerId', 'ownerProfileId', 'pointEarningProfileId', 'userId', 'sourceEmail').toLowerCase();
const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sailingKey = (record: RelationshipRecord): string => [text(record, 'shipName', 'ship'), text(record, 'sailDate', 'departureDate', 'date'), text(record, 'cabinType', 'cabinLabel', 'stateroom'), String(record.guestCount ?? record.guests ?? '')].map(normalize).join('|');
const parsedRows = (record: RelationshipRecord): RelationshipRecord[] => Array.isArray(record.parsedSailings) ? record.parsedSailings.filter((row): row is RelationshipRecord => Boolean(row && typeof row === 'object')) : [];
const MAX_PRIVATE_RECORDS = 80;
const MAX_SHARED_RECORDS = 120;

/**
 * Builds the complete cruise -> certificate -> offer -> realized-value graph.
 * Callers provide records already scoped to the active profile. Saved IDs and
 * codes are exact; date-near links remain inferred until that profile confirms.
 */
export function buildRelationshipGraph(input: {
  bookedCruises?: RelationshipRecord[];
  certificates?: RelationshipRecord[];
  offers?: RelationshipRecord[];
  availableCruises?: RelationshipRecord[];
  casinoSessions?: RelationshipRecord[];
  loyaltyRecords?: RelationshipRecord[];
  corrections?: Record<string, RelationshipCorrection>;
  activeOwnerId?: string | null;
  includeUnassignedPrivate?: boolean;
}): RelationshipGraph {
  const activeOwner = String(input.activeOwnerId ?? '').toLowerCase();
  const privateRows = (input.bookedCruises ?? []).filter((row) => {
    const owner = recordOwner(row);
    if (owner) return Boolean(activeOwner) && owner === activeOwner;
    return input.includeUnassignedPrivate === true;
  });
  const allCompleted = privateRows
    .filter((row) => String(row.status).toLowerCase() === 'completed' || String(row.completionState).toLowerCase() === 'completed')
    .filter((row) => points(row) > 0);
  const allBookings = privateRows.filter((row) => Boolean(text(row, 'reservationNumber', 'bookingNumber', 'confirmationNumber')) || String(row.status).toLowerCase() !== 'available');
  const allCertificates = input.certificates ?? [];
  const allOffers = input.offers ?? [];
  const allCasinoSessions = (input.casinoSessions ?? []).filter((row) => {
    const owner = recordOwner(row);
    if (owner) return Boolean(activeOwner) && owner === activeOwner;
    return input.includeUnassignedPrivate === true;
  });
  const allLoyaltyRecords = input.loyaltyRecords ?? [];
  const completed = allCompleted.slice(0, MAX_PRIVATE_RECORDS);
  const bookings = allBookings.slice(0, MAX_PRIVATE_RECORDS);
  const certificates = allCertificates.slice(0, MAX_SHARED_RECORDS);
  const offers = allOffers.slice(0, MAX_SHARED_RECORDS);
  const casinoSessions = allCasinoSessions.slice(0, MAX_PRIVATE_RECORDS);
  const loyaltyRecords = allLoyaltyRecords.slice(0, 12);
  const corrections = input.corrections ?? {};
  const rawSailings = [
    ...(input.availableCruises ?? []).slice(0, MAX_SHARED_RECORDS),
    ...certificates.flatMap(parsedRows),
  ];
  const sailingByKey = new Map<string, RelationshipRecord>();
  rawSailings.forEach((sailing, index) => {
    const key = sailingKey(sailing) || `sailing-${index}`;
    if (!sailingByKey.has(key)) sailingByKey.set(key, sailing);
  });
  const sailings = Array.from(sailingByKey.values()).slice(0, MAX_SHARED_RECORDS);
  const truncated = Math.max(0, allCompleted.length - completed.length)
    + Math.max(0, allBookings.length - bookings.length)
    + Math.max(0, allCertificates.length - certificates.length)
    + Math.max(0, allOffers.length - offers.length)
    + Math.max(0, allCasinoSessions.length - casinoSessions.length)
    + Math.max(0, allLoyaltyRecords.length - loyaltyRecords.length)
    + Math.max(0, sailingByKey.size - sailings.length);
  const nodes: MapNode[] = completed.map((cruise) => ({
    id: `cruise:${id(cruise, 'cruise')}`,
    label: `${String(cruise.shipName ?? 'Cruise')} · ${String(cruise.sailDate ?? 'Date not recorded')}`,
    value: points(cruise),
    valueLabel: 'Earning cruise',
    column: 0,
    routePath: `/cruise-details?id=${encodeURIComponent(id(cruise, 'cruise'))}`,
  }));
  completed.forEach((cruise) => nodes.push({
    id: `points:${id(cruise, 'cruise')}`,
    label: `${points(cruise).toLocaleString()} points`,
    value: points(cruise),
    valueLabel: [numeric(cruise, 'coinIn') ? `$${numeric(cruise, 'coinIn').toLocaleString()} coin-in` : '', numeric(cruise, 'theoreticalLoss', 'estimatedTheo') ? `$${numeric(cruise, 'theoreticalLoss', 'estimatedTheo').toLocaleString()} theoretical` : ''].filter(Boolean).join(' · ') || 'Casino result evidence',
    column: 1,
  }));
  casinoSessions.forEach((session, index) => {
    const sessionId = id(session, index);
    const coinIn = numeric(session, 'coinIn', 'cashCoinIn');
    const winLoss = numericEvidence(session, 'winLoss');
    nodes.push({
      id: `play:${sessionId}`,
      label: `${text(session, 'machineName', 'gameCategory') || 'Casino play'} · ${text(session, 'date') || 'Date not recorded'}`,
      value: numeric(session, 'pointsEarned'),
      valueLabel: [coinIn ? `$${coinIn.toLocaleString()} coin-in` : 'Coin-in not recorded', winLoss == null ? 'win/loss not recorded' : `${winLoss < 0 ? '-' : ''}$${Math.abs(winLoss).toLocaleString()} win/loss`].join(' · '),
      column: 0,
      routePath: '/slots?section=sessions',
    });
  });
  loyaltyRecords.forEach((record, index) => {
    const loyaltyId = id(record, index);
    nodes.push({
      id: `loyalty:${loyaltyId}`,
      label: `${text(record, 'program', 'name') || 'Loyalty'} · ${text(record, 'tier', 'level') || 'Tier not recorded'}`,
      value: numeric(record, 'points'),
      valueLabel: `${numeric(record, 'points').toLocaleString()} saved points · ${text(record, 'pointsSource', 'source') || 'source not recorded'}`,
      column: 2,
      routePath: '/casino/loyalty-data',
    });
  });
  certificates.forEach((certificate, index) => nodes.push({
    id: `cert:${id(certificate, index)}`,
    label: String(certificate.certificateCode ?? certificate.label ?? 'Certificate'),
    value: certificateThresholdPoints(certificate),
    valueLabel: [
      certificateThresholdPoints(certificate) ? `${certificateThresholdPoints(certificate).toLocaleString()}-point threshold` : 'Point threshold not stated',
      text(certificate, 'issueDate', 'issuedDate', 'issuedAt') ? `issued ${text(certificate, 'issueDate', 'issuedDate', 'issuedAt').slice(0, 10)}` : 'issue date not stated',
    ].join(' · '),
    column: 2,
    routePath: `/certificate-lookup?certificateCode=${encodeURIComponent(String(certificate.certificateCode ?? ''))}&certificateType=${encodeURIComponent(text(certificate, 'certificateFamily', 'certificateType') || 'ALL')}`,
  }));
  offers.forEach((offer, index) => nodes.push({
    id: `offer:${id(offer, index)}`,
    label: String(offer.title ?? offer.offerCode ?? 'Offer'),
    value: Number(offer.value ?? 0),
    valueLabel: offer.value ? `$${Number(offer.value).toLocaleString()} offer` : 'Offer value not recorded',
    column: 3,
    routePath: `/offer-details?offerId=${encodeURIComponent(id(offer, index))}`,
  }));
  sailings.forEach((sailing, index) => nodes.push({
    id: `sailing:${sailingKey(sailing) || index}`,
    label: `${text(sailing, 'shipName', 'ship') || 'Ship not stated'} · ${text(sailing, 'sailDate', 'departureDate', 'date') || 'Date not stated'}`,
    value: numeric(sailing, 'nights'),
    valueLabel: [text(sailing, 'cabinLabel', 'cabinType', 'stateroom') || 'Cabin not stated', sailing.guestCount ?? sailing.guests ? `${sailing.guestCount ?? sailing.guests} guest option` : 'Guest count not stated'].join(' · '),
    column: 4,
    routePath: `/cruise-details?id=${encodeURIComponent(id(sailing, index))}`,
  }));
  bookings.forEach((booking, index) => nodes.push({
    id: `booking:${id(booking, index)}`,
    label: `${text(booking, 'shipName') || 'Booked cruise'} · ${text(booking, 'sailDate') || 'Date not stated'}`,
    valueLabel: text(booking, 'reservationNumber', 'bookingNumber', 'confirmationNumber') ? `Reservation ${text(booking, 'reservationNumber', 'bookingNumber', 'confirmationNumber')}` : 'Reservation number not stated',
    column: 5,
    routePath: `/cruise-details?id=${encodeURIComponent(id(booking, index))}`,
  }));
  const realizedBookings = bookings.filter((row) => [
    numericEvidence(row, 'retailValue', 'cruiseRetailValue', 'totalRetailCost'),
    numericEvidence(row, 'amountPaid', 'pricePaid', 'netEffectivePaid'),
    numericEvidence(row, 'winningsHome', 'winLoss', 'netGamingResult'),
  ].some((value) => value !== null));
  realizedBookings.forEach((booking, index) => {
    const retail = numericEvidence(booking, 'retailValue', 'cruiseRetailValue', 'totalRetailCost');
    const paid = numericEvidence(booking, 'netEffectivePaid', 'amountPaid', 'pricePaid');
    const winnings = numericEvidence(booking, 'winningsHome', 'winLoss', 'netGamingResult');
    const realized = (retail ?? 0) + (winnings ?? 0) - (paid ?? 0);
    const completeness = [retail, paid, winnings].every((value) => value !== null) ? 'complete saved formula' : 'partial evidence estimate';
    nodes.push({ id: `realized:${id(booking, index)}`, label: `Realized value · ${text(booking, 'shipName') || 'Cruise'}`, value: realized, valueLabel: `$${realized.toLocaleString()} · retail + winnings − paid · ${completeness}`, column: 6, routePath: '/casino?tab=intelligence' });
  });

  const edges: MapEdge[] = [];
  casinoSessions.forEach((session, index) => {
    const sessionId = id(session, index);
    const cruiseId = text(session, 'cruiseId');
    const pointsNodeId = cruiseId && completed.some((cruise) => id(cruise, 'cruise') === cruiseId) ? `points:${cruiseId}` : '';
    if (pointsNodeId) {
      edges.push({ id: `play-points:${sessionId}:${cruiseId}`, from: `play:${sessionId}`, to: pointsNodeId, value: numeric(session, 'pointsEarned'), label: 'Saved casino session is attached to this cruise and its recorded point result', confidence: 'exact' });
    } else {
      const missingId = `unresolved-points:${sessionId}`;
      nodes.push({ id: missingId, label: 'Cruise points link not recorded', valueLabel: cruiseId ? `Cruise ${cruiseId} is outside this bounded graph` : 'Session has no cruise identifier', column: 1 });
      edges.push({ id: `missing-play-points:${sessionId}`, from: `play:${sessionId}`, to: missingId, value: numeric(session, 'pointsEarned'), label: cruiseId ? 'The session references a cruise that is not available in this bounded evidence graph' : 'The session is not attached to a cruise', confidence: 'unresolved' });
    }
  });
  completed.forEach((cruise) => {
    const cruiseId = id(cruise, 'cruise');
    edges.push({ id: `points-earned:${cruiseId}`, from: `cruise:${cruiseId}`, to: `points:${cruiseId}`, value: points(cruise), label: 'Saved cruise points are attached to this completed cruise', confidence: 'exact' });
    const clubRoyale = loyaltyRecords.find((record) => normalize(text(record, 'program', 'name')).includes('clubroyale'));
    if (clubRoyale) {
      const loyaltyId = id(clubRoyale, 'club-royale');
      edges.push({ id: `points-loyalty:${cruiseId}:${loyaltyId}`, from: `points:${cruiseId}`, to: `loyalty:${loyaltyId}`, value: points(cruise), label: 'Recorded cruise points contribute to Club Royale history; season timing determines whether they are in the current balance', confidence: 'inferred' });
    }
    const linked = certificates.filter((certificate) =>
      String(certificate.earnedCruiseId ?? certificate.earnedOnCruise ?? certificate.cruiseId ?? '') === cruiseId,
    );
    if (linked.length) {
      linked.forEach((certificate, index) => {
        const certificateId = id(certificate, index);
        const threshold = certificateThresholdPoints(certificate);
        const issued = text(certificate, 'issueDate', 'issuedDate', 'issuedAt').slice(0, 10);
        edges.push({ id: `earned:${cruiseId}:${certificateId}`, from: `points:${cruiseId}`, to: `cert:${certificateId}`, value: points(cruise), label: `Saved earning-cruise identifier: ${points(cruise).toLocaleString()} actual cruise points → ${threshold ? `${threshold.toLocaleString()}-point threshold` : 'threshold not stated'}${issued ? ` · certificate issued ${issued}` : ' · issue date not stated'}`, confidence: 'exact' });
      });
      return;
    }
    certificates
      .filter((certificate) => {
        const issueTime = date(certificate.issueDate ?? certificate.issuedDate ?? certificate.issuedAt);
        const cruiseTime = date(cruise.returnDate ?? cruise.sailDate);
        return issueTime > 0 && cruiseTime > 0 && Math.abs(issueTime - cruiseTime) <= 14 * 86_400_000;
      })
      .slice(0, 1)
      .forEach((certificate, index) => {
        const certificateId = id(certificate, index);
        const issued = text(certificate, 'issueDate', 'issuedDate', 'issuedAt').slice(0, 10);
        const threshold = certificateThresholdPoints(certificate);
        edges.push({ id: `inferred:${cruiseId}:${certificateId}`, from: `points:${cruiseId}`, to: `cert:${certificateId}`, value: points(cruise), label: `Possible earning link only: certificate issued ${issued} near this cruise; ${points(cruise).toLocaleString()} saved cruise points vs ${threshold ? `${threshold.toLocaleString()}-point threshold` : 'unknown threshold'} · confirmation required`, confidence: 'inferred' });
      });
    if (!edges.some((edge) => edge.from === `points:${cruiseId}` && edge.to.startsWith('cert:'))) {
      const missingId = `unresolved-cert:${cruiseId}`;
      nodes.push({ id: missingId, label: 'Certificate link not recorded', valueLabel: 'Needs review', column: 2 });
      edges.push({ id: `missing-cert:${cruiseId}`, from: `points:${cruiseId}`, to: missingId, value: points(cruise), label: 'No earned certificate is linked to these cruise points', confidence: 'unresolved' });
    }
  });
  certificates.forEach((certificate, certificateIndex) => {
    const certificateCode = String(certificate.certificateCode ?? '');
    offers
      .filter((offer) => String(offer.offerCode ?? '').includes(certificateCode) || String(offer.certificateCode ?? '') === certificateCode)
      .forEach((offer, offerIndex) => {
        const certificateId = id(certificate, certificateIndex);
        const offerId = id(offer, offerIndex);
        edges.push({ id: `offer-link:${certificateId}:${offerId}`, from: `cert:${certificateId}`, to: `offer:${offerId}`, value: Number(certificate.points ?? 0), label: 'Certificate code appears in offer evidence', confidence: 'exact' });
      });
    const certificateId = id(certificate, certificateIndex);
    const linkedOffer = edges.some((edge) => edge.from === `cert:${certificateId}` && edge.to.startsWith('offer:'));
    if (!linkedOffer) {
      const missingId = `unresolved-offer:${certificateId}`;
      nodes.push({ id: missingId, label: 'Offer link not recorded', valueLabel: 'Certificate has no linked offer', column: 3 });
      edges.push({ id: `missing-offer:${certificateId}`, from: `cert:${certificateId}`, to: missingId, value: Number(certificate.points ?? 0), label: 'No offer record is linked to this certificate', confidence: 'unresolved' });
    }
    parsedRows(certificate).forEach((sailing, sailingIndex) => {
      const key = sailingKey(sailing) || `${certificateId}-${sailingIndex}`;
      if (sailingByKey.has(key)) edges.push({ id: `cert-sailing:${certificateId}:${key}`, from: `cert:${certificateId}`, to: `sailing:${key}`, value: numeric(sailing, 'nights'), label: 'Downloaded certificate lists this eligible sailing row', confidence: 'exact' });
    });
  });
  offers.forEach((offer, offerIndex) => {
    const offerCode = String(offer.offerCode ?? offer.certificateCode ?? '');
    const offerId = id(offer, offerIndex);
    const matchedSailings = sailings.filter((sailing) => normalize(text(sailing, 'offerCode', 'certificateCode', 'promoCode')).includes(normalize(offerCode)) || normalize(text(sailing, 'offerId')) === normalize(offerId));
    matchedSailings.forEach((sailing, sailingIndex) => { const key = sailingKey(sailing) || String(sailingIndex); edges.push({ id: `offer-sailing:${offerId}:${key}`, from: `offer:${offerId}`, to: `sailing:${key}`, value: numeric(sailing, 'nights'), label: 'Offer evidence lists this eligible sailing', confidence: 'exact' }); });
    if (!matchedSailings.length) {
      const missingId = `unresolved-sailing:${offerId}`;
      nodes.push({ id: missingId, label: 'Eligible sailing link not loaded', valueLabel: 'Sync or download certificate rows', column: 4 });
      edges.push({ id: `missing-sailing:${offerId}`, from: `offer:${offerId}`, to: missingId, label: 'The offer has no loaded eligible sailing relationship', confidence: 'unresolved' });
    }
  });
  sailings.forEach((sailing, sailingIndex) => {
    const key = sailingKey(sailing) || String(sailingIndex);
    const matchedBookings = bookings.filter((booking) => normalize(text(booking, 'shipName')) === normalize(text(sailing, 'shipName', 'ship')) && text(booking, 'sailDate') === text(sailing, 'sailDate', 'departureDate', 'date'));
    matchedBookings.forEach((booking, bookingIndex) => {
      const sailingOfferCode = normalize(text(sailing, 'offerCode', 'certificateCode', 'promoCode'));
      const bookingOfferCode = normalize(text(booking, 'offerCode', 'certificateCode', 'certificateCodeUsed', 'promoCode'));
      const hasExactOfferEvidence = Boolean(sailingOfferCode && bookingOfferCode && (sailingOfferCode === bookingOfferCode || sailingOfferCode.includes(bookingOfferCode) || bookingOfferCode.includes(sailingOfferCode)));
      edges.push({
        id: `sailing-booking:${key}:${id(booking, bookingIndex)}`,
        from: `sailing:${key}`,
        to: `booking:${id(booking, bookingIndex)}`,
        label: hasExactOfferEvidence
          ? 'Ship, sail date, and saved offer/certificate code match this owner-scoped booking'
          : 'Ship and sail date match this owner-scoped booking; offer redemption is not confirmed',
        confidence: hasExactOfferEvidence ? 'exact' : 'inferred',
      });
    });
  });
  bookings.forEach((booking, bookingIndex) => {
    const bookingId = id(booking, bookingIndex);
    const realizedNodeId = `realized:${bookingId}`;
    if (nodes.some((node) => node.id === realizedNodeId)) {
      const retail = numericEvidence(booking, 'retailValue', 'cruiseRetailValue', 'totalRetailCost');
      const paid = numericEvidence(booking, 'netEffectivePaid', 'amountPaid', 'pricePaid');
      const winnings = numericEvidence(booking, 'winningsHome', 'winLoss', 'netGamingResult');
      const isComplete = [retail, paid, winnings].every((value) => value !== null);
      edges.push({ id: `booking-realized:${bookingId}`, from: `booking:${bookingId}`, to: realizedNodeId, value: (retail ?? 0) + (winnings ?? 0) - (paid ?? 0), label: isComplete ? `Saved realized value: $${retail?.toLocaleString()} retail + $${winnings?.toLocaleString()} casino result − $${paid?.toLocaleString()} paid` : 'Realized-value estimate uses available retail, paid, and casino-result fields; at least one input is missing', confidence: isComplete ? 'exact' : 'estimated' });
    }
    else {
      const missingId = `unresolved-value:${bookingId}`;
      nodes.push({ id: missingId, label: 'Realized value not recorded', valueLabel: 'Add retail, paid, or casino result evidence', column: 6 });
      edges.push({ id: `missing-value:${bookingId}`, from: `booking:${bookingId}`, to: missingId, label: 'This booking does not yet have enough evidence for realized value', confidence: 'unresolved' });
    }
  });
  const reviewed = edges
    .filter((edge) => corrections[edge.id] !== 'reject')
    .map((edge): MapEdge => corrections[edge.id] === 'confirm'
      ? { ...edge, confidence: 'exact', label: `${edge.label} · user confirmed` }
      : edge);
  const uniqueNodes = Array.from(new Map(nodes.map((node) => [node.id, node])).values());
  const nodeIds = new Set(uniqueNodes.map((node) => node.id));
  const safeReviewed = Array.from(new Map(reviewed.map((edge) => [edge.id, edge])).values())
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  return {
    nodes: uniqueNodes,
    edges: safeReviewed,
    completed: allCompleted.length,
    certificates: allCertificates.length,
    realized: realizedBookings.reduce((sum, row) => sum + numeric(row, 'retailValue', 'cruiseRetailValue', 'totalRetailCost') + numeric(row, 'winningsHome', 'winLoss', 'netGamingResult') - numeric(row, 'netEffectivePaid', 'amountPaid', 'pricePaid'), 0),
    corrections: Object.keys(corrections).length,
    eligibleSailings: sailingByKey.size,
    bookings: allBookings.length,
    unresolved: safeReviewed.filter((edge) => edge.confidence === 'unresolved').length,
    truncated,
  };
}
