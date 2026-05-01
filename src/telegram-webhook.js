// ══════════════════════════════════════════════════════════════════════
// Telegram Bot — pure HTTP implementation (no node-telegram-bot-api)
// Works on Vercel serverless via webhook. Zero library dependencies.
// Simplified: notifications only. Registration happens on the website.
// ══════════════════════════════════════════════════════════════════════

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const PLAN_LABELS = {
  starter: '🌱 Стартер — 10 BB/мес (100 запросов)',
  pro:     '📖 Про — 50 BB/мес (500 запросов)',
  expert:  '🚀 Эксперт — 150 BB/мес (безлимит)'
};

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

// ── Webhook setup ─────────────────────────────────────────────────────
async function setWebhook(webhookUrl) {
  if (!BOT_TOKEN) return { ok: false, error: 'No BOT_TOKEN' };
  return tgCall('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message']
  });
}

async function getWebhookInfo() {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API}/getWebhookInfo`);
    return res.json();
  } catch (e) { return null; }
}

// ── Main update handler ───────────────────────────────────────────────
function createHandler(db) {
  const SITE_URL = process.env.SITE_URL || 'https://ai-agent-bitbon-system.vercel.app';

  async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();
    if (!text) return;

    const username = msg.from.username ? '@' + msg.from.username : null;
    console.log(`📨 [BOT] chatId=${chatId} user=${username || '?'} text="${text}"`);

    if (text === '/start' || text.startsWith('/start')) {
      return send(chatId,
        `👋 Привет!\n\n` +
        `Для регистрации и входа в кабинет партнёра — перейдите на сайт:\n` +
        `${SITE_URL}\n\n` +
        `🔐 Войдите с помощью вашего *PIN-кода*.\n\n` +
        `/status — проверить статус вашей заявки`
      );
    }

    if (text === '/status' || text.startsWith('/status')) {
      const partner = Object.values(db.partners).find(
        p => p.telegramChatId === String(chatId) ||
             (username && p.telegram && p.telegram.toLowerCase() === username.toLowerCase())
      );
      if (!partner) {
        return send(chatId,
          `❌ Партнёр не найден.\n\nЗарегистрируйтесь на сайте: ${SITE_URL}`
        );
      }
      const ST = {
        pending:         '🕐 Заявка принята, ожидает активации',
        pending_payment: '⏳ Ожидает подтверждения оплаты',
        pending_review:  '🔍 На проверке у администратора',
        active:          '✅ Активен',
        suspended:       '🚫 Приостановлен'
      };
      return send(chatId,
        `📋 *Статус партнёра:*\n\n` +
        `🆔 \`${partner.id}\`\n` +
        `👤 ${partner.firstName || '—'} ${partner.lastName || ''}\n` +
        `💬 ${partner.telegram || '—'}\n` +
        `📦 ${PLAN_LABELS[partner.packageType] || 'пакет не выбран'}\n\n` +
        `${ST[partner.status] || partner.status}`
      );
    }
  }

  async function handleUpdate(update) {
    if (!update) return;
    try {
      if (update.message) {
        await handleMessage(update.message);
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
  const SITE_URL = process.env.SITE_URL || 'https://ai-agent-bitbon-system.vercel.app';
  await send(telegramChatId,
    `🎉 *Ваш аккаунт активирован!*\n\n` +
    `📦 ${PLAN_LABELS[partner.packageType] || partner.packageType}\n` +
    `🔑 *API ключ:*\n\`${partner.apiKey}\`\n\n` +
    `Лимит: ${partner.requestsLimit >= 999999 ? '∞ безлимит' : partner.requestsLimit + ' запросов/мес'}\n\n` +
    `🔐 Войдите в кабинет на сайте с помощью вашего *PIN-кода*:\n${SITE_URL}`
  ).catch(e => console.error('notifyActivated error:', e.message));
}

// ── Notify admin ──────────────────────────────────────────────────────
async function notifyAdmin(text) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  await send(ADMIN_CHAT_ID, text).catch(e => console.error('notifyAdmin error:', e.message));
}

module.exports = { createHandler, setWebhook, getWebhookInfo, notifyPartnerActivated, notifyAdmin };
