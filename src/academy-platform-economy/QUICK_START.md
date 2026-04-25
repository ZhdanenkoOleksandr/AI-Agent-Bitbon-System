# 🚀 Quick Start Guide - ACADEMY PLATFORM ECONOMY

## 5 минут до запуска системы

### Шаг 1: Подготовка окружения

```bash
cd src/academy-platform-economy/core

# Система готова к использованию (Python 3.6+)
python3 integration-test.py
```

### Шаг 2: Обработка вашего видео

```python
from orchestration_runtime import OrchestrationRuntime

runtime = OrchestrationRuntime("orchestration-engine.json")

# Выполнить FAST TRACK для социального контента (15 мин)
result_fast = runtime.execute_workflow(
    workflow_id="fast_track",
    input_source="https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
    input_data={
        "source": "YouTube Video",
        "duration": "15 минут",
        "topic": "Ваша тема"
    }
)

# ИЛИ выполнить FULL STACK для максимальной ценности (45 мин)
result_full = runtime.execute_workflow(
    workflow_id="full_stack",
    input_source="https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
    input_data={
        "source": "YouTube Video",
        "duration": "15 минут",
        "topic": "Ваша тема"
    }
)

print(f"✅ Workflow завершен за {result_full.total_duration_seconds:.2f} сек")
print(f"📊 Knowledge Base обновлений: {len(result_full.knowledge_base_updates)}")
```

### Шаг 3: Проверка ответов студентов

```python
from knowledge_base_manager import KnowledgeBaseManager

kb = KnowledgeBaseManager("knowledge_base.db")

# Студент ответил на вопрос
student_answer = {
    "question": "Какие три компонента личного бренда?",
    "reference_answer": "Имя, Репутация, Влияние",
    "student_answer": "Известность, деньги и успех",
    "question_type": "short_answer",
    "lesson_id": "lesson-001",
    "student_id": "student-123"
}

# Answer Validator проверяет (в реальной системе)
# Результат: Incorrect (20%) - триггерит Knowledge Base update

# Получить уроки с высокими ошибками (>30%)
high_error_lessons = kb.get_high_error_lessons(threshold=0.3)
for lesson_id, error_rate in high_error_lessons:
    print(f"⚠️  Урок {lesson_id}: {error_rate*100:.0f}% ошибок - требуется пересмотр")

kb.close()
```

---

## Workflow выбор

| Ваша задача | Выбрать |
|---|---|
| 🏃 **Быстро создать социальный контент** | `fast_track` |
| 📚 **Создать полный обучающий курс** | `deep_learning` |
| ⭐ **Максимум ценности одновременно** | `full_stack` |
| 🔄 **Обновить существующий курс** | `retrain_mode` |
| ✅ **Проверить ответы студентов** | `assessment_mode` |

---

## Примеры результатов

### Fast Track Output (1.6 сек)
```json
{
  "workflow": "Fast Track",
  "social_content": {
    "tiktok_ideas": ["30-сек о главной идее", "Быстрый совет"],
    "instagram_posts": ["Пост о репутации", "Пост о консистентности"],
    "linkedin": "Статья для профессионалов"
  }
}
```

### Full Stack Output (3.78 сек)
```json
{
  "workflow": "Full Stack",
  "course": {
    "title": "Мастерство личного бренда",
    "modules": 3,
    "lessons": 12,
    "duration_hours": 8
  },
  "social_content": {...},
  "personal_action_plan": {...},
  "quality_score": 0.92
}
```

### Answer Validation Output
```json
{
  "correctness": "incorrect",
  "score": 20,
  "feedback": "Хороший старт! Но деньги это результат, а не компонент бренда",
  "knowledge_base_update": {
    "lesson_needs_revision": true,
    "reason": "45% учеников путают известность с брендом"
  }
}
```

---

## Архитектура файлов

```
academy-platform-economy/
├── core/
│   ├── orchestration-engine.json       # Конфигурация всех 5 workflow-ов
│   ├── orchestration_runtime.py        # Рантайм для выполнения workflow-ов
│   ├── knowledge_base_manager.py       # SQLite DB с семантическими связями
│   └── integration-test.py             # Полный тест системы
│
├── agents/
│   ├── answer-validator/
│   │   ├── README.md                   # Документация агента
│   │   └── config/
│   │       ├── agent-config.json       # Конфигурация
│   │       └── system-prompt.txt       # System prompt
│   │
│   ├── structured-summary/
│   ├── personalization/
│   ├── lesson-builder/
│   ├── course-architect/
│   └── content-repurposer/
│
├── SYSTEM_OVERVIEW.md                  # Полная архитектура (этот файл)
└── QUICK_START.md                      # Быстрый старт (ты здесь)
```

