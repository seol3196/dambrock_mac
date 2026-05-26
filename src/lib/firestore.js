import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

export const colorOptions = [
  { name: '노랑', value: 'bg-yellow-100', swatch: '#fef3c7' },
  { name: '분홍', value: 'bg-rose-100', swatch: '#ffe4e6' },
  { name: '하늘', value: 'bg-sky-100', swatch: '#e0f2fe' },
  { name: '연두', value: 'bg-lime-100', swatch: '#ecfccb' },
  { name: '주황', value: 'bg-orange-100', swatch: '#ffedd5' }
];

export const wallBackgroundOptions = [
  { name: '크림', value: 'bg-[#fff8e8]', swatch: '#e6d3ad' },
  { name: '민트', value: 'bg-[#edf7f2]', swatch: '#b8c9a3' },
  { name: '하늘', value: 'bg-[#eef6ff]', swatch: '#a6bdd6' },
  { name: '라일락', value: 'bg-[#f5efff]', swatch: '#b7a4cb' },
  { name: '피치', value: 'bg-[#fff0ea]', swatch: '#d8a684' },
  { name: '모래', value: 'bg-[#f3ead8]', swatch: '#c89c67' }
];

export function createWall(data) {
  return addDoc(collection(db, 'walls'), {
    backgroundTone: wallBackgroundOptions[0].value,
    columnCount: 4,
    ...data,
    createdAt: serverTimestamp()
  });
}

export function updateWall(wallId, data) {
  return updateDoc(doc(db, 'walls', wallId), data);
}

export function deleteWall(wallId) {
  return deleteDoc(doc(db, 'walls', wallId));
}

export function createPost(data) {
  return addDoc(collection(db, 'posts'), {
    ...data,
    column: data.column || null,
    createdAt: serverTimestamp()
  });
}

export function updatePost(postId, data) {
  return updateDoc(doc(db, 'posts', postId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export function deletePost(postId) {
  return deleteDoc(doc(db, 'posts', postId));
}

export function createComment(data) {
  return addDoc(collection(db, 'comments'), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export function deleteComment(commentId) {
  return deleteDoc(doc(db, 'comments', commentId));
}

export async function toggleLike(postId, userId) {
  const likeRef = doc(db, 'likes', `${postId}_${userId}`);
  const snapshot = await getDoc(likeRef);
  if (snapshot.exists()) {
    await deleteDoc(likeRef);
    return false;
  }

  await setDoc(likeRef, { postId, userId, createdAt: serverTimestamp() });
  return true;
}

export async function deleteStudentAccount(studentUid) {
  const callable = httpsCallable(functions, 'deleteStudentAccount');
  return callable({ uid: studentUid });
}

export async function deleteStudentAccounts(studentUids) {
  const callable = httpsCallable(functions, 'deleteStudentAccounts');
  return callable({ uids: studentUids });
}

export async function setStudentPasswords(studentUids, password) {
  const callable = httpsCallable(functions, 'setStudentPasswords');
  return callable({ uids: studentUids, password });
}
