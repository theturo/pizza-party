// ====== CONFIGURAZIONE ======
const CONFIG = {
  // URL del Web App di Google Apps Script (dopo il deploy come "Chiunque")
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwY3R9Y1ysBhbNQPerN4x2LgclbJDk0RP8SVSGY6yLd4Jdu3LePjfi7g7D-zvIu_Brj0g/exec",
  // Dati evento per il link "Aggiungi al calendario".
  // EVENT_START/END: "AAAA-MM-GG" (giornata intera) oppure "AAAA-MM-GGTHH:mm" (con orario).
  EVENT_TITLE: "PizzaParty — 10° Anniversario",
  EVENT_START: "2026-10-10T19:30",
  EVENT_END: "2026-10-10T23:30",
  EVENT_LOCATION: "Corte Quaglio",
  // Quote in euro: usate per il testo della pagina e per il payload.
  QUOTA_SINGLE: 5,
  QUOTA_PLUS1: 10,
  // Giorni dopo l'evento entro cui i dati vengono cancellati (informativa privacy).
  RETENTION_DAYS: 30
};
const SCRIPT_URL = CONFIG.SCRIPT_URL;
const SCRIPT_READY = SCRIPT_URL && SCRIPT_URL.indexOf("INCOLLA_QUI") === -1;
const LOADING_DOTS_HTML = '<span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
function setLoadingLabel(btn, text){ btn.innerHTML = text + LOADING_DOTS_HTML; }

const formatEuro = n => n + '€';
function quotaFor(plus1){ return plus1 ? CONFIG.QUOTA_PLUS1 : CONFIG.QUOTA_SINGLE; }

// Testi della pagina derivati da CONFIG (elementi con data-cfg="…").
// L'HTML contiene già gli stessi valori, così la pagina è corretta anche prima del JS.
function applyConfigText(){
  const start = new Date(CONFIG.EVENT_START);
  const end = new Date(start); end.setDate(end.getDate() + CONFIG.RETENTION_DAYS);
  const pad = n => String(n).padStart(2, '0');
  const values = {
    dateShort: pad(start.getDate()) + ' · ' + pad(start.getMonth() + 1) + ' · ' + start.getFullYear(),
    dayMonth: start.toLocaleDateString('it-IT', {day: 'numeric', month: 'long'}),
    retentionEnd: end.toLocaleDateString('it-IT', {day: 'numeric', month: 'long', year: 'numeric'}),
    retentionDays: String(CONFIG.RETENTION_DAYS),
    quotaSingle: formatEuro(CONFIG.QUOTA_SINGLE)
  };
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const v = values[el.dataset.cfg];
    if(v) el.textContent = v;
  });
  return values;
}
const CFG_TEXT = applyConfigText();
// ============================

