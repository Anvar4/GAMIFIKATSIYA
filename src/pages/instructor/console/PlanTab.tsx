import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ListChecks, Save, Search, Shuffle, Wand2 } from 'lucide-react';
import { Modal, Panel, Spinner } from '../../../components/ui/Basics';
import { formatCorrectAnswer } from '../../../components/game/QuestionCard';
import { DIFFICULTIES, GRADES, QUESTION_TYPES, roundMeta } from '../../../game/constants';
import { isPlanList } from '../../../game/state';
import type { PlanItem, QuestionRecord, RoundConfig } from '../../../game/types';
import { listQuestions } from '../../../services/questions';
import { planRoundsAuto, setRoundQuestions, shuffleRound, updateGameQuestion, updateRoomSettings } from '../../../services/api';
import { errorMessage } from '../../../lib/errors';
import { useFeedback } from '../../../context/Feedback';
import type { ConsoleCtx } from './shared';

const STATUS: Record<PlanItem['status'], { label: string; cls: string }> = {
  pending: { label: 'Kutmoqda', cls: 'text-arena-muted border-white/10' },
  active: { label: 'Faol', cls: 'text-arena-cyan border-arena-cyan/40' },
  revealed: { label: 'Oʻynaldi', cls: 'text-arena-success border-arena-success/40' },
  skipped: { label: 'Oʻtkazildi', cls: 'text-arena-warning border-arena-warning/40' },
};

