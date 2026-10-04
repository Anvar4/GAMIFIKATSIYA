import type { SupabaseClient } from '@supabase/supabase-js';
import type { Player, RoomSnapshot, Team } from '../../../game/types';

export type RunFn = <T>(label: string, fn: () => Promise<T>, success?: string) => Promise<T | undefined>;

export interface ConsoleCtx {
  s: RoomSnapshot;
  client: SupabaseClient;
  run: RunFn;
  busy: string | null;
  online: Set<string>;
}

export function teamPlayers(s: Pick<RoomSnapshot, 'players'>, team: Team, statuses: Player['status'][] = ['approved']): Player[] {
  return s.players.filter((p) => p.team_id === team.id && statuses.includes(p.status));
}

export function sortedTeams(s: Pick<RoomSnapshot, 'teams'>): Team[] {
  return [...s.teams].sort((a, b) => a.slot - b.slot);
}