const form = document.getElementById('pizzaForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
// Inizio compilazione, per il filtro anti-bot "invio troppo rapido".
// Viene salvato insieme al progresso: dopo una ricarica (es. ritorno da
// PayPal/Satispay) si riparte dall'orario originale e non da zero.
let formStartedAt = Date.now();

const plus1Radio = document.querySelector('input[value="plus1"]');
const soloRadio = document.querySelector('input[value="solo"]');
const plus1Wrap = document.getElementById('plus1-wrap');
const quotaAmount = document.getElementById('quota-amount');
const accettoCheck = document.getElementById('accetto');

function isAttending(){
  const v = form.querySelector('input[name="conferma"]:checked');
  return v && (v.value === 'si' || v.value === 'forse');
}

// Apertura/chiusura animata (motion.js); da chiuso il blocco è inert.
function setConditionalOpen(el, open, animate = true){
  Motion.reveal(el, open, animate);
}

let shownQuota = CONFIG.QUOTA_SINGLE;
function updatePlus1(animate = true){
  const isPlus1 = plus1Radio.checked;
  setConditionalOpen(plus1Wrap, isPlus1, animate);
  const q = quotaFor(isPlus1);
  if(animate) Motion.countTo(quotaAmount, shownQuota, q, formatEuro);
  else quotaAmount.textContent = formatEuro(q);
  shownQuota = q;
}
plus1Radio.addEventListener('change', () => updatePlus1());
soloRadio.addEventListener('change', () => updatePlus1());

const onlineWrap = document.getElementById('online-wrap');
document.querySelectorAll('input[name="metodo_pagamento"]').forEach(r => {
  r.addEventListener('change', () => {
    setConditionalOpen(onlineWrap, r.value === 'online' && r.checked);
  });
});

// ---- Verifica email lato server, stato a tre valori: 'yes' | 'no' | 'unknown'
// fetch + JSON (Apps Script risponde con CORS aperto): a differenza del vecchio
// JSONP, la risposta è solo un dato e non codice eseguito nella pagina.
async function confirmSignup(email){
  if(!SCRIPT_READY) return 'unknown';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try{
    const res = await fetch(SCRIPT_URL + '?action=checkEmail&email=' + encodeURIComponent(email), {
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store'
    });
    if(!res.ok) return 'unknown';
    const data = await res.json();
    if(!data || typeof data.exists !== 'boolean') return 'unknown';
    return data.exists ? 'yes' : 'no';
  }catch(err){
    return 'unknown';
  }finally{
    clearTimeout(t);
  }
}

// ---- Salvataggio locale della compilazione ---------------------------------
// Protegge da un caso reale: su mobile, aprire un link di pagamento in un'altra
// scheda può far scaricare/ricaricare la scheda del modulo per motivi di memoria;
// al ritorno la pagina si ricarica da zero e perderebbe tutto senza questo.
// sessionStorage sopravvive a quel tipo di ricarica (non a una chiusura vera
// della scheda) ed è privato a questa scheda, quindi non crea conflitti tra
// più iscrizioni aperte in schede diverse.
const PROGRESS_KEY = 'pizzaPartyProgress';

function setRadioValue(name, value){
  if(!value) return;
  const el = form.querySelector('input[name="' + name + '"][value="' + CSS.escape(value) + '"]');
  if(el) el.checked = true;
}

function saveProgress(){
  try{
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({
      v: 1,
      email: document.getElementById('email').value,
      nome: document.getElementById('nome').value,
      conferma: (form.querySelector('input[name="conferma"]:checked') || {}).value,
      partecipazione: (form.querySelector('input[name="partecipazione"]:checked') || {}).value,
      plus1nome: document.getElementById('plus1nome').value,
      veterano: (form.querySelector('input[name="veterano"]:checked') || {}).value,
      intolleranze: document.getElementById('intolleranze').value,
      indicazioni: (form.querySelector('input[name="indicazioni"]:checked') || {}).value,
      contributo: Array.from(form.querySelectorAll('input[name="contributo"]:checked')).map(c => c.value),
      dettaglio: document.getElementById('dettaglio').value,
      sacchetto: document.getElementById('sacchetto').checked,
      metodo_pagamento: (form.querySelector('input[name="metodo_pagamento"]:checked') || {}).value,
      accetto: document.getElementById('accetto').checked,
      currentIndex: currentIndex,
      startedAt: formStartedAt
    }));
  }catch(e){ /* storage non disponibile: non è grave, si compila di nuovo */ }
}

function clearProgress(){
  try{ sessionStorage.removeItem(PROGRESS_KEY); }catch(e){}
}

function restoreProgress(){
  let data;
  try{ data = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || 'null'); }catch(e){ data = null; }
  if(!data) return;
  try{
    document.getElementById('email').value = data.email || '';
    document.getElementById('nome').value = data.nome || '';
    setRadioValue('conferma', data.conferma);
    setRadioValue('partecipazione', data.partecipazione);
    document.getElementById('plus1nome').value = data.plus1nome || '';
    setRadioValue('veterano', data.veterano);
    document.getElementById('intolleranze').value = data.intolleranze || '';
    setRadioValue('indicazioni', data.indicazioni);
    (data.contributo || []).forEach(v => {
      const el = form.querySelector('input[name="contributo"][value="' + CSS.escape(v) + '"]');
      if(el) el.checked = true;
    });
    document.getElementById('dettaglio').value = data.dettaglio || '';
    document.getElementById('sacchetto').checked = !!data.sacchetto;
    setRadioValue('metodo_pagamento', data.metodo_pagamento);
    document.getElementById('accetto').checked = !!data.accetto;

    updatePlus1(false);
    setConditionalOpen(onlineWrap, (form.querySelector('input[name="metodo_pagamento"]:checked') || {}).value === 'online', false);
    if(typeof data.startedAt === 'number' && data.startedAt <= Date.now()) formStartedAt = data.startedAt;

    const target = Math.max(0, Math.min(data.currentIndex || 0, scenes.length - 1));
    if(target > 0 && !isSkipped(scenes[target])){
      scenes[currentIndex].classList.remove('step-active');
      currentIndex = target;
      scenes[currentIndex].classList.add('step-active');
    }
    refreshFlow();

    if(currentIndex > 0 || data.email || data.nome){
      const note = document.getElementById('restoreNote');
      note.classList.add('show');
      setTimeout(() => note.classList.remove('show'), 8000);
    }
  }catch(e){ /* ripristino parziale va bene comunque */ }
}

