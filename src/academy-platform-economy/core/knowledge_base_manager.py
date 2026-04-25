#!/usr/bin/env python3
"""
Knowledge Base Manager для ACADEMY PLATFORM ECONOMY

Управляет накоплением, индексированием и поиском всех знаний в системе.
Интегрируется с агентами и хранит:
- Лекции и их анализ
- Уроки и курсы
- Topic Graph (связи между темами)
- Семантические embeddings для поиска
- Ошибки студентов для улучшения контента
"""

import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class TopicRelationship(Enum):
    """Типы связей между темами"""
    PREREQUISITE = "prerequisite"  # требуется знать перед
    RELATED = "related"  # связано с
    EXTENDS = "extends"  # расширяет
    DEEPENS = "deepens"  # углубляет


@dataclass
class Lecture:
    """Лекция в базе знаний"""
    id: str
    title: str
    raw_text: str
    cleaned_text: str
    insights: Dict  # {key_ideas, deep_insights, models, terminology}
    tags: List[str]
    created_at: str
    updated_at: str
    version: int = 1


@dataclass
class Lesson:
    """Урок"""
    id: str
    title: str
    lecture_id: str
    content: str
    examples: List[str]
    assignments: Dict  # {practical, homework}
    difficulty: str  # beginner, intermediate, advanced
    duration_minutes: int
    created_at: str
    updated_at: str


@dataclass
class Course:
    """Курс"""
    id: str
    title: str
    description: str
    modules: List[Dict]  # [{id, title, lessons}]
    final_project: str
    target_audience: str
    total_hours: float
    created_at: str
    updated_at: str


@dataclass
class ErrorPattern:
    """Паттерн ошибок студентов"""
    id: str
    lesson_id: str
    pattern: str
    frequency: float  # процент студентов с этой ошибкой
    severity: str  # low, medium, high
    common_misconceptions: List[str]
    suggested_clarifications: List[str]
    detected_at: str


