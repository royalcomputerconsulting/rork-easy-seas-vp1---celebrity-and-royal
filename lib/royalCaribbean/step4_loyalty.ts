export const STEP4_LOYALTY_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function extractLoyaltyStatus() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Extracting loyalty status...',
        logType: 'info'
      }));

      await wait(2000);

      const loyaltyData = {
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: '',
        clubRoyaleTier: '',
        clubRoyalePoints: ''
      };

      const selectors = [
        '[data-testid*="crown"], [class*="crown"], [class*="loyalty"]',
        '[data-testid*="club-royale"], [class*="club-royale"]',
        'h1, h2, h3, h4, h5, h6, p, span, div'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          
          if (text.match(/Diamond|Platinum|Gold|Silver|Emerald/i)) {
            if (!loyaltyData.crownAndAnchorLevel) {
              loyaltyData.crownAndAnchorLevel = text;
            }
          }
          
          if (text.match(/\\d+\\s*(nights?|points?)/i)) {
            if (!loyaltyData.crownAndAnchorPoints && text.match(/nights?/i)) {
              loyaltyData.crownAndAnchorPoints = text;
            }
          }
          
          if (text.match(/Signature|Premier|Classic/i)) {
            if (!loyaltyData.clubRoyaleTier) {
              loyaltyData.clubRoyaleTier = text;
            }
          }
          
          if (text.match(/\\d{3,}\\s*points?/i)) {
            if (!loyaltyData.clubRoyalePoints) {
              loyaltyData.clubRoyalePoints = text;
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
        message: \`Loyalty data extracted: \${loyaltyData.crownAndAnchorLevel || 'N/A'}\`,
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
