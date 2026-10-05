import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BookOpen, Brain, Crown, Medal, TrendingUp, Users, Zap } from 'lucide-react';
import type { AwardKey, GameResults, Player, Team } from '../../game/types';
import { AWARDS, AWARD_ORDER, TEAM_COLORS } from '../../game/constants';
import { awardImage } from '../../game/assets';
import { AnimatedNumber } from '../ui/Basics';
import { Spaceship } from './Spaceship';

const AWARD_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="h-6 w-6" />,
  brain: <Brain className="h-6 w-6" />,
  zap: <Zap className="h-6 w-6" />,
  book: <BookOpen className="h-6 w-6" />,
  users: <Users className="h-6 w-6" />,
  trending: <TrendingUp className="h-6 w-6" />,
};

/** Mukofot medali: Higgsfield rasmi boʻlsa — rasm, aks holda vektor belgi */
export function AwardIcon({ award, color }: { award: AwardKey; color: string }) {
  const img = awardImage(award);
  if (img) return <img src={img} alt="" className="h-14 w-14 shrink-0 object-contain" style={{ filter: `drop-shadow(0 0 12px ${color}66)` }} decoding="async" />;
  return (
    <div className="rounded-xl p-2" style={{ background: `${color}22`, color }}>
      {AWARD_ICONS[AWARDS[award].icon]}
    </div>
  );
}

export function AwardsGrid({ results, teams, compact }: { results: GameResults; teams: Team[]; compact?: boolean }) {
  const entries = AWARD_ORDER.map((k) => [k, results.awards[k]] as const).filter(([, v]) => v);
  if (entries.length === 0) return <p className="text-sm text-arena-muted">Mukofotlar uchun maʼlumot yetarli emas.</p>;
  return (
    <div className={clsx('grid gap-3', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 xl:grid-cols-3')}>
      {entries.map(([key, award], i) => {
        const meta = AWARDS[key as AwardKey];
        const team = teams.find((t) => t.id === award!.team_id);
        const color = team ? TEAM_COLORS[team.color].hex : '#3EE7FF';
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.12 }}
            className="relative overflow-hidden rounded-2xl border bg-space-950/60 p-4"
            style={{ borderColor: `${color}55` }}
          >
            <div className="flex items-start gap-3">
              <AwardIcon award={key as AwardKey} color={color} />
              <div className="min-w-0">
                <div className="font-display text-xs font-bold tracking-[0.2em] text-arena-warning">{meta.title}</div>
                <div className="text-[0.7rem] text-arena-muted">{meta.subtitle}</div>
                <div className="mt-1 truncate font-display text-xl font-extrabold" style={{ color }}>
                  {award!.nickname}
                </div>
                <div className="text-xs text-arena-muted">{award!.reason}</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Leaderboard({
  results,
  teams,
  highlightId,
  limit,
}: {
  results: GameResults;
  teams: Team[];
  highlightId?: string | null;
  limit?: number;
}) {
  const rows = results.statistics.players.slice(0, limit ?? results.statistics.players.length);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[0.68rem] uppercase tracking-[0.14em] text-arena-muted">
          <tr>
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Oʻquvchi</th>
            <th className="px-2 py-2 text-right">Ball</th>
            <th className="px-2 py-2 text-right">Toʻgʻri</th>
            <th className="px-2 py-2 text-right">Aniqlik</th>
            <th className="hidden px-2 py-2 text-right sm:table-cell">Oʻrt. vaqt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const team = teams.find((t) => t.id === p.team_id);
            const color = team ? TEAM_COLORS[team.color].hex : '#A8B7CC';
            return (
              <tr key={p.player_id} className={clsx('border-t border-white/5', p.player_id === highlightId && 'bg-white/10')}>
                <td className="px-2 py-2 font-display font-bold text-arena-muted">
                  {i < 3 ? <Medal className={clsx('h-4 w-4', i === 0 ? 'text-arena-warning' : i === 1 ? 'text-slate-300' : 'text-amber-600')} /> : i + 1}
                </td>
                <td className="px-2 py-2">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="font-semibold">{p.nickname}</span>
                </td>
                <td className="px-2 py-2 text-right font-display font-bold tabular-nums">{p.score}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {p.correct}/{p.possible}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{p.accuracy}%</td>
                <td className="hidden px-2 py-2 text-right tabular-nums text-arena-muted sm:table-cell">
                  {p.avg_correct_ms !== null ? `${(p.avg_correct_ms / 1000).toFixed(1)} s` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Kinematik gʻalaba ekrani (arena uchun) */
export function VictoryScreen({ results, teams }: { results: GameResults; teams: Team[]; players?: Player[] }) {
  const winner = teams.find((t) => t.id === results.winner_team_id) ?? null;
  const color = winner ? TEAM_COLORS[winner.color].hex : '#3EE7FF';
  const sorted = [...results.final_scores].sort((a, b) => a.slot - b.slot);
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid flex-1 grid-cols-[1fr_1.1fr_1fr] items-center gap-6">
        {sorted.map((fs, idx) => {
          const team = teams.find((t) => t.id === fs.team_id)!;
          const isWinner = fs.team_id === results.winner_team_id;
          const c = TEAM_COLORS[fs.color].hex;
          const block = (
            <motion.div
              key={fs.team_id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isWinner || results.is_tie ? 1 : 0.65, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.2 }}
              className="glass rounded-3xl p-5 text-center"
              style={{ borderColor: `${c}66` }}
            >
              <Spaceship skin={fs.spaceship_skin} color={fs.color} facing={fs.slot === 1 ? 'right' : 'left'} defeated={team?.is_defeated} className="mx-auto w-4/5" />
              <div className="mt-2 font-display text-2xl font-extrabold" style={{ color: c }}>
                {fs.name}
              </div>
              <AnimatedNumber value={fs.score} className="font-display text-5xl font-black" />
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-space-950/60 p-2">
                  <div className="font-display text-lg font-bold">{fs.shield}</div>
                  <div className="text-arena-muted">Qalqon</div>
                </div>
                <div className="rounded-lg bg-space-950/60 p-2">
                  <div className="font-display text-lg font-bold">{fs.correct_count}</div>
                  <div className="text-arena-muted">Toʻgʻri</div>
                </div>
                <div className="rounded-lg bg-space-950/60 p-2">
                  <div className="font-display text-lg font-bold">{fs.accuracy}%</div>
                  <div className="text-arena-muted">Aniqlik</div>
                </div>
              </div>
            </motion.div>
          );
          return block;
        }).flatMap((node, i) =>
          i === 0
            ? [
                node,
                <motion.div key="center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, type: 'spring' }} className="text-center">
                  <img src="/assets/brand/trophy.webp" alt="" className="mx-auto w-[60%] max-w-xs animate-float drop-shadow-[0_0_40px_rgba(255,200,87,0.5)]" />
                  <div className="mt-3 font-display text-sm font-bold uppercase tracking-[0.5em] text-arena-warning">
                    {results.is_tie ? 'Durang' : 'Gʻolib'}
                  </div>
                  <div className="font-logo text-[2.6rem] font-black leading-tight" style={{ color, textShadow: `0 0 30px ${color}` }}>
                    {results.is_tie ? 'TENG KUCHLAR!' : winner?.name}
                  </div>
                  <div className="mt-1 text-arena-muted">GALACTIC CHAMPIONS</div>
                </motion.div>,
              ]
            : [node],
        )}
      </div>
      <AwardsGrid results={results} teams={teams} />
    </div>
  );
}
