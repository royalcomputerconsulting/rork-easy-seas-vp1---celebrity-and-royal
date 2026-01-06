import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { 
  RoyalCaribbeanSyncState, 
  OfferRow, 
  BookedCruiseRow,
  WebViewMessage
} from '@/lib/royalCaribbean/types';
import { rcLogger } from '@/lib/royalCaribbean/logger';
import { generateOffersCSV, generateBookedCruisesCSV } from '@/lib/royalCaribbean/csvGenerator';
import { injectOffersExtraction } from '@/lib/royalCaribbean/step1_offers';
import { injectUpcomingCruisesExtraction } from '@/lib/royalCaribbean/step2_upcoming';
import { injectCourtesyHoldsExtraction } from '@/lib/royalCaribbean/step3_holds';
import { transformOffersToCasinoOffers, transformBookedCruisesToAppFormat } from '@/lib/royalCaribbean/dataTransformers';

const INITIAL_STATE: RoyalCaribbeanSyncState = {
  status: 'not_logged_in',
  currentStep: '',
  currentUrl: null,
  progress: null,
  logs: [],
  extractedOffers: [],
  extractedBookedCruises: [],
  loyaltyData: null,
  error: null,
  lastSyncTimestamp: null,
  syncCounts: null
};

export const [RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync] = createContextHook(() => {
  const [state, setState] = useState<RoyalCaribbeanSyncState>(INITIAL_STATE);
  const webViewRef = useRef<WebView | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    rcLogger.log(message, type);
    setState(prev => ({
      ...prev,
      logs: rcLogger.getLogs()
    }));
  }, []);

  const setProgress = useCallback((current: number, total: number, stepName?: string) => {
    setState(prev => ({
      ...prev,
      progress: { current, total, stepName }
    }));
  }, []);

  const stepsCompleted = useRef({ step1: false, step2: false, step3: false });

  const checkIfAllStepsComplete = useCallback(() => {
    console.log('[PROVIDER] Checking if all steps complete:', stepsCompleted.current);
    console.log('[PROVIDER] isIngestionRunning:', isIngestionRunning.current);
    
    if (!stepsCompleted.current.step1 || !stepsCompleted.current.step2 || 
        !stepsCompleted.current.step3) {
      console.log('[PROVIDER] Not all steps complete yet. Step1:', stepsCompleted.current.step1, 'Step2:', stepsCompleted.current.step2, 'Step3:', stepsCompleted.current.step3);
      return;
    }

    console.log('[PROVIDER] ✓ All steps completed! Computing counts...');

    setState(prev => {
      console.log('[PROVIDER] Current state - Offers:', prev.extractedOffers.length, 'Booked:', prev.extractedBookedCruises.length);
      
      const uniqueOfferCodes = new Set(prev.extractedOffers.map(o => o.offerCode));
      const cruisesFromOffers = prev.extractedOffers.filter(o => o.shipName && o.sailingDate).length;
      const upcomingCruises = prev.extractedBookedCruises.filter(c => c.status === 'Upcoming').length;
      const courtesyHolds = prev.extractedBookedCruises.filter(c => c.status === 'Courtesy Hold').length;
      
      console.log('[PROVIDER] ✓ Final Counts:', { offers: uniqueOfferCodes.size, cruises: cruisesFromOffers, upcomingCruises, courtesyHolds });
      
      console.log('[PROVIDER] ✓ Setting status to awaiting_confirmation');
      
      return {
        ...prev, 
        status: 'awaiting_confirmation',
        syncCounts: {
          offers: uniqueOfferCodes.size,
          cruises: cruisesFromOffers,
          upcomingCruises,
          courtesyHolds
        }
      };
    });

    addLog('', 'success');
    addLog('========================================', 'success');
    addLog('✓ DATA EXTRACTION COMPLETE', 'success');
    addLog('========================================', 'success');
    
    setState(prev => {
      const uniqueOfferCodes = new Set(prev.extractedOffers.map(o => o.offerCode));
      const cruisesFromOffers = prev.extractedOffers.filter(o => o.shipName && o.sailingDate).length;
      const upcomingCruises = prev.extractedBookedCruises.filter(c => c.status === 'Upcoming').length;
      const courtesyHolds = prev.extractedBookedCruises.filter(c => c.status === 'Courtesy Hold').length;
      
      addLog(`Offers Found: ${uniqueOfferCodes.size}`, 'success');
      addLog(`Available Sailings: ${cruisesFromOffers}`, 'success');
      addLog(`Upcoming Booked: ${upcomingCruises}`, 'success');
      addLog(`Courtesy Holds: ${courtesyHolds}`, 'success');
      if (prev.loyaltyData?.crownAndAnchorLevel) {
        addLog(`Loyalty Level: ${prev.loyaltyData.crownAndAnchorLevel} (${prev.loyaltyData.crownAndAnchorPoints || 'N/A'} points)`, 'success');
      }
      addLog('========================================', 'success');
      addLog('🎉 Ready to preview and import to app!', 'success');
      
      return prev;
    });
    
    isIngestionRunning.current = false;
    console.log('[PROVIDER] ✓ Ingestion marked as complete');
  }, [addLog]);

  const handleWebViewMessage = useCallback((message: WebViewMessage) => {
    switch (message.type) {
      case 'auth_status':
        setState(prev => {
          if (isIngestionRunning.current || prev.status.startsWith('running_') || prev.status === 'syncing' || prev.status === 'awaiting_confirmation') {
            return prev;
          }
          return { ...prev, status: message.loggedIn ? 'logged_in' : 'not_logged_in' };
        });
        if (!isIngestionRunning.current && state.status !== 'complete') {
          addLog(message.loggedIn ? 'User logged in successfully' : 'User not logged in', 'info');
        }
        break;

      case 'log':
        addLog(message.message, message.logType);
        break;

      case 'progress':
        setProgress(message.current, message.total, message.stepName);
        break;

      case 'step_complete':
        console.log(`[PROVIDER] Step ${message.step} completed with ${message.data.length} items`);
        addLog(`✓ Step ${message.step} completed: ${message.data.length} items`, 'success');
        
        if (message.step === 1) {
          extractedDataRef.current.offers = message.data.length;
          setState(prev => ({ ...prev, extractedOffers: message.data as OfferRow[] }));
          stepsCompleted.current.step1 = true;
          console.log('[PROVIDER] ✓ Step 1 (Offers) marked complete. Data count:', message.data.length);
        } else if (message.step === 2) {
          extractedDataRef.current.booked += message.data.length;
          setState(prev => ({
            ...prev,
            extractedBookedCruises: [
              ...prev.extractedBookedCruises,
              ...(message.data as BookedCruiseRow[])
            ]
          }));
          stepsCompleted.current.step2 = true;
          console.log('[PROVIDER] ✓ Step 2 (Upcoming) marked complete. Data count:', message.data.length);
        } else if (message.step === 3) {
          extractedDataRef.current.booked += message.data.length;
          setState(prev => ({
            ...prev,
            extractedBookedCruises: [
              ...prev.extractedBookedCruises,
              ...(message.data as BookedCruiseRow[])
            ]
          }));
          stepsCompleted.current.step3 = true;
          console.log('[PROVIDER] ✓ Step 3 (Courtesy Holds) marked complete. Data count:', message.data.length);
        }
        
        console.log('[PROVIDER] Scheduling completion check in 1000ms...');
        setTimeout(() => {
          console.log('[PROVIDER] Running scheduled completion check...');
          checkIfAllStepsComplete();
        }, 1000);
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
  }, [addLog, setProgress, checkIfAllStepsComplete, state.status]);

  const openLogin = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://www.royalcaribbean.com/club-royale/offers';
      `);
      addLog('Navigating to Club Royale offers page', 'info');
    }
  }, [addLog]);

  const isIngestionRunning = useRef(false);

  const extractedDataRef = useRef({ offers: 0, booked: 0 });

  const waitForStepCompletion = useCallback((stepNumber: number, timeoutMs: number) => {
    return new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if ((stepNumber === 1 && stepsCompleted.current.step1) ||
            (stepNumber === 2 && stepsCompleted.current.step2) ||
            (stepNumber === 3 && stepsCompleted.current.step3)) {
          clearInterval(checkInterval);
          console.log(`[PROVIDER] Step ${stepNumber} confirmed complete`);
          resolve();
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log(`[PROVIDER] Step ${stepNumber} timed out after ${timeoutMs}ms`);
        resolve();
      }, timeoutMs);
    });
  }, []);

  const runIngestion = useCallback(async () => {
    if (isIngestionRunning.current) {
      addLog('Ingestion already running, ignoring duplicate call', 'warning');
      return;
    }

    if (state.status !== 'logged_in') {
      addLog('Cannot run ingestion: user not logged in', 'error');
      return;
    }

    if (!webViewRef.current) {
      addLog('WebView not available', 'error');
      return;
    }

    isIngestionRunning.current = true;
    stepsCompleted.current = { step1: false, step2: false, step3: false };
    extractedDataRef.current = { offers: 0, booked: 0 };

    setState(prev => ({
      ...prev,
      status: 'running_step_1',
      currentUrl: 'https://www.royalcaribbean.com/club-royale/offers',
      extractedOffers: [],
      extractedBookedCruises: [],
      error: null,
      syncCounts: null
    }));

    addLog('========================================', 'info');
    addLog('Starting Royal Caribbean Data Sync', 'info');
    addLog('========================================', 'info');
    
    webViewRef.current.injectJavaScript(`
      if (typeof window.__stopAuthDetection === 'function') {
        window.__stopAuthDetection();
      }
      true;
    `);
    
    try {
      addLog('', 'info');
      addLog('STEP 1: Extracting Club Royale Offers & Sailings', 'info');
      addLog('Already on offers page, starting extraction...', 'info');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addLog('Extracting offers and available sailings...', 'info');
      webViewRef.current.injectJavaScript(injectOffersExtraction() + '; true;');
      
      addLog('Waiting for Step 1 to complete...', 'info');
      await waitForStepCompletion(1, 90000);
      addLog('Step 1 complete or timed out', 'info');
      
      addLog('', 'info');
      addLog('Transitioning: Navigating to Account page...', 'info');
      const accountUrl = `https://www.royalcaribbean.com/account/`;
      webViewRef.current.injectJavaScript(`
        window.location.href = '${accountUrl}';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      addLog('', 'info');
      addLog('STEP 2: Extracting Upcoming Booked Cruises', 'info');
      addLog('Navigating to upcoming cruises page...', 'info');
      const upcomingUrl = `https://www.royalcaribbean.com/account/upcoming-cruises`;
      setState(prev => ({ 
        ...prev, 
        status: 'running_step_2',
        currentUrl: upcomingUrl
      }));
      webViewRef.current.injectJavaScript(`
        window.location.href = '${upcomingUrl}';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      addLog('Extracting upcoming cruise bookings...', 'info');
      console.log('[PROVIDER] Injecting step 2 script');
      webViewRef.current.injectJavaScript(injectUpcomingCruisesExtraction() + '; true;');
      
      addLog('Waiting for Step 2 to complete...', 'info');
      await waitForStepCompletion(2, 60000);
      addLog('Step 2 complete or timed out', 'info');
      
      addLog('', 'info');
      addLog('STEP 3: Extracting Courtesy Holds', 'info');
      addLog('Navigating to courtesy holds page...', 'info');
      const holdsUrl = `https://www.royalcaribbean.com/account/courtesy-holds`;
      setState(prev => ({ 
        ...prev, 
        status: 'running_step_3',
        currentUrl: holdsUrl
      }));
      webViewRef.current.injectJavaScript(`
        window.location.href = '${holdsUrl}';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      addLog('Extracting courtesy holds...', 'info');
      webViewRef.current.injectJavaScript(injectCourtesyHoldsExtraction() + '; true;');
      
      addLog('Waiting for Step 3 to complete...', 'info');
      await waitForStepCompletion(3, 30000);
      addLog('Step 3 complete or timed out', 'info');
      
      addLog('', 'info');
      addLog('All extraction steps complete. Processing results...', 'info');
      
      console.log('[PROVIDER] All steps finished. Final check...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[PROVIDER] Running final completion check...');
      checkIfAllStepsComplete();
      
    } catch (error) {
      addLog(`Ingestion failed: ${error}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
      isIngestionRunning.current = false;
    }
  }, [addLog, checkIfAllStepsComplete, state.status, waitForStepCompletion]);

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

  const getTransformedPreview = useCallback(() => {
    if (state.extractedOffers.length === 0 && state.extractedBookedCruises.length === 0) {
      return null;
    }

    const { offers: transformedOffers, cruises: transformedCruises } = transformOffersToCasinoOffers(state.extractedOffers, state.loyaltyData);
    const transformedBookedCruises = transformBookedCruisesToAppFormat(state.extractedBookedCruises, state.loyaltyData);

    return {
      offers: transformedOffers,
      cruises: transformedCruises,
      bookedCruises: transformedBookedCruises,
      loyaltyData: state.loyaltyData,
      syncCounts: state.syncCounts
    };
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, state.syncCounts]);

  const syncToApp = useCallback(async (coreDataContext: any) => {
    try {
      setState(prev => ({ ...prev, status: 'syncing' }));
      addLog('Syncing data to app...', 'info');

      const { offers: transformedOffers, cruises: transformedCruises } = transformOffersToCasinoOffers(state.extractedOffers, state.loyaltyData);
      const transformedBookedCruises = transformBookedCruisesToAppFormat(state.extractedBookedCruises, state.loyaltyData);

      addLog(`Transformed ${transformedOffers.length} offers, ${transformedCruises.length} cruises, and ${transformedBookedCruises.length} booked cruises`, 'info');

      const existingOffers = coreDataContext.casinoOffers || [];
      const existingCruises = coreDataContext.cruises || [];
      const existingBooked = coreDataContext.bookedCruises || [];

      const isDuplicateOffer = (offer: any, existing: any[]) => {
        return existing.some(e => e.offerCode && offer.offerCode && e.offerCode === offer.offerCode);
      };

      const isDuplicateCruise = (cruise: any, existing: any[]) => {
        return existing.some(e => {
          return e.shipName === cruise.shipName && 
                 e.sailDate === cruise.sailDate && 
                 e.nights === cruise.nights;
        });
      };

      const isDuplicateBooked = (cruise: any, existing: any[]) => {
        return existing.some(e => {
          if (cruise.reservationNumber && e.reservationNumber && 
              cruise.reservationNumber === e.reservationNumber) {
            return true;
          }
          return e.shipName === cruise.shipName && 
                 e.sailDate === cruise.sailDate && 
                 e.nights === cruise.nights;
        });
      };

      const newOffers = transformedOffers.filter(offer => !isDuplicateOffer(offer, existingOffers));
      const newCruises = transformedCruises.filter(cruise => !isDuplicateCruise(cruise, existingCruises));
      const newBookedCruises = transformedBookedCruises.filter(cruise => !isDuplicateBooked(cruise, existingBooked));

      addLog(`Filtered duplicates: ${newOffers.length} new offers, ${newCruises.length} new cruises, ${newBookedCruises.length} new booked cruises`, 'info');

      if (newOffers.length === 0 && newCruises.length === 0 && newBookedCruises.length === 0) {
        addLog('No new data to sync - all items already exist in the app', 'warning');
        setState(prev => ({ 
          ...prev, 
          status: 'complete',
          lastSyncTimestamp: new Date().toISOString()
        }));
        return;
      }

      const allOffers = [...existingOffers, ...newOffers];
      const allCruises = [...existingCruises, ...newCruises];
      const allBooked = [...existingBooked, ...newBookedCruises];

      coreDataContext.setCasinoOffers(allOffers);
      coreDataContext.setCruises(allCruises);
      coreDataContext.setBookedCruises(allBooked);

      setState(prev => ({ 
        ...prev, 
        status: 'complete',
        lastSyncTimestamp: new Date().toISOString()
      }));
      addLog(`Successfully synced ${newOffers.length} new offers, ${newCruises.length} new available cruises, and ${newBookedCruises.length} new booked cruises to your app!`, 'success');
    } catch (error) {
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
      addLog(`Failed to sync data: ${error}`, 'error');
    }
  }, [state.extractedOffers, state.extractedBookedCruises, state.loyaltyData, addLog]);

  const cancelSync = useCallback(() => {
    setState(prev => ({ ...prev, status: 'logged_in', syncCounts: null }));
    addLog('Sync cancelled', 'warning');
  }, [addLog]);

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
    handleWebViewMessage,
    addLog,
    getTransformedPreview
  };
});
