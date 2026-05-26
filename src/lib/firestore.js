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
import { db } from './firebase';

export const colorOptions = [
  { name: '노랑', value: 'bg-yellow-100', swatch: '#fef3c7' },
  { name: '분홍', value: 'bg-rose-100', swatch: '#ffe4e6' },
  { name: '하늘', value: 'bg-sky-100', swatch: '#e0f2fe' },
  { name: '연두', value: 'bg-lime-100', swatch: '#ecfccb' },
  { name: '주황', value: 'bg-orange-100', swatch: '#ffedd5' }
];

export function createWall(data) {
  return addDoc(collection(db, 'walls'), {
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
    createdAt: serverTimestamp()
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
