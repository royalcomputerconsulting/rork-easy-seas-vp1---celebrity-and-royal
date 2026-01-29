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
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'account-id': accountId,
        'authorization': networkAuth,
        'content-type': 'application/json'
      };
    } catch (e) {
      log('⚠️ Failed to get auth headers: ' + e.message, 'warning');
      return null;
    }
  }

  async function fetchLoyaltyData() {
    log('📡 Fetching loyalty data via authenticated API...', 'info');

    var headers = getAuthHeaders();
    if (!headers) {
      log('⚠️ Could not obtain auth headers - will try DOM fallback', 'warning');
      return null;
    }

    try {
      var host = location && location.hostname ? location.hostname : '';
      var brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
      var baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
      var endpoint = baseUrl + '/api/profile/loyalty';
      
      log('📡 Calling ' + endpoint + '...', 'info');
      
      var response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'omit',
        headers: headers
      });

      log('📡 Loyalty API Response status: ' + response.status, 'info');

      if (!response.ok) {
        log('⚠️ Loyalty API returned non-OK status: ' + response.status, 'warning');
        return null;
      }

      var text = await response.text();
      log('📦 Loyalty response length: ' + text.length + ' chars', 'info');
      
      var data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        log('⚠️ Failed to parse loyalty JSON: ' + parseError.message, 'warning');
        return null;
      }
      
      if (data && data.payload && data.payload.loyaltyInformation) {
        var loyalty = data.payload.loyaltyInformation;
        log('✅ Loyalty API returned data successfully!', 'success');
        
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        log('📊 LOYALTY DATA EXTRACTION', 'success');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
        
        if (loyalty.crownAndAnchorSocietyLoyaltyTier) {
          var caPoints = loyalty.crownAndAnchorSocietyLoyaltyIndividualPoints || 0;
          var caNextTier = loyalty.crownAndAnchorSocietyNextTierLevel || '';
          var caRemaining = loyalty.crownAndAnchorSocietyRemainingPoints || 0;
          log('   👑 Crown & Anchor Society:', 'info');
          log('      Tier: ' + loyalty.crownAndAnchorSocietyLoyaltyTier, 'success');
          log('      Points: ' + caPoints.toLocaleString(), 'info');
          if (caNextTier) {
            log('      Next Tier: ' + caNextTier + ' (' + caRemaining.toLocaleString() + ' pts away)', 'info');
          }
        }
        
        if (loyalty.clubRoyaleLoyaltyTier) {
          var crPoints = loyalty.clubRoyaleLoyaltyIndividualPoints || 0;
          log('   🎰 Club Royale (Casino):', 'info');
          log('      Tier: ' + loyalty.clubRoyaleLoyaltyTier, 'success');
          log('      Points: ' + crPoints.toLocaleString(), 'info');
        }
        
        if (loyalty.captainsClubLoyaltyTier) {
          var ccPoints = loyalty.captainsClubLoyaltyIndividualPoints || 0;
          var ccNextTier = loyalty.captainsClubNextTierLevel || '';
          var ccRemaining = loyalty.captainsClubRemainingPoints || 0;
          log('   ⚓ Captain\\'s Club (Celebrity):', 'info');
          log('      Tier: ' + loyalty.captainsClubLoyaltyTier, 'success');
          log('      Points: ' + ccPoints.toLocaleString(), 'info');
          if (ccNextTier) {
            log('      Next Tier: ' + ccNextTier + ' (' + ccRemaining.toLocaleString() + ' pts away)', 'info');
          }
        }
        
        if (loyalty.blueChipClubLoyaltyTier) {
          var bcPoints = loyalty.blueChipClubLoyaltyIndividualPoints || 0;
          log('   💎 Blue Chip Club (Celebrity Casino):', 'info');
          log('      Tier: ' + loyalty.blueChipClubLoyaltyTier, 'success');
          log('      Points: ' + bcPoints.toLocaleString(), 'info');
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
          accountId: data.payload.accountId
        }));
        
        return loyalty;
      }
      
      log('⚠️ No loyaltyInformation in response', 'warning');
      if (data && data.payload) {
        log('📝 Payload keys: ' + Object.keys(data.payload).join(', '), 'info');
      }
      return null;
      
    } catch (error) {
      log('⚠️ Loyalty fetch failed: ' + error.message, 'warning');
      return null;
    }
  }

  async function extractLoyaltyData() {
    try {
      log('🚀 ====== STEP 4: LOYALTY DATA ======', 'info');
      log('📍 Current URL: ' + window.location.href, 'info');

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Fetching loyalty data...'
      }));

      // Small wait to ensure any pending operations complete
      await wait(1000);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 30,
        total: 100,
        stepName: 'Calling loyalty API...'
      }));

      // Fetch loyalty data using Bearer token auth (same as Step 1)
      var loyaltyResult = await fetchLoyaltyData();
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 80,
        total: 100,
        stepName: 'Processing loyalty data...'
      }));

      if (loyaltyResult) {
        log('✅ Step 4 Complete: Loyalty data extracted successfully', 'success');
      } else {
        log('⚠️ API method failed - trying DOM fallback...', 'warning');
        
        // Try to extract from DOM as fallback
        log('📄 Attempting DOM fallback for loyalty data...', 'info');
        var domLoyalty = extractLoyaltyFromDOM();
        if (domLoyalty) {
          log('✅ Extracted loyalty data from DOM', 'success');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'loyalty_data',
            data: domLoyalty
          }));
        } else {
          log('⚠️ Step 4 Complete: Could not extract loyalty data from API or DOM', 'warning');
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
      var result = {
        crownAndAnchorLevel: '',
        crownAndAnchorPoints: '',
        clubRoyaleTier: '',
        clubRoyalePoints: ''
      };
      
      // Crown & Anchor tier patterns - look for specific tier names
      var caTierPatterns = [
        /Crown\\s*(?:&|and)?\\s*Anchor[^\\w]*(Gold|Platinum|Emerald|Diamond|Diamond\\s*Plus|Pinnacle)/i,
        /(Gold|Platinum|Emerald|Diamond|Diamond\\s*Plus|Pinnacle)\\s*(?:Member|Status|Tier)/i,
        /Your\\s+(?:current\\s+)?tier[:\\s]*(Gold|Platinum|Emerald|Diamond|Diamond\\s*Plus|Pinnacle)/i
      ];
      
      for (var i = 0; i < caTierPatterns.length; i++) {
        var match = pageText.match(caTierPatterns[i]);
        if (match && match[1]) {
          result.crownAndAnchorLevel = match[1].trim();
          break;
        }
      }
      
      // Crown & Anchor points patterns
      var caPointsPatterns = [
        /([\\d,]+)\\s*(?:cruise\\s*)?points/i,
        /(?:total|earned|current)\\s*(?:cruise\\s*)?points[:\\s]*([\\d,]+)/i
      ];
      
      for (var j = 0; j < caPointsPatterns.length; j++) {
        var pMatch = pageText.match(caPointsPatterns[j]);
        if (pMatch) {
          var pointVal = pMatch[1] || pMatch[2];
          if (pointVal) {
            var numPoints = parseInt(pointVal.replace(/,/g, ''), 10);
            if (numPoints >= 1 && numPoints <= 10000000) {
              result.crownAndAnchorPoints = pointVal.replace(/,/g, '');
              break;
            }
          }
        }
      }
      
      // Club Royale tier patterns - look for specific tier names
      var crTierPatterns = [
        /Club\\s*Royale[^\\w]*(Signature|Premier|Classic|Prime|Choice|Masters)/i,
        /(Signature|Premier|Classic|Prime|Choice|Masters)\\s*(?:Member|Status|Tier)/i,
        /Casino\\s*(?:Status|Tier)[:\\s]*(Signature|Premier|Classic|Prime|Choice|Masters)/i
      ];
      
      for (var k = 0; k < crTierPatterns.length; k++) {
        var crMatch = pageText.match(crTierPatterns[k]);
        if (crMatch && crMatch[1]) {
          result.clubRoyaleTier = crMatch[1].trim();
          break;
        }
      }
      
      // Club Royale points patterns
      var crPointsPatterns = [
        /(?:tier\\s*)?credits[:\\s]*([\\d,]+)/i,
        /([\\d,]+)\\s*(?:tier\\s*)?credits/i,
        /casino\\s*points[:\\s]*([\\d,]+)/i
      ];
      
      for (var l = 0; l < crPointsPatterns.length; l++) {
        var crpMatch = pageText.match(crPointsPatterns[l]);
        if (crpMatch && crpMatch[1]) {
          var crPoints = parseInt(crpMatch[1].replace(/,/g, ''), 10);
          if (crPoints >= 0 && crPoints <= 10000000) {
            result.clubRoyalePoints = crpMatch[1].replace(/,/g, '');
            break;
          }
        }
      }
      
      var hasData = result.crownAndAnchorLevel || result.crownAndAnchorPoints || 
                    result.clubRoyaleTier || result.clubRoyalePoints;
      
      if (hasData) {
        log('📄 DOM extraction found:', 'info');
        if (result.crownAndAnchorLevel || result.crownAndAnchorPoints) {
          log('   C&A: ' + (result.crownAndAnchorLevel || 'N/A') + ' / ' + (result.crownAndAnchorPoints || '0') + ' pts', 'info');
        }
        if (result.clubRoyaleTier || result.clubRoyalePoints) {
          log('   CR: ' + (result.clubRoyaleTier || 'N/A') + ' / ' + (result.clubRoyalePoints || '0') + ' pts', 'info');
        }
        return result;
      }
      
      log('📄 DOM extraction: No loyalty data found on page', 'info');
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
