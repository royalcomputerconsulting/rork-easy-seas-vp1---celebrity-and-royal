export const STEP2_UPCOMING_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(maxAttempts = 20) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 3 && attempts < maxAttempts) {
      const currentHeight = document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      window.scrollBy(0, 800);
      await wait(800);
      attempts++;
    }
  }

  function parseDate(dateStr, year) {
    const match = dateStr.match(/(\\w+)\\s+(\\d+)/);
    if (!match) return dateStr;
    const month = match[1];
    const day = match[2];
    return month + ' ' + day + ', ' + year;
  }

  async function extractUpcomingCruises() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Loading Upcoming Cruises page...',
        logType: 'info'
      }));

      await wait(3000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling page to load all cruises...',
        logType: 'info'
      }));
      
      await scrollUntilComplete(20);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing page structure...',
        logType: 'info'
      }));

      const countText = document.body.textContent || '';
      const countMatch = countText.match(/You have (\\d+) upcoming cruise/i);
      const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Expected cruises: ' + expectedCount,
        logType: 'info'
      }));

      const allElements = Array.from(document.querySelectorAll('div, article, section, [class*="card"], [class*="cruise"]'));
      
      let cruiseCards = allElements.filter(el => {
        const text = el.textContent || '';
        const hasShip = text.includes('of the Seas');
        const hasNight = text.match(/\\d+\\s+Night/i);
        const hasReservation = text.match(/Reservation[:\\s]*\\d+/i);
        const hasDaysToGo = text.includes('Days to go') || text.includes('Day to go');
        const hasGuests = text.includes('Guests') || text.includes('Guest');
        const textLength = text.length;
        
        return hasShip && hasNight && hasReservation && textLength > 150 && textLength < 3000;
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + cruiseCards.length + ' potential cruise cards',
        logType: 'info'
      }));
      
      cruiseCards = cruiseCards.filter((el, idx, arr) => {
        return !arr.some((other, otherIdx) => otherIdx !== idx && (other.contains(el) || el.contains(other)));
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracted ' + cruiseCards.length + ' unique cruise cards',
        logType: cruiseCards.length === expectedCount ? 'success' : 'warning'
      }));
      
      if (cruiseCards.length !== expectedCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '⚠️ WARNING: Found ' + cruiseCards.length + ' but expected ' + expectedCount,
          logType: 'warning'
        }));
      }
      
      const cruises = [];
      let processedCount = 0;

      for (let i = 0; i < cruiseCards.length; i++) {
        const card = cruiseCards[i];
        const fullText = card.textContent || '';

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '━━━━━ Cruise ' + (i + 1) + '/' + cruiseCards.length + ' ━━━━━',
          logType: 'info'
        }));

        const shipMatch = fullText.match(/([\\w\\s]+of the Seas)/);
        const shipName = shipMatch ? shipMatch[1].trim() : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Ship: ' + (shipName || '[NOT FOUND]'),
          logType: shipName ? 'info' : 'warning'
        }));

        const cruiseTitleMatch = fullText.match(/(\\d+)\\s+Night\\s+([^\\n]+?)(?=VANCOUVER|LOS ANGELES|MIAMI|SEATTLE|TAMPA|ORLANDO|FORT LAUDERDALE|GALVESTON|NEW YORK|BOSTON|BALTIMORE|CHECK-IN|\\d+ Days|$)/i);
        const cruiseTitle = cruiseTitleMatch ? cruiseTitleMatch[0].trim() : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Title: ' + (cruiseTitle || '[NOT FOUND]'),
          logType: cruiseTitle ? 'info' : 'warning'
        }));

        const dateMatch = fullText.match(/(\\w{3})\\s+(\\d+)\\s*—\\s*(\\w{3})\\s+(\\d+),?\\s*(\\d{4})/);
        let sailingStartDate = '';
        let sailingEndDate = '';
        let year = '';
        
        if (dateMatch) {
          year = dateMatch[5];
          sailingStartDate = parseDate(dateMatch[1] + ' ' + dateMatch[2], year);
          sailingEndDate = dateMatch[3] + ' ' + dateMatch[4] + ', ' + year;
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Start Date: ' + (sailingStartDate || '[NOT FOUND]'),
          logType: sailingStartDate ? 'info' : 'warning'
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  End Date: ' + (sailingEndDate || '[NOT FOUND]'),
          logType: sailingEndDate ? 'info' : 'warning'
        }));

        let itinerary = '';
        const itineraryPattern = /([A-Z][A-Z\\s,()]+?)(?=Reservation|Interior|Balcony|Suite|Ocean View|GTY|Gty|\\d+ Gty|CHECK-IN|Guests|Days to go)/i;
        const itineraryMatch = fullText.match(itineraryPattern);
        
        if (itineraryMatch) {
          itinerary = itineraryMatch[1].trim();
          itinerary = itinerary.replace(/\\s+/g, ' ');
          
          if (itinerary.length > 150) {
            const parts = itinerary.split('|');
            if (parts.length > 0) {
              itinerary = parts.slice(0, Math.min(5, parts.length)).join(' | ').trim();
            }
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Itinerary: ' + (itinerary || '[NOT FOUND]'),
          logType: itinerary ? 'info' : 'warning'
        }));

        const reservationMatch = fullText.match(/Reservation[:\\s]*(\\d+)/i);
        const bookingId = reservationMatch ? reservationMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Reservation: ' + (bookingId || '[NOT FOUND]'),
          logType: bookingId ? 'info' : 'warning'
        }));

        const cabinMatches = fullText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite|GTY|Gty)([^\\n]*?)(?=(\\d{4,5})|Guests|Days|$)/i);
        let cabinType = '';
        let cabinNumber = '';
        
        if (cabinMatches) {
          cabinType = cabinMatches[1].trim();
          const cabinNumMatch = fullText.match(/(Interior|Balcony|Suite|Ocean View|GTY|Gty)[^\\n]*?(\\d{4,5})/i);
          if (cabinNumMatch) {
            cabinNumber = cabinNumMatch[2];
          }
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Cabin Type: ' + (cabinType || '[NOT FOUND]'),
          logType: cabinType ? 'info' : 'warning'
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Cabin Number: ' + (cabinNumber || '[NOT FOUND]'),
          logType: cabinNumber ? 'info' : 'warning'
        }));

        const guestsMatch = fullText.match(/(\\d+)\\s+Guest/i);
        const numberOfGuests = guestsMatch ? guestsMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Guests: ' + (numberOfGuests || '[NOT FOUND]'),
          logType: numberOfGuests ? 'info' : 'warning'
        }));

        const daysMatch = fullText.match(/(\\d+)\\s+Days?\\s+to\\s+go/i);
        const daysToGo = daysMatch ? daysMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Days to Go: ' + (daysToGo || '[NOT FOUND]'),
          logType: daysToGo ? 'info' : 'warning'
        }));

        if (shipName && cruiseTitle && bookingId) {
          const cruise = {
            sourcePage: 'Upcoming',
            shipName: shipName,
            cruiseTitle: cruiseTitle,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? sailingStartDate + ' - ' + sailingEndDate : '',
            itinerary: itinerary,
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

          processedCount++;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ✓ Cruise scraped successfully (' + processedCount + '/' + expectedCount + ')',
            logType: 'success'
          }));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: processedCount,
            total: cruiseCards.length,
            stepName: 'Upcoming: ' + processedCount + ' of ' + expectedCount + ' scraped'
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ⚠️ Skipped - missing required fields (ship: ' + !!shipName + ', title: ' + !!cruiseTitle + ', booking: ' + !!bookingId + ')',
            logType: 'warning'
          }));
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: cruises
      }));

      const statusType = cruises.length === expectedCount ? 'success' : 'warning';
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '✓ Extracted ' + cruises.length + ' cruises (expected ' + expectedCount + ')',
        logType: statusType
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract upcoming cruises: ' + error.message
      }));
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
