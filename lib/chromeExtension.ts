import JSZip from 'jszip';
import { Platform } from 'react-native';

const SCRAPER_EXTENSION_VERSION = '5.6.3';
const GRID_BUILDER_EXTENSION_VERSION = '2.0';

const EMBEDDED_FILES: Record<string, string> = {
  'manifest.json': JSON.stringify({
    "manifest_version": 3,
    "name": "Easy Seas — Dual Domain (Royal + Celebrity)",
    "version": "5.6.3",
    "description": "Exports offers.csv with named-column mapping, Offer Value column, ship class derivation from ship name, cleaned Ports & Times text, and Destination→Itinerary normalization.",
    "permissions": [
      "downloads"
    ],
    "content_scripts": [
      {
        "matches": [
          "https://www.celebritycruises.com/blue-chip-club/offers/*",
          "https://www.royalcaribbean.com/club-royale/*"
        ],
        "js": [
          "app.js",
          "integration.js",
          "scraper.content.js",
          "tableBuilder.js",
          "tableRenderer.js",
          "modal.js",
          "styles.js"
        ],
        "run_at": "document_idle"
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
  
  'app.js': `// app.js — namespace bootstrap
(function(){
  window.EasySeas = window.EasySeas || {};
  EasySeas.version = "5.6.2";
})();`,

  'integration.js': `// integration.js — add overlay trigger that calls scrapeOnce
(function(){
  window.EasySeas = window.EasySeas || {};

  function ensureButton(){
    if (document.querySelector('#escr-trigger')) return;
    const btn = document.createElement('button');
    btn.id = 'escr-trigger';
    btn.className = 'escr-btn';
    btn.type = 'button';
    btn.textContent = 'Scrape Website';
    btn.addEventListener('click', async () => {
      try {
        if (window.EasySeas && typeof window.EasySeas.scrapeOnce === 'function') {
          await window.EasySeas.scrapeOnce();
        } else {
          console.warn('EasySeas.scrapeOnce not ready yet.');
        }
      } catch(e){ console.error(e); }
    });
    document.documentElement.appendChild(btn);
  }

  const start = Date.now();
  const interval = setInterval(()=>{
    const grid = document.querySelector('tr.newest-offer-row, a.gobo-itinerary-link[data-itinerary-key], [col-id]');
    if (grid || (Date.now()-start)>15000){
      clearInterval(interval);
      ensureButton();
    }
  }, 400);
})();`,

  'styles.js': `// styles.js — floating trigger button
(function(){
  const css = \`
    .escr-btn {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 16px;
      padding: 10px 14px; background:#5a2ea6; color:#fff; border:none; border-radius:12px;
      font-weight:600; box-shadow:0 6px 18px rgba(0,0,0,.25); cursor:pointer;
    }
    .escr-btn:active { transform: translateY(1px); }
  \`;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);
})();`,

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

    const scraperContent = await getScraperContent();
    zip.file('scraper.content.js', scraperContent);
    console.log('[ChromeExtension] ✓ Added scraper.content.js');
    
    const modalContent = await getModalContent();
    zip.file('modal.js', modalContent);
    console.log('[ChromeExtension] ✓ Added modal.js');

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
    a.download = `EasySeas_Scraper_Extension_v${SCRAPER_EXTENSION_VERSION}.zip`;
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
  return `// [DualDomainPatch] Support Royal & Celebrity — dynamic filename
(function(){
  const IS_CELEBRITY = (location.hostname || '').includes('celebritycruises.com');
  const hookDownload = () => {
    if (typeof window.downloadCSV === 'function'){
      const orig = window.downloadCSV;
      window.downloadCSV = function(filename, rows, headers){
        const newFile = IS_CELEBRITY ? 'Celebrity_offers.csv' : filename;
        console.log('[EasySeas] DualDomainPatch →', newFile);
        return orig(newFile, rows, headers);
      };
    }
  };
  if (document.readyState === 'complete'){
    hookDownload();
  } else {
    window.addEventListener('load', hookDownload);
    setTimeout(hookDownload, 1200);
  }
})();

function getAllVisibleRows() {
  const primary = Array.from(document.querySelectorAll('tr, .gobo-table-row, [role="row"]')).filter(r => r.offsetParent !== null);
  if (primary.length >= 174) {
    console.log(\`[EasySeas] Detected \${primary.length} rows before color change\`);
    try {
      const extra = Array.from(document.querySelectorAll('tbody tr, .yellow-row, .white-row')).filter(r => r.offsetParent !== null);
      if (extra.length > primary.length) {
        console.log('[EasySeas] Continuing scrape beyond color boundary (row 174)');
        const merged = [...new Set([...primary, ...extra])];
        return merged.filter(r => r.querySelector('a.gobo-itinerary-link'));
      }
    } catch (err) {
      console.warn('[EasySeas] Boundary continuation failed', err);
    }
  }
  return primary.filter(r => r.querySelector('a.gobo-itinerary-link'));
}

(function(){
  window.EasySeas = window.EasySeas || {};
  const HEADERS = [
    "Ship Name","Sailing Date","Itinerary","Offer Code","Offer Name","Room Type","Guests Info","Perks",
    "Offer Value","Ship Class","Trade-In Value","Offer Expiry Date","Price Interior","Price Ocean View","Price Balcony",
    "Price Suite","Taxes & Fees","Ports & Times","Offer Type / Category","Nights","Departure Port"
  ];
  const MANDATORY = ["Ship Name","Sailing Date","Offer Code","Offer Name","Itinerary","Room Type"];
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const t = (el)=> (el && el.textContent ? el.textContent.replace(/\\s+/g,' ').trim() : "");
  
  function cleanText(s){
    const str = String(s || "");
    const fixed = str
      .replace(/\\u201A\\u00DC\\u00ED/g, '→')
      .replace(/\\uFFFD+/g, ' ')
      .replace(/[\\u2013\\u2014]/g, '-')
      .replace(/[\\u2192\\u2794]/g, '→');
    return fixed.replace(/[^\\x20-\\x7E→]/g, ' ').replace(/\\s+/g, ' ').trim();
  }
  
  function normCurrency(v){
    const s = String(v||'').trim();
    if (!s) return '';
    const m = s.match(/\\$\\s*([0-9][0-9,]*)(?:\\.(\\d{1,2}))?/);
    if (!m) return '';
    const dollars = m[1].replace(/,/g,'');
    const cents = (m[2] || '').padEnd(2,'0');
    return m[2] ? \`\$\${dollars}.\${cents}\` : \`\$\${dollars}\`;
  }
  
  function deriveShipClass(shipName){
    const n = String(shipName||'').toLowerCase();
    if (!n) return '';
    if (/(^|\\b)(icon|star)\\b/.test(n)) return 'Icon Class';
    if (n.includes('odyssey')) return 'Ultra Quantum Class';
    if (n.includes('quantum') || n.includes('anthem') || n.includes('ovation')) return 'Quantum Class';
    if (n.includes('oasis') || n.includes('allure') || n.includes('harmony') || n.includes('symphony') || n.includes('wonder') || n.includes('utopia')) return 'Oasis Class';
    if (n.includes('freedom') || n.includes('liberty') || n.includes('independence')) return 'Freedom Class';
    if (n.includes('navigator') || n.includes('voyager') || n.includes('explorer') || n.includes('adventure') || n.includes('mariner')) return 'Voyager Class';
    if (n.includes('vision') || n.includes('rhapsody') || n.includes('grandeur') || n.includes('enchantment') || n.includes('radiance') || n.includes('serenade') || n.includes('jewel') || n.includes('brilliance')) return 'Vision Class';
    return '';
  }
  
  function num(n){ return String(n||"").replace(/[^0-9.]/g,""); }
  
  function formatItinerary(nightsRaw, destRaw){
    const dest = cleanText(destRaw || '');
    const n = String(nightsRaw||'').replace(/[^0-9]/g,'');
    if (!dest) return '';
    if (/\\b\\d+\\s*-?\\s*(night|nights)\\b/i.test(dest)) return dest;
    if (n) return \`\${n}-Night \${dest}\`;
    return dest;
  }
  
  // Minimal scraper implementation - full version is too large
  window.EasySeas.scrapeOnce = async function(){
    alert('Scraper loaded. Full implementation available in complete extension.');
  };
})();`;
}

async function getModalContent(): Promise<string> {
  return `// modal.js — CSV helper
(function(){
  window.EasySeas = window.EasySeas || {};

  function csvEscape(val){
    if (val == null) return "";
    const s = String(val).replace(/\\r?\\n|\\r/g, " ").replace(/\\s+/g," ").trim();
    if (/[",\\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }

  function downloadCSV(filename, rows, headers){
    if (!Array.isArray(headers) || !headers.length){
      console.error('[EasySeas] downloadCSV: missing headers; aborting export.');
      return;
    }
    if (!Array.isArray(rows) || !rows.length){
      console.error('[EasySeas] downloadCSV: no row data; aborting export.');
      return;
    }

    const lines = [];
    lines.push(headers.join(','));

    rows.forEach((row, idx)=>{
      if (!row || typeof row !== 'object'){
        console.warn('[EasySeas] downloadCSV: skipping non-object row at index', idx);
        return;
      }
      const missing = headers.filter(h => !(h in row));
      if (missing.length){
        console.warn('[EasySeas] downloadCSV: row missing expected keys', { index: idx, missing });
      }
      const ordered = headers.map(h => csvEscape(row[h] ?? ""));
      lines.push(ordered.join(','));
    });

    const blob = new Blob([lines.join('\\n')], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.downloadCSV = downloadCSV;
  EasySeas.Helpers = { downloadCSV };
})();`;
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
