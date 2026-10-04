import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Shield, Zap } from 'lucide-react';

interface MeterProps {
  value: number;
  max: number;
  color: string;
  label: string;
  icon?: React.ReactNode;
  segments?: number;
  size?: 'sm' | 'md' | 'lg';
  danger?: boolean;
  className?: string;
}

export function Meter({ value, max, color, label, icon, segments = 10, size = 'md', danger, className }: MeterProps) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const h = { sm: 'h-2', md: 'h-3', lg: 'h-4' }[size];
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-arena-muted">
        <span className="flex items-center gap-1.5" style={{ color }}>
          {icon}
          {label}
        </span>
        <span className={clsx('tabular-nums text-arena-text', danger && 'text-arena-red')}>
          {Math.round(value)}
          <span className="text-arena-muted">/{max}</span>
        </span>
      </div>
      <div
        className={clsx('relative overflow-hidden rounded-full bg-space-950/80 ring-1 ring-white/10', h)}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 70, damping: 18 }}
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 14px ${color}` }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(${100 / segments}% - 2px), rgba(4,10,20,0.85) calc(${100 / segments}% - 2px) calc(${100 / segments}%))`,
          }}
        />
      </div>
    </div>
  );
}

export function ShieldBar({ value, max, color, size }: { value: number; max: number; color: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Meter
      value={value}
      max={max}
      color={color}
      label="Qalqon"
      icon={<Shield className="h-3.5 w-3.5" />}
      danger={value / Math.max(1, max) < 0.25}
      size={size}
    />
  );
}

export function EnergyBar({ value, max, size }: { value: number; max: number; size?: 'sm' | 'md' | 'lg' }) {
  return <Meter value={value} max={max} color="#FFC857" label="Energiya" icon={<Zap className="h-3.5 w-3.5" />} size={size} />;
}
