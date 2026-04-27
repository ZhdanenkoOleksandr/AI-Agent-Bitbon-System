// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner System — Server v2.0
// Express backend: auth, admin, partner API, metaresource knowledge base
// ══════════════════════════════════════════════════════════════════════

const path = require('path');
// AI-Agent-Bitbon-System/.env — основной конфиг (приоритет)
require('dotenv').config({ path: path.join(__dirname, 'AI-Agent-Bitbon-System', '.env') });
// Корневой .env — для значений которых нет в AI-Agent-Bitbon-System/.env
require('dotenv').config({ override: false });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { initBot, notifyPartnerActivated } = require('./src/telegram-bot');

// Anthropic API — поддержка обоих имён переменной
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

// Debug: Log API key status
console.log('🔑 API Configuration:');
console.log('   ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY ? '✓ Configured' : '❌ NOT SET');
console.log('   Environment:', process.env.NODE_ENV || 'development');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_SECRET not set in .env — refusing to start in production without it');
    process.exit(1);
  }
  console.warn('⚠️  JWT_SECRET not set — using dev-only fallback (NOT safe in production)');
  return 'bitbon-secret-dev-ONLY-not-for-production';
})();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => {
  console.warn('⚠️  ADMIN_PASSWORD not set in .env — using weak default');
  return 'admin2026';
})();

// ── MIDDLEWARE ────────────────────────────────────────────────────────
// CSP: frontend uses inline scripts, styles and event handlers extensively
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      // Required for onclick/onkeydown/onfocus/etc. attributes throughout the frontend
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com", "https:"],
      imgSrc:        ["'self'", "data:", "https:"],
      connectSrc:    ["'self'", "https:"],
      objectSrc:     ["'none'"],
      baseUri:       ["'self'"],
    }
  }
}));

// CORS: restrict to configured origin only
const ALLOWED_ORIGIN = (process.env.SITE_URL || process.env.ALLOWED_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Global rate limiting (100 req / 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/', apiLimiter);

// Strict PIN auth rate limit — brute-force protection (5 attempts / 15 min per IP)
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── IN-MEMORY DATABASE ───────────────────────────────────────────────
// In production, replace with PostgreSQL/MongoDB
const DB = {
  partners: {},       // partnerId -> partner object
  apiKeys: {},        // apiKey hash -> key record
  payments: [],       // payment records
  requestsLog: [],    // API usage log
  metaresources: [],  // Created metaresources (knowledge base learning)
  sessions: {},       // admin sessions
  guestTokens: {},    // token -> { partnerId, quota, used, createdAt }
  webTokens: {}       // web_token -> { username, createdAt, expiresAt }
};

// ── DATA FILES ───────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(filename) {
  try {
    const filepath = path.join(DATA_DIR, filename);
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error loading ${filename}:`, e.message);
  }
  return null;
}

function saveJSON(filename, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error saving ${filename}:`, e.message);
  }
}

// Load initial knowledge base
let knowledgeBase = loadJSON('knowledge_base_v2.0.json') || { categories: {}, meta: {} };
let knowledgeBaseV3 = loadJSON('knowledge_base_v3.0.json') || { segments: {}, routing: { rules: [] } };
let metaresourceTemplates = loadJSON('metaresource_templates.json') || { templates: {} };

// Load created metaresources from disk (persistence)
let createdMetaresources = loadJSON('created_metaresources.json') || [];
DB.metaresources = createdMetaresources;

// Load partners from disk
let savedPartners = loadJSON('partners_db.json') || {};
// Ensure zero user always has role: 'admin'
const ZERO_TG_LOWER = (process.env.ZERO_USER_TELEGRAM || '@VikingOLZH').toLowerCase();
Object.values(savedPartners).forEach(p => {
  if (p.telegram && p.telegram.toLowerCase() === ZERO_TG_LOWER) {
    p.role = 'admin';
  }
});
DB.partners = savedPartners;

// Load payments
let savedPayments = loadJSON('payments_db.json') || [];
DB.payments = savedPayments;

// Load guest tokens
let savedGuests = loadJSON('guests_db.json') || {};
DB.guestTokens = savedGuests;

// Load web tokens (for first login via Telegram)
let savedWebTokens = loadJSON('web_tokens_db.json') || {};
DB.webTokens = savedWebTokens;

// ── HELPERS ──────────────────────────────────────────────────────────
function hashApiKey(key) {
  return bcrypt.hashSync(key, 8);
}

function verifyApiKey(key, hash) {
  return bcrypt.compareSync(key, hash);
}

function generateApiKey() {
  return 'pk_' + uuidv4().replace(/-/g, '').substring(0, 32);
}

function generatePartnerId() {
  return 'prt_' + uuidv4().replace(/-/g, '').substring(0, 16);
}

function generateWebToken() {
  return uuidv4().replace(/-/g, '').substring(0, 24);
}

function getPackageLimits(packageType) {
  const packages = {
    starter:  { name: 'Стартер',       requests: 100,      metaresources: 3,   price_bb: 10,   validity_days: 30 },
    pro:      { name: 'Профессионал',  requests: 500,      metaresources: 15,  price_bb: 50,   validity_days: 30 },
    expert:   { name: 'Эксперт',       requests: Infinity,  metaresources: Infinity, price_bb: 150,  validity_days: 30 }
  };
  return packages[packageType] || packages.starter;
}

function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authenticatePartner(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'partner') throw new Error('Not partner');
    req.partner = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function persistGuests() {
  saveJSON('guests_db.json', DB.guestTokens);
}

function persistWebTokens() {
  saveJSON('web_tokens_db.json', DB.webTokens);
}

function persistData() {
  saveJSON('created_metaresources.json', DB.metaresources);
  saveJSON('partners_db.json', DB.partners);
  saveJSON('payments_db.json', DB.payments);
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// Admin Login (for admin panel)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token });
});

