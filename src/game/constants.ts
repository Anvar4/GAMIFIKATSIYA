import type {
  AbilityType,
  AwardKey,
  Difficulty,
  QuestionType,
  RoomSettings,
  SpaceshipSkin,
  SpecialEventKind,
  TeamColor,
} from './types';

export const APP_NAME = 'IT ARENA';
export const APP_MODE = 'GALAKTIK JANG';
export const TAGLINE = 'Bilim — eng kuchli qurol!';

export interface RoundMeta {
  number: number;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  banner: string;
  accent: string;
}

export const ROUNDS: RoundMeta[] = [
  {
    number: 1,
    code: 'START',
    title: 'BILIMLAR SINOVI',
    subtitle: 'Asosiy bilimlar',
    description: 'Toʻrt variantli savollar. Har bir toʻgʻri javob jamoa kemasiga energiya beradi.',
    banner: '/assets/rounds/round1.webp',
    accent: '#3EE7FF',
  },
  {
    number: 2,
    code: 'TECH HUNTER',
    title: 'RASMLI OV',
    subtitle: 'Rasm boʻyicha aniqlash',
    description: 'Katta ekrandagi rasmni diqqat bilan koʻring va toʻgʻri javobni toping.',
    banner: '/assets/rounds/round2.webp',
    accent: '#35D49A',
  },
  {
    number: 3,
    code: 'SPEED BATTLE',
    title: 'TEZLIK JANGI',
    subtitle: 'Tezlik + aniqlik',
    description: 'Qisqa savollar, kam vaqt. Tezroq toʻgʻri javob — koʻproq bonus.',
    banner: '/assets/rounds/round3.webp',
    accent: '#FFC857',
  },
  {
    number: 4,
    code: 'HACK THE SYSTEM',
    title: 'TIZIMNI BUZ',
    subtitle: 'Mantiq va muammolar',
    description: 'Raqamli qulflar, mantiqiy ketma-ketliklar va nosozliklarni topish.',
    banner: '/assets/rounds/round4.webp',
    accent: '#35D49A',
  },
  {
    number: 5,
    code: 'GALACTIC BOSS',
    title: 'GALAKTIK BOSS',
    subtitle: 'Yakuniy jang',
    description: 'Eng qiyin savollar, jamoaviy muhokama va kuchaytirilgan zarbalar.',
    banner: '/assets/rounds/round5.webp',
    accent: '#A66BFF',
  },
];

export function roundMeta(n: number, settings?: Pick<RoomSettings, 'rounds'> | null): RoundMeta {
  const base = ROUNDS[Math.min(Math.max(n, 1), 5) - 1];
  const custom = settings?.rounds?.[String(n)]?.title?.trim();
  return custom ? { ...base, title: custom.toUpperCase() } : base;
}

export interface TeamColorMeta {
  key: TeamColor;
  label: string;
  hex: string;
  rgb: string;
}

export const TEAM_COLORS: Record<TeamColor, TeamColorMeta> = {
  blue: { key: 'blue', label: 'Koʻk', hex: '#2583FF', rgb: '37 131 255' },
  red: { key: 'red', label: 'Qizil', hex: '#FF455A', rgb: '255 69 90' },
  cyan: { key: 'cyan', label: 'Feruza', hex: '#3EE7FF', rgb: '62 231 255' },
  green: { key: 'green', label: 'Yashil', hex: '#35D49A', rgb: '53 212 154' },
  gold: { key: 'gold', label: 'Oltin', hex: '#FFC857', rgb: '255 200 87' },
  purple: { key: 'purple', label: 'Binafsha', hex: '#A66BFF', rgb: '166 107 255' },
};

export const SKINS: Record<SpaceshipSkin, { key: SpaceshipSkin; label: string; image: string; description: string }> = {
  falcon: { key: 'falcon', label: 'Falcon', image: '/assets/ships/falcon.webp', description: 'Tezkor tutib oluvchi' },
  phoenix: { key: 'phoenix', label: 'Phoenix', image: '/assets/ships/phoenix.webp', description: 'Hujumkor qiruvchi' },
  nova: { key: 'nova', label: 'Nova', image: '/assets/ships/nova.webp', description: 'Yashirin kreyser' },
  titan: { key: 'titan', label: 'Titan', image: '/assets/ships/titan.webp', description: 'Ogʻir zirhli kema' },
};

export interface AbilityMeta {
  key: AbilityType;
  title: string;
  short: string;
  description: string;
  color: string;
}

