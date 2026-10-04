// Supabase Realtime Presence: kim hozir ulangan (oʻquvchilar, konsol, arena)
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function usePresence(
  client: SupabaseClient | null,
  roomId: string | null | undefined,
  key: string | null,
  meta: Record<string, unknown> = {},
): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const metaJson = JSON.stringify(meta);

  useEffect(() => {
    if (!client || !roomId || !key) return;
    const channel = client.channel(`presence:${roomId}`, { config: { presence: { key } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...JSON.parse(metaJson), at: new Date().toISOString() });
        }
      });
    return () => {
      void channel.untrack();
      void client.removeChannel(channel);
    };
  }, [client, roomId, key, metaJson]);

  return online;
}
