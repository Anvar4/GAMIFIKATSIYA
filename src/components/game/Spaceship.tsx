import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { SKINS, TEAM_COLORS } from '../../game/constants';
import { shipVisual } from '../../game/assets';
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

/** Jamoa rangidagi kema rasmi (rang varianti boʻlmasa asl rasm rang filtri bilan boʻyaladi) */
export function ShipImage({
  skin,
  color,
  flip,
  defeated,
  className,
  alt = '',
}: {
  skin: SpaceshipSkin;
  color: TeamColor;
  flip?: boolean;
  defeated?: boolean;
  className?: string;
  alt?: string;
}) {
  const v = shipVisual(skin, color);
  const filter = [v.filter, defeated ? 'grayscale(1)' : null].filter(Boolean).join(' ') || undefined;
  return (
    <img
      src={v.src}
      alt={alt}
      draggable={false}
      decoding="async"
      className={clsx(className, defeated && 'opacity-40')}
      style={{ transform: flip ? 'scaleX(-1)' : undefined, filter }}
    />
  );
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
        {/* dvigatel nuri alohida qatlamda — rang filtri bilan toʻqnashmasligi uchun */}
        <div className="engine-glow" style={{ ['--glow' as string]: c.hex }}>
          <ShipImage
            skin={skin}
            color={color}
            flip={facing === 'left'}
            defeated={defeated}
            alt={alt ?? `${SKINS[skin].label} kemasi`}
            className="block h-auto w-full"
          />
        </div>
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
