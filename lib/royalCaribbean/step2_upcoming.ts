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

  function extractTextMultiple(element, selectors) {
    if (!element) return '';
    for (const selector of selectors) {
      const text = extractText(element, selector);
      if (text) return text;
    }
    return '';
  }

  function extractFromPatterns(card) {
    const allText = card.textContent || '';
    const result = {};
    
    const shipMatch = allText.match(/^([^|]+?)\s*\|\s*[A-Za-z]{3}\s+\d{1,2}/);
    if (shipMatch) result.shipName = shipMatch[1].trim();
    
    const dateMatch = allText.match(/([A-Za-z]{3}\s+\d{1,2})\s*—\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4})/);
    if (dateMatch) {
      result.startDate = dateMatch[1];
      result.endDate = dateMatch[2];
    }
    
    const reservationMatch = allText.match(/RESERVATION\s*([\d]{6,8})/);
    if (reservationMatch) result.bookingId = reservationMatch[1];
    
    const nightsMatch = allText.match(/(\d+)\s*Night/);
    if (nightsMatch) result.nights = nightsMatch[1];
    
    return result;
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

          const patterns = extractFromPatterns(card);
          
          const shipName = patterns.shipName || extractTextMultiple(card, [
            '[data-testid*="ship"]',
            '[class*="ship"]',
            'h1',
            '[class*="title"]:first-child'
          ]);
          
          const sailingStartDate = patterns.startDate || extractTextMultiple(card, [
            '[data-testid*="start"]',
            '[data-testid*="departure"]',
            '[class*="date"]'
          ]);
          
          const sailingEndDate = patterns.endDate || extractTextMultiple(card, [
            '[data-testid*="end"]',
            '[data-testid*="return"]'
          ]);
          
          const itinerary = extractTextMultiple(card, [
            '[data-testid*="itinerary"]',
            '[class*="itinerary"]',
            'h2',
            '[class*="title"]:nth-child(2)'
          ]);
          
          const departurePort = extractTextMultiple(card, [
            '[data-testid*="port"]',
            '[class*="port"]',
            '[class*="location"]'
          ]);
          
          const cabinType = extractTextMultiple(card, [
            '[data-testid*="cabin"]',
            '[data-testid*="stateroom"]',
            '[class*="cabin"]',
            '[class*="room"]'
          ]);
          
          const cabinNumber = extractTextMultiple(card, [
            '[data-testid*="cabin-number"]',
            '[data-testid*="room-number"]'
          ]);
          
          const bookingId = patterns.bookingId || extractTextMultiple(card, [
            '[data-testid*="booking"]',
            '[data-testid*="reservation"]',
            '[class*="reservation"]'
          ]);
          
          let guests = extractTextMultiple(card, [
            '[data-testid*="guest"]',
            '[class*="guest"]'
          ]);

          if (!shipName && !sailingStartDate && !bookingId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Card ' + (i + 1) + ' appears to be empty or not a cruise card (no ship, dates, or booking ID found), skipping',
              logType: 'warning'
            }));
            skippedCount++;
            continue;
          }
          
          if (!bookingId) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Card ' + (i + 1) + ' has no booking ID but has other data, will still include',
              logType: 'warning'
            }));
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
