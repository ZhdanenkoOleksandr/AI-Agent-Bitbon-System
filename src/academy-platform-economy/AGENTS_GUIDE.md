# Руководство по агентам ACADEMY PLATFORM ECONOMY

## Обзор структуры

Проект использует многоагентную архитектуру для управления контентом образовательной платформы.

```
src/academy-platform-economy/
├── agents/
│   ├── transcriber/                    # ✓ Активный агент
│   │   ├── config/
│   │   │   ├── agent-config.json
│   │   │   └── system-prompt.txt
│   │   └── README.md
│   ├── [новые агенты]/
│   │   ├── config/
│   │   │   ├── agent-config.json
│   │   │   └── system-prompt.txt
│   │   └── README.md
│   ├── agents-registry.json            # Реестр всех агентов
│   └── agent-template/                 # Шаблон для новых агентов
├── content/
│   ├── lectures/
│   ├── videos/
│   └── audio/
├── workflows/
├── config/
└── AGENTS_GUIDE.md
```

## Активные агенты

### 1. **Transcriber Agent** ✓
- **Назначение**: Преобразование аудио/видео в текст
- **Статус**: Готов к использованию
- **Конфиг**: `agents/transcriber/config/agent-config.json`
- **Документация**: `agents/transcriber/README.md`

## Как создать новый агент

### Шаг 1: Создать структуру папок

```bash
mkdir -p src/academy-platform-economy/agents/[agent-name]/config
```

### Шаг 2: Создать конфигурацию

Скопируй и адаптируй `agents/transcriber/config/agent-config.json`:

```json
{
  "agentId": "[unique-id]",
  "type": "[agent-type]",
  "name": "[Agent Name]",
  "description": "[Описание задач]",
  "role": "specialist",
  "capabilities": ["capability1", "capability2"],
  "model": "claude-opus-4-6",
  "maxTokens": 16000,
  "temperature": 0,
  "systemInstructions": {
    "primary": "[Основная инструкция]",
    "requirements": ["требование1", "требование2"]
  }
}
```

### Шаг 3: Создать системный промпт

Создай `agents/[agent-name]/config/system-prompt.txt`:

```txt
Ты — [Agent Name] для ACADEMY PLATFORM ECONOMY.

ОСНОВНАЯ ЗАДАЧА:
[Описание основной задачи]

=== ТРЕБОВАНИЯ ===
[Ключевые требования]

=== ФОРМАТ ВЫВОДА ===
[Ожидаемый формат результата]
```

### Шаг 4: Создать документацию

Создай `agents/[agent-name]/README.md`:
- Назначение агента
- Ключевые правила
- Примеры использования
- Интеграция с платформой

### Шаг 5: Зарегистрировать агента

Добавь запись в `agents/agents-registry.json`:

```json
{
  "id": "[agent-id]",
  "name": "[Agent Name]",
  "type": "[type]",
  "status": "active",
  "description": "[Описание]",
  "configPath": "agents/[agent-name]/config/agent-config.json",
  "readmePath": "agents/[agent-name]/README.md",
  "capabilities": ["cap1", "cap2"]
}
```

## Планируемые агенты

### Editor Agent (в разработке)
- Редактирование и улучшение контента
- Проверка грамматики и стиля
- Форматирование текста

### Translator Agent (в разработке)
- Перевод лекций
- Сохранение смысла
- Локализация контента

### Summarizer Agent (в разработке)
- Создание резюме
- Выделение ключевых точек
- Генерация конспектов

### QA Agent (в разработке)
- Проверка качества
- Обнаружение ошибок
- Валидация структуры

### Publisher Agent (в разработке)
- Публикация контента
- Управление версиями
- Распределение по платформе

## Конфигурация проекта

### Топология
- **Тип**: hierarchical-mesh (для координации и устойчивости)
- **Макс агентов**: 15
- **Стратегия**: specialized (четкие роли)
- **Консенсус**: raft (лидер-основанный)

### Память
- **Тип**: hybrid (локальная + облачная)
- **Поиск**: enabled (семантический поиск)
- **Пространство имен**: `academy-platform-economy`

### Стандарты
- ✓ Обязательная валидация входных данных
- ✓ Стандартизированный формат выхода
- ✓ Корректная обработка ошибок
- ✓ Подробное логирование

## Использование агентов

### Инициализировать агента

```bash
npx @claude-flow/cli@latest agent spawn \
  -t [agent-type] \
  --name [agent-id] \
  --config agents/[agent-name]/config/agent-config.json
```

### Создать задачу для агента

```bash
npx @claude-flow/cli@latest task create \
  --type [task-type] \
  --description "[Описание задачи]" \
  --assign-to [agent-id]
```

### Инициализировать свармом (для параллельного выполнения)

```bash
npx @claude-flow/cli@latest swarm init \
  --topology hierarchical-mesh \
  --max-agents 15 \
  --strategy specialized
```

## Best Practices

### ✓ ЧТО ДЕЛАТЬ
- Каждый агент отвечает за одну ответственность
- Использовать конфиги для параметризации
- Документировать примеры использования
- Регистрировать агентов в реестре
- Тестировать интеграцию

### ✗ ЧТО НЕ ДЕЛАТЬ
- Не смешивать ответственности в одном агенте
- Не хардкодить параметры в систем-промпт
- Не забывать про документацию
- Не игнорировать валидацию входных данных

## Интеграция рабочих процессов

Агенты работают в следующей цепочке:

```
1. Transcriber Agent
   ↓
   Преобразует аудио/видео → текст
   ↓
2. Editor Agent (когда будет готов)
   ↓
   Улучшает структуру и стиль
   ↓
3. Translator Agent (опционально)
   ↓
   Переводит на другие языки
   ↓
4. Summarizer Agent (опционально)
   ↓
   Создает резюме
   ↓
5. QA Agent
   ↓
   Проверяет качество
   ↓
6. Publisher Agent
   ↓
   Публикует на платформе
```

## Поддержка и отладка

### Проверить статус агента

```bash
npx @claude-flow/cli@latest agent status -a [agent-id]
```

### Просмотреть логи

```bash
npx @claude-flow/cli@latest task list --assigned-to [agent-id]
```

### Диагностика

```bash
npx @claude-flow/cli@latest doctor --fix
```

---

**Проект:** ACADEMY PLATFORM ECONOMY  
**Версия:** 1.0  
**Последнее обновление:** 2026-04-15