form.addEventListener('input', saveProgress);
form.addEventListener('change', saveProgress);

// ---- Stepper -------------------------------------------------------------
const scenes = Array.from(document.querySelectorAll('.scene'));
const reel = document.getElementById('reel');
const reelLabel = document.getElementById('reelLabel');
const stepNav = document.getElementById('stepNav');
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
let currentIndex = 0;

function isSkipped(scene){
  if(scene === scenes[0]) return false;
  if(!isAttending()) return true;               // chi non viene compila solo la prima scena
  if(scene.id === 'intolleranze-scene'){
    const v = document.querySelector('input[name="veterano"]:checked');
    return v && v.value === 'si';
  }
  return false;
}
function visibleScenes(){ return scenes.filter(s => !isSkipped(s)); }

function findStep(fromIndex, direction){
  let i = fromIndex + direction;
  while(scenes[i] && isSkipped(scenes[i])) i += direction;
  return i;
}

// I fotogrammi già superati restano "impressionati"; con direction il
// fotogramma corrente si riempie con un'animazione (motion.js).
function renderReel(direction){
  const vis = visibleScenes();
  const cur = vis.indexOf(scenes[currentIndex]);
  reel.innerHTML = vis.map((s,i) =>
    '<span class="frame' + (i === cur ? ' on' : i < cur ? ' done' : '') + '"><span class="fill"></span></span>').join('');
  if(direction) Motion.reelAdvance(reel.children[cur], direction);
  const heading = scenes[currentIndex].querySelector('h2').textContent.trim();
  reelLabel.textContent = 'Scena ' + (cur + 1) + ' / ' + vis.length + ' — ' + heading;
}

function refreshFlow(direction){
  accettoCheck.required = isAttending();
  renderReel(direction);
  updateNav();
}

function updateNav(){
  const vis = visibleScenes();
  const pos = vis.indexOf(scenes[currentIndex]);
  btnBack.disabled = pos <= 0;
  const isLast = pos === vis.length - 1;
  stepNav.style.display = isLast ? 'none' : 'flex';
  submitBtn.style.display = isLast ? 'block' : 'none';
}

function setInvalid(el, on){
  el.setAttribute('aria-invalid', on ? 'true' : 'false');
}

function validateStep(index){
  const scene = scenes[index];
  if(scene.querySelector('#email')){
    const emailEl = document.getElementById('email');
    const nomeEl = document.getElementById('nome');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim());
    const nomeOk = nomeEl.value.trim().length > 0;
    document.getElementById('err-email').classList.toggle('show', !emailOk);
    document.getElementById('err-nome').classList.toggle('show', !nomeOk);
    setInvalid(emailEl, !emailOk);
    setInvalid(nomeEl, !nomeOk);
    return emailOk && nomeOk;
  }
  return true;
}

['email','nome'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    if(e.target.getAttribute('aria-invalid') === 'true'){
      setInvalid(e.target, false);
      const err = document.getElementById(id === 'email' ? 'err-email' : 'err-nome');
      err.classList.remove('show');
    }
  });
});

const scenesBox = document.getElementById('scenes');
let sceneBusy = false;

// Transizione animata (motion.js). Durante la transizione gli altri clic
// vengono ignorati, così non si possono saltare o sovrapporre scene.
async function goTo(newIndex, direction){
  if(sceneBusy || newIndex === currentIndex) return;
  sceneBusy = true;
  const oldScene = scenes[currentIndex];
  const newScene = scenes[newIndex];
  try{
    await Motion.sceneSwap(scenesBox, oldScene, newScene, direction, () => {
      oldScene.classList.remove('step-active');
      newScene.classList.add('step-active');
      currentIndex = newIndex;
      refreshFlow(direction);
      saveProgress();
      const h = newScene.querySelector('h2');
      if(h) h.focus({preventScroll: true});
    });
  }finally{
    sceneBusy = false;
  }
}

