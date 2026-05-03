/* config.js — все настройки платформы */

const CONFIG = {
  // ── Claude API ────────────────────────────────────────────────────
  MODEL:       'claude-sonnet-4-20250514',
  MAX_TOKENS:  600,
  API_URL:     'https://api.anthropic.com/v1/messages',

  // ── Chunking ──────────────────────────────────────────────────────
  CHUNK_WORDS:   180,   // слов в одном чанке
  OVERLAP_WORDS:  30,   // слов перекрытия между чанками
  MIN_CHUNK_WORDS: 20,  // минимум слов чтобы чанк попал в очередь

  // ── Сегменты базы знаний — добавляй свои ─────────────────────────
  SEGMENTS: [
    'web4_technology',
    'bitbon_ecosystem',
    'tokenization',
    'metaresources',
    'business_models',
    'personal_philosophy',
    'case_studies',
    'education',
    'general',
  ],

  // ── Цвета сегментов ───────────────────────────────────────────────
  SEG_COLORS: {
    web4_technology:    '#58a6ff',
    bitbon_ecosystem:   '#f0a73a',
    tokenization:       '#3fb950',
    metaresources:      '#bc8cff',
    business_models:    '#39d0cc',
    personal_philosophy:'#ff7b72',
    case_studies:       '#ffd166',
    education:          '#79c0ff',
    general:            '#8b949e',
  },

  // ── Промпты для Claude ────────────────────────────────────────────
  SYSTEM_PROMPT: `Ты аналитик базы знаний. Анализируешь фрагменты текста.
Отвечай ТОЛЬКО валидным JSON без markdown-блоков, без пояснений.`,

  buildAnalysisPrompt(text, segments) {
    return `Проанализируй фрагмент знания и верни ТОЛЬКО валидный JSON.

Доступные сегменты: ${segments.join(', ')}

Фрагмент:
${text.slice(0, 1400)}

Верни JSON строго в этом формате:
{
  "segment": "один из сегментов выше",
  "segment_confidence": 0.0,
  "summary": "резюме в 1-2 предложениях",
  "key_concepts": ["концепт1", "концепт2", "концепт3"],
  "knowledge_type": "definition|fact|theory|opinion|instruction|case_study",
  "quality_score": 0.0,
  "is_likely_outdated": false,
  "language": "ru|uk|en"
}`;
  },
};
