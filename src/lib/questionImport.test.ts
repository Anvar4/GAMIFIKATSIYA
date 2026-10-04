import { describe, expect, it } from 'vitest';
import { TEMPLATE_COLUMNS, jsonToQuestions, parseCsv, questionToRow, rowsToQuestions } from './questionImport';

const header = TEMPLATE_COLUMNS.map((c) => c.header);
const defaults = { subject: 'Informatika', grade: 9 };

function row(values: Partial<Record<string, string | number>>) {
  return TEMPLATE_COLUMNS.map((c) => values[c.key] ?? '');
}

describe('Excel/CSV import', () => {
  it('test savolini harf boʻyicha toʻgʻri javob bilan oʻqiydi', () => {
    const r = rowsToQuestions(
      [header, row({ subject: 'Matematika', grade: 7, category: 'Kasrlar', question_type: 'Test', question_text: '1/2 + 1/4 = ?', a: '3/4', b: '2/6', c: '1/6', d: '2/4', correct: 'A', difficulty: 'oson', round: 1 })],
      defaults,
    );
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({
      subject: 'Matematika',
      grade: 7,
      category: 'Kasrlar',
      question_type: 'single_choice',
      options: ['3/4', '2/6', '1/6', '2/4'],
      correct_answer: 0,
      difficulty: 'easy',
      default_points: 100,
    });
  });

  it('toʻgʻri/notoʻgʻri, qisqa javob va rasmli savollarni tushunadi', () => {
    const r = rowsToQuestions(
      [
        header,
        row({ question_type: 'Toʻgʻri/Notoʻgʻri', question_text: 'Yer Quyosh atrofida aylanadi.', correct: 'Toʻgʻri' }),
        row({ question_type: 'Qisqa javob', question_text: '2 + 2 × 2 = ?', correct: '6; olti' }),
        row({ question_type: 'Rasmli', question_text: 'Rasmda nima?', image_url: 'https://example.com/a.png', a: 'Mushuk', b: 'It', correct: 'b' }),
      ],
      defaults,
    );
    expect(r.errors).toEqual([]);
    expect(r.questions.map((q) => q.question_type)).toEqual(['true_false', 'short_answer', 'image_identification']);
    expect(r.questions[0].correct_answer).toBe(0);
    expect(r.questions[0].options).toEqual(['Toʻgʻri', 'Notoʻgʻri']);
    expect(r.questions[1].correct_answer).toEqual(['6', 'olti']);
    expect(r.questions[2].correct_answer).toBe(1);
    // fan/sinf koʻrsatilmasa standart qiymat olinadi
    expect(r.questions[0].subject).toBe('Informatika');
    expect(r.questions[0].grade).toBe(9);
  });

  it('xatolarni qator raqami bilan qaytaradi va boʻsh qatorlarni oʻtkazib yuboradi', () => {
    const r = rowsToQuestions(
      [
        header,
        row({ question_text: 'Variantsiz savol?', correct: 'A' }),
        row({}),
        row({ question_text: 'Notoʻgʻri javob harfi', a: '1', b: '2', correct: 'D' }),
        row({ question_type: 'Rasmli', question_text: 'Rasm yoʻq', a: '1', b: '2', correct: 'A' }),
      ],
      defaults,
    );
    expect(r.questions).toHaveLength(0);
    expect(r.skipped).toBe(1);
    expect(r.errors.map((e) => e.row)).toEqual([2, 4, 5]);
  });

  it('sarlavha kichik farqlar bilan ham tanib olinadi', () => {
    const r = rowsToQuestions(
      [
        ['Savol', 'A', 'B', 'Javob', 'Mavzu'],
        ['Poytaxt?', 'Toshkent', 'Samarqand', 'a', 'Geografiya'],
      ],
      defaults,
    );
    expect(r.errors).toEqual([]);
    expect(r.questions[0].category).toBe('Geografiya');
  });

  it('CSV (nuqta-vergul, qoʻshtirnoq) tahlili', () => {
    const rows = parseCsv('﻿Savol matni;A variant;B variant;Toʻgʻri javob\r\n"Salom; dunyo?";"Ha ""rost""";Yoʻq;A\r\n');
    expect(rows[1]).toEqual(['Salom; dunyo?', 'Ha "rost"', 'Yoʻq', 'A']);
    const r = rowsToQuestions(rows, defaults);
    expect(r.questions[0].options[0]).toBe('Ha "rost"');
  });

  it('eksport → import aylanishi maʼlumotni saqlaydi', () => {
    const original = rowsToQuestions(
      [header, row({ subject: 'Fizika', grade: 8, category: 'Kuch', question_type: 'Test', question_text: 'Kuch birligi?', a: 'Nyuton', b: 'Joul', c: 'Vatt', d: 'Paskal', correct: 'A', explanation: 'SI', hint: 'N', difficulty: 'qiyin', round: 4, points: 250, time: 40 })],
      defaults,
    ).questions[0];
    const { _row, ...q } = original;
    void _row;
    const again = rowsToQuestions([header, questionToRow(q)], defaults).questions[0];
    expect({ ...again, _row: 0 }).toEqual({ ...original, _row: 0 });
  });

  it('JSON import', () => {
    const r = jsonToQuestions(
      [{ question_text: 'JSON savol?', question_type: 'single_choice', options: ['x', 'y', 'z'], correct_answer: 2, category: 'Mavzu' }],
      defaults,
    );
    expect(r.errors).toEqual([]);
    expect(r.questions[0].correct_answer).toBe(2);
  });

  it('moslashtirish savolini “Chap = Oʻng” kataklaridan oʻqiydi va qayta eksport qiladi', () => {
    const r = rowsToQuestions(
      [
        header,
        row({
          category: 'Qurilmalar',
          question_type: 'Moslashtirish',
          question_text: 'Qurilmalarni turiga moslang',
          a: 'Klaviatura = Kiritish',
          b: 'Monitor → Chiqarish',
          c: 'SSD = Saqlash',
          d: 'Mikrofon = Kiritish',
          round: 4,
        }),
      ],
      defaults,
    );
    expect(r.errors).toEqual([]);
    const q = r.questions[0];
    expect(q.question_type).toBe('matching');
    expect(q.options).toEqual(['Klaviatura', 'Monitor', 'SSD', 'Mikrofon']);
    expect(q.correct_answer).toEqual(['Kiritish', 'Chiqarish', 'Saqlash', 'Kiritish']);
    const { _row, ...plain } = q;
    void _row;
    const again = rowsToQuestions([header, questionToRow(plain)], defaults).questions[0];
    expect(again.options).toEqual(q.options);
    expect(again.correct_answer).toEqual(q.correct_answer);
  });

  it('koʻp bosqichli zanjirni “Matn || variant | variant” kataklaridan oʻqiydi', () => {
    const r = rowsToQuestions(
      [
        header,
        row({
          category: 'Nosozliklar',
          question_type: 'Koʻp bosqichli',
          question_text: 'Nosozlikni toping',
          a: 'Monitor qorongʻi. Nima tekshiriladi? || Kabel | Protsessor | BIOS',
          b: 'Kabel joyida. Keyingisi? || Klaviatura | Port',
          correct: 'A, B',
          round: 4,
        }),
      ],
      defaults,
    );
    expect(r.errors).toEqual([]);
    const q = r.questions[0];
    expect(q.question_type).toBe('multi_step');
    expect(q.options).toEqual([
      { text: 'Monitor qorongʻi. Nima tekshiriladi?', options: ['Kabel', 'Protsessor', 'BIOS'] },
      { text: 'Kabel joyida. Keyingisi?', options: ['Klaviatura', 'Port'] },
    ]);
    expect(q.correct_answer).toEqual([0, 1]);
    const { _row, ...plain } = q;
    void _row;
    const again = rowsToQuestions([header, questionToRow(plain)], defaults).questions[0];
    expect(again.options).toEqual(q.options);
    expect(again.correct_answer).toEqual(q.correct_answer);
  });

  it('notoʻgʻri moslashtirish va zanjir kataklari tushunarli xato beradi', () => {
    const r = rowsToQuestions(
      [
        header,
        row({ category: 'X', question_type: 'Moslashtirish', question_text: 'Juftlik yoʻq', a: 'Klaviatura', b: 'Monitor = Chiqarish' }),
        row({ category: 'X', question_type: 'Koʻp bosqichli', question_text: 'Javob soni mos emas', a: '1-qadam || a | b', b: '2-qadam || a | b', correct: 'A' }),
      ],
      defaults,
    );
    expect(r.questions).toHaveLength(0);
    expect(r.errors[0].message).toMatch(/Chap = Oʻng/);
    expect(r.errors[1].message).toMatch(/har bir qadam/);
  });

  it('JSON import yangi savol turlarini qabul qiladi', () => {
    const r = jsonToQuestions(
      [
        { question_text: 'Moslang', question_type: 'matching', options: ['HDD', 'DVD'], correct_answer: ['Magnit', 'Optik'], category: 'Saqlash' },
        {
          question_text: 'Zanjir',
          question_type: 'multi_step',
          options: [
            { text: 'Birinchi qadam', options: ['x', 'y'] },
            { text: 'Ikkinchi qadam', options: ['p', 'q', 'r'] },
          ],
          correct_answer: [1, 2],
          category: 'Mantiq',
        },
      ],
      defaults,
    );
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({ question_type: 'matching', options: ['HDD', 'DVD'], correct_answer: ['Magnit', 'Optik'] });
    expect(r.questions[1]).toMatchObject({ question_type: 'multi_step', correct_answer: [1, 2] });
  });
});
