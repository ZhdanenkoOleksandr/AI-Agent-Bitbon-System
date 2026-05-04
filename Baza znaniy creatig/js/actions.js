/* actions.js — обработчики действий пользователя */

const Actions = {

  // ── Analysis queue control ────────────────────────────────────────
  _paused:  false,
  _stopped: false,

  pauseAnalysis() {
    this._paused = true;
    UI.setStatus('Пауза...', 'busy');
    UI.render();
  },

  resumeAnalysis() {
    this._paused = false;
    UI.setStatus('Продолжаю...', 'busy');
    UI.render();
  },

  stopAnalysis() {
    this._stopped = true;
    this._paused  = false;
    UI.setStatus('Остановка...', 'busy');
  },

  // ── API Key ───────────────────────────────────────────────────────

  saveApiKey() {
    const key = document.getElementById('apiKeyInput')?.value?.trim();
    if (!key || key.startsWith('••')) { UI.setStatus('Введи корректный ключ', 'err'); return; }
    CONFIG.setApiKey(key);
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('apiKeyInput').placeholder = '✓ Ключ сохранён (sk-ant-…' + key.slice(-6) + ')';
    UI.setStatus('API ключ сохранён', 'ok');
  },

  clearApiKey() {
    CONFIG.clearApiKey();
    const inp = document.getElementById('apiKeyInput');
    if (inp) { inp.value = ''; inp.placeholder = 'sk-ant-api03-…'; }
    UI.setStatus('API ключ удалён', 'ok');
  },

  // ── Source tab switching ─────────────────────────────────────────

  switchSrcTab(tab) {
    ['url','file','text'].forEach(t => {
      const panel = document.getElementById(`src-panel-${t}`);
      const btn   = document.getElementById(`st-${t}`);
      if (panel) panel.style.display = t === tab ? '' : 'none';
      if (btn)   btn.classList.toggle('on', t === tab);
    });
  },

  // ── URL fetch ────────────────────────────────────────────────────

  async fetchUrl() {
    const url = document.getElementById('urlInput')?.value?.trim();
    if (!url) { UI.setStatus('Введи URL', 'err'); return; }

    State.srcName               = url;
    State.currentSourceUrl      = url;
    State.currentSourcePriority = this._detectPriority(url);
    State.step = 1;
    State.busy = true;
    State.chunks = [];
    UI.render();

    try {
      const isYT = /youtube\.com\/watch|youtu\.be\//.test(url);
      if (isYT) {
        await this._fetchYouTube(url);
      } else {
        await this._fetchWebPage(url);
      }
    } catch (err) {
      console.error('fetchUrl error:', err);
      UI.setStatus('Помилка: ' + err.message, 'err');
      State.step = 0; State.busy = false; UI.render();
    }
  },

  async _fetchYouTube(url) {
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
    if (!videoId) throw new Error('Не вдалося визначити ID відео');

    UI.setStatus(`YouTube: ${videoId} — отримую дані...`, 'busy');

    // 1. Метадані через noembed (no CORS issues)
    let title = '', author = '';
    try {
      const meta = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`).then(r => r.json());
      title  = meta.title  || '';
      author = meta.author_name || '';
    } catch (e) { console.warn('noembed failed:', e); }

    // 2. Субтитри через corsproxy.io — пробуємо мови по черзі
    let transcript = '';
    const langs = ['uk', 'ru', 'en'];
    for (const lang of langs) {
      try {
        const ytUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`;
        const resp  = await fetch(`https://corsproxy.io/?${encodeURIComponent(ytUrl)}`);
        const data  = await resp.json();
        if (data?.events?.length) {
          transcript = data.events
            .filter(e => e.segs)
            .map(e => e.segs.map(s => s.utf8 || '').join(''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (transcript) { UI.setStatus(`Субтитри (${lang}) знайдено`, 'busy'); break; }
        }
      } catch (e) { console.warn(`transcript ${lang} failed:`, e); }
    }

    // 3. Збираємо текст
    let text = '';
    if (title)      text += `# ${title}\n\n`;
    if (author)     text += `Автор: ${author}\n\n`;
    if (transcript) text += `## Транскрипт\n\n${transcript}`;
    else            text += `[Субтитри недоступні. Вставте транскрипт вручну або скопіюйте опис відео нижче.]`;

    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 10) throw new Error('Контент недоступний — спробуй скопіювати текст вручну');

    State.srcName = title || url;
    UI.setStatus(`YouTube: ${words} слів, запускаю обробку...`, 'busy');
    this._runPipeline(text);
  },

  async _fetchWebPage(url) {
    UI.setStatus('Завантажую сторінку...', 'busy');

    // Пробуємо два проксі по черзі
    const proxies = [
      u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    let html = '';
    for (const makeProxy of proxies) {
      try {
        const resp = await fetch(makeProxy(url));
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const d = await resp.json();
          html = d.contents || d.data || '';
        } else {
          html = await resp.text();
        }
        if (html && html.length > 200) break;
      } catch (e) { console.warn('proxy failed:', e); }
    }

    if (!html) throw new Error('Не вдалося завантажити — сторінка закрита для парсингу');

    // Парсимо HTML
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, 'text/html');

    ['script','style','nav','footer','header','aside','noscript','iframe','form'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    const title  = doc.querySelector('title')?.textContent?.trim() || '';
    const main   = doc.querySelector('main, article, [role="main"], .content, .post-content, .entry-content, body');
    const rawTxt = (main?.innerText || main?.textContent || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const text   = (title ? `# ${title}\n\n` : '') + rawTxt;

    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 20) throw new Error('Текст не витягнуто — можливо сторінка потребує авторизації');

    State.srcName = title || url;
    UI.setStatus(`Сайт: ${words} слів, запускаю обробку...`, 'busy');
    this._runPipeline(text);
  },

  // ── File handling ────────────────────────────────────────────────

  handleDragOver(e) {
    e.preventDefault();
    document.getElementById('dropZone')?.classList.add('over');
  },
  handleDragLeave(e) {
    document.getElementById('dropZone')?.classList.remove('over');
  },
  handleDrop(e) {
    e.preventDefault();
    document.getElementById('dropZone')?.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) this.handleFile(file);
  },

  handleFile(file) {
    if (!file) return;
    State.srcName = file.name;
    const urlInput = document.getElementById('sourceUrl')?.value?.trim() || '';
    State.currentSourcePriority = this._detectPriority(urlInput || file.name);
    State.currentSourceUrl      = urlInput;
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      this._extractPDF(file);
    } else {
      const reader = new FileReader();
      reader.onload = e => this._runPipeline(e.target.result);
      reader.onerror = () => UI.setStatus('Ошибка чтения файла', 'err');
      reader.readAsText(file, 'utf-8');
    }
  },

  processText() {
    const text = document.getElementById('pasteText')?.value?.trim();
    if (!text) {
      UI.setStatus('Вставь текст', 'err');
      return;
    }
    State.srcName = 'Вставленный текст';
    // Визначаємо пріоритет за URL/назвою джерела
    const urlInput = document.getElementById('sourceUrl')?.value?.trim() || '';
    State.currentSourcePriority = this._detectPriority(urlInput || State.srcName);
    State.currentSourceUrl      = urlInput;
    this._runPipeline(text);
  },

  // ── Priority detection ────────────────────────────────────────────

  _detectPriority(source) {
    const s = (source || '').toLowerCase();
    const isPriority = CONFIG.PRIORITY_SOURCES.some(ps => s.includes(ps.toLowerCase()));
    return isPriority ? 'core' : 'extended';
  },

  _updateSourcePriorityHint() {
    const val  = document.getElementById('sourceUrl')?.value?.trim() || '';
    const hint = document.getElementById('sourcePriorityHint');
    if (!hint) return;
    const priority = this._detectPriority(val);
    hint.textContent  = priority === 'core' ? '🔴 CORE — пріоритетне джерело' : '⚪ Extended — додаткове джерело';
    hint.style.color  = priority === 'core' ? 'var(--green)' : 'var(--text3)';
  },

  // ── Pipeline ─────────────────────────────────────────────────────

  async _extractPDF(file) {
    State.step = 1;
    State.busy = true;
    UI.render();
    UI.setStatus(`Витягую текст з PDF (${file.name})...`, 'busy');

    try {
      const buffer = await file.arrayBuffer();
      const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages  = [];

      UI.setStatus(`PDF: ${pdf.numPages} сторінок, витягую...`, 'busy');

      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();

        // Відновлюємо структуру рядків за Y-координатами елементів
        const lines = [];
        let   cur   = '';
        let   lastY = null;

        for (const item of content.items) {
          if (!item.str) continue;
          const y = item.transform ? item.transform[5] : null;

          if (lastY !== null && y !== null) {
            const dy = Math.abs(y - lastY);
            if (dy > 10) {
              // Великий стрибок Y → новий абзац
              if (cur.trim()) lines.push(cur.trim());
              if (dy > 20) lines.push(''); // порожній рядок між абзацами
              cur = '';
            } else if (dy > 2) {
              // Малий стрибок Y → новий рядок
              if (cur.trim()) lines.push(cur.trim());
              cur = '';
            }
          }

          cur  += item.str;
          lastY = y;
        }
        if (cur.trim()) lines.push(cur.trim());

        pages.push(lines.join('\n'));
      }

      const text = pages.join('\n\n').trim();

      // Діагностика
      const words = text.split(/\s+/).filter(Boolean).length;
      console.log(`PDF extracted: ${text.length} chars, ${words} words`);

      if (!text || words < 10) {
        UI.setStatus('PDF не містить текстового шару — спробуй скопіювати текст вручну', 'err');
        State.step = 0;
        State.busy = false;
        UI.render();
        return;
      }

      UI.setStatus(`Витягнуто ${words} слів, нарізаю на чанки...`, 'busy');
      this._runPipeline(text);

    } catch (err) {
      console.error('PDF extraction error:', err);
      UI.setStatus('Помилка PDF: ' + err.message, 'err');
      State.step = 0;
      State.busy = false;
      UI.render();
    }
  },

  async _runPipeline(text) {
    this._paused  = false;
    this._stopped = false;

    State.step   = 1;
    State.busy   = true;
    State.chunks = [];
    UI.render();
    UI.setStatus('Нарезаю на чанки...', 'busy');

    await sleep(300);

    // Chunking
    const rawChunks = Chunker.chunk(text);
    const srcPriority = State.currentSourcePriority || 'extended';
    const srcUrl      = State.currentSourceUrl      || '';
    State.chunks = rawChunks.map((t, i) => ({
      id:          i,
      text:        t,
      editedText:  null,
      analysis:    null,
      status:      'pending',
      comment:     '',
      addedAt:     null,
      priority:    srcPriority,
      source:      srcUrl,
    }));

    if (State.chunks.length === 0) {
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      State.step = 0;
      State.busy = false;
      UI.setStatus(`0 чанків — знайдено ${wordCount} слів, але абзаців не виявлено`, 'err');
      UI.render();
      return;
    }

    State.step = 2;
    UI.render();
    UI.setStatus(`Аналізую ${State.chunks.length} чанків...`, 'busy');

    // Analyze each chunk (с поддержкой паузы/остановки)
    for (let i = 0; i < State.chunks.length; i++) {
      while (this._paused && !this._stopped) {
        await sleep(300);
      }
      if (this._stopped) break;

      try {
        State.chunks[i].analysis = await Analyzer.analyze(State.chunks[i].text);
      } catch (err) {
        console.warn(`Chunk ${i} analysis failed:`, err.message);
        State.chunks[i].analysis = Analyzer.fallback(State.chunks[i].text);
        if (err.message.includes('API ключ не задан')) {
          State.busy = false;
          UI.setStatus('Нет API ключа! Введи его на вкладке Источник.', 'err');
          UI.render();
          return;
        }
      }
      UI.setStatus(`${i + 1} / ${State.chunks.length} проанализировано`, 'busy');
      UI.render();
      await sleep(150);
    }

    const done = State.chunks.filter(c => c.analysis).length;
    State.step = 3;
    State.busy = false;
    this._paused  = false;
    this._stopped = false;
    UI.updateBadges();
    UI.setStatus(`Готово: ${done} из ${State.chunks.length} чанков`, 'ok');
    UI.render();
  },

  resetPipeline() {
    this._stopped = true;
    this._paused  = false;
    State.reset();
    UI.render();
    UI.setStatus('Готов', 'ok');
  },

  // ── Review actions ───────────────────────────────────────────────

  startEdit(id) {
    State.chunks[id].status = 'editing';
    UI.render();
  },

  cancelEdit(id) {
    State.chunks[id].status = 'pending';
    UI.render();
  },

  saveEdit(id) {
    const newText = document.getElementById(`et${id}`)?.value;
    const newSeg  = document.getElementById(`es${id}`)?.value;
    const newLink = document.getElementById(`el${id}`)?.value?.trim();
    if (newText) State.chunks[id].editedText = newText;
    if (newSeg)  State.chunks[id].analysis.segment = newSeg;
    if (newLink !== undefined) State.chunks[id].source = newLink;
    State.chunks[id].status = 'pending';
    UI.render();
  },

  approve(id) {
    const comment = document.getElementById(`cm${id}`);
    if (comment) State.chunks[id].comment = comment.value;
    State.approveChunk(id);
    UI.updateBadges();
    UI.render();
  },

  reject(id) {
    const comment = document.getElementById(`cm${id}`);
    if (comment) State.chunks[id].comment = comment.value;
    State.chunks[id].status = 'rejected';
    UI.updateBadges();
    UI.render();
  },

  undo(id) {
    State.revokeChunk(id);
    UI.updateBadges();
    UI.render();
  },

  approveAll() {
    State.pending.forEach(c => State.approveChunk(c.id));
    UI.updateBadges();
    UI.render();
  },

  // ── Export & KB management ───────────────────────────────────────

  exportKB() {
    const json = State.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `kb_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  clearKB() {
    if (!confirm('Очистити всю базу знань, включно з базовим скелетом? Дія незворотня.')) return;
    State.clearKB();
    UI.updateBadges();
    UI.render();
    UI.setStatus('База знань очищена', 'ok');
  },

  clearExtendedKB() {
    if (!confirm('Видалити розширені знання? Базовий скелет (core) залишиться.')) return;
    State.clearExtendedKB();
    UI.updateBadges();
    UI.render();
    UI.setStatus('Розширені знання видалені, скелет збережений', 'ok');
  },

  resetSeedKB() {
    // Перезавантажити скелет із config (на випадок якщо видалили)
    const prev = State.kb.filter(c => c.priority === 'core').length;
    State.kb = State.kb.filter(c => c.priority !== 'core'); // видалити старі core
    const added = State.loadSeedKB();
    UI.updateBadges();
    UI.render();
    UI.setStatus(`Скелет перезавантажено: ${added} базових знань`, 'ok');
  },
};

// Shortcuts доступны из HTML
function approve(id)    { Actions.approve(id); }
function reject(id)     { Actions.reject(id);  }
