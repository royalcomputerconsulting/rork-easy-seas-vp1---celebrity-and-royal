export const AUTH_DETECTION_SCRIPT = `
(function() {
  let lastAuthState = null;
  let checkCount = 0;
  let observer = null;
  let intervalId = null;
  let timeoutId = null;
  
  window.__stopAuthDetection = function() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  function checkAuthStatus() {
    checkCount++;
    const pageText = document.body.innerText || '';
    const pageHTML = document.body.innerHTML || '';
    const url = window.location.href;
    
    const cookies = document.cookie;
    const hasCookies = cookies.includes('RCAUTH') || 
                       cookies.includes('auth') || 
                       cookies.includes('session') ||
                       cookies.length > 100;
    
    const indicators = {
      accountLinks: document.querySelectorAll('a[href*="/account"]'),
      logoutLinks: document.querySelectorAll('a[href*="logout"], button[onclick*="logout"], a[href*="sign-out"]'),
      signInButtons: document.querySelectorAll('button:not([type="submit"]):not([type="button"])')?.length,
      upcomingCruisesLink: document.querySelector('a[href*="upcoming-cruises"]'),
      courtesyHoldsLink: document.querySelector('a[href*="courtesy-holds"]'),
      loyaltyStatusLink: document.querySelector('a[href*="loyalty-status"]'),
      myAccountLink: document.querySelector('a[href*="/account"]'),
      offersLink: document.querySelector('a[href*="club-royale/offers"]'),
      myProfileText: pageText.toLowerCase().includes('my profile'),
      welcomeText: pageText.toLowerCase().includes('welcome'),
      memberText: pageHTML.toLowerCase().includes('member'),
      pointsText: pageHTML.toLowerCase().includes('points'),
      crownAnchorText: pageHTML.toLowerCase().includes('crown') || pageHTML.toLowerCase().includes('anchor'),
      clubRoyaleText: pageHTML.toLowerCase().includes('club royale'),
      tierText: pageHTML.toLowerCase().includes('tier') || pageHTML.toLowerCase().includes('level'),
      hasLogoutButton: document.querySelectorAll('a[href*="logout"], a[href*="sign-out"]').length > 0,
      isOnClubRoyalePage: url.includes('club-royale'),
      hasOfferCards: document.querySelectorAll('[class*="offer"], [class*="Offer"]').length > 0
    };

    const strongAuthSignals = 
      indicators.upcomingCruisesLink || 
      indicators.courtesyHoldsLink || 
      indicators.loyaltyStatusLink ||
      indicators.hasLogoutButton ||
      (indicators.isOnClubRoyalePage && indicators.hasOfferCards && hasCookies);
    
    const accountFeatureCount = 
      (indicators.accountLinks.length > 0 ? 1 : 0) +
      (indicators.upcomingCruisesLink ? 1 : 0) +
      (indicators.courtesyHoldsLink ? 1 : 0) +
      (indicators.loyaltyStatusLink ? 1 : 0) +
      (indicators.myAccountLink ? 1 : 0) +
      (indicators.hasLogoutButton ? 1 : 0) +
      (indicators.offersLink ? 1 : 0);
    
    const contentSignals = 
      (indicators.memberText ? 1 : 0) +
      (indicators.pointsText ? 1 : 0) +
      (indicators.crownAnchorText ? 1 : 0) +
      (indicators.tierText ? 1 : 0);
    
    const isOnAccountPage = url.includes('/account/') || url.includes('loyalty-status') || url.includes('loyalty-programs');
    
    let isLoggedIn = false;
    
    if (strongAuthSignals) {
      isLoggedIn = true;
    } else if (accountFeatureCount >= 2) {
      isLoggedIn = true;
    } else if (hasCookies && (accountFeatureCount >= 1 || contentSignals >= 2)) {
      isLoggedIn = true;
    } else if (isOnAccountPage && !pageText.toLowerCase().includes('sign in to access')) {
      isLoggedIn = true;
    }
    
    if (lastAuthState !== isLoggedIn) {
      lastAuthState = isLoggedIn;
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'auth_status',
        loggedIn: isLoggedIn
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: isLoggedIn 
          ? 'User logged in' 
          : 'Not logged in',
        logType: 'info'
      }));
    }
  }

  function initAuthDetection() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkAuthStatus, 1500);
      });
    } else {
      setTimeout(checkAuthStatus, 1500);
    }

    observer = new MutationObserver(() => {
      checkAuthStatus();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    intervalId = setInterval(checkAuthStatus, 5000);

    timeoutId = setTimeout(() => {
      if (observer) observer.disconnect();
      if (intervalId) clearInterval(intervalId);
    }, 15000);
  }
  
  initAuthDetection();
})();
`;

export function injectAuthDetection() {
  return AUTH_DETECTION_SCRIPT;
}
