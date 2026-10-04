import { useState } from 'react';
import clsx from 'clsx';
import { Eye, FastForward, Flag, Pause, Play, RotateCcw, SkipForward, Square, TimerReset } from 'lucide-react';
import type { InstructorActions } from '../../game/state';
import { roundMeta } from '../../game/constants';
import type { RoomSettings } from '../../game/types';
import { Spinner } from '../ui/Basics';

interface Props {
  actions: InstructorActions;
  currentRound: number;
  settings: RoomSettings;
  busy: string | null;
  onStartQuestion: (discussionSeconds: number | null) => void;
  onReveal: () => void;
  onSkip: () => void;
  onRestart: () => void;
  onPause: () => void;
  onResume: () => void;
  onAdjustTimer: (seconds: number) => void;
  onNextRound: () => void;
  onEndRound: () => void;
  onEndGame: () => void;
}

/** Jonli oʻyin boshqaruv tugmalari (klaviatura: N — keyingi savol, R — javobni ochish, P — pauza) */
export function InstructorControls(p: Props) {
  const { actions: a, busy } = p;
  const cfg = p.settings.rounds?.[String(p.currentRound)] ?? {};
  const [discussion, setDiscussion] = useState<string>('');
  const disc = discussion === '' ? (cfg.discussion_seconds ?? 0) : Number(discussion);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className="btn btn-primary btn-lg"
          disabled={!a.canStartQuestion || busy !== null}
          onClick={() => p.onStartQuestion(discussion === '' ? null : disc)}
          title="N"
        >
          <BusyIcon busy={busy} id="startQ">
            <Play className="h-5 w-5" />
          </BusyIcon>
          {a.nextQuestion ? `${a.nextQuestion.sequence_number}-savolni boshlash` : 'Savolni boshlash'}
        </button>
        <button className="btn btn-success btn-lg" disabled={!a.canReveal || busy !== null} onClick={p.onReveal} title="R">
          <BusyIcon busy={busy} id="reveal">
            <Eye className="h-5 w-5" />
          </BusyIcon>
          Javobni ochish
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-space-950/40 p-2 text-sm">
        <span className="text-arena-muted">Jamoaviy muhokama:</span>
        <input
          type="number"
          min={0}
          max={300}
          className="input w-20 px-2 py-1"
          placeholder={String(cfg.discussion_seconds ?? 0)}
          value={discussion}
          onChange={(e) => setDiscussion(e.target.value)}
          aria-label="Muhokama soniyalari"
        />
        <span className="text-arena-muted">soniya (keyingi savol uchun)</span>
        <span className="ml-auto text-xs text-arena-muted">Raundda qolgan: {a.remainingInRound}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {a.canResume ? (
          <button className="btn btn-warning" disabled={busy !== null} onClick={p.onResume} title="P">
            <BusyIcon busy={busy} id="resume">
              <Play className="h-4 w-4" />
            </BusyIcon>
            Davom ettirish
          </button>
        ) : (
          <button className="btn btn-ghost" disabled={!a.canPause || busy !== null} onClick={p.onPause} title="P">
            <BusyIcon busy={busy} id="pause">
              <Pause className="h-4 w-4" />
            </BusyIcon>
            Pauza
          </button>
        )}
        <button className="btn btn-ghost" disabled={!a.canSkip || busy !== null} onClick={p.onSkip}>
          <SkipForward className="h-4 w-4" /> Oʻtkazish
        </button>
        <button className="btn btn-ghost" disabled={!a.canRestart || busy !== null} onClick={p.onRestart}>
          <RotateCcw className="h-4 w-4" /> Qayta boshlash
        </button>
        <div className="flex gap-1">
          {[-10, 10, 30].map((sec) => (
            <button
              key={sec}
              className={clsx('btn btn-ghost flex-1 px-2', sec < 0 && 'text-arena-warning')}
              disabled={!a.canAdjustTimer || busy !== null}
              onClick={() => p.onAdjustTimer(sec)}
              title="Vaqtni oʻzgartirish"
            >
              {sec === 10 && <TimerReset className="h-3.5 w-3.5" />}
              {sec > 0 ? `+${sec}` : sec}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button className="btn btn-ghost" disabled={!a.canEndRound || busy !== null} onClick={p.onEndRound}>
          <Flag className="h-4 w-4" /> Raundni yakunlash
        </button>
        <button className="btn btn-ghost" disabled={!a.canStartNextRound || busy !== null} onClick={p.onNextRound}>
          <FastForward className="h-4 w-4" />
          {a.nextRound ? `${a.nextRound}-raund: ${roundMeta(a.nextRound, p.settings).title}` : 'Oxirgi raund'}
        </button>
        <button className="btn btn-danger" disabled={!a.canEndGame || busy !== null} onClick={p.onEndGame}>
          <Square className="h-4 w-4" /> Oʻyinni yakunlash
        </button>
      </div>
    </div>
  );
}

function BusyIcon({ busy, id, children }: { busy: string | null; id: string; children: React.ReactNode }) {
  return busy === id ? <Spinner className="h-4 w-4" /> : <>{children}</>;
}
