// Server snapshot'i va maʼlumotlar bazasi obyektlari turlari.
// Manba: supabase/migrations/*_results_snapshot.sql → get_room_snapshot()

export type RoomStatus = 'lobby' | 'active' | 'paused' | 'finished' | 'archived';
export type RoomPhase = 'lobby' | 'round_intro' | 'question' | 'reveal' | 'idle' | 'round_end' | 'finished';
export type PlayerStatus = 'pending' | 'approved' | 'rejected' | 'kicked';
export type GameQuestionStatus = 'pending' | 'active' | 'revealed' | 'skipped';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType =
  | 'single_choice'
  | 'true_false'
  | 'image_identification'
  | 'short_answer'
  | 'logical_puzzle'
  | 'matching'
  | 'multi_step';
export type TeamColor = 'blue' | 'red' | 'cyan' | 'green' | 'gold' | 'purple';
export type SpaceshipSkin = 'falcon' | 'phoenix' | 'nova' | 'titan';
export type AbilityType = 'shield_boost' | 'double_attack' | 'time_freeze' | 'energy_steal' | 'hint_scan';
export type AwardKey =
  | 'galactic_champion'
  | 'best_strategist'
  | 'speed_master'
  | 'knowledge_master'
  | 'team_player'
  | 'most_improved';
export type SpecialEventKind = 'energy_surge' | 'meteor_storm' | 'shield_repair' | 'double_points';

export interface RoundConfig {
  title?: string;
  points?: number;
  time_limit?: number;
  count?: number;
  speed_bonus?: boolean;
  scoring_mode?: 'individual' | 'team_first';
  discussion_seconds?: number;
}

export interface QuestionFilter {
  subject: string | null;
  grade: number | null;
  categories: string[];
}

export interface RoomSettings {
  max_players: number;
  team_size: number;
  allow_team_choice: boolean;
  auto_approve: boolean;
  max_shield: number;
  max_energy: number;
  energy_per_correct: number;
  damage_per_correct: number;
  attack_threshold: number;
  heavy_attack_damage: number;
  crit_streak: number;
  crit_multiplier: number;
  final_round_multiplier: number;
  shield_boost_block: number;
  shield_regen_per_round: number;
  elimination_mode: boolean;
  speed_bonus_ratio: number;
  answer_grace_ms: number;
  ability_voting: boolean;
  ability_max_uses: number;
  ability_cooldown_seconds: number;
  time_freeze_seconds: number;
  energy_steal_amount: number;
  ability_costs: Record<AbilityType, number>;
  disabled_abilities: AbilityType[];
  question_filter?: QuestionFilter;
  rounds: Record<string, RoundConfig>;
}

export interface Room {
  id: string;
  room_code: string;
  title: string;
  status: RoomStatus;
  phase: RoomPhase;
  registration_open: boolean;
  current_round: number;
  current_game_question_id: string | null;
  current_question_started_at: string | null;
  question_deadline: string | null;
  paused_at: string | null;
  paused_remaining_ms: number | null;
  paused_open_ms: number | null;
  next_points_multiplier: number;
  settings: RoomSettings;
  winner_team_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  room_id: string;
  slot: 1 | 2;
  name: string;
  color: TeamColor;
  spaceship_skin: SpaceshipSkin;
  score: number;
  shield: number;
  max_shield: number;
  energy: number;
  streak: number;
  best_streak: number;
  correct_count: number;
  answered_count: number;
  possible_count: number;
  shield_boost_active: boolean;
  double_attack_active: boolean;
  is_defeated: boolean;
}

export interface Player {
  id: string;
  nickname: string;
  team_id: string | null;
  status: PlayerStatus;
  score: number;
  correct_count: number;
  answered_count: number;
  streak: number;
  best_streak: number;
  joined_at: string;
  approved_at: string | null;
  last_seen_at?: string;
  room_id?: string;
}

