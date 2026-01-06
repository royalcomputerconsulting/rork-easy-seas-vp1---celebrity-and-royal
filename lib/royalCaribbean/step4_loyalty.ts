export const STEP4_LOYALTY_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function extractLoyaltyStatus() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting Crown & Anchor loyalty status...',
        logType: 'info'
      }));

      await wait(2000);

      const loyaltyData = {
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: ''
      };

      const selectors = [
        '[data-testid*="crown"], [class*="crown"], [class*="loyalty"]',
        '[data-testid*="anchor"], [class*="anchor"]',
        'h1, h2, h3, h4, h5, h6, p, span, div, [class*="tier"], [class*="level"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
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
          
          if (text.match(/\\d+\\s*(nights?|loyalty points?)/i)) {
            if (!loyaltyData.crownAndAnchorPoints) {
              loyaltyData.crownAndAnchorPoints = text.match(/\\d+/)?.[0] || '';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: 'Found nights/loyalty points: ' + loyaltyData.crownAndAnchorPoints,
                logType: 'info'
              }));
            }
          }
        });
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'loyalty_data',
        data: loyaltyData
      }));

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
