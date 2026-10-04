// Savol turlariga xos maʼlumot tuzilmalari bilan ishlash uchun yordamchilar.
//  * matching:   options = chap ustun, correct_answer = oʻng ustun (bir xil tartibda)
//  * multi_step: options = qadamlar [{ text, options }], correct_answer = qadam indekslari
import type { CorrectAnswer, QuestionType, StepItem } from './types';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function isChoiceType(t: QuestionType | null | undefined): boolean {
  return t === 'single_choice' || t === 'true_false' || t === 'image_identification' || t === 'logical_puzzle';
}

/** Variantlarni matnlar roʻyxati sifatida olish (qadamlar boʻlsa — boʻsh roʻyxat) */
export function stringOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.every((o) => typeof o === 'string') ? (options as string[]) : [];
}

export function isStepItem(v: unknown): v is StepItem {
  return Boolean(v) && typeof v === 'object' && typeof (v as StepItem).text === 'string' && Array.isArray((v as StepItem).options);
}

/** Koʻp bosqichli savol qadamlari */
export function stepItems(options: unknown): StepItem[] {
  return Array.isArray(options) ? options.filter(isStepItem) : [];
}

export interface MatchingPair {
  left: string;
  right: string;
}

/** Moslashtirish juftliklari (chap → oʻng) */
export function matchingPairs(options: unknown, correct: unknown): MatchingPair[] {
  const left = stringOptions(options);
  const right = Array.isArray(correct) ? correct.map((c) => String(c ?? '')) : [];
  return left.map((l, i) => ({ left: l, right: right[i] ?? '' }));
}

/** Moslashtirish javobi: "[2,0,1]" → [2, 0, 1] (notoʻgʻri boʻlsa null) */
export function parseMatchingAnswer(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => Number.isInteger(x)) ? (v as number[]) : null;
  } catch {
    return null;
  }
}

/** Taqqoslash uchun normallashtirish (serverdagi _normalize_answer bilan bir xil gʻoya) */
export function normalizeAnswer(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!]+$/, '');
}

/** Moslashtirishda nechta juftlik toʻgʻri (server bilan bir xil qoida) */
export function matchingHits(correct: string[], choices: string[], selected: number[]): number {
  return correct.reduce((n, right, i) => {
    const pick = choices[selected[i]];
    return pick !== undefined && normalizeAnswer(pick) === normalizeAnswer(right) ? n + 1 : n;
  }, 0);
}

/** Toʻgʻri javobni oʻqiladigan matnga aylantirish */
export function formatCorrectAnswer(
  type: QuestionType | null | undefined,
  options: unknown,
  correct: CorrectAnswer | unknown,
  steps?: StepItem[] | null,
): string {
  if (correct === null || correct === undefined) return '';
  if (type === 'short_answer') return (Array.isArray(correct) ? correct : [String(correct)]).join(' / ');
  if (type === 'matching') {
    return matchingPairs(options, correct)
      .map((p) => `${p.left} → ${p.right}`)
      .join('; ');
  }
  if (type === 'multi_step') {
    const list = steps ?? stepItems(options);
    const answers = Array.isArray(correct) ? correct.map(Number) : [];
    return answers.map((a, i) => `${i + 1}) ${list[i]?.options[a] ?? OPTION_LETTERS[a] ?? '?'}`).join(' → ');
  }
  const idx = Number(correct);
  const opts = stringOptions(options);
  return `${OPTION_LETTERS[idx] ?? '?'}) ${opts[idx] ?? ''}`;
}
