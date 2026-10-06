import { FIREBASE, EVENT } from './config.js';
import * as fb from './vendor/firebase.js';
import { prepareImage } from './lib/image.js';
import { ZipWriter } from './lib/zip.js';
import { playIntro } from './lib/intro.js';

// ====== Ambiente ======
// In locale (npm run dev in pizzagram-dev) l'app parla con gli emulatori Firebase.
const EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname);
const FIREBASE_CONFIG = EMULATOR
  ? { apiKey: 'demo', authDomain: 'demo-pizzagram.firebaseapp.com', projectId: 'demo-pizzagram',
      storageBucket: 'demo-pizzagram.appspot.com', appId: 'demo' }
  : FIREBASE;
const CONFIGURED = EMULATOR || !Object.values(FIREBASE).some(v => String(v).includes('INCOLLA_QUI'));

const EVENT_START = new Date(EVENT.START);
const EXPIRE_DATE = new Date(EVENT_START);
EXPIRE_DATE.setDate(EXPIRE_DATE.getDate() + EVENT.RETENTION_DAYS);
const NICK_MIN = 2, NICK_MAX = 24;
const CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;
const PAGE = 15;

// localStorage può mancare (navigazione privata): l'app funziona comunque.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } }
};

// ====== Stato ======
const state = {
  user: null,
  nick: '',
  code: '',
  isAdmin: false,
  joining: false,
  order: store.get('pg_order') === 'asc' ? 'asc' : 'desc',
  limit: PAGE,
  posts: [],
  byId: new Map(),
  hasMore: false,
  loadingMore: false,
  feedLoaded: false,
  view: 'feed',
  wantAlbum: false,
  uploads: [],
  actionPost: null,
  commentsPost: null,
  modalPost: null
};
let app, auth, db, storage;
let unsubFeed = null, unsubMine = null, unsubComments = null;

// ====== Utilità ======

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const SVG_NS = 'http://www.w3.org/2000/svg';

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid)); // sempre testo: niente HTML dagli utenti
  }
  return el;
}

function icon(name, cls = 'ic') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

const AVATAR_COLORS = ['#d24a30', '#c99a1e', '#5c8a4a', '#ff8a4d', '#8a5cc2', '#3d8fb0', '#c2477f'];
function avatar(uid, nick, cls = 'avatar') {
  let hash = 0;
  for (const ch of uid || nick || '?') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const el = h('div', { class: cls, 'aria-hidden': 'true' }, (nick || '?').trim().charAt(0).toUpperCase());
  el.style.setProperty('--av', AVATAR_COLORS[hash % AVATAR_COLORS.length]);
  return el;
}
function paintAvatar(el, uid, nick) {
  const fresh = avatar(uid, nick, el.className);
  el.textContent = fresh.textContent;
  el.style.setProperty('--av', fresh.style.getPropertyValue('--av'));
}

const pad = n => String(n).padStart(2, '0');
const toDate = v => (v && typeof v.toDate === 'function' ? v.toDate() : v instanceof Date ? v : null);
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const longDayFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

// Orario mostrato sul post: la sera della festa basta l'ora, altrimenti la data.
function formatWhen(post) {
  const taken = toDate(post.takenAt);
  const d = taken || toDate(post.createdAt) || new Date();
  const party = new Date(EVENT_START.getTime() - 6 * 3600e3); // la "serata" inizia nel pomeriggio
  const sameNight = d >= party && d - party < 24 * 3600e3;
  const label = sameNight ? 'alle ' + timeFmt.format(d) : sameDay(d, new Date()) ? 'oggi alle ' + timeFmt.format(d) : dayFmt.format(d);
  return (taken ? 'scattata ' : 'caricata ') + label;
}

function ago(d) {
  if (!d) return 'ora';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'ora';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  return Math.floor(s / 86400) + ' g';
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function errorMessage(err, fallback) {
  const code = err && err.code || '';
  if (code.includes('permission-denied') || code.includes('unauthorized')) return 'Operazione non consentita.';
  if (code.includes('unavailable') || code.includes('retry-limit') || !navigator.onLine) return 'Connessione assente: riprova tra poco.';
  return fallback;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  if (label) btn.textContent = label;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copia questo testo:', text);
    return false;
  }
}

// ====== Schermate e pannelli ======
function showScreen(id) {
  for (const s of ['boot', 'setup', 'join', 'app']) $('#' + s).hidden = s !== id;
}

function openSheet(id) {
  const el = $('#' + id);
  el.hidden = false;
  document.body.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('open'));
}
function closeSheet(id) {
  const el = $('#' + id);
  if (el.hidden) return;
  el.classList.remove('open');
  const done = () => {
    el.hidden = true;
    if (!$$('.sheet:not([hidden]), .fullsheet:not([hidden])').length) document.body.classList.remove('locked');
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
  else setTimeout(done, 220);
  if (id === 'comments') { unsubComments?.(); unsubComments = null; state.commentsPost = null; }
  if (id === 'post-modal') { state.modalPost = null; $('#post-modal-body').textContent = ''; }
}

function showView(view) {
  if (state.view === view && view === 'feed') window.scrollTo({ top: 0, behavior: 'smooth' });
  state.view = view;
  for (const v of ['feed', 'grid', 'profile']) $('#view-' + v).hidden = v !== view;
  $$('.tabbar [data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
  });
  $('#sort-btn').hidden = view === 'profile';
  if (view === 'profile') loadProfileExtras();
}

// ====== Avvio ======
// Informativa privacy: un solo modello, inserito all'ingresso e nel profilo.
function mountPrivacy() {
  const tpl = $('#privacy-tpl');
  $$('[data-privacy]').forEach(slot => slot.replaceWith(tpl.content.cloneNode(true)));
  // L'indirizzo è composto qui e non compare intero nell'HTML (meno esposto ai bot).
  $$('.contact-email').forEach(a => {
    const addr = a.dataset.user + '@' + a.dataset.domain;
    a.href = 'mailto:' + addr + '?subject=' + encodeURIComponent('Pizzagram – i miei dati');
    a.textContent = addr;
  });
}

