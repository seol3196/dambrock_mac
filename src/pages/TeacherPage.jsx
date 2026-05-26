import { Copy, ExternalLink, Printer, Settings, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Field from '../components/Field.jsx';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createUser, makePassword } from '../lib/auth';
import { createWall, deleteWall, updateWall } from '../lib/firestore';
import { db } from '../lib/firebase';
import { wallTone } from '../lib/ui';

export default function TeacherPage() {
  const { user, displayId, profile } = useAuth();
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [walls, setWalls] = useState([]);
  const [studentForm, setStudentForm] = useState({ prefix: 'class_', start: 1, end: 30, password: '1234' });
  const [wallForm, setWallForm] = useState({ title: '', description: '', accessMode: 'login', commentsEnabled: true, likesEnabled: true });
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'), where('teacherId', '==', user.uid));
    const wallsQuery = query(collection(db, 'walls'), where('ownerId', '==', user.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snapshot) => setStudents(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() }))));
    const unsubWalls = onSnapshot(wallsQuery, (snapshot) => setWalls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    return () => {
      unsubStudents();
      unsubWalls();
    };
  }, [user.uid]);

  const aside = (
    <aside className="rounded-[8px] bg-white/85 p-3 shadow-soft">
      <button type="button" onClick={() => setTab('students')} className={`flex h-11 w-full items-center gap-2 rounded-[8px] px-3 font-bold ${tab === 'students' ? 'bg-stone-900 text-white' : 'text-stone-700'}`}>
        <Users size={18} />
        학생 관리
      </button>
      <button type="button" onClick={() => setTab('walls')} className={`mt-2 flex h-11 w-full items-center gap-2 rounded-[8px] px-3 font-bold ${tab === 'walls' ? 'bg-stone-900 text-white' : 'text-stone-700'}`}>
        <Settings size={18} />
        담벼락 관리
      </button>
    </aside>
  );

  async function createStudents(event) {
    event.preventDefault();
    for (let number = Number(studentForm.start); number <= Number(studentForm.end); number += 1) {
      const id = `${studentForm.prefix}${number}`;
      await createUser(id, studentForm.password, 'student', {
        displayName: id,
        teacherId: user.uid,
        passwordHint: studentForm.password
      });
    }
    alert('학생 계정을 생성했습니다.');
  }

  async function submitWall(event) {
    event.preventDefault();
    await createWall({
      ...wallForm,
      ownerId: user.uid,
      ownerName: profile?.displayName || displayId
    });
    setWallForm({ title: '', description: '', accessMode: 'login', commentsEnabled: true, likesEnabled: true });
  }

  return (
    <Layout badge="교사 모드" title={`${profile?.displayName || displayId}의 담벼락`} userLabel={displayId} aside={aside}>
      {tab === 'students' ? (
        <StudentManager form={studentForm} setForm={setStudentForm} submit={createStudents} students={students} />
      ) : (
        <WallManager form={wallForm} setForm={setWallForm} submit={submitWall} walls={walls} origin={origin} />
      )}
    </Layout>
  );
}

function StudentManager({ form, setForm, submit, students }) {
  const sorted = useMemo(() => [...students].sort((a, b) => a.id.localeCompare(b.id)), [students]);

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">학생 일괄 생성</h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Field label="ID 접두어">
            <input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3" />
          </Field>
          <Field label="비밀번호">
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3" />
          </Field>
          <Field label="시작 번호">
            <input type="number" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3" />
          </Field>
          <Field label="끝 번호">
            <input type="number" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3" />
          </Field>
        </div>
        <button type="submit" className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white">번호로 생성</button>
      </form>
      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">학생 목록</h2>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-[8px] border border-stone-300 px-3 py-2 text-sm font-bold">
            <Printer size={16} />
            인쇄
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sorted.map((student) => (
            <article key={student.uid} className="rounded-[8px] border border-stone-200 bg-lime-50 p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-bold">{student.displayName || student.id}</h3>
                  <p className="text-sm text-stone-600">{student.id}</p>
                  <p className="mt-1 text-sm text-stone-600">비밀번호: {student.passwordHint || '별도 관리'}</p>
                </div>
                <button type="button" onClick={() => deleteDoc(doc(db, 'users', student.uid))} className="rounded-full bg-white p-2 text-stone-500 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function WallManager({ form, setForm, submit, walls, origin }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">담벼락 만들기</h2>
        <div className="mt-5 space-y-4">
          <Field label="제목">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3" />
          </Field>
          <Field label="설명">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-24 w-full rounded-[8px] border border-stone-200 p-3" />
          </Field>
          <Field label="접근 모드">
            <select value={form.accessMode} onChange={(e) => setForm({ ...form, accessMode: e.target.value })} className="h-11 w-full rounded-[8px] border border-stone-200 px-3">
              <option value="login">로그인 필요</option>
              <option value="public">링크 공개</option>
            </select>
          </Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.commentsEnabled} onChange={(e) => setForm({ ...form, commentsEnabled: e.target.checked })} /> 댓글 허용</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.likesEnabled} onChange={(e) => setForm({ ...form, likesEnabled: e.target.checked })} /> 좋아요 허용</label>
        </div>
        <button type="submit" className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white">생성</button>
      </form>
      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">담벼락 목록</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {walls.map((wall) => (
            <article key={wall.id} className={`rounded-[8px] border border-stone-200 p-4 ${wallTone(wall.id)}`}>
              <h3 className="text-lg font-bold">{wall.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{wall.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(`${origin}/wall/${wall.id}`)} className="inline-flex items-center gap-1 rounded-[8px] bg-white px-3 py-2 text-sm font-bold">
                  <Copy size={15} />
                  링크 복사
                </button>
                <Link to={`/wall/${wall.id}`} className="inline-flex items-center gap-1 rounded-[8px] bg-stone-900 px-3 py-2 text-sm font-bold text-white">
                  <ExternalLink size={15} />
                  들어가기
                </Link>
                <button type="button" onClick={() => deleteWall(wall.id)} className="inline-flex items-center gap-1 rounded-[8px] bg-white px-3 py-2 text-sm font-bold text-red-600">
                  <Trash2 size={15} />
                  삭제
                </button>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={wall.accessMode === 'public'} onChange={(e) => updateWall(wall.id, { accessMode: e.target.checked ? 'public' : 'login' })} />
                  링크 공개
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={wall.commentsEnabled} onChange={(e) => updateWall(wall.id, { commentsEnabled: e.target.checked })} />
                  댓글 허용
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={wall.likesEnabled} onChange={(e) => updateWall(wall.id, { likesEnabled: e.target.checked })} />
                  좋아요 허용
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
