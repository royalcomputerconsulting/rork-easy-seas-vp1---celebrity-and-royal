import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { quotaSafeGetJsonItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import createContextHook from '@nkzw/create-context-hook';
import type { Certificate, CertificateType } from '@/components/CertificateManagerModal';
import { useAuth } from './AuthProvider';
import { getUserScopedKey } from '@/lib/storage/storageKeys';
import {
  CERTIFICATE_DOCUMENT_STORE_KEY,
  loadCertificateDocumentsWithReport,
  reprocessStoredCertificateDocument,
  storeCertificateDocument as persistCertificateDocument,
  type CertificateDocumentStorageMetadata,
  type CertificateDocumentRecord,
} from '@/lib/certificates/certificateDocumentStore';
import type { CertificateParseResult, CertificateParserReconciliation, DownloadedCertificatePdf } from '@/lib/certificates/certificatePdfPipeline';

const BASE_CERT_KEY = '@easyseas_certificates';

interface CertificatesState {
  certificates: Certificate[];
  searchableCertificates: Certificate[];
  certificateDocuments: CertificateDocumentRecord[];
  isLoading: boolean;
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
}

const DEFAULT_CERTIFICATES: Certificate[] = [];

function buildSearchableCertificateDocuments(documents: CertificateDocumentRecord[]): Certificate[] {
  return documents
    .filter((document) => document.documentKind === 'certificate')
    .map((document) => {
      const latest = document.parseHistory[document.parseHistory.length - 1]?.result;
      const sailings = latest?.sailings ?? [];
      const code = sailings[0]?.certificateCode || document.provenance.originalUrl.match(/(\d{4}[AC][A-Z0-9]+)/i)?.[1]?.toUpperCase();
      const family = sailings[0]?.certificateFamily;
      const pointRequirements = sailings.map((row) => row.pointRequirement).filter((value): value is number => typeof value === 'number');
      const maxFreePlay = sailings.reduce((max, row) => Math.max(max, row.freePlay ?? 0), 0);
      const maxOnboardCredit = sailings.reduce((max, row) => Math.max(max, row.onboardCredit ?? 0), 0);
      const value = maxFreePlay + maxOnboardCredit;
      const parserStatus = latest?.status ?? document.provenance.parseStatus ?? 'not_parsed';
      return {
        id: `document-${document.id}`,
        type: 'freeplay',
        label: code ? `${code} Instant Cruise Reward` : 'Downloaded Club Royale Certificate',
        value,
        description: `${sailings.length.toLocaleString()} eligible sailing(s) parsed from the retained Royal Caribbean PDF${pointRequirements.length ? ` · point levels ${Math.min(...pointRequirements).toLocaleString()}–${Math.max(...pointRequirements).toLocaleString()}` : ''}.`,
        status: 'available',
        certificateCode: code,
        certificateFamily: family && family !== 'unclassified' ? family : undefined,
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

export const [CertificatesProvider, useCertificates] = createContextHook((): CertificatesState => {
  const { authenticatedEmail } = useAuth();
  const lastEmailRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [certificateDocuments, setCertificateDocuments] = useState<CertificateDocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedCertificatesSnapshotRef = useRef<Certificate[] | null>(null);

  const storageKeyRef = useRef(getUserScopedKey(BASE_CERT_KEY, authenticatedEmail));
  const documentStorageKeyRef = useRef(getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail));
  const loadedDocumentStorageKeyRef = useRef<string | null>(null);
  const documentLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  useEffect(() => {
    storageKeyRef.current = getUserScopedKey(BASE_CERT_KEY, authenticatedEmail);
    documentStorageKeyRef.current = getUserScopedKey(CERTIFICATE_DOCUMENT_STORE_KEY, authenticatedEmail);
    loadedDocumentStorageKeyRef.current = null;
    documentLoadRef.current = null;
    console.log('[CertificatesProvider] Scoped storage key updated for:', authenticatedEmail);
  }, [authenticatedEmail]);

  const loadCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await quotaSafeGetJsonItem<Certificate[]>(
        storageKeyRef.current,
        [],
        Array.isArray,
      );
      if (stored.length > 0) {
        loadedCertificatesSnapshotRef.current = stored;
        setCertificates(stored);
        console.log('[CertificatesProvider] Loaded certificates:', stored.length);
      } else {
        loadedCertificatesSnapshotRef.current = DEFAULT_CERTIFICATES;
        setCertificates(DEFAULT_CERTIFICATES);
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
  }, []);

  const loadCertificateDocuments = useCallback(async (options?: { force?: boolean }) => {
    const key = documentStorageKeyRef.current;
    if (!options?.force && loadedDocumentStorageKeyRef.current === key) return;
    if (documentLoadRef.current?.key === key) return documentLoadRef.current.promise;

    const promise = (async () => {
      try {
        const report = await loadCertificateDocumentsWithReport(key);
        if (documentStorageKeyRef.current !== key) return;
        setCertificateDocuments(report.documents);
        loadedDocumentStorageKeyRef.current = key;
        if (report.malformedStorage) {
          console.error('[CertificatesProvider] Certificate document storage is malformed; no documents were restored.');
        } else if (report.invalidRecordCount > 0) {
          console.warn('[CertificatesProvider] Quarantined invalid certificate document record(s):', report.invalidRecordCount);
        }
        console.log('[CertificatesProvider] Loaded certificate documents:', report.documents.length);
      } catch (error) {
        console.error('[CertificatesProvider] Error loading certificate documents:', error);
        if (documentStorageKeyRef.current === key) setCertificateDocuments([]);
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
  }, [certificates]);

  const addCertificate = useCallback((cert: Omit<Certificate, 'id'>) => {
    const newCert: Certificate = {
      ...cert,
      id: `cert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setCertificates(prev => [...prev, newCert]);
    console.log('[CertificatesProvider] Added certificate:', newCert.id);
  }, []);

  const updateCertificate = useCallback((id: string, updates: Partial<Certificate>) => {
    setCertificates(prev => 
      prev.map(cert => cert.id === id ? { ...cert, ...updates } : cert)
    );
    console.log('[CertificatesProvider] Updated certificate:', id);
  }, []);

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
    await loadCertificateDocuments({ force: true });
    return stored;
  }, [loadCertificateDocuments]);

  const reprocessCertificateDocument = useCallback(async (documentId: string, expectedCode?: string) => {
    const stored = await reprocessStoredCertificateDocument(documentStorageKeyRef.current, documentId, expectedCode);
    await loadCertificateDocuments({ force: true });
    return stored;
  }, [loadCertificateDocuments]);

  const searchableCertificates = useMemo(() => {
    const documents = buildSearchableCertificateDocuments(certificateDocuments);
    const manualHashes = new Set(certificates.map((certificate) => certificate.sourceDocumentHash).filter(Boolean));
    return [...certificates, ...documents.filter((certificate) => !certificate.sourceDocumentHash || !manualHashes.has(certificate.sourceDocumentHash))];
  }, [certificateDocuments, certificates]);

  return useMemo(() => ({
    certificates,
    searchableCertificates,
    certificateDocuments,
    isLoading,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    getCertificatesByType,
    getAvailableCertificates,
    getTotalValue,
    storeCertificateDocument,
    reprocessCertificateDocument,
    refreshCertificateDocuments: loadCertificateDocuments,
  }), [certificates, searchableCertificates, certificateDocuments, isLoading, addCertificate, updateCertificate, deleteCertificate, getCertificatesByType, getAvailableCertificates, getTotalValue, storeCertificateDocument, reprocessCertificateDocument, loadCertificateDocuments]);
});
