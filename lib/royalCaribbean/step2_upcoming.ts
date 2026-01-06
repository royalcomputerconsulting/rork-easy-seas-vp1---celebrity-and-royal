export const STEP2_UPCOMING_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(maxAttempts = 10) {
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
      await wait(1000);
      attempts++;
    }
  }

  function extractText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el?.textContent?.trim() || '';
  }

  async function extractUpcomingCruises() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Upcoming Cruises extraction...',
        logType: 'info'
      }));

      await wait(3000);
      await scrollUntilComplete(15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting cruise cards...',
        logType: 'info'
      }));

      const countText = document.body.textContent || '';
      const countMatch = countText.match(/You have (\d+) upcoming cruise/i);
      const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page says there are ' + expectedCount + ' cruises',
        logType: 'info'
      }));

      let cruiseCards = Array.from(document.querySelectorAll('a[href*="/account/upcoming-cruises/"]')).map(a => {
        let parent = a;
        for (let i = 0; i < 10; i++) {
          parent = parent.parentElement;
          if (!parent) break;
          const hasShip = parent.textContent?.includes('of the Seas') || parent.textContent?.includes('Night');
          const hasDate = parent.textContent?.match(/\w+ \d+.*\d{4}/);
          if (hasShip && hasDate) return parent;
        }
        return a.closest('article') || a.closest('[class*="card"]') || a.parentElement;
      }).filter((el, idx, arr) => arr.indexOf(el) === idx);
      
      if (cruiseCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No link-based cards found, trying text search...',
          logType: 'warning'
        }));
        
        const allElements = document.querySelectorAll('div, article, section');
        cruiseCards = Array.from(allElements).filter(el => {
          const text = el.textContent || '';
          const hasShip = text.includes('of the Seas');
          const hasNight = text.match(/\d+\s+Night/);
          const hasDate = text.match(/\w+ \d+.*\d{4}/);
          const isReasonablySmall = text.length < 2000;
          return hasShip && hasNight && hasDate && isReasonablySmall;
        }).sort((a, b) => a.textContent.length - b.textContent.length).filter((el, idx, arr) => {
          return !arr.some((other, otherIdx) => otherIdx < idx && other.contains(el));
        });
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + cruiseCards.length + ' cruise cards',
        logType: 'info'
      }));
      
      const cruises = [];
      let processedCount = 0;

      for (let i = 0; i < cruiseCards.length; i++) {
        const card = cruiseCards[i];
        const fullText = card.textContent || '';

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Processing card ' + (i + 1) + ': ' + fullText.substring(0, 100) + '...',
          logType: 'info'
        }));

        const shipMatch = fullText.match(/([\w\s]+of the Seas)/);
        const shipName = shipMatch ? shipMatch[1].trim() : '';

        const nightsMatch = fullText.match(/(\d+)\s+Night\s+([^\n]+)/);
        const itinerary = nightsMatch ? nightsMatch[0].trim() : '';

        const dateMatch = fullText.match(/(\w+ \d+)\s*—\s*(\w+ \d+,\s*\d{4})/);
        let sailingStartDate = '';
        let sailingEndDate = '';
        if (dateMatch) {
          sailingStartDate = dateMatch[1];
          sailingEndDate = dateMatch[2];
        }

        const portsMatch = fullText.match(/([A-Z][A-Za-z\s,]+)\s*\|/);
        const departurePort = portsMatch ? portsMatch[1].trim() : '';

        const reservationMatch = fullText.match(/Reservation:\s*(\d+)/);
        const bookingId = reservationMatch ? reservationMatch[1] : '';

        const cabinMatch = fullText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite)[^\n]*/i);
        const cabinType = cabinMatch ? cabinMatch[0].trim() : '';

        if (shipName || itinerary) {
          cruises.push({
            sourcePage: 'Upcoming',
            shipName: shipName,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? \`\${sailingStartDate} - \${sailingEndDate}\` : '',
            itinerary: itinerary,
            departurePort: departurePort,
            cabinType: cabinType,
            cabinNumberOrGTY: '',
            bookingId: bookingId,
            status: 'Upcoming',
            loyaltyLevel: '',
            loyaltyPoints: ''
          });

          processedCount++;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: processedCount,
            total: cruiseCards.length,
            stepName: 'Upcoming Cruises'
          }));
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: cruises
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Extracted \${cruises.length} upcoming cruises\`,
        logType: 'success'
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
