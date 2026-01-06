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

      await wait(3000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page loaded, extracting Crown & Anchor loyalty from header...',
        logType: 'info'
      }));
      
      let crownAndAnchorLevel = '';
      let crownAndAnchorPoints = '';
      
      const headerSelectors = [
        'header',
        'nav',
        '[class*="header"]',
        '[class*="Header"]',
        '[class*="navigation"]',
        '[role="banner"]'
      ];
      
      for (const selector of headerSelectors) {
        const headers = document.querySelectorAll(selector);
        headers.forEach(header => {
          const headerText = header.textContent?.trim() || '';
          
          if (headerText.match(/Diamond Plus|Diamond|Platinum Plus|Platinum|Gold Plus|Gold|Silver|Emerald/i)) {
            const levelMatch = headerText.match(/(Diamond Plus|Diamond|Platinum Plus|Platinum|Gold Plus|Gold|Silver|Emerald)/i);
            if (levelMatch && !crownAndAnchorLevel) {
              crownAndAnchorLevel = levelMatch[1];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found Crown & Anchor level in header: ' + crownAndAnchorLevel,
                logType: 'info'
              }));
            }
          }
          
          if (headerText.match(/\d+\s*(nights?|cruise points?)/i)) {
            const pointsMatch = headerText.match(/(\d+)\s*(nights?|cruise points?)/i);
            if (pointsMatch && !crownAndAnchorPoints) {
              crownAndAnchorPoints = pointsMatch[1];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found Crown & Anchor points/nights in header: ' + crownAndAnchorPoints,
                logType: 'info'
              }));
            }
          }
        });
        
        if (crownAndAnchorLevel && crownAndAnchorPoints) break;
      }
      
      if (crownAndAnchorLevel || crownAndAnchorPoints) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'loyalty_data',
          data: {
            crownAndAnchorLevel: crownAndAnchorLevel,
            crownAndAnchorPoints: crownAndAnchorPoints
          }
        }));
      }
      
      const allElements = document.querySelectorAll('*');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'DOM has ' + allElements.length + ' total elements',
        logType: 'info'
      }));
      
      let cruiseCards = document.querySelectorAll('[data-testid*="cruise"], [class*="cruise-card"], [class*="cruise"], [class*="Cruise"], [class*="booking"], [class*="reservation"], [class*="trip"], [class*="upcoming"]');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Initial search found ' + cruiseCards.length + ' cruise cards',
        logType: 'info'
      }));
      
      if (cruiseCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No cruises with class selectors, searching for cards with ship names...',
          logType: 'warning'
        }));
        
        const allElements = document.querySelectorAll('section, article, [class*="card"], main > div > div, div[class*="container"]');
        const potentialCards = [];
        
        allElements.forEach(el => {
          const text = el.textContent || '';
          if (text.match(/of the [A-Z][a-z]+/i) && text.match(/RESERVATION|Booking|\d{4,5}/i)) {
            potentialCards.push(el);
          }
        });
        
        cruiseCards = potentialCards;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found ' + cruiseCards.length + ' cards with ship names and booking info',
          logType: 'info'
        }));
      }
      
      console.log('[STEP2] Starting scroll');
      await scrollUntilComplete(15);

      console.log('[STEP2] Scroll complete, looking for cards');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting cruise cards...',
        logType: 'info'
      }));
      
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
        
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(500);

        const viewMoreBtn = Array.from(card.querySelectorAll('button, a, [role="button"]')).find(el => 
          el.textContent?.match(/View More Details|More Details|View Details|Details|Expand/i)
        );

        if (viewMoreBtn) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Clicking View More Details for cruise ' + (i + 1),
            logType: 'info'
          }));
          
          viewMoreBtn.click();
          await wait(1500);
          
          await scrollUntilComplete(5);
          await wait(500);
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'No View More button for cruise ' + (i + 1) + ', card may already be expanded',
            logType: 'info'
          }));
        }

        const cardText = card.textContent || '';
        const cardHTML = card.innerHTML || '';

        const shipNameEl = extractText(card, '[data-testid*="ship"], [class*="ship"], h1, h2, h3');
        const shipMatch = cardText.match(/([A-Z][a-z]+ of the [A-Z][a-z]+)/i);
        const shipName = shipNameEl || (shipMatch ? shipMatch[1] : '');
        
        const dateMatches = cardText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*—\s*|\s*-\s*|\s+to\s+)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*\d{1,2},?\s*\d{4}/i);
        let sailingStartDate = '';
        let sailingEndDate = '';
        
        if (dateMatches) {
          const parts = dateMatches[0].split(/—|-|\s+to\s+/i);
          sailingStartDate = parts[0].trim();
          sailingEndDate = parts[1]?.trim() || '';
        }
        
        const nightMatch = cardText.match(/(\d+)\s*Night/i);
        const nights = nightMatch ? nightMatch[1] : '';
        
        const itineraryMatch = cardText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+[|]\s+[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)*)/);
        const itinerary = itineraryMatch ? itineraryMatch[0] : extractText(card, '[data-testid*="itinerary"], [class*="itinerary"], [class*="destination"]');
        
        const portMatch = cardText.match(/(Vancouver|Seattle|Fort Lauderdale|Miami|San Juan|Los Angeles|Galveston|New York|Baltimore|Tampa|Port Canaveral|Cape Liberty|Boston|Honolulu|San Diego|New Orleans)/i);
        const departurePort = portMatch ? portMatch[0] : extractText(card, '[data-testid*="port"], [class*="port"], [class*="departure"]');
        
        const cabinType = extractText(card, '[data-testid*="cabin"], [data-testid*="stateroom"], [class*="cabin"], [class*="stateroom"]') ||
                         (cardText.match(/(Interior|Ocean View|Balcony|Suite|Junior Suite|Grand Suite|Royal Suite|Owner's Suite)/i) || [])[0] || '';
        
        const reservationMatch = cardText.match(/RESERVATION[\s\n:]+(\d+)/i) || cardHTML.match(/reservation[^>]*>(\d+)/i) || cardText.match(/Booking\s*#?:?\s*(\d+)/i);
        const bookingId = reservationMatch ? reservationMatch[1] : '';
        
        const cabinNumberMatch = cardText.match(/(?:Cabin|Stateroom|Room)\s*#?:?\s*(\d{4,5})/i) || cardText.match(/\b(\d{4,5})\b/);
        const cabinNumber = cabinNumberMatch ? cabinNumberMatch[1] : '';

        const guestMatch = cardText.match(/Guests?[\s\n:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)/i);
        const guests = guestMatch ? guestMatch[1] : '';

        if ((shipName || bookingId) && sailingStartDate) {
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
            loyaltyLevel: crownAndAnchorLevel,
            loyaltyPoints: crownAndAnchorPoints
          });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracted cruise: ' + shipName + ' - ' + sailingStartDate,
            logType: 'success'
          }));
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
