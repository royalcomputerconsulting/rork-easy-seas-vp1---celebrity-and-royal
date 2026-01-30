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

const STATEROOM_TYPE_MAP: Record<string, string> = {
  'I': 'Interior',
  'O': 'Ocean View',
  'B': 'Balcony',
  'S': 'Suite',
};

export const STEP2_UPCOMING_SCRIPT = `
(function() {
  const SHIP_CODE_MAP = ${JSON.stringify(SHIP_CODE_MAP)};
  const STATEROOM_TYPE_MAP = ${JSON.stringify(STATEROOM_TYPE_MAP)};

  function log(message, type) {
    type = type || 'info';
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: message,
        logType: type
      }));
    } catch (e) {
      console.log('[Step2]', message);
    }
  }

  function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
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

  function calculateDaysToGo(sailDateStr) {
    if (!sailDateStr || sailDateStr.length !== 8) return '';
    var year = parseInt(sailDateStr.substring(0, 4));
    var month = parseInt(sailDateStr.substring(4, 6)) - 1;
    var day = parseInt(sailDateStr.substring(6, 8));
    var sailDate = new Date(year, month, day);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diffTime = sailDate.getTime() - today.getTime();
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays.toString() : '0';
  }

  function getCabinTypeFromCategory(categoryCode, stateroomType) {
    if (!categoryCode && !stateroomType) return '';
    
    if (stateroomType) {
      var mapped = STATEROOM_TYPE_MAP[stateroomType];
      if (mapped) return mapped;
    }
    
    if (categoryCode) {
      var firstChar = categoryCode.charAt(0);
      if (firstChar === 'G' || categoryCode.indexOf('GT') >= 0) return 'GTY';
      if (['1', '2', '3', '4', '5'].indexOf(firstChar) >= 0) {
        var secondChar = categoryCode.charAt(1);
        if (secondChar === 'N' || secondChar === 'O') return 'Ocean View';
        if (secondChar === 'D' || secondChar === 'B' || secondChar === 'C') return 'Balcony';
        if (secondChar === 'S') return 'Suite';
        if (secondChar === 'I') return 'Interior';
      }
    }
    
    return stateroomType ? (STATEROOM_TYPE_MAP[stateroomType] || stateroomType) : '';
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

  function parseBookingsWithEnrichment(bookings, enrichmentMap) {
    var cruises = [];
    
    log('🔄 Processing ' + bookings.length + ' bookings from API...', 'info');
    
    var statusCounts = {};
    var skippedBookings = [];
    var processedBookings = [];
    
    for (var j = 0; j < bookings.length; j++) {
      var status = bookings[j].bookingStatus || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    log('📊 Booking statuses breakdown: ' + JSON.stringify(statusCounts), 'info');
    log('📊 Total bookings to process: ' + bookings.length, 'info');
    
    for (var i = 0; i < bookings.length; i++) {
      var booking = bookings[i];
      var bookingInfo = booking.shipCode + ' ' + booking.sailDate + ' (ID: ' + booking.bookingId + ', Status: ' + booking.bookingStatus + ')';
      
      var cancelledStatuses = ['CX', 'CN', 'XX'];
      var isCancelled = cancelledStatuses.indexOf(booking.bookingStatus) >= 0;
      
      if (isCancelled) {
        log('⏭️ Skipping CANCELLED booking: ' + bookingInfo, 'info');
        skippedBookings.push(bookingInfo);
        continue;
      }
      
      log('✓ Processing booking ' + (i + 1) + '/' + bookings.length + ': ' + bookingInfo, 'info');
      
      var shipCode = booking.shipCode || '';
      var shipName = SHIP_CODE_MAP[shipCode] || (shipCode ? shipCode + ' of the Seas' : '');
      
      var nights = booking.numberOfNights || 0;
      var packageCode = booking.packageCode || '';
      
      var enrichmentKey = shipCode + '_' + booking.sailDate;
      var enrichment = enrichmentMap[enrichmentKey] || {};
      
      if (enrichment.shipName) {
        shipName = enrichment.shipName;
      }
      
      var cruiseTitle = nights + ' Night Cruise';
      if (enrichment.itinerary && enrichment.itinerary.description) {
        cruiseTitle = enrichment.itinerary.description;
      } else if (packageCode) {
        cruiseTitle = nights + ' Night ' + packageCode;
      }
      
      var sailingStartDate = formatDate(booking.sailDate);
      var sailingEndDate = calculateEndDate(booking.sailDate, nights);
      
      if (enrichment.sailingEndDate) {
        sailingEndDate = formatDate(enrichment.sailingEndDate);
      }
      
      var stateroomNumber = booking.stateroomNumber || '';
      var stateroomCategoryCode = booking.stateroomCategoryCode || '';
      var stateroomType = booking.stateroomType || '';
      
      var cabinType = getCabinTypeFromCategory(stateroomCategoryCode, stateroomType);
      var cabinNumber = stateroomNumber === 'GTY' ? '' : stateroomNumber;
      var isGTY = stateroomNumber === 'GTY' || !stateroomNumber;
      
      var numberOfGuests = booking.passengers ? booking.passengers.length.toString() : '1';
      var daysToGo = calculateDaysToGo(booking.sailDate);
      
      var deckNumber = booking.deckNumber || '';
      
      var status = 'Upcoming';
      var holdExpiration = '';
      if (booking.bookingStatus === 'OF') {
        status = 'Courtesy Hold';
        if (booking.offerExpirationDate && booking.offerExpirationDate.length === 8) {
          var expYear = booking.offerExpirationDate.substring(0, 4);
          var expMonth = booking.offerExpirationDate.substring(4, 6);
          var expDay = booking.offerExpirationDate.substring(6, 8);
          holdExpiration = expMonth + '/' + expDay + '/' + expYear;
        }
        log('   📋 Booking ' + booking.bookingId + ' is a Courtesy Hold (OF status), expires: ' + (holdExpiration || 'N/A'), 'info');
      }
      else if (booking.bookingStatus === 'HD' || booking.bookingStatus === 'HO') status = 'Courtesy Hold';
      else if (booking.bookingStatus === 'PD') status = 'Pending';
      else if (booking.bookingStatus === 'WL') status = 'Waitlist';
      
      var departurePort = '';
      var arrivalPort = '';
      if (enrichment.departurePortName) {
        departurePort = enrichment.departurePortName;
      }
      if (enrichment.arrivalPortName) {
        arrivalPort = enrichment.arrivalPortName;
      }
      
      var isOneWay = departurePort && arrivalPort && departurePort !== arrivalPort;
      if (isOneWay) {
        log('   📍 One-way cruise detected: ' + departurePort + ' → ' + arrivalPort, 'info');
      }
      
      var itinerary = '';
      var portList = [];
      if (enrichment.itinerary && enrichment.itinerary.portInfo) {
        var ports = [];
        var seenPorts = {};
        for (var p = 0; p < enrichment.itinerary.portInfo.length; p++) {
          var port = enrichment.itinerary.portInfo[p];
          if (port.title && port.portType !== 'CRUISING' && port.portType !== 'SEA') {
            if (!seenPorts[port.title]) {
              ports.push(port.title);
              portList.push(port.title);
              seenPorts[port.title] = true;
            }
          }
        }
        itinerary = ports.join(' → ');
        log('   📍 Ports extracted: ' + ports.length + ' unique ports', 'info');
      } else {
        log('   ⚠️ No port info in enrichment for ' + shipCode + '_' + booking.sailDate, 'warning');
      }

      var interiorPrice = '';
      var oceanviewPrice = '';
      var balconyPrice = '';
      var suitePrice = '';
      
      if (enrichment.stateroomCategories && Array.isArray(enrichment.stateroomCategories)) {
        log('   💰 Found ' + enrichment.stateroomCategories.length + ' stateroom categories with pricing', 'info');
        for (var sc = 0; sc < enrichment.stateroomCategories.length; sc++) {
          var category = enrichment.stateroomCategories[sc];
          var catCode = category.code || category.categoryCode || '';
          var price = category.price || category.amount || category.lowestPrice || category.minPrice || 0;
          
          if (price > 0) {
            var priceStr = '$' + price.toFixed(2);
            
            if (catCode.includes('I') || category.type === 'interior' || (category.name && category.name.toLowerCase().includes('interior'))) {
              if (!interiorPrice || price < parseFloat(interiorPrice.replace('$', ''))) {
                interiorPrice = priceStr;
              }
            } else if (catCode.includes('O') || category.type === 'oceanview' || (category.name && category.name.toLowerCase().includes('ocean'))) {
              if (!oceanviewPrice || price < parseFloat(oceanviewPrice.replace('$', ''))) {
                oceanviewPrice = priceStr;
              }
            } else if (catCode.includes('B') || category.type === 'balcony' || (category.name && category.name.toLowerCase().includes('balcony'))) {
              if (!balconyPrice || price < parseFloat(balconyPrice.replace('$', ''))) {
                balconyPrice = priceStr;
              }
            } else if (catCode.includes('S') || category.type === 'suite' || (category.name && category.name.toLowerCase().includes('suite'))) {
              if (!suitePrice || price < parseFloat(suitePrice.replace('$', ''))) {
                suitePrice = priceStr;
              }
            }
          }
        }
        if (interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
          log('   💰 Pricing - I: ' + (interiorPrice || 'N/A') + ', O: ' + (oceanviewPrice || 'N/A') + ', B: ' + (balconyPrice || 'N/A') + ', S: ' + (suitePrice || 'N/A'), 'success');
        }
      } else if (enrichment.pricing && Array.isArray(enrichment.pricing)) {
        log('   💰 Found pricing array with ' + enrichment.pricing.length + ' entries', 'info');
        for (var pr = 0; pr < enrichment.pricing.length; pr++) {
          var priceInfo = enrichment.pricing[pr];
          var type = (priceInfo.roomType || priceInfo.cabinType || priceInfo.type || '').toLowerCase();
          var price = priceInfo.price || priceInfo.amount || priceInfo.rate || 0;
          if (price > 0) {
            var priceStr = '$' + price.toFixed(2);
            
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
        if (interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
          log('   💰 Pricing - I: ' + (interiorPrice || 'N/A') + ', O: ' + (oceanviewPrice || 'N/A') + ', B: ' + (balconyPrice || 'N/A') + ', S: ' + (suitePrice || 'N/A'), 'success');
        }
      } else {
        log('   ℹ️ No pricing data available in enrichment', 'info');
      }

      var passengerStatus = '';
      if (booking.passengers && booking.passengers.length > 0 && booking.passengers[0].passengerStatus) {
        passengerStatus = booking.passengers[0].passengerStatus;
      }

      var cruise = {
        sourcePage: 'Upcoming',
        shipName: shipName,
        shipCode: shipCode,
        cruiseTitle: cruiseTitle,
        sailingStartDate: sailingStartDate,
        sailingEndDate: sailingEndDate,
        sailingDates: sailingStartDate && sailingEndDate ? sailingStartDate + ' - ' + sailingEndDate : '',
        itinerary: itinerary,
        departurePort: departurePort,
        arrivalPort: isOneWay ? arrivalPort : departurePort,
        isOneWay: isOneWay ? 'Yes' : 'No',
        cabinType: cabinType,
        cabinCategory: stateroomCategoryCode,
        cabinNumberOrGTY: isGTY ? 'GTY' : cabinNumber,
        deckNumber: deckNumber,
        bookingId: booking.bookingId || '',
        numberOfGuests: numberOfGuests,
        numberOfNights: nights,
        daysToGo: daysToGo,
        status: status,
        holdExpiration: holdExpiration,
        loyaltyLevel: '',
        loyaltyPoints: '',
        paidInFull: booking.paidInFull ? 'Yes' : 'No',
        balanceDue: booking.balanceDueAmount ? booking.balanceDueAmount.toString() : '0',
        musterStation: booking.musterStation || '',
        bookingStatus: booking.bookingStatus || '',
        packageCode: packageCode,
        passengerStatus: passengerStatus,
        stateroomNumber: stateroomNumber,
        stateroomCategoryCode: stateroomCategoryCode,
        stateroomType: stateroomType,
        interiorPrice: interiorPrice,
        oceanviewPrice: oceanviewPrice,
        balconyPrice: balconyPrice,
        suitePrice: suitePrice,
        portList: portList.join(', ')
      };
      
      cruises.push(cruise);
      processedBookings.push(bookingInfo);

      var cabinDisplay = cabinNumber ? cabinNumber : 'GTY';
      var cabinTypeDisplay = cabinType || 'Unknown';
      var cabinCategoryDisplay = stateroomCategoryCode ? ' (Cat: ' + stateroomCategoryCode + ')' : '';
      log('  ✓ ' + shipName + ' - ' + sailingStartDate + ' - ' + cabinTypeDisplay + cabinCategoryDisplay + ' #' + cabinDisplay + ' - Deck ' + (deckNumber || 'N/A') + ' - Booking: ' + booking.bookingId + ' - ' + status, 'success');
    }
    
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    log('📊 STEP 2 EXTRACTION SUMMARY', 'success');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
    log('  📥 Total bookings from API: ' + bookings.length, 'info');
    log('  ✓ Successfully processed: ' + processedBookings.length, 'success');
    log('  ⏭️ Skipped (cancelled): ' + skippedBookings.length, 'info');
    log('', 'info');
    log('📋 DETAILED CRUISE INFORMATION:', 'info');
    for (var detailIdx = 0; detailIdx < cruises.length && detailIdx < 15; detailIdx++) {
      var detailCruise = cruises[detailIdx];
      var roomInfo = detailCruise.cabinType + ' ' + (detailCruise.stateroomCategoryCode || '') + ' #' + detailCruise.cabinNumberOrGTY;
      log('  ' + (detailIdx + 1) + '. ' + detailCruise.shipName + ' - ' + detailCruise.sailingStartDate + ' | ' + roomInfo + ' | Booking: ' + detailCruise.bookingId, 'info');
    }
    
    if (skippedBookings.length > 0) {
      log('  📋 Skipped details: ' + skippedBookings.join(', '), 'info');
    }
    
    var upcomingCount = 0;
    var holdCount = 0;
    var otherCount = 0;
    for (var k = 0; k < cruises.length; k++) {
      if (cruises[k].status === 'Upcoming') upcomingCount++;
      else if (cruises[k].status === 'Courtesy Hold') holdCount++;
      else otherCount++;
    }
    log('  📊 By Status - Upcoming: ' + upcomingCount + ', Courtesy Holds: ' + holdCount + ', Other: ' + otherCount, 'success');
    
    if (processedBookings.length !== cruises.length) {
      log('  ⚠️ MISMATCH: Processed ' + processedBookings.length + ' but created ' + cruises.length + ' cruises!', 'error');
    }
    
    return cruises;
  }

  async function scrollUntilComplete(maxAttempts) {
    maxAttempts = maxAttempts || 30;
    var previousHeight = 0;
    var stableCount = 0;
    var attempts = 0;

    while (stableCount < 4 && attempts < maxAttempts) {
      var currentHeight = document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      window.scrollBy(0, 1000);
      await wait(1000);
      attempts++;
    }
    
    window.scrollTo(0, 0);
    await wait(500);
  }

  function parseDate(dateStr, year) {
    var match = dateStr.match(/(\\w+)\\s+(\\d+)/);
    if (!match) return dateStr;
    var month = match[1];
    var day = match[2];
    return month + ' ' + day + ', ' + year;
  }

  async function extractViaDOM() {
    log('📄 Falling back to DOM scraping method...', 'info');

    await wait(3000);
    await scrollUntilComplete(30);

    var countText = document.body.textContent || '';
    var countMatch = countText.match(/You have (\\d+) upcoming cruise/i);
    var expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

    log('📊 Expected cruises from page: ' + expectedCount, 'info');

    var allElements = Array.from(document.querySelectorAll('div, article, section, [class*="card"], [class*="cruise"]'));

    var cruiseCards = allElements.filter(function(el) {
      var text = el.textContent || '';
      var hasShip = text.indexOf('of the Seas') >= 0;
      var hasNight = text.match(/\\d+\\s+(Night|nt)\\b/i);
      var hasReservation = text.match(/Reservation[:\\s]*\\d+/i);
      var textLength = text.length;
      
      return hasShip && hasNight && hasReservation && textLength > 80 && textLength < 8000;
    });
    
    cruiseCards = cruiseCards.filter(function(el) {
      var text = el.textContent || '';
      var reservationMatches = text.match(/Reservation[:\\s]*\\d+/gi) || [];
      return reservationMatches.length <= 1;
    });
    
    cruiseCards = cruiseCards.filter(function(el, idx, arr) {
      for (var i = 0; i < arr.length; i++) {
        if (i !== idx && el.contains(arr[i])) {
          return false;
        }
      }
      return true;
    });

    log('📊 Found ' + cruiseCards.length + ' cruise cards via DOM', 'info');

    var cruises = [];

    for (var i = 0; i < cruiseCards.length; i++) {
      var card = cruiseCards[i];
      var fullText = card.textContent || '';

      var shipMatch = fullText.match(/([\\w\\s]+of the Seas)/);
      var shipName = shipMatch ? shipMatch[1].trim() : '';

      var cruiseTitleMatch = fullText.match(/(\\d+)\\s+(?:Night|nt)\\s+([^\\n]+?)(?=VANCOUVER|LOS ANGELES|MIAMI|SEATTLE|TAMPA|ORLANDO|FORT LAUDERDALE|GALVESTON|NEW YORK|BOSTON|BALTIMORE|SEWARD|HONOLULU|SAN JUAN|NASSAU|COZUMEL|BAYONNE|CAPE LIBERTY|PORT CANAVERAL|SINGAPORE|SYDNEY|SOUTHAMPTON|BARCELONA|ROME|CIVITAVECCHIA|CHECK-IN|\\d+ Days|$)/i);
      var cruiseTitle = cruiseTitleMatch ? cruiseTitleMatch[0].trim() : '';

      var dateMatch = fullText.match(/(\\w{3})\\s+(\\d+)\\s*—\\s*(\\w{3})\\s+(\\d+),?\\s*(\\d{4})/);
      var sailingStartDate = '';
      var sailingEndDate = '';
      var year = '';
      
      if (dateMatch) {
        year = dateMatch[5];
        sailingStartDate = parseDate(dateMatch[1] + ' ' + dateMatch[2], year);
        sailingEndDate = dateMatch[3] + ' ' + dateMatch[4] + ', ' + year;
      }

      var reservationMatch = fullText.match(/Reservation[:\\s]*(\\d+)/i);
      var bookingId = reservationMatch ? reservationMatch[1] : '';

      var cabinType = '';
      var cabinNumber = '';
      
      var cabinTypeMatch = fullText.match(/(Interior|Ocean View|Oceanview|Balcony|Suite|Junior Suite|GTY|Gty|Grand Suite)/i);
      if (cabinTypeMatch) {
        cabinType = cabinTypeMatch[1].trim();
      }
      
      var cabinNumMatch = fullText.match(/(Interior|Balcony|Suite|Ocean View|Oceanview|GTY|Gty|Grand Suite)[^\\n]*?(\\d{4,5})/i);
      if (cabinNumMatch) {
        cabinNumber = cabinNumMatch[2];
      }

      var guestsMatch = fullText.match(/(\\d+)\\s+Guest/i);
      var numberOfGuests = guestsMatch ? guestsMatch[1] : '1';

      var daysMatch = fullText.match(/(\\d+)\\s+Days?\\s+to\\s+go/i);
      var daysToGo = daysMatch ? daysMatch[1] : '';

      if (shipName && cruiseTitle && bookingId) {
        var cruise = {
          sourcePage: 'Upcoming',
          shipName: shipName,
          cruiseTitle: cruiseTitle,
          sailingStartDate: sailingStartDate,
          sailingEndDate: sailingEndDate,
          sailingDates: sailingStartDate && sailingEndDate ? sailingStartDate + ' - ' + sailingEndDate : '',
          itinerary: '',
          departurePort: '',
          cabinType: cabinType,
          cabinNumberOrGTY: cabinNumber || (cabinType.match(/GTY/i) ? 'GTY' : ''),
          bookingId: bookingId,
          numberOfGuests: numberOfGuests,
          daysToGo: daysToGo,
          status: 'Upcoming',
          loyaltyLevel: '',
          loyaltyPoints: ''
        };
        
        cruises.push(cruise);
        var domCabinDisplay = cabinNumber ? cabinNumber : (cabinType && cabinType.match(/GTY/i) ? 'GTY' : 'Unknown');
        log('  ✓ DOM: ' + shipName + ' - ' + sailingStartDate + ' - ' + (cabinType || 'Unknown') + ' #' + domCabinDisplay + ' - Booking: ' + bookingId, 'success');
      }
    }

    return cruises;
  }

  async function extractUpcomingCruises() {
    try {
      log('🚀 ====== STEP 2: UPCOMING CRUISES ======', 'info');
      log('🔍 Starting upcoming cruises extraction...', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');

      log('⏳ Waiting 8 seconds for page to load and make API calls...', 'info');
      await wait(8000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 10,
        total: 100,
        stepName: 'Page loaded, checking for data...'
      }));

      log('📡 Network monitor should have captured API calls from page load', 'info');
      
      log('🔍 Checking for captured API payload from network monitor...', 'info');
      log('📦 window.capturedPayloads: ' + (window.capturedPayloads ? 'EXISTS' : 'MISSING'), 'info');
      
      if (window.capturedPayloads) {
        var availableEndpoints = Object.keys(window.capturedPayloads).filter(function(k) { return window.capturedPayloads[k]; });
        log('📦 Captured endpoints: ' + (availableEndpoints.length > 0 ? availableEndpoints.join(', ') : 'NONE'), 'info');
      }
      
      if (window.capturedPayloads && window.capturedPayloads.upcomingCruises) {
        log('✅ Found captured payload from network monitor!', 'success');
        var capturedData = window.capturedPayloads.upcomingCruises;
        log('📦 Captured data structure: ' + JSON.stringify(Object.keys(capturedData)).substring(0, 200), 'info');
        
        var bookingsFromCapture = null;
        if (capturedData.payload && capturedData.payload.profileBookings && Array.isArray(capturedData.payload.profileBookings)) {
          bookingsFromCapture = capturedData.payload.profileBookings;
          log('✅ Found ' + bookingsFromCapture.length + ' bookings in payload.profileBookings', 'success');
        } else if (capturedData.profileBookings && Array.isArray(capturedData.profileBookings)) {
          bookingsFromCapture = capturedData.profileBookings;
          log('✅ Found ' + bookingsFromCapture.length + ' bookings in profileBookings', 'success');
        } else if (capturedData.payload && capturedData.payload.sailingInfo && Array.isArray(capturedData.payload.sailingInfo)) {
          bookingsFromCapture = capturedData.payload.sailingInfo;
          log('✅ Found ' + bookingsFromCapture.length + ' bookings in payload.sailingInfo', 'success');
        } else if (capturedData.sailingInfo && Array.isArray(capturedData.sailingInfo)) {
          bookingsFromCapture = capturedData.sailingInfo;
          log('✅ Found ' + bookingsFromCapture.length + ' bookings in sailingInfo', 'success');
        } else {
          log('⚠️ Captured payload does not contain bookings data', 'warning');
          log('📦 Payload keys: ' + Object.keys(capturedData).join(', '), 'info');
          if (capturedData.payload) {
            log('📦 Payload.* keys: ' + Object.keys(capturedData.payload).join(', '), 'info');
          }
        }
        
        if (bookingsFromCapture && bookingsFromCapture.length > 0) {
          log('✅ Using ' + bookingsFromCapture.length + ' bookings from captured payload', 'success');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: 40,
            total: 100,
            stepName: 'Processing ' + bookingsFromCapture.length + ' cruises from API...'
          }));
          
          var enrichmentMapFromCapture = {};
          if (window.capturedPayloads.voyageEnrichment) {
            log('✅ Found voyage enrichment data', 'success');
            var voyages = window.capturedPayloads.voyageEnrichment;
            log('📦 Voyage enrichment keys: ' + Object.keys(voyages).join(', '), 'info');
            for (var vKey in voyages) {
              if (voyages.hasOwnProperty(vKey) && vKey.length > 2) {
                var shipCode = vKey.substring(0, 2);
                var sailDate = vKey.substring(2);
                var enrichKey = shipCode + '_' + sailDate;
                enrichmentMapFromCapture[enrichKey] = voyages[vKey];
                log('   📋 Enrichment for ' + vKey + ' -> ' + enrichKey, 'info');
              }
            }
            log('✅ Created enrichment map with ' + Object.keys(enrichmentMapFromCapture).length + ' entries from voyage API', 'success');
          } else {
            for (var j = 0; j < bookingsFromCapture.length; j++) {
              var bookingItem = bookingsFromCapture[j];
              var enrichKey = bookingItem.shipCode + '_' + bookingItem.sailDate;
              enrichmentMapFromCapture[enrichKey] = bookingItem;
            }
            log('ℹ️ No separate enrichment data, using booking data itself', 'info');
          }
          
          var cruises = parseBookingsWithEnrichment(bookingsFromCapture, enrichmentMapFromCapture);
          
          log('📤 Sending ' + cruises.length + ' cruises to app...', 'info');
          for (var i = 0; i < cruises.length; i++) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'cruise_batch',
              data: [cruises[i]]
            }));
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step_complete',
            step: 2,
            totalCount: cruises.length
          }));
          
          log('✅ Step 2 Complete: Extracted ' + cruises.length + ' upcoming cruises', 'success');
          return;
        }
      } else {
        log('⚠️ No upcomingCruises payload captured from network monitor', 'warning');
        log('⚠️ The page may not have loaded properly or API calls were blocked', 'warning');
        
        if (window.capturedPayloads) {
          log('📊 Debug - Captured payloads status:', 'info');
          log('   - offers: ' + (window.capturedPayloads.offers ? 'YES' : 'NO'), 'info');
          log('   - upcomingCruises: ' + (window.capturedPayloads.upcomingCruises ? 'YES' : 'NO'), 'info');
          log('   - courtesyHolds: ' + (window.capturedPayloads.courtesyHolds ? 'YES' : 'NO'), 'info');
          log('   - loyalty: ' + (window.capturedPayloads.loyalty ? 'YES' : 'NO'), 'info');
        } else {
          log('⚠️ window.capturedPayloads object does not exist!', 'error');
          log('⚠️ Network monitoring may not be active', 'error');
        }
      }
      
      log('⚠️ No API payload captured - falling back to DOM scraping', 'warning');
      log('💡 Tip: If this happens consistently, try refreshing the page before syncing', 'info');
      
      var cruises = [];
      
      if (false) {
        log('⚠️ DOM extraction disabled - API payload required', 'warning');
      } else {
        log('⚠️ Using DOM scraping as last resort (less reliable)', 'warning');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: 30,
          total: 100,
          stepName: 'Using DOM scraping method...'
        }));
        
        cruises = await extractViaDOM();
        
        log('📄 DOM method extracted ' + cruises.length + ' cruises', 'info');
      }

      log('📤 Sending ' + cruises.length + ' cruises to app...', 'info');

      for (var i = 0; i < cruises.length; i++) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'cruise_batch',
          data: [cruises[i]]
        }));
        
        var progressPercent = 75 + Math.floor((i / cruises.length) * 25);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: progressPercent,
          total: 100,
          stepName: 'Sending cruise ' + (i + 1) + '/' + cruises.length
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: cruises,
        totalCount: cruises.length
      }));

      log('✅ Step 2 Complete: Extracted ' + cruises.length + ' upcoming cruises', 'success');

    } catch (error) {
      log('❌ CRITICAL ERROR in Step 2: ' + error.message, 'error');
      log('📝 Error stack: ' + (error.stack || 'N/A'), 'error');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: [],
        totalCount: 0
      }));
      
      log('⚠️ Step 2 completed with errors - continuing to Step 3', 'warning');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractUpcomingCruises);
  } else {
    extractUpcomingCruises();
  }
})();
`;

export function injectUpcomingCruisesExtraction() {
  return STEP2_UPCOMING_SCRIPT;
}

export { SHIP_CODE_MAP, STATEROOM_TYPE_MAP };
