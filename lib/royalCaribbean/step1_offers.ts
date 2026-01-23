export const STEP1_OFFERS_SCRIPT = `
(function() {
  const OFFER_TIMEOUT_MS = 900000;
  const BATCH_SIZE = 150;
  
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
  
  function sendOfferProgress(offerIndex, totalOffers, offerName, sailingsCount, status) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'offer_progress',
      offerIndex: offerIndex,
      totalOffers: totalOffers,
      offerName: offerName,
      sailingsCount: sailingsCount,
      status: status
    }));
  }

  async function scrollUntilComplete(container, maxAttempts = 30) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;
    let previousItemCount = 0;

    while (stableCount < 3 && attempts < maxAttempts) {
      const currentHeight = container ? container.scrollHeight : document.body.scrollHeight;
      
      // Also count items to detect if new content is loading
      const currentItemCount = container 
        ? container.querySelectorAll('[class*="sailing"], [class*="row"], [class*="card"], tr, li').length
        : document.querySelectorAll('[class*="sailing"], [class*="row"], [class*="card"], tr, li').length;
      
      if (currentHeight === previousHeight && currentItemCount === previousItemCount) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      previousItemCount = currentItemCount;
      
      // More aggressive scrolling
      if (container) {
        container.scrollBy(0, 1200);
      } else {
        window.scrollBy(0, 1200);
      }
      
      await wait(600);
      attempts++;
      
      // Log progress every 10 attempts
      if (attempts % 10 === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Scroll progress: ' + attempts + '/' + maxAttempts + ' attempts, ' + currentItemCount + ' items loaded',
          logType: 'info'
        }));
      }
    }
    
    // Scroll back to top
    if (container) {
      container.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
    await wait(300);
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
      const pageHTML = document.body.innerHTML || '';
      
      // Find tier first
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
      
      // IMPROVED: Find Club Royale points more accurately
      // Strategy: Look for the large number at the TOP of the page first (user's actual points)
      let candidatePoints = [];
      
      // PRIORITY 0: Look for large numbers in header/top elements (most reliable)
      const topElements = Array.from(document.querySelectorAll('header, [class*="header"], [class*="hero"], [class*="banner"], nav, [role="banner"]'));
      for (const topEl of topElements.slice(0, 10)) {
        const topText = (topEl.textContent || '').toLowerCase();
        if (topText.includes('club royale') || topText.includes('point') || topText.includes('tier')) {
          const numberMatches = topText.match(/([\\d,]{4,})(?![\\d])/g);
          if (numberMatches) {
            for (const numStr of numberMatches) {
              const numPoints = parseInt(numStr.replace(/,/g, ''), 10);
              if (numPoints >= 5000 && numPoints <= 10000000) {
                candidatePoints.push({ value: numPoints, str: numStr, source: 'top-header-large' });
              }
            }
          }
        }
      }
      
      // PRIORITY 1: Look for "TIER CREDITS" or "YOUR CURRENT TIER CREDITS" (actual label on RC site)
      const tierCreditsPatterns = [
        /YOUR\\s+CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
        /TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
        /([\\d,]+)\\s*TIER\\s+CREDITS/gi,
        /CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi
      ];
      
      for (const pattern of tierCreditsPatterns) {
        let match;
        while ((match = pattern.exec(pageText)) !== null) {
          const pointStr = match[1].replace(/,/g, '');
          const numPoints = parseInt(pointStr, 10);
          if (numPoints >= 100 && numPoints <= 10000000) {
            candidatePoints.push({ value: numPoints, str: match[1], source: 'tier-credits-primary' });
          }
        }
      }
      
      // PRIORITY 2: Look for specific Club Royale points patterns
      const specificPatterns = [
        /Club Royale[^\\d]{0,30}?([\\d,]+)\\s*(?:points|pts)/gi,
        /([\\d,]+)\\s*Club Royale\\s*(?:points|pts)/gi,
        /(?:your|total|current)\\s*(?:Club Royale)?\\s*points[:\\s]*([\\d,]+)/gi,
        /points[:\\s]*([\\d,]+)/gi
      ];
      
      for (const pattern of specificPatterns) {
        let match;
        while ((match = pattern.exec(pageText)) !== null) {
          const pointStr = match[1].replace(/,/g, '');
          const numPoints = parseInt(pointStr, 10);
          if (numPoints >= 100 && numPoints <= 10000000) {
            candidatePoints.push({ value: numPoints, str: match[1], source: 'regex' });
          }
        }
      }
      
      // Look for points in specific DOM elements
      const pointsElements = document.querySelectorAll('[class*="point"], [class*="loyalty"], [class*="balance"], [class*="royale"], [data-testid*="point"], [aria-label*="point"]');
      for (const el of pointsElements) {
        const text = (el.textContent || '').trim();
        const numMatch = text.match(/^([\\d,]+)$/);
        if (numMatch) {
          const numPoints = parseInt(numMatch[1].replace(/,/g, ''), 10);
          if (numPoints >= 100 && numPoints <= 10000000) {
            candidatePoints.push({ value: numPoints, str: numMatch[1], source: 'element-class' });
          }
        }
        // Also check for "X points" or "X pts" format
        const ptsMatch = text.match(/([\\d,]+)\\s*(?:points|pts)/i);
        if (ptsMatch) {
          const numPoints = parseInt(ptsMatch[1].replace(/,/g, ''), 10);
          if (numPoints >= 100 && numPoints <= 10000000) {
            candidatePoints.push({ value: numPoints, str: ptsMatch[1], source: 'element-pts' });
          }
        }
      }
      
      // Look for large numbers near "Club Royale" text (within same container)
      const clubRoyaleContainers = document.querySelectorAll('[class*="club"], [class*="royale"], [class*="loyalty"], [class*="member"], section, article, div');
      for (const container of clubRoyaleContainers) {
        const containerText = (container.textContent || '').toLowerCase();
        if (containerText.includes('club royale') || containerText.includes('points')) {
          const numMatches = containerText.match(/([\\d,]{4,})(?![\\d])/g);
          if (numMatches) {
            for (const numStr of numMatches) {
              const numPoints = parseInt(numStr.replace(/,/g, ''), 10);
              // Looking for points typically > 1000 for active players
              if (numPoints >= 1000 && numPoints <= 10000000) {
                // Check if this container mentions points specifically
                if (containerText.includes('point')) {
                  candidatePoints.push({ value: numPoints, str: numStr, source: 'container' });
                }
              } else if (numPoints >= 10000 && numPoints <= 10000000) {
                // High value numbers without explicit "point" mention - likely actual points
                candidatePoints.push({ value: numPoints, str: numStr, source: 'container-high' });
              }
            }
          }
        }
      }
      
      // Sort candidates: PRIORITIZE top-header-large, then tier-credits-primary, then larger values
      // (smaller values like 2500 might be promotional values, cruise prices, etc.)
      candidatePoints.sort((a, b) => {
        // ABSOLUTE HIGHEST PRIORITY: top-header-large (user's actual points at top)
        const aIsTopHeader = a.source === 'top-header-large';
        const bIsTopHeader = b.source === 'top-header-large';
        if (aIsTopHeader && !bIsTopHeader) return -1;
        if (!aIsTopHeader && bIsTopHeader) return 1;
        
        // SECOND PRIORITY: tier-credits-primary source (the actual RC label)
        const aIsTierCredits = a.source === 'tier-credits-primary';
        const bIsTierCredits = b.source === 'tier-credits-primary';
        if (aIsTierCredits && !bIsTierCredits) return -1;
        if (!aIsTierCredits && bIsTierCredits) return 1;
        
        // Third, heavily prioritize values >= 10000 (almost certainly real points)
        const aIsLarge = a.value >= 10000;
        const bIsLarge = b.value >= 10000;
        if (aIsLarge && !bIsLarge) return -1;
        if (!aIsLarge && bIsLarge) return 1;
        
        // Then prefer element-class and element-pts sources
        const sourceOrder = { 'top-header-large': 0, 'tier-credits-primary': 1, 'element-class': 2, 'element-pts': 3, 'container-high': 4, 'regex': 5, 'container': 6 };
        const sourceCompare = (sourceOrder[a.source] || 99) - (sourceOrder[b.source] || 99);
        if (sourceCompare !== 0) return sourceCompare;
        // Then prefer larger values (more likely to be actual accumulated points)
        return b.value - a.value;
      });
      
      // Remove duplicates
      const seenValues = new Set();
      candidatePoints = candidatePoints.filter(p => {
        if (seenValues.has(p.value)) return false;
        seenValues.add(p.value);
        return true;
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + candidatePoints.length + ' point candidates: ' + candidatePoints.slice(0, 5).map(p => p.value + ' (' + p.source + ')').join(', '),
        logType: 'info'
      }));
      
      // Pick the best candidate - after sorting, first one is best
      if (candidatePoints.length > 0) {
        loyaltyData.clubRoyalePoints = candidatePoints[0].str;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Selected Club Royale points: ' + candidatePoints[0].str + ' (value: ' + candidatePoints[0].value + ') from ' + candidatePoints[0].source,
          logType: 'success'
        }));
      }
      
      // Fallback: search for standalone number elements with points context
      if (!loyaltyData.clubRoyalePoints) {
        const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
        
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
          
          const pointsMatch = text.match(/^([\\d,]+)$/);  
          if (pointsMatch) {
            const num = parseInt(pointsMatch[1].replace(/,/g, ''), 10);
            if (num >= 1000 && num <= 10000000) {
              const parentText = (el.parentElement?.textContent || '').toLowerCase();
              const grandparentText = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
              if (parentText.includes('point') || grandparentText.includes('point') || parentText.includes('royale')) {
                loyaltyData.clubRoyalePoints = pointsMatch[1];
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: 'Found Club Royale points (fallback element): ' + pointsMatch[1],
                  logType: 'success'
                }));
                break;
              }
            }
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

      await scrollUntilComplete(null, 15);
      await wait(1000);
      
      for (let scrollPass = 0; scrollPass < 2; scrollPass++) {
        window.scrollTo(0, document.body.scrollHeight);
        await wait(800);
        window.scrollTo(0, document.body.scrollHeight / 2);
        await wait(500);
      }
      window.scrollTo(0, 0);
      await wait(800);

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
            return childText.length < 30 && (childText.includes('view sailing') || childText.includes('see sailing') || childText.includes('view dates') || childText.includes('sailing'));
          });
          const hasOfferCode = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          const hasTradeIn = text.toLowerCase().includes('trade-in value');
          const hasRedeem = text.includes('Redeem by') || text.includes('redeem by');
          const hasFeatured = text.includes('Featured Offer');
          const hasOfferKeywords = text.match(/(Balcony|Oceanview|Interior|Suite|Room for Two|Stateroom)/i);
          const isReasonableSize = text.length > 100 && text.length < 6000;
          
          return hasViewSailingsButton && (hasOfferCode || hasTradeIn || hasRedeem || hasFeatured || hasOfferKeywords) && isReasonableSize;
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
            const hasCabinType = text.match(/(Balcony|Oceanview|Interior|Suite|Room for Two|Stateroom)/i);
            const hasViewButton = Array.from(el.querySelectorAll('button, a, span, div')).some(child => {
              const childText = (child.textContent || '').toLowerCase().trim();
              return childText.length < 40 && childText.includes('sailing');
            });
            const isReasonableSize = text.length > 80 && text.length < 7000;
            const offerSignals = [hasOfferCode, hasTradeIn, hasRedeem, hasDollarAmount, hasExpiry, hasCabinType, hasViewButton].filter(Boolean).length;
            
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
          const offerStartTime = Date.now();
          let offerSailingCount = 0;
          
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
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '  📜 Scrolling sailings container to load all content...',
            logType: 'info'
          }));
          
          await scrollUntilComplete(sailingsContainer, 100);
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
          
          const checkOfferTimeout = () => {
            const elapsed = Date.now() - offerStartTime;
            if (elapsed > OFFER_TIMEOUT_MS) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '  ⚠️ Offer timeout reached (' + Math.round(elapsed/1000) + 's) - moving to next offer',
                logType: 'warning'
              }));
              return true;
            }
            return false;
          };
          
          for (const [cabinType, sectionElements] of Object.entries(cabinTypeSections)) {
            if (checkOfferTimeout()) break;
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
            let hitLimit = false;
            
            for (const [cabinTypeKey, sailingsForType] of Object.entries(sailingsByType)) {
              if (hitLimit || checkOfferTimeout()) break;
              
              for (let j = 0; j < sailingsForType.length; j++) {
                if (checkOfferTimeout()) {
                  hitLimit = true;
                  break;
                }
                
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
                offerSailingCount++;
                
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
            
            sendOfferProgress(i + 1, offerCards.length, offerName, offerSailingCount, 'complete');
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '  ✓ Offer complete: ' + offerSailingCount + ' sailings added' + (hitLimit ? ' (timeout)' : ''),
              logType: 'success'
            }));
            
            await wait(500);
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
        
        await wait(150);
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
