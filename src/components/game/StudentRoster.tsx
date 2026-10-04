import clsx from 'clsx';
import { Check, Circle, X } from 'lucide-react';
import type { Player, Team } from '../../game/types';
import { TEAM_COLORS } from '../../game/constants';

/** Arena uchun: jamoaning 5 ta oʻquvchi indikatori (ulanish va javob holati) */
export function PlayerDots({
  team,
  players,
  answered,
  online,
  correctness,
  size = 'md',
}: {
  team: Team;
  players: Player[];
  answered: Set<string>;
  online?: Set<string>;
  /** javob ochilgandan keyin: player_id → toʻgʻri/notoʻgʻri */
  correctness?: Map<string, boolean>;
  size?: 'md' | 'lg';
}) {
  const color = TEAM_COLORS[team.color].hex;
  const slots = Math.max(players.length, 5);
  return (
    <ul className="grid grid-cols-5 gap-2">
      {Array.from({ length: slots }, (_, i) => players[i]).map((p, i) => {
        if (!p) {
          return (
            <li key={`empty-${i}`} className="flex flex-col items-center gap-1 opacity-30">
              <div className={clsx('rounded-full border-2 border-dashed border-white/30', size === 'lg' ? 'h-10 w-10' : 'h-8 w-8')} />
              <span className="text-[0.6rem]">—</span>
            </li>
          );
        }
        const isOnline = online ? online.has(p.id) : true;
        const did = answered.has(p.id);
        const verdict = correctness?.get(p.id);
        return (
          <li key={p.id} className="flex min-w-0 flex-col items-center gap-1" title={p.nickname}>
            <div
              className={clsx(
                'relative flex items-center justify-center rounded-full border-2 font-display font-bold transition-all',
                size === 'lg' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs',
                !isOnline && 'opacity-40',
              )}
              style={{
                borderColor: verdict === true ? '#35D49A' : verdict === false ? '#FF455A' : did ? color : 'rgba(255,255,255,0.18)',
                background: did ? `${color}33` : 'rgba(4,10,20,0.6)',
                boxShadow: did ? `0 0 14px ${color}88` : undefined,
              }}
            >
              {verdict === true ? (
                <Check className="h-4 w-4 text-arena-success" />
              ) : verdict === false ? (
                <X className="h-4 w-4 text-arena-red" />
              ) : (
                p.nickname.slice(0, 1).toUpperCase()
              )}
              {online && (
                <span
                  className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-space-900', isOnline ? 'bg-arena-success' : 'bg-arena-muted/50')}
                />
              )}
            </div>
            <span className="w-full truncate text-center text-[0.62rem] font-semibold text-arena-muted">{p.nickname}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Lobbi va konsol uchun jamoa roʻyxati */
export function StudentRoster({
  team,
  players,
  online,
  highlightId,
  teamSize,
}: {
  team: Team;
  players: Player[];
  online?: Set<string>;
  highlightId?: string | null;
  teamSize: number;
}) {
  const color = TEAM_COLORS[team.color].hex;
  return (
    <div className="rounded-2xl border bg-space-950/40 p-4" style={{ borderColor: `${color}55` }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold tracking-wide" style={{ color }}>
          {team.name}
        </h3>
        <span className="chip border-white/10 text-arena-muted">
          {players.length}/{teamSize}
        </span>
      </div>
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li
            key={p.id}
            className={clsx(
              'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
              p.id === highlightId ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white/[0.03]',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Circle
                className={clsx('h-2.5 w-2.5 shrink-0', online?.has(p.id) ? 'fill-arena-success text-arena-success' : 'fill-arena-muted/40 text-arena-muted/40')}
              />
              <span className="truncate font-semibold">{p.nickname}</span>
            </span>
            {p.id === highlightId && <span className="text-xs text-arena-cyan">Siz</span>}
          </li>
        ))}
        {Array.from({ length: Math.max(0, teamSize - players.length) }).map((_, i) => (
          <li key={i} className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-sm text-arena-muted/50">
            Boʻsh oʻrin
          </li>
        ))}
      </ul>
    </div>
  );
}
