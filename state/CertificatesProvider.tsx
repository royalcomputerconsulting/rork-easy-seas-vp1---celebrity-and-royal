import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { Certificate, CertificateType } from '@/components/CertificateManagerModal';
import { useAuth } from './AuthProvider';

const CERTIFICATES_STORAGE_KEY = '@easyseas_certificates';

interface CertificatesState {
  certificates: Certificate[];
  isLoading: boolean;
  addCertificate: (cert: Omit<Certificate, 'id'>) => void;
  updateCertificate: (id: string, updates: Partial<Certificate>) => void;
  deleteCertificate: (id: string) => void;
  getCertificatesByType: (type: CertificateType) => Certificate[];
  getAvailableCertificates: () => Certificate[];
  getTotalValue: () => number;
}

const DEFAULT_CERTIFICATES: Certificate[] = [];

export const [CertificatesProvider, useCertificates] = createContextHook((): CertificatesState => {
  const { authenticatedEmail } = useAuth();
  const lastEmailRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCertificates = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(CERTIFICATES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCertificates(parsed);
        console.log('[CertificatesProvider] Loaded certificates:', parsed.length);
      } else {
        setCertificates(DEFAULT_CERTIFICATES);
        await AsyncStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(DEFAULT_CERTIFICATES));
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

  useEffect(() => {
    if (authenticatedEmail !== lastEmailRef.current) {
      const previousEmail = lastEmailRef.current;
      lastEmailRef.current = authenticatedEmail;
      
      if (previousEmail !== null && previousEmail !== authenticatedEmail) {
        console.log('[CertificatesProvider] User changed from', previousEmail, 'to', authenticatedEmail, '- resetting certificates');
        isInitializedRef.current = false;
        setCertificates(DEFAULT_CERTIFICATES);
      }
    }
    
    void loadCertificates();
  }, [loadCertificates, authenticatedEmail]);

  useEffect(() => {
    const handleDataCleared = () => {
      console.log('[CertificatesProvider] Data cleared event detected, resetting certificates');
      isInitializedRef.current = false;
      setCertificates(DEFAULT_CERTIFICATES);
      setIsLoading(false);
    };

    const handleCloudRestore = () => {
      console.log('[CertificatesProvider] Cloud data restored, reloading certificates');
      void loadCertificates();
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
  }, [loadCertificates]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const saveCertificates = async () => {
      try {
        await AsyncStorage.setItem(CERTIFICATES_STORAGE_KEY, JSON.stringify(certificates));
        console.log('[CertificatesProvider] Auto-saved certificates:', certificates.length);
      } catch (error) {
        console.error('[CertificatesProvider] Error saving certificates:', error);
      }
    };

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

  return useMemo(() => ({
    certificates,
    isLoading,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    getCertificatesByType,
    getAvailableCertificates,
    getTotalValue,
  }), [certificates, isLoading, addCertificate, updateCertificate, deleteCertificate, getCertificatesByType, getAvailableCertificates, getTotalValue]);
});
