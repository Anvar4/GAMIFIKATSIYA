import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { Award, CheckCircle2, Flame, Hourglass, Lightbulb, PauseCircle, Send, Target, Trophy, Users, XCircle } from 'lucide-react';
import { AnimatedNumber, ConnectionBadge, ErrorState, LoadingScreen, Logo, SpaceBackground, Spinner } from '../../components/ui/Basics';
import { MotionToggle, SoundControls } from '../../components/ui/SoundControls';
import { SpaceshipCard } from '../../components/game/TeamScoreboard';
import { CountdownTimer } from '../../components/game/CountdownTimer';
import {
  AnswerOption,
  MatchingInput,
  MultiStepPanel,
  QuestionImage,
  ShortAnswerInput,
  StepsReveal,
  formatCorrectAnswer,
  isChoiceType,
  optionState,
  OPTION_LETTERS,
} from '../../components/game/QuestionCard';
import { EnergyBar, ShieldBar } from '../../components/game/Meters';
import { AbilityPanel } from '../../components/game/AbilityPanel';
import { Leaderboard } from '../../components/game/VictoryScreen';
import { useRoomSnapshot } from '../../hooks/useRoomSnapshot';
import { usePresence } from '../../hooks/usePresence';
import { useAutoFinalize, useQuestionTimer, useServerNow } from '../../hooks/useTimer';
import { useDocumentTitle } from '../../hooks/useUi';
import { useFeedback } from '../../context/Feedback';
import { ensureStudentSession, getStudentClient } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { syncClock } from '../../lib/clock';
import { soundEngine } from '../../lib/sound';
import { isFullSnapshot, requestAbility, submitAnswer, submitStep } from '../../services/api';
import { parseMatchingAnswer, stringOptions } from '../../game/questionShape';
import { ABILITIES, AWARDS, AWARD_ORDER, TEAM_COLORS, roundMeta } from '../../game/constants';
import { accuracy } from '../../game/scoring';
import type { AbilityType, GameEvent, RoomSnapshot, RoundProgress } from '../../game/types';

