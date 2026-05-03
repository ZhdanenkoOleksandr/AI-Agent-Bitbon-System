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
   * Очищает текст от артефактов
   */
  _clean(text) {
    return text
      .replace(/\r\n/g, '\n')              // Windows line endings
      .replace(/\r/g, '\n')                // old Mac
      .replace(/\n{4,}/g, '\n\n\n')        // слишком много пустых строк
      .replace(/[ \t]{2,}/g, ' ')          // лишние пробелы
      .replace(/([а-яА-ЯёЁa-zA-Z,])\n(?=[а-яА-ЯёЁa-zA-Z])/g, '$1 ') // склеиваем перенесённые слова
      .trim();
  },
};
