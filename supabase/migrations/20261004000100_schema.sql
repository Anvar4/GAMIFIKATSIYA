-- =====================================================================
-- IT ARENA — Galaktik Jang
-- 1-migratsiya: jadvallar, cheklovlar, indekslar va yordamchi funksiyalar
-- =====================================================================

-- ---------------------------------------------------------------------
-- Standart xona sozlamalari (balans qoidalari). Oʻqituvchi har bir xona
-- uchun ularni oʻzgartirishi mumkin: game_rooms.settings
-- ---------------------------------------------------------------------
create or replace function public.default_room_settings()
returns jsonb
language sql
immutable
as $$
  select '{
    "max_players": 10,
    "team_size": 5,
    "allow_team_choice": false,
    "auto_approve": false,
    "max_shield": 100,
    "max_energy": 100,
    "energy_per_correct": 10,
    "damage_per_correct": 1,
    "attack_threshold": 100,
    "heavy_attack_damage": 8,
    "crit_streak": 3,
    "crit_multiplier": 1.5,
    "final_round_multiplier": 1.5,
    "shield_boost_block": 0.6,
    "shield_regen_per_round": 15,
    "elimination_mode": false,
    "speed_bonus_ratio": 0.5,
    "answer_grace_ms": 1000,
    "ability_voting": false,
    "ability_max_uses": 2,
    "ability_cooldown_seconds": 30,
    "time_freeze_seconds": 10,
    "energy_steal_amount": 20,
    "ability_costs": {
      "shield_boost": 30,
      "double_attack": 40,
      "time_freeze": 25,
      "energy_steal": 35,
      "hint_scan": 20
    },
    "disabled_abilities": [],
    "question_filter": {"subject": null, "grade": null, "categories": []},
    "rounds": {
      "1": {"points": 100, "time_limit": 20, "count": 5},
      "2": {"points": 150, "time_limit": 25, "count": 4},
      "3": {"points": 200, "time_limit": 10, "count": 5, "speed_bonus": true, "scoring_mode": "individual"},
      "4": {"points": 250, "time_limit": 40, "count": 4},
      "5": {"points": 300, "time_limit": 45, "count": 3, "discussion_seconds": 30}
    }
  }'::jsonb
$$;

