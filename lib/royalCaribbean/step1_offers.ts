export const STEP1_OFFERS_SCRIPT = `
(function() {
  const BATCH_SIZE = 150;
  
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sendOfferBatch(offers, isFinal = false, totalCount = 0, offerCount = 0) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: isFinal ? 'step_complete' : 'offers_batch',
      step: 1,
      data: offers,
      isFinal: isFinal,
      totalCount: totalCount,
      offerCount: offerCount
    }));
  }
  
  function sendOfferProgress(offerIndex, totalOffers, offerName, sailingsCount, status) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'offer_progress',
      offerIndex: offerIndex,
      totalOffers: totalOffers,
      offerName: offerName,
      sailingsCount: sailingsCount,
      status: status
    }));
  }

  function log(message, type = 'info') {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      message: message,
      logType: type
    }));
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    } catch (e) {
      return dateStr;
    }
  }

  function formatSailDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return month + '/' + day + '/' + year;
    } catch (e) {
      return dateStr;
    }
  }

  async function extractClubRoyaleStatus() {
    try {
      log('Extracting Club Royale status...');
      log('⚠️ Note: Loyalty data will be fetched via API in Step 4 for accuracy', 'info');

      // Don't extract loyalty data from DOM in Step 1 - it's unreliable
      // The API-based extraction in Step 4 is the authoritative source
      // This prevents incorrect data (like CHOICE/200) from being sent
      
      return null;
    } catch (error) {
      log('Error extracting Club Royale status: ' + error.message, 'warning');
      return null;
    }
  }

  async function getAuthContext() {
    try {
      log('Parsing session data from localStorage...');
      const sessionData = localStorage.getItem('persist:session');
      
      if (!sessionData) {
        throw new Error('No session data found. Please log in again.');
      }
      
      const parsedData = JSON.parse(sessionData);
      const authToken = parsedData.token ? JSON.parse(parsedData.token) : null;
      const tokenExpiration = parsedData.tokenExpiration ? parseInt(parsedData.tokenExpiration) * 1000 : null;
      const user = parsedData.user ? JSON.parse(parsedData.user) : null;
      const accountId = user && user.accountId ? user.accountId : null;
      const loyaltyId = user && user.cruiseLoyaltyId ? user.cruiseLoyaltyId : null;
      
      if (!authToken || !accountId) {
        throw new Error('Invalid session data. Please log in again.');
      }
      
      const currentTime = Date.now();
      if (tokenExpiration && tokenExpiration < currentTime) {
        throw new Error('Session expired. Please log in again.');
      }
      
      log('Session data parsed successfully', 'success');
      
      const rawAuth = authToken && authToken.toString ? authToken.toString() : '';
      const networkAuth = rawAuth ? (rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth) : '';
      
      const headers = {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'account-id': accountId,
        'authorization': networkAuth,
        'content-type': 'application/json',
      };
      
      const host = location && location.hostname ? location.hostname : '';
      const brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
      const baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
      
      return { headers, accountId, loyaltyId, brandCode, baseUrl, user };
    } catch (error) {
      log('Failed to get auth context: ' + error.message, 'error');
      throw error;
    }
  }

  async function fetchOffersFromAPI(authContext) {
    try {
      log('🔌 Using API-based offer extraction (more reliable)...');
      
      const { headers, loyaltyId, brandCode, baseUrl } = authContext;
      
      const endpoint = baseUrl + '/api/casino/casino-offers/v1';
      
      log('📡 Calling Royal Caribbean Casino Offers API...');
      log('Endpoint: ' + endpoint);
      
      const requestBody = {
        cruiseLoyaltyId: loyaltyId,
        offerCode: '',
        brand: brandCode
      };
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Fetching offers from API...'
      }));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        credentials: 'omit',
        body: JSON.stringify(requestBody)
      });
      
      log('API response status: ' + response.status);
      
      if (response.status === 403) {
        throw new Error('Session expired (403). Please log in again.');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('API error: ' + response.status + ' - ' + errorText);
      }
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data.offers)) {
        throw new Error('Invalid API response format');
      }
      
      log('✅ API returned ' + data.offers.length + ' offers', 'success');
      
      const offersWithEmptySailings = data.offers.filter(o => 
        o?.campaignOffer?.offerCode && 
        Array.isArray(o.campaignOffer.sailings) && 
        (o.campaignOffer.sailings.length === 0 || (o.campaignOffer.sailings[0] && o.campaignOffer.sailings[0].itineraryCode === null))
      );
      
      if (offersWithEmptySailings.length > 0) {
        log('🔄 Refetching ' + offersWithEmptySailings.length + ' offers with empty/incomplete sailings...');
        
        for (const offer of offersWithEmptySailings) {
          const code = offer.campaignOffer.offerCode.trim();
          log('  Refetching offer: ' + code);
          
          try {
            const refetchBody = { ...requestBody, offerCode: code };
            const refetchResponse = await fetch(endpoint, {
              method: 'POST',
              headers: headers,
              credentials: 'omit',
              body: JSON.stringify(refetchBody)
            });
            
            if (refetchResponse.ok) {
              const refetchData = await refetchResponse.json();
              const refreshedOffer = refetchData.offers?.find(o => o?.campaignOffer?.offerCode === code);
              
              if (refreshedOffer?.campaignOffer?.sailings?.length > 0) {
                const originalIdx = data.offers.findIndex(o => o?.campaignOffer?.offerCode === code);
                if (originalIdx !== -1) {
                  const origSailings = data.offers[originalIdx].campaignOffer.sailings || [];
                  const newSailings = refreshedOffer.campaignOffer.sailings;
                  
                  const sailingMap = new Map();
                  origSailings.forEach(s => {
                    const key = (s.shipCode || '') + '|' + (s.sailDate || '');
                    if (key !== '|') sailingMap.set(key, s);
                  });
                  newSailings.forEach(s => {
                    const key = (s.shipCode || '') + '|' + (s.sailDate || '');
                    if (key !== '|') sailingMap.set(key, s);
                  });
                  
                  data.offers[originalIdx].campaignOffer.sailings = Array.from(sailingMap.values());
                  log('  ✓ Updated ' + code + ': now has ' + data.offers[originalIdx].campaignOffer.sailings.length + ' sailings', 'success');
                }
              }
            }
          } catch (refetchErr) {
            log('  ⚠️ Failed to refetch ' + code + ': ' + refetchErr.message, 'warning');
          }
          
          await wait(300);
        }
      }
      
      return data;
    } catch (error) {
      log('Casino Offers API fetch failed: ' + error.message, 'error');
      throw error;
    }
  }



  function processAPIResponse(data) {
    const allOfferRows = [];
    let totalSailings = 0;
    
    if (!data || !Array.isArray(data.offers)) {
      return { offerRows: allOfferRows, offerCount: 0, totalSailings: 0 };
    }
    
    const validOffers = data.offers.filter(o => o && o.campaignOffer);
    
    log('📊 Processing ' + validOffers.length + ' offers from API response...');
    
    for (let i = 0; i < validOffers.length; i++) {
      const offer = validOffers[i];
      const co = offer.campaignOffer;
      
      const offerName = co.name || '';
      const offerCode = co.offerCode || '';
      const offerExpiry = formatDate(co.reserveByDate);
      const tradeInValue = co.tradeInValue ? '$' + Number(co.tradeInValue).toFixed(2) : '';
      const perks = tradeInValue ? 'Trade-in value: ' + tradeInValue : '';
      
      log('━━━━━ Offer ' + (i + 1) + '/' + validOffers.length + ' ━━━━━');
      log('  Offer Name: ' + offerName);
      log('  Offer Code: ' + (offerCode || '[NOT FOUND]'), offerCode ? 'info' : 'warning');
      log('  Expiry Date: ' + (offerExpiry || '[NOT FOUND]'), offerExpiry ? 'info' : 'warning');
      if (tradeInValue) {
        log('  Trade-in Value: ' + tradeInValue);
      }
      
      const sailings = co.sailings || [];
      
      if (sailings.length === 0) {
        log('  ⚠️ No sailings available for this offer', 'warning');
        
        allOfferRows.push({
          sourcePage: 'Offers',
          offerName: offerName,
          offerCode: offerCode,
          offerExpirationDate: offerExpiry,
          offerType: 'Club Royale',
          shipName: '',
          sailingDate: '',
          itinerary: '',
          departurePort: '',
          cabinType: '',
          numberOfGuests: '2',
          perks: perks,
          loyaltyLevel: '',
          loyaltyPoints: '',
          interiorPrice: '',
          oceanviewPrice: '',
          balconyPrice: '',
          suitePrice: '',
          portList: ''
        });
        totalSailings++;
        
        sendOfferProgress(i + 1, validOffers.length, offerName, 0, 'complete');
        continue;
      }
      
      log('  📜 Processing ' + sailings.length + ' sailings...');
      
      let offerSailingCount = 0;
      
      for (const sailing of sailings) {
        const shipName = sailing.shipName || '';
        const sailDate = formatSailDate(sailing.sailDate);
        const departurePort = sailing.departurePort?.name || sailing.departurePortName || '';
        const itinerary = sailing.itineraryDescription || sailing.sailingType?.name || '';
        const cabinType = sailing.roomType || sailing.stateroomType || '';
        
        const isGOBO = sailing.isGOBO || co.isGOBO || false;
        const numberOfGuests = isGOBO ? '1' : '2';
        
        let interiorPrice = '';
        let oceanviewPrice = '';
        let balconyPrice = '';
        let suitePrice = '';
        
        if (sailing.pricing && Array.isArray(sailing.pricing)) {
          for (const priceInfo of sailing.pricing) {
            const type = (priceInfo.roomType || priceInfo.cabinType || '').toLowerCase();
            const price = priceInfo.price || priceInfo.amount || priceInfo.rate;
            const priceStr = price ? '
        
        totalSailings++;
        offerSailingCount++;
        
        if (totalSailings % BATCH_SIZE === 0) {
          const batchStart = totalSailings - BATCH_SIZE;
          const batch = allOfferRows.slice(batchStart, totalSailings);
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
        
        if (offerSailingCount % 100 === 0) {
          log('    ✓ Processed ' + offerSailingCount + '/' + sailings.length + ' sailings (' + totalSailings + ' total)');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: totalSailings,
            total: validOffers.length,
            stepName: 'Offer ' + (i + 1) + '/' + validOffers.length + ': ' + offerSailingCount + '/' + sailings.length + ' sailings'
          }));
        }
      }
      
      const remainingInBatch = totalSailings % BATCH_SIZE;
      if (remainingInBatch > 0 && offerSailingCount > 0) {
        const batchStart = totalSailings - remainingInBatch;
        const batch = allOfferRows.slice(batchStart, totalSailings);
        if (batch.length > 0) {
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
      }
      
      sendOfferProgress(i + 1, validOffers.length, offerName, offerSailingCount, 'complete');
      log('Offer ' + (i + 1) + '/' + validOffers.length + ' (' + offerName + '): ' + offerSailingCount + ' sailings - complete', 'success');
      log('  ✓ Offer complete: ' + offerSailingCount + ' sailings added', 'success');
    }
    
    return { offerRows: allOfferRows, offerCount: validOffers.length, totalSailings };
  }

  async function extractOffers() {
    try {
      log('Extracting Club Royale data...');
      
      await extractClubRoyaleStatus();
      
      log('Loading Club Royale Offers page...');
      await wait(2000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Authenticating and fetching all data...'
      }));
      
      const authContext = await getAuthContext();
      
      const offersData = await fetchOffersFromAPI(authContext);
      
      const { offerRows, offerCount, totalSailings } = processAPIResponse(offersData);
      
      sendOfferBatch([], true, totalSailings, offerCount);
      
      log('✓ Extracted ' + totalSailings + ' offer rows from ' + offerCount + ' offer(s)', 'success');
      
    } catch (error) {
      log('❌ API extraction failed: ' + error.message, 'error');
      log('Attempting fallback to DOM scraping...', 'warning');
      
      await fallbackDOMExtraction();
    }
  }

  async function fallbackDOMExtraction() {
    log('🔄 Starting DOM-based fallback extraction...', 'warning');
    
    const pageText = document.body.textContent || '';
    
    let expectedOfferCount = 0;
    const featuredMatch = pageText.match(/Featured\\s+Offers?\\s*\\((\\d+)\\)/i);
    const moreMatch = pageText.match(/More\\s+Offers?\\s*\\((\\d+)\\)/i);
    
    if (featuredMatch) expectedOfferCount += parseInt(featuredMatch[1], 10);
    if (moreMatch) expectedOfferCount += parseInt(moreMatch[1], 10);
    
    log('Expected offers from page: ' + expectedOfferCount);
    
    const viewSailingsButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      return text.includes('view sailing') || text.includes('see sailing');
    });
    
    if (viewSailingsButtons.length === 0) {
      log('No offers found on page', 'warning');
      sendOfferBatch([], true, 0, 0);
      return;
    }
    
    log('Found ' + viewSailingsButtons.length + ' View Sailings buttons');
    
    const basicOffer = {
      sourcePage: 'Offers',
      offerName: 'Unknown Offer',
      offerCode: '',
      offerExpirationDate: '',
      offerType: 'Club Royale',
      shipName: '',
      sailingDate: '',
      itinerary: '',
      departurePort: '',
      cabinType: '',
      numberOfGuests: '2',
      perks: '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      portList: ''
    };
    
    sendOfferBatch([basicOffer], false);
    sendOfferBatch([], true, 1, viewSailingsButtons.length);
    
    log('⚠️ DOM fallback completed with limited data. Please try again or check login status.', 'warning');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractOffers);
  } else {
    extractOffers();
  }
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
 + Number(price).toFixed(2) : '';
            
            if (type.includes('interior') || type.includes('inside')) {
              interiorPrice = priceStr;
            } else if (type.includes('oceanview') || type.includes('ocean view')) {
              oceanviewPrice = priceStr;
            } else if (type.includes('balcony')) {
              balconyPrice = priceStr;
            } else if (type.includes('suite')) {
              suitePrice = priceStr;
            }
          }
        } else if (sailing.stateroomPricing && Array.isArray(sailing.stateroomPricing)) {
          for (const priceInfo of sailing.stateroomPricing) {
            const type = (priceInfo.stateroomType || priceInfo.category || '').toLowerCase();
            const price = priceInfo.price || priceInfo.amount || priceInfo.rate;
            const priceStr = price ? '
        
        totalSailings++;
        offerSailingCount++;
        
        if (totalSailings % BATCH_SIZE === 0) {
          const batchStart = totalSailings - BATCH_SIZE;
          const batch = allOfferRows.slice(batchStart, totalSailings);
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
        
        if (offerSailingCount % 100 === 0) {
          log('    ✓ Processed ' + offerSailingCount + '/' + sailings.length + ' sailings (' + totalSailings + ' total)');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: totalSailings,
            total: validOffers.length,
            stepName: 'Offer ' + (i + 1) + '/' + validOffers.length + ': ' + offerSailingCount + '/' + sailings.length + ' sailings'
          }));
        }
      }
      
      const remainingInBatch = totalSailings % BATCH_SIZE;
      if (remainingInBatch > 0 && offerSailingCount > 0) {
        const batchStart = totalSailings - remainingInBatch;
        const batch = allOfferRows.slice(batchStart, totalSailings);
        if (batch.length > 0) {
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
      }
      
      sendOfferProgress(i + 1, validOffers.length, offerName, offerSailingCount, 'complete');
      log('Offer ' + (i + 1) + '/' + validOffers.length + ' (' + offerName + '): ' + offerSailingCount + ' sailings - complete', 'success');
      log('  ✓ Offer complete: ' + offerSailingCount + ' sailings added', 'success');
    }
    
    return { offerRows: allOfferRows, offerCount: validOffers.length, totalSailings };
  }

  async function extractOffers() {
    try {
      log('Extracting Club Royale data...');
      
      await extractClubRoyaleStatus();
      
      log('Loading Club Royale Offers page...');
      await wait(2000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Authenticating and fetching all data...'
      }));
      
      const authContext = await getAuthContext();
      
      const offersData = await fetchOffersFromAPI(authContext);
      
      const { offerRows, offerCount, totalSailings } = processAPIResponse(offersData);
      
      sendOfferBatch([], true, totalSailings, offerCount);
      
      log('✓ Extracted ' + totalSailings + ' offer rows from ' + offerCount + ' offer(s)', 'success');
      
    } catch (error) {
      log('❌ API extraction failed: ' + error.message, 'error');
      log('Attempting fallback to DOM scraping...', 'warning');
      
      await fallbackDOMExtraction();
    }
  }

  async function fallbackDOMExtraction() {
    log('🔄 Starting DOM-based fallback extraction...', 'warning');
    
    const pageText = document.body.textContent || '';
    
    let expectedOfferCount = 0;
    const featuredMatch = pageText.match(/Featured\\s+Offers?\\s*\\((\\d+)\\)/i);
    const moreMatch = pageText.match(/More\\s+Offers?\\s*\\((\\d+)\\)/i);
    
    if (featuredMatch) expectedOfferCount += parseInt(featuredMatch[1], 10);
    if (moreMatch) expectedOfferCount += parseInt(moreMatch[1], 10);
    
    log('Expected offers from page: ' + expectedOfferCount);
    
    const viewSailingsButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      return text.includes('view sailing') || text.includes('see sailing');
    });
    
    if (viewSailingsButtons.length === 0) {
      log('No offers found on page', 'warning');
      sendOfferBatch([], true, 0, 0);
      return;
    }
    
    log('Found ' + viewSailingsButtons.length + ' View Sailings buttons');
    
    const basicOffer = {
      sourcePage: 'Offers',
      offerName: 'Unknown Offer',
      offerCode: '',
      offerExpirationDate: '',
      offerType: 'Club Royale',
      shipName: '',
      sailingDate: '',
      itinerary: '',
      departurePort: '',
      cabinType: '',
      numberOfGuests: '2',
      perks: '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      portList: ''
    };
    
    sendOfferBatch([basicOffer], false);
    sendOfferBatch([], true, 1, viewSailingsButtons.length);
    
    log('⚠️ DOM fallback completed with limited data. Please try again or check login status.', 'warning');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractOffers);
  } else {
    extractOffers();
  }
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
 + Number(price).toFixed(2) : '';
            
            if (type.includes('interior') || type.includes('inside')) {
              interiorPrice = priceStr;
            } else if (type.includes('oceanview') || type.includes('ocean view')) {
              oceanviewPrice = priceStr;
            } else if (type.includes('balcony')) {
              balconyPrice = priceStr;
            } else if (type.includes('suite')) {
              suitePrice = priceStr;
            }
          }
        }
        
        let portList = '';
        if (sailing.ports && Array.isArray(sailing.ports)) {
          const portNames = sailing.ports
            .filter(p => p && p.name)
            .map(p => p.name)
            .filter((name, idx, arr) => arr.indexOf(name) === idx);
          portList = portNames.join(' → ');
        } else if (sailing.itinerary && Array.isArray(sailing.itinerary.ports)) {
          const portNames = sailing.itinerary.ports
            .filter(p => p && p.portName)
            .map(p => p.portName)
            .filter((name, idx, arr) => arr.indexOf(name) === idx);
          portList = portNames.join(' → ');
        }
        
        allOfferRows.push({
          sourcePage: 'Offers',
          offerName: offerName,
          offerCode: offerCode,
          offerExpirationDate: offerExpiry,
          offerType: 'Club Royale',
          shipName: shipName,
          sailingDate: sailDate,
          itinerary: itinerary,
          departurePort: departurePort,
          cabinType: cabinType,
          numberOfGuests: numberOfGuests,
          perks: perks,
          loyaltyLevel: '',
          loyaltyPoints: '',
          interiorPrice: interiorPrice,
          oceanviewPrice: oceanviewPrice,
          balconyPrice: balconyPrice,
          suitePrice: suitePrice,
          portList: portList
        });
        
        totalSailings++;
        offerSailingCount++;
        
        if (totalSailings % BATCH_SIZE === 0) {
          const batchStart = totalSailings - BATCH_SIZE;
          const batch = allOfferRows.slice(batchStart, totalSailings);
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
        
        if (offerSailingCount % 100 === 0) {
          log('    ✓ Processed ' + offerSailingCount + '/' + sailings.length + ' sailings (' + totalSailings + ' total)');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: totalSailings,
            total: validOffers.length,
            stepName: 'Offer ' + (i + 1) + '/' + validOffers.length + ': ' + offerSailingCount + '/' + sailings.length + ' sailings'
          }));
        }
      }
      
      const remainingInBatch = totalSailings % BATCH_SIZE;
      if (remainingInBatch > 0 && offerSailingCount > 0) {
        const batchStart = totalSailings - remainingInBatch;
        const batch = allOfferRows.slice(batchStart, totalSailings);
        if (batch.length > 0) {
          sendOfferBatch(batch, false);
          log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + totalSailings + ')');
        }
      }
      
      sendOfferProgress(i + 1, validOffers.length, offerName, offerSailingCount, 'complete');
      log('Offer ' + (i + 1) + '/' + validOffers.length + ' (' + offerName + '): ' + offerSailingCount + ' sailings - complete', 'success');
      log('  ✓ Offer complete: ' + offerSailingCount + ' sailings added', 'success');
    }
    
    return { offerRows: allOfferRows, offerCount: validOffers.length, totalSailings };
  }

  async function extractOffers() {
    try {
      log('Extracting Club Royale data...');
      
      await extractClubRoyaleStatus();
      
      log('Loading Club Royale Offers page...');
      await wait(2000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Authenticating and fetching all data...'
      }));
      
      const authContext = await getAuthContext();
      
      const offersData = await fetchOffersFromAPI(authContext);
      
      const { offerRows, offerCount, totalSailings } = processAPIResponse(offersData);
      
      sendOfferBatch([], true, totalSailings, offerCount);
      
      log('✓ Extracted ' + totalSailings + ' offer rows from ' + offerCount + ' offer(s)', 'success');
      
    } catch (error) {
      log('❌ API extraction failed: ' + error.message, 'error');
      log('Attempting fallback to DOM scraping...', 'warning');
      
      await fallbackDOMExtraction();
    }
  }

  async function fallbackDOMExtraction() {
    log('🔄 Starting DOM-based fallback extraction...', 'warning');
    
    const pageText = document.body.textContent || '';
    
    let expectedOfferCount = 0;
    const featuredMatch = pageText.match(/Featured\\s+Offers?\\s*\\((\\d+)\\)/i);
    const moreMatch = pageText.match(/More\\s+Offers?\\s*\\((\\d+)\\)/i);
    
    if (featuredMatch) expectedOfferCount += parseInt(featuredMatch[1], 10);
    if (moreMatch) expectedOfferCount += parseInt(moreMatch[1], 10);
    
    log('Expected offers from page: ' + expectedOfferCount);
    
    const viewSailingsButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      return text.includes('view sailing') || text.includes('see sailing');
    });
    
    if (viewSailingsButtons.length === 0) {
      log('No offers found on page', 'warning');
      sendOfferBatch([], true, 0, 0);
      return;
    }
    
    log('Found ' + viewSailingsButtons.length + ' View Sailings buttons');
    
    const basicOffer = {
      sourcePage: 'Offers',
      offerName: 'Unknown Offer',
      offerCode: '',
      offerExpirationDate: '',
      offerType: 'Club Royale',
      shipName: '',
      sailingDate: '',
      itinerary: '',
      departurePort: '',
      cabinType: '',
      numberOfGuests: '2',
      perks: '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      portList: ''
    };
    
    sendOfferBatch([basicOffer], false);
    sendOfferBatch([], true, 1, viewSailingsButtons.length);
    
    log('⚠️ DOM fallback completed with limited data. Please try again or check login status.', 'warning');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractOffers);
  } else {
    extractOffers();
  }
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
