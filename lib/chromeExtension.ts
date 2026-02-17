import JSZip from 'jszip';
import { Platform } from 'react-native';

const SCRAPER_EXTENSION_VERSION = '6.0.0';
const GRID_BUILDER_EXTENSION_VERSION = '2.0';

const EMBEDDED_FILES: Record<string, string> = {
  'manifest.json': JSON.stringify({
    "manifest_version": 3,
    "name": "Easy Seas\u2122 \u2014 Sync Extension",
    "version": "6.0.0",
    "description": "Syncs casino offers, booked cruises, and loyalty data from Royal Caribbean & Celebrity Cruises websites. Mirrors the in-app sync functionality.",
    "permissions": [
      "downloads"
    ],
    "content_scripts": [
      {
        "matches": [
          "https://www.celebritycruises.com/*",
          "https://www.royalcaribbean.com/*"
        ],
        "js": [
          "app.js",
          "network-monitor.js",
          "sync-engine.js",
          "integration.js",
          "styles.js"
        ],
        "run_at": "document_start"
      }
    ],
    "icons": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "web_accessible_resources": [
      {
        "resources": [
          "*.png",
          "*.svg",
          "icons/*"
        ],
        "matches": [
          "<all_urls>"
        ]
      }
    ]
  }, null, 2),
  
  'app.js': `(function(){
  window.EasySeas = window.EasySeas || {};
  EasySeas.version = "6.0.0";
  EasySeas.capturedData = {
    offers: null,
    bookedCruises: [],
    loyaltyData: null,
    logs: []
  };
  EasySeas.log = function(msg, type) {
    var entry = { time: new Date().toLocaleTimeString(), message: msg, type: type || 'info' };
    EasySeas.capturedData.logs.push(entry);
    console.log('[EasySeas] ' + msg);
  };
})();`,

  'styles.js': getSyncExtensionStyles(),
  
  'tableBuilder.js': `(function(){window.EasySeas=window.EasySeas||{};EasySeas.TableBuilder={};})();`,
  
  'tableRenderer.js': `(function(){window.EasySeas=window.EasySeas||{};EasySeas.TableRenderer={};})();`,
};

