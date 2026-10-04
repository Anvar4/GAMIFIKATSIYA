// Savollar bankidan supabase/seed.sql va supabase/seed/question_bank.json yaratadi.
// Ishga tushirish: npm run seed:sql
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_BANK } from './question-bank.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SUBJECT = 'Informatika';
const GRADE = 9;

const TOPICS = {
  devices_software: 'Kompyuter qurilmalari va dasturiy taʼminot',
  system_components: 'Kompyuter tizimining asosiy komponentlari',
  operating_systems: 'Operatsion tizimlar',
  computer_types: 'Kompyuter turlari',
  new_technologies: 'Yangi texnologiyalarning taʼsiri',
  input_devices: 'Kiritish qurilmalari',
  direct_entry: 'Maʼlumotlarni bevosita kiritish qurilmalari',
  output_devices: 'Chiqarish qurilmalari',
  storage_devices: 'Saqlash qurilmalari va maʼlumot almashish',
  storage_pros_cons: 'Saqlash qurilmalarining afzallik va kamchiliklari',
};

const ROUND_DEFAULTS = {
  1: { points: 100, time: 20 },
  2: { points: 150, time: 25 },
  3: { points: 200, time: 10 },
  4: { points: 250, time: 40 },
  5: { points: 300, time: 45 },
};

// Deterministik PRNG (mulberry32) — har safar bir xil natija
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithCorrect(options, seed) {
  const rand = mulberry32(seed * 7919 + 17);
  const idx = options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { options: idx.map((i) => options[i]), correct: idx.indexOf(0) };
}

export function buildQuestions() {
  const seen = new Set();
  return QUESTION_BANK.map((item, i) => {
    if (!TOPICS[item.c]) throw new Error(`Nomaʼlum kategoriya: ${item.c}`);
    const key = `${item.q}|${item.img ?? ''}`;
    if (seen.has(key)) throw new Error(`Takroriy savol: ${item.q}`);
    seen.add(key);
    const defaults = ROUND_DEFAULTS[item.r];
    let options = [];
    let correct;
    if (item.t === 'true_false') {
      options = ['Toʻgʻri', 'Notoʻgʻri'];
      correct = item.a ? 0 : 1;
    } else if (item.t === 'short_answer') {
      options = [];
      correct = item.a;
      if (!Array.isArray(correct) || correct.length === 0) throw new Error(`Qisqa javob kerak: ${item.q}`);
    } else {
      if (!Array.isArray(item.o) || item.o.length < 2) throw new Error(`Variantlar yetarli emas: ${item.q}`);
      const s = shuffleWithCorrect(item.o, i + 1);
      options = s.options;
      correct = s.correct;
    }
    return {
      subject: SUBJECT,
      grade: GRADE,
      category: TOPICS[item.c],
      difficulty: item.d,
      question_type: item.t,
      question_text: item.q,
      options,
      correct_answer: correct,
      explanation: item.e ?? '',
      hint: item.h ?? '',
      image_url: item.img ? `/assets/devices/${item.img}.webp` : null,
      default_points: defaults.points,
      default_time_limit: defaults.time,
      recommended_round: item.r,
    };
  });
}

const sql = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

function toSql(questions) {
  const lines = [
    '-- AVTOMATIK YARATILGAN FAYL — tahrirlamang. Manba: scripts/question-bank.mjs',
    '-- Yaratish: npm run seed:sql',
    `-- Savollar soni: ${questions.length}`,
    '',
  ];
  for (const q of questions) {
    lines.push(
      'insert into public.questions (subject, grade, category, difficulty, question_type, question_text, options, correct_answer, explanation, hint, image_url, default_points, default_time_limit, recommended_round)',
      `select ${sql(q.subject)}, ${q.grade}, ${sql(q.category)}, ${sql(q.difficulty)}, ${sql(q.question_type)}, ${sql(q.question_text)}, ${sql(JSON.stringify(q.options))}::jsonb, ${sql(JSON.stringify(q.correct_answer))}::jsonb, ${sql(q.explanation)}, ${sql(q.hint)}, ${sql(q.image_url)}, ${q.default_points}, ${q.default_time_limit}, ${q.recommended_round}`,
      `where not exists (select 1 from public.questions where question_text = ${sql(q.question_text)} and image_url is not distinct from ${sql(q.image_url)});`,
      '',
    );
  }
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const questions = buildQuestions();
  writeFileSync(join(root, 'supabase', 'seed.sql'), toSql(questions), 'utf8');
  mkdirSync(join(root, 'supabase', 'seed'), { recursive: true });
  writeFileSync(join(root, 'supabase', 'seed', 'question_bank.json'), JSON.stringify(questions, null, 2) + '\n', 'utf8');

  const byRound = {};
  const byTopic = {};
  const answerPos = [0, 0, 0, 0];
  for (const q of questions) {
    byRound[q.recommended_round] = (byRound[q.recommended_round] ?? 0) + 1;
    byTopic[q.category] = (byTopic[q.category] ?? 0) + 1;
    if (typeof q.correct_answer === 'number' && q.options.length === 4) answerPos[q.correct_answer]++;
  }
  console.log(`✔ ${questions.length} ta savol yozildi`);
  console.log('Raundlar:', byRound);
  console.log('Mavzular:', byTopic);
  console.log('Toʻgʻri javob joylashuvi (A,B,C,D):', answerPos);
}
