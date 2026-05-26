import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

const [, , id = 'admin', password] = process.argv;

if (!password) {
  console.error('Usage: node scripts/create-admin.mjs <id> <password>');
  process.exit(1);
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Load .env before running this script.`);
    process.exit(1);
  }
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
});

const auth = getAuth(app);
const db = getFirestore(app);
const email = `${id}@damvyeorak.local`;

try {
  let credential;

  try {
    console.log(`Creating auth user ${email}...`);
    credential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error;
    console.log(`Auth user exists. Signing in ${email}...`);
    credential = await signInWithEmailAndPassword(auth, email, password);
  }

  console.log(`Writing Firestore users/${credential.user.uid}...`);
  const write = setDoc(doc(db, 'users', credential.user.uid), {
    id,
    role: 'admin',
    displayName: '관리자',
    createdAt: serverTimestamp()
  });
  const timeout = new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            'Firestore write timed out after 15s. Check that Firestore exists and firestore.rules is deployed.'
          )
        ),
      15000
    );
  });
  await Promise.race([write, timeout]);

  console.log(`Created admin: ${id}`);
  console.log(`UID: ${credential.user.uid}`);
  console.log('If you still get PERMISSION_DENIED, deploy firestore.rules first.');
  process.exit(0);
} catch (error) {
  console.error(error.code || error.name || 'error');
  console.error(error.message);
  process.exit(1);
}