btnNext.addEventListener('click', async () => {
  if(!validateStep(currentIndex)) return;

  if(currentIndex === 0){
    document.getElementById('err-email-dup').classList.remove('show');
    const email = document.getElementById('email').value.trim();
    const original = btnNext.textContent;
    btnNext.disabled = true;
    setLoadingLabel(btnNext, "Verifica in corso");
    const state = await confirmSignup(email);
    btnNext.disabled = false;
    btnNext.textContent = original;
    if(state === 'yes'){
      document.getElementById('err-email-dup').classList.add('show');
      setInvalid(document.getElementById('email'), true);
      return;
    }
  }

  const idx = findStep(currentIndex, 1);
  if(idx < scenes.length) goTo(idx, 1);
});

btnBack.addEventListener('click', () => {
  const idx = findStep(currentIndex, -1);
  if(idx >= 0) goTo(idx, -1);
});

form.querySelectorAll('input[name="conferma"], input[name="veterano"]').forEach(r => {
  r.addEventListener('change', refreshFlow);
});

// ---- Invio ------------------------------------------------------------------
function buildPayload(){
  const attending = isAttending();
  const contributi = Array.from(form.querySelectorAll('input[name="contributo"]:checked')).map(c => c.value);
  const confermaMap = {si:"Sì", no:"No", forse:"Forse (tendente al sì)", zonzo:"Sarò a zonzo per il mondo"};
  return {
    email: document.getElementById('email').value.trim(),
    nome: document.getElementById('nome').value.trim(),
    conferma: confermaMap[form.querySelector('input[name="conferma"]:checked').value],
    partecipazione: form.querySelector('input[name="partecipazione"]:checked').value,
    plus1nome: document.getElementById('plus1nome').value.trim(),
    veterano: form.querySelector('input[name="veterano"]:checked').value === "si" ? "Sì" : "No",
    indicazioni: attending ? form.querySelector('input[name="indicazioni"]:checked').value : "",
    intolleranze: attending ? document.getElementById('intolleranze').value.trim() : "",
    contributo: attending ? contributi.join(", ") : "",
    dettaglio: attending ? document.getElementById('dettaglio').value.trim() : "",
    sacchetto: attending && document.getElementById('sacchetto').checked ? "Sì" : "No",
    quota: attending ? formatEuro(quotaFor(plus1Radio.checked)) : "—",
    metodoPagamento: !attending ? "—"
      : (form.querySelector('input[name="metodo_pagamento"]:checked').value === "contanti"
          ? "Contanti alla serata" : "Online (PayPal/Satispay)"),
    timestamp: new Date().toISOString()
  };
}

