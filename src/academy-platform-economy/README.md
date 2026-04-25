# ACADEMY PLATFORM ECONOMY

Многоагентная образовательная платформа для профессиональной обработки лекционного контента.

## 🎯 Миссия

Автоматизировать полный цикл работы с образовательным контентом:
от сырого аудио/видео до готовых к публикации лекций на нескольких языках.

## 🚀 Возможности

- **Автоматическая транскрипция** аудио и видео в точный текст
- **Редактирование и улучшение** контента
- **Многоязычная поддержка** с переводом
- **Автоматическое резюмирование** лекций
- **Проверка качества** перед публикацией
- **Одноклик публикация** на платформе

## 📁 Структура проекта

```
src/academy-platform-economy/
├── agents/                    # Многоагентная система
│   ├── transcriber/          # ✓ Агент транскрипции (готов)
│   ├── agent-template/       # Шаблон для новых агентов
│   ├── agents-registry.json  # Реестр агентов
│   └── AGENTS_GUIDE.md       # Руководство по агентам
├── content/                  # Контент платформы
│   ├── lectures/            # Готовые лекции
│   ├── videos/              # Исходные видео
│   ├── audio/               # Исходные аудио
│   └── drafts/              # Черновики
├── workflows/               # Рабочие процессы
├── config/                  # Конфигурация
├── PROJECT.md               # Подробное описание проекта
├── AGENTS_GUIDE.md          # Руководство по агентам
└── README.md               # Этот файл
```

## ✨ Активные агенты

### 1. Transcriber Agent ✓
Преобразует аудио и видео в точный текст лекции.

- **Входы**: mp3, wav, m4a, ogg, mp4, webm, mov, avi
- **Выходы**: Структурированный текст, метаданные
- **Точность**: 95%+
- **Статус**: Готов к использованию

[Подробнее →](agents/transcriber/README.md)

## 🔄 Планируемые агенты

- **Editor Agent** — Редактирование и улучшение контента
- **Translator Agent** — Перевод на другие языки
- **Summarizer Agent** — Создание резюме и конспектов
- **QA Agent** — Проверка качества
- **Publisher Agent** — Публикация на платформе

## ⚡ Быстрый старт

### Запуск Transcriber Agent

```bash
# 1. Перейти в проект
cd src/academy-platform-economy

# 2. Инициализировать агента
npx @claude-flow/cli@latest agent spawn \
  -t transcriber \
  --name transcriber-academy \
  --config agents/transcriber/config/agent-config.json

# 3. Создать задачу транскрипции
npx @claude-flow/cli@latest task create \
  --type transcription \
  --description "Транскрибировать лекцию" \
  --assign-to transcriber-academy
```

### Инициализировать всю систему

```bash
# Инициализировать многоагентный сварм
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --max-agents 15 \
  --strategy specialized
```

## 📚 Документация

### Основные документы

1. **[PROJECT.md](PROJECT.md)** — Полное описание архитектуры и конфигурации
2. **[AGENTS_GUIDE.md](AGENTS_GUIDE.md)** — Подробное руководство по агентам
3. **[agents/transcriber/README.md](agents/transcriber/README.md)** — Документация Transcriber Agent

### Справочная информация

- **Реестр агентов**: [agents/agents-registry.json](agents/agents-registry.json)
- **Шаблон для новых агентов**: [agents/agent-template/](agents/agent-template/)
- **Конфигурация Transcriber**: [agents/transcriber/config/](agents/transcriber/config/)

## 🔧 Создание нового агента

1. Прочитайте [AGENTS_GUIDE.md](AGENTS_GUIDE.md)
2. Используйте шаблон из [agents/agent-template/](agents/agent-template/)
3. Адаптируйте конфигурацию под свои нужды
4. Зарегистрируйте в [agents/agents-registry.json](agents/agents-registry.json)
5. Протестируйте интеграцию

## 🏗️ Архитектура

### Топология системы

- **Тип**: Hierarchical-Mesh (иерархическая сетка)
- **Макс.агентов**: 15
- **Стратегия**: Specialized (специализированные роли)
- **Консенсус**: Raft (лидер-основанный)

### Поток обработки контента

