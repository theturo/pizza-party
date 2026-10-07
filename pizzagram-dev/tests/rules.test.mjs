// Test delle regole di sicurezza contro gli emulatori Firestore + Storage.
// Avvio: npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, writeBatch,
  serverTimestamp, Timestamp, increment, deleteField
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const CODE = 'pizza-2026';
const EXPIRE = Timestamp.fromDate(new Date('2026-11-10T00:00:00Z'));
const POST = 'AbCdEfGhIjKlMnOpQrSt';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pizzagram',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 }
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'invites', CODE), {});
    await setDoc(doc(db, 'admins', 'boss'), {});
    for (const uid of ['alice', 'bob', 'boss']) {
      await setDoc(doc(db, 'members', uid), { nickname: uid, code: CODE, joinedAt: Timestamp.now(), expireAt: EXPIRE });
    }
  });
});

const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const st = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();
const member = (nickname, code = CODE) => ({ nickname, code, joinedAt: serverTimestamp(), expireAt: EXPIRE });

function post(uid, id = POST, extra = {}) {
  return {
    uid, nickname: uid, caption: 'Margherita!',
    takenAt: Timestamp.now(), sortAt: Timestamp.now(), createdAt: serverTimestamp(),
    url: 'https://example/full', thumbUrl: 'https://example/thumb',
    path: `photos/${uid}/${id}.jpg`, thumbPath: `photos/${uid}/${id}_t.jpg`,
    w: 1080, h: 810, likes: {}, commentCount: 0, expireAt: EXPIRE, hdUrl: null, ...extra
  };
}
// Prenotazione della foto come fa l'app: contatore +1 e ID del post in arrivo.
function reserve(uid, id = POST, count = 1) {
  return updateDoc(doc(db(uid), 'members', uid), { postCount: count, pendingPost: id });
}
async function seedMember(uid, extra) {
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), 'members', uid), extra));
}

async function seedPost(uid = 'alice', extra = {}) {
  await env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), 'posts', POST), { ...post(uid), createdAt: Timestamp.now(), ...extra }));
}

// ---------- Ingresso ----------
test('entra con codice valido', async () => {
  await assertSucceeds(setDoc(doc(db('newbie'), 'members', 'newbie'), member('Newbie')));
});
test('codice sbagliato rifiutato', async () => {
  await assertFails(setDoc(doc(db('newbie'), 'members', 'newbie'), member('Newbie', 'sbagliato')));
});
test('codice con slash rifiutato (niente path injection)', async () => {
  await assertFails(setDoc(doc(db('newbie'), 'members', 'newbie'), member('Newbie', `../invites/${CODE}`)));
});
test('non si entra a nome di un altro uid', async () => {
  await assertFails(setDoc(doc(db('newbie'), 'members', 'other'), member('Newbie')));
});
test('nickname troppo corto o lungo rifiutato', async () => {
  await assertFails(setDoc(doc(db('n1'), 'members', 'n1'), member('A')));
  await assertFails(setDoc(doc(db('n2'), 'members', 'n2'), member('x'.repeat(25))));
});
test('si cambia solo il proprio nickname', async () => {
  await assertSucceeds(updateDoc(doc(db('alice'), 'members', 'alice'), { nickname: 'Alice B' }));
  await assertFails(updateDoc(doc(db('alice'), 'members', 'alice'), { code: 'altro' }));
  await assertFails(updateDoc(doc(db('bob'), 'members', 'alice'), { nickname: 'Hacker' }));
});
test('i codici invito non sono leggibili', async () => {
  await assertFails(getDoc(doc(db('alice'), 'invites', CODE)));
  await assertFails(getDocs(collection(db('alice'), 'invites')));
});

