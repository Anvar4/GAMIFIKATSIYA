// Server soati bilan farqni (offset) baholash. Taymerlar server muddatidan
// hisoblanadi, shuning uchun har bir kompyuter soati notoʻgʻri boʻlsa ham bir xil vaqt koʻrinadi.
import type { SupabaseClient } from '@supabase/supabase-js';

let offsetMs = 0;
let bestRtt = Number.POSITIVE_INFINITY;
let lastSync = 0;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffset(): number {
  return offsetMs;
}

/** Bitta oʻlchov: soʻrov yuborilgan va javob kelgan vaqt oraligʻi oʻrtasi */
export function recordSample(serverIso: string, sentAt: number, receivedAt: number): void {
  const server = Date.parse(serverIso);
  if (Number.isNaN(server)) return;
  const rtt = receivedAt - sentAt;
  // eski oʻlchovlar vaqt oʻtishi bilan ishonchsizlashadi
  const stale = receivedAt - lastSync > 5 * 60_000;
  if (rtt <= bestRtt || stale) {
    bestRtt = rtt;
    offsetMs = server - (sentAt + rtt / 2);
    lastSync = receivedAt;
  }
}

export async function syncClock(client: SupabaseClient, samples = 3): Promise<void> {
  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now();
    const { data, error } = await client.rpc('server_time');
    const receivedAt = Date.now();
    if (!error && typeof data === 'string') recordSample(data, sentAt, receivedAt);
  }
}
