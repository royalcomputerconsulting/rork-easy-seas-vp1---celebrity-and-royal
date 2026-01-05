export const AUTH_DETECTION_SCRIPT = `
(function() {
  function checkAuthStatus() {
    const indicators = {
      accountMenu: document.querySelector('[data-testid="account-menu"], .account-menu, [aria-label*="Account"]'),
      userName: document.querySelector('[data-testid="user-name"], .user-name'),
      logoutButton: document.querySelector('[href*="logout"], [data-testid="logout"]'),
      myAccountLink: document.querySelector('[href*="/account"], a[href*="my-account"]'),
      loginForm: document.querySelector('form[action*="login"], [data-testid="login-form"]'),
      loginButton: document.querySelector('button[type="submit"][data-testid*="login"]')
    };

    const isLoggedIn = !!(
      (indicators.accountMenu || indicators.userName || indicators.logoutButton || indicators.myAccountLink) &&
      !indicators.loginForm &&
      !indicators.loginButton
    );

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'auth_status',
      loggedIn: isLoggedIn
    }));

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      message: isLoggedIn ? 'Authentication detected' : 'Not authenticated',
      logType: 'info'
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuthStatus);
  } else {
    checkAuthStatus();
  }

  const observer = new MutationObserver(() => {
    checkAuthStatus();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setTimeout(() => {
    observer.disconnect();
  }, 10000);
})();
`;

export function injectAuthDetection() {
  return AUTH_DETECTION_SCRIPT;
}
