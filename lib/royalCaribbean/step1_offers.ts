export const STEP1_OFFERS_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(container, maxAttempts = 10) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 3 && attempts < maxAttempts) {
      const currentHeight = container ? container.scrollHeight : document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      
      if (container) {
        container.scrollBy(0, 500);
      } else {
        window.scrollBy(0, 500);
      }
      
      await wait(1000);
      attempts++;
    }
  }

  function extractText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el?.textContent?.trim() || '';
  }

  async function extractOffers() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Club Royale Offers extraction...',
        logType: 'info'
      }));

      await wait(3000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page loaded, searching for offer elements...',
        logType: 'info'
      }));

      let clubRoyaleTier = '';
      let clubRoyalePoints = '';
      
      const clubRoyaleSelectors = [
        '[data-testid*="club-royale"], [class*="club-royale"], [class*="ClubRoyale"]',
        '[data-testid*="tier"], [class*="tier"]',
        'header, nav, [class*="header"], [class*="profile"]',
        'h1, h2, h3, h4, h5, h6, p, span, div'
      ];

      for (const selector of clubRoyaleSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          if (text.match(/Signature|Premier|Classic/i) && !clubRoyaleTier) {
            clubRoyaleTier = text.match(/(Signature|Premier|Classic)/i)?.[0] || '';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found Club Royale tier: ' + clubRoyaleTier,
              logType: 'info'
            }));
          }
          
          if (text.match(/\d{3,}\s*(Club Royale\s*)?points?/i) && !clubRoyalePoints) {
            clubRoyalePoints = text.match(/\d{3,}/)?.[0] || '';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found Club Royale points: ' + clubRoyalePoints,
              logType: 'info'
            }));
          }
        });
        
        if (clubRoyaleTier && clubRoyalePoints) break;
      }

      const showAllBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.textContent?.match(/Show All|View All|See All/i)
      );
      
      if (showAllBtn) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Clicking "Show All Offers"',
          logType: 'info'
        }));
        showAllBtn.click();
        await wait(2000);
      }

      await scrollUntilComplete(null, 15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, searching for offers...',
        logType: 'info'
      }));

      let offerCards = [];
      
      const allSections = document.querySelectorAll('section, [role="region"], main > div, article, [class*="container"]');
      
      for (const section of allSections) {
        const hasViewSailings = Array.from(section.querySelectorAll('button, a')).some(btn => 
          btn.textContent?.match(/View Sailings?|See Sailings?/i)
        );
        
        if (hasViewSailings) {
          offerCards.push(section);
          const text = section.textContent?.trim() || '';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found offer section with View Sailings: ' + text.substring(0, 100),
            logType: 'info'
          }));
        }
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offers found with View Sailings buttons, trying broader search...',
          logType: 'warning'
        }));
        
        const allText = document.body.textContent || '';
        if (allText.match(/Full House|offer|promotion/i)) {
          offerCards = [document.querySelector('main') || document.body];
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Using main content area as single offer',
            logType: 'info'
          }));
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + offerCards.length + ' potential offer elements',
        logType: 'info'
      }));
      
      const offers = [];
      let processedCount = 0;

      for (let i = 0; i < offerCards.length; i++) {
        const card = offerCards[i];
        
        let offerName = extractText(card, '[data-testid*="offer-name"], [class*="offer-name"], h1, h2, h3');
        if (!offerName) {
          const headings = card.querySelectorAll('h1, h2, h3, h4');
          for (const h of headings) {
            const text = h.textContent?.trim() || '';
            if (text.length > 5 && text.length < 200) {
              offerName = text;
              break;
            }
          }
        }
        
        const offerCode = extractText(card, '[data-testid*="offer-code"], [class*="offer-code"], [class*="code"]');
        const offerExpiry = extractText(card, '[data-testid*="expir"], [class*="expir"]');
        const offerType = extractText(card, '[data-testid*="type"], [class*="type"]');
        const perks = extractText(card, '[data-testid*="perk"], [class*="perk"], [class*="benefit"]');

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a')).find(el => 
          el.textContent?.match(/View Sailings?|See Sailings?/i)
        );

        if (viewSailingsBtn) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Clicking View Sailings for: ' + offerName,
            logType: 'info'
          }));
          
          viewSailingsBtn.click();
          await wait(3000);

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'View Sailings modal opened, scrolling to load all room categories...',
            logType: 'info'
          }));

          await scrollUntilComplete(null, 15);
          await wait(2000);

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracting room categories and sailings...',
            logType: 'info'
          }));

          const roomCategories = document.querySelectorAll('h3, h4, [class*="room"], [class*="Room"], [class*="category"], [class*="Category"]');
          const shipNames = [];
          
          document.querySelectorAll('h2, h3, h4, h5, [class*="ship"], [class*="Ship"]').forEach(el => {
            const text = el.textContent?.trim() || '';
            const shipMatch = text.match(/([A-Z][a-z]+ of the [A-Z][a-z]+)/i);
            if (shipMatch && !shipNames.includes(shipMatch[1])) {
              shipNames.push(shipMatch[1]);
            }
          });

          const allText = document.body.textContent || '';
          const dateMatches = allText.matchAll(/(\d{2}\/\d{2}\/\d{2,4})/g);
          const dates = [];
          for (const match of dateMatches) {
            if (!dates.includes(match[1])) {
              dates.push(match[1]);
            }
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found ' + shipNames.length + ' ships and ' + dates.length + ' sailing dates',
            logType: 'info'
          }));

          const portMatches = allText.matchAll(/(Miami|Fort Lauderdale|Tampa|Orlando|Port Canaveral|Galveston|Los Angeles|Seattle|Vancouver|San Juan|New York|Baltimore|Boston|Honolulu|San Diego|New Orleans)/gi);
          const ports = [];
          for (const match of portMatches) {
            if (!ports.includes(match[1])) {
              ports.push(match[1]);
            }
          }

          let extractedSailings = 0;
          
          for (const roomCat of roomCategories) {
            const roomText = roomCat.textContent?.trim() || '';
            const cabinType = roomText.match(/(Interior|Ocean View|Balcony|Suite|Oceanview)/i)?.[1] || '';
            
            if (!cabinType) continue;
            
            const sailingCountMatch = roomText.match(/\((\d+)\s*Sailings?\)/i);
            const sailingCount = sailingCountMatch ? parseInt(sailingCountMatch[1]) : 0;
            
            if (sailingCount > 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found ' + cabinType + ' with ' + sailingCount + ' sailings',
                logType: 'info'
              }));

              for (let s = 0; s < Math.min(sailingCount, shipNames.length); s++) {
                offers.push({
                  sourcePage: 'Offers',
                  offerName: offerName,
                  offerCode: offerCode,
                  offerExpirationDate: offerExpiry,
                  offerType: offerType,
                  shipName: shipNames[s] || '',
                  sailingDate: dates[s] || '',
                  itinerary: '',
                  departurePort: ports[0] || '',
                  cabinType: cabinType,
                  numberOfGuests: '2',
                  perks: perks,
                  loyaltyLevel: clubRoyaleTier,
                  loyaltyPoints: clubRoyalePoints
                });
                extractedSailings++;
              }
            }
          }
            
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracted ' + extractedSailings + ' sailings from offer modal',
            logType: 'success'
          }));

          if (extractedSailings === 0) {
            offers.push({
              sourcePage: 'Offers',
              offerName: offerName,
              offerCode: offerCode,
              offerExpirationDate: offerExpiry,
              offerType: offerType,
              shipName: shipNames[0] || '',
              sailingDate: dates[0] || '',
              itinerary: '',
              departurePort: ports[0] || '',
              cabinType: 'Various',
              numberOfGuests: '2',
              perks: perks,
              loyaltyLevel: clubRoyaleTier,
              loyaltyPoints: clubRoyalePoints
            });
          }
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'No View Sailings button found for: ' + offerName,
            logType: 'warning'
          }));
          
          offers.push({
            sourcePage: 'Offers',
            offerName: offerName,
            offerCode: offerCode,
            offerExpirationDate: offerExpiry,
            offerType: offerType,
            shipName: '',
            sailingDate: '',
            itinerary: '',
            departurePort: '',
            cabinType: '',
            numberOfGuests: '',
            perks: perks,
            loyaltyLevel: clubRoyaleTier,
            loyaltyPoints: clubRoyalePoints
          });
        }

        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: offerCards.length,
          stepName: 'Club Royale Offers'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 1,
        data: offers
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Extracted \${offers.length} offer rows from \${offerCards.length} offers\`,
        logType: 'success'
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract offers: ' + error.message
      }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractOffers);
  } else {
    extractOffers();
  }
})();
`;

export function injectOffersExtraction() {
  return STEP1_OFFERS_SCRIPT;
}
