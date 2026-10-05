import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeftRight, Check, CheckCheck, Circle, Lock, Rocket, RotateCcw, Shuffle, Unlock, UserX, X } from 'lucide-react';
import { Panel, Spinner } from '../../../components/ui/Basics';
import { RoomCodeDisplay } from '../../../components/game/RoomCodeDisplay';
import { ShipImage } from '../../../components/game/Spaceship';
import { useFeedback } from '../../../context/Feedback';
import { SKINS, TEAM_COLORS } from '../../../game/constants';
import { lobbyReadiness } from '../../../game/state';
import type { SpaceshipSkin, Team, TeamColor } from '../../../game/types';
import {
  approveAllPlayers,
  approvePlayer,
  assignPlayerTeam,
  autoBalanceTeams,
  kickPlayer,
  rejectPlayer,
  resetRoom,
  setRegistration,
  startGame,
  updateTeam,
} from '../../../services/api';
import { sortedTeams, teamPlayers, type ConsoleCtx } from './shared';

export function LobbyTab({ s, client, run, busy, online, onStarted }: ConsoleCtx & { onStarted: () => void }) {
  const { confirm } = useFeedback();
  const [force, setForce] = useState(false);
  const teams = sortedTeams(s);
  const ready = lobbyReadiness(s);
  const pending = s.players.filter((p) => p.status === 'pending');
  const lobby = s.room.status === 'lobby';
  const approvedOnline = s.players.filter((p) => p.status === 'approved' && online.has(p.id)).length;

  const start = async () => {
    if (!ready.ready && !force) return;
    const ok = await confirm({
      title: 'Oʻyinni boshlash',
      message: ready.ready
        ? 'Roʻyxatdan oʻtish yopiladi va 1-raund boshlanadi.'
        : `Talablar bajarilmagan: ${ready.reasons.join('; ')}. Sinov rejimida baribir boshlaysizmi?`,
      confirmText: 'Boshlash',
    });
    if (!ok) return;
    const r = await run('start', () => startGame(client, s.room.id, force || !ready.ready), 'Oʻyin boshlandi!');
    if (r !== undefined) onStarted();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div className="space-y-5">
        <Panel title="Oʻquvchilarni taklif qilish">
          <RoomCodeDisplay code={s.room.room_code} size="md" />
          <p className="mt-4 text-center text-sm text-arena-muted">
            Oʻquvchilar <b className="text-arena-text">{window.location.host}/join</b> manziliga kirib kodni kiritadi yoki QR kodni skanerlaydi.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {lobby && (
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'reg',
                    () => setRegistration(client, s.room.id, !s.room.registration_open),
                    s.room.registration_open ? 'Roʻyxatdan oʻtish yopildi' : 'Roʻyxatdan oʻtish ochildi',
                  )
                }
              >
                {s.room.registration_open ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                {s.room.registration_open ? 'Roʻyxatni yopish' : 'Roʻyxatni ochish'}
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm text-arena-warning"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Xonani qayta tiklash',
                  message: 'Barcha ballar, javoblar va hodisalar oʻchiriladi. Oʻquvchilar va jamoalar saqlanadi.',
                  confirmText: 'Qayta tiklash',
                  danger: true,
                });
                if (ok) void run('reset', () => resetRoom(client, s.room.id), 'Xona qayta tiklandi');
              }}
            >
              <RotateCcw className="h-4 w-4" /> Xonani qayta tiklash
            </button>
          </div>
        </Panel>

        <Panel title="Tayyorlik">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-4xl font-extrabold">
                {ready.approved}
                <span className="text-xl text-arena-muted">/{ready.maxPlayers}</span>
              </div>
              <div className="text-sm text-arena-muted">tasdiqlangan oʻquvchi • {approvedOnline} tasi onlayn</div>
            </div>
            {ready.ready ? (
              <span className="chip border-arena-success bg-arena-success/15 px-3 py-1.5 text-base text-arena-success">
                <CheckCheck className="h-5 w-5" /> BARCHA TAYYOR
              </span>
            ) : (
              <span className="chip border-arena-warning/50 text-arena-warning">Kutilmoqda</span>
            )}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-space-950">
            <div className="h-full rounded-full bg-gradient-to-r from-arena-cyan to-arena-blue transition-all" style={{ width: `${(ready.approved / ready.maxPlayers) * 100}%` }} />
          </div>
          {!ready.ready && ready.reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-arena-muted">
              {ready.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
          {lobby && (
            <>
              <label className="mt-4 flex items-center gap-2 text-sm text-arena-muted">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                Sinov rejimi: talablar bajarilmasa ham boshlash
              </label>
              <button className="btn btn-primary btn-lg mt-4 w-full" disabled={busy !== null || (!ready.ready && !force) || ready.approved === 0} onClick={() => void start()}>
                {busy === 'start' ? <Spinner /> : <Rocket className="h-5 w-5" />} OʻYINNI BOSHLASH
              </button>
            </>
          )}
        </Panel>

        <Panel
          title={`Tasdiq kutayotganlar (${pending.length})`}
          actions={
            lobby && (
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void run('balance', () => autoBalanceTeams(client, s.room.id), 'Jamoalar taqsimlandi')}>
                  <Shuffle className="h-4 w-4" /> Taqsimlash
                </button>
                <button
                  className="btn btn-success btn-sm"
                  disabled={busy !== null || pending.length === 0}
                  onClick={() => void run('approveAll', () => approveAllPlayers(client, s.room.id), 'Oʻquvchilar tasdiqlandi')}
                >
                  <CheckCheck className="h-4 w-4" /> Hammasini tasdiqlash
                </button>
              </div>
            )
          }
        >
          {pending.length === 0 ? (
            <p className="text-sm text-arena-muted">Yangi soʻrovlar yoʻq.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((p) => {
                const chosen = teams.find((t) => t.id === p.team_id);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-space-950/40 p-2.5">
                    <Circle className={clsx('h-2.5 w-2.5', online.has(p.id) ? 'fill-arena-success text-arena-success' : 'fill-arena-muted/40 text-arena-muted/40')} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
                    {chosen && (
                      <span className="text-xs" style={{ color: TEAM_COLORS[chosen.color].hex }}>
                        tanlagan: {chosen.name}
                      </span>
                    )}
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        className="btn btn-sm btn-ghost"
                        style={{ borderColor: `${TEAM_COLORS[t.color].hex}66`, color: TEAM_COLORS[t.color].hex }}
                        disabled={busy !== null}
                        onClick={() => void run('approve', () => approvePlayer(client, p.id, t.id))}
                      >
                        <Check className="h-3.5 w-3.5" /> {t.name}
                      </button>
                    ))}
                    <button className="btn btn-sm btn-ghost text-arena-red" disabled={busy !== null} onClick={() => void run('reject', () => rejectPlayer(client, p.id))} aria-label="Rad etish">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid content-start gap-5 lg:grid-cols-2">
        {teams.map((team) => (
          <TeamEditor key={team.id} ctx={{ s, client, run, busy, online }} team={team} other={teams.find((t) => t.id !== team.id)!} />
        ))}
      </div>
    </div>
  );
}

