import {
  BrickWall,
  Copy,
  ExternalLink,
  KeyRound,
  Pencil,
  Printer,
  Trash2,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Field from '../components/Field.jsx';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createUser } from '../lib/auth';
import {
  createWall,
  deleteStudentAccount,
  deleteStudentAccounts,
  deleteWall,
  setStudentPasswords,
  subscribeUsers,
  subscribeWalls,
  updateUser
} from '../lib/firestore';
import { dateText, paddedNumber, wallTone } from '../lib/ui';

const RESET_PASSWORD = '123456';

export default function TeacherPage() {
  const { user, displayId, profile } = useAuth();
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [walls, setWalls] = useState([]);
  const [studentForm, setStudentForm] = useState({
    prefix: 'class_',
    start: '01',
    end: '30',
    password: RESET_PASSWORD,
    nameList: ''
  });
  const [singleStudentForm, setSingleStudentForm] = useState({
    id: '',
    displayName: '',
    password: RESET_PASSWORD
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
    const unsubStudents = subscribeUsers(
      { role: 'student', teacherId: user.uid },
      setStudents
    );
    const unsubWalls = subscribeWalls({ ownerId: user.uid }, setWalls);

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
        <BrickWall size={18} />
        내 담벼락
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
      ? names.map((studentName, index) => ({
          serial: paddedNumber(start + index, width),
          displayName: studentName
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

  async function createSingleStudent(event) {
    event.preventDefault();

    const id = String(singleStudentForm.id).trim();
    const displayName = String(singleStudentForm.displayName).trim();
    const password = String(singleStudentForm.password).trim();

    if (!id) {
      alert('학생 ID를 입력해 주세요.');
      return;
    }
    if (!displayName) {
      alert('학생 이름을 입력해 주세요.');
      return;
    }
    if (password.length < 6) {
      alert('학생 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    try {
      await createUser(id, password, 'student', {
        displayName,
        teacherId: user.uid,
        passwordHint: password
      });
      alert('학생 계정을 생성했습니다.');
      setSingleStudentForm({
        id: '',
        displayName: '',
        password: RESET_PASSWORD
      });
    } catch (error) {
      const message =
        error?.code === 'auth/email-already-in-use'
          ? '이미 존재하는 학생 ID입니다.'
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
      title={`${profile?.displayName || displayId} 선생님`}
      userLabel={displayId}
      aside={aside}
    >
      {tab === 'students' ? (
        <StudentManager
          form={studentForm}
          setForm={setStudentForm}
          submit={createStudents}
          singleForm={singleStudentForm}
          setSingleForm={setSingleStudentForm}
          submitSingle={createSingleStudent}
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

function StudentManager({
  form,
  setForm,
  submit,
  singleForm,
  setSingleForm,
  submitSingle,
  students
}) {
  const [editingUid, setEditingUid] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [passwordUid, setPasswordUid] = useState(null);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [selectedUids, setSelectedUids] = useState([]);
  const [batchPassword, setBatchPassword] = useState('');

  const sorted = useMemo(
    () =>
      [...students].sort((a, b) =>
        (a.displayName || a.id).localeCompare(b.displayName || b.id, 'ko')
      ),
    [students]
  );
  const selectedCount = selectedUids.length;
  const allSelected = sorted.length > 0 && selectedCount === sorted.length;

  useEffect(() => {
    setSelectedUids((current) =>
      current.filter((uid) => sorted.some((student) => student.uid === uid))
    );
  }, [sorted]);

  async function saveStudentName(student) {
    const nextName = nameDraft.trim();
    if (!nextName) return;
    await updateUser(student.uid, { displayName: nextName });
    setEditingUid(null);
    setNameDraft('');
  }

  function functionErrorMessage(error, fallback) {
    const code = error?.code || '';
    const message = String(error?.message || '');

    if (code.includes('unimplemented') || code.includes('request-failed')) {
      return '로컬 서버 요청을 처리하지 못했습니다. 서버 실행 상태를 확인해 주세요.';
    }
    if (code.includes('permission-denied')) {
      return '권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.';
    }
    if (code.includes('unauthenticated')) {
      return '로그인 상태가 만료되었습니다. 다시 로그인해 주세요.';
    }
    if (message.includes('CORS') || message.includes('Failed to fetch')) {
      return '로컬 API 서버에 연결하지 못했습니다. 서버 포트와 실행 상태를 확인해 주세요.';
    }
    return fallback;
  }

  async function applyPasswordChange(targetUids, password, successMessage) {
    const nextPassword = String(password).trim();
    if (!targetUids.length) {
      alert('학생을 먼저 선택해 주세요.');
      return false;
    }
    if (nextPassword.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return false;
    }

    try {
      await setStudentPasswords(targetUids, nextPassword);
      alert(successMessage);
      return true;
    } catch (error) {
      alert(functionErrorMessage(error, '비밀번호 변경 중 오류가 발생했습니다.'));
      return false;
    }
  }

  async function saveStudentPassword(student) {
    const ok = await applyPasswordChange(
      [student.uid],
      passwordDraft,
      `${student.displayName || student.id} 학생 비밀번호를 변경했습니다.`
    );
    if (!ok) return;
    setPasswordUid(null);
    setPasswordDraft('');
  }

  async function applyBatchPassword() {
    const ok = await applyPasswordChange(
      selectedUids,
      batchPassword,
      `${selectedCount}명의 비밀번호를 일괄 변경했습니다.`
    );
    if (!ok) return;
    setBatchPassword('');
  }

  function toggleSelected(uid) {
    setSelectedUids((current) =>
      current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]
    );
  }

  function toggleAllSelected() {
    setSelectedUids(allSelected ? [] : sorted.map((student) => student.uid));
  }

  async function removeStudent(student) {
    const ok = window.confirm(
      `${student.displayName || student.id} 학생을 삭제하면 로그인 계정과 학생 문서가 함께 삭제됩니다. 계속할까요?`
    );
    if (!ok) return;

    try {
      await deleteStudentAccount(student.uid);
      setSelectedUids((current) => current.filter((uid) => uid !== student.uid));
      alert('학생 계정을 삭제했습니다.');
    } catch (error) {
      alert(functionErrorMessage(error, '학생 삭제 중 오류가 발생했습니다.'));
    }
  }

  async function removeSelectedStudents() {
    if (!selectedCount) {
      alert('삭제할 학생을 먼저 선택해 주세요.');
      return;
    }

    const ok = window.confirm(
      `선택한 학생 ${selectedCount}명을 삭제하면 로그인 계정과 학생 문서가 함께 삭제됩니다. 계속할까요?`
    );
    if (!ok) return;

    try {
      await deleteStudentAccounts(selectedUids);
      setSelectedUids([]);
      alert(`학생 ${selectedCount}명을 삭제했습니다.`);
    } catch (error) {
      alert(functionErrorMessage(error, '학생 일괄 삭제 중 오류가 발생했습니다.'));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <form onSubmit={submitSingle} className="rounded-[8px] bg-white/90 p-5 shadow-soft">
          <h2 className="text-xl font-bold">학생 한 명 생성</h2>
          <div className="mt-5 space-y-4">
            <Field label="학생 ID">
              <input
                value={singleForm.id}
                onChange={(e) => setSingleForm({ ...singleForm, id: e.target.value })}
                className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
                placeholder="mh01"
              />
            </Field>
            <Field label="학생 이름">
              <input
                value={singleForm.displayName}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, displayName: e.target.value })
                }
                className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
                placeholder="홍길동"
              />
            </Field>
            <Field label="비밀번호">
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={singleForm.password}
                onChange={(e) =>
                  setSingleForm({ ...singleForm, password: e.target.value })
                }
                className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
              />
            </Field>
          </div>
          <button
            type="submit"
            className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white"
          >
            학생 한 명 생성
          </button>
        </form>

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
            엑셀에서 이름 열만 세로로 붙여넣으면 줄 수만큼 생성되고, 이름 목록이 있으면 번호 범위보다
            이름 목록이 우선 적용됩니다.
          </p>
          <button
            type="submit"
            className="mt-5 h-11 w-full rounded-[8px] bg-stone-900 font-bold text-white"
          >
            학생 계정 생성
          </button>
        </form>
      </div>

      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">학생 목록</h2>
            <p className="mt-1 text-sm text-stone-500">
              이름 수정, 개별 비밀번호 변경, 선택 학생 비밀번호 일괄 변경, 선택 학생 삭제를 여기서 처리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 self-start rounded-[8px] border border-stone-300 px-3 py-2 text-sm font-bold"
          >
            <Printer size={16} />
            인쇄
          </button>
        </div>

        <div className="mt-5 rounded-[8px] border border-stone-200 bg-stone-50 p-4">
          <div className="grid gap-3 xl:grid-cols-[auto_minmax(220px,1fr)_max-content_max-content] xl:items-end">
            <label className="inline-flex h-11 items-center gap-2 whitespace-nowrap text-sm font-bold text-stone-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAllSelected} />
              전체 선택
            </label>
            <Field label={`선택 학생 ${selectedCount}명 비밀번호 일괄 변경`}>
              <input
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={batchPassword}
                onChange={(e) => setBatchPassword(e.target.value)}
                className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
                placeholder="새 비밀번호"
              />
            </Field>
            <button
              type="button"
              onClick={applyBatchPassword}
              disabled={!selectedCount}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] bg-stone-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <KeyRound size={16} />
              선택 학생 비밀번호 변경
            </button>
            <button
              type="button"
              onClick={removeSelectedStudents}
              disabled={!selectedCount}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400"
            >
              <Trash2 size={16} />
              선택 학생 일괄 삭제
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sorted.map((student) => {
            const isNameEditing = editingUid === student.uid;
            const isPasswordEditing = passwordUid === student.uid;
            const isSelected = selectedUids.includes(student.uid);

            return (
              <article
                key={student.uid}
                className="rounded-[8px] border border-stone-200 bg-lime-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <label className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-stone-700">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(student.uid)}
                    />
                    선택
                  </label>

                  <div className="min-w-0 flex-1">
                    {isNameEditing ? (
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

                    <p className="mt-1 text-sm text-stone-600">{student.id}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      현재 비밀번호: {student.passwordHint || '별도 관리'}
                    </p>

                    {isPasswordEditing ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          type="password"
                          minLength={6}
                          autoComplete="new-password"
                          value={passwordDraft}
                          onChange={(event) => setPasswordDraft(event.target.value)}
                          className="h-10 min-w-0 flex-1 rounded-[8px] border border-stone-200 px-3"
                          placeholder="새 비밀번호"
                        />
                        <button
                          type="button"
                          onClick={() => saveStudentPassword(student)}
                          className="rounded-[8px] bg-stone-900 px-3 text-sm font-bold text-white"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordUid(null);
                            setPasswordDraft('');
                          }}
                          className="rounded-[8px] border border-stone-300 bg-white px-3 text-sm font-bold text-stone-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordUid(student.uid);
                            setPasswordDraft(student.passwordHint || '');
                          }}
                          className="inline-flex items-center gap-1 rounded-[8px] border border-stone-300 bg-white px-3 py-2 text-sm font-bold text-stone-700"
                        >
                          <KeyRound size={15} />
                          개별 비밀번호 변경
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeStudent(student)}
                    className="rounded-full bg-white p-2 text-stone-500 hover:text-red-600"
                    aria-label="학생 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
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
    () => [...walls].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
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
