const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();
const dateKey = (value: unknown) => {
  const parsed = new Date(String(value ?? ''));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : '';
};

/** Links by cruise/reservation identity first. A reusable marketing offer code is never treated as a cruise identity. */
export function linkCertificateToEarningCruise(input: {
  certificateCode?: string;
  certificate?: Record<string, unknown>;
  bookedCruise?: Record<string, unknown>;
  completedCruises?: Record<string, unknown>[];
}) {
  const certificate = input.certificate ?? {};
  const certificateCode = normalizeCode(input.certificateCode ?? certificate.certificateCode ?? input.bookedCruise?.instantCertificateOfferCode);
  const cruises = input.completedCruises ?? [];
  const directCruiseId = normalize(certificate.cruiseId);
  const earnedOnCruise = normalize(certificate.earnedOnCruise);
  const identityMatches = cruises.filter((cruise) => {
    const identities = [cruise.id, cruise.bookingId, cruise.reservationNumber, `${cruise.shipName ?? ''}${cruise.sailDate ?? ''}`].map(normalize).filter(Boolean);
    return Boolean((directCruiseId && identities.includes(directCruiseId)) || (earnedOnCruise && identities.includes(earnedOnCruise)));
  });
  if (identityMatches.length === 1) {
    return { certificateCode: certificateCode || null, likelyEarningCruise: identityMatches[0], confidence: 'high', matchReason: 'exact cruise/reservation identity', warnings: [] };
  }

  const certificateSailingDate = dateKey(certificate.sailingDate ?? certificate.sailDate);
  if (certificateSailingDate) {
    const sailingMatches = cruises.filter((cruise) => {
      const start = dateKey(cruise.sailDate);
      if (!start || certificateSailingDate !== start) return false;
      const cruiseShip = normalize(cruise.shipName ?? cruise.ship ?? '');
      const certificateShip = normalize(certificate.shipName ?? certificate.ship ?? '');
      return !cruiseShip || !certificateShip || cruiseShip === certificateShip || cruiseShip.includes(certificateShip) || certificateShip.includes(cruiseShip);
    });
    if (sailingMatches.length === 1) {
      return { certificateCode: certificateCode || null, likelyEarningCruise: sailingMatches[0], confidence: 'high', matchReason: `certificate sailing date and ship match earning cruise (${certificateSailingDate})`, warnings: [] };
    }
    if (sailingMatches.length > 1) {
      return { certificateCode: certificateCode || null, likelyEarningCruise: null, confidence: 'low', matchReason: null, warnings: [`Certificate sailing date ${certificateSailingDate} matches ${sailingMatches.length} completed cruises; select the earning cruise manually.`] };
    }
  }

  const issueDate = dateKey(certificate.issueDate ?? certificate.issuedDate);
  if (issueDate) {
    const dateMatches = cruises.filter((cruise) => {
      const start = dateKey(cruise.sailDate);
      const end = dateKey(cruise.returnDate) || start;
      if (!start || !end || issueDate < start || issueDate > end) return false;
      const cruiseLine = normalize(cruise.cruiseLine ?? cruise.brand ?? 'royal caribbean');
      const certificateLine = normalize(certificate.cruiseLine ?? certificate.brand ?? 'royal caribbean');
      return !cruiseLine || !certificateLine || cruiseLine.includes('royal') === certificateLine.includes('royal');
    });
    if (dateMatches.length === 1) {
      return { certificateCode: certificateCode || null, likelyEarningCruise: dateMatches[0], confidence: 'high', matchReason: `certificate issued during sailing (${issueDate})`, warnings: [] };
    }
    if (dateMatches.length > 1) {
      return { certificateCode: certificateCode || null, likelyEarningCruise: null, confidence: 'low', matchReason: null, warnings: [`Certificate issue date ${issueDate} overlaps ${dateMatches.length} completed cruises; select the earning cruise manually.`] };
    }
  }

  const codeMatches = certificateCode ? cruises.filter((cruise) => normalizeCode(cruise.instantCertificateOfferCode) === certificateCode) : [];
  if (codeMatches.length === 1) {
    return { certificateCode, likelyEarningCruise: codeMatches[0], confidence: 'medium', matchReason: 'unique instant certificate code on completed cruise', warnings: [] };
  }

  return {
    certificateCode: certificateCode || null,
    likelyEarningCruise: null,
    confidence: 'low',
    matchReason: null,
    warnings: [codeMatches.length > 1
      ? `Certificate code ${certificateCode} appears on ${codeMatches.length} cruises; a cruise/reservation identity is required.`
      : issueDate
        ? `No completed cruise contains certificate issue date ${issueDate}.`
        : certificateSailingDate
          ? `No completed cruise starts on certificate sailing date ${certificateSailingDate}.`
          : 'No completed cruise could be confidently linked because its issue/sailing date is missing.'],
  };
}
