export const STEP3_HOLDS_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(maxAttempts = 15) {
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
      window.scrollBy(0, 500);
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

  async function extractCourtesyHolds() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Loading Courtesy Holds page...',
        logType: 'info'
      }));

      await wait(3000);
      await scrollUntilComplete(15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing courtesy holds...',
        logType: 'info'
      }));

      const countText = document.body.textContent || '';
      const countMatch = countText.match(/You have (\\d+) courtesy hold/i);
      const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Expected holds: ' + expectedCount,
        logType: 'info'
      }));

      if (expectedCount === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'step_complete',
          step: 3,
          data: [],
          totalCount: 0
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No courtesy holds found',
          logType: 'success'
        }));
        return;
      }

      const allElements = Array.from(document.querySelectorAll('div, article, section, [class*="card"], [class*="hold"], [class*="courtesy"]'));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📊 Scanning ' + allElements.length + ' elements for hold cards...',
        logType: 'info'
      }));

      let holdCards = allElements.filter(el => {
        const text = el.textContent || '';
        const hasShip = text.includes('of the Seas');
        const hasNight = text.match(/\\d+\\s+Night/i);
        const hasReservation = text.match(/Reservation[:\\s]*\\d+/i);
        const hasExpires = text.match(/Expires[:\\s]*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/i) || text.includes('Expires') || text.includes('EXPIRES');
        const hasCourtesy = text.includes('Courtesy') || text.includes('Hold') || text.includes('COURTESY') || text.includes('HOLD');
        const isReasonablySmall = text.length > 50 && text.length < 4000;
        
        const passes = hasShip && hasNight && hasReservation && (hasExpires || hasCourtesy) && isReasonablySmall;
        
        if (!passes && hasShip && hasReservation) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  🔍 Filtered element (ship=' + hasShip + ', night=' + hasNight + ', res=' + hasReservation + ', expires=' + hasExpires + ', courtesy=' + hasCourtesy + ', size=' + text.length + ')',
            logType: 'info'
          }));
        }
        
        return passes;
      }).filter((el, idx, arr) => {
        return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
      }).sort((a, b) => a.textContent.length - b.textContent.length);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📊 HOLD COUNT: Found ' + holdCards.length + ' / Expected ' + expectedCount,
        logType: holdCards.length === expectedCount ? 'success' : 'warning'
      }));
      
      const holds = [];
      let processedCount = 0;

      for (let i = 0; i < holdCards.length; i++) {
        const card = holdCards[i];
        const fullText = card.textContent || '';

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '━━━━━ Hold ' + (i + 1) + '/' + holdCards.length + ' ━━━━━',
          logType: 'info'
        }));

        const cruiseTitleMatch = fullText.match(/(\\d+)\\s+[Nn]ight\\s+([^\\n]+?)(?=\\n|$|Reservation)/i);
        let cruiseTitle = cruiseTitleMatch ? cruiseTitleMatch[0].trim() : '';
        
        if (!cruiseTitle) {
          const alternateMatch = fullText.match(/(\\d+)\\s+[Nn]ight\\s+[\\w\\s&]+/i);
          if (alternateMatch) {
            cruiseTitle = alternateMatch[0].trim();
          }
        }
        
        if (cruiseTitle.includes('of the Seas')) {
          const parts = cruiseTitle.split(/(?=[A-Z][a-z]+\\s+of the Seas)/);
          if (parts.length > 0) {
            cruiseTitle = parts[0].trim();
          }
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Title: ' + (cruiseTitle || '[NOT FOUND]'),
          logType: cruiseTitle ? 'info' : 'warning'
        }));

        const shipMatch = fullText.match(/([\\w\\s]+of the Seas)/);
        const shipName = shipMatch ? shipMatch[1].trim() : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Ship: ' + (shipName || '[NOT FOUND]'),
          logType: shipName ? 'info' : 'warning'
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

        const reservationMatch = fullText.match(/Reservation[:\\s]*(\\d+)/i);
        const bookingId = reservationMatch ? reservationMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Reservation: ' + (bookingId || '[NOT FOUND]'),
          logType: bookingId ? 'info' : 'warning'
        }));

        const expiresMatch = fullText.match(/Expires[:\\s]*(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})/i);
        const holdExpiration = expiresMatch ? expiresMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Expiration: ' + (holdExpiration || '[NOT FOUND]'),
          logType: holdExpiration ? 'info' : 'warning'
        }));

        if (shipName && cruiseTitle && bookingId) {
          const hold = {
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
            status: 'Courtesy Hold',
            holdExpiration: holdExpiration,
            loyaltyLevel: '',
            loyaltyPoints: ''
          };
          
          holds.push(hold);
          processedCount++;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ✓ Hold scraped successfully (' + processedCount + '/' + expectedCount + ')',
            logType: 'success'
          }));
          
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
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ❌ SKIPPED - Missing fields: ship=' + !!shipName + ', title=' + !!cruiseTitle + ', booking=' + !!bookingId,
            logType: 'error'
          }));
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  📝 Card text preview: ' + fullText.substring(0, 200) + '...',
            logType: 'info'
          }));
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 3,
        data: holds,
        totalCount: holds.length
      }));

      const statusType = holds.length === expectedCount ? 'success' : 'warning';
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '✓ Extracted ' + holds.length + ' holds (expected ' + expectedCount + ')',
        logType: statusType
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract courtesy holds: ' + error.message
      }));
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
