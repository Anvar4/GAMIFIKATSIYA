import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ClipboardList, Gauge, MonitorPlay, Presentation, Settings2, Trophy, Users } from 'lucide-react';
import { InstructorLayout } from './InstructorLayout';
import { ConnectionBadge, ErrorState, LoadingScreen } from '../../components/ui/Basics';
import { SoundControls } from '../../components/ui/SoundControls';
import { useRoomSnapshot } from '../../hooks/useRoomSnapshot';
import { usePresence } from '../../hooks/usePresence';
import { useDocumentTitle } from '../../hooks/useUi';
import { useFeedback } from '../../context/Feedback';
import { getInstructorClient } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { syncClock } from '../../lib/clock';
import { soundEngine } from '../../lib/sound';
import { isFullSnapshot } from '../../services/api';
import { phaseLabel } from '../../game/state';
import type { GameEvent } from '../../game/types';
import type { RunFn } from './console/shared';
import { LobbyTab } from './console/LobbyTab';
import { PlanTab } from './console/PlanTab';
import { LiveTab } from './console/LiveTab';
import { SettingsTab } from './console/SettingsTab';
import { ResultsTab } from './console/ResultsTab';

type Tab = 'lobby' | 'plan' | 'live' | 'settings' | 'results';

export default function RoomConsole() {
  const { roomId } = useParams();
  const client = getInstructorClient();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  const onEvent = useCallback((e: GameEvent) => {
    const sound = soundEngine('console');
    if (e.event_type === 'player_joined') sound.play('submit');
    if (e.event_type === 'question_started') sound.play('question');
    if (e.event_type === 'ability_requested') sound.play('bonus');
  }, []);

  const { snapshot, loading, error, connection, refresh } = useRoomSnapshot(client, roomId, onEvent);
  const online = usePresence(client, roomId, 'console', { role: 'console' });

  useEffect(() => {
    void syncClock(client);
  }, [client]);

  const s = isFullSnapshot(snapshot) ? snapshot : null;
  useDocumentTitle(s ? `${s.room.room_code} • Konsol` : 'Konsol');

  // Holatga qarab standart tab
  useEffect(() => {
    if (!s) return;
    setTab((t) => {
      if (t) {
        if (s.room.status === 'finished' && t === 'live') return 'results';
        if ((s.room.status === 'active' || s.room.status === 'paused') && t === 'lobby') return 'live';
        return t;
      }
      return s.room.status === 'lobby' ? 'lobby' : s.room.status === 'finished' || s.room.status === 'archived' ? 'results' : 'live';
    });
  }, [s?.room.status]);

  const run: RunFn = useCallback(
    async (label, fn, success) => {
      setBusy(label);
      try {
        const r = await fn();
        if (success) toast(success, 'success');
        refresh();
        return r;
      } catch (e) {
        toast(errorMessage(e), 'error');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast, refresh],
  );

  if (!s && loading) return <LoadingScreen text="Xona yuklanmoqda…" />;
  if (!s) {
    return (
      <ErrorState
        title="Xonani ochib boʻlmadi"
        message={error ?? 'Xona topilmadi yoki unga kirish huquqingiz yoʻq.'}
        action={
          <Link className="btn btn-primary" to="/teacher">
            Boshqaruv paneliga
          </Link>
        }
      />
    );
  }

  const pendingCount = s.players.filter((p) => p.status === 'pending').length;
  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'lobby', label: 'Roʻyxat va jamoalar', icon: <Users className="h-4 w-4" />, badge: pendingCount },
    { key: 'plan', label: 'Savollar rejasi', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'live', label: 'Jonli boshqaruv', icon: <Gauge className="h-4 w-4" /> },
    { key: 'settings', label: 'Sozlamalar', icon: <Settings2 className="h-4 w-4" /> },
    { key: 'results', label: 'Natijalar', icon: <Trophy className="h-4 w-4" /> },
  ];
  const ctx = { s, client, run, busy, online };

  return (
    <InstructorLayout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/teacher" className="btn btn-ghost btn-sm" aria-label="Orqaga">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="font-logo text-2xl font-black tracking-[0.2em] text-arena-cyan">{s.room.room_code}</div>
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-bold">{s.room.title}</div>
          <div className="text-xs text-arena-muted">
            {phaseLabel(s)}
            {s.room.current_round > 0 && ` • ${s.room.current_round}-raund`}
          </div>
        </div>
        <ConnectionBadge state={connection} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SoundControls channel="console" showSlider={false} />
          <Link to={`/intro?room=${s.room.id}`} className="btn btn-ghost btn-sm">
            <Presentation className="h-4 w-4" /> Taqdimot
          </Link>
          <a href={`/arena/${s.room.id}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
            <MonitorPlay className="h-4 w-4" /> Arenani ochish
            {online.has('arena') && <span className="h-2 w-2 rounded-full bg-arena-success" title="Arena ochiq" />}
          </a>
        </div>
      </div>

      <nav className="mb-5 flex flex-wrap gap-1 rounded-2xl border border-white/5 bg-space-950/40 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === t.key ? 'bg-arena-cyan/15 text-arena-cyan' : 'text-arena-muted hover:bg-white/5 hover:text-arena-text',
            )}
          >
            {t.icon}
            {t.label}
            {Boolean(t.badge) && <span className="rounded-full bg-arena-warning px-1.5 text-xs font-bold text-space-950">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {tab === 'lobby' && <LobbyTab {...ctx} onStarted={() => setTab('live')} />}
      {tab === 'plan' && <PlanTab {...ctx} />}
      {tab === 'live' && <LiveTab {...ctx} />}
      {tab === 'settings' && <SettingsTab {...ctx} />}
      {tab === 'results' && <ResultsTab {...ctx} />}
    </InstructorLayout>
  );
}
