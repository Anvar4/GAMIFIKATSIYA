import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { Modal, Spinner } from '../../components/ui/Basics';
import { OPTION_LETTERS, QuestionImage } from '../../components/game/QuestionCard';
import { DIFFICULTIES, QUESTION_TYPES, GRADES, DEFAULT_SUBJECTS, roundMeta } from '../../game/constants';
import type { Difficulty, QuestionInput, QuestionRecord, QuestionType } from '../../game/types';
import { matchingPairs, stepItems, stringOptions } from '../../game/questionShape';
import { getInstructorClient } from '../../lib/supabase';
import { uploadQuestionImage } from '../../services/questions';
import { errorMessage } from '../../lib/errors';

const ROUND_DEFAULTS: Record<number, { points: number; time: number }> = {
  1: { points: 100, time: 20 },
  2: { points: 150, time: 25 },
  3: { points: 200, time: 10 },
  4: { points: 250, time: 40 },
  5: { points: 300, time: 45 },
};

export function emptyQuestion(defaults?: Partial<QuestionInput>): QuestionInput {
  return {
    subject: 'Informatika',
    grade: null,
    category: '',
    difficulty: 'medium',
    question_type: 'single_choice',
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: 0,
    explanation: '',
    hint: '',
    image_url: null,
    default_points: 100,
    default_time_limit: 20,
    recommended_round: 1,
    is_active: true,
    ...defaults,
  };
}

export function validateQuestion(q: QuestionInput): string | null {
  if (q.question_text.trim().length < 3) return 'Savol matnini kiriting';
  if (!q.category.trim()) return 'Mavzuni kiriting';
  if (!q.subject.trim()) return 'Fanni kiriting';
  if (q.question_type === 'short_answer') {
    if (!Array.isArray(q.correct_answer) || q.correct_answer.filter((a) => String(a).trim()).length === 0) return 'Kamida bitta toʻgʻri javob kiriting';
  } else if (q.question_type === 'matching') {
    const pairs = matchingPairs(q.options, q.correct_answer);
    if (pairs.length < 2 || pairs.length > 4) return 'Moslashtirish uchun 2 dan 4 gacha juftlik kiriting';
    if (pairs.some((p) => !p.left.trim() || !p.right.trim())) return 'Barcha juftliklarni toʻliq toʻldiring';
    if (new Set(pairs.map((p) => p.right.trim().toLowerCase())).size < 2) return 'Oʻng ustunda kamida 2 xil javob boʻlsin';
  } else if (q.question_type === 'multi_step') {
    const steps = stepItems(q.options);
    const answers = Array.isArray(q.correct_answer) ? q.correct_answer.map(Number) : [];
    if (steps.length < 2 || steps.length > 4) return 'Zanjirda 2 dan 4 gacha qadam boʻlsin';
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].text.trim().length < 2) return `${i + 1}-qadam matnini kiriting`;
      const opts = steps[i].options.map((o) => o.trim());
      if (opts.length < 2 || opts.length > 4 || opts.some((o) => !o)) return `${i + 1}-qadam variantlarini toʻldiring (2–4 ta)`;
      if (!(answers[i] >= 0 && answers[i] < opts.length)) return `${i + 1}-qadamning toʻgʻri javobini belgilang`;
    }
  } else {
    const opts = stringOptions(q.options).map((o) => o.trim());
    if (opts.length < 2 || opts.some((o) => !o)) return 'Barcha variantlarni toʻldiring (kamida 2 ta)';
    if (typeof q.correct_answer !== 'number' || q.correct_answer < 0 || q.correct_answer >= opts.length) return 'Toʻgʻri javobni belgilang';
  }
  if (q.question_type === 'image_identification' && !q.image_url) return 'Rasmli savol uchun rasm kerak';
  if (q.image_url && !/^(https:\/\/|\/)/.test(q.image_url)) return 'Rasm havolasi https:// yoki / bilan boshlanishi kerak';
  return null;
}