// ---------- Post ----------
test('il non membro non legge né pubblica', async () => {
  await seedPost();
  await assertFails(getDoc(doc(db('stranger'), 'posts', POST)));
  await assertFails(getDoc(doc(db(null), 'posts', POST)));
  await assertFails(setDoc(doc(db('stranger'), 'posts', 'ZZZZZZZZZZZZZZZZZZZZ'), post('stranger', 'ZZZZZZZZZZZZZZZZZZZZ')));
});
test('il membro pubblica un post valido dopo averlo prenotato', async () => {
  await assertSucceeds(reserve('alice'));
  await assertSucceeds(setDoc(doc(db('alice'), 'posts', POST), post('alice')));
});
test('senza prenotazione (o con un altro ID) il post è rifiutato', async () => {
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice')));
  await assertSucceeds(reserve('alice', 'ZZZZZZZZZZZZZZZZZZZZ'));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice')));
});
test('prenotazione: +1 alla volta, massimo 150, solo per sé, ID valido e nuovo', async () => {
  await assertFails(reserve('alice', POST, 2));
  await assertFails(reserve('alice', 'corto'));
  await assertFails(updateDoc(doc(db('bob'), 'members', 'alice'), { postCount: 1, pendingPost: POST }));
  await assertFails(updateDoc(doc(db('alice'), 'members', 'alice'), { postCount: 1, pendingPost: POST, nickname: 'Altro' }));
  await seedMember('alice', { postCount: 149 });
  await assertSucceeds(reserve('alice', POST, 150));
  await assertFails(reserve('alice', 'ZZZZZZZZZZZZZZZZZZZZ', 151));
  await seedPost('bob');
  await seedMember('bob', { postCount: 3 });
  await assertFails(reserve('bob', POST, 4)); // il post esiste già
});
test('post a nome di altri / percorso sbagliato / like precaricati rifiutati', async () => {
  await reserve('alice');
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('bob')));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { path: 'photos/bob/x.jpg' })));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { likes: { bob: 'bob' } })));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { commentCount: 99 })));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { extra: 1 })));
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { hdUrl: 'https://x' })));
});
test('versione HD: solo l’autore, una volta sola', async () => {
  await seedPost();
  await assertFails(updateDoc(doc(db('bob'), 'posts', POST), { hdUrl: 'https://example/hd' }));
  await assertFails(updateDoc(doc(db('alice'), 'posts', POST), { hdUrl: 42 }));
  await assertSucceeds(updateDoc(doc(db('alice'), 'posts', POST), { hdUrl: 'https://example/hd' }));
  await assertFails(updateDoc(doc(db('alice'), 'posts', POST), { hdUrl: 'https://example/altra' }));
});
test('post datato nel futuro (per restare in cima) rifiutato', async () => {
  await reserve('alice');
  const future = Timestamp.fromMillis(Date.now() + 3 * 3600e3);
  await assertFails(setDoc(doc(db('alice'), 'posts', POST), post('alice', POST, { sortAt: future })));
});
test('like: solo il proprio', async () => {
  await seedPost();
  await assertSucceeds(updateDoc(doc(db('bob'), 'posts', POST), { 'likes.bob': 'bob' }));
  await assertSucceeds(updateDoc(doc(db('bob'), 'posts', POST), { 'likes.bob': deleteField() }));
  await assertFails(updateDoc(doc(db('bob'), 'posts', POST), { 'likes.alice': 'alice' }));
  await assertFails(updateDoc(doc(db('bob'), 'posts', POST), { 'likes.bob': 'bob', caption: 'hack' }));
});
test('il post si modifica solo per like/commenti', async () => {
  await seedPost();
  await assertFails(updateDoc(doc(db('alice'), 'posts', POST), { caption: 'nuova' }));
  await assertFails(updateDoc(doc(db('alice'), 'posts', POST), { commentCount: 5 }));
});
test('elimina: autore e admin sì, altri no', async () => {
  await seedPost();
  await assertFails(deleteDoc(doc(db('bob'), 'posts', POST)));
  await assertSucceeds(deleteDoc(doc(db('alice'), 'posts', POST)));
  await seedPost();
  await assertSucceeds(deleteDoc(doc(db('boss'), 'posts', POST)));
});

// ---------- Commenti ----------
function comment(uid, text = 'Buonissima') {
  return { uid, nickname: uid, text, createdAt: serverTimestamp(), expireAt: EXPIRE };
}
test('commento insieme all’incremento del contatore', async () => {
  await seedPost();
  const d = db('bob');
  const b = writeBatch(d);
  b.set(doc(d, 'posts', POST, 'comments', 'c1'), comment('bob'));
  b.update(doc(d, 'posts', POST), { commentCount: increment(1) });
  await assertSucceeds(b.commit());
});
test('commento senza incremento rifiutato', async () => {
  await seedPost();
  await assertFails(setDoc(doc(db('bob'), 'posts', POST, 'comments', 'c1'), comment('bob')));
});
test('commento vuoto o troppo lungo rifiutato', async () => {
  await seedPost();
  for (const text of ['', 'x'.repeat(301)]) {
    const d = db('bob');
    const b = writeBatch(d);
    b.set(doc(d, 'posts', POST, 'comments', 'c1'), comment('bob', text));
    b.update(doc(d, 'posts', POST), { commentCount: increment(1) });
    await assertFails(b.commit());
  }
});
test('cancellazione commento: autore, autore del post, admin; non altri', async () => {
  await seedPost('alice', { commentCount: 1 });
  await env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), 'posts', POST, 'comments', 'c1'), { ...comment('bob'), createdAt: Timestamp.now() }));
  const del = uid => {
    const d = db(uid);
    const b = writeBatch(d);
    b.delete(doc(d, 'posts', POST, 'comments', 'c1'));
    b.update(doc(d, 'posts', POST), { commentCount: increment(-1) });
    return b.commit();
  };
  await assertFails(del('stranger'));
  await assertFails(del('boss2'));
  await assertSucceeds(del('alice'));
});
test('admin elimina post con i commenti in un batch', async () => {
  await seedPost('alice', { commentCount: 1 });
  await env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), 'posts', POST, 'comments', 'c1'), { ...comment('bob'), createdAt: Timestamp.now() }));
  const d = db('boss');
  const b = writeBatch(d);
  b.delete(doc(d, 'posts', POST, 'comments', 'c1'));
  b.delete(doc(d, 'posts', POST));
  await assertSucceeds(b.commit());
});

