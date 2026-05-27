import { Lock, LogIn, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { login } from '../lib/auth';

function homeFor(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/student';
  return '/';
}

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const fromPath = location.state?.from?.pathname;
  const redirectTo = fromPath || homeFor(role);

  if (!loading && user && role) return <Navigate to={redirectTo} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');

    try {
      const result = await login(id, password);
      const nextRole = result.profile?.role;
      const nextPath = fromPath || homeFor(nextRole);
      navigate(nextPath, { replace: true });
    } catch {
      setError('ID 또는 비밀번호를 확인해 주세요.');
    }
  }

  return (
    <main className="felt-bg grid min-h-screen place-items-center px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[8px] bg-white shadow-soft md:grid-cols-[1.1fr_0.9fr]">
        <div className="cork-bg relative min-h-[420px] p-8">
          <div className="absolute left-10 top-12 rounded-[6px] bg-yellow-100 p-6 shadow-paper">
            <p className="font-hand text-5xl">오늘의 생각</p>
            <p className="mt-2 text-stone-700">친구들과 따뜻하게 나누어요.</p>
          </div>
          <div className="absolute bottom-16 right-10 rounded-[6px] bg-rose-100 p-5 shadow-paper">
            <p className="font-hand text-4xl">담벼락</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col justify-center p-8">
          <p className="text-sm font-bold text-amber-700">학급 소통 노트</p>
          <h1 className="mt-2 text-4xl font-bold text-stone-950">담벼락</h1>
          <label className="mt-8 block">
            <span className="mb-2 block text-sm font-bold text-stone-700">ID</span>
            <span className="flex items-center gap-2 rounded-[8px] border border-stone-200 bg-stone-50 px-3">
              <UserRound size={18} className="text-stone-500" />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoComplete="username"
                className="h-12 min-w-0 flex-1 bg-transparent outline-none"
                placeholder="아이디"
              />
            </span>
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold text-stone-700">비밀번호</span>
            <span className="flex items-center gap-2 rounded-[8px] border border-stone-200 bg-stone-50 px-3">
              <Lock size={18} className="text-stone-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 min-w-0 flex-1 bg-transparent outline-none"
                placeholder="비밀번호"
              />
            </span>
          </label>
          {error && <p className="mt-4 text-sm font-bold text-red-600">{error}</p>}
          <button
            type="submit"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-stone-900 font-bold text-white hover:bg-stone-700"
          >
            <LogIn size={18} />
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
