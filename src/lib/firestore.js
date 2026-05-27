import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
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
    column: data.column || 1,
    likedBy: {},
    likeCount: 0,
    order: data.order ?? Date.now(),
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

export function updatePostLayouts(updates) {
  const batch = writeBatch(db);
  for (const update of updates) {
    batch.update(doc(db, 'posts', update.id), {
      column: update.column,
      order: update.order,
      updatedAt: serverTimestamp()
    });
  }
  return batch.commit();
}

export async function deleteWallColumn(wallId, column, columnCount, columnNames = {}) {
  const postsQuery = query(collection(db, 'posts'), where('wallId', '==', wallId));
  const postsSnapshot = await getDocs(postsQuery);
  const posts = postsSnapshot.docs.map((postDoc) => ({ id: postDoc.id, ...postDoc.data() }));
  const deletedPosts = posts.filter((post) => post.column === column);
  const shiftedPosts = posts.filter((post) => post.column > column);
  const batches = [writeBatch(db)];
  let batchOperationCount = 0;

  function activeBatch() {
    if (batchOperationCount >= 450) {
      batches.push(writeBatch(db));
      batchOperationCount = 0;
    }
    batchOperationCount += 1;
    return batches[batches.length - 1];
  }

  for (const post of deletedPosts) {
    const commentsQuery = query(collection(db, 'comments'), where('postId', '==', post.id));
    const commentsSnapshot = await getDocs(commentsQuery);
    commentsSnapshot.docs.forEach((commentDoc) => {
      activeBatch().delete(doc(db, 'comments', commentDoc.id));
    });
    activeBatch().delete(doc(db, 'posts', post.id));
  }

  for (const post of shiftedPosts) {
    activeBatch().update(doc(db, 'posts', post.id), {
      column: post.column - 1,
      updatedAt: serverTimestamp()
    });
  }

  const nextColumnNames = {};
  for (let nextColumn = 1; nextColumn < columnCount; nextColumn += 1) {
    const name = nextColumn < column ? columnNames[nextColumn] : columnNames[nextColumn + 1];
    if (typeof name === 'string' && name.trim()) {
      nextColumnNames[nextColumn] = name.trim();
    }
  }

  activeBatch().update(doc(db, 'walls', wallId), {
    columnCount: columnCount - 1,
    columnNames: nextColumnNames
  });

  for (const batch of batches) {
    await batch.commit();
  }
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
  const postRef = doc(db, 'posts', postId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) {
      throw new Error('Post not found.');
    }

    const data = snapshot.data();
    const likedBy = { ...(data.likedBy || {}) };
    const liked = Boolean(likedBy[userId]);
    if (liked) {
      delete likedBy[userId];
    } else {
      likedBy[userId] = true;
    }

    transaction.update(postRef, {
      likedBy,
      likeCount: Math.max(0, (data.likeCount || 0) + (liked ? -1 : 1)),
      updatedAt: serverTimestamp()
    });

    return !liked;
  });
}

export async function deleteStudentAccount(studentUid) {
  const callable = httpsCallable(functions, 'deleteStudentAccount');
  try {
    return await callable({ uid: studentUid });
  } catch (error) {
    await deleteDoc(doc(db, 'users', studentUid));
    return { data: { count: 1, deleted: [{ uid: studentUid, authDeleted: false }] } };
  }
}

export async function deleteStudentAccounts(studentUids) {
  const callable = httpsCallable(functions, 'deleteStudentAccounts');
  try {
    return await callable({ uids: studentUids });
  } catch (error) {
    await Promise.all(studentUids.map((uid) => deleteDoc(doc(db, 'users', uid))));
    return {
      data: {
        count: studentUids.length,
        deleted: studentUids.map((uid) => ({ uid, authDeleted: false }))
      }
    };
  }
}

export async function setStudentPasswords(studentUids, password) {
  const callable = httpsCallable(functions, 'setStudentPasswords');
  return callable({ uids: studentUids, password });
}
