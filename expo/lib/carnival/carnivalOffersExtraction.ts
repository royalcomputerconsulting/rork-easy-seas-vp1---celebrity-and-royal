export const CARNIVAL_OFFERS_SCRIPT = `
(function() {
  var BATCH_SIZE = 150;

  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream',
    'Carnival Elation', 'Carnival Fascination', 'Carnival Firenze', 'Carnival Freedom',
    'Carnival Glory', 'Carnival Horizon', 'Carnival Imagination', 'Carnival Inspiration',
    'Carnival Jubilee', 'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa',
    'Carnival Magic', 'Mardi Gras', 'Carnival Miracle', 'Carnival Panorama',
    'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance', 'Carnival Sensation',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine',
    'Carnival Valor', 'Carnival Venice', 'Carnival Vista'
  ];
  var SHIP_PATTERN = new RegExp('(' + CARNIVAL_SHIPS.map(function(s) { return s.replace(/\\s+/g, '\\\\s+'); }).join('|') + ')', 'i');

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function log(message, type) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
    } catch(e) {}
  }

  function sendBatch(offers, isFinal, totalCount, offerCount) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: isFinal ? 'step_complete' : 'offers_batch',
        step: 1,
        data: offers,
        isFinal: !!isFinal,
        totalCount: totalCount || 0,
        offerCount: offerCount || 0
      }));
    } catch(e) {}
  }

  function progress(current, total, stepName) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress', current: current, total: total, stepName: stepName
      }));
    } catch(e) {}
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

  function scrapeVifpOffersFromDOM() {
    var deals = [];
    log('Scraping VIFP offers from cruise-deals page DOM...', 'info');

    var offerCards = [];
    var selectors = [
      '[class*="offer-card"], [class*="offerCard"], [class*="OfferCard"]',
      '[class*="offer-tile"], [class*="offerTile"], [class*="OfferTile"]',
      '[data-testid*="offer"], [data-testid*="deal"]',
      '[class*="promo-card"], [class*="promoCard"], [class*="PromoCard"]',
      '[class*="PersonalizedOffer"], [class*="personalized-offer"]',
      '[class*="casino-offer"], [class*="casinoOffer"]',
      '[class*="member-offer"], [class*="memberOffer"]',
      '[class*="vifp-offer"], [class*="vifpOffer"]',
      '[class*="exclusive-offer"], [class*="exclusiveOffer"]',
      '[class*="campaign"], [class*="Campaign"]',
      'article[class*="offer"], article[class*="deal"]',
      '[class*="loyalty"] [class*="card"], [class*="loyalty"] [class*="Card"]'
    ];

    for (var si = 0; si < selectors.length; si++) {
      try {
        var found = document.querySelectorAll(selectors[si]);
        if (found.length > 0) {
          offerCards = found;
          log('Found ' + found.length + ' offer elements via: ' + selectors[si], 'info');
          break;
        }
      } catch(e) {}
    }

    if (offerCards.length === 0) {
      try {
        var shopLinks = document.querySelectorAll('a[href*="cruise-search"], a[href*="rateCodes"], a[href*="rateCode"], a[href*="offerCode"], a[href*="shop"], a[href*="book-now"]');
        if (shopLinks.length > 0) {
          log('Found ' + shopLinks.length + ' offer/shop links - checking parent cards', 'info');
          var parents = [];
          for (var li = 0; li < shopLinks.length; li++) {
            var parent = shopLinks[li].closest('article, section, [class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"], [class*="offer"], [class*="Offer"], [class*="promo"], [class*="Promo"], div[class]');
            if (parent && parents.indexOf(parent) === -1) {
              var parentText = (parent.textContent || '').trim();
              if (parentText.length > 20 && parentText.length < 5000) {
                parents.push(parent);
              }
            }
          }
          if (parents.length > 0) {
            offerCards = parents;
            log('Found ' + parents.length + ' offer card containers from shop links', 'info');
          }
        }
      } catch(e) {}
    }

    if (offerCards.length === 0) {
      try {
        var allEls = document.querySelectorAll('section, article, [role="listitem"], div[class*="card"], div[class*="Card"]');
        var matchEls = [];
        for (var ei = 0; ei < allEls.length; ei++) {
          var txt = (allEls[ei].textContent || '').substring(0, 1000).toLowerCase();
          var hasOfferSignal = (
            txt.includes('book by') || txt.includes('book now') || txt.includes('shop now') ||
            txt.includes('shop offers') || txt.includes('rate code') || txt.includes('offer code') ||
            txt.includes('per person') || txt.includes('from $') || txt.includes('starting at') ||
            txt.includes('booking bucks') || txt.includes('onboard credit') || txt.includes('obc') ||
            txt.includes('free upgrade') || txt.includes('bonus offer') || txt.includes('exclusive')
          );
          var hasPriceOrDeal = /\\$\\s*[\\d,]+/.test(txt) || /\\d+[\\s-]*night/i.test(txt);
          if (hasOfferSignal && (hasPriceOrDeal || txt.includes('shop'))) {
            matchEls.push(allEls[ei]);
          }
        }
        if (matchEls.length > 0 && matchEls.length < 50) {
          var filtered = [];
          for (var fi = 0; fi < matchEls.length; fi++) {
            var isChild = false;
            for (var fj = 0; fj < matchEls.length; fj++) {
              if (fi !== fj && matchEls[fj].contains(matchEls[fi]) && matchEls[fj] !== matchEls[fi]) {
                isChild = true;
                break;
              }
            }
            if (!isChild) filtered.push(matchEls[fi]);
          }
          offerCards = filtered.length > 0 ? filtered : matchEls;
          log('Found ' + offerCards.length + ' potential offer elements by content analysis (filtered from ' + matchEls.length + ')', 'info');
        }
      } catch(e) {}
    }

    for (var i = 0; i < offerCards.length; i++) {
      try {
        var card = offerCards[i];
        var text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text.length < 15) continue;

        var headings = card.querySelectorAll('h1, h2, h3, h4, h5, [class*="title"], [class*="Title"], [class*="heading"], [class*="Heading"], [class*="name"], [class*="Name"]');
        var offerName = '';
        for (var hi = 0; hi < headings.length; hi++) {
          var hText = (headings[hi].textContent || '').trim();
          if (hText.length > 3 && hText.length < 150) {
            offerName = hText;
            break;
          }
        }
        if (!offerName) {
          var firstStrong = card.querySelector('strong, b, [class*="bold"]');
          if (firstStrong) offerName = (firstStrong.textContent || '').trim();
        }
        if (!offerName) offerName = text.substring(0, 60).split('.')[0].trim();

        var expiryMatch = text.match(/(?:book by|expires?|valid (?:through|until|thru)|offer ends?)[:\\s]*([A-Za-z]+\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/i);
        var expiry = expiryMatch ? expiryMatch[1].trim() : '';

        var priceMatch = text.match(/(?:from|starting at|per person|pp)?\\s*\\$\\s*([\\d,]+)/i);
        var price = priceMatch ? '$' + priceMatch[1].replace(/,/g, '') : '';

        var rateCode = '';
        var bookingLink = '';
        try {
          var links = card.querySelectorAll('a[href]');
          for (var li2 = 0; li2 < links.length; li2++) {
            var href = links[li2].getAttribute('href') || '';
            var linkText = (links[li2].textContent || '').trim().toUpperCase();
            if (linkText.includes('SHOP') || href.includes('cruise-search') || href.includes('rateCodes') || href.includes('cruise-deals')) {
              if (!bookingLink) bookingLink = href;
            }
            var rcMatch = href.match(/rateCodes?=([A-Z0-9]+)/i);
            if (rcMatch && !rateCode) { rateCode = rcMatch[1]; bookingLink = href; }
            var offerMatch = href.match(/offerCode=([A-Z0-9]+)/i);
            if (offerMatch && !rateCode) { rateCode = offerMatch[1]; bookingLink = href; }
          }
        } catch(e3) {}

        var shipMatch = text.match(SHIP_PATTERN);
        var shipName = shipMatch ? shipMatch[1] : '';

        var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite|Day)/i);
        var nights = nightsMatch ? parseInt(nightsMatch[1]) : null;

        var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Baja\\s*Mexico|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic|Canada|New England|Cuba|Riviera|Ensenada)/i);
        var destination = destMatch ? destMatch[1].trim() : '';

        var portMatch = text.match(/(?:from|departing|departs?|sailing from|Start:)\\s+([A-Z][a-z]+(?:\\s+(?:[A-Z][a-z]+|\\([A-Z][a-z\\s]+\\)))*(?:,\\s*[A-Z]{2})?)/i);
        var port = portMatch ? portMatch[1] : '';

        var descEls = card.querySelectorAll('p, [class*="desc"], [class*="Desc"], [class*="detail"], [class*="Detail"], [class*="subtitle"], [class*="Subtitle"]');
        var perks = '';
        for (var di = 0; di < descEls.length; di++) {
          var dText = (descEls[di].textContent || '').trim();
          if (dText.length > 10 && dText.length < 300 && dText !== offerName) {
            perks = dText;
            break;
          }
        }

        if (offerName || rateCode || price) {
          deals.push({
            sourcePage: 'Offers',
            offerName: offerName || 'Carnival VIFP Offer',
            offerCode: rateCode,
            offerExpirationDate: expiry,
            offerType: 'VIFP Club',
            shipName: shipName,
            shipCode: '',
            sailingDate: '',
            itinerary: destination,
            departurePort: port,
            cabinType: '',
            numberOfGuests: '2',
            perks: perks.substring(0, 200),
            loyaltyLevel: '', loyaltyPoints: '',
            interiorPrice: price,
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '',
            dayByDayItinerary: [],
            destinationName: destination,
            totalNights: nights,
            bookingLink: bookingLink
          });
          log('Scraped offer: ' + (offerName || rateCode) + (price ? ' - ' + price : '') + (rateCode ? ' (Code: ' + rateCode + ')' : ''), 'success');
        }
      } catch(e) {}
    }

    var dedupedDeals = [];
    var seenOfferKeys = {};
    for (var dd = 0; dd < deals.length; dd++) {
      var deal = deals[dd];
      var dedupKey = (deal.offerCode || '') + '|' + (deal.offerName || '').substring(0, 40).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenOfferKeys[dedupKey]) {
        seenOfferKeys[dedupKey] = true;
        dedupedDeals.push(deal);
      }
    }
    if (dedupedDeals.length < deals.length) {
      log('Deduplicated DOM offers: ' + deals.length + ' -> ' + dedupedDeals.length, 'info');
    }
    return dedupedDeals;
  }

  function scrapeCruiseDealsFromDOM() {
    var deals = [];
    log('Scraping cruise deals from page DOM...', 'info');

    var selectorList = [
      '[data-testid*="deal"], [data-testid*="cruise"], [data-testid*="offer"]',
      '[class*="DealCard"], [class*="deal-card"], [class*="dealCard"]',
      '[class*="CruiseCard"], [class*="cruise-card"], [class*="cruiseCard"]',
      '[class*="SearchResult"], [class*="search-result"]',
      'article[class*="deal"], article[class*="cruise"]',
      '[class*="tile"][class*="cruise"], [class*="tile"][class*="deal"]'
    ];

    var cards = [];
    for (var si = 0; si < selectorList.length; si++) {
      try {
        var found = document.querySelectorAll(selectorList[si]);
        if (found.length > 1) {
          cards = found;
          log('Found ' + found.length + ' deal elements: ' + selectorList[si], 'info');
          break;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      try {
        var cruiseLinks = document.querySelectorAll('a[href*="/cruise-search"], a[href*="/booking"], a[href*="itineraryCode"], a[href*="/cruise-deals/"]');
        if (cruiseLinks.length > 1) {
          var parents = [];
          for (var li = 0; li < cruiseLinks.length; li++) {
            var parent = cruiseLinks[li].closest('article, section, [class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"]');
            if (parent && parents.indexOf(parent) === -1) parents.push(parent);
          }
          if (parents.length > 0) cards = parents;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      try {
        var allEls = document.querySelectorAll('section, article, [role="listitem"], [class*="card"], [class*="Card"]');
        var shipEls = [];
        for (var ei = 0; ei < allEls.length; ei++) {
          var txt = (allEls[ei].textContent || '').substring(0, 500);
          if (SHIP_PATTERN.test(txt) && txt.match(/\\$\\s*[\\d,]+/)) {
            shipEls.push(allEls[ei]);
          }
        }
        if (shipEls.length > 0) cards = shipEls;
      } catch(e) {}
    }

    for (var i = 0; i < cards.length; i++) {
      try {
        var card = cards[i];
        var text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
        if (text.length < 15) continue;

        var shipMatch = text.match(SHIP_PATTERN);
        var shipName = shipMatch ? shipMatch[1] : '';

        var dateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
        if (!dateMatch) dateMatch = text.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/);
        if (!dateMatch) dateMatch = text.match(/(\\d{4}-\\d{2}-\\d{2})/);
        var sailDate = dateMatch ? dateMatch[1] : '';

        var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite|Day)/i);
        var nights = nightsMatch ? nightsMatch[1] : '';

        var priceMatch = text.match(/\\$\\s*([\\d,]+)/);
        var price = priceMatch ? '$' + priceMatch[1].replace(/,/g, '') : '';

        var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic|Canada|New England|Cuba|Riviera)/i);
        var destination = destMatch ? destMatch[1].trim() : '';

        var portMatch = text.match(/(?:from|departing|departs?|sailing from)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*(?:,\\s*[A-Z]{2})?)/i);
        var port = portMatch ? portMatch[1] : '';

        var rateCode = '';
        try {
          var links = card.querySelectorAll('a[href]');
          for (var li2 = 0; li2 < links.length; li2++) {
            var href = links[li2].getAttribute('href') || '';
            var rcMatch = href.match(/rateCodes?=([A-Z0-9]+)/i);
            if (rcMatch) { rateCode = rcMatch[1]; break; }
          }
        } catch(e3) {}

        if (shipName || (sailDate && nights) || (price && nights) || (shipName && price)) {
          deals.push({
            sourcePage: 'Offers',
            offerName: (destination || 'Carnival') + (nights ? ' ' + nights + '-Night' : '') + ' Cruise Deal',
            offerCode: rateCode,
            offerExpirationDate: '',
            offerType: 'Cruise Deal',
            shipName: shipName,
            shipCode: '',
            sailingDate: sailDate,
            itinerary: destination,
            departurePort: port,
            cabinType: '',
            numberOfGuests: '2',
            perks: '',
            loyaltyLevel: '', loyaltyPoints: '',
            interiorPrice: price,
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '',
            dayByDayItinerary: [],
            destinationName: destination,
            totalNights: nights ? parseInt(nights) : null,
            bookingLink: ''
          });
        }
      } catch(e) {}
    }

    return deals;
  }

  function tryExtractFromNextData() {
    try {
      var el = document.getElementById('__NEXT_DATA__');
      if (!el) return [];
      var pageData = JSON.parse(el.textContent || '');
      var props = pageData && pageData.props && pageData.props.pageProps;
      if (!props) return [];
      log('Found __NEXT_DATA__ on page, scanning for deals...', 'info');
      var keys = Object.keys(props);
      for (var ki = 0; ki < keys.length; ki++) {
        var val = props[keys[ki]];
        if (Array.isArray(val) && val.length > 0 && val[0]) {
          var first = val[0];
          if (first.shipName || first.ship || first.sailDate || first.departureDate ||
              first.price || first.startingPrice || first.cruiseTitle || first.itinerary ||
              first.OfferId || first.Title || first.CtaUrl) {
            log('Found ' + val.length + ' deals in __NEXT_DATA__.' + keys[ki], 'success');
            var rows = [];
            for (var vi = 0; vi < val.length; vi++) {
              var item = val[vi];
              if (item.OfferId || item.Title) {
                var rateCode2 = '';
                try { var rm = (item.CtaUrl || '').match(/rateCodes=([A-Z0-9]+)/i); if (rm) rateCode2 = rm[1]; } catch(e) {}
                var expiry2 = '';
                try { var em = (item.Subtitle || '').match(/Book by (.+)/i); if (em) expiry2 = em[1].trim(); } catch(e) {}
                rows.push({
                  sourcePage: 'Offers',
                  offerName: item.Title || 'Carnival VIFP Offer',
                  offerCode: rateCode2,
                  offerExpirationDate: expiry2,
                  offerType: 'VIFP Club',
                  shipName: '', shipCode: '', sailingDate: '', itinerary: '',
                  departurePort: '', cabinType: '', numberOfGuests: '2',
                  perks: (item.Description || '').replace(/<[^>]*>/g, ' ').substring(0, 200),
                  loyaltyLevel: '', loyaltyPoints: '',
                  interiorPrice: item.Price ? '$' + Number(item.Price).toFixed(2) : '',
                  oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
                  portList: '', dayByDayItinerary: [], destinationName: '',
                  totalNights: null, bookingLink: item.CtaUrl || '',
                  carnivalOfferId: item.OfferId || ''
                });
              } else {
                var price = item.price || item.startingPrice || item.lowestPrice || 0;
                rows.push({
                  sourcePage: 'Offers',
                  offerName: item.cruiseTitle || item.title || item.name || 'Carnival Cruise Deal',
                  offerCode: item.rateCode || item.offerCode || '',
                  offerExpirationDate: '',
                  offerType: 'Cruise Deal',
                  shipName: item.shipName || item.ship || '',
                  shipCode: item.shipCode || '',
                  sailingDate: formatSailDate(item.sailDate || item.departureDate || item.startDate || ''),
                  itinerary: item.itinerary || item.destination || item.destinationName || '',
                  departurePort: item.departurePort || item.homePort || '',
                  cabinType: '',
                  numberOfGuests: '2',
                  perks: '',
                  loyaltyLevel: '', loyaltyPoints: '',
                  interiorPrice: price ? '$' + Number(price).toFixed(2) : '',
                  oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
                  portList: Array.isArray(item.ports) ? item.ports.map(function(p) { return typeof p === 'string' ? p : (p.name || ''); }).join(', ') : '',
                  dayByDayItinerary: [],
                  destinationName: item.destination || item.destinationName || '',
                  totalNights: item.duration || item.nights || item.numberOfNights || null,
                  bookingLink: item.bookingUrl || item.url || item.productViewLink || ''
                });
              }
            }
            return rows;
          }
        }
      }
      if (props.offers && Array.isArray(props.offers)) {
        log('Found offers array in __NEXT_DATA__.pageProps.offers', 'success');
        return props.offers.map(function(item, idx) {
          return {
            sourcePage: 'Offers',
            offerName: item.title || item.name || item.offerName || 'Carnival Offer ' + (idx + 1),
            offerCode: item.rateCode || item.offerCode || item.code || '',
            offerExpirationDate: item.expirationDate || item.bookByDate || '',
            offerType: 'VIFP Club',
            shipName: item.shipName || '', shipCode: '', sailingDate: '',
            itinerary: item.itinerary || item.destination || '',
            departurePort: item.departurePort || '', cabinType: '', numberOfGuests: '2',
            perks: (item.description || '').substring(0, 200),
            loyaltyLevel: '', loyaltyPoints: '',
            interiorPrice: item.price ? '$' + Number(item.price).toFixed(2) : '',
            oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '',
            portList: '', dayByDayItinerary: [], destinationName: item.destination || '',
            totalNights: item.nights || item.duration || null,
            bookingLink: item.url || item.bookingUrl || ''
          };
        });
      }
    } catch(e) {
      log('__NEXT_DATA__ parse error: ' + (e.message || e), 'warning');
    }
    return [];
  }

  function tryFetchCarnivalOffersAPI() {
    var apiEndpoints = [
      '/profilemanagement/api/offers',
      '/profilemanagement/api/profiles/offers',
      '/api/profile/offers',
      '/api/loyalty/offers',
      '/api/vifp/offers',
      '/api/personalization/offers',
      '/api/casino/offers',
      '/api/member/offers'
    ];

    log('Trying ' + apiEndpoints.length + ' offer API endpoints...', 'info');
    return new Promise(function(resolve) {
      var tried = 0;
      var totalEndpoints = apiEndpoints.length;

      function tryNext() {
        if (tried >= totalEndpoints) {
          log('All ' + totalEndpoints + ' offer endpoints exhausted with no results', 'warning');
          resolve(null);
          return;
        }
        var endpoint = apiEndpoints[tried];
        tried++;
        log('  Trying offer endpoint ' + tried + '/' + totalEndpoints + ': ' + endpoint, 'info');

        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 6000);

        fetch(endpoint, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include',
          signal: controller.signal
        }).then(function(response) {
          clearTimeout(timeoutId);
          log('  Response from ' + endpoint + ': ' + response.status + ' content-type=' + (response.headers.get('content-type') || 'N/A'), response.ok ? 'info' : 'warning');
          if (response.ok) {
            var ct = response.headers.get('content-type') || '';
            if (ct.includes('json')) {
              return response.json().then(function(data) {
                if (!data) { log('  Empty/null JSON from ' + endpoint, 'info'); tryNext(); return; }
                log('  Parsed JSON from ' + endpoint + ': type=' + typeof data + ' isArray=' + Array.isArray(data) + ' keys=' + (typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).join(',') : 'N/A'), 'info');
                if (data.Items && Array.isArray(data.Items) && data.Items.length > 0) {
                  log('  SUCCESS: Found ' + data.Items.length + ' VIFP Items from ' + endpoint, 'success');
                  log('  First Item: ' + JSON.stringify(data.Items[0]).substring(0, 300), 'info');
                  resolve({ type: 'vifp', data: data });
                  return;
                }
                if (data.offers && Array.isArray(data.offers) && data.offers.length > 0) {
                  log('  SUCCESS: Found ' + data.offers.length + ' casino offers from ' + endpoint, 'success');
                  resolve({ type: 'casino', data: data });
                  return;
                }
                if (Array.isArray(data) && data.length > 0) {
                  log('  SUCCESS: Found ' + data.length + ' offers (array) from ' + endpoint, 'success');
                  resolve({ type: 'array', data: data });
                  return;
                }
                log('  No matching offer structure in response from ' + endpoint + ' (data preview: ' + JSON.stringify(data).substring(0, 200) + ')', 'info');
                tryNext();
              });
            } else {
              log('  Non-JSON response from ' + endpoint + ' (ct=' + ct + ')', 'info');
            }
          }
          tryNext();
        }).catch(function(err) {
          clearTimeout(timeoutId);
          log('  Error on ' + endpoint + ': ' + (err && err.message ? err.message : 'aborted/timeout'), 'warning');
          tryNext();
        });
      }

      tryNext();
    });
  }

  function buildCarnivalSearchUrl(rateCode) {
    var lastUrl = '';
    try { lastUrl = window.__carnivalLastOffersUrl || ''; } catch(e) {}
    var tgoStr = '';
    var tierCode = '01';
    var pastGuestNum = '';
    try {
      var tgoMatch = lastUrl.match(/tgos?=([^&]+)/i);
      if (tgoMatch) {
        var fullTgo = decodeURIComponent(tgoMatch[1]);
        var tgoParts = fullTgo.split(';');
        for (var pi2 = 0; pi2 < tgoParts.length; pi2++) {
          var tfields = tgoParts[pi2].split(',');
          if (tfields.length >= 3 && tfields[0] === rateCode) { tgoStr = tgoParts[pi2]; break; }
        }
        if (!tgoStr) tgoStr = fullTgo;
      }
      var tcMatch = lastUrl.match(/tierCode=([^&]+)/i);
      if (tcMatch) tierCode = tcMatch[1];
      var pgMatch = lastUrl.match(/pastGuestNumber=([^&]+)/i);
      if (pgMatch) pastGuestNum = pgMatch[1];
    } catch(e) {}
    var baseSearchUrl = '/cruise-search?ratecodes=' + rateCode + '&pageNumber=1&pagesize=50&sort=fromprice&showBest=true&async=true&currency=USD&locality=1&numadults=2&pastGuest=true';
    if (tgoStr) baseSearchUrl += '&tgo=' + encodeURIComponent(tgoStr);
    if (tierCode) baseSearchUrl += '&tierCode=' + tierCode;
    if (pastGuestNum) baseSearchUrl += '&pastGuestNumber=' + pastGuestNum;
    return baseSearchUrl;
  }

  function tryFetchSailingsForOffer(rateCode) {
    var sailingEndpoints = [
      buildCarnivalSearchUrl(rateCode),
      '/cruise-search?ratecodes=' + rateCode + '&pageNumber=1&pagesize=50&async=true&sort=fromprice&showBest=true',
      '/cruise-search?ratecodes=' + rateCode + '&pageNumber=1&pagesize=50&async=true',
    ];

    return new Promise(function(resolve) {
      var tried = 0;
      function tryNext() {
        if (tried >= sailingEndpoints.length) {
          resolve(null);
          return;
        }
        var endpoint = sailingEndpoints[tried];
        tried++;
        log('  Trying Carnival cruise search API: ' + endpoint, 'info');
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 10000);
        fetch(endpoint, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include',
          signal: controller.signal
        }).then(function(response) {
          clearTimeout(timeoutId);
          log('  API response: ' + response.status + ' from ' + endpoint, response.ok ? 'info' : 'warning');
          if (response.ok) {
            var ct = response.headers.get('content-type') || '';
            if (ct.includes('json') || ct.includes('javascript') || ct.includes('html')) {
              return response.text().then(function(rawText) {
                var data = null;
                try { data = JSON.parse(rawText); } catch(parseErr) {
                  var jsonStart = rawText.indexOf('{');
                  var jsonStartArr = rawText.indexOf('[');
                  var start = (jsonStart >= 0 && (jsonStartArr < 0 || jsonStart < jsonStartArr)) ? jsonStart : jsonStartArr;
                  if (start >= 0) { try { data = JSON.parse(rawText.substring(start)); } catch(e2) {} }
                }
                if (!data) { tryNext(); return; }
                var sailings = null;
                if (data.results && Array.isArray(data.results)) sailings = data.results;
                else if (data.sailings && Array.isArray(data.sailings)) sailings = data.sailings;
                else if (data.cruises && Array.isArray(data.cruises)) sailings = data.cruises;
                else if (data.data && Array.isArray(data.data)) sailings = data.data;
                else if (data.itineraries && Array.isArray(data.itineraries)) sailings = data.itineraries;
                else if (data.searchResults && Array.isArray(data.searchResults)) sailings = data.searchResults;
                else if (data.voyages && Array.isArray(data.voyages)) sailings = data.voyages;
                else if (Array.isArray(data) && data.length > 0) sailings = data;
                if (!sailings) {
                  var dataKeys = Object.keys(data);
                  log('  API returned keys: ' + dataKeys.join(', ') + ' - checking nested...', 'info');
                  for (var ki = 0; ki < dataKeys.length; ki++) {
                    var val = data[dataKeys[ki]];
                    if (Array.isArray(val) && val.length > 0 && val[0] && (val[0].shipName || val[0].ship || val[0].sailDate || val[0].departureDate)) {
                      sailings = val;
                      log('  Found sailings in data.' + dataKeys[ki] + ': ' + sailings.length + ' items', 'success');
                      break;
                    }
                  }
                }
                if (sailings && sailings.length > 0) {
                  log('Found ' + sailings.length + ' sailings for rate code ' + rateCode + ' from ' + endpoint, 'success');
                  resolve(sailings);
                  return;
                }
                tryNext();
              });
            } else { tryNext(); }
          } else { tryNext(); }
        }).catch(function(err) {
          clearTimeout(timeoutId);
          log('  API error for ' + endpoint + ': ' + (err && err.message ? err.message : 'aborted/timeout'), 'warning');
          tryNext();
        });
      }
      tryNext();
    });
  }

  function convertSailingsToRows(sailings, offerName, offerCode, offerExpiry, perks) {
    var rows = [];
    for (var si = 0; si < sailings.length; si++) {
      var s = sailings[si];
      var shipName = s.shipName || s.ship || s.vesselName || '';
      if (!shipName && s.shipCode) shipName = 'Carnival ' + s.shipCode;
      var sailDate = s.sailDate || s.departureDate || s.startDate || s.embarkDate || '';
      var nightCount = s.duration || s.nights || s.numberOfNights || s.numNights || null;
      var dest = s.itinerary || s.itineraryDescription || s.destination || s.destinationName || '';
      if (!dest && s.sailingType) dest = s.sailingType.name || s.sailingType.description || '';
      var dPort = '';
      if (s.departurePort) dPort = typeof s.departurePort === 'string' ? s.departurePort : (s.departurePort.name || s.departurePort.portName || '');
      else if (s.departurePortName) dPort = s.departurePortName;
      else if (s.homePort) dPort = s.homePort;
      var cabin = s.roomType || s.stateroomType || s.cabinType || '';
      var price = '';
      var rawPrice = s.price || s.startingPrice || s.lowestPrice || s.interiorPrice || s.fromPrice || 0;
      var dollarChar = String.fromCharCode(36);
      if (rawPrice > 0) price = dollarChar + Number(rawPrice).toFixed(2);
      var guests = (s.isGOBO || s.gobo) ? '1' : '2';
      var portList = '';
      if (s.ports && Array.isArray(s.ports)) portList = s.ports.map(function(p) { return typeof p === 'string' ? p : (p.name || p.portName || ''); }).join(', ');
      rows.push({
        sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
        offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
        shipName: shipName, shipCode: s.shipCode || '',
        sailingDate: formatSailDate(sailDate),
        itinerary: dest, departurePort: dPort, cabinType: cabin,
        numberOfGuests: guests, perks: perks,
        loyaltyLevel: '', loyaltyPoints: '',
        interiorPrice: price, oceanviewPrice: '', balconyPrice: '', suitePrice: '',
        taxesAndFees: '', portList: portList,
        dayByDayItinerary: [], destinationName: dest,
        totalNights: nightCount, bookingLink: '/cruise-search?rateCodes=' + offerCode
      });
    }
    return rows;
  }

  async function enrichOffersWithSailings(offerRows) {
    var offersByCode = {};
    var enrichedRows = [];
    var offersWithoutSailings = [];
    for (var i = 0; i < offerRows.length; i++) {
      var row = offerRows[i];
      if (row.shipName && row.sailingDate) {
        enrichedRows.push(row);
      } else if (row.offerCode) {
        if (!offersByCode[row.offerCode]) {
          offersByCode[row.offerCode] = row;
          offersWithoutSailings.push(row);
        }
      } else {
        enrichedRows.push(row);
      }
    }
    if (offersWithoutSailings.length === 0) {
      log('All offers already have sailing data', 'success');
      return enrichedRows;
    }
    log('Fetching sailings for ' + offersWithoutSailings.length + ' offer(s)...', 'info');
    for (var oi = 0; oi < offersWithoutSailings.length; oi++) {
      var offer = offersWithoutSailings[oi];
      var code = offer.offerCode;
      if (!code) { enrichedRows.push(offer); continue; }
      progress(50 + Math.floor((oi / offersWithoutSailings.length) * 40), 100,
        'Fetching sailings for offer ' + (oi + 1) + '/' + offersWithoutSailings.length + ' (' + code + ')...');
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'offer_progress', offerIndex: oi + 1, totalOffers: offersWithoutSailings.length,
          offerName: offer.offerName, sailingsCount: 0, status: 'fetching sailings'
        }));
      } catch(e) {}
      var sailings = await tryFetchSailingsForOffer(code);
      if (sailings && sailings.length > 0) {
        var sailingRows = convertSailingsToRows(sailings, offer.offerName, offer.offerCode, offer.offerExpirationDate, offer.perks || '');
        log('  -> ' + offer.offerName + ' (' + code + '): ' + sailingRows.length + ' sailing(s) found', 'success');
        for (var ri = 0; ri < sailingRows.length; ri++) enrichedRows.push(sailingRows[ri]);
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'offer_progress', offerIndex: oi + 1, totalOffers: offersWithoutSailings.length,
            offerName: offer.offerName, sailingsCount: sailingRows.length, status: 'complete'
          }));
        } catch(e) {}
      } else {
        log('  -> ' + offer.offerName + ' (' + code + '): no sailings API found, keeping offer-level row', 'info');
        enrichedRows.push(offer);
      }
      await wait(500);
    }
    return enrichedRows;
  }

  async function extractCarnivalOffers() {
    try {
      log('Starting Carnival offer extraction...', 'info');
      log('Current page URL: ' + window.location.href, 'info');
      log('document.cookie length: ' + document.cookie.length + ' chars', 'info');
      var userCookie = parseCarnivalUserCookie();
      var tgoCookie = parseTgoCookie();
      if (userCookie) {
        log('Found Carnival user cookie: ' + JSON.stringify(userCookie).substring(0, 300), 'success');
        log('   FirstName="' + (userCookie.FirstName || 'N/A') + '" LastName="' + (userCookie.LastName || 'N/A') + '"', 'info');
        log('   VIFP#: ' + (userCookie.PastGuestNumber || 'N/A') + ', TierCode: ' + (userCookie.TierCode || 'N/A'), 'info');
        log('   All user cookie keys: ' + Object.keys(userCookie).join(', '), 'info');
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'carnival_user_data', data: userCookie })); } catch(e) {}
      } else {
        log('No Carnival user cookie found - cookie names on page: ' + document.cookie.split(';').map(function(c) { return c.trim().split('=')[0]; }).filter(function(n) { return n; }).join(', '), 'info');
      }
      if (tgoCookie) {
        log('TGO cookie found: ' + tgoCookie.offers.length + ' rate codes, VIFP#: ' + (tgoCookie.vifpNumber || 'N/A'), 'success');
        if (tgoCookie.offers.length > 0) {
          for (var tgi = 0; tgi < tgoCookie.offers.length; tgi++) {
            log('   TGO rate code ' + (tgi+1) + ': ' + tgoCookie.offers[tgi].code + ' (start: ' + tgoCookie.offers[tgi].startDate + ', end: ' + tgoCookie.offers[tgi].endDate + ')', 'info');
          }
        }
      } else {
        log('No TGO cookie found', 'info');
      }
      progress(0, 100, 'Starting Carnival offer extraction...');
      var collectedOffers = [];
      var vifpSource = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
      if (vifpSource) {
        log('Found pre-captured VIFP data: ' + (vifpSource.Items ? vifpSource.Items.length + ' Items' : 'no Items array') + ', keys: ' + Object.keys(vifpSource).join(', '), 'info');
        if (vifpSource.Items && vifpSource.Items.length > 0) {
          for (var pci = 0; pci < Math.min(vifpSource.Items.length, 5); pci++) {
            var pcItem = vifpSource.Items[pci];
            log('   Pre-captured Item ' + (pci+1) + ': Title="' + (pcItem.Title || 'N/A') + '" OfferId="' + (pcItem.OfferId || 'N/A') + '" Price=' + (pcItem.Price || 'N/A') + ' CtaUrl="' + (pcItem.CtaUrl || '').substring(0, 80) + '"', 'info');
          }
        }
        var immediateRows = convertVifpOffers(vifpSource);
        if (immediateRows.length > 0) { log('Converted pre-captured VIFP offers: ' + immediateRows.length + ' rows', 'success'); collectedOffers = immediateRows; }
      } else {
        log('No pre-captured VIFP offers found (window.__carnivalVifpOffers=' + !!window.__carnivalVifpOffers + ', capturedPayloads.carnivalVifpOffers=' + !!(window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers) + ')', 'info');
      }
      if (collectedOffers.length === 0) {
        progress(5, 100, 'Trying Carnival offers APIs...');
        log('No pre-captured offers, trying direct API endpoints...', 'info');
        var apiResult = await tryFetchCarnivalOffersAPI();
        if (apiResult) {
          log('API returned result type: ' + apiResult.type + ', data keys: ' + Object.keys(apiResult.data).join(', '), 'success');
          if (apiResult.type === 'vifp') {
            log('Converting VIFP API data (' + (apiResult.data.Items ? apiResult.data.Items.length : 0) + ' items)...', 'info');
            collectedOffers = convertVifpOffers(apiResult.data);
            log('Converted: ' + collectedOffers.length + ' offer rows', 'success');
          }
          else if (apiResult.type === 'casino') {
            log('Processing casino-style offers (' + (apiResult.data.offers ? apiResult.data.offers.length : 0) + ' offers)...', 'info');
            var result = processRCStyleOffers(apiResult.data);
            if (result.rows.length > 0) collectedOffers = result.rows;
            log('Processed: ' + result.rows.length + ' sailing rows from ' + result.count + ' offers', 'success');
          }
        } else {
          log('All direct API endpoints returned no offers', 'warning');
        }
      }
      if (collectedOffers.length === 0) {
        log('Waiting for Carnival page to load offers data via network capture...', 'info');
        for (var wi = 0; wi < 15; wi++) {
          await wait(2000);
          progress(15 + (wi * 4), 100, 'Waiting for Carnival offers (' + ((wi + 1) * 2) + 's)...');
          var captured = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
          if (captured) {
            log('Network captured VIFP data at ' + ((wi+1)*2) + 's: ' + (captured.Items ? captured.Items.length + ' Items' : 'keys=' + Object.keys(captured).join(',')), 'success');
            var rows = convertVifpOffers(captured);
            if (rows.length > 0) { collectedOffers = rows; log('VIFP offers captured: ' + rows.length + ' offers', 'success'); break; }
          }
          if (window.capturedPayloads && window.capturedPayloads.offers) {
            var capturedOffers = window.capturedPayloads.offers;
            log('Network captured casino offers at ' + ((wi+1)*2) + 's: ' + (capturedOffers.offers ? capturedOffers.offers.length + ' offers' : 'keys=' + Object.keys(capturedOffers).join(',')), 'info');
            if (capturedOffers.offers && capturedOffers.offers.length > 0) { var casinoResult = processRCStyleOffers(capturedOffers); if (casinoResult.rows.length > 0) { collectedOffers = casinoResult.rows; log('Casino offers captured: ' + casinoResult.rows.length + ' sailings', 'success'); break; } }
          }
          if (wi % 3 === 2) {
            log('Still waiting... capturedPayloads state: offers=' + !!(window.capturedPayloads && window.capturedPayloads.offers) + ' vifp=' + !!(window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers) + ' bookings=' + !!(window.capturedPayloads && window.capturedPayloads.upcomingCruises), 'info');
          }
        }
      }
      if (collectedOffers.length === 0) {
        progress(75, 100, 'Checking __NEXT_DATA__...');
        log('Trying __NEXT_DATA__ extraction...', 'info');
        var nextDataRows = tryExtractFromNextData();
        log('__NEXT_DATA__ result: ' + nextDataRows.length + ' rows', nextDataRows.length > 0 ? 'success' : 'info');
        if (nextDataRows.length > 0) collectedOffers = nextDataRows;
      }
      if (collectedOffers.length === 0) {
        progress(80, 100, 'Scraping VIFP offers from page DOM...');
        log('Trying DOM scraping for VIFP offers...', 'info');
        var vifpDeals = scrapeVifpOffersFromDOM();
        log('DOM VIFP scrape result: ' + vifpDeals.length + ' deals', vifpDeals.length > 0 ? 'success' : 'info');
        if (vifpDeals.length > 0) collectedOffers = vifpDeals;
      }
      if (collectedOffers.length === 0) {
        progress(90, 100, 'Scraping cruise deals from page DOM...');
        log('Trying DOM scraping for general cruise deals...', 'info');
        var domDeals = scrapeCruiseDealsFromDOM();
        log('DOM cruise deals scrape result: ' + domDeals.length + ' deals', domDeals.length > 0 ? 'success' : 'info');
        if (domDeals.length > 0) collectedOffers = domDeals;
      }
      if (collectedOffers.length === 0 && tgoCookie && tgoCookie.offers.length > 0) {
        log('Creating offers from TGO cookie rate codes...', 'info');
        for (var ci = 0; ci < tgoCookie.offers.length; ci++) {
          var co = tgoCookie.offers[ci];
          collectedOffers.push({ sourcePage: 'Offers', offerName: 'Carnival Rate Code ' + co.code, offerCode: co.code, offerExpirationDate: co.endDate || '', offerType: 'VIFP Club', shipName: '', shipCode: '', sailingDate: '', itinerary: '', departurePort: '', cabinType: '', numberOfGuests: '2', perks: '', loyaltyLevel: '', loyaltyPoints: '', interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '', dayByDayItinerary: [], destinationName: '', totalNights: null, bookingLink: '/cruise-search?rateCodes=' + co.code });
        }
        log('Created ' + collectedOffers.length + ' offers from TGO cookie', 'success');
      }
      if (collectedOffers.length > 0) {
        log('Phase 1 complete: ' + collectedOffers.length + ' offer row(s) collected', 'success');
        for (var logIdx = 0; logIdx < collectedOffers.length; logIdx++) {
          var logOffer = collectedOffers[logIdx];
          log('   Collected offer ' + (logIdx+1) + ': name="' + (logOffer.offerName || 'N/A') + '" code="' + (logOffer.offerCode || 'NONE') + '" ship="' + (logOffer.shipName || 'N/A') + '" date="' + (logOffer.sailingDate || 'N/A') + '" price=' + (logOffer.interiorPrice || 'N/A'), 'info');
        }
        log('Phase 2: Enriching offers with sailing details...', 'info');
        progress(50, 100, 'Enriching offers with sailing details...');
        var enrichedOffers = await enrichOffersWithSailings(collectedOffers);
        log('Enrichment complete: ' + enrichedOffers.length + ' total sailing row(s)', 'success');
        for (var k = 0; k < enrichedOffers.length; k += BATCH_SIZE) { sendBatch(enrichedOffers.slice(k, k + BATCH_SIZE), false); }
        var uniqueOfferCodes = {};
        for (var ui = 0; ui < enrichedOffers.length; ui++) { var key = enrichedOffers[ui].offerCode || enrichedOffers[ui].offerName || ('offer-' + ui); uniqueOfferCodes[key] = true; }
        var uniqueCount = Object.keys(uniqueOfferCodes).length;
        sendBatch([], true, enrichedOffers.length, uniqueCount);
        log('Sent ' + enrichedOffers.length + ' sailing(s) across ' + uniqueCount + ' offer(s)', 'success');
      } else {
        log('No Carnival offers found from any source', 'warning');
        sendBatch([], true, 0, 0);
      }
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
  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream',
    'Carnival Elation', 'Carnival Fascination', 'Carnival Firenze', 'Carnival Freedom',
    'Carnival Glory', 'Carnival Horizon', 'Carnival Imagination', 'Carnival Inspiration',
    'Carnival Jubilee', 'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa',
    'Carnival Magic', 'Mardi Gras', 'Carnival Miracle', 'Carnival Panorama',
    'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance', 'Carnival Sensation',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine',
    'Carnival Valor', 'Carnival Venice', 'Carnival Vista'
  ];
  var SHIP_PATTERN = new RegExp('(' + CARNIVAL_SHIPS.map(function(s) { return s.replace(/\\s+/g, '\\\\s+'); }).join('|') + ')', 'i');

  function log(message, type) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
    } catch(e) {}
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

  function parseDate(str) {
    if (!str) return '';
    var m1 = str.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
    if (m1) return m1[1];
    var m2 = str.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/);
    if (m2) return m2[1];
    var m3 = str.match(/(\\d{4}-\\d{2}-\\d{2})/);
    if (m3) return m3[1];
    return '';
  }

  function determineCruiseStatus(sailDateStr, bookingStatus) {
    if (bookingStatus === 'OF') return 'Courtesy Hold';
    if (bookingStatus === 'CX' || bookingStatus === 'XX') return 'Cancelled';
    try {
      var sailDate = new Date(sailDateStr);
      if (!isNaN(sailDate.getTime()) && sailDate < new Date()) return 'Completed';
    } catch(e) {}
    return 'Upcoming';
  }

  function formatBookingFromAPI(booking, index) {
    var shipName = booking.shipName || booking.ship || '';
    if (!shipName && booking.shipCode) shipName = 'Carnival ' + booking.shipCode;
    var sailDate = booking.sailDate || booking.departureDate || booking.startDate || '';
    var bStatus = booking.bookingStatus || 'BK';
    var status = determineCruiseStatus(sailDate, bStatus);
    if (booking.status && /past|completed/i.test(booking.status)) status = 'Completed';
    return {
      rawBooking: booking,
      sourcePage: status === 'Completed' ? 'Completed' : 'Upcoming',
      shipName: shipName,
      shipCode: booking.shipCode || '',
      cruiseTitle: booking.cruiseTitle || booking.title || (booking.numberOfNights ? booking.numberOfNights + ' Night Cruise' : 'Cruise'),
      sailingStartDate: sailDate,
      sailingEndDate: booking.endDate || booking.returnDate || '',
      sailingDates: '',
      itinerary: booking.itinerary || booking.destination || '',
      departurePort: booking.departurePort || booking.homePort || '',
      arrivalPort: booking.arrivalPort || '',
      cabinType: booking.stateroomType || booking.cabinType || booking.categoryType || '',
      cabinCategory: booking.stateroomCategoryCode || booking.categoryCode || '',
      cabinNumberOrGTY: booking.stateroomNumber || booking.cabinNumber || 'GTY',
      deckNumber: booking.deckNumber || '',
      bookingId: (booking.bookingId || booking.confirmationNumber || booking.reservationId || ('CCL-' + Date.now() + '-' + index)).toString(),
      numberOfGuests: (booking.guestCount || booking.numberOfGuests || 2).toString(),
      numberOfNights: (booking.numberOfNights || booking.duration || '').toString(),
      daysToGo: '',
      status: status,
      holdExpiration: '',
      loyaltyLevel: '',
      loyaltyPoints: '',
      paidInFull: booking.paidInFull ? 'Yes' : '',
      balanceDue: (booking.balanceDue || booking.amountDue || '').toString(),
      musterStation: '',
      bookingStatus: bStatus,
      packageCode: '',
      passengerStatus: '',
      stateroomNumber: booking.stateroomNumber || booking.cabinNumber || '',
      stateroomCategoryCode: booking.stateroomCategoryCode || booking.categoryCode || '',
      stateroomType: booking.stateroomType || booking.cabinType || ''
    };
  }

  async function tryFetchBookingsAPI() {
    var endpoints = [
      '/profilemanagement/api/bookings',
      '/profilemanagement/api/profiles/cruises',
      '/profilemanagement/api/cruises',
      '/api/profile/bookings',
      '/api/account/bookings',
      '/api/booking/upcoming',
      '/api/profile/cruises',
      '/api/reservation/list',
      '/api/guest/bookings'
    ];

    log('Trying ' + endpoints.length + ' booking API endpoints...', 'info');
    for (var ei = 0; ei < endpoints.length; ei++) {
      try {
        log('  Trying endpoint ' + (ei+1) + '/' + endpoints.length + ': ' + endpoints[ei], 'info');
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 8000);
        var response = await fetch(endpoints[ei], {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(tid);

        log('  Response: ' + response.status + ' ' + response.statusText + ' content-type=' + (response.headers.get('content-type') || 'N/A'), response.ok ? 'info' : 'warning');

        if (response.ok) {
          var ct = response.headers.get('content-type') || '';
          if (ct.includes('json')) {
            var rawText = await response.text();
            log('  Raw response length: ' + rawText.length + ' chars, preview: ' + rawText.substring(0, 300), 'info');
            var data = null;
            try { data = JSON.parse(rawText); } catch(parseErr) { log('  JSON parse error: ' + parseErr, 'warning'); continue; }
            if (!data) { log('  Parsed data is null/empty', 'warning'); continue; }
            log('  Parsed data type=' + typeof data + ' isArray=' + Array.isArray(data) + ' keys=' + (typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).join(',') : 'N/A'), 'info');
            var bookings = null;
            if (Array.isArray(data)) bookings = data;
            else if (data.bookings && Array.isArray(data.bookings)) bookings = data.bookings;
            else if (data.cruises && Array.isArray(data.cruises)) bookings = data.cruises;
            else if (data.reservations && Array.isArray(data.reservations)) bookings = data.reservations;
            else if (data.data && Array.isArray(data.data)) bookings = data.data;
            else if (data.payload && Array.isArray(data.payload)) bookings = data.payload;
            else if (data.upcoming && Array.isArray(data.upcoming)) bookings = data.upcoming;
            else if (data.pastCruises && Array.isArray(data.pastCruises)) bookings = data.pastCruises;
            else if (data.upcomingCruises && Array.isArray(data.upcomingCruises)) bookings = data.upcomingCruises;

            if (bookings && bookings.length > 0) {
              log('  SUCCESS: Found ' + bookings.length + ' bookings from ' + endpoints[ei], 'success');
              log('  First booking keys: ' + Object.keys(bookings[0]).join(', '), 'info');
              log('  First booking JSON: ' + JSON.stringify(bookings[0]).substring(0, 400), 'info');
              return bookings;
            } else {
              log('  No booking array found in response data', 'info');
            }
          } else {
            log('  Response is not JSON (content-type: ' + ct + ')', 'info');
          }
        }
      } catch(e) {
        log('  Error on ' + endpoints[ei] + ': ' + (e && e.message ? e.message : 'aborted/timeout'), 'warning');
      }
    }
    log('All ' + endpoints.length + ' booking endpoints exhausted with no results', 'warning');
    return null;
  }

  function tryExtractFromNextData() {
    try {
      var el = document.getElementById('__NEXT_DATA__');
      if (!el) return [];
      var pageData = JSON.parse(el.textContent || '');
      var props = pageData && pageData.props && pageData.props.pageProps;
      if (!props) return [];
      var keys = Object.keys(props);
      for (var ki = 0; ki < keys.length; ki++) {
        var val = props[keys[ki]];
        if (Array.isArray(val) && val.length > 0 && val[0]) {
          var first = val[0];
          if (first.bookingId || first.confirmationNumber || first.shipName || first.bookingNumber) {
            log('Found bookings in __NEXT_DATA__.' + keys[ki], 'success');
            return val;
          }
        }
      }
      if (props.bookings) return Array.isArray(props.bookings) ? props.bookings : [];
      if (props.cruises) return Array.isArray(props.cruises) ? props.cruises : [];
      if (props.trips) return Array.isArray(props.trips) ? props.trips : [];
      if (props.pastCruises) return Array.isArray(props.pastCruises) ? props.pastCruises : [];
      if (props.upcomingCruises) return Array.isArray(props.upcomingCruises) ? props.upcomingCruises : [];
    } catch(e) {}
    return [];
  }

  function scrapeBookingsFromDOM() {
    var bookings = [];
    log('Scraping bookings from Carnival profile page DOM...', 'info');

    var selectorList = [
      '[data-testid*="booking"], [data-testid*="cruise"], [data-testid*="trip"], [data-testid*="reservation"]',
      '[class*="BookingCard"], [class*="booking-card"], [class*="bookingCard"]',
      '[class*="CruiseCard"], [class*="cruise-card"], [class*="cruiseCard"]',
      '[class*="TripCard"], [class*="trip-card"], [class*="tripCard"]',
      '[class*="reservation"], [class*="Reservation"]',
      '[class*="upcoming-cruise"], [class*="UpcomingCruise"]',
      '[class*="profile-cruise"], [class*="ProfileCruise"]',
      '[class*="past-cruise"], [class*="PastCruise"]',
      '[class*="cruise-history"], [class*="CruiseHistory"]',
      '[class*="cruise-summary"], [class*="CruiseSummary"]',
      '[class*="booking-summary"], [class*="BookingSummary"]',
      'table[class*="cruise"] tr, table[class*="booking"] tr',
      '[class*="my-cruise"], [class*="MyCruise"]'
    ];

    var cards = [];
    for (var si = 0; si < selectorList.length; si++) {
      try {
        var found = document.querySelectorAll(selectorList[si]);
        if (found.length > 0) {
          cards = found;
          log('Found ' + found.length + ' booking elements: ' + selectorList[si], 'info');
          break;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      try {
        var bookingLinks = document.querySelectorAll('a[href*="manage-booking"], a[href*="managebooking"], a[href*="booking-detail"], a[href*="reservation"], a[href*="confirmationNumber"]');
        if (bookingLinks.length > 0) {
          log('Found ' + bookingLinks.length + ' booking links', 'info');
          var parents = [];
          for (var bi = 0; bi < bookingLinks.length; bi++) {
            var parent = bookingLinks[bi].closest('article, section, [class*="card"], [class*="Card"], [class*="tile"], [class*="Tile"], [class*="booking"], [class*="Booking"], [class*="cruise"], [class*="Cruise"], tr, li, div[class]');
            if (parent && parents.indexOf(parent) === -1) parents.push(parent);
          }
          if (parents.length > 0) cards = parents;
        }
      } catch(e) {}
    }

    if (cards.length === 0) {
      var allElements = document.querySelectorAll('section, article, [role="listitem"], [class*="card"], [class*="Card"], tr, li');
      var matchingEls = [];
      for (var ei = 0; ei < allElements.length; ei++) {
        var elText = (allElements[ei].textContent || '').substring(0, 600);
        if (SHIP_PATTERN.test(elText)) {
          var hasDate = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}|\\d{4}-\\d{2}-\\d{2}/i.test(elText);
          if (hasDate) matchingEls.push(allElements[ei]);
        }
      }
      if (matchingEls.length > 0) {
        cards = matchingEls;
        log('Found ' + matchingEls.length + ' elements with ship names + dates', 'info');
      }
    }

    for (var i = 0; i < cards.length; i++) {
      try {
        var card = cards[i];
        var text = (card.textContent || '').replace(/\\s+/g, ' ');

        var shipMatch = text.match(SHIP_PATTERN);
        if (!shipMatch) continue;

        var dateStr = parseDate(text);
        var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite)/i);
        var nights = nightsMatch ? nightsMatch[1] : '';

        var bookingIdMatch = text.match(/(?:Booking|Confirmation|Booking\\s*Number|Conf(?:irmation)?|Reference|Reservation)\\s*(?:#|:|Number:?)?\\s*([A-Z0-9]{4,12})/i);
        var bookingId = bookingIdMatch ? bookingIdMatch[1] : '';
        if (!bookingId) bookingId = card.getAttribute('data-booking-id') || card.getAttribute('data-confirmation') || '';

        var cabinMatch = text.match(/(?:Cabin|Stateroom|Room)\\s*(?:#|:|Number:?)?\\s*([A-Z]?\\d{3,5}[A-Z]?)/i);
        var cabin = cabinMatch ? cabinMatch[1] : '';

        var categoryMatch = text.match(/(Interior|Ocean\\s*View|Oceanview|Balcony|Suite|Havana|Cloud\\s*9|Spa|Extended\\s*Balcony|Cove\\s*Balcony)/i);
        var category = categoryMatch ? categoryMatch[1] : '';

        var portMatch = text.match(/(?:from|departing|departs?|sailing from)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*(?:,\\s*[A-Z]{2})?)/i);
        var port = portMatch ? portMatch[1] : '';

        var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic)/i);
        var destination = destMatch ? destMatch[1].trim() : '';

        var statusMatch = text.match(/(Past|Completed|Upcoming|Confirmed|Booked|Cancelled|Canceled)/i);
        var status = statusMatch ? statusMatch[1] : 'Upcoming';
        if (/past|completed/i.test(status)) status = 'Completed';
        else if (/cancel/i.test(status)) status = 'Cancelled';
        else status = 'Upcoming';

        bookings.push({
          rawBooking: null, sourcePage: 'Upcoming',
          shipName: shipMatch[1], shipCode: '',
          cruiseTitle: nights ? nights + ' Night ' + (destination || 'Cruise') : (destination || 'Cruise'),
          sailingStartDate: dateStr, sailingEndDate: '', sailingDates: '',
          itinerary: destination, departurePort: port, arrivalPort: '',
          cabinType: category, cabinCategory: '',
          cabinNumberOrGTY: cabin || 'GTY', deckNumber: '',
          bookingId: bookingId || ('CCL-DOM-' + Date.now() + '-' + i),
          numberOfGuests: '2', numberOfNights: nights,
          daysToGo: '', status: status, holdExpiration: '',
          loyaltyLevel: '', loyaltyPoints: '', paidInFull: '',
          balanceDue: '', musterStation: '', bookingStatus: 'BK',
          packageCode: '', passengerStatus: '',
          stateroomNumber: cabin, stateroomCategoryCode: '', stateroomType: category
        });
        log('Found booking: ' + shipMatch[1] + (dateStr ? ' - ' + dateStr : '') + (nights ? ' (' + nights + ' nights)' : '') + ' [' + status + ']', 'success');
      } catch(e) {}
    }

    return bookings;
  }

  async function scrapeBookings() {
    log('Starting Carnival bookings extraction...', 'info');
    log('Current page URL: ' + window.location.href, 'info');
    log('Waiting 4s for page APIs to fire...', 'info');
    await new Promise(function(r) { setTimeout(r, 4000); });

    var bookings = [];

    log('Trying Carnival booking APIs (direct fetch)...', 'info');
    var apiBookings = await tryFetchBookingsAPI();
    if (apiBookings && apiBookings.length > 0) {
      log('Direct API returned ' + apiBookings.length + ' raw booking(s)', 'success');
      for (var ai = 0; ai < apiBookings.length; ai++) {
        var rawB = apiBookings[ai];
        log('   RAW API booking ' + (ai+1) + ': keys=' + Object.keys(rawB).join(',') + ' JSON=' + JSON.stringify(rawB).substring(0, 300), 'info');
        bookings.push(formatBookingFromAPI(rawB, ai));
      }
      log('Formatted ' + bookings.length + ' booking(s) from Carnival API', 'success');
      bookings.forEach(function(b, idx) {
        log('   Formatted booking ' + (idx+1) + ': ' + b.shipName + ' - ' + b.sailingStartDate + ' (' + b.numberOfNights + ' nights) [' + b.status + '] cabin=' + b.cabinNumberOrGTY + ' id=' + b.bookingId, 'success');
      });
    } else {
      log('Direct API returned no bookings (all endpoints failed or empty)', 'warning');
    }

    if (bookings.length === 0 && window.capturedPayloads) {
      var captured = window.capturedPayloads.upcomingCruises;
      if (captured) {
        log('Found network-captured upcomingCruises payload, type=' + typeof captured + ' keys=' + (typeof captured === 'object' ? Object.keys(captured).join(',') : 'N/A'), 'info');
        log('   Raw captured data preview: ' + JSON.stringify(captured).substring(0, 500), 'info');
        var capBookings = null;
        if (Array.isArray(captured)) { capBookings = captured; log('   Captured is direct array: ' + captured.length + ' items', 'info'); }
        else if (captured.bookings) { capBookings = captured.bookings; log('   Found .bookings: ' + captured.bookings.length + ' items', 'info'); }
        else if (captured.cruises) { capBookings = captured.cruises; log('   Found .cruises: ' + captured.cruises.length + ' items', 'info'); }
        else if (captured.data && Array.isArray(captured.data)) { capBookings = captured.data; log('   Found .data: ' + captured.data.length + ' items', 'info'); }
        else if (captured.payload && Array.isArray(captured.payload)) { capBookings = captured.payload; log('   Found .payload: ' + captured.payload.length + ' items', 'info'); }
        else if (captured.upcoming && Array.isArray(captured.upcoming)) { capBookings = captured.upcoming; log('   Found .upcoming: ' + captured.upcoming.length + ' items', 'info'); }
        else if (captured.upcomingCruises && Array.isArray(captured.upcomingCruises)) { capBookings = captured.upcomingCruises; log('   Found .upcomingCruises: ' + captured.upcomingCruises.length + ' items', 'info'); }
        else if (captured.pastCruises && Array.isArray(captured.pastCruises)) { capBookings = captured.pastCruises; log('   Found .pastCruises: ' + captured.pastCruises.length + ' items', 'info'); }
        else { log('   Could not find booking array in captured payload. Keys: ' + Object.keys(captured).join(', '), 'warning'); }

        if (capBookings && capBookings.length > 0) {
          log('Processing ' + capBookings.length + ' captured booking(s)...', 'info');
          for (var ci = 0; ci < capBookings.length; ci++) {
            var rawCap = capBookings[ci];
            log('   RAW captured booking ' + (ci+1) + ': keys=' + Object.keys(rawCap).join(',') + ' JSON=' + JSON.stringify(rawCap).substring(0, 300), 'info');
            bookings.push(formatBookingFromAPI(rawCap, ci));
          }
          log('Formatted ' + bookings.length + ' booking(s) from network capture', 'success');
          bookings.forEach(function(b, idx) {
            log('   Formatted booking ' + (idx+1) + ': ' + b.shipName + ' - ' + b.sailingStartDate + ' (' + b.numberOfNights + ' nights) [' + b.status + '] cabin=' + b.cabinNumberOrGTY + ' id=' + b.bookingId, 'success');
          });
        }
      } else {
        log('No network-captured upcomingCruises payload found. capturedPayloads state: offers=' + !!window.capturedPayloads.offers + ' vifp=' + !!window.capturedPayloads.carnivalVifpOffers + ' bookings=' + !!window.capturedPayloads.upcomingCruises + ' loyalty=' + !!window.capturedPayloads.loyalty, 'warning');
      }
    } else if (bookings.length === 0) {
      log('No capturedPayloads object available on window', 'warning');
    }

    if (bookings.length === 0) {
      var nextBookings = tryExtractFromNextData();
      if (nextBookings.length > 0) {
        for (var ni = 0; ni < nextBookings.length; ni++) {
          bookings.push(formatBookingFromAPI(nextBookings[ni], ni));
        }
        log('Extracted ' + bookings.length + ' booking(s) from page data', 'success');
      }
    }

    if (bookings.length === 0) {
      log('No API/network bookings - scraping DOM...', 'info');
      bookings = scrapeBookingsFromDOM();
    }

    if (bookings.length > 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cruise_batch', data: bookings
      }));
      log('Total: ' + bookings.length + ' Carnival booking(s) captured', 'success');
    } else {
      log('No bookings found - you may have no cruises booked with Carnival', 'info');
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

    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete', step: 2, totalCount: bookings.length, data: []
      }));
      log('Carnival bookings extraction step complete', 'info');
    } catch(e) {}
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

export const CARNIVAL_CRUISE_SEARCH_SCRAPE_SCRIPT = `
(function() {
  var CARNIVAL_SHIPS = [
    'Carnival Breeze', 'Carnival Celebration', 'Carnival Conquest', 'Carnival Dream',
    'Carnival Elation', 'Carnival Fascination', 'Carnival Firenze', 'Carnival Freedom',
    'Carnival Glory', 'Carnival Horizon', 'Carnival Imagination', 'Carnival Inspiration',
    'Carnival Jubilee', 'Carnival Legend', 'Carnival Liberty', 'Carnival Luminosa',
    'Carnival Magic', 'Mardi Gras', 'Carnival Miracle', 'Carnival Panorama',
    'Carnival Paradise', 'Carnival Pride', 'Carnival Radiance', 'Carnival Sensation',
    'Carnival Spirit', 'Carnival Splendor', 'Carnival Sunrise', 'Carnival Sunshine',
    'Carnival Valor', 'Carnival Venice', 'Carnival Vista'
  ];
  var SHIP_PATTERN = new RegExp('(' + CARNIVAL_SHIPS.map(function(s) { return s.replace(/\\s+/g, '\\\\s+'); }).join('|') + ')', 'i');

  function log(message, type) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: message, logType: type || 'info' }));
    } catch(e) {}
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

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function convertApiSailingsToRows(apiSailings, offerName, offerCode, offerExpiry, offerPerks) {
    var rows = [];
    var dollarChar = String.fromCharCode(36);
    for (var i = 0; i < apiSailings.length; i++) {
      var s = apiSailings[i];
      var shipName = s.shipName || s.ship || s.vesselName || '';
      if (!shipName && s.shipCode) shipName = 'Carnival ' + s.shipCode;
      var sailDate = s.sailDate || s.departureDate || s.startDate || s.embarkDate || '';
      var nightCount = s.duration || s.nights || s.numberOfNights || s.numNights || null;
      var dest = s.itinerary || s.itineraryDescription || s.destination || s.destinationName || '';
      if (!dest && s.sailingType) dest = typeof s.sailingType === 'string' ? s.sailingType : (s.sailingType.name || s.sailingType.description || '');
      var dPort = '';
      if (s.departurePort) dPort = typeof s.departurePort === 'string' ? s.departurePort : (s.departurePort.name || s.departurePort.portName || '');
      else if (s.departurePortName) dPort = s.departurePortName;
      else if (s.homePort) dPort = s.homePort;
      var rawPrice = s.price || s.startingPrice || s.lowestPrice || s.interiorPrice || s.fromPrice || 0;
      var priceStr = rawPrice > 0 ? dollarChar + Number(rawPrice).toFixed(2) : '';
      var portList = '';
      if (s.ports && Array.isArray(s.ports)) portList = s.ports.map(function(p) { return typeof p === 'string' ? p : (p.name || p.portName || ''); }).join(', ');
      rows.push({
        sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
        offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
        shipName: shipName, shipCode: s.shipCode || '',
        sailingDate: formatSailDate(sailDate),
        itinerary: dest, departurePort: dPort, cabinType: '',
        numberOfGuests: '2', perks: offerPerks,
        loyaltyLevel: '', loyaltyPoints: '',
        interiorPrice: priceStr, oceanviewPrice: '', balconyPrice: '', suitePrice: '',
        taxesAndFees: '', portList: portList,
        dayByDayItinerary: [], destinationName: dest,
        totalNights: nightCount, bookingLink: '/cruise-search?rateCodes=' + offerCode
      });
    }
    return rows;
  }

  async function tryFetchSailingsAPI(rateCode) {
    var endpoints = [
      '/g/cruise-search/api/search?rateCodes=' + rateCode + '&pageNumber=1&pageSize=50&sort=departureDate&sortDirection=ASC',
      '/g/cruise-search/api/search?rateCode=' + rateCode + '&pageNumber=1&pageSize=50&sort=departureDate&sortDirection=ASC',
      '/cruise-search/api/search?rateCodes=' + rateCode + '&pageNumber=1&pageSize=50',
    ];
    for (var ei = 0; ei < endpoints.length; ei++) {
      try {
        log('  Trying cruise search API: ' + endpoints[ei], 'info');
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 12000);
        var response = await fetch(endpoints[ei], {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
          credentials: 'include',
          signal: controller.signal
        });
        clearTimeout(tid);
        log('  API response: ' + response.status, response.ok ? 'info' : 'warning');
        if (response.ok) {
          var ct = response.headers.get('content-type') || '';
          if (ct.includes('json')) {
            var data = await response.json();
            if (!data) continue;
            var sailings = null;
            if (data.results && Array.isArray(data.results)) sailings = data.results;
            else if (data.sailings && Array.isArray(data.sailings)) sailings = data.sailings;
            else if (data.cruises && Array.isArray(data.cruises)) sailings = data.cruises;
            else if (data.searchResults && Array.isArray(data.searchResults)) sailings = data.searchResults;
            else if (data.voyages && Array.isArray(data.voyages)) sailings = data.voyages;
            else if (data.data && Array.isArray(data.data)) sailings = data.data;
            else if (Array.isArray(data) && data.length > 0) sailings = data;
            if (!sailings) {
              var dKeys = Object.keys(data);
              log('  API keys: ' + dKeys.join(', '), 'info');
              for (var ki = 0; ki < dKeys.length; ki++) {
                var val = data[dKeys[ki]];
                if (Array.isArray(val) && val.length > 0 && val[0] && (val[0].shipName || val[0].ship || val[0].sailDate || val[0].departureDate)) {
                  sailings = val;
                  break;
                }
              }
            }
            if (sailings && sailings.length > 0) {
              log('Found ' + sailings.length + ' sailings from API for ' + rateCode, 'success');
              return sailings;
            }
          }
        }
      } catch(e) {
        log('  API error: ' + (e && e.message ? e.message : 'timeout'), 'warning');
      }
    }
    return null;
  }

  async function extractSailingsFromSearchPage() {
    var sailings = [];
    var offerName = window.__enrichOfferName || '';
    var offerCode = window.__enrichOfferCode || '';
    var offerExpiry = window.__enrichOfferExpiry || '';
    var offerPerks = window.__enrichOfferPerks || '';

    log('Extracting cruise sailings for offer: ' + offerName + ' (' + offerCode + ')', 'info');

    if (offerCode) {
      log('Phase 1: Trying cruise search API for rate code ' + offerCode + '...', 'info');
      var apiSailings = await tryFetchSailingsAPI(offerCode);
      if (apiSailings && apiSailings.length > 0) {
        sailings = convertApiSailingsToRows(apiSailings, offerName, offerCode, offerExpiry, offerPerks);
        log('API found ' + sailings.length + ' sailing(s) for ' + offerName, 'success');
      }
    }

    if (sailings.length === 0) {
      log('Phase 2: Checking __NEXT_DATA__ for pre-loaded cruise data...', 'info');
      try {
        var nextEl = document.getElementById('__NEXT_DATA__');
        if (nextEl) {
          var pageData = JSON.parse(nextEl.textContent || '');
          var props = pageData && pageData.props && pageData.props.pageProps;
          if (props) {
            var keys = Object.keys(props);
            log('  __NEXT_DATA__ pageProps keys: ' + keys.join(', '), 'info');
            for (var ki = 0; ki < keys.length; ki++) {
              var val = props[keys[ki]];
              if (Array.isArray(val) && val.length > 0 && val[0]) {
                var first = val[0];
                if (first.shipName || first.ship || first.sailDate || first.departureDate || first.price || first.startingPrice) {
                  log('Found ' + val.length + ' sailings in __NEXT_DATA__.' + keys[ki], 'success');
                  sailings = convertApiSailingsToRows(val, offerName, offerCode, offerExpiry, offerPerks);
                  break;
                }
              }
            }
          }
        }
      } catch(e) { log('__NEXT_DATA__ parse error: ' + (e.message || e), 'warning'); }
    }

    if (sailings.length === 0) {
      log('Phase 3: Waiting for page to fully render then scraping DOM...', 'info');
      await wait(3000);

      log('Phase 3a: Clicking all SHOW DATES buttons to reveal sailing dates...', 'info');
      try {
        var showDatesBtns = document.querySelectorAll('button, a, [role="button"]');
        var clickedCount = 0;
        for (var bi = 0; bi < showDatesBtns.length; bi++) {
          var btnText = (showDatesBtns[bi].textContent || '').trim().toUpperCase();
          if (btnText.includes('SHOW') && (btnText.includes('DATE') || btnText.includes('DATES'))) {
            try {
              showDatesBtns[bi].click();
              clickedCount++;
            } catch(clickErr) {}
          }
        }
        if (clickedCount > 0) {
          log('Clicked ' + clickedCount + ' SHOW DATES button(s) - waiting for dates to render...', 'success');
          await wait(3000);
        } else {
          log('No SHOW DATES buttons found on page', 'info');
        }
      } catch(showDatesErr) {
        log('Error clicking SHOW DATES: ' + (showDatesErr.message || showDatesErr), 'warning');
      }

      log('Phase 3b: Scraping cruise results with itinerary cards...', 'info');
      var cruiseResultCount = document.querySelectorAll('[class*="Cruise"] h2, [class*="cruise"] h2, [class*="result"] h2, [class*="Result"] h2').length;
      var headerText = document.querySelector('h1, h2, [class*="results-count"], [class*="ResultsCount"]');
      if (headerText) {
        var countMatch = (headerText.textContent || '').match(/(\\d+)\\s*(?:Cruise|Result)/i);
        if (countMatch) {
          log('Page shows ' + countMatch[1] + ' cruise results', 'info');
        }
      }

      var cardSelectors = [
        '[data-testid*="result"], [data-testid*="cruise"], [data-testid*="sailing"], [data-testid*="itinerary"]',
        '[class*="SearchResult"], [class*="search-result"], [class*="searchResult"]',
        '[class*="CruiseCard"], [class*="cruise-card"], [class*="cruiseCard"]',
        '[class*="SailingCard"], [class*="sailing-card"], [class*="sailingCard"]',
        '[class*="ItineraryCard"], [class*="itinerary-card"], [class*="itineraryCard"]',
        '[class*="DealCard"], [class*="deal-card"], [class*="dealCard"]',
        '[class*="result-card"], [class*="ResultCard"]',
        'article[class*="cruise"], article[class*="sailing"], article[class*="result"]',
        '[class*="tile"][class*="cruise"], [class*="tile"][class*="result"]'
      ];

      var cards = [];
      for (var si = 0; si < cardSelectors.length; si++) {
        try {
          var found = document.querySelectorAll(cardSelectors[si]);
          if (found.length > 0) {
            cards = found;
            log('Found ' + found.length + ' cruise result elements via: ' + cardSelectors[si], 'info');
            break;
          }
        } catch(e) {}
      }

      if (cards.length === 0) {
        try {
          var allEls = document.querySelectorAll('section, article, [role="listitem"], div[class*="card"], div[class*="Card"], li[class]');
          var matchEls = [];
          for (var ei = 0; ei < allEls.length; ei++) {
            var txt = (allEls[ei].textContent || '').substring(0, 800);
            var hasShip = SHIP_PATTERN.test(txt);
            var hasPrice = /\\$\\s*[\\d,]+/.test(txt);
            var hasNights = /\\d+\\s*[-\\s]?\\s*(?:Night|night|Nite|Day)/i.test(txt);
            if (hasShip && (hasPrice || hasNights)) {
              matchEls.push(allEls[ei]);
            }
          }
          if (matchEls.length > 0 && matchEls.length < 80) {
            cards = matchEls;
            log('Found ' + matchEls.length + ' cruise elements by content analysis', 'info');
          }
        } catch(e) {}
      }

      var dollarChar2 = String.fromCharCode(36);

      for (var i = 0; i < cards.length; i++) {
        try {
          var card = cards[i];
          var text = (card.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text.length < 15) continue;

          var shipMatch = text.match(SHIP_PATTERN);
          var shipName = shipMatch ? shipMatch[1] : '';

          var nightsMatch = text.match(/(\\d+)\\s*[-\\s]?\\s*(?:Night|night|Nite|Day)/i);
          var nights = nightsMatch ? parseInt(nightsMatch[1]) : null;

          var destMatch = text.match(/((?:Western|Eastern|Southern)?\\s*Caribbean|Bahamas|Baja\\s*Mexico|Mexico|Alaska|Hawaii|Bermuda|Europe|Mediterranean|Panama Canal|Transatlantic|Canada|New England|Cuba|Riviera|Ensenada)/i);
          var destination = destMatch ? destMatch[1].trim() : '';

          var portMatch = text.match(/(?:from|departing|departs?|sailing from|Start:)\\s+([A-Z][a-z]+(?:\\s+(?:[A-Z][a-z]+|\\([A-Z][a-z\\s]+\\)))*(?:,\\s*[A-Z]{2})?)/i);
          var port = portMatch ? portMatch[1] : '';

          var itineraryText = '';
          try {
            var viewItinLink = card.querySelector('a[href*="itinerary"], a[href*="Itinerary"]');
            if (viewItinLink) {
              var parentBlock = viewItinLink.closest('div, p, span');
              if (parentBlock && parentBlock.previousElementSibling) {
                itineraryText = (parentBlock.previousElementSibling.textContent || '').trim();
              }
            }
          } catch(itinErr) {}

          var dateContainers = card.querySelectorAll('[class*="date"], [class*="Date"], [class*="sailing"], [class*="Sailing"], [class*="Available"], [class*="available"]');
          var dateTexts = [];
          for (var di = 0; di < dateContainers.length; di++) {
            var dText = (dateContainers[di].textContent || '').trim();
            if (dText.length > 3 && dText.length < 200) dateTexts.push(dText);
          }
          var combinedDateText = dateTexts.join(' ');

          var allDateMatches = [];
          var dateRe1 = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2}\\s*[-–]\\s*\\d{1,2})[,\\s]*(\\d{4})?/gi;
          var dm1;
          while ((dm1 = dateRe1.exec(combinedDateText + ' ' + text)) !== null) {
            allDateMatches.push({ range: dm1[1].trim(), year: dm1[2] || '' });
          }
          var dateRe2 = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/gi;
          var dm2;
          while ((dm2 = dateRe2.exec(combinedDateText + ' ' + text)) !== null) {
            allDateMatches.push({ range: dm2[1].trim(), year: '' });
          }
          var dateRe3 = /(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/g;
          var dm3;
          while ((dm3 = dateRe3.exec(combinedDateText + ' ' + text)) !== null) {
            allDateMatches.push({ range: dm3[1].trim(), year: '' });
          }

          var priceContainers = card.querySelectorAll('[class*="price"], [class*="Price"], [class*="rate"], [class*="Rate"], [class*="cost"], [class*="Cost"]');
          var prices = {};
          for (var pi = 0; pi < priceContainers.length; pi++) {
            var priceText = (priceContainers[pi].textContent || '').trim();
            var priceVal = priceText.match(/\\$\\s*([\\d,]+)/);
            if (priceVal) {
              var lowerPriceText = priceText.toLowerCase();
              var parentPriceText = ((priceContainers[pi].parentElement || {}).textContent || '').toLowerCase();
              var combinedPT = lowerPriceText + ' ' + parentPriceText;
              if (combinedPT.includes('interior') || combinedPT.includes('inside')) {
                prices.interior = dollarChar2 + priceVal[1].replace(/,/g, '');
              } else if (combinedPT.includes('ocean') || combinedPT.includes('oceanview')) {
                prices.oceanview = dollarChar2 + priceVal[1].replace(/,/g, '');
              } else if (combinedPT.includes('balcony')) {
                prices.balcony = dollarChar2 + priceVal[1].replace(/,/g, '');
              } else if (combinedPT.includes('suite')) {
                prices.suite = dollarChar2 + priceVal[1].replace(/,/g, '');
              } else if (!prices.interior) {
                prices.interior = dollarChar2 + priceVal[1].replace(/,/g, '');
              }
            }
          }
          if (!prices.interior) {
            var simplePriceMatch = text.match(/\\$\\s*([\\d,]+)/);
            if (simplePriceMatch) prices.interior = dollarChar2 + simplePriceMatch[1].replace(/,/g, '');
          }

          if (allDateMatches.length > 0 && (shipName || nights)) {
            var seenDates = {};
            for (var dmi = 0; dmi < allDateMatches.length; dmi++) {
              var dateKey = allDateMatches[dmi].range + (allDateMatches[dmi].year || '');
              if (seenDates[dateKey]) continue;
              seenDates[dateKey] = true;
              var sailDateStr = allDateMatches[dmi].range;
              if (allDateMatches[dmi].year && sailDateStr.indexOf(allDateMatches[dmi].year) === -1) {
                sailDateStr += ' ' + allDateMatches[dmi].year;
              }
              sailings.push({
                sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
                offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
                shipName: shipName, shipCode: '',
                sailingDate: sailDateStr, itinerary: itineraryText || destination,
                departurePort: port, cabinType: '', numberOfGuests: '2',
                perks: offerPerks, loyaltyLevel: '', loyaltyPoints: '',
                interiorPrice: prices.interior || '', oceanviewPrice: prices.oceanview || '',
                balconyPrice: prices.balcony || '', suitePrice: prices.suite || '',
                taxesAndFees: '', portList: '',
                dayByDayItinerary: [], destinationName: destination,
                totalNights: nights, bookingLink: ''
              });
            }
          } else if (shipName || (nights && (prices.interior || destination))) {
            var fallbackDate = '';
            var fallbackDateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})/i);
            if (!fallbackDateMatch) fallbackDateMatch = text.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/);
            if (fallbackDateMatch) fallbackDate = fallbackDateMatch[1];

            sailings.push({
              sourcePage: 'Offers', offerName: offerName, offerCode: offerCode,
              offerExpirationDate: offerExpiry, offerType: 'VIFP Club',
              shipName: shipName, shipCode: '',
              sailingDate: fallbackDate, itinerary: itineraryText || destination,
              departurePort: port, cabinType: '', numberOfGuests: '2',
              perks: offerPerks, loyaltyLevel: '', loyaltyPoints: '',
              interiorPrice: prices.interior || '', oceanviewPrice: prices.oceanview || '',
              balconyPrice: prices.balcony || '', suitePrice: prices.suite || '',
              taxesAndFees: '', portList: '',
              dayByDayItinerary: [], destinationName: destination,
              totalNights: nights, bookingLink: ''
            });
          }
        } catch(e) {}
      }
    }

    log('Total: ' + sailings.length + ' sailing(s) found for ' + offerName + ' (' + offerCode + ')', sailings.length > 0 ? 'success' : 'warning');

    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'offer_sailings_result',
        offerCode: offerCode,
        offerName: offerName,
        sailings: sailings
      }));
    } catch(e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(extractSailingsFromSearchPage, 3000); });
  } else {
    setTimeout(extractSailingsFromSearchPage, 3000);
  }
})();
`;

export function injectCarnivalInlineEnrichmentScript(): string {
  return `