```
RAW CONTENT
    ↓
[Transcriber] — Преобразование аудио/видео в текст
    ↓
[Editor] — Улучшение и форматирование (планируется)
    ↓
[Translator] — Перевод контента (планируется)
    ↓
[Summarizer] — Создание резюме (планируется)
    ↓
[QA] — Проверка качества (планируется)
    ↓
[Publisher] — Публикация (планируется)
    ↓
PUBLISHED CONTENT
```

## 📊 Технические характеристики

| Параметр | Значение |
|----------|----------|
| **Язык** | JavaScript/Node.js |
| **Основной CLI** | @claude-flow/cli |
| **Модель (production)** | claude-opus-4-6 |
| **Модель (draft)** | claude-sonnet-4-6 |
| **Модель (quick)** | claude-haiku-4-5 |
| **Память** | Hybrid (локальная + облачная) |
| **Поиск** | Семантический (HNSW) |

## 🎓 Примеры использования

### Транскрибировать лекцию

```bash
npx @claude-flow/cli@latest task create \
  --type transcription \
  --description "Транскрибировать: Introduction to Blockchain" \
  --assign-to transcriber-academy
```

### Проверить статус агента

```bash
npx @claude-flow/cli@latest agent status -a transcriber-academy
```

### Просмотреть все активные задачи

```bash
npx @claude-flow/cli@latest task list --status active
```

### Диагностика системы

```bash
npx @claude-flow/cli@latest doctor --fix
```

## 🛠️ Конфигурация

### Требования

- Node.js 18+
- @claude-flow/cli (установлен как зависимость)
- Claude API ключ

### Установка зависимостей

```bash
npm install

# или если используется yarn
yarn install
```

### Переменные окружения

```bash
# .env файл (в корне проекта)
CLAUDE_API_KEY=sk-...
ACADEMY_ENV=production
```

## 🐛 Диагностика и поддержка

### Проверить здоровье системы

```bash
npx @claude-flow/cli@latest doctor --fix
```

### Просмотреть логи агента

```bash
npx @claude-flow/cli@latest task list --assigned-to [agent-id]
```

### Сброс состояния (только для разработки!)

```bash
npx @claude-flow/cli@latest system reset --confirm
```

## 📈 Производительность

### Ожидаемые метрики (на часовой лекции)

| Операция | Время | Качество |
|----------|-------|----------|
| Транскрипция | 3-5 мин | 95%+ |
| Редактирование | 2-3 мин | 95%+ |
| Перевод | 4-6 мин | 90%+ |
| Резюме | 1-2 мин | 90%+ |
| QA проверка | 1-2 мин | 98%+ |

## 🔐 Безопасность

- ✓ Валидация всех входных данных
- ✓ Санитизация путей файлов
- ✓ Защита от injection атак
- ✓ Шифрование чувствительных данных
- ✓ Логирование всех операций

## 📝 Best Practices

### ✓ Что делать

- Документируйте все изменения
- Тестируйте интеграцию между агентами
- Используйте температуру 0 для точности
- Следуйте стандартам качества
- Регистрируйте новых агентов

### ✗ Что не делать

- Не смешивайте ответственности
- Не игнорируйте валидацию данных
- Не меняйте температуру без причины
- Не забывайте про документацию

## 🚀 Дорожная карта

### v1.0 (текущая)
- ✓ Transcriber Agent
- ✓ Архитектура многоагентной системы
- ✓ Система конфигурации

### v1.1 (планируется)
- Editor Agent
- Улучшенная работа с метаданными
- Интеграция с платформой

### v2.0 (будущее)
- Все агенты (Translator, Summarizer, QA, Publisher)
- Веб-интерфейс
- API для интеграции

## 📞 Поддержка

- **Документация**: [AGENTS_GUIDE.md](AGENTS_GUIDE.md)
- **Проект**: [PROJECT.md](PROJECT.md)
- **Transcriber**: [agents/transcriber/README.md](agents/transcriber/README.md)
- **Помощь**: `npx @claude-flow/cli@latest doctor --help`

## 📄 Лицензия

Внутренний проект компании.

## 👥 Авторство

**Проект**: ACADEMY PLATFORM ECONOMY  
**Версия**: 1.0  
**Дата создания**: 2026-04-15  
**Статус**: Активная разработка

---

**Начните с**: [AGENTS_GUIDE.md](AGENTS_GUIDE.md) для полного понимания системы  
**Для быстрого старта**: Смотрите раздел [⚡ Быстрый старт](#-быстрый-старт)
