const SHIP_CODE_MAP: Record<string, string> = {
  'AL': 'Allure of the Seas',
  'AN': 'Anthem of the Seas',
  'AD': 'Adventure of the Seas',
  'BR': 'Brilliance of the Seas',
  'EN': 'Enchantment of the Seas',
  'EX': 'Explorer of the Seas',
  'FR': 'Freedom of the Seas',
  'GR': 'Grandeur of the Seas',
  'HM': 'Harmony of the Seas',
  'IC': 'Icon of the Seas',
  'ID': 'Independence of the Seas',
  'JW': 'Jewel of the Seas',
  'LB': 'Liberty of the Seas',
  'LE': 'Legend of the Seas',
  'MJ': 'Majesty of the Seas',
  'MR': 'Mariner of the Seas',
  'NV': 'Navigator of the Seas',
  'OA': 'Oasis of the Seas',
  'OV': 'Ovation of the Seas',
  'OY': 'Odyssey of the Seas',
  'QN': 'Quantum of the Seas',
  'RD': 'Radiance of the Seas',
  'RH': 'Rhapsody of the Seas',
  'SE': 'Serenade of the Seas',
  'SP': 'Spectrum of the Seas',
  'SY': 'Symphony of the Seas',
  'UT': 'Utopia of the Seas',
  'VI': 'Vision of the Seas',
  'VY': 'Voyager of the Seas',
  'WN': 'Wonder of the Seas',
};

