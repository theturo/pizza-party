// Backend della Cena di Natale: riceve le risposte del modulo e le scrive nel Foglio Google.
// Va incollato in Estensioni > Apps Script del foglio (vedi SETUP.md).

const SHEET_NAME = 'Risposte';
const HEADERS = ['Ricevuta il', 'Email', 'Nome', 'Conferma', 'Partecipazione', 'Nome +1',
                 'Contributo', 'Dettaglio', 'Quota', 'Pagamento', 'Compilata il'];
const FIELDS = ['email', 'nome', 'conferma', 'partecipazione', 'plus1nome',
                'contributo', 'dettaglio', 'quota', 'metodoPagamento', 'timestamp'];
const MAX_ROWS = 300;   // tetto di sicurezza contro invii automatici

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normEmail_(v) {
  return String(v || '').trim().toLowerCase();
}

function emailExists_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2 || !email) return false;
  return sheet.getRange(2, 2, last - 1, 1).getValues()
    .some(function (r) { return normEmail_(r[0]) === email; });
}

// Testo semplice, lunghezza limitata, mai interpretato come formula dal foglio.
function clean_(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// GET ?action=checkEmail&email=... -> {"exists": true|false}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'checkEmail') {
    return json_({ exists: emailExists_(getSheet_(), normEmail_(p.email)) });
  }
  return json_({ ok: true });
}

// POST con il JSON della risposta nel corpo.
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'json' });
  }
  const email = normEmail_(data.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !String(data.nome || '').trim()) {
    return json_({ ok: false, error: 'dati' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    if (sheet.getLastRow() > MAX_ROWS) return json_({ ok: false, error: 'pieno' });
    if (emailExists_(sheet, email)) return json_({ ok: true, duplicate: true });
    data.email = email;
    sheet.appendRow([new Date()].concat(FIELDS.map(function (f) { return clean_(data[f]); })));
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
