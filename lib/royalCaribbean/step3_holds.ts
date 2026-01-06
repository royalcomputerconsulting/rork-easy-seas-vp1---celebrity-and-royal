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

      const countText = document.body.textContent || '';
      const countMatch = countText.match(/You have (\d+) courtesy hold/i);
      const expectedCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Page says there are ' + expectedCount + ' courtesy holds',
        logType: 'info'
      }));

      const allElements = document.querySelectorAll('div, article, section');
      let holdCards = Array.from(allElements).filter(el => {
        const text = el.textContent || '';
        const hasShip = text.includes('of the Seas');
        const hasNight = text.match(/\d+\s+Night/);
        const hasReservation = text.includes('Reservation:');
        const hasExpires = text.includes('Expires');
        const isReasonablySmall = text.length < 2000;
        return (hasShip || hasNight) && (hasReservation || hasExpires) && isReasonablySmall;
      }).sort((a, b) => a.textContent.length - b.textContent.length).filter((el, idx, arr) => {
        return !arr.some((other, otherIdx) => otherIdx < idx && other.contains(el));
      });
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: 'Found ' + holdCards.length + ' courtesy hold cards',
        logType: 'info'
      }));
      
      const holds = [];
      let processedCount = 0;

      for (let i = 0; i < holdCards.length; i++) {
        const card = holdCards[i];
        const fullText = card.textContent || '';

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Processing hold card ' + (i + 1) + ': ' + fullText.substring(0, 100) + '...',
          logType: 'info'
        }));

        const nightsMatch = fullText.match(/(\d+)\s+Night\s+([^\n]+)/);
        const itinerary = nightsMatch ? nightsMatch[0].trim() : '';

        const shipMatch = fullText.match(/([\w\s]+of the Seas)/);
        const shipName = shipMatch ? shipMatch[1].trim() : '';

        const dateMatch = fullText.match(/(\w+ \d+)\s*—\s*(\w+ \d+,\s*\d{4})/);
        let sailingStartDate = '';
        let sailingEndDate = '';
        if (dateMatch) {
          sailingStartDate = dateMatch[1];
          sailingEndDate = dateMatch[2];
        }

        const reservationMatch = fullText.match(/Reservation:\s*(\d+)/);
        const bookingId = reservationMatch ? reservationMatch[1] : '';

        const expiresMatch = fullText.match(/Expires\s*([\d\/]+)/);
        const holdExpiration = expiresMatch ? expiresMatch[1] : '';

        if (shipName || itinerary || bookingId) {
          holds.push({
            sourcePage: 'Courtesy',
            shipName: shipName,
            sailingStartDate: sailingStartDate,
            sailingEndDate: sailingEndDate,
            sailingDates: sailingStartDate && sailingEndDate ? \`\${sailingStartDate} - \${sailingEndDate}\` : '',
            itinerary: itinerary,
            departurePort: '',
            cabinType: '',
            cabinNumberOrGTY: 'Hold',
            bookingId: bookingId,
            status: 'Courtesy Hold',
            holdExpiration: holdExpiration,
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
