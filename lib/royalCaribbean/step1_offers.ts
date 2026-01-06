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
        message: 'Scrolling complete, extracting offers...',
        logType: 'info'
      }));

      let offerCards = document.querySelectorAll('[data-testid*="offer"], [class*="offer-card"], [class*="OfferCard"]');
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offers found with primary selectors, trying broader search...',
          logType: 'warning'
        }));
        
        offerCards = document.querySelectorAll('[class*="offer"], [class*="Offer"], article, .card, [role="article"]');
      }

      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offer cards found, checking for featured/single offers...',
          logType: 'warning'
        }));
        
        const featuredSelectors = [
          '[class*="featured"]',
          '[class*="Featured"]',
          '[data-testid*="featured"]',
          '[class*="hero"]',
          '[class*="Hero"]',
          '[class*="banner"]',
          '[class*="Banner"]',
          'section',
          'main > div',
          'main section',
          '[role="region"]',
          '[class*="container"]',
          'article'
        ];
        
        for (const selector of featuredSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent || '';
            const hasViewSailings = el.querySelector('button, a') && 
              Array.from(el.querySelectorAll('button, a')).some(btn => 
                btn.textContent?.match(/View Sailings?|See Sailings?/i)
              );
            
            if ((text.match(/full house|offer|promotion|deal/i) && text.length > 50 && text.length < 10000) || hasViewSailings) {
              offerCards = [el];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found featured/single offer section: ' + text.substring(0, 100),
                logType: 'info'
              }));
              break;
            }
          }
          if (offerCards.length > 0) break;
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
          await wait(2500);

          await scrollUntilComplete(null, 10);
          
          await wait(1000);

          const sailingSelectors = [
            '[data-testid*="sailing-card"]',
            '[class*="sailing-item"]',
            '[class*="sailing-card"]',
            '[class*="SailingCard"]',
            '[class*="cruise-card"]',
            '[class*="CruiseCard"]',
            'article',
            '[role="article"]',
            '.card',
            '[class*="card"]'
          ];
          
          let sailingCards = [];
          for (const selector of sailingSelectors) {
            sailingCards = document.querySelectorAll(selector);
            if (sailingCards.length > 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found ' + sailingCards.length + ' sailings with selector: ' + selector,
                logType: 'info'
              }));
              break;
            }
          }
          
          if (sailingCards.length > 0) {
            for (let j = 0; j < sailingCards.length; j++) {
              const sailing = sailingCards[j];
              const sailingText = sailing.textContent || '';
              
              if (sailingText.length < 50) continue;
              
              const shipName = extractText(sailing, '[data-testid*="ship"], [class*="ship"], h3, h4');
              const sailingDate = extractText(sailing, '[data-testid*="date"], [class*="date"], time');
              
              if (!shipName && !sailingDate) continue;
              
              offers.push({
                sourcePage: 'Offers',
                offerName: offerName,
                offerCode: offerCode,
                offerExpirationDate: offerExpiry,
                offerType: offerType,
                shipName: shipName,
                sailingDate: sailingDate,
                itinerary: extractText(sailing, '[data-testid*="itinerary"], [class*="itinerary"], [class*="destination"]'),
                departurePort: extractText(sailing, '[data-testid*="port"], [class*="port"]'),
                cabinType: extractText(sailing, '[data-testid*="cabin"], [class*="cabin"]'),
                numberOfGuests: extractText(sailing, '[data-testid*="guest"], [class*="guest"]'),
                perks: perks,
                loyaltyLevel: clubRoyaleTier,
                loyaltyPoints: clubRoyalePoints
              });
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Extracted ' + offers.length + ' sailings from offer',
              logType: 'success'
            }));
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
              loyaltyLevel: clubRoyaleTier,
              loyaltyPoints: clubRoyalePoints
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
