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

      let cruiseCards = document.querySelectorAll('[data-testid*="cruise"], [class*="cruise-card"], [class*="booking"]');
      
      if (cruiseCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No cruises found with primary selectors, trying broader search...',
          logType: 'warning'
        }));
        
        cruiseCards = document.querySelectorAll('[class*="cruise"], [class*="Cruise"], [class*="trip"], [class*="booking"], article, .card');
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + cruiseCards.length + ' potential cruise elements',
        logType: 'info'
      }));
      
      const cruises = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < cruiseCards.length; i++) {
        try {
          const card = cruiseCards[i];

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Processing cruise card ' + (i + 1) + ' of ' + cruiseCards.length + '...',
            logType: 'info'
          }));

          const viewDetailsBtn = Array.from(card.querySelectorAll('button, a')).find(el => 
            el.textContent?.match(/View.*Details?|Additional Details|Show Details/i)
          );

          if (viewDetailsBtn) {
            try {
              viewDetailsBtn.click();
              await wait(2000);
            } catch (clickError) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Could not click View Details button on card ' + (i + 1) + ', continuing anyway',
                logType: 'warning'
              }));
            }
          }

          const shipName = extractText(card, '[data-testid*="ship"], [class*="ship"]');
          const sailingStartDate = extractText(card, '[data-testid*="start"], [data-testid*="departure"]');
          const sailingEndDate = extractText(card, '[data-testid*="end"], [data-testid*="return"]');
          const itinerary = extractText(card, '[data-testid*="itinerary"], [class*="itinerary"]');
          const departurePort = extractText(card, '[data-testid*="port"], [class*="port"]');
          const cabinType = extractText(card, '[data-testid*="cabin"], [data-testid*="stateroom"]');
          const cabinNumber = extractText(card, '[data-testid*="cabin-number"], [data-testid*="room-number"]');
          const bookingId = extractText(card, '[data-testid*="booking"], [data-testid*="reservation"]');

          if (!shipName && !sailingStartDate && !bookingId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Card ' + (i + 1) + ' appears to be empty or not a cruise card, skipping',
              logType: 'warning'
            }));
            skippedCount++;
            continue;
          }

          cruises.push({
            sourcePage: 'Upcoming',
            shipName: shipName,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? \`\${sailingStartDate} - \${sailingEndDate}\` : '',
            itinerary: itinerary,
            departurePort: departurePort,
            cabinType: cabinType,
            cabinNumberOrGTY: cabinNumber || (cabinType.includes('GTY') ? 'GTY' : ''),
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

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Successfully extracted cruise card ' + (i + 1) + ' (' + cruises.length + ' total cruises)',
            logType: 'success'
          }));

        } catch (cardError) {
          skippedCount++;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Error processing card ' + (i + 1) + ': ' + cardError.message + '. Skipping and continuing...',
            logType: 'error'
          }));
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: cruises
      }));

      if (skippedCount > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Skipped ' + skippedCount + ' invalid or empty cards',
          logType: 'warning'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracted ' + cruises.length + ' upcoming cruises from ' + cruiseCards.length + ' cards',
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
