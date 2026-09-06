// styles.js — floating trigger button
(function(){
  const css = `
    .escr-btn {
      position: fixed; z-index: 2147483646; right: 16px; bottom: 72px;
      padding: 10px 14px; background:#5a2ea6; color:#fff; border:none; border-radius:12px;
      font-weight:600; box-shadow:0 6px 18px rgba(0,0,0,.25); cursor:pointer;
    }
    .escr-btn:active { transform: translateY(1px); }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);
})();
