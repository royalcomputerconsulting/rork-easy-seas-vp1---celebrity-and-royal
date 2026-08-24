export const NETWORK_MONITOR_SCRIPT = `
(function() {
  if (window.networkMonitorInstalled) {
    console.log('[NetworkMonitor] Already installed, skipping');
    return;
  }
  window.networkMonitorInstalled = true;
  
  console.log('[NetworkMonitor] Installing comprehensive network monitor');
  
  window.capturedPayloads = window.capturedPayloads || {};
  window.capturedRequestHeaders = window.capturedRequestHeaders || {};
  
  function log(message, type = 'info') {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'log',
        message: message,
        logType: type
      }));
    } catch (e) {
      console.log('[NetworkMonitor]', message);
    }
  }
  
  log('🌐 Network monitoring active - will capture all API payloads', 'info');
  
  function extractHeaderValue(headers, name) {
    try {
      if (!headers) return undefined;
      const lower = name.toLowerCase();
      if (typeof headers.get === 'function') {
        return headers.get(name) || headers.get(lower) || undefined;
      }
      if (Array.isArray(headers)) {
        for (const pair of headers) {
          if (!pair || pair.length < 2) continue;
          const k = String(pair[0] || '').toLowerCase();
          if (k === lower) return String(pair[1] ?? '');
        }
      }
      if (typeof headers === 'object') {
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === lower) return String(headers[k] ?? '');
        }
      }
      return undefined;
    } catch (e) {
      return undefined;
    }
  }

  function captureRequestHeaders(url, options) {
    try {
      if (!url || typeof url !== 'string') return;
      const isRoyalApi = url.includes('aws-prd.api.rccl.com')
        || ((url.includes('royalcaribbean.com') || url.includes('celebritycruises.com')) && url.includes('/api/casino/'));
      if (!isRoyalApi) return;

      const headers = options?.headers;
      const apiKey = extractHeaderValue(headers, 'x-api-key') || extractHeaderValue(headers, 'X-Api-Key') || extractHeaderValue(headers, 'appkey');
      const authorization = extractHeaderValue(headers, 'authorization');
      const accountId = extractHeaderValue(headers, 'x-account-id') || extractHeaderValue(headers, 'account-id');
      const loyaltyId = extractHeaderValue(headers, 'x-loyalty-id');

      if (apiKey) window.capturedRequestHeaders.apiKey = apiKey;
      if (authorization) window.capturedRequestHeaders.authorization = authorization;
      if (accountId) {
        window.capturedRequestHeaders.accountId = accountId;
        window.capturedRequestHeaders.xAccountId = accountId;
      }
      if (loyaltyId) {
        window.capturedRequestHeaders.loyaltyId = loyaltyId;
        window.capturedRequestHeaders.xLoyaltyId = loyaltyId;
      }

      if (apiKey || authorization || accountId || loyaltyId) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'network_capture_headers',
          url,
          hasApiKey: !!apiKey,
          hasAuthorization: !!authorization,
          hasAccountId: !!accountId,
          hasLoyaltyId: !!loyaltyId,
        }));
      }
    } catch (e) {
      // ignore
    }
  }


  function looksLikeOfferPayload(url, data) {
    try {
      const normalizedUrl = String(url || '').toLowerCase();
      if (!data || typeof data !== 'object') return false;
      const isRoyalFamilyUrl = normalizedUrl.includes('royalcaribbean.com') || normalizedUrl.includes('celebritycruises.com') || normalizedUrl.includes('api.rccl.com');
      if (normalizedUrl && !isRoyalFamilyUrl) return false;
      if (normalizedUrl.includes('/i18n/') || normalizedUrl.includes('/translations/')) return false;
      const preview = JSON.stringify(data).slice(0, 240000).toLowerCase();
      const hasOfferShape = preview.includes('offercode') || preview.includes('casinooffers') || preview.includes('campaignoffer') || (preview.includes('sailings') && (preview.includes('reserveby') || preview.includes('expiration')));
      return normalizedUrl.includes('offer') || normalizedUrl.includes('club-royale') || hasOfferShape;
    } catch (e) {
      return false;
    }
  }

  function storeOfferCandidate(url, data) {
    try {
      if (!looksLikeOfferPayload(url, data)) return;
      window.capturedPayloads.offerCandidates = window.capturedPayloads.offerCandidates || [];
      const key = String(url || '') + '|' + String(Date.now());
      window.capturedPayloads.offerCandidates.push({ key: key, url: String(url || ''), data: data, timestamp: new Date().toISOString() });
      if (window.capturedPayloads.offerCandidates.length > 20) {
        window.capturedPayloads.offerCandidates = window.capturedPayloads.offerCandidates.slice(-20);
      }
      window.capturedPayloads.offers = data;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'network_capture_offer_available',
        url: String(url || '')
      }));
      log('📦 Captured live ' + (String(url || '').toLowerCase().includes('celebritycruises.com') ? 'Blue Chip Club' : 'Club Royale') + ' offer payload from ' + String(url || '').split('?')[0], 'success');
    } catch (e) {
      // Never let optional offer discovery interfere with the website request.
    }
  }

  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = args[1] || {};

    captureRequestHeaders(url, options);

    return originalFetch.apply(this, args).then(async (response) => {
      const clonedResponse = response.clone();
      const offerProbeResponse = response.clone();

      try {
        const contentType = offerProbeResponse.headers.get('content-type') || '';
        if (response.ok && contentType.toLowerCase().includes('json')) {
          try {
            const offerProbeData = await offerProbeResponse.json();
            storeOfferCandidate(url, offerProbeData);
          } catch (offerProbeError) {
            // Ignore non-offer or unreadable JSON probes.
          }
        }
      } catch (offerProbeOuterError) {
        // Ignore optional offer discovery failures.
      }
      
      try {
        if (url.includes('/casino-offers') || url.includes('/api/casino/casino-offers')) {
          log('📦 Captured Casino Offers API payload', 'info');
          const data = await clonedResponse.json();
          const offers = data?.payload?.casinoOffers || data?.casinoOffers || [];
          window.capturedPayloads.offers = data;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'log',
            message: \`📦 Captured Casino Offers API payload with \${offers.length} offers\`,
            logType: 'info'
          }));
        }
        
        else if (url.includes('/profileBookings/enriched') || url.includes('/upcomingCruises')) {
          const data = await clonedResponse.json();
          const bookings = data?.payload?.profileBookings || [];
          window.capturedPayloads.upcomingCruises = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'upcomingCruises',
            data: data
          }));
          
          log(\`📦 [Fetch] Captured Bookings API payload with \${bookings.length} bookings from \${url}\`, 'info');
        }
        
        else if (url.includes('/voyages/') && url.includes('/enriched')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.voyageEnrichment = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'voyageEnrichment',
            data: data
          }));
          
          log(\`📦 [Fetch] Captured Voyage Enrichment data from \${url}\`, 'info');
        }
        
        else if (url.includes('/guestAccounts/loyalty/info')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.loyalty = data;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'loyalty',
            data: data,
            url: url
          }));
          
          log(\`📦 [Fetch] Captured Loyalty API payload from \${url}\`, 'success');
          
          const loyaltyInfo = data?.payload?.loyaltyInformation || data?.loyaltyInformation || data;
          const loyaltyUrl = String(url || '').toLowerCase();
          const isCelebrityLoyalty = loyaltyUrl.includes('celebritycruises.com') || loyaltyUrl.includes('/celebrity/');
          if (isCelebrityLoyalty) {
            if (loyaltyInfo?.captainsClubLoyaltyTier) {
              log(\`   🌟 Captain's Club: \${loyaltyInfo.captainsClubLoyaltyTier}\`, 'info');
            }
            if (loyaltyInfo?.celebrityBlueChipLoyaltyTier) {
              log(\`   🎲 Blue Chip Club: \${loyaltyInfo.celebrityBlueChipLoyaltyTier}\`, 'info');
            }
          } else if (loyaltyInfo?.crownAndAnchorSocietyLoyaltyTier || loyaltyInfo?.clubRoyaleLoyaltyTier) {
            if (loyaltyInfo.crownAndAnchorSocietyLoyaltyTier) {
              log(\`   👑 Crown & Anchor: \${loyaltyInfo.crownAndAnchorSocietyLoyaltyTier}\`, 'info');
            }
            if (loyaltyInfo.clubRoyaleLoyaltyTier) {
              log(\`   🎰 Club Royale: \${loyaltyInfo.clubRoyaleLoyaltyTier}\`, 'info');
            }
          }
        }
        
        else if (url.includes('/manage/api/v1/bookings') || url.includes('/manage/api/')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.manageBooking = window.capturedPayloads.manageBooking || [];
          window.capturedPayloads.manageBooking.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'manageBooking',
            data: data,
            url: url
          }));
          
          log(\`💰 [Fetch] Captured Booking Management API from \${url}\`, 'info');
        }
        
        else if (url.includes('/graph') && (url.includes('royalcaribbean.com') || url.includes('celebritycruises.com'))) {
          const data = await clonedResponse.json();
          window.capturedPayloads.graphQL = window.capturedPayloads.graphQL || [];
          window.capturedPayloads.graphQL.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'graphQL',
            data: data,
            url: url
          }));
          
          log(\`📊 [Fetch] Captured GraphQL API from \${url}\`, 'info');
        }
        
        else if (url.includes('/booked/') || url.includes('token=')) {
          const data = await clonedResponse.json();
          window.capturedPayloads.bookedDetails = window.capturedPayloads.bookedDetails || [];
          window.capturedPayloads.bookedDetails.push({ url, data, timestamp: new Date().toISOString() });
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'network_capture',
            endpoint: 'bookedDetails',
            data: data,
            url: url
          }));
          
          log(\`🎫 [Fetch] Captured Booked Cruise Details from \${url}\`, 'info');
        }
        
        else if (url.includes('carnival.com')) {
          try {
            const ct = clonedResponse.headers.get('content-type') || '';
            if (ct.includes('json')) {
              const data = await clonedResponse.json();
              // Carnival frequently changes endpoint aliases. Capture the live JSON response
              // and let the app classify its structure instead of treating the URL as authority.
              window.capturedPayloads.carnivalLiveJson = window.capturedPayloads.carnivalLiveJson || [];
              window.capturedPayloads.carnivalLiveJson.push({ url: url, data: data, timestamp: new Date().toISOString() });
              if (data && data.Items && Array.isArray(data.Items)) {
                window.capturedPayloads.carnivalVifpOffers = data;
                window.__carnivalVifpOffers = data;
              }
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'network_payload',
                endpoint: 'carnival_structured_payload',
                data: data,
                url: url
              }));
              log(\`🎪 [Fetch] Captured Carnival live JSON from \${url.split('?')[0]}\`, 'info');
            }
          } catch (carnivalErr) {
            // ignore carnival parse errors
          }
        }
      } catch (err) {
        console.log('[NetworkMonitor] Error processing response:', err);
      }
      
      return response;
    });
  };
  
  const OriginalXHR = XMLHttpRequest;
  XMLHttpRequest = function() {
    const xhr = new OriginalXHR();

    let _url = '';
    let _headers = {};

    const originalOpen = xhr.open;
    xhr.open = function(method, url) {
      try {
        _url = String(url || '');
      } catch (e) {
        _url = '';
      }
      return originalOpen.apply(this, arguments);
    };

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(name, value) {
      try {
        _headers[String(name || '').toLowerCase()] = String(value ?? '');

        const isRoyalApi = _url.includes('aws-prd.api.rccl.com')
          || ((_url.includes('royalcaribbean.com') || _url.includes('celebritycruises.com')) && _url.includes('/api/casino/'));
        if (isRoyalApi) {
          const apiKey = _headers['x-api-key'] || _headers['appkey'];
          const authorization = _headers['authorization'];
          const accountId = _headers['x-account-id'] || _headers['account-id'];
          const loyaltyId = _headers['x-loyalty-id'];

          if (apiKey) window.capturedRequestHeaders.apiKey = apiKey;
          if (authorization) window.capturedRequestHeaders.authorization = authorization;
          if (accountId) {
            window.capturedRequestHeaders.accountId = accountId;
            window.capturedRequestHeaders.xAccountId = accountId;
          }
          if (loyaltyId) {
            window.capturedRequestHeaders.loyaltyId = loyaltyId;
            window.capturedRequestHeaders.xLoyaltyId = loyaltyId;
          }
        }
      } catch (e) {
        // ignore
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    xhr.addEventListener('load', function() {
      if (this.readyState === 4 && this.status === 200) {
        const url = this.responseURL || _url || '';
        
        try {
          try {
            const genericJson = JSON.parse(this.responseText);
            storeOfferCandidate(url, genericJson);
          } catch (genericOfferError) {
            // Ignore non-JSON responses.
          }

          if (url.includes('/profileBookings/enriched')) {
            const data = JSON.parse(this.responseText);
            const bookings = data?.payload?.profileBookings || [];
            window.capturedPayloads.upcomingCruises = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'upcomingCruises',
              data: data
            }));
            
            log(\`📦 [XHR] Captured Bookings API payload with \${bookings.length} bookings from \${url}\`, 'info');
          }
          
          else if (url.includes('/voyages/') && url.includes('/enriched')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.voyageEnrichment = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'voyageEnrichment',
              data: data
            }));
            
            log(\`📦 [XHR] Captured Voyage Enrichment data from \${url}\`, 'info');
          }
          
          else if (url.includes('/guestAccounts/loyalty/info')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.loyalty = data;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'loyalty',
              data: data,
              url: url
            }));
            
            log(\`📦 [XHR] Captured Loyalty API from \${url}\`, 'success');
            
            const loyaltyInfo = data?.payload?.loyaltyInformation || data?.loyaltyInformation || data;
            const loyaltyUrl = String(url || '').toLowerCase();
            const isCelebrityLoyalty = loyaltyUrl.includes('celebritycruises.com') || loyaltyUrl.includes('/celebrity/');
            if (isCelebrityLoyalty) {
              if (loyaltyInfo?.captainsClubLoyaltyTier) {
                log(\`   🌟 Captain's Club: \${loyaltyInfo.captainsClubLoyaltyTier}\`, 'info');
              }
              if (loyaltyInfo?.celebrityBlueChipLoyaltyTier) {
                log(\`   🎲 Blue Chip Club: \${loyaltyInfo.celebrityBlueChipLoyaltyTier}\`, 'info');
              }
            } else if (loyaltyInfo?.crownAndAnchorSocietyLoyaltyTier || loyaltyInfo?.clubRoyaleLoyaltyTier) {
              if (loyaltyInfo.crownAndAnchorSocietyLoyaltyTier) {
                log(\`   👑 Crown & Anchor: \${loyaltyInfo.crownAndAnchorSocietyLoyaltyTier}\`, 'info');
              }
              if (loyaltyInfo.clubRoyaleLoyaltyTier) {
                log(\`   🎰 Club Royale: \${loyaltyInfo.clubRoyaleLoyaltyTier}\`, 'info');
              }
            }
          }
          
          else if (url.includes('/manage/api/v1/bookings') || url.includes('/manage/api/')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.manageBooking = window.capturedPayloads.manageBooking || [];
            window.capturedPayloads.manageBooking.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'manageBooking',
              data: data,
              url: url
            }));
            
            log(\`💰 [XHR] Captured Booking Management API from \${url}\`, 'info');
          }
          
          else if (url.includes('/graph') && (url.includes('royalcaribbean.com') || url.includes('celebritycruises.com'))) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.graphQL = window.capturedPayloads.graphQL || [];
            window.capturedPayloads.graphQL.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'graphQL',
              data: data,
              url: url
            }));
            
            log(\`📊 [XHR] Captured GraphQL API from \${url}\`, 'info');
          }
          
          else if (url.includes('/booked/') || url.includes('token=')) {
            const data = JSON.parse(this.responseText);
            window.capturedPayloads.bookedDetails = window.capturedPayloads.bookedDetails || [];
            window.capturedPayloads.bookedDetails.push({ url, data, timestamp: new Date().toISOString() });
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'network_capture',
              endpoint: 'bookedDetails',
              data: data,
              url: url
            }));
            
            log(\`🎫 [XHR] Captured Booked Cruise Details from \${url}\`, 'info');
          }
          
          else if (url.includes('carnival.com') && (url.includes('/api/') || url.includes('/profilemanagement/'))) {
            try {
              const data = JSON.parse(this.responseText);
              
              if (url.includes('/offers') || url.includes('/vifp')) {
                if (data.Items && Array.isArray(data.Items)) {
                  window.capturedPayloads.carnivalVifpOffers = data;
                  window.__carnivalVifpOffers = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'carnival_vifp_offers',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [XHR] Captured Carnival VIFP offers: \${data.Items.length} items from \${url}\`, 'success');
                }
              }
              
              if (url.includes('/bookings') || url.includes('/cruises') || url.includes('/reservation')) {
                let bookings = null;
                if (Array.isArray(data)) bookings = data;
                else if (data.bookings && Array.isArray(data.bookings)) bookings = data.bookings;
                else if (data.cruises && Array.isArray(data.cruises)) bookings = data.cruises;
                else if (data.data && Array.isArray(data.data)) bookings = data.data;
                else if (data.payload && Array.isArray(data.payload)) bookings = data.payload;
                
                if (bookings && bookings.length > 0) {
                  window.capturedPayloads.upcomingCruises = data;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'network_payload',
                    endpoint: 'bookings',
                    data: data,
                    url: url
                  }));
                  log(\`🎪 [XHR] Captured Carnival bookings: \${bookings.length} from \${url}\`, 'success');
                }
              }
            } catch (carnivalErr) {
              // ignore
            }
          }
        } catch (err) {
          console.log('[NetworkMonitor] Error processing XHR response:', err);
        }
      }
    });
    
    return xhr;
  };
  
  XMLHttpRequest.prototype = OriginalXHR.prototype;
  
  log('✅ Network monitor installed - tracking fetch() and XMLHttpRequest', 'success');
})();
`;
