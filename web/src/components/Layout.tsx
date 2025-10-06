import { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/players', label: 'Players' },
  { to: '/teams', label: 'Teams' },
  { to: '/games', label: 'Games' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/import', label: 'Import' }
];

export default function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-950/80 px-6 py-8 lg:flex">
        <div className="mb-8 text-2xl font-semibold tracking-tight text-white">Meeplelytics</div>
        <nav className="space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                )
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-10 text-xs text-slate-500">Training analytics for 4-player board games.</div>
      </aside>
      <main className="flex-1 bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
