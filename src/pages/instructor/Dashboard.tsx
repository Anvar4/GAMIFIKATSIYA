import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Archive, BookOpenCheck, Gamepad2, History, MonitorPlay, Plus, Rocket, Trash2, Trophy, Users } from 'lucide-react';
import { InstructorLayout } from './InstructorLayout';
import { Panel, Spinner, Stat } from '../../components/ui/Basics';
import { getInstructorClient } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { useFeedback } from '../../context/Feedback';
import { archiveRoom, createRoom, deleteRoom } from '../../services/api';
import { GRADES, TEAM_COLORS } from '../../game/constants';
import type { RoomStatus, TeamColor } from '../../game/types';
import { useDocumentTitle } from '../../hooks/useUi';

interface RoomRow {
  id: string;
  room_code: string;
  title: string;
  status: RoomStatus;
  current_round: number;
  created_at: string;
  finished_at: string | null;
  winner_team_id: string | null;
  teams: { id: string; name: string; color: TeamColor; score: number; slot: number }[];
  players: { count: number }[];
}

interface CatalogRow {
  subject: string;
  grade: number | null;
  category: string;
}

const STATUS_LABEL: Record<RoomStatus, string> = {
  lobby: 'Roʻyxatdan oʻtish',
  active: 'Oʻyin davom etmoqda',
  paused: 'Pauzada',
  finished: 'Yakunlangan',
  archived: 'Arxivlangan',
};

