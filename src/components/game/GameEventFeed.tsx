import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { GameEvent, Player, Team } from '../../game/types';
import { describeEvent, type EventTone } from '../../game/events';

const TONE: Record<EventTone, string> = {
  info: 'border-arena-cyan/40 text-arena-text',
  success: 'border-arena-success/50 text-arena-success',
  danger: 'border-arena-red/50 text-arena-red',
  warning: 'border-arena-warning/50 text-arena-warning',
  ability: 'border-arena-purple/50 text-arena-purple',
  muted: 'border-white/10 text-arena-muted',
};

export function GameEventFeed({
  events,
  teams,
  players,
  limit = 6,
  all = false,
  direction = 'column',
  className,
}: {
  events: GameEvent[];
  teams: Team[];
  players: Player[];
  limit?: number;
  /** oʻqituvchi konsoli uchun: barcha hodisalar */
  all?: boolean;
  direction?: 'column' | 'row';
  className?: string;
}) {
  const items = events
    .map((e) => ({ e, v: describeEvent(e, { teams, players }) }))
    .filter((x) => all || x.v.feed)
    .slice(-limit)
    .reverse();
  return (
    <ul className={clsx('flex gap-1.5', direction === 'column' ? 'flex-col' : 'flex-row overflow-hidden', className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map(({ e, v }) => (
          <motion.li
            key={e.id}
            layout
            initial={{ opacity: 0, y: direction === 'column' ? -8 : 0, x: direction === 'row' ? -20 : 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0 }}
            className={clsx(
              'shrink-0 rounded-lg border-l-2 bg-space-950/50 px-3 py-1.5 text-sm leading-snug',
              direction === 'row' && 'max-w-[22rem] truncate',
              TONE[v.tone],
            )}
          >
            <span className="mr-2 text-[0.7em] tabular-nums text-arena-muted">
              {new Date(e.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {v.text}
          </motion.li>
        ))}
      </AnimatePresence>
      {items.length === 0 && <li className="text-sm text-arena-muted">Hozircha hodisalar yoʻq</li>}
    </ul>
  );
}
