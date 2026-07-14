/**
 * Casino data-health checker (Stage 9.1, checklist item 7).
 *
 * Scans the canonical ledger + booked cruises for known problem patterns
 * and returns a flat list of issues, each with a severity and (where
 * possible) a route to jump straight to the fix. Additive/read-only — does
 * not change any stored data.
 */
import type { CasinoLedger } from '@/types/casinoLedger';
import type { BookedCruise } from '@/types/models';
import { isRoyalCaribbeanShip } from '@/constants/shipInfo';

export type CasinoHealthSeverity = 'critical' | 'warning' | 'info';

export interface CasinoHealthIssue {
  id: string;
  severity: CasinoHealthSeverity;
  title: string;
  description: string;
  cruiseId?: string;
  fixRoute?: string;
  fixLabel?: string;
}

/**
 * Runs every check against the ledger + raw booked cruises and returns the
 * combined issue list, sorted critical -> warning -> info.
 */
export function runCasinoDataHealthCheck(ledger: CasinoLedger, bookedCruises: BookedCruise[]): CasinoHealthIssue[] {
  const issues: CasinoHealthIssue[] = [];
  const today = new Date();

  for (const entry of ledger.entries) {
    const cruise = bookedCruises.find((c) => c.id === entry.cruiseId);
    const sailDate = entry.sailDate ? new Date(entry.sailDate) : null;
    const isPast = sailDate ? sailDate.getTime() < today.getTime() : false;

    if (isPast && entry.winLoss.confidence === 'missing') {
      issues.push({
        id: `missing-winloss-${entry.cruiseId}`,
        severity: 'warning',
        title: 'Missing win/loss on a completed cruise',
        description: `${entry.shipName} (${entry.sailDate}) has no recorded casino win/loss result.`,
        cruiseId: entry.cruiseId,
        fixRoute: `/cruise/${entry.cruiseId}`,
        fixLabel: 'Add win/loss',
      });
    }

    if (isPast && entry.points.confidence === 'missing') {
      issues.push({
        id: `missing-points-${entry.cruiseId}`,
        severity: 'warning',
        title: 'Missing casino points on a completed casino cruise',
        description: `${entry.shipName} (${entry.sailDate}) has no recorded Club Royale casino points.`,
        cruiseId: entry.cruiseId,
        fixRoute: `/cruise/${entry.cruiseId}`,
        fixLabel: 'Add casino points',
      });
    }

    // Points that look suspiciously like Crown & Anchor loyalty points
    // (loyalty points are roughly 1-3 per night; casino points are
    // typically in the hundreds per cruise night).
    if (cruise && entry.points.value > 0 && (cruise.nights ?? 0) > 0) {
      const perNight = entry.points.value / (cruise.nights ?? 1);
      if (perNight > 0 && perNight <= 3) {
        issues.push({
          id: `points-look-like-loyalty-${entry.cruiseId}`,
          severity: 'critical',
          title: 'Casino points look like Crown & Anchor loyalty points',
          description: `${entry.shipName} (${entry.sailDate}) shows only ${perNight.toFixed(1)} points/night \u2014 that matches the Crown & Anchor loyalty-point rate, not Club Royale casino points. Double-check the source field.`,
          cruiseId: entry.cruiseId,
          fixRoute: `/cruise/${entry.cruiseId}`,
          fixLabel: 'Review casino points',
        });
      }
    }

    // Coin-in should equal points x $5 (Royal Caribbean's published slot rule).
    if (entry.points.value > 0 && entry.coinIn.value > 0) {
      const expectedCoinIn = entry.points.value * 5;
      const diffPct = Math.abs(entry.coinIn.value - expectedCoinIn) / Math.max(1, expectedCoinIn);
      if (diffPct > 0.05) {
        issues.push({
          id: `coinin-mismatch-${entry.cruiseId}`,
          severity: 'info',
          title: 'Coin-in doesn\u2019t match points \u00d7 $5',
          description: `${entry.shipName} (${entry.sailDate}): recorded coin-in is $${entry.coinIn.value.toLocaleString()} but points \u00d7 $5 would be $${expectedCoinIn.toLocaleString()}.`,
          cruiseId: entry.cruiseId,
        });
      }
    }

    if (cruise && !isRoyalCaribbeanShip(cruise.shipName) && entry.points.value > 0) {
      issues.push({
        id: `non-rci-casino-points-${entry.cruiseId}`,
        severity: 'critical',
        title: 'Non-Royal Caribbean sailing counted in Club Royale totals',
        description: `${entry.shipName} (${entry.sailDate}) isn\u2019t a Royal Caribbean ship but has Club Royale casino points recorded.`,
        cruiseId: entry.cruiseId,
        fixRoute: `/cruise/${entry.cruiseId}`,
        fixLabel: 'Review cruise',
      });
    }
  }

  // Duplicate cruises: same ship + sail date appearing more than once.
  const seen = new Map<string, string[]>();
  for (const cruise of bookedCruises) {
    const key = `${(cruise.shipName ?? '').toLowerCase().trim()}|${cruise.sailDate ?? ''}`;
    const list = seen.get(key) ?? [];
    list.push(cruise.id);
    seen.set(key, list);
  }
  for (const [key, ids] of seen.entries()) {
    if (ids.length > 1 && key.trim() !== '|') {
      issues.push({
        id: `duplicate-cruise-${key}`,
        severity: 'critical',
        title: 'Duplicate cruise records',
        description: `${ids.length} cruise records share the same ship and sail date. This can double-count points, coin-in, and value.`,
      });
    }
  }

  const severityOrder: Record<CasinoHealthSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
