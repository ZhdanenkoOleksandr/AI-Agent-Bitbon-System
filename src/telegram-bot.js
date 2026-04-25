// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner — Telegram Registration Bot
//
// FLOW:
// A. Новый партнёр (self-reg или invite):
//    /start [TOKEN] → Имя → Фамилия → Email → Телефон → PIN → Пакет
//    → status: pending_payment → admin активирует
//    → партнёр логинится на сайте через свой PIN
//
// B. Нулевой партнёр (@VikingOLZH):
//    /start → PIN из env → кабинет
//
// C. Активный партнёр:
//    /start → "Войдите на сайте с помощью вашего PIN"
// ══════════════════════════════════════════════════════════════════════

const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME     = process.env.TELEGRAM_BOT_USERNAME;
const ADMIN_CHAT_ID    = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SHEETS_WEBHOOK   = process.env.GOOGLE_SHEETS_WEBHOOK;

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

// Шаги регистрации: имя → фамилия → email → телефон → PIN
const STEPS = ['firstName', 'lastName', 'email', 'phone', 'pin'];
const PROMPTS = {
  firstName: '👤 Введите ваше *Имя*:',
  lastName:  '👤 Введите *Фамилию*:',
  email:     '📧 Введите *Email*:',
  phone:     '📱 Введите *телефон* (или . чтобы пропустить):',
  pin:       '🔐 Придумайте *PIN-код* для входа в кабинет\n_(от 4 до 8 цифр, запомните его!)_:'
};

// Сессии: chatId → { step, partnerId, data, ... }
const sessions = {};

let botInstance = null;

