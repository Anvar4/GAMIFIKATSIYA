// Muhim maʼlumotlar bazasi funksiyalari uchun integratsion testlar:
// xona yaratish, roʻyxatdan oʻtish, RLS, javob berish, ball, jang, qobiliyatlar, natijalar.
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

interface Room { id: string; room_code: string; status: string; settings: Record<string, unknown> }
interface Team { id: string; slot: number; score: number; shield: number; energy: number; streak: number; shield_boost_active: boolean }
interface Snapshot {
  role: string;
  room: { status: string; phase: string; current_round: number; current_game_question_id: string | null };
  teams: Team[];
  players: { id: string; nickname: string; team_id: string; status: string; score: number }[];
  question: null | {
    id: string; status: string; options: string[]; question_type: string;
    correct_answer: unknown; explanation: string | null; secret?: { correct_answer: unknown };
    deadline: string; answer_count: number; round_number: number;
  };
  answered_player_ids: string[];
  my_answer: null | { selected_answer: string; is_correct: boolean | null; awarded_points: number | null };
  answers: unknown[];
  plan: { round_number: number; status: string; id: string; total?: number }[];
  results: null | { winner_team_id: string | null; awards: Record<string, unknown>; statistics: { players: unknown[] } };
}

let t: TestDb;
let teacher: string;
let otherTeacher: string;
let room: Room;
const students: { uid: string; playerId: string; nickname: string }[] = [];

async function snapshot(uid: string) {
  return t.rpc<Snapshot>(uid, 'get_room_snapshot', [room.id]);
}

async function correctIndex(): Promise<number> {
  const s = await snapshot(teacher);
  return Number(s.question!.secret!.correct_answer);
}

function wrongIndex(correct: number, optionsLength: number) {
  return (correct + 1) % optionsLength;
}

async function expectError(p: Promise<unknown>, pattern: RegExp) {
  await expect(p).rejects.toThrow(pattern);
}

beforeAll(async () => {
  t = await createTestDb();
  teacher = await t.createUser({ instructor: true, name: 'Ustoz' });
  otherTeacher = await t.createUser({ instructor: true, name: 'Boshqa ustoz' });
}, 60_000);