function applyConfigText() {
  const end = longDayFmt.format(EXPIRE_DATE);
  const date = [EVENT_START.getDate(), EVENT_START.getMonth() + 1].map(pad).join(' · ') + ' · ' + EVENT_START.getFullYear();
  $$('[data-cfg="retentionEnd"]').forEach(el => { el.textContent = end; });
  $$('[data-cfg="eventDate"]').forEach(el => { el.textContent = date; });
  $$('[data-cfg="retentionDays"]').forEach(el => { el.textContent = String(EVENT.RETENTION_DAYS); });
}

// Animazione d'avvio: completa la prima volta, più svelta le successive; ?intro=0 la salta (test).
// Una volta per sessione: ricaricare la pagina (o "Aggiorna" dal banner) non la ripete.
function startIntro() {
  const root = $('#intro');
  let shown = false;
  try { shown = sessionStorage.getItem('pg_intro_session') === '1'; } catch { /* ignora */ }
  if (shown || new URLSearchParams(location.search).get('intro') === '0') { root.hidden = true; return; }
  playIntro(root, { fast: store.get('pg_intro_seen') === '1' })
    .then(() => {
      store.set('pg_intro_seen', '1');
      try { sessionStorage.setItem('pg_intro_session', '1'); } catch { /* ignora */ }
    })
    .catch(() => { root.hidden = true; });
}

function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const code = params.get('c');
  if (code) store.set('pg_code', code.trim());
  if (params.has('album')) state.wantAlbum = true;
  // Il codice non resta nella barra degli indirizzi (screenshot, condivisioni).
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

function initFirebase() {
  app = fb.initializeApp(FIREBASE_CONFIG);
  auth = fb.initializeAuth(app, { persistence: [fb.indexedDBLocalPersistence, fb.browserLocalPersistence] });
  let localCache;
  try {
    localCache = fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() });
  } catch {
    localCache = fb.memoryLocalCache();
  }
  db = fb.initializeFirestore(app, { localCache });
  storage = fb.getStorage(app);
  storage.maxUploadRetryTime = 5 * 60 * 1000;
  if (EMULATOR) {
    fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fb.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    fb.connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
}

// Service worker: apertura veloce con rete scarsa e avviso quando esce una nuova versione.
// (In locale con gli emulatori è spento; ?sw=1 lo attiva per provarlo.)
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (EMULATOR && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Le app sulla Home restano aperte a lungo: si controlla al ritorno in primo piano
    // e ogni mezz'ora, non solo all'avvio.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => { /* l'app funziona anche senza */ });

  // Il nuovo service worker prende il controllo da solo (skipWaiting), ma la pagina aperta
  // usa ancora i file vecchi: si propone di ricaricare. Al primo avvio non c'è nulla da aggiornare.
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) $('#update-banner').hidden = false;
    controlled = true;
  });
}

function applyUpdate() {
  if (state.uploads.some(u => ['wait', 'prep', 'up', 'save'].includes(u.status))) {
    toast('Aspetta che finiscano i caricamenti, poi aggiorna.');
    return;
  }
  location.reload();
}

async function main() {
  startIntro();
  mountPrivacy();
  applyConfigText();
  bindUi();
  readHash();
  if (!CONFIGURED) { showScreen('setup'); return; }
  registerServiceWorker();
  initFirebase();
  fb.onAuthStateChanged(auth, onAuth);
}

async function onAuth(user) {
  if (state.joining) return;
  state.user = user;
  if (!user) { showJoin(); return; }
  try {
    const snap = await fb.getDoc(fb.doc(db, 'members', user.uid));
    if (snap.exists()) {
      state.code = snap.data().code;
      enterApp(snap.data().nickname);
      return;
    }
  } catch {
    // Offline al primo avvio: se eravamo già dentro, si riparte dal nickname salvato.
    const nick = store.get('pg_nick');
    if (nick) { enterApp(nick); return; }
  }
  showJoin();
}

// ====== Ingresso ======
function showJoin() {
  const code = store.get('pg_code') || '';
  $('#join-code').value = code;
  // Arrivati dal QR il codice è già noto: si chiede solo il nickname.
  $('#code-field').hidden = CODE_RE.test(code);
  if (state.wantAlbum && CODE_RE.test(code)) {
    $('#join-nick').placeholder = 'il tuo nome, per entrare';
  }
  showScreen('join');
}

async function join(e) {
  e.preventDefault();
  const btn = $('#join-btn');
  const err = $('#join-error');
  const code = $('#join-code').value.trim();
  const nick = $('#join-nick').value.trim().replace(/\s+/g, ' ');
  err.textContent = '';
  if (!CODE_RE.test(code)) {
    $('#code-field').hidden = false;
    err.textContent = 'Inserisci il codice invito che trovi sotto il QR all\'ingresso.';
    return;
  }
  if (nick.length < NICK_MIN || nick.length > NICK_MAX) {
    err.textContent = `Il nickname deve avere da ${NICK_MIN} a ${NICK_MAX} caratteri.`;
    return;
  }
  state.joining = true;
  setBusy(btn, true, 'Un attimo…');
  try {
    const user = auth.currentUser || (await fb.signInAnonymously(auth)).user;
    state.user = user;
    await fb.setDoc(fb.doc(db, 'members', user.uid), {
      nickname: nick, code, joinedAt: fb.serverTimestamp(), expireAt: fb.Timestamp.fromDate(EXPIRE_DATE)
    });
    store.set('pg_code', code);
    state.code = code;
    enterApp(nick);
  } catch (ex) {
    const denied = (ex.code || '').includes('permission-denied');
    if (denied) $('#code-field').hidden = false;
    err.textContent = denied
      ? 'Codice invito non valido: controlla quello sotto il QR all\'ingresso.'
      : errorMessage(ex, 'Qualcosa è andato storto, riprova.');
  } finally {
    state.joining = false;
    setBusy(btn, false, 'Entra');
  }
}

