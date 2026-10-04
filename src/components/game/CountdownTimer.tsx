import clsx from 'clsx';
import { Pause, Users } from 'lucide-react';
import type { TimerState } from '../../game/timer';
import { formatSeconds } from '../../game/timer';

/** Doira shaklidagi taymer. Qiymatlar server muddatidan hisoblanadi. */
export function CountdownTimer({ timer, size = 120, className }: { timer: TimerState; size?: number; className?: string }) {
  if (timer.phase === 'none') return null;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const warn = timer.phase === 'answering' && timer.remainingMs <= 5000;
  const color =
    timer.phase === 'paused'
      ? '#FFC857'
      : timer.phase === 'discussion'
        ? '#A66BFF'
        : timer.phase === 'expired' || timer.phase === 'closed'
          ? '#A8B7CC'
          : warn
            ? '#FF455A'
            : '#3EE7FF';
  const label =
    timer.phase === 'paused'
      ? 'PAUZA'
      : timer.phase === 'discussion'
        ? 'MUHOKAMA'
        : timer.phase === 'expired' || timer.phase === 'closed'
          ? 'VAQT TUGADI'
          : 'SONIYA';
  return (
    <div
      className={clsx('relative inline-flex shrink-0 items-center justify-center', warn && 'timer-warning', className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={`${label}: ${formatSeconds(timer.remainingMs)}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="rgba(4,10,20,0.75)" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - timer.progress)}
          style={{ transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        {timer.phase === 'paused' ? (
          <Pause className="mb-1 h-[28%] w-[28%] text-arena-warning" />
        ) : timer.phase === 'discussion' ? (
          <Users className="mb-0.5 h-[18%] w-[18%] text-arena-purple" />
        ) : null}
        <span className="font-display font-extrabold tabular-nums" style={{ color, fontSize: size * 0.3 }}>
          {formatSeconds(timer.remainingMs)}
        </span>
        <span className="mt-1 font-semibold tracking-[0.18em] text-arena-muted" style={{ fontSize: Math.max(8, size * 0.075) }}>
          {label}
        </span>
      </div>
    </div>
  );
}
