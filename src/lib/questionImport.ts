// Savollarni Excel (.xlsx), CSV va JSON fayllaridan import/eksport qilish.
// Shablon ustunlari public/templates/IT_ARENA_savollar_shabloni.xlsx bilan bir xil.
import type { Difficulty, QuestionInput, QuestionRecord, QuestionType } from '../game/types';

export const TEMPLATE_COLUMNS = [
  { key: 'subject', header: 'Fan', width: 14 },
  { key: 'grade', header: 'Sinf', width: 7 },
  { key: 'category', header: 'Mavzu', width: 30 },
  { key: 'question_type', header: 'Savol turi', width: 22 },
  { key: 'question_text', header: 'Savol matni', width: 60 },
  { key: 'a', header: 'A variant', width: 26 },
  { key: 'b', header: 'B variant', width: 26 },
  { key: 'c', header: 'C variant', width: 26 },
  { key: 'd', header: 'D variant', width: 26 },
  { key: 'correct', header: 'Toʻgʻri javob', width: 16 },
  { key: 'explanation', header: 'Izoh', width: 44 },
  { key: 'hint', header: 'Maslahat', width: 30 },
  { key: 'image_url', header: 'Rasm havolasi', width: 30 },
  { key: 'difficulty', header: 'Qiyinlik', width: 10 },
  { key: 'round', header: 'Raund', width: 8 },
  { key: 'points', header: 'Ball', width: 8 },
  { key: 'time', header: 'Vaqt (soniya)', width: 12 },
] as const;

type ColumnKey = (typeof TEMPLATE_COLUMNS)[number]['key'];

export const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Test',
  true_false: 'Toʻgʻri/Notoʻgʻri',
  image_identification: 'Rasmli',
  short_answer: 'Qisqa javob',
  logical_puzzle: 'Mantiqiy',
  matching: 'Moslashtirish',
  multi_step: 'Koʻp bosqichli',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'oson', medium: 'oʻrta', hard: 'qiyin' };

const ROUND_DEFAULTS: Record<number, { points: number; time: number }> = {
  1: { points: 100, time: 20 },
  2: { points: 150, time: 25 },
  3: { points: 200, time: 10 },
  4: { points: 250, time: 40 },
  5: { points: 300, time: 45 },
};

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  subject: ['fan', 'subject', 'predmet'],
  grade: ['sinf', 'grade', 'class', 'klass'],
  category: ['mavzu', 'topic', 'category', 'kategoriya', 'bolim'],
  question_type: ['savolturi', 'tur', 'type', 'questiontype'],
  question_text: ['savolmatni', 'savol', 'question', 'questiontext', 'matn'],
  a: ['avariant', 'a', 'variant1', 'option1', 'optiona'],
  b: ['bvariant', 'b', 'variant2', 'option2', 'optionb'],
  c: ['cvariant', 'c', 'variant3', 'option3', 'optionc'],
  d: ['dvariant', 'd', 'variant4', 'option4', 'optiond'],
  correct: ['togrijavob', 'javob', 'correct', 'answer', 'correctanswer', 'togri'],
  explanation: ['izoh', 'explanation', 'tushuntirish'],
  hint: ['maslahat', 'hint', 'yordam'],
  image_url: ['rasmhavolasi', 'rasm', 'image', 'imageurl', 'rasmurl', 'havola'],
  difficulty: ['qiyinlik', 'difficulty', 'daraja'],
  round: ['raund', 'round', 'tavsiyaetilganraund'],
  points: ['ball', 'points', 'score'],
  time: ['vaqtsoniya', 'vaqt', 'time', 'timelimit', 'soniya'],
};

