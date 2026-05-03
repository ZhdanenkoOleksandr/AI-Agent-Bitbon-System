/* ui-components.js — переиспользуемые HTML-компоненты */

const Components = {

  /** Карточка одного чанка */
  chunkCard(chunk, compact = false) {
    if (!chunk.analysis) {
      return `<div class="card">
        <div class="ch"><span class="spin"></span>
          <span style="color:var(--text3)">Анализирую...</span>
        </div>
      </div>`;
    }

    const a   = chunk.analysis;
    const sc  = CONFIG.SEG_COLORS[a.segment] || '#8b949e';
    const qc  = a.quality_score > .75 ? 'var(--green)' : a.quality_score > .5 ? 'var(--amber)' : 'var(--red)';
    const isEd = chunk.status === 'editing';

    const pillClass = { pending:'p-pend', approved:'p-ok', rejected:'p-no', editing:'p-ed' }[chunk.status];
    const pillLabel = { pending:'Ожидает', approved:'Одобрено', rejected:'Отклонено', editing:'Редактируется' }[chunk.status];
    const typeTag   = a.knowledge_type === 'definition' ? 'b' : a.knowledge_type === 'theory' ? 'p' : 'a';

    return `<div class="card" id="c${chunk.id}">
      <div class="ch">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--text3);min-width:24px">#${chunk.id + 1}</span>
        <span class="tag" style="background:${hexRgba(sc,.12)};color:${sc};border-color:${hexRgba(sc,.3)}">
          ${a.segment.replace(/_/g,' ')}
        </span>
        <span class="tag ${typeTag}">${a.knowledge_type}</span>
        ${a.is_likely_outdated ? `<span class="tag r">⚠ устарело</span>` : ''}
        ${chunk.editedText      ? `<span class="tag b">✎ изменён</span>`   : ''}
        ${a.error               ? `<span class="tag r">⚠ API ошибка</span>` : ''}
        <span class="pill ${pillClass}" style="margin-left:auto">${pillLabel}</span>
      </div>
      <div class="cb">
        ${isEd
          ? `<textarea class="ctext" id="et${chunk.id}">${esc(chunk.editedText || chunk.text)}</textarea>
             <select id="es${chunk.id}" style="margin-top:7px">
               ${CONFIG.SEGMENTS.map(s => `<option value="${s}" ${s === a.segment ? 'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
             </select>`
          : `<div class="ctext">${esc(chunk.editedText || chunk.text)}</div>`
        }

        ${!compact ? `
        <div class="agrid">
          <div class="ai full">
            <div class="al">Резюме Claude</div>
            <div class="av">${esc(a.summary)}</div>
          </div>
          <div class="ai">
            <div class="al">Ключевые концепты</div>
            <div class="av">${a.key_concepts.map(k => `<span class="tag">${esc(k)}</span>`).join('') || '<span style="color:var(--text3)">—</span>'}</div>
          </div>
          <div class="ai">
            <div class="al">Качество</div>
            <div class="av">
              <div class="sbar">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:${qc}">${Math.round(a.quality_score * 100)}%</span>
                <div class="strack"><div class="sfill" style="width:${a.quality_score * 100}%;background:${qc}"></div></div>
              </div>
            </div>
          </div>
        </div>
        <textarea class="ctext cmnt" id="cm${chunk.id}" placeholder="Заметка администратора (необязательно)...">${esc(chunk.comment || '')}</textarea>
        ` : ''}

        <div class="acts">
          ${isEd
            ? `<button class="btn btn-sv" onclick="Actions.saveEdit(${chunk.id})">💾 Сохранить</button>
               <button class="btn btn-no btn-sm" onclick="Actions.cancelEdit(${chunk.id})">Отмена</button>`
            : chunk.status === 'pending'
              ? `<button class="btn btn-ok" onclick="Actions.approve(${chunk.id})">✓ Одобрить</button>
                 <button class="btn btn-ed" onclick="Actions.startEdit(${chunk.id})">✎ Редактировать</button>
                 <button class="btn btn-no" onclick="Actions.reject(${chunk.id})">✗ Отклонить</button>`
              : `<button class="btn btn-ed btn-sm" onclick="Actions.undo(${chunk.id})">↩ Вернуть в очередь</button>`
          }
        </div>
      </div>
    </div>`;
  },

  /** Блок прогресса пайплайна */
  pipelineSteps() {
    const s = State.step;
    const steps = [
      { i:'📄', n:'Текст',     state: s>0?'done':s===0?'run':'wait' },
      { i:'✂️',  n:'Нарезка',   state: s>1?'done':s===1?'run':'wait' },
      { i:'🤖', n:'AI Анализ', state: s>2?'done':s===2?'run':'wait' },
      { i:'✅', n:'Проверка',  state: s>3?'done':s===3?'run':'wait' },
    ];
    const sc = { done:'var(--green)', run:'var(--amber)', wait:'var(--text3)' };
    const sl = { done:'✓ готово', run:'● работаю', wait:'○ ожидание' };
    return `<div class="pipe">
      ${steps.map(step => `
        <div class="ps ${step.state}">
          <div class="psi">${step.i}</div>
          <div class="psn">${step.n}</div>
          <div class="pss" style="color:${sc[step.state]}">${sl[step.state]}</div>
        </div>`).join('')}
    </div>`;
  },

  /** Индикатор загрузки */
  loading(msg, counter = '') {
    return `<div class="card">
      <div class="ch">
        <span class="spin"></span>
        <span style="color:var(--amber)">${esc(msg)}</span>
        ${counter ? `<span style="margin-left:auto;font-size:11px;color:var(--text3)">${esc(counter)}</span>` : ''}
      </div>
      <div class="cb">
        <div class="lbw"><div class="lbf"></div></div>
        <div style="font-size:11px;color:var(--text2);margin-top:5px">Источник: ${esc(State.srcName)}</div>
      </div>
    </div>`;
  },

  /** Пустое состояние */
  empty(icon, title, subtitle = '') {
    return `<div class="empty">
      <div class="ei">${icon}</div>
      <div>${esc(title)}</div>
      ${subtitle ? `<div style="margin-top:6px;font-size:11px;color:var(--text3)">${esc(subtitle)}</div>` : ''}
    </div>`;
  },

  /** Сайдбар с сегментами */
  segmentSidebar() {
    const cnt = {};
    CONFIG.SEGMENTS.forEach(s => cnt[s] = 0);
    State.kb.forEach(c => cnt[c.analysis?.segment || 'general']++);
    return CONFIG.SEGMENTS.map(s => `
      <div class="si" style="font-size:11px" onclick="UI.switch('kb')">
        <span class="dot" style="background:${CONFIG.SEG_COLORS[s]}"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.replace(/_/g,' ')}</span>
        ${cnt[s] ? `<span style="font-size:10px;color:var(--text3)">${cnt[s]}</span>` : ''}
      </div>`).join('');
  },
};

/* ── Helpers ── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