export default function Play() {
  const { roomId } = useParams();
  const client = getStudentClient();
  const { toast } = useFeedback();
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const sound = soundEngine('student');

  useEffect(() => {
    ensureStudentSession()
      .then(() => {
        setReady(true);
        void syncClock(client);
      })
      .catch((e) => setAuthError(errorMessage(e)));
  }, [client]);

  const onEvent = useCallback(
    (e: GameEvent) => {
      if (e.event_type === 'question_started') sound.play('question');
      if (e.event_type === 'game_started' || e.event_type === 'round_started') sound.play('start');
      if (e.event_type === 'game_finished') sound.play('victory');
    },
    [sound],
  );

  const { snapshot, loading, error, connection, refresh } = useRoomSnapshot(ready ? client : null, roomId, onEvent);
  const me = snapshot?.me ?? null;
  const online = usePresence(ready ? client : null, roomId, me && (me.status === 'approved' || me.status === 'pending') ? me.id : null, { role: 'student' });
  void online;
  const s = isFullSnapshot(snapshot) ? snapshot : null;
  useDocumentTitle(me ? `${me.nickname} • IT ARENA` : 'Oʻyin');

  const timer = useQuestionTimer(s?.room, s?.question);
  // zaxira: oʻqituvchi konsoli yopiq boʻlsa ham savol oʻz vaqtida yopiladi
  const jitter = useRef(2200 + Math.floor(Math.random() * 1800));
  useAutoFinalize(client, s?.room, s?.question, timer, { delayMs: jitter.current, enabled: Boolean(s && s.me?.status === 'approved') });

  if (authError) return <ErrorState title="Ulanib boʻlmadi" message={authError} action={<Link className="btn btn-primary" to="/join">Qayta urinish</Link>} />;
  if (!snapshot && (loading || !ready)) return <LoadingScreen text="Oʻyinga ulanmoqda…" />;
  if (!snapshot) {
    return (
      <ErrorState
        title="Oʻyinga ulanib boʻlmadi"
        message={error ?? 'Xona topilmadi yoki siz bu xonada roʻyxatdan oʻtmagansiz.'}
        action={
          <Link className="btn btn-primary" to="/join">
            Xonaga qoʻshilish
          </Link>
        }
      />
    );
  }

  if (!s || !me || me.status === 'rejected' || me.status === 'kicked') {
    return (
      <ErrorState
        title={me?.status === 'kicked' ? 'Siz oʻyindan chiqarildingiz' : 'Soʻrovingiz rad etildi'}
        message="Oʻqituvchiga murojaat qiling. Rad etilgan boʻlsangiz, boshqa ism bilan qayta qoʻshilishingiz mumkin."
        action={
          <Link className="btn btn-primary" to={`/join/${snapshot.room.room_code}`}>
            Qayta qoʻshilish
          </Link>
        }
      />
    );
  }

  const team = s.teams.find((t) => t.id === me.team_id) ?? null;
  const color = team ? TEAM_COLORS[team.color].hex : '#3EE7FF';

  return (
    <main className="relative min-h-screen">
      <SpaceBackground image="arena" dim={0.72} />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-space-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Logo size="sm" className="hidden sm:flex" />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold">{me.nickname}</div>
            <div className="text-xs font-semibold" style={{ color }}>
              {team?.name ?? 'Jamoa tayinlanmagan'}
            </div>
          </div>
          {me.status === 'approved' && s.room.status !== 'lobby' && (
            <div className="ml-auto flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5" title="Shaxsiy ball">
                <Trophy className="h-4 w-4 text-arena-warning" />
                <AnimatedNumber value={me.score} className="font-display text-lg font-bold" />
              </span>
              <span className="hidden items-center gap-1.5 sm:flex" title="Toʻgʻri javoblar">
                <Target className="h-4 w-4 text-arena-success" /> {me.correct_count}
              </span>
              <span className={clsx('flex items-center gap-1.5', me.streak >= 2 && 'text-arena-warning')} title="Seriya">
                <Flame className="h-4 w-4" /> {me.streak}
              </span>
            </div>
          )}
          <div className={clsx('flex items-center gap-2', (me.status !== 'approved' || s.room.status === 'lobby') && 'ml-auto')}>
            <SoundControls channel="student" showSlider={false} />
            <MotionToggle showLabel={false} />
            <ConnectionBadge state={connection} compact />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        {me.status === 'pending' ? (
          <WaitingApproval s={s} />
        ) : s.room.status === 'lobby' ? (
          <StudentLobby s={s} />
        ) : s.room.status === 'finished' ? (
          <StudentResults s={s} />
        ) : (
          <StudentGame s={s} timer={timer} onError={(m) => toast(m, 'error')} onRefresh={refresh} />
        )}
      </div>
    </main>
  );
}

function WaitingApproval({ s }: { s: RoomSnapshot }) {
  return (
    <div className="glass mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
      <Hourglass className="mx-auto h-12 w-12 animate-pulse-soft text-arena-warning" />
      <h1 className="mt-4 font-display text-2xl font-bold">Tasdiq kutilmoqda</h1>
      <p className="mt-2 text-arena-muted">Oʻqituvchi sizni jamoaga qoʻshishini kuting. Sahifani yopmang.</p>
      <p className="mt-6 text-sm text-arena-muted">
        Xona: <b className="font-logo tracking-widest text-arena-cyan">{s.room.room_code}</b>
      </p>
    </div>
  );
}

function StudentLobby({ s }: { s: RoomSnapshot }) {
  const team = s.teams.find((t) => t.id === s.me?.team_id);
  const mates = s.players.filter((p) => p.team_id === team?.id && p.status === 'approved');
  if (!team) return <WaitingApproval s={s} />;
  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
        <SpaceshipCard team={team} subtitle="sizning kemangiz" facing={team.slot === 1 ? 'right' : 'left'} />
      </motion.div>
      <div className="glass rounded-3xl p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Users className="h-5 w-5 text-arena-cyan" /> Jamoadoshlar ({mates.length}/{s.room.settings.team_size})
        </h2>
        <ul className="mt-3 space-y-1.5">
          {mates.map((p) => (
            <li key={p.id} className={clsx('rounded-lg px-3 py-2 font-semibold', p.id === s.me?.id ? 'bg-white/10' : 'bg-white/[0.03]')}>
              {p.nickname} {p.id === s.me?.id && <span className="text-xs text-arena-cyan">(siz)</span>}
            </li>
          ))}
        </ul>
        <div className="mt-6 animate-pulse-soft text-center font-display text-xl font-semibold text-arena-warning">Oʻyin tez orada boshlanadi…</div>
        <p className="mt-2 text-center text-sm text-arena-muted">Katta ekrandagi qoidalarni diqqat bilan tinglang.</p>
      </div>
    </div>
  );
}