function gcalLink(){
  const clean = s => (s || "").replace(/[-:]/g, "");
  const start = clean(CONFIG.EVENT_START);
  let dates = "";
  if(start.length === 8){
    const d = new Date(CONFIG.EVENT_START + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    dates = start + "/" + d.toISOString().slice(0,10).replace(/-/g, "");
  } else if(start.length >= 13){
    const end = clean(CONFIG.EVENT_END) || start;
    dates = start.slice(0,15) + "/" + end.slice(0,15);
  } else {
    return "";
  }
  const p = new URLSearchParams({action:"TEMPLATE", text:CONFIG.EVENT_TITLE, dates:dates});
  if(CONFIG.EVENT_LOCATION) p.set("location", CONFIG.EVENT_LOCATION);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

function showResult(payload, opts){
  opts = opts || {};
  clearProgress();
  const attending = isAttending();
  document.getElementById('reel').classList.add('hidden');
  reelLabel.classList.add('hidden');
  form.classList.add('hidden');

  const successScreen = document.getElementById('successScreen');
  const stamp = document.getElementById('successStamp');
  const stampInk = document.getElementById('stampInk');
  const sTitle = document.getElementById('successTitle');
  const sText = document.getElementById('successText');
  const sPay = document.getElementById('successPay');
  const sNote = document.getElementById('successNote');
  const calLink = document.getElementById('calLink');
  const downloadBtn = document.getElementById('downloadReminderBtn');

  window.__lastPayload = payload;

  // Testi schermata finale
  const href = gcalLink();
  if(href){ calLink.href = href; calLink.hidden = false; } else { calLink.hidden = true; }
  sPay.hidden = true;
  sNote.hidden = true;
  downloadBtn.hidden = !attending;

  if(!attending){
    stamp.textContent = "REGISTRATO";
    stamp.style.borderColor = "var(--parchment-dim)";
    stamp.style.color = "var(--parchment-dim)";
    stampInk.style.borderColor = "var(--parchment-dim)";
    sTitle.textContent = "Ci mancherai!";
    sText.textContent = "Grazie per avercelo fatto sapere. Se cambi idea, riscrivici: alla prossima edizione!";
    calLink.hidden = true;
  } else {
    stamp.textContent = "ISCRITTO";
    stamp.style.borderColor = "var(--basil)";
    stamp.style.color = "var(--basil)";
    stampInk.style.borderColor = "var(--basil)";
    sTitle.textContent = "Ci vediamo il " + CFG_TEXT.dayMonth + "!";
    sText.textContent = "Dopo la serata ti manderemo la galleria fotografica via mail.";
    if(payload.metodoPagamento.indexOf("Online") === 0){
      sPay.textContent = "Puoi versare la quota di " + payload.quota + " con PayPal o Satispay quando ti fa comodo.";
      sPay.hidden = false;
    }
    if(opts.caveat){
      sNote.textContent = "Non siamo riusciti a confermare la ricezione dell'iscrizione. "
        + "Se non ricevi risposta da Arturo entro qualche giorno, riscrivi pure.";
      sNote.hidden = false;
    }
  }

  Motion.finale({
    bake: document.getElementById('bakeScreen'),
    wheel: document.getElementById('pizzaWheel'),
    crumbs: document.getElementById('crumbCanvas'),
    caption: document.getElementById('bakeCaption'),
    skip: document.getElementById('skipBtn'),
    success: successScreen,
    stage: successScreen,
    stamp: stamp,
    ink: stampInk,
    reveal: [sTitle, successScreen.querySelector('.success-body'), calLink, downloadBtn]
  }, {
    intro: "Sfornata al momento...",
    outro: attending ? "...ma finita in un lampo, fetta dopo fetta." : "...ma stavolta senza di te."
  });
}

// ---- Promemoria scaricabile (PDF) -------------------------------------------
// integrity (SRI): se il file sul CDN non corrisponde all'hash, il browser non lo esegue.
function loadScript(src, integrity){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('Impossibile caricare ' + src)); };
    document.head.appendChild(s);
  });
}

let libsPromise = null;
function ensureReminderLibs(){
  if(!libsPromise){
    libsPromise = Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA=='),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js',
        'sha512-plOdviVmws4Y3JAvbnpfKb2hVxKM1lCwsi3vmElYRj+tiDLffZ4FVUj5a8vyKJ9pIgl8JCAHEJ4D1iUKBecswg==')
    ]).catch(err => { libsPromise = null; throw err; });   // al prossimo clic si riprova
  }
  return libsPromise;
}

function formatEventWhen(){
  if(!CONFIG.EVENT_START) return '';
  const d = new Date(CONFIG.EVENT_START);
  if(isNaN(d.getTime())) return CONFIG.EVENT_START;
  const dateStr = d.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const cap = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  if(CONFIG.EVENT_START.indexOf('T') === -1) return cap;
  const timeStr = d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  return cap + ', dalle ' + timeStr;
}

function formatPorti(payload){
  const list = (payload.contributo || '').split(',').map(s => s.trim()).filter(Boolean);
  const meaningful = list.filter(x => x && x !== 'Nessuno');
  if(meaningful.length){
    let txt = meaningful.join(', ');
    if(payload.dettaglio) txt += ' — ' + payload.dettaglio;
    return txt;
  }
  return 'Qualcosa da condividere (ma è una scelta facoltativa)';
}

