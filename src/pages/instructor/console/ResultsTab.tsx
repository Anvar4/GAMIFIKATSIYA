import { Link } from 'react-router-dom';
import { Download, LayoutDashboard, MonitorPlay, RotateCcw, Trophy } from 'lucide-react';
import { Panel } from '../../../components/ui/Basics';
import { AwardsGrid, Leaderboard } from '../../../components/game/VictoryScreen';
import { useFeedback } from '../../../context/Feedback';
import { AWARDS, AWARD_ORDER, TEAM_COLORS, roundMeta } from '../../../game/constants';
import type { AwardKey, GameResults, RoomSnapshot } from '../../../game/types';
import { accuracy } from '../../../game/scoring';
import { resetRoom, setAward, setWinner } from '../../../services/api';
import { downloadFile, safeFileName, toCsv } from '../../../lib/csv';
import { sortedTeams, type ConsoleCtx } from './shared';

export function buildResultsCsv(s: RoomSnapshot, r: GameResults): string {
  const teamName = (id: string | null | undefined) => s.teams.find((t) => t.id === id)?.name ?? '';
  const rows: (string | number | null)[][] = [
    ['IT ARENA — Galaktik jang natijalari'],
    ['Oʻyin', s.room.title],
    ['Xona kodi', s.room.room_code],
    ['Sana', new Date(r.completed_at).toLocaleString('uz-UZ')],
    ['Gʻolib', r.is_tie ? 'Durang' : teamName(r.winner_team_id)],
    ['Oʻynalgan savollar', r.statistics.questions_played],
    [],
    ['JAMOALAR'],
    ['Jamoa', 'Ball', 'Qalqon', 'Toʻgʻri javoblar', 'Javoblar', 'Imkoniyatlar', 'Aniqlik %', 'Eng uzun seriya', 'Qoʻlda tuzatishlar'],
    ...r.final_scores.map((t) => [t.name, t.score, t.shield, t.correct_count, t.answered_count, t.possible_count, t.accuracy, t.best_streak, t.adjustments]),
    [],
    ['OʻQUVCHILAR'],
    ['Oʻrin', 'Oʻquvchi', 'Jamoa', 'Ball', 'Toʻgʻri', 'Javob bergan', 'Savollar', 'Aniqlik %', 'Oʻrtacha toʻgʻri javob vaqti (s)', 'Eng tez toʻgʻri javob (s)', 'Eng uzun seriya', '1-raund', '2-raund', '3-raund', '4-raund', '5-raund'],
    ...r.statistics.players.map((p, i) => [
      i + 1,
      p.nickname,
      teamName(p.team_id),
      p.score,
      p.correct,
      p.answered,
      p.possible,
      p.accuracy,
      p.avg_correct_ms !== null ? (p.avg_correct_ms / 1000).toFixed(1) : '',
      p.fastest_correct_ms !== null ? (p.fastest_correct_ms / 1000).toFixed(1) : '',
      p.best_streak,
      ...[1, 2, 3, 4, 5].map((n) => p.round_points?.[String(n)] ?? 0),
    ]),
    [],
    ['RAUNDLAR'],
    ['Raund', ...r.final_scores.map((t) => t.name)],
    ...r.statistics.rounds.map((rd) => [`${rd.round}. ${roundMeta(rd.round, s.room.settings).title}`, ...r.final_scores.map((t) => rd.teams[t.team_id] ?? 0)]),
    [],
    ['MUKOFOTLAR'],
    ...AWARD_ORDER.filter((k) => r.awards[k]).map((k) => [AWARDS[k].title, r.awards[k]!.nickname, r.awards[k]!.reason]),
  ];
  return toCsv(rows);
}

