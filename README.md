# ⚡ Bitbon Partner System v2.0

AI Агент Системы Bitbon — партнёрская платформа с самообучающейся базой знаний метаресурсов.

## 🏗️ Архитектура

```
├── server.js              # Express backend (API, auth, admin, knowledge base)
├── public/
│   ├── index.html         # AI Agent — главная страница
│   └── admin.html         # Панель администратора
├── data/
│   ├── knowledge_base.json         # Статическая база знаний
│   └── metaresource_templates.json # Шаблоны метаресурсов
├── package.json
├── Procfile               # Railway deployment
├── railway.json           # Railway config
├── .env.example
└── .gitignore
```

## 🚀 Быстрый старт

### 1. Клонирование
```bash
git clone https://github.com/YOUR_USERNAME/bitbon-partner-system.git
cd bitbon-partner-system
```

### 2. Установка зависимостей
```bash
npm install
```

### 3. Настройка окружения
```bash
cp .env.example .env
# Отредактируйте .env — установите JWT_SECRET и ADMIN_PASSWORD
```

### 4. Запуск
```bash
npm start
```
- Агент: http://localhost:3000
- Админ: http://localhost:3000/admin

## 🔐 Безопасность

- **JWT авторизация** для партнёров и админа
- **bcrypt** хеширование API ключей (plain key показывается только 1 раз)
- **Helmet** заголовки безопасности
- **Rate limiting** (100 запросов / 15 мин)
- **CORS** настроен
- **CSP** политика безопасности контента

## 📋 Логика работы

### Регистрация партнёра
1. Партнёр заполняет форму: **Имя, Фамилия**, Email, Telegram
2. Выбирает пакет (Стартер / Про / Эксперт)
3. Отправляет Bitbon на кошелёк системы
4. Указывает TX хэш в разделе «Оплата»
5. **Администратор видит оплату** в панели `/admin`
6. Админ **активирует API ключ** → система определяет лимиты по пакету
7. Имя партнёра отображается вместо стандартного заголовка

### Пакеты
| Пакет | Цена | Запросов | Метаресурсов |
|-------|------|----------|-------------|
| 🌱 Стартер | 10 BB/мес | 100 | 3 |
| 📖 Про | 50 BB/мес | 500 | 15 |
| 🚀 Эксперт | 150 BB/мес | ∞ | ∞ |

### Самообучающаяся база знаний
Каждый созданный демо-Метаресурс **автоматически сохраняется** в базу знаний:
- Определяется отрасль (авто, еда, здоровье, IT и т.д.)
- Находятся **кросс-ссылки** с существующими метаресурсами
- Обратные ссылки обновляются у связанных записей

**Пример:** Метаресурс «Шиномонтаж» → автоматически связывается с «Продажа Шин», «Автосалон», «Автосервис».

### Разделение User / Business
- **Пользователи**: вопросы о Bitbon, АУРА, Web 4.0
- **Бизнес**: создание метаресурсов, партнёрство, API

## 🌐 Деплой на Railway

### Через GitHub
1. Push в GitHub
2. Откройте [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Добавьте переменные окружения:
   - `PORT` = (Railway назначит автоматически)
   - `JWT_SECRET` = ваш секретный ключ
   - `ADMIN_PASSWORD` = пароль админа

### Переменные окружения
| Переменная | Описание | Обязательно |
|-----------|----------|------------|
| `PORT` | Порт сервера | Railway задаёт |
| `JWT_SECRET` | Секрет для JWT токенов | ✅ |
| `ADMIN_PASSWORD` | Пароль админ-панели | ✅ |

## 📡 API Endpoints

### Публичные
- `POST /api/partner/register` — Регистрация партнёра
- `POST /api/partner/payment` — Отправка информации об оплате
- `POST /api/partner/login` — Авторизация партнёра
- `GET /api/metaresource/knowledge` — База знаний метаресурсов
- `GET /api/metaresource/related/:industry` — Связанные метаресурсы
- `POST /api/metaresource/save` — Сохранение метаресурса в БЗ

### Партнёрские (JWT)
- `GET /api/partner/dashboard` — Дашборд партнёра
- `POST /api/query` — Запрос от клиента (X-API-Key)

### Административные (JWT)
- `POST /api/admin/login` — Авторизация админа
- `GET /api/admin/partners` — Список партнёров
- `GET /api/admin/payments` — Список платежей
- `POST /api/admin/activate` — Активация API ключа
- `POST /api/admin/confirm-payment` — Подтверждение оплаты
- `GET /api/admin/metaresources` — Все метаресурсы
- `GET /api/admin/stats` — Статистика

## 📄 Лицензия

MIT — Система Bitbon / Web 4.0
