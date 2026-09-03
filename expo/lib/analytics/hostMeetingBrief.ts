import type { BookedCruise } from '@/types/models';
import type { CasinoSession } from '@/state/CasinoSessionProvider';
import type { Certificate } from '@/components/CertificateManagerModal';

export interface HostBriefProfile {
  displayName?: string;
  email?: string;
  clubRoyaleId?: string;
  blueChipId?: string;
  clubRoyaleTier?: string;
  clubRoyalePoints?: number;
}

export interface HostBriefRedaction {
  identity: boolean;
  loyaltyIds: boolean;
  cashResults: boolean;
  reservationNumbers: boolean;
  cruiseDetails: boolean;
}

export interface HostBriefCruiseRow {
  id: string;
  ship: string;
  sailDate: string;
  nights: number;
  points: number | null;
  coinIn: number | null;
  theoreticalLoss: number | null;
  cashResult: number | null;
  hours: number | null;
  offerCode?: string;
  reservationNumber?: string;
  confidence: 'actual' | 'mixed' | 'estimated' | 'missing';
}

export interface CasinoHostMeetingBrief {
  generatedAt: string;
  profile: HostBriefProfile;
  request: string;
  recentCruises: HostBriefCruiseRow[];
  upcomingCruises: Array<{ ship: string; sailDate: string; nights: number; offerCode?: string; reservationNumber?: string }>;
  points: number | null;
  coinIn: number | null;
  theoreticalLoss: number | null;
  trackedCashResult: number | null;
  playHours: number | null;
  playDays: number | null;
  averagePointsPerDay: number | null;
  averageHoursPerDay: number | null;
  certificatesEarned: Array<{ code: string; value: number | null; source: 'cruise-closeout' | 'certificate-wallet' }>;
  bookedOfferCount: number;
  sourceNotes: string[];
  warnings: string[];
  redaction: HostBriefRedaction;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = finite(value);
    if (number !== null) return number;
  }
  return null;
}

function isCompleted(cruise: BookedCruise, now: Date): boolean {
  if (cruise.completionState === 'completed' || cruise.status === 'completed') return true;
  const returnAt = Date.parse(cruise.returnDate || cruise.sailDate);
  return Number.isFinite(returnAt) && returnAt < now.getTime();
}

function isUpcoming(cruise: BookedCruise, now: Date): boolean {
  const sailAt = Date.parse(cruise.sailDate);
  return !isCompleted(cruise, now) && Number.isFinite(sailAt) && sailAt >= now.getTime() - 86_400_000;
}

function cruiseRow(cruise: BookedCruise): HostBriefCruiseRow {
  return {
    id: cruise.id,
    ship: cruise.shipName || 'Ship not recorded',
    sailDate: cruise.sailDate,
    nights: cruise.nights || 0,
    points: firstNumber(cruise.pointsEarned, cruise.earnedPoints, cruise.casinoPoints),
    coinIn: finite(cruise.coinIn),
    theoreticalLoss: finite(cruise.theoreticalLoss),
    cashResult: firstNumber(cruise.cashResult, cruise.netResult, cruise.winningsBroughtHome, cruise.totalWinnings, cruise.winnings),
    hours: finite(cruise.hoursPlayed),
    offerCode: cruise.offerCode || cruise.instantCertificateOfferCode,
    reservationNumber: cruise.reservationNumber || cruise.bookingId,
    confidence: cruise.calculationConfidence ?? 'missing',
  };
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null;
}

