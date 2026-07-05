import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

import { ALL_STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { trpc } from '@/lib/trpc';

export interface CachedCertificateSailing {
  shipName: string;
  sailDate: string;
  departurePort: string | null;
  itinerary: string | null;
  offerTypeLabel: string | null;
  nextCruiseBonusLabel: string | null;
  cabinLabel: string | null;
  cabinRank: number | null;
  freePlay: number | null;
  onBoardCredit: number | null;
  benefitSummary: string[];
}

export interface CachedCertificateOffer {
  certificateCode: string;
  certificateType: 'A' | 'C';
  points: number | null;
  pdfUrl: string;
  monthlyIndexUrl: string;
  status: 'ok' | 'empty' | 'error' | 'no_sailings';
  sailings: CachedCertificateSailing[];
  fetchedAt: string;
}

interface DownloadAllProgress {
  monthCode: string;
  certificateType: 'A' | 'C';
  total: number;
  completed: number;
}

interface CertificateOffersState {
  offers: Record<string, CachedCertificateOffer>;
  isLoading: boolean;
  isDownloadingAll: boolean;
  downloadProgress: DownloadAllProgress | null;
  lastDownloadSummary: { ok: number; errors: number; totalSailings: number; monthCode: string; certificateType: 'A' | 'C' } | null;
  getOffer: (certificateCode: string) => CachedCertificateOffer | null;
  saveOffer: (offer: CachedCertificateOffer) => void;
  hasOffersForMonth: (monthCode: string, certificateType: 'A' | 'C') => boolean;
  countOffersForMonth: (monthCode: string, certificateType: 'A' | 'C') => number;
  downloadAll: (monthCode: string, certificateType: 'A' | 'C') => Promise<{ ok: number; errors: number; totalSailings: number }>;
  allSailings: () => Array<CachedCertificateSailing & { certificateCode: string; certificateType: 'A' | 'C'; points: number | null }>;
}

function normalizeSailings(raw: unknown): CachedCertificateSailing[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    shipName: String((item as { shipName?: string })?.shipName ?? ''),
    sailDate: String((item as { sailDate?: string })?.sailDate ?? ''),
    departurePort: (item as { departurePort?: string | null })?.departurePort ?? null,
    itinerary: (item as { itinerary?: string | null })?.itinerary ?? null,
    offerTypeLabel: (item as { offerTypeLabel?: string | null })?.offerTypeLabel ?? null,
    nextCruiseBonusLabel: (item as { nextCruiseBonusLabel?: string | null })?.nextCruiseBonusLabel ?? null,
    cabinLabel: (item as { cabinLabel?: string | null })?.cabinLabel ?? null,
    cabinRank: (item as { cabinRank?: number | null })?.cabinRank ?? null,
    freePlay: (item as { freePlay?: number | null })?.freePlay ?? null,
    onBoardCredit: (item as { onBoardCredit?: number | null })?.onBoardCredit ?? null,
    benefitSummary: Array.isArray((item as { benefitSummary?: string[] })?.benefitSummary)
      ? (item as { benefitSummary: string[] }).benefitSummary
      : [],
  }));
}