/** Taqqoslash uchun: kichik harf, apostrof va boʻshliqlarsiz */
export function norm(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[ʻʼ'`‘’´]/g, '')
    .replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
}

export function parseQuestionType(raw: string, hasImage: boolean, options: string[]): QuestionType | null {
  const n = norm(raw);
  if (!n) {
    if (hasImage) return 'image_identification';
    if (options.length === 0) return null;
    return 'single_choice';
  }
  if (/notogri|truefalse|^tf$|hayoq|rostyolgon/.test(n) || n === 'truefalse') return 'true_false';
  if (/rasm|image|picture/.test(n)) return 'image_identification';
  if (/qisqa|short|qulf|kod|code|ochiq/.test(n)) return 'short_answer';
  if (/mantiq|logic|puzzle/.test(n)) return 'logical_puzzle';
  if (/test|single|bitta|choice|variant/.test(n)) return 'single_choice';
  if (/moslash|matching/.test(n)) return 'matching';
  if (/bosqich|multi/.test(n)) return 'multi_step';
  if (n === 'singlechoice') return 'single_choice';
  return null;
}

export function parseDifficulty(raw: string): Difficulty {
  const n = norm(raw);
  if (/^(oson|easy|yengil|1)$/.test(n)) return 'easy';
  if (/^(qiyin|hard|murakkab|3)$/.test(n)) return 'hard';
  return 'medium';
}

function parseIntInRange(raw: string, min: number, max: number): number | null {
  const m = raw.match(/\d+/);
  if (!m) return null;
  const v = Number(m[0]);
  return v >= min && v <= max ? v : null;
}

function parseChoiceIndex(raw: string, options: string[]): number | null {
  const n = norm(raw);
  if (!n) return null;
  const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
  if (letters.includes(n)) return letters.indexOf(n);
  // kirill harflari: А, Б, В, Г
  const cyr = ['а', 'б', 'в', 'г'];
  if (cyr.includes(n)) return cyr.indexOf(n);
  if (/^[1-6]$/.test(n)) return Number(n) - 1;
  const byText = options.findIndex((o) => norm(o) === n);
  return byText >= 0 ? byText : null;
}

function parseTrueFalse(raw: string): number | null {
  const n = norm(raw);
  if (/^(togri|true|ha|rost|a|1|yes|t)$/.test(n)) return 0;
  if (/^(notogri|false|yoq|yolgon|b|0|2|no|f)$/.test(n)) return 1;
  return null;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  questions: (QuestionInput & { _row: number })[];
  errors: ImportRowError[];
  skipped: number;
}

export interface ImportDefaults {
  subject: string;
  grade: number | null;
}

/** Sarlavha qatorini topib, har bir ustun indeksini aniqlaydi */
function mapHeader(row: unknown[]): Partial<Record<ColumnKey, number>> | null {
  const map: Partial<Record<ColumnKey, number>> = {};
  row.forEach((cell, idx) => {
    const n = norm(cell);
    if (!n) return;
    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
      if (map[key] === undefined && aliases.includes(n)) {
        map[key] = idx;
        break;
      }
    }
  });
  return map.question_text !== undefined ? map : null;
}

/** Excel/CSV qatorlarini (birinchi sarlavha qatori bilan) savollarga aylantirish */
export function rowsToQuestions(rows: unknown[][], defaults: ImportDefaults): ImportResult {
  const result: ImportResult = { questions: [], errors: [], skipped: 0 };
  let headerIndex = -1;
  let map: Partial<Record<ColumnKey, number>> | null = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    map = mapHeader(rows[i] ?? []);
    if (map) {
      headerIndex = i;
      break;
    }
  }
  if (!map) {
    result.errors.push({ row: 1, message: 'Sarlavha qatori topilmadi. “Savol matni” ustuni boʻlishi shart (shablondan foydalaning).' });
    return result;
  }

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const excelRow = i + 1;
    const get = (k: ColumnKey) => (map![k] !== undefined ? cellText(row[map![k]!]) : '');
    if (row.every((c) => cellText(c) === '')) {
      result.skipped++;
      continue;
    }
    try {
      result.questions.push({ ...buildQuestion(get, defaults), _row: excelRow });
    } catch (e) {
      result.errors.push({ row: excelRow, message: (e as Error).message });
    }
  }
  return result;
}