// ---------- Profili pubblici ----------
test('profilo: ognuno scrive il proprio, gli invitati lo leggono', async () => {
  const prof = (extra = {}) => ({ nickname: 'Alice', avatar: 'margherita', updatedAt: serverTimestamp(), expireAt: EXPIRE, ...extra });
  await assertSucceeds(setDoc(doc(db('alice'), 'profiles', 'alice'), prof()));
  await assertSucceeds(setDoc(doc(db('alice'), 'profiles', 'alice'), prof({ avatar: null })));
  await assertFails(setDoc(doc(db('bob'), 'profiles', 'alice'), prof()));
  await assertFails(setDoc(doc(db('stranger'), 'profiles', 'stranger'), prof()));
  await assertFails(setDoc(doc(db('alice'), 'profiles', 'alice'), prof({ avatar: '<svg onload=x>' })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', 'alice'), prof({ nickname: 'A' })));
  await assertFails(setDoc(doc(db('alice'), 'profiles', 'alice'), prof({ code: 'pizza' })));
  await assertSucceeds(getDocs(collection(db('bob'), 'profiles')));
  await assertFails(getDocs(collection(db('stranger'), 'profiles')));
});

// ---------- Album via mail ----------
test('email album: la scrive il membro, la legge solo admin', async () => {
  const data = { email: 'a@b.it', nickname: 'alice', updatedAt: serverTimestamp(), expireAt: EXPIRE };
  await assertSucceeds(setDoc(doc(db('alice'), 'albumRequests', 'alice'), data));
  await assertFails(setDoc(doc(db('alice'), 'albumRequests', 'alice'), { ...data, email: 'non-email' }));
  await assertFails(getDocs(collection(db('alice'), 'albumRequests')));
  await assertFails(getDoc(doc(db('bob'), 'albumRequests', 'alice')));
  await assertSucceeds(getDocs(collection(db('boss'), 'albumRequests')));
});
test('admin: ognuno vede solo se stesso', async () => {
  await assertSucceeds(getDoc(doc(db('boss'), 'admins', 'boss')));
  await assertSucceeds(getDoc(doc(db('alice'), 'admins', 'alice')));
  await assertFails(getDocs(collection(db('alice'), 'admins')));
  await assertFails(setDoc(doc(db('alice'), 'admins', 'alice'), {}));
});

// ---------- Storage ----------
const jpeg = (n = 1000) => new Uint8Array(n).fill(7);
test('storage: il membro carica i file della foto prenotata', async () => {
  await reserve('alice');
  await assertSucceeds(uploadBytes(ref(st('alice'), `photos/alice/${POST}.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await assertSucceeds(uploadBytes(ref(st('alice'), `photos/alice/${POST}_t.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await assertSucceeds(uploadBytes(ref(st('alice'), `photos/alice/${POST}_hd.jpg`), jpeg(), { contentType: 'image/jpeg' }));
});
test('storage: senza prenotazione no; HD di un proprio post già pubblicato sì', async () => {
  await assertFails(uploadBytes(ref(st('alice'), `photos/alice/${POST}.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await seedPost('alice');
  await assertSucceeds(uploadBytes(ref(st('alice'), `photos/alice/${POST}_hd.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  // Il post è di Alice: Bob non può caricarci file nella propria cartella con quell'ID
  await assertFails(uploadBytes(ref(st('bob'), `photos/bob/${POST}_hd.jpg`), jpeg(), { contentType: 'image/jpeg' }));
});
test('storage: rifiuta cartelle altrui, non membri, tipi e dimensioni sbagliate', async () => {
  await reserve('alice');
  await assertFails(uploadBytes(ref(st('alice'), `photos/bob/${POST}.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(st('stranger'), `photos/stranger/${POST}.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(st('alice'), `photos/alice/${POST}.jpg`), jpeg(), { contentType: 'video/mp4' }));
  await assertFails(uploadBytes(ref(st('alice'), `photos/alice/evil.html`), jpeg(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(st('alice'), `photos/alice/${POST}.jpg`), jpeg(8.5 * 1024 * 1024), { contentType: 'image/jpeg' }));
});
test('storage: lettura solo membri; cancellazione autore o admin', async () => {
  await env.withSecurityRulesDisabled(ctx =>
    uploadBytes(ref(ctx.storage(), `photos/alice/${POST}.jpg`), jpeg(), { contentType: 'image/jpeg' }));
  await assertSucceeds(getBytes(ref(st('bob'), `photos/alice/${POST}.jpg`)));
  await assertFails(getBytes(ref(st('stranger'), `photos/alice/${POST}.jpg`)));
  await assertFails(deleteObject(ref(st('bob'), `photos/alice/${POST}.jpg`)));
  await assertSucceeds(deleteObject(ref(st('boss'), `photos/alice/${POST}.jpg`)));
});
