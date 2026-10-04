// Hodisalarni oʻzbekcha matnga aylantirish (jonli lenta uchun)
import { ABILITIES, SPECIAL_EVENTS, roundMeta } from './constants';
import type { AbilityType, GameEvent, Player, SpecialEventKind, Team } from './types';

export type EventTone = 'info' | 'success' | 'danger' | 'warning' | 'ability' | 'muted';

export interface EventView {
  text: string;
  tone: EventTone;
  /** Arena lentasida koʻrsatilsinmi */
  feed: boolean;
}

interface Ctx {
  teams: Team[];
  players: Player[];
}

const teamName = (ctx: Ctx, id: unknown) => ctx.teams.find((t) => t.id === id)?.name ?? 'Jamoa';
const playerName = (ctx: Ctx, id: unknown, fallback?: unknown) =>
  ctx.players.find((p) => p.id === id)?.nickname ?? (typeof fallback === 'string' ? fallback : 'Oʻquvchi');

export function describeEvent(e: GameEvent, ctx: Ctx): EventView {
  const d = e.event_data ?? {};
  switch (e.event_type) {
    case 'room_created':
      return { text: `Xona yaratildi: ${String(d.room_code ?? '')}`, tone: 'info', feed: false };
    case 'player_joined':
      return { text: `${String(d.nickname)} xonaga qoʻshilmoqchi`, tone: 'info', feed: false };
    case 'player_approved':
      return { text: `${String(d.nickname)} → ${teamName(ctx, e.team_id)}`, tone: 'success', feed: true };
    case 'player_rejected':
      return { text: `${String(d.nickname)} rad etildi`, tone: 'muted', feed: false };
    case 'player_kicked':
      return { text: `${String(d.nickname)} oʻyindan chiqarildi`, tone: 'warning', feed: false };
    case 'player_moved':
      return { text: `${String(d.nickname)} → ${teamName(ctx, e.team_id)}`, tone: 'info', feed: false };
    case 'team_updated':
      return { text: `Jamoa yangilandi: ${String(d.name)}`, tone: 'info', feed: false };
    case 'game_started':
      return { text: 'Galaktik jang boshlandi!', tone: 'success', feed: true };
    case 'round_started': {
      const r = Number(d.round ?? 1);
      return { text: `${r}-raund: ${roundMeta(r).title}`, tone: 'info', feed: true };
    }
    case 'round_ended':
      return { text: `${String(d.round)}-raund yakunlandi`, tone: 'info', feed: true };
    case 'question_started':
      return { text: `Yangi savol • ${String(d.points ?? '')} ball`, tone: 'info', feed: true };
    case 'answer_submitted':
      return { text: `${playerName(ctx, e.player_id)} javob berdi`, tone: 'muted', feed: true };
    case 'step_submitted':
      return { text: `${playerName(ctx, e.player_id)} ${String(d.step ?? '')}/${String(d.steps ?? '')}-qadamni yubordi`, tone: 'muted', feed: false };
    case 'question_revealed':
      return { text: 'Toʻgʻri javob ochildi', tone: 'info', feed: true };
    case 'attack': {
      const dmg = Number(d.damage ?? 0);
      const parts = [`${teamName(ctx, d.from)} zarba berdi: −${dmg} qalqon`];
      if (d.critical) parts.push('KRITIK!');
      if (d.heavy) parts.push('PLAZMA ZARBA');
      if (Number(d.blocked) > 0) parts.push(`(${String(d.blocked)} toʻsildi)`);
      return { text: parts.join(' '), tone: 'danger', feed: true };
    }
    case 'shield_down':
      return {
        text: `${teamName(ctx, d.team_id)} qalqoni nolga tushdi!${d.eliminated ? ' Kema magʻlub.' : ''}`,
        tone: 'danger',
        feed: true,
      };
    case 'question_skipped':
      return { text: 'Savol oʻtkazib yuborildi', tone: 'muted', feed: true };
    case 'question_restarted':
      return { text: 'Savol qayta boshlandi', tone: 'warning', feed: true };
    case 'game_paused':
      return { text: 'Oʻyin pauzada', tone: 'warning', feed: true };
    case 'game_resumed':
      return { text: 'Oʻyin davom etmoqda', tone: 'success', feed: true };
    case 'timer_adjusted': {
      const s = Number(d.seconds ?? 0);
      return { text: `Vaqt ${s > 0 ? '+' : ''}${s} soniya`, tone: 'warning', feed: true };
    }
    case 'score_adjusted': {
      const delta = Number(d.delta ?? 0);
      return {
        text: `${teamName(ctx, e.team_id)}: ${delta > 0 ? '+' : ''}${delta} ball (${String(d.reason ?? '')})`,
        tone: delta > 0 ? 'success' : 'warning',
        feed: true,
      };
    }
    case 'special_event': {
      const kind = d.kind as SpecialEventKind;
      const meta = SPECIAL_EVENTS[kind];
      return { text: `MAXSUS HODISA: ${meta?.title ?? kind} — ${meta?.description ?? ''}`, tone: 'warning', feed: true };
    }
    case 'ability_used': {
      const ab = ABILITIES[d.ability as AbilityType];
      return { text: `${teamName(ctx, e.team_id)}: ${ab?.title ?? String(d.ability)} faollashdi`, tone: 'ability', feed: true };
    }
    case 'ability_requested': {
      const ab = ABILITIES[d.ability as AbilityType];
      return { text: `${String(d.nickname)} ${ab?.title ?? ''} soʻradi`, tone: 'ability', feed: false };
    }
    case 'ability_rejected':
      return { text: 'Qobiliyat soʻrovi rad etildi', tone: 'muted', feed: false };
    case 'game_finished':
      return { text: 'Oʻyin yakunlandi!', tone: 'success', feed: true };
    case 'winner_set':
      return { text: `Gʻolib belgilandi: ${teamName(ctx, d.winner_team_id)}`, tone: 'success', feed: true };
    case 'award_set':
      return { text: `Mukofot: ${String(d.nickname ?? '')}`, tone: 'success', feed: false };
    case 'room_reset':
      return { text: 'Xona qayta tiklandi', tone: 'warning', feed: false };
    case 'registration_closed':
      return { text: 'Roʻyxatdan oʻtish yopildi', tone: 'info', feed: false };
    case 'registration_opened':
      return { text: 'Roʻyxatdan oʻtish ochildi', tone: 'info', feed: false };
    default:
      return { text: e.event_type, tone: 'muted', feed: false };
  }
}