function enterApp(nick) {
  state.nick = nick;
  store.set('pg_nick', nick);
  showScreen('app');
  showView('feed');
  renderMe();
  updateSortLabel();
  subscribeFeed();
  subscribeMine();
  checkAdmin();
  resumeHd();
  setupInstallCard();
  if (state.wantAlbum) {
    state.wantAlbum = false;
    openAlbum();
  }
}

function renderMe() {
  $('#me-nick').textContent = state.nick;
  $('#nick-input').value = state.nick;
  paintAvatar($('#me-avatar'), state.user?.uid, state.nick);
  paintAvatar($('#comment-avatar'), state.user?.uid, state.nick);
  $('#device-id').textContent = state.user?.uid || '';
}

async function checkAdmin() {
  try {
    const snap = await fb.getDoc(fb.doc(db, 'admins', state.user.uid));
    state.isAdmin = snap.exists();
  } catch {
    state.isAdmin = false;
  }
  $('#admin-card').hidden = !state.isAdmin;
  if (state.isAdmin && state.view === 'profile') loadAdminStats();
  renderFeed();
}

// ====== Feed ======
function subscribeFeed() {
  unsubFeed?.();
  const q = fb.query(fb.collection(db, 'posts'), fb.orderBy('sortAt', state.order), fb.limit(state.limit));
  unsubFeed = fb.onSnapshot(q, snap => {
    state.posts = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
    state.byId = new Map(state.posts.map(p => [p.id, p]));
    state.hasMore = snap.size >= state.limit;
    state.loadingMore = false;
    state.feedLoaded = true;
    renderFeed();
    renderGrid();
    if (state.modalPost) renderModal();
  }, () => {
    state.loadingMore = false;
    toast('Feed non raggiungibile: controlla la connessione.');
  });
}

// Aggiornamento manuale (trascina giù o tocca il logo): il feed è già in tempo reale,
// ma dopo ore in background la connessione può essersi addormentata. Si riparte dalla
// prima pagina e si controlla anche se c'è una nuova versione dell'app.
async function refreshFeed() {
  state.limit = PAGE;
  subscribeFeed();
  navigator.serviceWorker?.getRegistration().then(r => r && r.update()).catch(() => {});
  await new Promise(r => setTimeout(r, 800));
  toast('Feed aggiornato');
}

function setupPullToRefresh() {
  const ptr = $('#ptr');
  const MAX = 96, TRIGGER = 64;
  let startY = null, pull = 0, busy = false;
  const render = () => {
    ptr.style.transform = `translate(-50%, ${pull - 56}px) rotate(${pull * 4}deg)`;
    ptr.style.opacity = String(Math.min(1, pull / TRIGGER));
    ptr.classList.toggle('ready', pull >= TRIGGER);
  };
  const canStart = () => !busy && state.view === 'feed' && window.scrollY <= 0
    && !$('#app').hidden && !document.body.classList.contains('locked');
  window.addEventListener('touchstart', e => {
    startY = canStart() && e.touches.length === 1 ? e.touches[0].clientY : null;
    pull = 0;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    pull = dy > 0 && window.scrollY <= 0 ? Math.min(MAX, dy * 0.5) : 0;
    ptr.classList.add('dragging');
    render();
  }, { passive: true });
  window.addEventListener('touchend', async () => {
    if (startY == null) return;
    startY = null;
    ptr.classList.remove('dragging');
    if (pull >= TRIGGER) {
      busy = true;
      pull = TRIGGER;
      render();
      ptr.classList.add('spinning');
      await refreshFeed();
      ptr.classList.remove('spinning');
      busy = false;
    }
    pull = 0;
    render();
  });
  render();
}

function loadMore() {
  if (!state.hasMore || state.loadingMore) return;
  state.loadingMore = true;
  state.limit += PAGE;
  subscribeFeed();
}

function updateSortLabel() {
  $('#sort-label').textContent = state.order === 'desc' ? 'Più recenti' : 'Dall\'inizio';
}

function toggleOrder() {
  state.order = state.order === 'desc' ? 'asc' : 'desc';
  store.set('pg_order', state.order);
  state.limit = PAGE;
  updateSortLabel();
  window.scrollTo({ top: 0 });
  subscribeFeed();
  toast(state.order === 'desc' ? 'Prima le foto più recenti' : 'La serata dall\'inizio, in ordine di scatto');
}

const feedCards = new Map();

function buildCard(post) {
  const refs = {};
  refs.avatar = avatar(post.uid, post.nickname);
  refs.when = h('span', { class: 'post-when' });
  refs.more = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Altre azioni',
    onclick: () => openActions(post.id) }, icon('more'));

  refs.img = h('img', { alt: 'Foto di ' + post.nickname, loading: 'lazy', decoding: 'async', src: post.url });
  refs.img.addEventListener('load', () => refs.media.classList.add('loaded'), { once: true });
  refs.burst = h('div', { class: 'burst', 'aria-hidden': 'true' }, icon('pizza-on', 'burst-ic'));
  refs.media = h('div', { class: 'post-media' }, refs.img, refs.burst);
  const ratio = Math.min(1.91, Math.max(0.8, (post.w || 4) / (post.h || 5)));
  refs.media.style.aspectRatio = String(ratio);
  let lastTap = 0;
  refs.media.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap < 320) { likePost(post.id, true); popBurst(refs.burst); lastTap = 0; }
    else lastTap = now;
  });

  refs.like = h('button', { class: 'icon-btn like-btn', type: 'button', 'aria-label': 'Mi piace',
    onclick: () => likePost(post.id) }, icon('pizza'));
  refs.comment = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Commenta',
    onclick: () => openComments(post.id) }, icon('comment'));
  refs.likes = h('div', { class: 'post-likes' });
  refs.caption = post.caption
    ? h('p', { class: 'post-caption' }, h('b', null, post.nickname), ' ', post.caption)
    : null;
  refs.comments = h('button', { class: 'post-comments-link', type: 'button', onclick: () => openComments(post.id) });

  const el = h('article', { class: 'post', 'data-id': post.id },
    h('header', { class: 'post-head' }, refs.avatar,
      h('div', { class: 'post-who' }, h('span', { class: 'post-user' }, post.nickname), refs.when), refs.more),
    refs.media,
    h('div', { class: 'post-actions' }, refs.like, refs.comment),
    refs.likes, refs.caption, refs.comments);
  return { el, refs };
}

