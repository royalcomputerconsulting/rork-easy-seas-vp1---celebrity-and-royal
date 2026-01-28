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

  async function fetchProfileBookings() {
    log('🔄 Step 2: Fetching booking data via API...', 'info');

    try {
      log('📡 Calling /api/profile/bookings...', 'info');
      var response = await fetch('https://www.royalcaribbean.com/api/profile/bookings', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      log('📡 API Response status: ' + response.status, 'info');

      if (!response.ok) {
        log('⚠️ API returned non-OK status: ' + response.status, 'warning');
        throw new Error('API response not OK: ' + response.status);
      }

      var text = await response.text();
      log('📦 Response received, length: ' + text.length + ' chars', 'info');
      
      if (!text || text.length < 10) {
        log('⚠️ Empty or very short response', 'warning');
        throw new Error('Empty response');
      }
      
      var data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        log('❌ Failed to parse JSON: ' + parseError.message, 'error');
        log('📝 Response preview: ' + text.substring(0, 300), 'info');
        throw new Error('JSON parse error');
      }
      
      log('📊 Parsed response - status: ' + data.status + ', has payload: ' + !!data.payload, 'info');
      
      if (data && data.payload && data.payload.profileBookings) {
        var bookings = data.payload.profileBookings;
        log('✅ API returned ' + bookings.length + ' bookings from profileBookings', 'success');
        
        var confirmedCount = 0;
        var offerCount = 0;
        var cancelledCount = 0;
        for (var i = 0; i < bookings.length; i++) {
          var status = bookings[i].bookingStatus;
          if (status === 'BK') confirmedCount++;
          else if (status === 'OF') offerCount++;
          else if (status === 'CX' || status === 'CN') cancelledCount++;
          log('   📋 Booking ' + (i+1) + ': ' + bookings[i].shipCode + ' - ' + bookings[i].sailDate + ' - Status: ' + status, 'info');
        }
        log('   Summary - Confirmed: ' + confirmedCount + ', Offers: ' + offerCount + ', Cancelled: ' + cancelledCount, 'info');
        
        return { bookings: bookings, vdsId: data.payload.vdsId };
      }
      
      log('⚠️ No profileBookings in response payload', 'warning');
      if (data.payload) {
        log('📝 Payload keys: ' + Object.keys(data.payload).join(', '), 'info');
      }
      throw new Error('No profileBookings in response');
      
    } catch (error) {
      log('❌ API fetch failed: ' + error.message, 'error');
      log('📝 Will try DOM scraping as fallback...', 'info');
      return null;
    }
  }

  async function fetchEnrichmentData(bookings) {
    if (!bookings || bookings.length === 0) {
      log('⚠️ No bookings to enrich', 'warning');
      return {};
    }

    log('🔄 Fetching enrichment data for ' + bookings.length + ' bookings...', 'info');

    try {
      var sailingKeys = [];
      for (var i = 0; i < bookings.length; i++) {
        var b = bookings[i];
        if (b.shipCode && b.sailDate) {
          sailingKeys.push({ shipCode: b.shipCode, sailDate: b.sailDate });
          log('   📋 Adding sailing key: ' + b.shipCode + ' - ' + b.sailDate, 'info');
        }
      }

      if (sailingKeys.length === 0) {
        log('⚠️ No valid sailing keys for enrichment', 'warning');
        return {};
      }

      log('📡 Calling enrichment API with ' + sailingKeys.length + ' sailings...', 'info');
      
      var response = await fetch('https://www.royalcaribbean.com/api/profile/bookings/enrichment', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ sailings: sailingKeys })
      });

      log('📡 Enrichment API Response status: ' + response.status, 'info');

      if (!response.ok) {
        log('⚠️ Enrichment API returned: ' + response.status + ' - continuing without enrichment', 'warning');
        return {};
      }

      var text = await response.text();
      log('📦 Enrichment response length: ' + text.length + ' chars', 'info');
      
      var data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        log('⚠️ Failed to parse enrichment JSON: ' + parseError.message, 'warning');
        return {};
      }
      
      log('📊 Enrichment parsed - status: ' + data.status + ', has payload: ' + !!data.payload, 'info');
      
      if (data && data.payload && data.payload.sailingInfo) {
        var enrichmentMap = {};
        var sailingInfo = data.payload.sailingInfo;
        log('✅ Enrichment returned ' + sailingInfo.length + ' sailing details', 'success');
        
        for (var j = 0; j < sailingInfo.length; j++) {
          var info = sailingInfo[j];
          var key = info.shipCode + '_' + info.sailDate;
          enrichmentMap[key] = info;
          
          var itinDesc = info.itinerary && info.itinerary.description ? info.itinerary.description : 'N/A';
          var portCount = info.itinerary && info.itinerary.portInfo ? info.itinerary.portInfo.length : 0;
          var isOneWayEnrich = info.departurePortName && info.arrivalPortName && info.departurePortName !== info.arrivalPortName;
          var portInfo = isOneWayEnrich 
            ? info.departurePortName + ' → ' + info.arrivalPortName + ' (one-way)'
            : (info.departurePortName || 'N/A');
          log('   ✓ ' + info.shipName + ' (' + info.shipCode + ') - ' + info.sailDate + ' - ' + portInfo + ' - ' + itinDesc + ' (' + portCount + ' ports)', 'info');
        }
        
        return enrichmentMap;
      }
      
      log('⚠️ No sailingInfo in enrichment response', 'warning');
      if (data.payload) {
        log('📝 Enrichment payload keys: ' + Object.keys(data.payload).join(', '), 'info');
      }
      return {};
      
    } catch (error) {
      log('⚠️ Enrichment fetch failed: ' + error.message + ' - continuing without enrichment', 'warning');
      return {};
    }
  }

  function parseBookingsWithEnrichment(bookings, enrichmentMap) {
    var cruises = [];
    
    log('🔄 Processing ' + bookings.length + ' bookings...', 'info');
    
    // Log all booking statuses for debugging
    var statusCounts = {};
    for (var j = 0; j < bookings.length; j++) {
      var status = bookings[j].bookingStatus || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    log('📊 Booking statuses: ' + JSON.stringify(statusCounts), 'info');
    
    for (var i = 0; i < bookings.length; i++) {
      var booking = bookings[i];
      
      // Include all valid booking statuses:
      // BK = Booked/Confirmed, OF = Offer, PD = Pending, HD/HO = Hold
      // Only exclude cancelled (CX, CN) and explicitly rejected statuses
      var validStatuses = ['BK', 'OF', 'PD', 'HD', 'HO', 'CF', 'DP', 'WL'];
      var isValid = validStatuses.indexOf(booking.bookingStatus) >= 0;
      
      // If status is unknown but booking has valid data, include it
      if (!isValid && booking.bookingStatus) {
        var isCancelled = booking.bookingStatus === 'CX' || booking.bookingStatus === 'CN' || booking.bookingStatus === 'XX';
        if (!isCancelled) {
          log('⚠️ Including booking with unknown status: ' + booking.bookingStatus + ' (Ship: ' + booking.shipCode + ', Date: ' + booking.sailDate + ')', 'warning');
          isValid = true;
        }
      }
      
      if (!isValid) {
        log('⏭️ Skipping booking with status: ' + booking.bookingStatus + ' (Ship: ' + booking.shipCode + ', Date: ' + booking.sailDate + ')', 'info');
        continue;
      }
      
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
        // Format offer expiration date if available (YYYYMMDD -> MM/DD/YYYY)
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
      
      // Check for one-way cruise (different embark/disembark)
      var isOneWay = departurePort && arrivalPort && departurePort !== arrivalPort;
      if (isOneWay) {
        log('   📍 One-way cruise detected: ' + departurePort + ' → ' + arrivalPort, 'info');
      }
      
      var itinerary = '';
      if (enrichment.itinerary && enrichment.itinerary.portInfo) {
        var ports = [];
        var seenPorts = {};
        for (var p = 0; p < enrichment.itinerary.portInfo.length; p++) {
          var port = enrichment.itinerary.portInfo[p];
          // Include all ports except CRUISING days
          if (port.title && port.portType !== 'CRUISING' && port.portType !== 'SEA') {
            // Avoid duplicates (consecutive days at same port)
            if (!seenPorts[port.title]) {
              ports.push(port.title);
              seenPorts[port.title] = true;
            }
          }
        }
        itinerary = ports.join(' → ');
        log('   📍 Ports extracted: ' + ports.length + ' unique ports', 'info');
      } else {
        log('   ⚠️ No port info in enrichment for ' + shipCode + '_' + booking.sailDate, 'warning');
      }

      // Extract passenger status from first passenger
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
        stateroomType: stateroomType
      };
      
      cruises.push(cruise);

      var portSummary = departurePort ? (isOneWay ? departurePort + ' → ' + arrivalPort : departurePort) : 'No port data';
      log('  ✓ ' + shipName + ' - ' + sailingStartDate + ' - ' + portSummary + ' - Cabin: ' + (cabinNumber || 'GTY') + ' (' + cabinType + ')', 'success');
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
      var hasNight = text.match(/\\d+\\s+Night/i);
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

      var cruiseTitleMatch = fullText.match(/(\\d+)\\s+Night\\s+([^\\n]+?)(?=VANCOUVER|LOS ANGELES|MIAMI|SEATTLE|TAMPA|ORLANDO|FORT LAUDERDALE|GALVESTON|NEW YORK|BOSTON|BALTIMORE|SEWARD|HONOLULU|SAN JUAN|NASSAU|COZUMEL|BAYONNE|CAPE LIBERTY|PORT CANAVERAL|SINGAPORE|SYDNEY|SOUTHAMPTON|BARCELONA|ROME|CIVITAVECCHIA|CHECK-IN|\\d+ Days|$)/i);
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
        log('  ✓ DOM: ' + shipName + ' - ' + sailingStartDate + ' - Booking: ' + bookingId, 'success');
      }
    }

    return cruises;
  }

  async function fetchLoyaltyData() {
    log('🔄 Fetching loyalty data via API...', 'info');

    try {
      var response = await fetch('https://www.royalcaribbean.com/api/profile/loyalty', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      log('📡 Loyalty API Response status: ' + response.status, 'info');

      if (!response.ok) {
        log('⚠️ Loyalty API returned non-OK status: ' + response.status, 'warning');
        return null;
      }

      var text = await response.text();
      log('📦 Loyalty response length: ' + text.length + ' chars', 'info');
      
      var data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        log('⚠️ Failed to parse loyalty JSON: ' + parseError.message, 'warning');
        return null;
      }
      
      if (data && data.payload && data.payload.loyaltyInformation) {
        var loyalty = data.payload.loyaltyInformation;
        log('✅ Loyalty API returned data', 'success');
        
        // Log the key loyalty info
        if (loyalty.crownAndAnchorSocietyLoyaltyTier) {
          log('   → Crown & Anchor: ' + loyalty.crownAndAnchorSocietyLoyaltyTier + ' - ' + (loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints || 0) + ' pts', 'info');
        }
        if (loyalty.clubRoyaleLoyaltyTier) {
          log('   → Club Royale: ' + loyalty.clubRoyaleLoyaltyTier + ' - ' + (loyalty.clubRoyaleLoyaltyIndividualPoints || 0) + ' pts', 'info');
        }
        if (loyalty.captainsClubLoyaltyTier) {
          log('   → Captains Club: ' + loyalty.captainsClubLoyaltyTier + ' - ' + (loyalty.captainsClubLoyaltyIndividualPoints || 0) + ' pts', 'info');
        }
        
        // Send extended loyalty data to app
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'extended_loyalty_data',
          data: loyalty,
          accountId: data.payload.accountId
        }));
        
        return loyalty;
      }
      
      log('⚠️ No loyaltyInformation in response', 'warning');
      return null;
      
    } catch (error) {
      log('⚠️ Loyalty fetch failed: ' + error.message, 'warning');
      return null;
    }
  }

  async function extractUpcomingCruises() {
    try {
      log('🚀 ====== STEP 2: UPCOMING CRUISES ======', 'info');
      log('🔍 Starting upcoming cruises extraction...', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');

      await wait(2000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Fetching booking data...'
      }));

      // Also fetch loyalty data in parallel
      var loyaltyPromise = fetchLoyaltyData();
      
      var apiResult = await fetchProfileBookings();
      
      var cruises = [];
      
      if (apiResult && apiResult.bookings && apiResult.bookings.length > 0) {
        log('📊 API method: Processing ' + apiResult.bookings.length + ' bookings...', 'info');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: 25,
          total: 100,
          stepName: 'Fetching enrichment data...'
        }));
        
        var enrichmentMap = await fetchEnrichmentData(apiResult.bookings);
        
        var enrichmentCount = Object.keys(enrichmentMap).length;
        log('📊 Enrichment map has ' + enrichmentCount + ' entries', 'info');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: 50,
          total: 100,
          stepName: 'Processing ' + apiResult.bookings.length + ' cruises...'
        }));
        
        cruises = parseBookingsWithEnrichment(apiResult.bookings, enrichmentMap);
        
        log('✅ API method extracted ' + cruises.length + ' cruises with details', 'success');
      } else {
        log('⚠️ API method failed or returned no data - trying DOM scraping', 'warning');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: 25,
          total: 100,
          stepName: 'API failed, trying DOM scraping...'
        }));
        
        cruises = await extractViaDOM();
        
        log('📄 DOM method extracted ' + cruises.length + ' cruises', 'info');
      }

      // Wait for loyalty data to complete
      try {
        var loyaltyResult = await loyaltyPromise;
        if (loyaltyResult) {
          log('✅ Loyalty data fetched successfully', 'success');
        } else {
          log('⚠️ No loyalty data from API - will try DOM extraction in step 4', 'warning');
        }
      } catch (loyaltyError) {
        log('⚠️ Loyalty fetch error: ' + loyaltyError.message, 'warning');
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
      
      // Still send step_complete even on error so the sync continues
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: [],
        totalCount: 0
      }));
      
      // Don't send error message that would stop the whole sync
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
