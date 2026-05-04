/* chunker.js — нарезает текст на смысловые блоки с перекрытием */

const Chunker = {
  /**
   * Нарезает текст на чанки.
   * @param {string} text — исходный текст
   * @returns {string[]} — массив текстовых блоков
   */
  chunk(text) {
    const { CHUNK_WORDS, OVERLAP_WORDS, MIN_CHUNK_WORDS } = CONFIG;

    // 1. Очищаем текст
    const cleaned = this._clean(text);

    // 2. Разбиваем на абзацы
    const paras = cleaned
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    // Fallback: якщо подвійних переносів немає (типово для PDF) — ріжемо по рядках
    if (paras.length <= 1) {
      const fallback = this._splitByLines(cleaned);
      if (fallback.length > 0) return fallback;
    }

    if (paras.length === 0) return [];

    // 3. Группируем абзацы в чанки
    const chunks = [];
    let current  = [];
    let wordCount = 0;

    for (const para of paras) {
      const paraWords = para.split(/\s+/).length;

      // Если добавление этого абзаца превысит лимит — сохраняем текущий чанк
      if (wordCount + paraWords > CHUNK_WORDS && current.length > 0) {
        chunks.push(current.join('\n\n'));

        // Перекрытие: берём последний абзац для контекста
        const lastPara     = current[current.length - 1];
        const lastParaWords = lastPara.split(/\s+/).length;

        if (lastParaWords <= OVERLAP_WORDS) {
          current   = [lastPara];
          wordCount = lastParaWords;
        } else {
          // Берём последние OVERLAP_WORDS слов
          const overlapText = lastPara.split(/\s+/).slice(-OVERLAP_WORDS).join(' ');
          current   = [overlapText];
          wordCount = OVERLAP_WORDS;
        }
      }

      current.push(para);
      wordCount += paraWords;
    }

    // Сохраняем остаток
    if (current.length > 0) {
      chunks.push(current.join('\n\n'));
    }

    // 4. Фильтруем слишком короткие
    return chunks.filter(c => c.split(/\s+/).length >= MIN_CHUNK_WORDS);
  },

  /**
   * Очищает текст от артефактов PDF и нормализует абзацы
   */
  _clean(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Склеюємо перенесені слова (рядок не закінчується реченням)
      .replace(/([а-яА-ЯёЁіІїЇєЄa-zA-Z,;])\n(?=[а-яа-яёЁіІїЇєЄa-z])/g, '$1 ')
      // Рядок закінчується крапкою + наступний починається з великої → абзац
      .replace(/([.!?»])\n(?=[А-ЯЁЇІЄ"«A-Z0-9])/g, '$1\n\n')
      .trim();
  },

  /**
   * Fallback: якщо немає подвійних переносів — ріжемо по одиночних
   */
  _splitByLines(text) {
    // Розбиваємо по одиночних переносах рядків
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 15);
    if (!lines.length) return [];

    const chunks = [];
    const { CHUNK_WORDS, MIN_CHUNK_WORDS } = CONFIG;
    let current = [];
    let wordCount = 0;

    for (const line of lines) {
      const lw = line.split(/\s+/).length;
      if (wordCount + lw > CHUNK_WORDS && current.length > 0) {
        chunks.push(current.join(' '));
        current = [];
        wordCount = 0;
      }
      current.push(line);
      wordCount += lw;
    }
    if (current.length) chunks.push(current.join(' '));

    return chunks.filter(c => c.split(/\s+/).length >= MIN_CHUNK_WORDS);
  },
};
