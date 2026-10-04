import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpenCheck, LayoutDashboard, LogOut, Presentation } from 'lucide-react';
import { Logo, SpaceBackground } from '../../components/ui/Basics';
import { useInstructorAuth } from '../../context/InstructorAuth';

export function InstructorLayout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const auth = useInstructorAuth();
  const nav = [
    { to: '/teacher', label: 'Boshqaruv', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
    { to: '/teacher/questions', label: 'Savollar banki', icon: <BookOpenCheck className="h-4 w-4" /> },
    { to: '/intro', label: 'Taqdimot', icon: <Presentation className="h-4 w-4" /> },
  ];
  return (
    <div className="relative min-h-screen">
      <SpaceBackground dim={0.2} />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-space-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/teacher" aria-label="Boshqaruv paneli">
            <Logo size="sm" />
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Asosiy menyu">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
                    isActive ? 'bg-arena-cyan/15 text-arena-cyan' : 'text-arena-muted hover:bg-white/5 hover:text-arena-text',
                  )
                }
              >
                {n.icon}
                {n.label}
              </NavLink>
            ))}
          </nav>
          {actions}
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-arena-muted md:inline">{auth.profile?.display_name || auth.session?.user.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => void auth.signOut()}>
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  );
}
