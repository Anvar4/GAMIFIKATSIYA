import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowRight, CheckCircle2, Circle, Delete, Lock, LockOpen, XCircle } from 'lucide-react';
import type { InputSpec, MyStepsState, StepItem } from '../../game/types';
import { OPTION_LETTERS, normalizeAnswer } from '../../game/questionShape';

export { OPTION_LETTERS, formatCorrectAnswer, isChoiceType } from '../../game/questionShape';

const OPTION_ACCENTS = ['#3EE7FF', '#FFC857', '#A66BFF', '#35D49A', '#FF8A5B', '#FF6FB5'];

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

export function AnswerOption({
  index,
  text,
  state,
  onClick,
  disabled,
  size = 'md',
}: {
  index: number;
  text: string;
  state: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'xl';
}) {
  const accent = OPTION_ACCENTS[index % OPTION_ACCENTS.length];
  const interactive = Boolean(onClick) && !disabled;
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={onClick ? disabled : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      aria-pressed={onClick ? state === 'selected' : undefined}
      className={clsx(
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border text-left transition-all',
        size === 'xl' ? 'min-h-[5.2rem] px-5 py-4 text-[1.55rem]' : size === 'lg' ? 'min-h-[4rem] px-4 py-3 text-lg' : 'min-h-[3.4rem] px-3.5 py-3 text-base',
        state === 'idle' && 'border-white/10 bg-space-950/55',
        interactive && state === 'idle' && 'hover:border-white/30 hover:bg-white/[0.06]',
        state === 'selected' && 'border-arena-cyan bg-arena-cyan/15 shadow-glow',
        state === 'correct' && 'border-arena-success bg-arena-success/20',
        state === 'wrong' && 'border-arena-red bg-arena-red/15',
        state === 'dim' && 'border-white/5 bg-space-950/40 opacity-45',
        !interactive && onClick && 'cursor-not-allowed',
      )}
      style={state === 'correct' ? { boxShadow: '0 0 28px rgba(53,212,154,0.45)' } : undefined}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} />
      <span
        className={clsx(
          'flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold',
          size === 'xl' ? 'h-14 w-14 text-2xl' : size === 'lg' ? 'h-11 w-11 text-xl' : 'h-9 w-9 text-base',
        )}
        style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}66` }}
      >
        {OPTION_LETTERS[index]}
      </span>
      <span className="min-w-0 flex-1 font-semibold leading-snug text-arena-text">{text}</span>
      {state === 'correct' && <CheckCircle2 className="h-6 w-6 shrink-0 text-arena-success" />}
      {state === 'wrong' && <XCircle className="h-6 w-6 shrink-0 text-arena-red" />}
    </Tag>
  );
}

/** Variantlar holatini hisoblash */
export function optionState(i: number, opts: { selected?: string | null; correct?: number | null; revealed: boolean }): OptionState {
  const isSelected = opts.selected !== null && opts.selected !== undefined && Number(opts.selected) === i;
  if (opts.revealed && opts.correct !== null && opts.correct !== undefined) {
    if (i === opts.correct) return 'correct';
    if (isSelected) return 'wrong';
    return 'dim';
  }
  return isSelected ? 'selected' : 'idle';
}

/** Raqamli qulf yoki qisqa matnli javob */
export function ShortAnswerInput({
  spec,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  spec: InputSpec | null;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  if (spec?.kind === 'code') {
    const length = Math.min(Math.max(spec.length ?? 4, 1), 8);
    const press = (d: string) => !disabled && value.length < length && onChange(value + d);
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2" aria-label="Kod kiritish maydoni">
          {disabled ? <Lock className="h-6 w-6 text-arena-muted" /> : <LockOpen className="h-6 w-6 text-arena-success" />}
          {Array.from({ length }).map((_, i) => (
            <span
              key={i}
              className={clsx(
                'flex h-14 w-11 items-center justify-center rounded-xl border-2 font-logo text-2xl font-black',
                value[i] ? 'border-arena-success bg-arena-success/10 text-arena-success' : 'border-white/15 bg-space-950/60 text-arena-muted',
              )}
            >
              {value[i] ?? '•'}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-label="Kod"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          onKeyDown={(e) => e.key === 'Enter' && value.length > 0 && onSubmit()}
        />
        <div className="grid w-full max-w-xs grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="btn btn-ghost h-12 text-xl" disabled={disabled} onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="btn btn-ghost h-12" disabled={disabled} onClick={() => onChange(value.slice(0, -1))} aria-label="Oʻchirish">
            <Delete className="h-5 w-5" />
          </button>
          <button type="button" className="btn btn-ghost h-12 text-xl" disabled={disabled} onClick={() => press('0')}>
            0
          </button>
          <button type="button" className="btn btn-ghost h-12 text-sm" disabled={disabled} onClick={() => onChange('')}>
            Tozalash
          </button>
        </div>
      </div>
    );
  }
  return (
    <input
      ref={inputRef}
      className="input py-4 text-center text-xl font-semibold"
      placeholder="Javobingizni yozing…"
      value={value}
      maxLength={100}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && value.trim() && onSubmit()}
      aria-label="Javob"
      autoComplete="off"
    />
  );
}

/** Savol rasmi (yuklanmasa ham sahifa buzilmaydi) */
export function QuestionImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={clsx('flex items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-arena-muted', className)}>
        Rasm yuklanmadi
      </div>
    );
  }
  return (
    <div className={clsx('relative overflow-hidden rounded-2xl border border-arena-cyan/25 bg-[radial-gradient(circle_at_50%_45%,rgba(62,231,255,0.18),rgba(4,10,20,0.6)_70%)]', className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-arena-cyan/10 to-transparent" />
      <img src={src} alt="Savol rasmi" className="relative h-full w-full object-contain p-3" onError={() => setFailed(true)} decoding="async" />
    </div>
  );
}

// ---------------------------------------------------------------------
// Moslashtirish (matching)
// ---------------------------------------------------------------------

/** Oʻquvchi: har bir chap element uchun oʻng ustundan bitta javob tanlanadi */
export function MatchingInput({
  left,
  choices,
  value,
  onChange,
  disabled,
  reveal,
}: {
  left: string[];
  choices: string[];
  /** har bir chap element uchun tanlangan choices indeksi (−1 — tanlanmagan) */
  value: number[];
  onChange?: (next: number[]) => void;
  disabled?: boolean;
  /** ochilgandan keyin: toʻgʻri oʻng ustun (chap bilan bir xil tartibda) */
  reveal?: string[] | null;
}) {
  const interactive = Boolean(onChange) && !disabled;
  return (
    <div className="space-y-2.5" role="group" aria-label="Moslashtirish">
      {left.map((item, i) => {
        const picked = value[i] ?? -1;
        const pickedText = picked >= 0 ? choices[picked] : undefined;
        const correctText = reveal?.[i];
        const ok = reveal ? pickedText !== undefined && normalizeAnswer(pickedText) === normalizeAnswer(correctText ?? '') : null;
        return (
          <div
            key={i}
            className={clsx(
              'rounded-2xl border bg-space-950/55 p-3',
              ok === true ? 'border-arena-success/60' : ok === false ? 'border-arena-red/50' : 'border-white/10',
            )}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-arena-cyan/15 font-display text-sm font-bold text-arena-cyan">
                {i + 1}
              </span>
              <span className="text-lg">{item}</span>
              <ArrowRight className="h-4 w-4 text-arena-muted" aria-hidden />
              {reveal &&
                (ok ? (
                  <CheckCircle2 className="ml-auto h-5 w-5 text-arena-success" aria-label="Toʻgʻri" />
                ) : (
                  <span className="ml-auto flex items-center gap-1 text-sm text-arena-success">
                    <XCircle className="h-4 w-4 text-arena-red" aria-label="Notoʻgʻri" /> {correctText}
                  </span>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {choices.map((c, j) => {
                const active = picked === j;
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onChange?.(left.map((_, k) => (k === i ? j : (value[k] ?? -1))))}
                    aria-pressed={active}
                    className={clsx(
                      'rounded-xl border px-3 py-1.5 text-sm font-semibold transition',
                      active ? 'border-arena-cyan bg-arena-cyan/15 text-arena-cyan' : 'border-white/10 bg-white/[0.03] text-arena-text',
                      interactive && !active && 'hover:border-white/30 hover:bg-white/[0.06]',
                      !interactive && 'cursor-default',
                      reveal && !active && 'opacity-45',
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Katta ekran: chap ustun va aralashtirilgan javoblar; ochilganda toʻgʻri juftliklar */
export function MatchingBoard({ left, choices, reveal }: { left: string[]; choices: string[]; reveal?: string[] | null }) {
  if (reveal) {
    return (
      <ul className="grid gap-3 xl:grid-cols-2">
        {left.map((l, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-center gap-3 rounded-2xl border border-arena-success/40 bg-arena-success/10 px-4 py-3 text-[1.35rem] font-semibold"
          >
            <span className="min-w-0 flex-1 truncate">{l}</span>
            <ArrowRight className="h-6 w-6 shrink-0 text-arena-success" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-right text-arena-success">{reveal[i]}</span>
          </motion.li>
        ))}
      </ul>
    );
  }
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-5">
      <ul className="space-y-2.5">
        {left.map((l, i) => (
          <li key={i} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-space-950/55 px-4 py-3 text-[1.35rem] font-semibold">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-arena-cyan/15 font-display text-lg font-bold text-arena-cyan">{i + 1}</span>
            {l}
          </li>
        ))}
      </ul>
      <div className="flex flex-col justify-center gap-2.5 rounded-2xl border border-dashed border-white/15 bg-space-950/40 p-4">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-arena-muted">Javoblar</div>
        <div className="flex flex-wrap gap-2.5">
          {choices.map((c, j) => (
            <span key={j} className="rounded-xl border px-4 py-2 text-xl font-semibold" style={{ borderColor: `${OPTION_ACCENTS[j % OPTION_ACCENTS.length]}66`, color: OPTION_ACCENTS[j % OPTION_ACCENTS.length] }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Koʻp bosqichli zanjir (multi_step)
// ---------------------------------------------------------------------

/** Zanjir qadamlari holati: bajarilgan (✓/✗), joriy va qulflangan qadamlar */
export function StepDots({ total, done, current }: { total: number; done: { index: number; correct: boolean }[]; current: number | null }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Zanjir: ${done.length}/${total} qadam`}>
      {Array.from({ length: total }).map((_, i) => {
        const d = done.find((x) => x.index === i);
        return (
          <span key={i} className="flex items-center gap-1.5">
            <span
              className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-bold',
                d?.correct && 'border-arena-success bg-arena-success/20 text-arena-success',
                d && !d.correct && 'border-arena-red bg-arena-red/20 text-arena-red',
                !d && current === i && 'animate-pulse-soft border-arena-cyan bg-arena-cyan/15 text-arena-cyan',
                !d && current !== i && 'border-white/15 text-arena-muted',
              )}
            >
              {d ? d.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" /> : current === i ? i + 1 : <Lock className="h-3.5 w-3.5" />}
            </span>
            {i < total - 1 && <span className={clsx('h-0.5 w-5 rounded-full', d?.correct ? 'bg-arena-success/60' : 'bg-white/10')} />}
          </span>
        );
      })}
    </div>
  );
}

