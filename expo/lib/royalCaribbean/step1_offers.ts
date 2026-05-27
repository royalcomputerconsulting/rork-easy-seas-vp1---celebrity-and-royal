export const STEP1_OFFERS_SCRIPT = String.raw`
(function() {
  const ENGINE_VERSION = 'v9.2.7';
  const BATCH_SIZE = 40;
  const MAX_BATCH_CHARS = 42000;

  const SHIP_NAMES = [
    'Adventure of the Seas','Allure of the Seas','Anthem of the Seas','Brilliance of the Seas','Enchantment of the Seas','Explorer of the Seas','Freedom of the Seas','Grandeur of the Seas','Harmony of the Seas','Icon of the Seas','Independence of the Seas','Jewel of the Seas','Legend of the Seas','Liberty of the Seas','Mariner of the Seas','Navigator of the Seas','Oasis of the Seas','Odyssey of the Seas','Ovation of the Seas','Quantum of the Seas','Radiance of the Seas','Rhapsody of the Seas','Serenade of the Seas','Spectrum of the Seas','Star of the Seas','Symphony of the Seas','Utopia of the Seas','Vision of the Seas','Voyager of the Seas','Wonder of the Seas'
  ];
  const SHIP_CODES = { AD:'Adventure of the Seas', AL:'Allure of the Seas', AN:'Anthem of the Seas', BR:'Brilliance of the Seas', EN:'Enchantment of the Seas', EX:'Explorer of the Seas', FR:'Freedom of the Seas', GR:'Grandeur of the Seas', HM:'Harmony of the Seas', IC:'Icon of the Seas', ID:'Independence of the Seas', JW:'Jewel of the Seas', LB:'Liberty of the Seas', LE:'Legend of the Seas', MR:'Mariner of the Seas', NV:'Navigator of the Seas', OA:'Oasis of the Seas', OY:'Odyssey of the Seas', OV:'Ovation of the Seas', QN:'Quantum of the Seas', RD:'Radiance of the Seas', RH:'Rhapsody of the Seas', SE:'Serenade of the Seas', SP:'Spectrum of the Seas', ST:'Star of the Seas', SY:'Symphony of the Seas', UT:'Utopia of the Seas', VI:'Vision of the Seas', VY:'Voyager of the Seas', WN:'Wonder of the Seas' };
  const MONTHS = { jan:1, january:1, feb:2, february:2, mar:3, march:3, apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7, aug:8, august:8, sep:9, sept:9, september:9, oct:10, october:10, nov:11, november:11, dec:12, december:12 };

  function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
  function cleanText(value){ return String(value || '').replace(/\\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  function log(message, type){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'log', message, logType:type || 'info' })); } catch(e){ console.log('[EasySeas Step1]', message); } }
  function post(payload){ try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e){} }
  function sendBatch(rows, final, totalCount, offerCount){ post({ type: final ? 'step_complete' : 'offers_batch', step: 1, data: rows || [], isFinal: !!final, totalCount: totalCount || 0, offerCount: offerCount || 0 }); }
  function compactRow(row){ const r=Object.assign({}, row); if (r.rawTextSnippet && r.rawTextSnippet.length > 500) r.rawTextSnippet = r.rawTextSnippet.slice(0,500); if (r.sourceUrl && r.sourceUrl.length > 700) r.sourceUrl = r.sourceUrl.slice(0,700); return r; }
  function sendRows(rows, offerCount){
    if (!rows.length){ sendBatch([], true, 0, offerCount); return; }
    let chunk=[], chars=0, sent=0, n=0;
    for (const row of rows){
      const compact=compactRow(row); let size=1200; try { size=JSON.stringify(compact).length; } catch(e){}
      if (chunk.length && (chunk.length >= BATCH_SIZE || chars + size > MAX_BATCH_CHARS)) { n++; sendBatch(chunk, false); sent += chunk.length; log('📤 Sent live sailing batch '+n+' with '+chunk.length+' row(s) (total: '+sent+'/'+rows.length+')'); chunk=[]; chars=0; }
      chunk.push(compact); chars += size;
    }
    if (chunk.length){ n++; sendBatch(chunk, false); sent += chunk.length; log('📤 Sent live sailing batch '+n+' with '+chunk.length+' row(s) (total: '+sent+'/'+rows.length+')'); }
    sendBatch([], true, rows.length, offerCount);
  }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function fmtDate(y,m,d){ const yy = Number(y), mm = Number(m), dd = Number(d); if (!yy || !mm || !dd || mm<1 || mm>12 || dd<1 || dd>31) return ''; return pad2(mm)+'/'+pad2(dd)+'/'+yy; }
  function canonicalOfferCode(raw){
    let code = cleanText(raw).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (!code) return '';
    if (/^26BCP105[A-Z]*/.test(code)) return '26BCP105';
    if (/^26JUL104[A-Z]*/.test(code)) return '26JUL104';
    if (/^26VTY104[A-Z]*/.test(code)) return '26VTY104';
    if (/^26WCR403[A-Z]*/.test(code)) return '26WCR403';
    if (/^26VAR303[A-Z]*/.test(code)) return '26VAR303';
    const monthly = code.match(/^(\d{4}[A-Z]\d{2}[A-Z]?)/);
    if (monthly) return monthly[1];
    const family = code.match(/^(\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/);
    return family ? family[1] : code;
  }
  function offerCodeRegex(){ return /(\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/gi; }
  function extractPlayerOfferId(url){ const m=String(url||'').match(/[?&]playerOfferId=([^&#]+)/i); return m ? decodeURIComponent(m[1]) : ''; }
  function getShipNameFromText(text){ const src=cleanText(text); for (const ship of SHIP_NAMES){ const re = new RegExp(ship.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&'), 'i'); if (re.test(src)) return ship; } const codeMatch=src.match(/\b([A-Z]{2})(?=20\d{6}|\s*[- ]?\s*20\d{2})\b/); if (codeMatch && SHIP_CODES[codeMatch[1]]) return SHIP_CODES[codeMatch[1]]; return ''; }
  function parseOneDateToken(raw, carryYear, carryMonth){
    const s = cleanText(raw).replace(/(st|nd|rd|th)\b/gi,'');
    let m;
    m = s.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/); if (m) return { date: fmtDate(m[1],m[2],m[3]), year:+m[1], month:+m[2] };
    m = s.match(/\b(20\d{2})(\d{2})(\d{2})\b/); if (m) return { date: fmtDate(m[1],m[2],m[3]), year:+m[1], month:+m[2] };
    m = s.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})\b/); if (m) return { date: fmtDate(m[3],m[1],m[2]), year:+m[3], month:+m[1] };
    m = s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,)?\s*(20\d{2})?\b/i);
    if (m){ const month=MONTHS[m[1].toLowerCase()]; const year=+(m[3] || carryYear || 0); return { date: year ? fmtDate(year, month, m[2]) : '', year, month }; }
    m = s.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,)?\s*(20\d{2})?\b/i);
    if (m){ const month=MONTHS[m[2].toLowerCase()]; const year=+(m[3] || carryYear || 0); return { date: year ? fmtDate(year, month, m[1]) : '', year, month }; }
    m = s.match(/^\s*(\d{1,2})\s*$/); if (m && carryYear && carryMonth) return { date: fmtDate(carryYear, carryMonth, m[1]), year: carryYear, month: carryMonth };
    return { date:'', year:carryYear||0, month:carryMonth||0 };
  }
  function extractDates(text){
    const src = cleanText(text).replace(/\b(?:and|&)\b/gi, ',');
    const results=[]; const seen=new Set(); let m;
    function add(date){ if (date && !seen.has(date)){ seen.add(date); results.push(date); } }
    const globalYear = (src.match(/\b(20\d{2})\b/)||[])[1] || '';

    const numeric = /\b(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}|20\d{6}|\d{1,2}[-\/]\d{1,2}[-\/]20\d{2})\b/g;
    while ((m=numeric.exec(src))!==null){ add(parseOneDateToken(m[1], 0, 0).date); }

    // Straight month-day matches. Carry the last visible year forward so Royal's grouped layouts work.
    const monthDayYear = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*(?:20\d{2})?/gi;
    let lastYear = globalYear ? +globalYear : 0; let lastMonth=0;
    while ((m=monthDayYear.exec(src))!==null){ const parsed=parseOneDateToken(m[0], lastYear, lastMonth); if (parsed.date) add(parsed.date); if (parsed.year) lastYear=parsed.year; if (parsed.month) lastMonth=parsed.month; }

    // Royal grouped blocks are often rendered as:
    // Dates 2026 Jun 13, Jun 20, Jun 27, Jul 4 ... 2027 Feb 7, Feb 14 ...
    const dateBlockRe = /(?:Dates?|Sailing Dates?)\s*((?:20\d{2}\s+)?(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}|\d{1,2}|20\d{2})(?:\s*,\s*|\s+|\s*&\s*|\s+and\s+|$){0,3}){1,80}/ig;
    const yearMonthDayStream = /\b(20\d{2})\b|\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b|\b(\d{1,2})(?:st|nd|rd|th)?\b/gi;
    function expandGroupedBody(body, seedYear){
      let carryYear = seedYear || (globalYear ? +globalYear : 0);
      let carryMonth = 0;
      let mm;
      while ((mm=yearMonthDayStream.exec(body))!==null){
        if (mm[1]) { carryYear = +mm[1]; continue; }
        if (mm[2]) {
          carryMonth = MONTHS[mm[2].toLowerCase()];
          if (carryYear) add(fmtDate(carryYear, carryMonth, mm[3]));
          continue;
        }
        if (mm[4] && carryYear && carryMonth) add(fmtDate(carryYear, carryMonth, mm[4]));
      }
    }
    while ((m=dateBlockRe.exec(src))!==null) expandGroupedBody(m[0], globalYear ? +globalYear : 0);

    // Also scan windows that begin with a year, because detail rows often omit the word "Dates" after the first block.
    const looseYearBlock = /\b(20\d{2})\s+((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2})(?:\s*,\s*|\s+and\s+|\s*&\s*|\s+)?){1,60}/ig;
    while ((m=looseYearBlock.exec(src))!==null) expandGroupedBody(m[0], +m[1]);

    return results;
  }
  function inferCabin(text){ const l=cleanText(text).toLowerCase(); const out=[]; if (l.includes('suite')) out.push('Suite'); if (l.includes('balcony')) out.push('Balcony'); if (l.includes('oceanview')||l.includes('ocean view')) out.push('Oceanview'); if (l.includes('interior')) out.push('Interior'); return out.join(' or '); }
  function inferGuests(text){ const l=cleanText(text).toLowerCase(); if (/for\s+one|one\s+plus|1\s*person/.test(l)) return '1 person and a discount for second guest'; return '2 person'; }
  function normalizeOfferName(name){ return cleanText(name).replace(/^(My Offers|All Offers|Sort|Filters|View Sailings|Offer Details)\s*/i,'').slice(0,90).trim(); }
  function hasRealRow(row){ return !!(cleanText(row.shipName) && cleanText(row.sailingDate)); }
  function makeRow(offer, ship, date, sourceType, sourceUrl, rawText){
    return { sourcePage:'Offers', offerName:offer.offerName || 'Casino Offer', offerCode:canonicalOfferCode(offer.offerCode), offerExpirationDate:offer.offerExpirationDate || '', offerType:'Casino Offer', shipName:ship, sailingDate:date, itinerary:offer.itinerary || '', departurePort:offer.departurePort || '', cabinType:offer.cabinType || inferCabin(rawText || offer.perks || ''), numberOfGuests:offer.numberOfGuests || inferGuests(rawText || offer.perks || ''), perks:offer.perks || '', sourceType, sourceUrl:sourceUrl||'', rawTextSnippet:cleanText(rawText||'').slice(0,500) };
  }
  function getItineraryFromText(text){
    const src=cleanText(text);
    const m=src.match(/(\d{1,2}\s+Night\s+[^|]{3,90}?Cruise)/i) || src.match(/Itinerary\s+([^|]{3,120}?)(?:\s+Ship name|\s+Port|\s+Offer Type|$)/i);
    return cleanText(m ? m[1] : '');
  }
  function getDeparturePortFromText(text){
    const src=cleanText(text);
    const m=src.match(/\bPort\s+([A-Z][A-Za-z .'-]{2,60})(?:\s+Offer Type|\s+Room type|\s+Dates|$)/i) || src.match(/\bfrom\s+([A-Z][A-Za-z .'-]{2,60})(?:,|\s+on\s+|\s+aboard\s+)/i);
    return cleanText(m ? m[1] : '');
  }
  function splitSailingBlocks(text){
    const src=cleanText(text);
    const parts=src.split(/(?=\bOffer Type\s+)/i).map(x=>cleanText(x)).filter(x=>/of the Seas|\bShip name\b/i.test(x));
    return parts.length ? parts : [src];
  }
  function extractRowsFromText(text, offer, sourceType, sourceUrl){
    const src = cleanText(text); if (!src) return [];
    const rows=[];
    const shipRegex = new RegExp(SHIP_NAMES.map(s=>s.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&')).join('|'), 'gi');

    for (const block of splitSailingBlocks(src)){
      let match; const positions=[]; shipRegex.lastIndex=0;
      while ((match=shipRegex.exec(block))!==null) {
        const official = SHIP_NAMES.find(s => s.toLowerCase() === match[0].toLowerCase()) || match[0];
        positions.push({ ship: official, idx:match.index });
      }
      if (positions.length){
        for (let i=0;i<positions.length;i++){
          const start=Math.max(0, positions[i].idx-2200);
          const end=i+1<positions.length ? Math.min(block.length, positions[i+1].idx+250) : Math.min(block.length, positions[i].idx+2800);
          const section=block.slice(start,end);
          const dates=extractDates(section);
          const sectionOffer=Object.assign({}, offer, {
            itinerary: offer.itinerary || getItineraryFromText(section),
            departurePort: offer.departurePort || getDeparturePortFromText(section),
            cabinType: offer.cabinType || inferCabin(section),
            numberOfGuests: offer.numberOfGuests || inferGuests(section),
          });
          dates.forEach(date=>rows.push(makeRow(sectionOffer, positions[i].ship, date, sourceType, sourceUrl, section)));
        }
      } else {
        const ship = getShipNameFromText(block);
        if (ship) {
          const blockOffer=Object.assign({}, offer, { itinerary: offer.itinerary || getItineraryFromText(block), departurePort: offer.departurePort || getDeparturePortFromText(block), cabinType: offer.cabinType || inferCabin(block) });
          extractDates(block).forEach(date=>rows.push(makeRow(blockOffer, ship, date, sourceType, sourceUrl, block)));
        }
      }
    }
    return rows.filter(hasRealRow);
  }
  function collectRowsFromJson(value, offer, sourceType, sourceUrl, depth){
    if (depth > 8 || value == null) return [];
    const rows=[];
    if (Array.isArray(value)) { value.forEach(v=>rows.push(...collectRowsFromJson(v, offer, sourceType, sourceUrl, depth+1))); return rows; }
    if (typeof value !== 'object') { if (typeof value === 'string' && /of the Seas|20\d{2}|\d{1,2}\/\d{1,2}\//i.test(value)) rows.push(...extractRowsFromText(value, offer, sourceType, sourceUrl)); return rows; }
    const obj=value;
    const ship = cleanText(obj.shipName || obj.ship?.name || obj.vesselName || obj.shipDescription || obj.shipDisplayName || (obj.shipCode && SHIP_CODES[String(obj.shipCode).toUpperCase()]) || '');
    const dateRaw = cleanText(obj.sailDate || obj.sailingDate || obj.departureDate || obj.startDate || obj.embarkDate || obj.sailingStartDate || '');
    const dates = dateRaw ? extractDates(dateRaw) : [];
    if (ship && dates.length) dates.forEach(date=>rows.push(makeRow(offer, ship, date, sourceType, sourceUrl, JSON.stringify(obj).slice(0,500))));
    for (const k of Object.keys(obj)) rows.push(...collectRowsFromJson(obj[k], offer, sourceType, sourceUrl, depth+1));
    return rows;
  }
  function dedupeRows(rows){
    const seen=new Set(); const out=[];
    for (const r of rows.filter(hasRealRow)){
      const key=[canonicalOfferCode(r.offerCode), cleanText(r.shipName).toLowerCase(), cleanText(r.sailingDate), cleanText(r.cabinType).toLowerCase(), cleanText(r.numberOfGuests).toLowerCase()].join('|');
      if (!seen.has(key)){ seen.add(key); out.push(r); }
    }
    return out;
  }
  function parseOfferFromText(text, fallbackIndex){
    const clean=cleanText(text); const m=clean.match(offerCodeRegex()); const offerCode=m ? canonicalOfferCode(m[0]) : '';
    let name=''; if (offerCode){ const before=clean.slice(0, clean.toUpperCase().indexOf(m[0].toUpperCase())).trim(); const parts=before.split(/All Offers|My Offers|Sort|Filters|Redeem|Offer details|View Sailings|Missing Offers\?/i).map(x=>x.trim()).filter(Boolean); name=normalizeOfferName(parts[parts.length-1] || before); }
    if (!name){ const nm=clean.match(/([A-Z][A-Za-z0-9 '&-]{2,80})\s*(?:\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/); name=normalizeOfferName(nm ? nm[1] : 'Casino Offer '+fallbackIndex); }
    const expiry=(clean.match(/Redeem\s+by\s+([A-Za-z]{3,9}\s+\d{1,2},\s+20\d{2})/i)||[])[1] || '';
    return { offerName:name || ('Casino Offer '+fallbackIndex), offerCode, offerExpirationDate:expiry, cabinType:inferCabin(clean), numberOfGuests:inferGuests(clean), perks:clean.slice(0,500), playerOfferId:'', detailUrl:'' };
  }
  function getViewButtons(){ return Array.from(document.querySelectorAll('button,a')).filter(el => /View\s+Sailings/i.test(cleanText(el.textContent || el.getAttribute('aria-label') || ''))); }
  function getCardForButton(button){ let n=button, best=null; for (let i=0;n&&i<8;i++){ const txt=cleanText(n.textContent||''); const codes=txt.match(offerCodeRegex())||[]; if (txt.length<1800 && codes.length>=1 && /Redeem\s+by|View\s+Sailings/i.test(txt)) best=n; n=n.parentElement; } return best || button.parentElement || button; }
  function parseVisibleOffers(){
    const byCode=new Map(); const buttons=getViewButtons();
    const anchors=Array.from(document.querySelectorAll('a[href*="/club-royale/offers/"]'));
    anchors.forEach((a,idx)=>{ const href=a.href||a.getAttribute('href')||''; const cm=href.match(/\/club-royale\/offers\/([^?/#]+)/i); if (!cm) return; const code=canonicalOfferCode(cm[1]); if (!code) return; const txt=cleanText((a.closest('article,section,div')||a).textContent||a.textContent||''); const parsed=parseOfferFromText(txt || code, idx+1); parsed.offerCode=code; parsed.detailUrl=href; parsed.playerOfferId=extractPlayerOfferId(href); if (!byCode.has(code)) byCode.set(code, parsed); });
    buttons.forEach((btn,idx)=>{ const card=getCardForButton(btn); const txt=cleanText(card.textContent||''); const parsed=parseOfferFromText(txt, idx+1); if (!parsed.offerCode) return; parsed.buttonIndex=idx; const link=card.querySelector('a[href*="/club-royale/offers/"]'); if (link) { parsed.detailUrl=link.href||link.getAttribute('href')||''; parsed.playerOfferId=extractPlayerOfferId(parsed.detailUrl); } if (!byCode.has(parsed.offerCode)) byCode.set(parsed.offerCode, parsed); });
    // whole-page fallback for current card shape: Name Code Description Redeem by Date
    const page=cleanText(document.body && document.body.textContent || ''); const re=/([A-Z][A-Za-z0-9 '&-]{2,80})\s+(\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)\s+(.{0,260}?)\s+Redeem\s+by\s+([A-Za-z]{3,9}\s+\d{1,2},\s+20\d{2})/g; let m;
    while ((m=re.exec(page))!==null){ const code=canonicalOfferCode(m[2]); if (!byCode.has(code)) byCode.set(code, { offerName:normalizeOfferName(m[1]), offerCode:code, perks:cleanText(m[3]), offerExpirationDate:m[4], cabinType:inferCabin(m[3]), numberOfGuests:inferGuests(m[3]) }); }
    return Array.from(byCode.values()).filter(o=>o.offerCode && !/club royale|crown|anchor|benefits/i.test(o.offerName));
  }
  async function fetchText(url){
    try { const res=await fetch(url, { method:'GET', credentials:'include', headers:{ accept:'text/x-component, text/html, application/json, */*' } }); const text=await res.text(); log('GET '+url.replace(location.origin,'')+' — '+res.status+' — '+text.length+' byte(s)', res.ok?'info':'warning'); return res.ok ? text : ''; } catch(e){ log('GET failed '+url+': '+e.message, 'warning'); return ''; }
  }
  async function fetchJson(url){
    try { const res=await fetch(url, { method:'GET', credentials:'include', headers:{ accept:'application/json, text/plain, */*' } }); const text=await res.text(); log('GET '+url.replace(location.origin,'')+' — '+res.status+' — '+text.length+' byte(s)', res.ok?'info':'warning'); if (!res.ok || !text) return null; try { return JSON.parse(text); } catch(e){ return { __text:text }; } } catch(e){ log('GET failed '+url+': '+e.message, 'warning'); return null; }
  }
  async function fetchV2Rows(offers){
    const rows=[]; const urls=['/api/casino/v2/offers/merged','/api/casino/v2/offers/facets'];
    for (const u of urls){ const payload=await fetchJson(u); if (!payload) continue; for (const offer of offers){ rows.push(...collectRowsFromJson(payload, offer, 'royal-v2-api', location.origin+u, 0)); if (payload.__text) rows.push(...extractRowsFromText(payload.__text, offer, 'royal-v2-text', location.origin+u)); } }
    return rows;
  }
  async function fetchRscRows(offers){
    const rows=[]; const pageLinks=Array.from(document.querySelectorAll('a[href*="/club-royale/offers/"]')).map(a=>a.href||a.getAttribute('href')||'').filter(Boolean);
    for (let i=0;i<offers.length;i++){
      const offer=offers[i]; const code=canonicalOfferCode(offer.offerCode); const urls=[];
      if (offer.detailUrl) urls.push(offer.detailUrl);
      pageLinks.filter(h=>h.includes('/club-royale/offers/'+code)).forEach(h=>urls.push(h));
      if (offer.playerOfferId) urls.push(location.origin + '/club-royale/offers/' + code + '?redirect=%2Foffers%2F&country=USA&playerOfferId=' + encodeURIComponent(offer.playerOfferId));
      urls.push(location.origin + '/club-royale/offers/' + code + '?redirect=%2Foffers%2F&country=USA');
      urls.push(location.origin + '/club-royale/offers/' + code);
      const unique=[...new Set(urls.filter(Boolean))];
      log('Live RSC offer fetch '+(i+1)+'/'+offers.length+': '+(offer.offerName||code)+' ('+code+') — '+unique.length+' candidate URL(s)', 'info');
      for (const url of unique){ const text=await fetchText(url); if (!text) continue; let countBefore=rows.length; try { const json=JSON.parse(text); rows.push(...collectRowsFromJson(json, offer, 'royal-rsc-json', url, 0)); } catch(e) {} rows.push(...extractRowsFromText(text, offer, 'royal-rsc', url)); if (rows.length > countBefore) break; }
    }
    return rows;
  }
  function currentOfferListUrl(){ return location.origin + '/club-royale/offers'; }
  async function ensureOffersList(){
    if (/\/club-royale\/offers\/?(?:\?|#)?$/i.test(location.pathname + location.search)) return true;
    try { history.pushState(null, '', currentOfferListUrl()); window.dispatchEvent(new PopStateEvent('popstate')); await wait(1800); } catch(e){}
    if (!/\/club-royale\/offers\/?(?:\?|#)?$/i.test(location.pathname + location.search)) {
      location.href = currentOfferListUrl();
      await wait(5000);
    }
    return true;
  }
  function findOfferButton(offer, fallbackIndex){
    const code=canonicalOfferCode(offer.offerCode);
    const buttons=getViewButtons();
    for (const b of buttons){
      const card=getCardForButton(b);
      const txt=cleanText(card.textContent||'');
      if (code && txt.toUpperCase().includes(code)) return b;
    }
    return buttons[fallbackIndex] || null;
  }
  async function expandDetailRows(){
    for (let pass=0; pass<3; pass++){
      const expanders=Array.from(document.querySelectorAll('button,a')).filter(el => /View\s+details|Show\s+details|View\s+more/i.test(cleanText(el.textContent||el.getAttribute('aria-label')||'')));
      if (!expanders.length) break;
      for (const el of expanders.slice(0,25)){
        try { el.scrollIntoView({ block:'center' }); await wait(120); el.click(); await wait(300); } catch(e){}
      }
      await wait(900);
    }
  }
  async function clickDomRows(offers){
    const rows=[];
    for (let i=0;i<offers.length;i++){
      const offer=offers[i];
      try {
        await ensureOffersList();
        await wait(1200);
        const button=findOfferButton(offer, i);
        if (!button) { log('DOM detail parse skipped for '+offer.offerCode+': matching View Sailings button not found', 'warning'); continue; }
        log('👆 Opening View Sailings for '+offer.offerName+' ('+canonicalOfferCode(offer.offerCode)+') '+(i+1)+'/'+offers.length, 'info');
        button.scrollIntoView({ block:'center' }); await wait(350); button.click(); await wait(4500);
        await expandDetailRows();
        const body=cleanText(document.body && document.body.textContent || '');
        const before=rows.length;
        rows.push(...extractRowsFromText(body, offer, 'dom-detail', location.href));
        log('DOM detail parse for '+offer.offerName+': '+(rows.length-before)+' live ship/date row(s)', rows.length>before?'success':'warning');
        try { history.back(); await wait(1800); } catch(e) {}
      } catch(e){ log('DOM detail parse failed for '+offer.offerName+': '+e.message, 'warning'); }
    }
    return rows;
  }
  function logCounts(rows, offers){
    const map=new Map(); rows.forEach(r=>{ const code=canonicalOfferCode(r.offerCode); const cur=map.get(code)||{name:r.offerName||code,count:0}; cur.count++; map.set(code,cur); });
    offers.forEach(o=>{ const code=canonicalOfferCode(o.offerCode); const cur=map.get(code)||{name:o.offerName||code,count:0}; log((cur.count>0?'✅':'❌')+' Live offer count: '+cur.name+' ('+code+') — '+cur.count+' cruise row(s)', cur.count>0?'success':'error'); });
  }
  async function extractOffers(){
    try {
      log('🛠️ Offer sync engine '+ENGINE_VERSION+' active: Royal v2 merged + direct offer-detail DOM parser + grouped-date expansion; no CSV fallback', 'info');
      log('Loading Club Royale Offers page...', 'info');
      await wait(6000);
      const buttons=getViewButtons(); const offers=parseVisibleOffers();
      log('DOM/RSC discovery: parsed '+offers.length+' visible offer card(s), found '+buttons.length+' View Sailings button(s)', offers.length?'success':'warning');
      if (!offers.length){ log('❌ No visible Royal offer cards/codes found. Existing data will be preserved.', 'error'); sendRows([],0); return; }
      let rows=[];
      rows.push(...await fetchV2Rows(offers));
      rows.push(...await fetchRscRows(offers));
      rows.push(...await clickDomRows(offers));
      rows=dedupeRows(rows);
      logCounts(rows, offers);
      const realCodes=new Set(rows.map(r=>canonicalOfferCode(r.offerCode)).filter(Boolean));
      const missing=offers.map(o=>canonicalOfferCode(o.offerCode)).filter(Boolean).filter(c=>!realCodes.has(c));
      if (missing.length){ log('❌ STEP 1 LIVE SCRAPE INCOMPLETE: visible offer code(s) returned 0 valid ship/date rows: '+[...new Set(missing)].join(', ')+'. No local fallback will be used.', 'error'); }
      rows.forEach((r,idx)=>{ if (idx<10) log('Accepted live row: '+canonicalOfferCode(r.offerCode)+' | '+r.shipName+' | '+r.sailingDate, 'success'); });
      sendRows(rows, offers.length);
      log((rows.length && !missing.length ? '✅' : '❌')+' STEP 1 LIVE COMPLETE: captured '+offers.length+' visible offer(s) with '+rows.length+' individual live cruise row(s)', rows.length && !missing.length ? 'success' : 'error');
    } catch(e){ log('❌ Step 1 live scraper failed: '+(e&&e.message?e.message:String(e)), 'error'); sendRows([],0); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', extractOffers); else extractOffers();
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false) {
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};

${STEP1_OFFERS_SCRIPT}
`;
}
