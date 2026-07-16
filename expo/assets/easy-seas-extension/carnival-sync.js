(function(global) {
  'use strict';

  if (global.EasySeasCarnivalSync) return;

  var REASON = 'Legacy Carnival extension sync is disabled. Use the authenticated Easy Seas mobile sync engine or import an existing Carnival CSV export.';

  function getOfferItems(data) {
    if (!data) return [];
    if (Array.isArray(data.Items)) return data.Items;
    if (data.raw && Array.isArray(data.raw.Items)) return data.raw.Items;
    if (data.data && Array.isArray(data.data.Items)) return data.data.Items;
    if (Array.isArray(data.offers)) return data.offers;
    return [];
  }

  global.EasySeasCarnivalSync = {
    version: '12.4.2-deprecated',
    disabled: true,
    deprecationReason: REASON,
    getOfferItems: getOfferItems,
    getOfferCount: function(data) { return getOfferItems(data).length; },
    parseTgo: function() { return []; },
    discoverCatalog: function() {
      return { rateCodes: [], offers: [], actionCards: [], noOffersConfirmed: false, disabled: true, error: REASON };
    },
    buildSearchUrl: function() { throw new Error(REASON); },
    scrapeAllOffers: async function() {
      return { offers: [], rows: [], failures: [{ code: 'EXTENSION_DISABLED', error: REASON }], disabled: true };
    },
    parseProfileDocument: function() {
      return { bookings: [], completedCruises: [], profile: {}, disabled: true, error: REASON };
    },
    mergeBookings: function(existingData) {
      if (Array.isArray(existingData)) return existingData.slice();
      if (existingData && Array.isArray(existingData.bookings)) return existingData.bookings.slice();
      return [];
    }
  };
})(window);
