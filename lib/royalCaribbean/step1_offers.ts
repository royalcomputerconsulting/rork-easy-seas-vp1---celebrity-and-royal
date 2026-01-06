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

      await wait(4000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page loaded, searching for offer elements...',
        logType: 'info'
      }));

      await scrollUntilComplete(null, 15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, looking for offers...',
        logType: 'info'
      }));

      let offerCards = [];
      
      const possibleSelectors = [
        '[data-testid*="offer"]',
        '[class*="OfferCard"]',
        '[class*="offer-card"]',
        'article[class*="offer"]',
        'div[class*="offer"][class*="card"]',
        '.card',
        'article',
        'div[role="article"]'
      ];
      
      for (const selector of possibleSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          offerCards = Array.from(elements).filter(el => {
            const text = el.textContent || '';
            return text.toLowerCase().includes('view sailing') || 
                   text.toLowerCase().includes('offer') ||
                   el.querySelector('h1, h2, h3, h4');
          });
          
          if (offerCards.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found ' + offerCards.length + ' offers using selector: ' + selector,
              logType: 'info'
            }));
            break;
          }
        }
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offer cards found with any selector',
          logType: 'warning'
        }));
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'step_complete',
          step: 1,
          data: []
        }));
        return;
      }
      
      const offers = [];
      let processedCount = 0;

      for (let i = 0; i < offerCards.length; i++) {
        const card = offerCards[i];
        
        const offerName = extractText(card, 'h1') || extractText(card, 'h2') || 
                         extractText(card, 'h3') || extractText(card, 'h4') || 
                         extractText(card, '[class*="title"]') || extractText(card, '[class*="name"]');
        
        if (!offerName || offerName.length < 3) {
          continue;
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Processing offer: ' + offerName,
          logType: 'info'
        }));
        
        const offerCode = extractText(card, '[data-testid*="code"]') || 
                         extractText(card, '[class*="code"]') || '';
        const offerExpiry = extractText(card, '[data-testid*="expir"]') || 
                           extractText(card, '[class*="expir"]') || 
                           extractText(card, '[class*="valid"]') || '';
        const offerType = extractText(card, '[data-testid*="type"]') || 
                         extractText(card, '[class*="type"]') || 'Club Royale';
        const perks = extractText(card, '[data-testid*="perk"]') || 
                     extractText(card, '[class*="perk"]') || 
                     extractText(card, '[class*="benefit"]') || '';

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a, [role="button"]')).find(el => 
          (el.textContent || '').match(/View Sailing|See Sailing|Show Sailing/i)
        );

        if (viewSailingsBtn) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Clicking "View Sailings" for: ' + offerName,
            logType: 'info'
          }));
          
          viewSailingsBtn.click();
          await wait(3000);

          let sailingsContainer = document.querySelector('[class*="modal"]') || 
                                 document.querySelector('[role="dialog"]') || 
                                 document.querySelector('[class*="sailing"][class*="list"]') ||
                                 card;
          
          await scrollUntilComplete(sailingsContainer, 10);
          await wait(1000);

          const sailingElements = sailingsContainer.querySelectorAll(
            '[data-testid*="sailing"], [class*="sailing-card"], [class*="SailingCard"], [class*="cruise-card"], [class*="CruiseCard"], .card'
          );
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found ' + sailingElements.length + ' sailings for: ' + offerName,
            logType: 'info'
          }));
          
          if (sailingElements.length > 0) {
            for (let j = 0; j < sailingElements.length; j++) {
              const sailing = sailingElements[j];
              
              const shipName = extractText(sailing, '[data-testid*="ship"]') || 
                              extractText(sailing, '[class*="ship"]') || 
                              extractText(sailing, 'h3') || 
                              extractText(sailing, 'h4') || '';
              
              const sailingDate = extractText(sailing, '[data-testid*="date"]') || 
                                 extractText(sailing, '[class*="date"]') || 
                                 extractText(sailing, 'time') || '';
              
              const itinerary = extractText(sailing, '[data-testid*="itinerary"]') || 
                               extractText(sailing, '[class*="itinerary"]') || 
                               extractText(sailing, '[class*="destination"]') || '';
              
              const departurePort = extractText(sailing, '[data-testid*="port"]') || 
                                   extractText(sailing, '[class*="port"]') || 
                                   extractText(sailing, '[class*="departure"]') || '';
              
              const cabinType = extractText(sailing, '[data-testid*="cabin"]') || 
                               extractText(sailing, '[class*="cabin"]') || 
                               extractText(sailing, '[class*="stateroom"]') || '';
              
              const numberOfGuests = extractText(sailing, '[data-testid*="guest"]') || 
                                    extractText(sailing, '[class*="guest"]') || 
                                    extractText(sailing, '[class*="passenger"]') || '';
              
              offers.push({
                sourcePage: 'Offers',
                offerName: offerName,
                offerCode: offerCode,
                offerExpirationDate: offerExpiry,
                offerType: offerType,
                shipName: shipName,
                sailingDate: sailingDate,
                itinerary: itinerary,
                departurePort: departurePort,
                cabinType: cabinType,
                numberOfGuests: numberOfGuests,
                perks: perks,
                loyaltyLevel: '',
                loyaltyPoints: ''
              });
            }
          } else {
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
              loyaltyLevel: '',
              loyaltyPoints: ''
            });
          }
          
          const closeBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(el =>
            (el.textContent || '').match(/close|×|✕/i) || el.querySelector('[class*="close"]')
          );
          if (closeBtn) {
            closeBtn.click();
            await wait(1000);
          }
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'No "View Sailings" button found for: ' + offerName,
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
            loyaltyLevel: '',
            loyaltyPoints: ''
          });
        }

        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: offers.length,
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