function updateCard(card, post) {
  const { refs } = card;
  const uid = state.user?.uid;
  const likes = post.likes || {};
  const liked = !!likes[uid];
  const count = Object.keys(likes).length;
  refs.like.classList.toggle('on', liked);
  refs.like.setAttribute('aria-pressed', String(liked));
  refs.like.firstChild.firstChild.setAttribute('href', liked ? '#i-pizza-on' : '#i-pizza');
  refs.when.textContent = formatWhen(post);
  refs.more.hidden = !(post.uid === uid || state.isAdmin);

  refs.likes.textContent = '';
  if (count) {
    const others = Object.entries(likes).filter(([k]) => k !== uid).map(([, v]) => v);
    const first = liked ? 'te' : others[0];
    const rest = count - 1;
    refs.likes.append('🍕 Piace a ', h('b', null, first));
    if (rest > 0) refs.likes.append(' e ', h('b', null, rest === 1 ? (liked ? others[0] : '1 altra persona') : `altre ${rest} persone`));
  }
  refs.likes.hidden = !count;

  const n = post.commentCount || 0;
  refs.comments.textContent = n === 0 ? 'Aggiungi un commento…'
    : n === 1 ? 'Visualizza 1 commento' : `Visualizza tutti i ${n} commenti`;
}

function renderList(container, items, cache, build, update) {
  const seen = new Set();
  let prev = null;
  for (const item of items) {
    seen.add(item.id);
    let entry = cache.get(item.id);
    if (!entry) { entry = build(item); cache.set(item.id, entry); }
    update(entry, item);
    const expected = prev ? prev.nextSibling : container.firstChild;
    if (expected !== entry.el) container.insertBefore(entry.el, expected);
    prev = entry.el;
  }
  for (const [id, entry] of cache) {
    if (!seen.has(id)) { entry.el.remove(); cache.delete(id); }
  }
}

function renderFeed() {
  renderList($('#feed'), state.posts, feedCards, buildCard, updateCard);
  $('#feed-empty').hidden = !state.feedLoaded || state.posts.length > 0;
}

function popBurst(el) {
  el.classList.remove('pop');
  void el.offsetWidth; // riavvia l'animazione
  el.classList.add('pop');
}

async function likePost(id, onlyAdd = false) {
  const post = state.byId.get(id);
  const uid = state.user?.uid;
  if (!post || !uid) return;
  const liked = !!(post.likes || {})[uid];
  if (onlyAdd && liked) return;
  try {
    await fb.updateDoc(fb.doc(db, 'posts', id), { ['likes.' + uid]: liked ? fb.deleteField() : state.nick });
  } catch (ex) {
    toast(errorMessage(ex, 'Like non salvato, riprova.'));
  }
}

// ====== Album (griglia) ======
const gridItems = new Map();
const myGridItems = new Map();

function buildTile(post) {
  const img = h('img', { alt: 'Foto di ' + post.nickname, loading: 'lazy', decoding: 'async', src: post.thumbUrl });
  const el = h('button', { class: 'tile', type: 'button', onclick: () => openModal(post.id) }, img);
  return { el };
}

function renderGrid() {
  renderList($('#grid'), state.posts, gridItems, buildTile, () => {});
}

function subscribeMine() {
  unsubMine?.();
  const q = fb.query(fb.collection(db, 'posts'), fb.where('uid', '==', state.user.uid));
  unsubMine = fb.onSnapshot(q, snap => {
    const mine = snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
      .sort((a, b) => toDate(b.sortAt) - toDate(a.sortAt));
    for (const p of mine) if (!state.byId.has(p.id)) state.byId.set(p.id, p);
    renderList($('#my-grid'), mine, myGridItems, buildTile, () => {});
    $('#me-count').textContent = mine.length === 1 ? '1 foto pubblicata' : `${mine.length} foto pubblicate`;
  }, () => {});
}

function openModal(id) {
  state.modalPost = id;
  renderModal();
  openSheet('post-modal');
}

let modalCard = null;
function renderModal() {
  const post = state.byId.get(state.modalPost);
  const body = $('#post-modal-body');
  if (!post) { closeSheet('post-modal'); return; }
  if (!modalCard || modalCard.id !== post.id) {
    modalCard = { id: post.id, ...buildCard(post) };
    body.textContent = '';
    body.append(modalCard.el);
  }
  updateCard(modalCard, post);
}

// ====== Azioni sul post ======
function openActions(id) {
  state.actionPost = id;
  openSheet('actions');
}

async function deletePost() {
  const id = state.actionPost;
  const post = state.byId.get(id);
  closeSheet('actions');
  if (!post || !confirm('Eliminare questo post? Non si può annullare.')) return;
  try {
    const comments = await fb.getDocs(fb.collection(db, 'posts', id, 'comments'));
    const batch = fb.writeBatch(db);
    comments.forEach(c => batch.delete(c.ref));
    batch.delete(fb.doc(db, 'posts', id));
    await batch.commit();
    dropHd(id);
    await Promise.allSettled([
      fb.deleteObject(fb.ref(storage, post.path)),
      fb.deleteObject(fb.ref(storage, post.thumbPath)),
      fb.deleteObject(fb.ref(storage, post.path.replace(/\.jpg$/, '_hd.jpg')))
    ]);
    if (state.modalPost === id) closeSheet('post-modal');
    toast('Post eliminato.');
  } catch (ex) {
    toast(errorMessage(ex, 'Non sono riuscito a eliminare il post.'));
  }
}

