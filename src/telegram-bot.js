// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner — Telegram Registration Bot
//
// FLOW:
// 1. Нулевой партнёр (@VikingOLZH): /start → PIN → кабинет
// 2. Новый партнёр: /start → регистрация (имя, email, телефон, пакет)
// 3. Приглашённый: /start TOKEN → регистрация по invite-токену
// 4. Активный партнёр: /start → ссылка для входа
// ══════════════════════════════════════════════════════════════════════

const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME     = process.env.TELEGRAM_BOT_USERNAME;
const ADMIN_CHAT_ID    = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SHEETS_WEBHOOK   = process.env.GOOGLE_SHEETS_WEBHOOK;

// Нулевой пользователь — фиксированный администратор
const ZERO_USER_TELEGRAM = process.env.ZERO_USER_TELEGRAM || '@VikingOLZH';
const ZERO_USER_PIN      = process.env.ZERO_USER_PIN      || '8387';
const ZERO_USER_EMAIL    = process.env.ZERO_USER_EMAIL    || 'Alex.zhdanenko@gmail.com';
const ZERO_USER_PHONE    = process.env.ZERO_USER_PHONE    || '+380969519149';

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

// Шаги регистрации
const STEPS = ['firstName', 'lastName', 'email', 'phone'];
const PROMPTS = {
  firstName: '👤 Введите ваше *Имя*:',
  lastName:  '👤 Введите *Фамилию*:',
  email:     '📧 Введите *Email*:',
  phone:     '📱 Введите *телефон* (или отправьте . чтобы пропустить):'
};

