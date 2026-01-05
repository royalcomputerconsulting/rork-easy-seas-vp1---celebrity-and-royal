export const STEP3_HOLDS_SCRIPT = `
(function() {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollUntilComplete(maxAttempts = 10) {
    let previousHeight = 0;
    let stableCount = 0;
    let attempts = 0;

    while (stableCount < 3 && attempts < maxAttempts) {
      const currentHeight = document.body.scrollHeight;
      
      if (currentHeight === previousHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      previousHeight = currentHeight;
      window.scrollBy(0, 500);
      await wait(1000);
      attempts++;
    }
  }

  function extractText(element, selector) {
    if (!element) return '';
    const el = selector ? element.querySelector(selector) : element;
    return el?.textContent?.trim() || '';
  }

  async function extractCourtesyHolds() {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Starting Courtesy Holds extraction...',
        logType: 'info'
      }));

      await wait(3000);
      await scrollUntilComplete(15);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Scrolling complete, extracting holds...',
        logType: 'info'
      }));

      const holdCards = document.querySelectorAll('[data-testid*="hold"], [class*="hold-card"], [class*="courtesy"]');
      const holds = [];
      let processedCount = 0;

      for (let i = 0; i < holdCards.length; i++) {
        const card = holdCards[i];

        const shipName = extractText(card, '[data-testid*="ship"], [class*="ship"]');
        const sailingStartDate = extractText(card, '[data-testid*="start"], [data-testid*="departure"]');
        const sailingEndDate = extractText(card, '[data-testid*="end"], [data-testid*="return"]');
        const itinerary = extractText(card, '[data-testid*="itinerary"], [class*="itinerary"]');
        const departurePort = extractText(card, '[data-testid*="port"], [class*="port"]');
        const cabinType = extractText(card, '[data-testid*="cabin"], [data-testid*="stateroom"]');
        const holdExpiration = extractText(card, '[data-testid*="expir"], [class*="expir"]');
        const bookingId = extractText(card, '[data-testid*="hold-id"], [data-testid*="reference"]');

        holds.push({
          sourcePage: 'Courtesy',
          shipName: shipName,
          sailingStartDate: sailingStartDate,
          sailingEndDate: sailingEndDate,
          sailingDates: sailingStartDate && sailingEndDate ? \`\${sailingStartDate} - \${sailingEndDate}\` : '',
          itinerary: itinerary,
          departurePort: departurePort,
          cabinType: cabinType,
          cabinNumberOrGTY: 'Hold',
          bookingId: bookingId,
          status: 'Courtesy Hold',
          loyaltyLevel: '',
          loyaltyPoints: ''
        });

        processedCount++;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: processedCount,
          total: holdCards.length,
          stepName: 'Courtesy Holds'
        }));
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 3,
        data: holds
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: \`Extracted \${holds.length} courtesy holds\`,
        logType: 'success'
      }));

    } catch (error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: 'Failed to extract courtesy holds: ' + error.message
      }));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractCourtesyHolds);
  } else {
    extractCourtesyHolds();
  }
})();
`;

export function injectCourtesyHoldsExtraction() {
  return STEP3_HOLDS_SCRIPT;
}
