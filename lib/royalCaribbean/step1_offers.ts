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
        
        const allHeadings = Array.from(card.querySelectorAll('h1, h2, h3, h4, h5'));
        for (const heading of allHeadings) {
          const headingText = (heading.textContent || '').trim();
          if (headingText && 
              headingText.length > 5 && 
              headingText.length < 100 &&
              !headingText.match(/Featured Offer|View Sailing|Redeem|Trade-in|^\\$|Room for Two/i)) {
            offerName = headingText;
            break;
          }
        }
        
        if (!offerName || offerName.length < 3) {
          const titlePatterns = [
            /Full House\\s+\\w+/i,
            /Winning\\s+\\w+/i,
            /Instant\\s+\\w+/i,
            /\\w+\\s+Mix/i,
            /\\w+\\s+Picks/i,
            /Monthly\\s+\\w+/i
          ];
          
          for (const pattern of titlePatterns) {
            const match = cardText.match(pattern);
            if (match) {
              offerName = match[0].trim();
              break;
            }
          }
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

          let sailingElements = allPossibleElements.filter(el => {
            const text = el.textContent || '';
            const hasDate = text.match(/\\d{2}\\/\\d{2}\\/\\d{2,4}/);
            const hasNights = text.match(/\\d+\\s+NIGHT/i);
            const hasShipName = text.match(/\\w+\\s+of the Seas/i);
            const lengthOk = text.length > 30 && text.length < 5000;
            const hasPortOrItinerary = text.match(/(Miami|Orlando|Fort Lauderdale|Tampa|Galveston|Port Canaveral|Port Cañaveral|Cape Liberty|Baltimore|Boston|Seattle|Vancouver|Los Angeles|San Diego|San Juan|Bayonne|Caribbean|Mexico|Bahamas|Alaska|Hawaii|Europe)/i);
            const hasSailingInfo = hasDate && (hasNights || hasShipName || hasPortOrItinerary);
            return hasSailingInfo && lengthOk;
          }).filter((el, idx, arr) => {
            return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
          });
          
          if (sailingElements.length === 0) {
            sailingElements = allPossibleElements.filter(el => {
              const text = el.textContent || '';
              const hasDate = text.match(/\\d{2}\\/\\d{2}\\/\\d{2,4}/);
              const hasShip = text.match(/\\w+\\s+of the Seas/i);
              const lengthOk = text.length > 20 && text.length < 1000;
              return hasDate && hasShip && lengthOk;
            }).filter((el, idx, arr) => {
              return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
            });
          }
          
          let sailingsByType = {};
          
          sailingElements.forEach(el => {
            const text = el.textContent || '';
            let cabinType = '';
            
            const cabinMatch = text.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
            if (cabinMatch) {
              cabinType = cabinMatch[1];
            }
            
            if (!cabinType) {
              let parent = el.parentElement;
              for (let p = 0; p < 3 && parent && !cabinType; p++) {
                const parentText = parent.textContent || '';
                const parentCabinMatch = parentText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)(?:\\s+Room|\\s+Stateroom|\\s+Sailings)?/i);
                if (parentCabinMatch && parentText.length < 500) {
                  cabinType = parentCabinMatch[1];
                  break;
                }
                parent = parent.parentElement;
              }
            }
            
            if (!cabinType && offerName) {
              const offerCabinMatch = cardText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
              cabinType = offerCabinMatch ? offerCabinMatch[1] : 'Unknown';
            }
            
            if (!sailingsByType[cabinType]) {
              sailingsByType[cabinType] = [];
            }
            sailingsByType[cabinType].push(el);
          });
          
          const totalSailingRows = Object.values(sailingsByType).reduce((sum, arr) => sum + arr.length, 0);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ✓ Found ' + totalSailingRows + ' valid sailing rows (filtered from ' + allPossibleElements.length + ')',
            logType: totalSailingRows > 0 ? 'success' : 'warning'
          }));
          
          Object.keys(sailingsByType).forEach(cabinType => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '    • ' + cabinType + ': ' + sailingsByType[cabinType].length + ' sailing(s)',
              logType: 'info'
            }));
          });
          
          if (totalSailingRows > 0) {
            let sailingIndex = 0;
            for (const [cabinTypeKey, sailingsForType] of Object.entries(sailingsByType)) {
              for (let j = 0; j < sailingsForType.length; j++) {
                sailingIndex++;
                const sailing = sailingsForType[j];
              const sailingText = sailing.textContent || '';
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '    ─── Sailing ' + sailingIndex + '/' + totalSailingRows + ' ───',
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
              
              let cabinType = cabinTypeKey || '';
              
              if (!cabinType || cabinType === 'Unknown') {
                const cabinMatch = sailingText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
                if (cabinMatch) {
                  cabinType = cabinMatch[1];
                } else {
                  const offerCabinMatch = cardText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)(?:\\s+Room for Two|\\s+or\\s+Oceanview\\s+Room\\s+for\\s+Two)?/i);
                  cabinType = offerCabinMatch ? offerCabinMatch[1] : '';
                }
              }
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
