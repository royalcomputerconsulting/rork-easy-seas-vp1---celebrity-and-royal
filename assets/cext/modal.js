// modal.js — CSV helper
(function(){
  window.EasySeas = window.EasySeas || {};

  function csvEscape(val){
    if (val == null) return "";
    const s = String(val).replace(/\r?\n|\r/g, " ").replace(/\s+/g," ").trim();
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
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

    const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  EasySeas.Helpers = { downloadCSV };
})();
