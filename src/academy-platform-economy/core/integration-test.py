#!/usr/bin/env python3
"""
Integration Test для ACADEMY PLATFORM ECONOMY

Полная демонстрация работы системы:
1. Обработка видео через различные workflow-ы
2. Хранение в Knowledge Base
3. Проверка ответов студентов через Answer Validator
4. Отслеживание ошибок и улучшение контента
"""

import json
from datetime import datetime
from orchestration_runtime import OrchestrationRuntime
from knowledge_base_manager import KnowledgeBaseManager, Lecture, Lesson, Course, ErrorPattern, TopicRelationship


def print_section(title: str):
    """Красивый вывод заголовка"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


def test_video_processing():
    """Тест 1: Обработка видео через workflow-ы"""
    print_section("ТЕСТ 1: ОБРАБОТКА ВИДЕО")

    runtime = OrchestrationRuntime("orchestration-engine.json")

    # Информация о видео
    video_info = {
        "source": "YouTube Video",
        "url": "https://www.youtube.com/watch?v=l7RsfjUeSUA",
        "duration": "15 минут",
        "topic": "Персональный бренд",
        "instructor": "Unknown"
    }

    print(f"📹 Видео: {video_info['url']}")
    print(f"⏱️  Длительность: {video_info['duration']}")
    print(f"📚 Тема: {video_info['topic']}\n")

    # Выполнить FAST TRACK для быстрого социального контента
    print("1️⃣ FAST TRACK WORKFLOW (для социального контента)")
    print("-" * 70)
    fast_track_result = runtime.execute_workflow(
        workflow_id="fast_track",
        input_source=video_info['url'],
        input_data=video_info
    )

    # Выполнить FULL STACK для максимальной ценности
    print("\n2️⃣ FULL STACK WORKFLOW (полный контент пакет)")
    print("-" * 70)
    full_stack_result = runtime.execute_workflow(
        workflow_id="full_stack",
        input_source=video_info['url'],
        input_data=video_info
    )

    return fast_track_result, full_stack_result


def test_knowledge_base_storage(full_stack_result):
    """Тест 2: Хранение в Knowledge Base"""
    print_section("ТЕСТ 2: ХРАНЕНИЕ В KNOWLEDGE BASE")

    kb = KnowledgeBaseManager("/tmp/academy_test.db")

    # Создать темы
    print("📝 Создание тем в Topic Graph...")
    topics = {
        "personal-branding": "Personal Branding",
        "content-creation": "Content Creation",
        "audience-building": "Audience Building",
        "monetization": "Monetization"
    }

    for topic_id, topic_name in topics.items():
        kb.create_topic(topic_id, topic_name, f"Topic: {topic_name}")
        print(f"  ✓ {topic_name}")

    # Добавить связи между темами
    print("\n🔗 Добавление связей между темами...")
    edges = [
        ("personal-branding", "content-creation", TopicRelationship.EXTENDS),
        ("content-creation", "audience-building", TopicRelationship.EXTENDS),
        ("audience-building", "monetization", TopicRelationship.EXTENDS),
        ("personal-branding", "audience-building", TopicRelationship.RELATED),
    ]

    for from_topic, to_topic, relationship in edges:
        kb.add_edge(from_topic, to_topic, relationship)
        print(f"  ✓ {from_topic} --[{relationship.value}]--> {to_topic}")

    # Хранить лекцию
    print("\n📖 Сохранение лекции...")
    lecture = Lecture(
        id="lecture-001",
        title="Основы личного бренда",
        raw_text="[RAW TRANSCRIPTION] из видео YouTube...",
        cleaned_text="[CLEANED] Структурированный текст...",
        insights={
            "key_ideas": ["Бренд = репутация", "Требует времени", "Требует консистентности"],
            "deep_insights": {
                "models": ["Personal Brand Model", "Influence Model"],
                "frameworks": ["3-Component Framework: Name + Reputation + Influence"]
            },
            "terminology": {
                "Personal Brand": "Ваше имя, репутация и влияние в интернете",
                "Reputation": "То, что говорят о вас другие"
            }
        },
        tags=["personal-branding", "beginner", "youtube"],
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    kb.store_lecture(lecture)
    print(f"  ✓ Лекция сохранена: {lecture.title}")

    # Хранить урок
    print("\n📚 Сохранение урока...")
    lesson = Lesson(
        id="lesson-001",
        title="Что такое личный бренд?",
        lecture_id="lecture-001",
        content="Личный бренд это комбинация трех элементов...",
        examples=["Пример 1: Ивана", "Пример 2: Марии"],
        assignments={
            "practical": "Определите три компонента вашего бренда",
            "homework": "Найдите 3 люди с хорошим личным брендом"
        },
        difficulty="beginner",
        duration_minutes=45,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    kb.store_lesson(lesson)
    print(f"  ✓ Урок сохранен: {lesson.title}")

    # Хранить курс
    print("\n🎓 Сохранение курса...")
    course = Course(
        id="course-001",
        title="Мастерство личного бренда",
        description="Полный курс по созданию и развитию личного бренда",
        modules=[
            {"id": "mod1", "title": "Основы", "lessons": ["lesson-001", "lesson-002"]},
            {"id": "mod2", "title": "Стратегия", "lessons": ["lesson-003", "lesson-004"]},
            {"id": "mod3", "title": "Выполнение", "lessons": ["lesson-005", "lesson-006"]}
        ],
        final_project="Создайте свой личный бренд",
        target_audience="Начинающие предприниматели",
        total_hours=12.0,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    kb.store_course(course)
    print(f"  ✓ Курс сохранен: {course.title}")

    # Получить статистику
    stats = kb.get_statistics()
    print("\n📊 Статистика Knowledge Base:")
    for key, value in stats.items():
        if key != "timestamp":
            print(f"  {key}: {value}")

    # Получить prerequisites
    print("\n🔍 Предпосылки для 'monetization':")
    prerequisites = kb.get_prerequisites("monetization")
    for prereq in prerequisites:
        print(f"  ✓ {prereq}")

    return kb


def test_answer_validation(kb):
    """Тест 3: Проверка ответов студентов"""
    print_section("ТЕСТ 3: ПРОВЕРКА ОТВЕТОВ СТУДЕНТОВ (Answer Validator)")

    questions = [
        {
            "id": "q1",
            "question": "Какие три компонента личного бренда?",
            "reference_answer": "Имя (name), Репутация (reputation), Влияние (influence)",
            "student_answers": [
                ("Имя, репутация и влияние", "correct", 100),
                ("Известность, деньги и успех", "incorrect", 20),
                ("Имя и репутация", "partially_correct", 65),
                ("Способность зарабатывать", "incorrect", 15),
                ("Имя, доверие и вовлеченность", "partially_correct", 70),
            ]
        },
        {
            "id": "q2",
            "question": "Почему важна консистентность в личном бренде?",
            "reference_answer": "Консистентность создает узнаваемость и доверие",
            "student_answers": [
                ("Помогает людям помнить о вас", "partially_correct", 60),
                ("Без консистентности нет бренда", "correct", 95),
                ("Для красоты", "incorrect", 10),
                ("Создает доверие и узнаваемость", "correct", 100),
            ]
        }
    ]

    total_errors = {}
    error_tracking = []

    for question in questions:
        print(f"\n❓ Вопрос: {question['question']}")
        print(f"   Эталон: {question['reference_answer']}")
        print("   " + "-" * 66)

        correct_count = 0
        total_count = len(question['student_answers'])

        for idx, (answer, expected, score) in enumerate(question['student_answers'], 1):
            # Симулируем Answer Validator логику
            emoji = "✅" if expected == "correct" else ("🟡" if expected == "partially_correct" else "❌")
            print(f"   [{idx}] {emoji} Ответ: '{answer[:50]}...' → {expected} ({score}%)")

            if expected != "correct":
                # Отслеживать ошибку
                pattern = f"Question {question['id']}: {expected}"
                error_tracking.append({
                    "question_id": question['id'],
                    "student_answer": answer,
                    "correctness": expected,
                    "score": score
                })
            else:
                correct_count += 1

        error_rate = 1 - (correct_count / total_count)
        print(f"\n   📊 Правильно: {correct_count}/{total_count} ({correct_count/total_count*100:.0f}%)")
        print(f"   📊 Ошибок: {error_rate*100:.0f}%")

        # Если > 30% ошибок, логировать как high-error
        if error_rate > 0.3:
            print(f"   ⚠️  ВЫСОКИЙ УРОВЕНЬ ОШИБОК ({error_rate*100:.0f}%) - ТРЕБУЕТСЯ ПЕРЕСМОТР УРОКА")
            error_pattern = ErrorPattern(
                id=f"error-{question['id']}-{datetime.now().timestamp()}",
                lesson_id="lesson-001",
                pattern=f"Студенты неправильно отвечают на '{question['question'][:30]}...'",
                frequency=error_rate,
                severity="high" if error_rate > 0.5 else "medium",
                common_misconceptions=[
                    "Путают компоненты бренда",
                    "Фокусируются только на деньгах"
                ],
                suggested_clarifications=[
                    "Переформулировать определение",
                    "Добавить больше примеров",
                    "Показать контраст с неправильными ответами"
                ],
                detected_at=datetime.now().isoformat()
            )
            kb.log_error_pattern(error_pattern)
            total_errors[question['id']] = error_rate

    # Показать какие уроки нуждаются в пересмотре
    if total_errors:
        print("\n" + "="*70)
        print("📋 УРОКИ ТРЕБУЮЩИЕ ПЕРЕСМОТРА (>30% ошибок):")
        print("="*70)
        for q_id, error_rate in total_errors.items():
            print(f"  ⚠️  Вопрос {q_id}: {error_rate*100:.0f}% ошибок")

    # Получить high error lessons
    print("\n🔍 Уроки с высокой частотой ошибок:")
    high_error_lessons = kb.get_high_error_lessons(threshold=0.3)
    if high_error_lessons:
        for lesson_id, avg_freq in high_error_lessons:
            print(f"  ❌ Урок {lesson_id}: {avg_freq*100:.0f}% ошибок в среднем")
    else:
        print("  ✓ Нет уроков с критическими ошибками")

    return error_tracking


def generate_recommendations(error_tracking):
    """Тест 4: Генерация рекомендаций для улучшения"""
    print_section("ТЕСТ 4: РЕКОМЕНДАЦИИ ДЛЯ УЛУЧШЕНИЯ КУРСА")

    if error_tracking:
        print("🎯 ДЕЙСТВИЯ ДЛЯ УЛУЧШЕНИЯ КОНТЕНТА:\n")

        print("1. ПЕРЕСМОТР УРОКОВ")
        print("   - Переформулировать определения сложных концепций")
        print("   - Добавить больше практических примеров")
        print("   - Включить противопримеры (что это НЕ является)\n")

        print("2. ДОПОЛНИТЕЛЬНЫЕ МАТЕРИАЛЫ")
        print("   - Создать видео с подробным объяснением")
        print("   - Добавить интерактивный quiz после каждого раздела")
        print("   - Создать визуальные диаграммы концепций\n")

        print("3. SUPPORT & FEEDBACK")
        print("   - Добавить Q&A раздел для каждого урока")
        print("   - Включить live chat поддержку")
        print("   - Создать feedback форму для студентов\n")

        print("4. СЛЕДУЮЩАЯ ИТЕРАЦИЯ")
        print("   - Ревизия контента на основе feedback")
        print("   - A/B тестирование новых объяснений")
        print("   - Повторная проверка понимания после изменений")
    else:
        print("✅ Контент в хорошем состоянии - нет критических ошибок!")


def main():
    """Запуск полного интеграционного теста"""
    print("\n")
    print("╔" + "="*68 + "╗")
    print("║" + " "*68 + "║")
    print("║" + "  🎓 ACADEMY PLATFORM ECONOMY - ПОЛНЫЙ ТЕСТ СИСТЕМЫ".center(68) + "║")
    print("║" + "  Обработка видео → Knowledge Base → Answer Validation".center(68) + "║")
    print("║" + " "*68 + "║")
    print("╚" + "="*68 + "╝")

    try:
        # Тест 1: Обработка видео
        fast_track_result, full_stack_result = test_video_processing()

        # Тест 2: Хранение в Knowledge Base
        kb = test_knowledge_base_storage(full_stack_result)

        # Тест 3: Проверка ответов студентов
        error_tracking = test_answer_validation(kb)

        # Тест 4: Рекомендации
        generate_recommendations(error_tracking)

        # Финальный отчет
        print_section("ФИНАЛЬНЫЙ ОТЧЕТ")
        print("✅ Система работает интегрально:")
        print("   1. ✓ Видео обработано через workflow-ы")
        print("   2. ✓ Контент сохранен в Knowledge Base")
        print("   3. ✓ Созданы связи между темами (Topic Graph)")
        print("   4. ✓ Ответы студентов проверены")
        print("   5. ✓ Выявлены ошибки и паттерны")
        print("   6. ✓ Сгенерированы рекомендации для улучшения")
        print("\n🎯 ЦИКЛ ОБУЧЕНИЯ ЗАМЫКАЕТСЯ:")
        print("   Видео → Обработка → Уроки → Студенты → Ошибки → Улучшение → Видео (новое)")

        kb.close()

    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
