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

const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME   = process.env.TELEGRAM_BOT_USERNAME; // без @, напр: BitbonPartnerBot
const ADMIN_CHAT_ID  = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK;

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

    // Найти приглашение по токену
    const partner = Object.values(db.partners).find(p => p.inviteToken === token);
    if (!partner) {
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

    // Если уже зарегистрирован — не начинать заново
    if (partner.status !== 'invited') {
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

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || 'партнёр'}*!\n\n` +
      `Вас приглашают стать партнёром *Системы Bitbon* 🌐\n\n` +
      `Я задам несколько вопросов для оформления регистрации.\n` +
      `Отмена: /cancel\n\n` +
      PROMPTS.firstName,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /start без токена — генерировать web_token для входа ────────────
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
      // Уже активирован — генерировать web_token для входа в кабинет
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
    } else {
      // Не активирован или не найден — показать инструкцию
      bot.sendMessage(chatId,
        `👋 Привет! Это бот регистрации партнёров *Системы Bitbon*.\n\n` +
        `Для регистрации используйте персональную ссылку-приглашение от вашего менеджера.\n\n` +
        `🤝 *Уже партнёр?* Используйте /status для проверки статуса`,
        { parse_mode: 'Markdown' }
      );
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
    if (!text || text.startsWith('/')) return;

    const sess = sessions[chatId];
    if (!sess || typeof sess.step === 'string') return; // ждём inline keyboard

    const field = STEPS[sess.step];
    if (!field) return;

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
  partner.status        = 'pending_payment';
  partner.completedAt   = new Date().toISOString();
  persistData();

  // Подтверждение клиенту
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

  // Уведомление админу
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