// Admin Cabinet Login (для входа админа в основной кабинет)
app.post('/api/admin/cabinet-login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  // Создаём временного админ-партнёра в системе
  const adminPartner = {
    id: 'adm_' + Date.now(),
    firstName: 'Administrator',
    lastName: 'Cabinet',
    email: 'admin@bitbon.system',
    telegram: '@admin',
    phone: '',
    walletAddress: '',
    status: 'active',
    packageType: 'expert',
    apiKey: null,
    requestsLimit: Infinity,
    requestsUsed: 0,
    metaresourcesLimit: Infinity,
    metaresourcesUsed: 0,
    createdAt: new Date().toISOString(),
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    role: 'admin'
  };

  const token = jwt.sign(
    { role: 'partner', partnerId: adminPartner.id, name: 'Administrator Cabinet' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    jwt: token,
    user: {
      id: adminPartner.id,
      fullName: 'Administrator Cabinet',
      email: adminPartner.email,
      telegram: adminPartner.telegram,
      status: 'active',
      packageType: 'expert',
      requestsUsed: 0,
      requestsLimit: '∞',
      metaresourcesUsed: 0,
      metaresourcesLimit: '∞',
      expiresAt: adminPartner.expiresAt,
      role: 'admin'
    }
  });
});

// Admin: List all partners
app.get('/api/admin/partners', authenticateAdmin, (req, res) => {
  const partners = Object.values(DB.partners).map(p => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`,
    email: p.email,
    telegram: p.telegram,
    phone: p.phone,
    status: p.status,
    packageType: p.packageType,
    requestsUsed: p.requestsUsed || 0,
    requestsLimit: p.requestsLimit || 0,
    metaresourcesUsed: p.metaresourcesUsed || 0,
    metaresourcesLimit: p.metaresourcesLimit || 0,
    createdAt: p.createdAt,
    activatedAt: p.activatedAt,
    expiresAt: p.expiresAt
  }));
  res.json({ partners });
});

// Admin: List pending payments
app.get('/api/admin/payments', authenticateAdmin, (req, res) => {
  res.json({ payments: DB.payments });
});

// Admin: Activate partner API key (after payment confirmed)
app.post('/api/admin/activate', authenticateAdmin, (req, res) => {
  const { partnerId, packageType } = req.body;
  const partner = DB.partners[partnerId];
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const pkg = getPackageLimits(packageType || 'starter');
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);

  // Update partner
  partner.status = 'active';
  partner.packageType = packageType || 'starter';
  partner.apiKey = keyHash; // store hash only
  partner.requestsLimit = pkg.requests;
  partner.requestsUsed = 0;
  partner.metaresourcesLimit = pkg.metaresources;
  partner.metaresourcesUsed = 0;
  partner.activatedAt = new Date().toISOString();
  partner.expiresAt = new Date(Date.now() + pkg.validity_days * 86400000).toISOString();

  // Store API key record
  DB.apiKeys[keyHash] = {
    hash: keyHash,
    partnerId: partner.id,
    status: 'active',
    limit: pkg.requests,
    used: 0,
    createdAt: new Date().toISOString(),
    expiresAt: partner.expiresAt
  };

  persistData();

  res.json({
    success: true,
    partnerId: partner.id,
    partnerName: `${partner.firstName} ${partner.lastName}`,
    apiKey, // Return plain key ONCE — partner must save it
    package: pkg.name,
    requestsLimit: pkg.requests === Infinity ? 'Безлимит' : pkg.requests,
    expiresAt: partner.expiresAt,
    message: `API ключ активирован для ${partner.firstName} ${partner.lastName}. Пакет: ${pkg.name}`
  });
});

// Admin: View all created metaresources
app.get('/api/admin/metaresources', authenticateAdmin, (req, res) => {
  res.json({ metaresources: DB.metaresources });
});

// Admin: Dashboard stats
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
  const partners = Object.values(DB.partners);
  res.json({
    totalPartners: partners.length,
    activePartners: partners.filter(p => p.status === 'active').length,
    pendingPartners: partners.filter(p => p.status === 'pending_payment').length,
    totalPayments: DB.payments.length,
    totalMetaresources: DB.metaresources.length,
    totalRequests: DB.requestsLog.length
  });
});

// Admin: Deactivate partner
app.post('/api/admin/deactivate', authenticateAdmin, (req, res) => {
  const { partnerId } = req.body;
  const partner = DB.partners[partnerId];
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  partner.status = 'suspended';
  persistData();
  res.json({ success: true, message: `Partner ${partner.firstName} ${partner.lastName} suspended` });
});


// ══════════════════════════════════════════════════════════════════════
// PARTNER REGISTRATION & AUTH
// ══════════════════════════════════════════════════════════════════════

// Register new partner (invite flow — sends Telegram deep link)
app.post('/api/partner/register', authenticatePartner, (req, res) => {
  const { telegram } = req.body;

  if (!telegram) {
    return res.status(400).json({ error: 'Укажите Telegram партнёра' });
  }

  // Генерация уникального токена для deep link
  const inviteToken = uuidv4().replace(/-/g, '').substring(0, 20);
  const partnerId   = generatePartnerId();

  const partner = {
    id:                 partnerId,
    firstName:          '',
    lastName:           '',
    email:              '',
    telegram:           telegram.trim().startsWith('@') ? telegram.trim() : '@' + telegram.trim(),
    phone:              '',
    walletAddress:      '',
    inviteToken,
    telegramChatId:     null,
    status:             'invited',
    packageType:        null,
    apiKey:             null,
    requestsLimit:      0,
    requestsUsed:       0,
    metaresourcesLimit: 0,
    metaresourcesUsed:  0,
    createdAt:          new Date().toISOString(),
    activatedAt:        null,
    expiresAt:          null,
    source:             'cabinet_invite',
    invitedBy:          req.partner?.partnerId || null   // ← кто пригласил
  };

  DB.partners[partnerId] = partner;
  persistData();

  const { getInviteLink } = require('./src/telegram-bot');
  const inviteLink = getInviteLink(inviteToken);

  res.json({
    success:    true,
    partnerId,
    inviteToken,
    inviteLink,
    telegram:   partner.telegram,
    message:    `Приглашение создано для ${partner.telegram}. Отправьте партнёру ссылку — бот соберёт все данные автоматически.`
  });
});

// ══════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

// Admin: Create invitation link for new partner
app.post('/api/admin/create-invite', authenticateAdmin, (req, res) => {
  const { telegram } = req.body;

  if (!telegram) {
    return res.status(400).json({ error: 'Укажите Telegram партнёра' });
  }

  // Генерация уникального токена для deep link
  const inviteToken = uuidv4().replace(/-/g, '').substring(0, 20);
  const partnerId   = generatePartnerId();

  const partner = {
    id:                 partnerId,
    firstName:          '',
    lastName:           '',
    email:              '',
    telegram:           telegram.trim().startsWith('@') ? telegram.trim() : '@' + telegram.trim(),
    phone:              '',
    walletAddress:      '',
    inviteToken,
    telegramChatId:     null,
    status:             'invited',
    packageType:        null,
    apiKey:             null,
    role:               'partner',
    requestsLimit:      0,
    requestsUsed:       0,
    metaresourcesLimit: 0,
    metaresourcesUsed:  0,
    createdAt:          new Date().toISOString(),
    activatedAt:        null,
    expiresAt:          null,
    source:             'admin_invite',
    createdByAdmin:     req.admin?.adminName || 'unknown'
  };

  DB.partners[partnerId] = partner;
  persistData();

  const { getInviteLink } = require('./src/telegram-bot');
  const inviteLink = getInviteLink(inviteToken);

  res.json({
    success:    true,
    partnerId,
    inviteToken,
    inviteLink,
    telegram:   partner.telegram,
    message:    `✅ Приглашение создано для ${partner.telegram}`
  });
});

// Partner: Submit payment info
app.post('/api/partner/payment', (req, res) => {
  const { partnerId, txHash, amountBB, packageType } = req.body;
  if (!partnerId || !txHash || !packageType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const partner = DB.partners[partnerId];
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const payment = {
    id: 'pay_' + uuidv4().replace(/-/g, '').substring(0, 12),
    partnerId,
    partnerName: `${partner.firstName} ${partner.lastName}`,
    txHash,
    amountBB: amountBB || 0,
    packageType,
    status: 'pending_review', // Admin must confirm
    submittedAt: new Date().toISOString(),
    reviewedAt: null
  };

  DB.payments.push(payment);
  partner.status = 'pending_review';
  persistData();

  res.json({
    success: true,
    paymentId: payment.id,
    message: 'Платёж отправлен на проверку. Администратор подтвердит и активирует API ключ.'
  });
});

// Admin: Confirm payment
app.post('/api/admin/confirm-payment', authenticateAdmin, (req, res) => {
  const { paymentId } = req.body;
  const payment = DB.payments.find(p => p.id === paymentId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  payment.status = 'confirmed';
  payment.reviewedAt = new Date().toISOString();
  persistData();

  res.json({ success: true, payment, message: 'Платёж подтверждён. Теперь активируйте API ключ для партнёра.' });
});

// Partner login (by email — returns JWT)
app.post('/api/partner/login', (req, res) => {
  const { email, partnerId } = req.body;
  const partner = Object.values(DB.partners).find(
    p => p.email === email?.toLowerCase() || p.id === partnerId
  );
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const token = jwt.sign(
    { role: 'partner', partnerId: partner.id, name: `${partner.firstName} ${partner.lastName}` },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    partner: {
      id: partner.id,
      fullName: `${partner.firstName} ${partner.lastName}`,
      email: partner.email,
      status: partner.status,
      packageType: partner.packageType,
      requestsUsed: partner.requestsUsed,
      requestsLimit: partner.requestsLimit,
      metaresourcesUsed: partner.metaresourcesUsed,
      metaresourcesLimit: partner.metaresourcesLimit,
      expiresAt: partner.expiresAt
    }
  });
});

// Auth: Exchange web token (first login via Telegram)
// POST /api/auth/pin — вход по PIN для всех партнёров
app.post('/api/auth/pin', pinLimiter, (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const ZERO_PIN = process.env.ZERO_USER_PIN || '8387';
  const ZERO_TG  = process.env.ZERO_USER_TELEGRAM || '@VikingOLZH';

  let partner = null;

  // 1. Проверить нулевого пользователя (PIN из env, без хэша)
  if (String(pin) === String(ZERO_PIN)) {
    partner = Object.values(DB.partners).find(
      p => p.telegram && p.telegram.toLowerCase() === ZERO_TG.toLowerCase() && p.status === 'active'
    );
  }

  // 2. Поиск среди обычных партнёров по хэшу PIN
  if (!partner) {
    partner = Object.values(DB.partners).find(
      p => p.status === 'active' && p.pinHash && bcrypt.compareSync(String(pin), p.pinHash)
    );
  }

  if (!partner) {
    return res.status(401).json({ error: 'Неверный PIN-код' });
  }

  const sessionToken = jwt.sign(
    { role: partner.role || 'partner', partnerId: partner.id, telegram: partner.telegram,
      name: `${partner.firstName} ${partner.lastName}` },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    jwt: sessionToken,
    user: {
      id: partner.id,
      role: partner.role || 'partner',
      fullName: `${partner.firstName} ${partner.lastName}`,
      email: partner.email,
      telegram: partner.telegram,
      status: partner.status,
      packageType: partner.packageType,
      requestsUsed: partner.requestsUsed,
      requestsLimit: partner.requestsLimit,
      metaresourcesUsed: partner.metaresourcesUsed,
      metaresourcesLimit: partner.metaresourcesLimit,
      expiresAt: partner.expiresAt
    }
  });
});

// GET /api/auth/web-token?wt=TOKEN
app.get('/api/auth/web-token', (req, res) => {
  const { wt } = req.query;

  if (!wt) {
    return res.status(400).json({ error: 'Missing web token' });
  }

  const tokenData = DB.webTokens[wt];

  // Check if token exists
  if (!tokenData) {
    return res.status(404).json({ error: 'Token not found or expired' });
  }

  // Check if token is expired
  if (new Date() > new Date(tokenData.expiresAt)) {
    delete DB.webTokens[wt];
    persistWebTokens();
    return res.status(401).json({ error: 'Token expired' });
  }

  // Find partner by Telegram username (skip for admin tokens)
  let partner = null;
  if (!tokenData.isAdmin) {
    partner = Object.values(DB.partners).find(
      p => p.telegram === tokenData.username || p.telegram === '@' + tokenData.username
    );

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
  }

  // Generate JWT session token (admin or partner)
  const jwtPayload = {
    role: tokenData.isAdmin ? 'admin' : 'partner',
    telegram: tokenData.username
  };

  if (tokenData.isAdmin) {
    jwtPayload.adminName = tokenData.username;
  } else {
    jwtPayload.partnerId = partner.id;
    jwtPayload.name = `${partner.firstName} ${partner.lastName}`;
  }

  const sessionToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

  // Clean up used web token
  delete DB.webTokens[wt];
  persistWebTokens();

  res.json({
    success: true,
    jwt: sessionToken,
    user: tokenData.isAdmin ? {
      id: 'admin',
      role: 'admin',
      username: tokenData.username,
      fullName: 'Administrator'
    } : {
      id: partner.id,
      role: 'partner',
      fullName: `${partner.firstName} ${partner.lastName}`,
      email: partner.email,
      telegram: partner.telegram,
      status: partner.status,
      packageType: partner.packageType,
      requestsUsed: partner.requestsUsed,
      requestsLimit: partner.requestsLimit,
      metaresourcesUsed: partner.metaresourcesUsed,
      metaresourcesLimit: partner.metaresourcesLimit,
      expiresAt: partner.expiresAt
    }
  });
});

// Partner: Get dashboard
app.get('/api/partner/dashboard', authenticatePartner, (req, res) => {
  const partner = DB.partners[req.partner.partnerId];
  if (!partner) return res.status(404).json({ error: 'Partner not found' });

  const myMeta = DB.metaresources.filter(m => m.partnerId === partner.id);
  const myRequests = DB.requestsLog.filter(r => r.partnerId === partner.id);

  res.json({
    partner: {
      id: partner.id,
      fullName: `${partner.firstName} ${partner.lastName}`,
      email: partner.email,
      telegram: partner.telegram,
      status: partner.status,
      packageType: partner.packageType,
      requestsUsed: partner.requestsUsed,
      requestsLimit: partner.requestsLimit,
      metaresourcesUsed: partner.metaresourcesUsed,
      metaresourcesLimit: partner.metaresourcesLimit,
      activatedAt: partner.activatedAt,
      expiresAt: partner.expiresAt
    },
    metaresources: myMeta,
    recentRequests: myRequests.slice(-20)
  });
});


// ══════════════════════════════════════════════════════════════════════
// METARESOURCE GENERATION — proxy to Anthropic + KB v3.0 injection
// ══════════════════════════════════════════════════════════════════════

// Build full Bitbon KB context to inject into every metaresource generation
function buildMetaKBContext() {
  if (!knowledgeBaseV3 || !knowledgeBaseV3.segments) return '';
  let ctx = '\n\n═══ БАЗА ЗНАНИЙ СИСТЕМЫ BITBON (используй эти концепции точно) ═══\n';
  Object.values(knowledgeBaseV3.segments).forEach(seg => {
    ctx += `\n▶ ${seg.name}\n`;
    seg.facts.forEach(fact => {
      const answer = fact.answer.length > 500 ? fact.answer.substring(0, 500) + '...' : fact.answer;
      ctx += `  Q: ${fact.question}\n  A: ${answer}\n\n`;
    });
  });
  return ctx;
}

app.post('/api/metaresource/generate', async (req, res) => {
  const { context, systemPrompt } = req.body;
  if (!context || !systemPrompt) return res.status(400).json({ error: 'Missing context or systemPrompt' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'API key not configured' });

  // Inject KB v3.0 into system prompt
  const kbContext     = buildMetaKBContext();
  const fullSystem    = systemPrompt + kbContext;
  const segmentNames  = Object.values(knowledgeBaseV3.segments || {}).map(s => s.name);
  const totalFacts    = Object.values(knowledgeBaseV3.segments || {}).reduce((n, s) => n + s.facts.length, 0);

  // ── LOGIC LOG ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🏗️  МЕТАРЕСУРС — ЛОГИКА СОЗДАНИЯ ОТВЕТА                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('┌─ SYSTEM PROMPT ──────────────────────────────────────────');
  console.log('│  Базовый промпт:  ' + systemPrompt.length + ' символов');
  console.log('│  KB v3.0 добавлен: ' + kbContext.length + ' символов');
  console.log('│  Итого system:    ' + fullSystem.length + ' символов');
  console.log('│');
  console.log('├─ БАЗА ЗНАНИЙ (KB v3.0) ─────────────────────────────────');
  console.log('│  Сегментов: ' + segmentNames.length + ' | Фактов: ' + totalFacts);
  segmentNames.forEach((n, i) => console.log('│   ' + (i+1) + '. ' + n));
  console.log('│');
  console.log('├─ USER CONTEXT (ответы мастера) ─────────────────────────');
  context.split('\n').filter(l => l.trim()).forEach(l => console.log('│  ' + l));
  console.log('│');
  console.log('├─ API ЗАПРОС ─────────────────────────────────────────────');
  console.log('│  Модель:      claude-sonnet-4-20250514');
  console.log('│  max_tokens:  2000');
  console.log('└──────────────────────────────────────────────────────────');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: fullSystem,
        messages: [{ role: 'user', content: context }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.log('│  ❌ API Error:', data.error?.message);
      return res.status(response.status).json({ error: data.error?.message || 'API Error' });
    }

    const text  = data.content?.[0]?.text || '';
    const usage = {
      input:  data.usage?.input_tokens  || 0,
      output: data.usage?.output_tokens || 0,
      total:  (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };

    // Try parse JSON from response to log field names
    let parsedFields = [];
    try {
      const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
      if (fb !== -1 && lb !== -1) {
        const meta = JSON.parse(text.substring(fb, lb + 1));
        parsedFields = Object.keys(meta);
      }
    } catch (_) {}

    console.log('');
    console.log('┌─ ОТВЕТ CLAUDE ───────────────────────────────────────────');
    console.log('│  Токены:  input=' + usage.input + '  output=' + usage.output + '  total=' + usage.total);
    console.log('│  JSON поля: ' + parsedFields.join(', '));
    console.log('│  Размер ответа: ' + text.length + ' символов');
    console.log('└──────────────────────────────────────────────────────────\n');

    res.json({ success: true, text, usage, logic: {
      systemChars:   fullSystem.length,
      kbCharsAdded:  kbContext.length,
      kbSegments:    segmentNames.length,
      kbFacts:       totalFacts,
      contextChars:  context.length,
      jsonFields:    parsedFields,
      tokensInput:   usage.input,
      tokensOutput:  usage.output,
      tokensTotal:   usage.total
    }});
  } catch (err) {
    console.error('Metaresource generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// METARESOURCE KNOWLEDGE BASE — LEARNING SYSTEM
// ══════════════════════════════════════════════════════════════════════

// Save a created metaresource to the knowledge base
app.post('/api/metaresource/save', (req, res) => {
  const { metaresource, businessType, partnerId, wizardAnswers } = req.body;

  if (!metaresource || !metaresource.name) {
    return res.status(400).json({ error: 'Invalid metaresource data' });
  }

  // Extract industry/category from wizard answers or business type
  const industry = detectIndustry(businessType || '', wizardAnswers || []);

  const record = {
    id: 'mr_' + uuidv4().replace(/-/g, '').substring(0, 12),
    name: metaresource.name,
    tagline: metaresource.tagline || '',
    industry,
    businessType: businessType || 'general',
    roles: metaresource.roles || [],
    tokens: metaresource.tokens || [],
    activities: metaresource.activities || [],
    economics: metaresource.economics || '',
    interaction: metaresource.interaction || '',
    mission: metaresource.mission || '',
    uniqueness: metaresource.uniqueness || '',
    metaphor: metaresource.metaphor || '',
    atmosphere: metaresource.atmosphere || '',
    difference: metaresource.difference || '',
    // Cross-reference data
    relatedIndustries: findRelatedIndustries(industry),
    crossReferences: [],
    // Metadata
    partnerId: partnerId || 'anonymous',
    wizardAnswers: wizardAnswers || [],
    createdAt: new Date().toISOString(),
    usageCount: 0
  };

  // Find and set cross-references
  record.crossReferences = findCrossReferences(record);

  // Update existing metaresources with reverse cross-references
  DB.metaresources.forEach(existing => {
    if (areCrossReferenced(existing, record)) {
      if (!existing.crossReferences) existing.crossReferences = [];
      if (!existing.crossReferences.find(cr => cr.id === record.id)) {
        existing.crossReferences.push({
          id: record.id,
          name: record.name,
          industry: record.industry,
          relation: describeRelation(existing.industry, record.industry)
        });
      }
    }
  });

  DB.metaresources.push(record);
  persistData();

  res.json({
    success: true,
    metaresourceId: record.id,
    crossReferences: record.crossReferences,
    relatedIndustries: record.relatedIndustries,
    totalInKnowledgeBase: DB.metaresources.length,
    message: `Метаресурс "${record.name}" сохранён в базу знаний. Найдено ${record.crossReferences.length} связей.`
  });
});

// Get related metaresources for a given industry/business type
app.get('/api/metaresource/related/:industry', (req, res) => {
  const industry = decodeURIComponent(req.params.industry).toLowerCase();
  const related = DB.metaresources
    .filter(m => {
      const mi = (m.industry || '').toLowerCase();
      const mbt = (m.businessType || '').toLowerCase();
      return mi.includes(industry) || mbt.includes(industry) ||
             (m.relatedIndustries || []).some(ri => ri.toLowerCase().includes(industry));
    })
    .map(m => ({
      id: m.id,
      name: m.name,
      tagline: m.tagline,
      industry: m.industry,
      roles: m.roles?.map(r => r.name) || [],
      tokens: m.tokens?.map(t => t.name) || [],
      crossReferences: m.crossReferences || []
    }));

  res.json({ industry, related, total: related.length });
});

// Get all metaresources for the knowledge base (for system prompt)
app.get('/api/metaresource/knowledge', (req, res) => {
  const summary = DB.metaresources.map(m => ({
    id: m.id,
    name: m.name,
    tagline: m.tagline,
    industry: m.industry,
    businessType: m.businessType,
    roles: m.roles?.map(r => r.name) || [],
    tokens: m.tokens?.map(t => t.name) || [],
    crossReferences: (m.crossReferences || []).map(cr => cr.name),
    activities: m.activities || []
  }));
  res.json({ metaresources: summary, total: summary.length });
});

// Get full knowledge base
app.get('/api/knowledge-base', (req, res) => {
  res.json({
    knowledgeBase,
    createdMetaresources: DB.metaresources.length,
    metaresourceExamples: DB.metaresources.slice(-5).map(m => ({
      name: m.name,
      industry: m.industry,
      tagline: m.tagline
    }))
  });
});


// ── INDUSTRY DETECTION & CROSS-REFERENCING ───────────────────────────

const INDUSTRY_MAP = {
  'шиномонтаж':     { category: 'авто', related: ['продажа шин', 'автосалон', 'автосервис', 'производство шин', 'автомойка', 'техосмотр'] },
  'продажа шин':    { category: 'авто', related: ['шиномонтаж', 'автосалон', 'автозапчасти', 'производство шин'] },
  'автосалон':      { category: 'авто', related: ['шиномонтаж', 'автосервис', 'автострахование', 'автокредит', 'продажа шин'] },
  'автосервис':     { category: 'авто', related: ['шиномонтаж', 'автозапчасти', 'автосалон', 'техосмотр', 'автомойка'] },
  'автозапчасти':   { category: 'авто', related: ['автосервис', 'шиномонтаж', 'автосалон'] },
  'автомойка':      { category: 'авто', related: ['шиномонтаж', 'автосервис', 'техосмотр'] },
  'ресторан':       { category: 'еда', related: ['кафе', 'доставка еды', 'фермерское хозяйство', 'кейтеринг', 'кулинарная школа'] },
  'кафе':           { category: 'еда', related: ['ресторан', 'пекарня', 'кофейня', 'доставка еды'] },
  'доставка еды':   { category: 'еда', related: ['ресторан', 'кафе', 'фермерское хозяйство', 'логистика'] },
  'фермерское хозяйство': { category: 'агро', related: ['ресторан', 'доставка еды', 'переработка', 'агромаркет'] },
  'фитнес':         { category: 'здоровье', related: ['спортзал', 'йога', 'нутрициолог', 'спортивный магазин', 'wellness'] },
  'клиника':        { category: 'здоровье', related: ['аптека', 'лаборатория', 'стоматология', 'wellness'] },
  'стоматология':   { category: 'здоровье', related: ['клиника', 'аптека', 'лаборатория'] },
  'онлайн-школа':   { category: 'образование', related: ['репетитор', 'курсы', 'коучинг', 'вебинары'] },
  'магазин':        { category: 'ритейл', related: ['интернет-магазин', 'склад', 'логистика', 'маркетплейс'] },
  'интернет-магазин': { category: 'ритейл', related: ['магазин', 'логистика', 'маркетплейс', 'склад'] },
  'строительство':  { category: 'строительство', related: ['стройматериалы', 'дизайн интерьера', 'недвижимость', 'архитектура'] },
  'недвижимость':   { category: 'строительство', related: ['строительство', 'риэлтор', 'ипотека', 'дизайн интерьера'] },
  'юридические услуги': { category: 'услуги', related: ['бухгалтерия', 'нотариус', 'консалтинг'] },
  'it-компания':    { category: 'it', related: ['разработка', 'дизайн', 'маркетинг', 'хостинг'] },
  'парикмахерская': { category: 'красота', related: ['салон красоты', 'барбершоп', 'косметика', 'spa'] },
  'салон красоты':  { category: 'красота', related: ['парикмахерская', 'косметика', 'spa', 'маникюр'] }
};

function detectIndustry(businessType, wizardAnswers) {
  const text = (businessType + ' ' + wizardAnswers.map(a => a.a || a).join(' ')).toLowerCase();
  for (const [industry] of Object.entries(INDUSTRY_MAP)) {
    if (text.includes(industry)) return industry;
  }
  // Try to extract from first wizard answer
  const firstAnswer = (wizardAnswers[0]?.a || wizardAnswers[0] || '').toLowerCase();
  for (const [industry] of Object.entries(INDUSTRY_MAP)) {
    if (firstAnswer.includes(industry.split(' ')[0])) return industry;
  }
  return businessType || 'general';
}

function findRelatedIndustries(industry) {
  const key = industry.toLowerCase();
  if (INDUSTRY_MAP[key]) return INDUSTRY_MAP[key].related;
  // Fuzzy match
  for (const [ind, data] of Object.entries(INDUSTRY_MAP)) {
    if (key.includes(ind) || ind.includes(key)) return data.related;
  }
  return [];
}

function findCrossReferences(newRecord) {
  const refs = [];
  const industry = (newRecord.industry || '').toLowerCase();
  const relatedInds = newRecord.relatedIndustries || [];

  DB.metaresources.forEach(existing => {
    const existingInd = (existing.industry || '').toLowerCase();
    if (
      relatedInds.some(ri => existingInd.includes(ri.toLowerCase()) || ri.toLowerCase().includes(existingInd)) ||
      areCrossReferenced(existing, newRecord)
    ) {
      refs.push({
        id: existing.id,
        name: existing.name,
        industry: existing.industry,
        relation: describeRelation(industry, existingInd)
      });
    }
  });

  return refs;
}

function areCrossReferenced(a, b) {
  const aInd = (a.industry || '').toLowerCase();
  const bInd = (b.industry || '').toLowerCase();
  // Same category?
  const aCat = Object.entries(INDUSTRY_MAP).find(([k]) => aInd.includes(k));
  const bCat = Object.entries(INDUSTRY_MAP).find(([k]) => bInd.includes(k));
  if (aCat && bCat && aCat[1].category === bCat[1].category) return true;
  // Direct relation?
  if (aCat && aCat[1].related.some(r => bInd.includes(r))) return true;
  if (bCat && bCat[1].related.some(r => aInd.includes(r))) return true;
  return false;
}

function describeRelation(indA, indB) {
  const aCat = Object.entries(INDUSTRY_MAP).find(([k]) => indA.includes(k));
  const bCat = Object.entries(INDUSTRY_MAP).find(([k]) => indB.includes(k));
  if (aCat && bCat && aCat[1].category === bCat[1].category) {
    return `Одна отрасль: ${aCat[1].category}`;
  }
  return 'Смежный бизнес';
}


// ══════════════════════════════════════════════════════════════════════
// API QUERY ENDPOINT (for partner clients)
// ══════════════════════════════════════════════════════════════════════
// CHAT API — Proxy to Anthropic API (free access for all users)
// ── KB ROUTING ───────────────────────────────────────────────────────
// Routes question to 1-2 relevant KB segments and returns formatted context
function routeKBContext(question) {
  if (!knowledgeBaseV3 || !knowledgeBaseV3.segments) return '';

  const q = question.toLowerCase();
  const rules = knowledgeBaseV3.routing?.rules || [];

  // Score each segment by how many trigger keywords match the question
  const scores = rules.map(rule => ({
    segment: rule.segment,
    score: rule.triggers.filter(t => q.includes(t.toLowerCase())).length
  })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  // Take top 2 matching segments; fallback to segment 1 if no match
  const topSegments = scores.length > 0
    ? scores.slice(0, 2).map(r => r.segment)
    : ['1_fundamentals'];

  let ctx = '\n\n═══ РЕЛЕВАНТНАЯ БАЗА ЗНАНИЙ ═══\n';
  topSegments.forEach(segKey => {
    const seg = knowledgeBaseV3.segments[segKey];
    if (!seg) return;
    ctx += `\n[${seg.name}]\n`;
    seg.facts.slice(0, 3).forEach(fact => {
      // Trim answer to 600 chars to stay token-efficient
      const answer = fact.answer.length > 600
        ? fact.answer.substring(0, 600) + '...'
        : fact.answer;
      ctx += `Вопрос: ${fact.question}\nОтвет: ${answer}\n\n`;
    });
  });

  return ctx;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { question, messages, systemPrompt, userLevel, userMode, language } = req.body;

    if (!question || !messages || !systemPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Map language code to language name for Claude
    const languageMap = {
      'uk': 'Ukrainian',
      'en': 'English',
      'ru': 'Russian'
    };
    const langName = languageMap[language] || 'English';

    if (!ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not configured!');
      console.error('   process.env.ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY);
      return res.status(503).json({ error: 'API key not configured on server' });
    }

    // Inject routed KB context into system prompt
    const kbContext = routeKBContext(question);
    const languageInstruction = `\n\n[IMPORTANT: Respond ONLY in ${langName}. Do not use any other language.]`;
    const enhancedSystemPrompt = systemPrompt + kbContext + languageInstruction;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: enhancedSystemPrompt,
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'API Error' });
    }

    const reply = data.content && data.content[0] && data.content[0].text
      ? data.content[0].text
      : 'Не удалось получить ответ.';

    const usage = {
      input:  data.usage?.input_tokens  || 0,
      output: data.usage?.output_tokens || 0,
      total:  (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      model:  data.model || 'unknown'
    };
    console.log(`🔢 Tokens — input: ${usage.input}, output: ${usage.output}, total: ${usage.total}`);

    // Log request
    DB.requestsLog.push({
      id: 'req_' + Date.now(),
      type: 'demo',
      userMode: userMode,
      userLevel: userLevel,
      question: question,
      tokensInput:  usage.input,
      tokensOutput: usage.output,
      tokensTotal:  usage.total,
      model:        usage.model,
      timestamp: new Date().toISOString()
    });

    res.json({ reply, success: true, usage });
  } catch (err) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// DEMO MODE — Free access without API key (for all users/partners)
app.post('/api/demo/query', (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  // Log request (no partner tracking)
  DB.requestsLog.push({
    id: 'req_' + Date.now(),
    type: 'demo',
    question,
    timestamp: new Date().toISOString()
  });

  res.json({ message: 'Demo query logged, agent processing...' });
});

app.post('/api/query', (req, res) => {
  const apiKeyRaw = req.headers['x-api-key'];
  const { question, clientId } = req.body;

  if (!apiKeyRaw) return res.status(401).json({ error: 'Missing API key' });
  if (!question) return res.status(400).json({ error: 'Missing question' });

  // Find matching partner by API key
  let matchedPartner = null;
  for (const [pid, partner] of Object.entries(DB.partners)) {
    if (partner.apiKey && partner.status === 'active') {
      try {
        if (verifyApiKey(apiKeyRaw, partner.apiKey)) {
          matchedPartner = partner;
          break;
        }
      } catch (e) { /* skip */ }
    }
  }

  if (!matchedPartner) return res.status(401).json({ error: 'Invalid or expired API key' });

  // Check limits
  if (matchedPartner.requestsLimit !== Infinity &&
      matchedPartner.requestsUsed >= matchedPartner.requestsLimit) {
    return res.status(429).json({ error: 'Request limit exceeded. Upgrade your plan.' });
  }

  // Check expiry
  if (matchedPartner.expiresAt && new Date() > new Date(matchedPartner.expiresAt)) {
    return res.status(401).json({ error: 'API key expired. Please renew.' });
  }

  // Log request
  matchedPartner.requestsUsed = (matchedPartner.requestsUsed || 0) + 1;
  DB.requestsLog.push({
    id: 'req_' + Date.now(),
    partnerId: matchedPartner.id,
    clientId: clientId || 'unknown',
    question,
    timestamp: new Date().toISOString()
  });
  persistData();

  res.json({
    success: true,
    partnerName: `${matchedPartner.firstName} ${matchedPartner.lastName}`,
    requestsUsed: matchedPartner.requestsUsed,
    requestsLimit: matchedPartner.requestsLimit,
    message: 'Use the question with Claude API on the frontend'
  });
});


// ══════════════════════════════════════════════════════════════════════
// STATIC PAGES
// ══════════════════════════════════════════════════════════════════════

// ── Guest tokens (gift requests) ─────────────────────────────────────

// POST /api/gift/create — partner creates a gift link (requires partner API key)
app.post('/api/gift/create', (req, res) => {
  const { apiKey, quota = 20 } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });

  const partner = Object.values(DB.partners).find(p => p.apiKey && verifyApiKey(apiKey, p.apiKey));
  if (!partner) return res.status(403).json({ error: 'Invalid API key' });
  if (partner.status !== 'active') return res.status(403).json({ error: 'Partner not active' });

  const guestToken = uuidv4().replace(/-/g, '').substring(0, 24);
  DB.guestTokens[guestToken] = {
    token: guestToken,
    partnerId: partner.id,
    partnerName: `${partner.firstName || ''} ${partner.lastName || ''}`.trim() || partner.telegram,
    quota: Math.max(1, Math.min(parseInt(quota) || 20, 1000)),
    used: 0,
    createdAt: new Date().toISOString(),
    claimedAt: null,
    userAgent: req.headers['user-agent'] || ''
  };
  persistGuests();

  const giftUrl = `${req.protocol}://${req.get('host')}/?gift=${guestToken}`;
  res.json({ success: true, guestToken, giftUrl, quota: DB.guestTokens[guestToken].quota });
});

// POST /api/gift/claim — client claims a gift token (returns remaining quota)
app.post('/api/gift/claim', (req, res) => {
  const { token } = req.body;
  const gt = DB.guestTokens[token];
  if (!gt) return res.status(404).json({ error: 'Token not found or expired' });
  if (!gt.claimedAt) {
    gt.claimedAt = new Date().toISOString();
    persistGuests();
  }
  res.json({ success: true, quota: gt.quota, used: gt.used, remaining: gt.quota - gt.used });
});

// POST /api/gift/use — decrement one request from a guest token
app.post('/api/gift/use', (req, res) => {
  const { token } = req.body;
  const gt = DB.guestTokens[token];
  if (!gt) return res.status(404).json({ error: 'Token not found' });
  if (gt.used >= gt.quota) return res.status(429).json({ error: 'Quota exhausted', remaining: 0 });
  gt.used++;
  persistGuests();
  res.json({ success: true, used: gt.used, remaining: gt.quota - gt.used });
});

// POST /api/gift/topup — partner adds more requests to an existing token
app.post('/api/gift/topup', (req, res) => {
  const { apiKey, token, add = 10 } = req.body;
  if (!apiKey || !token) return res.status(400).json({ error: 'apiKey and token required' });
  const partner = Object.values(DB.partners).find(p => p.apiKey && verifyApiKey(apiKey, p.apiKey));
  if (!partner) return res.status(403).json({ error: 'Invalid API key' });
  const gt = DB.guestTokens[token];
  if (!gt) return res.status(404).json({ error: 'Token not found' });
  if (gt.partnerId !== partner.id) return res.status(403).json({ error: 'Not your token' });
  gt.quota += Math.max(1, Math.min(parseInt(add) || 10, 500));
  persistGuests();
  res.json({ success: true, quota: gt.quota, used: gt.used, remaining: gt.quota - gt.used });
});

// GET /api/partner/referrals — list partners invited by this partner
app.get('/api/partner/referrals', authenticatePartner, (req, res) => {
  const me = req.partner;
  const referrals = Object.values(DB.partners)
    .filter(p => p.invitedBy === me.partnerId)
    .map(p => ({
      id:          p.id,
      telegram:    p.telegram,
      firstName:   p.firstName || '',
      lastName:    p.lastName  || '',
      status:      p.status,
      packageType: p.packageType || null,
      createdAt:   p.createdAt,
      activatedAt: p.activatedAt || null
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, referrals });
});

// GET /api/partner/guests — list guest tokens created by this partner
app.get('/api/partner/guests', (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
  const partner = Object.values(DB.partners).find(p => p.apiKey && verifyApiKey(apiKey, p.apiKey));
  if (!partner) return res.status(403).json({ error: 'Invalid API key' });
  const guests = Object.values(DB.guestTokens)
    .filter(g => g.partnerId === partner.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(g => ({
      token: g.token,
      quota: g.quota,
      used: g.used,
      remaining: g.quota - g.used,
      createdAt: g.createdAt,
      claimedAt: g.claimedAt
    }));
  res.json({ success: true, guests });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SPA routing - serve index.html for all frontend routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cabinet', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ── ERROR HANDLING ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  ⚡ Bitbon Partner System v2.0`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  🔧 Admin: http://localhost:${PORT}/admin`);
  console.log(`  📊 ${DB.metaresources.length} metaresources in KB`);
  console.log(`  👥 ${Object.keys(DB.partners).length} partners`);
  console.log(`══════════════════════════════════════════\n`);

  // Start Telegram bot
  telegramBot = initBot(
    DB, persistData, generatePartnerId, generateWebToken, persistWebTokens,
    (pin) => bcrypt.hashSync(String(pin), 8)   // hashPin — для хранения PIN партнёров
  );
});

// ── Graceful shutdown — save DB before exit ───────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received — saving data and shutting down...`);
  persistData();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = app;
