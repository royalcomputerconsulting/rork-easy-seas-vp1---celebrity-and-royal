import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import createContextHook from '@nkzw/create-context-hook';
import type { Certificate, CertificateType } from '@/components/CertificateManagerModal';
import { useAuth } from './AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import {
  CERTIFICATE_DOCUMENT_STORE_KEY,
  PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY,
  loadCertificateDocumentsWithReport,
  reprocessStoredCertificateDocument,
  storeCertificateDocument as persistCertificateDocument,
  type CertificateDocumentStorageMetadata,
  type CertificateDocumentRecord,
} from '@/lib/certificates/certificateDocumentStore';
import type { CertificateParseResult, CertificateParserReconciliation, DownloadedCertificatePdf } from '@/lib/certificates/certificatePdfPipeline';
import { hydrateHighVolumeDomain, replaceHighVolumeDomain } from '@/lib/database/highVolumeRepository';

const BASE_CERT_KEY = '@easyseas_certificates';

interface CertificatesState {
  certificates: Certificate[];
  searchableCertificates: Certificate[];
  certificateDocuments: CertificateDocumentRecord[];
  isLoading: boolean;
  certificateDocumentLoadState: 'idle' | 'loading' | 'ready' | 'error';
  addCertificate: (cert: Omit<Certificate, 'id'>) => void;
  updateCertificate: (id: string, updates: Partial<Certificate>) => void;
  deleteCertificate: (id: string) => void;
  getCertificatesByType: (type: CertificateType) => Certificate[];
  getAvailableCertificates: () => Certificate[];
  getTotalValue: () => number;
  storeCertificateDocument: (
    download: DownloadedCertificatePdf,
    result: CertificateParseResult,
    reconciliation?: { backendResult: CertificateParseResult; comparison: CertificateParserReconciliation },
    metadata?: CertificateDocumentStorageMetadata,
  ) => Promise<CertificateDocumentRecord>;
  reprocessCertificateDocument: (documentId: string, expectedCode?: string) => Promise<CertificateDocumentRecord>;
  refreshCertificateDocuments: (options?: { force?: boolean }) => Promise<void>;
  loadSearchableCertificates: () => Promise<Certificate[]>;
}

const DEFAULT_CERTIFICATES: Certificate[] = [];

function buildSearchableCertificateDocuments(documents: CertificateDocumentRecord[]): Certificate[] {
  return documents
    .filter((document) => document.documentKind === 'certificate')
    .map((document) => {
      const latest = document.parseHistory[document.parseHistory.length - 1]?.result;
      const face = latest?.earnedCertificateFace ?? document.provenance.earnedCertificateFace ?? null;
      const sailings = latest?.sailings ?? [];
      const code = face?.certificateCode || sailings[0]?.certificateCode || document.provenance.originalUrl.match(/(\d{4}[AC][A-Z0-9]+)/i)?.[1]?.toUpperCase();
      const family = sailings[0]?.certificateFamily;
      const pointRequirements = sailings.map((row) => row.pointRequirement).filter((value): value is number => typeof value === 'number');
      const maxFreePlay = sailings.reduce((max, row) => Math.max(max, row.freePlay ?? 0), 0);
      const maxOnboardCredit = sailings.reduce((max, row) => Math.max(max, row.onboardCredit ?? 0), 0);
      const value = face?.tradeInValue ?? face?.awardValue ?? maxFreePlay + maxOnboardCredit;
      const parserStatus = latest?.status ?? document.provenance.parseStatus ?? 'not_parsed';
      return {
        id: `document-${document.id}`,
        type: /off|discount/i.test(face?.awardType ?? '') ? 'discount' : 'freeplay',
        label: code ? `${code} Instant Cruise Reward` : 'Downloaded Club Royale Certificate',
        value,
        description: `${sailings.length.toLocaleString()} eligible sailing(s) parsed from the retained Royal Caribbean PDF${face?.shipName && face?.sailingDate ? ` · earned on ${face.shipName} ${face.sailingDate}` : ''}${face?.pointsRequired ? ` · ${face.pointsRequired.toLocaleString()} point certificate evidence` : pointRequirements.length ? ` · point levels ${Math.min(...pointRequirements).toLocaleString()}–${Math.max(...pointRequirements).toLocaleString()}` : ''}.`,
        status: 'available',
        certificateCode: code,
        certificateFamily: family && family !== 'unclassified' ? family : undefined,
        awardType: face?.awardType,
        expiryDate: face?.expirationDate,
        sailingDate: face?.sailingDate,
        shipName: face?.shipName,
        tradeInValue: face?.tradeInValue,
        pointRequirement: face?.pointsRequired,
        pointsRequired: face?.pointsRequired,
        pointsEarnedEstimate: face?.pointsRequired,
        sourcePdfUrl: document.originalUrl,
        sourceDocumentArchiveUri: document.provenance.documentArchiveUri ?? undefined,
        sourceDocumentHash: document.documentHash,
        sourceDocumentVersion: document.documentVersion,
        sourceDocumentSize: document.provenance.documentSize,
        parserSource: 'device',
        parserStatus,
        parserVersion: latest?.parserVersion,
        parserWarnings: latest?.warnings ?? [],
        parsedAt: latest?.sailings[0]?.parsedAt ?? document.parseHistory[document.parseHistory.length - 1]?.parsedAt,
        parsedSailings: sailings,
      } satisfies Certificate;
    });
}

