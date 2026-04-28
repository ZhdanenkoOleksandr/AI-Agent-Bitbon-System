// ══════════════════════════════════════════════════════════════════════
// Telegram Bot — pure HTTP implementation (no node-telegram-bot-api)
// Works on Vercel serverless via webhook. Zero library dependencies.
// ══════════════════════════════════════════════════════════════════════

const BOT_TOKEN        = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME     = process.env.TELEGRAM_BOT_USERNAME || 'CandidatesZhdanenko_bot';
const ADMIN_CHAT_ID    = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SHEETS_WEBHOOK   = process.env.GOOGLE_SHEETS_WEBHOOK;
const ZERO_USER_TG     = (process.env.ZERO_USER_TELEGRAM || '@VikingOLZ').toLowerCase();
const ZERO_USER_PIN    = process.env.ZERO_USER_PIN        || '8387';
const ZERO_USER_EMAIL  = process.env.ZERO_USER_EMAIL      || 'Alex.zhdanenko@gmail.com';
const ZERO_USER_PHONE  = process.env.ZERO_USER_PHONE      || '+380969519149';

const PLAN_LABELS = {
  starter: '🌱 Стартер — 10 BB/мес (100 запросов)',
  pro:     '📖 Про — 50 BB/мес (500 запросов)',
  expert:  '🚀 Эксперт — 150 BB/мес (безлимит)'
};

const STEPS = ['firstName', 'lastName', 'email', 'phone', 'pin'];
const PROMPTS = {
  firstName: '👤 Введите ваше *Имя*:',
  lastName:  '👤 Введите *Фамилию*:',
  email:     '📧 Введите *Email*:',
  phone:     '📱 Введите *телефон* (или . чтобы пропустить):',
  pin:       '🔐 Придумайте *PIN-код* для входа в кабинет\n_(от 4 до 8 цифр, запомните его!)_:'
};

const PLAN_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🌱 Стартер — 10 BB/мес',  callback_data: 'plan_starter' }],
    [{ text: '📖 Про — 50 BB/мес',       callback_data: 'plan_pro'    }],
    [{ text: '🚀 Эксперт — 150 BB/мес',  callback_data: 'plan_expert' }]
  ]
};

// In-memory sessions — persists within a warm Vercel container
const sessions = {};

// ── Low-level Telegram API helpers ────────────────────────────────────
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tgCall(method, body) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  } catch (e) {
    console.error(`tgCall ${method} error:`, e.message);
    return null;
  }
}

function send(chatId, text, extra = {}) {
  return tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

function answerCbq(id, text = '') {
  return tgCall('answerCallbackQuery', { callback_query_id: id, text });
}

// ── Webhook setup ─────────────────────────────────────────────────────
async function setWebhook(webhookUrl) {
  if (!BOT_TOKEN) return { ok: false, error: 'No BOT_TOKEN' };
  const res = await tgCall('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query']
  });
  return res;
}

