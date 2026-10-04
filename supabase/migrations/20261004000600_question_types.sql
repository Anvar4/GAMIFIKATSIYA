-- =====================================================================
-- 6-migratsiya: "Moslashtirish" (matching) va "Koʻp bosqichli" (multi_step)
-- savol turlari oʻyinda toʻliq ishlaydi.
--
--  * matching:   options        = chap ustun (masalan, qurilmalar)
--                correct_answer = oʻng ustun, chap bilan bir xil tartibda
--                (masalan, "Kiritish", "Chiqarish", ...; takrorlanishi mumkin).
--                Oʻquvchiga oʻng ustun aralashtirilgan "choices" roʻyxati sifatida
--                beriladi, javob — har bir chap element uchun tanlangan indekslar
--                JSON massivi: "[2,0,1]". Qisman toʻgʻri moslash qisman ball oladi.
--  * multi_step: options        = qadamlar: [{"text": "...", "options": ["A","B"]}, ...]
--                correct_answer = har bir qadamning toʻgʻri variant indeksi: [1,0,2]
--                Oʻquvchi qadamlarni ketma-ket yechadi (submit_step). Keyingi qadam
--                faqat oldingisi toʻgʻri boʻlsa ochiladi; xato qadam zanjirni yakunlaydi.
--                Har bir toʻgʻri qadam uchun qisman ball, toʻliq zanjir uchun bonus.
--
-- Mavjud loyihalarda ham xavfsiz qoʻllanadi (faqat "create or replace" va "if not exists").
-- =====================================================================

-- ---------------------------------------------------------------------
-- Sozlamalar: toʻliq zanjir bonusi
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
    "multi_step_bonus": 50,
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

create or replace function public._validate_settings(s jsonb)
returns void
language plpgsql
immutable
as $$
declare
  k text;
  v numeric;
  rk text;
  rv jsonb;
  ranges constant jsonb := '{
    "max_players": [2, 40], "team_size": [1, 20], "max_shield": [10, 1000], "max_energy": [10, 1000],
    "energy_per_correct": [0, 200], "damage_per_correct": [0, 100], "attack_threshold": [1, 1000],
    "heavy_attack_damage": [0, 500], "crit_streak": [1, 20], "crit_multiplier": [1, 5],
    "final_round_multiplier": [1, 5], "shield_boost_block": [0, 1], "shield_regen_per_round": [0, 500],
    "speed_bonus_ratio": [0, 2], "answer_grace_ms": [0, 5000], "ability_max_uses": [0, 20],
    "ability_cooldown_seconds": [0, 600], "time_freeze_seconds": [1, 60], "energy_steal_amount": [0, 500],
    "multi_step_bonus": [0, 1000]
  }';
