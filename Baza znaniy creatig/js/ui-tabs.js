/* ui-tabs.js — рендерит содержимое каждой вкладки */

const Tabs = {

  // ── SOURCE TAB ────────────────────────────────────────────────────
  source() {
    const s = State.step;
    if (s === 1 || s === 2) {
      const analyzed = State.chunks.filter(c => c.analysis).length;
      const msg      = s === 1 ? 'Извлекаю текст...' : 'Анализирую через Claude API...';
      const counter  = s === 2 ? `${analyzed}/${State.chunks.length} чанков` : '';
      return Components.pipelineSteps() + Components.loading(msg, counter);
    }

    if (s === 3) {
      return Components.pipelineSteps() + `
        <div class="note green">
          ✓ Анализ завершён — <strong>${State.chunks.length} чанков</strong> готовы к проверке
          из «${esc(State.srcName)}»
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ok" onclick="UI.switch('rev')">→ Перейти к проверке</button>
          <button class="btn btn-ed btn-sm" onclick="Actions.resetPipeline()">↺ Загрузить новый источник</button>
        </div>`;
    }

    // s === 0 — idle
    return Components.pipelineSteps() + `
      <div class="note blue">
        💡 <strong>Принцип работы:</strong> Загрузи PDF или вставь текст —
        система нарежет на смысловые блоки и проанализирует каждый через Claude.
        Затем <strong>ты лично проверяешь каждый фрагмент</strong> перед добавлением в базу.
      </div>

      <div class="drop" id="dropZone"
           onclick="document.getElementById('fileInput').click()"
           ondrop="Actions.handleDrop(event)"
           ondragover="Actions.handleDragOver(event)"
           ondragleave="Actions.handleDragLeave(event)">
        <input type="file" id="fileInput" accept=".pdf,.txt" onchange="Actions.handleFile(this.files[0])">
        <div class="drop-icon">📁</div>
        <div class="drop-text">Перетащи PDF или нажми для выбора</div>
        <div class="drop-sub">.pdf · .txt · до 50 МБ</div>
      </div>

      <div class="divider">или вставь текст напрямую</div>

      <textarea id="pasteText" rows="7" placeholder="Вставь текст здесь — лекцию, статью, транскрипт..."></textarea>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-ok" onclick="Actions.processText()">▶ Обработать</button>
        <span id="pasteInfo" style="font-size:11px;color:var(--text3)"></span>
      </div>`;
  },

  // ── REVIEW TAB ────────────────────────────────────────────────────
  review() {
    if (!State.chunks.length) {
      return Components.empty('📋', 'Нет чанков для проверки', 'Загрузи источник на вкладке Источник');
    }

    const pending  = State.pending;
    const reviewed = State.chunks.filter(c => c.status !== 'pending');

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:13px;font-weight:600">Очередь проверки</span>
        <span style="font-size:11px;color:var(--text3)">${pending.length} ожидает · ${reviewed.length} проверено</span>
        ${pending.length
          ? `<button class="btn btn-ok btn-sm" style="margin-left:auto" onclick="Actions.approveAll()">✓ Одобрить все</button>`
          : ''}
      </div>

      ${pending.map(c => Components.chunkCard(c)).join('')}

      ${reviewed.length ? `
        <div style="margin:14px 0 8px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">
          Проверено (${reviewed.length})
        </div>
        ${reviewed.map(c => Components.chunkCard(c, true)).join('')}
      ` : ''}`;
  },

  // ── KB TAB ────────────────────────────────────────────────────────
  kb() {
    if (!State.kb.length) {
      return Components.empty('🧠', 'База знаний пуста', 'Одобряй чанки в очереди проверки');
    }

    const bySeg = State.kbBySegment;

    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:13px;font-weight:600">База знаний</span>
        <span style="font-size:11px;color:var(--text3)">${State.kb.length} записей · ${Object.keys(bySeg).length} сегментов</span>
        <button class="btn btn-ed btn-sm" style="margin-left:auto" onclick="Actions.exportKB()">⬇ JSON</button>
      </div>

      ${Object.entries(bySeg).map(([seg, items]) => {
        const sc = CONFIG.SEG_COLORS[seg] || '#8b949e';
        return `<div class="kseg">
          <div class="ksh">
            <span class="dot" style="background:${sc}"></span>
            <span class="ksn" style="color:${sc}">${seg.replace(/_/g,' ')}</span>
            <span style="font-size:11px;color:var(--text3)">${items.length} записей</span>
          </div>
          ${items.map(item => `
            <div class="ki">
              <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text3)">#${item.id+1}</span>
                ${item.analysis.key_concepts.slice(0,3).map(k=>`<span class="tag">${esc(k)}</span>`).join('')}
                ${item.comment    ? `<span class="tag b" title="${esc(item.comment)}">💬</span>` : ''}
                ${item.editedText ? `<span class="tag a">✎</span>` : ''}
              </div>
              <div style="font-size:11px">${esc((item.editedText||item.text).slice(0,160))}…</div>
              <div style="font-size:10px;color:var(--text3);margin-top:2px">${esc(item.analysis.summary)}</div>
            </div>`).join('')}
        </div>`;
      }).join('')}`;
  },

  // ── STATS TAB ────────────────────────────────────────────────────
  stats() {
    const st     = State.stats;
    const bySeg  = State.kbBySegment;
    const total  = State.kb.length;

    return `
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">Статистика</div>

      <div class="sgrid">
        <div class="sc"><div class="sn" style="color:var(--blue)">${st.total}</div><div class="sl2">всего чанков</div></div>
        <div class="sc"><div class="sn" style="color:var(--green)">${st.approved}</div><div class="sl2">одобрено</div></div>
        <div class="sc"><div class="sn" style="color:var(--red)">${st.rejected}</div><div class="sl2">отклонено</div></div>
        <div class="sc"><div class="sn" style="color:var(--amber)">${st.edited}</div><div class="sl2">отредактировано</div></div>
      </div>

      ${total > 0 ? `
        <div style="font-size:11px;font-weight:600;margin:14px 0 8px;color:var(--text2)">Распределение по сегментам</div>
        ${Object.entries(bySeg).sort((a,b) => b[1].length - a[1].length).map(([seg, items]) => {
          const pct = Math.round(items.length / total * 100);
          const sc  = CONFIG.SEG_COLORS[seg] || '#8b949e';
          return `<div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
            <span style="width:160px;font-size:11px;color:var(--text2)">${seg.replace(/_/g,' ')}</span>
            <div class="strack" style="flex:1">
              <div class="sfill" style="width:${pct}%;background:${sc}"></div>
            </div>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${sc};min-width:28px">${items.length}</span>
          </div>`;
        }).join('')}
      ` : `<div class="note blue">Добавь и одобри чанки чтобы увидеть статистику.</div>`}`;
  },
};
