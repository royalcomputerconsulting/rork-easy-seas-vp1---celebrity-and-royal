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
        message: 'Loading Club Royale Offers page...',
        logType: 'info'
      }));

      await wait(4000);
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling to load all content...',
        logType: 'info'
      }));

      await scrollUntilComplete(null, 15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing offers page structure...',
        logType: 'info'
      }));

      let offerCards = [];
      const allElements = Array.from(document.querySelectorAll('div, article, section'));
      
      offerCards = allElements.filter(el => {
        const text = el.textContent || '';
        const hasViewSailings = text.includes('View Sailings') || text.includes('VIEW SAILINGS');
        const isFeaturedOffer = text.includes('Featured Offer') || text.includes('FEATURED OFFER');
        const hasOfferKeyword = text.includes('Full House') || text.includes('READY TO PLAY');
        const hasRedeem = text.includes('Redeem');
        const hasTradeIn = text.toLowerCase().includes('trade-in');
        const hasRoomType = text.includes('Room for Two') || text.includes('Balcony') || text.includes('Ocean');
        const isReasonableSize = text.length > 50 && text.length < 2000;
        
        return hasViewSailings && (isFeaturedOffer || hasOfferKeyword || hasRedeem || hasTradeIn || hasRoomType) && isReasonableSize;
      });
      
      offerCards = offerCards.filter((el, idx, arr) => {
        return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + offerCards.length + ' offer cards on page',
        logType: 'info'
      }));
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offer cards found',
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
        const cardText = card.textContent || '';
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '━━━━━ Offer ' + (i + 1) + '/' + offerCards.length + ' ━━━━━',
          logType: 'info'
        }));
        
        let offerName = '';
        
        const featuredMatch = cardText.match(/Featured Offer[:\\s]*([A-Za-z0-9\\s]+?)(?=Redeem|Trade-in|\\$|Room|View|Featured|$)/i);
        if (featuredMatch && featuredMatch[1]) {
          offerName = featuredMatch[1].trim();
        }
        
        if (!offerName || offerName.length < 3) {
          offerName = extractText(card, 'h1') || extractText(card, 'h2') || 
                      extractText(card, 'h3') || extractText(card, 'h4');
        }
        
        if (!offerName || offerName.length < 3) {
          const roomMatch = cardText.match(/(Balcony|Ocean View|Interior|Suite)\\s+(Room for Two|or Oceanview Room for Two)/i);
          if (roomMatch) {
            offerName = roomMatch[0];
          }
        }
        
        if (!offerName || offerName.length < 3) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '⚠️ Skipping - no valid offer name found',
            logType: 'warning'
          }));
          continue;
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Offer Name: ' + offerName,
          logType: 'info'
        }));
        
        const codeMatch = cardText.match(/([A-Z0-9]{5,15})/);
        const offerCode = codeMatch ? codeMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Offer Code: ' + (offerCode || '[NOT FOUND]'),
          logType: offerCode ? 'info' : 'warning'
        }));
        
        const expiryMatch = cardText.match(/Redeem by ([A-Za-z]+ \\d+, \\d{4})/i);
        const offerExpiry = expiryMatch ? expiryMatch[1] : '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Expiry Date: ' + (offerExpiry || '[NOT FOUND]'),
          logType: offerExpiry ? 'info' : 'warning'
        }));
        
        const tradeInMatch = cardText.match(/\\$([\\d,]+\\.\\d{2})\\s*trade-in value/i);
        const tradeInValue = tradeInMatch ? tradeInMatch[1] : '';
        if (tradeInValue) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  Trade-in Value: $' + tradeInValue,
            logType: 'info'
          }));
        }
        
        const offerType = 'Club Royale';
        const perks = tradeInValue ? 'Trade-in value: $' + tradeInValue : '';

        const viewSailingsBtn = Array.from(card.querySelectorAll('button, a, [role="button"]')).find(el => 
          (el.textContent || '').match(/View Sailing|See Sailing|Show Sailing/i)
        );

        if (viewSailingsBtn) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ▶ Clicking "View Sailings"...',
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

          const allPossibleElements = Array.from(sailingsContainer.querySelectorAll('div, article, section'));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  📊 Analyzing ' + allPossibleElements.length + ' elements for sailings...',
            logType: 'info'
          }));

          const sailingElements = allPossibleElements.filter(el => {
            const text = el.textContent || '';
            const hasShipName = text.match(/\\w+\\s+of the Seas/);
            const hasNights = text.match(/\\d+\\s+NIGHT/i);
            const hasPort = text.match(/(Miami|Orlando|Fort Lauderdale|Tampa|Galveston|Port Canaveral|Port Cañaveral|Cape Liberty|Baltimore|Boston|Seattle|Vancouver|Los Angeles|San Diego|San Juan|Bayonne)/i);
            const hasDate = text.match(/\\d{2}\\/\\d{2}\\/\\d{2,4}/);
            const hasCabin = text.match(/(Balcony|Ocean View|Interior|Suite)/i);
            const lengthOk = text.length > 40 && text.length < 3000;
            const hasBasicInfo = hasShipName || (hasNights && hasDate);
            return hasBasicInfo && lengthOk;
          }).filter((el, idx, arr) => {
            return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
          });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ✓ Found ' + sailingElements.length + ' valid sailings (filtered from ' + allPossibleElements.length + ')',
            logType: sailingElements.length > 0 ? 'success' : 'warning'
          }));
          
          if (sailingElements.length > 0) {
            for (let j = 0; j < sailingElements.length; j++) {
              const sailing = sailingElements[j];
              const sailingText = sailing.textContent || '';
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '    ─── Sailing ' + (j + 1) + '/' + sailingElements.length + ' ───',
                logType: 'info'
              }));
              
              const shipMatch = sailingText.match(/([\\w\\s]+of the Seas)/);
              const shipName = shipMatch ? shipMatch[1].trim() : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      Ship: ' + (shipName || '[NOT FOUND]'),
                logType: shipName ? 'info' : 'warning'
              }));
              
              const itineraryMatch = sailingText.match(/(\\d+)\\s+NIGHT\\s+([A-Z\\s&]+?)(?=\\d{2}\\/|$)/i);
              const itinerary = itineraryMatch ? itineraryMatch[0].trim() : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      Itinerary: ' + (itinerary || '[NOT FOUND]'),
                logType: itinerary ? 'info' : 'warning'
              }));
              
              const portMatch = sailingText.match(/(Orlando \\(Port Cañaveral\\)|Port Cañaveral|Miami|Fort Lauderdale|Tampa|Galveston|Cape Liberty|Bayonne|Baltimore|Boston|Seattle|Vancouver|Los Angeles|San Diego|San Juan)/i);
              const departurePort = portMatch ? portMatch[1] : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      Port: ' + (departurePort || '[NOT FOUND]'),
                logType: departurePort ? 'info' : 'warning'
              }));
              
              const dateMatch = sailingText.match(/(\\d{2}\\/\\d{2}\\/\\d{2,4})/);
              const sailingDate = dateMatch ? dateMatch[1] : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      Date: ' + (sailingDate || '[NOT FOUND]'),
                logType: sailingDate ? 'info' : 'warning'
              }));
              
              const cabinMatch = cardText.match(/(Balcony|Ocean View|Interior|Suite)\\s+(Room for Two|or Oceanview Room for Two)/i);
              const cabinType = cabinMatch ? cabinMatch[1] : '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      Cabin: ' + (cabinType || '[NOT FOUND]'),
                logType: cabinType ? 'info' : 'warning'
              }));
              
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
                numberOfGuests: '2',
                perks: perks,
                loyaltyLevel: '',
                loyaltyPoints: ''
              });
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '      ✓ Row added (' + offers.length + ' total)',
                logType: 'success'
              }));
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
            message: '  ⚠️ No "View Sailings" button found',
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
          stepName: 'Offers: ' + offers.length + ' scraped'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 1,
        data: offers
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`✓ Extracted \${offers.length} offer rows from \${offerCards.length} offers\`,
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
