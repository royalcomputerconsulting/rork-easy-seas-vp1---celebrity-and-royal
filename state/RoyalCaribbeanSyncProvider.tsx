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
    console.log('Checking if all steps complete:', stepsCompleted.current);
    
    if (!stepsCompleted.current.step1 || !stepsCompleted.current.step2 || 
        !stepsCompleted.current.step3) {
      console.log('Not all steps complete yet');
      return;
    }

    console.log('All steps completed! Computing counts...');

    setState(prev => {
      const uniqueOfferCodes = new Set(prev.extractedOffers.map(o => o.offerCode));
      const cruisesFromOffers = prev.extractedOffers.filter(o => o.shipName && o.sailingDate).length;
      const upcomingCruises = prev.extractedBookedCruises.filter(c => c.status === 'Upcoming').length;
      const courtesyHolds = prev.extractedBookedCruises.filter(c => c.status === 'Courtesy Hold').length;
      
      console.log('Counts:', { offers: uniqueOfferCodes.size, cruises: cruisesFromOffers, upcomingCruises, courtesyHolds });
      
      addLog(`\n========== INGESTION COMPLETE ==========`, 'success');
      addLog(`Found ${uniqueOfferCodes.size} unique offers with ${cruisesFromOffers} sailings`, 'success');
      addLog(`Found ${upcomingCruises} upcoming cruises`, 'success');
      addLog(`Found ${courtesyHolds} courtesy holds`, 'success');
      if (prev.loyaltyData?.crownAndAnchorLevel) {
        addLog(`Crown & Anchor: ${prev.loyaltyData.crownAndAnchorLevel} (${prev.loyaltyData.crownAndAnchorPoints || 'N/A'} points)`, 'success');
      }
      addLog(`========================================`, 'success');
      addLog('All data extracted successfully! Ready to sync to app.', 'success');
      
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
        if (!isIngestionRunning.current) {
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
        console.log(`Step ${message.step} completed with ${message.data.length} items`);
        addLog(`Step ${message.step} completed with ${message.data.length} items`, 'success');
        if (message.step === 1) {
          extractedDataRef.current.offers = message.data.length;
          setState(prev => ({ ...prev, extractedOffers: message.data as OfferRow[] }));
          stepsCompleted.current.step1 = true;
          console.log('Step 1 marked complete');
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
          console.log('Step 2 marked complete');
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
          console.log('Step 3 marked complete');
        }
        
        setTimeout(() => checkIfAllStepsComplete(), 500);
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
  }, [addLog, setProgress, checkIfAllStepsComplete]);

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

    addLog('Starting ingestion process...', 'info');
    
    try {
      const timestamp = Date.now();
      
      addLog('Step 1: Scraping Club Royale Offers page...', 'info');
      webViewRef.current.injectJavaScript(`
        window.location.href = 'https://www.royalcaribbean.com/club-royale/offers?_t=${timestamp}';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      addLog('Injecting Step 1 extraction script...', 'info');
      webViewRef.current.injectJavaScript(injectOffersExtraction() + '; true;');
      
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      addLog('Step 1 complete. Navigating to Account page for 10-second pause...', 'info');
      const accountUrl = `https://www.royalcaribbean.com/account/`;
      webViewRef.current.injectJavaScript(`
        window.location.href = '${accountUrl}';
        true;
      `);
      
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      addLog('Account page pause complete. Navigating to upcoming cruises...', 'info');
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
      
      addLog('Injecting Step 2 extraction script...', 'info');
      console.log('[PROVIDER] Injecting step 2 script');
      webViewRef.current.injectJavaScript(injectUpcomingCruisesExtraction() + '; true;');
      
      await new Promise(resolve => setTimeout(resolve, 40000));
      
      addLog('Step 2 complete. Navigating to courtesy holds page...', 'info');
      const holdsUrl = `https://www.royalcaribbean.com/account/Courtesy-hold`;
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
      
      addLog('Injecting Step 3 extraction script...', 'info');
      webViewRef.current.injectJavaScript(injectCourtesyHoldsExtraction() + '; true;');
      
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      addLog('All steps completed! Finalizing data...', 'success');
      addLog(`Step results - Offers: ${extractedDataRef.current.offers}, Booked: ${extractedDataRef.current.booked}`, 'info');
      setTimeout(() => checkIfAllStepsComplete(), 2000);
      
    } catch (error) {
      addLog(`Ingestion failed: ${error}`, 'error');
      setState(prev => ({ ...prev, status: 'error', error: String(error) }));
    } finally {
      isIngestionRunning.current = false;
    }
  }, [addLog, checkIfAllStepsComplete, state.status]);

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
    addLog
  };
});