export function ResultsTab({ s, client, run, busy }: ConsoleCtx) {
  const { confirm } = useFeedback();
  const teams = sortedTeams(s);
  const r = s.results;

  if (!r || s.room.status !== 'finished') {
    const ranking = [...s.players].filter((p) => p.status === 'approved').sort((a, b) => b.score - a.score);
    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Joriy hisob">
          <div className="grid grid-cols-2 gap-3">
            {teams.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-space-950/40 p-4 text-center" style={{ borderColor: `${TEAM_COLORS[t.color].hex}55` }}>
                <div className="font-display text-lg font-bold" style={{ color: TEAM_COLORS[t.color].hex }}>
                  {t.name}
                </div>
                <div className="font-display text-4xl font-black">{t.score}</div>
                <div className="text-xs text-arena-muted">
                  Qalqon {t.shield} • Aniqlik {accuracy(t.correct_count, t.possible_count)}%
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-arena-muted">Yakuniy natijalar, mukofotlar va CSV eksport oʻyin yakunlangach paydo boʻladi.</p>
        </Panel>
        <Panel title="Oʻquvchilar reytingi">
          <ol className="space-y-1">
            {ranking.map((p, i) => {
              const t = teams.find((x) => x.id === p.team_id);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm">
                  <span className="w-5 font-display font-bold text-arena-muted">{i + 1}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: t ? TEAM_COLORS[t.color].hex : '#888' }} />
                  <span className="flex-1 font-semibold">{p.nickname}</span>
                  <span className="text-arena-muted">{p.correct_count} toʻgʻri</span>
                  <span className="w-14 text-right font-display font-bold">{p.score}</span>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>
    );
  }

  const winner = teams.find((t) => t.id === r.winner_team_id);
  return (
    <div className="space-y-5">
      <Panel
        title="Yakuniy natija"
        icon={<Trophy className="h-4 w-4" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(`${safeFileName(s.room.title)}_${s.room.room_code}_natijalar.csv`, buildResultsCsv(s, r))}>
              <Download className="h-4 w-4" /> CSV yuklab olish
            </button>
            <a className="btn btn-ghost btn-sm" href={`/arena/${s.room.id}`} target="_blank" rel="noreferrer">
              <MonitorPlay className="h-4 w-4" /> Arenada koʻrsatish
            </a>
            <button
              className="btn btn-warning btn-sm"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Oʻyinni qaytadan boshlash',
                  message: 'Ballar va natijalar tozalanadi, oʻquvchilar va jamoalar saqlanadi. Natijalarni avval CSV ga yuklab oling.',
                  confirmText: 'Qayta boshlash',
                  danger: true,
                });
                if (ok) void run('reset', () => resetRoom(client, s.room.id), 'Xona yangi oʻyinga tayyor');
              }}
            >
              <RotateCcw className="h-4 w-4" /> Qayta oʻynash
            </button>
            <Link to="/teacher" className="btn btn-ghost btn-sm">
              <LayoutDashboard className="h-4 w-4" /> Boshqaruv paneli
            </Link>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {r.final_scores
            .slice()
            .sort((a, b) => a.slot - b.slot)
            .map((fs, i) => (
              <div key={fs.team_id} className={i === 1 ? 'md:order-3' : ''}>
                <div className="rounded-2xl border bg-space-950/40 p-4 text-center" style={{ borderColor: `${TEAM_COLORS[fs.color].hex}66` }}>
                  <div className="font-display text-xl font-bold" style={{ color: TEAM_COLORS[fs.color].hex }}>
                    {fs.name}
                  </div>
                  <div className="font-display text-5xl font-black">{fs.score}</div>
                  <div className="mt-1 text-xs text-arena-muted">
                    Qalqon {fs.shield}/{fs.max_shield} • {fs.correct_count} toʻgʻri • aniqlik {fs.accuracy}%
                  </div>
                </div>
              </div>
            ))}
          <div className="text-center md:order-2">
            <img src="/assets/brand/trophy.webp" alt="" className="mx-auto h-24" />
            <div className="font-display text-sm uppercase tracking-[0.3em] text-arena-warning">{r.is_tie ? 'Durang' : 'Gʻolib'}</div>
            <div className="font-display text-2xl font-black" style={{ color: winner ? TEAM_COLORS[winner.color].hex : undefined }}>
              {r.is_tie ? 'Teng' : winner?.name}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-space-950/40 p-3 text-sm">
          <span className="text-arena-muted">Gʻolibni qoʻlda belgilash (tie-breaker):</span>
          {teams.map((t) => (
            <button
              key={t.id}
              className="btn btn-ghost btn-sm"
              disabled={busy !== null || r.winner_team_id === t.id}
              style={{ color: TEAM_COLORS[t.color].hex }}
              onClick={() => void run('winner', () => setWinner(client, s.room.id, t.id), 'Gʻolib belgilandi')}
            >
              {t.name}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" disabled={busy !== null || r.is_tie} onClick={() => void run('winner', () => setWinner(client, s.room.id, null))}>
            Durang
          </button>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Mukofotlar">
          <AwardsGrid results={r} teams={teams} compact />
          <div className="mt-4 space-y-2">
            <div className="label">Mukofotni oʻqituvchi tayinlashi</div>
            {AWARD_ORDER.map((k: AwardKey) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-44 shrink-0 font-display text-xs font-bold tracking-wider text-arena-warning">{AWARDS[k].title}</span>
                <select
                  className="input py-1.5"
                  value={r.awards[k]?.player_id ?? ''}
                  disabled={busy !== null}
                  onChange={(e) => void run('award', () => setAward(client, s.room.id, k, e.target.value || null), 'Mukofot yangilandi')}
                >
                  <option value="">— berilmagan —</option>
                  {r.statistics.players.map((p) => (
                    <option key={p.player_id} value={p.player_id}>
                      {p.nickname}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Batafsil reyting">
          <Leaderboard results={r} teams={teams} />
          {r.statistics.fastest_correct && (
            <p className="mt-3 text-sm text-arena-muted">
              Eng tez toʻgʻri javob: <b className="text-arena-text">{r.statistics.fastest_correct.nickname}</b> —{' '}
              {(r.statistics.fastest_correct.response_ms / 1000).toFixed(2)} s
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Raundlar boʻyicha">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[0.68rem] uppercase tracking-[0.12em] text-arena-muted">
              <tr>
                <th className="py-2 text-left">Raund</th>
                {r.final_scores.map((t) => (
                  <th key={t.team_id} className="py-2 text-right" style={{ color: TEAM_COLORS[t.color].hex }}>
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.statistics.rounds.map((rd) => (
                <tr key={rd.round} className="border-t border-white/5">
                  <td className="py-2">
                    {rd.round}. {roundMeta(rd.round, s.room.settings).title}
                  </td>
                  {r.final_scores.map((t) => (
                    <td key={t.team_id} className="py-2 text-right font-display font-bold tabular-nums">
                      {rd.teams[t.team_id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
