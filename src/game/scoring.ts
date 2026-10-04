// Ball va jang formulalari. Haqiqiy hisob-kitob FAQAT serverda bajariladi
// (public._score_question). Bu yerdagi funksiyalar qoidalarni koʻrsatish,
// oldindan baholash va unit testlar uchun server formulasini aynan takrorlaydi.
import type { RoomSettings } from './types';

/**
 * Tezlik bonusi (3-raund): ball = asosiy + floor(asosiy × koeffitsient × qolgan_ulush)
 * qolgan_ulush = max(0, 1 − javob_vaqti / vaqt_limiti)
 * Kech, lekin toʻgʻri javob ham kamida asosiy ballni oladi.
 */
export function speedPoints(base: number, ratio: number, responseMs: number, timeLimitSeconds: number): number {
  const limitMs = Math.max(1, timeLimitSeconds * 1000);
  const remainingShare = Math.max(0, 1 - responseMs / limitMs);
  return base + Math.floor(base * ratio * remainingShare);
}

export function questionPoints(opts: {
  correct: boolean;
  base: number;
  multiplier?: number;
  speedBonus?: boolean;
  ratio?: number;
  responseMs?: number;
  timeLimitSeconds?: number;
}): number {
  if (!opts.correct) return 0;
  const base = Math.round(opts.base * (opts.multiplier ?? 1));
  if (!opts.speedBonus) return base;
  return speedPoints(base, opts.ratio ?? 0.5, opts.responseMs ?? 0, opts.timeLimitSeconds ?? 10);
}

export interface AttackInput {
  correct: number;
  streakAfter: number;
  energyAfter: number;
  doubleAttack: boolean;
  round: number;
  opponentShieldBoost: boolean;
}

export interface AttackOutcome {
  rawDamage: number;
  damage: number;
  blocked: number;
  critical: boolean;
  heavy: boolean;
  doubled: boolean;
  energySpent: number;
}

type BattleRules = Pick<
  RoomSettings,
  | 'damage_per_correct'
  | 'attack_threshold'
  | 'heavy_attack_damage'
  | 'crit_streak'
  | 'crit_multiplier'
  | 'final_round_multiplier'
  | 'shield_boost_block'
>;

/** Server bilan bir xil zarba formulasi */
export function computeAttack(input: AttackInput, rules: BattleRules): AttackOutcome | null {
  if (input.correct <= 0) return null;
  const critical = input.streakAfter >= rules.crit_streak;
  const heavy = input.energyAfter >= rules.attack_threshold;
  let dmg = input.correct * rules.damage_per_correct + (heavy ? rules.heavy_attack_damage : 0);
  if (critical) dmg *= rules.crit_multiplier;
  if (input.round === 5) dmg *= rules.final_round_multiplier;
  if (input.doubleAttack) dmg *= 2;
  const rawDamage = Math.ceil(dmg);
  const blocked = input.opponentShieldBoost ? Math.min(rawDamage, Math.ceil(rawDamage * rules.shield_boost_block)) : 0;
  return {
    rawDamage,
    damage: rawDamage - blocked,
    blocked,
    critical,
    heavy,
    doubled: input.doubleAttack,
    energySpent: heavy ? rules.attack_threshold : 0,
  };
}

/** Jamoa seriyasi: kamida yarmi toʻgʻri javob bersa davom etadi */
export function teamQuestionSuccess(correct: number, members: number): boolean {
  return correct > 0 && correct * 2 >= Math.max(members, 1);
}

export function accuracy(correct: number, possible: number): number {
  if (possible <= 0) return 0;
  return Math.round((1000 * correct) / possible) / 10;
}
