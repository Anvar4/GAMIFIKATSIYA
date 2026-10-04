import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Copy, Download, Eye, FileJson, FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { InstructorLayout } from './InstructorLayout';
import { QuestionEditor } from './QuestionEditor';
import { ImportModal } from './ImportModal';
import { Modal, Panel, Spinner } from '../../components/ui/Basics';
import { AnswerOption, MatchingInput, QuestionImage, StepsReveal, formatCorrectAnswer, isChoiceType } from '../../components/game/QuestionCard';
import { matchingPairs, stepItems, stringOptions } from '../../game/questionShape';
import { useInstructorAuth } from '../../context/InstructorAuth';
import { useFeedback } from '../../context/Feedback';
import { getInstructorClient } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { bulkInsertQuestions, createQuestion, deleteQuestion, listQuestions, updateQuestion } from '../../services/questions';
import { exportQuestionsXlsx } from '../../lib/questionImport';
import { downloadFile } from '../../lib/csv';
import { DIFFICULTIES, GRADES, QUESTION_TYPES, roundMeta } from '../../game/constants';
import type { Difficulty, QuestionInput, QuestionRecord, QuestionType } from '../../game/types';
import { useDocumentTitle } from '../../hooks/useUi';

const PAGE = 60;

export default function QuestionBank() {
  useDocumentTitle('Savollar banki');
  const client = getInstructorClient();
  const auth = useInstructorAuth();
  const { toast, confirm } = useFeedback();
  const [items, setItems] = useState<QuestionRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [round, setRound] = useState('');
  const [onlyActive, setOnlyActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<QuestionRecord | QuestionInput | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<QuestionRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listQuestions(client));
    } catch (e) {
      toast(errorMessage(e), 'error');
      setItems([]);
    }
  }, [client, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjects = useMemo(() => [...new Set((items ?? []).map((q) => q.subject))].sort(), [items]);
  const categories = useMemo(
    () => [...new Set((items ?? []).filter((q) => !subject || q.subject === subject).map((q) => q.category))].sort(),
    [items, subject],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (items ?? []).filter(
      (q) =>
        (!s || q.question_text.toLowerCase().includes(s) || q.category.toLowerCase().includes(s)) &&
        (!subject || q.subject === subject) &&
        (!grade || q.grade === Number(grade)) &&
        (!category || q.category === category) &&
        (!type || q.question_type === type) &&
        (!difficulty || q.difficulty === difficulty) &&
        (!round || q.recommended_round === Number(round)) &&
        (onlyActive === 'all' || (onlyActive === 'active' ? q.is_active : !q.is_active)),
    );
  }, [items, search, subject, grade, category, type, difficulty, round, onlyActive]);

  useEffect(() => setLimit(PAGE), [search, subject, grade, category, type, difficulty, round, onlyActive]);

  const save = async (q: QuestionInput) => {
    if (editing && 'id' in editing) {
      const updated = await updateQuestion(client, editing.id, q);
      setItems((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      toast('Savol yangilandi', 'success');
    } else {
      const created = await createQuestion(client, q, auth.session!.user.id);
      setItems((list) => [...(list ?? []), created]);
      toast('Savol qoʻshildi', 'success');
    }
  };

  const remove = async (q: QuestionRecord) => {
    const ok = await confirm({
      title: 'Savolni oʻchirish',
      message: 'Agar savol oʻtgan oʻyinlarda ishlatilgan boʻlsa, u oʻchirilmaydi — faqat faolsizlantiriladi.',
      confirmText: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await deleteQuestion(client, q.id);
      if (r === 'deleted') setItems((l) => l?.filter((x) => x.id !== q.id) ?? null);
      else setItems((l) => l?.map((x) => (x.id === q.id ? { ...x, is_active: false } : x)) ?? null);
      toast(r === 'deleted' ? 'Savol oʻchirildi' : 'Savol oʻyinlarda ishlatilgan — faolsizlantirildi', r === 'deleted' ? 'success' : 'warning');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const toggleActive = async (q: QuestionRecord) => {
    try {
      const u = await updateQuestion(client, q.id, { is_active: !q.is_active });
      setItems((l) => l?.map((x) => (x.id === u.id ? u : x)) ?? null);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const doImport = async (qs: QuestionInput[], onProgress: (n: number) => void) => {
    const n = await bulkInsertQuestions(client, qs, auth.session!.user.id, onProgress);
    toast(`${n} ta savol saqlandi`, 'success');
    await load();
    return n;
  };

  const exportXlsx = async () => {
    try {
      await exportQuestionsXlsx(filtered, `IT_ARENA_savollar_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const exportJson = () => {
    const data = filtered.map(({ id, created_by, created_at, updated_at, ...rest }) => {
      void id;
      void created_by;
      void created_at;
      void updated_at;
      return rest;
    });
    downloadFile(`IT_ARENA_savollar_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  return (
    <InstructorLayout>
      <Panel
        title={`Savollar banki ${items ? `(${filtered.length}/${items.length})` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-ghost btn-sm" href="/templates/IT_ARENA_savollar_shabloni.xlsx" download>
              <Download className="h-4 w-4" /> Excel shablon
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Excel / CSV yuklash
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void exportXlsx()} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4" /> Excelga eksport
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportJson} disabled={!filtered.length}>
              <FileJson className="h-4 w-4" /> JSON
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Yangi savol
            </button>
          </div>
        }
      >
        <div className="mb-4 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-arena-muted" />
            <input className="input pl-9" placeholder="Savol yoki mavzu boʻyicha qidirish…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setCategory(''); }} aria-label="Fan">
            <option value="">Barcha fanlar</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Sinf">
            <option value="">Barcha sinflar</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}-sinf
              </option>
            ))}
          </select>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Mavzu">
            <option value="">Barcha mavzular</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Savol turi">
            <option value="">Barcha turlar</option>
            {(Object.keys(QUESTION_TYPES) as QuestionType[]).map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPES[t].label}
              </option>
            ))}
          </select>
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Qiyinlik">
            <option value="">Har qanday qiyinlik</option>
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTIES[d].label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select className="input" value={round} onChange={(e) => setRound(e.target.value)} aria-label="Raund">
              <option value="">Har qanday raund</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}-raund
                </option>
              ))}
            </select>
            <select className="input" value={onlyActive} onChange={(e) => setOnlyActive(e.target.value as 'all' | 'active' | 'inactive')} aria-label="Holat">
              <option value="all">Hammasi</option>
              <option value="active">Faol</option>
              <option value="inactive">Nofaol</option>
            </select>
          </div>
        </div>

        {!items ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-arena-muted">Savol topilmadi. Yangi savol qoʻshing yoki Excel faylidan yuklang.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, limit).map((q) => (
              <li key={q.id} className={clsx('flex flex-wrap items-start gap-3 rounded-xl border border-white/5 bg-space-950/40 p-3', !q.is_active && 'opacity-50')}>
                {q.image_url ? (
                  <img src={q.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-space-950 object-contain p-1" loading="lazy" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-space-950/80 font-display text-xs font-bold text-arena-muted">
                    {q.recommended_round ? `R${q.recommended_round}` : '—'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{q.question_text}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    <span className="chip border-white/10 text-arena-muted">
                      {q.subject}
                      {q.grade ? ` • ${q.grade}-sinf` : ''}
                    </span>
                    <span className="chip border-white/10 text-arena-muted">{q.category}</span>
                    <span className="chip border-white/10 text-arena-muted">{QUESTION_TYPES[q.question_type].label}</span>
                    <span className="chip border-white/10" style={{ color: DIFFICULTIES[q.difficulty].color }}>
                      {DIFFICULTIES[q.difficulty].label}
                    </span>
                    {q.recommended_round && <span className="chip border-white/10 text-arena-muted">{roundMeta(q.recommended_round).title}</span>}
                    <span className="chip border-arena-success/30 text-arena-success">✓ {formatCorrectAnswer(q.question_type, q.options, q.correct_answer)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="mr-2 flex items-center gap-1.5 text-xs text-arena-muted" title="Faol">
                    <input type="checkbox" checked={q.is_active} onChange={() => void toggleActive(q)} /> Faol
                  </label>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPreview(q)} aria-label="Koʻrish" title="Oldindan koʻrish">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    title="Nusxa olish"
                    aria-label="Nusxa olish"
                    onClick={() => {
                      const { id, created_by, created_at, updated_at, ...copy } = q;
                      void id;
                      void created_by;
                      void created_at;
                      void updated_at;
                      setEditing({ ...copy, question_text: `${copy.question_text} (nusxa)` });
                      setEditorOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(q);
                      setEditorOpen(true);
                    }}
                    aria-label="Tahrirlash"
                    title="Tahrirlash"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn btn-ghost btn-sm text-arena-red" onClick={() => void remove(q)} aria-label="Oʻchirish" title="Oʻchirish">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && (
          <div className="mt-4 text-center">
            <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
              Yana koʻrsatish ({filtered.length - limit})
            </button>
          </div>
        )}
      </Panel>

      <QuestionEditor open={editorOpen} initial={editing} categories={categories} subjects={subjects} onClose={() => setEditorOpen(false)} onSave={save} />
      <ImportModal open={importOpen} existing={items ?? []} subjects={subjects} onClose={() => setImportOpen(false)} onImport={doImport} />
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Oldindan koʻrish" wide>
        {preview && <QuestionPreview q={preview} />}
      </Modal>
    </InstructorLayout>
  );
}

export function QuestionPreview({ q }: { q: Pick<QuestionRecord, 'question_type' | 'question_text' | 'options' | 'correct_answer' | 'image_url' | 'explanation' | 'hint'> }) {
  return (
    <div className="space-y-4">
      <div className={clsx('grid gap-4', q.image_url && 'md:grid-cols-[16rem_1fr]')}>
        {q.image_url && <QuestionImage src={q.image_url} className="h-56" />}
        <div>
          <p className="font-display text-xl font-bold leading-snug">{q.question_text}</p>
          {isChoiceType(q.question_type) ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stringOptions(q.options).map((o, i) => (
                <AnswerOption key={i} index={i} text={o} state={i === q.correct_answer ? 'correct' : 'idle'} />
              ))}
            </div>
          ) : q.question_type === 'matching' ? (
            <div className="mt-4">
              <MatchingPreview options={q.options} correct={q.correct_answer} />
            </div>
          ) : q.question_type === 'multi_step' ? (
            <div className="mt-4">
              <StepsReveal steps={stepItems(q.options)} correct={Array.isArray(q.correct_answer) ? q.correct_answer.map(Number) : []} />
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-arena-success/10 p-3 text-arena-success">
              Qabul qilinadigan javoblar: {formatCorrectAnswer(q.question_type, q.options, q.correct_answer)}
            </p>
          )}
        </div>
      </div>
      {q.explanation && (
        <p className="rounded-xl border border-white/5 bg-space-950/50 p-3 text-sm text-arena-muted">
          <b className="text-arena-text">Izoh:</b> {q.explanation}
        </p>
      )}
      {q.hint && (
        <p className="rounded-xl border border-arena-success/20 bg-arena-success/5 p-3 text-sm text-arena-muted">
          <b className="text-arena-success">Maslahat:</b> {q.hint}
        </p>
      )}
    </div>
  );
}

/** Moslashtirish savolini oʻquvchi koʻradigan koʻrinishda (javoblar aralash) va toʻgʻri juftliklar bilan */
function MatchingPreview({ options, correct }: { options: unknown; correct: unknown }) {
  const pairs = matchingPairs(options, correct);
  const choices = [...new Set(pairs.map((p) => p.right))].sort((a, b) => a.localeCompare(b));
  return (
    <MatchingInput
      left={pairs.map((p) => p.left)}
      choices={choices}
      value={pairs.map((p) => choices.indexOf(p.right))}
      reveal={pairs.map((p) => p.right)}
    />
  );
}
