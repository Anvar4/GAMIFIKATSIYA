import { useEffect, useRef, type ReactNode } from 'react';
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import clsx from 'clsx';
import { Loader2, Wifi, WifiOff, X } from 'lucide-react';
import type { ConnectionState } from '../../hooks/useRoomSnapshot';
import { useReducedMotion } from '../../hooks/useUi';

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const img = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-16 w-16', xl: 'h-28 w-28' }[size];
  const title = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl', xl: 'text-6xl' }[size];
  const sub = { sm: 'text-[0.55rem]', md: 'text-[0.62rem]', lg: 'text-xs', xl: 'text-lg' }[size];
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <img src="/assets/brand/emblem.webp" alt="" className={clsx(img, 'drop-shadow-[0_0_14px_rgba(62,231,255,0.45)]')} />
      <div className="leading-none">
        <div className={clsx('font-logo font-black tracking-[0.14em] text-arena-text', title)}>
          IT <span className="text-arena-cyan text-glow-cyan">ARENA</span>
        </div>
        <div className={clsx('mt-1 font-display font-semibold tracking-[0.42em] text-arena-muted', sub)}>GALAKTIK JANG</div>
      </div>
    </div>
  );
}

export function SpaceBackground({
  image,
  dim = 0.55,
  className,
}: {
  image?: 'arena' | 'intro' | null;
  dim?: number;
  className?: string;
}) {
  return (
    <div className={clsx('pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-space-900', className)} aria-hidden>
      {image && (
        <img
          src={image === 'arena' ? '/assets/bg/arena.webp' : '/assets/bg/intro.webp'}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
        />
      )}
      <div className="absolute inset-0" style={{ background: `rgba(4, 10, 20, ${dim})` }} />
      <div className="starfield" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-space-950/80 to-transparent" />
    </div>
  );
}

export function Panel({
  title,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('glass rounded-2xl', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-arena-text">
            {icon && <span className="text-arena-cyan">{icon}</span>}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className ?? 'h-5 w-5')} aria-hidden />;
}

export function LoadingScreen({ text = 'Yuklanmoqda…' }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-arena-muted" role="status">
      <SpaceBackground />
      <img src="/assets/brand/emblem.webp" alt="" className="h-20 w-20 animate-pulse-soft" />
      <div className="flex items-center gap-2 font-display tracking-widest">
        <Spinner /> {text}
      </div>
    </div>
  );
}

export function ConnectionBadge({ state, compact }: { state: ConnectionState; compact?: boolean }) {
  const meta = {
    connected: { label: 'Ulangan', cls: 'border-arena-success/40 text-arena-success', dot: 'bg-arena-success' },
    reconnecting: { label: 'Qayta ulanmoqda…', cls: 'border-arena-warning/40 text-arena-warning', dot: 'bg-arena-warning animate-pulse' },
    offline: { label: 'Aloqa yoʻq', cls: 'border-arena-red/50 text-arena-red', dot: 'bg-arena-red' },
  }[state];
  return (
    <span className={clsx('chip bg-space-950/60', meta.cls)} role="status" aria-live="polite" title={meta.label}>
      {state === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
      <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {!compact && meta.label}
    </span>
  );
}

/** Ball oʻzgarganda raqamlar silliq sanaladi */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [reduced] = useReducedMotion();
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString('uz-UZ').replace(/,/g, ' '));
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduced) {
      mv.set(value);
      first.current = false;
      return;
    }
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv, reduced]);
  return <motion.span className={clsx('tabular-nums', className)}>{rounded}</motion.span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={clsx('glass-strong my-8 w-full rounded-2xl shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')}
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
          >
            <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <button className="rounded-lg p-1.5 text-arena-muted hover:bg-white/5 hover:text-arena-text" onClick={onClose} aria-label="Yopish">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-white/5 px-5 py-4">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ErrorState({ title, message, action }: { title: string; message?: string | null; action?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <SpaceBackground />
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <WifiOff className="mx-auto h-10 w-10 text-arena-red" />
        <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
        {message && <p className="mt-2 text-sm leading-relaxed text-arena-muted">{message}</p>}
        {action && <div className="mt-6 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-space-950/40 px-3 py-2">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-arena-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}
