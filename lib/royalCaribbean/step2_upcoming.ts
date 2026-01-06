export const STEP2_UPCOMING_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(maxAttempts = 8) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 2 && attempts < maxAttempts) {
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
    const cruises = [];
    const startTime = Date.now();
    const maxExecutionTime = 50000;
    
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Upcoming Cruises extraction...',
        logType: 'info'
      }));

      await wait(2000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Current URL: ' + window.location.href,
        logType: 'info'
      }));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page HTML sample (first 500 chars): ' + document.body.innerHTML.substring(0, 500),
        logType: 'info'
      }));
      
      await scrollUntilComplete(8);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting cruise cards...',
        logType: 'info'
      }));

      let cruiseCards = document.querySelectorAll('[data-testid*="cruise"], [class*="cruise-card"], [class*="booking-card"]');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Primary selectors found: ' + cruiseCards.length + ' elements',
        logType: 'info'
      }));
      
      if (cruiseCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No cruises found with primary selectors, trying broader search...',
          logType: 'warning'
        }));
        
        cruiseCards = document.querySelectorAll('[class*="cruise"], [class*="Cruise"], [class*="trip"], [class*="booking"], article, .card');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Broader selectors found: ' + cruiseCards.length + ' elements',
          logType: 'info'
        }));
      }
      
      const filteredCards = Array.from(cruiseCards).filter(card => {
        const text = card.textContent?.toLowerCase() || '';
        const textLength = text.length;
        
        if (textLength < 50) return false;
        
        const hasReservation = text.includes('reservation') || /\d{6,8}/.test(text);
        const hasShip = text.match(/symphony|harmony|oasis|allure|wonder|anthem|quantum|legend|adventure|of the seas/i);
        const hasDate = text.match(/[a-z]{3}\s+\d{1,2}[,\s]+\d{4}/i) || text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
        const hasNights = text.match(/\d+\s*night/i);
        const hasPort = text.match(/port|miami|galveston|fort lauderdale|cape canaveral|new york|baltimore|seattle/i);
        
        const childElements = card.children.length;
        if (childElements < 2) return false;
        
        const validCombination = (
          (hasShip && hasDate && hasNights) ||
          (hasReservation && hasDate && hasNights) ||
          (hasShip && hasReservation && hasNights) ||
          (hasShip && hasPort && hasNights)
        );
        
        return validCombination;
      });
      
      cruiseCards = filteredCards;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'After filtering: ' + cruiseCards.length + ' valid cruise elements (filtered from ' + Array.from(document.querySelectorAll('[data-testid*="cruise"], [class*="cruise-card"], [class*="booking-card"]')).length + ' initial elements)',
        logType: 'info'
      }));
      
      if (cruiseCards.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'First card sample: ' + (cruiseCards[0].textContent?.substring(0, 300) || 'No text'),
          logType: 'info'
        }));
      }
      
      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < cruiseCards.length; i++) {
        try {
          if (Date.now() - startTime > maxExecutionTime) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Time limit reached at card ' + (i + 1) + ', completing with ' + cruises.length + ' cruises',
              logType: 'warning'
            }));
            break;
          }
          const card = cruiseCards[i];

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Processing cruise card ' + (i + 1) + ' of ' + cruiseCards.length + '...',
            logType: 'info'
          }));

          try {
            let viewDetailsButton = null;
            const allButtons = card.querySelectorAll('button, a');
            for (let btn of allButtons) {
              const text = (btn.textContent || '').toLowerCase();
              const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
              const btnClass = (btn.className || '').toLowerCase();
              
              if ((text.includes('view') && text.includes('detail')) || 
                  (ariaLabel.includes('view') && ariaLabel.includes('detail')) || 
                  btnClass.includes('detail')) {
                viewDetailsButton = btn;
                break;
              }
            }
            
            if (viewDetailsButton) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found View Details button for card ' + (i + 1) + ', clicking once to expand...',
                logType: 'info'
              }));
              
              const cardRect = card.getBoundingClientRect();
              const isInView = cardRect.top >= 0 && cardRect.bottom <= window.innerHeight;
              
              if (!isInView) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await wait(500);
              }
              
              viewDetailsButton.click();
              await wait(1200);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Card ' + (i + 1) + ' expanded, extracting data...',
                logType: 'info'
              }));
            } else {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'No View Details button found for card ' + (i + 1) + ', will try to extract visible data',
                logType: 'warning'
              }));
            }
          } catch (clickError) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Could not click View Details for card ' + (i + 1) + ': ' + clickError.message + ', will try to extract visible data',
              logType: 'warning'
            }));
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

          const hasMinimumData = (
            (shipName && sailingStartDate) ||
            (bookingId && sailingStartDate) ||
            (shipName && bookingId)
          );
          
          if (!hasMinimumData) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Card ' + (i + 1) + ' appears to be empty or not a cruise card (no ship, dates, or booking ID found), skipping',
              logType: 'info'
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
        type: 'log',
        message: 'Error in extraction: ' + error.message + ', sending what we have (' + cruises.length + ' cruises)',
        logType: 'error'
      }));
    } finally {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: cruises
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Step 2 extraction completed (final count: ' + cruises.length + ' cruises)',
        logType: 'info'
      }));
    }
  }

  let scriptCompleted = false;
  
  setTimeout(() => {
    if (!scriptCompleted) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Safety timeout triggered - completing step with partial data',
        logType: 'warning'
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 2,
        data: []
      }));
    }
  }, 55000);
  
  setTimeout(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        extractUpcomingCruises().finally(() => { scriptCompleted = true; });
      });
    } else {
      extractUpcomingCruises().finally(() => { scriptCompleted = true; });
    }
  }, 500);
})();
`;

export function injectUpcomingCruisesExtraction() {
  return STEP2_UPCOMING_SCRIPT;
}
