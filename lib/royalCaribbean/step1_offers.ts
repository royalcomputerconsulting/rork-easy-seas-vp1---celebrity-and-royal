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
      let featuredOfferCount = 0;
      let moreOfferCount = 0;
      const pageText = document.body.textContent || '';
      
      // Look for Featured Offers count
      const featuredMatch = pageText.match(/Featured\\s+Offers?\\s*\\((\\d+)\\)/i) ||
                           pageText.match(/Featured\\s*\\((\\d+)\\)/i);
      if (featuredMatch) {
        featuredOfferCount = parseInt(featuredMatch[1], 10);
      } else {
        // Check if there's a Featured Offers section with at least 1 offer
        const hasFeaturedSection = pageText.match(/Featured\\s+Offer/i);
        if (hasFeaturedSection) {
          featuredOfferCount = 1;
        }
      }
      
      // Look for More Offers count
      const moreMatch = pageText.match(/More\\s+Offers?\\s*\\((\\d+)\\)/i) ||
                       pageText.match(/More\\s*\\((\\d+)\\)/i) ||
                       pageText.match(/All\\s+Offers?\\s*\\((\\d+)\\)/i) ||
                       pageText.match(/Other\\s+Offers?\\s*\\((\\d+)\\)/i);
      if (moreMatch) {
        moreOfferCount = parseInt(moreMatch[1], 10);
      }
      
      // Also check for total offers pattern
      const totalMatch = pageText.match(/Offers\\s*\\((\\d+)\\)/i) ||
                        pageText.match(/(\\d+)\\s+Offers?\\s+Available/i);
      if (totalMatch && !moreMatch) {
        const totalFromPage = parseInt(totalMatch[1], 10);
        if (totalFromPage > featuredOfferCount) {
          moreOfferCount = totalFromPage - featuredOfferCount;
        } else {
          moreOfferCount = totalFromPage;
        }
      }
      
      expectedOfferCount = featuredOfferCount + moreOfferCount;
      
      if (expectedOfferCount > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '📋 Found ' + featuredOfferCount + ' Featured Offer(s), Found ' + moreOfferCount + ' More = ' + expectedOfferCount + ' Total Offers',
          logType: 'info'
        }));
      } else {
        // Fallback: count View Sailings buttons directly
        const quickButtonCount = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(btn => 
          (btn.textContent || '').toLowerCase().includes('sailing')
        ).length;
        if (quickButtonCount > 0) {
          expectedOfferCount = quickButtonCount;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '📋 Detected ' + expectedOfferCount + ' offer(s) from View Sailings buttons',
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
      
      // ULTRA AGGRESSIVE scrolling to ensure ALL 9 offers are loaded
      // Royal Caribbean uses lazy loading, so we need to scroll multiple times
      
      // CRITICAL: Function to close/hide promotional banners blocking the view
      async function closePromotionalBanners() {
        const bannerCloseSelectors = [
          '[class*="close"]',
          '[class*="dismiss"]',
          '[aria-label*="close"]',
          '[aria-label*="dismiss"]',
          'button[class*="modal"]',
          '[class*="overlay"] button',
          '[class*="banner"] button',
          '[class*="popup"] button'
        ];
        
        for (const selector of bannerCloseSelectors) {
          try {
            const closeButtons = document.querySelectorAll(selector);
            for (const btn of closeButtons) {
              const btnText = (btn.textContent || '').toLowerCase().trim();
              const isCloseButton = btnText === 'x' || btnText === '×' || btnText === 'close' || 
                                   btnText === 'dismiss' || btnText === '' || btnText.length < 5;
              const parentText = (btn.parentElement?.textContent || '').toLowerCase();
              const isInPromo = parentText.includes('ready to play') || 
                               parentText.includes('apply now') || 
                               parentText.includes('casino credit') ||
                               parentText.includes('keep the party');
              if (isCloseButton || isInPromo) {
                btn.click();
                await wait(200);
              }
            }
          } catch (e) {}
        }
        
        // Hide promotional banners from DOM
        const promoElements = document.querySelectorAll('[class*="promo"], [class*="banner"], [class*="overlay"], [class*="modal"]');
        for (const promo of promoElements) {
          const promoText = (promo.textContent || '').toLowerCase();
          if (promoText.includes('ready to play') || promoText.includes('apply now') || 
              promoText.includes('casino credit') || promoText.includes('keep the party')) {
            promo.style.display = 'none';
            promo.style.visibility = 'hidden';
            promo.style.height = '0';
            promo.style.overflow = 'hidden';
          }
        }
      }
      
      await closePromotionalBanners();
      
      for (let scrollPass = 0; scrollPass < 15; scrollPass++) {
        // Close banners every few passes
        if (scrollPass % 2 === 0) {
          await closePromotionalBanners();
        }
        
        // More thorough scrolling pattern to ensure lazy-loaded content appears
        const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        
        // Scroll to bottom
        window.scrollTo(0, docHeight);
        await wait(1200);
        
        // Scroll back up in steps to trigger any lazy loading
        window.scrollTo(0, docHeight * 0.8);
        await wait(600);
        window.scrollTo(0, docHeight * 0.6);
        await wait(600);
        window.scrollTo(0, docHeight * 0.4);
        await wait(600);
        window.scrollTo(0, docHeight * 0.2);
        await wait(600);
        
        // Scroll back down to bottom
        window.scrollTo(0, docHeight);
        await wait(1200);
        
        // Extra scroll past "bottom" to trigger any additional lazy loading
        window.scrollBy(0, 500);
        await wait(800);
        
        // Log progress
        if (scrollPass % 2 === 0) {
          const currentOfferButtons = document.querySelectorAll('button, a, [role="button"]');
          const viewSailingCount = Array.from(currentOfferButtons).filter(btn => 
            (btn.textContent || '').toLowerCase().includes('sailing')
          ).length;
          
          // Also count unique offer codes on page
          const pageText = document.body.textContent || '';
          const offerCodes = pageText.match(/\\b[A-Z0-9]{5,12}[A-Z0-9]\\b/g) || [];
          const uniqueCodes = [...new Set(offerCodes.filter(c => c.length >= 6 && c.length <= 12))].length;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Scroll pass ' + (scrollPass + 1) + '/15: Found ' + viewSailingCount + ' View Sailings buttons, ~' + uniqueCodes + ' offer codes',
            logType: 'info'
          }));
          
          // Send progress to prevent timeout during long scroll phase
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: 0,
            total: expectedOfferCount || viewSailingCount,
            stepName: 'Scrolling to load offers (pass ' + (scrollPass + 1) + '/15)'
          }));
          
          // Stop early if we found enough buttons (2x expected = each offer has 2 buttons)
          if (expectedOfferCount > 0 && viewSailingCount >= expectedOfferCount * 2) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '✓ Found all expected offer buttons, stopping scroll',
              logType: 'success'
            }));
            break;
          }
        }
      }
      
      await closePromotionalBanners();
      window.scrollTo(0, 0);
      await wait(1500);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Analyzing offers page structure...',
        logType: 'info'
      }));
      
      // Send progress to prevent timeout during analysis phase
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: expectedOfferCount,
        stepName: 'Analyzing offers page structure...'
      }));

      let offerCards = [];
      
      // CRITICAL: Ignore promotional banners like "READY TO PLAY?"
      // These banners appear BETWEEN offers and should NOT stop our detection
      // Strategy: Find ALL View Sailings buttons on the ENTIRE page, ignoring any promotional content
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Scanning entire page for all ' + expectedOfferCount + ' offers (ignoring promotional banners)...',
        logType: 'info'
      }));
      
      // STEP 1: First, explicitly filter out promotional banner containers
      // These have text like "READY TO PLAY?", "Apply now", "casino credit"
      const promotionalBanners = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = (el.textContent || '').toLowerCase();
        const hasPromoText = text.includes('ready to play') || 
                            text.includes('apply now') || 
                            text.includes('casino credit') ||
                            text.includes('keep the party going') ||
                            text.includes('onboard you can') ||
                            text.includes('sign up') ||
                            text.includes('join now') ||
                            text.includes('exclusive benefits');
        const isLargePromo = text.length > 30 && text.length < 1000 && hasPromoText;
        return isLargePromo && !text.includes('view sailing') && !text.match(/\b[A-Z0-9]{5,12}[A-Z]\b/);
      });
      
      // Hide promotional banners to prevent blocking
      for (const banner of promotionalBanners) {
        banner.style.display = 'none';
        banner.style.visibility = 'hidden';
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🚫 Hidden ' + promotionalBanners.length + ' promotional banner(s)...',
        logType: 'info'
      }));
      
      // Mark these banners so we can skip them
      const bannersSet = new Set(promotionalBanners);
      
      // STEP 2: Get ALL possible clickable elements EXCEPT those inside promotional banners
      const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"], [class*="btn"], [class*="button"], span[onclick], div[onclick], span, div, p')).filter(el => {
        // Exclude elements that are inside promotional banners
        return !Array.from(bannersSet).some(banner => banner.contains(el) || el.contains(banner));
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Scanning ' + allClickables.length + ' elements (excluding promotional banners) for View Sailings buttons...',
        logType: 'info'
      }));
      
      // Find ALL View Sailings buttons - be VERY lenient
      const viewSailingsButtons = allClickables.filter(el => {
        const text = (el.textContent || '').trim().toLowerCase();
        const isShortText = text.length < 50;
        // Check for any sailing-related text
        const hasSailingText = text.includes('sailing') || text.includes('dates') || text.includes('view');
        // Match various button patterns
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
               (text === 'select' && el.closest('[class*="offer"], [class*="card"]')) ||
               (hasSailingText && text.length < 25)
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
        
        // AGGRESSIVE: Look for ANY element with sailing in text
        const additionalButtons = allClickables.filter(el => {
          const text = (el.textContent || '').trim().toLowerCase();
          const alreadyFound = viewSailingsButtons.includes(el);
          return !alreadyFound && (text.includes('sailing') && text.length < 40);
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
              return btnText.length < 30 && (btnText.includes('sailing') || btnText.includes('view'));
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
      
      // CRITICAL: Track offers by a combination of code + index to handle DUPLICATE CODES
      // Multiple offers can have the SAME offer code (e.g., multiple "2026 January instant reward certificate")
      const offerCodeCounts = {}; // Track how many times we've seen each code
      const seenOfferCards = new Set(); // Track unique card elements to avoid duplicates
      const seenOfferCodes = new Map(); // Track codes to their card elements
      let buttonIndex = 0;
      
      // Helper function to check if element is user's account/tier display (NOT an offer)
      function isAccountStatusDisplay(element) {
        const text = (element.textContent || '').toLowerCase();
        const upperText = (element.textContent || '');
        // Filter out user's tier credits display and account info
        const isTierCreditsDisplay = text.includes('your current tier credits') || 
                                     text.includes('current tier credits') ||
                                     upperText.includes('Club Royale #') ||
                                     text.includes('club royale #') ||
                                     (text.includes('tier credits') && text.includes('club royale') && !text.includes('view sailing'));
        return isTierCreditsDisplay;
      }
      
      // Helper function to get bounding rect Y position for sorting
      function getButtonYPosition(btn) {
        try {
          const rect = btn.getBoundingClientRect();
          return rect.top + window.scrollY;
        } catch (e) {
          return 0;
        }
      }
      
      // Sort buttons by their Y position on page (top to bottom)
      // This ensures we process offers in order as they appear on page
      const sortedButtons = [...viewSailingsButtons].sort((a, b) => {
        return getButtonYPosition(a) - getButtonYPosition(b);
      });
      
      // First pass: collect all potential offer cards from buttons
      const buttonToCard = new Map();
      
      for (const btn of sortedButtons) {
        buttonIndex++;
        
        // Skip if this button is inside a promotional banner
        const isInsideBanner = Array.from(bannersSet).some(banner => banner.contains(btn));
        if (isInsideBanner) {
          continue;
        }
        
        let parent = btn.parentElement;
        let offerCard = null;
        let bestCandidate = null;
        let bestCandidateScore = 0;
        
        // Work upwards to find the offer container - be MORE lenient
        for (let i = 0; i < 20 && parent; i++) {
          const parentText = parent.textContent || '';
          const parentLower = parentText.toLowerCase();
          
          // Check for offer signals
          const hasOfferCode = parentText.match(/\\b([A-Z0-9]{5,12}[A-Z0-9])\\b/);
          const hasTradeIn = parentLower.includes('trade-in value') || parentLower.includes('trade in value');
          const hasRedeem = parentText.includes('Redeem by') || parentText.match(/Redeem\s+by/i);
          const hasFeatured = parentText.includes('Featured Offer');
          const hasExpiry = parentText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
          const hasCabinType = parentText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite|Room for Two|Stateroom)/i);
          const hasDollarValue = parentText.match(/\\$[\\d,]+\\.?\\d*/); // Trade-in values
          const hasOfferKeyword = parentText.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Last Chance|Gamechanger|Instant|Reward|MGM|Wager|Gold|Coast|Spins|Getaway)/i);
          
          const isReasonableSize = parentText.length > 50 && parentText.length < 8000;
          
          // Calculate signal score
          let score = 0;
          if (hasOfferCode) score += 3;
          if (hasTradeIn) score += 3;
          if (hasRedeem) score += 2;
          if (hasExpiry) score += 2;
          if (hasCabinType) score += 1;
          if (hasDollarValue) score += 2;
          if (hasOfferKeyword) score += 1;
          if (hasFeatured) score += 1;
          
          if (isReasonableSize && score >= 2) {
            const buttonsInContainer = Array.from(parent.querySelectorAll('button, a, [role="button"]')).filter(el => 
              (el.textContent || '').match(/View Sailing|VIEW SAILING|See Sailing/i)
            );
            
            // Allow containers with 1-3 View Sailings buttons (RC sometimes has multiple)
            if (buttonsInContainer.length >= 1 && buttonsInContainer.length <= 3) {
              // Prefer smaller containers with higher signal density
              const density = score / (parentText.length / 100);
              if (density > bestCandidateScore || (density === bestCandidateScore && parentText.length < (bestCandidate?.textContent?.length || Infinity))) {
                bestCandidate = parent;
                bestCandidateScore = density;
              }
              
              // If we have a strong signal, use this container
              if (score >= 4 && buttonsInContainer.length <= 2) {
                offerCard = parent;
                break;
              }
            }
            // If too many buttons, this container is too large - keep looking up
            if (buttonsInContainer.length > 3) {
              parent = parent.parentElement;
              continue;
            }
          }
          
          parent = parent.parentElement;
        }
        
        // Use best candidate if we didn't find a definitive offer card
        if (!offerCard && bestCandidate) {
          offerCard = bestCandidate;
        }
        
        if (offerCard) {
          buttonToCard.set(btn, offerCard);
        }
      }
      
      // Second pass: deduplicate and add unique offer cards
      for (const btn of sortedButtons) {
        const offerCard = buttonToCard.get(btn);
        if (!offerCard) continue;
        
        // Skip if we've already processed this exact card element
        if (seenOfferCards.has(offerCard)) {
          continue;
        }
        
        // CRITICAL: Skip user's account status/tier credits display - it's NOT an offer
        if (isAccountStatusDisplay(offerCard)) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '🚫 Skipping account status display (not an offer)',
            logType: 'info'
          }));
          continue;
        }
        
        const cardText = offerCard.textContent || '';
        
        // Look for offer code - be more flexible with pattern
        const codeMatch = cardText.match(/\\b([A-Z0-9]{5,12}[A-Z0-9])\\b/);
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
        
        // CRITICAL: Handle MULTIPLE offers with the SAME offer code
        // Each unique card element is a unique offer, even if codes match
        const baseKey = offerCode || ('btn-' + buttonIndex + '-' + (offerName || 'unknown'));
        
        // Initialize or increment the count for this code
        if (!offerCodeCounts[baseKey]) {
          offerCodeCounts[baseKey] = 0;
        }
        offerCodeCounts[baseKey]++;
        
        // Mark this card as seen
        seenOfferCards.add(offerCard);
        offerCards.push(offerCard);
        
        const duplicateIndex = offerCodeCounts[baseKey];
        const duplicateLabel = duplicateIndex > 1 ? ' [#' + duplicateIndex + ']' : '';
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Identified offer card: ' + (offerName || offerCode || '[Unknown]') + duplicateLabel + ' (code: ' + (offerCode || 'N/A') + ')',
          logType: 'info'
        }));
      }
      
      // CRITICAL: If we still don't have enough offers, try finding by View Sailings button position
      // Some offers may have buttons that don't have proper parent containers
      if (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Button-based detection found ' + offerCards.length + ' offers (expected ' + expectedOfferCount + '), trying POSITION-BASED fallback...',
          logType: 'warning'
        }));
        
        // Strategy: Group View Sailings buttons by their vertical position on page
        // Each unique Y position likely represents a different offer
        // Use absolute page position (including scroll offset)
        const buttonPositions = viewSailingsButtons.map(btn => {
          const rect = btn.getBoundingClientRect();
          const absY = rect.top + window.scrollY;
          return { btn, y: Math.round(absY / 100) * 100 }; // Group by 100px bands for better separation
        });
        
        // Group buttons by Y position
        const positionGroups = {};
        buttonPositions.forEach(({ btn, y }) => {
          if (!positionGroups[y]) positionGroups[y] = [];
          positionGroups[y].push(btn);
        });
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Position fallback found ' + Object.keys(positionGroups).length + ' unique Y positions',
          logType: 'info'
        }));
        
        // For each unique position, find the offer container
        for (const [yPos, btns] of Object.entries(positionGroups)) {
          const btn = btns[0]; // Take first button at this position
          
          // Find parent container that looks like an offer - be VERY lenient
          let parent = btn.parentElement;
          let bestContainer = null;
          
          for (let i = 0; i < 25 && parent; i++) {
            const parentText = parent.textContent || '';
            const parentLower = parentText.toLowerCase();
            
            // Check for ANY offer signal
            const hasOfferCode = parentText.match(/\\b([A-Z0-9]{5,12}[A-Z0-9])\\b/);
            const hasTradeIn = parentLower.includes('trade-in') || parentLower.includes('trade in');
            const hasRedeem = parentText.includes('Redeem by') || parentText.match(/Redeem\\s+by/i);
            const hasExpiry = parentText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\w*\\s+\\d+,\\s*\\d{4}/i);
            const hasDollarValue = parentText.match(/\\$[\\d,]+\\.?\\d*/);
            const hasCabinType = parentText.match(/(Balcony|Oceanview|Ocean View|Interior|Suite|Room for Two)/i);
            const isReasonableSize = parentText.length > 40 && parentText.length < 10000;
            
            const hasAnySignal = hasOfferCode || hasTradeIn || hasRedeem || hasExpiry || hasDollarValue || hasCabinType;
            
            if (hasAnySignal && isReasonableSize && !seenOfferCards.has(parent) && !isAccountStatusDisplay(parent)) {
              // Count buttons in this container
              const btnsInParent = Array.from(parent.querySelectorAll('button, a, [role="button"]')).filter(el => 
                (el.textContent || '').toLowerCase().includes('sailing')
              ).length;
              
              // Accept containers with 1-4 View Sailings buttons
              if (btnsInParent >= 1 && btnsInParent <= 4) {
                bestContainer = parent;
                // If container has strong signals and reasonable button count, use it
                if ((hasOfferCode || hasTradeIn) && btnsInParent <= 2) {
                  break;
                }
              }
            }
            parent = parent.parentElement;
          }
          
          if (bestContainer && !seenOfferCards.has(bestContainer)) {
            seenOfferCards.add(bestContainer);
            offerCards.push(bestContainer);
            
            const containerText = bestContainer.textContent || '';
            const codeMatch = containerText.match(/\\b([A-Z0-9]{5,12}[A-Z0-9])\\b/);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Position-based detection found offer at Y=' + yPos + ' (code: ' + (codeMatch ? codeMatch[1] : 'N/A') + ')',
              logType: 'info'
            }));
          }
        }
      }
      
      if (offerCards.length === 0 || (expectedOfferCount > 0 && offerCards.length < expectedOfferCount)) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Still only found ' + offerCards.length + ' offers (expected ' + expectedOfferCount + '), trying ULTRA AGGRESSIVE fallback (ignoring banners)...',
          logType: 'warning'
        }));
        
        // ULTRA AGGRESSIVE: Scan ENTIRE page for ANY element that looks like an offer
        // Include ALL div, article, section elements regardless of class
        // BUT exclude promotional banners
        const allElements = Array.from(document.querySelectorAll('div, article, section, li, main > *, body > div > *, [class*="card"], [class*="offer"], [class*="promo"], [class*="deal"], [class*="tile"], [data-testid]')).filter(el => {
          // Skip if inside a promotional banner
          return !Array.from(bannersSet).some(banner => banner.contains(el) || el === banner);
        });
        
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
        
        // Track seen card elements to avoid duplicates (but allow same code from different cards)
        const existingCardElements = new Set(offerCards);
        
        for (const card of filteredFallback) {
          // Skip if we've already processed this exact card element
          if (existingCardElements.has(card)) {
            continue;
          }
          
          const text = card.textContent || '';
          const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
          const code = codeMatch ? codeMatch[1] : '';
          
          // Allow cards even with duplicate codes - they may be different offers
          // But skip account status displays
          if (code && !isAccountStatusDisplay(card)) {
            existingCardElements.add(card);
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
            message: 'Still missing offers (' + offerCards.length + '/' + expectedOfferCount + '), trying DEEP structure-based detection...',
            logType: 'warning'
          }));
          
          // DEEP SCAN: Look for offer codes directly and work backwards to find containers
          // FIXED: Look for offer codes in larger text contexts, not just exact matches
          // IMPROVED: Also scan for known RC offer code patterns
          const offerCodeElements = Array.from(document.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, [class*="code"], [class*="offer"]')).filter(el => {
            const text = (el.textContent || '').trim();
            // Match various offer code patterns:
            // - Standard: 26CLS103, 2601C05, 26NEW104, 26WST104, 26GRD103G
            // - MGM: 25GOLD%
            // - With letters: 2601A05, 2601A08
            const hasCode = text.match(/\\b[A-Z0-9]{5,12}[A-Z0-9%]\\b/) || 
                           text.match(/\\b\\d{2}[A-Z]{2,5}\\d{2,3}[A-Z]?\\b/) ||
                           text.match(/\\b\\d{4}[A-Z]\\d{2}[A-Z]?\\b/);
            const isShortEnough = text.length < 150;
            // Exclude navigation, header, footer elements
            const isNotNav = !el.closest('nav, header, footer, [role="navigation"]');
            // Exclude promotional banners
            const isNotBanner = !Array.from(bannersSet).some(banner => banner.contains(el));
            return hasCode && isShortEnough && isNotNav && isNotBanner;
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
          
          // Track seen containers to avoid duplicates
          const seenContainers = new Set(offerCards);
          
          // For EACH offer code, find its parent container that looks like an offer card
          for (const codeEl of offerCodeElements) {
            const codeText = (codeEl.textContent || '').trim();
            
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
            
            // Allow same code from different containers (different offers with same code)
            if (offerContainer && !seenContainers.has(offerContainer)) {
              seenContainers.add(offerContainer);
              offerCards.push(offerContainer);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Deep scan found offer by code: ' + codeText,
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
            // Skip if already seen this card element
            if (seenContainers.has(card)) {
              continue;
            }
            
            const text = card.textContent || '';
            const codeMatch = text.match(/\\b([A-Z0-9]{5,12}[A-Z])\\b/);
            const code = codeMatch ? codeMatch[1] : '';
            
            // Allow same code from different cards (different offers with same code)
            // But skip account status displays
            if (code && !isAccountStatusDisplay(card)) {
              seenContainers.add(card);
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
        message: '✅ Identified ' + offerCards.length + ' offer cards on page' + (expectedOfferCount > 0 ? ' (expected: ' + expectedOfferCount + ')' : ''),
        logType: (expectedOfferCount > 0 && offerCards.length < expectedOfferCount) ? 'warning' : 'success'
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
        
        // Extract offer code IMMEDIATELY after getting cardText to avoid temporal dead zone
        const offerCodeMatch = cardText.match(/([A-Z0-9]{5,15})/);
        const offerCode = offerCodeMatch ? offerCodeMatch[1] : '';
        
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
        
        // offerCode already extracted at start of loop
        
        if (!offerName || offerName.length < 3) {
          if (offerCode) {
            offerName = 'Offer ' + offerCode;
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
        
        // CRITICAL: Skip if offer name indicates it's account status, not an actual offer
        const offerNameLower = offerName.toLowerCase();
        if (offerNameLower.includes('your current tier') || 
            offerNameLower.includes('tier credits') ||
            offerName.includes('Club Royale #') ||
            offerCode === 'CURRENT') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '🚫 Skipping account status display: ' + offerName.substring(0, 50) + '...',
            logType: 'info'
          }));
          continue;
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '  Offer Name: ' + offerName,
          logType: 'info'
        }));
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
