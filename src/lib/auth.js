import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';

const DOMAIN = '@damvyeorak.local';

export function toEmail(id) {
  return `${String(id).trim()}${DOMAIN}`;
}

export function toId(email = '') {
  return email.endsWith(DOMAIN) ? email.slice(0, -DOMAIN.length) : email;
}

export async function login(id, password) {
  return signInWithEmailAndPassword(auth, toEmail(id), password);
}

export async function logout() {
  return signOut(auth);
}

export function makePassword(length = 8) {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createUser(id, password, role, extraData = {}) {
  if (String(password).length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}-${Math.random()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, toEmail(id), password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      id,
      role,
      displayName: extraData.displayName || id,
      createdAt: serverTimestamp(),
      ...extraData
    });
    return credential.user;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp);
  }
}