// Сессии в памяти: chatId → { step, ... }
// step: 'pin_verification' | 'pin_setup' | 0..3 | 'plan'
const sessions = {};

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

  // ── Вспомогательная: сгенерировать и отправить ссылку для входа ────
  function sendLoginLink(chatId, username, extraText) {
    const webToken = generateWebToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const normalizedUsername = username.startsWith('@') ? username : '@' + username;

    db.webTokens[webToken] = {
      username: normalizedUsername,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    persistWebTokens();

    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(normalizedUsername)}`;

    const message = extraText
      ? `${extraText}\n\n⏱️ Ссылка действует *10 минут*`
      : `🎉 *Добро пожаловать!*\n\nНажмите кнопку ниже чтобы войти в кабинет.\n\n⏱️ Ссылка действует *10 минут*`;

    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔑 Войти в кабинет', url: loginUrl }]]
      }
    });

    console.log(`🔗 [BOT] Login link sent to ${normalizedUsername} (chat ${chatId})`);
  }

  // ── /start с токеном (invite deep link из кабинета) ───────────────
  bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const token  = match[1];

    // Если это нулевой пользователь с токеном — игнорируем токен, используем PIN flow
    const username = msg.from.username ? '@' + msg.from.username : null;
    if (username && username.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      handleZeroUserStart(chatId, msg);
      return;
    }

    console.log(`🔗 [BOT] /start with invite token from chat ${chatId}`);

    const partner = Object.values(db.partners).find(p => p.inviteToken === token);

    if (!partner) {
      bot.sendMessage(chatId,
        `❌ *Ссылка устарела или недействительна.*\n\n` +
        `Попросите администратора создать новое приглашение.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (partner.status !== 'invited') {
      if (partner.status === 'active') {
        sendLoginLink(chatId, partner.telegram || username || ('@' + msg.from.username));
      } else {
        bot.sendMessage(chatId, `ℹ️ Статус вашей заявки: *${partner.status}*\n\nИспользуйте /status для подробностей.`, { parse_mode: 'Markdown' });
      }
      return;
    }

    // Сохранить chatId
    partner.telegramChatId = String(chatId);
    if (msg.from.username) {
      partner.telegram = '@' + msg.from.username;
    }
    persistData();

    sessions[chatId] = { token, partnerId: partner.id, step: 0, data: {}, isInvited: true };
    console.log(`📝 [BOT] Invited registration started for partner ${partner.id}`);

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || 'партнёр'}*!\n\n` +
      `Вас приглашают стать партнёром *Системы Bitbon* 🌐\n\n` +
      `Заполним данные для регистрации. Отмена: /cancel\n\n` +
      PROMPTS.firstName,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /start без токена ─────────────────────────────────────────────
  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    handleStart(chatId, msg);
  });

  function handleStart(chatId, msg) {
    const username = msg.from.username ? '@' + msg.from.username : null;

    // ── Нет @username ──────────────────────────────────────────────
    if (!username) {
      bot.sendMessage(chatId,
        `❌ *Ошибка:* У вас не установлен @username в Telegram.\n\n` +
        `Установите имя пользователя в настройках и попробуйте снова.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // ── Нулевой пользователь (администратор) ──────────────────────
    if (username.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      handleZeroUserStart(chatId, msg);
      return;
    }

    // ── Поиск партнёра по username ────────────────────────────────
    const existingPartner = Object.values(db.partners).find(p =>
      p.telegram && p.telegram.toLowerCase() === username.toLowerCase()
    );

    if (existingPartner) {
      if (existingPartner.status === 'active') {
        // Уже активен — отправить ссылку для входа
        sendLoginLink(chatId, existingPartner.telegram || username,
          `🎉 *Добро пожаловать обратно!*`
        );
      } else {
        // Есть запись, но ещё не активирован
        bot.sendMessage(chatId,
          `ℹ️ *Ваша регистрация на проверке.*\n\n` +
          `📌 Статус: *${existingPartner.status}*\n\n` +
          `После активации вы получите уведомление.\n` +
          `Используйте /status для подробностей.`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // ── Новый пользователь — самостоятельная регистрация ─────────
    console.log(`🆕 [BOT] New partner self-registration: ${username}`);

    const partnerId = generatePartnerId();
    const partner = {
      id: partnerId,
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      email: '',
      phone: '',
      telegram: username,
      walletAddress: '',
      inviteToken: null,
      telegramChatId: String(chatId),
      status: 'invited',
      packageType: null,
      apiKey: null,
      role: 'partner',
      requestsLimit: 0,
      requestsUsed: 0,
      metaresourcesLimit: 0,
      metaresourcesUsed: 0,
      createdAt: new Date().toISOString(),
      activatedAt: null,
      expiresAt: null,
      source: 'self_registration'
    };

    db.partners[partnerId] = partner;
    persistData();

    sessions[chatId] = { partnerId, step: 0, data: {} };

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || username}*!\n\n` +
      `Добро пожаловать в *Систему Bitbon* 🌐\n\n` +
      `Для регистрации партнёра ответьте на несколько вопросов.\n` +
      `Отмена: /cancel`,
      { parse_mode: 'Markdown' }
    );

    bot.sendMessage(chatId, PROMPTS.firstName, { parse_mode: 'Markdown' });
  }

  // ── Логика нулевого пользователя ─────────────────────────────────
  function handleZeroUserStart(chatId, msg) {
    const username = msg.from.username ? '@' + msg.from.username : ZERO_USER_TELEGRAM;

    // Проверить: есть ли уже активный аккаунт
    const zeroPartner = Object.values(db.partners).find(p =>
      p.telegram && p.telegram.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()
      && p.status === 'active'
    );

    if (zeroPartner) {
      // Аккаунт есть — запросить PIN для входа
      sessions[chatId] = { step: 'pin_verification', username, attempts: 0 };
      bot.sendMessage(chatId,
        `🔐 *Введите PIN-код для входа в кабинет:*`,
        { parse_mode: 'Markdown' }
      );
      console.log(`🔐 [BOT] PIN verification requested for zero user (chat ${chatId})`);
    } else {
      // Первый запуск — настройка аккаунта через PIN
      sessions[chatId] = { step: 'pin_setup', username, attempts: 0 };
      bot.sendMessage(chatId,
        `👑 *Привет, Администратор!*\n\n` +
        `Это ваш первый вход в систему Bitbon.\n\n` +
        `🔐 *Введите PIN-код для активации вашего аккаунта:*`,
        { parse_mode: 'Markdown' }
      );
      console.log(`🆕 [BOT] Zero user first-time PIN setup (chat ${chatId})`);
    }
  }

  // ── /cancel ────────────────────────────────────────────────────────
  bot.onText(/\/cancel/, (msg) => {
    delete sessions[msg.chat.id];
    bot.sendMessage(msg.chat.id, '❌ Операция отменена.\n\nДля начала используйте /start');
  });

  // ── /status ────────────────────────────────────────────────────────
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? '@' + msg.from.username : null;

    const partner = Object.values(db.partners).find(
      p => p.telegramChatId === String(chatId) ||
           (username && p.telegram && p.telegram.toLowerCase() === username.toLowerCase())
    );

    if (!partner) {
      bot.sendMessage(chatId,
        '❌ Партнёр не найден.\n\nИспользуйте /start для регистрации.'
      );
      return;
    }

    const statusText = {
      invited:         '📩 Заполняет данные',
      pending_payment: '⏳ Ожидает оплаты',
      pending_review:  '🔍 На проверке у администратора',
      active:          '✅ Активен',
      suspended:       '🚫 Приостановлен',
      expired:         '⌛ Истёк'
    };

    const options = { parse_mode: 'Markdown' };

    if (partner.status === 'active') {
      const targetUsername = partner.telegram || username;
      const webToken = generateWebToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      db.webTokens[webToken] = {
        username: targetUsername,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      };
      persistWebTokens();

      const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
      const loginUrl = `${siteUrl}/?wt=${webToken}&username=${encodeURIComponent(targetUsername)}`;

      options.reply_markup = {
        inline_keyboard: [[{ text: '🔑 Войти в кабинет', url: loginUrl }]]
      };
    }

    bot.sendMessage(chatId,
      `📋 *Статус партнёра:*\n\n` +
      `🆔 \`${partner.id}\`\n` +
      `👤 ${partner.firstName || '—'} ${partner.lastName || ''}\n` +
      `💬 ${partner.telegram || '—'}\n` +
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

  // ── Обработка всех текстовых сообщений ───────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text || text.startsWith('/')) return;

    const fromUsername = msg.from.username ? '@' + msg.from.username : null;

    // ── PIN нулевого пользователя — работает БЕЗ сессии ──────────
    // Если сообщение от @VikingOLZH и выглядит как PIN (цифры) — проверяем
    if (fromUsername && fromUsername.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      if (/^\d{4,8}$/.test(text)) {
        if (text === ZERO_USER_PIN) {
          delete sessions[chatId];
          console.log(`✅ [BOT] PIN correct for zero user (chat ${chatId})`);

          const zeroPartner = Object.values(db.partners).find(p =>
            p.telegram && p.telegram.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()
            && p.status === 'active'
          );

          if (zeroPartner) {
            sendLoginLink(chatId, ZERO_USER_TELEGRAM, `✅ *PIN верен!* Нажмите кнопку для входа:`);
          } else {
            // Аккаунта нет — создать администратора
            console.log(`🆕 [BOT] Creating admin account after PIN (chat ${chatId})`);
            const partnerId = generatePartnerId();
            const partner = {
              id: partnerId,
              firstName: msg.from.first_name || 'Олександр',
              lastName: msg.from.last_name || 'Жданенко',
              email: ZERO_USER_EMAIL,
              phone: ZERO_USER_PHONE,
              telegram: ZERO_USER_TELEGRAM,
              walletAddress: '',
              inviteToken: null,
              telegramChatId: String(chatId),
              status: 'active',
              packageType: 'expert',
              apiKey: null,
              role: 'admin',
              requestsLimit: 999999,
              requestsUsed: 0,
              metaresourcesLimit: 999999,
              metaresourcesUsed: 0,
              createdAt: new Date().toISOString(),
              activatedAt: new Date().toISOString(),
              expiresAt: null,
              source: 'zero_registration'
            };
            db.partners[partnerId] = partner;
            persistData();
            sendLoginLink(chatId, ZERO_USER_TELEGRAM, `✅ *Аккаунт создан!* Нажмите кнопку для входа:`);
          }
        } else {
          bot.sendMessage(chatId,
            `❌ *Неверный PIN-код.*\n\nПовторите ввод:`,
            { parse_mode: 'Markdown' }
          );
        }
        return;
      }
    }

    const sess = sessions[chatId];

    // ── Старый session-based PIN (на случай если сессия жива) ─────
    if (sess && (sess.step === 'pin_verification' || sess.step === 'pin_setup')) {
      // Уже обработано выше через sessionless проверку
      delete sessions[chatId];
      return;
    }


    // ── Сбор данных для регистрации партнёра ─────────────────────
    if (!sess) return;

    if (typeof sess.step === 'string' && sess.step !== 'plan') return;

    const field = STEPS[sess.step];
    if (!field) return;

    // Валидация email
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      bot.sendMessage(chatId, '❌ Некорректный email. Введите правильный адрес:');
      return;
    }

    // Пропуск необязательного телефона
    if (text === '.' && field === 'phone') {
      sess.data.phone = '';
    } else {
      sess.data[field] = text;
    }

    sess.step++;

    if (sess.step < STEPS.length) {
      bot.sendMessage(chatId, PROMPTS[STEPS[sess.step]], { parse_mode: 'Markdown' });
    } else {
      sess.step = 'plan';
      bot.sendMessage(chatId,
        '📦 Выберите *пакет партнёра*:',
        { parse_mode: 'Markdown', ...PLAN_KEYBOARD }
      );
    }
  });

  return bot;
}