---

## Ключевые метрики

| Метрика | Значение |
|---|---|
| Fast Track время | 15 мин |
| Deep Learning время | 40 мин |
| Full Stack время | 45 мин |
| Quality threshold | 85% |
| Error detection | >30% |
| Agents | 8 |
| Workflows | 5 |
| Database tables | 8 |
| Topic relationships | 4 типа |

---

## Где найти что?

### 📖 Документация
- **Полная архитектура:** `SYSTEM_OVERVIEW.md`
- **Answer Validator:** `agents/answer-validator/README.md`
- **Другие агенты:** `agents/*/README.md`

### 🔧 Конфигурация
- **Workflow-ы:** `core/orchestration-engine.json`
- **Answer Validator:** `agents/answer-validator/config/`

### 💻 Код
- **Оркестрация:** `core/orchestration_runtime.py`
- **Knowledge Base:** `core/knowledge_base_manager.py`
- **Интеграционный тест:** `core/integration-test.py`

---

## Примеры использования

### Пример 1: Обработка видео (Fast Track)

```python
runtime = OrchestrationRuntime("orchestration-engine.json")

result = runtime.execute_workflow(
    workflow_id="fast_track",
    input_source="https://www.youtube.com/watch?v=l7RsfjUeSUA",
    input_data={"source": "YouTube", "duration": "15 мин", "topic": "Personal Branding"}
)

# Результат: TikTok идеи, Instagram посты, LinkedIn статья за 1.6 сек ✅
print(f"✅ {result.workflow_name} завершен")
print(f"📱 Social posts готовы к публикации")
```

### Пример 2: Создание полного курса (Full Stack)

```python
result = runtime.execute_workflow(
    workflow_id="full_stack",
    input_source="https://www.youtube.com/watch?v=l7RsfjUeSUA",
    input_data={"source": "YouTube", "duration": "15 мин", "topic": "Personal Branding"}
)

# Результат: Курс + Уроки + Задания + Социальный контент + Персональный путь
print(f"✅ Курс создан: {len(result.knowledge_base_updates)} компонентов в Knowledge Base")
```

### Пример 3: Проверка студентов (Answer Validation)

```python
kb = KnowledgeBaseManager("knowledge_base.db")

# Логировать ответ студента
kb.log_student_answer(
    student_id="student-123",
    question_id="q1",
    lesson_id="lesson-001",
    answer="Известность, деньги и успех",
    correctness="incorrect",
    score=20.0
)

# Если >30% студентов ошибаются - урок нужен пересмотр
high_error = kb.get_high_error_lessons(threshold=0.3)
if high_error:
    print("⚠️  Требуется пересмотр уроков:")
    for lesson_id, error_rate in high_error:
        print(f"   - {lesson_id}: {error_rate*100:.0f}% ошибок")
```

---

## Поддержка и контакты

### Документация
- 📖 Полная архитектура: `SYSTEM_OVERVIEW.md`
- 🎯 Обзор Answer Validator: `agents/answer-validator/README.md`
- 📋 Все агенты: `agents/*/README.md`

### Конфигурация
- 🔧 Workflow конфиг: `core/orchestration-engine.json`
- ⚙️ Agent конфиг: `agents/answer-validator/config/`

### Код
- 🐍 Python рантайм: `core/orchestration_runtime.py`
- 💾 Knowledge Base: `core/knowledge_base_manager.py`
- 🧪 Тесты: `core/integration-test.py`

---

## Быстрые команды

```bash
# Запустить полный тест системы
cd src/academy-platform-economy/core
python3 integration-test.py

# Или обработать конкретное видео (в коде)
python3 -c "
from orchestration_runtime import OrchestrationRuntime
runtime = OrchestrationRuntime('orchestration-engine.json')
result = runtime.execute_workflow('full_stack', 'https://youtube.com/...', {...})
"
```

---

## Следующие шаги

1. ✅ **Сейчас:** Система работает с симуляциями
2. 🔜 **Интеграция:** Подключить реальные AI сервисы (OpenAI, etc)
3. 🔜 **Web:** Создать REST API и dashboard
4. 🔜 **Масштабирование:** Production deployment

---

**🎓 Ready to transform educational content?**

```python
# Запустить и обработать видео за 3 сек!
runtime.execute_workflow("full_stack", "your-video-url", {...})
```

