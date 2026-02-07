const BATCH_SIZE = 150;

function log(message, type = 'info') {
  console.log(`[RC Sync] ${message}`);
  chrome.runtime.sendMessage({
    type: 'LOG',
    message: message,
    logType: type
  });
}

function sendProgress(current, total, stepName) {
  chrome.runtime.sendMessage({
    type: 'PROGRESS',
    current: current,
    total: total,
    stepName: stepName
  });
}

function sendOfferBatch(offers) {
  chrome.runtime.sendMessage({
    type: 'OFFERS_BATCH',
    data: offers
  });
}

function sendComplete() {
  chrome.runtime.sendMessage({
    type: 'EXTRACTION_COMPLETE'
  });
}

function sendError(error) {
  chrome.runtime.sendMessage({
    type: 'EXTRACTION_ERROR',
    error: error
  });
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

function toISODate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
}

async function getAuthContext() {
  try {
    log('Parsing session data from localStorage...');
    const sessionData = localStorage.getItem('persist:session');
    
    if (!sessionData) {
      throw new Error('No session data found. Please log in to Royal Caribbean first.');
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
    log('🔌 Fetching offers from API...');
    
    const { headers, loyaltyId, brandCode, baseUrl } = authContext;
    
    const endpoint = baseUrl + (brandCode === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
    
    log('📡 Calling ' + (brandCode === 'C' ? 'Celebrity' : 'Royal Caribbean') + ' Casino Offers API...');
    
    const requestBody = {
      cruiseLoyaltyId: loyaltyId,
      offerCode: '',
      brand: brandCode
    };
    
    sendProgress(0, 100, 'Fetching offers from API...');
    
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
      log('🔄 Refetching ' + offersWithEmptySailings.length + ' offers with empty sailings...');
      
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
        
        await new Promise(resolve => setTimeout(resolve, 300));
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
    log('  Offer Code: ' + (offerCode || '[NOT FOUND]'));
    
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
        shipCode: '',
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
      continue;
    }
    
    log('  📜 Processing ' + sailings.length + ' sailings...');
    
    let offerSailingCount = 0;
    
    for (const sailing of sailings) {
      const shipName = sailing.shipName || '';
      const shipCode = sailing.shipCode || '';
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
          const priceStr = price ? '$' + Number(price).toFixed(2) : '';
          
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
      
      const ports = sailing.ports || sailing.itinerary?.ports || [];
      const portList = Array.isArray(ports) ? ports.map(p => p.name || p.portName || '').filter(n => n).join(', ') : '';
      
      allOfferRows.push({
        sourcePage: 'Offers',
        offerName: offerName,
        offerCode: offerCode,
        offerExpirationDate: offerExpiry,
        offerType: 'Club Royale',
        shipName: shipName,
        shipCode: shipCode,
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
        sendProgress(totalSailings, validOffers.length, 'Processing offers...');
      }
    }
    
    log('Offer ' + (i + 1) + '/' + validOffers.length + ' (' + offerName + '): ' + offerSailingCount + ' sailings - complete', 'success');
  }
  
  return { offerRows: allOfferRows, offerCount: validOffers.length, totalSailings };
}

async function extractOffers() {
  try {
    log('🚀 Starting Royal Caribbean sync...', 'info');
    
    const authContext = await getAuthContext();
    
    const offersData = await fetchOffersFromAPI(authContext);
    
    let { offerRows, offerCount, totalSailings } = processAPIResponse(offersData);
    
    log('📤 Sending extracted data...', 'info');
    
    const batchSize = BATCH_SIZE;
    for (let i = 0; i < offerRows.length; i += batchSize) {
      const batch = offerRows.slice(i, i + batchSize);
      sendOfferBatch(batch);
      log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + Math.min(i + batchSize, offerRows.length) + '/' + offerRows.length + ')');
    }
    
    log('✅ Extraction complete! Extracted ' + offerRows.length + ' offer rows from ' + offerCount + ' offer(s)', 'success');
    log('📥 Downloading CSV file...', 'info');
    
    sendComplete();
    
  } catch (error) {
    log('❌ Extraction failed: ' + error.message, 'error');
    sendError(error.message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BEGIN_EXTRACTION') {
    extractOffers();
  }
});

log('Royal Caribbean Sync content script loaded', 'info');
