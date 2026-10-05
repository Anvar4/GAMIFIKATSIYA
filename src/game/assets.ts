// Rasm resurslarini tanlash: Higgsfield'da yaratilgan rasm mavjud boʻlsa — u,
// aks holda buzilmaydigan zaxira (asl kema + rang filtri yoki vektor belgi).
import { GENERATED_ASSETS } from './assets.generated';
import type { AbilityType, AwardKey, SpaceshipSkin, TeamColor } from './types';

const SHIP_BASE: Record<SpaceshipSkin, { image: string; color: TeamColor; hue: number }> = {
  falcon: { image: '/assets/ships/falcon.webp', color: 'blue', hue: 219 },
  phoenix: { image: '/assets/ships/phoenix.webp', color: 'red', hue: 1 },
  nova: { image: '/assets/ships/nova.webp', color: 'cyan', hue: 184 },
  titan: { image: '/assets/ships/titan.webp', color: 'gold', hue: 34 },
};

/** Jamoa ranglarining asosiy rang tusi (HSV, gradus) */
const COLOR_HUE: Record<TeamColor, number> = { blue: 214, red: 353, cyan: 187, green: 158, gold: 40, purple: 264 };

export interface ShipVisual {
  src: string;
  /** rang varianti rasmi boʻlmasa — asl rasmni jamoa rangiga boʻyash uchun CSS filter */
  filter?: string;
}

/** Kema rasmi jamoa rangiga mos: avval tayyor rang varianti, boʻlmasa rang tusini aylantirish */
export function shipVisual(skin: SpaceshipSkin, color: TeamColor): ShipVisual {
  const base = SHIP_BASE[skin];
  if (base.color === color) return { src: base.image };
  const variant = `${skin}-${color}`;
  if (GENERATED_ASSETS.ships.includes(variant)) return { src: `/assets/ships/${variant}.webp` };
  let delta = COLOR_HUE[color] - base.hue;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return { src: base.image, filter: `hue-rotate(${delta}deg) saturate(1.15)` };
}

export const BOSS_SHIP = '/assets/ships/boss.webp';

export function abilityImage(key: AbilityType): string | null {
  return GENERATED_ASSETS.abilities.includes(key) ? `/assets/abilities/${key}.webp` : null;
}

export function awardImage(key: AwardKey): string | null {
  return GENERATED_ASSETS.awards.includes(key) ? `/assets/awards/${key}.webp` : null;
}
