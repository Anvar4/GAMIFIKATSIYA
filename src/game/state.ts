// Oʻyin holat mashinasi: qaysi holatda oʻqituvchi qaysi amallarni bajara oladi.
// Server baribir har bir amalni tekshiradi; bu faqat UI tugmalarini boshqarish uchun.
import type { PlanItem, RoomSnapshot } from './types';

export interface LobbyReadiness {
  approved: number;
  pending: number;
  perTeam: { teamId: string; count: number }[];
  teamSize: number;
  maxPlayers: number;
  ready: boolean;
  reasons: string[];
}

export function lobbyReadiness(s: Pick<RoomSnapshot, 'players' | 'teams' | 'room'>): LobbyReadiness {
  const teamSize = s.room.settings.team_size ?? 5;
  const maxPlayers = s.room.settings.max_players ?? 10;
  const approvedPlayers = s.players.filter((p) => p.status === 'approved' && p.team_id);
  const pending = s.players.filter((p) => p.status === 'pending').length;
  const perTeam = s.teams.map((t) => ({ teamId: t.id, count: approvedPlayers.filter((p) => p.team_id === t.id).length }));
  const reasons: string[] = [];
  perTeam.forEach((pt, i) => {
    if (pt.count !== teamSize) reasons.push(`${s.teams[i].name}: ${pt.count}/${teamSize} oʻquvchi`);
  });
  if (pending > 0) reasons.push(`${pending} ta oʻquvchi tasdiq kutmoqda`);
  return {
    approved: approvedPlayers.length,
    pending,
    perTeam,
    teamSize,
    maxPlayers,
    ready: reasons.length === 0 && approvedPlayers.length > 0,
    reasons,
  };
}

export interface InstructorActions {
  canStartGame: boolean;
  canPause: boolean;
  canResume: boolean;
  canStartQuestion: boolean;
  canReveal: boolean;
  canSkip: boolean;
  canRestart: boolean;
  canAdjustTimer: boolean;
  canStartNextRound: boolean;
  canEndRound: boolean;
  canEndGame: boolean;
  questionActive: boolean;
  nextQuestion: PlanItem | null;
  remainingInRound: number;
  nextRound: number | null;
}

export function isPlanList(plan: RoomSnapshot['plan']): plan is PlanItem[] {
  return plan.length === 0 || 'question_id' in plan[0];
}

export function instructorActions(s: RoomSnapshot): InstructorActions {
  const status = s.room.status;
  const live = status === 'active' || status === 'paused';
  const questionActive = s.question?.status === 'active';
  const plan = isPlanList(s.plan) ? s.plan : [];
  const round = Math.max(1, s.room.current_round);
  const pendingInRound = plan.filter((p) => p.round_number === round && p.status === 'pending');
  const nextRound = round < 5 ? round + 1 : null;

  return {
    canStartGame: status === 'lobby',
    canPause: status === 'active',
    canResume: status === 'paused',
    canStartQuestion: status === 'active' && !questionActive && pendingInRound.length > 0,
    canReveal: live && questionActive,
    canSkip: live && questionActive,
    canRestart: status === 'active' && questionActive,
    canAdjustTimer: live && questionActive,
    canStartNextRound: status === 'active' && !questionActive && nextRound !== null,
    canEndRound: live && !questionActive && s.room.phase !== 'round_end',
    canEndGame: live,
    questionActive,
    nextQuestion: pendingInRound[0] ?? null,
    remainingInRound: pendingInRound.length,
    nextRound,
  };
}

/** Oʻyin bosqichining oʻzbekcha nomi */
export function phaseLabel(s: Pick<RoomSnapshot, 'room'>): string {
  const { status, phase } = s.room;
  if (status === 'lobby') return 'Roʻyxatdan oʻtish';
  if (status === 'paused') return 'Pauza';
  if (status === 'finished') return 'Oʻyin yakunlandi';
  if (status === 'archived') return 'Arxiv';
  switch (phase) {
    case 'round_intro':
      return 'Raund boshlanmoqda';
    case 'question':
      return 'Savol';
    case 'reveal':
      return 'Javob ochildi';
    case 'round_end':
      return 'Raund yakuni';
    case 'idle':
      return 'Kutish';
    default:
      return 'Oʻyin';
  }
}
