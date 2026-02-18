/*
  Easy Seas — Upcoming Cruises Grid
  Adds a "SHOW ALL CRUISES" button on https://www.royalcaribbean.com/account/upcoming-cruises
  Builds an on-page grid of upcoming cruises and supports CSV export.

  Design goals:
  - Zero dependency on the Club Royale offers DOM.
  - Resilient parsing based on visible labels (Reservation, Guests, category, stateroom).
  - Non-destructive: we only inject a panel/grid; no page navigation.
*/

(function () {
  const URL_MATCH = /\/account\/upcoming-cruises/i;
  if (!URL_MATCH.test(location.pathname)) return;

  const LOG_PREFIX = '[EasySeas UpcomingCruises]';
  const log = (...a) => console.debug(LOG_PREFIX, ...a);

  // Avoid double-inject
  const ROOT_ID = 'easyseas-upcoming-cruises-root';
  if (document.getElementById(ROOT_ID)) return;

  // ---------- Utils ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function safeText(el) {
    return (el && (el.textContent || '').trim()) || '';
  }

  function findByText(root, regex) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const out = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = safeText(n);
      if (t && regex.test(t)) out.push(n);
    }
    return out;
  }

  function pickDigits(str) {
    const m = (str || '').match(/\b(\d{4,})\b/);
    return m ? m[1] : '';
  }

  function normalizeSpaces(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function slugify(s) {
    return normalizeSpaces(String(s || ''))
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  // ---------- DOM discovery ----------
  // The page is SPA-ish; content can appear after initial load.
  async function waitForCruiseCards(maxMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const cards = getCruiseCardRoots();
      if (cards.length) return cards;
      await sleep(400);
    }
    return [];
  }

  function getCruiseCardRoots() {
    // Heuristic: cruise cards have big banner image + reservation block.
    // We search for elements containing the label "RESERVATION" and walk upward.
    const reservationEls = findByText(document.body, /^reservation$/i);
    const roots = new Set();

    for (const el of reservationEls) {
      let p = el;
      // climb to a reasonable container
      for (let i = 0; i < 10 && p; i++) {
        p = p.parentElement;
        if (!p) break;
        const txt = safeText(p);
        if (txt && /reservation\s*\d{4,}/i.test(txt)) {
          roots.add(p);
          break;
        }
      }
    }

    // Fallback: locate by the "You have X upcoming cruises" section and pick prominent cards.
    if (!roots.size) {
      const section = findByText(document.body, /you have\s+\d+\s+upcoming cruises/i)[0];
      const container = section ? section.closest('main, section, div') : null;
      if (container) {
        // cards are often direct children with large images; take those that have a reservation number somewhere.
        const candidates = Array.from(container.querySelectorAll('div, section')).filter((d) => {
          const t = safeText(d);
          return t && /reservation\s*\d{4,}/i.test(t) && /guests/i.test(t);
        });
        for (const c of candidates) roots.add(c);
      }
    }

    // Deduplicate by choosing a higher-level card container if possible.
    const deduped = [];
    for (const r of Array.from(roots)) {
      // pick the nearest ancestor that still contains the ship+date header ("|" separator).
      let best = r;
      let p = r;
      for (let i = 0; i < 6 && p; i++) {
        const txt = safeText(p);
        if (/\|\s*[A-Za-z]{3,}\s*\d{1,2}\s*—/i.test(txt) || /\|\s*\w+\s*\d{1,2}\s*[-—]/i.test(txt)) {
          best = p;
        }
        p = p.parentElement;
      }
      if (!deduped.some((x) => x.contains(best) || best.contains(x))) deduped.push(best);
    }

    // Sort: by top-of-page position
    deduped.sort((a, b) => (a.getBoundingClientRect().top || 0) - (b.getBoundingClientRect().top || 0));
    return deduped;
  }

  // ---------- Parsing ----------
  function parseCruiseCard(card) {
    const text = safeText(card);

    // Header line: "Ship Name | Jan 7 — Jan 13, 2026"
    let ship = '';
    let dateRange = '';
    const headerCandidate = Array.from(card.querySelectorAll('h1,h2,h3,h4,div,span'))
      .map((e) => safeText(e))
      .find((t) => t.includes('|') && /\d{4}/.test(t));

    if (headerCandidate) {
      const parts = headerCandidate.split('|').map((p) => normalizeSpaces(p));
      ship = parts[0] || '';
      dateRange = parts.slice(1).join(' | ');
    } else {
      // fallback: first occurrence of "of the Seas" ship line
      const mShip = text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Za-z]+)*\s+of\s+the\s+Seas)\b/);
      ship = mShip ? mShip[1] : '';
      const mDate = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*[—-]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i);
      dateRange = mDate ? mDate[0] : '';
    }

    // Cruise title: big line like "6 Night Cabo Overnight And Ensenada"
    let title = '';
    const titleCandidate = Array.from(card.querySelectorAll('h1,h2,h3'))
      .map((e) => normalizeSpaces(safeText(e)))
      .find((t) => /\bnight\b/i.test(t) && t.length > 10);
    if (titleCandidate) title = titleCandidate;

    // Reservation number
    let reservation = '';
    const resLabel = findByText(card, /^reservation$/i)[0];
    if (resLabel) {
      // often in next sibling / same block
      const block = resLabel.parentElement || card;
      reservation = pickDigits(safeText(block));
    }
    if (!reservation) {
      const m = text.match(/reservation\s*(\d{4,})/i);
      reservation = m ? m[1] : '';
    }

    // Category + stateroom
    // Examples:
    //  Interior  #9539
    //  GTY
    let category = '';
    let stateroom = '';

    // Try find a line that looks like category (Interior/Oceanview/Balcony/Suite/GTY)
    const catRegex = /\b(Interior|Ocean\s*View|Oceanview|Balcony|Suite|GTY)\b/i;
    const lines = text.split('\n').map((l) => normalizeSpaces(l)).filter(Boolean);
    const catLine = lines.find((l) => catRegex.test(l) && !/guests/i.test(l) && !/reservation/i.test(l));
    if (catLine) {
      const m = catLine.match(catRegex);
      category = m ? normalizeSpaces(m[1]) : '';
    }

    // stateroom like #9539
    const mSt = text.match(/#\s*(\d{3,5})\b/);
    stateroom = mSt ? mSt[1] : '';

    // Guests
    let guests = '';
    const guestsLabel = findByText(card, /^guests$/i)[0];
    if (guestsLabel) {
      const blk = guestsLabel.parentElement || card;
      // guests names tend to be in following text nodes
      const after = normalizeSpaces(safeText(blk).replace(/\bguests\b/i, '').trim());
      guests = after && after !== reservation ? after : '';
    }
    if (!guests) {
      const idx = lines.findIndex((l) => /^guests$/i.test(l));
      if (idx >= 0) guests = lines[idx + 1] || '';
    }

    // Days to go (optional)
    let daysToGo = '';
    const mDays = text.match(/\b(\d{1,3})\s+days\s+to\s+go\b/i);
    if (mDays) daysToGo = mDays[1];

    // Normalize category name
    category = category
      .replace(/ocean\s*view/i, 'Oceanview')
      .replace(/^gty$/i, 'GTY')
      .replace(/^interior$/i, 'Interior')
      .replace(/^balcony$/i, 'Balcony')
      .replace(/^suite$/i, 'Suite');

    return {
      ship,
      dateRange,
      title,
      reservation,
      category,
      stateroom,
      guests,
      daysToGo,
      _anchor: `easyseas-cruise-${slugify(`${ship}-${dateRange}-${reservation}`)}`
    };
  }

  // ---------- UI ----------
  function injectStyles() {
    const id = 'easyseas-upcoming-cruises-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      #${ROOT_ID} { position: relative; margin: 16px 0; }
      #${ROOT_ID} .es-panel { background: #0b3d91; color: #fff; border-radius: 12px; padding: 14px 14px 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); }
      #${ROOT_ID} .es-title { font-weight: 700; font-size: 16px; letter-spacing: .2px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      #${ROOT_ID} .es-sub { font-size: 12px; opacity: .9; margin-top: 6px; }
      #${ROOT_ID} .es-actions { display: flex; gap: 10px; flex-wrap: wrap; }
      #${ROOT_ID} .es-btn { appearance: none; border: 0; border-radius: 999px; padding: 10px 12px; font-weight: 700; cursor: pointer; }
      #${ROOT_ID} .es-btn.primary { background: #ffd34d; color: #0b3d91; }
      #${ROOT_ID} .es-btn.secondary { background: rgba(255,255,255,0.16); color: #fff; }
      #${ROOT_ID} .es-btn:disabled { opacity: .55; cursor: not-allowed; }
      #${ROOT_ID} .es-tablewrap { margin-top: 12px; overflow: auto; background: #fff; border-radius: 12px; }
      #${ROOT_ID} table { width: 100%; border-collapse: collapse; font-size: 13px; color: #0b1b2b; }
      #${ROOT_ID} th, #${ROOT_ID} td { padding: 10px 10px; border-bottom: 1px solid rgba(0,0,0,0.06); vertical-align: top; }
      #${ROOT_ID} th { position: sticky; top: 0; background: #f6f8fb; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .6px; }
      #${ROOT_ID} .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-weight: 800; font-size: 11px; background: #e8eefb; color: #0b3d91; }
      #${ROOT_ID} .muted { color: rgba(11,27,43,0.65); }
      #${ROOT_ID} .warn { color: #7a5c00; }
      #${ROOT_ID} .footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
      #${ROOT_ID} .small { font-size: 12px; opacity: .9; }
      #${ROOT_ID} .err { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.14); }
      #easyseas-upcoming-cruises-fab { position: fixed; right: 16px; bottom: 18px; z-index: 999999; display: flex; gap: 10px; }
      #easyseas-upcoming-cruises-fab button { box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
    `;
    document.head.appendChild(style);
  }

  function makeButton(text, cls) {
    const b = document.createElement('button');
    b.className = `es-btn ${cls || ''}`.trim();
    b.type = 'button';
    b.textContent = text;
    return b;
  }

  function createRoot() {
    const root = document.createElement('div');
    root.id = ROOT_ID;

    const panel = document.createElement('div');
    panel.className = 'es-panel';

    const header = document.createElement('div');
    header.className = 'es-title';
    header.innerHTML = `<div>Upcoming Cruises Export</div>`;

    const actions = document.createElement('div');
    actions.className = 'es-actions';

    const btnBuild = makeButton('SHOW ALL CRUISES', 'primary');
    const btnExport = makeButton('EXPORT CSV', 'secondary');
    btnExport.disabled = true;

    actions.appendChild(btnBuild);
    actions.appendChild(btnExport);

    const sub = document.createElement('div');
    sub.className = 'es-sub';
    sub.textContent = 'Builds a grid from this page and exports a CSV. No scraping of pricing; this is your upcoming reservations list.';

    const tableWrap = document.createElement('div');
    tableWrap.className = 'es-tablewrap';

    const footer = document.createElement('div');
    footer.className = 'footer';
    footer.innerHTML = `<div class="small">Columns: Ship, Dates, Title, Reservation, Category, Stateroom, Guests, Days</div><div class="small muted" id="easyseas-upcoming-cruises-count">0 rows</div>`;

    panel.appendChild(header);
    panel.appendChild(actions);
    panel.appendChild(sub);
    panel.appendChild(tableWrap);
    panel.appendChild(footer);

    root.appendChild(panel);

    return { root, btnBuild, btnExport, tableWrap, countEl: footer.querySelector('#easyseas-upcoming-cruises-count') };
  }

  function renderTable(rows) {
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Ship</th>
          <th>Dates</th>
          <th>Title</th>
          <th>Reservation</th>
          <th>Category</th>
          <th>Stateroom</th>
          <th>Guests</th>
          <th>Days</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.id = r._anchor;
      tr.innerHTML = `
        <td><strong>${escapeHtml(r.ship || '')}</strong></td>
        <td class="muted">${escapeHtml(r.dateRange || '')}</td>
        <td>${escapeHtml(r.title || '')}</td>
        <td><span class="pill">${escapeHtml(r.reservation || '')}</span></td>
        <td>${escapeHtml(r.category || '')}</td>
        <td>${escapeHtml(r.stateroom ? '#' + r.stateroom : '')}</td>
        <td>${escapeHtml(r.guests || '')}</td>
        <td class="muted">${escapeHtml(r.daysToGo || '')}</td>
      `;
      tbody.appendChild(tr);
    }

    return table;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rowsToCSV(rows) {
    const headers = ['Ship', 'Dates', 'Title', 'Reservation', 'Category', 'Stateroom', 'Guests', 'DaysToGo'];
    const esc = (v) => {
      const s = String(v ?? '');
      const needs = /[\n\r,\"]/g.test(s);
      const out = s.replace(/\"/g, '""');
      return needs ? `"${out}"` : out;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        r.ship,
        r.dateRange,
        r.title,
        r.reservation,
        r.category,
        r.stateroom ? '#' + r.stateroom : '',
        r.guests,
        r.daysToGo
      ].map(esc).join(','));
    }
    return lines.join('\n');
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Inject ----------
  async function init() {
    injectStyles();

    // Place a floating action button (FAB) like the existing workflow.
    const fab = document.createElement('div');
    fab.id = 'easyseas-upcoming-cruises-fab';

    const btnShow = document.createElement('button');
    btnShow.id = 'easyseas-show-all-cruises';
    btnShow.className = 'es-btn primary';
    btnShow.textContent = 'SHOW ALL CRUISES';

    const btnExportFab = document.createElement('button');
    btnExportFab.id = 'easyseas-export-cruises';
    btnExportFab.className = 'es-btn secondary';
    btnExportFab.textContent = 'EXPORT CSV';
    btnExportFab.disabled = true;

    fab.appendChild(btnShow);
    fab.appendChild(btnExportFab);
    document.body.appendChild(fab);

    // Insert a panel near top of main content.
    const { root, btnBuild, btnExport, tableWrap, countEl } = createRoot();

    const anchor = document.querySelector('main') || document.body;
    anchor.prepend(root);

    let currentRows = [];

    async function build() {
      btnBuild.disabled = true;
      btnShow.disabled = true;
      const cards = await waitForCruiseCards(20000);
      if (!cards.length) {
        tableWrap.innerHTML = `<div class="err">Couldn't find cruise cards yet. Try scrolling a bit, or refresh the page.</div>`;
        btnBuild.disabled = false;
        btnShow.disabled = false;
        return;
      }

      const rows = cards
        .map(parseCruiseCard)
        .filter((r) => r.ship || r.reservation || r.title);

      // Sort by dateRange text (best-effort). Leave stable for now.
      currentRows = rows;

      tableWrap.innerHTML = '';
      tableWrap.appendChild(renderTable(rows));

      const countText = `${rows.length} row${rows.length === 1 ? '' : 's'}`;
      countEl.textContent = countText;

      btnExport.disabled = rows.length === 0;
      btnExportFab.disabled = rows.length === 0;

      btnBuild.disabled = false;
      btnShow.disabled = false;

      log('Built grid', rows.length);
    }

    function doExport() {
      if (!currentRows.length) return;
      const csv = rowsToCSV(currentRows);
      const stamp = new Date().toISOString().slice(0, 10);
      download('booked.csv', csv);
      log('Exported CSV', currentRows.length);
    }

    btnBuild.addEventListener('click', build);
    btnShow.addEventListener('click', build);

    btnExport.addEventListener('click', doExport);
    btnExportFab.addEventListener('click', doExport);

    // Convenience: build once after content seems present.
    // (Don’t auto-download; only auto-build if page already loaded.)
    setTimeout(async () => {
      const cards = getCruiseCardRoots();
      if (cards.length) await build();
    }, 1200);

    log('Injected upcoming cruises grid UI');
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
