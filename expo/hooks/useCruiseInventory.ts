import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/state/AuthProvider';
import { getCruiseInventoryOwnerScope } from '@/lib/cruiseInventory/cruiseCanonicalIdentity';
import {
  cruiseInventoryRepository,
  type CruiseInventoryCounts,
  type CruiseInventoryFacets,
  type CruiseInventoryPage,
  type CruiseInventoryQuery,
  type CruiseOfferSailingQuery,
} from '@/lib/cruiseInventory/CruiseInventoryRepository';

const EMPTY_COUNTS: CruiseInventoryCounts = {
  total: 0,
  sourceTotal: 0,
  offerSailingRelationships: 0,
  byProvider: {},
  activeGenerationIds: [],
};

const EMPTY_FACETS: CruiseInventoryFacets = {
  shipNames: [],
  providers: [],
  departurePorts: [],
  destinations: [],
};

export function useCruiseInventory() {
  const { authenticatedEmail, isAuthenticated } = useAuth();
  const [ownerScopeId, setOwnerScopeId] = useState<string | null>(null);
  const [counts, setCounts] = useState<CruiseInventoryCounts>(EMPTY_COUNTS);
  const [facets, setFacets] = useState<CruiseInventoryFacets>(EMPTY_FACETS);
  const [isInventoryReady, setIsInventoryReady] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !authenticatedEmail) {
      setOwnerScopeId(null);
      setCounts(EMPTY_COUNTS);
      setFacets(EMPTY_FACETS);
      setIsInventoryReady(false);
      return undefined;
    }
    setOwnerScopeId(getCruiseInventoryOwnerScope(authenticatedEmail));
    return undefined;
  }, [authenticatedEmail, isAuthenticated]);

  const refreshCounts = useCallback(async () => {
    if (!ownerScopeId) return EMPTY_COUNTS;
    const next = await cruiseInventoryRepository.getCounts(ownerScopeId);
    setCounts(next);
    return next;
  }, [ownerScopeId]);

  const refreshFacets = useCallback(async () => {
    if (!ownerScopeId) return EMPTY_FACETS;
    const next = await cruiseInventoryRepository.getFacets(ownerScopeId);
    setFacets(next);
    return next;
  }, [ownerScopeId]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerScopeId) return undefined;
    setInventoryError(null);
    void cruiseInventoryRepository.initialize()
      .then(() => Promise.all([
        cruiseInventoryRepository.getCounts(ownerScopeId),
        cruiseInventoryRepository.getFacets(ownerScopeId),
      ]))
      .then(([nextCounts, nextFacets]) => {
        if (cancelled) return;
        setCounts(nextCounts);
        setFacets(nextFacets);
        setIsInventoryReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setInventoryError(error instanceof Error ? error.message : String(error));
        setIsInventoryReady(false);
      });
    const unsubscribe = cruiseInventoryRepository.subscribe(() => {
      void Promise.all([refreshCounts(), refreshFacets()]).catch((error) => {
        if (!cancelled) setInventoryError(error instanceof Error ? error.message : String(error));
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ownerScopeId, refreshCounts, refreshFacets]);

  const queryCruises = useCallback(async (query: CruiseInventoryQuery = {}): Promise<CruiseInventoryPage> => {
    if (!ownerScopeId) return { rows: [], nextCursor: null, total: 0, queryMs: 0 };
    return cruiseInventoryRepository.query({ ...query, ownerScopeId });
  }, [ownerScopeId]);

  const getCruiseById = useCallback(async (canonicalKey: string) => {
    if (!ownerScopeId) return null;
    return cruiseInventoryRepository.getById(canonicalKey, ownerScopeId);
  }, [ownerScopeId]);

  const queryOfferSailings = useCallback(async (query: CruiseOfferSailingQuery): Promise<CruiseInventoryPage> => {
    if (!ownerScopeId) return { rows: [], nextCursor: null, total: 0, queryMs: 0 };
    return cruiseInventoryRepository.queryOfferSailings({ ...query, ownerScopeId });
  }, [ownerScopeId]);

  return {
    ownerScopeId,
    counts,
    facets,
    totalCruises: counts.total,
    totalSourceCruises: counts.sourceTotal,
    totalOfferSailingRelationships: counts.offerSailingRelationships,
    isInventoryReady,
    inventoryError,
    queryCruises,
    getCruiseById,
    queryOfferSailings,
    refreshCounts,
    refreshFacets,
  };
}
