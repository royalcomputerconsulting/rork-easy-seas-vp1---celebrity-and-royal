export const STEP3_HOLDS_SCRIPT = `
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

  async function extractCourtesyHolds() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Courtesy Holds extraction...',
        logType: 'info'
      }));

      await wait(3000);
      await scrollUntilComplete(15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting holds...',
        logType: 'info'
      }));

      let holdCards = document.querySelectorAll('[data-testid*="hold"], [class*="hold-card"], [class*="hold"], [class*="Hold"], [class*="courtesy"], [class*="Courtesy"]');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Initial search found ' + holdCards.length + ' hold cards',
        logType: 'info'
      }));
      
      if (holdCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No holds with class selectors, searching for cards with ship names and hold indicators...',
          logType: 'warning'
        }));
        
        const allElements = document.querySelectorAll('section, article, [class*="card"], main > div > div, div[class*="container"]');
        const potentialHolds = [];
        
        allElements.forEach(el => {
          const text = el.textContent || '';
          if (text.match(/of the [A-Z][a-z]+/i) && (text.match(/hold|courtesy|expir|expires/i) || text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).*\d{4}/i))) {
            potentialHolds.push(el);
          }
        });
        
        holdCards = potentialHolds;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found ' + holdCards.length + ' cards with ship names and hold/date info',
          logType: 'info'
        }));
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + holdCards.length + ' potential hold elements',
        logType: 'info'
      }));
      
      const holds = [];
      let processedCount = 0;

      for (let i = 0; i < holdCards.length; i++) {
        const card = holdCards[i];
        
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(500);
        
        const expandBtn = Array.from(card.querySelectorAll('button, a, [role="button"]')).find(el => 
          el.textContent?.match(/View More|Details|Expand/i)
        );
        
        if (expandBtn) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Expanding hold card ' + (i + 1),
            logType: 'info'
          }));
          expandBtn.click();
          await wait(1500);
        }
        
        const cardText = card.textContent || '';
        const cardHTML = card.innerHTML || '';

        const shipMatch = cardText.match(/([A-Z][a-z]+ of the [A-Z][a-z]+)/i);
        const shipName = shipMatch ? shipMatch[1] : extractText(card, '[data-testid*="ship"], [class*="ship"], h1, h2, h3');
        
        const dateMatches = cardText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*—\s*|\s*-\s*|\s+to\s+)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{1,2},?\s*\d{4}/i);
        let sailingStartDate = '';
        let sailingEndDate = '';
        
        if (dateMatches) {
          const parts = dateMatches[0].split(/—|-|\s+to\s+/i);
          sailingStartDate = parts[0].trim();
          sailingEndDate = parts[1]?.trim() || '';
        }
        
        const itineraryMatch = cardText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+[|]\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)*)/);
        const itinerary = itineraryMatch ? itineraryMatch[0] : extractText(card, '[data-testid*="itinerary"], [class*="itinerary"]');
        
        const portMatch = cardText.match(/(Vancouver|Seattle|Fort Lauderdale|Miami|San Juan|Los Angeles|Galveston|New York|Baltimore|Tampa|Port Canaveral|Cape Liberty|Boston|Honolulu|San Diego|New Orleans)/i);
        const departurePort = portMatch ? portMatch[0] : extractText(card, '[data-testid*="port"], [class*="port"]');
        
        const cabinType = extractText(card, '[data-testid*="cabin"], [data-testid*="stateroom"], [class*="cabin"], [class*="stateroom"]') ||
                         (cardText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite|Grand Suite)/i) || [])[0] || '';
        
        const expiryMatch = cardText.match(/expir[^\n]*?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/i) || 
                           cardText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}/i);
        const holdExpiration = expiryMatch ? expiryMatch[0] : extractText(card, '[data-testid*="expir"], [class*="expir"]');
        
        const holdIdMatch = cardText.match(/hold[^\n]*?(\d{5,})/i) || cardText.match(/reference[^\n]*?(\d{5,})/i);
        const bookingId = holdIdMatch ? holdIdMatch[1] : extractText(card, '[data-testid*="hold-id"], [data-testid*="reference"]');

        if (shipName || sailingStartDate || holdExpiration) {
          holds.push({
            sourcePage: 'Courtesy',
            shipName: shipName,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? \`\${sailingStartDate} - \${sailingEndDate}\` : '',
            itinerary: itinerary,
            departurePort: departurePort,
            cabinType: cabinType,
            cabinNumberOrGTY: 'Hold',
            bookingId: bookingId,
            status: 'Courtesy Hold',
            loyaltyLevel: '',
            loyaltyPoints: ''
          });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracted courtesy hold: ' + shipName,
            logType: 'success'
          }));
        }

        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: holdCards.length,
          stepName: 'Courtesy Holds'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 3,
        data: holds
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Extracted \${holds.length} courtesy holds\`,
        logType: 'success'
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
