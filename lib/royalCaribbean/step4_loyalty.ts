export const STEP4_LOYALTY_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function extractLoyaltyStatus() {
    try {
      console.log('[STEP4] Starting loyalty extraction');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting Crown & Anchor loyalty status...',
        logType: 'info'
      }));

      await wait(3000);

      const loyaltyData = {
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: ''
      };

      const selectors = [
        '[data-testid*="crown"], [class*="crown"], [class*="loyalty"]',
        '[data-testid*="anchor"], [class*="anchor"]',
        'h1, h2, h3, h4, h5, h6, p, span, div, [class*="tier"], [class*="level"]'
      ];

      console.log('[STEP4] Searching for loyalty data');
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log('[STEP4] Found', elements.length, 'elements with selector:', selector);
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          if (text.match(/Diamond|Platinum|Gold|Silver|Emerald/i) && text.match(/Plus/i)) {
            if (!loyaltyData.crownAndAnchorLevel) {
              loyaltyData.crownAndAnchorLevel = text;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found Crown & Anchor level: ' + text,
                logType: 'info'
              }));
            }
          } else if (text.match(/Diamond|Platinum|Gold|Silver|Emerald/i) && !text.match(/Signature|Premier|Classic/i)) {
            if (!loyaltyData.crownAndAnchorLevel) {
              loyaltyData.crownAndAnchorLevel = text;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found Crown & Anchor level: ' + text,
                logType: 'info'
              }));
            }
          }
          
          if (text.match(/\\d+\\s*(nights?|loyalty points?|cruise points?)/i)) {
            if (!loyaltyData.crownAndAnchorPoints) {
              const pointsMatch = text.match(/\\d+/);
              if (pointsMatch) {
                loyaltyData.crownAndAnchorPoints = pointsMatch[0];
                console.log('[STEP4] Found points:', loyaltyData.crownAndAnchorPoints);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  message: 'Found nights/loyalty points: ' + loyaltyData.crownAndAnchorPoints,
                  logType: 'info'
                }));
              }
            }
          }
        });
      }

      console.log('[STEP4] Final data:', loyaltyData);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'loyalty_data',
        data: loyaltyData
      }));

      console.log('[STEP4] Sending step_complete');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: [loyaltyData]
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Crown & Anchor data extracted: \${loyaltyData.crownAndAnchorLevel || 'N/A'}, \${loyaltyData.crownAndAnchorPoints || 'N/A'} nights\`,
        logType: 'success'
      }));

    } catch (error) {
      console.error('[STEP4] Error:', error);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract loyalty status: ' + error.message
      }));
    }
  }

  console.log('[STEP4] Script loaded, readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[STEP4] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', extractLoyaltyStatus);
  } else {
    console.log('[STEP4] Running immediately');
    extractLoyaltyStatus();
  }
})();
`;

export function injectLoyaltyExtraction() {
  return STEP4_LOYALTY_SCRIPT;
}
