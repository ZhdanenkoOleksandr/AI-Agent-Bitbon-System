/* actions.js — обработчики действий пользователя */

const Actions = {

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
    this._runPipeline(text);
  },

  // ── Pipeline ─────────────────────────────────────────────────────

  async _extractPDF(file) {
    State.step = 1;
    State.busy = true;
    UI.render();
    UI.setStatus('Извлекаю текст из PDF...', 'busy');

    try {
      const buffer = await file.arrayBuffer();
      const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages  = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text    = content.items.map(it => it.str).join(' ');
        pages.push(text);
      }

      const text = pages.join('\n\n').replace(/ {2,}/g, ' ').trim();
      this._runPipeline(text);
    } catch (err) {
      console.error('PDF extraction error:', err);
      UI.setStatus('Ошибка PDF: ' + err.message, 'err');
      State.step = 0;
      State.busy = false;
      UI.render();
    }
  },

  async _runPipeline(text) {
    State.step   = 1;
    State.busy   = true;
    State.chunks = [];
    UI.render();
    UI.setStatus('Нарезаю на чанки...', 'busy');

    await sleep(300);

    // Chunking
    const rawChunks = Chunker.chunk(text);
    State.chunks = rawChunks.map((t, i) => ({
      id:          i,
      text:        t,
      editedText:  null,
      analysis:    null,
      status:      'pending',
      comment:     '',
      addedAt:     null,
    }));

    State.step = 2;
    UI.render();
    UI.setStatus(`Анализирую ${State.chunks.length} чанков...`, 'busy');

    // Analyze each chunk
    for (let i = 0; i < State.chunks.length; i++) {
      try {
        State.chunks[i].analysis = await Analyzer.analyze(State.chunks[i].text);
      } catch (err) {
        console.warn(`Chunk ${i} analysis failed:`, err.message);
        State.chunks[i].analysis = Analyzer.fallback(State.chunks[i].text);
      }
      UI.setStatus(`${i + 1} / ${State.chunks.length} проанализировано`, 'busy');
      UI.render(); // обновляем счётчик
      await sleep(100); // небольшая пауза между запросами
    }

    State.step = 3;
    State.busy = false;
    UI.updateBadges();
    UI.setStatus(`Готово: ${State.chunks.length} чанков`, 'ok');
    UI.render();
  },

  resetPipeline() {
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
    if (newText) State.chunks[id].editedText = newText;
    if (newSeg)  State.chunks[id].analysis.segment = newSeg;
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

  // ── Export ───────────────────────────────────────────────────────

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
};

// Shortcut для одобрения — доступен из HTML
function approve(id)    { Actions.approve(id); }
function reject(id)     { Actions.reject(id);  }
