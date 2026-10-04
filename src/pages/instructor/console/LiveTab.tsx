import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, Circle, Clock3, Lightbulb, Minus, Plus, Sparkles, X } from 'lucide-react';
import { Panel } from '../../../components/ui/Basics';
import { InstructorControls } from '../../../components/game/InstructorControls';
import { CountdownTimer } from '../../../components/game/CountdownTimer';
import { AbilityPanel } from '../../../components/game/AbilityPanel';
import { GameEventFeed } from '../../../components/game/GameEventFeed';
import { EnergyBar, ShieldBar } from '../../../components/game/Meters';
import { OPTION_LETTERS, StepsReveal, formatCorrectAnswer, isChoiceType } from '../../../components/game/QuestionCard';
import { matchingPairs, stringOptions } from '../../../game/questionShape';
import { useFeedback } from '../../../context/Feedback';
import { useAutoFinalize, useQuestionTimer, useServerNow } from '../../../hooks/useTimer';
import { ABILITIES, SPECIAL_EVENTS, TEAM_COLORS, roundMeta } from '../../../game/constants';
import { instructorActions } from '../../../game/state';
import type { AbilityType, AnswerRow, QuestionPayload, SpecialEventKind } from '../../../game/types';
import {
  activateAbility,
  adjustScore,
  adjustTimer,
  endGame,
  endRound,
  finalizeQuestion,
  pauseGame,
  resolveAbilityRequest,
  restartQuestion,
  resumeGame,
  skipQuestion,
  startQuestion,
  startRound,
  triggerSpecialEvent,
} from '../../../services/api';
import { sortedTeams, teamPlayers, type ConsoleCtx } from './shared';