-- ---------------------------------------------------------------------
-- profiles — har bir auth foydalanuvchi uchun bitta qator
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  role         text not null default 'student' check (role in ('instructor', 'student')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- game_rooms — oʻyin xonasi (sessiya)
-- ---------------------------------------------------------------------
create table public.game_rooms (
  id                          uuid primary key default gen_random_uuid(),
  room_code                   text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  instructor_id               uuid not null references public.profiles (id) on delete cascade,
  title                       text not null default 'IT ARENA — Galaktik jang'
                                check (char_length(title) between 1 and 80),
  status                      text not null default 'lobby'
                                check (status in ('lobby', 'active', 'paused', 'finished', 'archived')),
  phase                       text not null default 'lobby'
                                check (phase in ('lobby', 'round_intro', 'question', 'reveal', 'idle', 'round_end', 'finished')),
  registration_open           boolean not null default true,
  current_round               smallint not null default 0 check (current_round between 0 and 5),
  current_game_question_id    uuid,
  current_question_started_at timestamptz,
  question_deadline           timestamptz,
  paused_at                   timestamptz,
  paused_remaining_ms         integer,
  paused_open_ms              integer,
  next_points_multiplier      numeric(4, 2) not null default 1 check (next_points_multiplier between 1 and 5),
  settings                    jsonb not null default public.default_room_settings(),
  winner_team_id              uuid,
  started_at                  timestamptz,
  finished_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index game_rooms_instructor_idx on public.game_rooms (instructor_id, created_at desc);
create index game_rooms_status_idx on public.game_rooms (status);

-- ---------------------------------------------------------------------
-- teams — har bir xonada 2 ta jamoa (slot 1 = chap, slot 2 = oʻng)
-- ---------------------------------------------------------------------
create table public.teams (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references public.game_rooms (id) on delete cascade,
  slot                 smallint not null check (slot in (1, 2)),
  name                 text not null check (char_length(name) between 1 and 24),
  color                text not null check (color in ('blue', 'red', 'cyan', 'green', 'gold', 'purple')),
  spaceship_skin       text not null check (spaceship_skin in ('falcon', 'phoenix', 'nova', 'titan')),
  score                integer not null default 0,
  shield               integer not null default 100 check (shield >= 0),
  max_shield           integer not null default 100 check (max_shield > 0),
  energy               integer not null default 0 check (energy >= 0),
  streak               integer not null default 0 check (streak >= 0),
  best_streak          integer not null default 0 check (best_streak >= 0),
  correct_count        integer not null default 0 check (correct_count >= 0),
  answered_count       integer not null default 0 check (answered_count >= 0),
  possible_count       integer not null default 0 check (possible_count >= 0),
  shield_boost_active  boolean not null default false,
  double_attack_active boolean not null default false,
  is_defeated          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (room_id, slot)
);

create index teams_room_idx on public.teams (room_id);

alter table public.game_rooms
  add constraint game_rooms_winner_fk
  foreign key (winner_team_id) references public.teams (id) on delete set null;

-- ---------------------------------------------------------------------
-- players — xonaga qoʻshilgan oʻquvchilar (anonim auth foydalanuvchilari)
-- ---------------------------------------------------------------------
create table public.players (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.game_rooms (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  team_id        uuid references public.teams (id) on delete set null,
  nickname       text not null check (char_length(nickname) between 2 and 20),
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'kicked')),
  score          integer not null default 0,
  correct_count  integer not null default 0 check (correct_count >= 0),
  answered_count integer not null default 0 check (answered_count >= 0),
  streak         integer not null default 0 check (streak >= 0),
  best_streak    integer not null default 0 check (best_streak >= 0),
  joined_at      timestamptz not null default now(),
  approved_at    timestamptz,
  last_seen_at   timestamptz not null default now(),
  -- bitta auth identifikatori bitta xonada faqat bitta faol sessiyaga ega
  unique (room_id, user_id)
);

-- bitta xonada faol taxalluslar takrorlanmaydi (katta-kichik harfdan qatʼi nazar)
create unique index players_room_nickname_active_uq
  on public.players (room_id, lower(nickname))
  where status in ('pending', 'approved');
create index players_room_status_idx on public.players (room_id, status);
create index players_user_idx on public.players (user_id);
create index players_team_idx on public.players (team_id);

-- ---------------------------------------------------------------------
-- questions — tahrirlanadigan savollar banki (faqat oʻqituvchilar oʻqiydi)
-- ---------------------------------------------------------------------
-- Bank istalgan fan va sinf (5–11) uchun ishlatiladi: subject = fan,
-- grade = sinf, category = mavzu (erkin matn, Excel orqali ham yuklanadi).
create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  created_by         uuid references public.profiles (id) on delete set null,
  subject            text not null default 'Informatika' check (char_length(subject) between 1 and 60),
  grade              smallint check (grade between 1 and 11),
  category           text not null check (char_length(category) between 1 and 80),
  difficulty         text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  question_type      text not null check (question_type in (
                       'single_choice', 'true_false', 'image_identification',
                       'short_answer', 'logical_puzzle', 'matching', 'multi_step')),
  question_text      text not null check (char_length(question_text) between 3 and 600),
  options            jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct_answer     jsonb not null,
  explanation        text not null default '' check (char_length(explanation) <= 800),
  hint               text not null default '' check (char_length(hint) <= 300),
  image_url          text check (image_url is null or char_length(image_url) <= 500),
  default_points     integer not null default 100 check (default_points between 0 and 2000),
  default_time_limit integer not null default 20 check (default_time_limit between 5 and 300),
  recommended_round  smallint check (recommended_round between 1 and 5),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index questions_active_round_idx on public.questions (is_active, recommended_round);
create index questions_subject_grade_idx on public.questions (subject, grade);
create index questions_category_idx on public.questions (category);

-- ---------------------------------------------------------------------
-- game_questions — xonaning raundlar boʻyicha savollar rejasi.
-- Savol matni/variantlari faqat savol boshlanganda nusxalanadi,
-- toʻgʻri javob esa faqat javob oynasi yopilgandan keyin yoziladi.
-- ---------------------------------------------------------------------
create table public.game_questions (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.game_rooms (id) on delete cascade,
  question_id       uuid not null references public.questions (id) on delete restrict,
  round_number      smallint not null check (round_number between 1 and 5),
  sequence_number   smallint not null check (sequence_number >= 1),
  points            integer not null check (points between 0 and 5000),
  time_limit        integer not null check (time_limit between 5 and 300),
  status            text not null default 'pending'
                      check (status in ('pending', 'active', 'revealed', 'skipped')),
  -- ochiq nusxa (savol boshlanganda toʻldiriladi)
  question_type     text,
  question_text     text,
  options           jsonb,
  image_url         text,
  input_spec        jsonb,
  points_multiplier numeric(4, 2) not null default 1,
  started_at        timestamptz,
  answers_open_at   timestamptz,
  deadline          timestamptz,
  closed_at         timestamptz,
  answer_count      integer not null default 0,
  -- faqat ochilgandan keyin toʻldiriladi
  correct_answer    jsonb,
  explanation       text,
  results           jsonb,
  created_at        timestamptz not null default now(),
  unique (room_id, round_number, sequence_number)
);

create index game_questions_room_status_idx on public.game_questions (room_id, status);
create index game_questions_room_round_idx on public.game_questions (room_id, round_number, sequence_number);

alter table public.game_rooms
  add constraint game_rooms_current_question_fk
  foreign key (current_game_question_id) references public.game_questions (id) on delete set null;

-- ---------------------------------------------------------------------
-- answers — oʻquvchi javoblari (har savolga bitta javob)
-- ---------------------------------------------------------------------
create table public.answers (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.game_rooms (id) on delete cascade,
  game_question_id uuid not null references public.game_questions (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  team_id          uuid references public.teams (id) on delete set null,
  selected_answer  text not null check (char_length(selected_answer) between 1 and 200),
  submitted_at     timestamptz not null default now(),
  response_ms      integer not null default 0 check (response_ms >= 0),
  is_correct       boolean,
  awarded_points   integer not null default 0,
  scored_at        timestamptz,
  unique (player_id, game_question_id)
);

create index answers_question_idx on public.answers (game_question_id, submitted_at);
create index answers_room_idx on public.answers (room_id);
create index answers_team_idx on public.answers (team_id);

-- ---------------------------------------------------------------------
-- game_events — real vaqt hodisalari jurnali (animatsiyalar va audit)
-- ---------------------------------------------------------------------
create table public.game_events (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,
  room_id    uuid not null references public.game_rooms (id) on delete cascade,
  team_id    uuid references public.teams (id) on delete set null,
  player_id  uuid references public.players (id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 40),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_room_seq_idx on public.game_events (room_id, seq desc);

-- ---------------------------------------------------------------------
-- team_abilities — maxsus qobiliyatlar (zaryad va qayta tiklanish)
-- ---------------------------------------------------------------------
create table public.team_abilities (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.game_rooms (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  ability_type   text not null check (ability_type in (
                   'shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan')),
  uses_left      integer not null default 2 check (uses_left >= 0),
  cooldown_until timestamptz,
  is_enabled     boolean not null default true,
  unique (team_id, ability_type)
);

create index team_abilities_room_idx on public.team_abilities (room_id);

-- ---------------------------------------------------------------------
-- ability_requests — jamoa ovoz berishi yoqilganda oʻquvchi soʻrovlari
-- ---------------------------------------------------------------------
create table public.ability_requests (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.game_rooms (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete cascade,
  player_id    uuid references public.players (id) on delete set null,
  ability_type text not null check (ability_type in (
                 'shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan')),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create unique index ability_requests_pending_uq
  on public.ability_requests (team_id, ability_type)
  where status = 'pending';
create index ability_requests_room_idx on public.ability_requests (room_id, status);

-- ---------------------------------------------------------------------
-- team_hints — HINT SCAN natijasi (faqat oʻsha jamoa koʻradi)
-- ---------------------------------------------------------------------
create table public.team_hints (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.game_rooms (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  game_question_id uuid not null references public.game_questions (id) on delete cascade,
  hint             text not null,
  created_at       timestamptz not null default now(),
  unique (team_id, game_question_id)
);

create index team_hints_room_idx on public.team_hints (room_id);

-- ---------------------------------------------------------------------
-- score_adjustments — ballni qoʻlda oʻzgartirishlar auditi
-- ---------------------------------------------------------------------
create table public.score_adjustments (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.game_rooms (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  player_id  uuid references public.players (id) on delete set null,
  delta      integer not null check (delta between -5000 and 5000 and delta <> 0),
  reason     text not null check (char_length(reason) between 3 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index score_adjustments_room_idx on public.score_adjustments (room_id, created_at desc);

-- ---------------------------------------------------------------------
-- game_results — yakuniy natijalar va mukofotlar
-- ---------------------------------------------------------------------
create table public.game_results (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null unique references public.game_rooms (id) on delete cascade,
  winner_team_id uuid references public.teams (id) on delete set null,
  is_tie         boolean not null default false,
  final_scores   jsonb not null default '[]'::jsonb,
  statistics     jsonb not null default '{}'::jsonb,
  awards         jsonb not null default '{}'::jsonb,
  completed_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- rate_limits — oddiy soʻrov chastotasi cheklovi
-- ---------------------------------------------------------------------
create table public.rate_limits (
  user_id      uuid not null,
  action       text not null,
  window_start timestamptz not null default now(),
  hits         integer not null default 0,
  primary key (user_id, action)
);

-- =====================================================================
-- Triggerlar
-- =====================================================================
create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_rooms_touch before update on public.game_rooms
  for each row execute function public._touch_updated_at();
create trigger teams_touch before update on public.teams
  for each row execute function public._touch_updated_at();
create trigger questions_touch before update on public.questions
  for each row execute function public._touch_updated_at();

-- Yangi auth foydalanuvchisi uchun profil (rol har doim 'student').
-- Oʻqituvchi roli faqat promote_to_instructor() orqali beriladi.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), ''), 60),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Savol tuzilmasini tekshirish
create or replace function public._validate_question()
returns trigger
language plpgsql
as $$
declare
  v_len int;
  v_idx int;
  v_opt jsonb;
begin
  new.question_text := btrim(new.question_text);
  new.explanation := btrim(coalesce(new.explanation, ''));
  new.hint := btrim(coalesce(new.hint, ''));
  new.image_url := nullif(btrim(coalesce(new.image_url, '')), '');

  if new.image_url is not null and new.image_url !~ '^(/|https://)' then
    raise exception 'Rasm manzili "/" yoki "https://" bilan boshlanishi kerak' using errcode = '22023';
  end if;

  v_len := jsonb_array_length(new.options);

  if new.question_type in ('single_choice', 'image_identification', 'logical_puzzle', 'true_false') then
    if new.question_type = 'true_false' and v_len <> 2 then
      raise exception 'Toʻgʻri/notoʻgʻri savolida aynan 2 ta variant boʻlishi kerak' using errcode = '22023';
    end if;
    if v_len < 2 or v_len > 6 then
      raise exception 'Variantlar soni 2 dan 6 gacha boʻlishi kerak' using errcode = '22023';
    end if;
    for v_opt in select value from jsonb_array_elements(new.options) loop
      if jsonb_typeof(v_opt) <> 'string' or btrim(v_opt #>> '{}') = '' or char_length(v_opt #>> '{}') > 200 then
        raise exception 'Har bir variant boʻsh boʻlmagan matn (≤200 belgi) boʻlishi kerak' using errcode = '22023';
      end if;
    end loop;
    if jsonb_typeof(new.correct_answer) <> 'number' then
      raise exception 'Toʻgʻri javob variant indeksi (raqam) boʻlishi kerak' using errcode = '22023';
    end if;
    v_idx := (new.correct_answer #>> '{}')::numeric::int;
    if v_idx < 0 or v_idx >= v_len then
      raise exception 'Toʻgʻri javob indeksi variantlar oraligʻidan tashqarida' using errcode = '22023';
    end if;
  elsif new.question_type = 'short_answer' then
    if jsonb_typeof(new.correct_answer) <> 'array' or jsonb_array_length(new.correct_answer) = 0 then
      raise exception 'Qisqa javobli savol uchun kamida bitta qabul qilinadigan javob kerak' using errcode = '22023';
    end if;
    for v_opt in select value from jsonb_array_elements(new.correct_answer) loop
      if jsonb_typeof(v_opt) <> 'string' or btrim(v_opt #>> '{}') = '' then
        raise exception 'Qabul qilinadigan javoblar boʻsh boʻlmagan matn boʻlishi kerak' using errcode = '22023';
      end if;
    end loop;
  end if;

  if new.question_type = 'image_identification' and new.image_url is null then
    raise exception 'Rasmli savol uchun rasm manzili kerak' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger questions_validate before insert or update on public.questions
  for each row execute function public._validate_question();

-- =====================================================================
-- Yordamchi funksiyalar (ruxsatlar)
-- =====================================================================
create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'instructor'
  );
$$;

create or replace function public.owns_room(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_rooms r
    join public.profiles p on p.id = r.instructor_id
    where r.id = p_room and r.instructor_id = auth.uid() and p.role = 'instructor'
  );
$$;

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players
    where room_id = p_room and user_id = auth.uid() and status in ('pending', 'approved')
  );
$$;

create or replace function public.can_view_room(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_room(p_room) or public.is_room_member(p_room);
$$;

create or replace function public.my_team_in_room(p_room uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.players
  where room_id = p_room and user_id = auth.uid() and status = 'approved'
  limit 1;
$$;

-- Sozlamalardan raqam olish
create or replace function public._s_num(p_settings jsonb, p_key text, p_default numeric)
returns numeric
language sql
immutable
as $$
  select coalesce(
    case when jsonb_typeof(p_settings -> p_key) = 'number' then (p_settings ->> p_key)::numeric end,
    p_default
  );
$$;

create or replace function public._s_int(p_settings jsonb, p_key text, p_default int)
returns int
language sql
immutable
as $$
  select round(public._s_num(p_settings, p_key, p_default))::int;
$$;

create or replace function public._s_bool(p_settings jsonb, p_key text, p_default boolean)
returns boolean
language sql
immutable
as $$
  select coalesce(
    case when jsonb_typeof(p_settings -> p_key) = 'boolean' then (p_settings ->> p_key)::boolean end,
    p_default
  );
$$;

-- Javoblarni solishtirish uchun matnni normallashtirish
create or replace function public._normalize_answer(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             translate(lower(btrim(coalesce(p_text, ''))), 'ʻʼ‘’`´', '''''''''''' ),
             '\s+', ' ', 'g'),
           '[.!]+$', '');
$$;

-- Javob toʻgʻriligini tekshirish (faqat server tomonida)
create or replace function public._check_answer(p_type text, p_correct jsonb, p_selected text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_selected is null then
    return false;
  end if;
  if p_type in ('single_choice', 'true_false', 'image_identification', 'logical_puzzle') then
    return p_selected ~ '^[0-9]{1,2}$'
       and jsonb_typeof(p_correct) = 'number'
       and p_selected::int = (p_correct #>> '{}')::numeric::int;
  elsif p_type = 'short_answer' then
    return exists (
      select 1 from jsonb_array_elements_text(p_correct) x
      where public._normalize_answer(x) = public._normalize_answer(p_selected)
    );
  end if;
  return false;
end;
$$;

-- Hodisa yozish
create or replace function public._log_event(
  p_room uuid,
  p_type text,
  p_data jsonb default '{}'::jsonb,
  p_team uuid default null,
  p_player uuid default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.game_events (room_id, team_id, player_id, event_type, event_data)
  values (p_room, p_team, p_player, p_type, coalesce(p_data, '{}'::jsonb));
$$;

-- Soʻrovlar chastotasini cheklash
create or replace function public._rate_limit(p_action text, p_max int, p_window_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits int;
begin
  if auth.uid() is null then
    raise exception 'Avtorizatsiya talab qilinadi' using errcode = '42501';
  end if;
  insert into public.rate_limits as rl (user_id, action, window_start, hits)
  values (auth.uid(), p_action, now(), 1)
  on conflict (user_id, action) do update set
    hits = case
             when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
             else rl.hits + 1
           end,
    window_start = case
             when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
             else rl.window_start
           end
  returning hits into v_hits;
  if v_hits > p_max then
    raise exception 'Juda koʻp soʻrov yuborildi. Bir necha soniya kuting.' using errcode = 'P0001';
  end if;
end;
$$;

-- Takrorlanmas 6 belgili xona kodi (chalkash belgilarsiz: 0/O, 1/I)
create or replace function public._generate_room_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempts int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.game_rooms where room_code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 50 then
      raise exception 'Xona kodini yaratib boʻlmadi' using errcode = 'P0001';
    end if;
  end loop;
  return v_code;
end;
$$;

-- Oʻqituvchi rolini berish (faqat SQL Editor / service_role orqali)
create or replace function public.promote_to_instructor(p_email text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'Bunday email bilan foydalanuvchi topilmadi: %', p_email;
  end if;
  insert into public.profiles (id, display_name, role)
  values (v_id, left(coalesce(p_display_name, split_part(p_email, '@', 1)), 60), 'instructor')
  on conflict (id) do update
    set role = 'instructor',
        display_name = coalesce(left(p_display_name, 60), public.profiles.display_name);
  return v_id;
end;
$$;
