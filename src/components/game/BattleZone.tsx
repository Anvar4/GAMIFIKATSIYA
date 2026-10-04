import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { Team } from '../../game/types';
import { TEAM_COLORS } from '../../game/constants';
import { Spaceship } from './Spaceship';

export interface BattleFx {
  id: string;
  kind: 'attack' | 'shield_down' | 'ability' | 'special' | 'victory';
  fromSlot?: 1 | 2;
  toSlot?: 1 | 2;
  damage?: number;
  blocked?: number;
  critical?: boolean;
  heavy?: boolean;
  correct?: number;
  label?: string;
  color?: string;
}

interface Props {
  left: Team;
  right: Team;
  fx: BattleFx[];
  hits: Record<1 | 2, string | null>;
  compact?: boolean;
  reducedMotion?: boolean;
  children?: ReactNode;
}

/** Markaziy jang maydoni: ikki kema bir-biriga qaragan, zarbalar animatsiyasi */
export function BattleZone({ left, right, fx, hits, compact, reducedMotion, children }: Props) {
  const slotTeam = (slot: 1 | 2) => (slot === 1 ? left : right);
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className={compact ? 'relative h-[38%] min-h-[9rem] shrink-0' : 'relative flex-1'}>
        {/* kemalar */}
        <div className="absolute left-[1%] top-1/2 w-[36%] -translate-y-1/2">
          <Spaceship
            skin={left.spaceship_skin}
            color={left.color}
            facing="right"
            shieldActive={left.shield_boost_active}
            hitKey={hits[1]}
            defeated={left.is_defeated}
            floating={!reducedMotion}
          />
        </div>
        <div className="absolute right-[1%] top-1/2 w-[36%] -translate-y-1/2">
          <Spaceship
            skin={right.spaceship_skin}
            color={right.color}
            facing="left"
            shieldActive={right.shield_boost_active}
            hitKey={hits[2]}
            defeated={right.is_defeated}
            floating={!reducedMotion}
          />
        </div>

        {/* effektlar */}
        <div className="pointer-events-none absolute inset-0">
          <AnimatePresence>
            {fx.map((f) => {
              if (f.kind === 'attack' && f.fromSlot && f.toSlot) {
                const attacker = slotTeam(f.fromSlot);
                const color = TEAM_COLORS[attacker.color].hex;
                const ltr = f.fromSlot === 1;
                const bolts = Math.max(1, Math.min(5, f.correct ?? 1));
                const targetX = ltr ? '74%' : '26%';
                return (
                  <motion.div key={f.id} className="absolute inset-0" exit={{ opacity: 0 }}>
                    {Array.from({ length: bolts }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                          top: `${44 + (i - (bolts - 1) / 2) * 4}%`,
                          left: '33%',
                          right: '33%',
                          height: f.heavy && i === 0 ? '0.75rem' : '0.32rem',
                          background: `linear-gradient(${ltr ? '90deg' : '270deg'}, transparent, ${color} 40%, #ffffff)`,
                          boxShadow: `0 0 16px ${color}, 0 0 36px ${color}`,
                          transformOrigin: ltr ? 'left center' : 'right center',
                        }}
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: [0, 1, 1], opacity: [0, 1, 0] }}
                        transition={{ duration: reducedMotion ? 0.01 : 0.6, delay: reducedMotion ? 0 : i * 0.09, times: [0, 0.5, 1] }}
                      />
                    ))}
                    {/* zarba nuqtasi */}
                    <motion.div
                      className="absolute top-1/2 h-[9rem] w-[9rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: targetX,
                        background: f.blocked ? 'radial-gradient(circle, rgba(62,231,255,0.85), rgba(62,231,255,0) 65%)' : `radial-gradient(circle, #fff, ${color} 35%, transparent 68%)`,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.4, 1.8], opacity: [0, 1, 0] }}
                      transition={{ duration: 0.75, delay: reducedMotion ? 0 : 0.45 }}
                    />
                    {/* zarar raqami */}
                    <motion.div
                      className="absolute top-[18%] -translate-x-1/2 text-center font-display font-black"
                      style={{ left: targetX }}
                      initial={{ y: 10, opacity: 0, scale: 0.6 }}
                      animate={{ y: -30, opacity: [0, 1, 1, 0], scale: 1 }}
                      transition={{ duration: 2, delay: reducedMotion ? 0 : 0.5, times: [0, 0.15, 0.75, 1] }}
                    >
                      <div className="text-[3.2rem] leading-none text-arena-red text-glow-red">−{f.damage ?? 0}</div>
                      {Boolean(f.blocked) && (
                        <div className="mt-1 text-base font-bold tracking-widest text-arena-cyan">QALQON {f.blocked} NI TOʻSDI</div>
                      )}
                    </motion.div>
                    {(f.critical || f.heavy) && (
                      <motion.div
                        className="absolute left-1/2 top-[6%] -translate-x-1/2 whitespace-nowrap font-logo text-[2rem] font-black tracking-[0.2em]"
                        style={{ color: f.critical ? '#FFC857' : color, textShadow: `0 0 24px ${f.critical ? '#FFC857' : color}` }}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: [0.4, 1.15, 1], opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 1.8, times: [0, 0.2, 0.8, 1] }}
                      >
                        {f.critical ? 'KRITIK ZARBA!' : 'PLAZMA ZARBA!'}
                      </motion.div>
                    )}
                  </motion.div>
                );
              }
              if (f.kind === 'shield_down' && f.toSlot) {
                const x = f.toSlot === 1 ? '20%' : '80%';
                return (
                  <motion.div key={f.id} className="absolute inset-0" exit={{ opacity: 0 }}>
                    <motion.div
                      className="absolute top-1/2 h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: x, background: 'radial-gradient(circle, #fff, #FFC857 25%, #FF455A 50%, transparent 70%)' }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.6, 2.2], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.4 }}
                    />
                    <motion.div
                      className="absolute top-[12%] -translate-x-1/2 whitespace-nowrap font-logo text-[1.8rem] font-black text-arena-red text-glow-red"
                      style={{ left: x }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 2.6 }}
                    >
                      QALQON YOʻQ!
                    </motion.div>
                  </motion.div>
                );
              }
              if ((f.kind === 'ability' || f.kind === 'special') && f.label) {
                const x = f.toSlot === 1 ? '20%' : f.toSlot === 2 ? '80%' : '50%';
                return (
                  <motion.div
                    key={f.id}
                    className="absolute top-[8%] -translate-x-1/2 whitespace-nowrap rounded-2xl border px-5 py-2 font-display text-xl font-extrabold tracking-[0.18em] backdrop-blur"
                    style={{ left: x, color: f.color ?? '#A66BFF', borderColor: `${f.color ?? '#A66BFF'}88`, background: 'rgba(4,10,20,0.7)', boxShadow: `0 0 30px ${f.color ?? '#A66BFF'}66` }}
                    initial={{ y: -20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                  >
                    {f.label}
                  </motion.div>
                );
              }
              return null;
            })}
          </AnimatePresence>
        </div>
      </div>
      {children && <div className="relative min-h-0 flex-1">{children}</div>}
    </div>
  );
}