/** Oʻquvchi: joriy qadamni yechish paneli */
export function MultiStepPanel({
  state,
  disabled,
  busy,
  onSubmit,
}: {
  state: MyStepsState;
  disabled?: boolean;
  busy?: boolean;
  onSubmit: (step: number, choice: number) => void;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const cur = state.current;
  useEffect(() => setPick(null), [cur?.index]);

  // klaviatura: 1–4 / A–D tanlash, Enter tasdiqlash
  useEffect(() => {
    if (!cur || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      let idx = -1;
      if (/^[1-4]$/.test(k)) idx = Number(k) - 1;
      else if (OPTION_LETTERS.includes(k)) idx = OPTION_LETTERS.indexOf(k);
      if (idx >= 0 && idx < cur.options.length) setPick(idx);
      if (e.key === 'Enter' && pick !== null && !busy) onSubmit(cur.index, pick);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, disabled, pick, busy, onSubmit]);

  const wrong = state.done.find((d) => !d.correct);
  const correctCount = state.done.filter((d) => d.correct).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepDots total={state.total} done={state.done} current={cur?.index ?? null} />
        <span className="text-sm text-arena-muted">
          {correctCount}/{state.total} qadam
        </span>
      </div>
      {cur ? (
        <motion.div key={cur.index} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-arena-cyan">
            {cur.index + 1}-qadam / {state.total}
          </div>
          <p className="mt-1 text-lg font-semibold leading-snug">{cur.text}</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {cur.options.map((o, i) => (
              <AnswerOption
                key={i}
                index={i}
                text={o}
                size="lg"
                disabled={disabled || busy}
                onClick={() => setPick(i)}
                state={pick === i ? 'selected' : 'idle'}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg mt-4 w-full"
            disabled={disabled || busy || pick === null}
            onClick={() => pick !== null && onSubmit(cur.index, pick)}
          >
            <LockOpen className="h-5 w-5" /> {cur.index + 1 < state.total ? 'QADAMNI TASDIQLASH' : 'ZANJIRNI YAKUNLASH'}
          </button>
          <p className="mt-2 text-center text-xs text-arena-muted">Qadamni tasdiqlagach oʻzgartirib boʻlmaydi. Xato qadam zanjirni yakunlaydi.</p>
        </motion.div>
      ) : state.finished ? (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-2xl border p-4',
            wrong ? 'border-arena-warning/50 bg-arena-warning/10' : 'border-arena-success/50 bg-arena-success/10',
          )}
          role="status"
        >
          {wrong ? <Circle className="h-8 w-8 text-arena-warning" /> : <CheckCircle2 className="h-8 w-8 text-arena-success" />}
          <div>
            <div className="font-display text-lg font-bold">{wrong ? `${wrong.index + 1}-qadamda xato — zanjir yakunlandi` : 'Zanjir toʻliq bajarildi!'}</div>
            <div className="text-sm text-arena-muted">Natija javob ochilganda koʻrsatiladi.</div>
          </div>
        </div>
      ) : (
        <p className="text-arena-muted">Javob berish vaqti tugadi.</p>
      )}
    </div>
  );
}

/** Ochilgandan keyin: barcha qadamlar va toʻgʻri javoblar (oʻquvchi tanlovi bilan) */
export function StepsReveal({
  steps,
  correct,
  mine,
  large,
}: {
  steps: StepItem[];
  correct: number[];
  mine?: { index: number; selected: number; correct: boolean }[];
  large?: boolean;
}) {
  return (
    <ol className={clsx('grid gap-2', large && 'xl:grid-cols-2')}>
      {steps.map((st, i) => {
        const my = mine?.find((d) => d.index === i);
        return (
          <li key={i} className="rounded-2xl border border-white/10 bg-space-950/55 p-3">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-arena-muted">{i + 1}-qadam</div>
            <div className={clsx('font-semibold leading-snug', large && 'text-lg')}>{st.text}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="chip border-arena-success/50 bg-arena-success/10 text-arena-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> {st.options[correct[i]] ?? '?'}
              </span>
              {my && !my.correct && (
                <span className="chip border-arena-red/50 bg-arena-red/10 text-arena-red">
                  <XCircle className="h-3.5 w-3.5" /> {st.options[my.selected] ?? '?'}
                </span>
              )}
              {mine && !my && <span className="text-xs text-arena-muted">bajarilmadi</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
