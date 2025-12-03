import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDrwC791rplIiqOeXKZTlCaacM8YhKkQdw",
  authDomain: "lista-de-compras-4420b.firebaseapp.com",
  projectId: "lista-de-compras-4420b",
  storageBucket: "lista-de-compras-4420b.firebasestorage.app",
  messagingSenderId: "457388372289",
  appId: "1:457388372289:web:f210e74b357e03ca5b71c0",
  measurementId: "G-DRMYGDKDDE"
};

let app: FirebaseApp;
let db: Firestore | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

export { db };