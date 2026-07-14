// integration.js — ensures there is a working "Scrape Website" trigger that calls scrapeOnce.
//
// Why this exists:
// Some EasySeas builds/pages already render their own "Scrape Website" button inside the app UI.
// Our previous floating trigger could visually cover/"replace" that real button.
// We now:
//  1) Prefer wiring up an existing visible "Scrape Website" button (without changing its look).
//  2) Only inject our floating fallback if no suitable existing button is found.
(function(){
  window.EasySeas = window.EasySeas || {};

  const FALLBACK_ID = 'easyseas-scrape-website-fallback';

  function isVisible(el){
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function normalize(s){
    return String(s || '').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function findExistingScrapeWebsiteButton(){
    // Heuristic: any button/a/input that *says* "Scrape Website".
    const candidates = [];
    const push = (el)=>{ if (el && el.id !== FALLBACK_ID) candidates.push(el); };
    document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]').forEach((el)=>{
      const txt = el.tagName === 'INPUT' ? (el.value || '') : (el.textContent || '');
      if (normalize(txt) === 'scrape website') push(el);
    });
    // Prefer visible, then nearest to bottom-right (common placement).
    const visible = candidates.filter(isVisible);
    const pool = visible.length ? visible : candidates;
    if (!pool.length) return null;
    let best = pool[0];
    let bestScore = -Infinity;
    for (const el of pool){
      const r = el.getBoundingClientRect();
      const score = (r.bottom) + (r.right); // larger = closer to bottom-right
      if (score > bestScore){ best = el; bestScore = score; }
    }
    return best;
  }

  function wireScrapeHandler(el){
    if (!el || el.dataset.easyseasWired === '1') return false;
    el.dataset.easyseasWired = '1';
    el.addEventListener('click', async (ev)=>{
      try{
        // If our real scraper exists, use it (this is the full functionality).
        if (window.EasySeas && typeof window.EasySeas.scrapeOnce === 'function'){
          ev.preventDefault();
          ev.stopPropagation();
          await window.EasySeas.scrapeOnce();
          return;
        }
        console.warn('[EasySeas] scrapeOnce not ready yet. Falling back to native click.');
        // Otherwise, allow the original handler to proceed.
      }catch(e){
        console.error('[EasySeas] Scrape handler error:', e);
      }
    }, true);
    return true;
  }

  function ensureFallbackButton(){
    if (document.querySelector('#' + FALLBACK_ID)) return;
    const btn = document.createElement('button');
    btn.id = FALLBACK_ID;
    btn.className = 'escr-btn';
    btn.type = 'button';
    btn.textContent = 'Scrape Website';
    btn.addEventListener('click', async () => {
      try {
        if (window.EasySeas && typeof window.EasySeas.scrapeOnce === 'function') {
          await window.EasySeas.scrapeOnce();
        } else {
          console.warn('[EasySeas] scrapeOnce not ready yet.');
        }
      } catch(e){ console.error(e); }
    });
    document.documentElement.appendChild(btn);
  }

  const start = Date.now();
  const interval = setInterval(()=>{
    const grid = document.querySelector('tr.newest-offer-row, a.gobo-itinerary-link, [data-itinerary-key], [col-id]');
    if (grid || (Date.now()-start)>15000){
      clearInterval(interval);
      // Prefer the app's existing "Scrape Website" button if present.
      const existing = findExistingScrapeWebsiteButton();
      if (existing){
        const wired = wireScrapeHandler(existing);
        if (wired) {
          console.log('[EasySeas] Wired existing "Scrape Website" button (no fallback injected).');
          return;
        }
      }
      // Otherwise inject our floating fallback (offset so it is less likely to cover app UI).
      ensureFallbackButton();
    }
  }, 400);
})();
