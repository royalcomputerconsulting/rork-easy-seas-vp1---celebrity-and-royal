export const CARNIVAL_OFFERS_SCRIPT = `
(function() {
  var BATCH_SIZE = 150;

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function log(message, type) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
  }

  function sendBatch(offers, isFinal, totalCount, offerCount) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: isFinal ? 'step_complete' : 'offers_batch',
      step: 1,
      data: offers,
      isFinal: !!isFinal,
      totalCount: totalCount || 0,
      offerCount: offerCount || 0
    }));
  }

  function getCookie(name) {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name + '=') === 0) {
          return c.substring(name.length + 1);
        }
      }
    } catch(e) {}
    return null;
  }

  function parseCarnivalUserCookie() {
    try {
      var raw = getCookie('user');
      if (!raw) return null;
      var decoded = decodeURIComponent(raw);
      return JSON.parse(decoded);
    } catch(e) {
      log('Failed to parse user cookie: ' + (e.message || e), 'warning');
      return null;
    }
  }

  function parseTgoCookie() {
    try {
      var raw = getCookie('tgo');
      if (!raw) return null;
      var decoded = decodeURIComponent(raw);
      var parts = decoded.split('|');
      var offers = [];
      var vifpNumber = '';
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        if (part.indexOf('offers=') === 0) {
          var offerStr = part.substring(7);
          var offerParts = offerStr.split(';');
          for (var oi = 0; oi < offerParts.length; oi++) {
            var fields = offerParts[oi].split(',');
            if (fields.length >= 3) {
              offers.push({ code: fields[0], startDate: fields[1], endDate: fields[2] });
            }
          }
        } else if (part.indexOf('PastGuestNumber=') === 0) {
          vifpNumber = part.substring(16);
        }
      }
      return { offers: offers, vifpNumber: vifpNumber };
    } catch(e) {
      log('Failed to parse tgo cookie: ' + (e.message || e), 'warning');
      return null;
    }
  }

  function formatSailDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      var year = date.getFullYear();
      return month + '/' + day + '/' + year;
    } catch(e) { return dateStr; }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    } catch(e) { return dateStr; }
  }

  function safeStr(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || val.description || val.code || val.text || '';
    return String(val);
  }

  function getAuthContext() {
    var headers = { 'accept': 'application/json', 'content-type': 'application/json' };
    var accountId = '';
    var loyaltyId = '';

    var keys = ['persist:session', 'persist:auth', 'persist:root', 'carnival-session', 'persist:user'];
    var sessionData = null;
    for (var i = 0; i < keys.length; i++) {
      try {
        var v = localStorage.getItem(keys[i]);
        if (v && v.length > 30) { sessionData = v; break; }
      } catch(e) {}
    }
    if (!sessionData) {
      try {
        var allKeys = Object.keys(localStorage || {});
        for (var j = 0; j < allKeys.length; j++) {
          if (/persist:|session|auth|token/i.test(allKeys[j])) {
            var val = localStorage.getItem(allKeys[j]);
            if (val && val.length > 30) { sessionData = val; break; }
          }
        }
      } catch(e) {}
    }

    if (sessionData) {
      try {
        var parsed = JSON.parse(sessionData);
        var token = parsed.token ? JSON.parse(parsed.token) : null;
        var user = parsed.user ? JSON.parse(parsed.user) : null;
        if (token && user && user.accountId) {
          accountId = user.accountId;
          var rawAuth = token.toString ? token.toString() : '';
          headers['authorization'] = rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth;
          headers['account-id'] = accountId;
          loyaltyId = user.cruiseLoyaltyId || '';
          log('Found auth context from localStorage', 'success');
        }
      } catch(e) {}
    }

    return { headers: headers, accountId: accountId, loyaltyId: loyaltyId };
  }

  async function tryCasinoOffersAPI(loyaltyId) {
    try {
      log('Trying shared casino offers API with cookie auth...', 'info');
      var ctx = getAuthContext();
      if (!loyaltyId && ctx.loyaltyId) loyaltyId = ctx.loyaltyId;

      var response = await fetch('/api/casino/casino-offers/v1', {
        method: 'POST',
        headers: ctx.headers,
        credentials: 'include',
        body: JSON.stringify({ cruiseLoyaltyId: loyaltyId || '', offerCode: '', brand: 'CCL' })
      });

      if (response.ok) {
        var data = await response.json();
        if (data && data.offers && data.offers.length > 0) {
          log('Casino offers API returned ' + data.offers.length + ' offers', 'success');
          return data;
        }
        log('Casino offers API returned empty (status ' + response.status + ')', 'info');
      } else {
        log('Casino offers API status: ' + response.status, 'warning');
      }
      return null;
    } catch(e) {
      log('Casino offers API error: ' + (e.message || e), 'warning');
      return null;
    }
  }

  function processRCStyleOffers(data) {
    var allRows = [];
    if (!data || !Array.isArray(data.offers)) return { rows: allRows, count: 0 };
    var validOffers = data.offers.filter(function(o) { return o && o.campaignOffer; });

    for (var i = 0; i < validOffers.length; i++) {
      var offer = validOffers[i];
      var co = offer.campaignOffer;
      var offerName = co.name || '';
      var offerCode = co.offerCode || '';
      var offerExpiry = formatDate(co.reserveByDate);
      var tradeInValue = co.tradeInValue ? '$' + Number(co.tradeInValue).toFixed(2) : '';
      var perks = tradeInValue ? 'Trade-in value: ' + tradeInValue : '';
      var sailings = co.sailings || [];

      log('Offer ' + (i+1) + '/' + validOffers.length + ': ' + offerName + ' (' + offerCode + ') - ' + sailings.length + ' sailings', 'info');

      if (sailings.length === 0) {
        allRows.push({
          sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
          offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
          shipName: '', shipCode: '', sailingDate: '', itinerary: '',
          departurePort: '', cabinType: '', numberOfGuests: '2', perks: perks,
          loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '', oceanviewPrice: '',
          balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '',
          dayByDayItinerary: [], destinationName: '', totalNights: null, bookingLink: ''
        });
        continue;
      }

      for (var j = 0; j < sailings.length; j++) {
        var s = sailings[j];
        allRows.push({
          sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
          offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
          shipName: s.shipName || '', shipCode: s.shipCode || '',
          sailingDate: formatSailDate(s.sailDate),
          itinerary: safeStr(s.itineraryDescription || (s.sailingType && s.sailingType.name) || ''),
          departurePort: safeStr((s.departurePort && s.departurePort.name) || s.departurePortName || ''),
          cabinType: safeStr(s.roomType || s.stateroomType || ''),
          numberOfGuests: (s.isGOBO || co.isGOBO) ? '1' : '2',
          perks: perks, loyaltyLevel: '', loyaltyPoints: '',
          interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '',
          taxesAndFees: '', portList: '',
          dayByDayItinerary: [], destinationName: '', totalNights: null, bookingLink: ''
        });
      }
    }
    return { rows: allRows, count: validOffers.length };
  }

  function convertVifpOffers(vifpData) {
    var rows = [];
    if (!vifpData || !Array.isArray(vifpData.Items)) return rows;
    for (var i = 0; i < vifpData.Items.length; i++) {
      var item = vifpData.Items[i];
      var rateCode = '';
      try {
        var m = (item.CtaUrl || '').match(/rateCodes=([A-Z0-9]+)/i);
        if (m) rateCode = m[1];
      } catch(e) {}
      var expiry = '';
      try {
        var m2 = (item.Subtitle || '').match(/Book by (.+)/i);
        if (m2) expiry = m2[1].trim();
      } catch(e) {}
      var desc = (item.Description || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
      rows.push({
        sourcePage: 'Offers', offerName: item.Title || 'Carnival VIFP Offer',
        offerCode: rateCode, offerExpirationDate: expiry, offerType: 'VIFP Club',
        shipName: '', shipCode: '', sailingDate: '', itinerary: '',
        departurePort: '', cabinType: '', numberOfGuests: '2',
        perks: desc.substring(0, 200), loyaltyLevel: '', loyaltyPoints: '',
        interiorPrice: item.Price ? '$' + Number(item.Price).toFixed(2) : '',
        oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
        portList: '', dayByDayItinerary: [], destinationName: '',
        totalNights: null, bookingLink: item.CtaUrl || '',
        carnivalOfferId: item.OfferId || ''
      });
    }
    return rows;
  }

  async function extractCarnivalOffers() {
    try {
      log('Starting Carnival offer extraction...', 'info');

      var userCookie = parseCarnivalUserCookie();
      var tgoCookie = parseTgoCookie();

      if (userCookie) {
        log('Found Carnival user: ' + userCookie.FirstName + ' ' + userCookie.LastName, 'success');
        log('   VIFP Number: ' + (userCookie.PastGuestNumber || 'N/A'), 'info');
        log('   Tier Code: ' + (userCookie.TierCode || 'N/A'), 'info');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'carnival_user_data', data: userCookie
        }));
      } else {
        log('No Carnival user cookie found - checking if logged in...', 'warning');
      }

      if (tgoCookie && tgoCookie.offers.length > 0) {
        log('Found ' + tgoCookie.offers.length + ' offer codes from TGO cookie', 'success');
        for (var ti = 0; ti < tgoCookie.offers.length; ti++) {
          var o = tgoCookie.offers[ti];
          log('   Rate Code: ' + o.code + ' (valid ' + o.startDate + ' - ' + o.endDate + ')', 'info');
        }
      }

      var loyaltyId = '';
      if (userCookie && userCookie.PastGuestNumber) loyaltyId = userCookie.PastGuestNumber;
      else if (tgoCookie && tgoCookie.vifpNumber) loyaltyId = tgoCookie.vifpNumber;

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress', current: 0, total: 100, stepName: 'Fetching Carnival offers...'
      }));

      var casinoData = await tryCasinoOffersAPI(loyaltyId);
      if (casinoData && casinoData.offers && casinoData.offers.length > 0) {
        log('Processing casino offers API data...', 'info');
        var result = processRCStyleOffers(casinoData);
        for (var k = 0; k < result.rows.length; k += BATCH_SIZE) {
          sendBatch(result.rows.slice(k, k + BATCH_SIZE), false);
        }
        sendBatch([], true, result.rows.length, result.count);
        log('Casino offers extraction complete: ' + result.rows.length + ' sailings from ' + result.count + ' offers', 'success');
        return;
      }

      log('Casino offers API unavailable - checking for passively captured VIFP offers...', 'info');

      if (window.__carnivalVifpOffers) {
        log('Using passively captured VIFP offers', 'success');
        var rows = convertVifpOffers(window.__carnivalVifpOffers);
        if (rows.length > 0) {
          sendBatch(rows, false);
          sendBatch([], true, rows.length, rows.length);
          log('VIFP offers complete: ' + rows.length + ' offers', 'success');
          return;
        }
      }

      log('Waiting for VIFP offers from page load...', 'info');
      for (var wi = 0; wi < 10; wi++) {
        await wait(2000);
        if (window.__carnivalVifpOffers) {
          var rows2 = convertVifpOffers(window.__carnivalVifpOffers);
          if (rows2.length > 0) {
            sendBatch(rows2, false);
            sendBatch([], true, rows2.length, rows2.length);
            log('VIFP offers captured after wait: ' + rows2.length + ' offers', 'success');
            return;
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress', current: (wi + 1) * 10, total: 100,
          stepName: 'Waiting for Carnival page to load offers (' + ((wi + 1) * 2) + 's)...'
        }));
      }

      if (tgoCookie && tgoCookie.offers.length > 0) {
        log('Creating offer entries from TGO cookie data...', 'info');
        var cookieRows = [];
        for (var ci = 0; ci < tgoCookie.offers.length; ci++) {
          var co = tgoCookie.offers[ci];
          cookieRows.push({
            sourcePage: 'Offers', offerName: 'Carnival Rate Code ' + co.code,
            offerCode: co.code, offerExpirationDate: co.endDate || '',
            offerType: 'VIFP Club', shipName: '', shipCode: '', sailingDate: '',
            itinerary: '', departurePort: '', cabinType: '', numberOfGuests: '2',
            perks: '', loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '',
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '', dayByDayItinerary: [], destinationName: '',
            totalNights: null, bookingLink: '/cruise-search?rateCodes=' + co.code
          });
        }
        sendBatch(cookieRows, false);
        sendBatch([], true, cookieRows.length, cookieRows.length);
        log('Created ' + cookieRows.length + ' offers from TGO cookie', 'success');
        return;
      }

      log('No Carnival offers found', 'warning');
      sendBatch([], true, 0, 0);
    } catch(error) {
      log('Carnival extraction error: ' + (error.message || error), 'error');
      sendBatch([], true, 0, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractCarnivalOffers);
  } else {
    extractCarnivalOffers();
  }
})();
`;

