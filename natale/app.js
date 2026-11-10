// ====== CONFIGURAZIONE ======
const CONFIG = {
  // URL del Web App di Google Apps Script (vedi ../natale-dev/SETUP.md).
  // Finché resta il segnaposto, la pagina funziona in anteprima e non salva nulla.
  SCRIPT_URL: "INCOLLA_QUI",
  EVENT_TITLE: "Cena di Natale",
  // "AAAA-MM-GG" (giornata intera) oppure "AAAA-MM-GGTHH:mm" (con orario).
  EVENT_START: "2026-12-19T20:00",
  EVENT_END: "2026-12-19T23:30",
  EVENT_LOCATION: "",
  // Quote in euro. Con null la pagina mostra "da definire".
  QUOTA_SINGLE: null,
  QUOTA_PLUS1: null,
  // Giorni dopo la cena entro cui i dati vengono cancellati (informativa privacy).
  RETENTION_DAYS: 30
};
const SCRIPT_URL = CONFIG.SCRIPT_URL;
const SCRIPT_READY = !!SCRIPT_URL && SCRIPT_URL.indexOf("INCOLLA_QUI") === -1;
const LOADING_DOTS_HTML = '<span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
function setLoadingLabel(btn, text){ btn.innerHTML = text + LOADING_DOTS_HTML; }

const formatEuro = n => n == null ? 'da definire' : n + '€';
function quotaFor(plus1){ return plus1 ? CONFIG.QUOTA_PLUS1 : CONFIG.QUOTA_SINGLE; }

// Testi della pagina derivati da CONFIG (elementi con data-cfg="…").
function applyConfigText(){
  const start = new Date(CONFIG.EVENT_START);
  const end = new Date(start); end.setDate(end.getDate() + CONFIG.RETENTION_DAYS);
  const weekdayDate = start.toLocaleDateString('it-IT', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
  const values = {
    weekdayDate: weekdayDate.charAt(0).toUpperCase() + weekdayDate.slice(1),
    dayMonth: start.toLocaleDateString('it-IT', {day: 'numeric', month: 'long'}),
    retentionEnd: end.toLocaleDateString('it-IT', {day: 'numeric', month: 'long', year: 'numeric'}),
    retentionDays: String(CONFIG.RETENTION_DAYS)
  };
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const v = values[el.dataset.cfg];
    if(v) el.textContent = v;
  });
  return values;
}
const CFG_TEXT = applyConfigText();
// ============================

const $ = id => document.getElementById(id);
const form = $('xmasForm');
const card = $('card');
const submitBtn = $('submitBtn');
const formError = $('formError');
const checked = name => (form.querySelector('input[name="' + name + '"]:checked') || {}).value;
// Inizio compilazione, per il filtro anti-bot "invio troppo rapido".
let formStartedAt = Date.now();

$('previewNote').hidden = SCRIPT_READY;

function isAttending(){
  const v = checked('conferma');
  return v === 'si' || v === 'forse';
}
const isPlus1 = () => checked('partecipazione') === 'plus1';

function updateConditionals(){
  Scene.reveal($('attending-wrap'), isAttending());
  Scene.reveal($('plus1-wrap'), isPlus1());
  Scene.reveal($('online-wrap'), checked('metodo_pagamento') === 'online');
  $('quota-amount').textContent = formatEuro(quotaFor(isPlus1()));
}

