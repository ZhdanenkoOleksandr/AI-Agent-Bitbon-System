# Telegram First Login Flow (Сценарій A)

## 📋 МЕХАНИКА ПЕРШОГО ВХОДУ

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     ПЕРШОГО ВХІД В ОСОБИСТИЙ КАБІНЕТ                    │
│                   (Через Telegram для активних партнерів)                │
└──────────────────────────────────────────────────────────────────────────┘

ФРОНТЕНД (сайт)           TELEGRAM БОТ          СЕРВЕР
      │                        │                    │
      │                        │                    │
  1️⃣  Екран входу          │                    │
      │                        │                    │
      ├─ Кнопка:              │                    │
      │  "🔑 Войти            │                    │
      │   через @BotUsername"  │                    │
      │                        │                    │
      └──► Клік ──► Redirect на т.me/BotUsername   │
                     │                              │
               2️⃣  /start (БЕЗ ТОКЕНА)           │
                     │                              │
                     │──► Перевірка:                │
                     │   • @username існує?        │
                     │   • Партнер активирований? │
                     │                              │
            3️⃣  Якщо партнер активирований:     │
                     │                              │
                     │   Генерувати web_token      │
                     │   webTokens[TOKEN] = {      │
                     │     username: "@user",       │
                     │     createdAt: ISO,         │
                     │     expiresAt: +10m          │
                     │   }                          │
                     │                              │
               4️⃣  Отправити inline кнопку:      │
                     │                              │
                     │   "🔑 Войти в кабинет"     │
                     │   site/?wt=TOKEN&           │
                     │   username=@user            │
                     │                              │
      ◄──────────────┘                              │
      │                                             │
  5️⃣  Клік на кнопку                           │
      │                                             │
      ├─ Отримує URL:                          │
      │  ?wt=TOKEN&username=@user              │
      │                                             │
  6️⃣  Завантаження фронтенду                   │
      │                                             │
      ├─ JS читає URL параметри                │
      │  GET /api/auth/web-token               │
      │      ?wt=TOKEN ─────────────────────────►│
      │                      │                     │
      │             7️⃣  Перевірка:              │
      │                      │  • Token в DB?    │
      │                      │  • Не истек?      │
      │                      │  • Валидный?      │
      │                      │                    │
      │                      ├─ Знайти партнер  │
      │                      │  по username      │
      │                      │                    │
      │    ◄──────────────────┤                   │
      │  8️⃣  { success: true,                     │
      │      jwt: "eyJ...",                       │
      │      user: {                             │
      │        id, fullName,                     │
      │        email, telegram,                  │
      │        status, packageType               │
      │      }                                    │
      │    }                                      │
      │                                           │
  9️⃣  localStorage.setItem                     │
      │  ('jwt', jwt_session)                    │
      │                                           │
 🔟  redirect /cabinet                         │
      │                                           │
 ✅  ВОШЛИ В КАБІНЕТ                           │
```

---

## 🔄 ПОВТОРНИЙ ВХОД (Для вже активних партнерів)

Якщо партнер вже активирований, він може повторно:

1. **Через /start команду** — бот генерує новий web_token
2. **Через /status команду** — показує статус і кнопку входу
3. **URL:** `t.me/BotUsername` → /start → кнопка входу

---

## 📦 РЕАЛІЗОВАНІ ЗМІНИ

### 1️⃣ **server.js** — Backend логіка

#### A. Додано новий endpoint
```javascript
GET /api/auth/web-token?wt=TOKEN
```

**Поведінка:**
- Отримує тимчасовий web_token
- Перевіряє TTL (10 хвилин)
- Знаходить партнера по Telegram username
- Генерує JWT session token
- Видаляє use web_token (one-time use)
- Повертає user + jwt

**Відповідь:**
```json
{
  "success": true,
  "jwt": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "prt_xxx",
    "fullName": "John Doe",
    "email": "user@example.com",
    "telegram": "@username",
    "status": "active",
    "packageType": "pro",
    "requestsUsed": 150,
    "requestsLimit": 500,
    "metaresourcesUsed": 5,
    "metaresourcesLimit": 15,
    "expiresAt": "2026-05-25T09:00:00Z"
  }
}
```

#### B. Нова структура DB
```javascript
DB.webTokens = {
  "abc123def456...": {
    username: "@telegram_username",
    createdAt: "2026-04-25T10:00:00Z",
    expiresAt: "2026-04-25T10:10:00Z"
  }
}
```

#### C. Нові функції
```javascript
generateWebToken()     // Генерує унікальний токен
persistWebTokens()     // Зберігає в data/web_tokens_db.json
```

---

### 2️⃣ **telegram-bot.js** — Логіка бота

#### A. Оновлено `/start` (без параметрів)

**Для активних партнерів:**
1. Перевіряє чи у користувача є @username
2. Знаходить партнера в DB
3. Генерує web_token (TTL: 10 хвилин)
4. Відправляє inline кнопку з loginUrl

**Приклад:**
```
🎉 Добро пожаловать! Нажмите кнопку ниже чтобы войти в личный кабинет.