// ====== Commenti ======
function openComments(id) {
  const post = state.byId.get(id);
  if (!post) return;
  state.commentsPost = id;
  const list = $('#comments-list');
  list.textContent = '';
  const head = post.caption
    ? h('div', { class: 'comment comment-caption' }, avatar(post.uid, post.nickname),
        h('div', { class: 'comment-body' }, h('b', null, post.nickname), ' ', post.caption))
    : null;
  const items = h('div');
  const empty = h('p', { class: 'muted center' }, 'Ancora nessun commento. Rompi il ghiaccio!');
  list.append(...[head, items, empty].filter(Boolean));
  openSheet('comments');

  unsubComments?.();
  const q = fb.query(fb.collection(db, 'posts', id, 'comments'), fb.orderBy('createdAt', 'asc'));
  unsubComments = fb.onSnapshot(q, snap => {
    items.textContent = '';
    empty.hidden = snap.size > 0;
    snap.docs.forEach(d => {
      const c = d.data({ serverTimestamps: 'estimate' });
      const p = state.byId.get(id);
      const canDelete = c.uid === state.user.uid || state.isAdmin || (p && p.uid === state.user.uid);
      items.append(h('div', { class: 'comment' }, avatar(c.uid, c.nickname),
        h('div', { class: 'comment-body' }, h('b', null, c.nickname), ' ', c.text,
          h('div', { class: 'comment-meta' }, ago(toDate(c.createdAt)),
            canDelete ? h('button', { class: 'link', type: 'button', onclick: () => deleteComment(id, d.id) }, 'Elimina') : null))));
    });
    list.scrollTop = list.scrollHeight;
  }, () => toast('Commenti non disponibili offline.'));
}

async function addComment(e) {
  e.preventDefault();
  const input = $('#comment-input');
  const text = input.value.trim();
  const id = state.commentsPost;
  if (!text || !id) return;
  input.value = '';
  const batch = fb.writeBatch(db);
  batch.set(fb.doc(fb.collection(db, 'posts', id, 'comments')), {
    uid: state.user.uid, nickname: state.nick, text: text.slice(0, 300),
    createdAt: fb.serverTimestamp(), expireAt: fb.Timestamp.fromDate(EXPIRE_DATE)
  });
  batch.update(fb.doc(db, 'posts', id), { commentCount: fb.increment(1) });
  try {
    await batch.commit();
  } catch (ex) {
    input.value = text;
    toast(errorMessage(ex, 'Commento non pubblicato, riprova.'));
  }
}

async function deleteComment(postId, commentId) {
  if (!confirm('Eliminare il commento?')) return;
  const batch = fb.writeBatch(db);
  batch.delete(fb.doc(db, 'posts', postId, 'comments', commentId));
  batch.update(fb.doc(db, 'posts', postId), { commentCount: fb.increment(-1) });
  try {
    await batch.commit();
  } catch (ex) {
    toast(errorMessage(ex, 'Non sono riuscito a eliminare il commento.'));
  }
}

// ====== Nuovo post ======
let composerItems = [];

function pickFiles() {
  openSheet('picker');
}

// L'input va "cliccato" dentro il tocco dell'utente, altrimenti il browser lo blocca.
function pickFrom(inputId) {
  closeSheet('picker');
  $('#' + inputId).click();
}

function onFilesPicked(e) {
  const files = [...e.target.files].filter(f => !f.type || f.type.startsWith('image/'));
  e.target.value = '';
  if (!files.length) return;
  if (files.length > EVENT.MAX_PER_BATCH) toast(`Massimo ${EVENT.MAX_PER_BATCH} foto alla volta: tengo le prime.`);
  composerItems = files.slice(0, EVENT.MAX_PER_BATCH).map(file => ({ file, caption: '', preview: URL.createObjectURL(file) }));
  renderComposer();
  openSheet('composer');
}

function renderComposer() {
  const list = $('#composer-list');
  list.textContent = '';
  if (!composerItems.length) { closeComposer(); return; }
  composerItems.forEach((item, i) => {
    const img = h('img', { alt: '', src: item.preview });
    img.addEventListener('error', () => img.replaceWith(h('div', { class: 'no-preview' }, 'Anteprima non disponibile')), { once: true });
    const caption = h('textarea', { maxlength: '300', rows: '2', placeholder: 'Scrivi una didascalia…' });
    caption.value = item.caption;
    caption.addEventListener('input', () => { item.caption = caption.value; });
    list.append(h('div', { class: 'composer-item' }, img,
      h('div', { class: 'composer-side' }, caption,
        h('button', { class: 'link', type: 'button', onclick: () => {
          URL.revokeObjectURL(item.preview);
          composerItems.splice(i, 1);
          renderComposer();
        } }, 'Togli'))));
  });
  $('#composer-publish').textContent = composerItems.length > 1 ? `Pubblica (${composerItems.length})` : 'Pubblica';
}

function closeComposer(keepPreviews = false) {
  if (!keepPreviews) composerItems.forEach(i => URL.revokeObjectURL(i.preview));
  composerItems = [];
  closeSheet('composer');
}

function publish() {
  const items = composerItems.map(i => ({
    file: i.file, caption: i.caption.trim().slice(0, 300), preview: i.preview,
    status: 'wait', progress: 0, done: {}
  }));
  closeComposer(true);
  state.uploads.push(...items);
  showView('feed');
  renderUploads();
  runUploads();
}

let uploading = false;
async function runUploads() {
  if (uploading) return;
  uploading = true;
  try {
    let item;
    // Una alla volta: con la rete mobile in sala è più affidabile del parallelo.
    while ((item = state.uploads.find(u => u.status === 'wait'))) await uploadOne(item);
  } finally {
    uploading = false;
  }
}

function putFile(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const task = fb.uploadBytesResumable(fb.ref(storage, path), blob, {
      contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable'
    });
    task.on('state_changed', s => onProgress(s.bytesTransferred), reject,
      () => fb.getDownloadURL(task.snapshot.ref).then(resolve, reject));
  });
}

// Messaggi per i problemi con il file della foto (vedi lib/image.js); tra parentesi tipo e
// peso, utili per capire il caso se qualcuno lo segnala.
function uploadErrorText(ex) {
  const info = ex && ex.fileInfo ? ` (${ex.fileInfo})` : '';
  switch (ex && ex.message) {
    case 'empty': return 'La foto non è ancora sul telefono: aprila prima in Galleria/Foto' + info;
    case 'read': return 'Non riesco a leggere la foto dal telefono' + info;
    case 'decode': return 'Formato della foto non supportato' + info;
    case 'encode': return 'Il telefono non è riuscito a preparare la foto';
    default: return errorMessage(ex, 'Caricamento non riuscito');
  }
}

