// ====== CONFIGURAZIONE PIZZAGRAM ======
// Dati del progetto Firebase: Console Firebase → Impostazioni progetto → Le tue app → App web.
// Non sono segreti (finiscono comunque nel browser): la protezione è nelle regole di sicurezza.
export const FIREBASE = {
  apiKey: "AIzaSyBPRrBdgRcTUemUQZ87iCiozBh364w67Uc",
  authDomain: "pizzagram-9fe92.firebaseapp.com",
  projectId: "pizzagram-9fe92",
  storageBucket: "pizzagram-9fe92.firebasestorage.app",
  messagingSenderId: "591830021990",
  appId: "1:591830021990:web:9f9090551bafc0a1c67aa7"
};

export const EVENT = {
  // Inizio della festa: usato per i testi e per calcolare la data di cancellazione.
  START: "2026-10-10T19:30",
  // Giorni dopo la festa in cui foto e commenti restano online.
  RETENTION_DAYS: 30,
  // Fine dei caricamenti (foto e commenti): mezzanotte tra il 12 e il 13 ottobre, ora italiana.
  // Il blocco vero è nelle regole Firebase (storage.rules e firestore.rules): tenere allineati.
  UPLOAD_UNTIL: "2026-10-13T00:00",
  // Foto che ogni invitato può pubblicare (anche questo nelle regole Firebase).
  MAX_POSTS: 150,
  // Foto selezionabili in una volta.
  MAX_PER_BATCH: 10,
  // Lato lungo in pixel delle tre versioni di ogni foto:
  // anteprima per la griglia, versione per il feed (leggera, si pubblica subito)
  // e versione HD per l'album scaricabile (parte in background dopo la pubblicazione).
  THUMB_SIZE: 480,
  FEED_SIZE: 1080,
  HD_SIZE: 2560
};
