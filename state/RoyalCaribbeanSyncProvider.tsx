import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { 
  RoyalCaribbeanSyncState, 
  SyncStatus,
  OfferRow, 
  BookedCruiseRow,
  WebViewMessage
} from '@/lib/royalCaribbean/types';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectUpcomingCruisesExtraction } from '@/lib/royalCaribbean/step2_upcoming';
import { injectCourtesyHoldsExtraction } from '@/lib/royalCaribbean/step3_holds';
import { createSyncPreview, calculateSyncCounts, applySyncPreview } from '@/lib/royalCaribbean/syncLogic';

const INITIAL_STATE: RoyalCaribbeanSyncState = {
  status: 'not_logged_in',
  currentStep: '',
  progress: null,
  logs: [],
  extractedOffers: [],
  extractedBookedCruises: [],
  loyaltyData: null,
  error: null,
  lastSyncTimestamp: null,
  syncCounts: null,
  syncPreview: null,
  scrapePricingAndItinerary: false
};

export const [RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync] = createContextHook(() => {
  console.log('[RoyalCaribbeanSync] Provider initializing...');
  const [state, setState] = useState<RoyalCaribbeanSyncState>(INITIAL_STATE);
  const webViewRef = useRef<WebView | null>(null);
  const stepCompleteResolvers = useRef<{ [key: number]: () => void }>({});

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    rcLogger.log(message, type);
    setState(prev => ({
      ...prev,
      logs: rcLogger.getLogs()
    }));
  }, []);

  const setStatus = useCallback((status: SyncStatus) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  const setProgress = useCallback((current: number, total: number, stepName?: string) => {
    setState(prev => ({
      ...prev,
      progress: { current, total, stepName }
    }));
  }, []);

  const handleWebViewMessage = useCallback((message: WebViewMessage) => {
    switch (message.type) {
      case 'auth_status':
        setStatus(message.loggedIn ? 'logged_in' : 'not_logged_in');
        addLog(message.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
        break;

      case 'log':
        addLog(message.message, message.logType);
        break;

      case 'progress':
        setProgress(message.current, message.total, message.stepName);
        break;

      case 'step_complete':
        addLog(`Step ${message.step} completed with ${message.data.length} items`, 'success');
        if (message.step === 1) {
          setState(prev => ({ ...prev, extractedOffers: message.data as OfferRow[] }));
        } else if (message.step === 2 || message.step === 3) {
          setState(prev => ({
            ...prev,
            extractedBookedCruises: [
              ...prev.extractedBookedCruises,
              ...(message.data as BookedCruiseRow[])
            ]
          }));
        }
        if (stepCompleteResolvers.current[message.step]) {
          stepCompleteResolvers.current[message.step]();
          delete stepCompleteResolvers.current[message.step];
        }
        break;

      case 'loyalty_data':
        setState(prev => ({ ...prev, loyaltyData: message.data }));
        addLog('Loyalty data extracted', 'success');
        break;

      case 'error':
        setState(prev => ({ ...prev, error: message.message, status: 'error' }));
        addLog(`Error: ${message.message}`, 'error');
        break;

      case 'complete':
        setState(prev => ({ 
          ...prev, 
          status: 'complete',
          lastSyncTimestamp: new Date().toISOString()
        }));
        addLog('Ingestion completed successfully', 'success');
        break;
    }
  }, [addLog, setStatus, setProgress]);

  const openLogin = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://www.royalcaribbean.com/club-royale';
      `);
      addLog('Navigating to Club Royale page', 'info');
    }
  }, [addLog]);

  const runIngestion = useCallback(async () => {
    if (state.status !== 'logged_in') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    setState(prev => ({
      ...prev,
      status: 'running_step_1',
      extractedOffers: [],
      extractedBookedCruises: [],
      error: null
    }));

    addLog('Starting ingestion process...', 'info');
    
    const waitForStepComplete = (step: number, timeoutMs: number = 300000): Promise<void> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          delete stepCompleteResolvers.current[step];
          addLog(`Step ${step} timed out after ${timeoutMs / 1000}s - continuing anyway`, 'warning');
          resolve();
        }, timeoutMs);
        
        stepCompleteResolvers.current[step] = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    };
    
    try {
      addLog('Step 1: Extracting offers from Club Royale page...', 'info');
      addLog('Loading Offers Page...', 'info');
      
      webViewRef.current.injectJavaScript(injectOffersExtraction(state.scrapePricingAndItinerary) + '; true;');
      
      await waitForStepComplete(1, 300000);
      
      setState(prev => ({ ...prev, status: 'running_step_2' }));
      addLog('Step 2: Navigating to upcoming cruises page...', 'info');
      addLog('Loading Upcoming Cruises Page...', 'info');
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://www.royalcaribbean.com/account/upcoming-cruises';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      webViewRef.current.injectJavaScript(injectUpcomingCruisesExtraction() + '; true;');
      
      await waitForStepComplete(2, 180000);
      
      setState(prev => ({ ...prev, status: 'running_step_3' }));
      addLog('Step 3: Navigating to courtesy holds page...', 'info');
      addLog('Loading Courtesy Holds Page...', 'info');
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://www.royalcaribbean.com/account/courtesy-holds';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      webViewRef.current.injectJavaScript(injectCourtesyHoldsExtraction() + '; true;');
      
      await waitForStepComplete(3, 120000);
      
      setState(prev => {
        const upcomingCruises = prev.extractedBookedCruises.filter(c => c.status === 'Upcoming').length;
        const courtesyHolds = prev.extractedBookedCruises.filter(c => c.status === 'Courtesy Hold').length;
        const uniqueOffers = new Set(prev.extractedOffers.map(o => o.offerName)).size;
        
        return {
          ...prev, 
          status: 'awaiting_confirmation',
          syncCounts: {
            offerCount: uniqueOffers,
            offerRows: prev.extractedOffers.length,
            upcomingCruises,
            courtesyHolds
          },
          syncPreview: null
        };
      });
      addLog('All steps completed successfully! Ready to sync.', 'success');
      
    } catch (error) {
      addLog(`Ingestion failed: ${error}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
    }
  }, [state.status, state.scrapePricingAndItinerary, addLog]);

  const exportOffersCSV = useCallback(async () => {
    try {
      const csv = generateOffersCSV(state.extractedOffers, state.loyaltyData);
      const file = new File(Paths.cache, 'offers.csv');
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Offers CSV'
        });
      }

      addLog('Offers CSV exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export offers CSV: ${error}`, 'error');
    }
  }, [state.extractedOffers, state.loyaltyData, addLog]);

  const exportBookedCruisesCSV = useCallback(async () => {
    try {
      const csv = generateBookedCruisesCSV(state.extractedBookedCruises, state.loyaltyData);
      const file = new File(Paths.cache, 'Booked_Cruises.csv');
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Booked Cruises CSV'
        });
      }

      addLog('Booked Cruises CSV exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export booked cruises CSV: ${error}`, 'error');
    }
  }, [state.extractedBookedCruises, state.loyaltyData, addLog]);

  const exportLog = useCallback(async () => {
    try {
      const logText = rcLogger.getLogsAsText();
      const file = new File(Paths.cache, 'last.log');
      file.write(logText);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Sync Log'
        });
      }

      addLog('Log exported successfully', 'success');
    } catch (error) {
      addLog(`Failed to export log: ${error}`, 'error');
    }
  }, [addLog]);

  const resetState = useCallback(() => {
    setState(INITIAL_STATE);
    rcLogger.clear();
  }, []);

  const syncToApp = useCallback(async (coreDataContext: any, loyaltyContext: any) => {
    try {
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('Creating sync preview...', 'info');

      const currentLoyalty = {
        clubRoyalePoints: loyaltyContext.clubRoyalePoints,
        clubRoyaleTier: loyaltyContext.clubRoyaleTier,
        crownAndAnchorPoints: loyaltyContext.crownAnchorPoints,
        crownAndAnchorLevel: loyaltyContext.crownAnchorLevel
      };

      const preview = createSyncPreview(
        state.extractedOffers,
        state.extractedBookedCruises,
        state.loyaltyData,
        coreDataContext.casinoOffers,
        coreDataContext.bookedCruises,
        currentLoyalty
      );

      const counts = calculateSyncCounts(preview);
      addLog(`Preview: ${counts.offersNew} new offers, ${counts.offersUpdated} updated offers`, 'info');
      addLog(`Preview: ${counts.cruisesNew} new cruises, ${counts.cruisesUpdated} updated cruises`, 'info');
      addLog(`Preview: ${counts.upcomingCruises} upcoming, ${counts.courtesyHolds} holds`, 'info');

      setState(prev => ({ ...prev, syncPreview: preview }));

      addLog('Applying sync...', 'info');
      const { offers: finalOffers, cruises: finalCruises } = applySyncPreview(
        preview,
        coreDataContext.casinoOffers,
        coreDataContext.bookedCruises
      );

      addLog(`Setting ${finalOffers.length} total offers in app`, 'info');
      coreDataContext.setCasinoOffers(finalOffers);

      addLog(`Setting ${finalCruises.length} total cruises in app`, 'info');
      coreDataContext.setBookedCruises(finalCruises);

      if (preview.loyalty) {
        if (preview.loyalty.clubRoyalePoints.changed) {
          addLog(`Updating Club Royale points: ${preview.loyalty.clubRoyalePoints.current} → ${preview.loyalty.clubRoyalePoints.synced}`, 'info');
          await loyaltyContext.setManualClubRoyalePoints(preview.loyalty.clubRoyalePoints.synced);
        }
        if (preview.loyalty.crownAndAnchorPoints.changed) {
          addLog(`Updating Crown & Anchor points: ${preview.loyalty.crownAndAnchorPoints.current} → ${preview.loyalty.crownAndAnchorPoints.synced}`, 'info');
          await loyaltyContext.setManualCrownAnchorPoints(preview.loyalty.crownAndAnchorPoints.synced);
        }
      }

      setState(prev => ({ 
        ...prev, 
        status: 'complete',
        lastSyncTimestamp: new Date().toISOString(),
        syncCounts: {
          offerCount: counts.totalOffers,
          offerRows: counts.totalOffers,
          upcomingCruises: counts.upcomingCruises,
          courtesyHolds: counts.courtesyHolds
        }
      }));
      addLog('Data synced successfully to app!', 'success');
    } catch (error) {
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
      addLog(`Failed to sync data: ${error}`, 'error');
      console.error('[RoyalCaribbeanSync] Sync error:', error);
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, addLog]);

  const cancelSync = useCallback(() => {
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog]);

  const togglePricingAndItinerary = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      scrapePricingAndItinerary: !prev.scrapePricingAndItinerary 
    }));
  }, []);

  return {
    state,
    webViewRef,
    openLogin,
    runIngestion,
    exportOffersCSV,
    exportBookedCruisesCSV,
    exportLog,
    resetState,
    syncToApp,
    cancelSync,
    togglePricingAndItinerary,
    handleWebViewMessage,
    addLog
  };
});