class KnowledgeBaseManager:
    """Менеджер базы знаний"""

    def __init__(self, db_path: str = "knowledge_base.db"):
        """Инициализация с SQLite БД"""
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self._init_database()

    def _init_database(self):
        """Создание таблиц если их нет"""
        self.cursor.executescript("""
            CREATE TABLE IF NOT EXISTS lectures (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                raw_text TEXT,
                cleaned_text TEXT,
                insights TEXT,  -- JSON
                tags TEXT,  -- JSON
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                lecture_id TEXT,
                content TEXT,
                examples TEXT,  -- JSON
                assignments TEXT,  -- JSON
                difficulty TEXT,
                duration_minutes INTEGER,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY(lecture_id) REFERENCES lectures(id)
            );

            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                modules TEXT,  -- JSON
                final_project TEXT,
                target_audience TEXT,
                total_hours REAL,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS topic_graph (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                lectures TEXT,  -- JSON array of lecture ids
                lessons TEXT,  -- JSON array of lesson ids
                courses TEXT,  -- JSON array of course ids
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS topic_edges (
                id TEXT PRIMARY KEY,
                from_topic_id TEXT,
                to_topic_id TEXT,
                relationship TEXT,
                weight REAL DEFAULT 1.0,
                FOREIGN KEY(from_topic_id) REFERENCES topic_graph(id),
                FOREIGN KEY(to_topic_id) REFERENCES topic_graph(id)
            );

            CREATE TABLE IF NOT EXISTS error_patterns (
                id TEXT PRIMARY KEY,
                lesson_id TEXT,
                pattern TEXT,
                frequency REAL,
                severity TEXT,
                common_misconceptions TEXT,  -- JSON
                suggested_clarifications TEXT,  -- JSON
                detected_at TEXT,
                FOREIGN KEY(lesson_id) REFERENCES lessons(id)
            );

            CREATE TABLE IF NOT EXISTS semantic_embeddings (
                id TEXT PRIMARY KEY,
                content_id TEXT,  -- lecture/lesson/course id
                content_type TEXT,  -- lecture, lesson, course
                embedding TEXT,  -- JSON array of floats
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS student_answers (
                id TEXT PRIMARY KEY,
                student_id TEXT,
                question_id TEXT,
                lesson_id TEXT,
                answer TEXT,
                correctness TEXT,  -- correct, partially_correct, incorrect
                score REAL,
                error_pattern_id TEXT,
                created_at TEXT,
                FOREIGN KEY(lesson_id) REFERENCES lessons(id),
                FOREIGN KEY(error_pattern_id) REFERENCES error_patterns(id)
            );

            CREATE INDEX IF NOT EXISTS idx_lecture_tags ON lectures(tags);
            CREATE INDEX IF NOT EXISTS idx_lesson_difficulty ON lessons(difficulty);
            CREATE INDEX IF NOT EXISTS idx_error_lesson ON error_patterns(lesson_id);
            CREATE INDEX IF NOT EXISTS idx_student_answers ON student_answers(lesson_id);
        """)
        self.conn.commit()

    # ===== LECTURES =====

    def store_lecture(self, lecture: Lecture) -> bool:
        """Сохранить лекцию"""
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO lectures
                (id, title, raw_text, cleaned_text, insights, tags, created_at, updated_at, version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                lecture.id,
                lecture.title,
                lecture.raw_text,
                lecture.cleaned_text,
                json.dumps(lecture.insights),
                json.dumps(lecture.tags),
                lecture.created_at,
                lecture.updated_at,
                lecture.version
            ))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при сохранении лекции: {e}")
            return False

    def get_lecture(self, lecture_id: str) -> Optional[Lecture]:
        """Получить лекцию"""
        self.cursor.execute("SELECT * FROM lectures WHERE id = ?", (lecture_id,))
        row = self.cursor.fetchone()
        if row:
            return Lecture(
                id=row[0], title=row[1], raw_text=row[2],
                cleaned_text=row[3], insights=json.loads(row[4]),
                tags=json.loads(row[5]), created_at=row[6],
                updated_at=row[7], version=row[8]
            )
        return None

    def get_lectures_by_tag(self, tag: str) -> List[Lecture]:
        """Получить лекции по тегу"""
        self.cursor.execute("SELECT * FROM lectures WHERE json_extract(tags, '$[*]') = ?", (tag,))
        lectures = []
        for row in self.cursor.fetchall():
            lectures.append(Lecture(
                id=row[0], title=row[1], raw_text=row[2],
                cleaned_text=row[3], insights=json.loads(row[4]),
                tags=json.loads(row[5]), created_at=row[6],
                updated_at=row[7], version=row[8]
            ))
        return lectures

    # ===== LESSONS =====

    def store_lesson(self, lesson: Lesson) -> bool:
        """Сохранить урок"""
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO lessons
                (id, title, lecture_id, content, examples, assignments, difficulty, duration_minutes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                lesson.id, lesson.title, lesson.lecture_id, lesson.content,
                json.dumps(lesson.examples), json.dumps(lesson.assignments),
                lesson.difficulty, lesson.duration_minutes, lesson.created_at, lesson.updated_at
            ))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при сохранении урока: {e}")
            return False

    def get_lesson(self, lesson_id: str) -> Optional[Lesson]:
        """Получить урок"""
        self.cursor.execute("SELECT * FROM lessons WHERE id = ?", (lesson_id,))
        row = self.cursor.fetchone()
        if row:
            return Lesson(
                id=row[0], title=row[1], lecture_id=row[2], content=row[3],
                examples=json.loads(row[4]), assignments=json.loads(row[5]),
                difficulty=row[6], duration_minutes=row[7], created_at=row[8], updated_at=row[9]
            )
        return None

    # ===== COURSES =====

    def store_course(self, course: Course) -> bool:
        """Сохранить курс"""
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO courses
                (id, title, description, modules, final_project, target_audience, total_hours, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                course.id, course.title, course.description,
                json.dumps(course.modules), course.final_project,
                course.target_audience, course.total_hours, course.created_at, course.updated_at
            ))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при сохранении курса: {e}")
            return False

    def get_course(self, course_id: str) -> Optional[Course]:
        """Получить курс"""
        self.cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        row = self.cursor.fetchone()
        if row:
            return Course(
                id=row[0], title=row[1], description=row[2],
                modules=json.loads(row[3]), final_project=row[4],
                target_audience=row[5], total_hours=row[6],
                created_at=row[7], updated_at=row[8]
            )
        return None

    # ===== TOPIC GRAPH =====

    def create_topic(self, topic_id: str, name: str, description: str = "") -> bool:
        """Создать тему в графе"""
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO topic_graph
                (id, name, description, lectures, lessons, courses, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (topic_id, name, description, json.dumps([]), json.dumps([]), json.dumps([]), datetime.now().isoformat()))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при создании темы: {e}")
            return False

    def add_edge(self, from_topic: str, to_topic: str, relationship: TopicRelationship, weight: float = 1.0) -> bool:
        """Добавить связь между темами"""
        try:
            edge_id = f"{from_topic}_{to_topic}_{relationship.value}"
            self.cursor.execute("""
                INSERT OR REPLACE INTO topic_edges
                (id, from_topic_id, to_topic_id, relationship, weight)
                VALUES (?, ?, ?, ?, ?)
            """, (edge_id, from_topic, to_topic, relationship.value, weight))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при добавлении связи: {e}")
            return False

    def get_prerequisites(self, topic_id: str) -> List[str]:
        """Получить предпосылки для темы"""
        self.cursor.execute("""
            SELECT from_topic_id FROM topic_edges
            WHERE to_topic_id = ? AND relationship = ?
        """, (topic_id, TopicRelationship.PREREQUISITE.value))
        return [row[0] for row in self.cursor.fetchall()]

    def get_related_topics(self, topic_id: str) -> List[str]:
        """Получить связанные темы"""
        self.cursor.execute("""
            SELECT to_topic_id FROM topic_edges
            WHERE from_topic_id = ? AND relationship = ?
        """, (topic_id, TopicRelationship.RELATED.value))
        return [row[0] for row in self.cursor.fetchall()]

    # ===== ERROR PATTERNS =====

    def log_error_pattern(self, error: ErrorPattern) -> bool:
        """Логировать паттерн ошибки"""
        try:
            self.cursor.execute("""
                INSERT OR REPLACE INTO error_patterns
                (id, lesson_id, pattern, frequency, severity, common_misconceptions, suggested_clarifications, detected_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                error.id, error.lesson_id, error.pattern, error.frequency, error.severity,
                json.dumps(error.common_misconceptions), json.dumps(error.suggested_clarifications),
                error.detected_at
            ))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при логировании паттерна: {e}")
            return False

    def get_high_error_lessons(self, threshold: float = 0.3) -> List[Tuple[str, float]]:
        """Получить уроки с высокой частотой ошибок"""
        self.cursor.execute("""
            SELECT lesson_id, AVG(frequency) as avg_freq
            FROM error_patterns
            GROUP BY lesson_id
            HAVING avg_freq > ?
            ORDER BY avg_freq DESC
        """, (threshold,))
        return self.cursor.fetchall()

    # ===== STUDENT ANSWERS =====

    def log_student_answer(self, student_id: str, question_id: str, lesson_id: str,
                          answer: str, correctness: str, score: float, error_pattern_id: Optional[str] = None) -> bool:
        """Логировать ответ студента"""
        try:
            answer_id = f"{student_id}_{question_id}_{datetime.now().timestamp()}"
            self.cursor.execute("""
                INSERT INTO student_answers
                (id, student_id, question_id, lesson_id, answer, correctness, score, error_pattern_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                answer_id, student_id, question_id, lesson_id, answer,
                correctness, score, error_pattern_id, datetime.now().isoformat()
            ))
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Ошибка при логировании ответа: {e}")
            return False

    def get_student_progress(self, student_id: str, lesson_id: str) -> Dict:
        """Получить прогресс студента в уроке"""
        self.cursor.execute("""
            SELECT
                COUNT(*) as total_answers,
                SUM(CASE WHEN correctness = 'correct' THEN 1 ELSE 0 END) as correct,
                AVG(score) as avg_score
            FROM student_answers
            WHERE student_id = ? AND lesson_id = ?
        """, (student_id, lesson_id))
        row = self.cursor.fetchone()
        if row:
            return {
                "total_answers": row[0],
                "correct_answers": row[1] or 0,
                "average_score": row[2] or 0,
                "correctness_rate": (row[1] or 0) / row[0] if row[0] > 0 else 0
            }
        return {}

    def get_statistics(self) -> Dict:
        """Получить общую статистику базы знаний"""
        self.cursor.execute("SELECT COUNT(*) FROM lectures")
        lectures_count = self.cursor.fetchone()[0]

        self.cursor.execute("SELECT COUNT(*) FROM lessons")
        lessons_count = self.cursor.fetchone()[0]

        self.cursor.execute("SELECT COUNT(*) FROM courses")
        courses_count = self.cursor.fetchone()[0]

        self.cursor.execute("SELECT COUNT(*) FROM topic_graph")
        topics_count = self.cursor.fetchone()[0]

        self.cursor.execute("SELECT COUNT(*) FROM student_answers")
        answers_count = self.cursor.fetchone()[0]

        return {
            "lectures": lectures_count,
            "lessons": lessons_count,
            "courses": courses_count,
            "topics": topics_count,
            "student_answers": answers_count,
            "timestamp": datetime.now().isoformat()
        }

    def close(self):
        """Закрыть соединение"""
        self.conn.close()


if __name__ == "__main__":
    # Пример использования
    kb = KnowledgeBaseManager()

    # Создать темы
    kb.create_topic("personal-branding", "Personal Branding", "Основы личного бренда")
    kb.create_topic("content-creation", "Content Creation", "Создание контента")
    kb.create_topic("monetization", "Monetization", "Монетизация и доход")

    # Добавить связи
    kb.add_edge("personal-branding", "content-creation", TopicRelationship.EXTENDS)
    kb.add_edge("content-creation", "monetization", TopicRelationship.EXTENDS)

    # Вывести статистику
    print("Knowledge Base Statistics:")
    print(json.dumps(kb.get_statistics(), indent=2))

    kb.close()
