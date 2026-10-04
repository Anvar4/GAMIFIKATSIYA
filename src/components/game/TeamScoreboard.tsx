import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Flame, ShieldCheck, Swords, Target } from 'lucide-react';
import type { Player, Team } from '../../game/types';
import { SKINS, TEAM_COLORS } from '../../game/constants';
import { accuracy } from '../../game/scoring';
import { AnimatedNumber } from '../ui/Basics';
import { EnergyBar, ShieldBar } from './Meters';
import { PlayerDots } from './StudentRoster';
import { Spaceship } from './Spaceship';

interface Props {
  team: Team;
  players: Player[];
  answered: Set<string>;
  online?: Set<string>;
  correctness?: Map<string, boolean>;
  maxEnergy: number;
  side: 'left' | 'right';
  leading?: boolean;
}

/** Arena yon paneli: jamoa nomi, ball, qalqon, energiya, statistika va oʻquvchilar */
export function TeamScoreboard({ team, players, answered, online, correctness, maxEnergy, side, leading }: Props) {
  const c = TEAM_COLORS[team.color];
  return (
    <motion.section
      initial={{ opacity: 0, x: side === 'left' ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="glass relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl p-4"
      style={{ borderColor: `${c.hex}55`, boxShadow: `0 0 40px ${c.hex}22, inset 0 0 60px ${c.hex}11` }}
      aria-label={`${team.name} jamoasi`}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${c.hex}, transparent)` }} />
      <header className={clsx('flex items-center gap-3', side === 'right' && 'flex-row-reverse text-right')}>
        <div className="min-w-0 flex-1">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-arena-muted">{SKINS[team.spaceship_skin].label} kemasi</div>
          <h2 className="truncate font-display text-[1.7rem] font-extrabold leading-tight tracking-wide" style={{ color: c.hex, textShadow: `0 0 18px ${c.hex}88` }}>
            {team.name}
          </h2>
        </div>
        {leading && (
          <span className="chip border-arena-warning/60 bg-arena-warning/10 text-arena-warning">
            <Swords className="h-3.5 w-3.5" /> Yetakchi
          </span>
        )}
      </header>

      <div className={clsx('flex items-end gap-2', side === 'right' && 'flex-row-reverse')}>
        <AnimatedNumber value={team.score} className="font-display text-[3.4rem] font-extrabold leading-none text-arena-text" />
        <span className="mb-2 text-sm font-semibold uppercase tracking-widest text-arena-muted">ball</span>
      </div>

      <ShieldBar value={team.shield} max={team.max_shield} color={c.hex} size="lg" />
      <EnergyBar value={team.energy} max={maxEnergy} size="md" />

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat icon={<Target className="h-4 w-4" />} label="Toʻgʻri" value={team.correct_count} />
        <MiniStat icon={<Flame className="h-4 w-4" />} label="Seriya" value={team.streak} highlight={team.streak >= 3} />
        <MiniStat label="Aniqlik" value={`${accuracy(team.correct_count, team.possible_count)}%`} />
      </div>

      {(team.shield_boost_active || team.double_attack_active || team.is_defeated) && (
        <div className="flex flex-wrap gap-1.5">
          {team.shield_boost_active && (
            <span className="chip border-arena-cyan/50 bg-arena-cyan/10 text-arena-cyan">
              <ShieldCheck className="h-3.5 w-3.5" /> SHIELD BOOST
            </span>
          )}
          {team.double_attack_active && (
            <span className="chip border-arena-red/50 bg-arena-red/10 text-arena-red">
              <Swords className="h-3.5 w-3.5" /> DOUBLE ATTACK
            </span>
          )}
          {team.is_defeated && <span className="chip border-arena-red bg-arena-red/20 text-arena-red">MAGʻLUB</span>}
        </div>
      )}

      <div className="mt-auto">
        <PlayerDots team={team} players={players} answered={answered} online={online} correctness={correctness} size="lg" />
      </div>
    </motion.section>
  );
}

function MiniStat({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={clsx('rounded-xl border bg-space-950/50 px-2 py-1.5', highlight ? 'border-arena-warning/50' : 'border-white/5')}>
      <div className={clsx('flex items-center justify-center gap-1 font-display text-xl font-bold', highlight && 'text-arena-warning')}>
        {icon}
        {value}
      </div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-arena-muted">{label}</div>
    </div>
  );
}

/** Lobbi/oʻquvchi ekrani uchun kema kartasi */
export function SpaceshipCard({ team, subtitle, facing = 'right', className }: { team: Team; subtitle?: string; facing?: 'left' | 'right'; className?: string }) {
  const c = TEAM_COLORS[team.color];
  return (
    <div
      className={clsx('relative overflow-hidden rounded-3xl border bg-space-950/40 p-5', className)}
      style={{ borderColor: `${c.hex}66`, boxShadow: `inset 0 0 60px ${c.hex}1f` }}
    >
      <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 60%, ${c.hex}55, transparent 60%)` }} />
      <div className="relative">
        <div className="text-center font-display text-2xl font-extrabold tracking-wide" style={{ color: c.hex, textShadow: `0 0 16px ${c.hex}aa` }}>
          {team.name}
        </div>
        {subtitle && <div className="mt-1 text-center text-xs uppercase tracking-[0.25em] text-arena-muted">{subtitle}</div>}
        <Spaceship skin={team.spaceship_skin} color={team.color} facing={facing} className="mx-auto mt-3 w-[85%] max-w-sm" />
      </div>
    </div>
  );
}