begin
  for k in select jsonb_object_keys(ranges) loop
    if s ? k then
      if jsonb_typeof(s -> k) <> 'number' then
        raise exception 'Sozlama "%" raqam boʻlishi kerak', k using errcode = '22023';
      end if;
      v := (s ->> k)::numeric;
      if v < (ranges -> k ->> 0)::numeric or v > (ranges -> k ->> 1)::numeric then
        raise exception 'Sozlama "%" % va % oraligʻida boʻlishi kerak', k, ranges -> k ->> 0, ranges -> k ->> 1
          using errcode = '22023';
      end if;
    end if;
  end loop;

  foreach k in array array['allow_team_choice', 'auto_approve', 'elimination_mode', 'ability_voting'] loop
    if s ? k and jsonb_typeof(s -> k) <> 'boolean' then
      raise exception 'Sozlama "%" ha/yoʻq qiymatli boʻlishi kerak', k using errcode = '22023';
    end if;
  end loop;

  if s ? 'ability_costs' then
    for rk, rv in select key, value from jsonb_each(s -> 'ability_costs') loop
      if rk not in ('shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan')
         or jsonb_typeof(rv) <> 'number' or (rv #>> '{}')::numeric < 0 or (rv #>> '{}')::numeric > 1000 then
        raise exception 'Qobiliyat narxi notoʻgʻri: %', rk using errcode = '22023';
      end if;
    end loop;
  end if;

  if s ? 'disabled_abilities' then
    if jsonb_typeof(s -> 'disabled_abilities') <> 'array' then
      raise exception 'disabled_abilities roʻyxat boʻlishi kerak' using errcode = '22023';
    end if;
    for rv in select value from jsonb_array_elements(s -> 'disabled_abilities') loop
      if (rv #>> '{}') not in ('shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan') then
        raise exception 'Nomaʼlum qobiliyat: %', rv using errcode = '22023';
      end if;
    end loop;
  end if;

  if s ? 'question_filter' then
    rv := s -> 'question_filter';
    if jsonb_typeof(rv) <> 'object' then
      raise exception 'Savollar filtri obyekt boʻlishi kerak' using errcode = '22023';
    end if;
    if jsonb_typeof(rv -> 'subject') not in ('null', 'string')
       or char_length(coalesce(rv ->> 'subject', '')) > 60 then
      raise exception 'Fan nomi notoʻgʻri' using errcode = '22023';
    end if;
    if jsonb_typeof(rv -> 'grade') not in ('null', 'number')
       or (rv ->> 'grade')::numeric < 1 or (rv ->> 'grade')::numeric > 11 then
      raise exception 'Sinf 1–11 oraligʻida boʻlishi kerak' using errcode = '22023';
    end if;
    if rv ? 'categories' and (jsonb_typeof(rv -> 'categories') <> 'array'
       or jsonb_array_length(rv -> 'categories') > 50) then
      raise exception 'Mavzular roʻyxati notoʻgʻri' using errcode = '22023';
    end if;
  end if;

  if s ? 'rounds' then
    for rk, rv in select key, value from jsonb_each(s -> 'rounds') loop
      if rk not in ('1', '2', '3', '4', '5') then
        raise exception 'Raund raqami notoʻgʻri: %', rk using errcode = '22023';
      end if;
      if rv ? 'title' and (jsonb_typeof(rv -> 'title') <> 'string' or char_length(rv ->> 'title') > 40) then
        raise exception '%-raund nomi 40 belgidan oshmasligi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'points' and ((rv ->> 'points')::numeric < 0 or (rv ->> 'points')::numeric > 5000) then
        raise exception '%-raund ballari 0–5000 oraligʻida boʻlishi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'time_limit' and ((rv ->> 'time_limit')::numeric < 5 or (rv ->> 'time_limit')::numeric > 300) then
        raise exception '%-raund vaqti 5–300 soniya oraligʻida boʻlishi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'count' and ((rv ->> 'count')::numeric < 0 or (rv ->> 'count')::numeric > 30) then
        raise exception '%-raund savollar soni 0–30 oraligʻida boʻlishi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'discussion_seconds' and ((rv ->> 'discussion_seconds')::numeric < 0 or (rv ->> 'discussion_seconds')::numeric > 300) then
        raise exception '%-raund muhokama vaqti 0–300 soniya oraligʻida boʻlishi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'speed_bonus' and jsonb_typeof(rv -> 'speed_bonus') <> 'boolean' then
        raise exception '%-raund speed_bonus ha/yoʻq boʻlishi kerak', rk using errcode = '22023';
      end if;
      if rv ? 'scoring_mode' and (rv ->> 'scoring_mode') not in ('individual', 'team_first') then
        raise exception '%-raund hisoblash rejimi notoʻgʻri', rk using errcode = '22023';
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Yangi ustun va jadval
-- ---------------------------------------------------------------------
-- Javob uchun berilgan ball ulushi (0..1): oddiy savollarda 0 yoki 1,
-- moslashtirish va koʻp bosqichli savollarda qisman boʻlishi mumkin.
alter table public.answers
  add column if not exists credit numeric(5, 4)
  check (credit is null or (credit >= 0 and credit <= 1));

create table if not exists public.answer_steps (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.game_rooms (id) on delete cascade,
  game_question_id uuid not null references public.game_questions (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  step_index       smallint not null check (step_index between 0 and 9),
  selected_answer  smallint not null check (selected_answer between 0 and 9),
  is_correct       boolean not null,
  submitted_at     timestamptz not null default now(),
  unique (player_id, game_question_id, step_index)
);

create index if not exists answer_steps_question_idx on public.answer_steps (game_question_id, player_id);
create index if not exists answer_steps_room_idx on public.answer_steps (room_id);

alter table public.answer_steps enable row level security;

drop policy if exists answer_steps_select on public.answer_steps;
create policy answer_steps_select on public.answer_steps
  for select to authenticated
  using (
    public.owns_room(room_id)
    or player_id in (select id from public.players where user_id = auth.uid())
  );

-- Supabase yangi jadvallarga avtomatik huquq beradi — faqat oʻqishni qoldiramiz
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.answer_steps from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.answer_steps from authenticated';
    execute 'grant select on public.answer_steps to authenticated';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Savol tuzilmasini tekshirish (yangi turlar bilan)
-- ---------------------------------------------------------------------
create or replace function public._validate_question()
returns trigger
language plpgsql
as $$
declare
  v_len int;
  v_idx int;
  v_opt jsonb;
  v_step jsonb;
  v_step_len int;
  i int;
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
  elsif new.question_type = 'matching' then
    -- options: chap ustun, correct_answer: oʻng ustun (bir xil uzunlikda)
    if v_len < 2 or v_len > 6 then
      raise exception 'Moslashtirish savolida 2 dan 6 gacha juftlik boʻlishi kerak' using errcode = '22023';
    end if;
    if jsonb_typeof(new.correct_answer) <> 'array' or jsonb_array_length(new.correct_answer) <> v_len then
      raise exception 'Har bir chap element uchun bitta mos javob (oʻng ustun) boʻlishi kerak' using errcode = '22023';
    end if;
    for v_opt in select value from jsonb_array_elements(new.options) union all select value from jsonb_array_elements(new.correct_answer) loop
      if jsonb_typeof(v_opt) <> 'string' or btrim(v_opt #>> '{}') = '' or char_length(v_opt #>> '{}') > 200 then
        raise exception 'Juftlik elementlari boʻsh boʻlmagan matn (≤200 belgi) boʻlishi kerak' using errcode = '22023';
      end if;
    end loop;
    -- trigger oʻqituvchi huquqi bilan ishlaydi, shuning uchun ichki yordamchi funksiyalar chaqirilmaydi
    if (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(new.correct_answer) x) < 2 then
      raise exception 'Oʻng ustunda kamida 2 xil javob boʻlishi kerak' using errcode = '22023';
    end if;
  elsif new.question_type = 'multi_step' then
    -- options: [{"text": "...", "options": [...]}, ...], correct_answer: [indeks, ...]
    if v_len < 2 or v_len > 5 then
      raise exception 'Koʻp bosqichli savolda 2 dan 5 gacha qadam boʻlishi kerak' using errcode = '22023';
    end if;
    if jsonb_typeof(new.correct_answer) <> 'array' or jsonb_array_length(new.correct_answer) <> v_len then
      raise exception 'Har bir qadam uchun toʻgʻri javob indeksi boʻlishi kerak' using errcode = '22023';
    end if;
    for i in 0 .. v_len - 1 loop
      v_step := new.options -> i;
      if jsonb_typeof(v_step) <> 'object' or jsonb_typeof(v_step -> 'text') <> 'string'
         or char_length(btrim(v_step ->> 'text')) < 2 or char_length(v_step ->> 'text') > 300
         or jsonb_typeof(v_step -> 'options') <> 'array' then
        raise exception '%-qadam notoʻgʻri tuzilgan (matn va variantlar kerak)', i + 1 using errcode = '22023';
      end if;
      v_step_len := jsonb_array_length(v_step -> 'options');
      if v_step_len < 2 or v_step_len > 4 then
        raise exception '%-qadamda 2 dan 4 gacha variant boʻlishi kerak', i + 1 using errcode = '22023';
      end if;
      for v_opt in select value from jsonb_array_elements(v_step -> 'options') loop
        if jsonb_typeof(v_opt) <> 'string' or btrim(v_opt #>> '{}') = '' or char_length(v_opt #>> '{}') > 200 then
          raise exception '%-qadam variantlari boʻsh boʻlmagan matn boʻlishi kerak', i + 1 using errcode = '22023';
        end if;
      end loop;
      if jsonb_typeof(new.correct_answer -> i) <> 'number'
         or (new.correct_answer ->> i)::numeric::int < 0
         or (new.correct_answer ->> i)::numeric::int >= v_step_len then
        raise exception '%-qadamning toʻgʻri javob indeksi notoʻgʻri', i + 1 using errcode = '22023';
      end if;
    end loop;
  end if;

  if new.question_type = 'image_identification' and new.image_url is null then
    raise exception 'Rasmli savol uchun rasm manzili kerak' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public._playable_types()
returns text[]
language sql
immutable
as $$
  select array['single_choice', 'true_false', 'image_identification', 'short_answer', 'logical_puzzle', 'matching', 'multi_step'];
$$;

-- Moslashtirish: nechta juftlik toʻgʻri tanlangan
create or replace function public._matching_hits(p_correct jsonb, p_choices jsonb, p_selected text)
returns int
language plpgsql
immutable
as $$
declare
  v_sel jsonb;
  v_hits int := 0;
  v_idx int;
  i int;
begin
  if p_correct is null or p_choices is null or p_selected is null then
    return 0;
  end if;
  begin
    v_sel := p_selected::jsonb;
  exception when others then
    return 0;
  end;
  if jsonb_typeof(v_sel) <> 'array' then
    return 0;
  end if;
  for i in 0 .. jsonb_array_length(p_correct) - 1 loop
    if jsonb_typeof(v_sel -> i) = 'number' then
      v_idx := (v_sel ->> i)::numeric::int;
      if v_idx >= 0 and v_idx < jsonb_array_length(p_choices)
         and public._normalize_answer(p_choices ->> v_idx) = public._normalize_answer(p_correct ->> i) then
        v_hits := v_hits + 1;
      end if;
    end if;
  end loop;
  return v_hits;
end;
$$;

-- ---------------------------------------------------------------------
-- Savolni boshlash (moslashtirish uchun aralashtirilgan tanlov,
-- koʻp bosqichli savol uchun faqat qadamlar soni ochiq boʻladi)
-- ---------------------------------------------------------------------
create or replace function public.start_question(
  p_room uuid,
  p_gq uuid default null,
  p_discussion_seconds int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  gq public.game_questions;
  q public.questions;
  cfg jsonb;
  v_disc int;
  v_open timestamptz;
  v_deadline timestamptz;
  v_spec jsonb := null;
  v_len int;
begin
  r := public._lock_owned_room(p_room);
  if r.status = 'paused' then
    raise exception 'Oʻyin pauzada — avval davom ettiring' using errcode = 'P0001';
  end if;
  if r.status <> 'active' then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.game_questions where id = r.current_game_question_id and status = 'active') then
    raise exception 'Joriy savol hali yakunlanmagan' using errcode = 'P0001';
  end if;

  if p_gq is null then
    select * into gq from public.game_questions
     where room_id = p_room and status = 'pending' and round_number = greatest(r.current_round, 1)
     order by sequence_number
     limit 1
     for update;
    if not found then
      raise exception 'Bu raundda boshqa savol qolmadi. Keyingi raundni boshlang.' using errcode = 'P0001';
    end if;
  else
    select * into gq from public.game_questions where id = p_gq and room_id = p_room for update;
    if not found then
      raise exception 'Savol topilmadi' using errcode = 'P0002';
    end if;
    if gq.status <> 'pending' then
      raise exception 'Bu savol allaqachon oʻynalgan' using errcode = 'P0001';
    end if;
  end if;

  select * into q from public.questions where id = gq.question_id;
  if not (q.question_type = any (public._playable_types())) then
    raise exception 'Bu savol turi hozircha oʻyinda qoʻllab-quvvatlanmaydi' using errcode = 'P0001';
  end if;

  cfg := coalesce(r.settings -> 'rounds' -> (gq.round_number::text), '{}'::jsonb);
  v_disc := greatest(0, least(300, coalesce(p_discussion_seconds, (cfg ->> 'discussion_seconds')::int, 0)));
  v_open := now() + make_interval(secs => v_disc);
  v_deadline := v_open + make_interval(secs => gq.time_limit);

  if q.question_type = 'short_answer' then
    if not exists (select 1 from jsonb_array_elements_text(q.correct_answer) x where x !~ '^[0-9]+$') then
      select min(char_length(x)) into v_len from jsonb_array_elements_text(q.correct_answer) x;
      v_spec := jsonb_build_object('kind', 'code', 'length', v_len);
    else
      v_spec := jsonb_build_object('kind', 'text');
    end if;
  elsif q.question_type = 'matching' then
    -- oʻng ustundagi takrorlanmas javoblar tasodifiy tartibda (toʻgʻri juftliklar sir qoladi)
    v_spec := jsonb_build_object('kind', 'matching', 'choices', (
      select jsonb_agg(d.x order by random())
        from (select distinct value as x from jsonb_array_elements_text(q.correct_answer)) d
    ));
  elsif q.question_type = 'multi_step' then
    v_spec := jsonb_build_object('kind', 'multi_step', 'steps', jsonb_array_length(q.options));
  end if;

  update public.game_questions
     set status = 'active', question_type = q.question_type, question_text = q.question_text,
         options = case when q.question_type = 'multi_step' then null else q.options end,
         image_url = q.image_url, input_spec = v_spec,
         points_multiplier = r.next_points_multiplier, started_at = now(), answers_open_at = v_open,
         deadline = v_deadline, closed_at = null, answer_count = 0, correct_answer = null,
         explanation = null, results = null
   where id = gq.id;

  update public.game_rooms
     set current_game_question_id = gq.id, current_round = gq.round_number,
         current_question_started_at = now(), question_deadline = v_deadline, phase = 'question',
         next_points_multiplier = 1, paused_remaining_ms = null, paused_open_ms = null
   where id = p_room;

  perform public._log_event(p_room, 'question_started', jsonb_build_object(
    'game_question_id', gq.id, 'round', gq.round_number, 'sequence', gq.sequence_number,
    'points', round(gq.points * r.next_points_multiplier), 'deadline', v_deadline,
    'answers_open_at', v_open, 'discussion_seconds', v_disc));
  return jsonb_build_object('game_question_id', gq.id, 'deadline', v_deadline, 'answers_open_at', v_open);
end;
$$;

-- ---------------------------------------------------------------------
-- Javobni baholash (qisman ball va zanjir bonusi bilan)
-- ---------------------------------------------------------------------
create or replace function public._score_question(p_room public.game_rooms, p_gq public.game_questions)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb := p_room.settings;
  cfg jsonb := coalesce(p_room.settings -> 'rounds' -> (p_gq.round_number::text), '{}'::jsonb);
  q public.questions;
  v_base int := round(p_gq.points * p_gq.points_multiplier)::int;
  v_speed boolean := coalesce((cfg ->> 'speed_bonus')::boolean, false);
  v_ratio numeric := public._s_num(s, 'speed_bonus_ratio', 0.5);
  v_team_first boolean := coalesce(cfg ->> 'scoring_mode', 'individual') = 'team_first';
  v_limit_ms numeric := greatest(1, p_gq.time_limit * 1000);
  v_max_energy int := public._s_int(s, 'max_energy', 100);
  v_epc int := public._s_int(s, 'energy_per_correct', 10);
  v_dpc numeric := public._s_num(s, 'damage_per_correct', 1);
  v_threshold int := public._s_int(s, 'attack_threshold', 100);
  v_heavy int := public._s_int(s, 'heavy_attack_damage', 8);
  v_crit_streak int := public._s_int(s, 'crit_streak', 3);
  v_crit_mult numeric := public._s_num(s, 'crit_multiplier', 1.5);
  v_final_mult numeric := case when p_gq.round_number = 5 then public._s_num(s, 'final_round_multiplier', 1.5) else 1 end;
  v_block numeric := public._s_num(s, 'shield_boost_block', 0.6);
  v_elim boolean := public._s_bool(s, 'elimination_mode', false);
  v_step_bonus int := public._s_int(s, 'multi_step_bonus', 50);
  v_parts int;
  t public.teams;
  opp public.teams;
  pl record;
  a jsonb;
  v_members int;
  v_answered int;
  v_correct int;
  v_pts int;
  v_success boolean;
  v_new_streak int;
  v_team_results jsonb := '{}'::jsonb;
  v_attacks jsonb := '[]'::jsonb;
  v_applied jsonb := '[]'::jsonb;
  v_shield_down jsonb := '[]'::jsonb;
  v_dmg numeric;
  v_dmg_int int;
  v_crit boolean;
  v_heavy_hit boolean;
  v_doubled boolean;
  v_blocked int;
  v_new_shield int;
begin
  select * into q from public.questions where id = p_gq.question_id;
  v_parts := case when jsonb_typeof(q.correct_answer) = 'array' then greatest(1, jsonb_array_length(q.correct_answer)) else 1 end;

  -- 0) Koʻp bosqichli: vaqt tugaganda tugallanmagan zanjirlar ham hisobga olinadi
  if q.question_type = 'multi_step' then
    insert into public.answers (room_id, game_question_id, player_id, team_id, selected_answer, response_ms, submitted_at)
    select p_room.id, p_gq.id, st.player_id, p.team_id,
           jsonb_agg(st.selected_answer order by st.step_index)::text,
           greatest(0, floor(extract(epoch from (least(max(st.submitted_at), p_gq.deadline) - p_gq.answers_open_at)) * 1000))::int,
           max(st.submitted_at)
      from public.answer_steps st
      join public.players p on p.id = st.player_id
     where st.game_question_id = p_gq.id
       and p.status = 'approved' and p.team_id is not null
       and not exists (
         select 1 from public.answers x where x.player_id = st.player_id and x.game_question_id = p_gq.id
       )
     group by st.player_id, p.team_id
    on conflict (player_id, game_question_id) do nothing;
  end if;

  -- 1) Javoblar toʻgʻriligi, ball ulushi (credit) va ballari
  if q.question_type = 'matching' then
    update public.answers a
       set credit = round(public._matching_hits(q.correct_answer, p_gq.input_spec -> 'choices', a.selected_answer)::numeric / v_parts, 4),
           scored_at = now()
     where a.game_question_id = p_gq.id;
    update public.answers a set is_correct = (a.credit >= 1) where a.game_question_id = p_gq.id;
  elsif q.question_type = 'multi_step' then
    update public.answers a
       set credit = round((
             select count(*) filter (where st.is_correct)
               from public.answer_steps st
              where st.game_question_id = a.game_question_id and st.player_id = a.player_id
           )::numeric / v_parts, 4),
           scored_at = now()
     where a.game_question_id = p_gq.id;
    update public.answers a set is_correct = (a.credit >= 1) where a.game_question_id = p_gq.id;
  else
    update public.answers a
       set is_correct = public._check_answer(q.question_type, q.correct_answer, a.selected_answer),
           scored_at = now()
     where a.game_question_id = p_gq.id;
    update public.answers a set credit = case when a.is_correct then 1 else 0 end where a.game_question_id = p_gq.id;
  end if;

  update public.answers a
     set awarded_points = case
           when a.is_correct then v_base
             + case when v_speed then floor(v_base * v_ratio * greatest(0, 1 - a.response_ms / v_limit_ms))::int else 0 end
             + case when q.question_type = 'multi_step' then v_step_bonus else 0 end
           -- qisman toʻgʻri moslash / qisman bajarilgan zanjir
           when q.question_type in ('matching', 'multi_step') then floor(v_base * coalesce(a.credit, 0))::int
           else 0 end
   where a.game_question_id = p_gq.id;

  if v_team_first then
    -- jamoada faqat birinchi toʻliq toʻgʻri javob ball oladi
    update public.answers a
       set awarded_points = 0
     where a.game_question_id = p_gq.id
       and (
         not coalesce(a.is_correct, false)
         or exists (
           select 1 from public.answers b
            where b.game_question_id = a.game_question_id and b.team_id = a.team_id and b.is_correct
              and (b.submitted_at < a.submitted_at or (b.submitted_at = a.submitted_at and b.id < a.id))
         )
       );
  end if;

  -- 2) Oʻquvchilar statistikasi
  for pl in
    select p.id, a2.id as answer_id, coalesce(a2.is_correct, false) as ok, coalesce(a2.awarded_points, 0) as pts
      from public.players p
      left join public.answers a2 on a2.player_id = p.id and a2.game_question_id = p_gq.id
     where p.room_id = p_room.id and p.status = 'approved' and p.team_id is not null
  loop
    update public.players
       set score = score + pl.pts,
           correct_count = correct_count + case when pl.ok then 1 else 0 end,
           answered_count = answered_count + case when pl.answer_id is not null then 1 else 0 end,
           streak = case when pl.ok then streak + 1 else 0 end,
           best_streak = greatest(best_streak, case when pl.ok then streak + 1 else 0 end)
     where id = pl.id;
  end loop;

  -- 3) Jamoa natijalari, energiya va seriya
  for t in select * from public.teams where room_id = p_room.id order by slot for update loop
    select count(*), count(a2.id), count(a2.id) filter (where a2.is_correct), coalesce(sum(a2.awarded_points), 0)
      into v_members, v_answered, v_correct, v_pts
      from public.players p
      left join public.answers a2 on a2.player_id = p.id and a2.game_question_id = p_gq.id
     where p.team_id = t.id and p.status = 'approved';

    v_success := v_correct > 0 and v_correct * 2 >= greatest(v_members, 1);
    v_new_streak := case when v_success then t.streak + 1 else 0 end;

    update public.teams
       set score = score + v_pts,
           correct_count = correct_count + v_correct,
           answered_count = answered_count + v_answered,
           possible_count = possible_count + v_members,
           streak = v_new_streak,
           best_streak = greatest(best_streak, v_new_streak),
           energy = least(v_max_energy, energy + v_correct * v_epc)
     where id = t.id;

    v_team_results := v_team_results || jsonb_build_object(t.id::text, jsonb_build_object(
      'correct', v_correct, 'answered', v_answered, 'members', v_members, 'points', v_pts, 'streak', v_new_streak));
  end loop;

  -- 4) Zarbalar (yangilangan holat asosida hisoblanadi, bir vaqtda qoʻllanadi)
  for t in select * from public.teams where room_id = p_room.id order by slot loop
    v_correct := coalesce((v_team_results -> t.id::text ->> 'correct')::int, 0);
    if v_correct = 0 then
      continue;
    end if;
    if v_elim and t.is_defeated then
      continue;
    end if;
    select * into opp from public.teams where room_id = p_room.id and id <> t.id limit 1;
    if not found then
      continue;
    end if;

    v_crit := t.streak >= v_crit_streak;
    v_heavy_hit := t.energy >= v_threshold;
    v_dmg := v_correct * v_dpc + case when v_heavy_hit then v_heavy else 0 end;
    if v_crit then
      v_dmg := v_dmg * v_crit_mult;
    end if;
    v_dmg := v_dmg * v_final_mult;
    v_doubled := t.double_attack_active;
    if v_doubled then
      v_dmg := v_dmg * 2;
    end if;
    v_dmg_int := ceil(v_dmg)::int;

    update public.teams
       set energy = energy - case when v_heavy_hit then v_threshold else 0 end,
           double_attack_active = false
     where id = t.id;

    v_attacks := v_attacks || jsonb_build_array(jsonb_build_object(
      'from', t.id, 'to', opp.id, 'damage', v_dmg_int, 'critical', v_crit,
      'heavy', v_heavy_hit, 'doubled', v_doubled, 'correct', v_correct));
  end loop;

  for a in select value from jsonb_array_elements(v_attacks) loop
    select * into opp from public.teams where id = (a ->> 'to')::uuid for update;
    v_dmg_int := (a ->> 'damage')::int;
    v_blocked := 0;
    if opp.shield_boost_active then
      v_blocked := least(v_dmg_int, ceil(v_dmg_int * v_block)::int);
      v_dmg_int := v_dmg_int - v_blocked;
    end if;
    v_new_shield := greatest(0, opp.shield - v_dmg_int);
    update public.teams
       set shield = v_new_shield,
           shield_boost_active = false,
           is_defeated = is_defeated or (v_elim and v_new_shield = 0)
     where id = opp.id;
    v_applied := v_applied || jsonb_build_array(a || jsonb_build_object(
      'raw_damage', (a ->> 'damage')::int, 'damage', v_dmg_int, 'blocked', v_blocked,
      'shield_after', v_new_shield, 'round', p_gq.round_number));
    if v_new_shield = 0 and opp.shield > 0 then
      v_shield_down := v_shield_down || jsonb_build_array(jsonb_build_object('team_id', opp.id, 'eliminated', v_elim));
    end if;
  end loop;

  -- 5) Savolni yopish va toʻgʻri javobni ochish
  update public.game_questions
     set status = 'revealed', closed_at = now(), correct_answer = q.correct_answer,
         explanation = q.explanation,
         answer_count = (select count(*) from public.answers x where x.game_question_id = p_gq.id),
         results = jsonb_build_object('teams', v_team_results, 'attacks', v_applied)
   where id = p_gq.id;

  update public.game_rooms
     set phase = 'reveal', question_deadline = null, paused_remaining_ms = null, paused_open_ms = null
   where id = p_room.id;

  perform public._log_event(p_room.id, 'question_revealed', jsonb_build_object(
    'game_question_id', p_gq.id, 'round', p_gq.round_number, 'correct_answer', q.correct_answer,
    'teams', v_team_results));
  for a in select value from jsonb_array_elements(v_applied) loop
    perform public._log_event(p_room.id, 'attack', a, (a ->> 'from')::uuid);
  end loop;
  for a in select value from jsonb_array_elements(v_shield_down) loop
    perform public._log_event(p_room.id, 'shield_down', a, (a ->> 'team_id')::uuid);
  end loop;

  return jsonb_build_object('teams', v_team_results, 'attacks', v_applied);
