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
  // Foto selezionabili in una volta e lato lungo dopo il ridimensionamento.
  MAX_PER_BATCH: 10,
  FULL_SIZE: 1600,
  THUMB_SIZE: 480
};
