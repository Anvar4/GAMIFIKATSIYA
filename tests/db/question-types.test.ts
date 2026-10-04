// "Moslashtirish" va "Koʻp bosqichli" savol turlari uchun integratsion testlar:
// sir saqlanishi, qadamlarni oʻtkazib yuborishning oldini olish, qisman ball va zanjir bonusi.
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

interface Snapshot {
  role: string;
  room: { status: string; phase: string; current_game_question_id: string | null };
  question: null | {
    id: string;
    status: string;
    question_type: string;
    options: unknown;
    input_spec: { kind: string; choices?: string[]; steps?: number } | null;
    correct_answer: unknown;
    steps: unknown;
    secret?: { correct_answer: unknown };
  };
  my_answer: null | { selected_answer: string; is_correct: boolean | null; awarded_points: number | null; credit: number | null };
  my_steps: null | {
    total: number;
    finished: boolean;
    done: { index: number; selected: number; correct: boolean }[];
    current: null | { index: number; text: string; options: string[] };
  };
  step_progress: { player_id: string; done: number; correct: number }[];
  answers: { player_id: string; is_correct: boolean | null; awarded_points: number; credit: number | null }[];
}

let t: TestDb;
let teacher: string;
let roomId: string;
let matchingId: string;
let multiId: string;
const students: { uid: string; playerId: string }[] = [];

const LEFT = ['Klaviatura', 'Monitor', 'SSD', 'Mikrofon'];
const RIGHT = ['Kiritish', 'Chiqarish', 'Saqlash', 'Kiritish'];
const STEPS = [
  { text: 'Monitor qorongʻi, kompyuter esa ishlayapti. Birinchi nimani tekshirasiz?', options: ['Kabel va quvvat', 'Protsessor', 'BIOS parol'] },
  { text: 'Kabel joyida, ekranda “Signal yoʻq”. Keyingi qadam?', options: ['Klaviaturani almashtirish', 'Kabel ulangan portni tekshirish'] },
  { text: 'Kabel boshqa portga ulandi va tasvir chiqdi. Muammo nimada edi?', options: ['Notoʻgʻri port', 'Viruslar', 'Sichqoncha', 'Printer'] },
];
const STEP_ANSWERS = [0, 1, 0];

async function snap(uid: string) {
  return t.rpc<Snapshot>(uid, 'get_room_snapshot', [roomId]);
}

beforeAll(async () => {
  t = await createTestDb();
  teacher = await t.createUser({ instructor: true, name: 'Ustoz' });
  // xona avval yaratiladi: avtomatik reja yangi savollarni boshqa raundga olib qoʻymasligi uchun
  const room = await t.rpc<{ id: string; room_code: string }>(teacher, 'create_room', ['Savol turlari testi']);
  roomId = room.id;

  const [m] = await t.as<{ id: string }>(
    teacher,
    `insert into public.questions (category, question_type, question_text, options, correct_answer, explanation, recommended_round)
     values ('Kiritish qurilmalari', 'matching', 'Qurilmalarni vazifasiga moslang', $1::jsonb, $2::jsonb, 'Qurilmalar turlari', 4)
     returning id`,
    [JSON.stringify(LEFT), JSON.stringify(RIGHT)],
  );
  matchingId = m.id;
  const [ms] = await t.as<{ id: string }>(
    teacher,
    `insert into public.questions (category, question_type, question_text, options, correct_answer, explanation, recommended_round)
     values ('Chiqarish qurilmalari', 'multi_step', 'Nosozlikni bosqichma-bosqich toping', $1::jsonb, $2::jsonb, 'Avval eng oddiy sabab tekshiriladi', 4)
     returning id`,
    [JSON.stringify(STEPS), JSON.stringify(STEP_ANSWERS)],
  );
  multiId = ms.id;

  await t.rpc(teacher, 'update_room_settings', [roomId, JSON.stringify({ team_size: 2, max_players: 4 })]);
  for (let i = 0; i < 4; i++) {
    const uid = await t.createUser();
    const res = await t.rpc<{ player: { id: string } }>(uid, 'join_room', [room.room_code, `Oʻquvchi ${i + 1}`, null]);
    students.push({ uid, playerId: res.player.id });
  }
  await t.rpc(teacher, 'approve_all_players', [roomId]);
  await t.rpc(teacher, 'set_round_questions', [roomId, 1, `{${matchingId},${multiId}}`, 100, 60]);
  await t.rpc(teacher, 'start_game', [roomId, false]);
}, 60_000);

