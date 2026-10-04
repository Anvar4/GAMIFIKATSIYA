import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serverNow } from '../lib/clock';
import { computeTimer, type TimerState } from '../game/timer';
import type { QuestionPayload, Room } from '../game/types';
import { finalizeQuestion } from '../services/api';

/** Server soatiga moslangan joriy vaqt (ms), har `intervalMs` da yangilanadi */
export function useServerNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useQuestionTimer(room: Room | null | undefined, question: QuestionPayload | null | undefined): TimerState {
  const now = useServerNow(200);
  return computeTimer(room, question, now);
}

/**
 * Muddat tugaganda savolni yopishni serverdan soʻraydi. Server vaqtni oʻzi tekshiradi,
 * shuning uchun bir nechta mijoz chaqirsa ham natija bitta (idempotent).
 * Oʻquvchilar zaxira sifatida biroz kechikish bilan chaqiradi.
 */
export function useAutoFinalize(
  client: SupabaseClient | null,
  room: Room | null | undefined,
  question: QuestionPayload | null | undefined,
  timer: TimerState,
  opts: { delayMs?: number; enabled?: boolean } = {},
): void {
  const { delayMs = 1300, enabled = true } = opts;
  const attempts = useRef<{ id: string | null; count: number; last: number }>({ id: null, count: 0, last: 0 });

  useEffect(() => {
    if (!enabled || !client || !question || !room) return;
    if (question.status !== 'active' || room.status !== 'active' || timer.phase !== 'expired') return;
    const a = attempts.current;
    if (a.id !== question.id) {
      a.id = question.id;
      a.count = 0;
      a.last = 0;
    }
    if (a.count >= 6) return;
    const since = Date.now() - a.last;
    const wait = a.count === 0 ? delayMs : Math.max(0, 2500 - since);
    const id = window.setTimeout(() => {
      a.count += 1;
      a.last = Date.now();
      finalizeQuestion(client, question.id, false).catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(id);
  }, [client, room, question, timer.phase, enabled, delayMs]);
}