interface EditorStep {
  text: string;
  options: string[];
  correct: number;
}

const EMPTY_PAIRS = () => [
  { left: '', right: '' },
  { left: '', right: '' },
  { left: '', right: '' },
];
const EMPTY_STEPS = (): EditorStep[] => [
  { text: '', options: ['', '', ''], correct: 0 },
  { text: '', options: ['', '', ''], correct: 0 },
];

export function QuestionEditor({
  open,
  initial,
  categories,
  subjects,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: QuestionRecord | QuestionInput | null;
  categories: string[];
  subjects: string[];
  onClose: () => void;
  onSave: (q: QuestionInput) => Promise<void>;
}) {
  const [q, setQ] = useState<QuestionInput>(emptyQuestion());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // turga xos tahrirlash holati (saqlashda options/correct_answer ga aylantiriladi)
  const [pairs, setPairs] = useState(EMPTY_PAIRS);
  const [steps, setSteps] = useState<EditorStep[]>(EMPTY_STEPS);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const { subject, grade, category, difficulty, question_type, question_text, options, correct_answer, explanation, hint, image_url, default_points, default_time_limit, recommended_round, is_active } =
        initial as QuestionInput;
      setQ({
        subject,
        grade,
        category,
        difficulty,
        question_type,
        question_text,
        options: question_type === 'short_answer' || question_type === 'matching' || question_type === 'multi_step' ? [] : [...stringOptions(options)],
        correct_answer: Array.isArray(correct_answer) ? ([...correct_answer] as string[]) : correct_answer,
        explanation,
        hint,
        image_url,
        default_points,
        default_time_limit,
        recommended_round,
        is_active,
      });
      const mp = question_type === 'matching' ? matchingPairs(options, correct_answer) : [];
      setPairs(mp.length >= 2 ? mp : EMPTY_PAIRS());
      const st = question_type === 'multi_step' ? stepItems(options) : [];
      const answers = Array.isArray(correct_answer) ? correct_answer.map(Number) : [];
      setSteps(st.length >= 2 ? st.map((x, i) => ({ text: x.text, options: [...x.options], correct: answers[i] ?? 0 })) : EMPTY_STEPS());
    } else {
      setQ(emptyQuestion());
      setPairs(EMPTY_PAIRS());
      setSteps(EMPTY_STEPS());
    }
    setError(null);
  }, [open, initial]);

  const set = <K extends keyof QuestionInput>(k: K, v: QuestionInput[K]) => setQ((p) => ({ ...p, [k]: v }));

  const changeType = (t: QuestionType) => {
    setQ((p) => {
      if (t === 'true_false') return { ...p, question_type: t, options: ['Toʻgʻri', 'Notoʻgʻri'], correct_answer: 0 };
      if (t === 'short_answer') return { ...p, question_type: t, options: [], correct_answer: [''] };
      if (t === 'matching' || t === 'multi_step') return { ...p, question_type: t, options: [], correct_answer: [] };
      const prev = stringOptions(p.options);
      const options = p.question_type === 'true_false' || prev.length < 2 ? ['', '', '', ''] : prev;
      return { ...p, question_type: t, options, correct_answer: typeof p.correct_answer === 'number' ? Math.min(p.correct_answer, options.length - 1) : 0 };
    });
  };

  const changeRound = (r: number | null) => {
    setQ((p) => ({
      ...p,
      recommended_round: r,
      default_points: r ? ROUND_DEFAULTS[r].points : p.default_points,
      default_time_limit: r ? ROUND_DEFAULTS[r].time : p.default_time_limit,
    }));
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadQuestionImage(getInstructorClient(), file);
      set('image_url', url);
    } catch (e) {
      setError(`Rasm yuklanmadi: ${errorMessage(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    let options: QuestionInput['options'] = stringOptions(q.options).map((o) => o.trim());
    let correct: QuestionInput['correct_answer'] = q.correct_answer;
    if (q.question_type === 'short_answer') {
      options = [];
      correct = (Array.isArray(q.correct_answer) ? q.correct_answer : []).map((a) => String(a).trim()).filter(Boolean);
    } else if (q.question_type === 'matching') {
      options = pairs.map((p) => p.left.trim());
      correct = pairs.map((p) => p.right.trim());
    } else if (q.question_type === 'multi_step') {
      options = steps.map((st) => ({ text: st.text.trim(), options: st.options.map((o) => o.trim()) }));
      correct = steps.map((st) => st.correct);
    }
    const clean: QuestionInput = {
      ...q,
      question_text: q.question_text.trim(),
      subject: q.subject.trim(),
      category: q.category.trim(),
      options,
      correct_answer: correct,
      image_url: q.image_url?.trim() || null,
    };
    const v = validateQuestion(clean);
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    try {
      await onSave(clean);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isChoice = !['short_answer', 'matching', 'multi_step'].includes(q.question_type);
  const accepted = Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : [];
  const choiceOptions = stringOptions(q.options);

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial && 'id' in initial ? 'Savolni tahrirlash' : 'Yangi savol'}
      footer={
        <>
          {error && <p className="mr-auto self-center text-sm text-arena-red" role="alert">{error}</p>}
          <button className="btn btn-ghost" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || uploading}>
            {saving && <Spinner className="h-4 w-4" />} Saqlash
          </button>
        </>
      }
    >
      <datalist id="cat-list">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="subj-list">
        {[...new Set([...subjects, ...DEFAULT_SUBJECTS])].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className="label">Fan</label>
          <input className="input" list="subj-list" value={q.subject} maxLength={60} onChange={(e) => set('subject', e.target.value)} />
        </div>
        <div>
          <label className="label">Sinf</label>
          <select className="input" value={q.grade ?? ''} onChange={(e) => set('grade', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Barcha sinflar</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}-sinf
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Mavzu</label>
          <input className="input" list="cat-list" value={q.category} maxLength={80} placeholder="Masalan: Kiritish qurilmalari" onChange={(e) => set('category', e.target.value)} />
        </div>
        <div>
          <label className="label">Savol turi</label>
          <select className="input" value={q.question_type} onChange={(e) => changeType(e.target.value as QuestionType)}>
            {(Object.keys(QUESTION_TYPES) as QuestionType[]).map((t) => (
              <option key={t} value={t} disabled={!QUESTION_TYPES[t].playable}>
                {QUESTION_TYPES[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Qiyinlik</label>
          <select className="input" value={q.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTIES[d].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tavsiya etilgan raund</label>
          <select className="input" value={q.recommended_round ?? ''} onChange={(e) => changeRound(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Istalgan</option>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                {r}. {roundMeta(r).title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Ball</label>
            <input type="number" min={0} max={2000} className="input" value={q.default_points} onChange={(e) => set('default_points', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Vaqt, s</label>
            <input type="number" min={5} max={300} className="input" value={q.default_time_limit} onChange={(e) => set('default_time_limit', Number(e.target.value))} />
          </div>
        </div>
        <div className="md:col-span-4">
          <label className="label">Savol matni</label>
          <textarea className="input min-h-[90px]" maxLength={600} value={q.question_text} onChange={(e) => set('question_text', e.target.value)} />
        </div>

        <div className="md:col-span-4">
          {isChoice ? (
            <>
              <div className="label">Variantlar (toʻgʻrisini belgilang)</div>
              <div className="space-y-2">
                {choiceOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label
                      className={clsx(
                        'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border font-display font-bold',
                        q.correct_answer === i ? 'border-arena-success bg-arena-success/20 text-arena-success' : 'border-white/10 text-arena-muted',
                      )}
                      title="Toʻgʻri javob"
                    >
                      <input type="radio" className="sr-only" name="correct" checked={q.correct_answer === i} onChange={() => set('correct_answer', i)} />
                      {OPTION_LETTERS[i]}
                    </label>
                    <input
                      className="input"
                      value={opt}
                      maxLength={200}
                      readOnly={q.question_type === 'true_false'}
                      placeholder={`${OPTION_LETTERS[i]} variant`}
                      onChange={(e) => setQ((p) => ({ ...p, options: stringOptions(p.options).map((o, j) => (j === i ? e.target.value : o)) }))}
                    />
                    {q.question_type !== 'true_false' && choiceOptions.length > 2 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label="Variantni oʻchirish"
                        onClick={() =>
                          setQ((p) => {
                            const options = stringOptions(p.options).filter((_, j) => j !== i);
                            const c = typeof p.correct_answer === 'number' ? p.correct_answer : 0;
                            return { ...p, options, correct_answer: c === i ? 0 : c > i ? c - 1 : c };
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {q.question_type !== 'true_false' && choiceOptions.length < 6 && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => setQ((p) => ({ ...p, options: [...stringOptions(p.options), ''] }))}>
                  <Plus className="h-4 w-4" /> Variant qoʻshish
                </button>
              )}
            </>
          ) : q.question_type === 'matching' ? (
            <>
              <div className="label">Juftliklar: chap element → toʻgʻri javob (oʻng ustun)</div>
              <div className="space-y-2">
                {pairs.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-display font-bold text-arena-muted">{i + 1}</span>
                    <input
                      className="input"
                      value={p.left}
                      maxLength={200}
                      placeholder="Masalan: Klaviatura"
                      onChange={(e) => setPairs((list) => list.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))}
                    />
                    <ArrowRight className="h-4 w-4 shrink-0 text-arena-muted" aria-hidden />
                    <input
                      className="input"
                      value={p.right}
                      maxLength={200}
                      list="match-rights"
                      placeholder="Masalan: Kiritish qurilmasi"
                      onChange={(e) => setPairs((list) => list.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))}
                    />
                    {pairs.length > 2 && (
                      <button className="btn btn-ghost btn-sm" aria-label="Juftlikni oʻchirish" onClick={() => setPairs((list) => list.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <datalist id="match-rights">
                {[...new Set(pairs.map((p) => p.right.trim()).filter(Boolean))].map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              {pairs.length < 4 && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => setPairs((list) => [...list, { left: '', right: '' }])}>
                  <Plus className="h-4 w-4" /> Juftlik qoʻshish
                </button>
              )}
              <p className="mt-2 text-xs text-arena-muted">
                Oʻng ustundagi javoblar takrorlanishi mumkin (masalan, bir nechta qurilma “Kiritish”ga mos). Oʻquvchiga javoblar aralashtirib koʻrsatiladi; qisman toʻgʻri moslash qisman ball oladi.
              </p>
            </>
          ) : q.question_type === 'multi_step' ? (
            <>
              <div className="label">Zanjir qadamlari (har bir qadamda toʻgʻri variantni belgilang)</div>
              <div className="space-y-3">
                {steps.map((st, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-space-950/40 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-arena-cyan">{i + 1}-qadam</span>
                      {steps.length > 2 && (
                        <button className="btn btn-ghost btn-sm ml-auto" aria-label="Qadamni oʻchirish" onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <input
                      className="input"
                      value={st.text}
                      maxLength={300}
                      placeholder={i === 0 ? 'Masalan: Monitor qorongʻi. Birinchi nimani tekshirasiz?' : 'Keyingi qadam savoli'}
                      onChange={(e) => setSteps((list) => list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {st.options.map((opt, k) => (
                        <div key={k} className="flex items-center gap-2">
                          <label
                            className={clsx(
                              'flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border font-display text-sm font-bold',
                              st.correct === k ? 'border-arena-success bg-arena-success/20 text-arena-success' : 'border-white/10 text-arena-muted',
                            )}
                            title="Toʻgʻri javob"
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`step-${i}`}
                              checked={st.correct === k}
                              onChange={() => setSteps((list) => list.map((x, j) => (j === i ? { ...x, correct: k } : x)))}
                            />
                            {OPTION_LETTERS[k]}
                          </label>
                          <input
                            className="input"
                            value={opt}
                            maxLength={200}
                            placeholder={`${OPTION_LETTERS[k]} variant`}
                            onChange={(e) =>
                              setSteps((list) => list.map((x, j) => (j === i ? { ...x, options: x.options.map((o, m) => (m === k ? e.target.value : o)) } : x)))
                            }
                          />
                          {st.options.length > 2 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              aria-label="Variantni oʻchirish"
                              onClick={() =>
                                setSteps((list) =>
                                  list.map((x, j) =>
                                    j === i ? { ...x, options: x.options.filter((_, m) => m !== k), correct: x.correct === k ? 0 : x.correct > k ? x.correct - 1 : x.correct } : x,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {st.options.length < 4 && (
                      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setSteps((list) => list.map((x, j) => (j === i ? { ...x, options: [...x.options, ''] } : x)))}>
                        <Plus className="h-4 w-4" /> Variant
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {steps.length < 4 && (
                <button className="btn btn-ghost btn-sm mt-2" onClick={() => setSteps((list) => [...list, { text: '', options: ['', '', ''], correct: 0 }])}>
                  <Plus className="h-4 w-4" /> Qadam qoʻshish
                </button>
              )}
              <p className="mt-2 text-xs text-arena-muted">
                Oʻquvchi qadamlarni ketma-ket yechadi: keyingi qadam faqat oldingisi toʻgʻri boʻlsa ochiladi, xato qadam zanjirni yakunlaydi. Har bir toʻgʻri qadam — qisman ball, toʻliq zanjir — bonus.
              </p>
            </>
          ) : (
            <>
              <div className="label">Qabul qilinadigan javoblar (katta-kichik harf farq qilmaydi)</div>
              <div className="space-y-2">
                {accepted.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input"
                      value={a}
                      maxLength={100}
                      placeholder={i === 0 ? 'Masalan: 1010 yoki Nyuton' : 'Muqobil javob'}
                      onChange={(e) => set('correct_answer', accepted.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {accepted.length > 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => set('correct_answer', accepted.filter((_, j) => j !== i))} aria-label="Oʻchirish">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => set('correct_answer', [...accepted, ''])}>
                <Plus className="h-4 w-4" /> Muqobil javob
              </button>
              <p className="mt-2 text-xs text-arena-muted">Faqat raqamlardan iborat javob “raqamli qulf” klaviaturasi bilan koʻrsatiladi.</p>
            </>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="label">Izoh (javob ochilganda koʻrsatiladi)</label>
          <textarea className="input min-h-[80px]" maxLength={800} value={q.explanation} onChange={(e) => set('explanation', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Maslahat (HINT SCAN uchun)</label>
          <textarea className="input min-h-[80px]" maxLength={300} value={q.hint} onChange={(e) => set('hint', e.target.value)} />
        </div>

        <div className="md:col-span-4">
          <label className="label">Rasm</label>
          <div className="flex flex-wrap items-start gap-3">
            <input
              className="input flex-1"
              placeholder="https://… yoki kompyuterdan yuklang"
              value={q.image_url ?? ''}
              onChange={(e) => set('image_url', e.target.value || null)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />} Rasm yuklash
            </button>
            {q.image_url && (
              <button className="btn btn-ghost" onClick={() => set('image_url', null)}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {q.image_url && <QuestionImage src={q.image_url} className="mt-3 h-44 w-64" />}
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-4">
          <input type="checkbox" checked={q.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Faol (oʻyinlarga avtomatik tanlanadi)
        </label>
      </div>
    </Modal>
  );
}
