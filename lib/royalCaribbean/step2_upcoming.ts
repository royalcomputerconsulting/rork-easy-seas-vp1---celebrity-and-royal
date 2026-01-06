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
        message: 'Scrolling page to load all content...',
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

      const allLinks = Array.from(document.querySelectorAll('a[href*="/account/upcoming-cruises/"]'));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + allLinks.length + ' detail links',
        logType: 'info'
      }));

      let cruiseCards = [];
      const processedElements = new Set();

      for (const link of allLinks) {
        let parent = link;
        for (let i = 0; i < 12; i++) {
          if (!parent || !parent.parentElement) break;
          parent = parent.parentElement;
          
          if (processedElements.has(parent)) break;
          
          const text = parent.textContent || '';
          const hasShip = text.includes('of the Seas');
          const hasNight = text.match(/\\d+\\s+Night/);
          const hasDate = text.match(/(\\w{3})\\s+\\d+/);
          const hasReservation = text.includes('Reservation:');
          const textLength = text.length;
          
          if (hasShip && hasNight && hasDate && textLength > 200 && textLength < 3000) {
            cruiseCards.push(parent);
            processedElements.add(parent);
            break;
          }
        }
      }
      
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
          message: 'WARNING: Found ' + cruiseCards.length + ' but expected ' + expectedCount,
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
          message: 'Processing cruise ' + (i + 1) + '/' + cruiseCards.length,
          logType: 'info'
        }));

        const shipMatch = fullText.match(/([\\w\\s]+of the Seas)/);
        const shipName = shipMatch ? shipMatch[1].trim() : '';

        const cruiseTitleMatch = fullText.match(/(\\d+)\\s+Night\\s+([^\\n]+?)(?=\\n|$)/);
        const cruiseTitle = cruiseTitleMatch ? cruiseTitleMatch[0].trim() : '';

        const dateMatch = fullText.match(/(\\w{3})\\s+(\\d+)\\s*—\\s*(\\w{3})\\s+(\\d+),?\\s*(\\d{4})/);
        let sailingStartDate = '';
        let sailingEndDate = '';
        let year = '';
        
        if (dateMatch) {
          year = dateMatch[5];
          sailingStartDate = parseDate(dateMatch[1] + ' ' + dateMatch[2], year);
          sailingEndDate = dateMatch[3] + ' ' + dateMatch[4] + ', ' + year;
        }

        const itineraryMatch = fullText.match(/([A-Z][A-Z\\s,]+?)(?=\\||Reservation|Interior|Balcony|Suite|Ocean View|GTY|\\d+ Gty)/i);
        let itinerary = itineraryMatch ? itineraryMatch[1].trim() : '';
        
        if (itinerary.length > 100) {
          const shortMatch = fullText.match(/([A-Z][A-Z\\s]{10,60})\\s*\\|/);
          itinerary = shortMatch ? shortMatch[1].trim() : itinerary;
        }

        const reservationMatch = fullText.match(/Reservation:\\s*(\\d+)/);
        const bookingId = reservationMatch ? reservationMatch[1] : '';

        const cabinMatches = fullText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite|GTY|Gty)([^\\n]*?)(?=(\\d{4,5})|$)/i);
        let cabinType = '';
        let cabinNumber = '';
        
        if (cabinMatches) {
          cabinType = cabinMatches[1].trim();
          const cabinNumMatch = fullText.match(/(Interior|Balcony|Suite|Ocean View|GTY|Gty)[^\\n]*?(\\d{4,5})/);
          if (cabinNumMatch) {
            cabinNumber = cabinNumMatch[2];
          }
        }

        const guestsMatch = fullText.match(/(\\d+)\\s+Guest/i);
        const numberOfGuests = guestsMatch ? guestsMatch[1] : '';

        const daysMatch = fullText.match(/(\\d+)\\s+Days?\\s+to\\s+go/i);
        const daysToGo = daysMatch ? daysMatch[1] : '';

        if (shipName && cruiseTitle) {
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
            message: 'Scraped: ' + shipName + ' - ' + cruiseTitle + ' (Res: ' + bookingId + ')',
            logType: 'info'
          }));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: processedCount,
            total: cruiseCards.length,
            stepName: 'Upcoming Cruises (' + processedCount + ' scraped)'
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
        message: 'Extracted ' + cruises.length + ' cruises (expected ' + expectedCount + ')',
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