function StudentGame({
  s,
  timer,
  onError,
  onRefresh,
}: {
  s: RoomSnapshot;
  timer: ReturnType<typeof useQuestionTimer>;
  onError: (m: string) => void;
  onRefresh: () => void;
}) {
  const client = getStudentClient();
  const q = s.question;
  const team = s.teams.find((t) => t.id === s.me?.team_id)!;
  const opp = s.teams.find((t) => t.id !== team?.id)!;
  const now = useServerNow(1000);
  const sound = soundEngine('student');
  const [selected, setSelected] = useState<string>('');
  const [matchSel, setMatchSel] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  /** yuborilgan qadam indeksi — snapshot yangilanguncha panel band turadi */
  const [awaitingStep, setAwaitingStep] = useState<number | null>(null);
  const qid = q?.id ?? null;
  const leftItems = q?.question_type === 'matching' ? stringOptions(q.options) : [];

  useEffect(() => {
    setSelected('');
    setMatchSel(leftItems.map(() => -1));
    setAwaitingStep(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qid]);

  // snapshot yangi qadamni koʻrsatganda kutish holati tugaydi
  const stepState = s.my_steps ?? null;
  useEffect(() => {
    if (awaitingStep === null) return;
    if (!stepState || stepState.finished || (stepState.current && stepState.current.index !== awaitingStep)) setAwaitingStep(null);
  }, [stepState, awaitingStep]);

  const mine = s.my_answer;
  const locked = Boolean(mine) || q?.status !== 'active' || s.room.status !== 'active' || timer.phase === 'discussion' || timer.phase === 'expired';
  const revealed = q?.status === 'revealed';
  const current = mine?.selected_answer ?? selected;

  // javob ochilganda ovozli fikr
  const prevRevealed = useRef<string | null>(null);
  useEffect(() => {
    if (revealed && qid && prevRevealed.current !== qid) {
      prevRevealed.current = qid;
      if (mine) sound.play(mine.is_correct ? 'correct' : 'wrong');
    }
  }, [revealed, qid, mine, sound]);

  const isMatching = q?.question_type === 'matching';
  const isMultiStep = q?.question_type === 'multi_step';
  const matchingReady = isMatching && matchSel.length > 0 && matchSel.every((v) => v >= 0);
  const answerText = isMatching ? (matchingReady ? JSON.stringify(matchSel) : '') : selected.trim();

  const submit = useCallback(async () => {
    if (!q || locked || !answerText || submitting) return;
    setSubmitting(true);
    try {
      const r = await submitAnswer(client, q.id, answerText);
      if (r.accepted || r.duplicate) sound.play('submit');
      onRefresh();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [client, q, locked, answerText, submitting, sound, onError, onRefresh]);

  const sendStep = useCallback(
    async (step: number, choice: number) => {
      if (!q || submitting) return;
      setSubmitting(true);
      try {
        const r = await submitStep(client, q.id, step, String(choice));
        if (r.accepted) {
          sound.play(r.correct ? 'submit' : 'wrong');
          setAwaitingStep(step);
        }
        onRefresh();
      } catch (e) {
        onError(errorMessage(e));
        onRefresh();
      } finally {
        setSubmitting(false);
      }
    },
    [client, q, submitting, sound, onError, onRefresh],
  );

  // klaviatura: 1–4 / A–D tanlash, Enter yuborish
  useEffect(() => {
    if (!q || !isChoiceType(q.question_type)) return;
    const onKey = (e: KeyboardEvent) => {
      if (locked) return;
      const k = e.key.toUpperCase();
      const n = q.options?.length ?? 0;
      let idx = -1;
      if (/^[1-6]$/.test(k)) idx = Number(k) - 1;
      else if (OPTION_LETTERS.includes(k)) idx = OPTION_LETTERS.indexOf(k);
      if (idx >= 0 && idx < n) setSelected(String(idx));
      if (e.key === 'Enter') void submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, locked, submit]);

  const hint = s.hints.find((h) => h.team_id === team?.id)?.hint;
  const requested = useMemo(() => new Set(s.ability_requests.map((r) => r.ability_type)), [s.ability_requests]);
  const progress = (s.plan as RoundProgress[]).find((p) => p.round_number === s.room.current_round);

  if (s.room.status === 'paused' && (!q || q.status !== 'active')) {
    return (
      <div className="glass mx-auto mt-10 max-w-md rounded-3xl p-8 text-center">
        <PauseCircle className="mx-auto h-14 w-14 text-arena-warning" />
        <h2 className="mt-3 font-display text-2xl font-bold text-arena-warning">Pauza</h2>
        <p className="mt-2 text-arena-muted">Oʻqituvchi oʻyinni vaqtincha toʻxtatdi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="chip border-white/10 bg-space-950/60 text-arena-text">
          {Math.max(1, s.room.current_round)}-raund • {roundMeta(Math.max(1, s.room.current_round), s.room.settings).title}
        </span>
        {progress && (
          <span className="chip border-white/10 bg-space-950/60 text-arena-muted">
            Savollar: {progress.done}/{progress.total}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {q && (q.status === 'active' || q.status === 'revealed') ? (
          <motion.section key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-5">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-arena-muted">{q.points} ball</div>
                <h1 className="font-display text-xl font-bold leading-snug sm:text-2xl">{q.question_text}</h1>
              </div>
              <CountdownTimer timer={timer} size={92} />
            </div>

            {timer.phase === 'discussion' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-arena-purple/40 bg-arena-purple/10 px-4 py-3 text-arena-purple">
                <Users className="h-5 w-5" /> Jamoangiz bilan muhokama qiling. Javob berish muhokama tugagach ochiladi.
              </div>
            )}
            {hint && q.status === 'active' && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-arena-success/40 bg-arena-success/10 px-4 py-3 text-sm">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-arena-success" />
                <span>
                  <b className="text-arena-success">HINT SCAN: </b>
                  {hint}
                </span>
              </div>
            )}

            <div className={clsx('mt-4 grid gap-4', q.image_url && 'md:grid-cols-[40%_1fr]')}>
              {q.image_url && <QuestionImage src={q.image_url} className="h-56 md:h-full" />}
              <div>
                {isChoiceType(q.question_type) ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {stringOptions(q.options).map((o, i) => (
                      <AnswerOption
                        key={i}
                        index={i}
                        text={o}
                        size="lg"
                        disabled={locked}
                        onClick={() => setSelected(String(i))}
                        state={optionState(i, { selected: current || null, revealed, correct: typeof q.correct_answer === 'number' ? q.correct_answer : null })}
                      />
                    ))}
                  </div>
                ) : isMatching ? (
                  <MatchingInput
                    left={leftItems}
                    choices={q.input_spec?.choices ?? []}
                    value={mine ? (parseMatchingAnswer(mine.selected_answer) ?? []) : matchSel}
                    onChange={locked ? undefined : setMatchSel}
                    disabled={locked}
                    reveal={revealed && Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : null}
                  />
                ) : isMultiStep ? (
                  revealed ? (
                    <StepsReveal
                      steps={q.steps ?? []}
                      correct={Array.isArray(q.correct_answer) ? q.correct_answer.map(Number) : []}
                      mine={stepState?.done ?? []}
                    />
                  ) : stepState ? (
                    <MultiStepPanel
                      state={stepState}
                      disabled={s.room.status !== 'active' || timer.phase === 'discussion' || timer.phase === 'expired'}
                      busy={submitting || awaitingStep !== null}
                      onSubmit={(step, choice) => void sendStep(step, choice)}
                    />
                  ) : (
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  )
                ) : (
                  <ShortAnswerInput spec={q.input_spec} value={mine?.selected_answer ?? selected} onChange={setSelected} onSubmit={() => void submit()} disabled={locked} />
                )}
              </div>
            </div>

            {!revealed &&
              !isMultiStep &&
              (mine ? (
                <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-arena-cyan/40 bg-arena-cyan/10 px-4 py-3 font-semibold text-arena-cyan" role="status">
                  <CheckCircle2 className="h-5 w-5" /> Javobingiz qabul qilindi! Natijani kuting…
                </div>
              ) : timer.phase === 'expired' ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-space-950/50 px-4 py-3 text-center text-arena-muted">Vaqt tugadi</div>
              ) : (
                <button className="btn btn-primary btn-lg mt-5 w-full" disabled={locked || !answerText || submitting} onClick={() => void submit()}>
                  {submitting ? <Spinner /> : <Send className="h-5 w-5" />} JAVOBNI YUBORISH
                </button>
              ))}

            {revealed && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-5 space-y-3">
                {mine ? (
                  mine.is_correct ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-arena-success/50 bg-arena-success/15 p-4">
                      <CheckCircle2 className="h-9 w-9 text-arena-success" />
                      <div>
                        <div className="font-display text-xl font-bold text-arena-success">Toʻgʻri!</div>
                        <div className="text-sm">
                          +{mine.awarded_points ?? 0} ball • kemangiz energiya oldi
                          {isMultiStep && ' • toʻliq zanjir bonusi bilan'}
                        </div>
                      </div>
                    </div>
                  ) : (mine.awarded_points ?? 0) > 0 ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-arena-warning/50 bg-arena-warning/10 p-4">
                      <Target className="h-9 w-9 text-arena-warning" />
                      <div>
                        <div className="font-display text-xl font-bold text-arena-warning">Qisman toʻgʻri ({Math.round((mine.credit ?? 0) * 100)}%)</div>
                        <div className="text-sm">+{mine.awarded_points} ball</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-arena-red/50 bg-arena-red/10 p-4">
                      <XCircle className="h-9 w-9 text-arena-red" />
                      <div>
                        <div className="font-display text-xl font-bold text-arena-red">Notoʻgʻri</div>
                        {!isMatching && !isMultiStep && (
                          <div className="text-sm">Toʻgʻri javob: {formatCorrectAnswer(q.question_type, q.options, q.correct_answer)}</div>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-space-950/50 p-4 text-arena-muted">
                    Siz javob bermadingiz.
                    {!isMatching && !isMultiStep && (
                      <>
                        {' '}
                        Toʻgʻri javob: <b className="text-arena-text">{formatCorrectAnswer(q.question_type, q.options, q.correct_answer)}</b>
                      </>
                    )}
                  </div>
                )}
                {q.explanation && (
                  <p className="rounded-2xl border border-white/5 bg-space-950/50 p-4 text-sm leading-relaxed">
                    <b className="text-arena-cyan">Izoh: </b>
                    {q.explanation}
                  </p>
                )}
              </motion.div>
            )}
          </motion.section>
        ) : (
          <motion.section key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-6 text-center">
            <SpaceshipCard team={team} subtitle="keyingi savolga tayyorlanmoqda" facing={team.slot === 1 ? 'right' : 'left'} className="mx-auto max-w-md" />
            <p className="mt-4 animate-pulse-soft font-display text-lg text-arena-warning">Keyingi savolni kuting…</p>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="grid gap-4 md:grid-cols-2">
        {[team, opp].map((t) => (
          <div key={t.id} className="glass rounded-2xl p-4" style={{ borderColor: `${TEAM_COLORS[t.color].hex}44` }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display font-bold" style={{ color: TEAM_COLORS[t.color].hex }}>
                {t.name} {t.id === team.id && <span className="text-xs text-arena-muted">(sizning jamoa)</span>}
              </span>
              <AnimatedNumber value={t.score} className="font-display text-2xl font-black" />
            </div>
            <div className="space-y-2">
              <ShieldBar value={t.shield} max={t.max_shield} color={TEAM_COLORS[t.color].hex} size="sm" />
              <EnergyBar value={t.energy} max={s.room.settings.max_energy} size="sm" />
            </div>
          </div>
        ))}
      </section>

      {s.room.settings.ability_voting && (
        <section className="glass rounded-2xl p-4">
          <h2 className="mb-1 font-display font-bold">Jamoa qobiliyatlari</h2>
          <p className="mb-3 text-xs text-arena-muted">Qobiliyat soʻrang — oʻqituvchi tasdiqlasa, jamoa energiyasi sarflanadi.</p>
          <AbilityPanel
            team={team}
            abilities={s.abilities}
            settings={s.room.settings}
            questionActive={q?.status === 'active'}
            serverNow={now}
            actionLabel="Soʻrash"
            busy={requesting}
            requested={requested}
            onUse={async (a: AbilityType) => {
              setRequesting(true);
              try {
                const r = await requestAbility(client, s.room.id, a);
                if (!r.created && r.message) onError(r.message);
                else sound.play('bonus');
              } catch (e) {
                onError(errorMessage(e));
              } finally {
                setRequesting(false);
              }
            }}
          />
          {s.ability_requests.length > 0 && (
            <p className="mt-2 text-xs text-arena-purple">Kutilayotgan soʻrovlar: {s.ability_requests.map((r) => ABILITIES[r.ability_type].title).join(', ')}</p>
          )}
        </section>
      )}
    </div>
  );
}

function StudentResults({ s }: { s: RoomSnapshot }) {
  const r = s.results;
  const me = s.me!;
  const team = s.teams.find((t) => t.id === me.team_id);
  if (!r) return <LoadingScreen text="Natijalar hisoblanmoqda…" />;
  const stat = r.statistics.players.find((p) => p.player_id === me.id);
  const rank = r.statistics.players.findIndex((p) => p.player_id === me.id) + 1;
  const won = r.winner_team_id === team?.id;
  const myAwards = AWARD_ORDER.filter((k) => r.awards[k]?.player_id === me.id);
  return (
    <div className="space-y-5">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-3xl p-6 text-center">
        <img src="/assets/brand/trophy.webp" alt="" className={clsx('mx-auto h-28', !won && !r.is_tie && 'opacity-50 grayscale')} />
        <h1 className="mt-3 font-logo text-3xl font-black tracking-wider">{r.is_tie ? 'DURANG!' : won ? 'GʻALABA!' : 'YAXSHI JANG!'}</h1>
        <p className="mt-1 text-arena-muted">{r.is_tie ? 'Ikkala jamoa teng kuchli chiqdi.' : won ? `${team?.name} jamoasi galaktika chempioni!` : 'Keyingi safar albatta gʻalaba qozonasiz!'}</p>
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-space-950/60 p-3">
            <div className="font-display text-2xl font-black">{me.score}</div>
            <div className="text-xs text-arena-muted">Ball</div>
          </div>
          <div className="rounded-xl bg-space-950/60 p-3">
            <div className="font-display text-2xl font-black">{rank || '—'}</div>
            <div className="text-xs text-arena-muted">Oʻrin</div>
          </div>
          <div className="rounded-xl bg-space-950/60 p-3">
            <div className="font-display text-2xl font-black">
              {me.correct_count}/{stat?.possible ?? me.answered_count}
            </div>
            <div className="text-xs text-arena-muted">Toʻgʻri</div>
          </div>
          <div className="rounded-xl bg-space-950/60 p-3">
            <div className="font-display text-2xl font-black">{stat ? stat.accuracy : accuracy(me.correct_count, me.answered_count)}%</div>
            <div className="text-xs text-arena-muted">Aniqlik</div>
          </div>
        </div>
        {myAwards.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {myAwards.map((k) => (
              <span key={k} className="chip border-arena-warning bg-arena-warning/15 px-3 py-1.5 text-sm text-arena-warning">
                <Award className="h-4 w-4" /> {AWARDS[k].title}
              </span>
            ))}
          </div>
        )}
      </motion.div>
      <div className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Reyting</h2>
        <Leaderboard results={r} teams={s.teams} highlightId={me.id} />
      </div>
      <div className="text-center">
        <Link to="/" className="btn btn-ghost">
          Bosh sahifa
        </Link>
      </div>
    </div>
  );
}
