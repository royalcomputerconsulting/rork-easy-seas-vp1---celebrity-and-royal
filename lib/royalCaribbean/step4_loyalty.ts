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
        message: '🔍 Searching for Crown & Anchor cruise points...',
        logType: 'info'
      }));
      
      let cruisePointsFound = false;
      const allCandidates = [];
      
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
            if (num >= 0 && num <= 2000) {
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
        // Scan parent containers aggressively
        let container = yourTierElement.parentElement;
        for (let level = 0; level < 8 && container; level++) {
          // Get all prominent elements (headings, large text, standalone numbers)
          const prominentElements = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p, strong'));
          
          for (const el of prominentElements) {
            const elText = (el.textContent || '').trim();
            // Look for STANDALONE large numbers (like 503 displayed prominently)
            const standaloneMatch = elText.match(/^(\\d{1,4})$/);
            if (standaloneMatch) {
              const num = parseInt(standaloneMatch[1], 10);
              if (num >= 0 && num <= 2000 && num !== 2025 && num !== 2026) {
                // Check this isn't tier credits
                const parentText = (el.parentElement?.textContent || '').toLowerCase();
                if (!parentText.includes('tier credit') && !parentText.includes('100,000')) {
                  // Higher priority if it's in a heading or large element
                  const isHeading = el.tagName.match(/^H[1-6]$/i);
                  allCandidates.push({ 
                    value: num, 
                    str: standaloneMatch[1], 
                    source: 'your-tier-standalone', 
                    priority: isHeading ? 2 : 3 
                  });
                }
              }
            }
          }
          container = container.parentElement;
        }
      }
      
      // PRIORITY STRATEGY 3: Look near tier name for prominent numbers
      if (loyaltyData.crownAndAnchorLevel) {
        const tierElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, div[class*="large"], span[class*="large"]');
        for (const el of tierElements) {
          const text = (el.textContent || '').trim();
          if (text.includes(loyaltyData.crownAndAnchorLevel)) {
            // Look for sibling elements with standalone numbers
            const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
            for (const sibling of siblings) {
              const sibText = (sibling.textContent || '').trim();
              const standaloneMatch = sibText.match(/^(\\d{1,4})$/);
              if (standaloneMatch) {
                const num = parseInt(standaloneMatch[1], 10);
                if (num >= 0 && num <= 2000 && num !== 2025 && num !== 2026) {
                  allCandidates.push({ value: num, str: standaloneMatch[1], source: 'near-tier', priority: 4 });
                }
              }
            }
          }
        }
      }
      
      // FALLBACK: Pattern matching
      const fallbackPatterns = [
        /(\\d{1,4})\\s*Cruise Points?/i,
        /Cruise Points?[:\\s]+(\\d{1,4})/i
      ];
      
      for (const pattern of fallbackPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= 0 && num <= 2000) {
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
      
      // Pick best candidate
      if (uniqueCandidates.length > 0) {
        loyaltyData.crownAndAnchorPoints = uniqueCandidates[0].str;
        cruisePointsFound = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '✓ Found cruise points: ' + uniqueCandidates[0].str + ' (source: ' + uniqueCandidates[0].source + ')',
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
