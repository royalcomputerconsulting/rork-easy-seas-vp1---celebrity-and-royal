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

      await wait(3000);

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

      // IMPROVED: Look for cruise points more comprehensively
      let cruisePointsCandidates = [];
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: '🔍 Searching for Crown & Anchor cruise points...',
        logType: 'info'
      }));
      
      // STRATEGY 1: Look in all relevant elements
      const topElements = Array.from(document.querySelectorAll('header, [class*="header"], [class*="point"], [class*="cruise"], [class*="anchor"], [class*="loyalty"], h1, h2, h3, h4, p, span, div'));
      
      for (const el of topElements.slice(0, 100)) {
        const text = (el.textContent || '').trim();
        const lowerText = text.toLowerCase();
        
        // Look for numbers in elements that mention Crown & Anchor or cruise points
        if (lowerText.includes('crown') || lowerText.includes('anchor') || (lowerText.includes('cruise') && lowerText.includes('point'))) {
          const numMatches = text.match(/\\b(\\d+)\\b/g);
          if (numMatches) {
            for (const numStr of numMatches) {
              const num = parseInt(numStr, 10);
              // Crown & Anchor points typically range from 0 to 10,000 for most cruisers
              if (num >= 0 && num <= 10000) {
                const hasContext = lowerText.includes('cruise point') || lowerText.includes('crown') || lowerText.includes('anchor');
                const priority = hasContext ? 1 : 2;
                cruisePointsCandidates.push({ value: num, str: numStr, source: 'element-with-context', priority: priority });
              }
            }
          }
        }
      }
      
      // STRATEGY 2: Pattern matching for "X Cruise Points"
      const cruisePointsPatterns = [
        /(\\d+)\\s*Cruise Points?/i,
        /Cruise Points?[:\\s]+(\\d+)/i,
        /(\\d+)\\s*cruise\\s*points?/i,
        /Crown\\s+(?:&|and)\\s+Anchor[^\\d]{0,50}?(\\d+)\\s*(?:points?|pts)/i
      ];
      
      for (const pattern of cruisePointsPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= 0 && num <= 10000) {
            cruisePointsCandidates.push({ value: num, str: match[1], source: 'pattern', priority: 1 });
          }
        }
      }
      
      // Sort by priority, then by value
      cruisePointsCandidates.sort((a, b) => {
        const priorityDiff = (a.priority || 99) - (b.priority || 99);
        if (priorityDiff !== 0) return priorityDiff;
        
        // For Crown & Anchor, reasonable values are typically 100-2000
        // Prefer values in this range
        const aReasonable = a.value >= 100 && a.value <= 2000;
        const bReasonable = b.value >= 100 && b.value <= 2000;
        if (aReasonable && !bReasonable) return -1;
        if (!aReasonable && bReasonable) return 1;
        
        return a.value - b.value;
      });
      
      // Remove duplicates
      const seenValues = new Set();
      cruisePointsCandidates = cruisePointsCandidates.filter(p => {
        if (seenValues.has(p.value)) return false;
        seenValues.add(p.value);
        return true;
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + cruisePointsCandidates.length + ' cruise point candidates: ' + cruisePointsCandidates.slice(0, 5).map(p => p.value).join(', '),
        logType: 'info'
      }));
      
      if (cruisePointsCandidates.length > 0) {
        loyaltyData.crownAndAnchorPoints = cruisePointsCandidates[0].str;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '✓ Selected cruise points: ' + cruisePointsCandidates[0].str + ' (value: ' + cruisePointsCandidates[0].value + ') from ' + cruisePointsCandidates[0].source,
          logType: 'success'
        }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '⚠ Could not find cruise points',
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

      // PRIORITY 1: Look for TIER CREDITS pattern (this is the actual label RC uses on the offers page)
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
      
      const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, section, article');
      let foundClubRoyale = false;
      
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        
        if (text.match(/Club Royale/i) && !foundClubRoyale) {
          foundClubRoyale = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: 'Found Club Royale section',
            logType: 'info'
          }));
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

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract loyalty status: ' + error.message
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
