/* state.js — центральное хранилище состояния приложения */

const State = {
  // текущий таб
  tab: 'src',

  // шаг пайплайна: 0=idle, 1=extracting, 2=chunking, 3=analyzing, 4=ready
  step: 0,

  // имя текущего источника
  srcName: '',

  // все чанки текущего источника
  // формат: { id, text, editedText, analysis, status, comment, addedAt }
  chunks: [],

  // одобренные чанки в базе знаний (автосохранение в localStorage)
  kb: [],

  // флаг работы
  busy: false,

  // helper: pending чанки
  get pending() { return this.chunks.filter(c => c.status === 'pending'); },

  // helper: статистика
  get stats() {
    return {
      total:    this.chunks.length,
      approved: this.chunks.filter(c => c.status === 'approved').length,
      rejected: this.chunks.filter(c => c.status === 'rejected').length,
      edited:   this.chunks.filter(c => c.editedText).length,
      pending:  this.chunks.filter(c => c.status === 'pending').length,
    };
  },

  // helper: KB по сегментам
  get kbBySegment() {
    const map = {};
    this.kb.forEach(c => {
      const seg = c.analysis?.segment || c.segment || 'general';
      if (!map[seg]) map[seg] = [];
      map[seg].push(c);
    });
    return map;
  },

  // helper: кількість core-знань (скелет)
  get coreCount() {
    return this.kb.filter(c => c.priority === 'core').length;
  },

  // Добавить чанк в KB
  approveChunk(id) {
    const chunk = this.chunks[id];
    if (!chunk) return;
    chunk.status     = 'approved';
    chunk.approvedAt = new Date().toISOString();
    if (!this.kb.find(c => c.id === id)) {
      this.kb.push(chunk);
    }
    this.saveKB();
  },

  // Убрать из KB (при undo)
  revokeChunk(id) {
    this.kb = this.kb.filter(c => c.id !== id);
    if (this.chunks[id]) this.chunks[id].status = 'pending';
    this.saveKB();
  },

  // ── Persistence (localStorage) ────────────────────────────────────

  saveKB() {
    try {
      localStorage.setItem('kb_data', JSON.stringify(this.kb));
    } catch (e) { console.warn('saveKB:', e); }
  },

  loadKB() {
    try {
      const d = localStorage.getItem('kb_data');
      if (d) this.kb = JSON.parse(d);
    } catch (e) { console.warn('loadKB:', e); this.kb = []; }
  },

  // Завантажити seed-знання зі скелету якщо KB порожня або немає core
  loadSeedKB() {
    const hasCore = this.kb.some(c => c.priority === 'core');
    if (hasCore) return 0; // вже є скелет

    const seeds = CONFIG.SEED_KB || [];
    let added = 0;
    seeds.forEach((seed, i) => {
      const entry = {
        id:          `seed_${i}`,
        text:        seed.text,
        editedText:  null,
        status:      'approved',
        comment:     `Базова знання з ${seed.source}`,
        priority:    'core',
        source:      seed.source,
        approvedAt:  new Date().toISOString(),
        analysis: {
          segment:            seed.segment,
          segment_confidence: 1.0,
          summary:            seed.summary,
          key_concepts:       seed.key_concepts,
          knowledge_type:     seed.knowledge_type,
          quality_score:      seed.quality_score,
          is_likely_outdated: false,
          language:           'uk',
          bitbon_relevance:   'high',
        },
      };
      if (!this.kb.find(c => c.id === entry.id)) {
        this.kb.push(entry);
        added++;
      }
    });
    if (added > 0) this.saveKB();
    return added;
  },

  clearKB() {
    this.kb = [];
    localStorage.removeItem('kb_data');
  },

  // Видалити тільки non-core (розширені знання), зберегти скелет
  clearExtendedKB() {
    this.kb = this.kb.filter(c => c.priority === 'core');
    this.saveKB();
  },

  // Экспорт KB в JSON
  exportJSON() {
    const coreItems     = this.kb.filter(c => c.priority === 'core');
    const extendedItems = this.kb.filter(c => c.priority !== 'core');
    return JSON.stringify({
      exported_at:      new Date().toISOString(),
      total:            this.kb.length,
      core_count:       coreItems.length,
      extended_count:   extendedItems.length,
      by_segment:       Object.fromEntries(
        Object.entries(this.kbBySegment).map(([k, v]) => [k, v.length])
      ),
      chunks: this.kb.map(c => ({
        id:            c.id,
        priority:      c.priority || 'extended',
        source:        c.source || null,
        text:          c.editedText || c.text,
        original_text: c.editedText ? c.text : undefined,
        analysis:      c.analysis,
        comment:       c.comment || null,
        approved_at:   c.approvedAt,
      })),
    }, null, 2);
  },

  reset() {
    this.step    = 0;
    this.srcName = '';
    this.chunks  = [];
    this.busy    = false;
  },
};
