// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner — Telegram Registration Bot
//
// FLOW:
// 1. Кабинет создаёт предварительную запись партнёра (status: invited)
// 2. Кабинет показывает deep link: t.me/BOT?start=TOKEN
// 3. Клиент нажимает ссылку → бот пишет первым → собирает данные
// 4. Данные сохраняются в DB + Google Sheets
// 5. Админ получает уведомление в Telegram
// ══════════════════════════════════════════════════════════════════════

const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME     = process.env.TELEGRAM_BOT_USERNAME; // без @, напр: BitbonPartnerBot
const ADMIN_CHAT_ID    = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SHEETS_WEBHOOK   = process.env.GOOGLE_SHEETS_WEBHOOK;
const ADMIN_USERNAME   = process.env.ADMIN_USERNAME || '@VikingOLZ';
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'admin123';

// Данные нулевого пользователя (для PIN верификации)
const ZERO_USER_TELEGRAM = process.env.ZERO_USER_TELEGRAM || '@VikingOLZH';
const ZERO_USER_PIN      = process.env.ZERO_USER_PIN || '8387';
const ZERO_USER_EMAIL    = process.env.ZERO_USER_EMAIL || 'Alex.zhdanenko@gmail.com';
const ZERO_USER_PHONE    = process.env.ZERO_USER_PHONE || '+380969519149';

const PLAN_LABELS = {
  starter: '🌱 Стартер — 10 BB/мес (100 запросов)',
  pro:     '📖 Про — 50 BB/мес (500 запросов)',
  expert:  '🚀 Эксперт — 150 BB/мес (безлимит)'
};

const PLAN_KEYBOARD = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🌱 Стартер — 10 BB/мес',  callback_data: 'plan_starter' }],
      [{ text: '📖 Про — 50 BB/мес',       callback_data: 'plan_pro'    }],
      [{ text: '🚀 Эксперт — 150 BB/мес',  callback_data: 'plan_expert' }]
    ]
  }
};

// Сессии регистрации: { chatId: { token, step, data } }
const sessions = {};

// Admin sessions: { chatId: { step, attempts } }
// step: 'password' = ожидает пароля
const adminSessions = {};

// Шаги сбора данных после deep link
const STEPS = ['firstName', 'lastName', 'email', 'phone'];
const PROMPTS = {
  firstName: '👤 Введите ваше *Имя*:',
  lastName:  '👤 Введите *Фамилию*:',
  email:     '📧 Введите *Email*:',
  phone:     '📱 Введите *телефон* (или отправьте . чтобы пропустить):'
};

let botInstance = null;

