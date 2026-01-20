export const STEP1_OFFERS_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sendOfferBatch(offers, isFinal = false, totalCount = 0, offerCount = 0) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: isFinal ? 'step_complete' : 'offers_batch',
      step: 1,
      data: offers,
      isFinal: isFinal,
      totalCount: totalCount,
      offerCount: offerCount
    }));
  }

  async function scrollUntilComplete(container, maxAttempts = 15) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 4 && attempts < maxAttempts) {
      const currentHeight = container ? container.scrollHeight : document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      
      if (container) {
        container.scrollBy(0, 800);
      } else {
        window.scrollBy(0, 800);
      }
      
      await wait(1200);
      attempts++;
    }
    
    if (container) {
      container.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
    await wait(500);
  }

  function extractText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el?.textContent?.trim() || '';
  }

  async function extractClubRoyaleStatus() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting Club Royale status...',
        logType: 'info'
      }));

      const loyaltyData = {
        clubRoyaleTier: '',
        clubRoyalePoints: '',
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: ''
      };

      const pageText = document.body.textContent || '';
      
      const tierPatterns = [
        /Club Royale\\s*(?:Status|Tier)?[:\\s]*(Signature|Premier|Classic)/i,
        /(Signature|Premier|Classic)\\s*(?:Member|Status|Tier)?/i,
        /Your\\s+(?:Club Royale\\s+)?(?:Status|Tier)\\s*(?:is)?\\s*(Signature|Premier|Classic)/i
      ];
      
      for (const pattern of tierPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          loyaltyData.clubRoyaleTier = match[1];
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found Club Royale tier: ' + match[1],
            logType: 'success'
          }));
          break;
        }
      }
      
      const pointsPatterns = [
        /([\\d,]+)\\s*(?:Club Royale)?\\s*Points/i,
        /Points[:\\s]*([\\d,]+)/i,
        /Club Royale[^\\d]*([\\d,]{3,})(?:\\s*points)?/i
      ];
      
      for (const pattern of pointsPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const points = match[1].replace(/,/g, '');
          const numPoints = parseInt(points, 10);
          if (numPoints >= 0 && numPoints <= 1000000) {
            loyaltyData.clubRoyalePoints = match[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found Club Royale points: ' + match[1],
              logType: 'success'
            }));
            break;
          }
        }
      }

      if (!loyaltyData.clubRoyaleTier || !loyaltyData.clubRoyalePoints) {
        const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, [class*="tier"], [class*="status"], [class*="points"], [class*="loyalty"]');
        
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          
          if (!loyaltyData.clubRoyaleTier) {
            const tierMatch = text.match(/^(Signature|Premier|Classic)$/i);
            if (tierMatch) {
              loyaltyData.clubRoyaleTier = tierMatch[1];
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found Club Royale tier (element): ' + tierMatch[1],
                logType: 'success'
              }));
            }
          }
          
          if (!loyaltyData.clubRoyalePoints) {
            const pointsMatch = text.match(/^([\\d,]+)$/);  
            if (pointsMatch) {
              const num = parseInt(pointsMatch[1].replace(/,/g, ''), 10);
              if (num >= 100 && num <= 1000000) {
                const parentText = (el.parentElement?.textContent || '').toLowerCase();
                if (parentText.includes('point')) {
                  loyaltyData.clubRoyalePoints = pointsMatch[1];
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: 'Found Club Royale points (element): ' + pointsMatch[1],
                    logType: 'success'
                  }));
                }
              }
            }
          }
          
          if (loyaltyData.clubRoyaleTier && loyaltyData.clubRoyalePoints) {
            break;
          }
        }
      }

      if (loyaltyData.clubRoyaleTier || loyaltyData.clubRoyalePoints) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'loyalty_data',
          data: loyaltyData
        }));
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Club Royale status: ' + (loyaltyData.clubRoyaleTier || 'Unknown') + ', ' + (loyaltyData.clubRoyalePoints || '0') + ' points',
          logType: 'success'
        }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Could not find Club Royale status on page',
          logType: 'warning'
        }));
      }
      
      return loyaltyData;
    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Error extracting Club Royale status: ' + error.message,
        logType: 'warning'
      }));
      return null;
    }
  }

  async function extractOffers() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting Club Royale data...',
        logType: 'info'
      }));

      await extractClubRoyaleStatus();

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Loading Club Royale Offers page...',
        logType: 'info'
      }));

      await wait(4000);
      
      let expectedOfferCount = 0;
      const pageText = document.body.textContent || '';
      const offerCountMatch = pageText.match(/All Offers\\s*\\((\\d+)\\)/i) || 
                              pageText.match(/Offers\\s*\\((\\d+)\\)/i) ||
                              pageText.match(/(\\d+)\\s+Offers?\\s+Available/i);
      if (offerCountMatch) {
        expectedOfferCount = parseInt(offerCountMatch[1], 10);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Expected offer count from page: ' + expectedOfferCount,
          logType: 'info'
        }));
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling to load all content...',
        logType: 'info'
      }));

      await scrollUntilComplete(null, 25);
      await wait(2000);
      
      for (let scrollPass = 0; scrollPass < 3; scrollPass++) {
        window.scrollTo(0, document.body.scrollHeight);
        await wait(1500);
        window.scrollTo(0, document.body.scrollHeight / 2);
        await wait(1000);
      }
      window.scrollTo(0, 0);
      await wait(1500);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing offers page structure...',
        logType: 'info'
      }));

      let offerCards = [];
      
      const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"], [class*="btn"], [class*="button"], span[onclick], div[onclick], span, div'));
      
      const viewSailingsButtons = allClickables.filter(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        const isShortText = text.length < 30;
        return isShortText && (
               text.includes('view sailing') || 
               text.includes('see sailing') || 
               text.includes('show sailing') ||
               text.includes('view dates') ||
               text.includes('see dates') ||
               text.includes('available sailing') ||
               text === 'view sailings' ||
               text === 'see sailings' ||
               text === 'view' ||
               text === 'select'
        );
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + viewSailingsButtons.length + ' "View Sailings" buttons (expected: ' + (expectedOfferCount || 'unknown') + ')',
        logType: viewSailingsButtons.length >= expectedOfferCount ? 'info' : 'warning'
      }));
      
      if (expectedOfferCount > 0 && viewSailingsButtons.length < expectedOfferCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Trying alternative button detection...',
          logType: 'info'
        }));
        
        const additionalButtons = allClickables.filter(el => {
          const text = (el.textContent || '').trim().toLowerCase();
          const alreadyFound = viewSailingsButtons.includes(el);
          return !alreadyFound && (text.includes('sailing') && text.length < 30);
        });
        
        if (additionalButtons.length > 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found ' + additionalButtons.length + ' additional potential buttons',
            logType: 'info'
          }));
          viewSailingsButtons.push(...additionalButtons);
        }
      }
      
      const seenOfferCodes = new Set();
      const seenOfferNames = new Set();
      
      for (const btn of viewSailingsButtons) {
        let parent = btn.parentElement;
        let offerCard = null;
        
        for (let i = 0; i < 15 && parent; i++) {
          const parentText = parent.textContent || '';
          
          const hasOfferCode = parentText.match(/\\b([A-Z0-9]{6,12}[A-Z])\\b/);
          const hasTradeIn = parentText.toLowerCase().includes('trade-in value');
          const hasRedeem = parentText.includes('Redeem by');
          const hasFeatured = parentText.includes('Featured Offer');
          const hasOfferTitle = parentText.match(/\\b(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Full House|Lucky|Jackpot|Double|Triple|Bonus|Winner|Royal|Caribbean|Cruise|Sail|Summer|Winter|Spring|Fall|Holiday|Special)\\b/i);
          
          const isReasonableSize = parentText.length > 100 && parentText.length < 5000;
          
          if (isReasonableSize && (hasOfferCode || hasTradeIn || hasRedeem || hasFeatured)) {
            const buttonsInContainer = Array.from(parent.querySelectorAll('button, a, [role="button"]')).filter(el => 
              (el.textContent || '').match(/View Sailing|VIEW SAILING|See Sailing/i)
            );
            
            if (buttonsInContainer.length === 1) {
              offerCard = parent;
              break;
            }
            if (buttonsInContainer.length > 1 && parentText.length < 3000) {
              parent = parent.parentElement;
              continue;
            }
          }
          
          parent = parent.parentElement;
        }
        
        if (offerCard) {
          const cardText = offerCard.textContent || '';
          
          const codeMatch = cardText.match(/\\b([A-Z0-9]{6,12}[A-Z])\\b/);
          const offerCode = codeMatch ? codeMatch[1] : '';
          
          let offerName = '';
          const headings = Array.from(offerCard.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"]'));
          for (const h of headings) {
            const hText = (h.textContent || '').trim();
            if (hText.length >= 5 && hText.length <= 100 && !hText.match(/Featured Offer|View Sailing|Redeem|Trade-in|^\\$|^\\d+$/i)) {
              offerName = hText;
              break;
            }
          }
          
          const uniqueKey = offerCode || offerName || '';
          
          if (uniqueKey && !seenOfferCodes.has(uniqueKey)) {
            seenOfferCodes.add(uniqueKey);
            offerCards.push(offerCard);
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Identified offer card: ' + (offerName || offerCode || '[Unknown]'),
              logType: 'info'
            }));
          }
        }
      }
      
      if (offerCards.length === 0 || (expectedOfferCount > 0 && offerCards.length < expectedOfferCount)) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Button-based detection found ' + offerCards.length + ' offers (expected ' + expectedOfferCount + '), trying fallback method...',
          logType: 'warning'
        }));
        
        const allElements = Array.from(document.querySelectorAll('div, article, section, [class*="card"], [class*="offer"], [class*="promo"], [class*="deal"]'));
        
        const fallbackCards = allElements.filter(el => {
          const text = el.textContent || '';
          const hasViewSailingsButton = Array.from(el.querySelectorAll('button, a, [role="button"], span, div')).some(child => {
            const childText = (child.textContent || '').toLowerCase().trim();
            return childText.length < 30 && (childText.includes('view sailing') || childText.includes('see sailing') || childText.includes('view dates'));
          });
          const hasOfferCode = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          const hasTradeIn = text.toLowerCase().includes('trade-in value');
          const hasRedeem = text.includes('Redeem by') || text.includes('redeem by');
          const hasFeatured = text.includes('Featured Offer');
          const isReasonableSize = text.length > 150 && text.length < 5000;
          
          return hasViewSailingsButton && (hasOfferCode || hasTradeIn || hasRedeem || hasFeatured) && isReasonableSize;
        });
        
        const filteredFallback = fallbackCards.filter((el, idx, arr) => {
          return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
        });
        
        const existingCodes = new Set(offerCards.map(card => {
          const text = card.textContent || '';
          const match = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          return match ? match[1] : '';
        }).filter(Boolean));
        
        for (const card of filteredFallback) {
          const text = card.textContent || '';
          const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          const code = codeMatch ? codeMatch[1] : '';
          
          if (code && !existingCodes.has(code)) {
            existingCodes.add(code);
            offerCards.push(card);
            
            let name = '';
            const headings = Array.from(card.querySelectorAll('h1, h2, h3, h4, h5, h6'));
            for (const h of headings) {
              const hText = (h.textContent || '').trim();
              if (hText.length >= 5 && hText.length <= 80) {
                name = hText;
                break;
              }
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Fallback found offer card: ' + (name || code || '[Unknown]'),
              logType: 'info'
            }));
          }
        }
        
        if (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Still missing offers (' + offerCards.length + '/' + expectedOfferCount + '), trying structure-based detection...',
            logType: 'warning'
          }));
          
          const structuralCards = allElements.filter(el => {
            const text = el.textContent || '';
            const hasOfferCode = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
            const hasTradeIn = text.toLowerCase().includes('trade-in value');
            const hasRedeem = text.includes('Redeem by') || text.includes('redeem by');
            const hasDollarAmount = text.match(/\\$[\\d,]+\\.?\\d*/); 
            const hasExpiry = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
            const isReasonableSize = text.length > 100 && text.length < 6000;
            const offerSignals = [hasOfferCode, hasTradeIn, hasRedeem, hasDollarAmount, hasExpiry].filter(Boolean).length;
            
            return offerSignals >= 2 && isReasonableSize;
          });
          
          const filteredStructural = structuralCards.filter((el, idx, arr) => {
            return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
          });
          
          for (const card of filteredStructural) {
            const text = card.textContent || '';
            const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
            const code = codeMatch ? codeMatch[1] : '';
            
            if (code && !existingCodes.has(code)) {
              existingCodes.add(code);
              offerCards.push(card);
              
              let name = '';
              const headings = Array.from(card.querySelectorAll('h1, h2, h3, h4, h5, h6'));
              for (const h of headings) {
                const hText = (h.textContent || '').trim();
                if (hText.length >= 5 && hText.length <= 80) {
                  name = hText;
                  break;
                }
              }
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Structure-based detection found offer: ' + (name || code || '[Unknown]'),
                logType: 'info'
              }));
            }
          }
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + offerCards.length + ' offer cards on page' + (expectedOfferCount > 0 ? ' (expected: ' + expectedOfferCount + ')' : ''),
        logType: (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) ? 'warning' : 'info'
      }));
      
      if (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '⚠️ WARNING: Found ' + offerCards.length + ' offers but expected ' + expectedOfferCount + '. Some offers may not be scraped.',
          logType: 'warning'
        }));
      }
      
      if (offerCards.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'No offer cards found',
          logType: 'warning'
        }));
        
        sendOfferBatch([], true, 0, 0);
        return;
      }
      
      let totalSailingsScraped = 0;
      let processedCount = 0;
      const BATCH_SIZE = 150;
      let pendingBatch = [];

      function flushBatch(force = false) {
        if (pendingBatch.length >= BATCH_SIZE || (force && pendingBatch.length > 0)) {
          sendOfferBatch(pendingBatch, false);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '📤 Sent batch of ' + pendingBatch.length + ' sailings (total: ' + totalSailingsScraped + ')',
            logType: 'info'
          }));
          pendingBatch = [];
        }
      }

      for (let i = 0; i < offerCards.length; i++) {
        const card = offerCards[i];
        const cardText = card.textContent || '';
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '━━━━━ Offer ' + (i + 1) + '/' + offerCards.length + ' ━━━━━',
          logType: 'info'
        }));
        
        let offerName = '';
        
        const excludePatterns = /^Featured Offer$|^View Sailing|^View Sailings$|^See Sailing|^Redeem|^Trade-in value|^\\$|^My Offers$|^Club Royale Offers$|^Offers$|^Exclusive$|^Available$|^Learn More$|^Book Now$|^Select$|^Close$|^Filter$|^Sort$|^Room for Two$|^\\d+\\s+NIGHT/i;
        
        const allHeadings = Array.from(card.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="heading"], [class*="name"], [class*="offer"], span, p, div'));
        
        const sortedHeadings = allHeadings.sort((a, b) => {
          const depthA = getElementDepth(a, card);
          const depthB = getElementDepth(b, card);
          return depthA - depthB;
        });
        
        function getElementDepth(el, container) {
          let depth = 0;
          let current = el;
          while (current && current !== container) {
            depth++;
            current = current.parentElement;
          }
          return depth;
        }
        
        const offerNamePatterns = /(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Full House|Lucky|Jackpot|Double|Triple|Bonus|Winner|Royal|Sail|Summer|Winter|Spring|Fall|Holiday|Special|Wager|Deal|Flash|Hot|Golden|Diamond|Platinum|Elite|Premium|VIP|High Roller|All In|Big Win|Cash|Free|Comp|Cruise)/i;
        
        for (const heading of sortedHeadings) {
          const headingText = (heading.textContent || '').trim();
          const words = headingText.split(/\\s+/).length;
          
          if (headingText.length > 150) continue;
          
          const looksLikeOfferName = offerNamePatterns.test(headingText) && 
                                    !headingText.match(/\\d{2}\\/\\d{2}/) &&
                                    !headingText.match(/of the Seas/i);
          
          if (headingText && 
              headingText.length >= 3 && 
              headingText.length <= 100 &&
              words >= 1 &&
              words <= 12 &&
              !excludePatterns.test(headingText) &&
              !headingText.match(/^\\d+$/) &&
              !headingText.match(/^[A-Z0-9]{5,15}$/) &&
              (looksLikeOfferName || heading.tagName.match(/^H[1-6]$/i))) {
            offerName = headingText;
            break;
          }
        }
        
        if (!offerName || offerName.length < 3) {
          const textContent = cardText;
          const promoPatterns = [
            /([A-Z][a-z]+\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Chance|House|Wagers?|Deal|Flash|Jackpot|Bonus))/,
            /((?:Last Chance|Full House|Lucky|Double|Triple|High Roller|All In|Big Win|Golden|Diamond|Flash)\\s+[A-Za-z]+)/,
            /([A-Z][a-z]+\\s+[A-Z][a-z]+)(?=\\s*[A-Z0-9]{5,15})/
          ];
          
          for (const pattern of promoPatterns) {
            const match = textContent.match(pattern);
            if (match && match[1] && match[1].length >= 5 && match[1].length <= 60) {
              const candidate = match[1].trim();
              if (!excludePatterns.test(candidate)) {
                offerName = candidate;
                break;
              }
            }
          }
        }
        
        if (!offerName || offerName.length < 3) {
          const lines = cardText.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
          for (const line of lines.slice(0, 20)) {
            const words = line.split(/\\s+/).length;
            if (line.length >= 3 && 
                line.length <= 100 && 
                words >= 1 && 
                words <= 12 &&
                !excludePatterns.test(line) &&
                !line.match(/^\\d+$/) &&
                !line.match(/^[A-Z0-9]{5,15}$/) &&
                !line.match(/\\d{2}\\/\\d{2}/) &&
                offerNamePatterns.test(line)) {
              offerName = line;
              break;
            }
          }
        }
        
        if (!offerName || offerName.length < 3) {
          const codeMatch = cardText.match(/\\b([A-Z0-9]{5,15})\\b/);
          if (codeMatch) {
            offerName = 'Offer ' + codeMatch[1];
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
          
          const urlBefore = window.location.href;
          
          if (viewSailingsBtn.tagName === 'A') {
            const href = viewSailingsBtn.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.includes('modal')) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '  ⚠️ View Sailings is a navigation link - preventing navigation...',
                logType: 'warning'
              }));
              
              const originalHref = viewSailingsBtn.getAttribute('href');
              viewSailingsBtn.removeAttribute('href');
              viewSailingsBtn.style.cursor = 'pointer';
              
              viewSailingsBtn.click();
              await wait(2000);
              
              const modalOpened = document.querySelector('[class*="modal"]') || 
                                 document.querySelector('[role="dialog"]') ||
                                 document.querySelector('[class*="drawer"]') ||
                                 document.querySelector('[class*="overlay"][class*="sailing"]');
              
              if (!modalOpened) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '  ⚠️ No modal opened - skipping sailings for this offer',
                  logType: 'warning'
                }));
                
                if (originalHref) {
                  viewSailingsBtn.setAttribute('href', originalHref);
                }
                
                const noSailingOffer = {
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
                };
                pendingBatch.push(noSailingOffer);
                totalSailingsScraped++;
                flushBatch();
                
                processedCount++;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'progress',
                  current: totalSailingsScraped,
                  total: offerCards.length,
                  stepName: 'Offer ' + (i + 1) + '/' + offerCards.length + ': ' + totalSailingsScraped + ' sailings'
                }));
                continue;
              }
              
              if (originalHref) {
                viewSailingsBtn.setAttribute('href', originalHref);
              }
            } else {
              viewSailingsBtn.click();
              await wait(3000);
            }
          } else {
            viewSailingsBtn.click();
            await wait(3000);
          }
          
          if (window.location.href !== urlBefore) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '  ⚠️ Page navigated away unexpectedly - attempting recovery...',
              logType: 'warning'
            }));
            window.history.back();
            await wait(3000);
            
            const navOffer = {
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
            };
            pendingBatch.push(navOffer);
            totalSailingsScraped++;
            flushBatch();
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '  ⚠️ Skipped sailings for this offer (navigation detected)',
              logType: 'warning'
            }));
            
            processedCount++;
            continue;
          }

          let sailingsContainer = document.querySelector('[class*="modal"]') || 
                                 document.querySelector('[role="dialog"]') || 
                                 document.querySelector('[class*="sailing"][class*="list"]') ||
                                 card;
          
          await scrollUntilComplete(sailingsContainer, 10);
          await wait(1000);

          const allPossibleElements = Array.from(sailingsContainer.querySelectorAll('div, article, section, tr, li, [role="row"]'));
          
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
            const lengthOk = text.length > 20 && text.length < 600;
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
              const lengthOk = text.length > 20 && text.length < 800;
              return hasDate && hasShip && lengthOk;
            }).filter((el, idx, arr) => {
              return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
            });
          }
          
          let cabinTypeSections = {};
          
          sailingElements.forEach(el => {
            const text = el.textContent || '';
            let cabinType = '';
            
            const cabinMatch = text.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
            if (cabinMatch) {
              cabinType = cabinMatch[1];
              if (cabinType.toLowerCase().includes('ocean')) {
                cabinType = 'Oceanview';
              }
            }
            
            if (!cabinType) {
              let parent = el.parentElement;
              for (let p = 0; p < 3 && parent && !cabinType; p++) {
                const parentText = parent.textContent || '';
                const parentCabinMatch = parentText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)(?:\\s+Room|\\s+Stateroom|\\s+Sailings)?/i);
                if (parentCabinMatch && parentText.length < 500) {
                  cabinType = parentCabinMatch[1];
                  if (cabinType.toLowerCase().includes('ocean')) {
                    cabinType = 'Oceanview';
                  }
                  break;
                }
                parent = parent.parentElement;
              }
            }
            
            if (!cabinType && offerName) {
              const offerCabinMatch = cardText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
              if (offerCabinMatch) {
                cabinType = offerCabinMatch[1];
                if (cabinType.toLowerCase().includes('ocean')) {
                  cabinType = 'Oceanview';
                }
              } else {
                cabinType = 'Unknown';
              }
            }
            
            if (!cabinTypeSections[cabinType]) {
              cabinTypeSections[cabinType] = [];
            }
            cabinTypeSections[cabinType].push(el);
          });
          
          let sailingsByType = {};
          
          for (const [cabinType, sectionElements] of Object.entries(cabinTypeSections)) {
            const allIndividualDates = [];
            const seenDates = new Set();
            
            for (const sectionEl of sectionElements) {
              const sectionText = sectionEl.textContent || '';
              
              const allDateMatches = [];
              const dateRegex = /\\d{2}\\/\\d{2}\\/\\d{2,4}/g;
              let match;
              while ((match = dateRegex.exec(sectionText)) !== null) {
                allDateMatches.push(match[0]);
              }
              
              const uniqueDates = [...new Set(allDateMatches)];
              
              if (uniqueDates.length > 0) {
                for (const dateStr of uniqueDates) {
                  const shipMatch = sectionText.match(/([\\w\\s]+of the Seas)/i);
                  const shipName = shipMatch ? shipMatch[1].trim() : '';
                  const key = dateStr + '|' + shipName + '|' + cabinType;
                  
                  if (!seenDates.has(key)) {
                    seenDates.add(key);
                    allIndividualDates.push({
                      element: sectionEl,
                      date: dateStr,
                      shipName: shipName,
                      text: sectionText
                    });
                  }
                }
              } else {
                const noDateKey = 'nodate-' + Math.random() + '-' + cabinType;
                if (!seenDates.has(noDateKey)) {
                  seenDates.add(noDateKey);
                  allIndividualDates.push({
                    element: sectionEl,
                    date: '',
                    shipName: '',
                    text: sectionText
                  });
                }
              }
            }
            
            sailingsByType[cabinType] = allIndividualDates;
          }
          
          const totalSailingRows = Object.values(sailingsByType).reduce((sum, arr) => sum + arr.length, 0);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  ✓ Found ' + totalSailingRows + ' individual sailing date rows',
            logType: totalSailingRows > 0 ? 'success' : 'warning'
          }));
          
          const sortedCabinTypes = Object.keys(sailingsByType).sort();
          sortedCabinTypes.forEach(cabinType => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '    • ' + cabinType + ': ' + sailingsByType[cabinType].length + ' individual date(s)',
              logType: 'info'
            }));
          });
          
          if (totalSailingRows > 0) {
            let sailingIndex = 0;
            let lastLoggedCount = 0;
            
            for (const [cabinTypeKey, sailingsForType] of Object.entries(sailingsByType)) {
              for (let j = 0; j < sailingsForType.length; j++) {
                sailingIndex++;
                const sailingData = sailingsForType[j];
                const sailing = sailingData.element;
                const sailingText = sailingData.text || sailing.textContent || '';
                
                let shipName = sailingData.shipName || '';
                
                if (!shipName) {
                  const shipMatch = sailingText.match(/([\\w\\s]+of the Seas)/);
                  shipName = shipMatch ? shipMatch[1].trim() : '';
                }
                
                if (!shipName) {
                  let parent = sailing.parentElement;
                  for (let p = 0; p < 5 && parent && !shipName; p++) {
                    const parentText = parent.textContent || '';
                    const parentShipMatch = parentText.match(/([\\w\\s]+of the Seas)/);
                    if (parentShipMatch) {
                      shipName = parentShipMatch[1].trim();
                      break;
                    }
                    parent = parent.parentElement;
                  }
                }
                
                let itineraryMatch = sailingText.match(/(\\d+)\\s+NIGHT\\s+([A-Z\\s&]+?)(?=\\d{2}\\/|$)/i);
                let itinerary = itineraryMatch ? itineraryMatch[0].trim() : '';
                
                if (!itinerary) {
                  let parent = sailing.parentElement;
                  for (let p = 0; p < 5 && parent && !itinerary; p++) {
                    const parentText = parent.textContent || '';
                    const parentItinMatch = parentText.match(/(\\d+)\\s+NIGHT\\s+([A-Z\\s&]+)/i);
                    if (parentItinMatch) {
                      itinerary = parentItinMatch[0].trim();
                      break;
                    }
                    parent = parent.parentElement;
                  }
                }
                
                let portMatch = sailingText.match(/(Orlando \\(Port Cañaveral\\)|Port Cañaveral|Miami|Fort Lauderdale|Tampa|Galveston|Cape Liberty|Bayonne|Baltimore|Boston|Seattle|Vancouver|Los Angeles|San Diego|San Juan)/i);
                let departurePort = portMatch ? portMatch[1] : '';
                
                if (!departurePort) {
                  let parent = sailing.parentElement;
                  for (let p = 0; p < 5 && parent && !departurePort; p++) {
                    const parentText = parent.textContent || '';
                    const parentPortMatch = parentText.match(/(Orlando \\(Port Cañaveral\\)|Port Cañaveral|Miami|Fort Lauderdale|Tampa|Galveston|Cape Liberty|Bayonne|Baltimore|Boston|Seattle|Vancouver|Los Angeles|San Diego|San Juan)/i);
                    if (parentPortMatch) {
                      departurePort = parentPortMatch[1];
                      break;
                    }
                    parent = parent.parentElement;
                  }
                }
                
                const sailingDate = sailingData.date || '';
                
                let cabinType = cabinTypeKey || '';
                
                if (!cabinType || cabinType === 'Unknown') {
                  const cabinMatch = sailingText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
                  if (cabinMatch) {
                    cabinType = cabinMatch[1];
                    if (cabinType.toLowerCase().includes('ocean')) {
                      cabinType = 'Oceanview';
                    }
                  } else {
                    const offerCabinMatch = cardText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)(?:\\s+Room for Two|\\s+or\\s+Oceanview\\s+Room\\s+for\\s+Two)?/i);
                    if (offerCabinMatch) {
                      cabinType = offerCabinMatch[1];
                      if (cabinType.toLowerCase().includes('ocean')) {
                        cabinType = 'Oceanview';
                      }
                    } else {
                      cabinType = '';
                    }
                  }
                }
                
                pendingBatch.push({
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
                totalSailingsScraped++;
                
                if (totalSailingsScraped - lastLoggedCount >= 100 || sailingIndex === totalSailingRows) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: '    ✓ Processed ' + sailingIndex + '/' + totalSailingRows + ' sailings (' + totalSailingsScraped + ' total)',
                    logType: 'info'
                  }));
                  lastLoggedCount = totalSailingsScraped;
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'progress',
                    current: totalSailingsScraped,
                    total: offerCards.length,
                    stepName: 'Offer ' + (i + 1) + '/' + offerCards.length + ': ' + sailingIndex + '/' + totalSailingRows + ' sailings'
                  }));
                }
                
                flushBatch();
              }
            }
            
            flushBatch(true);
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '  ✓ Offer complete: ' + totalSailingRows + ' sailings added',
              logType: 'success'
            }));
          } else {
            const noSailingOffer = {
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
            };
            pendingBatch.push(noSailingOffer);
            totalSailingsScraped++;
            flushBatch(true);
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
          
          const noButtonOffer = {
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
          };
          pendingBatch.push(noButtonOffer);
          totalSailingsScraped++;
          flushBatch(true);
        }

        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: totalSailingsScraped,
          total: offerCards.length,
          stepName: 'Offers: ' + totalSailingsScraped + ' sailings (' + processedCount + '/' + offerCards.length + ' offers)'
        }));
      }

      flushBatch(true);
      
      sendOfferBatch([], true, totalSailingsScraped, offerCards.length);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '✓ Extracted ' + totalSailingsScraped + ' offer rows from ' + offerCards.length + ' offer(s)',
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

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