export function buildCasinoHostMeetingBrief(input: {
  profile?: HostBriefProfile | null;
  bookedCruises: BookedCruise[];
  sessions: CasinoSession[];
  certificates: Certificate[];
  request?: string;
  redaction?: Partial<HostBriefRedaction>;
  now?: Date;
}): CasinoHostMeetingBrief {
  const now = input.now ?? new Date();
  const redaction: HostBriefRedaction = {
    identity: input.redaction?.identity ?? false,
    loyaltyIds: input.redaction?.loyaltyIds ?? false,
    cashResults: input.redaction?.cashResults ?? false,
    reservationNumbers: input.redaction?.reservationNumbers ?? false,
    cruiseDetails: input.redaction?.cruiseDetails ?? false,
  };
  const completed = input.bookedCruises.filter((cruise) => isCompleted(cruise, now)).sort((left, right) => right.sailDate.localeCompare(left.sailDate));
  const completedRows = completed.map(cruiseRow);
  const recentCruises = completedRows.slice(0, 8);
  const recentIds = new Set(recentCruises.map((row) => row.id));
  const recentSessions = input.sessions.filter((session) => !session.cruiseId || recentIds.has(session.cruiseId));

  const cruisePoints = sumKnown(recentCruises.map((row) => row.points));
  const sessionPoints = sumKnown(recentSessions.map((session) => finite(session.pointsEarned)));
  const cruiseHours = sumKnown(recentCruises.map((row) => row.hours));
  const sessionHours = recentSessions.length > 0 ? recentSessions.reduce((sum, session) => sum + Math.max(0, session.durationMinutes || 0), 0) / 60 : null;
  const sessionDays = new Set(recentSessions.map((session) => session.date).filter(Boolean)).size;
  const recordedCasinoDays = recentCruises.reduce((sum, row) => {
    const source = completed.find((cruise) => cruise.id === row.id);
    return sum + Math.max(0, source?.casinoOpenDays || 0);
  }, 0);
  const playDays = sessionDays || recordedCasinoDays || null;
  const points = cruisePoints ?? sessionPoints;
  const playHours = cruiseHours ?? sessionHours;
  const earnedByCruise = completed
    .filter((cruise) => cruise.instantCertificateWon || cruise.instantCertificateOfferCode)
    .map((cruise) => ({ code: cruise.instantCertificateOfferCode || 'Certificate code not recorded', value: finite(cruise.instantCertificateValue), source: 'cruise-closeout' as const }));
  const earnedCodes = new Set(earnedByCruise.map((certificate) => certificate.code));
  const walletCertificates = input.certificates
    .filter((certificate) => certificate.status !== 'expired')
    .map((certificate) => ({ code: certificate.certificateCode || certificate.label || 'Certificate', value: finite(certificate.value), source: 'certificate-wallet' as const }))
    .filter((certificate) => !earnedCodes.has(certificate.code));
  const confidenceCounts = recentCruises.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.confidence]: (counts[row.confidence] ?? 0) + 1 }), {});

  return {
    generatedAt: now.toISOString(),
    profile: input.profile ?? {},
    request: input.request?.trim() || 'No specific host request entered.',
    recentCruises,
    upcomingCruises: input.bookedCruises.filter((cruise) => isUpcoming(cruise, now)).sort((left, right) => left.sailDate.localeCompare(right.sailDate)).slice(0, 6).map((cruise) => ({
      ship: cruise.shipName,
      sailDate: cruise.sailDate,
      nights: cruise.nights,
      offerCode: cruise.offerCode,
      reservationNumber: cruise.reservationNumber || cruise.bookingId,
    })),
    points,
    coinIn: sumKnown(recentCruises.map((row) => row.coinIn)),
    theoreticalLoss: sumKnown(recentCruises.map((row) => row.theoreticalLoss)),
    trackedCashResult: sumKnown(recentCruises.map((row) => row.cashResult)),
    playHours,
    playDays,
    averagePointsPerDay: points !== null && playDays ? points / playDays : null,
    averageHoursPerDay: playHours !== null && playDays ? playHours / playDays : null,
    certificatesEarned: [...earnedByCruise, ...walletCertificates].slice(0, 12),
    bookedOfferCount: completed.filter((cruise) => Boolean(cruise.offerCode || cruise.instantCertificateOfferCode)).length,
    sourceNotes: [
      `Recent cruise confidence: ${confidenceCounts.actual ?? 0} actual, ${confidenceCounts.mixed ?? 0} mixed, ${confidenceCounts.estimated ?? 0} estimated, ${confidenceCounts.missing ?? 0} missing.`,
      cruisePoints !== null ? 'Cruise closeout point totals were used instead of session rollups.' : sessionPoints !== null ? 'Session points were used because recent cruise closeouts lacked point totals.' : 'No point totals were available.',
      cruiseHours !== null ? 'Recorded cruise play hours were used.' : sessionHours !== null ? 'Logged session duration was used.' : 'No play-hour data was available.',
      'Coin-in is shown only when recorded; this brief never converts points to coin-in.',
    ],
    warnings: [
      'Verify all figures against the cruise-line casino system before relying on them in a comp discussion.',
      'Theoretical loss is omitted when it was not recorded; no cross-brand points multiplier is applied.',
    ],
    redaction,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string);
}

