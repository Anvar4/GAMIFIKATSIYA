// Taymer holati server tomonidan berilgan muddat (deadline) asosida hisoblanadi.
// Brauzer taymeri hech qachon avtoritet emas — u faqat koʻrsatish uchun.
import type { QuestionPayload, Room } from './types';

export type TimerPhase = 'none' | 'discussion' | 'answering' | 'expired' | 'paused' | 'closed';

export interface TimerState {
  phase: TimerPhase;
  /** joriy bosqich tugashigacha qolgan ms */
  remainingMs: number;
  /** joriy bosqichning umumiy davomiyligi (progress uchun) */
  totalMs: number;
  /** 0..1 — qancha vaqt qolgani */
  progress: number;
}

const NONE: TimerState = { phase: 'none', remainingMs: 0, totalMs: 0, progress: 0 };

export function computeTimer(
  room: Pick<Room, 'status' | 'paused_remaining_ms' | 'paused_open_ms'> | null | undefined,
  question: Pick<QuestionPayload, 'status' | 'deadline' | 'answers_open_at' | 'started_at' | 'time_limit'> | null | undefined,
  serverNowMs: number,
): TimerState {
  if (!room || !question) return NONE;
  if (question.status === 'revealed' || question.status === 'skipped') {
    return { phase: 'closed', remainingMs: 0, totalMs: question.time_limit * 1000, progress: 0 };
  }
  if (question.status !== 'active' || !question.deadline) return NONE;

  const answerTotal = question.time_limit * 1000;

  if (room.status === 'paused') {
    const openLeft = room.paused_open_ms ?? 0;
    if (openLeft > 0) {
      return { phase: 'paused', remainingMs: openLeft, totalMs: openLeft, progress: 1 };
    }
    const rem = Math.max(0, room.paused_remaining_ms ?? 0);
    return { phase: 'paused', remainingMs: rem, totalMs: answerTotal, progress: clamp01(rem / answerTotal) };
  }

  const deadline = Date.parse(question.deadline);
  const openAt = question.answers_open_at ? Date.parse(question.answers_open_at) : null;
  const startedAt = question.started_at ? Date.parse(question.started_at) : null;

  if (openAt !== null && serverNowMs < openAt) {
    const total = startedAt !== null ? Math.max(1, openAt - startedAt) : Math.max(1, openAt - serverNowMs);
    const rem = openAt - serverNowMs;
    return { phase: 'discussion', remainingMs: rem, totalMs: total, progress: clamp01(rem / total) };
  }

  const rem = Math.max(0, deadline - serverNowMs);
  const total = openAt !== null ? Math.max(answerTotal, deadline - openAt) : answerTotal;
  if (rem <= 0) return { phase: 'expired', remainingMs: 0, totalMs: total, progress: 0 };
  return { phase: 'answering', remainingMs: rem, totalMs: total, progress: clamp01(rem / total) };
}

export function formatSeconds(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  if (s < 60) return String(s);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