export interface TeamAbility {
  team_id: string;
  ability_type: AbilityType;
  uses_left: number;
  cooldown_until: string | null;
  is_enabled: boolean;
}

export interface InputSpec {
  kind: 'code' | 'text' | 'matching' | 'multi_step';
  /** raqamli qulf uzunligi (kind = 'code') */
  length?: number;
  /** moslashtirish: oʻng ustundagi aralashtirilgan javoblar (kind = 'matching') */
  choices?: string[];
  /** koʻp bosqichli zanjirdagi qadamlar soni (kind = 'multi_step') */
  steps?: number;
}

/** Koʻp bosqichli savolning bitta qadami */
export interface StepItem {
  text: string;
  options: string[];
}

/** Savol variantlari: oddiy savollarda matnlar, koʻp bosqichli savolda qadamlar */
export type QuestionOptions = string[] | StepItem[];

/** Toʻgʻri javob: variant indeksi, qabul qilinadigan matnlar / oʻng ustun yoki qadam indekslari */
export type CorrectAnswer = number | string[] | number[];

/** Oʻquvchining koʻp bosqichli zanjirdagi holati (faqat oʻziga) */
export interface MyStepsState {
  total: number;
  finished: boolean;
  done: { index: number; selected: number; correct: boolean }[];
  current: { index: number; text: string; options: string[] } | null;
}

export interface StepProgress {
  player_id: string;
  done: number;
  correct: number;
}

export interface TeamQuestionResult {
  correct: number;
  answered: number;
  members: number;
  points: number;
  streak: number;
}

export interface AttackResult {
  from: string;
  to: string;
  damage: number;
  raw_damage: number;
  blocked: number;
  critical: boolean;
  heavy: boolean;
  doubled: boolean;
  correct: number;
  shield_after: number;
  round: number;
}

export interface QuestionPayload {
  id: string;
  round_number: number;
  sequence_number: number;
  points: number;
  base_points: number;
  points_multiplier: number;
  time_limit: number;
  status: GameQuestionStatus;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null;
  image_url: string | null;
  input_spec: InputSpec | null;
  started_at: string | null;
  answers_open_at: string | null;
  deadline: string | null;
  closed_at: string | null;
  answer_count: number;
  correct_answer: CorrectAnswer | null;
  explanation: string | null;
  results: { teams: Record<string, TeamQuestionResult>; attacks: AttackResult[] } | null;
  /** koʻp bosqichli savol qadamlari (oʻquvchiga faqat ochilgandan keyin) */
  steps?: StepItem[] | null;
  /** faqat oʻqituvchi snapshot'ida */
  secret?: {
    correct_answer: CorrectAnswer;
    explanation: string;
    hint: string;
    subject: string;
    grade: number | null;
    category: string;
    difficulty: Difficulty;
  };
}

export interface AnswerRow {
  player_id: string;
  team_id: string | null;
  selected_answer: string;
  submitted_at: string;
  response_ms: number;
  is_correct: boolean | null;
  awarded_points: number;
  /** ball ulushi 0..1 (qisman toʻgʻri javoblar uchun) */
  credit?: number | null;
}

export interface MyAnswer {
  selected_answer: string;
  submitted_at: string;
  response_ms: number;
  is_correct: boolean | null;
  awarded_points: number | null;
  credit?: number | null;
}

export interface GameEvent {
  id: string;
  seq: number;
  event_type: string;
  event_data: Record<string, unknown>;
  team_id: string | null;
  player_id: string | null;
  created_at: string;
}

export interface PlanItem {
  id: string;
  question_id: string;
  round_number: number;
  sequence_number: number;
  status: GameQuestionStatus;
  points: number;
  time_limit: number;
  question_text: string;
  question_type: QuestionType;
  subject: string;
  grade: number | null;
  category: string;
  difficulty: Difficulty;
  image_url: string | null;
  options: QuestionOptions;
  correct_answer: CorrectAnswer;
  answer_count: number;
}

