// Server RPC funksiyalari uchun tiplangan oʻramlar. Barcha muhim amallar
// (ball, jang, vaqt) serverda bajariladi — brauzer faqat soʻrov yuboradi.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AbilityType,
  AwardKey,
  QuestionFilter,
  Room,
  RoomLookup,
  RoomSettings,
  RoomSnapshot,
  LimitedSnapshot,
  SpaceshipSkin,
  SpecialEventKind,
  TeamColor,
} from '../game/types';
import { recordSample } from '../lib/clock';

async function call<T>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// ---------------- Umumiy ----------------
export async function fetchSnapshot(client: SupabaseClient, roomId: string): Promise<RoomSnapshot | LimitedSnapshot> {
  const sentAt = Date.now();
  const snap = await call<RoomSnapshot | LimitedSnapshot>(client, 'get_room_snapshot', { p_room: roomId });
  recordSample(snap.server_time, sentAt, Date.now());
  return snap;
}

export function isFullSnapshot(s: RoomSnapshot | LimitedSnapshot | null): s is RoomSnapshot {
  return Boolean(s && 'teams' in s);
}

// ---------------- Oʻqituvchi: xona ----------------
export const createRoom = (c: SupabaseClient, title: string | null, filter: QuestionFilter | null) =>
  call<Room>(c, 'create_room', { p_title: title, p_filter: filter });
export const updateRoomSettings = (c: SupabaseClient, roomId: string, patch: Partial<RoomSettings>) =>
  call<RoomSettings>(c, 'update_room_settings', { p_room: roomId, p_patch: patch });
export const updateTeam = (c: SupabaseClient, teamId: string, name: string, color: TeamColor, skin: SpaceshipSkin) =>
  call(c, 'update_team', { p_team: teamId, p_name: name, p_color: color, p_skin: skin });
export const setRegistration = (c: SupabaseClient, roomId: string, open: boolean) =>
  call(c, 'set_registration', { p_room: roomId, p_open: open });
export const resetRoom = (c: SupabaseClient, roomId: string) => call(c, 'reset_room', { p_room: roomId });
export const archiveRoom = (c: SupabaseClient, roomId: string) => call(c, 'archive_room', { p_room: roomId });
export const deleteRoom = (c: SupabaseClient, roomId: string) => call(c, 'delete_room', { p_room: roomId });

// ---------------- Oʻqituvchi: oʻquvchilar ----------------
export const approvePlayer = (c: SupabaseClient, playerId: string, teamId: string | null) =>
  call(c, 'approve_player', { p_player: playerId, p_team: teamId });
export const approveAllPlayers = (c: SupabaseClient, roomId: string) => call<number>(c, 'approve_all_players', { p_room: roomId });
export const rejectPlayer = (c: SupabaseClient, playerId: string) => call(c, 'reject_player', { p_player: playerId });
export const kickPlayer = (c: SupabaseClient, playerId: string) => call(c, 'kick_player', { p_player: playerId });
export const assignPlayerTeam = (c: SupabaseClient, playerId: string, teamId: string) =>
  call(c, 'assign_player_team', { p_player: playerId, p_team: teamId });
export const autoBalanceTeams = (c: SupabaseClient, roomId: string) => call<number>(c, 'auto_balance_teams', { p_room: roomId });

// ---------------- Oʻqituvchi: reja ----------------
export const planRoundsAuto = (c: SupabaseClient, roomId: string, round: number | null) =>
  call<number>(c, 'plan_rounds_auto', { p_room: roomId, p_round: round });
export const setRoundQuestions = (
  c: SupabaseClient,
  roomId: string,
  round: number,
  questionIds: string[],
  points: number | null,
  timeLimit: number | null,
) =>
  call<number>(c, 'set_round_questions', {
    p_room: roomId,
    p_round: round,
    p_question_ids: questionIds,
    p_points: points,
    p_time_limit: timeLimit,
  });
export const updateGameQuestion = (c: SupabaseClient, gqId: string, points: number, timeLimit: number) =>
  call(c, 'update_game_question', { p_gq: gqId, p_points: points, p_time_limit: timeLimit });
export const shuffleRound = (c: SupabaseClient, roomId: string, round: number) =>
  call(c, 'shuffle_round', { p_room: roomId, p_round: round });

// ---------------- Oʻqituvchi: jonli boshqaruv ----------------
export const startGame = (c: SupabaseClient, roomId: string, force: boolean) =>
  call(c, 'start_game', { p_room: roomId, p_force: force });
