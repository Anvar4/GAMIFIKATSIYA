import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal, Spinner } from '../../components/ui/Basics';
import { GRADES, QUESTION_TYPES, DEFAULT_SUBJECTS } from '../../game/constants';
import type { QuestionInput, QuestionRecord } from '../../game/types';
import { readQuestionFile, norm, type ImportResult } from '../../lib/questionImport';
import { errorMessage } from '../../lib/errors';

export function ImportModal({
  open,
  existing,
  subjects,
  onClose,
  onImport,
}: {
  open: boolean;
  existing: QuestionRecord[];
  subjects: string[];
  onClose: () => void;
  onImport: (qs: QuestionInput[], onProgress: (n: number) => void) => Promise<number>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState('Informatika');
  const [grade, setGrade] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const existingKeys = useMemo(() => new Set(existing.map((q) => `${norm(q.subject)}|${norm(q.question_text)}|${q.image_url ?? ''}`)), [existing]);
  const dupOf = (q: QuestionInput) => existingKeys.has(`${norm(q.subject)}|${norm(q.question_text)}|${q.image_url ?? ''}`);

  const parse = async (file: File, subj = subject, gr = grade) => {
    setError(null);
    setBusy(true);
    setFileName(file.name);
    setLastFile(file);
    try {
      const r = await readQuestionFile(file, { subject: subj, grade: gr ? Number(gr) : null });
      setResult(r);
      setSelected(new Set(r.questions.map((q, i) => (dupOf(q) ? -1 : i)).filter((i) => i >= 0)));
    } catch (e) {
      setResult(null);
      setError(`Faylni oʻqib boʻlmadi: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFileName(null);
    setSelected(new Set());
    setError(null);
    setProgress(0);
  };

  const save = async () => {
    if (!result) return;
    const chosen = result.questions.filter((_, i) => selected.has(i)).map(({ _row, ...q }) => {
      void _row;
      return q;
    });
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onImport(chosen, setProgress);
      reset();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const dupCount = result?.questions.filter(dupOf).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          reset();
          onClose();
        }
      }}
      wide
      title="Savollarni import qilish (Excel / CSV / JSON)"
      footer={
        <>
          {error && <p className="mr-auto self-center text-sm text-arena-red">{error}</p>}
          {busy && progress > 0 && <span className="mr-auto self-center text-sm text-arena-muted">{progress} ta saqlandi…</span>}
          <button className="btn btn-ghost" onClick={reset} disabled={busy || !result}>
            Boshqa fayl
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || selected.size === 0}>
            {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Saqlash ({selected.size} ta)
          </button>
        </>
      }
    >
      {!result ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-arena-cyan/25 bg-arena-cyan/5 p-4 text-sm leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-arena-cyan">
              <FileSpreadsheet className="h-5 w-5" /> Qanday qilib?
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-arena-muted">
              <li>Excel shablonini yuklab oling va “Savollar” varagʻini toʻldiring (istalgan fan va sinf uchun).</li>
              <li>Faylni .xlsx sifatida saqlang va quyida tanlang.</li>
              <li>Tekshiruv natijasini koʻring — xato qatorlar raqami bilan koʻrsatiladi.</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn btn-ghost btn-sm" href="/templates/IT_ARENA_savollar_shabloni.xlsx" download>
                <Download className="h-4 w-4" /> Excel shablon
              </a>
              <a className="btn btn-ghost btn-sm" href="/templates/Informatika_9-sinf_savollar_banki.xlsx" download>
                <Download className="h-4 w-4" /> Namuna: Informatika 9-sinf (117 savol)
              </a>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Fan (faylda koʻrsatilmagan boʻlsa)</label>
              <input className="input" list="import-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <datalist id="import-subjects">
                {[...new Set([...subjects, ...DEFAULT_SUBJECTS])].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Sinf (faylda koʻrsatilmagan boʻlsa)</label>
              <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Barcha sinflar</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}-sinf
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 bg-space-950/40 px-6 py-10 text-arena-muted transition hover:border-arena-cyan/50 hover:text-arena-text"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void parse(f);
            }}
            disabled={busy}
          >
            {busy ? <Spinner className="h-8 w-8" /> : <Upload className="h-8 w-8" />}
            <span className="font-semibold">Faylni tanlang yoki shu yerga tashlang</span>
            <span className="text-xs">.xlsx, .csv yoki .json</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv,.json,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void parse(f);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">{fileName}</span>
            <span className="chip border-arena-success/40 text-arena-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {result.questions.length} ta toʻgʻri qator
            </span>
            {result.errors.length > 0 && (
              <span className="chip border-arena-red/40 text-arena-red">
                <AlertTriangle className="h-3.5 w-3.5" /> {result.errors.length} ta xato
              </span>
            )}
            {dupCount > 0 && <span className="chip border-arena-warning/40 text-arena-warning">{dupCount} ta bankda bor (belgilanmagan)</span>}
            {lastFile && (
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => void parse(lastFile)}>
                Qayta tekshirish
              </button>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-arena-red/30 bg-arena-red/5 p-3 text-sm scrollbar-thin">
              {result.errors.map((e, i) => (
                <div key={i} className="py-0.5">
                  <span className="font-semibold text-arena-red">{e.row ? `${e.row}-qator:` : 'Fayl:'}</span> {e.message}
                </div>
              ))}
            </div>
          )}

          {result.questions.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-space-950/60 text-[0.68rem] uppercase tracking-[0.12em] text-arena-muted">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Hammasini tanlash"
                        checked={selected.size === result.questions.length}
                        onChange={(e) => setSelected(e.target.checked ? new Set(result.questions.map((_, i) => i)) : new Set())}
                      />
                    </th>
                    <th className="px-3 py-2">Qator</th>
                    <th className="px-3 py-2">Savol</th>
                    <th className="px-3 py-2">Tur</th>
                    <th className="px-3 py-2">Fan / sinf</th>
                    <th className="px-3 py-2">Mavzu</th>
                  </tr>
                </thead>
                <tbody>
                  {result.questions.map((q, i) => {
                    const dup = dupOf(q);
                    return (
                      <tr key={i} className={clsx('border-t border-white/5', dup && 'opacity-60')}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={(e) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(i);
                                else n.delete(i);
                                return n;
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums text-arena-muted">{q._row}</td>
                        <td className="max-w-md px-3 py-2">
                          <div className="line-clamp-2">{q.question_text}</div>
                          {dup && <div className="text-xs text-arena-warning">Bankda allaqachon bor</div>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-arena-muted">{QUESTION_TYPES[q.question_type].label}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-arena-muted">
                          {q.subject}
                          {q.grade ? ` • ${q.grade}` : ''}
                        </td>
                        <td className="px-3 py-2 text-arena-muted">{q.category}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