export function injectCarnivalOffersExtraction(): string {
  return CARNIVAL_OFFERS_SCRIPT;
}

export const CARNIVAL_BOOKINGS_SCRAPE_SCRIPT = `
(function() {
  function log(message, type) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
  }

  function getCookie(name) {
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name + '=') === 0) return c.substring(name.length + 1);
      }
    } catch(e) {}
    return null;
  }

  function parseCarnivalUserCookie() {
    try {
      var raw = getCookie('user');
      if (!raw) return null;
      return JSON.parse(decodeURIComponent(raw));
    } catch(e) { return null; }
  }

  async function scrapeBookings() {
    log('Scraping Carnival bookings page...', 'info');
    await new Promise(function(r) { setTimeout(r, 3000); });

    var bookings = [];
    try {
      var cards = document.querySelectorAll('[class*="booking"], [class*="cruise"], [class*="reservation"], [class*="trip"], [data-booking-id]');
      if (cards.length === 0) {
        cards = document.querySelectorAll('.card, article, section');
      }
      log('Found ' + cards.length + ' elements to scan for bookings', 'info');

      for (var i = 0; i < cards.length; i++) {
        try {
          var card = cards[i];
          var text = (card.textContent || '').replace(/\\s+/g, ' ');
          var shipMatch = text.match(/Carnival\\s+\\w+/i);
          if (!shipMatch) continue;
          var dateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
          var nightsMatch = text.match(/(\\d+)\\s*(?:-\\s*)?(?:Night|night|Nite)/i);
          var bookingIdMatch = text.match(/(?:Booking|Confirmation|Ref)\\s*(?:#|:)?\\s*([A-Z0-9]{4,})/i);
          var cabinMatch = text.match(/(?:Cabin|Stateroom|Room)\\s*(?:#|:)?\\s*([A-Z]?\\d{3,})/i);
          var categoryMatch = text.match(/(?:Interior|Ocean\\s*View|Oceanview|Balcony|Suite|Havana|Cloud)/i);

          bookings.push({
            rawBooking: null, sourcePage: 'Upcoming',
            shipName: shipMatch[0], shipCode: '',
            cruiseTitle: nightsMatch ? nightsMatch[1] + ' Night Cruise' : 'Cruise',
            sailingStartDate: dateMatch ? dateMatch[1] : '',
            sailingEndDate: '', sailingDates: '', itinerary: '',
            departurePort: '', arrivalPort: '',
            cabinType: categoryMatch ? categoryMatch[0] : '',
            cabinCategory: '', cabinNumberOrGTY: cabinMatch ? cabinMatch[1] : 'GTY',
            deckNumber: '', bookingId: bookingIdMatch ? bookingIdMatch[1] : ('CCL-' + Date.now() + '-' + i),
            numberOfGuests: '2', numberOfNights: nightsMatch ? nightsMatch[1] : '',
            daysToGo: '', status: 'Upcoming', holdExpiration: '',
            loyaltyLevel: '', loyaltyPoints: '', paidInFull: '',
            balanceDue: '', musterStation: '', bookingStatus: 'BK',
            packageCode: '', passengerStatus: '',
            stateroomNumber: cabinMatch ? cabinMatch[1] : '',
            stateroomCategoryCode: '', stateroomType: ''
          });
          log('Found booking: ' + shipMatch[0] + (dateMatch ? ' - ' + dateMatch[1] : ''), 'success');
        } catch(e) {}
      }
    } catch(e) {
      log('DOM scrape error: ' + (e.message || e), 'warning');
    }

    if (bookings.length > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cruise_batch', data: bookings
      }));
      log('Captured ' + bookings.length + ' booking(s) from Carnival page', 'success');
    } else {
      log('No bookings found on this page', 'info');
    }

    var userCookie = parseCarnivalUserCookie();
    if (userCookie) {
      var tierMap = { '01': 'Red', '02': 'Gold', '03': 'Platinum', '04': 'Diamond' };
      var tierName = tierMap[userCookie.TierCode] || userCookie.TierCode || 'Unknown';
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'carnival_user_data', data: userCookie
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'loyalty_data',
        data: {
          crownAndAnchorLevel: tierName,
          crownAndAnchorPoints: userCookie.PastGuestNumber || '',
          clubRoyaleTier: tierName,
          clubRoyalePoints: ''
        }
      }));
      log('VIFP loyalty: ' + tierName + ' (VIFP# ' + (userCookie.PastGuestNumber || 'N/A') + ')', 'success');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scrapeBookings);
  } else {
    scrapeBookings();
  }
})();
`;

export function injectCarnivalBookingsScrape(): string {
  return CARNIVAL_BOOKINGS_SCRAPE_SCRIPT;
}