describe('savollar banki va seed', () => {
  it('kamida 60 ta savol yuklangan va barcha 5 raund qamrab olingan', async () => {
    const rows = await t.sql<{ n: number; rounds: number }>(
      `select count(*)::int as n, count(distinct recommended_round)::int as rounds from public.questions`,
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(60);
    expect(rows[0].rounds).toBe(5);
  });

  it('notoʻgʻri tuzilgan savolni trigger rad etadi', async () => {
    await expectError(
      t.as(teacher, `insert into public.questions (category, question_type, question_text, options, correct_answer)
                     values ('Test', 'single_choice', 'Savol?', '["A","B"]', '5')`),
      /oraligʻidan tashqarida/,
    );
  });

  it('oʻquvchi savollar jadvalini (toʻgʻri javoblarni) koʻra olmaydi', async () => {
    const s = await t.createUser();
    const rows = await t.as(s, `select * from public.questions`);
    expect(rows).toHaveLength(0);
  });
});

describe('xona yaratish', () => {
  it('oʻquvchi xona yarata olmaydi', async () => {
    const s = await t.createUser();
    await expectError(t.rpc(s, 'create_room', ['X', null]), /Faqat oʻqituvchi/);
  });

  it('oʻqituvchi takrorlanmas 6 belgili kodli xona yaratadi', async () => {
    room = await t.rpc<Room>(teacher, 'create_room', ['9-S sinf jangi', null]);
    expect(room.room_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room.status).toBe('lobby');

    const codes = new Set<string>([room.room_code]);
    for (let i = 0; i < 15; i++) {
      const r = await t.rpc<Room>(otherTeacher, 'create_room', [null, null]);
      codes.add(r.room_code);
    }
    expect(codes.size).toBe(16);
  });

  it('ikki jamoa, qobiliyatlar va 5 raundlik reja yaratiladi', async () => {
    const s = await snapshot(teacher);
    expect(s.teams).toHaveLength(2);
    expect(s.teams.every((x) => x.shield === 100 && x.score === 0)).toBe(true);
    const perRound = [1, 2, 3, 4, 5].map((r) => s.plan.filter((p) => p.round_number === r).length);
    expect(perRound).toEqual([5, 4, 5, 4, 3]);
  });

  it('fan/sinf/mavzu filtri bilan xona faqat mos savollarni oladi', async () => {
    const r = await t.rpc<Room>(teacher, 'create_room', [
      'Filtr testi',
      { subject: 'Informatika', grade: 9, categories: ['Operatsion tizimlar'] },
    ]);
    const s = await t.rpc<Snapshot>(teacher, 'get_room_snapshot', [r.id]);
    const cats = new Set((s.plan as unknown as { category: string }[]).map((p) => p.category));
    expect([...cats]).toEqual(['Operatsion tizimlar']);
  });

  it('boshqa oʻqituvchi bu xonani boshqara olmaydi', async () => {
    await expectError(t.rpc(otherTeacher, 'start_game', [room.id, true]), /huquqingiz yoʻq/);
    await expectError(t.rpc(otherTeacher, 'get_room_snapshot', [room.id]), /huquqingiz yoʻq/);
  });
});

describe('roʻyxatdan oʻtish', () => {
  it('10 ta oʻquvchi qoʻshiladi, takroriy taxallus va 11-oʻquvchi rad etiladi', async () => {
    for (let i = 1; i <= 10; i++) {
      const uid = await t.createUser();
      const nickname = `Oʻquvchi ${i}`;
      const res = await t.rpc<{ player: { id: string; status: string } }>(uid, 'join_room', [room.room_code, nickname, null]);
      expect(res.player.status).toBe('pending');
      students.push({ uid, playerId: res.player.id, nickname });
    }
    const dup = await t.createUser();
    await expectError(t.rpc(dup, 'join_room', [room.room_code, 'oʻquvchi 1', null]), /Xona toʻla|taxallus band/);

    const eleventh = await t.createUser();
    await expectError(t.rpc(eleventh, 'join_room', [room.room_code, 'Ortiqcha', null]), /Xona toʻla/);
  });

  it('bir xil foydalanuvchi qayta qoʻshilsa, mavjud sessiya qaytariladi', async () => {
    const res = await t.rpc<{ reconnected: boolean; player: { id: string } }>(
      students[0].uid, 'join_room', [room.room_code, 'Boshqa ism', null]);
    expect(res.reconnected).toBe(true);
    expect(res.player.id).toBe(students[0].playerId);
  });

  it('notoʻgʻri kod bilan qoʻshilib boʻlmaydi', async () => {
    const u = await t.createUser();
    await expectError(t.rpc(u, 'join_room', ['ZZZZZZ', 'Ali', null]), /topilmadi/);
  });

  it('tasdiqlashdan oldin oʻyinni boshlab boʻlmaydi', async () => {
    await expectError(t.rpc(teacher, 'start_game', [room.id, false]), /Kamida bitta tasdiqlangan|aynan 5 ta/);
  });

  it('hammasini tasdiqlash jamoalarni 5/5 taqsimlaydi', async () => {
    const n = await t.rpc<number>(teacher, 'approve_all_players', [room.id]);
    expect(n).toBe(10);
    const s = await snapshot(teacher);
    const counts = s.teams.map((tm) => s.players.filter((p) => p.team_id === tm.id && p.status === 'approved').length);
    expect(counts).toEqual([5, 5]);
  });

  it('oʻquvchi toʻgʻridan-toʻgʻri jadvalga yoza olmaydi', async () => {
    await expectError(
      t.as(students[0].uid, `update public.teams set score = 99999`),
      /permission denied/,
    );
    await expectError(
      t.as(students[0].uid, `insert into public.answers (room_id, game_question_id, player_id, selected_answer) values ($1, $1, $1, '0')`, [room.id]),
      /permission denied/,
    );
  });

  it('oʻquvchi oʻyinni boshqara olmaydi', async () => {
    await expectError(t.rpc(students[0].uid, 'start_game', [room.id, true]), /huquqingiz yoʻq/);
  });
});

describe('oʻyin jarayoni', () => {
  it('oʻyin boshlanadi', async () => {
    const res = await t.rpc<{ ok: boolean; players: number }>(teacher, 'start_game', [room.id, false]);
    expect(res.players).toBe(10);
    const s = await snapshot(teacher);
    expect(s.room.status).toBe('active');
    expect(s.room.current_round).toBe(1);
  });

  it('oʻquvchi boshlanmagan savollarni koʻra olmaydi', async () => {
    const rows = await t.as(students[0].uid, `select * from public.game_questions`);
    expect(rows).toHaveLength(0);
  });

  it('savol boshlanadi; oʻquvchiga toʻgʻri javob yuborilmaydi', async () => {
    await t.rpc(teacher, 'start_question', [room.id, null, null]);
    const s = await snapshot(students[0].uid);
    expect(s.role).toBe('student');
    expect(s.question?.status).toBe('active');
    expect(s.question?.correct_answer).toBeNull();
    expect(s.question?.explanation).toBeNull();
    expect(s.question).not.toHaveProperty('secret');
    expect(s.answers).toEqual([]);
    const raw = await t.as<{ correct_answer: unknown }>(students[0].uid, `select correct_answer from public.game_questions`);
    expect(raw[0].correct_answer).toBeNull();
  });

  it('javoblar qabul qilinadi, takroriy javob hisobga olinmaydi, hamma javob bergach savol avtomatik yopiladi', async () => {
    const correct = await correctIndex();
    const before = await snapshot(teacher);
    const opts = before.question!.options.length;
    const team1 = before.teams[0].id;

    // 1-jamoa: 5 tadan 4 tasi toʻgʻri; 2-jamoa: 5 tadan 1 tasi toʻgʻri
    const plan = students.map((st) => {
      const p = before.players.find((x) => x.id === st.playerId)!;
      return { ...st, team: p.team_id };
    });
    let t1 = 0;
    let t2 = 0;
    for (const st of plan) {
      let answer: number;
      if (st.team === team1) answer = t1++ < 4 ? correct : wrongIndex(correct, opts);
      else answer = t2++ < 1 ? correct : wrongIndex(correct, opts);
      const res = await t.rpc<{ accepted: boolean }>(st.uid, 'submit_answer', [before.question!.id, String(answer)]);
      expect(res.accepted).toBe(true);
      if (st === plan[0]) {
        const again = await t.rpc<{ accepted: boolean; duplicate: boolean }>(st.uid, 'submit_answer', [before.question!.id, String(answer)]);
        expect(again.duplicate).toBe(true);
        // javob ochilmaguncha toʻgʻriligi oʻquvchiga koʻrsatilmaydi
        const mine = await snapshot(st.uid);
        expect(mine.my_answer?.is_correct).toBeNull();
      }
    }

    const after = await snapshot(teacher);
    expect(after.question?.status).toBe('revealed');
    expect(after.room.phase).toBe('reveal');
    const tm1 = after.teams.find((x) => x.id === team1)!;
    const tm2 = after.teams.find((x) => x.id !== team1)!;
    expect(tm1.score).toBe(400);
    expect(tm2.score).toBe(100);
    expect(tm1.energy).toBe(40);
    expect(tm2.energy).toBe(10);
    expect(tm1.streak).toBe(1);
    expect(tm2.streak).toBe(0);
    // zarbalar: 1-jamoa 4 ta toʻgʻri × 1 = 4; 2-jamoa 1 × 1 = 1
    expect(tm2.shield).toBe(96);
    expect(tm1.shield).toBe(99);

    const studentView = await snapshot(students[0].uid);
    expect(studentView.question?.correct_answer).not.toBeNull();
    expect(typeof studentView.my_answer?.is_correct).toBe('boolean');

    const events = await t.sql<{ event_type: string }>(
      `select event_type from public.game_events where room_id = $1 and event_type in ('attack','question_revealed')`, [room.id]);
    expect(events.filter((e) => e.event_type === 'attack')).toHaveLength(2);
  });

  it('qayta yuborilgan javob ochilgandan keyin ham ballni oʻzgartirmaydi', async () => {
    const s = await snapshot(teacher);
    const r = await t.rpc<{ accepted: boolean; duplicate: boolean }>(students[1].uid, 'submit_answer', [s.question!.id, '0']);
    expect(r.accepted).toBe(false);
    expect(r.duplicate).toBe(true);
    const after = await snapshot(teacher);
    expect(after.teams.map((x) => x.score)).toEqual(s.teams.map((x) => x.score));
  });

  it('vaqt tugamaguncha oʻquvchi savolni yopa olmaydi; tugagach yopa oladi', async () => {
    const started = await t.rpc<{ game_question_id: string }>(teacher, 'start_question', [room.id, null, null]);
    const gq = started.game_question_id;
    await t.rpc(students[0].uid, 'submit_answer', [gq, '0']);
    await t.rpc(students[5].uid, 'submit_answer', [gq, '1']);

    const early = await t.rpc<{ finalized: boolean; reason: string }>(students[2].uid, 'finalize_question', [gq, false]);
    expect(early.finalized).toBe(false);
    expect(early.reason).toBe('running');

    await expectError(t.rpc(students[2].uid, 'finalize_question', [gq, true]), /faqat oʻqituvchiga/);

    await t.sql(`update public.game_questions set deadline = now() - interval '5 seconds' where id = $1`, [gq]);
    await expectError(t.rpc(students[3].uid, 'submit_answer', [gq, '0']), /Vaqt tugadi/);

    const done = await t.rpc<{ finalized: boolean }>(students[2].uid, 'finalize_question', [gq, false]);
    expect(done.finalized).toBe(true);
    const again = await t.rpc<{ finalized: boolean }>(teacher, 'finalize_question', [gq, true]);
    expect(again.finalized).toBe(false); // idempotent
  });

  it('pauza paytida javob qabul qilinmaydi, davom ettirilganda muddat suriladi', async () => {
    const started = await t.rpc<{ game_question_id: string; deadline: string }>(teacher, 'start_question', [room.id, null, null]);
    await t.rpc(teacher, 'pause_game', [room.id]);
    await expectError(t.rpc(students[0].uid, 'submit_answer', [started.game_question_id, '0']), /pauzada/);
    // savol 40 soniya oldin ochilgan va pauza 30 soniya davom etgandek
    await t.sql(`update public.game_questions set answers_open_at = now() - interval '40 seconds' where id = $1`, [started.game_question_id]);
    await t.sql(`update public.game_rooms set paused_at = now() - interval '30 seconds' where id = $1`, [room.id]);
    await t.rpc(teacher, 'resume_game', [room.id]);
    const rows = await t.sql<{ diff: number }>(
      `select extract(epoch from (deadline - $2::timestamptz))::int as diff from public.game_questions where id = $1`,
      [started.game_question_id, started.deadline]);
    expect(rows[0].diff).toBeGreaterThanOrEqual(29);
    const res = await t.rpc<{ accepted: boolean }>(students[0].uid, 'submit_answer', [started.game_question_id, '0']);
    expect(res.accepted).toBe(true);
    await t.rpc(teacher, 'finalize_question', [started.game_question_id, true]);
  });

  it('qobiliyatlar: energiya yetmasa rad etiladi; qalqon zarbani kamaytiradi', async () => {
    let s = await snapshot(teacher);
    const [a, b] = s.teams;
    await t.sql(`update public.teams set energy = 0 where id = $1`, [b.id]);
    await expectError(t.rpc(teacher, 'use_ability', [room.id, b.id, 'shield_boost']), /Energiya yetarli emas/);

    await t.rpc(teacher, 'trigger_special_event', [room.id, 'energy_surge']);
    await t.rpc(teacher, 'trigger_special_event', [room.id, 'energy_surge']);
    await t.rpc(teacher, 'use_ability', [room.id, b.id, 'shield_boost']);
    s = await snapshot(teacher);
    expect(s.teams.find((x) => x.id === b.id)!.shield_boost_active).toBe(true);
    await expectError(t.rpc(teacher, 'use_ability', [room.id, b.id, 'shield_boost']), /allaqachon faol|qayta zaryadlanmoqda/);

    // A jamoasi zarba beradi
    const started = await t.rpc<{ game_question_id: string }>(teacher, 'start_question', [room.id, null, null]);
    const correct = await correctIndex();
    const shieldBefore = (await snapshot(teacher)).teams.find((x) => x.id === b.id)!.shield;
    for (const st of students) {
      const p = s.players.find((x) => x.id === st.playerId)!;
      if (p.team_id === a.id) await t.rpc(st.uid, 'submit_answer', [started.game_question_id, String(correct)]);
    }
    await t.rpc(teacher, 'finalize_question', [started.game_question_id, true]);
    const atk = await t.sql<{ event_data: { blocked: number; raw_damage: number; damage: number } }>(
      `select event_data from public.game_events where room_id = $1 and event_type = 'attack' and team_id = $2 order by seq desc limit 1`,
      [room.id, a.id]);
    expect(atk[0].event_data.blocked).toBeGreaterThan(0);
    expect(atk[0].event_data.damage).toBeLessThan(atk[0].event_data.raw_damage);
    const after = (await snapshot(teacher)).teams.find((x) => x.id === b.id)!;
    expect(after.shield).toBe(shieldBefore - atk[0].event_data.damage);
    expect(after.shield_boost_active).toBe(false);
  });

  it('tezlik raundida tezroq toʻgʻri javob qoʻshimcha ball oladi (deterministik formula)', async () => {
    await t.rpc(teacher, 'start_round', [room.id, 3]);
    const started = await t.rpc<{ game_question_id: string }>(teacher, 'start_question', [room.id, null, null]);
    const correct = await correctIndex();
    await t.rpc(students[0].uid, 'submit_answer', [started.game_question_id, String(correct)]);
    // ikkinchi javob 5 soniya keyin berilgandek
    await t.sql(`update public.game_questions set answers_open_at = answers_open_at - interval '5 seconds' where id = $1`,
      [started.game_question_id]);
    await t.rpc(students[1].uid, 'submit_answer', [started.game_question_id, String(correct)]);
    await t.rpc(teacher, 'finalize_question', [started.game_question_id, true]);
    const rows = await t.sql<{ player_id: string; awarded_points: number; response_ms: number }>(
      `select player_id, awarded_points, response_ms from public.answers where game_question_id = $1 order by submitted_at`,
      [started.game_question_id]);
    const fast = rows.find((r) => r.player_id === students[0].playerId)!;
    const slow = rows.find((r) => r.player_id === students[1].playerId)!;
    expect(fast.awarded_points).toBeGreaterThan(slow.awarded_points);
    expect(slow.awarded_points).toBeGreaterThanOrEqual(200);
    expect(fast.awarded_points).toBeLessThanOrEqual(300);
    // formula: 200 + floor(200 * 0.5 * (1 - ms/10000))
    expect(slow.awarded_points).toBe(200 + Math.floor(200 * 0.5 * Math.max(0, 1 - slow.response_ms / 10000)));
  });

  it('ballni qoʻlda tuzatish audit yozuvi bilan saqlanadi', async () => {
    const s = await snapshot(teacher);
    const team = s.teams[0];
    await expectError(t.rpc(teacher, 'adjust_score', [room.id, team.id, null, 50, '']), /Sababni yozing/);
    await t.rpc(teacher, 'adjust_score', [room.id, team.id, null, -50, 'Notoʻgʻri berilgan ball tuzatildi']);
    const after = await snapshot(teacher);
    expect(after.teams[0].score).toBe(team.score - 50);
    const audit = await t.sql(`select * from public.score_adjustments where room_id = $1`, [room.id]);
    expect(audit).toHaveLength(1);
    const studentAudit = await t.as(students[0].uid, `select * from public.score_adjustments`);
    expect(studentAudit).toHaveLength(0);
  });

  it('oʻyin yakunlanadi, natijalar va mukofotlar hisoblanadi', async () => {
    const res = await t.rpc<{ winner_team_id: string | null; awards: Record<string, { nickname: string } | null> }>(
      teacher, 'end_game', [room.id, null]);
    expect(res.awards.galactic_champion?.nickname).toBeTruthy();
    const s = await snapshot(students[3].uid);
    expect(s.room.status).toBe('finished');
    expect(s.results?.statistics.players.length).toBe(10);

    await t.rpc(teacher, 'set_award', [room.id, 'team_player', students[4].playerId]);
    const s2 = await snapshot(teacher);
    expect((s2.results!.awards.team_player as { player_id: string }).player_id).toBe(students[4].playerId);
  });

  it('xonani qayta tiklash (reset) holatni lobbiga qaytaradi, oʻquvchilar saqlanadi', async () => {
    await t.rpc(teacher, 'reset_room', [room.id]);
    const s = await snapshot(teacher);
    expect(s.room.status).toBe('lobby');
    expect(s.teams.every((x) => x.score === 0 && x.shield === 100)).toBe(true);
    expect(s.players.filter((p) => p.status === 'approved')).toHaveLength(10);
    expect(s.plan.every((p) => p.status === 'pending')).toBe(true);
  });
});
