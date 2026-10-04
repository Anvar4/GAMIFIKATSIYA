import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeft, CheckCheck, Lock, Maximize, Minimize, PauseCircle, Users } from 'lucide-react';
import { ConnectionBadge, ErrorState, LoadingScreen, Logo, SpaceBackground } from '../../components/ui/Basics';
import { SoundControls } from '../../components/ui/SoundControls';
import { TeamScoreboard, SpaceshipCard } from '../../components/game/TeamScoreboard';
import { BattleZone, type BattleFx } from '../../components/game/BattleZone';
import { RoundBanner } from '../../components/game/RoundBanner';
import { CountdownTimer } from '../../components/game/CountdownTimer';
import { AnswerOption, MatchingBoard, QuestionImage, StepsReveal, formatCorrectAnswer, isChoiceType, optionState } from '../../components/game/QuestionCard';
import { stringOptions } from '../../game/questionShape';
import { RoomCodeDisplay } from '../../components/game/RoomCodeDisplay';
import { GameEventFeed } from '../../components/game/GameEventFeed';
import { VictoryScreen } from '../../components/game/VictoryScreen';
import { StudentRoster } from '../../components/game/StudentRoster';
import { useRoomSnapshot } from '../../hooks/useRoomSnapshot';
import { usePresence } from '../../hooks/usePresence';
import { useAutoFinalize, useQuestionTimer } from '../../hooks/useTimer';
import { useDocumentTitle, useFullscreen, useReducedMotion, useStageScale } from '../../hooks/useUi';
import { getInstructorClient } from '../../lib/supabase';
import { syncClock } from '../../lib/clock';
import { soundEngine } from '../../lib/sound';
import { isFullSnapshot } from '../../services/api';
import { ABILITIES, SPECIAL_EVENTS, TEAM_COLORS, roundMeta } from '../../game/constants';
import { isPlanList, lobbyReadiness, phaseLabel } from '../../game/state';
import type { AbilityType, GameEvent, RoomSnapshot, SpecialEventKind, Team } from '../../game/types';

