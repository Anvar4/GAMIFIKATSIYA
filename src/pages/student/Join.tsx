import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowRight, Rocket, RotateCcw } from 'lucide-react';
import { Logo, SpaceBackground, Spinner } from '../../components/ui/Basics';
import { ensureStudentSession, getStudentClient, studentSlot } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { readLocal, writeLocal } from '../../lib/storage';
import { joinRoom, lookupRoom } from '../../services/api';
import { SKINS, TEAM_COLORS } from '../../game/constants';
import type { RoomLookup } from '../../game/types';
import { useDocumentTitle } from '../../hooks/useUi';

export const lastRoomKey = () => `it-arena-last-room${studentSlot() ? `-${studentSlot()}` : ''}`;

export default function Join() {
  useDocumentTitle('Oʻyinga qoʻshilish');
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const client = getStudentClient();
  const [code, setCode] = useState((codeParam ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [room, setRoom] = useState<RoomLookup | null>(null);
  const [nickname, setNickname] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = readLocal<{ roomId: string; code: string } | null>(lastRoomKey(), null);

  const lookup = async (c: string) => {
    setBusy(true);
    setError(null);
    try {
      await ensureStudentSession();
      const r = await lookupRoom(client, c);
      if (r.my_player && (r.my_player.status === 'pending' || r.my_player.status === 'approved')) {
        writeLocal(lastRoomKey(), { roomId: r.id, code: r.room_code });
        navigate(`/play/${r.id}`, { replace: true });
        return;
      }
      setRoom(r);
      if (r.my_player?.nickname) setNickname(r.my_player.nickname);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (codeParam && code.length === 6) void lookup(code);
  }, []);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) void lookup(code);
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setBusy(true);
    setError(null);
    try {
      const res = await joinRoom(client, room.room_code, nickname.trim(), room.allow_team_choice ? teamId : null);
      writeLocal(lastRoomKey(), { roomId: res.room_id, code: room.room_code });
      navigate(`/play/${res.room_id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const closed = room && (room.status !== 'lobby' || !room.registration_open);
  const full = room && room.active_players >= room.max_players;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <SpaceBackground image="arena" dim={0.55} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-lg rounded-3xl p-6 sm:p-8">
        <Logo size="md" />
        {!room ? (
          <form onSubmit={submitCode} className="mt-8">
            <h1 className="font-display text-2xl font-bold">Oʻyinga qoʻshilish</h1>
            <p className="mt-1 text-sm text-arena-muted">Katta ekrandagi 6 belgili xona kodini kiriting.</p>
            <label htmlFor="code" className="sr-only">
              Xona kodi
            </label>
            <input
              id="code"
              className="input mt-6 text-center font-logo text-3xl font-black uppercase tracking-[0.5em]"
              value={code}
              maxLength={6}
              autoFocus
              autoComplete="off"
              inputMode="text"
              placeholder="ABC123"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            />
            <button className="btn btn-primary btn-lg mt-4 w-full" disabled={busy || code.length !== 6}>
              {busy ? <Spinner /> : <ArrowRight className="h-5 w-5" />} Davom etish
            </button>
            {last && (
              <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => navigate(`/play/${last.roomId}`)}>
                <RotateCcw className="h-4 w-4" /> Oldingi oʻyinga qaytish ({last.code})
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={join} className="mt-8">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-arena-muted">Xona {room.room_code}</div>
            <h1 className="font-display text-2xl font-bold">{room.title}</h1>
            <p className="mt-1 text-sm text-arena-muted">
              {room.active_players}/{room.max_players} oʻquvchi roʻyxatdan oʻtgan
            </p>
            {closed ? (
              <p className="mt-6 rounded-xl border border-arena-warning/40 bg-arena-warning/10 p-3 text-sm text-arena-warning">
                {room.status === 'finished' ? 'Bu oʻyin yakunlangan.' : 'Roʻyxatdan oʻtish yopilgan. Oʻqituvchiga murojaat qiling.'}
              </p>
            ) : full ? (
              <p className="mt-6 rounded-xl border border-arena-warning/40 bg-arena-warning/10 p-3 text-sm text-arena-warning">Xona toʻla.</p>
            ) : (
              <>
                <label className="label mt-6" htmlFor="nick">
                  Ismingiz yoki taxallusingiz
                </label>
                <input
                  id="nick"
                  className="input text-lg font-semibold"
                  maxLength={20}
                  minLength={2}
                  required
                  autoFocus
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Masalan: Aziza K."
                />
                {room.allow_team_choice ? (
                  <div className="mt-5">
                    <div className="label">Jamoangizni tanlang</div>
                    <div className="grid grid-cols-2 gap-3">
                      {room.teams.map((t) => {
                        const full2 = t.members >= room.team_size;
                        const c = TEAM_COLORS[t.color].hex;
                        return (
                          <button
                            type="button"
                            key={t.id}
                            disabled={full2}
                            onClick={() => setTeamId(t.id)}
                            aria-pressed={teamId === t.id}
                            className={clsx('rounded-2xl border-2 bg-space-950/50 p-3 text-center transition disabled:opacity-40', teamId === t.id ? 'scale-[1.02]' : 'border-white/10')}
                            style={teamId === t.id ? { borderColor: c, boxShadow: `0 0 24px ${c}55` } : undefined}
                          >
                            <img src={SKINS[t.spaceship_skin].image} alt="" className="mx-auto h-16 object-contain" style={{ transform: t.slot === 2 ? 'scaleX(-1)' : undefined }} />
                            <div className="mt-1 font-display font-bold" style={{ color: c }}>
                              {t.name}
                            </div>
                            <div className="text-xs text-arena-muted">
                              {t.members}/{room.team_size}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-arena-muted">Jamoangizni oʻqituvchi belgilaydi.</p>
                )}
                <button
                  className="btn btn-primary btn-lg mt-6 w-full"
                  disabled={busy || nickname.trim().length < 2 || (room.allow_team_choice && !teamId)}
                >
                  {busy ? <Spinner /> : <Rocket className="h-5 w-5" />} OʻYINGA QOʻSHILISH
                </button>
              </>
            )}
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-arena-muted hover:text-arena-cyan"
              onClick={() => {
                setRoom(null);
                setError(null);
              }}
            >
              ← Boshqa kod kiritish
            </button>
          </form>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-arena-red/40 bg-arena-red/10 px-3 py-2 text-sm text-arena-red" role="alert">
            {error}
          </p>
        )}
        {studentSlot() && <p className="mt-4 text-center text-xs text-arena-muted">Sinov sloti: {studentSlot()}</p>}
      </motion.div>
    </main>
  );
}