export const ABILITIES: Record<AbilityType, AbilityMeta> = {
  shield_boost: {
    key: 'shield_boost',
    title: 'SHIELD BOOST',
    short: 'Qalqon kuchaytirgich',
    description: 'Keyingi kelgan zarbaning katta qismini toʻsadi.',
    color: '#3EE7FF',
  },
  double_attack: {
    key: 'double_attack',
    title: 'DOUBLE ATTACK',
    short: 'Ikki karra zarba',
    description: 'Jamoaning keyingi zarbasi ikki barobar kuchli boʻladi.',
    color: '#FF455A',
  },
  time_freeze: {
    key: 'time_freeze',
    title: 'TIME FREEZE',
    short: 'Vaqtni muzlatish',
    description: 'Joriy savolga qoʻshimcha vaqt qoʻshadi (javob muddati tugashidan oldin).',
    color: '#A66BFF',
  },
  energy_steal: {
    key: 'energy_steal',
    title: 'ENERGY STEAL',
    short: 'Energiya oʻgʻirlash',
    description: 'Raqib kemasidan cheklangan miqdorda energiya oladi.',
    color: '#FFC857',
  },
  hint_scan: {
    key: 'hint_scan',
    title: 'HINT SCAN',
    short: 'Maslahat skaneri',
    description: 'Joriy savol uchun oʻqituvchi kiritgan maslahatni jamoaga ochadi.',
    color: '#35D49A',
  },
};

export const ABILITY_ORDER: AbilityType[] = ['shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan'];

export const SPECIAL_EVENTS: Record<SpecialEventKind, { title: string; description: string }> = {
  energy_surge: { title: 'Energiya toʻlqini', description: 'Ikkala jamoaga +25 energiya' },
  meteor_storm: { title: 'Meteor yomgʻiri', description: 'Ikkala kema qalqoni −5' },
  shield_repair: { title: 'Qalqon taʼmiri', description: 'Ikkala kema qalqoni +15' },
  double_points: { title: 'Ikki karra ball', description: 'Keyingi savol ballari ×2' },
};

export const QUESTION_TYPES: Record<QuestionType, { label: string; playable: boolean }> = {
  single_choice: { label: 'Test (bitta toʻgʻri javob)', playable: true },
  true_false: { label: 'Toʻgʻri / Notoʻgʻri', playable: true },
  image_identification: { label: 'Rasmli savol', playable: true },
  short_answer: { label: 'Qisqa javob / raqamli qulf', playable: true },
  logical_puzzle: { label: 'Mantiqiy masala', playable: true },
  matching: { label: 'Moslashtirish (tez orada)', playable: false },
  multi_step: { label: 'Koʻp bosqichli (tez orada)', playable: false },
};

export const DIFFICULTIES: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: 'Oson', color: '#35D49A' },
  medium: { label: 'Oʻrta', color: '#FFC857' },
  hard: { label: 'Qiyin', color: '#FF455A' },
};

export const AWARDS: Record<AwardKey, { title: string; subtitle: string; icon: string }> = {
  galactic_champion: { title: 'GALACTIC CHAMPION', subtitle: 'Galaktik chempion', icon: 'crown' },
  best_strategist: { title: 'BEST STRATEGIST', subtitle: 'Eng yaxshi strateg', icon: 'brain' },
  speed_master: { title: 'SPEED MASTER', subtitle: 'Tezlik ustasi', icon: 'zap' },
  knowledge_master: { title: 'KNOWLEDGE MASTER', subtitle: 'Bilimlar ustasi', icon: 'book' },
  team_player: { title: 'TEAM PLAYER', subtitle: 'Jamoa oʻyinchisi', icon: 'users' },
  most_improved: { title: 'RISING STAR', subtitle: 'Eng koʻp oʻsgan ishtirokchi', icon: 'trending' },
};

export const AWARD_ORDER: AwardKey[] = [
  'galactic_champion',
  'knowledge_master',
  'best_strategist',
  'speed_master',
  'team_player',
  'most_improved',
];

export const GRADES = [5, 6, 7, 8, 9, 10, 11];

export const DEFAULT_SUBJECTS = [
  'Informatika',
  'Matematika',
  'Fizika',
  'Kimyo',
  'Biologiya',
  'Ona tili',
  'Adabiyot',
  'Ingliz tili',
  'Tarix',
  'Geografiya',
];