// ── INIT ──────────────────────────────────────────────────────────────
function initBot(db, persistData, generatePartnerId, generateWebToken, persistWebTokens) {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram бот отключён');
    return null;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  botInstance = bot;
  console.log('🤖 Telegram бот запущен');

  // ── /start с токеном (deep link из кабинета) ───────────────────────
  bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const token  = match[1];

    console.log(`🔗 [BOT] /start received with token: ${token.substring(0, 10)}... from chat ${chatId}`);
    console.log(`📋 [BOT] Looking up partner with inviteToken...`);
    console.log(`📊 [BOT] Total partners in DB: ${Object.keys(db.partners).length}`);

    // Debug: log all inviteTokens
    const allTokens = Object.values(db.partners).map(p => ({ id: p.id, token: p.inviteToken?.substring(0, 10), status: p.status }));
    console.log(`🔑 [BOT] Available tokens:`, allTokens);

    // Найти приглашение по токену
    const partner = Object.values(db.partners).find(p => p.inviteToken === token);

    if (!partner) {
      console.log(`❌ [BOT] Partner NOT found for token: ${token}`);
      bot.sendMessage(chatId,
        `❌ *Ссылка устарела или недействительна.*\n\n` +
        `Возможные причины:\n` +
        `• Ссылка была создана давно и сервер перезапустился\n` +
        `• Ссылка уже была использована\n\n` +
        `📌 *Что делать:* попросите менеджера создать новое приглашение в кабинете (кнопка 🤝 Партнёр).`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    console.log(`✅ [BOT] Partner found: ${partner.id}, status: ${partner.status}`);

    // Если уже зарегистрирован — не начинать заново
    if (partner.status !== 'invited') {
      console.log(`⚠️  [BOT] Partner already registered with status: ${partner.status}`);
      bot.sendMessage(chatId,
        `ℹ️ Вы уже зарегистрированы!\n\nИспользуйте /status для проверки статуса.`
      );
      return;
    }

    // Сохранить chat_id к партнёру
    partner.telegramChatId = String(chatId);
    partner.telegram = msg.from.username ? '@' + msg.from.username : partner.telegram;
    persistData();

    // Начать сбор данных
    sessions[chatId] = { token, partnerId: partner.id, step: 0, data: {} };
    console.log(`📝 [BOT] Session created for chat ${chatId}, step 0`);

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || 'партнёр'}*!\n\n` +
      `Вас приглашают стать партнёром *Системы Bitbon* 🌐\n\n` +
      `Я задам несколько вопросов для оформления регистрации.\n` +
      `Отмена: /cancel\n\n` +
      PROMPTS.firstName,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /start без токена — либо вход, либо НУЛЕВАЯ РЕГИСТРАЦИЯ ───────────
  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? '@' + msg.from.username : null;

    if (!username) {
      bot.sendMessage(chatId,
        `❌ *Ошибка:* У вас не установлено имя пользователя (@username) в Telegram.\n\n` +
        `Пожалуйста, установите имя пользователя в настройках аккаунта и попробуйте снова.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Проверить есть ли уже активный партнёр с этим username
    const existingPartner = Object.values(db.partners).find(
      p => p.telegram === username || p.telegram === username.substring(1)
    );

    if (existingPartner && existingPartner.status === 'active') {
      // Уже активирован — проверяем нужна ли PIN верификация (для нулевого пользователя)
      if (username.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
        // Нулевой пользователь — требуем PIN код
        sessions[chatId] = { step: 'pin_verification', username, attempts: 0 };
        bot.sendMessage(chatId,
          `🔐 *Введите PIN-код доступа к кабинету:*`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Обычный партнёр — генерируем web_token сразу
        const webToken = generateWebToken();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

        db.webTokens[webToken] = {
          username: username.startsWith('@') ? username : '@' + username,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString()
        };
        persistWebTokens();

        // Отправить inline кнопку для входа на сайт
        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(username)}`;

        bot.sendMessage(chatId,
          `🎉 *Добро пожаловать!* Нажмите кнопку ниже чтобы войти в личный кабинет.\n\n` +
          `⏱️ Ссылка действует 10 минут`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔑 Войти в кабинет', url: loginUrl }]
              ]
            }
          }
        );
      }
    } else if (existingPartner) {
      // Есть партнёр, но статус не активен — показать статус
      bot.sendMessage(chatId,
        `ℹ️ *Ваша регистрация в процессе.*\n\n` +
        `📌 Статус: ${existingPartner.status}\n\n` +
        `Используйте /status для подробностей.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      // Нет партнёра — проверяем: есть ли ВООБЩЕ активные партнеры?
      const hasActivePartners = Object.values(db.partners).some(p => p.status === 'active');

      if (!hasActivePartners) {
        // ✅ НУЛЕВАЯ РЕГИСТРАЦИЯ — первый пользователь становится АДМИНОМ
        console.log(`🆕 [BOT] Zero registration started: ${username} will become ADMIN`);

        const partnerId = generatePartnerId();
        const partner = {
          id: partnerId,
          firstName: msg.from.first_name || '',
          lastName: msg.from.last_name || '',
          email: '',
          telegram: username,
          phone: '',
          walletAddress: '',
          inviteToken: null,
          telegramChatId: String(chatId),
          status: 'invited',
          packageType: null,
          apiKey: null,
          role: 'admin', // ✅ ПЕРВЫЙ ПОЛЬЗОВАТЕЛЬ = АДМИН
          requestsLimit: 0,
          requestsUsed: 0,
          metaresourcesLimit: 0,
          metaresourcesUsed: 0,
          createdAt: new Date().toISOString(),
          activatedAt: null,
          expiresAt: null,
          source: 'zero_registration'
        };

        db.partners[partnerId] = partner;
        persistData();

        // Начать сбор данных для админа
        sessions[chatId] = { partnerId, step: 0, data: {}, isZeroReg: true };
        console.log(`📝 [BOT] Admin session created for chat ${chatId}`);

        bot.sendMessage(chatId,
          `🎉 *Добро пожаловать!*\n\n` +
          `Вы первый пользователь системы Bitbon! 👑\n\n` +
          `Вы будете администратором и сможете приглашать партнеров.\n\n` +
          `Заполните свои данные:`,
          { parse_mode: 'Markdown' }
        );

        bot.sendMessage(chatId, PROMPTS.firstName, { parse_mode: 'Markdown' });
      } else {
        // Не активирован, НО уже есть активные партнеры — требуется приглашение
        bot.sendMessage(chatId,
          `👋 Привет! Это бот регистрации партнёров *Системы Bitbon*.\n\n` +
          `Для регистрации используйте персональную ссылку-приглашение от администратора.\n\n` +
          `🤝 *Уже партнёр?* Используйте /status для проверки статуса`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  });

  // ── /cancel ────────────────────────────────────────────────────────
  bot.onText(/\/cancel/, (msg) => {
    delete sessions[msg.chat.id];
    bot.sendMessage(msg.chat.id, '❌ Регистрация отменена. Для повторного старта используйте вашу ссылку-приглашение.');
  });

  // ── /status ────────────────────────────────────────────────────────
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const partner = Object.values(db.partners).find(p => p.telegramChatId === String(chatId));
    if (!partner) {
      bot.sendMessage(chatId, '❌ Партнёр не найден. Используйте ссылку-приглашение для регистрации.');
      return;
    }
    const statusText = {
      invited:         '📩 Ожидает заполнения данных',
      pending_payment: '⏳ Ожидает оплаты',
      pending_review:  '🔍 На проверке у администратора',
      active:          '✅ Активен',
      suspended:       '🚫 Приостановлен',
      expired:         '⌛ Истёк'
    };
    const options = {
      parse_mode: 'Markdown'
    };

    // Если партнёр активирован, добавить кнопку входа
    if (partner.status === 'active') {
      const webToken = generateWebToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      db.webTokens[webToken] = {
        username: partner.telegram || ('@' + msg.from.username),
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      persistWebTokens();

      const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
      const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(partner.telegram || ('@' + msg.from.username))}`;

      options.reply_markup = {
        inline_keyboard: [
          [{ text: '🔑 Войти в кабинет', url: loginUrl }]
        ]
      };
    }

    bot.sendMessage(chatId,
      `📋 *Статус партнёра:*\n\n` +
      `🆔 \`${partner.id}\`\n` +
      `👤 ${partner.firstName || '—'} ${partner.lastName || ''}\n` +
      `📦 ${partner.packageType ? PLAN_LABELS[partner.packageType] : 'пакет не выбран'}\n` +
      `${statusText[partner.status] || partner.status}\n` +
      (partner.apiKey ? `\n🔑 API: \`${partner.apiKey}\`` : ''),
      options
    );
  });

  // ── /login (для админа) ────────────────────────────────────────────
  bot.onText(/\/login/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? '@' + msg.from.username : null;

    // Проверка username админа
    if (!username || username.toLowerCase() !== ADMIN_USERNAME.toLowerCase()) {
      bot.sendMessage(chatId,
        `❌ *Вход запрещён.*\n\n` +
        `Эта команда доступна только для администратора.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Начать сессию ввода пароля
    adminSessions[chatId] = { step: 'password', attempts: 0 };
    bot.sendMessage(chatId,
      `🔐 *Введите пароль администратора:*\n\n` +
      `(У вас есть 3 попытки)`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Выбор пакета (inline keyboard) ────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const sess = sessions[chatId];
    if (!sess || sess.step !== 'plan') return;

    const plan = query.data.replace('plan_', '');
    sess.data.plan = plan;
    bot.answerCallbackQuery(query.id);

    await completeRegistration(bot, chatId, sess, db, persistData);
    delete sessions[chatId];
  });

  // ── Ввод текста по шагам ───────────────────────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    console.log(`💬 [BOT] Message from chat ${chatId}: "${text?.substring(0, 30)}..."`);

    if (!text || text.startsWith('/')) {
      console.log(`⏭️  [BOT] Skipping: empty text or command`);
      return;
    }

    // ── Проверка PIN верификации (для нулевого пользователя) ─────────
    const sess = sessions[chatId];
    if (sess && sess.step === 'pin_verification') {
      if (text === ZERO_USER_PIN) {
        // PIN верный — генерируем web_token для нулевого пользователя
        delete sessions[chatId];

        const webToken = generateWebToken();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const username = sess.username;

        db.webTokens[webToken] = {
          username: username.startsWith('@') ? username : '@' + username,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString()
        };
        persistWebTokens();

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(username)}`;

        bot.sendMessage(chatId,
          `✅ *PIN верен!* Нажмите кнопку ниже чтобы войти в личный кабинет.\n\n` +
          `⏱️ Ссылка действует 10 минут`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔑 Войти в кабинет', url: loginUrl }]
              ]
            }
          }
        );
      } else {
        // PIN неверный
        sess.attempts++;
        if (sess.attempts >= 3) {
          delete sessions[chatId];
          bot.sendMessage(chatId, `❌ Исчерпаны попытки входа. Используйте /start для нового входа.`);
        } else {
          const remaining = 3 - sess.attempts;
          bot.sendMessage(chatId,
            `❌ *Неверный PIN-код.*\n\n` +
            `Осталось попыток: ${remaining}\n\n` +
            `Введите PIN-код:`,
            { parse_mode: 'Markdown' }
          );
        }
      }
      return;
    }

    // ── Проверка админ сессии (ввод пароля) ──────────────────────────
    const adminSess = adminSessions[chatId];
    if (adminSess && adminSess.step === 'password') {
      if (text === ADMIN_PASSWORD) {
        // Пароль верный — генерируем admin web_token
        delete adminSessions[chatId];

        const webToken = generateWebToken();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const adminUsername = msg.from.username ? '@' + msg.from.username : '@admin';

        db.webTokens[webToken] = {
          username: adminUsername,
          isAdmin: true,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString()
        };
        persistWebTokens();

        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(adminUsername)}&role=admin`;

        bot.sendMessage(chatId,
          `✅ *Добро пожаловать, Администратор!*\n\n` +
          `⏱️ Ссылка действует 10 минут\n\n`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔑 Войти в админ панель', url: loginUrl }]
              ]
            }
          }
        );
      } else {
        // Пароль неверный
        adminSess.attempts++;
        if (adminSess.attempts >= 3) {
          delete adminSessions[chatId];
          bot.sendMessage(chatId, `❌ Исчерпаны попытки входа. Используйте /login для нового входа.`);
        } else {
          const remaining = 3 - adminSess.attempts;
          bot.sendMessage(chatId,
            `❌ *Неверный пароль.*\n\n` +
            `Осталось попыток: ${remaining}\n\n` +
            `Введите пароль:`,
            { parse_mode: 'Markdown' }
          );
        }
      }
      return;
    }

    // ── Регулярная сессия партнёра ────────────────────────────────────
    const sess = sessions[chatId];

    console.log(`📌 [BOT] Session check: exists=${!!sess}, step=${sess?.step}, type=${typeof sess?.step}`);

    if (!sess) {
      console.log(`❌ [BOT] No session found for chat ${chatId}. Active sessions:`, Object.keys(sessions));
      return;
    }

    if (typeof sess.step === 'string') {
      console.log(`⏸️  [BOT] Waiting for inline keyboard callback, not processing text input`);
      return; // ждём inline keyboard
    }

    const field = STEPS[sess.step];
    console.log(`📋 [BOT] Processing field: ${field} (step ${sess.step}/${STEPS.length})`);

    if (!field) {
      console.log(`⚠️  [BOT] No field for step ${sess.step}`);
      return;
    }

    // Пропуск необязательных полей
    if (text === '.' && field === 'phone') {
      sess.data.phone = '';
    } else {
      // Валидация email
      if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        bot.sendMessage(chatId, '❌ Некорректный email. Попробуйте ещё раз:');
        return;
      }
      sess.data[field] = text;
    }

    sess.step++;

    if (sess.step < STEPS.length) {
      // Следующий шаг
      bot.sendMessage(chatId, PROMPTS[STEPS[sess.step]], { parse_mode: 'Markdown' });
    } else {
      // Все поля заполнены — выбор пакета
      sess.step = 'plan';
      bot.sendMessage(chatId, '📦 Выберите *пакет партнёра*:', { parse_mode: 'Markdown', ...PLAN_KEYBOARD });
    }
  });

  return bot;
}

// ── Завершение регистрации ────────────────────────────────────────────
async function completeRegistration(bot, chatId, sess, db, persistData) {
  const partner = db.partners[sess.partnerId];
  if (!partner) return;

  // Обновить данные партнёра
  partner.firstName     = sess.data.firstName?.trim();
  partner.lastName      = sess.data.lastName?.trim();
  partner.email         = sess.data.email?.trim().toLowerCase();
  partner.phone         = sess.data.phone || '';
  partner.packageType   = sess.data.plan;
  partner.completedAt   = new Date().toISOString();

  // НУЛЕВАЯ РЕГИСТРАЦИЯ: админ сразу активный
  if (sess.isZeroReg) {
    partner.status = 'active';
    partner.activatedAt = new Date().toISOString();
    partner.requestsLimit = Infinity;
    persistData();

    bot.sendMessage(chatId,
      `✅ *Добро пожаловать, Администратор!*\n\n` +
      `👤 ${partner.firstName} ${partner.lastName}\n` +
      `📧 ${partner.email}\n\n` +
      `🔑 Вы можете:\n` +
      `• Создавать приглашения для партнёров\n` +
      `• Управлять системой\n` +
      `• Проверять платежи\n\n` +
      `📱 Используйте /status для входа в кабинет\n\n`,
      { parse_mode: 'Markdown' }
    );

    // Уведомление в консоль
    console.log(`🆕 [BOT] ADMIN REGISTRATION COMPLETE: ${partner.id}`);
  } else {
    // Обычный партнер - требует платёж
    partner.status = 'pending_payment';
    persistData();

    bot.sendMessage(chatId,
      `✅ *Данные сохранены!*\n\n` +
      `👤 ${partner.firstName} ${partner.lastName}\n` +
      `📧 ${partner.email}\n` +
      `📱 ${partner.phone || '—'}\n` +
      `📦 ${PLAN_LABELS[partner.packageType]}\n\n` +
      `🆔 *Ваш ID:* \`${partner.id}\`\n\n` +
      `⏳ *Следующий шаг:* отправьте оплату Bitbon и сообщите менеджеру TX-хэш.\n` +
      `После подтверждения вы получите API-ключ здесь в боте.\n\n` +
      `/status — проверить статус`,
      { parse_mode: 'Markdown' }
    );

    // Уведомление админу о новом партнере
    if (ADMIN_CHAT_ID) {
      bot.sendMessage(ADMIN_CHAT_ID,
        `🆕 *Партнёр заполнил данные!*\n\n` +
        `👤 ${partner.firstName} ${partner.lastName}\n` +
        `📧 ${partner.email}\n` +
        `📱 ${partner.phone || '—'}\n` +
        `💬 Telegram: ${partner.telegram || '—'}\n` +
        `📦 ${PLAN_LABELS[partner.packageType]}\n` +
        `🆔 \`${partner.id}\`\n` +
        `📅 ${new Date().toLocaleString('ru-RU')}`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  // Google Sheets
  await appendToSheets(partner);
}

// ── Google Sheets (Apps Script webhook) ──────────────────────────────
async function appendToSheets(partner) {
  if (!SHEETS_WEBHOOK) return;
  try {
    await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date:      new Date().toLocaleString('ru-RU'),
        partnerId: partner.id,
        firstName: partner.firstName,
        lastName:  partner.lastName,
        email:     partner.email,
        phone:     partner.phone,
        telegram:  partner.telegram,
        plan:      partner.packageType,
        status:    partner.status
      })
    });
    console.log(`📊 Sheets: partner ${partner.id} записан`);
  } catch (e) {
    console.error('📊 Sheets ошибка:', e.message);
  }
}

// ── Уведомить партнёра об активации (из admin endpoint) ──────────────
async function notifyPartnerActivated(telegramChatId, partner) {
  if (!botInstance || !telegramChatId) return;
  try {
    await botInstance.sendMessage(telegramChatId,
      `🎉 *Ваш аккаунт партнёра активирован!*\n\n` +
      `📦 ${PLAN_LABELS[partner.packageType] || partner.packageType}\n` +
      `🔑 *API ключ:*\n\`${partner.apiKey}\`\n\n` +
      `Лимит: ${partner.requestsLimit === Infinity ? '∞ безлимит' : partner.requestsLimit + ' запросов/мес'}\n\n` +
      `Удачи в работе! /status`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Telegram notify ошибка:', e.message);
  }
}

// ── Получить deep link для нового партнёра ───────────────────────────
function getInviteLink(inviteToken) {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}?start=${inviteToken}`;
}

module.exports = { initBot, notifyPartnerActivated, appendToSheets, getInviteLink };
