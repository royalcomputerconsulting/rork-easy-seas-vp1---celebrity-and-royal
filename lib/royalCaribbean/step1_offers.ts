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
      console.log('[STEP1] Starting extraction');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '[STEP1] Starting Club Royale Offers extraction...',
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
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Searching for featured offers and offer cards...',
        logType: 'info'
      }));
      
      const allElements = document.querySelectorAll('*');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Searching through ' + allElements.length + ' DOM elements for offers...',
        logType: 'info'
      }));
      
      const allSections = document.querySelectorAll('section, [role="region"], main > div, article, [class*="container"], [class*="hero"], [class*="featured"], [class*="banner"], [class*="offer"], [class*="Offer"]');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + allSections.length + ' potential sections',
        logType: 'info'
      }));
      
      for (const section of allSections) {
        const hasViewSailings = Array.from(section.querySelectorAll('button, a, [role="button"]')).some(btn => 
          btn.textContent?.match(/View Sailings?|See Sailings?|Book Now|Learn More/i)
        );
        
        if (hasViewSailings) {
          offerCards.push(section);
          const text = section.textContent?.trim() || '';
          const offerNamePreview = text.match(/Full House February|Full House|[A-Z][a-z]+ [A-Z][a-z]+/)?.[0] || text.substring(0, 50);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found offer with View Sailings: ' + offerNamePreview,
            logType: 'info'
          }));
        }
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offers found with View Sailings button. Searching for featured content...',
          logType: 'warning'
        }));
        
        const hero = document.querySelector('main section:first-of-type, [class*="hero"], [class*="featured"]');
        if (hero) {
          const hasButton = Array.from(hero.querySelectorAll('button, a')).some(btn => 
            btn.textContent?.match(/View|Sailing|Book|Learn/i)
          );
          if (hasButton) {
            offerCards = [hero];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found featured hero section with action button',
              logType: 'success'
            }));
          }
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

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a, [role="button"]')).find(el => 
          el.textContent?.match(/View Sailings?|See Sailings?|Book Now|Learn More/i)
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

          await wait(4000);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Modal opened, scrolling to load all sailings...',
            logType: 'info'
          }));
          
          await scrollUntilComplete(null, 20);
          await wait(3000);

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Scroll complete. Extracting all cruise cards from modal...',
            logType: 'info'
          }));

          const cruiseCards = document.querySelectorAll('[class*="cruise"], [class*="Cruise"], [class*="sailing"], [class*="Sailing"], [class*="card"], article, [role="article"]');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found ' + cruiseCards.length + ' potential cruise cards in modal',
            logType: 'info'
          }));

          const extractedCruises = [];
          
          for (const cruiseCard of cruiseCards) {
            const cardText = cruiseCard.textContent || '';
            const cardHTML = cruiseCard.innerHTML || '';
            
            const shipMatch = cardText.match(/([A-Z][a-z]+ of the [A-Z][a-z]+)/i);
            const dateMatch = cardText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            const cabinMatch = cardText.match(/(Interior|Ocean View|Balcony|Suite|Oceanview)/i);
            
            if (shipMatch || dateMatch) {
              const cruise = {
                sourcePage: 'Offers',
                offerName: offerName,
                offerCode: offerCode,
                offerExpirationDate: offerExpiry,
                offerType: offerType,
                shipName: shipMatch ? shipMatch[1] : '',
                sailingDate: dateMatch ? dateMatch[0] : '',
                itinerary: '',
                departurePort: '',
                cabinType: cabinMatch ? cabinMatch[1] : '',
                numberOfGuests: '2',
                perks: perks,
                loyaltyLevel: clubRoyaleTier,
                loyaltyPoints: clubRoyalePoints
              };
              
              extractedCruises.push(cruise);
            }
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracted ' + extractedCruises.length + ' cruises from cards',
            logType: 'info'
          }));
          
          let extractedSailings = 0;
          if (extractedCruises.length > 0) {
            extractedCruises.forEach(cruise => {
              offers.push(cruise);
              extractedSailings++;
            });
          } else {
            const allText = document.body.textContent || '';
            const shipNames = [];
            document.querySelectorAll('*').forEach(el => {
              const text = el.textContent?.trim() || '';
              const shipMatch = text.match(/([A-Z][a-z]+ of the [A-Z][a-z]+)/i);
              if (shipMatch && !shipNames.includes(shipMatch[1]) && text.length < 200) {
                shipNames.push(shipMatch[1]);
              }
            });
            
            const dateMatches = allText.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g);
            const dates = [];
            for (const match of dateMatches) {
              if (!dates.includes(match[1]) && dates.length < 30) {
                dates.push(match[1]);
              }
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Fallback: found ' + shipNames.length + ' ships and ' + dates.length + ' dates',
              logType: 'info'
            }));
            
            const maxCruises = Math.max(shipNames.length, dates.length);
            for (let i = 0; i < maxCruises; i++) {
              offers.push({
                sourcePage: 'Offers',
                offerName: offerName,
                offerCode: offerCode,
                offerExpirationDate: offerExpiry,
                offerType: offerType,
                shipName: shipNames[i] || '',
                sailingDate: dates[i] || '',
                itinerary: '',
                departurePort: '',
                cabinType: '',
                numberOfGuests: '2',
                perks: perks,
                loyaltyLevel: clubRoyaleTier,
                loyaltyPoints: clubRoyalePoints
              });
              extractedSailings++;
            }
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Extracted ' + extractedSailings + ' sailings from offer modal',
            logType: 'success'
          }));
          
          const closeBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(btn => 
            btn.textContent?.match(/Close|✕|×|Back/i) || btn.getAttribute('aria-label')?.match(/Close/i)
          );
          if (closeBtn) {
            closeBtn.click();
            await wait(1000);
          }

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

      console.log('[STEP1] Sending step_complete with', offers.length, 'offers');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 1,
        data: offers
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '[STEP1] ✓ Extracted ' + offers.length + ' offer rows from ' + offerCards.length + ' offers',
        logType: 'success'
      }));

    } catch (error) {
      console.error('[STEP1] Error:', error);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: '[STEP1] Failed to extract offers: ' + error.message
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 1,
        data: []
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
