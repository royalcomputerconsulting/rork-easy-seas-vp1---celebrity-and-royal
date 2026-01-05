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
        message: 'Scrolling complete, extracting offers...',
        logType: 'info'
      }));

      const offerCards = document.querySelectorAll('[data-testid*="offer"], [class*="offer-card"], [class*="OfferCard"]');
      const offers = [];
      let processedCount = 0;

      for (let i = 0; i < offerCards.length; i++) {
        const card = offerCards[i];
        
        const offerName = extractText(card, '[data-testid*="offer-name"], [class*="offer-name"], h2, h3');
        const offerCode = extractText(card, '[data-testid*="offer-code"], [class*="offer-code"], [class*="code"]');
        const offerExpiry = extractText(card, '[data-testid*="expir"], [class*="expir"]');
        const offerType = extractText(card, '[data-testid*="type"], [class*="type"]');
        const perks = extractText(card, '[data-testid*="perk"], [class*="perk"], [class*="benefit"]');

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a')).find(el => 
          el.textContent?.match(/View Sailings?|See Sailings?/i)
        );

        if (viewSailingsBtn) {
          viewSailingsBtn.click();
          await wait(1500);

          const sailingsPanel = card.querySelector('[data-testid*="sailing"], [class*="sailing"]') || card;
          await scrollUntilComplete(sailingsPanel, 8);

          const sailingCards = sailingsPanel.querySelectorAll('[data-testid*="sailing-card"], [class*="sailing-item"]');
          
          if (sailingCards.length > 0) {
            for (let j = 0; j < sailingCards.length; j++) {
              const sailing = sailingCards[j];
              
              offers.push({
                sourcePage: 'Offers',
                offerName: offerName,
                offerCode: offerCode,
                offerExpirationDate: offerExpiry,
                offerType: offerType,
                shipName: extractText(sailing, '[data-testid*="ship"], [class*="ship"]'),
                sailingDate: extractText(sailing, '[data-testid*="date"], [class*="date"]'),
                itinerary: extractText(sailing, '[data-testid*="itinerary"], [class*="itinerary"]'),
                departurePort: extractText(sailing, '[data-testid*="port"], [class*="port"]'),
                cabinType: extractText(sailing, '[data-testid*="cabin"], [class*="cabin"]'),
                numberOfGuests: extractText(sailing, '[data-testid*="guest"], [class*="guest"]'),
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
