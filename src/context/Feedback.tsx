// Bildirishnomalar (toast) va tasdiqlash oynasi (destruktiv amallar uchun)
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (text: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((text: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6500 : 3800);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className={clsx(
                'pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md',
                t.tone === 'success' && 'border-arena-success/40 bg-[#0c2a24]/90 text-arena-text',
                t.tone === 'error' && 'border-arena-red/50 bg-[#2c0f17]/90 text-arena-text',
                t.tone === 'warning' && 'border-arena-warning/50 bg-[#2b2310]/90 text-arena-text',
                t.tone === 'info' && 'border-arena-cyan/40 bg-space-800/90 text-arena-text',
              )}
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-arena-success" />}
              {t.tone === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-arena-red" />}
              {t.tone === 'warning' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-arena-warning" />}
              {t.tone === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-arena-cyan" />}
              <span className="leading-snug">{t.text}</span>
              <button
                className="ml-1 rounded p-0.5 text-arena-muted hover:text-arena-text"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                aria-label="Yopish"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {dialog && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onKeyDown={(e) => e.key === 'Escape' && close(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="glass w-full max-w-md rounded-2xl p-6"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
              <div className="flex items-start gap-3">
                <div className={clsx('rounded-xl p-2', dialog.danger ? 'bg-arena-red/15 text-arena-red' : 'bg-arena-cyan/15 text-arena-cyan')}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="confirm-title" className="font-display text-lg font-bold text-arena-text">
                    {dialog.title}
                  </h2>
                  {dialog.message && <p className="mt-1.5 text-sm leading-relaxed text-arena-muted">{dialog.message}</p>}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button className="btn btn-ghost" onClick={() => close(false)}>
                  {dialog.cancelText ?? 'Bekor qilish'}
                </button>
                <button autoFocus className={clsx('btn', dialog.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>
                  {dialog.confirmText ?? 'Tasdiqlash'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('FeedbackProvider topilmadi');
  return v;
}
