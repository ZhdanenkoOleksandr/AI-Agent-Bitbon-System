/* analyzer.js — анализирует чанки через Claude API */

const Analyzer = {
  /**
   * Анализирует один чанк через Claude.
   * @param {string} text
   * @returns {Promise<object>} analysis
   */
  async analyze(text) {
    const prompt = CONFIG.buildAnalysisPrompt(text, CONFIG.SEGMENTS);

    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        system:     CONFIG.SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw  = data.content[0].text.trim()
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '');

    const parsed = JSON.parse(raw);

    // Валидация сегмента
    if (!CONFIG.SEGMENTS.includes(parsed.segment)) {
      parsed.segment = 'general';
    }

    // Нормализация чисел
    parsed.quality_score       = Math.min(1, Math.max(0, Number(parsed.quality_score) || 0.5));
    parsed.segment_confidence  = Math.min(1, Math.max(0, Number(parsed.segment_confidence) || 0.5));
    parsed.is_likely_outdated  = Boolean(parsed.is_likely_outdated);
    parsed.key_concepts        = Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [];

    return parsed;
  },

  /**
   * Запасной вариант при ошибке API
   */
  fallback(text) {
    return {
      segment:            'general',
      segment_confidence: 0.5,
      summary:            text.slice(0, 120) + '...',
      key_concepts:       [],
      knowledge_type:     'fact',
      quality_score:      0.5,
      is_likely_outdated: false,
      language:           'ru',
      error:              true,
    };
  },
};