⏱️ Ссылка действует 10 минут

[🔑 Войти в кабинет]
```

#### B. Оновлено `/status` команду

Якщо партнер активирований:
- Показує статус
- Генерує web_token
- Додає кнопку "🔑 Войти в кабинет"

---

## 🌐 ФРОНТЕНД ЛОГІКА (Потрібно реалізувати)

### HTML/Landing
```html
<div class="login-options">
  <button onclick="window.location = 't.me/YourBotUsername'">
    🔑 Войти через Telegram
  </button>
</div>
```

### JavaScript (React/Vue/Vanilla)
```javascript
// 1. На загрузці сторінки перевірити URL параметри
const params = new URLSearchParams(window.location.search);
const webToken = params.get('wt');
const username = params.get('username');

// 2. Якщо є web_token — обміняти його на JWT
if (webToken) {
  fetch(`/api/auth/web-token?wt=${webToken}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        // 3. Зберегти JWT
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 4. Redirect в кабінет
        window.location = '/cabinet';
      } else {
        // Помилка: токен истек чи невалиден
        alert('❌ ' + data.error);
        window.location = '/';
      }
    });
}
```

---

## 🔑 Environment Variables

Потрібно додати до `.env`:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_BOT_USERNAME=BitbonPartnerBot
TELEGRAM_ADMIN_CHAT_ID=123456789

# Web URLs
SITE_URL=https://yourdomain.com
# або для локального розробки:
SITE_URL=http://localhost:3000
```

---

## 📊 DATA PERSISTENCE

Усі web tokens зберігаються в:
```
data/web_tokens_db.json
```

**Структура:**
```json
{
  "token123abc": {
    "username": "@user123",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "expiresAt": "2026-04-25T10:10:00.000Z"
  }
}
```

---

## 🚀 DEPLOYMENT FLOW

1. **Партнер активирований** (status: "active")
   ↓
2. **Отримує invite ссилку** або просто заходить на сайт
   ↓
3. **Клік на "Войти через Telegram"**
   ↓
4. **Відправляється на t.me/BotUsername**
   ↓
5. **Нажимает /start**
   ↓
6. **Бот генерує web_token** (TTL: 10 хв)
   ↓
7. **Клік на кнопку "Войти в кабинет"**
   ↓
8. **Фронтенд обмінює token на JWT**
   ↓
9. **Redirect в /cabinet** (з auth token)

---

## ✅ ТЕСТУВАННЯ

### Сценарій: Перший вход активного партнера

1. **Стан БД:** Партнер існує з status="active"
   ```javascript
   DB.partners['prt_xxx'] = {
     id: 'prt_xxx',
     firstName: 'John',
     lastName: 'Doe',
     telegram: '@johndoe',
     status: 'active',
     ...
   }
   ```

2. **Користувач нажимає:** t.me/BitbonPartnerBot

3. **Бот отримує:** /start

4. **Очікуємий результат:**
   - web_token генерується ✅
   - Inline кнопка відправляється ✅
   - URL містить ?wt=TOKEN&username=@johndoe ✅

5. **Користувач клацає кнопку**

6. **Фронтенд отримує:**
   ```json
   {
     "success": true,
     "jwt": "eyJ...",
     "user": {...}
   }
   ```

7. **Результат:** ✅ Користувач у кабінеті

---

## 🔒 SECURITY NOTES

✅ **Що захищено:**
- web_tokens одноразові (видаляються після використання)
- web_tokens з TTL (10 хвилин)
- JWT повністю незалежний (може мати власні TTL)
- Перевірка username чи партнер активирований
- Перевірка наявності @username у Telegram

⚠️ **Що варто покращити:**
- Додати rate limiting на /api/auth/web-token
- HTTPS only для production
- CSRF token для POST операцій
- Logout endpoint для видалення JWT

---

## 📞 КОНТАКТИ ДЛЯ ПИТАНЬ

- API: /api/auth/web-token?wt=TOKEN
- Bot: /start, /status, /cancel
- Dashboard: /cabinet (з JWT auth)
