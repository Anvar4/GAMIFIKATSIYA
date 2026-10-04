import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { SKINS, TEAM_COLORS } from '../../game/constants';
import type { SpaceshipSkin, TeamColor } from '../../game/types';

interface Props {
  skin: SpaceshipSkin;
  color: TeamColor;
  /** Kema burni qaysi tomonga qaragan (rasmlar oʻngga qaragan) */
  facing?: 'right' | 'left';
  shieldActive?: boolean;
  /** har oʻzgarganda kema silkinadi (zarba) */
  hitKey?: string | number | null;
  defeated?: boolean;
  floating?: boolean;
  className?: string;
  alt?: string;
}

export function Spaceship({ skin, color, facing = 'right', shieldActive, hitKey, defeated, floating = true, className, alt }: Props) {
  const c = TEAM_COLORS[color];
  return (
    <div className={clsx('relative select-none', className)} style={{ color: c.hex }}>
      <motion.div
        key={hitKey ?? 'idle'}
        animate={hitKey ? { x: [0, -14, 12, -8, 6, 0], filter: ['brightness(1)', 'brightness(2.4)', 'brightness(1)'] } : {}}
        transition={{ duration: 0.55 }}
        className={clsx(floating && !defeated && 'hover-float')}
      >
        <img
          src={SKINS[skin].image}
          alt={alt ?? `${SKINS[skin].label} kemasi`}
          draggable={false}
          className={clsx('engine-glow block h-auto w-full', defeated && 'opacity-40 grayscale')}
          style={{
            transform: facing === 'left' ? 'scaleX(-1)' : undefined,
            ['--glow' as string]: c.hex,
          }}
          decoding="async"
        />
      </motion.div>
      <AnimatePresence>
        {shieldActive && (
          <motion.div
            className="shield-bubble"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0.35, 0.65, 0.35], scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={{ opacity: { repeat: Infinity, duration: 2.2 }, scale: { duration: 0.4 } }}
            style={{ color: '#3EE7FF' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