function TeamEditor({ ctx, team, other }: { ctx: ConsoleCtx; team: Team; other: Team }) {
  const { s, client, run, busy, online } = ctx;
  const { confirm } = useFeedback();
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState<TeamColor>(team.color);
  const [skin, setSkin] = useState<SpaceshipSkin>(team.spaceship_skin);
  useEffect(() => {
    setName(team.name);
    setColor(team.color);
    setSkin(team.spaceship_skin);
  }, [team.name, team.color, team.spaceship_skin]);
  const dirty = name !== team.name || color !== team.color || skin !== team.spaceship_skin;
  const members = teamPlayers(s, team);
  const lobby = s.room.status === 'lobby';
  const editable = s.room.status !== 'finished' && s.room.status !== 'archived';
  const hex = TEAM_COLORS[color].hex;

  return (
    <Panel
      title={<span style={{ color: hex }}>{team.slot === 1 ? 'Chap kema' : 'Oʻng kema'}</span>}
      className="overflow-hidden"
      actions={
        <span className="chip border-white/10 text-arena-muted">
          {members.length}/{s.room.settings.team_size}
        </span>
      }
    >
      <div className="relative -mx-4 -mt-4 mb-4 flex h-36 items-center justify-center" style={{ background: `radial-gradient(circle, ${hex}33, transparent 70%)` }}>
        <ShipImage skin={skin} color={color} flip={team.slot === 2} className="h-full object-contain" />
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">Jamoa nomi</label>
          <input className="input font-display font-bold uppercase" maxLength={24} value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="label">Rang</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEAM_COLORS) as TeamColor[]).map((c) => {
              const taken = other.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={!editable || taken}
                  onClick={() => setColor(c)}
                  title={taken ? `${TEAM_COLORS[c].label} (band)` : TEAM_COLORS[c].label}
                  className={clsx('h-8 w-8 rounded-full border-2 transition disabled:opacity-25', color === c ? 'scale-110 border-white' : 'border-transparent')}
                  style={{ background: TEAM_COLORS[c].hex }}
                  aria-label={TEAM_COLORS[c].label}
                  aria-pressed={color === c}
                />
              );
            })}
          </div>
        </div>
        <div>
          <div className="label">Kema dizayni</div>
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(SKINS) as SpaceshipSkin[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={!editable}
                onClick={() => setSkin(k)}
                className={clsx('rounded-xl border bg-space-950/50 p-1.5 transition', skin === k ? 'border-arena-cyan' : 'border-white/10 hover:border-white/30')}
                aria-pressed={skin === k}
              >
                <ShipImage skin={k} color={color} className="h-10 w-full object-contain" />
                <div className="mt-1 text-[0.65rem] font-semibold">{SKINS[k].label}</div>
              </button>
            ))}
          </div>
        </div>
        {dirty && (
          <button className="btn btn-primary w-full" disabled={busy !== null} onClick={() => void run('team', () => updateTeam(client, team.id, name, color, skin), 'Jamoa saqlandi')}>
            Saqlash
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="label">Aʼzolar</div>
        <ul className="space-y-1.5">
          {members.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-sm">
              <Circle className={clsx('h-2.5 w-2.5', online.has(p.id) ? 'fill-arena-success text-arena-success' : 'fill-arena-muted/40 text-arena-muted/40')} />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
              {lobby && (
                <button
                  className="rounded p-1 text-arena-muted hover:bg-white/10 hover:text-arena-text"
                  title={`${other.name} jamoasiga oʻtkazish`}
                  disabled={busy !== null}
                  onClick={() => void run('move', () => assignPlayerTeam(client, p.id, other.id))}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              )}
              <button
                className="rounded p-1 text-arena-muted hover:bg-arena-red/10 hover:text-arena-red"
                title="Oʻyindan chiqarish"
                disabled={busy !== null}
                onClick={async () => {
                  const ok = await confirm({ title: `${p.nickname} ni chiqarish`, message: 'Oʻquvchi bu xonaga qayta qoʻshila olmaydi.', confirmText: 'Chiqarish', danger: true });
                  if (ok) void run('kick', () => kickPlayer(client, p.id));
                }}
              >
                <UserX className="h-4 w-4" />
              </button>
            </li>
          ))}
          {members.length === 0 && <li className="text-sm text-arena-muted">Hali aʼzo yoʻq</li>}
        </ul>
      </div>
    </Panel>
  );
}