function fillReminderCard(payload){
  document.getElementById('rem-nome').textContent = payload.nome || 'un ospite';
  document.getElementById('rem-quando').textContent = formatEventWhen();
  document.getElementById('rem-dove').textContent = CONFIG.EVENT_LOCATION || '[luogo da definire]';
  document.getElementById('rem-quota').textContent = payload.quota;
  document.getElementById('rem-porti').textContent = formatPorti(payload);

  const online = payload.metodoPagamento.indexOf('Online') === 0;
  document.getElementById('rem-pay-section').hidden = !online;
  document.getElementById('rem-cash-note').hidden = online;
}

const downloadReminderBtn = document.getElementById('downloadReminderBtn');
downloadReminderBtn.addEventListener('click', async () => {
  const payload = window.__lastPayload;
  if(!payload) return;
  const original = downloadReminderBtn.textContent;
  downloadReminderBtn.disabled = true;
  downloadReminderBtn.textContent = 'Preparazione…';
  try{
    await ensureReminderLibs();
    fillReminderCard(payload);
    await new Promise(r => setTimeout(r, 60)); // lascia assestare il layout
    const card = document.getElementById('reminderCard');
    const canvas = await html2canvas(card, {scale:2, backgroundColor:'#17141a'});
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:'pt', format:'a5', compress:true});   // ~125 KB invece di ~5 MB
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.addImage(imgData, 'PNG', 0, 0, pageW, pageH);
    doc.save('PizzaParty-promemoria.pdf');
  }catch(err){
    alert("Non sono riuscito a generare il promemoria. Riprova, oppure usa \"Stampa\" > \"Salva come PDF\" dal browser su questa pagina.");
  }finally{
    downloadReminderBtn.disabled = false;
    downloadReminderBtn.textContent = original;
  }
});

async function submitPayload(payload){
  let networkError = false;
  if(SCRIPT_READY){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {"Content-Type": "text/plain"},
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(t);
    }catch(err){
      networkError = true;
    }
  }

  // Conferma best-effort: l'endpoint POST è "no-cors" e non leggibile,
  // quindi verifichiamo l'esito interrogando il backend.
  let state = SCRIPT_READY ? await confirmSignup(payload.email) : 'unknown';
  if(state === 'no'){
    await new Promise(r => setTimeout(r, 1400));
    state = await confirmSignup(payload.email);
  }

  if(state === 'yes'){
    showResult(payload, {});
    return;
  }
  if(state === 'no'){
    submitBtn.disabled = false;
    submitBtn.textContent = "Prenota il tuo posto";
    formError.textContent = networkError
      ? "Sembra esserci un problema di connessione. Controlla la rete e riprova, oppure scrivi ad Arturo."
      : "Non siamo riusciti a registrare l'iscrizione. Riprova tra poco, oppure scrivi ad Arturo.";
    formError.classList.add('show');
    return;
  }
  // state === 'unknown' : mostriamo comunque l'esito, con avviso
  showResult(payload, {caveat: SCRIPT_READY});
}

form.addEventListener('submit', function(e){
  e.preventDefault();
  formError.classList.remove('show');

  // validazione finale
  let valid = validateStep(0);
  const attending = isAttending();
  if(attending && !accettoCheck.checked){
    document.getElementById('err-accetto').classList.add('show');
    valid = false;
  } else {
    document.getElementById('err-accetto').classList.remove('show');
  }
  if(!valid){
    // riporta l'utente alla prima scena se il problema è lì
    if(!validateStep(0) && currentIndex !== 0) goTo(0, -1);
    return;
  }

  const payload = buildPayload();

  // anti-spam: honeypot + invio troppo rapido
  const trap = document.getElementById('website').value.trim();
  const tooFast = (Date.now() - formStartedAt) < 3000;
  if(trap || tooFast){
    showResult(payload, {});   // finto successo, nessun invio
    return;
  }

  submitBtn.disabled = true;
  setLoadingLabel(submitBtn, "Invio in corso");
  submitPayload(payload);
});

// Recapito nell'informativa: l'indirizzo è composto qui e non compare
// intero nell'HTML, così è meno esposto ai bot che raccolgono email.
document.querySelectorAll('.contact-email').forEach(a => {
  const addr = a.dataset.user + '@' + a.dataset.domain;
  a.href = 'mailto:' + addr + '?subject=' + encodeURIComponent('PizzaParty – i miei dati');
  a.textContent = addr;
});

// init
Motion.flame(document.querySelector('.hero'));
updatePlus1(false);
refreshFlow();
restoreProgress();
