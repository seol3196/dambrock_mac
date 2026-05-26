import { LogOut } from 'lucide-react';
import { logout } from '../lib/auth';

export default function Layout({ badge, title, userLabel, children, aside }) {
  return (
    <main className="felt-bg min-h-screen">
      <header className="border-b border-stone-200/80 bg-white/82 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-bold text-amber-700">{badge}</p>
            <h1 className="text-2xl font-bold text-stone-950">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {userLabel && <span className="hidden text-sm text-stone-600 sm:inline">{userLabel}</span>}
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-stone-300 bg-white px-3 text-sm font-bold text-stone-700 shadow-sm hover:bg-stone-50"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[220px_1fr]">
        {aside}
        <section>{children}</section>
      </div>
    </main>
  );
}
