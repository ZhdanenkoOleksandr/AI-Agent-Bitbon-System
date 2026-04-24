// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner System — Server v2.0
// Express backend: auth, admin, partner API, metaresource knowledge base
// ══════════════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Anthropic API (using fetch - no SDK needed)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Debug: Log API key status
console.log('🔑 API Configuration:');
console.log('   ANTHROPIC_API_KEY:', ANTHROPIC_API_KEY ? '✓ Configured' : '❌ NOT SET');
console.log('   Environment:', process.env.NODE_ENV || 'development');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bitbon-secret-change-in-production-' + Date.now();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';

// ── MIDDLEWARE ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Too many requests, try again later' }
});
app.use('/api/', apiLimiter);

// ── IN-MEMORY DATABASE ───────────────────────────────────────────────
// In production, replace with PostgreSQL/MongoDB
const DB = {
  partners: {},       // partnerId -> partner object
  apiKeys: {},        // apiKey hash -> key record
  payments: [],       // payment records
  requestsLog: [],    // API usage log
  metaresources: [],  // Created metaresources (knowledge base learning)
  sessions: {}        // admin sessions
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
let knowledgeBase = loadJSON('knowledge_base.json') || { categories: {}, meta: {} };
let metaresourceTemplates = loadJSON('metaresource_templates.json') || { templates: {} };

// Load created metaresources from disk (persistence)
let createdMetaresources = loadJSON('created_metaresources.json') || [];
DB.metaresources = createdMetaresources;

// Load partners from disk
let savedPartners = loadJSON('partners_db.json') || {};
DB.partners = savedPartners;

// Load payments
let savedPayments = loadJSON('payments_db.json') || [];
DB.payments = savedPayments;

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

function persistData() {
  saveJSON('created_metaresources.json', DB.metaresources);
  saveJSON('partners_db.json', DB.partners);
  saveJSON('payments_db.json', DB.payments);
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token });
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

// Register new partner
app.post('/api/partner/register', (req, res) => {
  const { firstName, lastName, email, telegram, phone, walletAddress } = req.body;

  if (!firstName || !lastName || !email || !telegram) {
    return res.status(400).json({ error: 'Заполните обязательные поля: Имя, Фамилия, Email, Telegram' });
  }

  // Check duplicate email
  const existing = Object.values(DB.partners).find(p => p.email === email);
  if (existing) {
    return res.status(409).json({ error: 'Партнёр с таким email уже зарегистрирован' });
  }

  const partnerId = generatePartnerId();
  const partner = {
    id: partnerId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    telegram: telegram.trim(),
    phone: phone?.trim() || '',
    walletAddress: walletAddress?.trim() || '',
    status: 'pending_payment', // pending_payment -> active -> suspended -> expired
    packageType: null,
    apiKey: null,
    requestsLimit: 0,
    requestsUsed: 0,
    metaresourcesLimit: 0,
    metaresourcesUsed: 0,
    createdAt: new Date().toISOString(),
    activatedAt: null,
    expiresAt: null
  };

  DB.partners[partnerId] = partner;
  persistData();

  res.json({
    success: true,
    partnerId,
    fullName: `${partner.firstName} ${partner.lastName}`,
    status: 'pending_payment',
    message: `Партнёр ${partner.firstName} ${partner.lastName} зарегистрирован. Ожидается оплата Bitbon для активации.`
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
app.post('/api/chat', async (req, res) => {
  try {
    const { question, messages, systemPrompt, userLevel, userMode } = req.body;

    if (!question || !messages || !systemPrompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not configured!');
      console.error('   process.env.ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY);
      return res.status(503).json({ error: 'API key not configured on server' });
    }

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
        system: systemPrompt,
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

    // Log request
    DB.requestsLog.push({
      id: 'req_' + Date.now(),
      type: 'demo',
      userMode: userMode,
      userLevel: userLevel,
      question: question,
      timestamp: new Date().toISOString()
    });

    res.json({ reply, success: true });
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
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
});

module.exports = app;