export async function downloadScraperExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Creating Scraper extension ZIP from embedded files...');
    const zip = new JSZip();

    for (const [filename, content] of Object.entries(EMBEDDED_FILES)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] ✓ Added ${filename}`);
    }

    const networkMonitor = await getModalContent();
    zip.file('network-monitor.js', networkMonitor);
    console.log('[ChromeExtension] ✓ Added network-monitor.js');

    const syncEngine = await getScraperContent();
    zip.file('sync-engine.js', syncEngine);
    console.log('[ChromeExtension] ✓ Added sync-engine.js');

    zip.file('integration.js', getSyncIntegrationContent());
    console.log('[ChromeExtension] ✓ Added integration.js');

    const iconsFolder = zip.folder('icons');
    if (iconsFolder) {
      const placeholderIcon = createPlaceholderIcon('ES', '#5a2ea6');
      iconsFolder.file('icon16.png', placeholderIcon);
      iconsFolder.file('icon48.png', placeholderIcon);
      iconsFolder.file('icon128.png', placeholderIcon);
      console.log('[ChromeExtension] ✓ Added placeholder icons');
    }

    const fileCount = Object.keys(zip.files).length;
    console.log(`[ChromeExtension] Generating Scraper ZIP blob with ${fileCount} files...`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Easy Seas Sync.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ChromeExtension] Scraper extension download initiated successfully');
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating Scraper ZIP:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function downloadGridBuilderExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Creating Grid Builder extension ZIP...');
    const zip = new JSZip();

    const gridBuilderFiles = getGridBuilderFiles();
    for (const [filename, content] of Object.entries(gridBuilderFiles)) {
      zip.file(filename, content);
      console.log(`[ChromeExtension] ✓ Added ${filename}`);
    }

    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      const icon = createPlaceholderIcon('CR', '#1e40af');
      imagesFolder.file('percex-48.png', icon);
      imagesFolder.file('percex-128.png', icon);
      imagesFolder.file('percex-256.png', icon);
      imagesFolder.file('percex-512.png', icon);
      imagesFolder.file('percex-1024.png', icon);
      imagesFolder.file('facebook.png', createPlaceholderIcon('FB', '#1877f2'));
      imagesFolder.file('venmo.png', createPlaceholderIcon('V', '#3d95ce'));
      imagesFolder.file('link.png', createPlaceholderIcon('🔗', '#666666'));
      imagesFolder.file('link_off.png', createPlaceholderIcon('⛓', '#999999'));
      imagesFolder.file('royal-16.png', icon);
      console.log('[ChromeExtension] ✓ Added Grid Builder icons');
    }

    const stylesFolder = zip.folder('styles');
    if (stylesFolder) {
      const styles = getGridBuilderStyles();
      for (const [filename, content] of Object.entries(styles)) {
        stylesFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added styles/${filename}`);
      }
    }

    const utilsFolder = zip.folder('utils');
    if (utilsFolder) {
      const utils = getGridBuilderUtils();
      for (const [filename, content] of Object.entries(utils)) {
        utilsFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added utils/${filename}`);
      }
    }

    const featuresFolder = zip.folder('features');
    if (featuresFolder) {
      const features = getGridBuilderFeatures();
      for (const [filename, content] of Object.entries(features)) {
        featuresFolder.file(filename, content);
        console.log(`[ChromeExtension] ✓ Added features/${filename}`);
      }
    }

    const fileCount = Object.keys(zip.files).length;
    console.log(`[ChromeExtension] Generating Grid Builder ZIP blob with ${fileCount} files...`);
    const blob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EasySeas_Grid_Builder_Extension_v${GRID_BUILDER_EXTENSION_VERSION}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[ChromeExtension] Grid Builder extension download initiated successfully');
    return { success: true, filesAdded: fileCount };
  } catch (error) {
    console.error('[ChromeExtension] Error creating Grid Builder ZIP:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function downloadChromeExtension(): Promise<{ success: boolean; error?: string; filesAdded?: number; scraperResult?: { success: boolean; filesAdded?: number }; gridBuilderResult?: { success: boolean; filesAdded?: number } }> {
  if (Platform.OS !== 'web') {
    console.log('[ChromeExtension] Download only available on web');
    return { success: false, error: 'Download only available on web browser' };
  }

  try {
    console.log('[ChromeExtension] Downloading both extensions...');
    
    const scraperResult = await downloadScraperExtension();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const gridBuilderResult = await downloadGridBuilderExtension();
    
    const totalFiles = (scraperResult.filesAdded || 0) + (gridBuilderResult.filesAdded || 0);
    const success = scraperResult.success && gridBuilderResult.success;
    
    console.log('[ChromeExtension] Both extensions download completed', { scraperResult, gridBuilderResult });
    
    return { 
      success, 
      filesAdded: totalFiles,
      scraperResult: { success: scraperResult.success, filesAdded: scraperResult.filesAdded },
      gridBuilderResult: { success: gridBuilderResult.success, filesAdded: gridBuilderResult.filesAdded }
    };
  } catch (error) {
    console.error('[ChromeExtension] Error downloading extensions:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

async function getScraperContent(): Promise<string> {
  return getSyncEngineContent();
}

async function getModalContent(): Promise<string> {
  return getNetworkMonitorContent();
}

function createPlaceholderIcon(text: string = 'ES', bgColor: string = '#5a2ea6'): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
  }
  
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getGridBuilderFiles(): Record<string, string> {
  return {
    'manifest.json': JSON.stringify({
      "browser_specific_settings": {
        "gecko": {
          "id": "club-royale-offers@percex.local",
          "strict_min_version": "102.0"
        }
      },
      "content_scripts": [{
        "css": ["styles/tailwind.min.css", "styles/table-base.css", "styles/table-columns.css", "styles/accordion.css", "styles/ui.css", "styles/tabs-badges.css", "styles/itinerary.css", "styles/advanced-search.css"],
        "js": ["safari-polyfill.js", "utils/consoleShim.js", "utils/roomCategory.js", "utils/utils_core.js", "utils/utils_row.js", "utils/domUtils.js", "utils/errorHandler.js", "utils/sortUtils.js", "utils/b2bUtils.js", "utils/utils_filter.js", "utils/apiClient.js", "features/storageShim.js", "features/itinerary.js", "features/advancedItinerarySearch.js", "features/profileIdManager.js", "features/buttonManager.js", "features/spinner.js", "features/accordionBuilder.js", "features/favorites.js", "features/offerCodeLookup.js", "features/filtering.js", "features/whatsNew.js", "features/settings.js", "features/advancedSearch.js", "features/advancedSearchAddField.js", "features/backToBackTool.js", "features/breadcrumbs.js", "styles.js", "modal.js", "tableBuilder.js", "tableRenderer.js", "app.js"],
        "matches": ["https://*.royalcaribbean.com/club-royale/*", "https://*.celebritycruises.com/blue-chip-club/*"],
        "run_at": "document_start"
      }],
      "description": "View Royal Caribbean & Celebrity comp offers in a sortable, groupable table and accordion.",
      "host_permissions": ["https://www.royalcaribbean.com/*", "https://www.celebritycruises.com/*", "https://royalcaribbean.com/*", "https://celebritycruises.com/*"],
      "icons": {
        "1024": "images/percex-1024.png",
        "128": "images/percex-128.png",
        "256": "images/percex-256.png",
        "48": "images/percex-48.png",
        "512": "images/percex-512.png"
      },
      "manifest_version": 3,
      "name": "Club Royale & Blue Chip Offers",
      "permissions": ["storage"],
      "short_name": "Club Royale Offers",
      "version": "2.0",
      "web_accessible_resources": [{
        "matches": ["<all_urls>"],
        "resources": ["images/*", "styles/*"]
      }]
    }, null, 2),
    
    'safari-polyfill.js': `// Safari polyfill for Chrome extension APIs
(function() {
  if (typeof chrome === 'undefined') {
    window.chrome = { runtime: { getURL: (path) => path } };
  }
})();`,
    
    'styles.js': `// styles.js - Grid Builder button styling
(function(){
  const css = \`
    .gobo-show-all-btn {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 70px;
      padding: 10px 14px; background: #1e40af; color: #fff; border: none; border-radius: 12px;
      font-weight: 600; box-shadow: 0 6px 18px rgba(0,0,0,.25); cursor: pointer;
    }
    .gobo-show-all-btn:hover { background: #1e3a8a; }
    .gobo-show-all-btn:active { transform: translateY(1px); }
  \`;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);
})();`,
    
    'modal.js': getGridBuilderModalContent(),
    'tableBuilder.js': getGridBuilderTableBuilderContent(),
    'tableRenderer.js': getGridBuilderTableRendererContent(),
    'app.js': getGridBuilderAppContent()
  };
}

function getGridBuilderStyles(): Record<string, string> {
  return {
    'tailwind.min.css': '/* Tailwind CSS minimal reset */\n* { box-sizing: border-box; margin: 0; padding: 0; }\n.fixed { position: fixed; }\n.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }\n.z-50 { z-index: 50; }\n.flex { display: flex; }\n.hidden { display: none; }\n.w-full { width: 100%; }\n.border { border: 1px solid #e5e7eb; }\n.border-collapse { border-collapse: collapse; }\n.table-auto { table-layout: auto; }\n.p-2 { padding: 0.5rem; }\n.text-left { text-align: left; }\n.text-center { text-align: center; }\n.font-semibold { font-weight: 600; }\n.cursor-pointer { cursor: pointer; }\n.bg-black { background-color: #000; }\n.bg-opacity-50 { opacity: 0.5; }\n.bg-white { background-color: #fff; }\n.rounded { border-radius: 0.25rem; }\n.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }',
    'table-base.css': '/* Table base styles */\n.gobo-offers-table { width: 100%; border-collapse: collapse; font-size: 13px; }\n.gobo-offers-table th, .gobo-offers-table td { padding: 8px 12px; border: 1px solid #e5e7eb; text-align: left; }\n.gobo-offers-table th { background: #f9fafb; font-weight: 600; position: sticky; top: 0; z-index: 10; }\n.gobo-offers-table tr:hover { background: #f3f4f6; }\n.table-scroll-container { max-height: 80vh; overflow-y: auto; background: #fff; border-radius: 8px; padding: 16px; }',
    'table-columns.css': '/* Column-specific styles */\n.col-ship { min-width: 120px; }\n.col-date { min-width: 100px; }\n.col-code { min-width: 80px; }\n.col-value { min-width: 80px; text-align: right; }',
    'accordion.css': '/* Accordion styles */\n.accordion-header { padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }\n.accordion-header:hover { background: #f3f4f6; }\n.accordion-content { display: none; padding: 0; }\n.accordion-content.open { display: block; }\n.accordion-arrow { transition: transform 0.2s; }\n.accordion-content.open + .accordion-arrow { transform: rotate(90deg); }',
    'ui.css': '/* UI elements */\n.close-button, .export-csv-button { padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; margin: 4px; }\n.close-button { background: #ef4444; color: white; border: none; }\n.close-button:hover { background: #dc2626; }\n.export-csv-button { background: #10b981; color: white; border: none; }\n.export-csv-button:hover { background: #059669; }\n.table-footer-container { display: flex; justify-content: center; gap: 8px; padding: 12px; border-top: 1px solid #e5e7eb; }',
    'tabs-badges.css': '/* Profile tabs */\n.profile-tab { padding: 8px 16px; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 8px 8px 0 0; cursor: pointer; background: #f9fafb; }\n.profile-tab.active { background: #fff; border-bottom: 1px solid #fff; margin-bottom: -1px; font-weight: 600; }\n.profile-tabs-container { display: flex; gap: 4px; padding: 0 16px; }',
    'itinerary.css': '/* Itinerary links */\n.gobo-itinerary-link { color: #2563eb; text-decoration: none; }\n.gobo-itinerary-link:hover { text-decoration: underline; }',
    'advanced-search.css': '/* Advanced search */\n.advanced-search-container { padding: 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; }\n.search-input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; width: 200px; }'
  };
}

function getGridBuilderUtils(): Record<string, string> {
  return {
    'consoleShim.js': '// Console shim\nif (!window.console) window.console = { log: function(){}, debug: function(){}, warn: function(){}, error: function(){} };',
    'roomCategory.js': '// Room category utilities\nconst RoomCategory = { parse: (s) => s || "Unknown", isGTY: (s) => /GTY/i.test(s || "") };',
    'utils_core.js': getUtilsCoreContent(),
    'utils_row.js': '// Row utilities\nconst RowUtils = { getRowId: (row) => row?.sailing?.sailDate + "_" + row?.sailing?.shipCode };',
    'domUtils.js': getDomUtilsContent(),
    'errorHandler.js': '// Error handler\nconst ErrorHandler = { showError: (msg) => { console.error(msg); alert(msg); } };',
    'sortUtils.js': getSortUtilsContent(),
    'b2bUtils.js': '// B2B utilities placeholder\nconst B2BUtils = { computeB2BDepth: () => new Map() };',
    'utils_filter.js': '// Filter utilities\nconst FilterUtils = { applyFilters: (offers, filters) => offers };',
    'apiClient.js': '// API client\nconst ApiClient = { fetch: async (url) => fetch(url).then(r => r.json()) };'
  };
}

function getGridBuilderFeatures(): Record<string, string> {
  return {
    'storageShim.js': getStorageShimContent(),
    'itinerary.js': '// Itinerary cache\nconst ItineraryCache = { all: () => ({}), hydrateIfNeeded: async () => {}, showModal: () => {} };',
    'advancedItinerarySearch.js': '// Advanced itinerary search\nconst AdvancedItinerarySearch = { init: () => {} };',
    'profileIdManager.js': getProfileIdManagerContent(),
    'buttonManager.js': getButtonManagerContent(),
    'spinner.js': '// Spinner\nconst Spinner = { showSpinner: () => {}, hideSpinner: () => {} };',
    'accordionBuilder.js': getAccordionBuilderContent(),
    'favorites.js': '// Favorites\nconst Favorites = { toggle: () => {}, isFavorite: () => false };',
    'offerCodeLookup.js': '// Offer code lookup\nconst OfferCodeLookup = { lookup: () => null };',
    'filtering.js': getFilteringContent(),
    'whatsNew.js': '// What\'s New\nconst WhatsNew = { start: () => {} };',
    'settings.js': '// Settings\nconst Settings = { get: () => ({}), set: () => {} };',
    'advancedSearch.js': '// Advanced search\nconst AdvancedSearch = { init: () => {}, apply: () => {} };',
    'advancedSearchAddField.js': '// Advanced search add field\nconst AdvancedSearchAddField = { init: () => {} };',
    'backToBackTool.js': '// Back to back tool\nconst BackToBackTool = { registerEnvironment: () => {}, attachToCell: () => {} };',
    'breadcrumbs.js': getBreadcrumbsContent()
  };
}

function getUtilsCoreContent(): string {
  return `// Core utilities
const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  parseItinerary(itinerary) {
    const match = (itinerary || '').match(/(\\d+)[- ]?[Nn]ight\\s*(.*)/);
    return { nights: match ? match[1] : '', destination: match ? match[2] : itinerary || '' };
  },
  computePerks(offer, sailing) {
    const perks = [];
    if (sailing?.isGOBO) perks.push('GOBO');
    if (sailing?.isFREEPLAY) perks.push('FP');
    if (sailing?.isDOLLARSOFF) perks.push('$OFF');
    return perks.join(', ') || '-';
  },
  getShipClass(shipName) {
    const n = (shipName || '').toLowerCase();
    if (/(icon|star)/.test(n)) return 'Icon';
    if (/oasis|allure|harmony|symphony|wonder|utopia/.test(n)) return 'Oasis';
    if (/quantum|anthem|ovation|odyssey/.test(n)) return 'Quantum';
    if (/freedom|liberty|independence/.test(n)) return 'Freedom';
    if (/voyager|navigator|explorer|adventure|mariner/.test(n)) return 'Voyager';
    return 'Other';
  },
  computeOfferValue(offer, sailing) {
    let value = 0;
    const trade = offer?.campaignOffer?.tradeInValue;
    if (trade && typeof trade === 'number') value += trade;
    if (sailing?.isFREEPLAY && sailing?.FREEPLAY_AMT) value += sailing.FREEPLAY_AMT;
    if (sailing?.isDOLLARSOFF && sailing?.DOLLARSOFF_AMT) value += sailing.DOLLARSOFF_AMT;
    return value;
  },
  formatOfferValue(value) {
    if (value == null || isNaN(value)) return '-';
    return '
 + value.toLocaleString();
  },
  createOfferRow(pair, isNewest, isExpiringSoon, idx) {
    const { offer, sailing } = pair;
    const tr = document.createElement('tr');
    tr.dataset.b2bRowId = sailing?.__b2bRowId || (sailing?.sailDate + '_' + sailing?.shipCode);
    if (isNewest) tr.classList.add('newest-offer-row');
    if (isExpiringSoon) tr.classList.add('expiring-soon-row');
    const cells = [
      '<td class="fav-cell">★</td>',
      '<td class="b2b-depth-cell">1</td>',
      '<td>' + (offer?.campaignOffer?.offerCode || '-') + '</td>',
      '<td>' + this.formatDate(offer?.campaignOffer?.startDate) + '</td>',
      '<td>' + this.formatDate(offer?.campaignOffer?.reserveByDate) + '</td>',
      '<td>' + (offer?.campaignOffer?.tradeInValue ? '
 + offer.campaignOffer.tradeInValue : '-') + '</td>',
      '<td>' + this.formatOfferValue(this.computeOfferValue(offer, sailing)) + '</td>',
      '<td>' + (offer?.campaignOffer?.name || '-') + '</td>',
      '<td>' + this.getShipClass(sailing?.shipName) + '</td>',
      '<td>' + (sailing?.shipName || '-') + '</td>',
      '<td>' + this.formatDate(sailing?.sailDate) + '</td>',
      '<td>' + (sailing?.departurePort?.name || '-') + '</td>',
      '<td>' + (this.parseItinerary(sailing?.itineraryDescription).nights || '-') + '</td>',
      '<td id="SD_' + (sailing?.shipCode || '') + '_' + (sailing?.sailDate || '').slice(0,10) + '">' + (this.parseItinerary(sailing?.itineraryDescription).destination || '-') + '</td>',
      '<td>' + (sailing?.roomType || '-') + '</td>',
      '<td>' + (sailing?.isGOBO ? '1 Guest' : '2 Guests') + '</td>',
      '<td>' + this.computePerks(offer, sailing) + '</td>'
    ];
    tr.innerHTML = cells.join('');
    return tr;
  }
};
function preserveSelectedProfileKey(state, lastState) {
  if (!state.selectedProfileKey && lastState?.selectedProfileKey) {
    state.selectedProfileKey = lastState.selectedProfileKey;
  }
  return state;
}`;
}

function getDomUtilsContent(): string {
  return `// DOM utilities
const DOMUtils = {
  waitForDom() {
    const check = () => {
      const offers = document.querySelector('[data-testid="offers-container"], .offers-list, [class*="offer"]');
      if (offers || document.readyState === 'complete') {
        setTimeout(() => ButtonManager.init(), 500);
      } else {
        setTimeout(check, 300);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', check);
    } else {
      check();
    }
  }
};`;
}

function getSortUtilsContent(): string {
  return `// Sort utilities
const SortUtils = {
  sortOffers(offers, column, order) {
    if (order === 'original') return [...offers];
    return [...offers].sort((a, b) => {
      let aVal, bVal;
      switch(column) {
        case 'sailDate':
          aVal = new Date(a.sailing?.sailDate || 0).getTime();
          bVal = new Date(b.sailing?.sailDate || 0).getTime();
          break;
        case 'offerDate':
          aVal = new Date(a.offer?.campaignOffer?.startDate || 0).getTime();
          bVal = new Date(b.offer?.campaignOffer?.startDate || 0).getTime();
          break;
        case 'expiration':
          aVal = new Date(a.offer?.campaignOffer?.reserveByDate || 0).getTime();
          bVal = new Date(b.offer?.campaignOffer?.reserveByDate || 0).getTime();
          break;
        case 'ship':
          aVal = a.sailing?.shipName || '';
          bVal = b.sailing?.shipName || '';
          break;
        case 'tradeInValue':
          aVal = a.offer?.campaignOffer?.tradeInValue || 0;
          bVal = b.offer?.campaignOffer?.tradeInValue || 0;
          break;
        case 'b2bDepth':
          aVal = a.sailing?.__b2bDepth || 1;
          bVal = b.sailing?.__b2bDepth || 1;
          break;
        default:
          aVal = a.offer?.campaignOffer?.[column] || '';
          bVal = b.offer?.campaignOffer?.[column] || '';
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return order === 'asc' ? cmp : -cmp;
      }
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }
};`;
}

function getStorageShimContent(): string {
  return `// Storage shim for cross-browser compatibility
(function() {
  const PREFIX = 'gobo_';
  window.goboStorageGet = function(key) {
    try { return localStorage.getItem(PREFIX + key); } catch(e) { return null; }
  };
  window.goboStorageSet = function(key, value) {
    try { localStorage.setItem(PREFIX + key, value); } catch(e) {}
  };
  window.goboStorageRemove = function(key) {
    try { localStorage.removeItem(PREFIX + key); } catch(e) {}
  };
})();`;
}

function getProfileIdManagerContent(): string {
  return `// Profile ID Manager
const ProfileIdManager = {
  map: {},
  nextId: 1,
  getId(key) { return this.map[key]; },
  assignMissingIds(keys) {
    keys.forEach(k => {
      if (!this.map[k]) this.map[k] = this.nextId++;
    });
  },
  transferId(oldKey, newKey) {
    if (this.map[oldKey]) {
      this.map[newKey] = this.map[oldKey];
      delete this.map[oldKey];
    }
  }
};`;
}

function getButtonManagerContent(): string {
  return `// Button Manager - creates the "Show All Offers" button
const ButtonManager = {
  init() {
    if (document.getElementById('gobo-show-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gobo-show-all-btn';
    btn.className = 'gobo-show-all-btn';
    btn.textContent = 'Show All Offers';
    btn.addEventListener('click', () => this.handleShowAll());
    document.body.appendChild(btn);
    console.log('[GridBuilder] Show All Offers button added');
  },
  async handleShowAll() {
    try {
      Spinner.showSpinner();
      const sessionRaw = localStorage.getItem('persist:session');
      if (!sessionRaw) {
        ErrorHandler.showError('Please log in to view offers');
        return;
      }
      const session = JSON.parse(sessionRaw);
      const user = session.user ? JSON.parse(session.user) : null;
      const offers = session.offers ? JSON.parse(session.offers) : null;
      if (!offers || !offers.length) {
        ErrorHandler.showError('No offers found. Please refresh the page.');
        return;
      }
      const username = user?.username || user?.email || 'user';
      const key = 'gobo-' + username.replace(/[^a-zA-Z0-9]/g, '_');
      App.TableRenderer.displayTable({ offers }, key, []);
    } catch(e) {
      console.error('[GridBuilder] Error showing offers:', e);
      ErrorHandler.showError('Failed to load offers: ' + e.message);
    } finally {
      Spinner.hideSpinner();
    }
  }
};`;
}

function getAccordionBuilderContent(): string {
  return `// Accordion Builder
const AccordionBuilder = {
  createGroupedData(offers, groupColumn) {
    const groups = {};
    offers.forEach(row => {
      let key;
      switch(groupColumn) {
        case 'ship': key = row.sailing?.shipName || 'Unknown'; break;
        case 'offerCode': key = row.offer?.campaignOffer?.offerCode || 'Unknown'; break;
        case 'destination': key = Utils.parseItinerary(row.sailing?.itineraryDescription).destination || 'Unknown'; break;
        default: key = 'All';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  },
  renderAccordion(container, groupedData, sortStates, state, groupingStack, keysStack, maxOfferDate) {
    container.innerHTML = '';
    Object.entries(groupedData).forEach(([key, rows]) => {
      const header = document.createElement('div');
      header.className = 'accordion-header';
      header.innerHTML = '<span>' + key + ' (' + rows.length + ')</span><span class="accordion-arrow">▶</span>';
      const content = document.createElement('div');
      content.className = 'accordion-content';
      content.dataset.groupKey = key;
      const table = document.createElement('table');
      table.className = 'accordion-table gobo-offers-table';
      table.dataset.groupKey = key;
      const tbody = document.createElement('tbody');
      rows.forEach((row, idx) => {
        const tr = Utils.createOfferRow(row, false, false, idx);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      content.appendChild(table);
      header.addEventListener('click', () => content.classList.toggle('open'));
      container.appendChild(header);
      container.appendChild(content);
    });
  }
};`;
}

function getFilteringContent(): string {
  return `// Filtering
const Filtering = {
  filterOffers(state, offers) {
    let filtered = [...offers];
    if (state.hideTierSailings) {
      filtered = filtered.filter(row => {
        const code = row.offer?.campaignOffer?.offerCode || '';
        return !/TIER/i.test(code);
      });
    }
    return filtered;
  },
  wasRowHidden(row, state) {
    if (state.hideTierSailings) {
      const code = row.offer?.campaignOffer?.offerCode || '';
      if (/TIER/i.test(code)) return true;
    }
    return false;
  },
  isRowHidden(row, state) { return this.wasRowHidden(row, state); },
  loadHiddenGroups() { return []; }
};`;
}

function getBreadcrumbsContent(): string {
  return `// Breadcrumbs
const Breadcrumbs = {
  updateBreadcrumb(groupingStack, groupKeysStack) {
    const container = document.querySelector('.breadcrumb-container');
    if (!container) return;
    const arrow = container.querySelector('.breadcrumb-arrow');
    const title = container.querySelector('.group-title');
    if (groupKeysStack && groupKeysStack.length) {
      if (arrow) arrow.style.display = '';
      if (title) title.textContent = groupKeysStack.join(' > ');
    } else {
      if (arrow) arrow.style.display = 'none';
      if (title) title.textContent = '';
    }
  }
};`;
}

function getGridBuilderModalContent(): string {
  return `// Modal for Grid Builder
const Modal = {
  createModalContainer() {
    const container = document.createElement('div');
    container.id = 'gobo-offers-table';
    container.className = 'fixed inset-0 m-auto z-[2147483647]';
    container.style.cssText = 'background: white; max-width: 95vw; max-height: 90vh; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;';
    return container;
  },
  createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.id = 'gobo-backdrop';
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-[2147483646]';
    backdrop.style.cssText = 'pointer-events: auto !important;';
    return backdrop;
  },
  setupModal(state, overlappingElements) {
    const { container, backdrop, table, tbody, accordionContainer, backButton } = state;
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'table-scroll-container';
    const footerContainer = document.createElement('div');
    footerContainer.className = 'table-footer-container';
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => this.closeModal(container, backdrop, overlappingElements));
    const exportButton = document.createElement('button');
    exportButton.className = 'export-csv-button';
    exportButton.textContent = 'CSV Export';
    exportButton.addEventListener('click', () => this.exportToCSV(App.TableRenderer.lastState));
    const breadcrumbContainer = document.createElement('div');
    breadcrumbContainer.className = 'breadcrumb-container';
    breadcrumbContainer.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const allOffersLink = document.createElement('span');
    allOffersLink.className = 'breadcrumb-link';
    allOffersLink.textContent = 'All Offers';
    allOffersLink.style.cssText = 'cursor: pointer; color: #2563eb;';
    allOffersLink.addEventListener('click', backButton.onclick);
    const arrow = document.createElement('span');
    arrow.className = 'breadcrumb-arrow';
    arrow.textContent = '>';
    arrow.style.display = 'none';
    const groupTitle = document.createElement('span');
    groupTitle.id = 'group-title';
    groupTitle.className = 'group-title';
    breadcrumbContainer.appendChild(allOffersLink);
    breadcrumbContainer.appendChild(arrow);
    breadcrumbContainer.appendChild(groupTitle);
    backdrop.addEventListener('click', () => this.closeModal(container, backdrop, overlappingElements));
    this._container = container;
    this._backdrop = backdrop;
    this._overlappingElements = overlappingElements;
    this._escapeHandler = (e) => { if (e.key === 'Escape') this.closeModal(); };
    document.addEventListener('keydown', this._escapeHandler);
    table.appendChild(tbody);
    scrollContainer.appendChild(breadcrumbContainer);
    scrollContainer.appendChild(table);
    scrollContainer.appendChild(accordionContainer);
    footerContainer.appendChild(exportButton);
    footerContainer.appendChild(closeButton);
    container.appendChild(scrollContainer);
    container.appendChild(footerContainer);
    document.body.appendChild(backdrop);
    document.body.appendChild(container);
  },
  closeModal(container, backdrop, overlappingElements) {
    container = container || this._container;
    backdrop = backdrop || this._backdrop;
    overlappingElements = overlappingElements || this._overlappingElements || [];
    if (!container || !backdrop) return;
    container.remove();
    backdrop.remove();
    document.body.style.overflow = '';
    overlappingElements.forEach(el => { el.style.display = el.dataset.originalDisplay || ''; });
    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._container = null;
    this._backdrop = null;
  },
  exportToCSV(state) {
    const headers = ['Code','Rcvd','Expires','Trade','Value','Name','Class','Ship','Sail Date','Departs','Nights','Destination','Category','Guests','Perks'];
    const rows = (state.sortedOffers || []).map(({offer, sailing}) => [
      offer?.campaignOffer?.offerCode || '',
      Utils.formatDate(offer?.campaignOffer?.startDate),
      Utils.formatDate(offer?.campaignOffer?.reserveByDate),
      offer?.campaignOffer?.tradeInValue || '',
      Utils.computeOfferValue(offer, sailing),
      offer?.campaignOffer?.name || '',
      Utils.getShipClass(sailing?.shipName),
      sailing?.shipName || '',
      Utils.formatDate(sailing?.sailDate),
      sailing?.departurePort?.name || '',
      Utils.parseItinerary(sailing?.itineraryDescription).nights,
      Utils.parseItinerary(sailing?.itineraryDescription).destination,
      sailing?.roomType || '',
      sailing?.isGOBO ? '1 Guest' : '2 Guests',
      Utils.computePerks(offer, sailing)
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\r\\n');
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offers.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};`;
}

function getGridBuilderTableBuilderContent(): string {
  return `// Table Builder
const TableBuilder = {
  createMainTable() {
    const table = document.createElement('table');
    table.className = 'gobo-offers-table w-full border-collapse table-auto';
    return table;
  },
  createTableHeader(state) {
    const { headers } = state;
    const thead = document.createElement('thead');
    thead.className = 'table-header';
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.className = 'border p-2 text-left font-semibold';
      th.dataset.key = header.key;
      th.textContent = header.label;
      if (header.key !== 'favorite') {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          let newOrder = 'asc';
          if (state.currentSortColumn === header.key) {
            newOrder = state.currentSortOrder === 'asc' ? 'desc' : 'original';
          }
          state.currentSortColumn = header.key;
          state.currentSortOrder = newOrder;
          state.viewMode = 'table';
          App.TableRenderer.updateView(state);
        });
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  },
  renderTable(tbody, state, globalMaxOfferDate) {
    tbody.innerHTML = '';
    const rows = state.sortedOffers || [];
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="17" class="border p-2 text-center">No offers available</td>';
      tbody.appendChild(tr);
      return;
    }
    rows.forEach((pair, idx) => {
      const tr = Utils.createOfferRow(pair, false, false, idx);
      tbody.appendChild(tr);
    });
  }
};`;
}

function getGridBuilderTableRendererContent(): string {
  return `// Table Renderer
const TableRenderer = {
  lastState: null,
  currentSwitchToken: null,
  displayTable(data, selectedProfileKey, overlappingElements) {
    const existing = document.getElementById('gobo-offers-table');
    if (existing) { this.loadProfile(selectedProfileKey, { data }); return; }
    document.body.style.overflow = 'hidden';
    const state = {
      backdrop: App.Modal.createBackdrop(),
      container: App.Modal.createModalContainer(),
      table: App.TableBuilder.createMainTable(),
      tbody: document.createElement('tbody'),
      accordionContainer: document.createElement('div'),
      backButton: document.createElement('button'),
      headers: [
        { key: 'favorite', label: '★' },
        { key: 'b2bDepth', label: 'B2B' },
        { key: 'offerCode', label: 'Code' },
        { key: 'offerDate', label: 'Rcvd' },
        { key: 'expiration', label: 'Expires' },
        { key: 'tradeInValue', label: 'Trade' },
        { key: 'offerValue', label: 'Value' },
        { key: 'offerName', label: 'Name' },
        { key: 'shipClass', label: 'Class' },
        { key: 'ship', label: 'Ship' },
        { key: 'sailDate', label: 'Sail Date' },
        { key: 'departurePort', label: 'Departs' },
        { key: 'nights', label: 'Nights' },
        { key: 'destination', label: 'Destination' },
        { key: 'category', label: 'Category' },
        { key: 'guests', label: 'Guests' },
        { key: 'perks', label: 'Perks' }
      ],
      currentSortColumn: 'offerDate',
      currentSortOrder: 'desc',
      viewMode: 'table',
      groupingStack: [],
      groupKeysStack: [],
      selectedProfileKey,
      ...this.prepareOfferData(data)
    };
    state.fullOriginalOffers = [...state.originalOffers];
    state.accordionContainer.className = 'w-full';
    state.backButton.onclick = () => {
      state.viewMode = 'table';
      state.groupingStack = [];
      state.groupKeysStack = [];
      this.updateView(state);
    };
    state.thead = App.TableBuilder.createTableHeader(state);
    App.Modal.setupModal(state, overlappingElements || []);
    this.loadProfile(selectedProfileKey, { data });
  },
  loadProfile(key, payload) {
    const state = this.lastState || {};
    state.selectedProfileKey = key;
    const prepared = this.prepareOfferData(payload.data);
    state.originalOffers = prepared.originalOffers;
    state.sortedOffers = prepared.sortedOffers;
    state.fullOriginalOffers = [...state.originalOffers];
    this.lastState = state;
    this.updateView(state);
  },
  prepareOfferData(data) {
    const offers = data?.offers || [];
    const originalOffers = [];
    offers.forEach(offer => {
      const sailings = offer?.campaignOffer?.sailings || [];
      sailings.forEach(sailing => originalOffers.push({ offer, sailing }));
    });
    return { originalOffers, sortedOffers: [...originalOffers] };
  },
  updateView(state) {
    this.lastState = state;
    const filtered = Filtering.filterOffers(state, state.fullOriginalOffers || state.originalOffers);
    state.originalOffers = filtered;
    if (state.currentSortOrder !== 'original') {
      state.sortedOffers = SortUtils.sortOffers(filtered, state.currentSortColumn, state.currentSortOrder);
    } else {
      state.sortedOffers = [...filtered];
    }
    const { table, tbody, thead, accordionContainer, viewMode } = state;
    table.style.display = viewMode === 'table' ? 'table' : 'none';
    accordionContainer.style.display = viewMode === 'accordion' ? 'block' : 'none';
    if (viewMode === 'table') {
      App.TableBuilder.renderTable(tbody, state);
      if (!table.contains(thead)) table.appendChild(thead);
      if (!table.contains(tbody)) table.appendChild(tbody);
    } else {
      const grouped = AccordionBuilder.createGroupedData(state.sortedOffers, state.groupingStack[0] || 'ship');
      AccordionBuilder.renderAccordion(accordionContainer, grouped, {}, state, state.groupingStack, state.groupKeysStack);
    }
    Breadcrumbs.updateBreadcrumb(state.groupingStack, state.groupKeysStack);
  }
};`;
}

function getGridBuilderAppContent(): string {
  return `// Grid Builder App
(function() {
  console.debug('[GridBuilder] Extension loaded on:', window.location.href);
  window.App = {
    DOMUtils,
    Styles: {},
    ButtonManager,
    ErrorHandler,
    Spinner,
    ApiClient,
    Modal,
    TableBuilder,
    AccordionBuilder,
    SortUtils,
    TableRenderer,
    ItineraryCache,
    AdvancedItinerarySearch,
    Breadcrumbs,
    AdvancedSearch,
    AdvancedSearchAddField,
    Utils,
    OfferCodeLookup,
    Filtering,
    B2BUtils,
    BackToBackTool,
    Favorites,
    Settings,
    ProfileIdMap: {},
    ProfileCache: {},
    CurrentProfile: null,
    SettingsStore: {
      getSettings() { try { return JSON.parse(goboStorageGet('goboSettings') || '{}'); } catch(e) { return {}; } },
      setSettings(obj) { try { goboStorageSet('goboSettings', JSON.stringify(obj)); } catch(e) {} },
      getAutoRunB2B() { return true; },
      setAutoRunB2B() {},
      getIncludeSideBySide() { return true; },
      setIncludeSideBySide() {}
    },
    BackToBackAutoRun: true,
    init() { this.DOMUtils.waitForDom(); }
  };
  App.init();
})();`;
}

function getSyncExtensionStyles(): string {
  return `(function(){
  const css = \`
    #easyseas-sync-panel {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .es-sync-btn {
      padding: 12px 20px; background: #0f172a; color: #fff; border: 2px solid #3b82f6;
      border-radius: 14px; font-weight: 700; font-size: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,.3); cursor: pointer;
      display: flex; align-items: center; gap: 8px; transition: all 0.2s;
    }
    .es-sync-btn:hover { background: #1e293b; border-color: #60a5fa; transform: translateY(-1px); }
    .es-sync-btn:active { transform: translateY(1px); }
    .es-sync-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .es-sync-btn .es-icon { font-size: 18px; }
    .es-status-panel {
      position: fixed; z-index: 2147483647; right: 16px; bottom: 70px;
      width: 380px; max-height: 500px; background: #0f172a; color: #e2e8f0;
      border: 1px solid #334155; border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,.4); overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .es-status-header {
      padding: 16px; background: #1e293b; border-bottom: 1px solid #334155;
      display: flex; justify-content: space-between; align-items: center;
    }
    .es-status-title { font-size: 16px; font-weight: 700; color: #fff; }
    .es-status-close { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 8px; }
    .es-status-close:hover { color: #fff; }
    .es-status-body { padding: 16px; max-height: 300px; overflow-y: auto; }
    .es-status-body::-webkit-scrollbar { width: 6px; }
    .es-status-body::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
    .es-log-entry { padding: 4px 0; font-size: 12px; line-height: 1.4; font-family: monospace; }
    .es-log-entry.success { color: #10b981; }
    .es-log-entry.error { color: #ef4444; }
    .es-log-entry.warning { color: #f59e0b; }
    .es-log-entry.info { color: #94a3b8; }
    .es-status-footer {
      padding: 12px 16px; background: #1e293b; border-top: 1px solid #334155;
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .es-action-btn {
      flex: 1; padding: 10px 12px; border: none; border-radius: 10px;
      font-weight: 600; font-size: 13px; cursor: pointer; text-align: center;
    }
    .es-action-btn.primary { background: #3b82f6; color: #fff; }
    .es-action-btn.primary:hover { background: #2563eb; }
    .es-action-btn.success { background: #10b981; color: #fff; }
    .es-action-btn.success:hover { background: #059669; }
    .es-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .es-count-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .es-count-badge {
      flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 10px;
      padding: 10px; text-align: center;
    }
    .es-count-num { font-size: 22px; font-weight: 800; color: #fff; }
    .es-count-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  \`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();`;
}

function getNetworkMonitorContent(): string {
  return `(function(){
  window.EasySeas = window.EasySeas || {};
  EasySeas.capturedData = EasySeas.capturedData || { offers: null, bookedCruises: [], loyaltyData: null, logs: [] };

  var SHIP_CODES = {
    'AL':'Allure of the Seas','AN':'Anthem of the Seas','AD':'Adventure of the Seas',
    'BR':'Brilliance of the Seas','EN':'Enchantment of the Seas','EX':'Explorer of the Seas',
    'FR':'Freedom of the Seas','GR':'Grandeur of the Seas','HM':'Harmony of the Seas',
    'IC':'Icon of the Seas','ID':'Independence of the Seas','JW':'Jewel of the Seas',
    'LB':'Liberty of the Seas','MR':'Mariner of the Seas','NV':'Navigator of the Seas',
    'OA':'Oasis of the Seas','OV':'Ovation of the Seas','OY':'Odyssey of the Seas',
    'QN':'Quantum of the Seas','RD':'Radiance of the Seas','SE':'Serenade of the Seas',
    'SP':'Spectrum of the Seas','SY':'Symphony of the Seas','UT':'Utopia of the Seas',
    'VI':'Vision of the Seas','VY':'Voyager of the Seas','WN':'Wonder of the Seas'
  };
  var CABIN_TYPES = {'I':'Interior','O':'Ocean View','B':'Balcony','S':'Suite'};

  function resolveShip(code){ return SHIP_CODES[code] || (code ? code+' of the Seas' : 'Unknown Ship'); }
  function resolveCabin(code){ return CABIN_TYPES[code] || code || ''; }

  function processBookings(bookings, source){
    if (!bookings || !Array.isArray(bookings) || !bookings.length) return;
    var existingIds = new Set(EasySeas.capturedData.bookedCruises.map(function(c){ return c.bookingId; }).filter(Boolean));
    var added = 0;
    bookings.forEach(function(b){
      var bid = b.bookingId ? b.bookingId.toString() : '';
      if (bid && existingIds.has(bid)) return;
      existingIds.add(bid);
      EasySeas.capturedData.bookedCruises.push({
        bookingId: bid,
        shipName: b.shipName || resolveShip(b.shipCode),
        shipCode: b.shipCode || '',
        sailDate: b.sailDate || '',
        numberOfNights: b.numberOfNights || 0,
        cabinType: resolveCabin(b.stateroomType),
        cabinCategory: b.stateroomCategoryCode || '',
        stateroomNumber: b.stateroomNumber || '',
        bookingStatus: b.bookingStatus || 'BK',
        isCourtesyHold: b.bookingStatus === 'OF',
        paidInFull: b.paidInFull || false,
        passengers: b.passengers || [],
        source: source
      });
      added++;
    });
    if (added > 0) EasySeas.log('Captured ' + added + ' booking(s) from ' + source, 'success');
  }

  function extractBookingsFromPayload(data){
    if (data && data.payload && Array.isArray(data.payload.sailingInfo)) return data.payload.sailingInfo;
    if (data && data.payload && Array.isArray(data.payload.profileBookings)) return data.payload.profileBookings;
    if (data && Array.isArray(data.sailingInfo)) return data.sailingInfo;
    if (data && Array.isArray(data.profileBookings)) return data.profileBookings;
    if (Array.isArray(data)) return data;
    if (data && data.bookings && Array.isArray(data.bookings)) return data.bookings;
    return null;
  }

  var origFetch = window.fetch;
  window.fetch = function(){
    var args = arguments;
    return origFetch.apply(this, args).then(function(response){
      var url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (!url || !response.ok) return response;
      var cloned = response.clone();

      if (url.indexOf('/profileBookings/enriched') !== -1 || url.indexOf('/api/account/upcoming-cruises') !== -1 || url.indexOf('/api/profile/bookings') !== -1){
        cloned.json().then(function(data){
          var bookings = extractBookingsFromPayload(data);
          if (bookings) processBookings(bookings, 'API:' + url.split('?')[0].split('/').pop());
        }).catch(function(){});
      }

      if (url.indexOf('/guestAccounts/loyalty/info') !== -1 || url.indexOf('/en/celebrity/web/v3/guestAccounts/') !== -1){
        cloned.json().then(function(data){
          EasySeas.capturedData.loyaltyData = data;
          EasySeas.log('Captured loyalty data from API', 'success');
        }).catch(function(){});
      }

      if (url.indexOf('/api/casino/casino-offers') !== -1){
        cloned.json().then(function(data){
          EasySeas.capturedData.offers = data;
          var count = (data && data.offers) ? data.offers.length : 0;
          EasySeas.log('Captured ' + count + ' offers from Casino API', 'success');
        }).catch(function(){});
      }

      return response;
    });
  };

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url){ this._esUrl = url; return origOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){
    var xhr = this;
    xhr.addEventListener('load', function(){
      if (!xhr._esUrl) return;
      try {
        var data = JSON.parse(xhr.responseText);
        if (xhr._esUrl.indexOf('/profileBookings/enriched') !== -1 || xhr._esUrl.indexOf('/api/account/upcoming-cruises') !== -1){
          var bookings = extractBookingsFromPayload(data);
          if (bookings) processBookings(bookings, 'XHR:bookings');
        }
        if (xhr._esUrl.indexOf('/guestAccounts/loyalty') !== -1){
          EasySeas.capturedData.loyaltyData = data;
          EasySeas.log('Captured loyalty data (XHR)', 'success');
        }
        if (xhr._esUrl.indexOf('/api/casino/casino-offers') !== -1){
          EasySeas.capturedData.offers = data;
          EasySeas.log('Captured offers (XHR)', 'success');
        }
      } catch(e){}
    });
    return origSend.apply(this, arguments);
  };

  EasySeas.log('Network monitor active - capturing API payloads', 'info');
})();`;
}

function getSyncEngineContent(): string {
  return `(function(){
  window.EasySeas = window.EasySeas || {};

  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function getAuthContext(){
    var raw = localStorage.getItem('persist:session');
    if (!raw) throw new Error('No session data. Please log in first.');
    var session = JSON.parse(raw);
    var token = session.token ? JSON.parse(session.token) : null;
    var user = session.user ? JSON.parse(session.user) : null;
    if (!token || !user || !user.accountId) throw new Error('Invalid session. Please log in again.');
    var auth = token.toString ? token.toString() : '';
    if (auth && !auth.startsWith('Bearer ')) auth = 'Bearer ' + auth;
    var isCelebrity = location.hostname.indexOf('celebritycruises.com') !== -1;
    return {
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'account-id': user.accountId,
        'authorization': auth,
        'content-type': 'application/json'
      },
      accountId: user.accountId,
      loyaltyId: user.cruiseLoyaltyId || '',
      isCelebrity: isCelebrity,
      brandCode: isCelebrity ? 'C' : 'R',
      baseUrl: isCelebrity ? 'https://www.celebritycruises.com' : 'https://www.royalcaribbean.com'
    };
  }

  async function fetchOffers(ctx){
    EasySeas.log('Fetching casino offers via API...', 'info');
    var endpoint = ctx.baseUrl + (ctx.brandCode === 'C' ? '/api/casino/casino-offers/v2' : '/api/casino/casino-offers/v1');
    var body = { cruiseLoyaltyId: ctx.loyaltyId, offerCode: '', brand: ctx.brandCode };
    var res = await fetch(endpoint, { method: 'POST', headers: ctx.headers, credentials: 'omit', body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Offers API error: ' + res.status);
    var data = await res.json();
    EasySeas.capturedData.offers = data;
    var count = (data && data.offers) ? data.offers.length : 0;
    EasySeas.log('Fetched ' + count + ' casino offers', 'success');
    return data;
  }

  async function fetchBookings(ctx){
    EasySeas.log('Fetching booked cruises via API...', 'info');
    var endpoint = ctx.baseUrl + '/api/account/upcoming-cruises';
    try {
      var res = await fetch(endpoint, { method: 'GET', headers: ctx.headers, credentials: 'omit' });
      if (res.ok) {
        var data = await res.json();
        var bookings = null;
        if (data && data.payload && Array.isArray(data.payload.sailingInfo)) bookings = data.payload.sailingInfo;
        else if (data && data.payload && Array.isArray(data.payload.profileBookings)) bookings = data.payload.profileBookings;
        else if (Array.isArray(data)) bookings = data;
        if (bookings && bookings.length > 0){
          EasySeas.log('Fetched ' + bookings.length + ' bookings from API', 'success');
          return bookings;
        }
      }
    } catch(e){ EasySeas.log('Direct booking fetch failed: ' + e.message, 'warning'); }

    EasySeas.log('Trying enriched bookings endpoint...', 'info');
    try {
      var enrichedUrl = 'https://aws-prd.api.rccl.com/en/' + (ctx.brandCode === 'C' ? 'celebrity' : 'royal') + '/web/v1/profileBookings/enriched';
      var res2 = await fetch(enrichedUrl, { method: 'GET', headers: ctx.headers, credentials: 'omit' });
      if (res2.ok){
        var data2 = await res2.json();
        var bk = null;
        if (data2 && data2.payload && Array.isArray(data2.payload.sailingInfo)) bk = data2.payload.sailingInfo;
        else if (Array.isArray(data2)) bk = data2;
        if (bk && bk.length > 0){
          EasySeas.log('Fetched ' + bk.length + ' enriched bookings', 'success');
          return bk;
        }
      }
    } catch(e2){ EasySeas.log('Enriched booking fetch failed: ' + e2.message, 'warning'); }

    if (EasySeas.capturedData.bookedCruises.length > 0){
      EasySeas.log('Using ' + EasySeas.capturedData.bookedCruises.length + ' bookings from network capture', 'info');
      return null;
    }
    EasySeas.log('No bookings found from any source', 'warning');
    return null;
  }

  async function fetchLoyalty(ctx){
    EasySeas.log('Fetching loyalty data...', 'info');
    var url = ctx.isCelebrity
      ? 'https://aws-prd.api.rccl.com/en/celebrity/web/v3/guestAccounts/' + encodeURIComponent(ctx.accountId)
      : 'https://aws-prd.api.rccl.com/en/royal/web/v1/guestAccounts/loyalty/info';
    try {
      var res = await fetch(url, { method: 'GET', headers: ctx.headers, credentials: 'omit' });
      if (res.ok){
        var data = await res.json();
        EasySeas.capturedData.loyaltyData = data;
        EasySeas.log('Fetched loyalty data successfully', 'success');
        return data;
      }
      EasySeas.log('Loyalty API returned ' + res.status, 'warning');
    } catch(e){ EasySeas.log('Loyalty fetch failed: ' + e.message, 'warning'); }
    return EasySeas.capturedData.loyaltyData;
  }

  function formatExportDate(dateStr){
    if (!dateStr) return '';
    try {
      var m = dateStr.match(/(\\d{4})-(\\d{2})-(\\d{2})/);
      if (m) return m[2] + '-' + m[3] + '-' + m[1];
      var d = new Date(dateStr + 'T12:00:00');
      if (!isNaN(d.getTime())){
        return String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + '-' + d.getFullYear();
      }
    } catch(e){}
    return dateStr;
  }

  function buildExportPayload(){
    var SHIP_CODES = {
      'AL':'Allure of the Seas','AN':'Anthem of the Seas','AD':'Adventure of the Seas',
      'BR':'Brilliance of the Seas','FR':'Freedom of the Seas','GR':'Grandeur of the Seas',
      'HM':'Harmony of the Seas','IC':'Icon of the Seas','ID':'Independence of the Seas',
      'JW':'Jewel of the Seas','LB':'Liberty of the Seas','MR':'Mariner of the Seas',
      'NV':'Navigator of the Seas','OA':'Oasis of the Seas','OV':'Ovation of the Seas',
      'OY':'Odyssey of the Seas','QN':'Quantum of the Seas','RD':'Radiance of the Seas',
      'SE':'Serenade of the Seas','SP':'Spectrum of the Seas','SY':'Symphony of the Seas',
      'UT':'Utopia of the Seas','VI':'Vision of the Seas','VY':'Voyager of the Seas','WN':'Wonder of the Seas'
    };
    var CABIN_MAP = {'I':'Interior','O':'Ocean View','B':'Balcony','S':'Suite'};

    var offersData = EasySeas.capturedData.offers;
    var offerRows = [];
    if (offersData && offersData.offers){
      offersData.offers.forEach(function(o){
        var co = o.campaignOffer || o;
        var sailings = co.sailings || [];
        sailings.forEach(function(s){
          offerRows.push({
            offerCode: co.offerCode || '',
            offerName: co.name || '',
            offerExpirationDate: co.reserveByDate || '',
            shipName: s.shipName || SHIP_CODES[s.shipCode] || (s.shipCode ? s.shipCode + ' of the Seas' : ''),
            shipCode: s.shipCode || '',
            sailingDate: s.sailDate || '',
            itinerary: s.itineraryDescription || '',
            departurePort: (s.departurePort && s.departurePort.name) || s.departurePortName || '',
            cabinType: s.roomType || s.stateroomType || '',
            numberOfGuests: s.isGOBO ? '1' : '2',
            perks: co.tradeInValue ? 'Trade-in value: 
 + co.tradeInValue : '',
            offerType: 'Club Royale'
          });
        });
      });
    }

    var cruiseRows = EasySeas.capturedData.bookedCruises.map(function(c){
      return {
        bookingId: c.bookingId || '',
        shipName: c.shipName || SHIP_CODES[c.shipCode] || '',
        shipCode: c.shipCode || '',
        sailingStartDate: formatExportDate(c.sailDate),
        sailingEndDate: '',
        numberOfNights: c.numberOfNights || 0,
        cabinType: c.cabinType || CABIN_MAP[c.stateroomType] || '',
        cabinCategory: c.cabinCategory || c.stateroomCategoryCode || '',
        cabinNumberOrGTY: c.stateroomNumber === 'GTY' ? 'GTY' : (c.stateroomNumber || 'GTY'),
        status: c.bookingStatus === 'OF' ? 'Courtesy Hold' : 'Upcoming',
        bookingStatus: c.bookingStatus || 'BK',
        paidInFull: c.paidInFull ? 'Yes' : 'No'
      };
    });

    return {
      version: '6.0.0',
      exportedAt: new Date().toISOString(),
      source: 'EasySeas Chrome Extension',
      offers: offerRows,
      bookedCruises: cruiseRows,
      loyaltyData: EasySeas.capturedData.loyaltyData,
      counts: {
        offers: offerRows.length,
        bookedCruises: cruiseRows.length,
        hasLoyalty: !!EasySeas.capturedData.loyaltyData
      }
    };
  }

  function downloadJSON(data, filename){
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  EasySeas.runFullSync = async function(){
    EasySeas.capturedData.logs = [];
    EasySeas.log('Starting full sync...', 'info');
    try {
      var ctx = getAuthContext();
      EasySeas.log('Authenticated as account: ' + ctx.accountId, 'success');

      await fetchOffers(ctx);
      await wait(500);

      var apiBookings = await fetchBookings(ctx);
      if (apiBookings && apiBookings.length > 0){
        var SHIP_CODES = {
          'AL':'Allure of the Seas','AN':'Anthem of the Seas','AD':'Adventure of the Seas',
          'BR':'Brilliance of the Seas','FR':'Freedom of the Seas','HM':'Harmony of the Seas',
          'IC':'Icon of the Seas','ID':'Independence of the Seas','LB':'Liberty of the Seas',
          'MR':'Mariner of the Seas','NV':'Navigator of the Seas','OA':'Oasis of the Seas',
          'OV':'Ovation of the Seas','OY':'Odyssey of the Seas','QN':'Quantum of the Seas',
          'SE':'Serenade of the Seas','SY':'Symphony of the Seas','UT':'Utopia of the Seas',
          'VY':'Voyager of the Seas','WN':'Wonder of the Seas'
        };
        var CABIN_MAP = {'I':'Interior','O':'Ocean View','B':'Balcony','S':'Suite'};
        var existingIds = new Set(EasySeas.capturedData.bookedCruises.map(function(c){ return c.bookingId; }).filter(Boolean));
        apiBookings.forEach(function(b){
          var bid = b.bookingId ? b.bookingId.toString() : '';
          if (bid && existingIds.has(bid)) return;
          existingIds.add(bid);
          EasySeas.capturedData.bookedCruises.push({
            bookingId: bid,
            shipName: b.shipName || SHIP_CODES[b.shipCode] || (b.shipCode ? b.shipCode + ' of the Seas' : ''),
            shipCode: b.shipCode || '',
            sailDate: b.sailDate || '',
            numberOfNights: b.numberOfNights || 0,
            cabinType: CABIN_MAP[b.stateroomType] || b.stateroomType || '',
            cabinCategory: b.stateroomCategoryCode || '',
            stateroomNumber: b.stateroomNumber || '',
            bookingStatus: b.bookingStatus || 'BK',
            isCourtesyHold: b.bookingStatus === 'OF',
            paidInFull: b.paidInFull || false,
            passengers: b.passengers || [],
            source: 'directAPI'
          });
        });
      }
      await wait(500);

      await fetchLoyalty(ctx);

      var payload = buildExportPayload();
      EasySeas.log('Sync complete! ' + payload.counts.offers + ' offer sailings, ' + payload.counts.bookedCruises + ' booked cruises', 'success');
      EasySeas._lastPayload = payload;
      return payload;
    } catch(e){
      EasySeas.log('Sync error: ' + e.message, 'error');
      throw e;
    }
  };

  EasySeas.exportJSON = function(){
    var payload = EasySeas._lastPayload || buildExportPayload();
    var stamp = new Date().toISOString().slice(0,10);
    downloadJSON(payload, 'EasySeas_Sync_' + stamp + '.json');
    EasySeas.log('Exported JSON file', 'success');
  };

  EasySeas.buildExportPayload = buildExportPayload;
})();`;
}

function getSyncIntegrationContent(): string {
  return `(function(){
  window.EasySeas = window.EasySeas || {};
  var panelVisible = false;
  var syncing = false;

  function createUI(){
    if (document.getElementById('easyseas-sync-panel')) return;

    var panel = document.createElement('div');
    panel.id = 'easyseas-sync-panel';

    var btn = document.createElement('button');
    btn.className = 'es-sync-btn';
    btn.innerHTML = '<span class="es-icon">\u2693</span> Easy Seas\u2122 Sync';
    btn.addEventListener('click', toggleStatusPanel);
    panel.appendChild(btn);
    document.body.appendChild(panel);

    var status = document.createElement('div');
    status.id = 'easyseas-status-panel';
    status.className = 'es-status-panel';
    status.style.display = 'none';
    status.innerHTML = '<div class="es-status-header"><span class="es-status-title">Easy Seas\u2122 Sync</span><button class="es-status-close" id="es-close-btn">&times;</button></div>'
      + '<div class="es-status-body" id="es-status-body"><div class="es-count-row"><div class="es-count-badge"><div class="es-count-num" id="es-offers-count">0</div><div class="es-count-label">Offers</div></div><div class="es-count-badge"><div class="es-count-num" id="es-cruises-count">0</div><div class="es-count-label">Cruises</div></div><div class="es-count-badge"><div class="es-count-num" id="es-loyalty-count">\u2014</div><div class="es-count-label">Loyalty</div></div></div><div id="es-log-container"></div></div>'
      + '<div class="es-status-footer"><button class="es-action-btn primary" id="es-sync-btn">Sync Now</button><button class="es-action-btn success" id="es-export-btn" disabled>Export JSON</button></div>';
    document.body.appendChild(status);

    document.getElementById('es-close-btn').addEventListener('click', function(){ status.style.display = 'none'; panelVisible = false; });
    document.getElementById('es-sync-btn').addEventListener('click', doSync);
    document.getElementById('es-export-btn').addEventListener('click', function(){
      if (EasySeas.exportJSON) EasySeas.exportJSON();
    });

    setInterval(updateCounts, 2000);
    setInterval(updateLogs, 1000);
  }

  function toggleStatusPanel(){
    var el = document.getElementById('easyseas-status-panel');
    if (!el) return;
    panelVisible = !panelVisible;
    el.style.display = panelVisible ? 'block' : 'none';
  }

  function updateCounts(){
    var d = EasySeas.capturedData || {};
    var offersEl = document.getElementById('es-offers-count');
    var cruisesEl = document.getElementById('es-cruises-count');
    var loyaltyEl = document.getElementById('es-loyalty-count');
    if (offersEl){
      var oc = (d.offers && d.offers.offers) ? d.offers.offers.length : 0;
      offersEl.textContent = oc;
    }
    if (cruisesEl) cruisesEl.textContent = (d.bookedCruises || []).length;
    if (loyaltyEl) loyaltyEl.textContent = d.loyaltyData ? '\u2713' : '\u2014';
  }

  var lastLogCount = 0;
  function updateLogs(){
    var logs = (EasySeas.capturedData && EasySeas.capturedData.logs) || [];
    if (logs.length === lastLogCount) return;
    lastLogCount = logs.length;
    var container = document.getElementById('es-log-container');
    if (!container) return;
    container.innerHTML = '';
    logs.slice(-30).forEach(function(entry){
      var div = document.createElement('div');
      div.className = 'es-log-entry ' + (entry.type || 'info');
      div.textContent = entry.time + ' ' + entry.message;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  async function doSync(){
    if (syncing) return;
    syncing = true;
    var btn = document.getElementById('es-sync-btn');
    var expBtn = document.getElementById('es-export-btn');
    if (btn){ btn.disabled = true; btn.textContent = 'Syncing...'; }
    if (expBtn) expBtn.disabled = true;
    try {
      await EasySeas.runFullSync();
      if (expBtn) expBtn.disabled = false;
      if (btn) btn.textContent = 'Sync Again';
    } catch(e){
      if (btn) btn.textContent = 'Retry Sync';
    } finally {
      syncing = false;
      if (btn) btn.disabled = false;
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(createUI, 1500); });
  } else {
    setTimeout(createUI, 1500);
  }
})();`;
}