export function LiveTab(ctx: ConsoleCtx) {
  const { s, client, run, busy, online } = ctx;
  const { confirm } = useFeedback();
  const teams = sortedTeams(s);
  const actions = instructorActions(s);
  const q = s.question;
  const timer = useQuestionTimer(s.room, q);
  const now = useServerNow(1000);
  useAutoFinalize(client, s.room, q, timer, { delayMs: 1100 });

  const live = s.room.status === 'active' || s.room.status === 'paused';
  const answered = new Set(s.answered_player_ids);
  const approved = s.players.filter((p) => p.status === 'approved' && p.team_id);
  const answerMap = new Map(s.answers.map((a) => [a.player_id, a]));
  const stepMap = new Map((s.step_progress ?? []).map((p) => [p.player_id, p]));

  const handlers = {
    onStartQuestion: (disc: number | null) => void run('startQ', () => startQuestion(client, s.room.id, null, disc)),
    onReveal: () => q && void run('reveal', () => finalizeQuestion(client, q.id, true)),
    onSkip: async () => {
      if (!q) return;
      if (await confirm({ title: 'Savolni oʻtkazib yuborish', message: 'Berilgan javoblar oʻchiriladi va ball berilmaydi.', confirmText: 'Oʻtkazish', danger: true }))
        void run('skip', () => skipQuestion(client, q.id), 'Savol oʻtkazib yuborildi');
    },
    onRestart: async () => {
      if (!q) return;
      if (await confirm({ title: 'Savolni qayta boshlash', message: 'Joriy javoblar oʻchiriladi va taymer qaytadan boshlanadi.', confirmText: 'Qayta boshlash', danger: true }))
        void run('restart', () => restartQuestion(client, q.id), 'Savol qayta boshlandi');
    },
    onPause: () => void run('pause', () => pauseGame(client, s.room.id)),
    onResume: () => void run('resume', () => resumeGame(client, s.room.id)),
    onAdjustTimer: (sec: number) => void run('timer', () => adjustTimer(client, s.room.id, sec)),
    onNextRound: () => void run('round', () => startRound(client, s.room.id, null)),
    onEndRound: () => void run('endRound', () => endRound(client, s.room.id), 'Raund yakunlandi'),
    onEndGame: async () => {
      if (await confirm({ title: 'Oʻyinni yakunlash', message: 'Yakuniy natijalar va mukofotlar hisoblanadi. Bu amalni ortga qaytarib boʻlmaydi.', confirmText: 'Yakunlash', danger: true }))
        void run('endGame', () => endGame(client, s.room.id, null), 'Oʻyin yakunlandi!');
    },
  };

  // Klaviatura qisqartmalari
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'n' && actions.canStartQuestion && !busy) handlers.onStartQuestion(null);
      if (k === 'r' && actions.canReveal && !busy) handlers.onReveal();
      if (k === 'p' && !busy) (actions.canResume ? handlers.onResume : actions.canPause ? handlers.onPause : () => undefined)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Variantlar boʻyicha javoblar taqsimoti (faqat oʻqituvchi koʻradi)
  const distribution = useMemo(() => {
    if (!q || !isChoiceType(q.question_type)) return null;
    const counts = stringOptions(q.options).map(() => 0);
    s.answers.forEach((a) => {
      const i = Number(a.selected_answer);
      if (counts[i] !== undefined) counts[i] += 1;
    });
    return counts;
  }, [q, s.answers]);

  if (!live && s.room.status !== 'finished') {
    return (
      <Panel>
        <p className="text-arena-muted">Oʻyin hali boshlanmagan. “Roʻyxat va jamoalar” tabida oʻquvchilarni tasdiqlab, oʻyinni boshlang.</p>
      </Panel>
    );
  }

  const correctIdx = q?.secret && typeof q.secret.correct_answer === 'number' ? q.secret.correct_answer : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title={`${Math.max(1, s.room.current_round)}-raund • ${roundMeta(Math.max(1, s.room.current_round), s.room.settings).title}`}>
          <InstructorControls actions={actions} currentRound={Math.max(1, s.room.current_round)} settings={s.room.settings} busy={busy} {...handlers} />
          {s.room.next_points_multiplier > 1 && (
            <p className="mt-3 rounded-xl border border-arena-warning/40 bg-arena-warning/10 px-3 py-2 text-sm text-arena-warning">
              Keyingi savol ballari ×{s.room.next_points_multiplier}
            </p>
          )}
          <p className="mt-3 text-xs text-arena-muted">
            Qisqartmalar: <span className="kbd">N</span> keyingi savol • <span className="kbd">R</span> javobni ochish • <span className="kbd">P</span> pauza
          </p>
        </Panel>

        <Panel title="Joriy savol" actions={<span className="text-xs text-arena-muted">{q ? `${q.answer_count}/${approved.length} javob` : ''}</span>}>
          {!q ? (
            <p className="text-sm text-arena-muted">
              Faol savol yoʻq. {actions.nextQuestion ? `Keyingisi: “${actions.nextQuestion.question_text}”` : 'Bu raundda savol qolmadi — keyingi raundni boshlang.'}
            </p>
          ) : (
            <div className="flex gap-4">
              <CountdownTimer timer={timer} size={108} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-arena-muted">
                  {q.sequence_number}-savol • {q.points} ball • {q.secret?.category}
                  {q.status === 'revealed' && ' • ochilgan'}
                </div>
                <p className="mt-1 font-semibold leading-snug">{q.question_text}</p>
                {q.image_url && <img src={q.image_url} alt="" className="mt-2 h-20 rounded-lg bg-space-950 object-contain p-1" />}
                {distribution ? (
                  <ul className="mt-3 space-y-1">
                    {stringOptions(q.options).map((o, i) => (
                      <li key={i} className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm', i === correctIdx ? 'bg-arena-success/15 text-arena-success' : 'bg-white/[0.03]')}>
                        <span className="w-5 font-display font-bold">{OPTION_LETTERS[i]}</span>
                        <span className="min-w-0 flex-1 truncate">{o}</span>
                        <span className="tabular-nums text-arena-muted">{distribution[i]}</span>
                        {i === correctIdx && <Check className="h-4 w-4" />}
                      </li>
                    ))}
                  </ul>
                ) : q.question_type === 'matching' ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {matchingPairs(q.options, q.secret?.correct_answer).map((p, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg bg-arena-success/10 px-2 py-1 text-arena-success">
                        <span className="min-w-0 flex-1 truncate text-arena-text">{p.left}</span>→<span className="min-w-0 flex-1 truncate">{p.right}</span>
                      </li>
                    ))}
                  </ul>
                ) : q.question_type === 'multi_step' ? (
                  <div className="mt-3 max-h-64 overflow-y-auto pr-1 text-sm scrollbar-thin">
                    <StepsReveal steps={q.steps ?? []} correct={Array.isArray(q.secret?.correct_answer) ? q.secret.correct_answer.map(Number) : []} />
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-arena-success/10 px-3 py-2 text-sm text-arena-success">
                    Toʻgʻri javob: {formatCorrectAnswer(q.question_type, q.options, q.secret?.correct_answer)}
                  </p>
                )}
                {q.secret?.hint && (
                  <p className="mt-2 flex gap-1.5 text-xs text-arena-muted">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-arena-success" /> {q.secret.hint}
                  </p>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {teams.map((team) => {
          const c = TEAM_COLORS[team.color].hex;
          const members = teamPlayers(s, team);
          return (
            <Panel key={team.id} title={<span style={{ color: c }}>{team.name}</span>} actions={<span className="font-display text-2xl font-extrabold">{team.score}</span>}>
              <div className="grid gap-3 sm:grid-cols-2">
                <ShieldBar value={team.shield} max={team.max_shield} color={c} />
                <EnergyBar value={team.energy} max={s.room.settings.max_energy} />
              </div>
              <table className="mt-4 w-full text-sm">
                <thead className="text-[0.65rem] uppercase tracking-[0.12em] text-arena-muted">
                  <tr>
                    <th className="py-1 text-left">Oʻquvchi</th>
                    <th className="py-1 text-left">Javob</th>
                    <th className="py-1 text-right">Vaqt</th>
                    <th className="py-1 text-right">Ball</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((p) => {
                    const a = answerMap.get(p.id);
                    return (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            <Circle className={clsx('h-2.5 w-2.5', online.has(p.id) ? 'fill-arena-success text-arena-success' : 'fill-arena-red/60 text-arena-red/60')} />
                            <span className="truncate font-semibold">{p.nickname}</span>
                            {p.streak >= 2 && <span className="text-xs text-arena-warning">🔥{p.streak}</span>}
                          </span>
                        </td>
                        <td className="py-1.5">
                          {q && answered.has(p.id) ? (
                            <span className="flex items-center gap-1.5">
                              {a?.is_correct === true && <Check className="h-4 w-4 text-arena-success" />}
                              {a?.is_correct === false && <X className="h-4 w-4 text-arena-red" />}
                              <span className="text-arena-text">{answerLabel(q, a)}</span>
                            </span>
                          ) : q?.status === 'active' && stepMap.has(p.id) ? (
                            <span className="flex items-center gap-1 text-arena-cyan">
                              <Clock3 className="h-3.5 w-3.5" /> {stepMap.get(p.id)!.done}/{q.input_spec?.steps ?? '?'} qadam
                            </span>
                          ) : q?.status === 'active' ? (
                            <span className="flex items-center gap-1 text-arena-muted">
                              <Clock3 className="h-3.5 w-3.5" /> kutilmoqda
                            </span>
                          ) : (
                            <span className="text-arena-muted">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-arena-muted">{a ? `${(a.response_ms / 1000).toFixed(1)} s` : ''}</td>
                        <td className="py-1.5 text-right font-display font-bold tabular-nums">{p.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4">
                <div className="label">Qobiliyatlar</div>
                <AbilityPanel
                  team={team}
                  abilities={s.abilities}
                  settings={s.room.settings}
                  questionActive={q?.status === 'active'}
                  serverNow={now}
                  busy={busy !== null}
                  compact
                  onUse={(ab: AbilityType) => void run('ability', () => activateAbility(client, s.room.id, team.id, ab), `${ABILITIES[ab].title} faollashtirildi`)}
                />
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5">
          {s.ability_requests.length > 0 && (
            <Panel title="Jamoa soʻrovlari">
              <ul className="space-y-2">
                {s.ability_requests.map((r) => {
                  const team = teams.find((t) => t.id === r.team_id);
                  const who = s.players.find((p) => p.id === r.player_id);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-arena-purple/30 bg-arena-purple/10 p-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <b style={{ color: team ? TEAM_COLORS[team.color].hex : undefined }}>{team?.name}</b>: {ABILITIES[r.ability_type].title}
                        <span className="block text-xs text-arena-muted">{who?.nickname} soʻradi</span>
                      </span>
                      <button className="btn btn-success btn-sm" disabled={busy !== null} onClick={() => void run('req', () => resolveAbilityRequest(client, r.id, true), 'Tasdiqlandi')}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void run('req', () => resolveAbilityRequest(client, r.id, false))}>
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          <Panel title="Maxsus hodisalar" icon={<Sparkles className="h-4 w-4" />}>
            <div className="grid gap-2">
              {(Object.keys(SPECIAL_EVENTS) as SpecialEventKind[]).map((k) => (
                <button key={k} className="btn btn-ghost justify-start" disabled={!live || busy !== null} onClick={() => void run('special', () => triggerSpecialEvent(client, s.room.id, k), SPECIAL_EVENTS[k].title)}>
                  <Sparkles className="h-4 w-4 text-arena-purple" />
                  <span className="font-semibold">{SPECIAL_EVENTS[k].title}</span>
                  <span className="ml-auto text-xs text-arena-muted">{SPECIAL_EVENTS[k].description}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <ScoreAdjustPanel ctx={ctx} />
        <Panel title="Hodisalar jurnali">
          <div className="max-h-[26rem] overflow-y-auto pr-1 scrollbar-thin">
            <GameEventFeed events={s.events} teams={s.teams} players={s.players} limit={40} all />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Oʻqituvchi jadvalidagi javob koʻrinishi (turga qarab) */
function answerLabel(q: QuestionPayload, a: AnswerRow | undefined): string {
  if (!a) return '✓';
  if (isChoiceType(q.question_type)) return OPTION_LETTERS[Number(a.selected_answer)] ?? '?';
  if (q.question_type === 'matching' || q.question_type === 'multi_step') {
    const total = q.question_type === 'matching' ? stringOptions(q.options).length : (q.input_spec?.steps ?? 0);
    const unit = q.question_type === 'matching' ? 'juft' : 'qadam';
    return a.credit !== null && a.credit !== undefined ? `${Math.round(Number(a.credit) * total)}/${total} ${unit}` : '✓';
  }
  return a.selected_answer;
}

function ScoreAdjustPanel({ ctx }: { ctx: ConsoleCtx }) {
  const { s, client, run, busy } = ctx;
  const teams = sortedTeams(s);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [playerId, setPlayerId] = useState('');
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');
  const members = s.players.filter((p) => p.team_id === teamId && p.status === 'approved');
  const submit = async (sign: 1 | -1) => {
    const r = await run('adjust', () => adjustScore(client, s.room.id, teamId, playerId || null, sign * Math.abs(amount), reason), 'Ball oʻzgartirildi (auditga yozildi)');
    if (r !== undefined) setReason('');
  };
  return (
    <Panel title="Ballni tuzatish (audit bilan)">
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setPlayerId(''); }} aria-label="Jamoa">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)} aria-label="Oʻquvchi">
          <option value="">Butun jamoa</option>
          {members.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname}
            </option>
          ))}
        </select>
        <input type="number" className="input" min={1} max={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Ball miqdori" />
        <input className="input" placeholder="Sabab (majburiy)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn btn-success" disabled={busy !== null || reason.trim().length < 3 || amount <= 0} onClick={() => void submit(1)}>
          <Plus className="h-4 w-4" /> Bonus qoʻshish
        </button>
        <button className="btn btn-danger" disabled={busy !== null || reason.trim().length < 3 || amount <= 0} onClick={() => void submit(-1)}>
          <Minus className="h-4 w-4" /> Ball ayirish
        </button>
      </div>
      {s.adjustments.length > 0 && (
        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-xs scrollbar-thin">
          {s.adjustments.map((a) => (
            <li key={a.id} className="flex gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
              <span className={clsx('font-display font-bold tabular-nums', a.delta > 0 ? 'text-arena-success' : 'text-arena-red')}>
                {a.delta > 0 ? '+' : ''}
                {a.delta}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {teams.find((t) => t.id === a.team_id)?.name}
                {a.player_id && ` • ${s.players.find((p) => p.id === a.player_id)?.nickname ?? ''}`} — {a.reason}
              </span>
              <span className="text-arena-muted">{new Date(a.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