// Persists every certificate PDF the app has ever pulled (single-code views
// and "Download All" batches alike) to a shared, non-user-scoped cache so the
// rest of the app - not just the certificate screens - can evaluate questions
// against the full offer set without re-downloading anything.
export const [CertificateOffersProvider, useCertificateOffers] = createContextHook((): CertificateOffersState => {
  const [offers, setOffers] = useState<Record<string, CachedCertificateOffer>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadAllProgress | null>(null);
  const [lastDownloadSummary, setLastDownloadSummary] = useState<CertificateOffersState['lastDownloadSummary']>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(ALL_STORAGE_KEYS.CERTIFICATE_OFFERS_CACHE);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, CachedCertificateOffer>;
          setOffers(parsed);
          console.log('[CertificateOffersProvider] Loaded cached offers:', Object.keys(parsed).length);
        }
      } catch (error) {
        console.error('[CertificateOffersProvider] Error loading cached offers:', error);
      } finally {
        isInitializedRef.current = true;
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(ALL_STORAGE_KEYS.CERTIFICATE_OFFERS_CACHE, JSON.stringify(offers));
      } catch (error) {
        console.error('[CertificateOffersProvider] Error saving cached offers:', error);
      }
    };
    void save();
  }, [offers]);

  const getOffer = useCallback((certificateCode: string): CachedCertificateOffer | null => {
    return offers[certificateCode.toUpperCase()] ?? null;
  }, [offers]);

  const saveOffer = useCallback((offer: CachedCertificateOffer) => {
    setOffers((prev) => ({
      ...prev,
      [offer.certificateCode.toUpperCase()]: {
        ...offer,
        sailings: normalizeSailings(offer.sailings),
      },
    }));
  }, []);

  const hasOffersForMonth = useCallback((monthCode: string, certificateType: 'A' | 'C'): boolean => {
    const prefix = `${monthCode}${certificateType}`.toUpperCase();
    return Object.keys(offers).some((code) => code.startsWith(prefix));
  }, [offers]);

  const countOffersForMonth = useCallback((monthCode: string, certificateType: 'A' | 'C'): number => {
    const prefix = `${monthCode}${certificateType}`.toUpperCase();
    return Object.keys(offers).filter((code) => code.startsWith(prefix)).length;
  }, [offers]);

  const batchMutation = trpc.certificateExplorer.codeSailingsBatch.useMutation();

  const downloadAll = useCallback(async (monthCode: string, certificateType: 'A' | 'C') => {
    setIsDownloadingAll(true);
    setDownloadProgress({ monthCode, certificateType, total: 13, completed: 0 });
    console.log('[CertificateOffersProvider] Starting download all:', { monthCode, certificateType });

    try {
      const result = await batchMutation.mutateAsync({ monthCode, certificateType });

      setOffers((prev) => {
        const next = { ...prev };
        result.results.forEach((entry) => {
          next[entry.certificateCode.toUpperCase()] = {
            certificateCode: entry.certificateCode,
            certificateType: entry.certificateType,
            points: entry.points,
            pdfUrl: entry.pdfUrl,
            monthlyIndexUrl: entry.monthlyIndexUrl,
            status: entry.status,
            sailings: normalizeSailings(entry.sailings),
            fetchedAt: result.fetchedAt,
          };
        });
        return next;
      });

      setDownloadProgress({ monthCode, certificateType, total: result.summary.total, completed: result.summary.total });
      setLastDownloadSummary({
        ok: result.summary.ok,
        errors: result.summary.errors,
        totalSailings: result.summary.totalSailings,
        monthCode,
        certificateType,
      });

      console.log('[CertificateOffersProvider] Download all complete:', result.summary);
      return { ok: result.summary.ok, errors: result.summary.errors, totalSailings: result.summary.totalSailings };
    } finally {
      setIsDownloadingAll(false);
      setTimeout(() => setDownloadProgress(null), 1200);
    }
  }, [batchMutation]);

  const allSailings = useCallback(() => {
    return Object.values(offers).flatMap((offer) =>
      offer.sailings.map((sailing) => ({
        ...sailing,
        certificateCode: offer.certificateCode,
        certificateType: offer.certificateType,
        points: offer.points,
      }))
    );
  }, [offers]);

  return useMemo(() => ({
    offers,
    isLoading,
    isDownloadingAll,
    downloadProgress,
    lastDownloadSummary,
    getOffer,
    saveOffer,
    hasOffersForMonth,
    countOffersForMonth,
    downloadAll,
    allSailings,
  }), [offers, isLoading, isDownloadingAll, downloadProgress, lastDownloadSummary, getOffer, saveOffer, hasOffersForMonth, countOffersForMonth, downloadAll, allSailings]);
});
