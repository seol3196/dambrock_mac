const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

function getTeacherUid(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }

  return request.auth.uid;
}

async function requireTeacher(db, teacherUid) {
  const teacherRef = db.doc(`users/${teacherUid}`);
  const teacherSnap = await teacherRef.get();
  if (!teacherSnap.exists || teacherSnap.data()?.role !== 'teacher') {
    throw new HttpsError('permission-denied', 'Only teachers can manage students.');
  }
}

async function loadOwnedStudents(db, teacherUid, uids) {
  const uniqueUids = [...new Set(uids.map((uid) => String(uid || '').trim()).filter(Boolean))];
  if (!uniqueUids.length) {
    throw new HttpsError('invalid-argument', 'At least one student uid is required.');
  }

  const studentDocs = await Promise.all(
    uniqueUids.map(async (uid) => {
      const ref = db.doc(`users/${uid}`);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Student document not found.');
      }

      const data = snap.data();
      if (data.role !== 'student' || data.teacherId !== teacherUid) {
        throw new HttpsError('permission-denied', 'You can only manage your own students.');
      }

      return { uid, ref, data };
    })
  );

  return studentDocs;
}

exports.deleteStudentAccount = onCall(async (request) => {
  const teacherUid = getTeacherUid(request);
  const db = getFirestore();
  await requireTeacher(db, teacherUid);

  const [student] = await loadOwnedStudents(db, teacherUid, [request.data?.uid]);
  const studentUid = student.uid;

  try {
    await getAuth().deleteUser(studentUid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Failed to delete auth user.');
    }
  }

  await student.ref.delete();

  return {
    uid: studentUid,
    id: student.data.id || null
  };
});

exports.setStudentPasswords = onCall(async (request) => {
  const teacherUid = getTeacherUid(request);
  const password = String(request.data?.password || '').trim();
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const db = getFirestore();
  await requireTeacher(db, teacherUid);
  const students = await loadOwnedStudents(db, teacherUid, request.data?.uids || []);

  for (const student of students) {
    await getAuth().updateUser(student.uid, { password });
    await student.ref.update({ passwordHint: password });
  }

  return {
    count: students.length,
    password
  };
});
