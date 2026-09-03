const ApiClient = {
    logSailingDifferences(originalOffer, refreshedOffer) {
        try {
            const original = Array.isArray(originalOffer?.campaignOffer?.sailings) ? originalOffer.campaignOffer.sailings : [];
            const refreshed = Array.isArray(refreshedOffer?.campaignOffer?.sailings) ? refreshedOffer.campaignOffer.sailings : [];
            console.debug('[apiClient] Sailing comparison', {
                offerCode: refreshedOffer?.campaignOffer?.offerCode || originalOffer?.campaignOffer?.offerCode || 'UNKNOWN',
                original: original.length,
                refreshed: refreshed.length,
            });
        } catch (error) {
            console.warn('[apiClient] Sailing comparison failed', error);
        }
    },

    getCookie(name) {
        const target = String(name || '').toLowerCase();
        const pairs = String(document.cookie || '').split(';');
        for (const pair of pairs) {
            const separator = pair.indexOf('=');
            const key = (separator >= 0 ? pair.slice(0, separator) : pair).trim().toLowerCase();
            if (key !== target) continue;
            const value = separator >= 0 ? pair.slice(separator + 1).trim() : '';
            try { return decodeURIComponent(value); } catch (_) { return value; }
        }
        return '';
    },

    async readJson(response, label) {
        const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) return response.json();
        const raw = await response.text();
        try { return JSON.parse(raw); } catch (_) {}
        try { return JSON.parse(atob(raw)); } catch (_) {
            throw new Error(`${label} returned unreadable data`);
        }
    },

    async fetchOffers(retryCount = 2) {
        const host = location?.hostname || '';
        const brandCode = host.includes('celebritycruises.com') ? 'C' : 'R';
        const baseUrl = brandCode === 'C' ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com';
        const accountId = this.getCookie('VDS_ID');
        const loyaltyId = this.getCookie('loyalty_ID');
        const headers = {
            accept: 'application/json',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'cache-control': 'no-cache',
            pragma: 'no-cache',
        };
        if (accountId) {
            headers['account-id'] = accountId;
            headers['x-account-id'] = accountId;
        }
        if (loyaltyId) headers['x-loyalty-id'] = loyaltyId;

        try {
            App.Spinner.showSpinner();
            let partnershipIds = [];
            try {
                const partnerResponse = await fetch(`${baseUrl}/api/casino/v1/partners/player`, {
                    method: 'GET', headers, credentials: 'include',
                });
                if (partnerResponse.ok) {
                    const partnerData = await this.readJson(partnerResponse, 'Partner lookup');
                    const partners = Array.isArray(partnerData) ? partnerData : (Array.isArray(partnerData?.data) ? partnerData.data : []);
                    partnershipIds = partners.map((partner) => String(partner?.partnershipId || partner?.id || partner || '')).filter(Boolean);
                } else if (partnerResponse.status === 401 || partnerResponse.status === 403) {
                    throw new Error('Session expired');
                }
            } catch (partnerError) {
                if (/session expired/i.test(String(partnerError?.message || ''))) throw partnerError;
                console.warn('[apiClient] Partner lookup unavailable; continuing with cookie session', partnerError);
            }

            const listParams = new URLSearchParams();
            if (partnershipIds.length) listParams.append('partnershipIds', partnershipIds.join(','));
            listParams.append('sortBy', 'offer.reserveByDate');
            listParams.append('sortDirection', 'asc');
            listParams.append('limit', '100');
            listParams.append('page', '1');
            listParams.append('digitalRedemption', 'true');
            const listResponse = await fetch(`${baseUrl}/api/casino/v2/offers/list?${listParams}`, {
                method: 'GET', headers, credentials: 'include',
            });
            if (!listResponse.ok) throw new Error(`Offers list failed: ${listResponse.status}`);
            const listData = await this.readJson(listResponse, 'Offers list');
            const initialOffers = Array.isArray(listData?.offers) ? listData.offers : (Array.isArray(listData) ? listData : []);
            if (!initialOffers.length) throw new Error('Offers list returned zero records');

            const offers = await Promise.all(initialOffers.map(async (offer) => {
                const campaign = offer?.campaignOffer || offer || {};
                const offerCode = String(campaign.offerCode || '').trim();
                const playerOfferId = String(offer?.playerOfferId || campaign.playerOfferId || '').trim();
                if (!offerCode || !playerOfferId) return offer;
                const params = new URLSearchParams({
                    offerCode,
                    playerOfferId,
                    limit: '999',
                    page: '1',
                    sortBy: 'offer.reserveByDate',
                    sortDirection: 'asc',
                });
                try {
                    const response = await fetch(`${baseUrl}/api/casino/v2/offers/details?${params}`, {
                        method: 'GET', headers, credentials: 'include',
                    });
                    if (!response.ok) return offer;
                    const detailData = await this.readJson(response, `Offer ${offerCode}`);
                    let detailCampaign = null;
                    if (Array.isArray(detailData?.offers) && detailData.offers.length) {
                        const match = detailData.offers.find((item) => String((item.campaignOffer || item)?.offerCode || '').trim() === offerCode) || detailData.offers[0];
                        detailCampaign = match.campaignOffer || match;
                    } else if (detailData?.campaignOffer) detailCampaign = detailData.campaignOffer;
                    else if (detailData?.sailings || detailData?.offerCode) detailCampaign = detailData;
                    return detailCampaign ? { ...offer, campaignOffer: { ...campaign, ...detailCampaign } } : offer;
                } catch (error) {
                    console.warn('[apiClient] Offer details failed', offerCode, error);
                    return offer;
                }
            }));

            const data = { ...(listData && typeof listData === 'object' && !Array.isArray(listData) ? listData : {}), offers };
            const normalizedData = App.Utils.normalizeOffers(data);
            try { normalizedData.savedAt = Date.now(); } catch (_) {}
            App.TableRenderer.displayTable(normalizedData);
        } catch (error) {
            console.warn('[apiClient] Current Club Royale flow failed', error);
            if (retryCount > 0 && !/session expired/i.test(String(error?.message || ''))) {
                setTimeout(() => this.fetchOffers(retryCount - 1), 2000);
            } else {
                App.ErrorHandler.showError(`Failed to load offers: ${error.message}. Please log in again or retry.`);
                App.ErrorHandler.closeModalIfOpen();
            }
        } finally {
            App.Spinner.hideSpinner();
        }
    },
};