(async function() {
  function ielog(msg, type) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg, logType: type || 'info' })); } catch(e) {}
  }

  function formatSailDateInline(d) {
    if (!d) return '';
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return String(d);
      var m = String(date.getMonth() + 1).padStart(2, '0');
      var dy = String(date.getDate()).padStart(2, '0');
      return m + '/' + dy + '/' + date.getFullYear();
    } catch(e) { return String(d); }
  }

  var vifpData = window.__carnivalVifpOffers || (window.capturedPayloads && window.capturedPayloads.carnivalVifpOffers);
  if (!vifpData || !vifpData.Items || !vifpData.Items.length) {
    ielog('No VIFP offers found for inline enrichment', 'warning');
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'carnival_enrichment_complete', sailings: [], total: 0 }));
    return;
  }

  var lastUrl = '';
  try { lastUrl = window.__carnivalLastOffersUrl || ''; } catch(e) {}
  var tgoMap = {};
  var tierCodeIE = '01';
  var pastGuestNumIE = '';
  var fullTgoIE = '';

  try {
    var tgoMatchIE = lastUrl.match(/tgos?=([^&]+)/i);
    if (tgoMatchIE) {
      fullTgoIE = decodeURIComponent(tgoMatchIE[1]);
      var tgoPartsIE = fullTgoIE.split(';');
      for (var pi3 = 0; pi3 < tgoPartsIE.length; pi3++) {
        var tfieldsIE = tgoPartsIE[pi3].split(',');
        if (tfieldsIE.length >= 3) tgoMap[tfieldsIE[0]] = tgoPartsIE[pi3];
      }
    }
    var tcMatchIE = lastUrl.match(/tierCode=([^&]+)/i);
    if (tcMatchIE) tierCodeIE = tcMatchIE[1];
    var pgMatchIE = lastUrl.match(/pastGuestNumber=([^&]+)/i);
    if (pgMatchIE) pastGuestNumIE = pgMatchIE[1];
  } catch(e) {}

  try {
    function getCookieIE(name) {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name + '=') === 0) return decodeURIComponent(c.substring(name.length + 1));
      }
      return '';
    }
    var userCookieStrIE = getCookieIE('user');
    if (userCookieStrIE) {
      var userCookieIE = JSON.parse(userCookieStrIE);
      if (userCookieIE && userCookieIE.TierCode && tierCodeIE === '01') tierCodeIE = userCookieIE.TierCode;
      if (userCookieIE && userCookieIE.PastGuestNumber && !pastGuestNumIE) pastGuestNumIE = userCookieIE.PastGuestNumber;
    }
  } catch(e) {}

  var items = vifpData.Items;
  var allSailingsIE = [];
  var dollarIE = String.fromCharCode(36);

  ielog('Starting inline offer enrichment for ' + items.length + ' offer(s)...', 'info');

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var rateCodeIE = '';
    try {
      var rcM = (item.CtaUrl || '').match(/rateCodes?=([A-Z0-9]+)/i);
      if (rcM) rateCodeIE = rcM[1];
    } catch(e) {}
    if (!rateCodeIE) continue;

    var offerNameIE = item.Title || ('Carnival Offer ' + rateCodeIE);
    var expiryIE = '';
    try { var emIE = (item.Subtitle || '').match(/Book by (.+)/i); if (emIE) expiryIE = emIE[1].trim(); } catch(e) {}
    var perksIE = (item.Description || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim().substring(0, 200);
    var fromPriceIE = item.Price ? dollarIE + Number(item.Price).toFixed(2) : '';

    ielog('Fetching sailings for: ' + offerNameIE + ' (' + rateCodeIE + ')...', 'info');

    var offerTgoIE = tgoMap[rateCodeIE] || fullTgoIE || '';
    var apiUrlIE = '/cruise-search?ratecodes=' + rateCodeIE + '&pageNumber=1&pagesize=50&sort=fromprice&showBest=true&async=true&currency=USD&locality=1&numadults=2&pastGuest=true';
    if (offerTgoIE) apiUrlIE += '&tgo=' + encodeURIComponent(offerTgoIE);
    if (tierCodeIE) apiUrlIE += '&tierCode=' + tierCodeIE;
    if (pastGuestNumIE) apiUrlIE += '&pastGuestNumber=' + pastGuestNumIE;

    var foundSailingsIE = false;

    try {
      var controllerIE = new AbortController();
      var timeoutIdIE = setTimeout(function() { controllerIE.abort(); }, 20000);

      var respIE = await fetch(apiUrlIE, {
        credentials: 'include',
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'x-requested-with': 'XMLHttpRequest'
        },
        signal: controllerIE.signal
      });
      clearTimeout(timeoutIdIE);

      if (respIE.ok || respIE.status === 200) {
        var rawTextIE = await respIE.text();
        var dataIE = null;
        try { dataIE = JSON.parse(rawTextIE); } catch(parseErrIE) {
          var jsIE = rawTextIE.indexOf('{');
          var jsIEA = rawTextIE.indexOf('[');
          var startIE = (jsIE >= 0 && (jsIEA < 0 || jsIE < jsIEA)) ? jsIE : jsIEA;
          if (startIE >= 0) { try { dataIE = JSON.parse(rawTextIE.substring(startIE)); } catch(e2) {} }
        }

        if (dataIE) {
          var sailingsIE = null;
          if (dataIE.results && Array.isArray(dataIE.results)) sailingsIE = dataIE.results;
          else if (dataIE.sailings && Array.isArray(dataIE.sailings)) sailingsIE = dataIE.sailings;
          else if (dataIE.cruises && Array.isArray(dataIE.cruises)) sailingsIE = dataIE.cruises;
          else if (dataIE.data && Array.isArray(dataIE.data)) sailingsIE = dataIE.data;
          else if (dataIE.searchResults && Array.isArray(dataIE.searchResults)) sailingsIE = dataIE.searchResults;
          else if (Array.isArray(dataIE) && dataIE.length > 0) sailingsIE = dataIE;

          if (!sailingsIE) {
            var dkIE = Object.keys(dataIE);
            for (var ki3 = 0; ki3 < dkIE.length; ki3++) {
              var valIE = dataIE[dkIE[ki3]];
              if (Array.isArray(valIE) && valIE.length > 0 && valIE[0] && (valIE[0].shipName || valIE[0].ship || valIE[0].sailDate || valIE[0].departureDate)) {
                sailingsIE = valIE; break;
              }
            }
          }

          if (sailingsIE && sailingsIE.length > 0) {
            ielog('Enriched ' + offerNameIE + ' (' + rateCodeIE + '): ' + sailingsIE.length + ' sailing(s)', 'success');
            foundSailingsIE = true;
            for (var si3 = 0; si3 < sailingsIE.length; si3++) {
              var s3 = sailingsIE[si3];
              var shipNameIE = s3.shipName || s3.ship || s3.vesselName || '';
              var sailDateIE = s3.sailDate || s3.departureDate || s3.startDate || s3.embarkDate || '';
              var nightsIE = s3.duration || s3.nights || s3.numberOfNights || s3.numNights || null;
              var destIE = s3.itinerary || s3.itineraryDescription || s3.destination || s3.destinationName || '';
              if (!destIE && s3.sailingType) destIE = typeof s3.sailingType === 'string' ? s3.sailingType : (s3.sailingType.name || '');
              var dPortIE = '';
              if (s3.departurePort) dPortIE = typeof s3.departurePort === 'string' ? s3.departurePort : (s3.departurePort.name || s3.departurePort.portName || '');
              else if (s3.departurePortName) dPortIE = s3.departurePortName;
              else if (s3.homePort) dPortIE = s3.homePort;
              var rawPriceIE = s3.price || s3.startingPrice || s3.lowestPrice || s3.fromPrice || s3.interiorPrice || 0;
              var priceStrIE = rawPriceIE > 0 ? dollarIE + Number(rawPriceIE).toFixed(2) : fromPriceIE;
              var portListIE = '';
              if (s3.ports && Array.isArray(s3.ports)) portListIE = s3.ports.map(function(p) { return typeof p === 'string' ? p : (p.name || p.portName || ''); }).join(', ');
              allSailingsIE.push({
                sourcePage: 'Offers', offerName: offerNameIE, offerCode: rateCodeIE,
                offerExpirationDate: expiryIE, offerType: 'VIFP Club',
                shipName: shipNameIE, shipCode: s3.shipCode || '',
                sailingDate: formatSailDateInline(sailDateIE),
                itinerary: destIE, departurePort: dPortIE, cabinType: '',
                numberOfGuests: (s3.isGOBO || item.isGOBO) ? '1' : '2',
                perks: perksIE, loyaltyLevel: '', loyaltyPoints: '',
                interiorPrice: priceStrIE, oceanviewPrice: '', balconyPrice: '', suitePrice: '',
                taxesAndFees: '', portList: portListIE,
                dayByDayItinerary: [], destinationName: destIE,
                totalNights: nightsIE, bookingLink: 'https://www.carnival.com/cruise-search?ratecodes=' + rateCodeIE
              });
            }
          } else {
            ielog('No sailings found for ' + rateCodeIE + ' - keeping offer-level row', 'info');
          }
        }
      } else {
        ielog('Cruise search API returned ' + respIE.status + ' for ' + rateCodeIE, 'warning');
      }
    } catch(fetchErrIE) {
      ielog('Fetch error for ' + rateCodeIE + ': ' + (fetchErrIE && fetchErrIE.message ? fetchErrIE.message : String(fetchErrIE)), 'warning');
    }

    if (!foundSailingsIE) {
      allSailingsIE.push({
        sourcePage: 'Offers', offerName: offerNameIE, offerCode: rateCodeIE,
        offerExpirationDate: expiryIE, offerType: 'VIFP Club',
        shipName: '', shipCode: '', sailingDate: '', itinerary: '',
        departurePort: '', cabinType: '', numberOfGuests: '2',
        perks: perksIE, loyaltyLevel: '', loyaltyPoints: '',
        interiorPrice: fromPriceIE, oceanviewPrice: '', balconyPrice: '', suitePrice: '',
        taxesAndFees: '', portList: '', dayByDayItinerary: [], destinationName: '',
        totalNights: null, bookingLink: 'https://www.carnival.com/cruise-search?ratecodes=' + rateCodeIE
      });
    }

    await new Promise(function(r) { setTimeout(r, 500); });
  }

  ielog('Inline enrichment done: ' + allSailingsIE.length + ' total sailing row(s) from ' + items.length + ' offer(s)', 'success');
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'carnival_enrichment_complete',
    sailings: allSailingsIE,
    total: allSailingsIE.length
  }));
})();
true;
`;
}

export function injectCarnivalCruiseSearchScrape(offerName: string, offerCode: string, offerExpiry: string, offerPerks: string): string {
  const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  return `
    window.__enrichOfferName = '${escaped(offerName)}';
    window.__enrichOfferCode = '${escaped(offerCode)}';
    window.__enrichOfferExpiry = '${escaped(offerExpiry)}';
    window.__enrichOfferPerks = '${escaped(offerPerks)}';
    ${CARNIVAL_CRUISE_SEARCH_SCRAPE_SCRIPT}
    true;
  `;
}
