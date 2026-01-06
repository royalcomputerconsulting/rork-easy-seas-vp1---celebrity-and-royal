export const AUTH_DETECTION_SCRIPT = `
(function() {
  function checkAuthStatus() {
    const pageText = document.body.innerText || '';
    const pageHTML = document.body.innerHTML || '';
    
    const indicators = {
      accountLinks: document.querySelectorAll('a[href*="/account"]'),
      logoutLinks: document.querySelectorAll('a[href*="logout"], button[onclick*="logout"]'),
      signInText: pageText.toLowerCase().includes('sign in'),
      loginText: pageText.toLowerCase().includes('log in'),
      upcomingCruisesLink: document.querySelector('a[href*="upcoming-cruises"]'),
      courtesyHoldsLink: document.querySelector('a[href*="courtesy-holds"]'),
      loyaltyStatusLink: document.querySelector('a[href*="loyalty-status"]'),
      myProfileText: pageText.toLowerCase().includes('my profile'),
      welcomeText: pageText.toLowerCase().includes('welcome back')
    };

    const hasAccountFeatures = indicators.accountLinks.length > 2 || 
                              indicators.upcomingCruisesLink || 
                              indicators.courtesyHoldsLink || 
                              indicators.loyaltyStatusLink ||
                              indicators.myProfileText ||
                              indicators.welcomeText;
    
    const hasLoginPrompts = indicators.signInText || indicators.loginText;
    
    const isLoggedIn = hasAccountFeatures && !hasLoginPrompts;

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'auth_status',
      loggedIn: isLoggedIn
    }));

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      message: isLoggedIn 
        ? 'Authentication detected - account features visible' 
        : 'Not authenticated - login prompts detected',
      logType: 'info'
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAuthStatus, 1000);
    });
  } else {
    setTimeout(checkAuthStatus, 1000);
  }

  const observer = new MutationObserver(() => {
    checkAuthStatus();
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setTimeout(() => {
    observer.disconnect();
  }, 15000);
})();
`;

export function injectAuthDetection() {
  return AUTH_DETECTION_SCRIPT;
}