async function uploadOne(item) {
  const uid = state.user.uid;
  try {
    item.status = 'prep';
    renderUploads();
    if (!item.prepared) {
      item.prepared = await prepareImage(item.file, { feedSize: EVENT.FEED_SIZE, thumbSize: EVENT.THUMB_SIZE, hdSize: EVENT.HD_SIZE });
    }
    const { feed: full, thumb, w, h: height } = item.prepared;
    item.postId ||= fb.doc(fb.collection(db, 'posts')).id;
    const base = `photos/${uid}/${item.postId}`;
    const total = full.size + thumb.size;
    item.status = 'up';
    renderUploads();
    // Ogni file si carica una volta sola (le regole vietano di sovrascrivere).
    const sent = { full: item.done.full ? full.size : 0, thumb: item.done.thumb ? thumb.size : 0 };
    const progress = () => { item.progress = (sent.full + sent.thumb) / total; renderUploadProgress(item); };
    if (!item.done.thumb) item.done.thumb = await putFile(base + '_t.jpg', thumb, b => { sent.thumb = b; progress(); });
    if (!item.done.full) item.done.full = await putFile(base + '.jpg', full, b => { sent.full = b; progress(); });

    const now = Date.now();
    let taken = item.prepared.takenAt;
    if (!taken && item.file.lastModified && now - item.file.lastModified < 365 * 86400e3) taken = new Date(item.file.lastModified);
    if (taken && taken.getTime() > now + 5 * 60e3) taken = null; // orologio sballato
    item.status = 'save';
    renderUploads();
    await fb.setDoc(fb.doc(db, 'posts', item.postId), {
      uid, nickname: state.nick, caption: item.caption,
      takenAt: taken ? fb.Timestamp.fromDate(taken) : null,
      sortAt: fb.Timestamp.fromDate(taken || new Date(now)),
      createdAt: fb.serverTimestamp(),
      url: item.done.full, thumbUrl: item.done.thumb,
      path: base + '.jpg', thumbPath: base + '_t.jpg',
      w, h: height, likes: {}, commentCount: 0,
      expireAt: fb.Timestamp.fromDate(EXPIRE_DATE), hdUrl: null
    });
    // La foto è già nel feed; la versione HD per l'album parte dopo, senza fretta.
    queueHd({ postId: item.postId, uid, blob: item.prepared.hd });
    item.prepared = null;
    item.status = 'done';
    renderUploads();
    setTimeout(() => {
      URL.revokeObjectURL(item.preview);
      state.uploads = state.uploads.filter(u => u !== item);
      renderUploads();
    }, 1500);
  } catch (ex) {
    item.status = 'error';
    item.error = uploadErrorText(ex);
    renderUploads();
  }
}

