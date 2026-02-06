

function findItinTrigger(tr){
  if (!tr) return null;
  // Primary: existing generated link in our grid
  let el = tr.querySelector('a.gobo-itinerary-link, button.gobo-itinerary-link');
  if (el) return el;
  // Secondary: any element carrying itinerary key
  el = tr.querySelector('[data-itinerary-key]');
  if (el) return el;
  // Fallback: common href patterns
  el = tr.querySelector('a[href*="itinerary" i], a[href*="sailing" i], a[href*="cruise" i]');
  return el || null;
}

// [DualDomainPatch] Support Royal & Celebrity — dynamic filename
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


// [FullColorBoundaryFix] - Ensures scraper continues after color change (row 174+)
function getAllVisibleRows() {
  const primary = Array.from(document.querySelectorAll('tr, .gobo-table-row, [role="row"]')).filter(r => r.offsetParent !== null);
  if (primary.length >= 174) {
    console.log(`[EasySeas] Detected ${primary.length} rows before color change`);
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

// Easy Seas V5 — full rebuild
// One-file export (offers.csv), exact 20 columns, fast modal parse scoped to `.gobo-itinerary-panel`

(function(){
  window.EasySeas = window.EasySeas || {};

  // NOTE: Offers.csv schema is strict. "Offer Value" is a new column inserted
  // immediately BEFORE "Ship Class".
  const HEADERS = [
    "Ship Name","Sailing Date","Itinerary","Offer Code","Offer Name","Room Type","Guests Info","Perks",
    "Offer Value","Ship Class","Trade-In Value","Offer Expiry Date","Price Interior","Price Ocean View","Price Balcony",
    "Price Suite","Taxes & Fees","Ports & Times","Offer Type / Category","Nights","Departure Port"
  ];
  const MANDATORY = ["Ship Name","Sailing Date","Offer Code","Offer Name","Itinerary","Room Type"];

  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
  const t = (el)=> (el && el.textContent ? el.textContent.replace(/\s+/g,' ').trim() : "");

  // Normalize text for CSV (prevents mojibake like "‚Üí")
  function cleanText(s){
    const str = String(s || "");
    // Common bad sequences observed in exports
    const fixed = str
      .replace(/\u201A\u00DC\u00ED/g, '→') // "‚Üí" (mojibake)
      .replace(/\uFFFD+/g, ' ')            // replacement characters
      .replace(/[\u2013\u2014]/g, '-')    // en/em dashes
      .replace(/[\u2192\u2794]/g, '→');   // arrows

    // Remove other non-printable / non-ascii characters
    return fixed
      .replace(/[^\x20-\x7E→]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normCurrency(v){
    const s = String(v||'').trim();
    if (!s) return '';
    const m = s.match(/\$\s*([0-9][0-9,]*)(?:\.(\d{1,2}))?/);
    if (!m) return '';
    const dollars = m[1].replace(/,/g,'');
    const cents = (m[2] || '').padEnd(2,'0');
    // Trade-in values are typically whole dollars; keep cents only if present
    return m[2] ? `$${dollars}.${cents}` : `$${dollars}`;
  }

  function deriveShipClass(shipName){
    const n = String(shipName||'').toLowerCase();
    if (!n) return '';
    // Icon Class
    if (/(^|\b)(icon|star)\b/.test(n)) return 'Icon Class';
    // Ultra Quantum (Odyssey)
    if (n.includes('odyssey')) return 'Ultra Quantum Class';
    // Quantum Class
    if (n.includes('quantum') || n.includes('anthem') || n.includes('ovation')) return 'Quantum Class';
    // Oasis Class
    if (n.includes('oasis') || n.includes('allure') || n.includes('harmony') || n.includes('symphony') || n.includes('wonder') || n.includes('utopia')) return 'Oasis Class';
    // Freedom Class
    if (n.includes('freedom') || n.includes('liberty') || n.includes('independence')) return 'Freedom Class';
    // Voyager Class
    if (n.includes('navigator') || n.includes('voyager') || n.includes('explorer') || n.includes('adventure') || n.includes('mariner')) return 'Voyager Class';
    // Vision Class
    if (n.includes('vision') || n.includes('rhapsody') || n.includes('grandeur') || n.includes('enchantment') || n.includes('radiance') || n.includes('serenade') || n.includes('jewel') || n.includes('brilliance')) return 'Vision Class';
    return '';
  }

  function num(n){ return String(n||"").replace(/[^0-9.]/g,""); }

  function formatItinerary(nightsRaw, destRaw){
    const dest = cleanText(destRaw || '');
    const n = String(nightsRaw||'').replace(/[^0-9]/g,'');
    if (!dest) return '';
    // If destination already includes nights wording, keep as-is.
    if (/\b\d+\s*-?\s*(night|nights)\b/i.test(dest)) return dest;
    if (n) return `${n}-Night ${dest}`;
    return dest;
  }


  // Default positions (may vary by grid build). We rely on header detection +
  // content heuristics to correct mismaps.
  const GRID_DEFAULT_INDEX = {
    code: 1,
    rcvd: 2,
    expires: 3,
    trade: 4,        // Trade-In Value
    offerValue: 5,   // Offer Value (NEW)
    name: 6,
    shipCls: 7,
    ship: 8,
    sail: 9,
    departs: 10,
    nights: 11,
    itinText: 12,
    room: 13,
    guests: 14,
    perks: 15
  };
  let GRID_INDEX = null;

  function detectGridIndex(){
    // Grids sometimes render headers without <thead> (div-based grids, role=columnheader, etc.)
    const candidates = [
      ...Array.from(document.querySelectorAll('thead tr')),
      ...Array.from(document.querySelectorAll('[role="row"]')).filter(r => r.querySelector('[role="columnheader"]')),
      ...Array.from(document.querySelectorAll('tr')).filter(r => r.querySelector('th')),
    ];
    if (!candidates.length){
      console.warn('[EasySeas] Header detection: no header rows found; using default index map.');
      return null;
    }

    const scoreRow = (tr)=>{
      const cells = Array.from(tr.querySelectorAll('th, td, [role="columnheader"]'));
      let score = 0;
      for (const cell of cells){
        const txt = t(cell).toLowerCase();
        if (!txt) continue;
        if ((txt.includes('offer') && txt.includes('code')) || txt === 'code') score += 2;
        if (txt.includes('offer') && txt.includes('name')) score += 2;
        if (txt.includes('offer') && txt.includes('value')) score += 2;
        if (txt.includes('ship class')) score += 2;
        if (txt.includes('ship')) score += 1;
        if (txt.includes('sail') && txt.includes('date')) score += 1;
        if (txt.includes('depart')) score += 1;
        if (txt.includes('night')) score += 1;
        if (txt.includes('itiner')) score += 1;
        if (txt.includes('room') || txt.includes('stateroom') || txt.includes('category') || txt.includes('cabin')) score += 1;
        if (txt.includes('guest')) score += 1;
        if (txt.includes('perk')) score += 1;
        if (txt.includes('receiv') || txt.includes('rcvd')) score += 1;
        if (txt.includes('expir')) score += 1;
        if (txt.includes('trade')) score += 1;
        if (txt === 'value' || txt.includes('value')) score += 1;
      }
      return score;
    };

    let best = null;
    let bestScore = 0;
    for (const tr of candidates){
      const s = scoreRow(tr);
      if (s > bestScore){
        bestScore = s;
        best = tr;
      }
    }

    if (!best || bestScore < 3){
      console.warn('[EasySeas] Header detection: no strong header row; using default index map.');
      return null;
    }

    const map = {};
    const headerCells = Array.from(best.querySelectorAll('th, td, [role="columnheader"]'));
    headerCells.forEach((cell, idx)=>{
      const txt = t(cell).toLowerCase();
      if (!txt) return;
      if ((txt.includes('offer') && txt.includes('code')) || txt === 'code') map.code = idx;
      else if (txt.includes('receiv') || txt.includes('rcvd')) map.rcvd = idx;
      else if (txt.includes('expir')) map.expires = idx;
      else if ((txt.includes('trade') || txt.includes('trade-in')) && txt.includes('value')) map.trade = idx;
      else if ((txt.includes('offer') && txt.includes('value')) || (txt === 'value')) map.offerValue = idx;
      else if (txt.includes('offer') && txt.includes('name')) map.name = idx;
      else if (txt.includes('ship class')) map.shipCls = idx;
      else if (txt.includes('ship')) map.ship = idx;
      else if (txt.includes('sail') && txt.includes('date')) map.sail = idx;
      else if (txt.includes('depart')) map.departs = idx;
      else if (txt.includes('night')) map.nights = idx;
      // The grid sometimes labels itinerary as "Destination".
      else if (txt.includes('itiner')) map.itinText = idx;
      else if (txt.includes('destination')) map.itinText = idx;
      else if (txt.includes('room') || txt.includes('stateroom') || txt.includes('category') || txt.includes('cabin')) map.room = idx;
      else if (txt.includes('guest')) map.guests = idx;
      else if (txt.includes('perk')) map.perks = idx;
    });

    console.log('[EasySeas] Header detection map:', map);
    return map;
  }

  function ensureGridIndex(){
    if (GRID_INDEX) return GRID_INDEX;
    const detected = detectGridIndex();
    if (detected){
      GRID_INDEX = Object.assign({}, GRID_DEFAULT_INDEX, detected);
      console.log('[EasySeas] Using header-based grid index map:', GRID_INDEX);
    } else {
      GRID_INDEX = Object.assign({}, GRID_DEFAULT_INDEX);
      console.warn('[EasySeas] Falling back to default grid index map:', GRID_INDEX);
    }
    return GRID_INDEX;
  }

  function getCellTextByKey(tdList, key){
    const map = ensureGridIndex();
    const idx = map[key];
    if (typeof idx !== 'number') return "";
    const cell = tdList[idx] || null;
    return t(cell);
  }

  // ---- parse grid row by nth-child (newest-offer-row) ----
  
  function parseGridRow(tr){
    const td = tr.querySelectorAll('td');
    const cells = Array.from(td).map(c => t(c));
    const offerCodeRegex = /^(?:\d{2})[A-Z]{2,}[A-Z0-9]*\d{2,}$/; // e.g., 25JKP2102
    const looksLikeCurrency = (s)=>/^\s*\$\s*\d/.test(String(s||""));
    const looksLikeDate = (s)=>/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(String(s||""));
    const looksLikeGuests = (s)=>/\bguest/i.test(String(s||""));
    const looksLikeCabin = (s)=>/(interior|inside|ocean\s*view|oceanview|balcony|suite|guarantee|gty)/i.test(String(s||""));
    const cabinFromText = (s)=>{
      const v = String(s||"").toLowerCase();
      if (v.includes('interior') || v.includes('inside')) return 'Interior';
      if (v.includes('ocean') && v.includes('view')) return 'Oceanview';
      if (v.includes('oceanview')) return 'Oceanview';
      if (v.includes('balcony')) return 'Balcony';
      if (v.includes('suite')) return 'Suite';
      if (v.includes('gty') || v.includes('guarantee')){
        if (v.includes('ocean')) return 'Oceanview GTY';
        if (v.includes('balcony')) return 'Balcony GTY';
        if (v.includes('interior') || v.includes('inside')) return 'Interior GTY';
      }
      return '';
    };

    const offerKeywordScore = (s)=>{
      const v = String(s||'').toLowerCase();
      if (!v) return 0;
      // Strong signals for offer titles
      const kws = ['instant', 'reward', 'rewards', 'weekend', 'winning', 'jackpot', 'deal', 'deals', 'holiday', 'monthly', 'mix', 'picks', 'bets', 'selection', 'freeplay', 'free play', 'free play', 'free', 'certificate'];
      let score = 0;
      for (const k of kws){
        if (v.includes(k)) score += 2;
      }
      // Penalize obvious itinerary phrases
      const itinBad = ['cruise', 'perfect day', 'bahamas', 'cabo', 'ensenada', 'catalina', 'caribbean', 'mediterranean', 'day', 'nights', 'night'];
      for (const k of itinBad){
        if (v.includes(k)) score -= 1;
      }
      // Penalize if it looks like a ship name
      if (v.includes('of the seas')) score -= 2;
      return score;
    };

    const rec = {
      code: getCellTextByKey(td, 'code'),
      rcvd: getCellTextByKey(td, 'rcvd'),
      expires: getCellTextByKey(td, 'expires'),
      trade: getCellTextByKey(td, 'trade'),
      offerValue: getCellTextByKey(td, 'offerValue'),
      name: getCellTextByKey(td, 'name'),
      shipCls: getCellTextByKey(td, 'shipCls'),
      ship: getCellTextByKey(td, 'ship'),
      sail: getCellTextByKey(td, 'sail'),
      departs: getCellTextByKey(td, 'departs'),
      nights: getCellTextByKey(td, 'nights'),
      itinText: getCellTextByKey(td, 'itinText'),
      room: getCellTextByKey(td, 'room'),
      guests: getCellTextByKey(td, 'guests'),
      perks: getCellTextByKey(td, 'perks'),
      itinLink: findItinTrigger(tr)
    };

    // --- Heuristic repairs for common grid mismaps ---
    if (!rec.code || !offerCodeRegex.test(String(rec.code).trim())){
      const found = cells.find(c => offerCodeRegex.test(String(c).trim()));
      if (found) rec.code = found.trim();
    }

    // Offer Name should be human text (not currency, not 0/1, not a date)
    const badName = (v)=>{
      const s = String(v||"").trim();
      if (!s) return true;
      if (looksLikeCurrency(s)) return true;
      if (looksLikeDate(s)) return true;
      if (/^\$?0(?:\.0+)?$/.test(s)) return true;
      if (/^[01]$/.test(s)) return true;
      return false;
    };
    if (badName(rec.name)){
      const candidates = cells
        .filter(c => c && !badName(c))
        .filter(c => !looksLikeGuests(c))
        .filter(c => !looksLikeCabin(c))
        .filter(c => c.length >= 4);
      if (candidates.length){
        // Prefer strings that look like offer titles (Instant Rewards, Winning Weekends, Jackpot Deals...)
        const scored = candidates
          .map(c => ({c, score: offerKeywordScore(c)}))
          .sort((a,b)=>b.score-a.score || b.c.length-a.c.length);
        // Only accept keyword-driven winner when it scores positively; otherwise fall back to longest.
        if (scored[0] && scored[0].score > 0) rec.name = scored[0].c.trim();
        else {
          candidates.sort((a,b)=>b.length-a.length);
          rec.name = candidates[0].trim();
        }
      }
    }

    // Room Type should be text, not numeric enum.
    let roomTxt = cabinFromText(rec.room);
    if (!roomTxt){
      const foundCabin = cells.map(cabinFromText).find(v => v);
      if (foundCabin) roomTxt = foundCabin;
    }
    if (roomTxt) rec.room = roomTxt;

    // If Ship Class is currency, it is almost certainly Offer Value.
    if (looksLikeCurrency(rec.shipCls) && !looksLikeCurrency(rec.offerValue)){
      rec.offerValue = rec.shipCls;
      rec.shipCls = '';
    }
    // If Offer Value still missing, grab the most plausible currency cell
    if (!looksLikeCurrency(rec.offerValue)){
      const currencyCells = cells.filter(looksLikeCurrency);
      if (currencyCells.length){
        // Prefer the first currency that isn't clearly a price column (handled in modal)
        rec.offerValue = currencyCells[0];
      }
    }

    // Trade-In Value should be a $ amount like $0 / $450 / $475 / $500 etc.
    // If the detected trade cell isn't currency, try to find an alternate currency cell (distinct from offerValue).
    const tradeCurrency = normCurrency(rec.trade);
    if (tradeCurrency) {
      rec.trade = tradeCurrency;
    } else {
      const offerValNorm = normCurrency(rec.offerValue);
      const currencyCells = cells.map(normCurrency).filter(Boolean);
      const distinct = currencyCells.filter(v => v !== offerValNorm);
      if (distinct.length){
        // Prefer values that look like common trade-in amounts
        const common = distinct.find(v => /^\$(0|3\d\d|4\d\d|5\d\d|6\d\d|7\d\d|8\d\d|9\d\d)$/.test(v.replace(/\.\d\d$/,'')));
        rec.trade = common || distinct[0];
      } else {
        rec.trade = '$0';
      }
    }

    // Itinerary/Destination should not be a bare number (often nights leaks here).
    // If itinText is only digits, try to find a more descriptive destination cell.
    const itinTrim = String(rec.itinText||'').trim();
    if (/^\d+$/.test(itinTrim)){
      const destCandidates = cells
        .filter(c => c && c.length >= 4)
        .filter(c => !/^\d+$/.test(c.trim()))
        .filter(c => !looksLikeDate(c))
        .filter(c => !offerCodeRegex.test(c.trim()))
        .filter(c => !looksLikeCurrency(c))
        .filter(c => !looksLikeGuests(c))
        .filter(c => !looksLikeCabin(c))
        .filter(c => !c.toLowerCase().includes('of the seas'));
      // Prefer strings that look like destinations (contain '&', ',', or known port keywords)
      const portish = ['cabo','ensenada','bahamas','perfect day','caribbean','mexico','catalina','alaska','mediterranean','europe','bermuda','cancun','costa maya','cozumel'];
      const scored = destCandidates.map(c=>{
        const v = c.toLowerCase();
        let score = 0;
        if (v.includes('&')) score += 3;
        if (v.includes(',')) score += 2;
        for (const p of portish){ if (v.includes(p)) score += 2; }
        return {c, score};
      }).sort((a,b)=>b.score-a.score || b.c.length-a.c.length);
      if (scored[0] && scored[0].score > 0) rec.itinText = scored[0].c.trim();
    }

    // Itinerary text should be destination-style text (e.g., "Cabo & Ensenada"),
    // not just a digit like 4 or 5. If we detect a numeric, try to recover.
    const itinIsJustNumber = (v)=>/^\s*\d+\s*$/.test(String(v||''));
    const looksLikeDestination = (s)=>{
      const v = String(s||'').toLowerCase();
      if (!v || v.length < 4) return false;
      if (itinIsJustNumber(v)) return false;
      // common destination-ish signals
      if (v.includes('&') || v.includes(' and ')) return true;
      const kws = ['cabo','ensenada','bahamas','perfect day','caribbean','mexico','alaska','europe','mediterranean','catalina','cozumel','jamaica','bonaire','cura','aruba','canada','new england','bermuda','hawaii','panama','key west','labadee','cococay'];
      return kws.some(k=>v.includes(k));
    };
    if (itinIsJustNumber(rec.itinText) || !rec.itinText){
      const cand = cells.find(looksLikeDestination);
      if (cand) rec.itinText = cand.trim();
    }

    return rec;
  }


  async function waitForPanel(){
    const end = Date.now() + 4000; // up to ~4s
    while (Date.now() < end){
      const p = document.querySelector('.gobo-itinerary-panel');
      if (p){
        // Ensure at least something inside
        const hasTbl = p.querySelector('.gobo-itinerary-table tbody tr');
        if (hasTbl) return p;
      }
      await sleep(200);
    }
    return document.querySelector('.gobo-itinerary-panel'); // best effort
  }

  function parsePanel(panel){
    const out = { priceInterior:"", priceOcean:"", priceBalcony:"", priceSuite:"", taxes:"", portsTimes:"" };
    if (!panel) return out;

    // Pricing table: under "Stateroom Pricing" or first table with Class/Price/Currency
    const tables = Array.from(panel.querySelectorAll('.gobo-itinerary-table'));
    const priceTable = tables.find(tb => (tb.querySelector('thead')?.textContent||"").includes('Class'));
    if (priceTable){
      priceTable.querySelectorAll('tbody tr').forEach(tr=>{
        const cells = tr.querySelectorAll('td');
        const label = (cells[0]?.textContent||"").toLowerCase();
        const val = num(cells[1]?.textContent||"");
        if (label.includes('interior') || label.includes('inside')) out.priceInterior = val || out.priceInterior;
        else if (label.includes('ocean')) out.priceOcean = val || out.priceOcean;
        else if (label.includes('balcony')) out.priceBalcony = val || out.priceBalcony;
        else if (label.includes('suite')) out.priceSuite = val || out.priceSuite;
      });
    }

    // Taxes & Fees line
    const taxNode = panel.querySelector('.gobo-itinerary-taxes');
    if (taxNode){
      const m = taxNode.textContent.match(/([\d,.]+)\s*USD/i);
      if (m) out.taxes = m[1].replace(/,/g,"");
    } else {
      // fallback regex on panel text
      const m2 = (panel.textContent||"").match(/Taxes?.?Fees?:?\s*\$?([\d,.]+)/i);
      if (m2) out.taxes = m2[1].replace(/,/g,"");
    }

    // Day-by-Day itinerary table: header contains Day/Day of Week
    const itinTable = tables.find(tb => (tb.querySelector('thead')?.textContent||"").includes('Day of Week'));
    if (itinTable){
      const ports = [];
      itinTable.querySelectorAll('tbody tr').forEach(tr=>{
        const p = tr.children[4]?.textContent?.trim();
        if (p && !ports.includes(p)) ports.push(p);
      });
      out.portsTimes = ports.join(' → ');
    }

    return out;
  }

  function buildRow(rec, modal){
    const shipClass = deriveShipClass(rec.ship);
    return {
      "Ship Name": cleanText(rec.ship),
      "Sailing Date": cleanText(rec.sail),
      "Itinerary": formatItinerary(rec.nights, rec.itinText),
      "Offer Code": cleanText(rec.code),
      "Offer Name": cleanText(rec.name),
      "Room Type": cleanText(rec.room),
      "Guests Info": cleanText(rec.guests),
      "Perks": cleanText(rec.perks),
      "Offer Value": cleanText(normCurrency(rec.offerValue) || rec.offerValue || ""),
      "Ship Class": shipClass,
      "Trade-In Value": cleanText(normCurrency(rec.trade) || rec.trade || '$0'),
      "Offer Expiry Date": cleanText(rec.expires),
      "Price Interior": modal.priceInterior,
      "Price Ocean View": modal.priceOcean,
      "Price Balcony": modal.priceBalcony,
      "Price Suite": modal.priceSuite,
      "Taxes & Fees": cleanText(modal.taxes),
      "Ports & Times": cleanText(modal.portsTimes),
      "Offer Type / Category": cleanText(rec.guests),
      "Nights": num(rec.nights),
      "Departure Port": cleanText(rec.departs)
    };
  }

  function ok(row){ return MANDATORY.every(k => (row[k]||"").toString().trim().length>0); }

  function validHeaders(h){ return Array.isArray(h) && h.length===HEADERS.length && h.every((v,i)=>v===HEADERS[i]); }

  async function scrapeOnce(){
    let maxRows = parseInt(prompt("How many rows do you want to scrape? (Default 590)", "590"));
    if (isNaN(maxRows) || maxRows <= 0) maxRows = 590;

    const trs = Array.from(getAllVisibleRows());
    const withLink = trs.filter(tr => findItinTrigger(tr));
    const total = Math.min(maxRows, withLink.length);
    if (!total){ console.error("No rows with itinerary links detected. Try clicking SHOW ALL OFFERS first, or ensure the offers grid is visible."); return; }

    const out = [];
    for (let i=0;i<total;i++){
      const tr = withLink[i];
      const rec = parseGridRow(tr);

      let m = { priceInterior:"", priceOcean:"", priceBalcony:"", priceSuite:"", taxes:"", portsTimes:"" };
      try{
        rec.itinLink && rec.itinLink.click();
        const panel = await waitForPanel();
        await sleep(500); // let contents settle
        m = parsePanel(panel);
        // retry once if all empty
        if (!m.priceInterior && !m.priceOcean && !m.priceBalcony && !m.priceSuite){
          await sleep(900);
          m = parsePanel(panel);
        }
        // close panel
        const closeBtn = panel && panel.querySelector('.gobo-itinerary-close');
        if (closeBtn) closeBtn.click(); else document.dispatchEvent(new KeyboardEvent('keydown', {key:"Escape"}));
      }catch(e){
        console.warn("Panel parse error:", e);
      }

      const row = buildRow(rec, m);
      console.log(`Row ${i+1}/${total} → Interior: ${row["Price Interior"]||"-"} | Ocean: ${row["Price Ocean View"]||"-"} | Balcony: ${row["Price Balcony"]||"-"} | Suite: ${row["Price Suite"]||"-"} | Taxes: ${row["Taxes & Fees"]||"-"} | Ports: ${row["Ports & Times"] ? row["Ports & Times"].slice(0,120) : "-"}`);
      if (ok(row)) out.push(row);
      await sleep(70);
    }

    const H = window.EasySeas.Helpers;
    if (!validHeaders(HEADERS)){ console.error("Header validation failed."); return; }
    if (!out.length){ console.error("No valid rows to export."); return; }
    H.downloadCSV("offers.csv", out, HEADERS);
    console.log(`✅ ${out.length} rows exported.`);
  }

  window.EasySeas.scrapeOnce = scrapeOnce;
})();
