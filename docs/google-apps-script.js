// ══════════════════════════════════════════════════════════════════════
// Bitbon Partner Registration — Google Apps Script Webhook
// Вставить в: Google Sheets → Расширения → Apps Script
// ══════════════════════════════════════════════════════════════════════

const SHEET_NAME = 'Регистрации'; // Название листа

// Заголовки столбцов
const HEADERS = [
  '📅 Дата',
  '🆔 ID партнёра',
  '👤 Имя',
  '👤 Фамилия',
  '📧 Email',
  '📱 Телефон',
  '💬 Telegram',
  '📦 Пакет',
  '⚡ Статус',
  '🔗 Источник'
];

const PLAN_LABELS = {
  starter: '🌱 Стартер — 10 BB/мес',
  pro:     '📖 Про — 50 BB/мес',
  expert:  '🚀 Эксперт — 150 BB/мес'
};

const STATUS_LABELS = {
  invited:         '📩 Приглашён',
  pending_payment: '⏳ Ожидает оплаты',
  pending_review:  '🔍 На проверке',
  active:          '✅ Активен',
  suspended:       '🚫 Приостановлен',
  expired:         '⌛ Истёк'
};

// ── Обработка POST запроса от сервера ─────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet();

    var row = [
      data.date      || new Date().toLocaleString('ru-RU'),
      data.partnerId || '',
      data.firstName || '',
      data.lastName  || '',
      data.email     || '',
      data.phone     || '',
      data.telegram  || '',
      PLAN_LABELS[data.plan] || data.plan || '',
      STATUS_LABELS[data.status] || data.status || '',
      data.source    || 'telegram'
    ];

    sheet.appendRow(row);

    // Подсветить строку зелёным если активен
    if (data.status === 'active') {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, HEADERS.length)
        .setBackground('#d9ead3');
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET запрос (тест доступности) ────────────────────────────────────
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Bitbon Sheets Webhook работает ✅' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Получить или создать лист ─────────────────────────────────────────
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupHeaders(sheet);
  } else if (sheet.getLastRow() === 0) {
    setupHeaders(sheet);
  }

  return sheet;
}

// ── Создать заголовки с форматированием ──────────────────────────────
function setupHeaders(sheet) {
  sheet.appendRow(HEADERS);

  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(11);

  // Ширина столбцов
  sheet.setColumnWidth(1, 150); // Дата
  sheet.setColumnWidth(2, 160); // ID
  sheet.setColumnWidth(3, 120); // Имя
  sheet.setColumnWidth(4, 120); // Фамилия
  sheet.setColumnWidth(5, 200); // Email
  sheet.setColumnWidth(6, 130); // Телефон
  sheet.setColumnWidth(7, 130); // Telegram
  sheet.setColumnWidth(8, 200); // Пакет
  sheet.setColumnWidth(9, 160); // Статус
  sheet.setColumnWidth(10, 120); // Источник

  sheet.setFrozenRows(1);
}

// ── Ручной тест из редактора скриптов ────────────────────────────────
function testWebhook() {
  var testData = {
    date:      new Date().toLocaleString('ru-RU'),
    partnerId: 'prt_test123',
    firstName: 'Тест',
    lastName:  'Партнёр',
    email:     'test@example.com',
    phone:     '+380501234567',
    telegram:  '@testpartner',
    plan:      'pro',
    status:    'pending_payment',
    source:    'telegram'
  };

  var sheet = getOrCreateSheet();
  sheet.appendRow([
    testData.date,
    testData.partnerId,
    testData.firstName,
    testData.lastName,
    testData.email,
    testData.phone,
    testData.telegram,
    PLAN_LABELS[testData.plan],
    STATUS_LABELS[testData.status],
    testData.source
  ]);

  Logger.log('✅ Тестовая строка добавлена в лист: ' + SHEET_NAME);
}