// ====== Versione HD in background ======
// Le foto HD (per l'album scaricabile) aspettano in IndexedDB finché non sono inviate:
// se l'app viene chiusa, ripartono alla prossima apertura.
const hdStore = {
  db: null,
  open() {
    this.db ||= new Promise((resolve, reject) => {
      const req = indexedDB.open('pizzagram', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('hd');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('hd', mode);
      const req = fn(tx.objectStore('hd'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  put(job) { return this.run('readwrite', s => s.put(job, job.postId)).catch(() => {}); },
  del(id) { return this.run('readwrite', s => s.delete(id)).catch(() => {}); },
  all() { return this.run('readonly', s => s.getAll()).catch(() => []); }
};

const hdQueue = [];
let hdRunning = false, hdRetry = 0;

function queueHd(job) {
  hdQueue.push(job);
  hdStore.put(job);
  renderUploads();
  runHd();
}

async function resumeHd() {
  for (const job of await hdStore.all()) {
    if (job.uid === state.user.uid && !hdQueue.some(j => j.postId === job.postId)) hdQueue.push(job);
  }
  renderUploads();
  runHd();
}

async function uploadHd(job) {
  const path = `photos/${job.uid}/${job.postId}_hd.jpg`;
  let url;
  try {
    url = await putFile(path, job.blob, () => {});
  } catch (ex) {
    // Già caricata in un tentativo precedente (sovrascrivere è vietato): basta l'indirizzo.
    url = await fb.getDownloadURL(fb.ref(storage, path)).catch(() => null);
    if (!url) throw ex;
  }
  try {
    await fb.updateDoc(fb.doc(db, 'posts', job.postId), { hdUrl: url });
  } catch (ex) {
    const code = ex.code || '';
    if (code.includes('not-found')) await fb.deleteObject(fb.ref(storage, path)).catch(() => {}); // post eliminato nel frattempo
    else if (!code.includes('permission-denied')) throw ex; // permission-denied: HD già registrata
  }
}

async function runHd() {
  if (hdRunning) return;
  hdRunning = true;
  try {
    while (hdQueue.length) {
      // Prima si pubblicano le foto nuove, poi le HD.
      if (uploading) { await new Promise(r => setTimeout(r, 1500)); continue; }
      const job = hdQueue[0];
      try {
        await uploadHd(job);
      } catch {
        // Rete assente o instabile: si riprova tra 20 secondi o appena torna la rete.
        clearTimeout(hdRetry);
        hdRetry = setTimeout(runHd, 20000);
        return;
      }
      hdQueue.shift();
      await hdStore.del(job.postId);
      renderUploads();
    }
  } finally {
    hdRunning = false;
  }
}

function dropHd(postId) {
  const i = hdQueue.findIndex(j => j.postId === postId);
  if (i > 0) hdQueue.splice(i, 1); // l'eventuale primo è già in invio: ci pensa uploadHd
  hdStore.del(postId);
}

const UPLOAD_LABEL = { wait: 'In coda', prep: 'Preparo la foto…', up: 'Caricamento', save: 'Pubblico…', done: 'Pubblicata!' };

function renderUploads() {
  const box = $('#uploads');
  box.textContent = '';
  box.hidden = !state.uploads.length && !hdQueue.length;
  if (hdQueue.length) {
    const n = hdQueue.length;
    box.append(h('div', { class: 'upload upload-hd' },
      h('span', { class: 'hd-badge' }, 'HD'),
      h('span', null, `${n === 1 ? '1 foto' : n + ' foto'} in alta qualità per l'album: si inviano da sole, ` +
        'anche alla prossima apertura dell\'app.')));
  }
  for (const item of state.uploads) {
    const bar = h('div', { class: 'progress' }, h('div', { class: 'progress-bar' }));
    item.bar = bar.firstChild;
    const status = item.status === 'error'
      ? h('span', { class: 'upload-error' }, item.error + ' · ',
          h('button', { class: 'link link-strong', type: 'button', onclick: () => { item.status = 'wait'; runUploads(); renderUploads(); } }, 'Riprova'),
          ' · ',
          h('button', { class: 'link', type: 'button', onclick: () => {
            URL.revokeObjectURL(item.preview);
            state.uploads = state.uploads.filter(u => u !== item);
            renderUploads();
          } }, 'Annulla'))
      : h('span', null, UPLOAD_LABEL[item.status] || '');
    const thumb = h('img', { alt: '', src: item.preview });
    thumb.addEventListener('error', () => { thumb.style.visibility = 'hidden'; }, { once: true });
    box.append(h('div', { class: 'upload ' + item.status }, thumb, h('div', { class: 'upload-info' }, status, bar)));
    renderUploadProgress(item);
  }
}

function renderUploadProgress(item) {
  if (!item.bar) return;
  const pct = item.status === 'done' || item.status === 'save' ? 1 : item.status === 'up' ? item.progress : 0;
  item.bar.style.width = Math.round(pct * 100) + '%';
}

// ====== Profilo ======
async function saveNick(e) {
  e.preventDefault();
  const nick = $('#nick-input').value.trim().replace(/\s+/g, ' ');
  if (nick === state.nick) return;
  if (nick.length < NICK_MIN || nick.length > NICK_MAX) {
    toast(`Il nickname deve avere da ${NICK_MIN} a ${NICK_MAX} caratteri.`);
    return;
  }
  try {
    await fb.updateDoc(fb.doc(db, 'members', state.user.uid), { nickname: nick });
    state.nick = nick;
    store.set('pg_nick', nick);
    renderMe();
    toast('Nickname aggiornato.');
  } catch (ex) {
    toast(errorMessage(ex, 'Nickname non salvato.'));
  }
}

let profileLoaded = false;
async function loadProfileExtras() {
  if (state.isAdmin) loadAdminStats();
  if (profileLoaded) return;
  profileLoaded = true;
  try {
    const snap = await fb.getDoc(fb.doc(db, 'albumRequests', state.user.uid));
    if (snap.exists()) {
      $('#email-input').value = snap.data().email;
      $('#email-status').textContent = 'Ok, ti scriveremo a questo indirizzo.';
    }
  } catch { /* offline: pazienza */ }
}

async function saveEmail(e) {
  e.preventDefault();
  const email = $('#email-input').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Controlla l\'indirizzo email.'); return; }
  const btn = $('#email-btn');
  setBusy(btn, true);
  try {
    await fb.setDoc(fb.doc(db, 'albumRequests', state.user.uid), {
      email, nickname: state.nick, updatedAt: fb.serverTimestamp(), expireAt: fb.Timestamp.fromDate(EXPIRE_DATE)
    });
    $('#email-status').textContent = 'Ok, ti scriveremo a questo indirizzo.';
    toast('Fatto! Riceverai il link all\'album.');
  } catch (ex) {
    toast(errorMessage(ex, 'Email non salvata, riprova.'));
  } finally {
    setBusy(btn, false);
  }
}

// ====== Installazione ======
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  setupInstallCard();
});

function setupInstallCard() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const card = $('#install-card');
  if (standalone) { card.hidden = true; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  card.hidden = false;
  $('#install-btn').hidden = !installEvent;
  $('#install-text').textContent = installEvent
    ? 'Aggiungi Pizzagram alla schermata Home: si apre come un\'app, a tutto schermo.'
    : ios
      ? 'In Safari tocca Condividi (il quadrato con la freccia) e poi «Aggiungi alla schermata Home».'
      : 'Dal menu del browser scegli «Aggiungi a schermata Home» o «Installa app».';
}

async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  setupInstallCard();
}

// ====== Admin ======
async function loadAdminStats() {
  try {
    const [posts, members, emails] = await Promise.all([
      fb.getCountFromServer(fb.collection(db, 'posts')),
      fb.getCountFromServer(fb.collection(db, 'members')),
      fb.getCountFromServer(fb.collection(db, 'albumRequests'))
    ]);
    $('#admin-stats').textContent =
      `${posts.data().count} foto · ${members.data().count} invitati entrati · ${emails.data().count} email per l'album`;
  } catch {
    $('#admin-stats').textContent = 'Statistiche non disponibili offline.';
  }
}

async function copyAdminEmails() {
  try {
    const snap = await fb.getDocs(fb.collection(db, 'albumRequests'));
    const list = [...new Set(snap.docs.map(d => d.data().email.toLowerCase()))];
    if (!list.length) { toast('Ancora nessuna email.'); return; }
    if (await copyText(list.join(', '))) toast(`${list.length} indirizzi copiati: incollali in Ccn.`);
  } catch (ex) {
    toast(errorMessage(ex, 'Email non disponibili.'));
  }
}

async function copyAlbumLink() {
  const link = `${location.origin}${location.pathname}#album&c=${encodeURIComponent(state.code)}`;
  if (await copyText(link)) toast('Link all\'album copiato.');
}

// ====== Download album ======
const ALBUM_TEXT = 'Prepariamo un file ZIP con tutte le foto in alta qualità, in ordine di scatto. ' +
  'Meglio farlo con il Wi-Fi: può pesare qualche centinaio di MB.';
// Oltre questa dimensione lo ZIP si divide in più parti: i telefoni tengono tutto in memoria.
// (In locale ?zippart=N imposta la soglia in byte, per provare la divisione.)
const ALBUM_PART_MAX = (EMULATOR && Number(new URLSearchParams(location.search).get('zippart'))) || 180 * 1048576;

function openAlbum() {
  $('#album-progress').hidden = true;
  $('#album-start').hidden = false;
  $('#album-save').hidden = true;
  $('#album-text').textContent = ALBUM_TEXT;
  openSheet('album');
}

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'ospite';

// Mostra il pulsante per salvare una parte; se non è l'ultima, aspetta che venga toccato.
function offerAlbumPart(blob, part, last) {
  const save = $('#album-save');
  const old = save.href;
  if (old) setTimeout(() => URL.revokeObjectURL(old), 60000);
  save.href = URL.createObjectURL(blob);
  const single = last && part === 1;
  save.download = single ? 'PizzaParty-Pizzagram.zip' : `PizzaParty-Pizzagram-parte-${part}.zip`;
  save.lastChild.textContent = single ? ' Salva lo ZIP' : ` Salva la parte ${part}`;
  save.hidden = false;
  if (last) return Promise.resolve();
  return new Promise(resolve => save.addEventListener('click', () => {
    save.hidden = true;
    setTimeout(resolve, 300);
  }, { once: true }));
}

async function buildAlbum() {
  const start = $('#album-start');
  const text = $('#album-text');
  const bar = $('#album-progress .progress-bar');
  start.hidden = true;
  $('#album-save').hidden = true;
  $('#album-progress').hidden = false;
  bar.style.width = '0%';
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(db, 'posts'), fb.orderBy('sortAt', 'asc')));
    const posts = snap.docs.map(d => d.data());
    if (!posts.length) throw new Error('empty');

    // Si scarica qualche foto in anticipo, ma si aggiungono allo ZIP sempre in ordine.
    const pending = new Map();
    const fetchAt = i => fetch(posts[i].hdUrl || posts[i].url)
      .then(res => { if (!res.ok) throw new Error('fetch'); return res.arrayBuffer(); })
      .then(buf => new Uint8Array(buf));
    let zip = new ZipWriter(), part = 1;
    for (let i = 0; i < posts.length; i++) {
      for (let k = i; k < Math.min(posts.length, i + 4); k++) if (!pending.has(k)) pending.set(k, fetchAt(k));
      const bytes = await pending.get(i);
      pending.delete(i);
      const p = posts[i];
      const d = toDate(p.sortAt) || new Date();
      const name = `${String(i + 1).padStart(3, '0')}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}_${slug(p.nickname)}.jpg`;
      zip.add(name, bytes, d);
      bar.style.width = Math.round((i + 1) / posts.length * 100) + '%';
      text.textContent = `Scarico le foto: ${i + 1} di ${posts.length}…`;

      const last = i === posts.length - 1;
      if (last || zip.offset >= ALBUM_PART_MAX) {
        const blob = zip.finish();
        const mb = (blob.size / 1048576).toFixed(0);
        text.textContent = last
          ? (part === 1
            ? `Pronto: ${posts.length} foto, ${mb} MB.`
            : `Ultima parte pronta (${mb} MB): ${posts.length} foto in ${part} file.`)
          : `Parte ${part} pronta (${mb} MB). Salvala: poi preparo la successiva.`;
        await offerAlbumPart(blob, part, last);
        zip = new ZipWriter();
        part++;
      }
    }
  } catch (ex) {
    start.hidden = false;
    $('#album-progress').hidden = true;
    text.textContent = ex.message === 'empty'
      ? 'Non ci sono ancora foto da scaricare.'
      : 'Download interrotto: controlla la connessione e riprova.';
  }
}

