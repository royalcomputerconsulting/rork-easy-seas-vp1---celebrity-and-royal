import type { OfferLineage, OfferLineageEvent, RecommendationConfidence } from '@/types/intelligence';

function eventSort(left: OfferLineageEvent, right: OfferLineageEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id);
}

/**
 * Builds a lineage without ever joining by marketing code alone. Exact parent
 * IDs and player-offer IDs are authoritative; a shared offer code is evidence
 * for review only because several distinct offers may reuse it.
 */
export function buildOfferLineage(events: OfferLineageEvent[], rootEntityId: string): OfferLineage {
  const byEntity = new Map(events.map((event) => [event.entityId, event]));
  const root = byEntity.get(rootEntityId);
  const exactPlayerOfferId = root?.playerOfferId;
  const included = events.filter((event) => event.entityId === rootEntityId
    || event.parentEntityId === rootEntityId
    || (exactPlayerOfferId && event.playerOfferId === exactPlayerOfferId));
  const includedIds = new Set(included.map((event) => event.entityId));
  const unresolvedLinks = included
    .filter((event) => event.parentEntityId && !includedIds.has(event.parentEntityId) && !byEntity.has(event.parentEntityId))
    .map((event) => `${event.id}: missing parent ${event.parentEntityId}`);
  const evidenceStatuses = included.map((event) => event.evidenceStatus);
  const confidence: RecommendationConfidence = !root || included.length === 0
    ? 'insufficient'
    : unresolvedLinks.length > 0 || evidenceStatuses.includes('missing')
      ? 'low'
      : evidenceStatuses.every((status) => status === 'verified') ? 'high' : 'medium';
  return { rootEntityId, events: included.sort(eventSort), unresolvedLinks, confidence };
}
