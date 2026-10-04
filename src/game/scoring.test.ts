import { describe, expect, it } from 'vitest';
import { accuracy, computeAttack, questionPoints, speedPoints, teamQuestionSuccess } from './scoring';
import { computeTimer, formatSeconds } from './timer';
import { instructorActions, lobbyReadiness } from './state';
import type { RoomSnapshot } from './types';

const RULES = {
  damage_per_correct: 1,
  attack_threshold: 100,
  heavy_attack_damage: 8,
  crit_streak: 3,
  crit_multiplier: 1.5,
  final_round_multiplier: 1.5,
  shield_boost_block: 0.6,
};

describe('ball formulasi', () => {
  it('notoʻgʻri javob 0 ball', () => {
    expect(questionPoints({ correct: false, base: 100 })).toBe(0);
  });

  it('oddiy raundda toʻgʻri javob asosiy ballni oladi', () => {
    expect(questionPoints({ correct: true, base: 150 })).toBe(150);
    expect(questionPoints({ correct: true, base: 100, multiplier: 2 })).toBe(200);
  });

  it('tezlik bonusi deterministik va kech javob ham asosiy ballni oladi', () => {
    expect(speedPoints(200, 0.5, 0, 10)).toBe(300);
    expect(speedPoints(200, 0.5, 5000, 10)).toBe(250);
    expect(speedPoints(200, 0.5, 10_000, 10)).toBe(200);
    expect(speedPoints(200, 0.5, 12_000, 10)).toBe(200);
    // tezroq javob hech qachon kamroq ball olmaydi
    let prev = Infinity;
    for (let ms = 0; ms <= 10_000; ms += 250) {
      const p = speedPoints(200, 0.5, ms, 10);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('jang formulasi', () => {
  it('toʻgʻri javob boʻlmasa zarba yoʻq', () => {
    expect(
      computeAttack({ correct: 0, streakAfter: 0, energyAfter: 0, doubleAttack: false, round: 1, opponentShieldBoost: false }, RULES),
    ).toBeNull();
  });

  it('oddiy zarba = toʻgʻri javoblar × zarar', () => {
    const a = computeAttack({ correct: 4, streakAfter: 1, energyAfter: 40, doubleAttack: false, round: 1, opponentShieldBoost: false }, RULES)!;
    expect(a.damage).toBe(4);
    expect(a.critical).toBe(false);
    expect(a.heavy).toBe(false);
  });

  it('energiya chegaraga yetsa plazma zarba qoʻshiladi va energiya sarflanadi', () => {
    const a = computeAttack({ correct: 5, streakAfter: 1, energyAfter: 100, doubleAttack: false, round: 1, opponentShieldBoost: false }, RULES)!;
    expect(a.heavy).toBe(true);
    expect(a.damage).toBe(13);
    expect(a.energySpent).toBe(100);
  });

  it('seriya, final raund va ikki karra zarba koʻpaytiriladi; qalqon kamaytiradi', () => {
    const a = computeAttack({ correct: 2, streakAfter: 3, energyAfter: 0, doubleAttack: true, round: 5, opponentShieldBoost: true }, RULES)!;
    // 2 × 1.5 (kritik) × 1.5 (final) × 2 = 9
    expect(a.rawDamage).toBe(9);
    expect(a.blocked).toBe(6);
    expect(a.damage).toBe(3);
    expect(a.critical).toBe(true);
  });

  it('bitta notoʻgʻri javob jamoani magʻlub qilmaydi: bitta savoldagi maksimal zarar kichik', () => {
    const a = computeAttack({ correct: 5, streakAfter: 1, energyAfter: 50, doubleAttack: false, round: 1, opponentShieldBoost: false }, RULES)!;
    expect(a.damage).toBeLessThan(10);
  });

  it('jamoa seriyasi yarmi toʻgʻri boʻlsa davom etadi', () => {
    expect(teamQuestionSuccess(3, 5)).toBe(true);
    expect(teamQuestionSuccess(2, 5)).toBe(false);
    expect(teamQuestionSuccess(0, 0)).toBe(false);
  });

  it('aniqlik foizi', () => {
    expect(accuracy(7, 10)).toBe(70);
    expect(accuracy(1, 3)).toBe(33.3);
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe('taymer (server muddati asosida)', () => {
  const room = { status: 'active' as const, paused_remaining_ms: null, paused_open_ms: null };
  const t0 = Date.parse('2026-10-04T10:00:00Z');
  const q = {
    status: 'active' as const,
    started_at: new Date(t0).toISOString(),
    answers_open_at: new Date(t0).toISOString(),
    deadline: new Date(t0 + 20_000).toISOString(),
    time_limit: 20,
  };

  it('javob berish bosqichida qolgan vaqtni hisoblaydi', () => {
    const s = computeTimer(room, q, t0 + 5_000);
    expect(s.phase).toBe('answering');
    expect(s.remainingMs).toBe(15_000);
    expect(s.progress).toBeCloseTo(0.75);
  });

  it('muddat oʻtgach expired', () => {
    expect(computeTimer(room, q, t0 + 25_000).phase).toBe('expired');
  });

  it('muhokama bosqichi', () => {
    const qd = { ...q, answers_open_at: new Date(t0 + 30_000).toISOString(), deadline: new Date(t0 + 75_000).toISOString(), time_limit: 45 };
    const s = computeTimer(room, qd, t0 + 10_000);
    expect(s.phase).toBe('discussion');
    expect(s.remainingMs).toBe(20_000);
  });

  it('pauza paytida qolgan vaqt muzlatiladi', () => {
    const s = computeTimer({ status: 'paused', paused_remaining_ms: 7_000, paused_open_ms: 0 }, q, t0 + 999_999);
    expect(s.phase).toBe('paused');
    expect(s.remainingMs).toBe(7_000);
  });

  it('formatlash', () => {
    expect(formatSeconds(9_100)).toBe('10');
    expect(formatSeconds(65_000)).toBe('1:05');
    expect(formatSeconds(-5)).toBe('0');
  });
});

describe('holat mashinasi', () => {
  const base = {
    room: { status: 'lobby', phase: 'lobby', current_round: 0, settings: { team_size: 5, max_players: 10 } },
    teams: [
      { id: 't1', name: 'KOʻK' },
      { id: 't2', name: 'QIZIL' },
    ],
    players: [] as { id: string; team_id: string | null; status: string }[],
    question: null,
    plan: [],
  } as unknown as RoomSnapshot;

  it('lobbi tayyorligi: 5/5 talab qilinadi', () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, team_id: i < 5 ? 't1' : 't2', status: 'approved' }));
    expect(lobbyReadiness({ ...base, players } as unknown as RoomSnapshot).ready).toBe(true);
    const fewer = players.slice(0, 9);
    const r = lobbyReadiness({ ...base, players: fewer } as unknown as RoomSnapshot);
    expect(r.ready).toBe(false);
    expect(r.reasons[0]).toContain('4/5');
  });

  it('faol savol paytida yangi savol boshlab boʻlmaydi', () => {
    const s = {
      ...base,
      room: { ...base.room, status: 'active', phase: 'question', current_round: 1 },
      question: { status: 'active' },
      plan: [{ id: 'g1', question_id: 'q', round_number: 1, status: 'pending' }],
    } as unknown as RoomSnapshot;
    const a = instructorActions(s);
    expect(a.canStartQuestion).toBe(false);
    expect(a.canReveal).toBe(true);
    expect(a.canPause).toBe(true);
  });

  it('savol tugagach keyingisini boshlash mumkin', () => {
    const s = {
      ...base,
      room: { ...base.room, status: 'active', phase: 'reveal', current_round: 1 },
      question: { status: 'revealed' },
      plan: [{ id: 'g2', question_id: 'q', round_number: 1, status: 'pending' }],
    } as unknown as RoomSnapshot;
    const a = instructorActions(s);
    expect(a.canStartQuestion).toBe(true);
    expect(a.nextQuestion?.id).toBe('g2');
    expect(a.canStartNextRound).toBe(true);
  });
});
