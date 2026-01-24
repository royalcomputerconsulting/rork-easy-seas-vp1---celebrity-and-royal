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
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Starting Club Royale points search...',
        logType: 'info'
      }));
      
      // PRIORITY 0: Look for large numbers in header/top elements (most reliable)
      // ULTRA AGGRESSIVE: The user's actual points are displayed PROMINENTLY at top
      const topElements = Array.from(document.querySelectorAll('header, [class*="header"], [class*="hero"], [class*="banner"], nav, [role="banner"], [class*="top"], [class*="nav"], main > div:first-child, main > section:first-child, body > div:first-child, body > div:nth-child(2), [class*="points"], [class*="balance"], [class*="tier"], [class*="credit"], [class*="loyalty"], [class*="status"], h1, h2, h3, p[class*="point"], span[class*="point"], div[class*="point"]'));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📊 Analyzing ' + topElements.length + ' top elements...',
        logType: 'info'
      }));
      
      // STRATEGY 1: Find ALL numbers >= 1000 in top sections
      // User's points like 39,728 or 37,928 are displayed prominently
      for (const topEl of topElements.slice(0, 80)) {
        const topText = (topEl.textContent || '');
        // Look for standalone numbers (with or without commas)
        const numberMatches = topText.match(/\\b([\\d,]{4,})\\b/g);
        if (numberMatches) {
          for (const numStr of numberMatches) {
            const cleanNum = numStr.replace(/,/g, '');
            const numPoints = parseInt(cleanNum, 10);
            
            // Prioritize ANY number >= 5000 (actual user points vs promotional offers like 2500)
            if (numPoints >= 1000 && numPoints <= 10000000) {
              const elementClasses = topEl.className || '';
              const elementText = topEl.textContent || '';
              const hasPointsContext = elementText.toLowerCase().includes('point') || 
                                      elementText.toLowerCase().includes('credit') || 
                                      elementText.toLowerCase().includes('tier') ||
                                      elementClasses.toLowerCase().includes('point') ||
                                      elementClasses.toLowerCase().includes('balance');
              
              // Calculate priority based on size and context
              let priority = 10;
              if (numPoints >= 30000) {
                priority = hasPointsContext ? 1 : 2;  // Very high with context = top priority
              } else if (numPoints >= 10000) {
                priority = hasPointsContext ? 2 : 3;
              } else if (numPoints >= 5000) {
                priority = hasPointsContext ? 3 : 5;
              } else if (numPoints >= 2500) {
                priority = hasPointsContext ? 4 : 6;
              } else {
                priority = hasPointsContext ? 5 : 7;
              }
              
              candidatePoints.push({ 
                value: numPoints, 
                str: numStr, 
                source: 'top-header',
                priority: priority
              });
              
              if (numPoints >= 10000) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '  ➜ Found large number: ' + numStr + ' (priority: ' + priority + ', context: ' + hasPointsContext + ')',
                  logType: 'info'
                }));
              }
            }
          }
        }
      }
      
      // STRATEGY 2: Check for numbers with explicit Club Royale / points context
      for (const topEl of topElements.slice(0, 30)) {
        const topText = (topEl.textContent || '').toLowerCase();
        if (topText.includes('club royale') || topText.includes('point') || topText.includes('tier') || topText.includes('credit')) {
          const numberMatches = topText.match(/([\\d,]{4,})(?![\\d])/g);
          if (numberMatches) {
            for (const numStr of numberMatches) {
              const numPoints = parseInt(numStr.replace(/,/g, ''), 10);
              if (numPoints >= 1000 && numPoints <= 10000000) {
                candidatePoints.push({ value: numPoints, str: numStr, source: 'top-context', priority: 2 });
              }
            }
          }
        }
      }
      
      // PRIORITY 1: Look for Club Royale specific TIER CREDITS
      // Search in a LIMITED scope near Club Royale mentions to avoid Crown & Anchor confusion
      const clubRoyaleElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = (el.textContent || '').toLowerCase();
        return text.includes('club royale') && text.length < 2000;
      });
      
      for (const crEl of clubRoyaleElements.slice(0, 10)) {
        const crText = crEl.textContent || '';
        const tierCreditsPatterns = [
          /YOUR\\s+CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
          /TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
          /([\\d,]+)\\s*TIER\\s+CREDITS/gi,
          /CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi
        ];
        
        for (const pattern of tierCreditsPatterns) {
          let match;
          const resetPattern = new RegExp(pattern.source, pattern.flags);
          while ((match = resetPattern.exec(crText)) !== null) {
            const pointStr = match[1].replace(/,/g, '');
            const numPoints = parseInt(pointStr, 10);
            if (numPoints >= 100 && numPoints <= 10000000) {
              candidatePoints.push({ value: numPoints, str: match[1], source: 'tier-credits-primary', priority: 0 });
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '  ➜ Found TIER CREDITS near Club Royale: ' + match[1],
                logType: 'info'
              }));
            }
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
      
      // Sort candidates: PRIORITIZE tier-credits-primary FIRST (official label), then by priority, source, and value
      candidatePoints.sort((a, b) => {
        // HIGHEST PRIORITY: tier-credits-primary source (official RC label)
        const aIsTierCredits = a.source === 'tier-credits-primary';
        const bIsTierCredits = b.source === 'tier-credits-primary';
        if (aIsTierCredits && !bIsTierCredits) return -1;
        if (!aIsTierCredits && bIsTierCredits) return 1;
        
        // CRITICAL: When both are tier-credits, prefer SMALLER value (current points, not points-to-next-tier)
        if (aIsTierCredits && bIsTierCredits) {
          return a.value - b.value;
        }
        
        // Second: Sort by priority field (lower number = higher priority)
        const priorityDiff = (a.priority || 99) - (b.priority || 99);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Third: Prefer top-header sources
        const sourceOrder = { 'top-header': 1, 'top-context': 2, 'element-class': 3, 'element-pts': 4, 'container-high': 5, 'regex': 6, 'container': 7 };
        const sourceCompare = (sourceOrder[a.source] || 99) - (sourceOrder[b.source] || 99);
        if (sourceCompare !== 0) return sourceCompare;
        
        // Fourth: Prefer larger values (more likely to be actual accumulated points)
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
      
      // Check if there's a FEATURED offer section
      const hasFeaturedOffer = pageText.match(/FEATURED\\s+Offer/i);
      
      if (offerCountMatch) {
        expectedOfferCount = parseInt(offerCountMatch[1], 10);
        // Add 1 for FEATURED offer if it exists (structure: 1 FEATURED + X from ALL OFFERS)
        if (hasFeaturedOffer) {
          expectedOfferCount += 1;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found FEATURED offer section + ALL OFFERS (' + (expectedOfferCount - 1) + ') = ' + expectedOfferCount + ' total offers expected',
            logType: 'info'
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Expected offer count from page: ' + expectedOfferCount,
            logType: 'info'
          }));
        }
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling to load all content...',
        logType: 'info'
      }));

      await scrollUntilComplete(null, 20);
      await wait(1000);
      
      // HYPER AGGRESSIVE scrolling to ensure ALL offers are loaded (including past dividers)
      // Royal Caribbean uses lazy loading AND has promotional dividers that can break detection
      // We need to scroll PAST all dividers to load hidden offers
      let lastButtonCount = 0;
      let stableScrollCount = 0;
      
      // CRITICAL: DO NOT CLICK ANY BUTTONS - ONLY "View Sailings" buttons should be clicked
      // Clicking other buttons can break the page or navigate away
      
      for (let scrollPass = 0; scrollPass < 30; scrollPass++) {
        // Scroll to multiple positions to trigger lazy loading
        window.scrollTo(0, document.body.scrollHeight);
        await wait(2000);
        window.scrollTo(0, document.body.scrollHeight * 0.25);
        await wait(1000);
        window.scrollTo(0, document.body.scrollHeight * 0.5);
        await wait(1000);
        window.scrollTo(0, document.body.scrollHeight * 0.75);
        await wait(1000);
        window.scrollTo(0, document.body.scrollHeight);
        await wait(2000);
        
        // Aggressive: scroll PAST the bottom by triggering events
        window.scrollBy(0, 8000);
        await wait(1500);
        
        // Trigger scroll events manually to force lazy loading
        window.dispatchEvent(new Event('scroll'));
        document.body.dispatchEvent(new Event('scroll'));
        await wait(300);
        
        // Count buttons after each pass - be ULTRA lenient in detection
        const currentOfferButtons = document.querySelectorAll('button, a, [role="button"], span[class*="button"], div[class*="button"], span, div');
        const viewSailingCount = Array.from(currentOfferButtons).filter(btn => {
          const textContent = (btn.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const ariaLabel = (btn.getAttribute?.('aria-label') || '').toLowerCase();
          const combined = textContent + ' ' + ariaLabel;
          // Multiple matching strategies
          return textContent === 'view sailings' || 
                 textContent === 'view sailing' || 
                 combined.includes('view sailing') ||
                 (combined.includes('view') && combined.includes('sailing'));
        }).length;
        
        // Log progress
        if (scrollPass % 2 === 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Scroll pass ' + (scrollPass + 1) + '/30: Found ' + viewSailingCount + ' View Sailings buttons',
            logType: 'info'
          }));
        }
        
        // Check if button count is stable (no new offers loading)
        if (viewSailingCount === lastButtonCount) {
          stableScrollCount++;
          // Only stop if we've reached the expected count
          if (expectedOfferCount > 0 && viewSailingCount >= expectedOfferCount && stableScrollCount >= 3) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '✓ Found all expected offers (' + viewSailingCount + ' buttons), stopping scroll',
              logType: 'success'
            }));
            break;
          }
          // If count is stable but below expected, keep trying until we exhaust all passes
          if (stableScrollCount >= 8 && viewSailingCount < expectedOfferCount) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '⚠️ Button count stable at ' + viewSailingCount + ' (expected: ' + expectedOfferCount + '), trying more aggressive tactics...',
              logType: 'warning'
            }));
            // Don't break, keep trying
          }
        } else {
          stableScrollCount = 0;
          lastButtonCount = viewSailingCount;
        }
      }
      window.scrollTo(0, 0);
      await wait(2000);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing offers page structure...',
        logType: 'info'
      }));

      let offerCards = [];
      
      // CRITICAL FIX: Royal Caribbean structure:
      // - FEATURED offer at top
      // - ALL OFFERS (X) section
      // - Some offers
      // - PROMOTIONAL DIVIDERS (e.g., "READY TO PLAY", "Woman enjoying casino experience") that MUST be ignored
      // - More offers AFTER dividers
      // - More offers at bottom
      // Each card has: Title, Offer Code, Room Type, Redeem Date, T&C link, sometimes Trade-in, Redeem button, View Sailings button
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 SCANNING: Finding ALL ' + (expectedOfferCount || 'available') + ' offer cards (ignoring promotional banners)...',
        logType: 'info'
      }));
      
      // CRITICAL: Filter out promotional banners/dividers that are NOT offers
      const promoExclusionPatterns = [
        /READY TO PLAY/i,
        /Woman enjoying casino/i,
        /Playing card symbols/i,
        /You can apply for a casino credit/i,
        /Apply now/i,
        /for more information click on the benefits tab/i
      ];
      
      // STRATEGY: Each offer card MUST have ALL of these elements:
      // 1. Offer code (format: 26CLS103 or 26CLS103B)
      // 2. Room type (Balcony, Oceanview, Interior, Suite) + guests ("for two")
      // 3. Redeem by date (e.g., "Jan 31, 2026")
      // 4. View Sailings button
      // We'll find containers that have ALL these signals
      
      const pageHTML = document.body.innerHTML;
      const allOfferCodes = pageHTML.match(/\b\d{2}(?:CLS|GOLD|C0|NEW|WEST|MAX|GO|MAR|WST|GRD|A0)[A-Z0-9%]{2,10}\b/gi) || [];
      const uniqueOfferCodes = [...new Set(allOfferCodes.map(c => c.toUpperCase()))].filter(code => {
        return !code.match(/^(CURRENT|FEATURED|SAILING|BOOKING|LOYALTY|MEMBER|ROYALE)$/);
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📋 Detected ' + uniqueOfferCodes.length + ' potential offer codes: ' + uniqueOfferCodes.slice(0, 10).join(', '),
        logType: 'info'
      }));
      
      // PRIMARY STRATEGY: Find containers with COMPLETE offer card structure
      // Must have: offer code, room type, redeem date, and View Sailings button
      // This ensures we get REAL offer cards and not dividers or promotional content
      
      const allPossibleContainers = Array.from(document.querySelectorAll('div, article, section, li, [class*="card"], [class*="offer"], [class*="promo"], [class*="deal"], [class*="tile"]'));
      
      // Find ALL clickable elements on the page
      const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"], span[class*="button"], div[class*="button"]'));
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Scanning ' + allClickables.length + ' elements across ENTIRE page (ignoring dividers like READY TO PLAY)...',
        logType: 'info'
      }));
      
      // Find ALL "View Sailings" buttons - be VERY lenient in matching
      // User confirmed: ALL buttons say "View Sailings" - they are all exactly the same
      const allViewSailingButtons = allClickables.filter(el => {
        const textContent = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const ariaLabel = (el.getAttribute?.('aria-label') || '').toLowerCase();
        const title = (el.getAttribute?.('title') || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        const dataTestId = (el.getAttribute?.('data-testid') || '').toLowerCase();
        const combined = textContent + ' ' + ariaLabel + ' ' + title + ' ' + className + ' ' + dataTestId;
        
        // Multiple matching strategies
        const exactMatch = textContent === 'view sailings' || textContent === 'view sailing';
        const containsMatch = combined.includes('view sailing') || combined.includes('viewsailing');
        const partialMatch = (combined.includes('view') && combined.includes('sailing'));
        const sailingsOnly = textContent === 'sailings' || textContent.match(/^view\s*$/i);
        
        return exactMatch || containsMatch || partialMatch;
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + allViewSailingButtons.length + ' total "View Sailings" buttons before filtering',
        logType: 'info'
      }));
      
      // DEBUG: If no buttons found, log what's on the page
      if (allViewSailingButtons.length === 0) {
        const allButtonsText = Array.from(allClickables).slice(0, 50).map(el => (el.textContent || '').trim().substring(0, 30)).filter(t => t.length > 0);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '🔍 DEBUG: Sample buttons on page: ' + allButtonsText.slice(0, 20).join(' | '),
          logType: 'warning'
        }));
        
        // Try alternative detection - look for ANY element with "Sailing" in text
        const sailingElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('sailing') && text.length < 100;
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '🔍 Found ' + sailingElements.length + ' elements containing "sailing"',
          logType: 'info'
        }));
      }
      
      // ULTRA SIMPLE: Keep ALL View Sailings buttons EXCEPT those in obvious promo banners
      // User confirmed: ALL offers have identical "View Sailings" buttons
      // Don't overthink - just exclude promotional banners
      const viewSailingsButtons = allViewSailingButtons.filter(btn => {
        let parent = btn.parentElement;
        
        // Check up to 10 levels for promo banner exclusion patterns ONLY
        for (let i = 0; i < 10 && parent; i++) {
          const parentText = parent.textContent || '';
          const parentLower = parentText.toLowerCase();
          
          // ONLY exclude if this is clearly a promotional banner (NOT an offer)
          const isPromoBanner = parentLower.includes('ready to play') && parentLower.includes('casino credit');
          const isApplyNowBanner = parentLower.includes('apply now') && parentLower.includes('keep the party going');
          const isBenefitsBanner = parentLower.includes('for more information click on the benefits tab');
          
          // If it's a promo banner AND doesn't have offer signals, exclude it
          if (isPromoBanner || isApplyNowBanner || isBenefitsBanner) {
            // But double-check: if this container also has offer code + redeem date, it's an offer
            const hasOfferCode = parentText.match(/\b\d{2}[A-Z]{2,4}\d{2,3}[A-Z]?\b/i) || parentText.match(/\b\d{4}[A-Z]\d{2}[A-Z]?\b/i);
            const hasRedeemDate = parentText.match(/Redeem by/i);
            if (hasOfferCode && hasRedeemDate) {
              // This IS an offer despite having promo-like text
              return true;
            }
            // It's a promo banner without offer signals - exclude
            return false;
          }
          
          parent = parent.parentElement;
        }
        
        // Default: INCLUDE the button (assume it's a valid offer)
        return true;
      });
      
      const filteredOutCount = allViewSailingButtons.length - viewSailingsButtons.length;
      if (filteredOutCount > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '🚫 Filtered out ' + filteredOutCount + ' non-offer button(s) (promotional banners, account links, etc.)',
          logType: 'info'
        }));
      }
      
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
        
        // Look for any additional "View Sailings" buttons we might have missed
        const additionalButtons = allClickables.filter(el => {
          const text = (el.textContent || '').trim().toLowerCase();
          const alreadyFound = viewSailingsButtons.includes(el);
          // Be more lenient but still focused on "view sailing" text
          return !alreadyFound && 
                 text.includes('view') && 
                 text.includes('sailing') && 
                 text.length < 50;
        });
        
        if (additionalButtons.length > 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found ' + additionalButtons.length + ' additional potential buttons',
            logType: 'info'
          }));
          viewSailingsButtons.push(...additionalButtons);
        }
        
        // SECOND PASS: Also look for buttons by their position relative to offer codes
        const allOfferCodeElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = (el.textContent || '').trim();
          return text.match(/^[A-Z0-9]{5,12}[A-Z]$/) && text.length < 15;
        });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found ' + allOfferCodeElements.length + ' offer code elements on page',
          logType: 'info'
        }));
        
        for (const codeEl of allOfferCodeElements) {
          // Find parent container and look for View Sailings button within
          let parent = codeEl.parentElement;
          for (let i = 0; i < 10 && parent; i++) {
            const btnsInParent = Array.from(parent.querySelectorAll('button, a, [role="button"], span, div')).filter(btn => {
              const btnText = (btn.textContent || '').trim().toLowerCase();
              // ONLY match elements with BOTH "view" AND "sailing" text
              return btnText.length < 50 && btnText.includes('view') && btnText.includes('sailing');
            });
            
            for (const btn of btnsInParent) {
              if (!viewSailingsButtons.includes(btn)) {
                viewSailingsButtons.push(btn);
              }
            }
            
            if (btnsInParent.length > 0) break;
            parent = parent.parentElement;
          }
        }
      }
      
      // STRATEGY: For EACH View Sailings button, find its parent offer card container
      // This ensures we capture ALL offers, even after promotional banners like "READY TO PLAY"
      const seenOfferCodes = new Set();
      
      for (const btn of viewSailingsButtons) {
        let parent = btn.parentElement;
        let bestContainer = null;
        
        // Walk up the DOM tree to find the complete offer card
        for (let i = 0; i < 15 && parent; i++) {
          const parentText = parent.textContent || '';
          const parentLower = parentText.toLowerCase();
          
          // MUST have offer code
          const offerCodeMatch = parentText.match(/\b(\d{2}(?:CLS|GOLD|C0|NEW|WEST|MAX|GO|MAR|WST|GRD|A0)[A-Z0-9%]{2,10})\b/i);
          if (!offerCodeMatch) {
            parent = parent.parentElement;
            continue;
          }
          
          const offerCode = offerCodeMatch[1].toUpperCase();
          
          // Skip if we already found this exact offer code (deduplication by DOM element)
          // BUT allow same code if it's a different DOM container (multiple offers with same name but different sailings)
          const hasRedeemDate = parentText.match(/Redeem by\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
          const hasCabinType = parentText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite)/i);
          const isReasonableSize = parentText.length > 100 && parentText.length < 3000;
          
          // Check if this container has exactly ONE offer (not a parent with multiple)
          const offerCodesInContainer = uniqueOfferCodes.filter(c => parentText.includes(c)).length;
          
          // Valid offer card if: has offer code, redeem date, cabin type, reasonable size, and ONLY ONE offer code
          if (offerCodeMatch && hasRedeemDate && hasCabinType && isReasonableSize && offerCodesInContainer === 1) {
            bestContainer = parent;
            break;
          }
          
          parent = parent.parentElement;
        }
        
        if (bestContainer && !offerCards.includes(bestContainer)) {
          const offerCodeMatch = bestContainer.textContent.match(/\b(\d{2}(?:CLS|GOLD|C0|NEW|WEST|MAX|GO|MAR|WST|GRD|A0)[A-Z0-9%]{2,10})\b/i);
          const offerCode = offerCodeMatch ? offerCodeMatch[1] : 'UNKNOWN';
          
          offerCards.push(bestContainer);
          
          const nameEl = bestContainer.querySelector('h1, h2, h3, h4, h5');
          const name = nameEl ? (nameEl.textContent || '').trim() : '';
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '✓ Found offer card: ' + offerCode + ' - ' + (name || '[No title]'),
            logType: 'success'
          }));
        }
      }
      
      // NOW process remaining buttons that weren't matched by code
      for (const btn of viewSailingsButtons) {
        let parent = btn.parentElement;
        let offerCard = null;
        
        // Work upwards to find the offer container
        for (let i = 0; i < 15 && parent; i++) {
          const parentText = parent.textContent || '';
          
          const hasOfferCode = parentText.match(/\\b([A-Z0-9]{6,12}[A-Z])\\b/);
          const hasTradeIn = parentText.toLowerCase().includes('trade-in value') || parentText.match(/\\$[\\d,]+\\.\\d{2}/);
          const hasRedeem = parentText.includes('Redeem by') || parentText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
          const hasFeatured = parentText.includes('Featured Offer');
          const hasOfferTitle = parentText.match(/\\b(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Full House|Lucky|Jackpot|Double|Triple|Bonus|Winner|Royal|Caribbean|Cruise|Sail|Summer|Winter|Spring|Fall|Holiday|Special|Gamechanger|Instant|Wager|MGM|Reward|Deal|Flash|Getaway)\\b/i);
          
          // CRITICAL: More lenient size check to catch offers after dividers
          const isReasonableSize = parentText.length > 80 && parentText.length < 8000;
          
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
          
          // Don't deduplicate by code - use element reference instead
          if (offerCard && !offerCards.includes(offerCard)) {
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
          message: 'Button-based detection found ' + offerCards.length + ' offers (expected ' + expectedOfferCount + '), trying ULTRA AGGRESSIVE fallback...',
          logType: 'warning'
        }));
        
        // ULTRA AGGRESSIVE: Scan ENTIRE page for ANY element that looks like an offer
        // Include ALL div, article, section elements regardless of class
        const allElements = Array.from(document.querySelectorAll('div, article, section, li, main > *, body > div > *, [class*="card"], [class*="offer"], [class*="promo"], [class*="deal"], [class*="tile"], [data-testid]'));
        
        const fallbackCards = allElements.filter(el => {
          const text = el.textContent || '';
          const textLower = text.toLowerCase();
          
          // Look for ANY View Sailings button
          const hasViewSailingsButton = Array.from(el.querySelectorAll('button, a, [role="button"], span, div')).some(child => {
            const childText = (child.textContent || '').toLowerCase().trim();
            return childText.length < 50 && (childText.includes('sailing') || childText.includes('view dates'));
          });
          
          // Offer indicators - be VERY lenient
          const hasOfferCode = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          const hasTradeIn = textLower.includes('trade-in') || textLower.includes('trade in');
          const hasRedeem = textLower.includes('redeem');
          const hasFeatured = textLower.includes('featured');
          const hasOfferKeywords = text.match(/(Balcony|Oceanview|Interior|Suite|Room for Two|Stateroom|Exclusive|Discounted|Ocean View)/i);
          const hasOfferTitle = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Gamechanger|Instant|Reward|MGM|Wager|Deal|Flash|Jackpot|Bonus|Getaway)/i);
          const hasExpiry = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
          const hasDollarValue = text.match(/\\$[\\d,]+/); // Trade-in values like $500.00
          const isReasonableSize = text.length > 50 && text.length < 15000;
          
          // VERY lenient: just need 1 strong indicator OR button + any indicator
          const strongIndicators = [hasOfferCode, hasTradeIn, hasRedeem, hasFeatured, hasDollarValue].filter(Boolean).length;
          const weakIndicators = [hasOfferKeywords, hasOfferTitle, hasExpiry, hasViewSailingsButton].filter(Boolean).length;
          
          return isReasonableSize && (strongIndicators >= 1 || (hasViewSailingsButton && weakIndicators >= 1) || weakIndicators >= 2);
        });
        
        const filteredFallback = fallbackCards.filter((el, idx, arr) => {
          return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
        });
        
        // Don't deduplicate by code - check if container already exists
        for (const card of filteredFallback) {
          if (!offerCards.includes(card)) {
            offerCards.push(card);
            
            const text = card.textContent || '';
            const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
            const code = codeMatch ? codeMatch[1] : '';
            
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
            message: 'Still missing offers (' + offerCards.length + '/' + expectedOfferCount + '), trying DEEP structure-based detection...',
            logType: 'warning'
          }));
          
          // DEEP SCAN: Look for offer codes directly and work backwards to find containers
          const offerCodeElements = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = (el.textContent || '').trim();
            return text.match(/^[A-Z0-9]{5,12}[A-Z]$/) && text.length < 20;
          });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Deep scan found ' + offerCodeElements.length + ' potential offer codes on page',
            logType: 'info'
          }));
          
          // Log each offer code found to help debug
          const codesFound = offerCodeElements.map(el => (el.textContent || '').trim()).slice(0, 15);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Offer codes found: ' + codesFound.join(', '),
            logType: 'info'
          }));
          
          // For EACH offer code, find its parent container that looks like an offer card
          for (const codeEl of offerCodeElements) {
            const codeText = (codeEl.textContent || '').trim();
            // Don't skip based on code - same code can appear multiple times
            
            let parent = codeEl.parentElement;
            let offerContainer = null;
            
            for (let i = 0; i < 12 && parent; i++) {
              const parentText = parent.textContent || '';
              const parentLower = parentText.toLowerCase();
              
              // Check if this container has offer signals
              const hasViewBtn = Array.from(parent.querySelectorAll('button, a, span, div')).some(btn => {
                const btnText = (btn.textContent || '').toLowerCase().trim();
                return btnText.length < 40 && (btnText.includes('sailing') || btnText.includes('view'));
              });
              const hasExpiry = parentText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
              const hasCabin = parentText.match(/(Balcony|Oceanview|Interior|Suite|Room for Two|Stateroom)/i);
              const isReasonableSize = parentText.length > 50 && parentText.length < 8000;
              
              if (isReasonableSize && (hasViewBtn || hasExpiry || hasCabin)) {
                // Check it only contains ONE offer code
                const codesInContainer = (parentText.match(/\\b[A-Z0-9]{5,12}[A-Z]\\b/g) || []);
                const uniqueCodes = [...new Set(codesInContainer)];
                if (uniqueCodes.length === 1 || parentText.length < 2000) {
                  offerContainer = parent;
                  break;
                }
              }
              parent = parent.parentElement;
            }
            
            if (offerContainer && !offerCards.includes(offerContainer)) {
              offerCards.push(offerContainer);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Deep scan found offer by code: ' + codeText + ' (total: ' + offerCards.length + ')',
                logType: 'info'
              }));
            }
          }
          
          const structuralCards = allElements.filter(el => {
            const text = el.textContent || '';
            const textLower = text.toLowerCase();
            const hasOfferCode = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
            const hasTradeIn = textLower.includes('trade-in') || textLower.includes('trade in');
            const hasRedeem = textLower.includes('redeem');
            const hasDollarAmount = text.match(/\\$[\\d,]+\\.?\\d*/); 
            const hasExpiry = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
            const hasCabinType = text.match(/(Balcony|Oceanview|Interior|Suite|Room for Two|Stateroom|Exclusive|Discounted|Ocean View)/i);
            const hasOfferName = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Gamechanger|Instant|Reward|MGM|Wager|Flash|Jackpot|Bonus|Royal|Premium|Getaway)/i);
            const hasViewButton = Array.from(el.querySelectorAll('button, a, span, div')).some(child => {
              const childText = (child.textContent || '').toLowerCase().trim();
              return childText.length < 50 && (childText.includes('sailing') || childText.includes('view'));
            });
            const isReasonableSize = text.length > 40 && text.length < 15000;
            const offerSignals = [hasOfferCode, hasTradeIn, hasRedeem, hasDollarAmount, hasExpiry, hasCabinType, hasOfferName, hasViewButton].filter(Boolean).length;
            
            // VERY lenient: just 1 strong signal or 2 weak signals
            return (hasOfferCode || hasTradeIn || hasRedeem) || (offerSignals >= 2 && isReasonableSize);
          });
          
          const filteredStructural = structuralCards.filter((el, idx, arr) => {
            return !arr.some((other, otherIdx) => otherIdx !== idx && other.contains(el));
          });
          
          for (const card of filteredStructural) {
            // Don't deduplicate - check if container already exists
            if (!offerCards.includes(card)) {
              offerCards.push(card);
              
              const text = card.textContent || '';
              const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
              const code = codeMatch ? codeMatch[1] : '';
              
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