function buildQuestion(get: (k: ColumnKey) => string, defaults: ImportDefaults): QuestionInput {
  const text = get('question_text');
  if (text.length < 3) throw new Error('Savol matni juda qisqa yoki boʻsh');
  if (text.length > 600) throw new Error('Savol matni 600 belgidan oshmasligi kerak');

  const rawOptions = (['a', 'b', 'c', 'd'] as const).map((k) => get(k));
  // boʻsh variantlar oxiridan olib tashlanadi; oʻrtadagi boʻsh variant xato
  let last = rawOptions.length - 1;
  while (last >= 0 && rawOptions[last] === '') last--;
  const options = rawOptions.slice(0, last + 1);
  if (options.some((o) => o === '')) throw new Error('Variantlar orasida boʻsh variant bor (A, B, C, D ketma-ket toʻldirilsin)');

  const image = get('image_url');
  if (image && !/^(https:\/\/|\/)/.test(image)) throw new Error('Rasm havolasi https:// yoki / bilan boshlanishi kerak');

  const type = parseQuestionType(get('question_type'), Boolean(image), options);
  if (!type) throw new Error(`Savol turi tushunarsiz: “${get('question_type')}”`);
  if (type === 'image_identification' && !image) throw new Error('Rasmli savol uchun “Rasm havolasi” kerak');

  const correctRaw = get('correct');
  if (!correctRaw) throw new Error('“Toʻgʻri javob” ustuni boʻsh');

  let finalOptions: string[] = options;
  let correct: number | string[];
  if (type === 'true_false') {
    finalOptions = ['Toʻgʻri', 'Notoʻgʻri'];
    const idx = parseTrueFalse(correctRaw);
    if (idx === null) throw new Error('Toʻgʻri/Notoʻgʻri savolida javob “Toʻgʻri” yoki “Notoʻgʻri” boʻlishi kerak');
    correct = idx;
  } else if (type === 'short_answer') {
    finalOptions = [];
    const accepted = correctRaw
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (accepted.length === 0) throw new Error('Qisqa javob uchun kamida bitta javob kerak');
    correct = accepted;
  } else {
    if (options.length < 2) throw new Error('Kamida 2 ta variant (A va B) kerak');
    const idx = parseChoiceIndex(correctRaw, options);
    if (idx === null || idx >= options.length) {
      throw new Error(`Toʻgʻri javob “${correctRaw}” notoʻgʻri — A, B, C yoki D yozing`);
    }
    correct = idx;
  }
  if (finalOptions.some((o) => o.length > 200)) throw new Error('Variant matni 200 belgidan oshmasligi kerak');

  const round = parseIntInRange(get('round'), 1, 5);
  const defaultsForRound = ROUND_DEFAULTS[round ?? 1];
  const pointsRaw = parseIntInRange(get('points'), 0, 2000);
  const timeRaw = parseIntInRange(get('time'), 5, 300);
  const gradeRaw = get('grade');
  const grade = gradeRaw ? parseIntInRange(gradeRaw, 1, 11) : defaults.grade;
  if (gradeRaw && grade === null) throw new Error('Sinf 1 dan 11 gacha boʻlishi kerak');

  const subject = (get('subject') || defaults.subject || 'Umumiy').slice(0, 60);
  const category = (get('category') || 'Umumiy').slice(0, 80);

  return {
    subject,
    grade,
    category,
    difficulty: parseDifficulty(get('difficulty')),
    question_type: type,
    question_text: text,
    options: finalOptions,
    correct_answer: correct,
    explanation: get('explanation').slice(0, 800),
    hint: get('hint').slice(0, 300),
    image_url: image || null,
    default_points: pointsRaw ?? defaultsForRound.points,
    default_time_limit: timeRaw ?? defaultsForRound.time,
    recommended_round: round,
    is_active: true,
  };
}

