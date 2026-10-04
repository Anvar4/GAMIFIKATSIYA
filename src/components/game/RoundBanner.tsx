import { motion } from 'framer-motion';
import { roundMeta } from '../../game/constants';
import type { RoomSettings } from '../../game/types';

export function RoundBanner({ round, settings, compact }: { round: number; settings?: RoomSettings | null; compact?: boolean }) {
  const meta = roundMeta(round, settings);
  const cfg = settings?.rounds?.[String(round)];
  return (
    <motion.div
      key={round}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto flex h-full w-full max-w-5xl items-center overflow-hidden rounded-3xl border"
      style={{ borderColor: `${meta.accent}66`, boxShadow: `0 0 60px ${meta.accent}33` }}
    >
      <img src={meta.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-space-950/95 via-space-950/70 to-space-950/30" />
      <div className={compact ? 'relative p-6' : 'relative p-10'}>
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-display text-sm font-bold uppercase tracking-[0.5em]"
          style={{ color: meta.accent }}
        >
          {round}-raund • {meta.code}
        </motion.div>
        <motion.h2
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className={compact ? 'mt-2 font-logo text-3xl font-black tracking-wider' : 'mt-3 font-logo text-[3.6rem] font-black leading-none tracking-wider'}
          style={{ textShadow: `0 0 30px ${meta.accent}88` }}
        >
          {meta.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className={compact ? 'mt-3 max-w-xl text-sm text-arena-muted' : 'mt-5 max-w-2xl text-xl leading-relaxed text-arena-text/90'}
        >
          {meta.description}
        </motion.p>
        {cfg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-5 flex flex-wrap gap-2">
            <span className="chip border-white/15 bg-space-950/60 px-3 py-1 text-sm text-arena-text">{cfg.points ?? 100} ball</span>
            <span className="chip border-white/15 bg-space-950/60 px-3 py-1 text-sm text-arena-text">{cfg.time_limit ?? 20} soniya</span>
            {cfg.speed_bonus && <span className="chip border-arena-warning/50 bg-space-950/60 px-3 py-1 text-sm text-arena-warning">Tezlik bonusi</span>}
            {Boolean(cfg.discussion_seconds) && (
              <span className="chip border-arena-purple/50 bg-space-950/60 px-3 py-1 text-sm text-arena-purple">{cfg.discussion_seconds} s jamoaviy muhokama</span>
            )}
            {round === 5 && <span className="chip border-arena-red/50 bg-space-950/60 px-3 py-1 text-sm text-arena-red">Zarbalar ×{settings?.final_round_multiplier ?? 1.5}</span>}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