export function PlanTab(ctx: ConsoleCtx) {
  const { s, client, run, busy } = ctx;
  const plan = isPlanList(s.plan) ? s.plan : [];
  const [picker, setPicker] = useState<number | null>(null);
  const editable = s.room.status !== 'finished' && s.room.status !== 'archived';
  const filter = s.room.settings.question_filter;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-space-950/40 p-4 text-sm">
        <span className="text-arena-muted">Avtomatik tanlash filtri:</span>
        <span className="chip border-white/10">{filter?.subject ?? 'Barcha fanlar'}</span>
        <span className="chip border-white/10">{filter?.grade ? `${filter.grade}-sinf` : 'Barcha sinflar'}</span>
        <span className="chip border-white/10">{filter?.categories?.length ? `${filter.categories.length} ta mavzu` : 'Barcha mavzular'}</span>
        <span className="text-arena-muted">(Sozlamalar tabida oʻzgartiriladi)</span>
        {editable && (
          <button className="btn btn-primary btn-sm ml-auto" disabled={busy !== null} onClick={() => void run('autoAll', () => planRoundsAuto(client, s.room.id, null), 'Kutayotgan savollar qayta tanlandi')}>
            <Wand2 className="h-4 w-4" /> Barcha raundlarni avtomatik toʻldirish
          </button>
        )}
      </div>

      {[1, 2, 3, 4, 5].map((round) => (
        <RoundPlan key={round} ctx={ctx} round={round} items={plan.filter((p) => p.round_number === round)} onPick={() => setPicker(round)} editable={editable} />
      ))}

      {picker !== null && (
        <QuestionPicker
          ctx={ctx}
          round={picker}
          plan={plan}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function RoundPlan({ ctx, round, items, onPick, editable }: { ctx: ConsoleCtx; round: number; items: PlanItem[]; onPick: () => void; editable: boolean }) {
  const { s, client, run, busy } = ctx;
  const meta = roundMeta(round, s.room.settings);
  const cfg: RoundConfig = s.room.settings.rounds?.[String(round)] ?? {};
  const [draft, setDraft] = useState<RoundConfig>(cfg);
  const cfgKey = JSON.stringify(cfg);
  useEffect(() => setDraft(JSON.parse(cfgKey) as RoundConfig), [cfgKey]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg);
  const isCurrent = s.room.current_round === round && s.room.status !== 'lobby';

  return (
    <Panel
      className={clsx(isCurrent && 'ring-1 ring-arena-cyan/40')}
      title={
        <span className="flex items-center gap-2">
          <span style={{ color: meta.accent }}>{round}-raund</span> {meta.title}
          {isCurrent && <span className="chip border-arena-cyan/40 text-arena-cyan">joriy</span>}
        </span>
      }
      actions={
        editable && (
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void run('shuffle', () => shuffleRound(client, s.room.id, round), 'Aralashtirildi')}>
              <Shuffle className="h-4 w-4" /> Aralashtirish
            </button>
            <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void run('auto', () => planRoundsAuto(client, s.room.id, round), 'Raund avtomatik toʻldirildi')}>
              <Wand2 className="h-4 w-4" /> Avtomatik
            </button>
            <button className="btn btn-primary btn-sm" onClick={onPick}>
              <ListChecks className="h-4 w-4" /> Qoʻlda tanlash
            </button>
          </div>
        )
      }
    >
      {editable && (
        <div className="mb-4 grid gap-3 rounded-xl border border-white/5 bg-space-950/40 p-3 sm:grid-cols-3 lg:grid-cols-7">
          <div className="lg:col-span-2">
            <label className="label">Raund nomi</label>
            <input className="input" maxLength={40} placeholder={roundMeta(round).title} value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Ball</label>
            <input type="number" className="input" min={0} max={5000} value={draft.points ?? 100} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Vaqt, s</label>
            <input type="number" className="input" min={5} max={300} value={draft.time_limit ?? 20} onChange={(e) => setDraft({ ...draft, time_limit: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Savollar soni</label>
            <input type="number" className="input" min={0} max={30} value={draft.count ?? 4} onChange={(e) => setDraft({ ...draft, count: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Muhokama, s</label>
            <input type="number" className="input" min={0} max={300} value={draft.discussion_seconds ?? 0} onChange={(e) => setDraft({ ...draft, discussion_seconds: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(draft.speed_bonus)} onChange={(e) => setDraft({ ...draft, speed_bonus: e.target.checked })} /> Tezlik bonusi
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.scoring_mode === 'team_first'}
                onChange={(e) => setDraft({ ...draft, scoring_mode: e.target.checked ? 'team_first' : 'individual' })}
              />
              Jamoada faqat birinchi toʻgʻri javob
            </label>
          </div>
          {dirty && (
            <div className="flex items-end sm:col-span-3 lg:col-span-7">
              <button
                className="btn btn-primary btn-sm"
                disabled={busy !== null}
                onClick={() => void run('roundcfg', () => updateRoomSettings(client, s.room.id, { rounds: { [String(round)]: draft } }), 'Raund sozlamalari saqlandi')}
              >
                <Save className="h-4 w-4" /> Saqlash
              </button>
              <span className="ml-3 text-xs text-arena-muted">Yangi ball/vaqt “Avtomatik” yoki “Qoʻlda tanlash” orqali qoʻshilgan savollarga qoʻllanadi.</span>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-arena-muted">Bu raundda savol yoʻq.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it) => (
            <PlanRow key={it.id} ctx={ctx} item={it} editable={editable && it.status === 'pending'} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

function PlanRow({ ctx, item, editable }: { ctx: ConsoleCtx; item: PlanItem; editable: boolean }) {
  const { client, run, busy } = ctx;
  const [points, setPoints] = useState(item.points);
  const [time, setTime] = useState(item.time_limit);
  useEffect(() => {
    setPoints(item.points);
    setTime(item.time_limit);
  }, [item.points, item.time_limit]);
  const dirty = points !== item.points || time !== item.time_limit;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-space-950/40 px-3 py-2">
      <span className="w-6 text-center font-display font-bold text-arena-muted">{item.sequence_number}</span>
      {item.image_url && <img src={item.image_url} alt="" className="h-9 w-9 rounded bg-space-950 object-contain" loading="lazy" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" title={item.question_text}>
          {item.question_text}
        </div>
        <div className="truncate text-xs text-arena-muted">
          {QUESTION_TYPES[item.question_type].label} • {item.category} •{' '}
          <span style={{ color: DIFFICULTIES[item.difficulty].color }}>{DIFFICULTIES[item.difficulty].label}</span> •{' '}
          <span className="text-arena-success">✓ {formatCorrectAnswer(item.question_type, item.options, item.correct_answer)}</span>
        </div>
      </div>
      <span className={clsx('chip', STATUS[item.status].cls)}>{STATUS[item.status].label}</span>
      {editable ? (
        <div className="flex items-center gap-1.5 text-xs">
          <input type="number" className="input w-20 px-2 py-1" min={0} max={5000} value={points} onChange={(e) => setPoints(Number(e.target.value))} aria-label="Ball" />
          <span className="text-arena-muted">ball</span>
          <input type="number" className="input w-16 px-2 py-1" min={5} max={300} value={time} onChange={(e) => setTime(Number(e.target.value))} aria-label="Vaqt" />
          <span className="text-arena-muted">s</span>
          {dirty && (
            <button className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void run('gq', () => updateGameQuestion(client, item.id, points, time))}>
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <span className="text-xs text-arena-muted">
          {item.points} ball • {item.time_limit} s{item.status !== 'pending' && ` • ${item.answer_count} javob`}
        </span>
      )}
    </li>
  );
}

function QuestionPicker({ ctx, round, plan, onClose }: { ctx: ConsoleCtx; round: number; plan: PlanItem[]; onClose: () => void }) {
  const { s, client, run } = ctx;
  const { toast } = useFeedback();
  const [bank, setBank] = useState<QuestionRecord[] | null>(null);
  const roundPending = plan.filter((p) => p.round_number === round && p.status === 'pending');
  const [selected, setSelected] = useState<string[]>(roundPending.map((p) => p.question_id));
  const usedElsewhere = useMemo(
    () => new Set(plan.filter((p) => !(p.round_number === round && p.status === 'pending')).map((p) => p.question_id)),
    [plan, round],
  );
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState(s.room.settings.question_filter?.subject ?? '');
  const [grade, setGrade] = useState(s.room.settings.question_filter?.grade ? String(s.room.settings.question_filter.grade) : '');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listQuestions(client)
      .then((q) => setBank(q.filter((x) => x.is_active && QUESTION_TYPES[x.question_type].playable)))
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [client, toast]);

  const subjects = useMemo(() => [...new Set((bank ?? []).map((q) => q.subject))].sort(), [bank]);
  const categories = useMemo(() => [...new Set((bank ?? []).filter((q) => !subject || q.subject === subject).map((q) => q.category))].sort(), [bank, subject]);
  const list = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (bank ?? [])
      .filter(
        (q) =>
          (!t || q.question_text.toLowerCase().includes(t)) &&
          (!subject || q.subject === subject) &&
          (!grade || q.grade === null || q.grade === Number(grade)) &&
          (!category || q.category === category),
      )
      .sort((a, b) => Number(b.recommended_round === round) - Number(a.recommended_round === round));
  }, [bank, search, subject, grade, category, round]);

  const cfg = s.room.settings.rounds?.[String(round)] ?? {};
  const save = async () => {
    setSaving(true);
    const r = await run('pick', () => setRoundQuestions(client, s.room.id, round, selected, cfg.points ?? null, cfg.time_limit ?? null), `${round}-raund rejasi saqlandi`);
    setSaving(false);
    if (r !== undefined) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${round}-raund uchun savollarni tanlash`}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-arena-muted">{selected.length} ta tanlandi (tanlash tartibi — savollar tartibi)</span>
          <button className="btn btn-ghost" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving && <Spinner className="h-4 w-4" />} Saqlash
          </button>
        </>
      }
    >
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <div className="relative sm:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-muted" />
          <input className="input pl-9" placeholder="Qidirish…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Barcha fanlar</option>
          {subjects.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Barcha sinflar</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}-sinf
            </option>
          ))}
        </select>
        <select className="input sm:col-span-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Barcha mavzular</option>
          {categories.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {!bank ? (
        <Spinner />
      ) : (
        <ul className="space-y-1.5">
          {list.map((q) => {
            const idx = selected.indexOf(q.id);
            const used = usedElsewhere.has(q.id);
            return (
              <li key={q.id}>
                <label className={clsx('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2', idx >= 0 ? 'border-arena-cyan/50 bg-arena-cyan/10' : 'border-white/5 bg-space-950/40', used && 'cursor-not-allowed opacity-40')}>
                  <input
                    type="checkbox"
                    disabled={used}
                    checked={idx >= 0}
                    onChange={(e) => setSelected((sel) => (e.target.checked ? [...sel, q.id] : sel.filter((x) => x !== q.id)))}
                  />
                  <span className="w-6 text-center font-display text-sm font-bold text-arena-cyan">{idx >= 0 ? idx + 1 : ''}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{q.question_text}</span>
                    <span className="block truncate text-xs text-arena-muted">
                      {q.subject}
                      {q.grade ? ` • ${q.grade}-sinf` : ''} • {q.category} • {QUESTION_TYPES[q.question_type].label}
                      {q.recommended_round ? ` • R${q.recommended_round}` : ''}
                      {used ? ' • boshqa raundda' : ''}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
