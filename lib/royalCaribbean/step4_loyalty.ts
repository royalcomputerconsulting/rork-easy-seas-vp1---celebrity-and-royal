export const STEP4_LOYALTY_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function extractLoyaltyStatus() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Loading Loyalty Programs page...',
        logType: 'info'
      }));

      await wait(5000);
      
      let waitCount = 0;
      while (waitCount < 10 && document.body.textContent.length < 1000) {
        await wait(500);
        waitCount++;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting Crown & Anchor data...',
        logType: 'info'
      }));

      const loyaltyData = {
        crownAndAnchorLevel: '',
        crownAndAnchorMemberNumber: '',
        crownAndAnchorPoints: '',
        pointsToNextTier: '',
        cruiseNights: '',
        clubRoyaleTier: '',
        clubRoyalePoints: ''
      };

      const pageText = document.body.textContent || '';

      const tierMatch = pageText.match(/(Diamond Plus|Diamond|Platinum|Gold|Silver|Emerald)(?!.*Member:)/);
      if (tierMatch) {
        loyaltyData.crownAndAnchorLevel = tierMatch[1];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found tier: ' + tierMatch[1],
          logType: 'info'
        }));
      }

      const memberMatch = pageText.match(/Member:\\s*(\\d+)/);
      if (memberMatch) {
        loyaltyData.crownAndAnchorMemberNumber = memberMatch[1];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found member#: ' + memberMatch[1],
          logType: 'info'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Searching for Crown & Anchor cruise points (looking for large prominent number)...',
        logType: 'info'
      }));
      
      let cruisePointsFound = false;
      const allCandidates = [];
      
      // FIRST PASS: Scan ALL elements for ANY standalone 2-4 digit numbers
      // This ensures we don't miss the main number (like 503)
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '📊 Phase 1: Scanning ALL elements for standalone numbers...',
        logType: 'info'
      }));
      
      const allPageElements = document.querySelectorAll('*');
      const rawNumbers = [];
      for (const el of allPageElements) {
        const text = (el.textContent || '').trim();
        // Only look at elements with JUST a number (no other text)
        if (text.match(/^\d{2,4}$/)) {
          const num = parseInt(text, 10);
          if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026 && num !== 2024 && num !== 2023) {
            rawNumbers.push({ num, el, text });
          }
        }
      }
      
      // Log what we found
      const uniqueRawNums = [...new Set(rawNumbers.map(r => r.num))].sort((a, b) => b - a);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '  ➜ Found ' + uniqueRawNums.length + ' unique standalone numbers: ' + uniqueRawNums.slice(0, 10).join(', '),
        logType: 'info'
      }));
      
      // Now process each number and determine its context
      for (const { num, el, text } of rawNumbers) {
        const parentText = (el.parentElement?.textContent || '').toLowerCase();
        const grandparentText = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
        const greatGrandparentText = (el.parentElement?.parentElement?.parentElement?.textContent || '').toLowerCase();
        
        // CRITICAL EXCLUSIONS (only exclude if we're CERTAIN it's not cruise points)
        const isTierCredits = parentText.includes('tier credit') || grandparentText.includes('tier credit') || greatGrandparentText.includes('tier credit');
        const isPointsToNext = parentText.includes('points to') || parentText.includes('points away') || grandparentText.includes('points to') || grandparentText.includes('points away');
        const isToNextTier = parentText.includes('to diamond') || parentText.includes('to platinum') || parentText.includes('to gold') || parentText.includes('to emerald');
        const isDate = parentText.includes('feb') || parentText.includes('jan') || parentText.includes('mar') || parentText.includes('apr');
        
        if (isTierCredits || isPointsToNext || isToNextTier || isDate) {
          continue; // Skip this number
        }
        
        // Check for positive signals
        const nearYourTier = parentText.includes('your tier') || grandparentText.includes('your tier') || greatGrandparentText.includes('your tier');
        const nearNightsEarned = parentText.includes('nights earned') || grandparentText.includes('nights earned') || parentText.includes('cruise nights') || grandparentText.includes('cruise nights');
        const nearCrownAnchor = parentText.includes('crown') || parentText.includes('anchor') || grandparentText.includes('crown') || grandparentText.includes('anchor');
        
        // Get visual prominence
        const computedStyle = window.getComputedStyle(el);
        const fontSize = parseFloat(computedStyle.fontSize) || 0;
        const fontWeight = computedStyle.fontWeight;
        const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900';
        const isHeading = el.tagName.match(/^H[1-6]$/i);
        const isVeryLarge = fontSize > 40;
        const isLarge = fontSize > 30;
        const isMedium = fontSize > 20;
        
        // PRIORITY CALCULATION (lower = better)
        let priority = 10;
        
        // ABSOLUTE TOP PRIORITY: Large numbers (400+) with prominent display
        if (num >= 400 && isVeryLarge) {
          priority = 0;
        }
        // SECOND: 300+ with very large font
        else if (num >= 300 && (isVeryLarge || (isLarge && isBold))) {
          priority = 0;
        }
        // THIRD: Any number with "nights earned" nearby (strongest text signal)
        else if (nearNightsEarned && num >= 100) {
          priority = 0;
        }
        // FOURTH: 400+ with large font
        else if (num >= 400 && (isLarge || nearYourTier)) {
          priority = 1;
        }
        // FIFTH: 300+ with medium+ font
        else if (num >= 300 && (isLarge || isMedium)) {
          priority = 2;
        }
        // SIXTH: 200-299 with styling
        else if (num >= 200 && (isLarge || isBold || isHeading)) {
          priority = 4;
        }
        // LOWER: 200+ without much styling
        else if (num >= 200) {
          priority = 6;
        }
        // VERY LOW: 100-199 (likely NOT the main cruise points)
        else if (num >= 100) {
          priority = 8;
        }
        // LOWEST: < 100
        else {
          priority = 10;
        }
        
        allCandidates.push({
          value: num,
          str: text,
          source: 'page-scan',
          priority: priority,
          fontSize: fontSize,
          isBold: isBold,
          nearYourTier: nearYourTier,
          nearNightsEarned: nearNightsEarned
        });
      }
      
      // PRIORITY STRATEGY 1: Look for "nights earned" pattern (most explicit)
      const nightsEarnedPatterns = [
        /(\\d{1,4})\\s*(?:nights?|cruise\\s+nights?)\\s*earned/gi,
        /(?:nights?|cruise\\s+nights?)\\s*earned[:\\s]*(\\d{1,4})/gi,
        /(\\d{1,4})\\s*cruise\\s*(?:points?|nights?)/gi,
        /cruise\\s*(?:points?|nights?)[:\\s]*(\\d{1,4})/gi
      ];
      
      for (const pattern of nightsEarnedPatterns) {
        let match;
        while ((match = pattern.exec(pageText)) !== null) {
          if (match[1]) {
            const num = parseInt(match[1], 10);
            // CRITICAL: Minimum 20 points to avoid picking up random small numbers
            if (num >= 20 && num <= 2000) {
              allCandidates.push({ value: num, str: match[1], source: 'nights-earned', priority: 1 });
            }
          }
        }
      }
      
      // PRIORITY STRATEGY 2: Find "YOUR TIER" and scan ALL nearby prominent elements
      const allElements = document.querySelectorAll('*');
      let yourTierElement = null;
      
      for (const el of allElements) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text === 'your tier' || (text.includes('your tier') && text.length < 50)) {
          yourTierElement = el;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '✓ Found YOUR TIER section',
            logType: 'info'
          }));
          break;
        }
      }
      
      if (yourTierElement) {
        // ULTRA PRIORITY: Find the FIRST and LARGEST standalone number immediately under "YOUR TIER"
        // This is almost always the actual cruise points displayed prominently (e.g., 503)
        let container = yourTierElement.parentElement;
        for (let level = 0; level < 15 && container; level++) {
          // Get ALL elements, including those without specific classes
          const allContainerElements = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p, strong, b, [class*="large"], [class*="big"], [class*="hero"], [class*="count"], [class*="number"], [class*="point"], [class*="tier"], [class*="badge"], [class*="stat"], [class*="value"], [class*="display"]'));
          
          // Sort by DOM order (elements appearing earlier get priority)
          const elementsWithOrder = allContainerElements.map((el, index) => ({ el, index }));
          
          for (const { el, index } of elementsWithOrder) {
            const elText = (el.textContent || '').trim();
            // Look for STANDALONE numbers - MUST be at least 2 digits
            const standaloneMatch = elText.match(/^(\\d{2,4})$/);
            if (standaloneMatch) {
              const num = parseInt(standaloneMatch[1], 10);
              // Minimum 50 points, exclude years and tier credits
              if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026 && num !== 2024 && num !== 2023) {
                // Check this isn't tier credits or points to next tier
                const parentText = (el.parentElement?.textContent || '').toLowerCase();
                const grandparentText = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
                const greatGrandparentText = (el.parentElement?.parentElement?.parentElement?.textContent || '').toLowerCase();
                
                // Look for "nights earned" or "cruise nights" nearby (strongest signal)
                const nearNightsEarned = parentText.includes('nights earned') || 
                                         grandparentText.includes('nights earned') ||
                                         parentText.includes('cruise nights') ||
                                         grandparentText.includes('cruise nights');
                
                const isNotTierCredits = !parentText.includes('tier credit') && 
                                          !grandparentText.includes('tier credit') &&
                                          !greatGrandparentText.includes('tier credit') &&
                                          !parentText.includes('100,000') &&
                                          !parentText.includes('to diamond') &&
                                          !parentText.includes('to platinum') &&
                                          !parentText.includes('to gold') &&
                                          !parentText.includes('points to') &&
                                          !parentText.includes('points away') &&
                                          !grandparentText.includes('points to') &&
                                          !grandparentText.includes('points away');
                
                if (isNotTierCredits) {
                  // HIGHEST priority for larger numbers displayed prominently
                  const isHeading = el.tagName.match(/^H[1-6]$/i);
                  const isLargeClass = (el.className || '').toLowerCase().includes('large') || 
                                        (el.className || '').toLowerCase().includes('big') ||
                                        (el.className || '').toLowerCase().includes('hero') ||
                                        (el.className || '').toLowerCase().includes('count') ||
                                        (el.className || '').toLowerCase().includes('badge') ||
                                        (el.className || '').toLowerCase().includes('stat') ||
                                        (el.className || '').toLowerCase().includes('display') ||
                                        (el.className || '').toLowerCase().includes('value');
                  const elementSize = el.offsetHeight || 0;
                  const isLarge = elementSize > 30;
                  
                  // CRITICAL: 503 displayed PROMINENTLY under YOUR TIER gets ABSOLUTE TOP priority
                  // The HUGE number (300+) is the actual cruise nights, not smaller numbers like 140
                  let priority = 10;
                  if (nearNightsEarned && num >= 100) {
                    // ABSOLUTE TOP: Number with "nights earned" or "cruise nights" nearby
                    priority = 0;
                  } else if (num >= 400 && (isHeading || isLargeClass || isLarge)) {
                    // CRITICAL: Large numbers (503) displayed prominently = HIGHEST priority
                    priority = 0;
                  } else if (num >= 400) {
                    // High: 400+ without styling
                    priority = 1;
                  } else if (num >= 300 && (isHeading || isLargeClass || isLarge)) {
                    priority = 1;
                  } else if (num >= 300) {
                    priority = 2;
                  } else if (num >= 200 && (isHeading || isLargeClass)) {
                    priority = 3;
                  } else if (num >= 200) {
                    priority = 4;
                  } else if (num >= 150) {
                    // 140-199 range gets LOW priority (NOT the main number)
                    priority = (isHeading || isLargeClass) ? 8 : 9;
                  } else {
                    // Very small numbers get lowest priority
                    priority = 10;
                  }
                  
                  allCandidates.push({ 
                    value: num, 
                    str: standaloneMatch[1], 
                    source: 'your-tier-standalone', 
                    priority: priority
                  });
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: '  ➜ Found standalone number near YOUR TIER: ' + num + ' (priority: ' + priority + ', nights: ' + nearNightsEarned + ', heading: ' + !!isHeading + ', large: ' + (isLargeClass || isLarge) + ', size: ' + elementSize + ')',
                    logType: 'info'
                  }));
                }
              }
            }
          }
          container = container.parentElement;
        }
      }
      
      // PRIORITY STRATEGY 3: Look near tier name for prominent numbers
      if (loyaltyData.crownAndAnchorLevel) {
        const tierElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div[class*="large"], span[class*="large"], div[class*="tier"], span[class*="tier"], div[class*="point"], span[class*="point"]');
        for (const el of tierElements) {
          const text = (el.textContent || '').trim();
          if (text.includes(loyaltyData.crownAndAnchorLevel)) {
            // Look for sibling elements with standalone numbers
            const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
            for (const sibling of siblings) {
              const sibText = (sibling.textContent || '').trim();
              // MUST be at least 2 digits to avoid random small numbers
              const standaloneMatch = sibText.match(/^(\\d{2,4})$/);
              if (standaloneMatch) {
                const num = parseInt(standaloneMatch[1], 10);
                // CRITICAL: Minimum 50 points to exclude small numbers
                if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026) {
                  allCandidates.push({ value: num, str: standaloneMatch[1], source: 'near-tier', priority: 4 });
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'log',
                    message: '  ➜ Found standalone number near tier: ' + num,
                    logType: 'info'
                  }));
                }
              }
            }
            
            // Also scan parent container for prominent numbers
            const parentContainer = el.parentElement?.parentElement;
            if (parentContainer) {
              const containerElements = Array.from(parentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6, span, div, p'));
              for (const contEl of containerElements) {
                const contText = (contEl.textContent || '').trim();
                const contMatch = contText.match(/^(\\d{2,4})$/);
                if (contMatch) {
                  const num = parseInt(contMatch[1], 10);
                  if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026) {
                    const alreadyExists = allCandidates.some(c => c.value === num);
                    if (!alreadyExists) {
                      allCandidates.push({ value: num, str: contMatch[1], source: 'tier-container', priority: 5 });
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // STRATEGY 4: Look for prominent standalone numbers anywhere on page (2-4 digits)
      // This catches the big "503" displayed prominently under YOUR TIER
      const prominentNumberElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, [class*="large"], [class*="big"], [class*="hero"], [class*="featured"], [class*="primary"], [class*="title"], [class*="count"], [class*="number"], [class*="badge"], [class*="stat"], div[style*="font-size"], span[style*="font-size"]');
      for (const el of prominentNumberElements) {
        const elText = (el.textContent || '').trim();
        const numMatch = elText.match(/^(\\d{2,4})$/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026 && num !== 2024 && num !== 2023) {
            const parentText = (el.parentElement?.textContent || '').toLowerCase();
            const grandparentText = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
            const greatGrandparentText = (el.parentElement?.parentElement?.parentElement?.textContent || '').toLowerCase();
            
            // Check if near "your tier" or "cruise nights" or similar
            const nearYourTier = parentText.includes('your tier') || grandparentText.includes('your tier') || greatGrandparentText.includes('your tier');
            const nearCruiseNights = parentText.includes('cruise night') || grandparentText.includes('cruise night') || parentText.includes('nights earned');
            
            // Exclude if it's tier credits, dates, or points-to-next
            const isValid = !parentText.includes('tier credit') && 
                           !grandparentText.includes('tier credit') &&
                           !greatGrandparentText.includes('tier credit') &&
                           !parentText.includes('100,000') && 
                           !parentText.includes('feb') && 
                           !parentText.includes('jan') &&
                           !parentText.includes('to diamond') &&
                           !parentText.includes('to platinum') &&
                           !parentText.includes('points to') &&
                           !parentText.includes('points away') &&
                           !grandparentText.includes('points to') &&
                           !grandparentText.includes('points away');
            
            if (isValid) {
              // Check element styling to determine if it's displayed PROMINENTLY
              const computedStyle = window.getComputedStyle(el);
              const fontSize = parseFloat(computedStyle.fontSize) || 0;
              const fontWeight = computedStyle.fontWeight;
              const isVeryLarge = fontSize > 40;
              const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900';
              
              // CRITICAL: Strongly prioritize LARGE numbers (400+) displayed prominently
              // User's actual cruise points like 503 should ALWAYS win over small numbers like 140
              let priority = 10;
              
              // ABSOLUTE TOP: 400+ with very large font (> 40px)
              if (num >= 400 && isVeryLarge) {
                priority = 0;
              }
              // SECOND: 300+ with very large font
              else if (num >= 300 && isVeryLarge) {
                priority = 0;
              }
              // THIRD: Any number with "nights earned" or "cruise nights" nearby
              else if (nearCruiseNights && num >= 100) {
                priority = 0;
              }
              // FOURTH: 400+ with large font or bold (even without "very large")
              else if (num >= 400 && (nearYourTier || isBold || fontSize > 30)) {
                priority = 1;
              }
              // FIFTH: 300+ with styling
              else if (num >= 300 && (isVeryLarge || isBold || fontSize > 30 || nearYourTier)) {
                priority = 2;
              }
              // LOWER: 200-299
              else if (num >= 200) {
                priority = (isVeryLarge || fontSize > 30) ? 4 : 6;
              }
              // VERY LOW: 100-199 (like 140 - definitely NOT the main cruise points number)
              else if (num >= 150) {
                priority = 9;
              }
              // LOWEST: < 150
              else {
                priority = 10;
              }
              
              allCandidates.push({ value: num, str: numMatch[1], source: 'prominent-number', priority: priority });
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '  ➜ Found prominent number: ' + num + ' (priority: ' + priority + ', nearYourTier: ' + nearYourTier + ', nearNights: ' + nearCruiseNights + ', fontSize: ' + fontSize + 'px, bold: ' + isBold + ')',
                logType: 'info'
              }));
            }
          }
        }
      }
      
      // FALLBACK: Pattern matching
      const fallbackPatterns = [
        /(\\d{2,4})\\s*Cruise Points?/i,
        /Cruise Points?[:\\s]+(\\d{2,4})/i,
        /(\\d{2,4})\\s*(?:nights?|points?)\\s*earned/i
      ];
      
      for (const pattern of fallbackPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          // CRITICAL: Minimum 50 points to avoid small random numbers
          if (num >= 50 && num <= 2000) {
            allCandidates.push({ value: num, str: match[1], source: 'pattern', priority: 10 });
          }
        }
      }
      
      // Sort candidates by priority (lower = better) and value (higher = better for tie-break)
      allCandidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.value - a.value;
      });
      
      // Remove duplicates
      const uniqueCandidates = [];
      const seenValues = new Set();
      for (const cand of allCandidates) {
        if (!seenValues.has(cand.value)) {
          seenValues.add(cand.value);
          uniqueCandidates.push(cand);
        }
      }
      
      if (uniqueCandidates.length > 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found ' + uniqueCandidates.length + ' candidate(s): ' + uniqueCandidates.slice(0, 3).map(c => c.value + ' (' + c.source + ')').join(', '),
          logType: 'info'
        }));
      }
      
      // Remove duplicates first
      const seenInUnique = new Set();
      const trulyUnique = uniqueCandidates.filter(c => {
        if (seenInUnique.has(c.value)) return false;
        seenInUnique.add(c.value);
        return true;
      });
      
      // CRITICAL: Sort by PRIORITY first (best strategy), then by VALUE (largest)
      // This ensures 503 with good context beats 140 with "nights earned" tag
      trulyUnique.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.value - a.value;
      });
      
      // CRITICAL SAFETY CHECK: Large prominent numbers (300+) should ALWAYS win over small numbers
      // User's actual cruise points like 503 are displayed PROMINENTLY and should beat small numbers like 140
      if (trulyUnique.length > 0) {
        const topPick = trulyUnique[0];
        
        // Find any 400+ candidate (very likely to be the actual cruise points)
        const veryLargeCandidate = trulyUnique.find(c => c.value >= 400);
        
        // If top pick is < 300 but we have a 400+ candidate, ALWAYS prefer the larger one
        if (topPick.value < 300 && veryLargeCandidate) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '⚠️ OVERRIDE: Top pick is ' + topPick.value + ' but found much larger value ' + veryLargeCandidate.value + ' - switching!',
            logType: 'warning'
          }));
          
          trulyUnique.splice(trulyUnique.indexOf(veryLargeCandidate), 1);
          trulyUnique.unshift(veryLargeCandidate);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: '✓ Switched to larger value: ' + veryLargeCandidate.value + ' (much more likely to be actual cruise points)',
            logType: 'success'
          }));
        }
        // If top pick is < 200 but we have a 300+ candidate, review
        else if (topPick.value < 200) {
          const largerCandidate = trulyUnique.find(c => c.value >= 300);
          if (largerCandidate) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '⚠️ WARNING: Top pick is ' + topPick.value + ' but found larger value ' + largerCandidate.value + ' - reviewing...',
              logType: 'warning'
            }));
            
            // If larger number has ANY reasonable priority (< 6), prefer it
            if (largerCandidate.priority <= 6) {
              trulyUnique.splice(trulyUnique.indexOf(largerCandidate), 1);
              trulyUnique.unshift(largerCandidate);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '✓ Switched to larger value: ' + largerCandidate.value,
                logType: 'success'
              }));
            }
          }
        }
      }
      
      if (trulyUnique.length > 0) {
        // Pick the best candidate (sorted by priority then value)
        let bestCandidate = trulyUnique[0];
        
        // Log all candidates for debugging
        const top5 = trulyUnique.slice(0, 5).map(c => c.value + ' (' + c.source + ', pri:' + c.priority + ')').join(', ');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '📊 Top candidates: ' + top5,
          logType: 'info'
        }));
        

        
        loyaltyData.crownAndAnchorPoints = bestCandidate.str;
        cruisePointsFound = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '✓ Found cruise points: ' + bestCandidate.str + ' (source: ' + bestCandidate.source + ')',
          logType: 'success'
        }));
      }
      
      if (!cruisePointsFound) {
        loyaltyData.crownAndAnchorPoints = '0';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '⚠ Could not find cruise points - defaulting to 0',
          logType: 'warning'
        }));
      }

      const pointsToNextMatch = pageText.match(/(\\d+)\\s*Points to (Pinnacle Club|Diamond|Platinum|Emerald)/);
      if (pointsToNextMatch) {
        loyaltyData.pointsToNextTier = pointsToNextMatch[1] + ' to ' + pointsToNextMatch[2];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found points to next: ' + loyaltyData.pointsToNextTier,
          logType: 'info'
        }));
      }

      const cruiseNightsMatch = pageText.match(/(\\d+)\\s*Cruise Nights?/);
      if (cruiseNightsMatch) {
        loyaltyData.cruiseNights = cruiseNightsMatch[1];
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found cruise nights: ' + cruiseNightsMatch[1],
          logType: 'info'
        }));
      }

      const tierCreditsPatterns = [
        /YOUR\\s+CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
        /TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi,
        /([\\d,]+)\\s*TIER\\s+CREDITS/gi,
        /CURRENT\\s+TIER\\s+CREDITS[^\\d]{0,50}?([\\d,]+)/gi
      ];
      
      for (const pattern of tierCreditsPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1] && !loyaltyData.clubRoyalePoints) {
          const num = parseInt(match[1].replace(/,/g, ''), 10);
          if (num >= 100 && num <= 10000000) {
            loyaltyData.clubRoyalePoints = match[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found Club Royale Tier Credits: ' + match[1],
              logType: 'success'
            }));
            break;
          }
        }
      }
      
      const targetElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span[class*="tier"], span[class*="point"], div[class*="tier"], div[class*="point"]');
      let foundClubRoyale = false;
      
      targetElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        
        if (text.match(/Club Royale/i) && !foundClubRoyale) {
          foundClubRoyale = true;
        }
        
        if (text.match(/^(Signature|Premier|Classic)$/i) && !loyaltyData.clubRoyaleTier) {
          loyaltyData.clubRoyaleTier = text;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found Club Royale tier: ' + text,
            logType: 'success'
          }));
        }
        
        const pointsMatch = text.match(/^([\\d,]+)\\s*(?:Club Royale)?\\s*(?:Points?)?$/i);
        if (pointsMatch && !loyaltyData.clubRoyalePoints) {
          const num = parseInt(pointsMatch[1].replace(/,/g, ''));
          if (num >= 1000 && num <= 10000000) {
            loyaltyData.clubRoyalePoints = pointsMatch[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: 'Found Club Royale points: ' + pointsMatch[1],
              logType: 'success'
            }));
          }
        }
      });
      
      if (!loyaltyData.clubRoyaleTier) {
        const tierPattern = /(Signature|Premier|Classic)\\s+Club Royale|Club Royale\\s+(Signature|Premier|Classic)/i;
        const tierMatch = pageText.match(tierPattern);
        if (tierMatch) {
          loyaltyData.clubRoyaleTier = tierMatch[1] || tierMatch[2];
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found Club Royale tier (pattern): ' + loyaltyData.clubRoyaleTier,
            logType: 'success'
          }));
        }
      }
      
      if (!loyaltyData.clubRoyalePoints) {
        const pointsPattern = /Club Royale[^\\d]*([\\d,]{4,})\\s*(?:Points?|pts)/i;
        const pointsMatch2 = pageText.match(pointsPattern);
        if (pointsMatch2) {
          loyaltyData.clubRoyalePoints = pointsMatch2[1];
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found Club Royale points (pattern): ' + pointsMatch2[1],
            logType: 'success'
          }));
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'loyalty_data',
        data: loyaltyData
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Loyalty extraction complete: ' + loyaltyData.crownAndAnchorLevel + ', ' + loyaltyData.crownAndAnchorPoints + ' pts, ' + loyaltyData.cruiseNights + ' nights',
        logType: 'success'
      }));

      // Send step_complete for step 4
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: [loyaltyData],
        totalCount: 1
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract loyalty status: ' + error.message
      }));
      
      // Still send step_complete even on error
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: [],
        totalCount: 0
      }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractLoyaltyStatus);
  } else {
    extractLoyaltyStatus();
  }
})();
`;

export function injectLoyaltyExtraction() {
  return STEP4_LOYALTY_SCRIPT;
}
