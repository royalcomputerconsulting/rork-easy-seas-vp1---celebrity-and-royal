// Improved offer detection section - to be integrated into step1_offers.ts
// This replaces lines 550-680 approximately

export const IMPROVED_OFFER_DETECTION = `
      let offerCards = [];
      const seenOfferCodes = new Set();
      
      // STRATEGY: Find containers with COMPLETE offer card structure
      // Each card MUST have: offer code, room type, redeem date, View Sailings button
      // This ensures we capture ALL offers including those after dividers like "READY TO PLAY"
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Finding ALL offer cards (ignoring promotional dividers)...',
        logType: 'info'
      }));
      
      // Step 1: Find all potential offer codes on page
      const pageHTML = document.body.innerHTML;
      const allOfferCodes = pageHTML.match(/\\b[12][0-9](CLS|GOLD|C0|NEW|WEST|MAX|GO)[A-Z0-9]{2,8}[A-Z0-9]\\b/gi) || [];
      const uniqueOfferCodes = [...new Set(allOfferCodes.map(c => c.toUpperCase()))].filter(code => {
        return !code.match(/^(CURRENT|FEATURED|SAILING|BOOKING|LOYALTY|MEMBER|ROYALE)$/);
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📋 Found ' + uniqueOfferCodes.length + ' potential offer codes: ' + uniqueOfferCodes.slice(0, 10).join(', '),
        logType: 'info'
      }));
      
      // Step 2: For EACH offer code, find its container with complete card structure
      for (const offerCode of uniqueOfferCodes) {
        if (seenOfferCodes.has(offerCode)) continue;
        
        // Find all elements containing this specific offer code
        const allElements = Array.from(document.querySelectorAll('*'));
        let bestContainer = null;
        
        for (const el of allElements) {
          const elText = (el.textContent || '').trim();
          
          // Skip if element doesn't contain this code
          if (!elText.includes(offerCode)) continue;
          
          // Skip if too large (likely page container) or too small (just code element)
          if (elText.length < 100 || elText.length > 5000) continue;
          
          // Check if this element contains ONLY ONE offer code (not a parent with multiple offers)
          const codesInElement = uniqueOfferCodes.filter(c => elText.includes(c)).length;
          if (codesInElement !== 1) continue;
          
          // VERIFY this is a COMPLETE offer card with ALL required elements
          const hasOfferCode = elText.includes(offerCode);
          const hasRoomType = elText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite).*?(for two|room|stateroom)/i);
          const hasRedeemDate = elText.match(/Redeem by\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+\\d+,\\s*\\d{4}/i);
          const hasViewSailingsBtn = Array.from(el.querySelectorAll('button, a, [role="button"]')).some(btn => {
            const btnText = (btn.textContent || '').toLowerCase().trim();
            return btnText.includes('view sailing') || btnText.includes('see sailing');
          });
          
          // MUST have ALL components to be a valid offer card
          if (hasOfferCode && hasRoomType && hasRedeemDate && hasViewSailingsBtn) {
            bestContainer = el;
            break;  // Found the perfect container for this code
          }
        }
        
        if (bestContainer && !seenOfferCodes.has(offerCode)) {
          seenOfferCodes.add(offerCode);
          offerCards.push(bestContainer);
          
          const nameEl = bestContainer.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"]');
          const name = nameEl ? (nameEl.textContent || '').trim() : '';
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '✓ Found complete offer card: ' + offerCode + ' - ' + (name || '[No title]'),
            logType: 'success'
          }));
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Primary detection found ' + offerCards.length + '/' + (expectedOfferCount || '?') + ' offers',
        logType: offerCards.length >= expectedOfferCount ? 'success' : 'warning'
      }));
      
      // FALLBACK: If still missing offers, use button-based detection
      if (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Using fallback detection for missing offers...',
          logType: 'info'
        }));
        
        // Find ALL View Sailings buttons
        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const viewSailingsButtons = allButtons.filter(btn => {
          const text = (btn.textContent || '').trim().toLowerCase();
          return text.length < 50 && (text.includes('view sailing') || text.includes('see sailing'));
        });
        
        // For each button, work upwards to find offer container
        for (const btn of viewSailingsButtons) {
          let parent = btn.parentElement;
          
          for (let i = 0; i < 15 && parent; i++) {
            const parentText = parent.textContent || '';
            
            // Check if this looks like an offer card
            const hasOfferCode = parentText.match(/\\b[12][0-9](CLS|GOLD|C0|NEW|WEST|MAX|GO)[A-Z0-9]{2,8}[A-Z0-9]\\b/i);
            const hasRoomType = parentText.match(/(Balcony|Oceanview|Interior|Suite)/i);
            const hasRedeemDate = parentText.match(/Redeem by.*?\\d+,\\s*\\d{4}/i);
            const isReasonableSize = parentText.length > 100 && parentText.length < 5000;
            
            if (hasOfferCode && hasRoomType && hasRedeemDate && isReasonableSize) {
              const code = hasOfferCode[0].toUpperCase();
              
              if (!seenOfferCodes.has(code)) {
                seenOfferCodes.add(code);
                offerCards.push(parent);
                
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '✓ Fallback found offer: ' + code,
                  logType: 'success'
                }));
                break;
              }
            }
            
            parent = parent.parentElement;
          }
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Final result: Found ' + offerCards.length + ' offer cards (expected: ' + (expectedOfferCount || 'unknown') + ')',
        logType: (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) ? 'warning' : 'success'
      }));
      
      if (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '⚠️ WARNING: Missing ' + (expectedOfferCount - offerCards.length) + ' offers. Some may not be scraped.',
          logType: 'warning'
        }));
      }
`;