function mergeSearchableCertificates(certificates: Certificate[], documents: CertificateDocumentRecord[]): Certificate[] {
  const projectedDocuments = buildSearchableCertificateDocuments(documents);
  const manualHashes = new Set(certificates.map((certificate) => certificate.sourceDocumentHash).filter(Boolean));
  return [
    ...certificates,
    ...projectedDocuments.filter((certificate) => !certificate.sourceDocumentHash || !manualHashes.has(certificate.sourceDocumentHash)),
  ];
}

function cacheDocumentProjections(certificates: Certificate[], documents: CertificateDocumentRecord[]): Certificate[] {
  const existingHashes = new Set(certificates.map((certificate) => certificate.sourceDocumentHash).filter(Boolean));
  const additions = buildSearchableCertificateDocuments(documents)
    .filter((certificate) => !certificate.sourceDocumentHash || !existingHashes.has(certificate.sourceDocumentHash));
  return additions.length > 0 ? [...certificates, ...additions] : certificates;
}

export const [CertificatesProvider, useCertificates] = createContextHook((): CertificatesState => {
  const { authenticatedEmail } = useAuth();
  const lastEmailRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateDocuments, setCertificateDocuments] = useState<CertificateDocumentRecord[]>([]);
  const certificatesRef = useRef<Certificate[]>([]);
  const certificateDocumentsRef = useRef<CertificateDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [certificateDocumentLoadState, setCertificateDocumentLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const loadedCertificatesSnapshotRef = useRef<Certificate[] | null>(null);

  const storageKeyRef = useRef(getUserScopedKey(BASE_CERT_KEY, authenticatedEmail));
  const documentStorageKeyRef = useRef(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY);
  const legacyDocumentStorageKeyRef = useRef(getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail));
  const loadedDocumentStorageKeyRef = useRef<string | null>(null);
  const documentLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  certificatesRef.current = certificates;
  certificateDocumentsRef.current = certificateDocuments;
  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(BASE_CERT_KEY, authenticatedEmail);
    documentStorageKeyRef.current = PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY;
    legacyDocumentStorageKeyRef.current = getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail);
    loadedDocumentStorageKeyRef.current = null;
    documentLoadRef.current = null;
    setCertificateDocumentLoadState('idle');
    console.log('[CertificatesProvider] Scoped storage key updated for:', authenticatedEmail);
  }, [authenticatedEmail]);

  const loadCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      const repositoryOwner = authenticatedEmail || 'local-default';
      const stored = await hydrateHighVolumeDomain<Certificate>(repositoryOwner, 'certificates');
      if (stored.length > 0) {
        loadedCertificatesSnapshotRef.current = stored;
        setCertificates(stored);
        console.log('[CertificatesProvider] Loaded certificates:', stored.length);
      } else {
        loadedCertificatesSnapshotRef.current = DEFAULT_CERTIFICATES;
        setCertificates(DEFAULT_CERTIFICATES);
        await replaceHighVolumeDomain(repositoryOwner, 'certificates', DEFAULT_CERTIFICATES, storageKeyRef.current);
        await quotaSafeSetJsonItem(storageKeyRef.current, DEFAULT_CERTIFICATES);
        console.log('[CertificatesProvider] Initialized with default certificates');
      }
      isInitializedRef.current = true;
    } catch (error) {
      console.error('[CertificatesProvider] Error loading certificates:', error);
      setCertificates(DEFAULT_CERTIFICATES);
      isInitializedRef.current = true;
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedEmail]);

  const loadCertificateDocuments = useCallback(async (options?: { force?: boolean }) => {
    const key = documentStorageKeyRef.current;
    if (!options?.force && loadedDocumentStorageKeyRef.current === key) return;
    if (documentLoadRef.current?.key === key) return documentLoadRef.current.promise;
    setCertificateDocumentLoadState('loading');

    const promise = (async () => {
      try {
        const [report, legacyReport] = await Promise.all([
          loadCertificateDocumentsWithReport(key),
          loadCertificateDocumentsWithReport(legacyDocumentStorageKeyRef.current),
        ]);
        const mergedByIdentity = new Map<string, CertificateDocumentRecord>();
        [...report.documents, ...legacyReport.documents].forEach((document) => {
          const identity = `${document.documentHash}|${document.originalUrl}`;
          const existing = mergedByIdentity.get(identity);
          if (!existing || document.parseHistory.length > existing.parseHistory.length || document.storedAt > existing.storedAt) {
            mergedByIdentity.set(identity, document);
          }
        });
        const documents = Array.from(mergedByIdentity.values());
        if (legacyReport.documents.length > 0 && documents.length !== report.documents.length) {
          await quotaSafeSetJsonItem(PUBLIC_CERTIFICATE_DOCUMENT_STORE_KEY, documents);
          console.log('[CertificatesProvider] Migrated legacy profile certificate PDFs into shared Club Royale reference storage:', legacyReport.documents.length);
        }
        if (documentStorageKeyRef.current !== key) return;
        setCertificateDocuments(documents);
        certificateDocumentsRef.current = documents;
        setCertificates((current) => {
          const next = cacheDocumentProjections(current, documents);
          certificatesRef.current = next;
          return next;
        });
        loadedDocumentStorageKeyRef.current = key;
        setCertificateDocumentLoadState('ready');
        if (report.malformedStorage) {
          console.error('[CertificatesProvider] Certificate document storage is malformed; no documents were restored.');
        } else if (report.invalidRecordCount > 0) {
          console.warn('[CertificatesProvider] Quarantined invalid certificate document record(s):', report.invalidRecordCount);
        }
        console.log('[CertificatesProvider] Loaded shared certificate documents:', documents.length);
      } catch (error) {
        console.error('[CertificatesProvider] Error loading certificate documents:', error);
        if (documentStorageKeyRef.current === key) {
          setCertificateDocuments([]);
          setCertificateDocumentLoadState('error');
        }
      } finally {
        if (documentLoadRef.current?.key === key) documentLoadRef.current = null;
      }
    })();
    documentLoadRef.current = { key, promise };
    return promise;
  }, []);

  useEffect(() => {
    if (authenticatedEmail !== lastEmailRef.current) {
      const previousEmail = lastEmailRef.current;
      lastEmailRef.current = authenticatedEmail;
      
      if (previousEmail !== null && previousEmail !== authenticatedEmail) {
        console.log('[CertificatesProvider] User changed from', previousEmail, 'to', authenticatedEmail, '- resetting certificates');
        isInitializedRef.current = false;
        setCertificates(DEFAULT_CERTIFICATES);
        setCertificateDocuments([]);
        setCertificateDocumentLoadState('idle');
      }
    }
    
    // Certificate documents can contain retained PDF evidence plus thousands
    // of parsed sailing rows. They remain durable on disk and are hydrated by
    // the certificate/Ask My Data screens when requested; parsing them here
    // blocked unrelated cold-start navigation.
    void loadCertificates();
  }, [loadCertificates, authenticatedEmail]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[CertificatesProvider] Data cleared event detected, resetting certificates');
      isInitializedRef.current = false;
      setCertificates(DEFAULT_CERTIFICATES);
      setCertificateDocuments([]);
      setCertificateDocumentLoadState('idle');
      setIsLoading(false);
    };

    const handleCloudRestore = () => {
      console.log('[CertificatesProvider] Cloud data restored, reloading certificates');
      void loadCertificates();
      void loadCertificateDocuments({ force: true });
    };

    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
        window.addEventListener('appDataCleared', handleDataCleared);
        window.addEventListener('cloudDataRestored', handleCloudRestore);
        return () => {
          window.removeEventListener('appDataCleared', handleDataCleared);
          window.removeEventListener('cloudDataRestored', handleCloudRestore);
        };
      }
    } catch (e) {
      console.log('[CertificatesProvider] Could not set up event listeners:', e);
    }
  }, [loadCertificateDocuments, loadCertificates]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const saveCertificates = async () => {
      try {
        await replaceHighVolumeDomain(authenticatedEmail || 'local-default', 'certificates', certificates, storageKeyRef.current);
        await quotaSafeSetJsonItem(storageKeyRef.current, certificates);
        console.log('[CertificatesProvider] Auto-saved certificates:', certificates.length);
      } catch (error) {
        console.error('[CertificatesProvider] Error saving certificates:', error);
      }
    };

    if (loadedCertificatesSnapshotRef.current === certificates) {
      loadedCertificatesSnapshotRef.current = null;
      return;
    }
    void saveCertificates();
  }, [authenticatedEmail, certificates]);

  const addCertificate = useCallback((cert: Omit<Certificate, 'id'>) => {
    const newCert: Certificate = {
      ...cert,
      id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setCertificates(prev => [...prev, newCert]);
    console.log('[CertificatesProvider] Added certificate:', newCert.id);
  }, []);

  const updateCertificate = useCallback((id: string, updates: Partial<Certificate>) => {
    setCertificates(prev => {
      if (prev.some((certificate) => certificate.id === id)) {
        return prev.map(cert => cert.id === id ? { ...cert, ...updates } : cert);
      }
      // Downloaded PDF certificates are normally projections of retained
      // document records. Promote the selected projection into the ordinary
      // persisted certificate collection before applying a user correction,
      // so confirm/unlink/reassign survives restart and Save All/Load All.
      const projected = buildSearchableCertificateDocuments(certificateDocuments).find((certificate) => certificate.id === id);
      return projected ? [...prev, { ...projected, ...updates }] : prev;
    });
    console.log('[CertificatesProvider] Updated certificate:', id);
  }, [certificateDocuments]);

  const deleteCertificate = useCallback((id: string) => {
    setCertificates(prev => prev.filter(cert => cert.id !== id));
    console.log('[CertificatesProvider] Deleted certificate:', id);
  }, []);

  const getCertificatesByType = useCallback((type: CertificateType): Certificate[] => {
    return certificates.filter(cert => cert.type === type);
  }, [certificates]);

  const getAvailableCertificates = useCallback((): Certificate[] => {
    return certificates.filter(cert => cert.status === 'available');
  }, [certificates]);

  const getTotalValue = useCallback((): number => {
    return certificates
      .filter(cert => cert.status === 'available')
      .reduce((sum, cert) => sum + cert.value, 0);
  }, [certificates]);

  const storeCertificateDocument = useCallback(async (
    download: DownloadedCertificatePdf,
    result: CertificateParseResult,
    reconciliation?: { backendResult: CertificateParseResult; comparison: CertificateParserReconciliation },
    metadata?: CertificateDocumentStorageMetadata,
  ) => {
    const stored = await persistCertificateDocument(documentStorageKeyRef.current, download, result, reconciliation, metadata);
    setCertificateDocuments((current) => {
      const next = [...current.filter((document) => document.id !== stored.id), stored];
      certificateDocumentsRef.current = next;
      return next;
    });
    setCertificates((current) => {
      const next = cacheDocumentProjections(current, [stored]);
      certificatesRef.current = next;
      return next;
    });
    loadedDocumentStorageKeyRef.current = documentStorageKeyRef.current;
    setCertificateDocumentLoadState('ready');
    return stored;
  }, []);

  const reprocessCertificateDocument = useCallback(async (documentId: string, expectedCode?: string) => {
    const stored = await reprocessStoredCertificateDocument(documentStorageKeyRef.current, documentId, expectedCode);
    setCertificateDocuments((current) => {
      const next = current.map((document) => document.id === stored.id ? stored : document);
      certificateDocumentsRef.current = next;
      return next;
    });
    setCertificates((current) => {
      const withoutPriorProjection = current.filter((certificate) => certificate.sourceDocumentHash !== stored.documentHash);
      const next = cacheDocumentProjections(withoutPriorProjection, [stored]);
      certificatesRef.current = next;
      return next;
    });
    setCertificateDocumentLoadState('ready');
    return stored;
  }, []);

  const searchableCertificates = useMemo(() => {
    return mergeSearchableCertificates(certificates, certificateDocuments);
  }, [certificateDocuments, certificates]);

  const loadSearchableCertificates = useCallback(async (): Promise<Certificate[]> => {
    // Export and backup callers must be able to hydrate retained PDF results
    // directly. They must not depend on the Certificates screen having mounted.
    const cachedRows = certificatesRef.current.reduce((total, certificate) => total + (certificate.parsedSailings?.length ?? 0), 0);
    if (cachedRows === 0 || loadedDocumentStorageKeyRef.current !== documentStorageKeyRef.current) {
      await loadCertificateDocuments({ force: true });
    }
    return mergeSearchableCertificates(certificatesRef.current, certificateDocumentsRef.current);
  }, [loadCertificateDocuments]);

  return useMemo(() => ({
    certificates,
    searchableCertificates,
    certificateDocuments,
    isLoading,
    certificateDocumentLoadState,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    getCertificatesByType,
    getAvailableCertificates,
    getTotalValue,
    storeCertificateDocument,
    reprocessCertificateDocument,
    refreshCertificateDocuments: loadCertificateDocuments,
    loadSearchableCertificates,
  }), [certificates, searchableCertificates, certificateDocuments, isLoading, certificateDocumentLoadState, addCertificate, updateCertificate, deleteCertificate, getCertificatesByType, getAvailableCertificates, getTotalValue, storeCertificateDocument, reprocessCertificateDocument, loadCertificateDocuments, loadSearchableCertificates]);
});