export default function Arena() {
  const { roomId } = useParams();
  const client = getInstructorClient();
  useStageScale();
  const [reduced] = useReducedMotion();
  const { active: fs, toggle: toggleFs } = useFullscreen();
  const sound = soundEngine('arena');

  // ---------- jang effektlari navbati ----------
  const [fx, setFx] = useState<BattleFx[]>([]);
  const [hits, setHits] = useState<Record<1 | 2, string | null>>({ 1: null, 2: null });
  const teamsRef = useRef<Team[]>([]);
  const nextAt = useRef(0);
  const timers = useRef<Set<number>>(new Set());

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const pushFx = useCallback(
    (f: BattleFx, baseDelay = 0, duration = 2600) => {
      const now = Date.now();
      const delay = Math.max(baseDelay, nextAt.current - now);
      nextAt.current = now + delay + (f.kind === 'attack' ? 1100 : 500);
      later(delay, () => {
        setFx((list) => [...list, f]);
        if (f.kind === 'attack') {
          sound.play('laser');
          later(reduced ? 0 : 520, () => {
            if (f.toSlot) setHits((h) => ({ ...h, [f.toSlot!]: f.id }));
            sound.play(f.blocked ? 'shield' : 'hit');
          });
        }
        if (f.kind === 'shield_down') sound.play('hit');
        later(duration, () => setFx((list) => list.filter((x) => x.id !== f.id)));
      });
    },
    [later, reduced, sound],
  );

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const onEvent = useCallback(
    (e: GameEvent) => {
      const slotOf = (id: unknown) => teamsRef.current.find((t) => t.id === id)?.slot as 1 | 2 | undefined;
      const d = e.event_data ?? {};
      switch (e.event_type) {
        case 'attack':
          pushFx(
            {
              id: e.id,
              kind: 'attack',
              fromSlot: slotOf(d.from),
              toSlot: slotOf(d.to),
              damage: Number(d.damage ?? 0),
              blocked: Number(d.blocked ?? 0),
              critical: Boolean(d.critical),
              heavy: Boolean(d.heavy),
              correct: Number(d.correct ?? 1),
            },
            1600,
          );
          break;
        case 'shield_down':
          pushFx({ id: e.id, kind: 'shield_down', toSlot: slotOf(d.team_id) }, 2000, 3000);
          break;
        case 'ability_used': {
          const ab = ABILITIES[d.ability as AbilityType];
          sound.play(d.ability === 'shield_boost' ? 'shield' : 'bonus');
          pushFx({ id: e.id, kind: 'ability', toSlot: slotOf(e.team_id), label: ab?.title ?? 'ABILITY', color: ab?.color }, 0, 2600);
          break;
        }
        case 'special_event': {
          const meta = SPECIAL_EVENTS[d.kind as SpecialEventKind];
          sound.play('bonus');
          pushFx({ id: e.id, kind: 'special', label: meta?.title.toUpperCase() ?? 'MAXSUS HODISA', color: '#FFC857' }, 0, 3000);
          break;
        }
        case 'question_started':
          sound.play('question');
          break;
        case 'question_revealed':
          sound.play('correct');
          break;
        case 'round_started':
        case 'game_started':
          sound.play('start');
          break;
        case 'game_finished':
          sound.play('victory');
          break;
      }
    },
    [pushFx, sound],
  );

  const { snapshot, loading, error, connection } = useRoomSnapshot(client, roomId, onEvent);
  const online = usePresence(client, roomId, 'arena', { role: 'arena' });
  const s = isFullSnapshot(snapshot) ? snapshot : null;
  useEffect(() => {
    if (s) teamsRef.current = s.teams;
  }, [s]);
  useEffect(() => {
    void syncClock(client);
  }, [client]);
  useDocumentTitle(s ? `Arena • ${s.room.room_code}` : 'Arena');

  const timer = useQuestionTimer(s?.room, s?.question);
  useAutoFinalize(client, s?.room, s?.question, timer, { delayMs: 1600 });

  // oxirgi 5 soniyada tiqillash
  const sec = Math.ceil(timer.remainingMs / 1000);
  useEffect(() => {
    if (timer.phase === 'answering' && sec <= 5 && sec > 0) sound.play('tick');
  }, [sec, timer.phase, sound]);

  // boshqaruv tugmalari faqat sichqoncha qimirlaganda koʻrinadi (toza displey rejimi)
  const [chrome, setChrome] = useState(true);
  useEffect(() => {
    let t = window.setTimeout(() => setChrome(false), 3500);
    const show = () => {
      setChrome(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setChrome(false), 3500);
    };
    window.addEventListener('mousemove', show);
    window.addEventListener('keydown', show);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousemove', show);
      window.removeEventListener('keydown', show);
    };
  }, []);

  if (!s && loading) return <LoadingScreen text="Arena yuklanmoqda…" />;
  if (!s) return <ErrorState title="Arenani ochib boʻlmadi" message={error ?? 'Xona topilmadi.'} />;

  const teams = [...s.teams].sort((a, b) => a.slot - b.slot);
  const [left, right] = teams;
  const answered = new Set(s.answered_player_ids);
  const q = s.question;
  const revealed = q?.status === 'revealed';
  const correctness = revealed ? new Map(s.answers.map((a) => [a.player_id, Boolean(a.is_correct)])) : undefined;
  const playersOf = (t: Team) => s.players.filter((p) => p.team_id === t.id && p.status === 'approved');
  const lobby = s.room.status === 'lobby';
  const finished = s.room.status === 'finished' && s.results;
  const leading = left.score === right.score ? null : left.score > right.score ? left.id : right.id;

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden" style={{ cursor: chrome ? 'default' : 'none' }}>
      <SpaceBackground image="arena" dim={0.3} />

      {/* ---------- YUQORI PANEL ---------- */}
      <header className="relative z-10 flex items-center gap-6 px-6 pt-4">
        <Logo size="md" />
        <div className="hud-line flex-1" />
        {!lobby && s.room.current_round > 0 && (
          <div className="text-center">
            <div className="font-display text-xs font-bold uppercase tracking-[0.4em]" style={{ color: roundMeta(s.room.current_round).accent }}>
              {s.room.current_round}-raund
            </div>
            <div className="font-logo text-xl font-black tracking-wider">{roundMeta(s.room.current_round, s.room.settings).title}</div>
          </div>
        )}
        <QuestionCounter s={s} />
        <span className="chip border-white/15 bg-space-950/60 px-3 py-1 text-sm text-arena-text">{phaseLabel(s)}</span>
        <ConnectionBadge state={connection} compact />
        <div className="hud-line w-24" />
      </header>

      {/* ---------- ASOSIY QISM ---------- */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[23%_1fr_23%] gap-4 px-6 py-4">
        {finished ? (
          <div className="col-span-3 min-h-0">
            <VictoryScreen results={s.results!} teams={teams} players={s.players} />
          </div>
        ) : lobby ? (
          <LobbyStage s={s} left={left} right={right} online={online} />
        ) : (
          <>
            <TeamScoreboard
              team={left}
              players={playersOf(left)}
              answered={answered}
              online={online}
              correctness={correctness}
              maxEnergy={s.room.settings.max_energy}
              side="left"
              leading={leading === left.id}
            />
            <section className="relative min-h-0">
              <BattleZone left={left} right={right} fx={fx} hits={hits} compact={Boolean(q) || s.room.phase === 'round_intro'} reducedMotion={reduced}>
                <AnimatePresence mode="wait">
                  {s.room.phase === 'round_intro' || (!q && s.room.phase !== 'round_end') ? (
                    <motion.div key={`intro-${s.room.current_round}`} className="h-full py-2" exit={{ opacity: 0 }}>
                      <RoundBanner round={Math.max(1, s.room.current_round)} settings={s.room.settings} />
                    </motion.div>
                  ) : s.room.phase === 'round_end' ? (
                    <motion.div key="round-end" className="flex h-full items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <RoundSummary s={s} />
                    </motion.div>
                  ) : q ? (
                    <motion.div key={q.id} className="h-full" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.45 }}>
                      <ArenaQuestion s={s} timer={timer} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </BattleZone>
              <AnimatePresence>
                {s.room.status === 'paused' && (
                  <motion.div
                    className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-space-950/60 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="text-center">
                      <PauseCircle className="mx-auto h-24 w-24 text-arena-warning" />
                      <div className="mt-4 font-logo text-5xl font-black tracking-[0.3em] text-arena-warning">PAUZA</div>
                      <div className="mt-2 text-xl text-arena-muted">Oʻqituvchi oʻyinni vaqtincha toʻxtatdi</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
            <TeamScoreboard
              team={right}
              players={playersOf(right)}
              answered={answered}
              online={online}
              correctness={correctness}
              maxEnergy={s.room.settings.max_energy}
              side="right"
              leading={leading === right.id}
            />
          </>
        )}
      </div>

      {/* ---------- PASTKI PANEL ---------- */}
      {!lobby && !finished && (
        <footer className="relative z-10 grid grid-cols-[23%_1fr] items-center gap-4 px-6 pb-4">
          <LiveLeaderboard s={s} />
          <div className="glass flex h-14 items-center overflow-hidden rounded-2xl px-3">
            <GameEventFeed events={s.events} teams={s.teams} players={s.players} limit={5} direction="row" />
          </div>
        </footer>
      )}

      {/* ---------- yashirin boshqaruv ---------- */}
      <div className={clsx('fixed bottom-4 right-4 z-30 flex items-center gap-2 transition-opacity', chrome ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <SoundControls channel="arena" />
        <button className="btn btn-ghost btn-sm" onClick={() => void toggleFs()} title="Toʻliq ekran">
          {fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <Link to={`/teacher/room/${s.room.id}`} className="btn btn-ghost btn-sm" title="Konsolga qaytish">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}

function QuestionCounter({ s }: { s: RoomSnapshot }) {
  if (!s.question || !isPlanList(s.plan)) return null;
  const inRound = s.plan.filter((p) => p.round_number === s.question!.round_number);
  const pos = inRound.findIndex((p) => p.id === s.question!.id) + 1;
  return (
    <div className="text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-arena-muted">Savol</div>
      <div className="font-display text-2xl font-extrabold">
        {pos}
        <span className="text-arena-muted">/{inRound.length}</span>
      </div>
    </div>
  );
}

function ArenaQuestion({ s, timer }: { s: RoomSnapshot; timer: ReturnType<typeof useQuestionTimer> }) {
  const q = s.question!;
  const revealed = q.status === 'revealed';
  const correct = revealed && typeof q.correct_answer === 'number' ? q.correct_answer : null;
  const approved = s.players.filter((p) => p.status === 'approved' && p.team_id).length;
  const teams = [...s.teams].sort((a, b) => a.slot - b.slot);
  const options = stringOptions(q.options);
  return (
    <div className="glass flex h-full flex-col gap-4 rounded-3xl p-5">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="chip border-arena-cyan/40 bg-arena-cyan/10 px-3 py-1 text-sm text-arena-cyan">{q.points} ball</span>
            {q.points_multiplier > 1 && <span className="chip border-arena-warning/50 px-3 py-1 text-sm text-arena-warning">×{q.points_multiplier}</span>}
            {timer.phase === 'discussion' && (
              <span className="chip animate-pulse-soft border-arena-purple/60 bg-arena-purple/15 px-3 py-1 text-sm text-arena-purple">
                <Users className="h-4 w-4" /> JAMOAVIY MUHOKAMA
              </span>
            )}
          </div>
          <h2 className="font-display text-[2.05rem] font-bold leading-tight text-arena-text">{q.question_text}</h2>
        </div>
        <div className="flex flex-col items-center gap-2">
          <CountdownTimer timer={timer} size={136} />
          <div className="flex items-center gap-1.5 text-sm font-semibold text-arena-muted">
            <CheckCheck className="h-4 w-4 text-arena-success" />
            {q.answer_count}/{approved} javob
          </div>
        </div>
      </div>

      <div className={clsx('grid min-h-0 flex-1 gap-4', q.image_url && 'grid-cols-[38%_1fr]')}>
        {q.image_url && <QuestionImage src={q.image_url} className="h-full min-h-[12rem]" />}
        <div className="flex min-h-0 flex-col gap-3">
          {isChoiceType(q.question_type) ? (
            <div className={clsx('grid gap-3', options.length > 2 ? 'grid-cols-2' : 'grid-cols-2')}>
              {options.map((o, i) => (
                <AnswerOption key={i} index={i} text={o} size="xl" state={optionState(i, { revealed, correct })} />
              ))}
            </div>
          ) : q.question_type === 'matching' ? (
            <MatchingBoard
              left={options}
              choices={q.input_spec?.choices ?? []}
              reveal={revealed && Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : null}
            />
          ) : q.question_type === 'multi_step' ? (
            revealed ? (
              <div className="min-h-0 overflow-y-auto pr-1 scrollbar-thin">
                <StepsReveal steps={q.steps ?? []} correct={Array.isArray(q.correct_answer) ? q.correct_answer.map(Number) : []} large />
              </div>
            ) : (
              <ChainProgress total={q.input_spec?.steps ?? 0} finished={q.answer_count} players={approved} />
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-space-950/50 p-6 text-center">
              <Lock className={clsx('h-14 w-14', revealed ? 'text-arena-success' : 'text-arena-cyan')} />
              {revealed ? (
                <div className="font-logo text-[2.4rem] font-black text-arena-success">{formatCorrectAnswer(q.question_type, null, q.correct_answer)}</div>
              ) : (
                <div className="text-xl text-arena-muted">
                  {q.input_spec?.kind === 'code' ? `${q.input_spec.length ?? ''} xonali kodni kompyuteringizda kiriting` : 'Javobni kompyuteringizda yozing'}
                </div>
              )}
            </div>
          )}
          {revealed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[1fr_auto] gap-3">
              <div className="rounded-2xl border border-arena-success/30 bg-arena-success/10 p-3 text-lg leading-snug">
                <b className="text-arena-success">Izoh: </b>
                {q.explanation || formatCorrectAnswer(q.question_type, q.options, q.correct_answer, q.steps)}
              </div>
              <div className="flex gap-2">
                {teams.map((t) => {
                  const r = q.results?.teams?.[t.id];
                  return (
                    <div key={t.id} className="rounded-2xl border bg-space-950/60 px-4 py-2 text-center" style={{ borderColor: `${TEAM_COLORS[t.color].hex}66` }}>
                      <div className="font-display text-2xl font-black" style={{ color: TEAM_COLORS[t.color].hex }}>
                        +{r?.points ?? 0}
                      </div>
                      <div className="text-xs text-arena-muted">
                        {r?.correct ?? 0}/{r?.members ?? 0} toʻgʻri
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Koʻp bosqichli zanjir: katta ekranda qadamlar sirli qoladi, faqat progress koʻrinadi */
function ChainProgress({ total, finished, players }: { total: number; finished: number; players: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-space-950/50 p-6 text-center">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-arena-cyan/50 bg-arena-cyan/10 font-logo text-2xl font-black text-arena-cyan">
              {i + 1}
            </span>
            {i < total - 1 && <span className="h-1 w-10 rounded-full bg-gradient-to-r from-arena-cyan/60 to-arena-purple/60" />}
          </span>
        ))}
        <Lock className="ml-2 h-10 w-10 text-arena-warning" />
      </div>
      <div className="text-2xl font-semibold">{total} qadamli zanjir — har bir qadam keyingisini ochadi</div>
      <div className="text-lg text-arena-muted">
        Zanjirni yakunlaganlar: <b className="text-arena-text">{finished}</b>/{players}
      </div>
    </div>
  );
}

function RoundSummary({ s }: { s: RoomSnapshot }) {
  const ev = [...s.events].reverse().find((e) => e.event_type === 'round_ended');
  const pts = (ev?.event_data?.team_points ?? {}) as Record<string, number>;
  const teams = [...s.teams].sort((a, b) => a.slot - b.slot);
  return (
    <div className="glass w-full max-w-3xl rounded-3xl p-8 text-center">
      <div className="font-display text-sm font-bold uppercase tracking-[0.5em] text-arena-cyan">{s.room.current_round}-raund yakunlandi</div>
      <div className="mt-6 grid grid-cols-2 gap-6">
        {teams.map((t) => (
          <div key={t.id}>
            <div className="font-display text-2xl font-bold" style={{ color: TEAM_COLORS[t.color].hex }}>
              {t.name}
            </div>
            <div className="font-logo text-5xl font-black">+{pts[t.id] ?? 0}</div>
            <div className="text-arena-muted">raund ballari</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLeaderboard({ s }: { s: RoomSnapshot }) {
  const top = s.players
    .filter((p) => p.status === 'approved')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return (
    <div className="glass flex h-14 items-center gap-3 overflow-hidden rounded-2xl px-3">
      <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-arena-warning">TOP</span>
      {top.map((p, i) => {
        const t = s.teams.find((x) => x.id === p.team_id);
        return (
          <span key={p.id} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="font-display font-bold text-arena-muted">{i + 1}.</span>
            <span className="truncate font-semibold" style={{ color: t ? TEAM_COLORS[t.color].hex : undefined }}>
              {p.nickname}
            </span>
            <span className="font-display font-bold tabular-nums">{p.score}</span>
          </span>
        );
      })}
    </div>
  );
}

function LobbyStage({ s, left, right, online }: { s: RoomSnapshot; left: Team; right: Team; online: Set<string> }) {
  const ready = lobbyReadiness(s);
  const roster = (t: Team) => s.players.filter((p) => p.team_id === t.id && p.status === 'approved');
  return (
    <>
      <div className="flex min-h-0 flex-col gap-4">
        <motion.div initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}>
          <SpaceshipCard team={left} subtitle="tayyorlanmoqda" facing="right" />
        </motion.div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <StudentRoster team={left} players={roster(left)} online={online} teamSize={ready.teamSize} />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-8 text-center">
        <div>
          <div className="font-display text-lg font-semibold uppercase tracking-[0.4em] text-arena-muted">Oʻyinga qoʻshiling</div>
          <div className="mt-1 font-display text-2xl text-arena-text">{window.location.host}/join</div>
        </div>
        <RoomCodeDisplay code={s.room.room_code} size="lg" />
        <div className="w-full max-w-xl">
          <div className="flex items-end justify-between">
            <span className="text-lg text-arena-muted">Roʻyxatdan oʻtganlar</span>
            <span className="font-display text-4xl font-black">
              {ready.approved}
              <span className="text-2xl text-arena-muted">/{ready.maxPlayers}</span>
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-space-950/80 ring-1 ring-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-arena-blue via-arena-cyan to-arena-red" animate={{ width: `${(ready.approved / ready.maxPlayers) * 100}%` }} />
          </div>
          <div className="mt-5">
            {ready.ready ? (
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="font-logo text-4xl font-black tracking-[0.2em] text-arena-success">
                BARCHA TAYYOR!
              </motion.div>
            ) : (
              <div className="animate-pulse-soft font-display text-2xl font-semibold text-arena-warning">Oʻyin tez orada boshlanadi…</div>
            )}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-4">
        <motion.div initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }}>
          <SpaceshipCard team={right} subtitle="tayyorlanmoqda" facing="left" />
        </motion.div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <StudentRoster team={right} players={roster(right)} online={online} teamSize={ready.teamSize} />
        </div>
      </div>
    </>
  );
}