end;
$$;

-- ---------------------------------------------------------------------
-- Bitta javob yuborish (koʻp bosqichli savollar submit_step orqali)
-- ---------------------------------------------------------------------
create or replace function public.submit_answer(p_gq uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
  r public.game_rooms;
  gq public.game_questions;
  pl public.players;
  v_ans text;
  v_arr jsonb;
  v_choices int;
  v_id uuid;
  v_resp int;
  v_cnt int;
  v_total int;
  v_grace int;
  i int;
begin
  if v_uid is null then
    raise exception 'Avtorizatsiya talab qilinadi' using errcode = '42501';
  end if;
  perform public._rate_limit('submit_answer', 30, 10);

  select room_id into v_room from public.game_questions where id = p_gq;
  if v_room is null then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;

  select * into r from public.game_rooms where id = v_room for update;
  select * into gq from public.game_questions where id = p_gq for update;
  select * into pl from public.players where room_id = v_room and user_id = v_uid;
  if not found or pl.status <> 'approved' then
    raise exception 'Siz bu oʻyinda tasdiqlangan ishtirokchi emassiz' using errcode = '42501';
  end if;
  if pl.team_id is null then
    raise exception 'Siz hali jamoaga biriktirilmagansiz' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.answers where player_id = pl.id and game_question_id = p_gq) then
    return jsonb_build_object('accepted', false, 'duplicate', true);
  end if;

  if r.status = 'paused' then
    raise exception 'Oʻyin pauzada — javob hozircha qabul qilinmaydi' using errcode = 'P0001';
  end if;
  if r.status <> 'active' then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if gq.status <> 'active' then
    raise exception 'Bu savolga javob berish vaqti tugagan' using errcode = 'P0001';
  end if;
  if gq.question_type = 'multi_step' then
    raise exception 'Koʻp bosqichli savolga javob qadamma-qadam yuboriladi' using errcode = '22023';
  end if;
  if now() < gq.answers_open_at then
    raise exception 'Jamoaviy muhokama hali davom etmoqda' using errcode = 'P0001';
  end if;
  v_grace := public._s_int(r.settings, 'answer_grace_ms', 1000);
  if now() > gq.deadline + make_interval(secs => v_grace / 1000.0) then
    raise exception 'Vaqt tugadi — javob qabul qilinmadi' using errcode = 'P0001';
  end if;

  v_ans := btrim(coalesce(p_answer, ''));
  if gq.question_type in ('single_choice', 'true_false', 'image_identification', 'logical_puzzle') then
    if v_ans !~ '^[0-9]{1,2}$' or v_ans::int >= jsonb_array_length(coalesce(gq.options, '[]'::jsonb)) then
      raise exception 'Notoʻgʻri variant tanlandi' using errcode = '22023';
    end if;
  elsif gq.question_type = 'matching' then
    begin
      v_arr := v_ans::jsonb;
    exception when others then
      raise exception 'Moslashtirish javobi notoʻgʻri formatda' using errcode = '22023';
    end;
    v_choices := jsonb_array_length(coalesce(gq.input_spec -> 'choices', '[]'::jsonb));
    if jsonb_typeof(v_arr) <> 'array' or jsonb_array_length(v_arr) <> jsonb_array_length(coalesce(gq.options, '[]'::jsonb)) then
      raise exception 'Har bir element uchun bitta javob tanlang' using errcode = '22023';
    end if;
    for i in 0 .. jsonb_array_length(v_arr) - 1 loop
      if jsonb_typeof(v_arr -> i) <> 'number' or (v_arr ->> i) !~ '^[0-9]{1,2}$' or (v_arr ->> i)::int >= v_choices then
        raise exception 'Moslashtirish javobi notoʻgʻri' using errcode = '22023';
      end if;
    end loop;
    v_ans := v_arr::text;
  else
    if char_length(v_ans) < 1 or char_length(v_ans) > 100 then
      raise exception 'Javob 1–100 belgidan iborat boʻlishi kerak' using errcode = '22023';
    end if;
  end if;

  v_resp := greatest(0, floor(extract(epoch from (least(now(), gq.deadline) - gq.answers_open_at)) * 1000))::int;

  insert into public.answers (room_id, game_question_id, player_id, team_id, selected_answer, response_ms)
  values (v_room, p_gq, pl.id, pl.team_id, v_ans, v_resp)
  on conflict (player_id, game_question_id) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('accepted', false, 'duplicate', true);
  end if;

  update public.game_questions set answer_count = answer_count + 1 where id = p_gq
  returning answer_count into v_cnt;
  update public.players set last_seen_at = now() where id = pl.id;

  perform public._log_event(v_room, 'answer_submitted',
    jsonb_build_object('game_question_id', p_gq, 'answer_count', v_cnt), pl.team_id, pl.id);

  select count(*) into v_total
    from public.players where room_id = v_room and status = 'approved' and team_id is not null;
  if v_cnt >= v_total then
    select * into gq from public.game_questions where id = p_gq;
    perform public._score_question(r, gq);
  end if;

  return jsonb_build_object('accepted', true, 'submitted_at', now(), 'response_ms', v_resp,
                            'auto_closed', v_cnt >= v_total);