function money(value: number | null): string {
  return value === null ? 'Not recorded' : `${value < 0 ? '-' : ''}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function number(value: number | null, suffix = ''): string {
  return value === null ? 'Not recorded' : `${Math.round(value).toLocaleString()}${suffix}`;
}

export function buildCasinoHostBriefHtml(brief: CasinoHostMeetingBrief): string {
  const show = (redacted: boolean, value: unknown, fallback = 'Redacted') => redacted ? fallback : escapeHtml(value);
  const metric = (label: string, value: string) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  const recentRows = brief.redaction.cruiseDetails ? '' : brief.recentCruises.slice(0, 6).map((row) => `<tr><td>${escapeHtml(row.ship)}<small>${escapeHtml(row.sailDate)} · ${row.nights} nights</small></td><td>${number(row.points)}</td><td>${money(row.coinIn)}</td><td>${money(row.theoreticalLoss)}</td><td>${brief.redaction.cashResults ? 'Redacted' : money(row.cashResult)}</td><td>${escapeHtml(row.confidence)}</td></tr>`).join('');
  const upcoming = brief.upcomingCruises.slice(0, 5).map((row) => `<li><b>${escapeHtml(row.ship)}</b> — ${escapeHtml(row.sailDate)} (${row.nights} nights)${row.offerCode ? ` · offer ${escapeHtml(row.offerCode)}` : ''}${row.reservationNumber ? ` · reservation ${show(brief.redaction.reservationNumbers, row.reservationNumber)}` : ''}</li>`).join('');
  const certificates = brief.certificatesEarned.slice(0, 8).map((certificate) => `<li>${escapeHtml(certificate.code)}${certificate.value !== null ? ` · ${money(certificate.value)}` : ''} <small>(${escapeHtml(certificate.source.replace('-', ' '))})</small></li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:letter;margin:.38in}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#10223A;margin:0;font-size:9.5px}header{background:#10223A;color:white;border-radius:12px;padding:14px 16px}h1{margin:2px 0 4px;font-size:22px}h2{font-size:12px;text-transform:uppercase;letter-spacing:.7px;margin:12px 0 5px;border-bottom:1px solid #B9CDD6;padding-bottom:3px}p{margin:3px 0;line-height:1.35}.muted{color:#607384}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:9px}.metric{border:1px solid #C9DCE4;border-radius:7px;padding:6px;background:#F5FAFB}.metric span{display:block;color:#607384;font-size:7.5px;text-transform:uppercase}.metric strong{font-size:12px}.ask{background:#E6F7F3;border:1px solid #9BD7CC;border-radius:8px;padding:9px;margin-top:9px}.grid{display:grid;grid-template-columns:1.12fr .88fr;gap:12px}table{border-collapse:collapse;width:100%;font-size:8px}th,td{border:1px solid #D7E4E9;padding:4px;text-align:left;vertical-align:top}th{background:#E8F2F6}small{display:block;color:#607384;font-size:7px}ul{margin:3px 0;padding-left:15px}li{margin:2px 0}.notes{font-size:7.5px;color:#607384}footer{margin-top:8px;border-top:1px solid #D7E4E9;padding-top:5px;font-size:7px;color:#607384}</style></head><body><header><div>CASINO HOST MEETING BRIEF</div><h1>${show(brief.redaction.identity, brief.profile.displayName || 'Easy Seas Player')}</h1><p>${show(brief.redaction.identity, brief.profile.email || '')}${brief.profile.clubRoyaleTier ? ` · ${escapeHtml(brief.profile.clubRoyaleTier)}` : ''}${brief.profile.clubRoyaleId ? ` · Club Royale ${show(brief.redaction.loyaltyIds, brief.profile.clubRoyaleId)}` : ''}</p></header><div class="ask"><b>Specific request for the host</b><p>${escapeHtml(brief.request)}</p></div><div class="metrics">${metric('Recent points', number(brief.points))}${metric('Recorded coin-in', money(brief.coinIn))}${metric('Recorded theo', money(brief.theoreticalLoss))}${metric('Tracked cash result', brief.redaction.cashResults ? 'Redacted' : money(brief.trackedCashResult))}${metric('Play hours', number(brief.playHours, ' hr'))}${metric('Average points/day', number(brief.averagePointsPerDay))}${metric('Average hours/day', number(brief.averageHoursPerDay, ' hr'))}${metric('Offers booked', number(brief.bookedOfferCount))}</div><div class="grid"><section><h2>Recent casino cruises</h2>${brief.redaction.cruiseDetails ? '<p>Detailed cruise history redacted.</p>' : `<table><thead><tr><th>Cruise</th><th>Points</th><th>Coin-in</th><th>Theo</th><th>Cash</th><th>Source</th></tr></thead><tbody>${recentRows || '<tr><td colspan="6">No recent cruise closeouts recorded.</td></tr>'}</tbody></table>`}<h2>Data provenance</h2>${brief.sourceNotes.map((note) => `<p class="notes">• ${escapeHtml(note)}</p>`).join('')}</section><section><h2>Upcoming cruises</h2><ul>${upcoming || '<li>No upcoming cruises recorded.</li>'}</ul><h2>Certificates earned / held</h2><ul>${certificates || '<li>No certificates recorded.</li>'}</ul><h2>Discussion cautions</h2>${brief.warnings.map((warning) => `<p class="notes">• ${escapeHtml(warning)}</p>`).join('')}</section></div><footer>Generated by Easy Seas ${escapeHtml(brief.generatedAt)}. One-page planning summary; not a cruise-line casino statement.</footer></body></html>`;
}
