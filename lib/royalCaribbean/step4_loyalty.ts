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
        message: '🔍 Searching for cruise points under YOUR TIER...',
        logType: 'info'
      }));
      
      let cruisePointsFound = false;
      
      // Strategy 1: Find "YOUR TIER" section and look for the prominent number below it
      const allElements = document.querySelectorAll('*');
      let yourTierElement = null;
      
      for (const el of allElements) {
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim())
          .join('');
        if (directText.toLowerCase().includes('your tier')) {
          yourTierElement = el;
          break;
        }
      }
      
      if (yourTierElement) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: '✓ Found YOUR TIER section, scanning for points...',
          logType: 'info'
        }));
        
        // Look at parent container and find numbers
        let container = yourTierElement.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          const containerText = container.textContent || '';
          // Look for a standalone 3-digit number that could be cruise points
          const nums = containerText.match(/\\b(\\d{1,4})\\b/g);
          if (nums) {
            for (const numStr of nums) {
              const num = parseInt(numStr, 10);
              // Cruise points typically 0-2000 range, exclude years like 2025, 2026
              if (num >= 1 && num <= 2000 && num !== 2025 && num !== 2026) {
                // Check if this number is NOT part of tier credits context
                const lowerText = containerText.toLowerCase();
                const numIndex = containerText.indexOf(numStr);
                const surroundingText = containerText.substring(Math.max(0, numIndex - 50), Math.min(containerText.length, numIndex + 50)).toLowerCase();
                
                // Skip if it looks like tier credits
                if (surroundingText.includes('tier credits') || surroundingText.includes('100,000')) {
                  continue;
                }
                
                loyaltyData.crownAndAnchorPoints = numStr;
                cruisePointsFound = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: '✓ Found cruise points in YOUR TIER section: ' + numStr,
                  logType: 'success'
                }));
                break;
              }
            }
          }
          if (cruisePointsFound) break;
          container = container.parentElement;
        }
      }
      
      // Strategy 2: Look for prominent numbers near tier name (Diamond Plus, etc)
      if (!cruisePointsFound && loyaltyData.crownAndAnchorLevel) {
        const tierElements = document.querySelectorAll('h1, h2, h3, h4, h5, span, div, p');
        for (const el of tierElements) {
          const text = (el.textContent || '').trim();
          if (text.includes(loyaltyData.crownAndAnchorLevel)) {
            let parent = el.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              const parentText = parent.textContent || '';
              const nums = parentText.match(/\\b(\\d{1,4})\\b/g);
              if (nums) {
                for (const numStr of nums) {
                  const num = parseInt(numStr, 10);
                  if (num >= 1 && num <= 2000 && num !== 2025 && num !== 2026) {
                    loyaltyData.crownAndAnchorPoints = numStr;
                    cruisePointsFound = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'log',
                      message: '✓ Found cruise points near tier: ' + numStr,
                      logType: 'success'
                    }));
                    break;
                  }
                }
              }
              if (cruisePointsFound) break;
              parent = parent.parentElement;
            }
            if (cruisePointsFound) break;
          }
        }
      }
      
      // Strategy 3: Pattern matching fallback
      if (!cruisePointsFound) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Trying pattern matching fallback...',
          logType: 'info'
        }));
        
        const cruisePointsPatterns = [
          /(\\d{1,4})\\s*Cruise Points?/i,
          /Cruise Points?[:\\s]+(\\d{1,4})/i,
          /(\\d{1,4})\\s*(?:points?)?\\s*earned/i
        ];
        
        for (const pattern of cruisePointsPatterns) {
          const match = pageText.match(pattern);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num >= 1 && num <= 2000) {
              loyaltyData.crownAndAnchorPoints = match[1];
              cruisePointsFound = true;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: '✓ Found cruise points via pattern: ' + match[1],
                logType: 'success'
              }));
              break;
            }
          }
        }
      }
      
      if (!cruisePointsFound) {
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
