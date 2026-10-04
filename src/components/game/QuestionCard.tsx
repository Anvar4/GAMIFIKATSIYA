import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle2, Delete, Lock, LockOpen, XCircle } from 'lucide-react';
import type { InputSpec, QuestionType } from '../../game/types';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const OPTION_ACCENTS = ['#3EE7FF', '#FFC857', '#A66BFF', '#35D49A', '#FF8A5B', '#FF6FB5'];

export function isChoiceType(t: QuestionType | null | undefined): boolean {
  return t === 'single_choice' || t === 'true_false' || t === 'image_identification' || t === 'logical_puzzle';
}

export function formatCorrectAnswer(type: QuestionType | null | undefined, options: string[] | null | undefined, correct: unknown): string {
  if (correct === null || correct === undefined) return '';
  if (type === 'short_answer') return (Array.isArray(correct) ? correct : [String(correct)]).join(' / ');
  const idx = Number(correct);
  return `${OPTION_LETTERS[idx] ?? '?'}) ${options?.[idx] ?? ''}`;
}

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
