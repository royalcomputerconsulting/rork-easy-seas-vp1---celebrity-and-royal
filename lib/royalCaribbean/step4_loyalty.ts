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
      
      // Pattern 1: Standard "X Cruise Points" format
      const cruisePointsPatterns = [
        /(\\d+)\\s*Cruise Points?/i,
        /Cruise Points?[:\\s]+(\\d+)/i,
        /(\\d+)\\s*(?:cruise)?\\s*point/i,
        /Crown\\s+(?:&|and)\\s+Anchor[^\\d]{0,50}?(\\d+)\\s*(?:points?|pts)/i
      ];
      
      for (const pattern of cruisePointsPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= 0 && num <= 100000) {
            cruisePointsCandidates.push({ value: num, str: match[1], source: 'pattern' });
          }
        }
      }
      
      // Pattern 2: Look in specific DOM elements with point-related classes
      const pointElements = document.querySelectorAll('[class*="point"], [class*="cruise"], [class*="anchor"], [class*="loyalty"]');
      for (const el of pointElements) {
        const text = (el.textContent || '').trim();
        // Look for numbers near "cruise" or "point" keywords
        if (text.toLowerCase().includes('cruise') || text.toLowerCase().includes('point')) {
          const numMatch = text.match(/\\b(\\d+)\\b/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            if (num >= 0 && num <= 100000 && num !== parseInt(loyaltyData.clubRoyalePoints || '0', 10)) {
              cruisePointsCandidates.push({ value: num, str: numMatch[1], source: 'element' });
            }
          }
        }
      }
      
      // Pick the best candidate (prefer pattern matches, then smaller reasonable values)
      cruisePointsCandidates.sort((a, b) => {
        if (a.source === 'pattern' && b.source !== 'pattern') return -1;
        if (a.source !== 'pattern' && b.source === 'pattern') return 1;
        // Prefer values in reasonable range (100-10000 for cruise points)
        const aReasonable = a.value >= 100 && a.value <= 10000;
        const bReasonable = b.value >= 100 && b.value <= 10000;
        if (aReasonable && !bReasonable) return -1;
        if (!aReasonable && bReasonable) return 1;
        return a.value - b.value;
      });
      
      if (cruisePointsCandidates.length > 0) {
        loyaltyData.crownAndAnchorPoints = cruisePointsCandidates[0].str;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Found cruise points: ' + cruisePointsCandidates[0].str + ' (from ' + cruisePointsCandidates[0].source + ')',
          logType: 'info'
        }));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Could not find cruise points',
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
