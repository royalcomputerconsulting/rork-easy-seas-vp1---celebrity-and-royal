export const STEP4_LOYALTY_SCRIPT = `
(function() {
  function log(message, type) {
    type = type || 'info';
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: message,
        logType: type
      }));
    } catch (e) {
      console.log('[Step4]', message);
    }
  }

  function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function getAuthHeaders() {
    try {
      var sessionData = localStorage.getItem('persist:session');
      if (!sessionData) {
        log('⚠️ No session data found in localStorage', 'warning');
        return null;
      }
      
      var parsedData = JSON.parse(sessionData);
      var authToken = parsedData.token ? JSON.parse(parsedData.token) : null;
      var user = parsedData.user ? JSON.parse(parsedData.user) : null;
      var accountId = user && user.accountId ? user.accountId : null;
      
      if (!authToken || !accountId) {
        log('⚠️ Missing auth token or account ID', 'warning');
        return null;
      }
      
      var rawAuth = authToken && authToken.toString ? authToken.toString() : '';
      var networkAuth = rawAuth ? (rawAuth.startsWith('Bearer ') ? rawAuth : 'Bearer ' + rawAuth) : '';
      
      log('✓ Auth headers obtained - account: ' + accountId.substring(0, 8) + '...', 'info');
      
      return {
        headers: {
          'accept': 'application/json',
          'accept-language': 'en-US,en;q=0.9',
          'account-id': accountId,
          'authorization': networkAuth,
          'content-type': 'application/json'
        },
        accountId: accountId
      };
    } catch (e) {
      log('⚠️ Failed to get auth headers: ' + e.message, 'warning');
      return null;
    }
  }

  // Extract loyalty data from page's embedded JSON (Next.js __NEXT_DATA__ or similar)
  function extractFromPageState() {
    try {
      // Try __NEXT_DATA__ first
      var nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        var nextData = JSON.parse(nextDataEl.textContent || '');
        if (nextData && nextData.props && nextData.props.pageProps) {
          var pageProps = nextData.props.pageProps;
          // Look for loyalty data in various locations
          if (pageProps.loyaltyInformation) {
            log('✅ Found loyalty data in __NEXT_DATA__.props.pageProps.loyaltyInformation', 'success');
            return { loyalty: pageProps.loyaltyInformation, accountId: pageProps.accountId };
          }
          if (pageProps.payload && pageProps.payload.loyaltyInformation) {
            log('✅ Found loyalty data in __NEXT_DATA__.props.pageProps.payload.loyaltyInformation', 'success');
            return { loyalty: pageProps.payload.loyaltyInformation, accountId: pageProps.payload.accountId };
          }
          if (pageProps.initialData && pageProps.initialData.loyaltyInformation) {
            log('✅ Found loyalty data in __NEXT_DATA__.props.pageProps.initialData', 'success');
            return { loyalty: pageProps.initialData.loyaltyInformation, accountId: pageProps.initialData.accountId };
          }
        }
      }
      
      // Try looking for Apollo/GraphQL state
      if (window.__APOLLO_STATE__) {
        log('📄 Found Apollo state, searching for loyalty...', 'info');
        var apolloStr = JSON.stringify(window.__APOLLO_STATE__);
        if (apolloStr.includes('loyaltyInformation') || apolloStr.includes('crownAndAnchor')) {
          log('📄 Apollo state contains loyalty keywords', 'info');
        }
      }
      
      // Try Redux/store state
      if (window.__PRELOADED_STATE__) {
        var preloaded = window.__PRELOADED_STATE__;
        if (preloaded.loyalty || preloaded.profile) {
          log('📄 Found preloaded state with loyalty/profile', 'info');
        }
      }
      
      return null;
    } catch (e) {
      log('📄 Page state extraction failed: ' + e.message, 'warning');
      return null;
    }
  }

  // Removed manual API calls - network monitor captures the page's natural API calls
  // Wait for page to load naturally and capture loyalty data from network monitor
  
  async function extractLoyaltyData() {
    try {
      log('🚀 ====== STEP 4: LOYALTY PROGRAMS ======', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');
      
      // Wait for page to load and make API calls naturally
      log('⏳ Waiting 8 seconds for page to load and make loyalty API calls...', 'info');
      await wait(8000);
      
      // Log current URL to verify we're on the right page
      log('📍 Current page URL: ' + window.location.href, 'info');
      
      // FIRST: Check if we have captured loyalty payload from network monitor
      if (window.capturedPayloads && window.capturedPayloads.loyalty) {
        log('✅ Found captured loyalty payload from network monitor!', 'success');
        var capturedData = window.capturedPayloads.loyalty;
        log('📦 Captured data keys: ' + Object.keys(capturedData).join(', '), 'info');
        
        // Extract loyalty information from captured payload
        var loyaltyInfo = null;
        var accountId = '';
        
        // Try multiple possible structures
        if (capturedData.payload && capturedData.payload.loyaltyInformation) {
          loyaltyInfo = capturedData.payload.loyaltyInformation;
          accountId = capturedData.payload.accountId || '';
          log('✅ Found loyalty data in payload.loyaltyInformation', 'success');
        } else if (capturedData.loyaltyInformation) {
          loyaltyInfo = capturedData.loyaltyInformation;
          accountId = capturedData.accountId || '';
          log('✅ Found loyalty data in loyaltyInformation', 'success');
        } else if (capturedData.crownAndAnchorId || capturedData.clubRoyaleLoyaltyTier || capturedData.crownAndAnchorSocietyLoyaltyTier) {
          // Direct structure from /guestAccounts/loyalty/info endpoint - fields at root level
          loyaltyInfo = capturedData;
          accountId = capturedData.accountId || '';
          log('✅ Found loyalty data at root level (direct API response)', 'success');
        } else if (capturedData.accountId) {
          // Has accountId but no loyalty fields yet - might be partial data
          loyaltyInfo = capturedData;
          accountId = capturedData.accountId || '';
          log('✅ Found loyalty data with accountId (checking for loyalty fields...)', 'success');
        } else {
          log('⚠️ Captured payload does not contain recognizable loyalty data', 'warning');
          log('📦 Payload keys: ' + Object.keys(capturedData).join(', '), 'info');
        }
        
        if (loyaltyInfo) {
          log('✅ Using loyalty data from captured payload', 'success');
          
          // Log loyalty data summary
          if (loyaltyInfo.crownAndAnchorSocietyLoyaltyTier) {
            log('   👑 Crown & Anchor: ' + loyaltyInfo.crownAndAnchorSocietyLoyaltyTier + ' - ' + (loyaltyInfo.crownAndAnchorSocietyLoyaltyIndividualPoints || 0).toLocaleString() + ' pts', 'info');
          }
          if (loyaltyInfo.clubRoyaleLoyaltyTier) {
            log('   🎰 Club Royale: ' + loyaltyInfo.clubRoyaleLoyaltyTier + ' - ' + (loyaltyInfo.clubRoyaleLoyaltyIndividualPoints || 0).toLocaleString() + ' pts', 'info');
          }
          if (loyaltyInfo.captainsClubLoyaltyTier) {
            log('   ⭐ Captain\'s Club: ' + loyaltyInfo.captainsClubLoyaltyTier + ' - ' + (loyaltyInfo.captainsClubLoyaltyIndividualPoints || 0).toLocaleString() + ' pts', 'info');
          }
          
          // Send to app
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'extended_loyalty_data',
            data: loyaltyInfo,
            accountId: accountId
          }));
          
          // Complete step
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step_complete',
            step: 4,
            data: []
          }));
          
          log('✅ Step 4 Complete - Loyalty data from captured payload', 'success');
          return;
        }
      } else {
        log('📝 No captured loyalty payload, trying other methods...', 'info');
      }
      
      // Try to extract from embedded page state
      var pageState = extractFromPageState();
      if (pageState && pageState.loyalty) {
        log('✅ Found loyalty data in embedded page state', 'success');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'extended_loyalty_data',
          data: pageState.loyalty,
          accountId: pageState.accountId || ''
        }));
      } else {
        log('ℹ️ No embedded loyalty data found - relying on network capture', 'info');
      }
      
      // Network monitor should have captured any loyalty API calls
      log('📡 Network monitor should have captured loyalty API calls during page load', 'info');
      
      // Complete step
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: []
      }));
      
      log('✅ Step 4 Complete', 'success');
      
    } catch (error) {
      log('❌ Step 4 error: ' + error.message, 'error');
      // Still send step_complete so sync continues
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: []
      }));
    }
  }
    log('📡 Fetching loyalty data...', 'info');
    
    // First try to extract from embedded page state (Next.js SSR data)
    var pageState = extractFromPageState();
    if (pageState && pageState.loyalty) {
      return { data: { payload: { loyaltyInformation: pageState.loyalty, accountId: pageState.accountId } }, accountId: pageState.accountId };
    }

    var authInfo = getAuthHeaders();
    var accountId = authInfo ? authInfo.accountId : null;

    try {
      var host = location && location.hostname ? location.hostname : '';
      var brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
      var baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
      
      log('🔍 Testing multiple loyalty endpoints...', 'info');
      // Try multiple API endpoints - test all possible variations
      var endpoints = [
        { url: baseUrl + '/api/loyalty', method: 'cookie' },
        { url: baseUrl + '/api/account/loyalty', method: 'cookie' },
        { url: baseUrl + '/api/account/loyalty-programs', method: 'cookie' },
        { url: baseUrl + '/api/profile/loyalty-programs', method: 'cookie' },
        { url: baseUrl + '/api/profile/loyalty', method: 'cookie' },
        { url: baseUrl + '/api/profile/loyalty', method: 'bearer' }
      ];
      
      var loyaltyResult = null;
      
      for (var i = 0; i < endpoints.length; i++) {
        var ep = endpoints[i];
        log('📡 Testing endpoint ' + (i + 1) + '/' + endpoints.length + ': ' + ep.url + ' (' + ep.method + ' auth)', 'info');
        
        try {
          var fetchOpts;
          if (ep.method === 'cookie') {
            // Cookie-based auth - must include credentials and proper headers
            fetchOpts = {
              method: 'GET',
              credentials: 'include',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'no-cache',
                'pragma': 'no-cache'
              }
            };
          } else if (authInfo) {
            // Bearer token auth
            fetchOpts = {
              method: 'GET',
              credentials: 'omit',
              headers: authInfo.headers
            };
          } else {
            log('⚠️ Skipping bearer auth - no auth headers available', 'warning');
            continue;
          }
          
          var response = await fetch(ep.url, fetchOpts);

          log('   📡 Response status: ' + response.status, 'info');

          if (response.ok) {
            var text = await response.text();
            log('📦 Response length: ' + text.length + ' chars', 'info');
            
            if (text && text.length > 10) {
              var data = JSON.parse(text);
              
              // Log raw response structure for debugging
              if (data && data.payload) {
                log('📋 Response has payload with keys: ' + Object.keys(data.payload).slice(0, 10).join(', '), 'info');
              }
              
              if (data && data.payload && data.payload.loyaltyInformation) {
                loyaltyResult = { data: data, accountId: data.payload.accountId || accountId };
                log('   ✅ SUCCESS! Endpoint works: ' + ep.url, 'success');
                break;
              } else if (data && data.loyaltyInformation) {
                // Handle direct response without payload wrapper
                loyaltyResult = { data: { payload: data }, accountId: data.accountId || accountId };
                log('   ✅ SUCCESS! Endpoint works (unwrapped): ' + ep.url, 'success');
                break;
              } else {
                log('   ❌ No loyaltyInformation in response', 'warning');
              }
            }
          } else if (response.status === 403) {
            log('   ❌ Failed: 403 Forbidden', 'warning');
          } else {
            log('   ❌ Failed with status: ' + response.status, 'warning');
          }
        } catch (endpointError) {
          log('   ❌ Error: ' + endpointError.message, 'warning');
        }
        
        await wait(500);
      }
      
      if (!loyaltyResult) {
        log('❌ All loyalty endpoints failed!', 'error');
        log('📝 Tested endpoints:', 'info');
        for (var li = 0; li < endpoints.length; li++) {
          log('   ' + (li + 1) + '. ' + endpoints[li].url + ' (' + endpoints[li].method + ')', 'info');
        }
        return null;
      }
      
      log('✅ Using working endpoint for loyalty data', 'success');
      
      var loyalty = loyaltyResult.data.payload.loyaltyInformation;
      log('✅ Loyalty API returned data successfully!', 'success');
      
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      log('📊 LOYALTY DATA EXTRACTION RESULTS', 'success');
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      log('', 'info');
      
      if (loyalty.crownAndAnchorSocietyLoyaltyTier) {
        var caPoints = loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints || 0;
        var caNextTier = loyalty.crownAndAnchorSocietyNextTier || '';
        var caRemaining = loyalty.crownAndAnchorSocietyRemainingPoints || 0;
        var caPercentage = loyalty.crownAndAnchorTrackerPercentage || 0;
        log('   👑 Crown & Anchor Society (Loyalty):', 'info');
        log('      Tier: ' + loyalty.crownAndAnchorSocietyLoyaltyTier, 'success');
        log('      Points: ' + caPoints.toLocaleString() + ' cruise credits', 'success');
        log('      ID: ' + (loyalty.crownAndAnchorId || 'N/A'), 'info');
        if (caNextTier) {
          log('      Next Tier: ' + caNextTier + ' (' + caRemaining.toLocaleString() + ' pts away, ' + caPercentage + '% complete)', 'info');
        }
      } else {
        log('   👑 Crown & Anchor Society: Not found in API response', 'warning');
      }
      log('', 'info');
      
      if (loyalty.clubRoyaleLoyaltyTier) {
        var crPoints = loyalty.clubRoyaleLoyaltyIndividualPoints || 0;
        log('   🎰 Club Royale (Casino Loyalty):', 'info');
        log('      Tier: ' + loyalty.clubRoyaleLoyaltyTier, 'success');
        log('      Points: ' + crPoints.toLocaleString() + ' tier credits', 'success');
      } else {
        log('   🎰 Club Royale (Casino): Not found in API response', 'warning');
      }
      log('', 'info');
      
      if (loyalty.captainsClubLoyaltyTier) {
        var ccPoints = loyalty.captainsClubLoyaltyIndividualPoints || 0;
        var ccNextTier = loyalty.captainsClubNextTier || '';
        var ccRemaining = loyalty.captainsClubRemainingPoints || 0;
        var ccPercentage = loyalty.captainsClubTrackerPercentage || 0;
        log('   ⚓ Captain\'s Club (Celebrity Loyalty):', 'info');
        log('      Tier: ' + loyalty.captainsClubLoyaltyTier, 'success');
        log('      Points: ' + ccPoints.toLocaleString(), 'success');
        log('      ID: ' + (loyalty.captainsClubId || 'N/A'), 'info');
        if (ccNextTier) {
          log('      Next Tier: ' + ccNextTier + ' (' + ccRemaining.toLocaleString() + ' pts away, ' + ccPercentage + '% complete)', 'info');
        }
      }
      log('', 'info');
      
      if (loyalty.celebrityBlueChipLoyaltyTier) {
        var bcPoints = loyalty.celebrityBlueChipLoyaltyIndividualPoints || 0;
        log('   💎 Blue Chip Club (Celebrity Casino):', 'info');
        log('      Tier: ' + loyalty.celebrityBlueChipLoyaltyTier, 'success');
        log('      Points: ' + bcPoints.toLocaleString(), 'success');
      }
      log('', 'info');
      
      if (loyalty.venetianSocietyLoyaltyTier) {
        log('   🚢 Venetian Society (Silversea):', 'info');
        log('      Tier: ' + loyalty.venetianSocietyLoyaltyTier, 'success');
        if (loyalty.venetianSocietyNextTier) {
          log('      Next Tier: ' + loyalty.venetianSocietyNextTier, 'info');
        }
        if (loyalty.vsMemberNumber) {
          log('      Member #: ' + loyalty.vsMemberNumber, 'info');
        }
      }
      
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      log('📋 COMPLETE API PAYLOAD:', 'info');
      log('   Account ID: ' + (loyaltyResult.accountId || 'N/A'), 'info');
      log('   Crown & Anchor ID: ' + (loyalty.crownAndAnchorId || 'N/A'), 'info');
      log('   C&A Tier: ' + (loyalty.crownAndAnchorSocietyLoyaltyTier || 'N/A'), 'info');
      log('   C&A Points: ' + (loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints || 0), 'info');
      log('   Club Royale Tier: ' + (loyalty.clubRoyaleLoyaltyTier || 'N/A'), 'info');
      log('   Club Royale Points: ' + (loyalty.clubRoyaleLoyaltyIndividualPoints || 0), 'info');
      if (loyalty.captainsClubLoyaltyTier) {
        log('   Captain\'s Club Tier: ' + loyalty.captainsClubLoyaltyTier, 'info');
        log('   Captain\'s Club Points: ' + (loyalty.captainsClubLoyaltyIndividualPoints || 0), 'info');
      }
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      log('📊 LOYALTY DATA EXTRACTION RESULTS', 'success');
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      
      if (loyalty.crownAndAnchorSocietyLoyaltyTier) {
        var caPoints = loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints || 0;
        var caNextTier = loyalty.crownAndAnchorSocietyNextTierLevel || '';
        var caRemaining = loyalty.crownAndAnchorSocietyRemainingPoints || 0;
        log('   👑 Crown & Anchor Society:', 'info');
        log('      Tier: ' + loyalty.crownAndAnchorSocietyLoyaltyTier, 'success');
        log('      Points: ' + caPoints.toLocaleString(), 'success');
        if (caNextTier) {
          log('      Next Tier: ' + caNextTier + ' (' + caRemaining.toLocaleString() + ' pts away)', 'info');
        }
      } else {
        log('   👑 Crown & Anchor Society: Not found in API response', 'warning');
      }
      
      if (loyalty.clubRoyaleLoyaltyTier) {
        var crPoints = loyalty.clubRoyaleLoyaltyIndividualPoints || 0;
        log('   🎰 Club Royale (Casino):', 'info');
        log('      Tier: ' + loyalty.clubRoyaleLoyaltyTier, 'success');
        log('      Points: ' + crPoints.toLocaleString(), 'success');
      } else {
        log('   🎰 Club Royale (Casino): Not found in API response', 'warning');
      }
      
      if (loyalty.captainsClubLoyaltyTier) {
        var ccPoints = loyalty.captainsClubLoyaltyIndividualPoints || 0;
        var ccNextTier = loyalty.captainsClubNextTierLevel || '';
        var ccRemaining = loyalty.captainsClubRemainingPoints || 0;
        log('   ⚓ Captain\\'s Club (Celebrity):', 'info');
        log('      Tier: ' + loyalty.captainsClubLoyaltyTier, 'success');
        log('      Points: ' + ccPoints.toLocaleString(), 'success');
        if (ccNextTier) {
          log('      Next Tier: ' + ccNextTier + ' (' + ccRemaining.toLocaleString() + ' pts away)', 'info');
        }
      }
      
      if (loyalty.blueChipClubLoyaltyTier) {
        var bcPoints = loyalty.blueChipClubLoyaltyIndividualPoints || 0;
        log('   💎 Blue Chip Club (Celebrity Casino):', 'info');
        log('      Tier: ' + loyalty.blueChipClubLoyaltyTier, 'success');
        log('      Points: ' + bcPoints.toLocaleString(), 'success');
      }
      
      if (loyalty.venetianSocietyLoyaltyTier) {
        log('   🚢 Venetian Society:', 'info');
        log('      Tier: ' + loyalty.venetianSocietyLoyaltyTier, 'success');
        if (loyalty.venetianSocietyMemberNumber) {
          log('      Member #: ' + loyalty.venetianSocietyMemberNumber, 'info');
        }
      }
      
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'extended_loyalty_data',
        data: loyalty,
        accountId: loyaltyResult.accountId
      }));
      
      return loyalty;
      
    } catch (error) {
      log('⚠️ Loyalty fetch failed: ' + error.message, 'warning');
      return null;
    }
  }

  // Valid Crown & Anchor tiers
  var VALID_CA_TIERS = ['gold', 'platinum', 'emerald', 'diamond', 'diamond plus', 'pinnacle'];
  // Valid Club Royale tiers  
  var VALID_CR_TIERS = ['choice', 'classic', 'prime', 'premier', 'signature', 'masters'];

  function isValidLoyaltyData(data) {
    if (!data) return false;
    
    // Check if we have at least one valid tier
    var caTier = (data.crownAndAnchorLevel || '').toLowerCase().trim();
    var crTier = (data.clubRoyaleTier || '').toLowerCase().trim();
    
    var hasValidCATier = caTier && VALID_CA_TIERS.some(function(t) { 
      return caTier.indexOf(t) !== -1; 
    });
    var hasValidCRTier = crTier && VALID_CR_TIERS.some(function(t) { 
      return crTier.indexOf(t) !== -1; 
    });
    
    // Check if we have reasonable points
    var caPoints = parseInt(data.crownAndAnchorPoints || '0', 10);
    var crPoints = parseInt(data.clubRoyalePoints || '0', 10);
    var hasValidPoints = (caPoints > 0 && caPoints < 10000000) || (crPoints > 0 && crPoints < 10000000);
    
    // Must have at least one valid tier OR valid points to be considered valid
    var isValid = hasValidCATier || hasValidCRTier || hasValidPoints;
    
    if (!isValid) {
      log('⚠️ Extracted data failed validation - not sending garbage', 'warning');
      log('   C&A Tier: "' + caTier + '" valid=' + hasValidCATier, 'info');
      log('   CR Tier: "' + crTier + '" valid=' + hasValidCRTier, 'info');
      log('   Points valid=' + hasValidPoints, 'info');
    }
    
    return isValid;
  }

  async function extractLoyaltyData() {
    try {
      log('🚀 ====== STEP 4: LOYALTY DATA ======', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');

      // Check if we're on the correct page
      if (window.location.href.includes('/error') || window.location.href.includes('/errors')) {
        log('⚠️ On error page - page redirect may have failed', 'warning');
      } else if (window.location.href.includes('/loyalty-programs')) {
        log('✅ On loyalty-programs page - good!', 'success');
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Extracting loyalty data from page...'
      }));

      // Wait for page to fully load and render (5 seconds as recommended)
      log('🔄 Waiting for page to fully load...', 'info');
      await wait(5000);

      // FIRST: Check if we have captured payloads from network monitor
      if (window.capturedPayloads && window.capturedPayloads.loyalty) {
        log('✅ Found captured loyalty payload from network monitor!', 'success');
        var capturedData = window.capturedPayloads.loyalty;
        log('📦 Captured data keys: ' + Object.keys(capturedData).join(', '), 'info');
        
        // Extract loyalty info from captured payload
        var loyaltyPayload = capturedData.payload || capturedData;
        var loyaltyInfo = loyaltyPayload.loyaltyInformation || loyaltyPayload;
        var accountId = loyaltyPayload.accountId || '';
        
        if (loyaltyInfo) {
          log('✅ Using loyalty data from captured payload', 'success');
          
          // Send the loyalty data
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'extended_loyalty_data',
            data: loyaltyInfo,
            accountId: accountId
          }));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'step_complete',
            step: 4,
            totalCount: 1
          }));
          
          log('✅ Step 4 Complete: Loyalty data extracted from captured payload', 'success');
          return;
        }
      } else {
        log('📝 No captured loyalty payload, trying other methods...', 'info');
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 20,
        total: 100,
        stepName: 'Checking embedded page data...'
      }));

      // SECOND: Try to extract from embedded page data (most reliable)
      log('📄 Step 1: Trying to extract from embedded page data (__NEXT_DATA__)...', 'info');
      var pageState = extractFromPageState();
      
      var loyaltyResult = null;
      if (pageState && pageState.loyalty) {
        log('✅ Successfully extracted loyalty from page data!', 'success');
        loyaltyResult = pageState.loyalty;
        
        // Send the loyalty data
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'extended_loyalty_data',
          data: pageState.loyalty,
          accountId: pageState.accountId
        }));
      } else {
        log('⚠️ Page data extraction failed or returned no loyalty data - trying API...', 'warning');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          current: 40,
          total: 100,
          stepName: 'Trying API fallback...'
        }));
        
        // Fallback to API
        loyaltyResult = await fetchLoyaltyData();
      }
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 70,
        total: 100,
        stepName: 'Processing loyalty data...'
      }));

      if (loyaltyResult) {
        log('✅ Step 4 Complete: Loyalty data extracted successfully via API', 'success');
      } else {
        log('⚠️ API method failed - trying DOM fallback...', 'warning');
        
        // Wait a moment then try DOM extraction
        await wait(1000);
        
        // Try to extract from DOM as fallback
        log('📄 Attempting DOM fallback for loyalty data...', 'info');
        var domLoyalty = extractLoyaltyFromDOM();
        
        // Validate extracted data - don't send garbage
        if (domLoyalty && isValidLoyaltyData(domLoyalty)) {
          log('✅ Extracted valid loyalty data from DOM', 'success');
          
          // Log DOM extraction results
          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
          log('📊 LOYALTY DATA (DOM FALLBACK)', 'success');
          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
          if (domLoyalty.crownAndAnchorLevel) {
            log('   👑 Crown & Anchor: ' + domLoyalty.crownAndAnchorLevel + ' - ' + (domLoyalty.crownAndAnchorPoints || '0') + ' pts', 'success');
          }
          if (domLoyalty.clubRoyaleTier) {
            log('   🎰 Club Royale: ' + domLoyalty.clubRoyaleTier + ' - ' + (domLoyalty.clubRoyalePoints || '0') + ' pts', 'success');
          }
          log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'loyalty_data',
            data: domLoyalty
          }));
        } else {
          log('⚠️ Step 4 Complete: Could not extract valid loyalty data from API or DOM', 'warning');
          log('💡 Tip: Try logging out and back in, then run sync again', 'info');
        }
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 100,
        total: 100,
        stepName: 'Complete'
      }));

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: loyaltyResult || {},
        totalCount: loyaltyResult ? 1 : 0
      }));

    } catch (error) {
      log('❌ CRITICAL ERROR in Step 4: ' + error.message, 'error');
      log('📝 Error stack: ' + (error.stack || 'N/A'), 'error');
      
      // Still send step_complete even on error
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'step_complete',
        step: 4,
        data: {},
        totalCount: 0
      }));
      
      log('⚠️ Step 4 completed with errors', 'warning');
    }
  }

  function extractLoyaltyFromDOM() {
    try {
      var pageText = document.body.textContent || '';
      var pageHTML = document.body.innerHTML || '';
      var result = {
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: '',
        clubRoyaleTier: '',
        clubRoyalePoints: ''
      };
      
      log('📄 Scanning page for loyalty data...', 'info');
      log('📄 Page text length: ' + pageText.length + ' chars', 'info');
      
      // First check for "Diamond Plus" or "Pinnacle Club" explicitly (multi-word tiers)
      var diamondPlusMatch = pageText.match(/Diamond\\s+Plus/i);
      var pinnacleClubMatch = pageText.match(/Pinnacle\\s+Club/i);
      
      if (pinnacleClubMatch) {
        result.crownAndAnchorLevel = 'Pinnacle Club';
        log('📄 Found Crown & Anchor tier: Pinnacle Club', 'success');
      } else if (diamondPlusMatch) {
        result.crownAndAnchorLevel = 'Diamond Plus';
        log('📄 Found Crown & Anchor tier: Diamond Plus', 'success');
      } else {
        // Crown & Anchor tier patterns - more specific patterns
        var caTierPatterns = [
          /Crown\\s*(?:&|and)?\\s*Anchor[^a-zA-Z]{0,50}(Pinnacle|Emerald|Diamond|Platinum|Gold)/i,
          /(?:Your|My)?\\s*(?:current\\s*)?(?:C&A|Crown\\s*&?\\s*Anchor)?\\s*(?:status|tier|level|membership)[:\\s\\-]{0,10}(Pinnacle|Emerald|Diamond|Platinum|Gold)/i,
          /(Pinnacle|Emerald|Diamond|Platinum|Gold)\\s*(?:Member|Status|Tier|Level)/i,
          /\\b(Pinnacle|Emerald|Diamond|Platinum|Gold)\\s+member\\b/i
        ];
        
        for (var i = 0; i < caTierPatterns.length; i++) {
          var match = pageText.match(caTierPatterns[i]);
          if (match && match[1]) {
            var tier = match[1].trim();
            // Verify it's a valid tier name
            if (VALID_CA_TIERS.indexOf(tier.toLowerCase()) !== -1) {
              result.crownAndAnchorLevel = tier;
              log('📄 Found Crown & Anchor tier: ' + tier, 'success');
              break;
            }
          }
        }
      }
      
      // Crown & Anchor points patterns - MUST be more specific to avoid matching random numbers
      // Look for "X cruise credits" or "cruise credits: X" patterns near Crown & Anchor content
      var caPointsPatterns = [
        // Very specific: near "Crown & Anchor" or "C&A"
        /(?:Crown\\s*(?:&|and)?\\s*Anchor|C&A)[^0-9]{0,100}?([\\d,]+)\\s*(?:cruise\\s*)?(?:credits|points)/i,
        /(?:cruise\\s*)?(?:credits|points)[:\\s]*([\\d,]+)(?:[^0-9]{0,50}Crown|[^0-9]{0,50}C&A)/i,
        // "You have X cruise credits" or "X total cruise credits"
        /(?:you\\s+have|total|earned|current|lifetime)\\s*([\\d,]+)\\s*(?:cruise\\s*)?(?:credits|points)/i,
        /([\\d,]+)\\s*(?:total\\s*)?cruise\\s*credits/i
      ];
      
      for (var j = 0; j < caPointsPatterns.length; j++) {
        var pMatch = pageText.match(caPointsPatterns[j]);
        if (pMatch) {
          var pointVal = pMatch[1] || pMatch[2];
          if (pointVal) {
            var numPoints = parseInt(pointVal.replace(/,/g, ''), 10);
            // Crown & Anchor points are typically 1-10000+ range, filter out small numbers that might be days/nights
            // Points below 50 are likely "X days to go" or similar, not actual loyalty points
            if (numPoints >= 50 && numPoints <= 10000000) {
              result.crownAndAnchorPoints = numPoints.toString();
              log('📄 Found Crown & Anchor points: ' + numPoints, 'success');
              break;
            } else {
              log('📄 Skipping potential C&A points value ' + numPoints + ' (too small, likely not points)', 'info');
            }
          }
        }
      }
      
      // If we still don't have C&A points, try looking at structured data on the page
      if (!result.crownAndAnchorPoints) {
        // Look for elements with specific data attributes or classes
        var pointElements = document.querySelectorAll('[class*="point"], [class*="credit"], [data-testid*="point"], [data-testid*="credit"]');
        for (var pe = 0; pe < pointElements.length; pe++) {
          var elText = pointElements[pe].textContent || '';
          var elPointMatch = elText.match(/(\\d{2,})/); // At least 2 digits
          if (elPointMatch && elText.toLowerCase().indexOf('cruise') >= 0) {
            var elPoints = parseInt(elPointMatch[1], 10);
            if (elPoints >= 50 && elPoints <= 10000000) {
              result.crownAndAnchorPoints = elPoints.toString();
              log('📄 Found C&A points from DOM element: ' + elPoints, 'success');
              break;
            }
          }
        }
      }
      
      // Club Royale tier patterns
      var crTierPatterns = [
        /Club\\s*Royale[^a-zA-Z]{0,50}(Masters|Signature|Premier|Prime|Classic|Choice)/i,
        /(?:Casino|CR)\\s*(?:Status|Tier|Level)[:\\s\\-]{0,10}(Masters|Signature|Premier|Prime|Classic|Choice)/i,
        /(Masters|Signature|Premier|Prime|Classic|Choice)\\s*(?:Member|Status|Tier)/i,
        /\\b(Masters|Signature|Premier|Prime|Classic|Choice)\\s+casino\\s+tier\\b/i
      ];
      
      for (var k = 0; k < crTierPatterns.length; k++) {
        var crMatch = pageText.match(crTierPatterns[k]);
        if (crMatch && crMatch[1]) {
          var crTier = crMatch[1].trim();
          if (VALID_CR_TIERS.indexOf(crTier.toLowerCase()) !== -1) {
            result.clubRoyaleTier = crTier;
            log('📄 Found Club Royale tier: ' + crTier, 'success');
            break;
          }
        }
      }
      
      // Club Royale points/credits patterns - more specific
      var crPointsPatterns = [
        /(?:Club\\s*Royale|casino)[^0-9]{0,100}?([\\d,]+)\\s*(?:tier\\s*)?credits/i,
        /tier\\s*credits[:\\s]*([\\d,]+)/i,
        /([\\d,]+)\\s*tier\\s*credits/i
      ];
      
      for (var l = 0; l < crPointsPatterns.length; l++) {
        var crpMatch = pageText.match(crPointsPatterns[l]);
        if (crpMatch && crpMatch[1]) {
          var crPoints = parseInt(crpMatch[1].replace(/,/g, ''), 10);
          // Club Royale tier credits typically in hundreds to tens of thousands
          if (crPoints >= 100 && crPoints <= 10000000) {
            result.clubRoyalePoints = crPoints.toString();
            log('📄 Found Club Royale points: ' + crPoints, 'success');
            break;
          }
        }
      }
      
      var hasData = result.crownAndAnchorLevel || result.crownAndAnchorPoints || 
                    result.clubRoyaleTier || result.clubRoyalePoints;
      
      if (hasData) {
        log('📄 DOM extraction summary:', 'info');
        log('   C&A Tier: ' + (result.crownAndAnchorLevel || '[not found]'), 'info');
        log('   C&A Points: ' + (result.crownAndAnchorPoints || '[not found]'), 'info');
        log('   CR Tier: ' + (result.clubRoyaleTier || '[not found]'), 'info');
        log('   CR Points: ' + (result.clubRoyalePoints || '[not found]'), 'info');
        return result;
      }
      
      log('📄 DOM extraction: No loyalty data found on page', 'warning');
      log('📄 Page might be an error page or not a loyalty page', 'warning');
      return null;
    } catch (e) {
      log('⚠️ DOM extraction failed: ' + e.message, 'warning');
      return null;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', extractLoyaltyData);
  } else {
    extractLoyaltyData();
  }
})();
`;

export function injectLoyaltyExtraction() {
  return STEP4_LOYALTY_SCRIPT;
}
