import {
  Copy,
  ExternalLink,
  Pencil,
  Printer,
  Settings,
  Trash2,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Field from '../components/Field.jsx';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createUser } from '../lib/auth';
import { createWall, deleteWall } from '../lib/firestore';
import { db } from '../lib/firebase';
import { dateText, paddedNumber, wallTone } from '../lib/ui';

export default function TeacherPage() {
  const { user, displayId, profile } = useAuth();
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [walls, setWalls] = useState([]);
  const [studentForm, setStudentForm] = useState({
    prefix: 'class_',
    start: '01',
    end: '30',
    password: '123456',
    nameList: ''
  });
  const [wallForm, setWallForm] = useState({
    title: '',
    description: '',
    accessMode: 'login',
    commentsEnabled: true,
    likesEnabled: true
  });
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('teacherId', '==', user.uid)
    );
    const wallsQuery = query(collection(db, 'walls'), where('ownerId', '==', user.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snapshot) =>
      setStudents(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() })))
    );
    const unsubWalls = onSnapshot(wallsQuery, (snapshot) =>
      setWalls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    );

    return () => {
      unsubStudents();
      unsubWalls();
    };
  }, [user.uid]);

  const aside = (
    <aside className="rounded-[8px] bg-white/85 p-3 shadow-soft">
      <button
        type="button"
        onClick={() => setTab('students')}
        className={`flex h-11 w-full items-center gap-2 rounded-[8px] px-3 font-bold ${
          tab === 'students' ? 'bg-stone-900 text-white' : 'text-stone-700'
        }`}
      >
        <Users size={18} />
        학생 관리
      </button>
      <button
        type="button"
        onClick={() => setTab('walls')}
        className={`mt-2 flex h-11 w-full items-center gap-2 rounded-[8px] px-3 font-bold ${
          tab === 'walls' ? 'bg-stone-900 text-white' : 'text-stone-700'
        }`}
      >
        <Settings size={18} />
        담벼락 관리
      </button>
    </aside>
  );

  async function createStudents(event) {
    event.preventDefault();

    const password = String(studentForm.password).trim();
    const prefix = studentForm.prefix.trim();
    const names = String(studentForm.nameList)
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    const start = Number(studentForm.start);
    const end = Number(studentForm.end);

    if (password.length < 6) {
      alert('학생 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (!prefix) {
      alert('학생 ID 접두어를 입력해 주세요.');
      return;
    }

    if (!Number.isInteger(start) || start < 0) {
      alert('시작 번호를 다시 확인해 주세요.');
      return;
    }

    if (!names.length && (!Number.isInteger(end) || end < 0 || start > end)) {
      alert('시작 번호와 끝 번호를 다시 확인해 주세요.');
      return;
    }

    const lastNumber = names.length ? start + names.length - 1 : end;
    const width = Math.max(
      studentForm.start.length,
      studentForm.end.length,
      String(lastNumber).length,
      2
    );
    const studentEntries = names.length
      ? names.map((displayName, index) => ({
          serial: paddedNumber(start + index, width),
          displayName
        }))
      : Array.from({ length: end - start + 1 }, (_, index) => {
          const number = start + index;
          const serial = paddedNumber(number, width);
          const id = `${prefix}${serial}`;
          return {
            serial,
            displayName: id
          };
        });

    try {
      for (const studentEntry of studentEntries) {
        const id = `${prefix}${studentEntry.serial}`;
        await createUser(id, password, 'student', {
          displayName: studentEntry.displayName,
          teacherId: user.uid,
          passwordHint: password
        });
      }

      alert('학생 계정을 생성했습니다.');
      setStudentForm((prev) => ({
        ...prev,
        nameList: names.length ? '' : prev.nameList
      }));
    } catch (error) {
      const message =
        error?.code === 'auth/email-already-in-use'
          ? '이미 존재하는 학생 ID가 포함되어 있습니다.'
          : error?.message || '학생 계정 생성 중 오류가 발생했습니다.';
      alert(message);
    }
  }

  async function submitWall(event) {
    event.preventDefault();
    await createWall({
      ...wallForm,
      ownerId: user.uid,
      ownerName: profile?.displayName || displayId
    });
    setWallForm({
      title: '',
      description: '',
      accessMode: 'login',
      commentsEnabled: true,
      likesEnabled: true
    });
  }

  return (
    <Layout
      badge="교사 모드"
      title={`${profile?.displayName || displayId}의 담벼락`}
      userLabel={displayId}
      aside={aside}
    >
      {tab === 'students' ? (
        <StudentManager
          form={studentForm}
          setForm={setStudentForm}
          submit={createStudents}
          students={students}
        />
      ) : (
        <WallManager
          form={wallForm}
          setForm={setWallForm}
          submit={submitWall}
          walls={walls}
          origin={origin}
        />
      )}
    </Layout>
  );
}

