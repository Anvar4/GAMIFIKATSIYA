// Excel shabloni va tayyor bank fayli import kodi bilan toʻgʻri oʻqilishini tekshiradi
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import readXlsxFile from 'read-excel-file/node';
import { rowsToQuestions } from '../src/lib/questionImport';

const dir = join(__dirname, '..', 'public', 'templates');
const defaults = { subject: 'Informatika', grade: 9 };

async function load(name: string) {
  const sheets = await readXlsxFile(readFileSync(join(dir, name)));
  const sheet = sheets.find((s) => s.sheet === 'Savollar')!;
  return rowsToQuestions(sheet.data as unknown[][], defaults);
}

describe('Excel shabloni', () => {
  it('namuna qatorlari xatosiz import qilinadi (turli fan va sinflar)', async () => {
    const r = await load('IT_ARENA_savollar_shabloni.xlsx');
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(8);
    expect(new Set(r.questions.map((q) => q.subject)).size).toBeGreaterThanOrEqual(5);
    expect(r.questions.map((q) => q.question_type)).toEqual([
      'single_choice',
      'single_choice',
      'true_false',
      'short_answer',
      'image_identification',
      'logical_puzzle',
      'matching',
      'multi_step',
    ]);
    expect(r.questions[3].correct_answer).toEqual(['Nyuton', 'N']);
    expect(r.questions[6].correct_answer).toEqual(['Magnit', 'Optik (lazer)', 'Flesh-xotira', 'Magnit']);
    expect(r.questions[7].correct_answer).toEqual([0, 1, 1]);
  });

  it('Informatika 9-sinf banki toʻliq import qilinadi', async () => {
    const r = await load('Informatika_9-sinf_savollar_banki.xlsx');
    const bank = JSON.parse(readFileSync(join(__dirname, '..', 'supabase', 'seed', 'question_bank.json'), 'utf8'));
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(bank.length);
    r.questions.forEach((q, i) => {
      expect(q.question_text).toBe(bank[i].question_text);
      expect(q.correct_answer).toEqual(bank[i].correct_answer);
      expect(q.options).toEqual(bank[i].options);
    });
  });
});