// ---- Verifica email lato server: 'yes' | 'no' | 'unknown'
async function confirmSignup(email){
  if(!SCRIPT_READY) return 'unknown';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try{
    const res = await fetch(SCRIPT_URL + '?action=checkEmail&email=' + encodeURIComponent(email), {
      signal: ctrl.signal, credentials: 'omit', cache: 'no-store'
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
// Su telefono, aprire il link di pagamento in un'altra scheda può far ricaricare
// questa pagina: sessionStorage permette di ritrovare le risposte al ritorno.
const PROGRESS_KEY = 'cenaNataleProgress';
const TEXT_FIELDS = ['email', 'nome', 'plus1nome', 'dettaglio'];
const RADIO_FIELDS = ['conferma', 'partecipazione', 'metodo_pagamento'];

function saveProgress(){
  try{
    const data = {v: 1, currentIndex, startedAt: formStartedAt, accetto: $('accetto').checked};
    TEXT_FIELDS.forEach(id => { data[id] = $(id).value; });
    RADIO_FIELDS.forEach(n => { data[n] = checked(n); });
    data.contributo = Array.from(form.querySelectorAll('input[name="contributo"]:checked')).map(c => c.value);
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  }catch(e){ /* storage non disponibile: si compila di nuovo */ }
}
function clearProgress(){
  try{ sessionStorage.removeItem(PROGRESS_KEY); }catch(e){}
}
function restoreProgress(){
  let data;
  try{ data = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || 'null'); }catch(e){ data = null; }
  if(!data) return;
  TEXT_FIELDS.forEach(id => { $(id).value = data[id] || ''; });
  RADIO_FIELDS.forEach(n => {
    const el = data[n] && form.querySelector('input[name="' + n + '"][value="' + CSS.escape(data[n]) + '"]');
    if(el) el.checked = true;
  });
  form.querySelectorAll('input[name="contributo"]').forEach(c => {
    c.checked = (data.contributo || []).indexOf(c.value) !== -1;
  });
  $('accetto').checked = !!data.accetto;
  if(typeof data.startedAt === 'number' && data.startedAt <= Date.now()) formStartedAt = data.startedAt;

  const target = Math.max(0, Math.min(data.currentIndex || 0, steps.length - 1));
  if(target > 0 && !isSkipped(steps[target])){
    steps[currentIndex].classList.remove('step-active');
    currentIndex = target;
    steps[currentIndex].classList.add('step-active');
  }
  if(currentIndex > 0 || data.email || data.nome){
    const note = $('restoreNote');
    note.classList.add('show');
    setTimeout(() => note.classList.remove('show'), 8000);
  }
}
form.addEventListener('input', saveProgress);
form.addEventListener('change', saveProgress);

// ---- Passi -----------------------------------------------------------------
const steps = Array.from(document.querySelectorAll('.step'));
const progress = $('progress');
const progressLabel = $('progressLabel');
const stepNav = $('stepNav');
const btnBack = $('btnBack');
const btnNext = $('btnNext');
let currentIndex = 0;

// Chi non viene compila solo il primo passo.
function isSkipped(step){ return step !== steps[0] && !isAttending(); }
function visibleSteps(){ return steps.filter(s => !isSkipped(s)); }
function findStep(fromIndex, direction){
  let i = fromIndex + direction;
  while(steps[i] && isSkipped(steps[i])) i += direction;
  return i;
}

// Una candela per passo: si accendono man mano che si avanza.
function renderProgress(){
  const vis = visibleSteps();
  const cur = vis.indexOf(steps[currentIndex]);
  while(progress.children.length < vis.length) progress.appendChild(Object.assign(document.createElement('span'), {className: 'candle'}));
  while(progress.children.length > vis.length) progress.lastChild.remove();
  Array.from(progress.children).forEach((c, i) => c.classList.toggle('lit', i <= cur));
  const heading = steps[currentIndex].querySelector('h2').textContent.trim();
  progressLabel.textContent = vis.length > 1 ? 'Passo ' + (cur + 1) + ' di ' + vis.length + ' — ' + heading : heading;

  btnBack.disabled = cur <= 0;
  const isLast = cur === vis.length - 1;
  stepNav.style.display = isLast && cur === 0 ? 'none' : 'flex';
  btnNext.style.display = isLast ? 'none' : '';
  submitBtn.style.display = isLast ? 'block' : 'none';
}

function refreshFlow(){
  $('accetto').required = isAttending();
  updateConditionals();
  renderProgress();
}

function setInvalid(el, on){ el.setAttribute('aria-invalid', on ? 'true' : 'false'); }

function validateFirstStep(){
  const emailEl = $('email'), nomeEl = $('nome');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim());
  const nomeOk = nomeEl.value.trim().length > 0;
  $('err-email').classList.toggle('show', !emailOk);
  $('err-nome').classList.toggle('show', !nomeOk);
  setInvalid(emailEl, !emailOk);
  setInvalid(nomeEl, !nomeOk);
  if(!nomeOk) nomeEl.focus(); else if(!emailOk) emailEl.focus();
  return emailOk && nomeOk;
}
['email', 'nome'].forEach(id => {
  $(id).addEventListener('input', e => {
    if(e.target.getAttribute('aria-invalid') !== 'true') return;
    setInvalid(e.target, false);
    $('err-' + id).classList.remove('show');
    if(id === 'email') $('err-email-dup').classList.remove('show');
  });
});

let stepBusy = false;
async function goTo(newIndex, direction){
  if(stepBusy || newIndex === currentIndex) return;
  stepBusy = true;
  const oldStep = steps[currentIndex], newStep = steps[newIndex];
  try{
    await Scene.stepSwap(oldStep, newStep, direction, () => {
      oldStep.classList.remove('step-active');
      newStep.classList.add('step-active');
      currentIndex = newIndex;
      refreshFlow();
      saveProgress();
      // Su telefono il biglietto può essere più in alto dello schermo: lo riportiamo in vista.
      if(card.getBoundingClientRect().top < 0) card.scrollIntoView({behavior: Scene.reduced ? 'auto' : 'smooth', block: 'start'});
      newStep.querySelector('h2').focus({preventScroll: true});
    });
  }finally{
    stepBusy = false;
  }
}

// Controlla che l'email non abbia già risposto. Restituisce false se è un doppione.
async function checkDuplicate(btn){
  $('err-email-dup').classList.remove('show');
  const original = btn.textContent;
  btn.disabled = true;
  setLoadingLabel(btn, "Verifica in corso");
  const state = await confirmSignup($('email').value.trim());
  btn.disabled = false;
  btn.textContent = original;
  if(state !== 'yes') return true;
  $('err-email-dup').classList.add('show');
  setInvalid($('email'), true);
  return false;
}

btnNext.addEventListener('click', async () => {
  if(currentIndex === 0){
    if(!validateFirstStep()) return;
    if(!(await checkDuplicate(btnNext))) return;
  }
  const idx = findStep(currentIndex, 1);
  if(idx < steps.length) goTo(idx, 1);
});
btnBack.addEventListener('click', () => {
  const idx = findStep(currentIndex, -1);
  if(idx >= 0) goTo(idx, -1);
});
form.addEventListener('change', e => {
  if(RADIO_FIELDS.indexOf(e.target.name) !== -1) refreshFlow();
  if(e.target.id === 'accetto') $('err-accetto').classList.remove('show');
  // "Non porto nulla" esclude le altre voci, e viceversa.
  if(e.target.name === 'contributo' && e.target.checked){
    const none = e.target.value === 'Nessuno';
    form.querySelectorAll('input[name="contributo"]').forEach(c => {
      if(c !== e.target && (none || c.value === 'Nessuno')) c.checked = false;
    });
  }
});

// ---- Invio -------------------------------------------------------------------
function buildPayload(){
  const attending = isAttending();
  const contributi = Array.from(form.querySelectorAll('input[name="contributo"]:checked')).map(c => c.value);
  const confermaMap = {si: "Sì", forse: "Forse", no: "No"};
  return {
    email: $('email').value.trim(),
    nome: $('nome').value.trim(),
    conferma: confermaMap[checked('conferma')],
    partecipazione: attending ? checked('partecipazione') : "",
    plus1nome: attending && isPlus1() ? $('plus1nome').value.trim() : "",
    contributo: attending ? contributi.join(", ") : "",
    dettaglio: attending ? $('dettaglio').value.trim() : "",
    quota: attending ? formatEuro(quotaFor(isPlus1())) : "—",
    metodoPagamento: !attending ? "—"
      : (checked('metodo_pagamento') === "contanti" ? "Contanti alla serata" : "Online (PayPal/Satispay)"),
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
    dates = start + "/" + d.toISOString().slice(0, 10).replace(/-/g, "");
  } else if(start.length >= 13){
    const end = clean(CONFIG.EVENT_END) || start;
    dates = start.slice(0, 15) + "/" + end.slice(0, 15);
  } else {
    return "";
  }
  const p = new URLSearchParams({action: "TEMPLATE", text: CONFIG.EVENT_TITLE, dates: dates, ctz: "Europe/Rome"});
  if(CONFIG.EVENT_LOCATION) p.set("location", CONFIG.EVENT_LOCATION);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

function showResult(payload, opts){
  opts = opts || {};
  clearProgress();
  const attending = isAttending();
  const stamp = $('stamp'), sPay = $('successPay'), sNote = $('successNote'), calLink = $('calLink');
  sPay.hidden = true;
  sNote.hidden = true;

  if(!attending){
    stamp.textContent = "ASSENTE GIUSTIFICATO";
    stamp.classList.add('muted');
    $('successTitle').textContent = "Ci mancherai!";
    $('successText').textContent = "Grazie per avercelo fatto sapere. Se cambi idea, scrivi ad Arturo: un posto a tavola si trova sempre.";
    calLink.hidden = true;
  } else {
    stamp.textContent = "CI SARÒ";
    $('successTitle').textContent = "Ci vediamo il " + CFG_TEXT.dayMonth + "!";
    $('successText').textContent = "Il tuo posto a tavola è segnato.";
    if(payload.metodoPagamento.indexOf("Online") === 0 && quotaFor(isPlus1()) != null){
      sPay.textContent = "Puoi versare la quota di " + payload.quota + " con PayPal o Satispay quando ti fa comodo.";
      sPay.hidden = false;
    }
    const href = gcalLink();
    calLink.hidden = !href;
    if(href) calLink.href = href;
  }
  if(opts.caveat){
    sNote.textContent = "Non siamo riusciti a confermare la ricezione della risposta. "
      + "Se non hai notizie da Arturo entro qualche giorno, riscrivi pure.";
    sNote.hidden = false;
  }

  Scene.finale(
    {screen: $('sealScreen'), envelope: $('envelope'), caption: $('sealCaption')},
    ["Pieghiamo il biglietto...", "...lo chiudiamo nella busta...", attending ? "...ed è consegnato!" : "...e ti teniamo il posto per l'anno prossimo."],
    () => {
      form.hidden = true;
      progress.hidden = true;
      progressLabel.hidden = true;
      $('success').hidden = false;
      card.scrollIntoView({behavior: 'auto', block: 'nearest'});
      Scene.popIn(stamp);
      $('successTitle').focus({preventScroll: true});
    });
}

function resetSubmit(){
  submitBtn.disabled = false;
  submitBtn.textContent = "Invia la risposta";
}

async function submitPayload(payload){
  let networkError = false;
  if(SCRIPT_READY){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      await fetch(SCRIPT_URL, {
        method: "POST", mode: "no-cors",
        headers: {"Content-Type": "text/plain"},
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(t);
    }catch(err){
      networkError = true;
    }
  }

  // L'esito del POST "no-cors" non è leggibile: lo verifichiamo interrogando il backend.
  let state = SCRIPT_READY ? await confirmSignup(payload.email) : 'unknown';
  if(state === 'no'){
    await new Promise(r => setTimeout(r, 1400));
    state = await confirmSignup(payload.email);
  }
  if(state === 'no'){
    resetSubmit();
    formError.textContent = networkError
      ? "Sembra esserci un problema di connessione. Controlla la rete e riprova, oppure scrivi ad Arturo."
      : "Non siamo riusciti a registrare la risposta. Riprova tra poco, oppure scrivi ad Arturo.";
    formError.classList.add('show');
    return;
  }
  showResult(payload, {caveat: state === 'unknown' && SCRIPT_READY});
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  formError.classList.remove('show');

  if(!validateFirstStep()){
    if(currentIndex !== 0) goTo(0, -1);
    return;
  }
  const attending = isAttending();
  const missingAccept = attending && !$('accetto').checked;
  $('err-accetto').classList.toggle('show', missingAccept);
  if(missingAccept) return;

  // Chi non viene invia dal primo passo, senza essere passato da "Avanti".
  if(currentIndex === 0 && !(await checkDuplicate(submitBtn))) return;

  const payload = buildPayload();

  // anti-spam: honeypot + invio troppo rapido (finto successo, nessun invio)
  if($('website').value.trim() || (Date.now() - formStartedAt) < 3000){
    showResult(payload, {});
    return;
  }

  submitBtn.disabled = true;
  setLoadingLabel(submitBtn, "Invio in corso");
  submitPayload(payload);
});

// L'indirizzo è composto qui e non compare intero nell'HTML,
// così è meno esposto ai bot che raccolgono email.
document.querySelectorAll('.contact-email').forEach(a => {
  const addr = a.dataset.user + '@' + a.dataset.domain;
  a.href = 'mailto:' + addr + '?subject=' + encodeURIComponent('Cena di Natale – i miei dati');
  a.textContent = addr;
});

// init
restoreProgress();
refreshFlow();
