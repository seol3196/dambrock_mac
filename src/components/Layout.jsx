import { LogOut } from 'lucide-react';
import { logout } from '../lib/auth';

export default function Layout({ badge, title, subtitle, userLabel, children, aside }) {
  const hasAside = Boolean(aside);

  return (
    <main className="felt-bg min-h-screen">
      <header className="border-b border-stone-200/80 bg-white/82 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-700">{badge}</p>
            <h1 className="truncate text-2xl font-bold text-stone-950 sm:text-4xl">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 line-clamp-2 text-base font-medium text-stone-600 sm:text-lg">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {userLabel && (
              <span className="hidden text-sm font-medium text-stone-600 sm:inline">
                {userLabel}
              </span>
            )}
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
      <div
        className={`mx-auto w-full max-w-[1600px] gap-5 px-5 py-6 ${
          hasAside ? 'grid lg:grid-cols-[220px_minmax(0,1fr)]' : ''
        }`}
      >
        {hasAside ? aside : null}
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
