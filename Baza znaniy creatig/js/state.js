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

  // одобренные чанки в базе знаний
  // (в продакшене заменить на IndexedDB или API)
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
      const seg = c.analysis?.segment || 'general';
      if (!map[seg]) map[seg] = [];
      map[seg].push(c);
    });
    return map;
  },

  // Добавить чанк в KB
  approveChunk(id) {
    const chunk = this.chunks[id];
    if (!chunk) return;
    chunk.status    = 'approved';
    chunk.approvedAt = new Date().toISOString();
    // не дублировать
    if (!this.kb.find(c => c.id === id)) {
      this.kb.push(chunk);
    }
  },

  // Убрать из KB (при undo)
  revokeChunk(id) {
    this.kb = this.kb.filter(c => c.id !== id);
    if (this.chunks[id]) this.chunks[id].status = 'pending';
  },

  // Экспорт KB в JSON
  exportJSON() {
    return JSON.stringify({
      exported_at:   new Date().toISOString(),
      source:        this.srcName,
      total:         this.kb.length,
      by_segment:    Object.fromEntries(
        Object.entries(this.kbBySegment).map(([k, v]) => [k, v.length])
      ),
      chunks: this.kb.map(c => ({
        id:            c.id,
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