function StudentManager({ form, setForm, submit, students }) {
  const [editingUid, setEditingUid] = useState(null);
  const [nameDraft, setNameDraft] = useState('');

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.displayName || a.id).localeCompare(b.displayName || b.id, 'ko')
      ),
    [students]
  );

  async function saveStudentName(student) {
    const nextName = nameDraft.trim();
    if (!nextName) return;
    await updateDoc(doc(db, 'users', student.uid), { displayName: nextName });
    setEditingUid(null);
    setNameDraft('');
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">학생 일괄 생성</h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="ID 접두어">
            <input
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
              className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
              placeholder="class_"
            />
          </Field>
          <Field label="비밀번호">
            <input
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
            />
          </Field>
          <Field label="시작 번호">
            <input
              inputMode="numeric"
              value={form.start}
              onChange={(e) =>
                setForm({ ...form, start: e.target.value.replace(/\D/g, '') || '00' })
              }
              className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
            />
          </Field>
          <Field label="끝 번호">
            <input
              inputMode="numeric"
              value={form.end}
              onChange={(e) =>
                setForm({ ...form, end: e.target.value.replace(/\D/g, '') || '00' })
              }
              className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="학생 이름 목록">
            <textarea
              value={form.nameList}
              onChange={(e) => setForm({ ...form, nameList: e.target.value })}
              className="min-h-40 w-full rounded-[8px] border border-stone-200 p-3"
              placeholder={'김학생\n이학생\n박학생'}
            />
          </Field>
        </div>
        <p className="mt-3 text-sm text-stone-500">
          시작 번호를 `01`처럼 두 자리로 적으면 생성되는 ID도 같은 자리수로 맞춰집니다.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          엑셀에서 이름 열만 세로로 복붙하면 한 줄당 한 명씩 생성되고, 이름 목록이 있으면 끝 번호보다
          이름 목록을 우선합니다.
        </p>
        <button
          type="submit"
          className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white"
        >
          학생 계정 생성
        </button>
      </form>

      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">학생 목록</h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[8px] border border-stone-300 px-3 py-2 text-sm font-bold"
          >
            <Printer size={16} />
            인쇄
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sorted.map((student) => (
            <article
              key={student.uid}
              className="rounded-[8px] border border-stone-200 bg-lime-50 p-4"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  {editingUid === student.uid ? (
                    <div className="flex gap-2">
                      <input
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-[8px] border border-stone-200 px-3"
                      />
                      <button
                        type="button"
                        onClick={() => saveStudentName(student)}
                        className="rounded-[8px] bg-stone-900 px-3 text-sm font-bold text-white"
                      >
                        저장
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{student.displayName || student.id}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUid(student.uid);
                          setNameDraft(student.displayName || student.id);
                        }}
                        className="rounded-full bg-white p-1.5 text-stone-500 hover:text-stone-900"
                        aria-label="학생 이름 수정"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-stone-600">{student.id}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    비밀번호: {student.passwordHint || '별도 관리'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteDoc(doc(db, 'users', student.uid))}
                  className="rounded-full bg-white p-2 text-stone-500 hover:text-red-600"
                  aria-label="학생 삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {!sorted.length && (
            <p className="text-sm text-stone-500">생성된 학생 계정이 아직 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function WallManager({ form, setForm, submit, walls, origin }) {
  const sortedWalls = useMemo(
    () =>
      [...walls].sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      ),
    [walls]
  );

  async function copyWallLink(wallId) {
    await navigator.clipboard.writeText(`${origin}/wall/${wallId}`);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">담벼락 만들기</h2>
        <div className="mt-5 space-y-4">
          <Field label="제목">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
            />
          </Field>
          <Field label="설명">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="min-h-24 w-full rounded-[8px] border border-stone-200 p-3"
            />
          </Field>
          <label className="flex items-center justify-between rounded-[8px] border border-stone-200 px-4 py-3">
            <span>
              <b className="block text-sm text-stone-900">로그인 필요</b>
              <span className="text-sm text-stone-600">
                끄면 링크만 있으면 바로 참여할 수 있습니다.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.accessMode === 'login'}
              onChange={(e) =>
                setForm({
                  ...form,
                  accessMode: e.target.checked ? 'login' : 'public'
                })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.commentsEnabled}
              onChange={(e) => setForm({ ...form, commentsEnabled: e.target.checked })}
            />
            댓글 사용
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.likesEnabled}
              onChange={(e) => setForm({ ...form, likesEnabled: e.target.checked })}
            />
            좋아요 사용
          </label>
        </div>
        <button
          type="submit"
          className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white"
        >
          생성
        </button>
      </form>

      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">담벼락 목록</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sortedWalls.map((wall) => (
            <article
              key={wall.id}
              className={`rounded-[8px] border border-stone-200 p-4 ${wallTone(wall.id)}`}
            >
              <h3 className="text-lg font-bold">{wall.title}</h3>
              <p className="mt-1 text-sm text-stone-600">
                {wall.description || '설명이 아직 없습니다.'}
              </p>
              <p className="mt-3 text-xs text-stone-500">생성 시간 {dateText(wall.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyWallLink(wall.id)}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-white px-3 py-2 text-sm font-bold"
                >
                  <Copy size={15} />
                  링크 복사
                </button>
                <Link
                  to={`/wall/${wall.id}`}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-stone-900 px-3 py-2 text-sm font-bold text-white"
                >
                  <ExternalLink size={15} />
                  들어가기
                </Link>
                <button
                  type="button"
                  onClick={() => deleteWall(wall.id)}
                  className="inline-flex items-center gap-1 rounded-[8px] bg-white px-3 py-2 text-sm font-bold text-red-600"
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              </div>
            </article>
          ))}
          {!sortedWalls.length && (
            <p className="text-sm text-stone-500">아직 만든 담벼락이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
