export const STEP1_OFFERS_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(container, maxAttempts = 6) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 2 && attempts < maxAttempts) {
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
      
      await wait(800);
      attempts++;
    }
  }

  function extractText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el?.textContent?.trim() || '';
  }

  async function extractOffers() {
    let offersData = [];
    const startTime = Date.now();
    const maxExecutionTime = 50000;
    
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Club Royale Offers extraction...',
        logType: 'info'
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Current URL: ' + window.location.href,
        logType: 'info'
      }));

      await wait(1000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page loaded, searching for offer elements...',
        logType: 'info'
      }));

      let clubRoyaleTier = '';
      let clubRoyalePoints = '';
      
      const bodyText = document.body.textContent || '';
      const tierMatch = bodyText.match(/(Signature|Premier|Classic)/i);
      if (tierMatch) {
        clubRoyaleTier = tierMatch[1];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found Club Royale tier: ' + clubRoyaleTier,
          logType: 'info'
        }));
      }
      
      const pointsMatch = bodyText.match(/(\d{3,})\s*(?:Club Royale\s*)?points?/i);
      if (pointsMatch) {
        clubRoyalePoints = pointsMatch[1];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found Club Royale points: ' + clubRoyalePoints,
          logType: 'info'
        }));
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
        await wait(1500);
      }

      if (Date.now() - startTime > maxExecutionTime) {
        throw new Error('Execution time limit reached');
      }

      await scrollUntilComplete(null, 6);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting offers...',
        logType: 'info'
      }));

      let offerCards = [];
      
      const primarySelectors = [
        '[data-testid*="offer"]',
        '[class*="offer-card"]',
        '[class*="OfferCard"]',
        '[class*="offer"][class*="card"]',
        '[id*="offer"]'
      ];
      
      for (const selector of primarySelectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Selector "' + selector + '" found ' + found.length + ' elements',
            logType: 'info'
          }));
          offerCards = Array.from(found);
          break;
        }
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offers found with primary selectors, trying broader search...',
          logType: 'warning'
        }));
        
        const broadSelectors = document.querySelectorAll('div[class*="card"], section[class*="card"], article');
        const potentialOffers = Array.from(broadSelectors).slice(0, 100).filter(card => {
          const text = card.textContent?.toLowerCase() || '';
          if (text.length < 50 || text.length > 5000) return false;
          
          const hasOfferKeyword = text.includes('offer') || text.includes('promo');
          const hasCruiseInfo = text.includes('sail') || text.includes('cruise');
          const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) || /[a-z]{3}\s+\d{1,2}/i.test(text);
          
          return hasOfferKeyword && (hasCruiseInfo || hasDate);
        });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found ' + potentialOffers.length + ' potential offer elements',
          logType: 'info'
        }));
        
        offerCards = potentialOffers;
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + offerCards.length + ' potential offer elements. Processing...',
        logType: 'info'
      }));
      
      if (offerCards.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'First card sample: ' + (offerCards[0].textContent?.substring(0, 200) || 'No text'),
          logType: 'info'
        }));
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offers found on page, completing step',
          logType: 'warning'
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'step_complete',
          step: 1,
          data: []
        }));
        return;
      }
      
      let processedCount = 0;

      for (let i = 0; i < offerCards.length; i++) {
        const card = offerCards[i];
        
        const cardText = card.textContent?.trim() || '';
        
        if (!cardText || cardText.length < 20) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Card ' + (i + 1) + ' has insufficient text (' + cardText.length + ' chars), skipping',
            logType: 'info'
          }));
          continue;
        }
        
        const offerName = extractText(card, '[data-testid*="offer-name"], [class*="offer-name"], [class*="title"], h1, h2, h3, h4');
        const offerCode = extractText(card, '[data-testid*="offer-code"], [class*="offer-code"], [class*="code"]');
        const offerExpiry = extractText(card, '[data-testid*="expir"], [class*="expir"], [class*="valid"]');
        const offerType = extractText(card, '[data-testid*="type"], [class*="type"]');
        const perks = extractText(card, '[data-testid*="perk"], [class*="perk"], [class*="benefit"]');
        
        if (!offerName && !offerCode && !cardText.match(/sail|cruise|ship/i)) {
          continue;
        }

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a')).find(el => 
          el.textContent?.match(/View Sailings?|See Sailings?/i)
        );

        if (Date.now() - startTime > maxExecutionTime) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Time limit reached at card ' + (i + 1) + ', completing with ' + offersData.length + ' offers',
            logType: 'warning'
          }));
          break;
        }

        if (viewSailingsBtn) {
          viewSailingsBtn.click();
          await wait(1200);

          const sailingsPanel = card.querySelector('[data-testid*="sailing"], [class*="sailing"]') || card;
          await scrollUntilComplete(sailingsPanel, 5);

          const sailingCards = sailingsPanel.querySelectorAll('[data-testid*="sailing-card"], [class*="sailing-item"]');
          
          if (sailingCards.length > 0) {
            for (let j = 0; j < sailingCards.length; j++) {
              const sailing = sailingCards[j];
              
              offersData.push({
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
                loyaltyLevel: clubRoyaleTier,
                loyaltyPoints: clubRoyalePoints
              });
            }
          } else {
            offersData.push({
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
          offersData.push({
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
        data: offersData
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Extracted \${offersData.length} offer rows from \${offerCards.length} offers\`,
        logType: 'success'
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Error in extraction: ' + error.message + ', sending what we have (' + offersData.length + ' offers)',
        logType: 'error'
      }));
    } finally {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 1,
        data: offersData
      }));
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Step 1 extraction completed (final count: ' + offersData.length + ' offers)',
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
        step: 1,
        data: []
      }));
    }
  }, 55000);
  
  setTimeout(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        extractOffers().finally(() => { scriptCompleted = true; });
      });
    } else {
      extractOffers().finally(() => { scriptCompleted = true; });
    }
  }, 500);
})();
`;

export function injectOffersExtraction() {
  return STEP1_OFFERS_SCRIPT;
}