export const startRound = (c: SupabaseClient, roomId: string, round: number | null) =>
  call(c, 'start_round', { p_room: roomId, p_round: round });
export const endRound = (c: SupabaseClient, roomId: string) => call(c, 'end_round', { p_room: roomId });
export const startQuestion = (c: SupabaseClient, roomId: string, gqId: string | null, discussionSeconds: number | null) =>
  call<{ game_question_id: string; deadline: string }>(c, 'start_question', {
    p_room: roomId,
    p_gq: gqId,
    p_discussion_seconds: discussionSeconds,
  });
export const finalizeQuestion = (c: SupabaseClient, gqId: string, force: boolean) =>
  call<{ finalized: boolean; reason?: string }>(c, 'finalize_question', { p_gq: gqId, p_force: force });
export const skipQuestion = (c: SupabaseClient, gqId: string) => call(c, 'skip_question', { p_gq: gqId });
export const restartQuestion = (c: SupabaseClient, gqId: string) => call(c, 'restart_question', { p_gq: gqId });
export const pauseGame = (c: SupabaseClient, roomId: string) => call(c, 'pause_game', { p_room: roomId });
export const resumeGame = (c: SupabaseClient, roomId: string) => call(c, 'resume_game', { p_room: roomId });
export const adjustTimer = (c: SupabaseClient, roomId: string, seconds: number) =>
  call(c, 'adjust_timer', { p_room: roomId, p_seconds: seconds });
export const adjustScore = (
  c: SupabaseClient,
  roomId: string,
  teamId: string,
  playerId: string | null,
  delta: number,
  reason: string,
) => call(c, 'adjust_score', { p_room: roomId, p_team: teamId, p_player: playerId, p_delta: delta, p_reason: reason });
export const triggerSpecialEvent = (c: SupabaseClient, roomId: string, kind: SpecialEventKind) =>
  call(c, 'trigger_special_event', { p_room: roomId, p_kind: kind });
export const activateAbility = (c: SupabaseClient, roomId: string, teamId: string, ability: AbilityType) =>
  call(c, 'use_ability', { p_room: roomId, p_team: teamId, p_ability: ability });
export const resolveAbilityRequest = (c: SupabaseClient, requestId: string, approve: boolean) =>
  call(c, 'resolve_ability_request', { p_request: requestId, p_approve: approve });
export const endGame = (c: SupabaseClient, roomId: string, winnerTeamId: string | null) =>
  call(c, 'end_game', { p_room: roomId, p_winner: winnerTeamId });
export const setWinner = (c: SupabaseClient, roomId: string, teamId: string | null) =>
  call(c, 'set_winner', { p_room: roomId, p_team: teamId });
export const setAward = (c: SupabaseClient, roomId: string, award: AwardKey, playerId: string | null) =>
  call(c, 'set_award', { p_room: roomId, p_award: award, p_player: playerId });

// ---------------- Oʻquvchi ----------------
export const lookupRoom = (c: SupabaseClient, code: string) => call<RoomLookup>(c, 'lookup_room', { p_code: code });
export const joinRoom = (c: SupabaseClient, code: string, nickname: string, teamId: string | null) =>
  call<{ player: { id: string; status: string; room_id: string }; room_id: string; reconnected: boolean }>(c, 'join_room', {
    p_code: code,
    p_nickname: nickname,
    p_team: teamId,
  });
export const submitAnswer = (c: SupabaseClient, gqId: string, answer: string) =>
  call<{ accepted: boolean; duplicate?: boolean; submitted_at?: string; auto_closed?: boolean }>(c, 'submit_answer', {
    p_gq: gqId,
    p_answer: answer,
  });
/** Koʻp bosqichli savol: bitta qadam javobi (server keyingi qadamni faqat toʻgʻri javobdan keyin beradi) */
export const submitStep = (c: SupabaseClient, gqId: string, step: number, answer: string) =>
  call<{
    accepted: boolean;
    duplicate?: boolean;
    correct?: boolean;
    finished?: boolean;
    auto_closed?: boolean;
    next?: { index: number; text: string; options: string[] } | null;
  }>(c, 'submit_step', { p_gq: gqId, p_step: step, p_answer: answer });
export const requestAbility = (c: SupabaseClient, roomId: string, ability: AbilityType) =>
  call<{ created: boolean; message?: string }>(c, 'request_ability', { p_room: roomId, p_ability: ability });