async function getWebhookInfo() {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API}/getWebhookInfo`);
    return res.json();
  } catch (e) { return null; }
}

// ── Main update handler ───────────────────────────────────────────────
function createHandler(db, persistData, generatePartnerId, hashPin) {

  async function handleStart(chatId, from) {
    const username = from.username ? '@' + from.username : null;
    console.log(`📥 [BOT] /start chatId=${chatId} user=${username || 'no_username'}`);

    if (!username) {
      return send(chatId, '❌ Установите @username в настройках Telegram и попробуйте снова.');
    }

    if (username.toLowerCase() === ZERO_USER_TG) {
      return handleZeroUserStart(chatId, username);
    }

    const existing = Object.values(db.partners).find(
      p => p.telegram && p.telegram.toLowerCase() === username.toLowerCase()
    );

    if (existing) {
      if (existing.status === 'active') {
        return send(chatId, '✅ *Вы уже зарегистрированы!*\n\n🔑 Войдите в кабинет на сайте используя ваш *PIN-код*.');
      }
      if (existing.status === 'pending_payment' || existing.status === 'pending_review') {
        return send(chatId, '⏳ *Ваша заявка отправлена и ожидает проверки.*\n\nАдминистратор активирует ваш аккаунт после подтверждения оплаты.\n\n/status — проверить статус');
      }
      existing.telegramChatId = String(chatId);
      persistData();
      sessions[chatId] = { step: 'awaiting_start', partnerId: existing.id, isInvited: true,
        fromUser: { first_name: from.first_name, last_name: from.last_name, username } };
      return send(chatId,
        `👋 *${from.first_name || username}*, продолжаем регистрацию!\n\nНажмите кнопку ниже чтобы начать:`,
        { reply_markup: { inline_keyboard: [[{ text: '🚀 НАЧАТЬ', callback_data: 'action_start_reg' }]] } }
      );
    }

    // New user
    sessions[chatId] = { step: 'awaiting_start', partnerId: null,
      fromUser: { first_name: from.first_name, last_name: from.last_name, username } };
    return send(chatId,
      `👋 Привет, *${from.first_name || username}*!\n\nДобро пожаловать в *Систему Bitbon* 🌐\n\nНажмите кнопку ниже чтобы пройти регистрацию партнёра.\nЭто займёт ~2 минуты.`,
      { reply_markup: { inline_keyboard: [[{ text: '🚀 НАЧАТЬ', callback_data: 'action_start_reg' }]] } }
    );
  }

  async function handleZeroUserStart(chatId, username) {
    const zeroPartner = Object.values(db.partners).find(
      p => p.telegram && p.telegram.toLowerCase() === ZERO_USER_TG && p.status === 'active'
    );
    if (zeroPartner) {
      sessions[chatId] = { step: 'zero_pin', username, attempts: 0 };
      return send(chatId, '🔐 *Введите PIN-код для входа в кабинет:*');
    } else {
      sessions[chatId] = { step: 'zero_pin_setup', username, attempts: 0 };
      return send(chatId, '👑 *Привет, Администратор!*\n\n🔐 Введите PIN-код для активации аккаунта:');
    }
  }

  async function handleStartWithToken(chatId, from, token) {
    const username = from.username ? '@' + from.username : null;
    console.log(`📥 [BOT] /start TOKEN chatId=${chatId} user=${username} token=${token}`);

    if (username && username.toLowerCase() === ZERO_USER_TG) {
      return handleZeroUserStart(chatId, username);
    }

    const partner = Object.values(db.partners).find(p => p.inviteToken === token);
    if (!partner) {
      return send(chatId, '❌ *Ссылка устарела или недействительна.*\n\nПопросите администратора создать новое приглашение.');
    }
    if (partner.status === 'active') {
      return send(chatId, '✅ Вы уже зарегистрированы!\n\n🔑 Войдите на сайте используя ваш *PIN-код*.');
    }
    if (partner.status !== 'invited') {
      return send(chatId, `ℹ️ Статус заявки: *${partner.status}*\n\nИспользуйте /status для подробностей.`);
    }

    partner.telegramChatId = String(chatId);
    if (from.username) partner.telegram = '@' + from.username;
    persistData();

    sessions[chatId] = { token, partnerId: partner.id, step: 0, data: {}, isInvited: true };
    return send(chatId,
      `👋 Привет, *${from.first_name || 'партнёр'}*!\n\nВас приглашают стать партнёром *Системы Bitbon* 🌐\n\nЯ задам несколько вопросов. Отмена: /cancel\n\n${PROMPTS.firstName}`
    );
  }

  async function handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const sess   = sessions[chatId];

    if (query.data === 'action_start_reg') {
      await answerCbq(query.id);
      const fromUser = sess?.fromUser || {
        first_name: query.from.first_name, last_name: query.from.last_name,
        username: query.from.username ? '@' + query.from.username : null
      };
      const username = fromUser.username || (query.from.username ? '@' + query.from.username : null);

      if (!username) {
        delete sessions[chatId];
        return send(chatId, '❌ Установите @username в настройках Telegram и попробуйте снова.');
      }

      let partnerId = sess?.partnerId;
      if (partnerId) {
        const p = db.partners[partnerId];
        if (p) { p.telegramChatId = String(chatId); persistData(); }
      } else {
        partnerId = generatePartnerId();
        db.partners[partnerId] = {
          id: partnerId, firstName: fromUser.first_name || '', lastName: fromUser.last_name || '',
          email: '', phone: '', telegram: username, walletAddress: '', inviteToken: null,
          telegramChatId: String(chatId), status: 'invited', packageType: null,
          apiKey: null, pinHash: null, role: 'partner',
          requestsLimit: 0, requestsUsed: 0, metaresourcesLimit: 0, metaresourcesUsed: 0,
          createdAt: new Date().toISOString(), activatedAt: null, expiresAt: null,
          source: 'self_registration'
        };
        persistData();
        console.log(`✅ [BOT] partner created chatId=${chatId} partnerId=${partnerId}`);
      }

      sessions[chatId] = { partnerId, step: 0, data: {}, isInvited: !!sess?.isInvited };
      return send(chatId, PROMPTS.firstName);
    }

    if (query.data.startsWith('plan_')) {
      if (!sess || sess.step !== 'plan') return;
      sess.data.plan = query.data.replace('plan_', '');
      await answerCbq(query.id);
      await completeRegistration(chatId, sess);
      delete sessions[chatId];
    }
  }

  async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();
    if (!text) return;

    // Commands
    if (text === '/cancel' || text.startsWith('/cancel')) {
      delete sessions[chatId];
      return send(chatId, '❌ Отменено. Используйте /start для нового старта.');
    }
    if (text === '/status' || text.startsWith('/status')) {
      const username = msg.from.username ? '@' + msg.from.username : null;
      const partner = Object.values(db.partners).find(
        p => p.telegramChatId === String(chatId) ||
             (username && p.telegram && p.telegram.toLowerCase() === username.toLowerCase())
      );
      if (!partner) return send(chatId, '❌ Партнёр не найден.\n\nИспользуйте /start для регистрации.');
      const ST = { invited:'📩 Заполняет данные', pending_payment:'⏳ Ожидает оплаты',
        pending_review:'🔍 На проверке', active:'✅ Активен', suspended:'🚫 Приостановлен' };
      return send(chatId,
        `📋 *Статус партнёра:*\n\n🆔 \`${partner.id}\`\n👤 ${partner.firstName||'—'} ${partner.lastName||''}\n` +
        `💬 ${partner.telegram||'—'}\n📦 ${partner.packageType ? PLAN_LABELS[partner.packageType] : 'не выбран'}\n` +
        `${ST[partner.status]||partner.status}\n🔐 ${partner.pinHash ? '✅ PIN установлен' : '❌ PIN не установлен'}`
      );
    }
    if (text.startsWith('/start ')) {
      return handleStartWithToken(chatId, msg.from, text.slice(7).trim());
    }
    if (text === '/start' || text.startsWith('/start@')) {
      return handleStart(chatId, msg.from);
    }
    if (text.startsWith('/')) return; // unknown command, ignore

    const fromUsername = msg.from.username ? '@' + msg.from.username : null;
    console.log(`📨 [BOT] msg chatId=${chatId} user=${fromUsername||'?'} text="${text}"`);

    // Zero user PIN handling (no session needed)
    if (fromUsername && fromUsername.toLowerCase() === ZERO_USER_TG) {
      if (/^\d{4,8}$/.test(text)) {
        if (text === ZERO_USER_PIN) {
          delete sessions[chatId];
          const zeroPartner = Object.values(db.partners).find(
            p => p.telegram && p.telegram.toLowerCase() === ZERO_USER_TG && p.status === 'active'
          );
          if (zeroPartner) {
            return send(chatId, '✅ *PIN верен!*\n\n🔑 Войдите в кабинет на сайте используя ваш PIN-код.');
          } else {
            const partnerId = generatePartnerId();
            db.partners[partnerId] = {
              id: partnerId, firstName: msg.from.first_name||'Олександр', lastName: msg.from.last_name||'Жданенко',
              email: ZERO_USER_EMAIL, phone: ZERO_USER_PHONE, telegram: fromUsername, walletAddress: '',
              inviteToken: null, telegramChatId: String(chatId), status: 'active', packageType: 'expert',
              apiKey: null, pinHash: null, role: 'admin',
              requestsLimit: 999999, requestsUsed: 0, metaresourcesLimit: 999999, metaresourcesUsed: 0,
              createdAt: new Date().toISOString(), activatedAt: new Date().toISOString(),
              expiresAt: null, source: 'zero_registration'
            };
            persistData();
            return send(chatId, `✅ *Аккаунт администратора создан!*\n\n🔑 Войдите в кабинет на сайте используя ваш PIN-код *${ZERO_USER_PIN}*.`);
          }
        } else {
          return send(chatId, '❌ *Неверный PIN-код.* Повторите ввод:');
        }
      }
    }

    const sess = sessions[chatId];

    if (!sess) {
      return handleStart(chatId, msg.from);
    }
    if (sess.step === 'zero_pin' || sess.step === 'zero_pin_setup') {
      delete sessions[chatId]; return;
    }
    if (sess.step === 'awaiting_start') {
      return send(chatId, '⬆️ Нажмите кнопку *НАЧАТЬ* выше, чтобы начать регистрацию.');
    }
    if (sess.step === 'plan') return;

    const field = STEPS[sess.step];
    if (!field) return;

    // Validation
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return send(chatId, '❌ Некорректный email. Введите правильный адрес:');
    }
    if (field === 'pin' && !/^\d{4,8}$/.test(text)) {
      return send(chatId, '❌ PIN должен содержать *только цифры* (от 4 до 8).\n\nПовторите:');
    }

    sess.data[field] = (text === '.' && field === 'phone') ? '' : text;
    sess.step++;

    if (sess.step < STEPS.length) {
      return send(chatId, PROMPTS[STEPS[sess.step]]);
    } else {
      sess.step = 'plan';
      return send(chatId, '📦 Отлично! Выберите *пакет партнёра*:', { reply_markup: PLAN_KEYBOARD });
    }
  }

  async function completeRegistration(chatId, sess) {
    const partner = db.partners[sess.partnerId];
    if (!partner) return;

    partner.firstName   = sess.data.firstName?.trim() || partner.firstName;
    partner.lastName    = sess.data.lastName?.trim()  || partner.lastName;
    partner.email       = sess.data.email?.trim().toLowerCase();
    partner.phone       = sess.data.phone || '';
    partner.packageType = sess.data.plan;
    partner.completedAt = new Date().toISOString();
    partner.status      = 'pending_payment';
    if (sess.data.pin && hashPin) {
      partner.pinHash = hashPin(sess.data.pin);
    }
    persistData();

    await send(chatId,
      `✅ *Регистрация завершена!*\n\n` +
      `👤 ${partner.firstName} ${partner.lastName}\n📧 ${partner.email}\n📱 ${partner.phone||'—'}\n` +
      `📦 ${PLAN_LABELS[partner.packageType]}\n🔐 PIN-код установлен ✓\n\n🆔 *Ваш ID:* \`${partner.id}\`\n\n` +
      `⏳ *Следующий шаг:*\nОтправьте оплату в Bitbon и сообщите администратору TX-хэш.\n` +
      `После активации вы сможете войти в кабинет на сайте с помощью вашего PIN-кода.\n\n/status — проверить статус`
    );

    if (ADMIN_CHAT_ID) {
      const src = sess.isInvited ? '📩 По приглашению' : '🆕 Самостоятельная';
      await send(ADMIN_CHAT_ID,
        `🆕 *Новая регистрация!*\n\n👤 ${partner.firstName} ${partner.lastName}\n📧 ${partner.email}\n` +
        `📱 ${partner.phone||'—'}\n💬 ${partner.telegram||'—'}\n📦 ${PLAN_LABELS[partner.packageType]}\n` +
        `🔐 PIN: ${partner.pinHash ? 'да' : 'нет'}\n🆔 \`${partner.id}\`\n📌 ${src}\n📅 ${new Date().toLocaleString('ru-RU')}`
      );
    }

    if (SHEETS_WEBHOOK) {
      fetch(SHEETS_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: new Date().toLocaleString('ru-RU'), partnerId: partner.id,
          firstName: partner.firstName, lastName: partner.lastName, email: partner.email,
          phone: partner.phone, telegram: partner.telegram, plan: partner.packageType, status: partner.status })
      }).catch(e => console.error('Sheets error:', e.message));
    }
  }

  // Main dispatcher
  async function handleUpdate(update) {
    if (!update) return;
    try {
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    } catch (e) {
      console.error('[BOT] handleUpdate error:', e.message);
    }
  }

  return handleUpdate;
}

// ── Notify partner activation ─────────────────────────────────────────
async function notifyPartnerActivated(telegramChatId, partner) {
  if (!BOT_TOKEN || !telegramChatId) return;
  await send(telegramChatId,
    `🎉 *Ваш аккаунт активирован!*\n\n` +
    `📦 ${PLAN_LABELS[partner.packageType] || partner.packageType}\n` +
    `🔑 *API ключ:*\n\`${partner.apiKey}\`\n\n` +
    `Лимит: ${partner.requestsLimit >= 999999 ? '∞ безлимит' : partner.requestsLimit + ' запросов/мес'}\n\n` +
    `🔐 Войдите в кабинет на сайте используя ваш *PIN-код*.`
  ).catch(e => console.error('notifyActivated error:', e.message));
}

module.exports = { createHandler, setWebhook, getWebhookInfo, notifyPartnerActivated };
