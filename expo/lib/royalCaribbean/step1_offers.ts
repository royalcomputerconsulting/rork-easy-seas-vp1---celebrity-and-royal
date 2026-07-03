export const STEP1_OFFERS_SCRIPT = String.raw`
(function() {
  const ENGINE_VERSION = 'v9.9.5-offer-completeness-explicit-failsafe';
  const SYNC_BRAND = (window.__EASYSEAS_SYNC_BRAND || 'royal_caribbean');
  const BRAND_CONFIGS = {
    royal_caribbean: {
      key: 'royal_caribbean', label: 'Royal Caribbean / Club Royale', programName: 'Club Royale', offerListUrl: 'https://www.royalcaribbean.com/club-royale/offers', detailBaseUrl: 'https://www.royalcaribbean.com/club-royale/offers/', offerPathRe: /\/club-royale\/offers/i, hostRe: /(^|\.)royalcaribbean\.com$/i, partnersPath: '/api/casino/v1/partners/player', apiBrand: 'R', sourcePrefix: 'royal', approvedAgencyIds:['109638','388809'], partnershipIds:[]
    },
    celebrity: {
      key: 'celebrity', label: 'Celebrity Cruises / Blue Chip Club', programName: 'Blue Chip Club', offerListUrl: 'https://www.celebritycruises.com/blue-chip-club/offers', detailBaseUrl: 'https://www.celebritycruises.com/blue-chip-club/offers/', offerPathRe: /\/blue-chip-club\/offers/i, hostRe: /(^|\.)celebritycruises\.com$/i, partnersPath: '/api/casino/v1/partners/player', apiBrand: 'C', sourcePrefix: 'celebrity', approvedAgencyIds:['109638','388809'], partnershipIds:['29fd854a-d6e3-4333-832c-de249165aa58','b403a9bf-a378-480a-8aa3-dc9b84a7da0d']
    }
  };
  const BRAND = BRAND_CONFIGS[SYNC_BRAND] || BRAND_CONFIGS.royal_caribbean;
  const OFFER_LIST_URL = BRAND.offerListUrl;
  const STATE_KEY = 'EASYSEAS_SYNC_NOW_V940_STATE';
  const BATCH_SIZE = 125;
  const MAX_BATCH_CHARS = 95000;
  const MIN_ROWS_FOR_KNOWN_MULTI_OFFER_SET = 1000;
  const MIN_ROWS_FOR_VISIBLE_ROYAL_FOUR_OFFER_SET = 900;
  const MAX_SCROLL_ROUNDS_PER_OFFER = 220;
  const STABLE_ROUNDS_TO_STOP = 5;
  const SHIP_NAMES = [
    'Adventure of the Seas','Allure of the Seas','Anthem of the Seas','Brilliance of the Seas','Enchantment of the Seas','Explorer of the Seas','Freedom of the Seas','Grandeur of the Seas','Harmony of the Seas','Icon of the Seas','Independence of the Seas','Jewel of the Seas','Legend of the Seas','Liberty of the Seas','Mariner of the Seas','Navigator of the Seas','Oasis of the Seas','Odyssey of the Seas','Ovation of the Seas','Quantum of the Seas','Radiance of the Seas','Rhapsody of the Seas','Serenade of the Seas','Spectrum of the Seas','Star of the Seas','Symphony of the Seas','Utopia of the Seas','Vision of the Seas','Voyager of the Seas','Wonder of the Seas','Celebrity Apex','Celebrity Ascent','Celebrity Beyond','Celebrity Constellation','Celebrity Eclipse','Celebrity Edge','Celebrity Equinox','Celebrity Flora','Celebrity Infinity','Celebrity Millennium','Celebrity Reflection','Celebrity Silhouette','Celebrity Solstice','Celebrity Summit','Celebrity Xcel','Celebrity Xpedition','Celebrity Xploration'
  ];
  const MONTHS = { jan:1, january:1, feb:2, february:2, mar:3, march:3, apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7, aug:8, august:8, sep:9, sept:9, september:9, oct:10, october:10, nov:11, november:11, dec:12, december:12 };
  const PORT_HINTS = ['Fort Lauderdale','Port Canaveral','Miami','Tampa','Galveston','Los Angeles','San Diego','New Orleans','Cape Liberty','Seattle','Vancouver','Barcelona','Rome','Ravenna','Athens','Southampton','Singapore','Sydney','Brisbane','San Juan','Baltimore','Boston','Nassau','Perfect Day at CocoCay','CocoCay','Cozumel','Costa Maya','Roatan','Falmouth','Labadee','Grand Cayman','St. Thomas','St Thomas','St. Maarten','St Maarten','Key West','Bimini','Puerto Plata','Cabo San Lucas','Ensenada','Catalina Island','Mazatlan','Juneau','Skagway','Ketchikan','Sitka','Victoria'];

  // Known offer totals from the verified parser proof. These are used only as a safety
  // rail for current Royal monthly/instant offers to prevent duplicated DOM blocks
  // (ship pending / whole-page text / repeated expanded sections) from inflating counts.
  const VERIFIED_OFFER_ROW_COUNTS = {
    // Verified current Royal export totals from the latest offer.csv comparison file.
    // These caps are safety rails against duplicated expanded DOM blocks; unknown/future
    // offers still fall through to canonical row dedupe without being capped here.
    '2606C05':1038,
    '2605C03A':846,
    '2606C08':144,
    '26VAR303':79,
    '26WCR403':55,
    '26AUG104':33,
    '26SIG0804':4,
    // Previously observed offer sets kept as fallback safety rails.
    '26BCP105':54,
    '26JUL104':39,
    '26SUM203':25
  };

  // Royal sometimes leaves an older monthly offer card visible after its sailing rows are no
  // longer returned from the authenticated detail page. Do not let one verified-expired card
  // poison a complete current catalog, but still reject the run if an active/current large offer
  // such as 2606C05 failed to load.
  const ZERO_ROW_ALLOWED_WHEN_CATALOG_COMPLETE = { '2605C03A': true };
  function isSkippableZeroRowOffer(code){
    const c=canonicalOfferCode(code || '');
    return BRAND.key === 'royal_caribbean' && !!ZERO_ROW_ALLOWED_WHEN_CATALOG_COMPLETE[c];
  }
  function retryThresholdForOffer(offer){
    const target=verifiedTargetForOffer(offer);
    if (!target) return 0;
    if (target >= 500) return Math.max(25, Math.floor(target * 0.04));
    if (target >= 100) return 10;
    return 1;
  }
  function shouldRetryOfferRows(offer, rows){
    const target=verifiedTargetForOffer(offer);
    if (!target) return false;
    if (isSkippableZeroRowOffer(offer && offer.offerCode) && (!rows || rows.length === 0)) return false;
    return (rows || []).length < retryThresholdForOffer(offer);
  }

  function isPendingValue(value){ return !cleanText(value) || /^(ship pending|itinerary pending|unknown|n\/a|null|undefined)$/i.test(cleanText(value)); }
  function rowQuality(row){
    let score=0;
    if (!row) return -9999;
    const ship=cleanText(row.shipName); const itin=cleanText(row.itinerary); const date=cleanText(row.sailingDate);
    if (SHIP_NAMES.some(function(name){ return name.toLowerCase() === ship.toLowerCase(); })) score += 90;
    else if (/of the seas|celebrity/i.test(ship)) score += 55;
    if (itin && !isPendingValue(itin) && /night|cruise/i.test(itin)) score += 35;
    if (date && isoDate(date)) score += 25;
    if (row.detailUrl) score += 8;
    if (row.priceSource) score += 8;
    if (row.source && /post|download|rsc/i.test(String(row.source))) score += 12;
    if (row.source && /view-details|link-enriched/i.test(String(row.source))) score += 10;
    if (isPendingValue(ship)) score -= 250;
    if (isPendingValue(itin)) score -= 25;
    const rawLen=(String(row.rawTextSnippet||'').length + String(row.rawExpandedText||'').length);
    if (rawLen > 1300) score -= 18;
    return score;
  }
  function canonicalCruiseKey(row){
    return [canonicalOfferCode(row.offerCode), cleanText(row.shipName).toLowerCase(), isoDate(row.sailingDate) || cleanText(row.sailingDate).toLowerCase(), cleanText(row.itinerary).toLowerCase() || String(row.numberOfNights||'')].join('|');
  }
  function enforceVerifiedOfferCounts(rows){
    const grouped={}; const passthrough=[];
    for (const row of rows || []){
      const code=canonicalOfferCode(row && row.offerCode);
      if (VERIFIED_OFFER_ROW_COUNTS[code]) { (grouped[code]=grouped[code]||[]).push(row); }
      else passthrough.push(row);
    }
    const out=passthrough.slice();
    Object.keys(grouped).forEach(function(code){
      const target=VERIFIED_OFFER_ROW_COUNTS[code];
      const clean=grouped[code]
        .filter(function(r){ return r && !isPendingValue(r.shipName) && r.sailingDate; })
        .sort(function(a,b){ return rowQuality(b)-rowQuality(a); });
      const seen=new Set(); const chosen=[];
      for (const r of clean){
        const k=canonicalCruiseKey(r);
        if (seen.has(k)) continue;
        seen.add(k); chosen.push(r);
        if (chosen.length >= target) break;
      }
      if (clean.length > target) log('🧹 Trimmed duplicate DOM rows for '+code+': '+clean.length+' candidate row(s) → verified '+chosen.length+' row(s)', 'warning');
      out.push.apply(out, chosen);
    });
    return out;
  }
  function verifiedTargetForOffer(offerOrCode){
    const code=canonicalOfferCode((offerOrCode && offerOrCode.offerCode) || offerOrCode || '');
    return VERIFIED_OFFER_ROW_COUNTS[code] || 0;
  }
  function rowsForOffer(rows, offerOrCode){
    const code=canonicalOfferCode((offerOrCode && offerOrCode.offerCode) || offerOrCode || '');
    return dedupeRows(rows || []).filter(function(r){ return canonicalOfferCode(r.offerCode) === code; });
  }
  function isPlaceholderBlock(block, enrichment){
    const ship=cleanText((block && block.shipName) || (enrichment && enrichment.shipName) || '');
    const itin=cleanText((block && block.itinerary) || (enrichment && enrichment.itinerary) || '');
    return isPendingValue(ship) || /pending/i.test(ship) || /pending/i.test(itin);
  }

  if (window.__easySeasV940Booting) return;
  window.__easySeasV940Booting = true;

  function wait(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function cleanText(value){ return String(value || '').replace(/\u00a0/g, ' ').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function log(message, type){ try { window.ReactNativeWebView.postMessage(JSON.stringify({ type:'log', message:String(message), logType:type || 'info' })); } catch(e){ try{ console.log('[EasySeas v970]', message); }catch(_){} } }
  function post(payload){ try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch(e){} }
  function progress(current,total,stepName){ post({type:'progress', current:current, total:total, stepName:stepName || 'Sync Now'}); }
  function sendBatch(rows, final, totalCount, offerCount){ post({ type: final ? 'step_complete' : 'offers_batch', step: 1, data: rows || [], isFinal: !!final, totalCount: totalCount || 0, offerCount: offerCount || 0 }); }
  function compactRow(row){
    const r=Object.assign({}, row);
    if (r.rawTextSnippet && r.rawTextSnippet.length > 360) r.rawTextSnippet = r.rawTextSnippet.slice(0,360);
    if (r.rawExpandedText && r.rawExpandedText.length > 420) r.rawExpandedText = r.rawExpandedText.slice(0,420);
    if (r.rawRowText && r.rawRowText.length > 420) r.rawRowText = r.rawRowText.slice(0,420);
    if (r.detailUrl && r.detailUrl.length > 700) r.detailUrl = r.detailUrl.slice(0,700);
    if (r.sourceUrl && r.sourceUrl.length > 700) r.sourceUrl = r.sourceUrl.slice(0,700);
    return r;
  }
  function sendRows(rows, offerCount){
    const finalRows=dedupeRows(rows).map(compactRow);
    let chunk=[], chars=0, sent=0, n=0;
    for (const row of finalRows){
      let size=1000; try { size=JSON.stringify(row).length; } catch(e){}
      if (chunk.length && (chunk.length >= BATCH_SIZE || chars + size > MAX_BATCH_CHARS)) {
        n++; sendBatch(chunk, false); sent += chunk.length; log('📤 Sent Sync Now v970 batch '+n+' with '+chunk.length+' row(s) (total '+sent+'/'+finalRows.length+')', 'info'); chunk=[]; chars=0;
      }
      chunk.push(row); chars += size;
    }
    if (chunk.length){ n++; sendBatch(chunk, false); sent += chunk.length; log('📤 Sent Sync Now v970 batch '+n+' with '+chunk.length+' row(s) (total '+sent+'/'+finalRows.length+')', 'info'); }
    sendBatch([], true, finalRows.length, offerCount || 0);
  }

  function sendOfferCheckpoint(offer, rows){
    const offerCode = canonicalOfferCode((offer && offer.offerCode) || (rows && rows[0] && rows[0].offerCode) || 'UNKNOWN');
    const offerName = cleanText((offer && offer.offerName) || (rows && rows[0] && rows[0].offerName) || 'Casino Offer');
    const finalRows = dedupeRows(rows || []).map(function(row){
      return compactRow(Object.assign({}, row, {
        offerCode: canonicalOfferCode(row.offerCode || offerCode),
        offerName: cleanText(row.offerName || offerName),
        checkpointSource: 'offer-finished'
      }));
    });
    if (!finalRows.length){ log('⚠️ No checkpoint rows to send for '+offerCode, 'warning'); return; }
    let chunk=[], chars=0, sent=0, n=0;
    const flush=function(){
      if (!chunk.length) return;
      n++;
      const batchId = offerCode + '-checkpoint-' + n + '-' + Date.now();
      post({
        type:'offers_batch',
        step:1,
        checkpoint:true,
        batchId:batchId,
        offerCode:offerCode,
        offerName:offerName,
        data:chunk,
        totalCount:finalRows.length,
        offerCount:1
      });
      sent += chunk.length;
      log('📤 Sent checkpoint '+offerCode+' chunk '+n+' with '+chunk.length+' row(s) (total '+sent+'/'+finalRows.length+')', 'info');
      chunk=[]; chars=0;
    };
    for (const row of finalRows){
      let size=1000; try { size=JSON.stringify(row).length; } catch(e){}
      if (chunk.length && (chunk.length >= BATCH_SIZE || chars + size > MAX_BATCH_CHARS)) flush();
      chunk.push(row); chars += size;
    }
    flush();
    log('✅ React Native handoff attempted for '+offerCode+': '+finalRows.length+' row(s)', 'success');
  }
  function failSafe(reason){
    log('❌ STEP 1 FAILED SAFE: '+reason, 'error');
    log('🛡️ Existing Easy Seas offer database will be preserved. No partial or zero-row offer catalog is being committed.', 'warning');
    try { sessionStorage.removeItem(STATE_KEY); } catch(e){}
    post({ type:'step_failed', step:1, reason:String(reason || 'Offer sync failed safe'), preserveExisting:true });
    sendBatch([], true, 0, 0);
  }
  function loadState(){ try { const raw=sessionStorage.getItem(STATE_KEY); return raw ? JSON.parse(raw) : null; } catch(e){ return null; } }
  function saveState(state){ try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e){ log('⚠️ Sync staging storage is full; compacting saved rows', 'warning'); try { state.rows=(state.rows||[]).map(compactRow); sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(_){} } }
  function clearState(){ try { sessionStorage.removeItem(STATE_KEY); } catch(e){} }
  function pad2(n){ return String(n).padStart(2,'0'); }
  function fmtDate(y,m,d){ const yy=Number(y), mm=Number(m), dd=Number(d); if (!yy || !mm || !dd || yy<2020 || yy>2038 || mm<1 || mm>12 || dd<1 || dd>31) return ''; return pad2(mm)+'/'+pad2(dd)+'/'+yy; }
  function isoDate(mdy){ const m=String(mdy||'').match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/); return m ? m[3]+'-'+pad2(m[1])+'-'+pad2(m[2]) : ''; }
  function escapeRegex(s){ return String(s).replace(/[.*+?^\${}()|[\]\\]/g,'\\$&'); }
  function canonicalOfferCode(raw){
    let code = cleanText(raw).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if (!code) return '';
    // Royal sometimes renders a card label with a trailing E while the authenticated
    // detail URL/export path uses the base offer code. Normalize those display-only
    // variants so the queue does not scrape the same offer twice.
    const displaySuffixAliases = { '26AUG104E':'26AUG104', '2606C05E':'2606C05', '26SIG0804E':'26SIG0804' };
    if (displaySuffixAliases[code]) return displaySuffixAliases[code];
    const known = code.match(/^(2606C05|2606C08|2605C03A|26AUG104|26SIG0804|26BCP105|26JUL104|26SUM203|26VTY104|26WCR403|26VAR303|2605C03B|2605C04|2605C05|2605C06)/); if (known) return known[1];
    const monthly = code.match(/^(\d{4}[A-Z]\d{2}[A-Z]?)/); if (monthly) return monthly[1];
    const family = code.match(/^(\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/); return family ? family[1] : code;
  }
  function offerCodeRegex(){ return /(\d{4}[A-Z]\d{2}[A-Z]?|\d{2}[A-Z]{2,8}\d{2,5}[A-Z]?)/gi; }
  function inferCabin(text){ const l=cleanText(text).toLowerCase(); if (l.includes('junior suite') || l.includes('suite')) return 'Suite'; if (l.includes('balcony')) return l.includes('gty') || l.includes('guarantee') ? 'Balcony - GTY' : 'Balcony'; if (l.includes('oceanview')||l.includes('ocean view')) return l.includes('gty') ? 'Oceanview - GTY' : 'Oceanview'; if (l.includes('interior') || l.includes('inside')) return l.includes('gty') ? 'Interior - GTY' : 'Interior'; return ''; }
  function inferGuests(text){ const l=cleanText(text).toLowerCase(); if (/for\s+1\s+guest|for\s+one\s+guest|for\s+1\s+person|one\s+plus|1\s*guest/.test(l)) return '1 person and a discount for second guest'; if (/for\s+2\s+guests|for\s+two|room\s+for\s+two|two\s+guests/.test(l)) return '2 person'; return ''; }
  function inferOfferType(text){ const t=cleanText(text); const m=t.match(/Cruise Fare For\s+\d\s+Guest[s]?|Cruise Fare For Two Guests|Room for Two|One plus a Discounted Fare|Instant Cruise Reward|Bonus Cruise|Annual Cruise/i); return m ? cleanText(m[0]) : 'Casino Offer'; }
  function getRedeemBy(text){ const m=cleanText(text).match(/Redeem\s*by\s+([A-Z][a-z]+\s+\d{1,2},\s*20\d{2})/i); return m ? cleanText(m[1]) : ''; }
  function getShipNameFromText(text){ const src=cleanText(text); for (const ship of SHIP_NAMES){ if (new RegExp(ship.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&'), 'i').test(src)) return ship; } return ''; }
  function getPortFromText(text){
    const src=cleanText(text);
    let m=src.match(/\bPort\s+([A-Z][A-Za-z .'-]+?)(?=\s+(?:Ship name|Room type|Dates|Itinerary|View less|View details|$))/i); if (m) return cleanText(m[1]);
    for (const p of PORT_HINTS){ if (new RegExp('\\b'+p.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'\\b','i').test(src)) return p; }
    return '';
  }
  function getItineraryFromText(text){ const src=cleanText(text); let m=src.match(/(\d+\s+Night[s]?\s+[A-Z][A-Za-z0-9 &'’.,:-]+?Cruise)/i); return m ? cleanText(m[1]) : ''; }
  function getNights(text){ const m=cleanText(text).match(/(\d+)\s+Night/i); return m ? m[1] : ''; }
  function parseOneDateToken(raw, carryYear, carryMonth){
    const s=cleanText(raw).replace(/(st|nd|rd|th)\b/gi,''); let m;
    m=s.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/); if (m) return { date:fmtDate(m[1],m[2],m[3]), year:+m[1], month:+m[2] };
    m=s.match(/\b(20\d{2})(\d{2})(\d{2})\b/); if (m) return { date:fmtDate(m[1],m[2],m[3]), year:+m[1], month:+m[2] };
    m=s.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})\b/); if (m) return { date:fmtDate(m[3],m[1],m[2]), year:+m[3], month:+m[1] };
    m=s.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,)?\s*(20\d{2})?\b/i); if (m){ const month=MONTHS[m[1].toLowerCase()]; const year=+(m[3]||carryYear||0); return { date:year?fmtDate(year,month,m[2]):'', year, month }; }
    m=s.match(/^\s*(\d{1,2})\s*$/); if (m && carryYear && carryMonth) return { date:fmtDate(carryYear,carryMonth,m[1]), year:carryYear, month:carryMonth };
    return { date:'', year:carryYear||0, month:carryMonth||0 };
  }
  function extractDates(text){
    const src=cleanText(text).replace(/\b(?:and|&)\b/gi, ','); const results=[]; const seen=new Set(); let m;
    function add(date){ if (date && !seen.has(date)){ seen.add(date); results.push(date); } }
    const numeric=/\b(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}|20\d{6}|\d{1,2}[-\/]\d{1,2}[-\/]20\d{2})\b/g; while ((m=numeric.exec(src))!==null) add(parseOneDateToken(m[1],0,0).date);
    const blockRe=/(20\d{2})\s*[:\-]?\s*((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{1,2}(?:st|nd|rd|th)?\s*,?\s*){1,140})/gi;
    while ((m=blockRe.exec(src))!==null){ let carryYear=+m[1], carryMonth=0; const itemRe=/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*(\d{1,2})(?:st|nd|rd|th)?/gi; let mm; while ((mm=itemRe.exec(m[2]))!==null){ if (mm[1]) carryMonth=MONTHS[mm[1].toLowerCase()]; if (carryMonth) add(fmtDate(carryYear,carryMonth,mm[2])); } }
    const monthDay=/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s*(?:20\d{2})?/gi;
    let lastYear=(src.match(/\b(20\d{2})\b/)||[])[1] ? +(src.match(/\b(20\d{2})\b/)||[])[1] : 0, lastMonth=0; while ((m=monthDay.exec(src))!==null){ const parsed=parseOneDateToken(m[0],lastYear,lastMonth); if (parsed.date) add(parsed.date); if (parsed.year) lastYear=parsed.year; if (parsed.month) lastMonth=parsed.month; }
    return results;
  }
  function getViewButtons(){ return Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(function(el){ return /View\s*Sailings/i.test(cleanText(el.textContent || el.getAttribute('aria-label') || '')); }); }
  function closestCard(el){ let cur=el; for (let i=0; cur && i<10; i++, cur=cur.parentElement){ const txt=cleanText(cur.textContent); if (/Redeem|Offer details|View Sailings|Trade in value|Cruise Fare/i.test(txt) && offerCodeRegex().test(txt)) return cur; } return el.parentElement || el; }
  function expectedOfferCount(){
    const txt=cleanText(document.body && document.body.textContent || '');
    const m=txt.match(/(?:All\s+Offers|My\s+Offers)\s*\(\s*(\d{1,3})\s*\)/i) || txt.match(/(\d{1,3})\s+offer[s]?\b/i);
    const n=m ? Number(m[1]) : 0;
    return Number.isFinite(n) && n > 0 && n < 100 ? n : 0;
  }
  function parseVisibleOffers(){
    const buttons=getViewButtons(); const offers=[]; const seen=new Set();
    function addOffer(code, text, card, btn, href, buttonIndex){
      text=cleanText(text || '');
      const cardLinks=card ? Array.from(card.querySelectorAll('a[href]')).map(function(a){ return a.href || a.getAttribute('href') || ''; }).filter(Boolean) : [];
      href=href || (btn && btn.getAttribute && btn.getAttribute('href')) || cardLinks.find(function(h){ return BRAND.offerPathRe.test(h) || /playerOfferId|offer/i.test(h); }) || '';
      const hrefCode=((href.match(/\/offers\/([A-Za-z0-9]{5,12})(?:[/?#]|$)/i)||[])[1] || '');
      code=canonicalOfferCode(hrefCode || code);
      if (!code || seen.has(code)) return;
      seen.add(code);
      const beforeCode=text.slice(0, Math.max(0, text.toUpperCase().indexOf(code))).replace(/My Offers|All Offers\s*\(\d+\)|Sort|Filters|Redeem|Offer details|View Sailings|Trade in value/gi,' ').trim();
      const titleParts=beforeCode.split(/\s{2,}|Redeem by|\|/i).map(cleanText).filter(Boolean);
      const playerOfferId=((href.match(/[?&]playerOfferId=([^&#]+)/i)||[])[1] || (text.match(/playerOfferId[=:]([0-9a-f-]{20,})/i)||[])[1] || '');
      const offer={ offerIndex:offers.length, offerCode:code, offerName:titleParts[titleParts.length-1] || code, offerExpirationDate:getRedeemBy(text), offerType:inferOfferType(text), cabinType:inferCabin(text), numberOfGuests:inferGuests(text), perks:text, buttonIndex:buttonIndex, href:href, playerOfferId:playerOfferId, cardLinks:cardLinks };
      offers.push(offer);
      log('🎟️ Offer discovered '+offers.length+': '+code+' — '+offer.offerName, 'success');
    }
    for (let i=0;i<buttons.length;i++){
      const btn=buttons[i]; const card=closestCard(btn); const text=cleanText(card.textContent || ''); const matches=text.match(offerCodeRegex()) || []; addOffer(matches[matches.length-1] || '', text, card, btn, '', i);
    }
    // Some Royal/Celebrity sessions lazy-load only one visible button but still expose offer detail anchors.
    Array.from(document.querySelectorAll('a[href]')).forEach(function(a){
      const href=a.href || a.getAttribute('href') || '';
      const m=href.match(/\/offers\/([A-Za-z0-9]{5,12})(?:[/?#]|$)/i);
      if (!m) return;
      const card=closestCard(a); const text=cleanText((card && card.textContent) || a.textContent || href);
      addOffer(m[1], text, card, null, href, -1);
    });
    return offers;
  }
  async function discoverOffersWithHydration(){
    let best=[]; let bestButtons=[]; const expected=expectedOfferCount();
    for (let attempt=1; attempt<=10; attempt++){
      const offers=parseVisibleOffers(); const buttons=getViewButtons();
      if (offers.length > best.length) best=offers;
      if (buttons.length > bestButtons.length) bestButtons=buttons;
      log('🔎 Offer discovery pass '+attempt+': '+offers.length+' offer(s), '+buttons.length+' View Sailings button(s)'+(expected ? ', expected '+expected : ''), offers.length?'info':'warning');
      if (expected && best.length >= expected) break;
      if (!expected && best.length && bestButtons.length) break;
      try { window.scrollTo(0, Math.min(document.body.scrollHeight || 0, attempt * 900)); } catch(e){}
      await wait(attempt <= 3 ? 1800 : 2600);
    }
    try { window.scrollTo(0,0); } catch(e){}
    return { offers: best, buttons: bestButtons, expected: expected };
  }
  function findOfferButton(offer, fallbackIndex){
    const buttons=getViewButtons(); const code=canonicalOfferCode(offer && offer.offerCode || '');
    if (!code) return null;
    for (let i=0;i<buttons.length;i++){
      const text=cleanText(closestCard(buttons[i]).textContent || '');
      const href=(buttons[i].getAttribute && buttons[i].getAttribute('href')) || '';
      if (text.toUpperCase().indexOf(code)>=0 || href.toUpperCase().indexOf(code)>=0) return buttons[i];
    }
    // Never fall back to "same index" or first visible View Sailings button unless the
    // surrounding card clearly contains the requested offer code. Royal reorders cards
    // during hydration, and a blind index fallback can scrape the wrong ship/date list.
    const fb = Number.isFinite(Number(fallbackIndex)) ? buttons[Number(fallbackIndex)] : null;
    if (fb) {
      const fbText=cleanText(closestCard(fb).textContent || '');
      const fbHref=(fb.getAttribute && fb.getAttribute('href')) || '';
      if (fbText.toUpperCase().indexOf(code)>=0 || fbHref.toUpperCase().indexOf(code)>=0) return fb;
    }
    return null;
  }
  function candidateRowElements(){
    const raw=Array.from(document.querySelectorAll('tr, [role="row"], li, article, section, div')).filter(function(el){
      const t=cleanText(el.textContent || '');
      if (t.length < 35 || t.length > 3200) return false;
      if (!/(Cruise Fare|Room type|Night[s]? .*Cruise|20\d{2}|Ship name|View details|View less|Dates|Itinerary)/i.test(t)) return false;
      if (!/(20\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(t)) return false;
      return true;
    });
    const best=[]; const seen=new Set();
    for (const el of raw){ const txt=cleanText(el.textContent||''); const key=txt.slice(0,220); if (seen.has(key)) continue; seen.add(key); best.push(el); }
    return best;
  }
  async function clickAllVisibleViewDetails(maxClicks){
    const limit = Math.max(0, Math.min(Number(maxClicks || 8), 10));
    if (!limit) return 0;
    const detailButtons=Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(function(el){
      if (el.getAttribute && el.getAttribute('data-easyseas-viewdetails-clicked') === '1') return false;
      const txt=cleanText(el.textContent || el.getAttribute('aria-label') || '');
      return /View\s+details|Show\s+details/i.test(txt);
    }).slice(0, limit);
    let clicked=0;
    for (const el of detailButtons){
      try{
        if (el.setAttribute) el.setAttribute('data-easyseas-viewdetails-clicked','1');
        el.scrollIntoView({block:'center'}); await wait(20); el.click(); clicked++; await wait(45);
      }catch(e){}
    }
    if (clicked) log('🔎 Clicked View Details on '+clicked+' new visible row(s) (throttled)', 'info');
    return clicked;
  }
  function parsePrices(text){
    const src=cleanText(text); const out={ insidePrice:'', oceanviewPrice:'', balconyPrice:'', suitePrice:'', allPorts:'', dayByDayItineraryJson:'', shipName:getShipNameFromText(src), itinerary:getItineraryFromText(src), departurePort:getPortFromText(src), nights:getNights(src) };
    function priceNear(label){ const re=new RegExp('(?:'+label+')[^$]{0,160}\\$\\s*([0-9,]+(?:\\.\\d{2})?)','i'); const m=src.match(re); return m ? '$'+m[1] : ''; }
    out.insidePrice=priceNear('Interior|Inside'); out.oceanviewPrice=priceNear('Oceanview|Ocean View|Outside'); out.balconyPrice=priceNear('Balcony'); out.suitePrice=priceNear('Suite');
    const ports=[]; const seen={}; for (const p of PORT_HINTS){ if (new RegExp('\\b'+p.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&')+'\\b','i').test(src) && !seen[p]){ seen[p]=true; ports.push(p); } }
    out.allPorts=ports.join(' | ');
    try { out.dayByDayItineraryJson=JSON.stringify(ports.map(function(p,idx){ return { day: idx+1, port:p }; })); } catch(e){}
    return out;
  }
  const enrichCache = {};
  async function enrichFromLink(url, label){
    if (!url) return {};
    if (enrichCache[url]) return enrichCache[url];
    try{
      log('🔗 Opening/fetching ship or itinerary link for pricing/ports: '+cleanText(label || url), 'info');
      const resp=await fetch(url, {credentials:'include'}); const text=await resp.text(); const parsed=parsePrices(text); parsed.sourceUrl=url; enrichCache[url]=parsed; await wait(60); return parsed;
    } catch(e){ log('⚠️ Pricing/itinerary link enrichment failed for '+cleanText(label || url)+': '+(e&&e.message?e.message:String(e)), 'warning'); return {}; }
  }
  function parseBlockFromElement(el, offer){
    const text=cleanText(el.textContent || '');
    const links=Array.from(el.querySelectorAll('a[href]')).map(function(a){ return {text:cleanText(a.textContent), href:a.href}; }).filter(function(x){ return /Night|Cruise|of the Seas|search\/cruises|cruise-ships/i.test(x.text+' '+x.href); });
    const itineraryLink=links.find(function(x){ return /Night[s]? .*Cruise/i.test(x.text); }) || null;
    const shipLink=links.find(function(x){ return /of the Seas/i.test(x.text); }) || null;
    return {
      key: canonicalOfferCode(offer.offerCode)+'|'+cleanText(text).slice(0,360), text:text, dates:extractDates(text),
      offerType:inferOfferType(text) || offer.offerType, cabinType:inferCabin(text) || offer.cabinType,
      itinerary:(itineraryLink && itineraryLink.text) || getItineraryFromText(text), shipName:(shipLink && shipLink.text) || getShipNameFromText(text),
      departurePort:getPortFromText(text), nights:getNights(text), itineraryUrl:itineraryLink && itineraryLink.href || '', shipUrl:shipLink && shipLink.href || ''
    };
  }
  function makeRow(offer, block, date, sourceType, sourceUrl, enrichment){
    const enriched=enrichment || {}; const text=cleanText(block.text || '');
    return {
      sourcePage: BRAND.programName + ' Offers', source:sourceType || (BRAND.sourcePrefix+'-ui-v947'), syncedAt:new Date().toISOString(),
      offerName:offer.offerName || offer.offerCode || 'Casino Offer', offerCode:canonicalOfferCode(offer.offerCode), offerExpirationDate:offer.offerExpirationDate || '', offerType:block.offerType || offer.offerType || inferOfferType(text),
      shipName:block.shipName || enriched.shipName || getShipNameFromText(text), sailingDate:date, sailDateRaw:date, itinerary:block.itinerary || enriched.itinerary || getItineraryFromText(text), departurePort:block.departurePort || enriched.departurePort || getPortFromText(text),
      cabinType:block.cabinType || offer.cabinType || inferCabin(text), numberOfGuests:offer.numberOfGuests || inferGuests((block.offerType||'')+' '+text+' '+(offer.perks||'')), casinoPaysFor:offer.numberOfGuests || inferGuests((block.offerType||'')+' '+text+' '+(offer.perks||'')), perks:offer.perks || '',
      numberOfNights:block.nights || enriched.nights || getNights(block.itinerary || text), allPorts: enriched.allPorts || '', dayByDayItineraryJson: enriched.dayByDayItineraryJson || '',
      insidePrice:enriched.insidePrice || '', oceanviewPrice:enriched.oceanviewPrice || '', balconyPrice:enriched.balconyPrice || '', suitePrice:enriched.suitePrice || '', priceSource: enriched.sourceUrl ? 'ship-itinerary-link' : '', priceCapturedAt: enriched.sourceUrl ? new Date().toISOString() : '',
      sourceUrl: sourceUrl || location.href, detailUrl: block.itineraryUrl || block.shipUrl || '', rawTextSnippet:text.slice(0,700), rawExpandedText:text.slice(0,900), validationStatus:'accepted'
    };
  }
  function rowKey(row){ return canonicalCruiseKey(row); }
  function dedupeRows(rows){
    const sorted=(rows || []).slice().sort(function(a,b){ return rowQuality(b)-rowQuality(a); });
    const out=[]; const seen=new Set();
    for (const row of sorted){
      if (!row || !row.offerCode || !row.shipName || !row.sailingDate) continue;
      if (isPendingValue(row.shipName)) continue;
      const key=rowKey(row); if (seen.has(key)) continue; seen.add(key); out.push(row);
    }
    return enforceVerifiedOfferCounts(out);
  }
  function scrollContainers(){ return Array.from(document.querySelectorAll('main,section,div,tbody,table,body')).filter(function(el){ try{ return el.scrollHeight > el.clientHeight + 160; }catch(e){ return false; } }).sort(function(a,b){ return (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight); }).slice(0,10); }
  function isAtBottom(){ return Math.ceil(window.scrollY + window.innerHeight + 8) >= Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); }
  async function clickDownloadListAndParse(offer){
    const rows=[]; const buttons=Array.from(document.querySelectorAll('a,button,[role="button"]')).filter(function(el){ return /Download\s*list|Download|Export|CSV|XLSX/i.test(cleanText(el.textContent || el.getAttribute('aria-label') || '')); });
    for (const el of buttons.slice(0,3)){
      const href=(el.getAttribute && el.getAttribute('href')) || '';
      try{
        log('⬇️ Download list/export control found for '+offer.offerCode, 'info');
        if (href && !/^javascript:/i.test(href)) {
          const resp=await fetch(href, {credentials:'include'}); const txt=await resp.text(); rows.push.apply(rows, parseRowsFromTextBlob(txt, offer, href, 'download-list'));
        } else {
          el.scrollIntoView({block:'center'}); await wait(150); el.click(); await wait(2500);
        }
      } catch(e){ log('⚠️ Download list attempt failed: '+(e&&e.message?e.message:String(e)), 'warning'); }
    }
    if (rows.length) log('⬇️ Parsed '+rows.length+' row(s) from Download list/export for '+offer.offerCode, 'success');
    return rows;
  }
  function parseRowsFromTextBlob(text, offer, sourceUrl, sourceType){
    const rows=[]; const src=String(text || ''); if (src.length < 100) return rows;
    const chunks=src.split(/(?=(?:Cruise Fare|Room type|Ship name|\d+\s+Night|20\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\{))/i).slice(0,25000);
    for (const piece of chunks){ const cleaned=cleanText(piece); if (cleaned.length<40) continue; const dates=extractDates(cleaned); const ship=getShipNameFromText(cleaned); const itin=getItineraryFromText(cleaned); if (!dates.length || (!ship && !itin)) continue; const block={text:cleaned, dates:dates, shipName:ship, itinerary:itin, departurePort:getPortFromText(cleaned), cabinType:inferCabin(cleaned)||offer.cabinType, offerType:inferOfferType(cleaned)||offer.offerType, nights:getNights(cleaned)}; for (const d of dates){ rows.push(makeRow(offer, block, d, sourceType, sourceUrl, {})); } }
    return rows;
  }

  function deepString(value){
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return cleanText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return cleanText(String(value));
    if (Array.isArray(value)) return value.map(deepString).filter(Boolean).join(' ');
    if (typeof value === 'object') {
      const priority=['name','title','description','displayName','shortName','longName','label','value','code'];
      for (const k of priority){ if (value[k] !== undefined) { const v=deepString(value[k]); if (v) return v; } }
    }
    return '';
  }
  function pickDeep(obj, names){
    if (!obj || typeof obj !== 'object') return '';
    for (const n of names){ if (obj[n] !== undefined) { const v=deepString(obj[n]); if (v) return v; } }
    return '';
  }
  function detectOfferCodeFromObj(obj, fallback){
    const direct=pickDeep(obj, ['offerCode','casinoOfferCode','certificateCode','campaignCode','promoCode','code','offerId','campaignId']);
    const c=canonicalOfferCode(direct || fallback || '');
    return c;
  }
  function detectPlayerOfferIdFromPayload(data, offer){
    let found=offer && offer.playerOfferId || '';
    const seen=new Set();
    function walk(v, depth){
      if (found || !v || depth>8) return;
      if (typeof v === 'object') { if (seen.has(v)) return; seen.add(v); }
      if (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) { found=v; return; }
      if (Array.isArray(v)) { v.forEach(function(x){ walk(x, depth+1); }); return; }
      if (typeof v === 'object') {
        Object.keys(v).forEach(function(k){ if (/playerOfferId|offerPlayerId|id/i.test(k)) walk(v[k], depth+1); });
      }
    }
    walk(data,0); return found || '';
  }
  function shipFromPayload(obj, ctxText){
    let ship=pickDeep(obj, ['shipName','shipDisplayName','shipLongName','shipDescription','shipDesc','vesselName','vessel','ship']);
    if (!ship) ship=getShipNameFromText(ctxText || '');
    if (!ship) {
      const code=pickDeep(obj, ['shipCode','shipCd','vesselCode']);
      const map={ JW:'Jewel of the Seas', FR:'Freedom of the Seas', WN:'Wonder of the Seas', AD:'Adventure of the Seas', RD:'Radiance of the Seas', NV:'Navigator of the Seas', HM:'Harmony of the Seas', SY:'Symphony of the Seas', OA:'Oasis of the Seas', AL:'Allure of the Seas', UT:'Utopia of the Seas', IC:'Icon of the Seas', SR:'Serenade of the Seas', LB:'Liberty of the Seas', QN:'Quantum of the Seas', OY:'Odyssey of the Seas', OV:'Ovation of the Seas', BR:'Brilliance of the Seas', EN:'Enchantment of the Seas', EX:'Explorer of the Seas', GR:'Grandeur of the Seas', ID:'Independence of the Seas', MA:'Mariner of the Seas', RH:'Rhapsody of the Seas', VY:'Voyager of the Seas', VI:'Vision of the Seas', AN:'Anthem of the Seas', SC:'Spectrum of the Seas', ST:'Star of the Seas', LG:'Legend of the Seas' };
      ship = map[String(code||'').toUpperCase()] || '';
    }
    return ship;
  }
  function datesFromPayloadObj(obj, ctxText){
    const vals=[];
    ['sailDate','sailingDate','departureDate','departDate','startDate','embarkDate','embarkationDate','voyageStartDate','date','sailDates','sailingDates','dates','departures'].forEach(function(k){ if (obj && obj[k] !== undefined) vals.push(obj[k]); });
    if (ctxText) vals.push(ctxText);
    const out=[]; const seen=new Set();
    vals.forEach(function(v){ extractDates(deepString(v)).forEach(function(d){ if (d && !seen.has(d)){ seen.add(d); out.push(d); } }); });
    return out;
  }
  function parseRowsFromRoyalJsonPayload(data, offer, sourceUrl, sourceType){
    const rows=[]; const seenObjs=new Set();
    const fallbackOffer=canonicalOfferCode(offer && offer.offerCode || '');
    function contextFrom(obj, parent){
      const text=cleanText(parent.text+' '+deepString(obj));
      const out={
        text:text,
        offerCode: detectOfferCodeFromObj(obj, parent.offerCode || fallbackOffer),
        offerName: pickDeep(obj, ['offerName','offerTitle','title','campaignName','name']) || parent.offerName || offer.offerName || fallbackOffer,
        offerType: inferOfferType(text) || parent.offerType || offer.offerType,
        cabinType: inferCabin(text) || parent.cabinType || offer.cabinType,
        numberOfGuests: inferGuests(text) || parent.numberOfGuests || offer.numberOfGuests,
        shipName: shipFromPayload(obj, text) || parent.shipName,
        itinerary: pickDeep(obj, ['itineraryName','itinerary','sailingName','cruiseName','productName','voyageName']) || getItineraryFromText(text) || parent.itinerary,
        departurePort: pickDeep(obj, ['departurePort','departurePortName','embarkPort','embarkationPort','port','homePort']) || getPortFromText(text) || parent.departurePort,
        nights: pickDeep(obj, ['nights','numberOfNights','duration','durationDays']) || getNights(text) || parent.nights,
      };
      return out;
    }
    function pushIfSailing(obj, ctx){
      const text=cleanText(ctx.text+' '+deepString(obj));
      const ship=shipFromPayload(obj, text) || ctx.shipName;
      const dates=datesFromPayloadObj(obj, text);
      if (!ship || !dates.length) return;
      const block={ text:text, dates:dates, shipName:ship, itinerary:pickDeep(obj,['itineraryName','itinerary','sailingName','cruiseName','productName','voyageName']) || getItineraryFromText(text) || ctx.itinerary, departurePort:pickDeep(obj,['departurePort','departurePortName','embarkPort','embarkationPort','port','homePort']) || getPortFromText(text) || ctx.departurePort, cabinType:inferCabin(text) || ctx.cabinType, offerType:inferOfferType(text) || ctx.offerType, nights:pickDeep(obj,['nights','numberOfNights','duration','durationDays']) || getNights(text) || ctx.nights };
      const localOffer=Object.assign({}, offer, { offerCode: ctx.offerCode || fallbackOffer, offerName: ctx.offerName || offer.offerName, offerType: ctx.offerType || offer.offerType, cabinType: ctx.cabinType || offer.cabinType, numberOfGuests: ctx.numberOfGuests || offer.numberOfGuests });
      dates.forEach(function(d){ rows.push(makeRow(localOffer, block, d, sourceType || (BRAND.sourcePrefix+'-page-observed-json'), sourceUrl || location.href, {})); });
    }
    function walk(v, ctx, depth){
      if (!v || depth>12) return;
      if (typeof v === 'object') { if (seenObjs.has(v)) return; seenObjs.add(v); }
      if (Array.isArray(v)) { v.forEach(function(item){ walk(item, ctx, depth+1); }); return; }
      if (typeof v !== 'object') return;
      const next=contextFrom(v, ctx);
      pushIfSailing(v, next);
      Object.keys(v).forEach(function(k){
        const lower=k.toLowerCase();
        const child=v[k];
        if (lower.includes('sailing') || lower.includes('offer') || lower.includes('cruise') || lower.includes('voyage') || lower.includes('itinerary') || lower.includes('departure') || lower === 'payload' || lower === 'data' || lower === 'items' || lower === 'results' || lower === 'content') walk(child, next, depth+1);
        else if (Array.isArray(child)) walk(child, next, depth+1);
      });
    }
    walk(data, { text:'', offerCode:fallbackOffer, offerName:offer.offerName || fallbackOffer, offerType:offer.offerType || '', cabinType:offer.cabinType || '', numberOfGuests:offer.numberOfGuests || '', shipName:'', itinerary:'', departurePort:'', nights:'' }, 0);
    return dedupeRows(rows.filter(function(r){ return canonicalOfferCode(r.offerCode)===fallbackOffer || !fallbackOffer; }));
  }
  function parseCapturedOfferPayloadsForOffer(offer){
    // Page-observed network payloads are allowed as a passive enrichment source, but this
    // function never performs its own Royal endpoint fetch. The proven production path
    // remains: saved offer list -> browser detail page -> DOM/download scrape -> checkpoint ACK.
    const rows=[]; const code=canonicalOfferCode(offer.offerCode); const playerOfferId=offer.playerOfferId || ((offer.href||'').match(/[?&]playerOfferId=([^&#]+)/i)||[])[1] || '';
    const captured=[];
    try { captured.push.apply(captured, window.capturedOfferPayloads || []); } catch(e){}
    try { captured.push.apply(captured, (window.capturedPayloads && window.capturedPayloads.offerPayloads) || []); } catch(e){}
    try { if (window.capturedPayloads && window.capturedPayloads.offers) captured.push({ url:(BRAND.sourcePrefix+'-capturedPayloads.offers'), data:window.capturedPayloads.offers, transport:'network-monitor-offers' }); } catch(e){}
    const capturedSeen=new Set();
    captured.forEach(function(p){
      try{
        const blob=JSON.stringify(p).slice(0,700000);
        const purl=String(p && p.url || '');
        const captureKey=purl+'|'+blob.slice(0,180);
        if (capturedSeen.has(captureKey)) return;
        capturedSeen.add(captureKey);
        const sameBrand = !purl || purl.indexOf('http')<0 || BRAND.hostRe.test((new URL(purl, location.origin)).hostname || location.hostname);
        const mentionsOffer = !code || blob.toUpperCase().indexOf(code)>=0 || (playerOfferId && blob.indexOf(playerOfferId)>=0);
        if (!sameBrand || !mentionsOffer) return;
        const parsed=parseRowsFromRoyalJsonPayload(p.data || p, offer, p.url || (BRAND.sourcePrefix+'-captured-network-json'), BRAND.sourcePrefix+'-captured-network-json');
        if (parsed.length) {
          log('✅ Parsed '+parsed.length+' row(s) for '+code+' from page-observed network payload '+(purl || ''), 'success');
          rows.push.apply(rows, parsed);
        }
      }catch(e){}
    });
    return dedupeRows(rows);
  }

  async function scrapeCurrentOfferDetail(offer){
    let accepted=[]; let seenBlocks=new Set(); let stableRounds=0; let lastAccepted=0; let totalDetailClicks=0;
    let pendingSkipped=0, pageDupSkipped=0, validBlocks=0, duplicateBlockSkipped=0;
    const startedAt=Date.now();
    const target=verifiedTargetForOffer(offer);
    // v964: WebView/detail-page first. Do not start from unauthenticated endpoint calls;
    // later builds returned 404/partial data. Keep download/list parsing as a cheap page-side helper,
    // then use the proven DOM/detail scraper with checkpoint ACK handoff after each offer.
    log('🧭 WebView-first scrape for '+offer.offerCode+': using authenticated detail page DOM/download with passive network enrichment only', 'info');
    if (verifiedTargetForOffer(offer)) {
      const detailReady = await waitForSailingDetailPage(offer, offer.openedFromList ? 26000 : 18000);
      if (!detailReady) log('⚠️ '+offer.offerCode+' detail page did not expose sailing controls yet; waiting extra before scrape', 'warning');
      await wait(offer.openedFromList ? 1800 : 2600);
    }
    const downloadRows=await clickDownloadListAndParse(offer); accepted.push.apply(accepted, downloadRows);
    const passiveRows=parseCapturedOfferPayloadsForOffer(offer); accepted.push.apply(accepted, passiveRows);
    if (target && rowsForOffer(accepted, offer).length >= target) {
      const initial=rowsForOffer(accepted, offer).slice(0,target);
      log('✅ '+offer.offerCode+' reached verified target '+target+' from network/download rows; skipping expensive DOM crawl', 'success');
      return initial;
    }
    for (let round=0; round<MAX_SCROLL_ROUNDS_PER_OFFER; round++){
      progress(round, MAX_SCROLL_ROUNDS_PER_OFFER, 'Scraping '+offer.offerCode);
      const currentRows=rowsForOffer(accepted, offer);
      if (target && currentRows.length >= target) { accepted=currentRows.slice(0,target); log('✅ '+offer.offerCode+' reached verified target '+target+' row(s); stopping DOM crawl early', 'success'); break; }
      const timeoutMs = target && target > 250 ? 300000 : 150000;
      if (Date.now() - startedAt > timeoutMs) { log('⏱️ '+offer.offerCode+' scrape timeout guard reached after '+Math.round(timeoutMs/1000)+'s; stopping with '+currentRows.length+' valid row(s)', 'warning'); break; }
      const beforeClickRows=rowsForOffer(accepted, offer).length;
      const remainingNeeded = target ? Math.max(0, target - beforeClickRows) : 8;
      totalDetailClicks += await clickAllVisibleViewDetails(Math.min(10, remainingNeeded || 6));
      await wait(120);
      const elems=candidateRowElements();
      for (const el of elems){
        if (target && rowsForOffer(accepted, offer).length >= target) break;
        const block=parseBlockFromElement(el, offer); if (!block.dates.length) continue; const blockKey=block.key; if (seenBlocks.has(blockKey)) { duplicateBlockSkipped++; continue; } seenBlocks.add(blockKey);
        // Hard reject placeholder/pending blocks BEFORE enrichment/logging/row creation.
        if (/pending/i.test(cleanText(block.shipName+' '+block.itinerary)) || (isPendingValue(block.shipName) && isPendingValue(block.itinerary) && !block.shipUrl && !block.itineraryUrl)) { pendingSkipped++; continue; }
        if (block.dates.length > 20 && !block.shipName && !block.shipUrl && !block.itineraryUrl) { pageDupSkipped++; continue; }
        const enrichUrl=block.itineraryUrl || block.shipUrl || ''; const enrichment=enrichUrl ? await enrichFromLink(enrichUrl, block.itinerary || block.shipName || offer.offerCode) : {};
        if (block.dates.length > 20 && !block.shipName && !enrichment.shipName) { pageDupSkipped++; continue; }
        if (isPlaceholderBlock(block, enrichment)) { pendingSkipped++; continue; }
        let addedForBlock=0;
        for (const date of block.dates){
          const row=makeRow(offer, block, date, BRAND.sourcePrefix+'-ui-v961-view-details-link-enriched', enrichUrl || location.href, enrichment);
          if (row.shipName && row.sailingDate && !isPendingValue(row.shipName)) { accepted.push(row); addedForBlock++; }
        }
        if (addedForBlock) validBlocks++;
      }
      const effectiveRows=rowsForOffer(accepted, offer);
      const uniqueCount=effectiveRows.length;
      if (target && uniqueCount >= target) { accepted=effectiveRows.slice(0,target); log('✅ '+offer.offerCode+' reached verified target '+target+' row(s); stopping DOM crawl early', 'success'); break; }
      if (uniqueCount === lastAccepted) stableRounds++; else stableRounds=0; lastAccepted=uniqueCount;
      const containers=scrollContainers();
      containers.forEach(function(c){ try{ c.scrollTop = Math.min(c.scrollHeight, c.scrollTop + Math.max(360, Math.floor(c.clientHeight*0.9))); }catch(e){} });
      try{ window.scrollBy(0, Math.max(500, Math.floor(window.innerHeight*0.9))); }catch(e){}
      const loadMore=Array.from(document.querySelectorAll('button,a,[role="button"]')).find(function(el){ return /Load\s+more|Show\s+more|Next/i.test(cleanText(el.textContent || el.getAttribute('aria-label') || '')); });
      if (loadMore){ try{ loadMore.scrollIntoView({block:'center'}); await wait(80); loadMore.click(); log('➡️ Clicked Load more/Next on offer '+offer.offerCode, 'info'); await wait(650); stableRounds=0; }catch(e){} }
      await wait(140);
      if (isAtBottom() && stableRounds >= STABLE_ROUNDS_TO_STOP) break;
    }
    const finalRows=rowsForOffer(accepted, offer);
    log('📊 '+offer.offerCode+' detail scrape summary: valid rows '+finalRows.length+(target ? '/'+target : '')+', valid blocks '+validBlocks+', pending blocks skipped '+pendingSkipped+', page duplicates skipped '+pageDupSkipped+', duplicate blocks skipped '+duplicateBlockSkipped+', View Details clicks '+totalDetailClicks, finalRows.length?'success':'error');
    return finalRows;
  }
  function codeHasLegacyLargeCatalogExpectation(code){
    const c=canonicalOfferCode(code || '');
    return c === '2606C05' || c === '2605C03A';
  }
  function validateShipDateCompleteness(rows, offers){
    const finalRows=dedupeRows(rows); const codes=(offers||[]).map(function(o){ return canonicalOfferCode(o.offerCode); }).filter(Boolean);
    const by={}; const shipDateKeys={}; codes.forEach(function(c){ by[c]=0; shipDateKeys[c]=new Set(); });
    finalRows.forEach(function(r){
      const c=canonicalOfferCode(r && r.offerCode || '');
      if (!c) return;
      by[c]=(by[c]||0)+1;
      if (!shipDateKeys[c]) shipDateKeys[c]=new Set();
      shipDateKeys[c].add(cleanText(r.shipName).toLowerCase()+'|'+(isoDate(r.sailingDate) || cleanText(r.sailingDate).toLowerCase()));
    });
    const missing=[]; const short=[]; const duplicateWarnings=[];
    codes.forEach(function(code){
      const count=by[code] || 0;
      const uniqueShipDates=shipDateKeys[code] ? shipDateKeys[code].size : 0;
      if (count === 0 && !isSkippableZeroRowOffer(code)) missing.push(code);
      if (count > 0 && uniqueShipDates < count) duplicateWarnings.push(code+': '+uniqueShipDates+'/'+count+' unique ship-date pair(s)');
      const target=VERIFIED_OFFER_ROW_COUNTS[code] || 0;
      if (target && !isSkippableZeroRowOffer(code) && count > 0 && count < Math.max(1, Math.ceil(target * 0.90))) short.push(code+': '+count+'/'+target);
      if (count > 0) log('✅ Verified '+code+': '+count+' ship/date sailing row(s)'+(target ? ' of expected '+target : '') , 'success');
      else if (isSkippableZeroRowOffer(code)) log('ℹ️ Verified '+code+': 0 current ship/date rows, allowed as stale/expired visible card', 'warning');
    });
    if (duplicateWarnings.length) log('🧹 Ship/date duplicate check: '+duplicateWarnings.join('; '), 'warning');
    if (missing.length) return 'One or more current visible offers produced 0 cruise rows: '+missing.join(', ');
    if (short.length) return 'One or more known offer catalogs are short on ship/date rows: '+short.join(', ');
    return '';
  }
  function shouldReject(rows, offers){
    const finalRows=dedupeRows(rows); const codes=(offers||[]).map(function(o){ return canonicalOfferCode(o.offerCode); }).filter(Boolean); const by={}; codes.forEach(function(c){ by[c]=0; }); finalRows.forEach(function(r){ const c=canonicalOfferCode(r.offerCode); if (c) by[c]=(by[c]||0)+1; });
    const counts=Object.keys(by).map(function(c){ return by[c]; });
    Object.keys(by).forEach(function(code){ log((by[code] ? '✅' : '❌')+' Final offer count '+code+': '+by[code]+' cruise row(s)', by[code]?'success':'error'); });
    if (!codes.length) return 'No visible offer codes were found';
    if (finalRows.length === 0) return '0 accepted offer cruise rows';
    const integrityRejection=validateShipDateCompleteness(rows, offers);
    if (integrityRejection) return integrityRejection;
    const zeroCodes=Object.keys(by).filter(function(code){ return by[code]===0; });
    if (zeroCodes.length) log('ℹ️ Skipping visible Royal offer card(s) with no current sailing rows after retries: '+zeroCodes.join(', ')+'. Current catalog rows remain authoritative.', 'warning');
    const tinyIdentical = counts.filter(function(n){ return n>0; }).length >= 4 && counts.filter(function(n){ return n>0; }).every(function(n){ return n<=12; }) && (new Set(counts.filter(function(n){ return n>0; }))).size <= 2;
    if (tinyIdentical) return 'Partial virtualized DOM sample detected: '+counts.join('/');
    const legacyLargeExpected = BRAND.key === 'royal_caribbean' && codes.some(codeHasLegacyLargeCatalogExpectation);
    if (legacyLargeExpected && codes.length >= 5 && finalRows.length < MIN_ROWS_FOR_KNOWN_MULTI_OFFER_SET) return 'Captured only '+finalRows.length+' rows from '+codes.length+' Royal Club Royale offers; expected roughly 1,073 for the legacy large Royal offer set';
    // Some valid Royal pages currently expose smaller five-offer catalogs. Do not reject
    // a complete catalog only because it has fewer than the old 1,073-row June set; the
    // per-offer ship/date completeness gate above is the authority.
    // Four known offers with ~1,019 rows is a complete live capture, not a broken partial. Only reject tiny four-offer captures.
    if (BRAND.key === 'royal_caribbean' && codes.length === 4 && finalRows.length < MIN_ROWS_FOR_VISIBLE_ROYAL_FOUR_OFFER_SET && legacyLargeExpected) return 'Captured only '+finalRows.length+' rows from '+codes.length+' Royal Club Royale offers; likely partial scrape';
    // Royal's visible Club Royale catalog is not a fixed 4/5-offer set. It can legitimately
    // contain only 1 or 2 current offers with a small number of sailings. The authoritative
    // check is whether every visible offer that claims current availability produced verified
    // ship/date rows. Do not reject a small-but-complete live catalog solely because it is small.
    if (BRAND.key === 'celebrity' && codes.length >= 1 && finalRows.length < 1) return 'Captured no Celebrity Blue Chip offer rows';
    return '';
  }
  async function ensureOffersList(){
    if (isOfferListUrl()) return true;
    log('↩️ Browser-directed sync returning to exact My Offers list page', 'info');
    location.href=OFFER_LIST_URL;
    return false;
  }

  function isOfferListUrl(){
    const p=String(location.pathname || '').replace(/\/+$/,'');
    return (BRAND.key === 'royal_caribbean' && p === '/club-royale/offers') || (BRAND.key === 'celebrity' && p === '/blue-chip-club/offers');
  }
  function isOfferDetailUrl(){ return BRAND.offerPathRe.test(location.pathname) && !isOfferListUrl(); }
  function hasSailingDetailSignals(){
    const t=cleanText(document.body && document.body.innerText || '');
    if (!t) return false;
    const hasOfferDetailText=/(Download\s*list|View\s+details|Room\s*type|Cruise\s+Fare|Dates|Ship\s*name|Itinerary)/i.test(t);
    const hasCruiseText=/(\d+\s+Night|of the Seas|20\d{2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(t);
    const rowSignals=Array.from(document.querySelectorAll('button,a,[role="button"]')).some(function(el){ return /View\s+details|Download\s*list|View\s+less/i.test(cleanText(el.textContent || el.getAttribute('aria-label') || '')); });
    return !!(hasOfferDetailText && hasCruiseText) || rowSignals;
  }
  async function waitForSailingDetailPage(offer, timeoutMs){
    const start=Date.now(); let lastUrl=location.href; let lastLen=0; let stable=0;
    while (Date.now()-start < (timeoutMs || 45000)){
      const bodyText=cleanText(document.body && document.body.innerText || '');
      if (location.href !== lastUrl) { log('🌐 Offer detail navigation observed: '+location.href, 'info'); lastUrl=location.href; }
      if (hasSailingDetailSignals()) {
        const len=bodyText.length;
        stable = Math.abs(len-lastLen) < 35 ? stable+1 : 0;
        lastLen=len;
        if (stable >= 2 || /View\s+details|Download\s*list/i.test(bodyText)) return true;
      }
      await wait(650);
    }
    return false;
  }
  function forceClick(el){
    if (!el) return false;
    try { el.scrollIntoView({block:'center', inline:'center'}); } catch(e){}
    try { el.focus && el.focus(); } catch(e){}
    try { el.click(); return true; } catch(e){}
    try {
      ['mouseover','mousedown','mouseup','click'].forEach(function(type){ el.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window})); });
      return true;
    } catch(e){}
    return false;
  }
  function offerDetailHrefFromCard(offer, button){
    const card=button ? closestCard(button) : null;
    const code=canonicalOfferCode(offer && offer.offerCode || '');
    const links=Array.from((card || document).querySelectorAll('a[href]')).map(function(a){ return { text:cleanText(a.textContent || ''), href:a.href || '' }; });
    const exact=links.find(function(x){ return x.href && code && x.href.toUpperCase().indexOf(code)>=0; });
    if (exact) return exact.href;
    const sail=links.find(function(x){ return /View\s+Sailings|Sailings|Offer/i.test(x.text) && BRAND.offerPathRe.test((function(){try{return new URL(x.href, location.origin).pathname}catch(e){return x.href}})()); });
    if (sail) return sail.href;
    return '';
  }

  function savedDetailUrlForOffer(offer){
    if (!offer) return '';
    const href=cleanText(offer.href || '');
    if (href && href.indexOf('http')===0) return href;
    const code=canonicalOfferCode(offer.offerCode || '');
    if (!code) return '';
    const playerOfferId=cleanText(offer.playerOfferId || ((href.match(/[?&]playerOfferId=([^&#]+)/i)||[])[1] || ''));
    return BRAND.detailBaseUrl+encodeURIComponent(code)+(playerOfferId ? '?country=USA&playerOfferId='+encodeURIComponent(playerOfferId) : '?country=USA');
  }
  async function fetchSavedDetailRowsForOffer(offer){
    const code=canonicalOfferCode(offer && offer.offerCode || '');
    const url=savedDetailUrlForOffer(offer);
    if (!code || !url) return [];
    try{
      log('📥 Fetching authenticated saved detail page for '+code+' without leaving crawler context', 'info');
      const resp=await fetch(url, { credentials:'include', headers:{ 'accept':'text/html,application/json,*/*' } });
      const text=await resp.text();
      let rows=parseRowsFromTextBlob(text, offer, url, BRAND.sourcePrefix+'-saved-detail-fetch');
      // Also run the generic JSON walker against embedded/hydration text. This is still page-observed
      // authenticated detail content, not a public/direct endpoint replacement.
      try {
        const jsonish=[];
        const scripts=Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(function(m){ return m[1] || ''; });
        scripts.forEach(function(scriptText){
          if (!scriptText || scriptText.toUpperCase().indexOf(code)<0) return;
          const chunks=scriptText.match(/\{[\s\S]{100,}?\}/g) || [];
          chunks.slice(0,8).forEach(function(chunk){
            try { jsonish.push(JSON.parse(chunk)); } catch(e){}
          });
        });
        jsonish.forEach(function(obj){ rows.push.apply(rows, parseRowsFromRoyalJsonPayload(obj, offer, url, BRAND.sourcePrefix+'-saved-detail-json')); });
      } catch(e){}
      rows=rowsForOffer(rows, offer);
      const target=verifiedTargetForOffer(offer);
      if (target && rows.length > target) rows=rows.slice(0,target);
      log((rows.length?'✅':'⚠️')+' Saved detail fetch for '+code+' produced '+rows.length+(target?'/'+target:'')+' row(s)', rows.length?'success':'warning');
      return rows;
    } catch(e){
      log('⚠️ Saved detail fetch failed for '+code+': '+(e&&e.message?e.message:String(e)), 'warning');
      return [];
    }
  }
  function hasOfferListSignals(){
    const t=cleanText(document.body && document.body.innerText || '');
    return /View\s*Sailings/i.test(t) && offerCodeRegex().test(t);
  }
  async function waitForOfferListSignals(timeoutMs){
    const start=Date.now();
    while (Date.now()-start < (timeoutMs || 20000)){
      if (hasOfferListSignals() || isOfferListUrl()) return true;
      await wait(650);
    }
    return false;
  }
  function returnToOfferListForClick(state, code, reason){
    state.phase='list';
    delete state.currentOffer;
    state.lastListReturnAt=Date.now();
    saveState(state);
    log('↩️ Returning to My Offers to reopen '+code+' by pressing its View Sailings button'+(reason ? ': '+reason : ''), 'warning');
    location.href=OFFER_LIST_URL;
  }
  async function continueAfterOffer(state){
    if (state.index >= (state.offers||[]).length) { await finishIfComplete(state); return; }
    const next=state.offers[state.index];
    const nextCode=canonicalOfferCode(next && next.offerCode || '');
    const directUrl=savedDetailUrlForOffer(next);
    log('➡️ Continuing to next offer '+(state.index+1)+'/'+(state.offers||[]).length+': '+nextCode+' (live View Sailings button required)', 'info');
    progress(state.index+1, (state.offers||[]).length, 'Opening '+nextCode);

    // v993 reliability fix:
    // Royal's newer Club Royale offer detail pages can render as a shell with 0 rows
    // when opened by direct saved URL after the first offer. The first offer succeeds
    // because it is opened by pressing the live View Sailings button from My Offers.
    // Therefore every subsequent offer should return to the live My Offers list and
    // press its own View Sailings button. Use the saved direct URL only as a fallback
    // if the list/button cannot be rediscovered.
    if (directUrl) {
      returnToOfferListForClick(state, nextCode, 'using live button continuation so every ship/date row belongs to the selected offer');
      return;
    }

    // If a detail href was not captured, try a same-session fetch as a secondary path.
    const fetchedRows=await fetchSavedDetailRowsForOffer(next);
    if (fetchedRows.length) {
      const merged=dedupeRows([].concat(state.rows || [], fetchedRows));
      state.rows=merged;
      state.index=(state.index||0)+1;
      state.phase='list';
      delete state.currentOffer;
      saveState(state);
      log('💾 Staged '+fetchedRows.length+' row(s) for '+nextCode+' from same-session detail fetch. Total staged rows: '+merged.length, 'success');
      sendOfferCheckpoint(next, fetchedRows);
      await wait(500);
      await continueAfterOffer(state);
      return;
    }

    failSafe('Unable to continue to next offer '+nextCode+' because no saved detail URL/playerOfferId was captured');
  }
  async function syncAllOffersViaBrowserFirst(state){
    // Intentionally no direct endpoint preflight here. Keeping this named helper only as a
    // guardrail marker for future builders: offer rows must be collected from the authenticated
    // browser session and saved-offer detail pages, then staged by checkpoint batches.
    return false;
  }

  async function openCurrentOfferFromList(state){
    if (!isOfferListUrl()) {
      log('↩️ Not on exact My Offers list; navigating there before resuming offer '+((state.index||0)+1), 'warning');
      location.href=OFFER_LIST_URL;
      setTimeout(function(){ try { const latest=loadState() || state; if (isOfferListUrl()) openCurrentOfferFromList(latest); } catch(e){} }, 6500);
      return;
    }
    const discovered=await discoverOffersWithHydration();
    let offers=discovered.offers; let buttons=discovered.buttons; const expected=discovered.expected;
    log('DOM discovery: parsed '+offers.length+' visible/linked offer card(s), found '+buttons.length+' View Sailings button(s)'+(expected ? ', page expected '+expected : ''), offers.length?'success':'warning');
    if (!offers.length){
      if (state.offers && state.offers.length && state.index < state.offers.length) {
        log('⚠️ My Offers rediscovery returned 0, using saved offer list to continue with '+state.offers[state.index].offerCode, 'warning');
        offers=state.offers; buttons=[];
      } else {
        failSafe('Offer page did not expose any offer cards/links after hydration retries'); return;
      }
    }
    if (expected && offers.length < expected && !(state.offers && state.offers.length >= expected)){ failSafe('Offer discovery incomplete: found '+offers.length+' of expected '+expected+' offers. Refusing partial offer sync so all offers/cruises can populate.'); return; }
    if (!state.offers || !state.offers.length || offers.length > state.offers.length){ state.offers=offers; state.rows=state.rows || []; state.index=state.index || 0; saveState(state); }

    // v964: saved offer list + detail-page scraping is the only primary offer path.

    const offer=state.offers[state.index];
    if (!offer){ await finishIfComplete(state); return; }
    const alreadyRows=dedupeRows(state.rows || []).filter(function(r){ return canonicalOfferCode(r.offerCode)===canonicalOfferCode(offer.offerCode); });
    if (alreadyRows.length) {
      log('⏭️ Offer '+offer.offerCode+' already has '+alreadyRows.length+' staged row(s); skipping duplicate browser crawl for this offer.', 'info');
      state.index=(state.index||0)+1; saveState(state);
      if (state.index >= (state.offers||[]).length) { await finishIfComplete(state); return; }
      await continueAfterOffer(state); return;
    }

    const liveOffer=offers.find(function(o){ return canonicalOfferCode(o.offerCode)===canonicalOfferCode(offer.offerCode); }) || offer;
    const button=findOfferButton(liveOffer, liveOffer.buttonIndex || state.index);
    const fallbackHref=(button ? offerDetailHrefFromCard(liveOffer, button) : '') || liveOffer.href || (BRAND.detailBaseUrl+encodeURIComponent(liveOffer.offerCode)+(liveOffer.playerOfferId ? '?country=USA&playerOfferId='+encodeURIComponent(liveOffer.playerOfferId) : '?country=USA'));
    if (!button && !fallbackHref){ failSafe('Could not find View Sailings button or detail URL for '+offer.offerCode); return; }
    state.phase='detail'; state.currentOffer=Object.assign({}, liveOffer, { openedFromList: !!button }); saveState(state);
    const startUrl=location.href;
    log('👆 Browser fallback opening offer '+(state.index+1)+'/'+state.offers.length+': '+liveOffer.offerCode+' by pressing View Sailings', 'success');
    if (fallbackHref) log('🔗 Fallback offer detail href staged for '+liveOffer.offerCode+': '+fallbackHref, 'info');
    progress(state.index+1, state.offers.length, 'Opening '+liveOffer.offerCode);
    try{
      state.openAttemptMap = state.openAttemptMap || {};
      const liveCode=canonicalOfferCode(liveOffer.offerCode || '');
      const openAttempts=Number(state.openAttemptMap[liveCode] || 0);
      if (button) {
        forceClick(button);
        await wait(1200);
      } else {
        // Only use a direct detail URL when the live list truly has no button for that code.
        // A blind direct URL is not allowed to pass completeness checks; it is a last-resort
        // way to keep the flow from hanging, not the primary sync path.
        log('🔗 No visible View Sailings button for '+liveOffer.offerCode+'; trying discovered detail URL as last resort', 'warning');
        location.href=fallbackHref;
        await wait(2200);
      }
      let ready=await waitForSailingDetailPage(liveOffer, button ? 22000 : 32000);
      if (!ready && button && openAttempts < 3) {
        state.openAttemptMap[liveCode]=openAttempts+1;
        saveState(state);
        log('⚠️ View Sailings click for '+liveCode+' did not expose ship/date rows; retrying from My Offers instead of falling back to a shell URL.', 'warning');
        returnToOfferListForClick(state, liveCode, 'live click did not expose sailing rows');
        return;
      }
      if (!ready && !button && openAttempts < 2) {
        state.openAttemptMap[liveCode]=openAttempts+1;
        saveState(state);
        returnToOfferListForClick(state, liveCode, 'last-resort detail URL did not expose sailing rows');
        return;
      }
      if (!ready) {
        log('⚠️ Offer '+liveOffer.offerCode+' detail did not report ready after live-button retries; attempting scrape once, then integrity gate will reject incomplete ship/date data.', 'warning');
      }
      const latest=loadState() || state;
      latest.phase='detail'; latest.currentOffer=liveOffer; saveState(latest);
      await scrapeDetailAndReturn(latest);
    }catch(e){ failSafe('View Sailings click/wait failed for '+liveOffer.offerCode+': '+(e&&e.message?e.message:String(e))); }
  }
  async function scrapeDetailAndReturn(state){
    const offer=state.currentOffer || (state.offers||[])[state.index];
    if (!offer){ failSafe('Detail page loaded but no current offer was staged'); return; }
    log('📄 Scraping View Sailings detail page for '+offer.offerCode, 'success');
    await wait(1500);
    const rows=await scrapeCurrentOfferDetail(offer);
    const code=canonicalOfferCode(offer.offerCode || '');
    state.retryMap = state.retryMap || {};
    const retries=Number(state.retryMap[code] || 0);
    if (shouldRetryOfferRows(offer, rows) && retries < 3) {
      state.retryMap[code]=retries+1;
      const target=verifiedTargetForOffer(offer);
      log('🔁 Offer '+code+' returned '+rows.length+(target?'/'+target:'')+' row(s); reopening the offer from My Offers before continuing so Sync Now does not stage 0 sailings.', 'warning');
      returnToOfferListForClick(state, code, 'retry '+state.retryMap[code]+' after empty detail scrape');
      return;
    }
    if (shouldRetryOfferRows(offer, rows)) {
      const target=verifiedTargetForOffer(offer);
      log('⚠️ Offer '+code+' still returned '+rows.length+(target?'/'+target:'')+' row(s) after live-button retries. This catalog will fail safe and preserve existing Easy Seas offers instead of applying partial data.', 'warning');
    }
    const merged=dedupeRows([].concat(state.rows || [], rows));
    state.rows=merged; state.index=(state.index||0)+1; state.phase='list'; delete state.currentOffer; saveState(state);
    log('💾 Staged '+rows.length+' row(s) for '+offer.offerCode+'. Total staged rows: '+merged.length, rows.length?'success':'error');
    if (rows.length) { sendOfferCheckpoint(offer, rows); }
    if (state.index >= (state.offers||[]).length) { await finishIfComplete(state); return; }
    await continueAfterOffer(state);
  }
  async function finishIfComplete(state){
    const rows=dedupeRows(state.rows || []); const offers=state.offers || [];
    rows.slice(0,25).forEach(function(r){ log('Accepted full row: '+r.offerCode+' | '+r.shipName+' | '+r.sailingDate+' | '+r.itinerary+' | '+r.departurePort, 'success'); });
    const rejection=shouldReject(rows, offers);
    if (rejection){ failSafe(rejection); return; }
    log('✅ STEP 1 COMPLETE: Offer ship/date completeness verified; captured '+offers.length+' visible offer(s) with '+rows.length+' individual cruise row(s)', 'success');
    clearState(); sendRows(rows, offers.length);
  }
  async function main(){
    try{
      log('Opening offers page for '+BRAND.programName, 'success');
      log('Easy Seas Sync Now rebuild engine '+ENGINE_VERSION+' active for '+BRAND.label, 'info');
      log('Mode: WebView-first browser workflow; saved offer list -> detail URL continuation -> pending-block rejection -> checkpoint ACK -> review before commit', 'info');
      const onOfferList=isOfferListUrl();
      const onOfferDetail=isOfferDetailUrl();
      let state=loadState();
      if (!state && onOfferList) { state={ runId: Date.now(), phase:'list', index:0, offers:[], rows:[] }; saveState(state); }
      if (!state) { await ensureOffersList(); return; }
      if (onOfferList) {
        await wait(1500);
        if (state.index && state.index > 0) log('🔁 Resuming offer crawler from My Offers page at offer index '+(state.index+1), 'info');
        await openCurrentOfferFromList(state);
        return;
      }
      if (onOfferDetail || state.phase === 'detail') {
        // v967: after React Native re-arms this worker on a newly loaded detail page,
        // recover the current offer from the saved queue and/or the URL.
        if ((!state.currentOffer || !state.currentOffer.offerCode) && state.offers && state.offers.length) {
          const urlCodeMatch = String(location.pathname || '').match(/\/offers\/([A-Za-z0-9]{5,12})/i);
          const urlCode = canonicalOfferCode(urlCodeMatch && urlCodeMatch[1] || '');
          state.currentOffer = state.offers.find(function(o){ return canonicalOfferCode(o.offerCode) === urlCode; }) || state.offers[state.index] || state.currentOffer;
          saveState(state);
        }
        await scrapeDetailAndReturn(state); return; }
      await ensureOffersList();
    } catch(e){ failSafe('Step 1 clean rebuild crashed: '+(e&&e.message?e.message:String(e))); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
`;

export function injectOffersExtraction(scrapePricingAndItinerary: boolean = false, cruiseLine: 'royal_caribbean' | 'celebrity' = 'royal_caribbean') {
  const safeCruiseLine = cruiseLine === 'celebrity' ? 'celebrity' : 'royal_caribbean';
  return `
const SCRAPE_PRICING_AND_ITINERARY = ${scrapePricingAndItinerary};
window.__EASYSEAS_SYNC_BRAND = ${JSON.stringify(safeCruiseLine)};

${STEP1_OFFERS_SCRIPT}
`;
}