end;
$$;

-- ---------------------------------------------------------------------
-- Koʻp bosqichli savol: bitta qadamni yuborish.
-- Qadamlarni oʻtkazib yuborish yoki qayta yuborish mumkin emas — server
-- keyingi kutilgan qadam raqamini tekshiradi. Natija va keyingi qadam
-- matni faqat shu oʻquvchiga qaytariladi.
-- ---------------------------------------------------------------------
create or replace function public.submit_step(p_gq uuid, p_step int, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
  r public.game_rooms;
  gq public.game_questions;
  pl public.players;
  q public.questions;
  v_steps jsonb;
  v_n int;
  v_done int;
  v_wrong int;
  v_choice int;
  v_ok boolean;
  v_finished boolean;
  v_grace int;
  v_sel jsonb;
  v_resp int;
  v_cnt int;
  v_total int;
  v_auto boolean := false;
begin
  if v_uid is null then
    raise exception 'Avtorizatsiya talab qilinadi' using errcode = '42501';
  end if;
  perform public._rate_limit('submit_step', 40, 10);

  select room_id into v_room from public.game_questions where id = p_gq;
  if v_room is null then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;

  select * into r from public.game_rooms where id = v_room for update;
  select * into gq from public.game_questions where id = p_gq for update;
  select * into pl from public.players where room_id = v_room and user_id = v_uid;
  if not found or pl.status <> 'approved' then
    raise exception 'Siz bu oʻyinda tasdiqlangan ishtirokchi emassiz' using errcode = '42501';
  end if;
  if pl.team_id is null then
    raise exception 'Siz hali jamoaga biriktirilmagansiz' using errcode = 'P0001';
  end if;
  if gq.question_type is distinct from 'multi_step' then
    raise exception 'Bu savol koʻp bosqichli emas' using errcode = '22023';
  end if;
  if exists (select 1 from public.answers where player_id = pl.id and game_question_id = p_gq) then
    return jsonb_build_object('accepted', false, 'finished', true, 'duplicate', true);
  end if;
  if r.status = 'paused' then
    raise exception 'Oʻyin pauzada — javob hozircha qabul qilinmaydi' using errcode = 'P0001';
  end if;
  if r.status <> 'active' then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if gq.status <> 'active' then
    raise exception 'Bu savolga javob berish vaqti tugagan' using errcode = 'P0001';
  end if;
  if now() < gq.answers_open_at then
    raise exception 'Jamoaviy muhokama hali davom etmoqda' using errcode = 'P0001';
  end if;
  v_grace := public._s_int(r.settings, 'answer_grace_ms', 1000);
  if now() > gq.deadline + make_interval(secs => v_grace / 1000.0) then
    raise exception 'Vaqt tugadi — javob qabul qilinmadi' using errcode = 'P0001';
  end if;

  select * into q from public.questions where id = gq.question_id;
  v_steps := q.options;
  v_n := jsonb_array_length(v_steps);

  select count(*), count(*) filter (where not is_correct)
    into v_done, v_wrong
    from public.answer_steps
   where player_id = pl.id and game_question_id = p_gq;
  if v_wrong > 0 or v_done >= v_n then
    raise exception 'Zanjir allaqachon yakunlangan' using errcode = 'P0001';
  end if;
  if p_step is distinct from v_done then
    raise exception 'Avval %-qadamni bajaring — qadamlarni oʻtkazib yuborib boʻlmaydi', v_done + 1 using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_answer, '')) !~ '^[0-9]{1,2}$'
     or btrim(p_answer)::int >= jsonb_array_length(v_steps -> v_done -> 'options') then
    raise exception 'Notoʻgʻri variant tanlandi' using errcode = '22023';
  end if;
  v_choice := btrim(p_answer)::int;
  v_ok := v_choice = (q.correct_answer ->> v_done)::numeric::int;

  insert into public.answer_steps (room_id, game_question_id, player_id, step_index, selected_answer, is_correct)
  values (v_room, p_gq, pl.id, v_done, v_choice, v_ok)
  on conflict (player_id, game_question_id, step_index) do nothing;
  if not found then
    return jsonb_build_object('accepted', false, 'duplicate', true);
  end if;

  v_finished := (not v_ok) or (v_done + 1 >= v_n);
  update public.players set last_seen_at = now() where id = pl.id;
  perform public._log_event(v_room, 'step_submitted',
    jsonb_build_object('game_question_id', p_gq, 'step', v_done + 1, 'steps', v_n), pl.team_id, pl.id);

  if v_finished then
    select coalesce(jsonb_agg(selected_answer order by step_index), '[]'::jsonb) into v_sel
      from public.answer_steps where player_id = pl.id and game_question_id = p_gq;
    v_resp := greatest(0, floor(extract(epoch from (least(now(), gq.deadline) - gq.answers_open_at)) * 1000))::int;
    insert into public.answers (room_id, game_question_id, player_id, team_id, selected_answer, response_ms)
    values (v_room, p_gq, pl.id, pl.team_id, v_sel::text, v_resp)
    on conflict (player_id, game_question_id) do nothing;
    if found then
      update public.game_questions set answer_count = answer_count + 1 where id = p_gq
      returning answer_count into v_cnt;
      perform public._log_event(v_room, 'answer_submitted',
        jsonb_build_object('game_question_id', p_gq, 'answer_count', v_cnt), pl.team_id, pl.id);
      select count(*) into v_total
        from public.players where room_id = v_room and status = 'approved' and team_id is not null;
      if v_cnt >= v_total then
        select * into gq from public.game_questions where id = p_gq;
        perform public._score_question(r, gq);
        v_auto := true;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'step', v_done,
    'correct', v_ok,
    'finished', v_finished,
    'auto_closed', v_auto,
    'next', case when v_ok and not v_finished then jsonb_build_object(
      'index', v_done + 1,
      'text', v_steps -> (v_done + 1) ->> 'text',
      'options', v_steps -> (v_done + 1) -> 'options') end
  );
