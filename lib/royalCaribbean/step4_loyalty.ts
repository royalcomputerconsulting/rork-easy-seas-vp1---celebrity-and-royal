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
        credentials: 'include',
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

      // Check if we're on an error page
      if (window.location.href.includes('/error') || window.location.href.includes('/errors')) {
        log('⚠️ Currently on an error page - API may fail', 'warning');
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 0,
        total: 100,
        stepName: 'Fetching loyalty data...'
      }));

      // Wait for page to stabilize
      await wait(2000);

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 30,
        total: 100,
        stepName: 'Calling loyalty API...'
      }));

      // Fetch loyalty data using Bearer token auth
      var loyaltyResult = await fetchLoyaltyData();
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress',
        current: 60,
        total: 100,
        stepName: 'Processing loyalty data...'
      }));

      if (loyaltyResult) {
        log('✅ Step 4 Complete: Loyalty data extracted successfully', 'success');
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
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'loyalty_data',
            data: domLoyalty
          }));
        } else {
          log('⚠️ Step 4 Complete: Could not extract valid loyalty data from API or DOM', 'warning');
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
      
      log('📄 Scanning page for loyalty data...', 'info');
      log('📄 Page text length: ' + pageText.length + ' chars', 'info');
      
      // First check for "Diamond Plus" explicitly (multi-word tier)
      var diamondPlusMatch = pageText.match(/Diamond\\s+Plus/i);
      if (diamondPlusMatch) {
        result.crownAndAnchorLevel = 'Diamond Plus';
        log('📄 Found Crown & Anchor tier: Diamond Plus', 'success');
      } else {
        // Crown & Anchor tier patterns - more specific patterns
        var caTierPatterns = [
          /Crown\\s*(?:&|and)?\\s*Anchor[^a-zA-Z]{0,30}(Pinnacle|Emerald|Diamond|Platinum|Gold)/i,
          /(?:Your|My)?\\s*(?:current\\s*)?(?:status|tier|level|membership)[:\\s\\-]{0,10}(Pinnacle|Emerald|Diamond|Platinum|Gold)/i,
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
      
      // Crown & Anchor points patterns - look for cruise credits/points
      var caPointsPatterns = [
        /([\\d,]+)\\s*(?:cruise\\s*)?(?:credits|points)(?:\\s*earned)?/i,
        /(?:total|earned|current|lifetime)\\s*(?:cruise\\s*)?(?:credits|points)[:\\s]*([\\d,]+)/i
      ];
      
      for (var j = 0; j < caPointsPatterns.length; j++) {
        var pMatch = pageText.match(caPointsPatterns[j]);
        if (pMatch) {
          var pointVal = pMatch[1] || pMatch[2];
          if (pointVal) {
            var numPoints = parseInt(pointVal.replace(/,/g, ''), 10);
            // Crown & Anchor points are typically in the range of 1-100000+
            if (numPoints >= 1 && numPoints <= 10000000) {
              result.crownAndAnchorPoints = numPoints.toString();
              log('📄 Found Crown & Anchor points: ' + numPoints, 'success');
              break;
            }
          }
        }
      }
      
      // Club Royale tier patterns
      var crTierPatterns = [
        /Club\\s*Royale[^a-zA-Z]{0,30}(Masters|Signature|Premier|Prime|Classic|Choice)/i,
        /(?:Casino|CR)\\s*(?:Status|Tier|Level)[:\\s\\-]{0,10}(Masters|Signature|Premier|Prime|Classic|Choice)/i,
        /(Masters|Signature|Premier|Prime|Classic|Choice)\\s*(?:Member|Status|Tier)/i
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
      
      // Club Royale points/credits patterns
      var crPointsPatterns = [
        /tier\\s*credits[:\\s]*([\\d,]+)/i,
        /([\\d,]+)\\s*tier\\s*credits/i
      ];
      
      for (var l = 0; l < crPointsPatterns.length; l++) {
        var crpMatch = pageText.match(crPointsPatterns[l]);
        if (crpMatch && crpMatch[1]) {
          var crPoints = parseInt(crpMatch[1].replace(/,/g, ''), 10);
          // Club Royale tier credits are typically 0-100000+
          if (crPoints >= 0 && crPoints <= 10000000) {
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
