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
      console.log('[STEP2] Starting extraction');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Upcoming Cruises extraction...',
        logType: 'info'
      }));

      await wait(2000);
      console.log('[STEP2] Starting scroll');
      await scrollUntilComplete(15);

      console.log('[STEP2] Scroll complete, looking for cards');
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
      
      console.log('[STEP2] Found', cruiseCards.length, 'cards');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + cruiseCards.length + ' potential cruise elements',
        logType: 'info'
      }));
      
      const cruises = [];
      let processedCount = 0;

      if (cruiseCards.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Processing ' + cruiseCards.length + ' cruise cards...',
          logType: 'info'
        }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No cruise cards found to process',
          logType: 'warning'
        }));
      }

      for (let i = 0; i < cruiseCards.length; i++) {
        const card = cruiseCards[i];

        const cardText = card.textContent || '';
        const cardHTML = card.innerHTML || '';

        const shipName = extractText(card, '[data-testid*="ship"], [class*="ship"]') || 
                        (cardHTML.match(/([A-Z][a-z]+ of the [A-Z][a-z]+|Anthem of the Seas|Legend of the Seas)/i) || [])[0] || '';
        
        const dateMatches = cardText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*—\s*|\s*-\s*)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{1,2},?\s*\d{4}/i);
        let sailingStartDate = '';
        let sailingEndDate = '';
        
        if (dateMatches) {
          sailingStartDate = dateMatches[0].split(/—|-/)[0].trim();
          sailingEndDate = dateMatches[0].split(/—|-/)[1]?.trim() || '';
        }
        
        const nightMatch = cardText.match(/(\d+)\s*Night/i);
        const nights = nightMatch ? nightMatch[1] : '';
        
        const itineraryMatch = cardText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+[|]\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)*)/);
        const itinerary = itineraryMatch ? itineraryMatch[0] : extractText(card, '[data-testid*="itinerary"], [class*="itinerary"]');
        
        const portMatch = cardText.match(/(Vancouver|Seattle|Fort Lauderdale|Miami|San Juan|Los Angeles|Galveston|New York|Baltimore|Tampa|Port Canaveral|Cape Liberty|Boston)/i);
        const departurePort = portMatch ? portMatch[0] : extractText(card, '[data-testid*="port"], [class*="port"]');
        
        const cabinType = extractText(card, '[data-testid*="cabin"], [data-testid*="stateroom"]') ||
                         (cardText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite|Grand Suite)/i) || [])[0] || '';
        
        const reservationMatch = cardText.match(/RESERVATION[\s\n]+(\d+)/i) || cardHTML.match(/reservation[^>]*>(\d+)/i);
        const bookingId = reservationMatch ? reservationMatch[1] : '';
        
        const cabinNumberMatch = cardText.match(/\b\d{4,5}\b/);
        const cabinNumber = cabinNumberMatch ? cabinNumberMatch[0] : '';

        const guestMatch = cardText.match(/Guests?[\s\n]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
        const guests = guestMatch ? guestMatch[1] : '';

        if (shipName || bookingId) {
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
        }
        
        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: cruiseCards.length,
          stepName: 'Upcoming Cruises'
        }));
      }

      console.log('[STEP2] Finished processing, found', cruises.length, 'valid cruises');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Finished processing cards, found ' + cruises.length + ' valid cruises',
        logType: 'info'
      }));

      console.log('[STEP2] Sending step_complete');
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
      console.error('[STEP2] Error:', error);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract upcoming cruises: ' + error.message
      }));
    }
  }

  console.log('[STEP2] Script loaded, readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[STEP2] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', extractUpcomingCruises);
  } else {
    console.log('[STEP2] Running immediately');
    extractUpcomingCruises();
  }
})();
`;

export function injectUpcomingCruisesExtraction() {
  return STEP2_UPCOMING_SCRIPT;
}
