// Xona holatini real vaqtda kuzatish.
// Mijoz faqat game_events jadvaliga (RLS bilan filtrlangan) obuna boʻladi va har bir
// hodisadan keyin rolga mos xavfsiz snapshot'ni serverdan qayta oladi. Shu tufayli
// oʻquvchi brauzeriga hech qachon toʻgʻri javob yoki boshqalarning javoblari kelmaydi.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameEvent, LimitedSnapshot, RoomSnapshot } from '../game/types';
import { fetchSnapshot } from '../services/api';
import { errorMessage, isNetworkError } from '../lib/errors';
import { useOnline } from './useOnline';

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface RoomSnapshotState {
  snapshot: RoomSnapshot | LimitedSnapshot | null;
  loading: boolean;
  error: string | null;
  connection: ConnectionState;
  refresh: () => void;
}

export function useRoomSnapshot(
  client: SupabaseClient | null,
  roomId: string | null | undefined,
  onEvent?: (e: GameEvent) => void,
): RoomSnapshotState {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | LimitedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const online = useOnline();

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const inflight = useRef(false);
  const queued = useRef(false);
  const debounce = useRef<number | undefined>(undefined);
  const seen = useRef<Set<string>>(new Set());
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!client || !roomId) return;
    if (inflight.current) {
      queued.current = true;
      return;
    }
    inflight.current = true;
    try {
      const s = await fetchSnapshot(client, roomId);
      if (!alive.current) return;
      setSnapshot(s);
      setError(null);
      setFetchFailed(false);
    } catch (e) {
      if (!alive.current) return;
      setFetchFailed(true);
      // tarmoq uzilishida eski holat saqlanadi, faqat ulanish holati oʻzgaradi
      if (!isNetworkError(e)) setError(errorMessage(e));
    } finally {
      inflight.current = false;
      if (alive.current) setLoading(false);
      if (queued.current) {
        queued.current = false;
        void load();
      }
    }
  }, [client, roomId]);

  const schedule = useCallback(
    (delay = 120) => {
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => void load(), delay);
    },
    [load],
  );

  useEffect(() => {
    alive.current = true;
    if (!client || !roomId) return;
    setLoading(true);
    void load();

    const channel = client
      .channel(`room-events:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const ev = payload.new as GameEvent;
          if (ev?.id) {
            if (seen.current.has(ev.id)) return;
            seen.current.add(ev.id);
            if (seen.current.size > 400) seen.current = new Set([...seen.current].slice(-200));
          }
          onEventRef.current?.(ev);
          schedule();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSubscribed(true);
          // qayta ulanganda oʻtkazib yuborilgan hodisalarni tiklash
          schedule(50);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSubscribed(false);
        }
      });

    return () => {
      alive.current = false;
      window.clearTimeout(debounce.current);
      void client.removeChannel(channel);
    };
  }, [client, roomId, load, schedule]);

  // Zaxira soʻrov: ulanish yoʻq paytda tez-tez, bor paytda kamdan-kam
  useEffect(() => {
    if (!client || !roomId) return;
    const interval = window.setInterval(() => void load(), subscribed && !fetchFailed ? 20_000 : 3_000);
    return () => window.clearInterval(interval);
  }, [client, roomId, subscribed, fetchFailed, load]);

  // Oyna qayta faollashganda yoki internet qaytganda yangilash
  useEffect(() => {
    const onFocus = () => schedule(0);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [schedule]);

  const connection: ConnectionState = !online ? 'offline' : subscribed && !fetchFailed ? 'connected' : 'reconnecting';

  return { snapshot, loading, error, connection, refresh: () => schedule(0) };
}