// ── INIT ──────────────────────────────────────────────────────────────
function initBot(db, persistData, generatePartnerId, generateWebToken, persistWebTokens, hashPin) {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN не задан — Telegram бот отключён');
    return null;
  }

  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  botInstance = bot;
  console.log('🤖 Telegram бот запущен');

  // ── /start с invite-токеном (deep link из кабинета) ───────────────
  bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId  = msg.chat.id;
    const token   = match[1];
    const username = msg.from.username ? '@' + msg.from.username : null;

    // Нулевой пользователь — игнорируем токен, используем PIN flow
    if (username && username.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      handleZeroUserStart(chatId, msg);
      return;
    }

    const partner = Object.values(db.partners).find(p => p.inviteToken === token);

    if (!partner) {
      bot.sendMessage(chatId,
        `❌ *Ссылка устарела или недействительна.*\n\nПопросите администратора создать новое приглашение.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (partner.status !== 'invited') {
      if (partner.status === 'active') {
        bot.sendMessage(chatId,
          `✅ Вы уже зарегистрированы!\n\n🔑 Войдите на сайте используя ваш *PIN-код*.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId,
          `ℹ️ Статус заявки: *${partner.status}*\n\nИспользуйте /status для подробностей.`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // Сохранить chatId
    partner.telegramChatId = String(chatId);
    if (msg.from.username) partner.telegram = '@' + msg.from.username;
    persistData();

    sessions[chatId] = { token, partnerId: partner.id, step: 0, data: {}, isInvited: true };

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || 'партнёр'}*!\n\n` +
      `Вас приглашают стать партнёром *Системы Bitbon* 🌐\n\n` +
      `Я задам несколько вопросов. Отмена: /cancel\n\n` +
      PROMPTS.firstName,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /start без токена ─────────────────────────────────────────────
  bot.onText(/\/start$/, (msg) => {
    handleStart(msg.chat.id, msg);
  });

  function handleStart(chatId, msg) {
    const username = msg.from.username ? '@' + msg.from.username : null;

    if (!username) {
      bot.sendMessage(chatId,
        `❌ Установите @username в настройках Telegram и попробуйте снова.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Нулевой пользователь
    if (username.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      handleZeroUserStart(chatId, msg);
      return;
    }

    // Поиск существующего партнёра
    const existing = Object.values(db.partners).find(
      p => p.telegram && p.telegram.toLowerCase() === username.toLowerCase()
    );

    if (existing) {
      if (existing.status === 'active') {
        bot.sendMessage(chatId,
          `✅ *Вы зарегистрированы!*\n\n` +
          `🔑 Войдите в кабинет на сайте используя ваш *PIN-код*.\n\n` +
          `Забыли PIN? Напишите администратору для сброса.`,
          { parse_mode: 'Markdown' }
        );
      } else if (existing.status === 'pending_payment') {
        bot.sendMessage(chatId,
          `⏳ *Ваша заявка ожидает оплаты.*\n\n` +
          `Отправьте оплату в Bitbon и сообщите администратору TX-хэш.\n` +
          `После подтверждения вы получите уведомление.\n\n` +
          `/status — проверить статус`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId,
          `ℹ️ Статус: *${existing.status}*\n\n/status — подробнее`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // Новый пользователь — начать самостоятельную регистрацию
    console.log(`🆕 [BOT] Self-registration: ${username}`);

    const partnerId = generatePartnerId();
    const newPartner = {
      id: partnerId,
      firstName: msg.from.first_name || '',
      lastName: msg.from.last_name || '',
      email: '', phone: '', telegram: username,
      walletAddress: '', inviteToken: null,
      telegramChatId: String(chatId),
      status: 'invited', packageType: null,
      apiKey: null, pinHash: null,
      role: 'partner',
      requestsLimit: 0, requestsUsed: 0,
      metaresourcesLimit: 0, metaresourcesUsed: 0,
      createdAt: new Date().toISOString(),
      activatedAt: null, expiresAt: null,
      source: 'self_registration'
    };

    db.partners[partnerId] = newPartner;
    persistData();
    sessions[chatId] = { partnerId, step: 0, data: {} };

    bot.sendMessage(chatId,
      `👋 Привет, *${msg.from.first_name || username}*!\n\n` +
      `Добро пожаловать в *Систему Bitbon* 🌐\n\n` +
      `Для регистрации ответьте на несколько вопросов.\n` +
      `Отмена: /cancel`,
      { parse_mode: 'Markdown' }
    );
    bot.sendMessage(chatId, PROMPTS.firstName, { parse_mode: 'Markdown' });
  }

  // ── Нулевой пользователь ─────────────────────────────────────────
  function handleZeroUserStart(chatId, msg) {
    const username = msg.from.username ? '@' + msg.from.username : ZERO_USER_TELEGRAM;
    const zeroPartner = Object.values(db.partners).find(
      p => p.telegram && p.telegram.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()
        && p.status === 'active'
    );

    if (zeroPartner) {
      sessions[chatId] = { step: 'zero_pin', username, attempts: 0 };
      bot.sendMessage(chatId, `🔐 *Введите PIN-код для входа в кабинет:*`, { parse_mode: 'Markdown' });
    } else {
      sessions[chatId] = { step: 'zero_pin_setup', username, attempts: 0 };
      bot.sendMessage(chatId,
        `👑 *Привет, Администратор!*\n\n🔐 Введите PIN-код для активации аккаунта:`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  // ── /cancel ────────────────────────────────────────────────────────
  bot.onText(/\/cancel/, (msg) => {
    delete sessions[msg.chat.id];
    bot.sendMessage(msg.chat.id, '❌ Отменено. Используйте /start для нового старта.');
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
      bot.sendMessage(chatId, '❌ Партнёр не найден.\n\nИспользуйте /start для регистрации.');
      return;
    }

    const statusText = {
      invited:         '📩 Заполняет данные',
      pending_payment: '⏳ Ожидает оплаты',
      pending_review:  '🔍 На проверке',
      active:          '✅ Активен',
      suspended:       '🚫 Приостановлен',
      expired:         '⌛ Истёк'
    };

    const pinStatus = partner.pinHash ? '✅ PIN установлен' : '❌ PIN не установлен';

    bot.sendMessage(chatId,
      `📋 *Статус партнёра:*\n\n` +
      `🆔 \`${partner.id}\`\n` +
      `👤 ${partner.firstName || '—'} ${partner.lastName || ''}\n` +
      `💬 ${partner.telegram || '—'}\n` +
      `📦 ${partner.packageType ? PLAN_LABELS[partner.packageType] : 'пакет не выбран'}\n` +
      `${statusText[partner.status] || partner.status}\n` +
      `🔐 ${pinStatus}`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Выбор пакета (callback) ────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const sess = sessions[chatId];
    if (!sess || sess.step !== 'plan') return;

    sess.data.plan = query.data.replace('plan_', '');
    bot.answerCallbackQuery(query.id);

    await completeRegistration(bot, chatId, sess, db, persistData, hashPin);
    delete sessions[chatId];
  });

  // ── Все текстовые сообщения ────────────────────────────────────────
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    if (!text || text.startsWith('/')) return;

    const fromUsername = msg.from.username ? '@' + msg.from.username : null;

    // ── PIN нулевого пользователя (без сессии, sessionless) ──────────
    if (fromUsername && fromUsername.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()) {
      if (/^\d{4,8}$/.test(text)) {
        if (text === ZERO_USER_PIN) {
          delete sessions[chatId];

          const zeroPartner = Object.values(db.partners).find(p =>
            p.telegram && p.telegram.toLowerCase() === ZERO_USER_TELEGRAM.toLowerCase()
            && p.status === 'active'
          );

          if (zeroPartner) {
            bot.sendMessage(chatId,
              `✅ *PIN верен!*\n\n🔑 Войдите в кабинет на сайте используя ваш PIN-код.`,
              { parse_mode: 'Markdown' }
            );
          } else {
            // Первый вход — создать аккаунт
            const partnerId = generatePartnerId();
            const adminPartner = {
              id: partnerId,
              firstName: msg.from.first_name || 'Олександр',
              lastName: msg.from.last_name || 'Жданенко',
              email: ZERO_USER_EMAIL, phone: ZERO_USER_PHONE,
              telegram: ZERO_USER_TELEGRAM, walletAddress: '',
              inviteToken: null, telegramChatId: String(chatId),
              status: 'active', packageType: 'expert',
              apiKey: null, pinHash: null, // zero user использует env PIN
              role: 'admin',
              requestsLimit: 999999, requestsUsed: 0,
              metaresourcesLimit: 999999, metaresourcesUsed: 0,
              createdAt: new Date().toISOString(),
              activatedAt: new Date().toISOString(),
              expiresAt: null, source: 'zero_registration'
            };
            db.partners[partnerId] = adminPartner;
            persistData();
            bot.sendMessage(chatId,
              `✅ *Аккаунт администратора создан!*\n\n` +
              `🔑 Войдите в кабинет на сайте используя ваш PIN-код *${ZERO_USER_PIN}*.`,
              { parse_mode: 'Markdown' }
            );
          }
        } else {
          bot.sendMessage(chatId, `❌ *Неверный PIN-код.* Повторите ввод:`, { parse_mode: 'Markdown' });
        }
        return;
      }
    }

    const sess = sessions[chatId];

    // Очистка устаревших PIN-сессий (теперь обрабатываются выше)
    if (sess && (sess.step === 'zero_pin' || sess.step === 'zero_pin_setup')) {
      delete sessions[chatId];
      return;
    }

    // Нет сессии — игнорируем
    if (!sess) return;

    // Ожидание inline keyboard
    if (sess.step === 'plan') return;

    const field = STEPS[sess.step];
    if (!field) return;

    // ── Валидация полей ───────────────────────────────────────────
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      bot.sendMessage(chatId, '❌ Некорректный email. Введите правильный адрес:');
      return;
    }

    if (field === 'pin') {
      if (!/^\d{4,8}$/.test(text)) {
        bot.sendMessage(chatId,
          '❌ PIN должен содержать *только цифры* (от 4 до 8).\n\nПовторите:',
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Сохранить значение поля
    if (text === '.' && field === 'phone') {
      sess.data.phone = '';
    } else {
      sess.data[field] = text;
    }

    sess.step++;

    if (sess.step < STEPS.length) {
      bot.sendMessage(chatId, PROMPTS[STEPS[sess.step]], { parse_mode: 'Markdown' });
    } else {
      // Все поля заполнены — выбор пакета
      sess.step = 'plan';
      bot.sendMessage(chatId,
        '📦 Отлично! Выберите *пакет партнёра*:',
        { parse_mode: 'Markdown', ...PLAN_KEYBOARD }
      );
    }
  });

  return bot;
}

// ── Завершение регистрации ────────────────────────────────────────────
async function completeRegistration(bot, chatId, sess, db, persistData, hashPin) {
  const partner = db.partners[sess.partnerId];
  if (!partner) return;

  partner.firstName   = sess.data.firstName?.trim() || partner.firstName;
  partner.lastName    = sess.data.lastName?.trim()  || partner.lastName;
  partner.email       = sess.data.email?.trim().toLowerCase();
  partner.phone       = sess.data.phone || '';
  partner.packageType = sess.data.plan;
  partner.completedAt = new Date().toISOString();
  partner.status      = 'pending_payment';

  // Сохранить PIN хэш
  if (sess.data.pin && hashPin) {
    partner.pinHash = hashPin(sess.data.pin);
    console.log(`🔐 [BOT] PIN hash saved for partner ${partner.id}`);
  }

  persistData();

  bot.sendMessage(chatId,
    `✅ *Регистрация завершена!*\n\n` +
    `👤 ${partner.firstName} ${partner.lastName}\n` +
    `📧 ${partner.email}\n` +
    `📱 ${partner.phone || '—'}\n` +
    `📦 ${PLAN_LABELS[partner.packageType]}\n` +
    `🔐 PIN-код установлен ✓\n\n` +
    `🆔 *Ваш ID:* \`${partner.id}\`\n\n` +
    `⏳ *Следующий шаг:*\n` +
    `Отправьте оплату в Bitbon и сообщите администратору TX-хэш.\n` +
    `После активации вы сможете войти в кабинет на сайте с помощью вашего PIN-кода.\n\n` +
    `/status — проверить статус`,
    { parse_mode: 'Markdown' }
  );

  if (ADMIN_CHAT_ID) {
    const source = sess.isInvited ? '📩 По приглашению' : '🆕 Самостоятельная';
    bot.sendMessage(ADMIN_CHAT_ID,
      `🆕 *Новая регистрация!*\n\n` +
      `👤 ${partner.firstName} ${partner.lastName}\n` +
      `📧 ${partner.email}\n` +
      `📱 ${partner.phone || '—'}\n` +
      `💬 ${partner.telegram || '—'}\n` +
      `📦 ${PLAN_LABELS[partner.packageType]}\n` +
      `🔐 PIN установлен: ${partner.pinHash ? 'да' : 'нет'}\n` +
      `🆔 \`${partner.id}\`\n` +
      `📌 ${source}\n` +
      `📅 ${new Date().toLocaleString('ru-RU')}`,
      { parse_mode: 'Markdown' }
    );
  }

  await appendToSheets(partner);
}

// ── Google Sheets ─────────────────────────────────────────────────────
async function appendToSheets(partner) {
  if (!SHEETS_WEBHOOK) return;
  try {
    await fetch(SHEETS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toLocaleString('ru-RU'),
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
  } catch (e) {
    console.error('📊 Sheets ошибка:', e.message);
  }
}

// ── Уведомление об активации ─────────────────────────────────────────
async function notifyPartnerActivated(telegramChatId, partner) {
  if (!botInstance || !telegramChatId) return;
  try {
    await botInstance.sendMessage(telegramChatId,
      `🎉 *Ваш аккаунт активирован!*\n\n` +
      `📦 ${PLAN_LABELS[partner.packageType] || partner.packageType}\n` +
      `🔑 *API ключ:*\n\`${partner.apiKey}\`\n\n` +
      `Лимит: ${partner.requestsLimit >= 999999 ? '∞ безлимит' : partner.requestsLimit + ' запросов/мес'}\n\n` +
      `🔐 Войдите в кабинет на сайте используя ваш *PIN-код*.`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('Telegram notify ошибка:', e.message);
  }
}

function getInviteLink(inviteToken) {
  if (!BOT_USERNAME) return null;
  return `https://t.me/${BOT_USERNAME}?start=${inviteToken}`;
}

module.exports = { initBot, notifyPartnerActivated, appendToSheets, getInviteLink };
