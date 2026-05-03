/* app.js — главный контроллер UI */

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const UI = {

  switch(tab) {
    State.tab = tab;

    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.tab === tab);
    });

    // Sidebar items
    document.querySelectorAll('.si[data-tab]').forEach(el => {
      el.classList.toggle('on', el.dataset.tab === tab);
    });

    this.render();
  },

  render() {
    const el = document.getElementById('content');
    if (!el) return;

    switch (State.tab) {
      case 'src': el.innerHTML = Tabs.source();  break;
      case 'rev': el.innerHTML = Tabs.review();  break;
      case 'kb':  el.innerHTML = Tabs.kb();      break;
      case 'st':  el.innerHTML = Tabs.stats();   break;
    }

    this.updateBadges();
  },

  updateBadges() {
    const pending = State.pending.length;

    // Tab badge
    const rb = document.getElementById('rb');
    if (rb) rb.textContent = pending;

    // Sidebar badge
    document.querySelectorAll('.srb').forEach(el => el.textContent = pending);

    // KB badge
    const kbEl = document.getElementById('kbBadge');
    if (kbEl) kbEl.textContent = State.kb.length;

    // Segment sidebar
    const segEl = document.getElementById('segSidebar');
    if (segEl) segEl.innerHTML = Components.segmentSidebar();
  },

  setStatus(msg, state = 'ok') {
    const txt  = document.getElementById('stxt');
    const dot  = document.getElementById('sdot');
    if (txt) txt.textContent = msg;
    if (dot) dot.className = 'status-dot' + (state === 'busy' ? ' busy' : state === 'err' ? ' err' : '');
  },
};

// ── Tab click handlers ───────────────────────────────────────────────
document.querySelectorAll('.tab[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => UI.switch(btn.dataset.tab));
});
document.querySelectorAll('.si[data-tab]').forEach(el => {
  el.addEventListener('click', () => UI.switch(el.dataset.tab));
});

// ── textarea character counter ───────────────────────────────────────
document.addEventListener('input', e => {
  if (e.target.id === 'pasteText') {
    const words  = e.target.value.trim().split(/\s+/).filter(Boolean).length;
    const infoEl = document.getElementById('pasteInfo');
    if (infoEl) infoEl.textContent = words > 0 ? `${words} слов` : '';
  }
});

// ── Boot ─────────────────────────────────────────────────────────────
UI.render();
UI.setStatus('Готов', 'ok');