export const STEP3_HOLDS_SCRIPT = `
(function() {
  const SHIP_CODE_MAP = ${JSON.stringify(SHIP_CODE_MAP)};

  // Complete list of Royal Caribbean ship names for exact matching
  const KNOWN_SHIPS = [
    'Adventure of the Seas', 'Allure of the Seas', 'Anthem of the Seas',
    'Brilliance of the Seas', 'Enchantment of the Seas', 'Explorer of the Seas',
    'Freedom of the Seas', 'Grandeur of the Seas', 'Harmony of the Seas',
    'Icon of the Seas', 'Independence of the Seas', 'Jewel of the Seas',
    'Legend of the Seas', 'Liberty of the Seas', 'Majesty of the Seas',
    'Mariner of the Seas', 'Navigator of the Seas', 'Oasis of the Seas',
    'Odyssey of the Seas', 'Ovation of the Seas', 'Quantum of the Seas',
    'Radiance of the Seas', 'Rhapsody of the Seas', 'Serenade of the Seas',
    'Spectrum of the Seas', 'Star of the Seas', 'Symphony of the Seas',
    'Utopia of the Seas', 'Vision of the Seas', 'Voyager of the Seas',
    'Wonder of the Seas'
  ];

  function log(message, type) {
    type = type || 'info';
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: message,
        logType: type
      }));
    } catch (e) {
      console.log('[Step3]', message);
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return '';
    var year = dateStr.substring(0, 4);
    var month = dateStr.substring(4, 6);
    var day = dateStr.substring(6, 8);
    var date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[date.getMonth()] + ' ' + date.getDate() + ', ' + year;
  }

  function calculateEndDate(startDateStr, nights) {
    if (!startDateStr || startDateStr.length !== 8) return '';
    var year = parseInt(startDateStr.substring(0, 4));
    var month = parseInt(startDateStr.substring(4, 6)) - 1;
    var day = parseInt(startDateStr.substring(6, 8));
    var startDate = new Date(year, month, day);
    startDate.setDate(startDate.getDate() + nights);
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[startDate.getMonth()] + ' ' + startDate.getDate() + ', ' + startDate.getFullYear();
  }

  // Normalize text by adding spaces around newlines and cleaning up concatenated words
  function normalizeText(text) {
    return text
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      // Add space before uppercase letters that follow lowercase (fixes "ensenadaQuantum" -> "ensenada Quantum")
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Collapse multiple spaces
      .replace(/\\s+/g, ' ')
      .trim();
  }

  // Extract ship name using exact matching against known ships
  function extractShipName(text) {
    var normalizedText = normalizeText(text);
    
    // First, try exact match against known ships (case-insensitive)
    for (var i = 0; i < KNOWN_SHIPS.length; i++) {
      var ship = KNOWN_SHIPS[i];
      var shipRegex = new RegExp('\\\\b' + ship.replace(/\\s+/g, '\\\\s+') + '\\\\b', 'i');
      if (shipRegex.test(normalizedText)) {
        log('   ✓ Ship matched exactly: ' + ship, 'info');
        return ship;
      }
    }
    
    // Fallback: try to extract "X of the Seas" pattern with strict word boundary
    var shipMatch = normalizedText.match(/\\b([A-Z][a-z]+)\\s+of\\s+the\\s+Seas\\b/i);
    if (shipMatch) {
      var extractedShip = shipMatch[1] + ' of the Seas';
      // Capitalize first letter
      extractedShip = extractedShip.charAt(0).toUpperCase() + extractedShip.slice(1);
      log('   ✓ Ship extracted via pattern: ' + extractedShip, 'info');
      return extractedShip;
    }
    
    return '';
  }

  async function scrollUntilComplete(maxAttempts) {
    maxAttempts = maxAttempts || 15;
    var previousHeight = 0;
    var stableCount = 0;
    var attempts = 0;

    while (stableCount < 3 && attempts < maxAttempts) {
      var currentHeight = document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      window.scrollBy(0, 500);
      await wait(800);
      attempts++;
    }
  }

  function parseDate(dateStr, year) {
    var match = dateStr.match(/(\\w+)\\s+(\\d+)/);
    if (!match) return dateStr;
    var month = match[1];
    var day = match[2];
    return month + ' ' + day + ', ' + year;
  }

  function getAuthHeaders() {
    try {
      var sessionData = localStorage.getItem('persist:session');
      if (!sessionData) {
        log('⚠️ No session data found in localStorage', 'warning');
        return null;
      }
      
      var parsedData = JSON.parse(sessionData);
      var authToken = parsedData.token ? JSON.parse(parsedData.token) : null;
      var user = parsedData.user ? JSON.parse(parsedData.user) : null;
      var accountId = user && user.accountId ? user.accountId : null;
      
      if (!authToken || !accountId) {
        log('⚠️ Missing auth token or account ID', 'warning');
        return null;
      }
      
      var rawAuth = authToken && authToken.toString ? authToken.toString() : '';
      var networkAuth = rawAuth ? (rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth) : '';
      
      return {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'account-id': accountId,
        'authorization': networkAuth,
        'content-type': 'application/json'
      };
    } catch (e) {
      log('⚠️ Failed to get auth headers: ' + e.message, 'warning');
      return null;
    }
  }

  // Removed manual API calls - network monitor captures the page's natural API calls
  // Courtesy holds are already captured in Step 2 as bookings with status='OF'
  // This step just waits for the page to load and does DOM scraping as fallback
          var itinerary = '';
          if (enrichment.itinerary && enrichment.itinerary.portInfo) {
            var ports = [];
            var seenPorts = {};
            for (var p = 0; p < enrichment.itinerary.portInfo.length; p++) {
              var port = enrichment.itinerary.portInfo[p];
              if (port.title && port.portType !== 'CRUISING' && port.portType !== 'SEA') {
                if (!seenPorts[port.title]) {
                  ports.push(port.title);
                  seenPorts[port.title] = true;
                }
              }
            }
            itinerary = ports.join(' → ');
          }
          
          var hold = {
            sourcePage: 'Courtesy',
            shipName: shipName,
            shipCode: shipCode,
            cruiseTitle: cruiseTitle,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? sailingStartDate + ' - ' + sailingEndDate : '',
            itinerary: itinerary,
            departurePort: departurePort,
            cabinType: '',
            cabinNumberOrGTY: 'Hold',
            bookingId: booking.bookingId || '',
            numberOfNights: nights,
            status: 'Courtesy Hold',
            holdExpiration: holdExpiration,
            loyaltyLevel: '',
            loyaltyPoints: '',
            musterStation: booking.musterStation || '',
            bookingStatus: booking.bookingStatus || '',
            packageCode: packageCode,
            stateroomNumber: booking.stateroomNumber || '',
            stateroomCategoryCode: booking.stateroomCategoryCode || '',
            stateroomType: booking.stateroomType || ''
          };
          
          parsedHolds.push(hold);
          log('  ✓ API Hold: ' + shipName + ' - ' + sailingStartDate + ' - Booking: ' + booking.bookingId + ' - Expires: ' + (holdExpiration || 'N/A'), 'success');
        }
        
        return parsedHolds;
      }
      
      log('⚠️ No profileBookings in response', 'warning');
      return null;
      
    } catch (error) {
      log('❌ API fetch failed: ' + error.message, 'error');
      return null;
    }
  }

  async function fetchEnrichmentData(bookings) {
    if (!bookings || bookings.length === 0) {
      return {};
    }

    log('🔄 Fetching enrichment data for ' + bookings.length + ' holds...', 'info');

    var headers = getAuthHeaders();
    if (!headers) {
      log('⚠️ Could not obtain auth headers for enrichment', 'warning');
      return {};
    }

    try {
      var sailingKeys = [];
      for (var i = 0; i < bookings.length; i++) {
        var b = bookings[i];
        if (b.shipCode && b.sailDate) {
          sailingKeys.push({ shipCode: b.shipCode, sailDate: b.sailDate });
        }
      }

      if (sailingKeys.length === 0) {
        return {};
      }

      var host = location && location.hostname ? location.hostname : '';
      var brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
      var baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
      var endpoint = baseUrl + '/api/profile/bookings/enrichment';

      var response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        headers: headers,
        body: JSON.stringify({ sailings: sailingKeys })
      });

      if (!response.ok) {
        log('⚠️ Enrichment API returned: ' + response.status, 'warning');
        return {};
      }

      var text = await response.text();
      var data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        return {};
      }
      
      if (data && data.payload && data.payload.sailingInfo) {
        var enrichmentMap = {};
        var sailingInfo = data.payload.sailingInfo;
        
        for (var j = 0; j < sailingInfo.length; j++) {
          var info = sailingInfo[j];
          var key = info.shipCode + '_' + info.sailDate;
          enrichmentMap[key] = info;
        }
        
        log('✅ Enrichment returned ' + sailingInfo.length + ' sailing details', 'success');
        return enrichmentMap;
      }
      
      return {};
      
    } catch (error) {
      log('⚠️ Enrichment fetch failed: ' + error.message, 'warning');
      return {};
    }
  }

  async function extractViaDOM() {
    log('📄 Falling back to DOM scraping for courtesy holds...', 'info');

    await wait(3000);
    await scrollUntilComplete(15);

    log('Analyzing courtesy holds...', 'info');

    var countText = document.body.textContent || '';
    var countMatch = countText.match(/You have (\\d+) courtesy hold/i);
    var expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

    log('Expected holds: ' + expectedCount, 'info');

    if (expectedCount === 0) {
      return [];
    }

    var allElements = Array.from(document.querySelectorAll('div, article, section, [class*="card"], [class*="hold"], [class*="courtesy"]'));
    
    log('📊 Scanning ' + allElements.length + ' elements for hold cards...', 'info');

    var holdCards = allElements.filter(function(el) {
      var text = el.textContent || '';
      var hasShip = text.indexOf('of the Seas') >= 0;
      var hasNight = text.match(/\\d+\\s+Night/i);
      var hasReservation = text.match(/Reservation[:\\s]*\\d+/i);
      var hasExpires = text.match(/Expires[:\\s]*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/i) || text.indexOf('Expires') >= 0 || text.indexOf('EXPIRES') >= 0;
      var hasCourtesy = text.indexOf('Courtesy') >= 0 || text.indexOf('Hold') >= 0 || text.indexOf('COURTESY') >= 0 || text.indexOf('HOLD') >= 0;
      var isReasonablySmall = text.length > 50 && text.length < 4000;
      
      var passes = hasShip && hasNight && hasReservation && (hasExpires || hasCourtesy) && isReasonablySmall;
      
      if (!passes && hasShip && hasReservation) {
        log('  🔍 Filtered element (ship=' + hasShip + ', night=' + hasNight + ', res=' + hasReservation + ', expires=' + hasExpires + ', courtesy=' + hasCourtesy + ', size=' + text.length + ')', 'info');
      }
      
      return passes;
    }).filter(function(el, idx, arr) {
      for (var i = 0; i < arr.length; i++) {
        if (i !== idx && arr[i].contains(el)) {
          return false;
        }
      }
      return true;
    }).sort(function(a, b) {
      return a.textContent.length - b.textContent.length;
    });
    
    log('📊 HOLD COUNT: Found ' + holdCards.length + ' / Expected ' + expectedCount, holdCards.length === expectedCount ? 'success' : 'warning');
    
    var holds = [];
    var processedCount = 0;

    for (var i = 0; i < holdCards.length; i++) {
      var card = holdCards[i];
      var rawText = card.textContent || '';
      var fullText = normalizeText(rawText);

      log('━━━━━ Hold ' + (i + 1) + '/' + holdCards.length + ' ━━━━━', 'info');

      // Extract cruise title (e.g., "7 Night cabo overnight & ensenada")
      var cruiseTitleMatch = fullText.match(/(\\d+)\\s+[Nn]ight\\s+([^\\n]+?)(?=\\s+[A-Z][a-z]+\\s+of\\s+the\\s+Seas|Reservation|$)/i);
      var cruiseTitle = cruiseTitleMatch ? cruiseTitleMatch[0].trim() : '';
      
      if (!cruiseTitle) {
        var alternateMatch = fullText.match(/(\\d+)\\s+[Nn]ight\\s+[\\w\\s&]+/i);
        if (alternateMatch) {
          cruiseTitle = alternateMatch[0].trim();
        }
      }
      
      // Clean up cruise title - remove ship name if accidentally included
      if (cruiseTitle) {
        for (var s = 0; s < KNOWN_SHIPS.length; s++) {
          var shipNameInTitle = KNOWN_SHIPS[s];
          if (cruiseTitle.indexOf(shipNameInTitle) >= 0) {
            cruiseTitle = cruiseTitle.replace(shipNameInTitle, '').trim();
          }
        }
      }
      
      log('  Title: ' + (cruiseTitle || '[NOT FOUND]'), cruiseTitle ? 'info' : 'warning');

      // Extract ship name using the robust extraction function
      var shipName = extractShipName(rawText);
      log('  Ship: ' + (shipName || '[NOT FOUND]'), shipName ? 'info' : 'warning');

      var dateMatch = fullText.match(/(\\w{3})\\s+(\\d+)\\s*—\\s*(\\w{3})\\s+(\\d+),?\\s*(\\d{4})/);
      var sailingStartDate = '';
      var sailingEndDate = '';
      var year = '';
      
      if (dateMatch) {
        year = dateMatch[5];
        sailingStartDate = parseDate(dateMatch[1] + ' ' + dateMatch[2], year);
        sailingEndDate = dateMatch[3] + ' ' + dateMatch[4] + ', ' + year;
      }
      log('  Start Date: ' + (sailingStartDate || '[NOT FOUND]'), sailingStartDate ? 'info' : 'warning');
      log('  End Date: ' + (sailingEndDate || '[NOT FOUND]'), sailingEndDate ? 'info' : 'warning');

      var reservationMatch = fullText.match(/Reservation[:\\s]*(\\d+)/i);
      var bookingId = reservationMatch ? reservationMatch[1] : '';
      log('  Reservation: ' + (bookingId || '[NOT FOUND]'), bookingId ? 'info' : 'warning');

      var expiresMatch = fullText.match(/Expires[:\\s]*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/i);
      var holdExpiration = expiresMatch ? expiresMatch[1] : '';
      log('  Expiration: ' + (holdExpiration || '[NOT FOUND]'), holdExpiration ? 'info' : 'warning');

      // Extract number of nights
      var nightsMatch = cruiseTitle.match(/(\\d+)\\s+[Nn]ight/);
      var numberOfNights = nightsMatch ? parseInt(nightsMatch[1], 10) : 0;

      if (shipName && cruiseTitle && bookingId) {
        var hold = {
          sourcePage: 'Courtesy',
          shipName: shipName,
          cruiseTitle: cruiseTitle,
          sailingStartDate: sailingStartDate,
          sailingEndDate: sailingEndDate,
          sailingDates: sailingStartDate && sailingEndDate ? sailingStartDate + ' - ' + sailingEndDate : '',
          itinerary: '',
          departurePort: '',
          cabinType: '',
          cabinNumberOrGTY: 'Hold',
          bookingId: bookingId,
          numberOfNights: numberOfNights,
          status: 'Courtesy Hold',
          holdExpiration: holdExpiration,
          loyaltyLevel: '',
          loyaltyPoints: ''
        };
        
        holds.push(hold);
        processedCount++;
        
        log('  ✓ Hold scraped successfully (' + processedCount + '/' + expectedCount + ')', 'success');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: holdCards.length,
          stepName: 'Holds: ' + processedCount + ' of ' + expectedCount + ' scraped'
        }));

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'cruise_batch',
          data: [hold]
        }));
      } else {
        log('  ❌ SKIPPED - Missing fields: ship=' + !!shipName + ', title=' + !!cruiseTitle + ', booking=' + !!bookingId, 'error');
        log('  📝 Normalized text preview: ' + fullText.substring(0, 300) + '...', 'info');
      }
    }

    return holds;
  }

  async function extractCourtesyHolds() {
    try {
      log('🚀 ====== STEP 3: COURTESY HOLDS ======', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Checking for courtesy holds...'
      }));

      await wait(2000);

      // FIRST: Check if we have captured payloads from network monitor
      if (window.capturedPayloads && window.capturedPayloads.courtesyHolds) {
        log('✅ Found captured courtesy holds payload from network monitor!', 'success');
        var capturedData = window.capturedPayloads.courtesyHolds;
        log('📦 Captured data keys: ' + Object.keys(capturedData).join(', '), 'info');
        
        // Extract courtesy holds from captured payload
        var holdsFromCapture = null;
        if (capturedData.payload && capturedData.payload.sailingInfo) {
          holdsFromCapture = capturedData.payload.sailingInfo;
          log('✅ Found ' + holdsFromCapture.length + ' holds in payload.sailingInfo', 'success');
        } else if (capturedData.sailingInfo) {
          holdsFromCapture = capturedData.sailingInfo;
          log('✅ Found ' + holdsFromCapture.length + ' holds in sailingInfo', 'success');
        }
        
        if (holdsFromCapture && holdsFromCapture.length > 0) {
          log('✅ Using ' + holdsFromCapture.length + ' holds from captured payload', 'success');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step_complete',
            step: 3,
            totalCount: holdsFromCapture.length
          }));
          
          log('✅ Step 3 Complete: Extracted ' + holdsFromCapture.length + ' courtesy holds', 'success');
          return;
        } else {
          log('ℹ️ Captured payload shows 0 courtesy holds', 'info');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step_complete',
            step: 3,
            totalCount: 0
          }));
          
          log('✅ Step 3 Complete: No courtesy holds found', 'info');
          return;
        }
      } else {
        log('📝 No captured courtesy holds payload, trying fallback methods...', 'info');
      }

      // Try API extraction first (more reliable, gets enrichment data)
      var apiHolds = null;
      
      var holds = [];
      
      if (apiHolds && apiHolds.length > 0) {
        log('✅ API method extracted ' + apiHolds.length + ' courtesy holds with details', 'success');
        holds = apiHolds;
        
        // Send holds to app
        for (var i = 0; i < holds.length; i++) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'cruise_batch',
            data: [holds[i]]
          }));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: 50 + Math.floor((i / holds.length) * 50),
            total: 100,
            stepName: 'Processing hold ' + (i + 1) + '/' + holds.length
          }));
        }
      } else if (apiHolds && apiHolds.length === 0) {
        log('ℹ️ API returned no courtesy holds', 'info');
        // Still check DOM in case API missed something
        holds = await extractViaDOM();
      } else {
        log('⚠️ API method failed - falling back to DOM scraping', 'warning');
        holds = await extractViaDOM();
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 3,
        data: holds,
        totalCount: holds.length
      }));

      var statusType = holds.length > 0 ? 'success' : 'info';
      log('✅ Step 3 Complete: Extracted ' + holds.length + ' courtesy holds', statusType);

    } catch (error) {
      log('❌ CRITICAL ERROR in Step 3: ' + error.message, 'error');
      
      // Still send step_complete even on error so the sync continues
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 3,
        data: [],
        totalCount: 0
      }));
      
      log('⚠️ Step 3 completed with errors - sync will continue', 'warning');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractCourtesyHolds);
  } else {
    extractCourtesyHolds();
  }
})();
`;

export function injectCourtesyHoldsExtraction() {
  return STEP3_HOLDS_SCRIPT;
}