/** JSON import: [{ question_text, options, correct_answer, ... }] */
export function jsonToQuestions(data: unknown, defaults: ImportDefaults): ImportResult {
  const result: ImportResult = { questions: [], errors: [], skipped: 0 };
  const list = Array.isArray(data) ? data : Array.isArray((data as { questions?: unknown[] })?.questions) ? (data as { questions: unknown[] }).questions : null;
  if (!list) {
    result.errors.push({ row: 0, message: 'JSON fayl savollar massivi boʻlishi kerak' });
    return result;
  }
  list.forEach((item, i) => {
    const q = item as Partial<QuestionRecord>;
    try {
      const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : [];
      const letters = ['A', 'B', 'C', 'D'];
      let correct = '';
      if (q.question_type === 'short_answer') correct = (Array.isArray(q.correct_answer) ? q.correct_answer : [String(q.correct_answer ?? '')]).join(';');
      else if (q.question_type === 'true_false') correct = Number(q.correct_answer) === 0 ? 'Toʻgʻri' : 'Notoʻgʻri';
      else correct = letters[Number(q.correct_answer)] ?? String(q.correct_answer ?? '');
      const values: Record<ColumnKey, string> = {
        subject: String(q.subject ?? ''),
        grade: q.grade ? String(q.grade) : '',
        category: String(q.category ?? ''),
        question_type: q.question_type ? TYPE_LABELS[q.question_type as QuestionType] ?? String(q.question_type) : '',
        question_text: String(q.question_text ?? ''),
        a: q.question_type === 'true_false' ? '' : options[0] ?? '',
        b: q.question_type === 'true_false' ? '' : options[1] ?? '',
        c: q.question_type === 'true_false' ? '' : options[2] ?? '',
        d: q.question_type === 'true_false' ? '' : options[3] ?? '',
        correct,
        explanation: String(q.explanation ?? ''),
        hint: String(q.hint ?? ''),
        image_url: String(q.image_url ?? ''),
        difficulty: String(q.difficulty ?? ''),
        round: q.recommended_round ? String(q.recommended_round) : '',
        points: q.default_points !== undefined ? String(q.default_points) : '',
        time: q.default_time_limit !== undefined ? String(q.default_time_limit) : '',
      };
      result.questions.push({ ...buildQuestion((k) => values[k].trim(), defaults), _row: i + 1 });
    } catch (e) {
      result.errors.push({ row: i + 1, message: (e as Error).message });
    }
  });
  return result;
}

/** Oddiy CSV tahlilchisi (qoʻshtirnoq, vergul yoki nuqta-vergul ajratuvchi) */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Savolni shablon qatoriga aylantirish (Excel/CSV eksport uchun) */
export function questionToRow(q: QuestionInput): string[] {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const isTf = q.question_type === 'true_false';
  const options = isTf ? [] : q.options;
  let correct = '';
  if (q.question_type === 'short_answer') correct = (q.correct_answer as string[]).join('; ');
  else if (isTf) correct = Number(q.correct_answer) === 0 ? 'Toʻgʻri' : 'Notoʻgʻri';
  else correct = letters[Number(q.correct_answer)] ?? '';
  return [
    q.subject,
    q.grade ? String(q.grade) : '',
    q.category,
    TYPE_LABELS[q.question_type],
    q.question_text,
    options[0] ?? '',
    options[1] ?? '',
    options[2] ?? '',
    options[3] ?? '',
    correct,
    q.explanation,
    q.hint,
    q.image_url ?? '',
    DIFFICULTY_LABELS[q.difficulty],
    q.recommended_round ? String(q.recommended_round) : '',
    String(q.default_points),
    String(q.default_time_limit),
  ];
}

export async function readQuestionFile(file: File, defaults: ImportDefaults): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const data = JSON.parse(await file.text());
    return jsonToQuestions(data, defaults);
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return rowsToQuestions(parseCsv(await file.text()), defaults);
  }
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    const preferred = sheets.find((s) => norm(s.sheet) === 'savollar') ?? sheets.find((s) => s.data.length > 1) ?? sheets[0];
    if (!preferred) return { questions: [], errors: [{ row: 0, message: 'Excel faylida varaq topilmadi' }], skipped: 0 };
    return rowsToQuestions(preferred.data as unknown[][], defaults);
  }
  if (name.endsWith('.xls')) {
    return { questions: [], errors: [{ row: 0, message: 'Eski .xls format qoʻllab-quvvatlanmaydi. Faylni Excelda .xlsx sifatida saqlang.' }], skipped: 0 };
  }
  return { questions: [], errors: [{ row: 0, message: 'Faqat .xlsx, .csv yoki .json fayllar qabul qilinadi' }], skipped: 0 };
}

export async function exportQuestionsXlsx(questions: QuestionInput[], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = TEMPLATE_COLUMNS.map((c) => ({
    value: c.header,
    fontWeight: 'bold' as const,
    backgroundColor: '#0E1B2D',
    textColor: '#3EE7FF',
  }));
  const body = questions.map((q) => questionToRow(q).map((value) => ({ value, wrap: true })));
  await writeXlsxFile([header, ...body], {
    sheet: 'Savollar',
    columns: TEMPLATE_COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(fileName);
}