// ====== Eventi ======
function bindUi() {
  $('#join-form').addEventListener('submit', join);
  $('#sort-btn').addEventListener('click', toggleOrder);
  $$('.tabbar [data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'upload') pickFiles();
    if (action === 'album') openAlbum();
    const closer = e.target.closest('[data-close]');
    if (closer) {
      const sheet = closer.closest('.sheet, .fullsheet');
      if (sheet.id === 'composer') closeComposer();
      else closeSheet(sheet.id);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $$('.sheet:not([hidden]), .fullsheet:not([hidden])').pop();
    if (open) open.id === 'composer' ? closeComposer() : closeSheet(open.id);
  });
  $('#file-input').addEventListener('change', onFilesPicked);
  $('#camera-input').addEventListener('change', onFilesPicked);
  $('#pick-camera').addEventListener('click', () => pickFrom('camera-input'));
  $('#pick-gallery').addEventListener('click', () => pickFrom('file-input'));
  $('#composer-publish').addEventListener('click', publish);
  $('#comment-form').addEventListener('submit', addComment);
  $('#action-delete').addEventListener('click', deletePost);
  $('#nick-form').addEventListener('submit', saveNick);
  $('#email-form').addEventListener('submit', saveEmail);
  $('#install-btn').addEventListener('click', install);
  $('#admin-emails').addEventListener('click', copyAdminEmails);
  $('#admin-link').addEventListener('click', copyAlbumLink);
  $('#album-start').addEventListener('click', buildAlbum);
  $('#update-btn').addEventListener('click', applyUpdate);
  $('.topbar .logo').addEventListener('click', () => {
    if (state.view !== 'feed') showView('feed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshFeed();
  });
  setupPullToRefresh();

  const io = new IntersectionObserver(entries => {
    if (entries.some(en => en.isIntersecting)) loadMore();
  }, { rootMargin: '800px 0px' });
  io.observe($('#feed-more'));
  io.observe($('#grid-more'));

  window.addEventListener('online', () => { if (state.user && hdQueue.length) runHd(); });

  window.addEventListener('beforeunload', e => {
    if (state.uploads.some(u => ['wait', 'prep', 'up', 'save'].includes(u.status))) e.preventDefault();
  });
}

main();