export interface RoundProgress {
  round_number: number;
  total: number;
  done: number;
}

export interface AbilityRequest {
  id: string;
  team_id: string;
  player_id: string | null;
  ability_type: AbilityType;
  created_at: string;
}

export interface AwardEntry {
  player_id: string;
  nickname: string;
  team_id: string | null;
  reason: string;
  manual: boolean;
}

export interface PlayerStat {
  player_id: string;
  nickname: string;
  team_id: string;
  score: number;
  correct: number;
  answered: number;
  possible: number;
  accuracy: number;
  avg_correct_ms: number | null;
  fastest_correct_ms: number | null;
  best_streak: number;
  strategy_points: number;
  improvement: number | null;
  round_points: Record<string, number>;
}

export interface FinalTeamScore {
  team_id: string;
  name: string;
  color: TeamColor;
  spaceship_skin: SpaceshipSkin;
  slot: number;
  score: number;
  shield: number;
  max_shield: number;
  energy: number;
  correct_count: number;
  answered_count: number;
  possible_count: number;
  accuracy: number;
  best_streak: number;
  is_defeated: boolean;
  adjustments: number;
}

export interface GameResults {
  id: string;
  room_id: string;
  winner_team_id: string | null;
  is_tie: boolean;
  final_scores: FinalTeamScore[];
  statistics: {
    questions_played: number;
    players: PlayerStat[];
    rounds: { round: number; teams: Record<string, number> }[];
    fastest_correct: { player_id: string; nickname: string; team_id: string; response_ms: number } | null;
  };
  awards: Partial<Record<AwardKey, AwardEntry | null>>;
  completed_at: string;
}

export interface ScoreAdjustment {
  id: string;
  team_id: string;
  player_id: string | null;
  delta: number;
  reason: string;
  created_at: string;
}

export interface RoomSnapshot {
  role: 'instructor' | 'student';
  server_time: string;
  room: Room;
  teams: Team[];
  players: Player[];
  abilities: TeamAbility[];
  question: QuestionPayload | null;
  answered_player_ids: string[];
  my_answer: MyAnswer | null;
  /** koʻp bosqichli savolda oʻquvchining zanjir holati */
  my_steps?: MyStepsState | null;
  answers: AnswerRow[];
  /** koʻp bosqichli savolda oʻquvchilar progressi (faqat oʻqituvchiga) */
  step_progress?: StepProgress[];
  hints: { team_id: string; hint: string }[];
  ability_requests: AbilityRequest[];
  plan: PlanItem[] | RoundProgress[];
  events: GameEvent[];
  me: Player | null;
  results: GameResults | null;
  adjustments: ScoreAdjustment[];
}

/** Rad etilgan/chiqarilgan oʻquvchi uchun qisqartirilgan snapshot */
export interface LimitedSnapshot {
  role: 'student';
  server_time: string;
  room: Pick<Room, 'id' | 'room_code' | 'title' | 'status'>;
  me: Player;
}

export interface QuestionRecord {
  id: string;
  created_by: string | null;
  subject: string;
  grade: number | null;
  category: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  question_text: string;
  options: QuestionOptions;
  correct_answer: CorrectAnswer;
  explanation: string;
  hint: string;
  image_url: string | null;
  default_points: number;
  default_time_limit: number;
  recommended_round: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type QuestionInput = Omit<QuestionRecord, 'id' | 'created_by' | 'created_at' | 'updated_at'>;

export interface RoomLookup {
  id: string;
  room_code: string;
  title: string;
  status: RoomStatus;
  registration_open: boolean;
  allow_team_choice: boolean;
  max_players: number;
  team_size: number;
  active_players: number;
  teams: { id: string; name: string; color: TeamColor; spaceship_skin: SpaceshipSkin; slot: number; members: number }[];
  my_player: { id: string; nickname: string; status: PlayerStatus; team_id: string | null } | null;
}
