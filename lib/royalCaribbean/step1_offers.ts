export const STEP1_OFFERS_SCRIPT = `
(function() {
  const BATCH_SIZE = 150;
  const PRICING_BATCH_SIZE = 10;
  
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

  function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.name || val.description || val.code || val.text || '';
    }
    return String(val);
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

  async function extractClubRoyaleStatus() {
    try {
      log('Extracting Club Royale status...');
      log('⚠️ Note: Loyalty data will be fetched via API in Step 4 for accuracy', 'info');
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

  async function fetchPricingAndItinerary(baseUrl, shipCode, minDate, maxDate, count) {
    const endpoint = baseUrl + '/graph';
    const query = 'query cruiseSearch_Cruises($filters:String,$qualifiers:String,$sort:CruiseSearchSort,$pagination:CruiseSearchPagination,$nlSearch:String){cruiseSearch(filters:$filters,qualifiers:$qualifiers,sort:$sort,pagination:$pagination,nlSearch:$nlSearch){results{cruises{id productViewLink masterSailing{itinerary{name code days{number type ports{activity arrivalTime departureTime port{code name region}}}departurePort{code name region}destination{code name}portSequence sailingNights ship{code name}totalNights type}}sailings{bookingLink id itinerary{code}sailDate startDate endDate taxesAndFees{value}taxesAndFeesIncluded stateroomClassPricing{price{value currency{code}}stateroomClass{id content{code}}}}}cruiseRecommendationId total}}}';
    
    const filtersValue = 'startDate:' + minDate + '~' + maxDate + '|ship:' + shipCode;
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'apollographql-client-name': 'rci-NextGen-Cruise-Search',
          'apollographql-query-name': 'cruiseSearch_Cruises',
          'skip_authentication': 'true'
        },
        body: JSON.stringify({
          query: query,
          variables: {
            filters: filtersValue,
            pagination: { count: count, skip: 0 }
          }
        })
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data?.data?.cruiseSearch?.results?.cruises || [];
    } catch (error) {
      return null;
    }
  }

  function extractPricingFromCruise(cruise, sailDate) {
    const result = {
      interiorPrice: '',
      oceanviewPrice: '',
      balconyPrice: '',
      suitePrice: '',
      taxesAndFees: '',
      dayByDayItinerary: [],
      destinationName: '',
      totalNights: null,
      bookingLink: '',
      portList: ''
    };
    
    try {
      const itin = cruise?.masterSailing?.itinerary || {};
      result.destinationName = itin?.destination?.name || '';
      result.totalNights = itin?.totalNights || itin?.sailingNights || null;
      
      if (Array.isArray(itin?.days)) {
        result.dayByDayItinerary = itin.days.map(day => ({
          day: day.number || 0,
          type: day.type || '',
          portName: day.ports?.[0]?.port?.name || '',
          portCode: day.ports?.[0]?.port?.code || '',
          arrivalTime: day.ports?.[0]?.arrivalTime || '',
          departureTime: day.ports?.[0]?.departureTime || ''
        }));
        
        const portNames = itin.days
          .filter(d => d.ports && d.ports.length > 0)
          .map(d => d.ports[0]?.port?.name)
          .filter(n => n);
        result.portList = [...new Set(portNames)].join(', ');
      }
      
      const sailings = cruise?.sailings || [];
      const targetDate = toISODate(sailDate);
      const matchingSailing = sailings.find(s => {
        const sSailDate = (s.sailDate || '').toString().trim().slice(0, 10);
        return sSailDate === targetDate;
      }) || sailings[0];
      
      if (matchingSailing) {
        result.bookingLink = matchingSailing.bookingLink || '';
        
        const taxVal = matchingSailing.taxesAndFees?.value;
        if (taxVal !== undefined && taxVal !== null) {
          const taxNum = Number(taxVal);
          if (!isNaN(taxNum)) {
            result.taxesAndFees = '$' + (taxNum * 2).toFixed(2);
          }
        }
        
        const categoryMap = {
          'I': 'interior', 'IN': 'interior', 'INT': 'interior', 'INSIDE': 'interior', 'INTERIOR': 'interior',
          'O': 'oceanview', 'OV': 'oceanview', 'OB': 'oceanview', 'E': 'oceanview', 'OCEAN': 'oceanview', 
          'OCEANVIEW': 'oceanview', 'OUTSIDE': 'oceanview',
          'B': 'balcony', 'BAL': 'balcony', 'BK': 'balcony', 'BALCONY': 'balcony',
          'D': 'suite', 'DLX': 'suite', 'DELUXE': 'suite', 'JS': 'suite', 'SU': 'suite', 'SUITE': 'suite'
        };
        
        const categoryPrices = { interior: null, oceanview: null, balcony: null, suite: null };
        
        if (Array.isArray(matchingSailing.stateroomClassPricing)) {
          for (const pricing of matchingSailing.stateroomClassPricing) {
            const code = (pricing?.stateroomClass?.content?.code || pricing?.stateroomClass?.id || '').toString().trim().toUpperCase();
            const priceVal = pricing?.price?.value;
            
            if (code && priceVal !== undefined && priceVal !== null) {
              const category = categoryMap[code];
              if (category) {
                const priceNum = Number(priceVal) * 2;
                if (!isNaN(priceNum) && (categoryPrices[category] === null || priceNum < categoryPrices[category])) {
                  categoryPrices[category] = priceNum;
                }
              }
            }
          }
        }
        
        if (categoryPrices.interior !== null) result.interiorPrice = '$' + categoryPrices.interior.toFixed(2);
        if (categoryPrices.oceanview !== null) result.oceanviewPrice = '$' + categoryPrices.oceanview.toFixed(2);
        if (categoryPrices.balcony !== null) result.balconyPrice = '$' + categoryPrices.balcony.toFixed(2);
        if (categoryPrices.suite !== null) result.suitePrice = '$' + categoryPrices.suite.toFixed(2);
      }
    } catch (e) {
    }
    
    return result;
  }

  async function fetchOffersFromAPI(authContext) {
    try {
      log('🔌 Using API-based offer extraction (more reliable)...');
      
      const { headers, loyaltyId, brandCode, baseUrl } = authContext;
      
      const endpoint = baseUrl + (brandCode === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
      
      log('📡 Calling ' + (brandCode === 'C' ? 'Celebrity' : 'Royal Caribbean') + ' Casino Offers API...');
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

  async function enrichWithPricingData(allOfferRows, baseUrl) {
    if (!SCRAPE_PRICING_AND_ITINERARY || allOfferRows.length === 0) {
      return allOfferRows;
    }
    
    log('💰 Fetching stateroom pricing, taxes & day-by-day itinerary...', 'info');
    
    const shipDateMap = new Map();
    allOfferRows.forEach((row, idx) => {
      if (row.shipCode && row.sailingDate) {
        const sailDateISO = toISODate(row.sailingDate);
        if (sailDateISO) {
          const key = row.shipCode + '|' + sailDateISO;
          if (!shipDateMap.has(key)) {
            shipDateMap.set(key, { shipCode: row.shipCode, sailDate: sailDateISO, indices: [] });
          }
          shipDateMap.get(key).indices.push(idx);
        }
      }
    });
    
    const uniqueSailings = Array.from(shipDateMap.values());
    log('📊 Found ' + uniqueSailings.length + ' unique ship/date combinations to enrich', 'info');
    
    if (uniqueSailings.length === 0) {
      return allOfferRows;
    }
    
    const shipGroups = {};
    uniqueSailings.forEach(s => {
      if (!shipGroups[s.shipCode]) {
        shipGroups[s.shipCode] = { shipCode: s.shipCode, sailings: [], minDate: null, maxDate: null };
      }
      const group = shipGroups[s.shipCode];
      group.sailings.push(s);
      if (!group.minDate || s.sailDate < group.minDate) group.minDate = s.sailDate;
      if (!group.maxDate || s.sailDate > group.maxDate) group.maxDate = s.sailDate;
    });
    
    const groups = Object.values(shipGroups);
    let processedCount = 0;
    const totalCount = uniqueSailings.length;
    
    for (const group of groups) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: totalCount,
          stepName: 'Fetching pricing for ' + group.shipCode + '...'
        }));
        
        const cruises = await fetchPricingAndItinerary(
          baseUrl, 
          group.shipCode, 
          group.minDate, 
          group.maxDate, 
          group.sailings.length * 3
        );
        
        if (cruises && cruises.length > 0) {
          const cruiseByDate = {};
          cruises.forEach(cruise => {
            const sailings = cruise?.sailings || [];
            sailings.forEach(s => {
              const sDate = (s.sailDate || '').toString().trim().slice(0, 10);
              if (sDate) {
                cruiseByDate[sDate] = cruise;
              }
            });
          });
          
          for (const sailing of group.sailings) {
            const cruise = cruiseByDate[sailing.sailDate];
            if (cruise) {
              const pricingData = extractPricingFromCruise(cruise, sailing.sailDate);
              
              for (const idx of sailing.indices) {
                const row = allOfferRows[idx];
                if (!row.interiorPrice && pricingData.interiorPrice) row.interiorPrice = pricingData.interiorPrice;
                if (!row.oceanviewPrice && pricingData.oceanviewPrice) row.oceanviewPrice = pricingData.oceanviewPrice;
                if (!row.balconyPrice && pricingData.balconyPrice) row.balconyPrice = pricingData.balconyPrice;
                if (!row.suitePrice && pricingData.suitePrice) row.suitePrice = pricingData.suitePrice;
                if (!row.taxesAndFees && pricingData.taxesAndFees) row.taxesAndFees = pricingData.taxesAndFees;
                if (!row.portList && pricingData.portList) row.portList = pricingData.portList;
                if (!row.destinationName && pricingData.destinationName) row.destinationName = pricingData.destinationName;
                if (!row.totalNights && pricingData.totalNights) row.totalNights = pricingData.totalNights;
                if (!row.bookingLink && pricingData.bookingLink) row.bookingLink = pricingData.bookingLink;
                if (pricingData.dayByDayItinerary && pricingData.dayByDayItinerary.length > 0) {
                  row.dayByDayItinerary = pricingData.dayByDayItinerary;
                }
              }
              
              processedCount += sailing.indices.length;
            } else {
              processedCount += sailing.indices.length;
            }
          }
          
          log('  ✓ Enriched ' + group.sailings.length + ' sailing(s) for ship ' + group.shipCode, 'success');
        } else {
          processedCount += group.sailings.reduce((sum, s) => sum + s.indices.length, 0);
          log('  ⚠️ No pricing data found for ship ' + group.shipCode, 'warning');
        }
        
        await wait(200);
      } catch (err) {
        processedCount += group.sailings.reduce((sum, s) => sum + s.indices.length, 0);
        log('  ⚠️ Error fetching pricing for ' + group.shipCode + ': ' + err.message, 'warning');
      }
    }
    
    const enrichedCount = allOfferRows.filter(r => r.interiorPrice || r.oceanviewPrice || r.balconyPrice || r.suitePrice).length;
    log('✅ Pricing enrichment complete: ' + enrichedCount + '/' + allOfferRows.length + ' sailings have pricing data', 'success');
    
    return allOfferRows;
  }

  function processAPIResponse(data, scrapePricing) {
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
          taxesAndFees: '',
          portList: '',
          dayByDayItinerary: [],
          destinationName: '',
          totalNights: null,
          bookingLink: ''
        });
        totalSailings++;
        
        sendOfferProgress(i + 1, validOffers.length, offerName, 0, 'complete');
        continue;
      }
      
      log('  📜 Processing ' + sailings.length + ' sailings...');
      
      let offerSailingCount = 0;
      
      for (const sailing of sailings) {
        const shipName = sailing.shipName || '';
        const shipCode = sailing.shipCode || '';
        const sailDate = formatSailDate(sailing.sailDate);
        const departurePort = safeStr(sailing.departurePort?.name || sailing.departurePortName || sailing.departurePort || '');
        const itinerary = safeStr(sailing.itineraryDescription || sailing.sailingType?.name || sailing.sailingType || '');
        const cabinType = safeStr(sailing.roomType || sailing.stateroomType || '');
        
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
          taxesAndFees: '',
          portList: portList,
          dayByDayItinerary: [],
          destinationName: '',
          totalNights: null,
          bookingLink: ''
        });
        
        totalSailings++;
        offerSailingCount++;
        
        if (totalSailings % BATCH_SIZE === 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: totalSailings,
            total: validOffers.length,
            stepName: 'Processing offers...'
          }));
        }
        
        if (offerSailingCount % 100 === 0) {
          log('    ✓ Processed ' + offerSailingCount + '/' + sailings.length + ' sailings (' + totalSailings + ' total)');
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
      
      let { offerRows, offerCount, totalSailings } = processAPIResponse(offersData, SCRAPE_PRICING_AND_ITINERARY);
      
      if (SCRAPE_PRICING_AND_ITINERARY && offerRows.length > 0) {
        log('🔄 Starting pricing and itinerary enrichment...', 'info');
        offerRows = await enrichWithPricingData(offerRows, authContext.baseUrl);
      }
      
      const batchSize = BATCH_SIZE;
      for (let i = 0; i < offerRows.length; i += batchSize) {
        const batch = offerRows.slice(i, i + batchSize);
        sendOfferBatch(batch, false);
        log('📤 Sent batch of ' + batch.length + ' sailings (total: ' + Math.min(i + batchSize, offerRows.length) + '/' + offerRows.length + ')');
      }
      
      sendOfferBatch([], true, offerRows.length, offerCount);
      
      log('✓ Extracted ' + offerRows.length + ' offer rows from ' + offerCount + ' offer(s)', 'success');
      
      if (SCRAPE_PRICING_AND_ITINERARY) {
        const withPricing = offerRows.filter(r => r.interiorPrice || r.oceanviewPrice || r.balconyPrice || r.suitePrice).length;
        const withItinerary = offerRows.filter(r => r.dayByDayItinerary && r.dayByDayItinerary.length > 0).length;
        const withTaxes = offerRows.filter(r => r.taxesAndFees).length;
        log('📊 Enrichment summary: ' + withPricing + ' with pricing, ' + withItinerary + ' with day-by-day itinerary, ' + withTaxes + ' with taxes/fees', 'success');
      }
      
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
      shipCode: '',
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
      taxesAndFees: '',
      portList: '',
      dayByDayItinerary: [],
      destinationName: '',
      totalNights: null,
      bookingLink: ''
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