describe('savol tuzilmasi tekshiruvi', () => {
  it('notoʻgʻri moslashtirish va zanjir savollari rad etiladi', async () => {
    await expect(
      t.as(teacher, `insert into public.questions (category, question_type, question_text, options, correct_answer)
                     values ('X', 'matching', 'Juftliklar soni mos emas', '["A","B"]', '["1"]')`),
    ).rejects.toThrow(/mos javob/);
    await expect(
      t.as(teacher, `insert into public.questions (category, question_type, question_text, options, correct_answer)
                     values ('X', 'multi_step', 'Indeks chegaradan tashqarida', '[{"text":"1-qadam","options":["a","b"]},{"text":"2-qadam","options":["a","b"]}]', '[0, 5]')`),
    ).rejects.toThrow(/2-qadam/);
  });
});

describe('moslashtirish (matching)', () => {
  let gq: string;
  let choices: string[];
  const answerFor = (correctPairs: number) =>
    JSON.stringify(RIGHT.map((r, i) => (i < correctPairs ? choices.indexOf(r) : choices.findIndex((c) => c !== r))));

  it('oʻquvchi chap ustun va aralashtirilgan tanlovlarni oladi, toʻgʻri juftliklarni emas', async () => {
    const started = await t.rpc<{ game_question_id: string }>(teacher, 'start_question', [roomId, null, 0]);
    gq = started.game_question_id;
    const s = await snap(students[0].uid);
    expect(s.question!.question_type).toBe('matching');
    expect(s.question!.options).toEqual(LEFT);
    choices = s.question!.input_spec!.choices!;
    expect([...choices].sort()).toEqual(['Chiqarish', 'Kiritish', 'Saqlash']);
    expect(s.question!.correct_answer).toBeNull();
    expect(s.question!.secret).toBeUndefined();
  });

  it('notoʻgʻri formatdagi javoblar rad etiladi', async () => {
    await expect(t.rpc(students[2].uid, 'submit_answer', [gq, 'salom'])).rejects.toThrow(/format/);
    await expect(t.rpc(students[2].uid, 'submit_answer', [gq, '[0,1]'])).rejects.toThrow(/Har bir element/);
    await expect(t.rpc(students[2].uid, 'submit_answer', [gq, '[0,1,2,9]'])).rejects.toThrow(/notoʻgʻri/);
  });

  it('toʻliq toʻgʻri moslash toʻliq ball, yarmi — yarim ball oladi', async () => {
    await t.rpc(students[0].uid, 'submit_answer', [gq, answerFor(4)]);
    await t.rpc(students[1].uid, 'submit_answer', [gq, answerFor(2)]);
    await t.rpc(teacher, 'finalize_question', [gq, true]);

    const owner = await snap(teacher);
    const byPlayer = new Map(owner.answers.map((a) => [a.player_id, a]));
    expect(byPlayer.get(students[0].playerId)).toMatchObject({ is_correct: true, awarded_points: 100 });
    expect(Number(byPlayer.get(students[0].playerId)!.credit)).toBe(1);
    expect(byPlayer.get(students[1].playerId)).toMatchObject({ is_correct: false, awarded_points: 50 });
    expect(Number(byPlayer.get(students[1].playerId)!.credit)).toBe(0.5);

    const s = await snap(students[1].uid);
    expect(s.question!.correct_answer).toEqual(RIGHT);
    expect(s.my_answer).toMatchObject({ is_correct: false, awarded_points: 50 });
  });
});