// ── Завершение регистрации ────────────────────────────────────────────
async function completeRegistration(bot, chatId, sess, db, persistData) {
  const partner = db.partners[sess.partnerId];
  if (!partner) return;

  partner.firstName   = sess.data.firstName?.trim() || partner.firstName;
  partner.lastName    = sess.data.lastName?.trim()  || partner.lastName;
  partner.email       = sess.data.email?.trim().toLowerCase();
  partner.phone       = sess.data.phone || '';
  partner.packageType = sess.data.plan;
  partner.completedAt = new Date().toISOString();
  partner.status      = 'pending_payment';
  persistData();

  bot.sendMessage(chatId,
    `✅ *Данные сохранены!*\n\n` +
    `👤 ${partner.firstName} ${partner.lastName}\n` +
    `📧 ${partner.email}\n` +
    `📱 ${partner.phone || '—'}\n` +
    `📦 ${PLAN_LABELS[partner.packageType]}\n\n` +
    `🆔 *Ваш ID:* \`${partner.id}\`\n\n` +
    `⏳ *Следующий шаг:*\n` +
    `Отправьте оплату в Bitbon и сообщите администратору TX-хэш.\n` +
    `После подтверждения вы получите API-ключ здесь в боте.\n\n` +
    `/status — проверить статус`,
    { parse_mode: 'Markdown' }
  );

  // Уведомить администратора
  if (ADMIN_CHAT_ID) {
    const source = sess.isInvited ? '📩 По приглашению' : '🆕 Самостоятельная регистрация';
    bot.sendMessage(ADMIN_CHAT_ID,
      `🆕 *Новая регистрация партнёра!*\n\n` +
      `👤 ${partner.firstName} ${partner.lastName}\n` +
      `📧 ${partner.email}\n` +
      `📱 ${partner.phone || '—'}\n` +
      `💬 Telegram: ${partner.telegram || '—'}\n` +
      `📦 ${PLAN_LABELS[partner.packageType]}\n` +
      `🆔 \`${partner.id}\`\n` +
      `📌 ${source}\n` +
      `📅 ${new Date().toLocaleString('ru-RU')}`,
      { parse_mode: 'Markdown' }
    );
  }

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
      `Лимит: ${partner.requestsLimit >= 999999 ? '∞ безлимит' : partner.requestsLimit + ' запросов/мес'}\n\n` +
      `Используйте /status для входа в кабинет.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Telegram notify ошибка:', e.message);
  }
}

// ── Deep link для приглашения нового партнёра ─────────────────────────
function getInviteLink(inviteToken) {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}?start=${inviteToken}`;
}

module.exports = { initBot, notifyPartnerActivated, appendToSheets, getInviteLink };
