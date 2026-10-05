// ====== CONFIGURAZIONE PIZZAGRAM ======
// Dati del progetto Firebase: Console Firebase → Impostazioni progetto → Le tue app → App web.
// Non sono segreti (finiscono comunque nel browser): la protezione è nelle regole di sicurezza.
export const FIREBASE = {
  apiKey: "INCOLLA_QUI",
  authDomain: "INCOLLA_QUI.firebaseapp.com",
  projectId: "INCOLLA_QUI",
  storageBucket: "INCOLLA_QUI.firebasestorage.app",
  messagingSenderId: "INCOLLA_QUI",
  appId: "INCOLLA_QUI"
};

export const EVENT = {
  // Inizio della festa: usato per i testi e per calcolare la data di cancellazione.
  START: "2026-10-10T19:30",
  // Giorni dopo la festa in cui foto e commenti restano online.
  RETENTION_DAYS: 30,
  // Foto selezionabili in una volta.
  MAX_PER_BATCH: 10,
  // Lato lungo in pixel delle tre versioni di ogni foto:
  // anteprima per la griglia, versione per il feed (leggera, si pubblica subito)
  // e versione HD per l'album scaricabile (parte in background dopo la pubblicazione).
  THUMB_SIZE: 480,
  FEED_SIZE: 1080,
  HD_SIZE: 2560
};