export default function Dashboard() {
  useDocumentTitle('Oʻqituvchi paneli');
  const client = getInstructorClient();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const [rooms, setRooms] = useState<RoomRow[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [topics, setTopics] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const [r, q] = await Promise.all([
      client
        .from('game_rooms')
        .select('id, room_code, title, status, current_round, created_at, finished_at, winner_team_id, teams(id, name, color, score, slot), players(count)')
        .order('created_at', { ascending: false })
        .limit(60),
      client.from('questions').select('subject, grade, category').eq('is_active', true).limit(5000),
    ]);
    if (r.error) toast(errorMessage(r.error), 'error');
    else setRooms(r.data as unknown as RoomRow[]);
    if (!q.error) setCatalog(q.data as CatalogRow[]);
  }, [client, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjects = useMemo(() => [...new Set(catalog.map((c) => c.subject))].sort(), [catalog]);
  const filtered = useMemo(
    () =>
      catalog.filter(
        (c) => (!subject || c.subject === subject) && (!grade || c.grade === null || c.grade === Number(grade)),
      ),
    [catalog, subject, grade],
  );
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((c) => m.set(c.category, (m.get(c.category) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);
  const matching = topics.length ? filtered.filter((c) => topics.includes(c.category)).length : filtered.length;

  useEffect(() => {
    setTopics((t) => t.filter((x) => topicCounts.some(([name]) => name === x)));
  }, [topicCounts]);

  const create = async () => {
    setBusy(true);
    try {
      const filter = { subject: subject || null, grade: grade ? Number(grade) : null, categories: topics };
      const room = await createRoom(client, title.trim() || null, filter);
      toast(`Xona yaratildi: ${room.room_code}`, 'success');
      navigate(`/teacher/room/${room.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const active = rooms?.filter((r) => r.status === 'lobby' || r.status === 'active' || r.status === 'paused') ?? [];
  const history = rooms?.filter((r) => r.status === 'finished' || (showArchived && r.status === 'archived')) ?? [];
  const finishedCount = rooms?.filter((r) => r.status === 'finished').length ?? 0;

  return (
    <InstructorLayout>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Yangi oʻyin yaratish" icon={<Plus className="h-4 w-4" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="label" htmlFor="title">
                Oʻyin nomi (ixtiyoriy)
              </label>
              <input id="title" className="input" placeholder="Masalan: 9-S sinf • Informatika" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="subject">
                Fan
              </label>
              <select id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">Barcha fanlar</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="grade">
                Sinf
              </label>
              <select id="grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Barcha sinflar</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}-sinf
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="label">Mavzular (tanlanmasa — barchasi)</div>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
                {topicCounts.length === 0 && <span className="text-sm text-arena-muted">Bu filtr boʻyicha savol yoʻq. Savollar bankiga savol qoʻshing.</span>}
                {topicCounts.map(([name, n]) => {
                  const on = topics.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setTopics((t) => (on ? t.filter((x) => x !== name) : [...t, name]))}
                      className={clsx('chip transition', on ? 'border-arena-cyan bg-arena-cyan/15 text-arena-cyan' : 'border-white/10 text-arena-muted hover:border-white/30')}
                      aria-pressed={on}
                    >
                      {name} <span className="opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-space-950/40 p-4">
            <div className="text-sm">
              <span className={clsx('font-display text-2xl font-bold', matching < 21 ? 'text-arena-warning' : 'text-arena-success')}>{matching}</span>
              <span className="ml-2 text-arena-muted">ta mos savol {matching < 21 && '(5 raund uchun ~21 ta tavsiya etiladi)'}</span>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => void create()} disabled={busy || matching === 0}>
              {busy ? <Spinner /> : <Rocket className="h-5 w-5" />}
              YANGI OʻYIN YARATISH
            </button>
          </div>
        </Panel>

        <div className="grid content-start gap-4 sm:grid-cols-3 xl:grid-cols-3">
          <Stat label="Savollar banki" value={catalog.length} accent="#3EE7FF" />
          <Stat label="Faol oʻyinlar" value={active.length} accent="#35D49A" />
          <Stat label="Yakunlangan" value={finishedCount} accent="#FFC857" />
          <div className="sm:col-span-3">
            <Panel title="Tezkor havolalar" icon={<Gamepad2 className="h-4 w-4" />}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link to="/teacher/questions" className="btn btn-ghost justify-start">
                  <BookOpenCheck className="h-4 w-4" /> Savollar banki va Excel import
                </Link>
                <Link to="/intro" className="btn btn-ghost justify-start">
                  <MonitorPlay className="h-4 w-4" /> Qoidalar taqdimoti
                </Link>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Faol oʻyinlar" icon={<Users className="h-4 w-4" />}>
          {!rooms ? (
            <Spinner />
          ) : active.length === 0 ? (
            <p className="text-sm text-arena-muted">Faol oʻyin yoʻq. Yuqorida yangi oʻyin yarating.</p>
          ) : (
            <ul className="space-y-2">
              {active.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-space-950/40 p-3">
                  <span className="font-logo text-xl font-black tracking-widest text-arena-cyan">{r.room_code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className="text-xs text-arena-muted">
                      {STATUS_LABEL[r.status]} • {r.players[0]?.count ?? 0} oʻquvchi {r.current_round > 0 && `• ${r.current_round}-raund`}
                    </div>
                  </div>
                  <Link to={`/arena/${r.id}`} target="_blank" className="btn btn-ghost btn-sm">
                    <MonitorPlay className="h-4 w-4" /> Arena
                  </Link>
                  <Link to={`/teacher/room/${r.id}`} className="btn btn-primary btn-sm">
                    Boshqarish
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Oʻyinlar tarixi"
          icon={<History className="h-4 w-4" />}
          actions={
            <label className="flex items-center gap-2 text-xs text-arena-muted">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Arxivni koʻrsatish
            </label>
          }
        >
          {!rooms ? (
            <Spinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-arena-muted">Hali yakunlangan oʻyin yoʻq.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((r) => {
                const teams = [...r.teams].sort((a, b) => a.slot - b.slot);
                const winner = r.teams.find((t) => t.id === r.winner_team_id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-space-950/40 p-3">
                    <Trophy className="h-5 w-5 shrink-0" style={{ color: winner ? TEAM_COLORS[winner.color].hex : '#A8B7CC' }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {r.title} <span className="text-xs text-arena-muted">({r.room_code})</span>
                      </div>
                      <div className="text-xs text-arena-muted">
                        {teams.map((t) => `${t.name}: ${t.score}`).join(' • ')} •{' '}
                        {new Date(r.finished_at ?? r.created_at).toLocaleDateString('uz-UZ')}
                      </div>
                    </div>
                    <Link to={`/teacher/room/${r.id}`} className="btn btn-ghost btn-sm">
                      Natijalar
                    </Link>
                    {r.status === 'finished' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Arxivlash"
                        onClick={async () => {
                          try {
                            await archiveRoom(client, r.id);
                            void load();
                          } catch (e) {
                            toast(errorMessage(e), 'error');
                          }
                        }}
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm text-arena-red"
                      title="Oʻchirish"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Oʻyinni oʻchirish',
                          message: `${r.room_code} xonasi va uning barcha natijalari butunlay oʻchiriladi.`,
                          confirmText: 'Oʻchirish',
                          danger: true,
                        });
                        if (!ok) return;
                        try {
                          await deleteRoom(client, r.id);
                          toast('Oʻyin oʻchirildi', 'success');
                          void load();
                        } catch (e) {
                          toast(errorMessage(e), 'error');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </InstructorLayout>
  );
}
