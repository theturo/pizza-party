// Solo le funzioni Firebase usate dall'app: esbuild le impacchetta in pizzagram/vendor/firebase.js
export { initializeApp } from 'firebase/app';
export {
  signInAnonymously, onAuthStateChanged, connectAuthEmulator,
  indexedDBLocalPersistence, browserLocalPersistence, initializeAuth
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  connectFirestoreEmulator, doc, collection, query, where, orderBy, limit,
  getDoc, getDocs, setDoc, updateDoc, onSnapshot, writeBatch,
  serverTimestamp, Timestamp, increment, deleteField, getCountFromServer
} from 'firebase/firestore';
export {
  getStorage, connectStorageEmulator, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from 'firebase/storage';