describe('koʻp bosqichli zanjir (multi_step)', () => {
  let gq: string;

  it('oʻquvchiga faqat joriy qadam beriladi; qadamlar va javoblar yashirin', async () => {
    const started = await t.rpc<{ game_question_id: string }>(teacher, 'start_question', [roomId, null, 0]);
    gq = started.game_question_id;
    const s = await snap(students[0].uid);
    expect(s.question!.question_type).toBe('multi_step');
    expect(s.question!.options).toBeNull();
    expect(s.question!.steps).toBeNull();
    expect(s.question!.input_spec).toEqual({ kind: 'multi_step', steps: 3 });
    expect(s.my_steps).toMatchObject({ total: 3, finished: false, done: [], current: { index: 0, text: STEPS[0].text, options: STEPS[0].options } });

    const owner = await snap(teacher);
    expect(owner.question!.steps).toEqual(STEPS);
    expect(owner.question!.secret!.correct_answer).toEqual(STEP_ANSWERS);
  });

  it('qadamni oʻtkazib yuborib boʻlmaydi va bitta javob savoli kabi yuborib boʻlmaydi', async () => {
    await expect(t.rpc(students[0].uid, 'submit_step', [gq, 1, '1'])).rejects.toThrow(/1-qadamni bajaring/);
    await expect(t.rpc(students[0].uid, 'submit_answer', [gq, '0'])).rejects.toThrow(/qadamma-qadam/);
    await expect(t.rpc(students[0].uid, 'submit_step', [gq, 0, '7'])).rejects.toThrow(/variant/);
  });

  it('toʻgʻri qadam keyingi qadamni ochadi; qayta yuborish rad etiladi', async () => {
    const r1 = await t.rpc<{ correct: boolean; finished: boolean; next: { index: number; text: string } }>(students[0].uid, 'submit_step', [gq, 0, '0']);
    expect(r1).toMatchObject({ correct: true, finished: false, next: { index: 1, text: STEPS[1].text } });
    await expect(t.rpc(students[0].uid, 'submit_step', [gq, 0, '0'])).rejects.toThrow(/2-qadamni bajaring/);
    await t.rpc(students[0].uid, 'submit_step', [gq, 1, '1']);
    const r3 = await t.rpc<{ correct: boolean; finished: boolean; next: unknown }>(students[0].uid, 'submit_step', [gq, 2, '0']);
    expect(r3).toMatchObject({ correct: true, finished: true, next: null });
    const s = await snap(students[0].uid);
    expect(s.my_steps).toMatchObject({ finished: true, current: null });
  });

  it('xato qadam zanjirni yakunlaydi', async () => {
    await t.rpc(students[1].uid, 'submit_step', [gq, 0, '0']);
    const r = await t.rpc<{ correct: boolean; finished: boolean }>(students[1].uid, 'submit_step', [gq, 1, '0']);
    expect(r).toMatchObject({ correct: false, finished: true });
    const again = await t.rpc<{ accepted: boolean; duplicate: boolean }>(students[1].uid, 'submit_step', [gq, 2, '0']);
    expect(again).toMatchObject({ accepted: false, duplicate: true });
  });

  it('oʻquvchi faqat oʻz qadamlarini koʻradi va jadvalga yoza olmaydi', async () => {
    const own = await t.as<{ player_id: string }>(students[0].uid, 'select player_id from public.answer_steps');
    expect(own.length).toBe(3);
    expect(new Set(own.map((r) => r.player_id))).toEqual(new Set([students[0].playerId]));
    await expect(
      t.as(students[2].uid, `insert into public.answer_steps (room_id, game_question_id, player_id, step_index, selected_answer, is_correct)
                              values ($1, $2, $3, 0, 0, true)`, [roomId, gq, students[2].playerId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('ochilganda: toʻliq zanjir bonus bilan, tugallanmagan zanjir qisman ball oladi', async () => {
    await t.rpc(students[2].uid, 'submit_step', [gq, 0, '0']); // 1/3 qadam, vaqt tugaydi
    const owner1 = await snap(teacher);
    expect(owner1.step_progress.find((p) => p.player_id === students[2].playerId)).toMatchObject({ done: 1, correct: 1 });

    await t.rpc(teacher, 'finalize_question', [gq, true]);
    const owner = await snap(teacher);
    const byPlayer = new Map(owner.answers.map((a) => [a.player_id, a]));
    expect(byPlayer.get(students[0].playerId)).toMatchObject({ is_correct: true, awarded_points: 150 }); // 100 + 50 bonus
    expect(byPlayer.get(students[1].playerId)).toMatchObject({ is_correct: false, awarded_points: 33 });
    expect(byPlayer.get(students[2].playerId)).toMatchObject({ is_correct: false, awarded_points: 33 });
    expect(byPlayer.has(students[3].playerId)).toBe(false);

    const s = await snap(students[2].uid);
    expect(s.question!.steps).toEqual(STEPS);
    expect(s.question!.correct_answer).toEqual(STEP_ANSWERS);
    expect(s.my_answer).toMatchObject({ awarded_points: 33 });
  });

  it('xonani qayta tiklash qadamlarni tozalaydi', async () => {
    await t.rpc(teacher, 'end_game', [roomId, null]);
    await t.rpc(teacher, 'reset_room', [roomId]);
    const rows = await t.sql<{ n: number }>(`select count(*)::int as n from public.answer_steps where room_id = $1`, [roomId]);
    expect(rows[0].n).toBe(0);
  });
});