end;
$$;

-- Qayta boshlash / oʻtkazib yuborish / tiklashda qadamlar tozalanadi
create or replace function public._reset_answer_steps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status and new.status in ('pending', 'skipped'))
     or (old.started_at is not null and new.started_at is distinct from old.started_at) then
    delete from public.answer_steps where game_question_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists game_questions_reset_steps on public.game_questions;
create trigger game_questions_reset_steps
  after update on public.game_questions
  for each row execute function public._reset_answer_steps();

-- ---------------------------------------------------------------------
-- Oʻquvchining joriy zanjir holati (faqat oʻziga; toʻgʻri javoblarsiz)
-- ---------------------------------------------------------------------
create or replace function public._steps_state(p_gq public.game_questions, p_player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_steps jsonb;
  v_n int;
  v_done jsonb;
  v_cnt int;
  v_wrong int;
  v_finished boolean;
begin
  select options into v_steps from public.questions where id = p_gq.question_id;
  v_n := coalesce(jsonb_array_length(v_steps), 0);
  select coalesce(jsonb_agg(jsonb_build_object('index', step_index, 'selected', selected_answer, 'correct', is_correct)
                            order by step_index), '[]'::jsonb),
         count(*), count(*) filter (where not is_correct)
    into v_done, v_cnt, v_wrong
    from public.answer_steps
   where game_question_id = p_gq.id and player_id = p_player;
  v_finished := v_wrong > 0 or v_cnt >= v_n
    or exists (select 1 from public.answers where game_question_id = p_gq.id and player_id = p_player);
  return jsonb_build_object(
    'total', v_n,
    'done', v_done,
    'finished', v_finished,
    'current', case when not v_finished and p_gq.status = 'active' then jsonb_build_object(
      'index', v_cnt,
      'text', v_steps -> v_cnt ->> 'text',
      'options', v_steps -> v_cnt -> 'options') end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Savol maʼlumoti: koʻp bosqichli savol qadamlari faqat ochilgandan keyin
-- (oʻqituvchiga har doim) koʻrsatiladi
-- ---------------------------------------------------------------------
create or replace function public._question_payload(p_gq public.game_questions, p_owner boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  q public.questions;
begin
  select * into q from public.questions where id = p_gq.question_id;
  v := jsonb_build_object(
    'id', p_gq.id,
    'round_number', p_gq.round_number,
    'sequence_number', p_gq.sequence_number,
    'points', round(p_gq.points * p_gq.points_multiplier)::int,
    'base_points', p_gq.points,
    'points_multiplier', p_gq.points_multiplier,
    'time_limit', p_gq.time_limit,
    'status', p_gq.status,
    'question_type', p_gq.question_type,
    'question_text', p_gq.question_text,
    'options', p_gq.options,
    'image_url', p_gq.image_url,
    'input_spec', p_gq.input_spec,
    'started_at', p_gq.started_at,
    'answers_open_at', p_gq.answers_open_at,
    'deadline', p_gq.deadline,
    'closed_at', p_gq.closed_at,
    'answer_count', p_gq.answer_count,
    'correct_answer', case when p_gq.status = 'revealed' then p_gq.correct_answer end,
    'explanation', case when p_gq.status = 'revealed' then p_gq.explanation end,
    'results', case when p_gq.status = 'revealed' then p_gq.results end,
    'steps', case when p_gq.question_type = 'multi_step' and (p_owner or p_gq.status = 'revealed') then q.options end
  );
  if p_owner then
    v := v || jsonb_build_object('secret', jsonb_build_object(
      'correct_answer', q.correct_answer, 'explanation', q.explanation, 'hint', q.hint,
      'subject', q.subject, 'grade', q.grade, 'category', q.category, 'difficulty', q.difficulty));
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- Snapshot: yangi maydonlar — my_steps (oʻquvchi), step_progress (oʻqituvchi),
-- javoblarda credit (ball ulushi)
-- ---------------------------------------------------------------------
create or replace function public.get_room_snapshot(p_room uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner boolean;
  r public.game_rooms;
  me public.players;
  gq public.game_questions;
  v_has_q boolean := false;
  v_team uuid;
begin
  if v_uid is null then
    raise exception 'Avtorizatsiya talab qilinadi' using errcode = '42501';
  end if;
  select * into r from public.game_rooms where id = p_room;
  if not found then
    raise exception 'Xona topilmadi' using errcode = 'P0002';
  end if;
  v_owner := public.owns_room(p_room);

  if not v_owner then
    select * into me from public.players where room_id = p_room and user_id = v_uid;
    if not found then
      raise exception 'Bu xonaga kirish huquqingiz yoʻq' using errcode = '42501';
    end if;
    if me.status in ('rejected', 'kicked') then
      return jsonb_build_object(
        'role', 'student',
        'server_time', now(),
        'room', jsonb_build_object('id', r.id, 'room_code', r.room_code, 'title', r.title, 'status', r.status),
        'me', to_jsonb(me) - 'user_id'
      );
    end if;
    v_team := case when me.status = 'approved' then me.team_id end;
  end if;

  if r.current_game_question_id is not null then
    select * into gq from public.game_questions where id = r.current_game_question_id;
    v_has_q := found and (v_owner or gq.status in ('active', 'revealed'));
  end if;

  return jsonb_build_object(
    'role', case when v_owner then 'instructor' else 'student' end,
    'server_time', now(),
    'room', to_jsonb(r) - 'instructor_id',
    'teams', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.slot), '[]'::jsonb)
        from public.teams t where t.room_id = p_room
    ),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'nickname', p.nickname, 'team_id', p.team_id, 'status', p.status,
               'score', p.score, 'correct_count', p.correct_count, 'answered_count', p.answered_count,
               'streak', p.streak, 'best_streak', p.best_streak, 'joined_at', p.joined_at,
               'approved_at', p.approved_at, 'last_seen_at', p.last_seen_at
             ) order by p.joined_at), '[]'::jsonb)
        from public.players p
       where p.room_id = p_room
         and (v_owner or p.status = 'approved' or p.id = me.id)
    ),
    'abilities', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'team_id', a.team_id, 'ability_type', a.ability_type, 'uses_left', a.uses_left,
               'cooldown_until', a.cooldown_until, 'is_enabled', a.is_enabled
             ) order by a.ability_type), '[]'::jsonb)
        from public.team_abilities a where a.room_id = p_room
    ),
    'question', case when v_has_q then public._question_payload(gq, v_owner) end,
    'answered_player_ids', case when v_has_q then (
      select coalesce(jsonb_agg(a.player_id order by a.submitted_at), '[]'::jsonb)
        from public.answers a where a.game_question_id = gq.id
    ) else '[]'::jsonb end,
    'my_answer', case when v_has_q and not v_owner then (
      select jsonb_build_object(
               'selected_answer', a.selected_answer,
               'submitted_at', a.submitted_at,
               'response_ms', a.response_ms,
               'is_correct', case when gq.status = 'revealed' then a.is_correct end,
               'awarded_points', case when gq.status = 'revealed' then a.awarded_points end,
               'credit', case when gq.status = 'revealed' then a.credit end)
        from public.answers a where a.game_question_id = gq.id and a.player_id = me.id
    ) end,
    'my_steps', case when v_has_q and not v_owner and me.status = 'approved' and gq.question_type = 'multi_step'
      then public._steps_state(gq, me.id) end,
    'answers', case when v_has_q and v_owner then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', a.player_id, 'team_id', a.team_id, 'selected_answer', a.selected_answer,
               'submitted_at', a.submitted_at, 'response_ms', a.response_ms,
               'is_correct', a.is_correct, 'awarded_points', a.awarded_points, 'credit', a.credit
             ) order by a.submitted_at), '[]'::jsonb)
        from public.answers a where a.game_question_id = gq.id
    ) else '[]'::jsonb end,
    'step_progress', case when v_has_q and v_owner and gq.question_type = 'multi_step' then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', st.player_id, 'done', st.done, 'correct', st.correct
             )), '[]'::jsonb)
        from (
          select player_id, count(*)::int as done, count(*) filter (where is_correct)::int as correct
            from public.answer_steps where game_question_id = gq.id group by player_id
        ) st
    ) else '[]'::jsonb end,
    'hints', case when v_has_q then (
      select coalesce(jsonb_agg(jsonb_build_object('team_id', h.team_id, 'hint', h.hint)), '[]'::jsonb)
        from public.team_hints h
       where h.game_question_id = gq.id and (v_owner or h.team_id = v_team)
    ) else '[]'::jsonb end,
    'ability_requests', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', ar.id, 'team_id', ar.team_id, 'player_id', ar.player_id,
               'ability_type', ar.ability_type, 'created_at', ar.created_at
             ) order by ar.created_at), '[]'::jsonb)
        from public.ability_requests ar
       where ar.room_id = p_room and ar.status = 'pending' and (v_owner or ar.team_id = v_team)
    ),
    'plan', case when v_owner then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', g.id, 'question_id', g.question_id, 'round_number', g.round_number,
               'sequence_number', g.sequence_number, 'status', g.status, 'points', g.points,
               'time_limit', g.time_limit, 'question_text', q.question_text, 'question_type', q.question_type,
               'subject', q.subject, 'grade', q.grade,
               'category', q.category, 'difficulty', q.difficulty, 'image_url', q.image_url,
               'options', q.options, 'correct_answer', q.correct_answer, 'answer_count', g.answer_count
             ) order by g.round_number, g.sequence_number), '[]'::jsonb)
        from public.game_questions g join public.questions q on q.id = g.question_id
       where g.room_id = p_room
    ) else (
      select coalesce(jsonb_agg(jsonb_build_object('round_number', x.round_number, 'total', x.total, 'done', x.done)
             order by x.round_number), '[]'::jsonb)
        from (
          select round_number, count(*) as total, count(*) filter (where status in ('revealed', 'skipped')) as done
            from public.game_questions where room_id = p_room group by round_number
        ) x
    ) end,
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'seq', e.seq, 'event_type', e.event_type, 'event_data', e.event_data,
               'team_id', e.team_id, 'player_id', e.player_id, 'created_at', e.created_at
             ) order by e.seq), '[]'::jsonb)
        from (select * from public.game_events where room_id = p_room order by seq desc limit 40) e
    ),
    'me', case when v_owner then null else to_jsonb(me) - 'user_id' end,
    'results', (select to_jsonb(gr) from public.game_results gr where gr.room_id = p_room),
    'adjustments', case when v_owner then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', sa.id, 'team_id', sa.team_id, 'player_id', sa.player_id, 'delta', sa.delta,
               'reason', sa.reason, 'created_at', sa.created_at
             ) order by sa.created_at desc), '[]'::jsonb)
        from (select * from public.score_adjustments where room_id = p_room order by created_at desc limit 30) sa
    ) else '[]'::jsonb end
  );
end;
$$;

-- =====================================================================
-- Huquqlar: yangi funksiyalar standart boʻyicha hammaga ochiq boʻlib
-- qolmasligi uchun yopiladi, faqat submit_step ochiladi
-- =====================================================================
revoke execute on function public._matching_hits(jsonb, jsonb, text) from public;
revoke execute on function public.submit_step(uuid, int, text) from public;
revoke execute on function public._reset_answer_steps() from public;
revoke execute on function public._steps_state(public.game_questions, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public._matching_hits(jsonb, jsonb, text) from anon';
    execute 'revoke execute on function public.submit_step(uuid, int, text) from anon';
    execute 'revoke execute on function public._reset_answer_steps() from anon';
    execute 'revoke execute on function public._steps_state(public.game_questions, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public._matching_hits(jsonb, jsonb, text) from authenticated';
    execute 'revoke execute on function public._reset_answer_steps() from authenticated';
    execute 'revoke execute on function public._steps_state(public.game_questions, uuid) from authenticated';
    execute 'grant execute on function public.submit_step(uuid, int, text) to authenticated';
  end if;
end;
$$;
