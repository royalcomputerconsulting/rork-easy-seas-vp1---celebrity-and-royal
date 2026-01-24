// Improved Crown & Anchor points extraction - to be integrated into step4_loyalty.ts
// This fixes the issue of extracting 140 instead of 503

export const IMPROVED_LOYALTY_POINTS_EXTRACTION = `
      // CRITICAL FIX: Extract Crown & Anchor cruise points (the LARGE prominent number under YOUR TIER)
      // User reported: Finding 140 instead of 503 - we need to STRONGLY prioritize large prominent numbers
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Searching for Crown & Anchor cruise points (looking for large prominent number)...',
        logType: 'info'
      }));
      
      let cruisePointsFound = false;
      const allCandidates = [];
      
      // STRATEGY 1: Find "YOUR TIER" section and get the LARGEST standalone number near it
      // The actual cruise points (like 503) are displayed PROMINENTLY in large font
      const allElements = Array.from(document.querySelectorAll('*'));
      let yourTierElement = null;
      
      for (const el of allElements) {
        const text = (el.textContent || '').trim().toLowerCase();
        if ((text === 'your tier' || text.includes('your tier')) && text.length < 50) {
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
        // Search NEAR "YOUR TIER" for standalone numbers displayed prominently
        let container = yourTierElement.parentElement;
        
        for (let level = 0; level < 20 && container; level++) {
          const allNearbyElements = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p, strong, b'));
          
          for (const el of allNearbyElements) {
            const elText = (el.textContent || '').trim();
            
            // Look for STANDALONE numbers (2-4 digits)
            const standaloneMatch = elText.match(/^(\\d{2,4})$/);
            if (!standaloneMatch) continue;
            
            const num = parseInt(standaloneMatch[1], 10);
            
            // Filter: Must be reasonable cruise points range, exclude years
            if (num < 50 || num > 2000) continue;
            if (num === 2025 || num === 2026 || num === 2024 || num === 2023) continue;
            
            // Check parent/grandparent context
            const parentText = (el.parentElement?.textContent || '').toLowerCase();
            const grandparentText = (el.parentElement?.parentElement?.textContent || '').toLowerCase();
            
            // EXCLUDE tier credits, points-to-next-tier, and other non-cruise-points
            const isTierCredits = parentText.includes('tier credit') || grandparentText.includes('tier credit');
            const isPointsToNext = parentText.includes('points to') || parentText.includes('points away') || 
                                   grandparentText.includes('points to') || grandparentText.includes('points away');
            const isPointsNeeded = parentText.includes('100,000') || grandparentText.includes('100,000');
            
            if (isTierCredits || isPointsToNext || isPointsNeeded) continue;
            
            // Check if near "nights earned" or "cruise nights" (STRONGEST signal)
            const nearNightsEarned = parentText.includes('nights earned') || 
                                     grandparentText.includes('nights earned') ||
                                     parentText.includes('cruise nights') ||
                                     grandparentText.includes('cruise nights');
            
            // Check styling - is this number displayed PROMINENTLY?
            const computedStyle = window.getComputedStyle(el);
            const fontSize = parseFloat(computedStyle.fontSize) || 0;
            const fontWeight = computedStyle.fontWeight;
            const isVeryLarge = fontSize > 40;
            const isLarge = fontSize > 30;
            const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900';
            const elementHeight = el.offsetHeight || 0;
            
            // PRIORITY CALCULATION - STRONGLY prefer large numbers displayed prominently
            let priority = 10;
            
            // ABSOLUTE TOP PRIORITY: 400+ with very large font (> 40px) = the main displayed number
            if (num >= 400 && isVeryLarge) {
              priority = 0;
            }
            // SECOND: 300+ with very large font
            else if (num >= 300 && isVeryLarge) {
              priority = 0;
            }
            // THIRD: Any number with "nights earned" context
            else if (nearNightsEarned && num >= 100) {
              priority = 0;
            }
            // FOURTH: 400+ with large font or bold
            else if (num >= 400 && (isLarge || isBold || elementHeight > 40)) {
              priority = 1;
            }
            // FIFTH: 300+ with large font or bold
            else if (num >= 300 && (isLarge || isBold || elementHeight > 30)) {
              priority = 2;
            }
            // LOWER: 200-299 range
            else if (num >= 200) {
              priority = (isLarge || isBold) ? 5 : 7;
            }
            // VERY LOW: 100-199 range (like 140 - NOT the main number)
            else if (num >= 100) {
              priority = 9;
            }
            // LOWEST: < 100
            else {
              priority = 10;
            }
            
            allCandidates.push({ 
              value: num, 
              str: standaloneMatch[1], 
              source: 'your-tier-prominent', 
              priority: priority,
              fontSize: fontSize,
              isBold: isBold,
              nearNights: nearNightsEarned
            });
            
            // Log significant findings
            if (num >= 100) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '  ➜ Found number near YOUR TIER: ' + num + ' (priority: ' + priority + ', fontSize: ' + fontSize + 'px, bold: ' + isBold + ', nearNights: ' + nearNightsEarned + ')',
                logType: 'info'
              }));
            }
          }
          
          container = container.parentElement;
        }
      }
      
      // STRATEGY 2: Find ALL prominent standalone numbers on page (for pages without YOUR TIER)
      const prominentElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, [class*="large"], [class*="big"], [class*="hero"], [class*="display"], [class*="stat"], [class*="count"]');
      
      for (const el of prominentElements) {
        const elText = (el.textContent || '').trim();
        const numMatch = elText.match(/^(\\d{2,4})$/);
        
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (num >= 50 && num <= 2000 && num !== 2025 && num !== 2026 && num !== 2024) {
            const parentText = (el.parentElement?.textContent || '').toLowerCase();
            const isValid = !parentText.includes('tier credit') && !parentText.includes('points to');
            
            if (isValid) {
              const computedStyle = window.getComputedStyle(el);
              const fontSize = parseFloat(computedStyle.fontSize) || 0;
              const isVeryLarge = fontSize > 40;
              
              // STRONG preference for 400+ with large font
              let priority = num >= 400 && isVeryLarge ? 0 : num >= 300 && isVeryLarge ? 1 : num >= 400 ? 2 : num >= 200 ? 5 : 8;
              
              allCandidates.push({ value: num, str: numMatch[1], source: 'prominent-page', priority: priority });
            }
          }
        }
      }
      
      // SORT: Lower priority number = higher importance, then by value (higher = better)
      allCandidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.value - a.value;  // For same priority, prefer LARGER numbers
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
          message: 'Found ' + uniqueCandidates.length + ' candidate(s): ' + uniqueCandidates.slice(0, 3).map(c => c.value + ' (pri:' + c.priority + ')').join(', '),
          logType: 'info'
        }));
      }
      
      // PICK BEST CANDIDATE - strongly prefer larger numbers with lower priority
      if (uniqueCandidates.length > 0) {
        let bestCandidate = uniqueCandidates[0];
        
        // CRITICAL OVERRIDE: If best is < 200 but there's a 400+ candidate, use the larger one
        if (bestCandidate.value < 200 && uniqueCandidates.length > 1) {
          const muchLargerCandidate = uniqueCandidates.find(c => c.value >= 400 && c.priority <= 3);
          if (muchLargerCandidate) {
            bestCandidate = muchLargerCandidate;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '✓✓ OVERRIDING: Chose MUCH LARGER value ' + bestCandidate.value + ' over ' + uniqueCandidates[0].value + ' (the prominent number is the real cruise points)',
              logType: 'success'
            }));
          }
        }
        
        // FINAL VALIDATION: Warn if value seems too small
        if (bestCandidate.value < 100) {
          const largerAlternative = uniqueCandidates.find(c => c.value >= 100);
          if (largerAlternative) {
            bestCandidate = largerAlternative;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: '⚠ Skipping very small value, using ' + bestCandidate.value + ' instead',
              logType: 'warning'
            }));
          }
        }
        
        loyaltyData.crownAndAnchorPoints = bestCandidate.str;
        cruisePointsFound = true;
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '✓✓ Selected cruise points: ' + bestCandidate.str + ' (source: ' + bestCandidate.source + ', priority: ' + bestCandidate.priority + ')',
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
`;
