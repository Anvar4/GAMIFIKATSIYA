import { useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { RotateCcw, Save } from 'lucide-react';
import { Panel } from '../../../components/ui/Basics';
import { ABILITIES, ABILITY_ORDER, GRADES } from '../../../game/constants';
import type { AbilityType, RoomSettings } from '../../../game/types';
import { updateRoomSettings } from '../../../services/api';
import { getInstructorClient } from '../../../lib/supabase';
import type { ConsoleCtx } from './shared';

type NumKey = {
  [K in keyof RoomSettings]-?: RoomSettings[K] extends number ? K : never;
}[keyof RoomSettings];
type BoolKey = {
  [K in keyof RoomSettings]-?: RoomSettings[K] extends boolean ? K : never;
}[keyof RoomSettings];

const NUMBERS: { key: NumKey; label: string; min: number; max: number; step?: number; hint?: string; lobbyOnly?: boolean }[] = [
  { key: 'max_players', label: 'Maksimal oʻquvchilar', min: 2, max: 40, lobbyOnly: true },
  { key: 'team_size', label: 'Jamoa hajmi', min: 1, max: 20, lobbyOnly: true },
  { key: 'max_shield', label: 'Maksimal qalqon', min: 10, max: 1000 },
  { key: 'max_energy', label: 'Maksimal energiya', min: 10, max: 1000 },
  { key: 'energy_per_correct', label: 'Toʻgʻri javob uchun energiya', min: 0, max: 200 },
  { key: 'damage_per_correct', label: 'Toʻgʻri javob uchun zarar', min: 0, max: 100 },
  { key: 'attack_threshold', label: 'Plazma zarba uchun energiya', min: 1, max: 1000 },
  { key: 'heavy_attack_damage', label: 'Plazma zarba zarari', min: 0, max: 500 },
  { key: 'crit_streak', label: 'Kritik zarba seriyasi', min: 1, max: 20 },
  { key: 'crit_multiplier', label: 'Kritik koʻpaytuvchi', min: 1, max: 5, step: 0.1 },
  { key: 'final_round_multiplier', label: 'Final raund koʻpaytuvchisi', min: 1, max: 5, step: 0.1 },
  { key: 'shield_regen_per_round', label: 'Har raundda qalqon tiklanishi', min: 0, max: 500 },
  { key: 'speed_bonus_ratio', label: 'Tezlik bonusi koeffitsienti', min: 0, max: 2, step: 0.05, hint: '0,5 = maksimal +50%' },
  { key: 'answer_grace_ms', label: 'Tarmoq kechikishi uchun imtiyoz (ms)', min: 0, max: 5000, step: 100 },
  { key: 'ability_max_uses', label: 'Har qobiliyatdan foydalanish soni', min: 0, max: 20, lobbyOnly: true },
  { key: 'ability_cooldown_seconds', label: 'Qobiliyat qayta zaryadlanishi (s)', min: 0, max: 600 },
  { key: 'time_freeze_seconds', label: 'TIME FREEZE qoʻshimcha vaqti (s)', min: 1, max: 60 },
  { key: 'energy_steal_amount', label: 'ENERGY STEAL miqdori', min: 0, max: 500 },
  { key: 'shield_boost_block', label: 'SHIELD BOOST toʻsish ulushi', min: 0, max: 1, step: 0.05, hint: '0,6 = zarbaning 60% i' },
];

const BOOLS: { key: BoolKey; label: string; hint: string }[] = [
  { key: 'allow_team_choice', label: 'Oʻquvchi jamoani oʻzi tanlaydi', hint: 'Oʻchiq boʻlsa jamoani oʻqituvchi belgilaydi' },
  { key: 'auto_approve', label: 'Avtomatik tasdiqlash', hint: 'Oʻquvchi qoʻshilishi bilan jamoaga kiritiladi' },
  { key: 'elimination_mode', label: 'Eliminatsiya rejimi', hint: 'Qalqoni 0 boʻlgan kema magʻlub deb belgilanadi va zarba bera olmaydi (oʻquvchilar baribir ball yigʻadi)' },
  { key: 'ability_voting', label: 'Jamoa qobiliyat soʻray oladi', hint: 'Oʻquvchilar qobiliyat soʻraydi, oʻqituvchi tasdiqlaydi' },
];

export function SettingsTab({ s, run, busy }: ConsoleCtx) {
  const [draft, setDraft] = useState<RoomSettings>(s.room.settings);
  const key = JSON.stringify(s.room.settings);
  useEffect(() => setDraft(JSON.parse(key) as RoomSettings), [key]);
  const [catalog, setCatalog] = useState<{ subject: string; grade: number | null; category: string }[]>([]);
  useEffect(() => {
    void getInstructorClient()
      .from('questions')
      .select('subject, grade, category')
      .eq('is_active', true)
      .limit(5000)
      .then(({ data }) => setCatalog((data as typeof catalog) ?? []));
  }, []);

  const lobby = s.room.status === 'lobby';
  const editable = s.room.status !== 'finished' && s.room.status !== 'archived';
  const patch = useMemo(() => {
    const p: Record<string, unknown> = {};
    (Object.keys(draft) as (keyof RoomSettings)[]).forEach((k) => {
      if (k === 'rounds') return;
      if (JSON.stringify(draft[k]) !== JSON.stringify(s.room.settings[k])) p[k] = draft[k];
    });
    return p as Partial<RoomSettings>;
  }, [draft, s.room.settings]);
  const dirty = Object.keys(patch).length > 0;

  const filter = draft.question_filter ?? { subject: null, grade: null, categories: [] };
  const subjects = [...new Set(catalog.map((c) => c.subject))].sort();
  const cats = [...new Set(catalog.filter((c) => (!filter.subject || c.subject === filter.subject) && (!filter.grade || c.grade === null || c.grade === filter.grade)).map((c) => c.category))].sort();

  const field = (label: string, input: ReactNode, hint?: string) => (
    <label className="block">
      <span className="label">{label}</span>
      {input}
      {hint && <span className="mt-1 block text-xs text-arena-muted">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-5 pb-24">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Roʻyxatdan oʻtish va rejim">
          <div className="space-y-3">
            {BOOLS.map((b) => (
              <label key={b.key} className="flex items-start gap-3 rounded-xl border border-white/5 bg-space-950/40 p-3">
                <input type="checkbox" className="mt-1" disabled={!editable} checked={Boolean(draft[b.key])} onChange={(e) => setDraft({ ...draft, [b.key]: e.target.checked })} />
                <span>
                  <span className="block font-semibold">{b.label}</span>
                  <span className="text-xs text-arena-muted">{b.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Savollarni avtomatik tanlash filtri">
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              'Fan',
              <select
                className="input"
                disabled={!editable}
                value={filter.subject ?? ''}
                onChange={(e) => setDraft({ ...draft, question_filter: { ...filter, subject: e.target.value || null, categories: [] } })}
              >
                <option value="">Barcha fanlar</option>
                {subjects.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>,
            )}
            {field(
              'Sinf',
              <select
                className="input"
                disabled={!editable}
                value={filter.grade ?? ''}
                onChange={(e) => setDraft({ ...draft, question_filter: { ...filter, grade: e.target.value ? Number(e.target.value) : null } })}
              >
                <option value="">Barcha sinflar</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}-sinf
                  </option>
                ))}
              </select>,
            )}
          </div>
          <div className="mt-3">
            <span className="label">Mavzular (tanlanmasa — barchasi)</span>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const on = filter.categories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={!editable}
                    onClick={() =>
                      setDraft({ ...draft, question_filter: { ...filter, categories: on ? filter.categories.filter((x) => x !== c) : [...filter.categories, c] } })
                    }
                    className={clsx('chip', on ? 'border-arena-cyan bg-arena-cyan/15 text-arena-cyan' : 'border-white/10 text-arena-muted')}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-arena-muted">Filtr saqlangach “Savollar rejasi” tabida “Avtomatik toʻldirish” tugmasini bosing.</p>
          </div>
        </Panel>
      </div>

      <Panel title="Jang balansi va qobiliyatlar">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NUMBERS.map((n) =>
            field(
              n.label,
              <input
                type="number"
                className="input"
                min={n.min}
                max={n.max}
                step={n.step ?? 1}
                disabled={!editable || (n.lobbyOnly && !lobby)}
                value={draft[n.key] as number}
                onChange={(e) => setDraft({ ...draft, [n.key]: Number(e.target.value) })}
              />,
              n.lobbyOnly && !lobby ? 'Faqat lobbida oʻzgartiriladi' : n.hint,
            ),
          )}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {ABILITY_ORDER.map((a: AbilityType) => {
            const disabled = draft.disabled_abilities?.includes(a);
            return (
              <div key={a} className={clsx('rounded-xl border bg-space-950/40 p-3', disabled ? 'border-white/5 opacity-60' : 'border-white/10')}>
                <div className="font-display text-sm font-bold" style={{ color: ABILITIES[a].color }}>
                  {ABILITIES[a].title}
                </div>
                <label className="mt-2 block text-xs text-arena-muted">
                  Narx (energiya)
                  <input
                    type="number"
                    className="input mt-1"
                    min={0}
                    max={1000}
                    disabled={!editable}
                    value={draft.ability_costs?.[a] ?? 30}
                    onChange={(e) => setDraft({ ...draft, ability_costs: { ...draft.ability_costs, [a]: Number(e.target.value) } })}
                  />
                </label>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={!disabled}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        disabled_abilities: e.target.checked ? (draft.disabled_abilities ?? []).filter((x) => x !== a) : [...(draft.disabled_abilities ?? []), a],
                      })
                    }
                  />
                  Yoqilgan
                </label>
              </div>
            );
          })}
        </div>
      </Panel>

      {dirty && editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-space-900/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-2 px-4 py-3">
            <span className="mr-auto text-sm text-arena-muted">{Object.keys(patch).length} ta sozlama oʻzgartirildi</span>
            <button className="btn btn-ghost" onClick={() => setDraft(s.room.settings)}>
              <RotateCcw className="h-4 w-4" /> Bekor qilish
            </button>
            <button className="btn btn-primary" disabled={busy !== null} onClick={() => void run('settings', () => updateRoomSettings(getInstructorClient(), s.room.id, patch), 'Sozlamalar saqlandi')}>
              <Save className="h-4 w-4" /> Saqlash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
