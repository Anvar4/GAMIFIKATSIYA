-- =====================================================================
-- 3-migratsiya: oʻyin mantiqi (server-authoritative RPC funksiyalar)
--
-- Qulflash tartibi (deadlock oldini olish uchun): har doim avval
-- game_rooms qatori (FOR UPDATE), keyin game_questions, keyin teams/players.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ichki yordamchilar
-- ---------------------------------------------------------------------
create or replace function public._lock_owned_room(p_room uuid)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  if not public.owns_room(p_room) then
    raise exception 'Bu xonani boshqarish huquqingiz yoʻq' using errcode = '42501';
  end if;
  select * into r from public.game_rooms where id = p_room for update;
  return r;
end;
$$;

create or replace function public._playable_types()
returns text[]
language sql
immutable
as $$
  select array['single_choice', 'true_false', 'image_identification', 'short_answer', 'logical_puzzle'];
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
    "ability_cooldown_seconds": [0, 600], "time_freeze_seconds": [1, 60], "energy_steal_amount": [0, 500]
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

-- Bitta raund uchun savollarni avtomatik tanlash (faqat 'pending' savollar almashtiriladi)
create or replace function public._plan_round(p_room uuid, p_round int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb;
  cfg jsonb;
  v_count int;
  v_points int;
  v_time int;
  v_start int;
  v_existing int;
  v_n int := 0;
  v_q record;
  v_subject text;
  v_grade int;
  v_cats text[];
begin
  select settings into s from public.game_rooms where id = p_room;
  cfg := coalesce(s -> 'rounds' -> (p_round::text), '{}'::jsonb);
  -- xona uchun tanlangan fan / sinf / mavzular filtri
  v_subject := nullif(btrim(coalesce(s -> 'question_filter' ->> 'subject', '')), '');
  v_grade := (s -> 'question_filter' ->> 'grade')::numeric::int;
  v_cats := array(select jsonb_array_elements_text(coalesce(s -> 'question_filter' -> 'categories', '[]'::jsonb)));
  v_count := coalesce((cfg ->> 'count')::int, 4);
  v_points := coalesce((cfg ->> 'points')::int, 100 * p_round);
  v_time := coalesce((cfg ->> 'time_limit')::int, 20);

  delete from public.game_questions
   where room_id = p_room and round_number = p_round and status = 'pending';

  select coalesce(max(sequence_number), 0), count(*)
    into v_start, v_existing
    from public.game_questions
   where room_id = p_room and round_number = p_round;

  v_count := v_count - v_existing;
  if v_count <= 0 then
    return 0;
  end if;

  for v_q in
    select q.id
      from public.questions q
     where q.is_active
       and q.question_type = any (public._playable_types())
       and (v_subject is null or lower(q.subject) = lower(v_subject))
       and (v_grade is null or q.grade is null or q.grade = v_grade)
       and (cardinality(v_cats) = 0 or q.category = any (v_cats))
       and not exists (
         select 1 from public.game_questions g where g.room_id = p_room and g.question_id = q.id
       )
     order by
       case when q.recommended_round = p_round then 0
            when q.recommended_round is null then 1
            else 2 end,
       case when p_round = 2 and q.question_type = 'image_identification' then 0 else 1 end,
       random()
     limit v_count
  loop
    v_n := v_n + 1;
    insert into public.game_questions (room_id, question_id, round_number, sequence_number, points, time_limit)
    values (p_room, v_q.id, p_round, v_start + v_n, v_points, v_time);
  end loop;
  return v_n;
end;
$$;

-- =====================================================================
-- A. XONA BOSHQARUVI (oʻqituvchi)
-- =====================================================================
create or replace function public.create_room(p_title text default null, p_filter jsonb default null)
returns public.game_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_settings jsonb := public.default_room_settings()
    || case when p_filter is not null then jsonb_build_object('question_filter', p_filter) else '{}'::jsonb end;
  v_shield int := public._s_int(v_settings, 'max_shield', 100);
  t1 uuid;
  t2 uuid;
  v_tries int := 0;
begin
  if not public.is_instructor() then
    raise exception 'Faqat oʻqituvchi xona yarata oladi' using errcode = '42501';
  end if;
  perform public._validate_settings(v_settings);

  loop
    begin
      insert into public.game_rooms (room_code, instructor_id, title, settings)
      values (
        public._generate_room_code(),
        auth.uid(),
        coalesce(nullif(left(btrim(coalesce(p_title, '')), 80), ''), 'IT ARENA — Galaktik jang'),
        v_settings
      )
      returning * into r;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 5 then
        raise;
      end if;
    end;
  end loop;

  insert into public.teams (room_id, slot, name, color, spaceship_skin, shield, max_shield)
  values (r.id, 1, 'KOʻK JAMOA', 'blue', 'falcon', v_shield, v_shield)
  returning id into t1;
  insert into public.teams (room_id, slot, name, color, spaceship_skin, shield, max_shield)
  values (r.id, 2, 'QIZIL JAMOA', 'red', 'phoenix', v_shield, v_shield)
  returning id into t2;

  insert into public.team_abilities (room_id, team_id, ability_type, uses_left)
  select r.id, t.id, a.x, public._s_int(v_settings, 'ability_max_uses', 2)
    from (values (t1), (t2)) as t(id)
   cross join unnest(array['shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan']) as a(x);

  for i in 1..5 loop
    perform public._plan_round(r.id, i);
  end loop;

  perform public._log_event(r.id, 'room_created', jsonb_build_object('room_code', r.room_code));
  return r;
end;
$$;

create or replace function public.update_room_settings(p_room uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_new jsonb;
  rk text;
  rv jsonb;
  v_shield int;
begin
  r := public._lock_owned_room(p_room);
  if r.status in ('finished', 'archived') then
    raise exception 'Yakunlangan oʻyin sozlamalarini oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then
    raise exception 'Sozlamalar obyekt koʻrinishida boʻlishi kerak' using errcode = '22023';
  end if;

  v_new := r.settings || (p_patch - 'rounds' - 'ability_costs');
  if p_patch ? 'ability_costs' then
    v_new := jsonb_set(v_new, '{ability_costs}', coalesce(r.settings -> 'ability_costs', '{}'::jsonb) || (p_patch -> 'ability_costs'));
  end if;
  if p_patch ? 'rounds' then
    for rk, rv in select key, value from jsonb_each(p_patch -> 'rounds') loop
      v_new := jsonb_set(
        v_new,
        array['rounds', rk],
        coalesce(v_new -> 'rounds' -> rk, '{}'::jsonb) || rv,
        true
      );
    end loop;
  end if;

  perform public._validate_settings(v_new);

  update public.game_rooms set settings = v_new where id = p_room;

  v_shield := public._s_int(v_new, 'max_shield', 100);
  if r.status = 'lobby' then
    update public.teams set max_shield = v_shield, shield = v_shield where room_id = p_room;
    update public.team_abilities
       set uses_left = public._s_int(v_new, 'ability_max_uses', 2)
     where room_id = p_room;
  elsif v_shield <> public._s_int(r.settings, 'max_shield', 100) then
    update public.teams set max_shield = v_shield, shield = least(shield, v_shield) where room_id = p_room;
  end if;

  perform public._log_event(p_room, 'settings_updated', jsonb_build_object('keys', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return v_new;
end;
$$;

create or replace function public.update_team(p_team uuid, p_name text, p_color text, p_skin text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teams;
  r public.game_rooms;
  v_name text := upper(btrim(coalesce(p_name, '')));
begin
  select * into t from public.teams where id = p_team;
  if not found then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(t.room_id);
  if r.status in ('finished', 'archived') then
    raise exception 'Yakunlangan oʻyinda jamoani oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'Jamoa nomi 1–24 belgidan iborat boʻlishi kerak' using errcode = '22023';
  end if;
  if v_name ~ '[<>{}\\]' then
    raise exception 'Jamoa nomida ruxsat etilmagan belgilar bor' using errcode = '22023';
  end if;
  if p_color not in ('blue', 'red', 'cyan', 'green', 'gold', 'purple') then
    raise exception 'Rang notoʻgʻri' using errcode = '22023';
  end if;
  if p_skin not in ('falcon', 'phoenix', 'nova', 'titan') then
    raise exception 'Kema dizayni notoʻgʻri' using errcode = '22023';
  end if;
  if exists (select 1 from public.teams where room_id = t.room_id and id <> t.id and color = p_color) then
    raise exception 'Bu rang boshqa jamoaga berilgan' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.teams where room_id = t.room_id and id <> t.id and upper(name) = v_name) then
    raise exception 'Jamoa nomlari bir xil boʻlmasligi kerak' using errcode = 'P0001';
  end if;

  update public.teams set name = v_name, color = p_color, spaceship_skin = p_skin
   where id = p_team
   returning * into t;
  perform public._log_event(t.room_id, 'team_updated', jsonb_build_object('name', t.name, 'color', t.color, 'skin', t.spaceship_skin), t.id);
  return t;
end;
$$;

create or replace function public.set_registration(p_room uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'lobby' and p_open then
    raise exception 'Oʻyin boshlangandan keyin roʻyxatni ochib boʻlmaydi' using errcode = 'P0001';
  end if;
  update public.game_rooms set registration_open = p_open where id = p_room;
  perform public._log_event(p_room, case when p_open then 'registration_opened' else 'registration_closed' end);
end;
$$;

create or replace function public.reset_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  update public.game_rooms
     set current_game_question_id = null
   where id = p_room;

  delete from public.answers where room_id = p_room;
  delete from public.team_hints where room_id = p_room;
  delete from public.ability_requests where room_id = p_room;
  delete from public.game_results where room_id = p_room;
  delete from public.game_events where room_id = p_room;

  update public.game_questions
     set status = 'pending', question_type = null, question_text = null, options = null,
         image_url = null, input_spec = null, points_multiplier = 1, started_at = null,
         answers_open_at = null, deadline = null, closed_at = null, answer_count = 0,
         correct_answer = null, explanation = null, results = null
   where room_id = p_room;

  update public.teams
     set score = 0, shield = max_shield, energy = 0, streak = 0, best_streak = 0,
         correct_count = 0, answered_count = 0, possible_count = 0,
         shield_boost_active = false, double_attack_active = false, is_defeated = false
   where room_id = p_room;

  update public.team_abilities
     set uses_left = public._s_int(r.settings, 'ability_max_uses', 2), cooldown_until = null
   where room_id = p_room;

  update public.players
     set score = 0, correct_count = 0, answered_count = 0, streak = 0, best_streak = 0
   where room_id = p_room;

  update public.game_rooms
     set status = 'lobby', phase = 'lobby', current_round = 0, current_question_started_at = null,
         question_deadline = null, paused_at = null, paused_remaining_ms = null, paused_open_ms = null,
         registration_open = true, winner_team_id = null, started_at = null, finished_at = null,
         next_points_multiplier = 1
   where id = p_room;

  perform public._log_event(p_room, 'room_reset');
end;
$$;

create or replace function public.archive_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  if r.status in ('active', 'paused') then
    raise exception 'Avval oʻyinni yakunlang' using errcode = 'P0001';
  end if;
  update public.game_rooms set status = 'archived', registration_open = false where id = p_room;
  perform public._log_event(p_room, 'room_archived');
end;
$$;

create or replace function public.delete_room(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  if r.status in ('active', 'paused') then
    raise exception 'Faol oʻyinni oʻchirib boʻlmaydi — avval yakunlang' using errcode = 'P0001';
  end if;
  update public.game_rooms set current_game_question_id = null where id = p_room;
  delete from public.game_rooms where id = p_room;
end;
$$;

-- =====================================================================
-- B. ROʻYXATDAN OʻTISH
-- =====================================================================
create or replace function public.lookup_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  perform public._rate_limit('lookup_room', 30, 60);
  select * into r from public.game_rooms where room_code = upper(btrim(coalesce(p_code, '')));
  if not found or r.status = 'archived' then
    raise exception 'Bunday kodli xona topilmadi' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', r.id,
    'room_code', r.room_code,
    'title', r.title,
    'status', r.status,
    'registration_open', r.registration_open,
    'allow_team_choice', public._s_bool(r.settings, 'allow_team_choice', false),
    'max_players', public._s_int(r.settings, 'max_players', 10),
    'team_size', public._s_int(r.settings, 'team_size', 5),
    'active_players', (select count(*) from public.players p where p.room_id = r.id and p.status in ('pending', 'approved')),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'color', t.color, 'spaceship_skin', t.spaceship_skin, 'slot', t.slot,
               'members', (select count(*) from public.players p where p.team_id = t.id and p.status in ('pending', 'approved'))
             ) order by t.slot), '[]'::jsonb)
        from public.teams t where t.room_id = r.id
    ),
    'my_player', (
      select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'status', p.status, 'team_id', p.team_id)
        from public.players p where p.room_id = r.id and p.user_id = auth.uid()
    )
  );
end;
$$;

create or replace function public.join_room(p_code text, p_nickname text, p_team uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.game_rooms;
  pl public.players;
  v_nick text;
  v_team uuid;
  v_team_size int;
  v_active int;
  v_auto boolean;
begin
  if v_uid is null then
    raise exception 'Avtorizatsiya talab qilinadi' using errcode = '42501';
  end if;
  perform public._rate_limit('join_room', 10, 60);

  v_nick := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 then
    raise exception 'Ism yoki taxallus 2–20 belgidan iborat boʻlishi kerak' using errcode = '22023';
  end if;
  if v_nick ~ '[<>{}\[\]\\/@#$%^&*=+|~"]' or v_nick ~ '[[:cntrl:]]' then
    raise exception 'Taxallusda ruxsat etilmagan belgilar bor' using errcode = '22023';
  end if;

  select * into r from public.game_rooms
   where room_code = upper(btrim(coalesce(p_code, '')))
   for update;
  if not found or r.status = 'archived' then
    raise exception 'Bunday kodli xona topilmadi' using errcode = 'P0002';
  end if;

  select * into pl from public.players where room_id = r.id and user_id = v_uid for update;
  if found then
    if pl.status in ('pending', 'approved') then
      -- qayta ulanish: mavjud sessiya qaytariladi
      return jsonb_build_object('player', to_jsonb(pl), 'room_id', r.id, 'reconnected', true);
    elsif pl.status = 'kicked' then
      raise exception 'Siz oʻqituvchi tomonidan bu xonadan chiqarilgansiz' using errcode = '42501';
    end if;
  end if;

  if r.status in ('finished', 'archived') then
    raise exception 'Bu oʻyin allaqachon yakunlangan' using errcode = 'P0001';
  end if;
  if r.status <> 'lobby' or not r.registration_open then
    raise exception 'Roʻyxatdan oʻtish yopilgan. Oʻqituvchiga murojaat qiling.' using errcode = 'P0001';
  end if;

  select count(*) into v_active from public.players where room_id = r.id and status in ('pending', 'approved');
  if v_active >= public._s_int(r.settings, 'max_players', 10) then
    raise exception 'Xona toʻla (maksimal % oʻquvchi)', public._s_int(r.settings, 'max_players', 10) using errcode = 'P0001';
  end if;

  v_team_size := public._s_int(r.settings, 'team_size', 5);
  v_auto := public._s_bool(r.settings, 'auto_approve', false);

  if p_team is not null and public._s_bool(r.settings, 'allow_team_choice', false) then
    if not exists (select 1 from public.teams where id = p_team and room_id = r.id) then
      raise exception 'Jamoa topilmadi' using errcode = 'P0002';
    end if;
    if (select count(*) from public.players where team_id = p_team and status in ('pending', 'approved')) >= v_team_size then
      raise exception 'Bu jamoa toʻla. Boshqa jamoani tanlang.' using errcode = 'P0001';
    end if;
    v_team := p_team;
  elsif v_auto then
    select t.id into v_team
      from public.teams t
     where t.room_id = r.id
     order by (select count(*) from public.players p where p.team_id = t.id and p.status in ('pending', 'approved')), t.slot
     limit 1;
    if (select count(*) from public.players where team_id = v_team and status in ('pending', 'approved')) >= v_team_size then
      v_team := null;
    end if;
  end if;

  begin
    if pl.id is not null then
      update public.players
         set nickname = v_nick, team_id = v_team, status = 'pending', joined_at = now(), approved_at = null,
             last_seen_at = now()
       where id = pl.id
       returning * into pl;
    else
      insert into public.players (room_id, user_id, team_id, nickname, status)
      values (r.id, v_uid, v_team, v_nick, 'pending')
      returning * into pl;
    end if;
  exception when unique_violation then
    raise exception 'Bu taxallus band. Boshqa ism tanlang.' using errcode = '23505';
  end;

  if v_auto and v_team is not null then
    update public.players set status = 'approved', approved_at = now() where id = pl.id returning * into pl;
    perform public._log_event(r.id, 'player_approved', jsonb_build_object('nickname', pl.nickname, 'auto', true), pl.team_id, pl.id);
  else
    perform public._log_event(r.id, 'player_joined', jsonb_build_object('nickname', pl.nickname), pl.team_id, pl.id);
  end if;

  return jsonb_build_object('player', to_jsonb(pl), 'room_id', r.id, 'reconnected', false);
end;
$$;

create or replace function public._approve_player_internal(r public.game_rooms, p_player uuid, p_team uuid)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.players;
  v_team uuid;
  v_team_size int := public._s_int(r.settings, 'team_size', 5);
begin
  select * into pl from public.players where id = p_player and room_id = r.id for update;
  if not found then
    raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
  end if;
  if r.status in ('finished', 'archived') then
    raise exception 'Oʻyin yakunlangan' using errcode = 'P0001';
  end if;

  v_team := coalesce(p_team, pl.team_id);
  if v_team is null then
    select t.id into v_team
      from public.teams t
     where t.room_id = r.id
     order by (select count(*) from public.players p where p.team_id = t.id and p.status = 'approved'), t.slot
     limit 1;
  end if;
  if not exists (select 1 from public.teams where id = v_team and room_id = r.id) then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  if r.status <> 'lobby' and pl.status = 'approved' and pl.team_id is distinct from v_team then
    raise exception 'Oʻyin boshlangandan keyin jamoani oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if (select count(*) from public.players where team_id = v_team and status = 'approved' and id <> pl.id) >= v_team_size then
    raise exception 'Jamoa toʻla (% ta oʻquvchi)', v_team_size using errcode = 'P0001';
  end if;
  if pl.status <> 'approved'
     and (select count(*) from public.players where room_id = r.id and status = 'approved') >= public._s_int(r.settings, 'max_players', 10) then
    raise exception 'Xona toʻla' using errcode = 'P0001';
  end if;

  begin
    update public.players
       set status = 'approved', team_id = v_team, approved_at = coalesce(approved_at, now())
     where id = pl.id
     returning * into pl;
  exception when unique_violation then
    raise exception 'Bu taxallus band — oʻquvchidan boshqa ism tanlashni soʻrang' using errcode = '23505';
  end;
  perform public._log_event(r.id, 'player_approved', jsonb_build_object('nickname', pl.nickname), pl.team_id, pl.id);
  return pl;
end;
$$;

create or replace function public.approve_player(p_player uuid, p_team uuid default null)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  r public.game_rooms;
begin
  select room_id into v_room from public.players where id = p_player;
  if v_room is null then
    raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(v_room);
  return public._approve_player_internal(r, p_player, p_team);
end;
$$;

create or replace function public.approve_all_players(p_room uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  pl record;
  v_n int := 0;
begin
  r := public._lock_owned_room(p_room);
  for pl in select id, team_id from public.players where room_id = p_room and status = 'pending' order by joined_at loop
    begin
      perform public._approve_player_internal(r, pl.id, pl.team_id);
      v_n := v_n + 1;
    exception when others then
      -- jamoa toʻla boʻlsa, boshqa jamoaga urinib koʻramiz
      begin
        perform public._approve_player_internal(r, pl.id, null);
        v_n := v_n + 1;
      exception when others then
        null;
      end;
    end;
  end loop;
  return v_n;
end;
$$;

create or replace function public.reject_player(p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.players;
  r public.game_rooms;
begin
  select * into pl from public.players where id = p_player;
  if not found then
    raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(pl.room_id);
  if r.status <> 'lobby' and pl.status = 'approved' then
    raise exception 'Oʻyin davomida tasdiqlangan oʻquvchini rad etib boʻlmaydi — "chiqarish"dan foydalaning' using errcode = 'P0001';
  end if;
  update public.players set status = 'rejected', team_id = null where id = p_player;
  perform public._log_event(pl.room_id, 'player_rejected', jsonb_build_object('nickname', pl.nickname), null, pl.id);
end;
$$;

create or replace function public.kick_player(p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.players;
  r public.game_rooms;
begin
  select * into pl from public.players where id = p_player;
  if not found then
    raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(pl.room_id);
  update public.players set status = 'kicked' where id = p_player;
  perform public._log_event(pl.room_id, 'player_kicked', jsonb_build_object('nickname', pl.nickname), pl.team_id, pl.id);
end;
$$;

create or replace function public.assign_player_team(p_player uuid, p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.players;
  r public.game_rooms;
begin
  select * into pl from public.players where id = p_player;
  if not found then
    raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(pl.room_id);
  if r.status <> 'lobby' then
    raise exception 'Oʻyin boshlangandan keyin jamoani oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.teams where id = p_team and room_id = pl.room_id) then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  if pl.status = 'approved'
     and (select count(*) from public.players where team_id = p_team and status = 'approved' and id <> pl.id)
         >= public._s_int(r.settings, 'team_size', 5) then
    raise exception 'Jamoa toʻla' using errcode = 'P0001';
  end if;
  update public.players set team_id = p_team where id = p_player;
  perform public._log_event(pl.room_id, 'player_moved', jsonb_build_object('nickname', pl.nickname), p_team, pl.id);
end;
$$;

-- Jamoasiz oʻquvchilarni jamoalarga teng taqsimlash
create or replace function public.auto_balance_teams(p_room uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  pl record;
  v_team uuid;
  v_n int := 0;
  v_team_size int;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'lobby' then
    raise exception 'Jamoalarni faqat lobbida taqsimlash mumkin' using errcode = 'P0001';
  end if;
  v_team_size := public._s_int(r.settings, 'team_size', 5);
  for pl in
    select id from public.players
     where room_id = p_room and status in ('pending', 'approved') and team_id is null
     order by joined_at
  loop
    select t.id into v_team
      from public.teams t
     where t.room_id = p_room
     order by (select count(*) from public.players p where p.team_id = t.id and p.status in ('pending', 'approved')), t.slot
     limit 1;
    if (select count(*) from public.players where team_id = v_team and status in ('pending', 'approved')) >= v_team_size then
      exit;
    end if;
    update public.players set team_id = v_team where id = pl.id;
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then
    perform public._log_event(p_room, 'teams_balanced', jsonb_build_object('count', v_n));
  end if;
  return v_n;
end;
$$;

-- =====================================================================
-- C. SAVOLLAR REJASI
-- =====================================================================
create or replace function public.plan_rounds_auto(p_room uuid, p_round int default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_n int := 0;
begin
  r := public._lock_owned_room(p_room);
  if r.status in ('finished', 'archived') then
    raise exception 'Yakunlangan oʻyin rejasini oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if p_round is not null then
    if p_round < 1 or p_round > 5 then
      raise exception 'Raund raqami 1–5 oraligʻida boʻlishi kerak' using errcode = '22023';
    end if;
    v_n := public._plan_round(p_room, p_round);
  else
    for i in 1..5 loop
      v_n := v_n + public._plan_round(p_room, i);
    end loop;
  end if;
  perform public._log_event(p_room, 'plan_updated', jsonb_build_object('round', p_round));
  return v_n;
end;
$$;

create or replace function public.set_round_questions(
  p_room uuid,
  p_round int,
  p_question_ids uuid[],
  p_points int default null,
  p_time_limit int default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  cfg jsonb;
  v_points int;
  v_time int;
  v_start int;
  v_n int := 0;
  v_qid uuid;
begin
  r := public._lock_owned_room(p_room);
  if r.status in ('finished', 'archived') then
    raise exception 'Yakunlangan oʻyin rejasini oʻzgartirib boʻlmaydi' using errcode = 'P0001';
  end if;
  if p_round < 1 or p_round > 5 then
    raise exception 'Raund raqami 1–5 oraligʻida boʻlishi kerak' using errcode = '22023';
  end if;
  if coalesce(array_length(p_question_ids, 1), 0) > 30 then
    raise exception 'Bir raundda koʻpi bilan 30 ta savol boʻlishi mumkin' using errcode = '22023';
  end if;
  cfg := coalesce(r.settings -> 'rounds' -> (p_round::text), '{}'::jsonb);
  v_points := coalesce(p_points, (cfg ->> 'points')::int, 100);
  v_time := coalesce(p_time_limit, (cfg ->> 'time_limit')::int, 20);
  if v_points < 0 or v_points > 5000 or v_time < 5 or v_time > 300 then
    raise exception 'Ball (0–5000) yoki vaqt (5–300 s) notoʻgʻri' using errcode = '22023';
  end if;

  delete from public.game_questions where room_id = p_room and round_number = p_round and status = 'pending';
  select coalesce(max(sequence_number), 0) into v_start
    from public.game_questions where room_id = p_room and round_number = p_round;

  foreach v_qid in array coalesce(p_question_ids, array[]::uuid[]) loop
    if not exists (
      select 1 from public.questions
       where id = v_qid and is_active and question_type = any (public._playable_types())
    ) then
      raise exception 'Savol topilmadi yoki oʻyinda ishlatib boʻlmaydi' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.game_questions where room_id = p_room and question_id = v_qid) then
      raise exception 'Bitta savol bir oʻyinda ikki marta boʻlishi mumkin emas' using errcode = 'P0001';
    end if;
    v_n := v_n + 1;
    insert into public.game_questions (room_id, question_id, round_number, sequence_number, points, time_limit)
    values (p_room, v_qid, p_round, v_start + v_n, v_points, v_time);
  end loop;

  perform public._log_event(p_room, 'plan_updated', jsonb_build_object('round', p_round, 'count', v_n));
  return v_n;
end;
$$;

create or replace function public.update_game_question(p_gq uuid, p_points int, p_time_limit int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gq public.game_questions;
  r public.game_rooms;
begin
  select * into gq from public.game_questions where id = p_gq;
  if not found then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(gq.room_id);
  if gq.status <> 'pending' then
    raise exception 'Faqat hali boshlanmagan savolni tahrirlash mumkin' using errcode = 'P0001';
  end if;
  if p_points < 0 or p_points > 5000 or p_time_limit < 5 or p_time_limit > 300 then
    raise exception 'Ball (0–5000) yoki vaqt (5–300 s) notoʻgʻri' using errcode = '22023';
  end if;
  update public.game_questions set points = p_points, time_limit = p_time_limit where id = p_gq;
  perform public._log_event(gq.room_id, 'plan_updated', jsonb_build_object('round', gq.round_number));
end;
$$;

create or replace function public.shuffle_round(p_room uuid, p_round int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_start int;
begin
  r := public._lock_owned_room(p_room);
  select coalesce(max(sequence_number), 0) into v_start
    from public.game_questions
   where room_id = p_room and round_number = p_round and status <> 'pending';

  update public.game_questions set sequence_number = sequence_number + 1000
   where room_id = p_room and round_number = p_round and status = 'pending';

  update public.game_questions g
     set sequence_number = v_start + x.rn
    from (
      select id, row_number() over (order by random()) as rn
        from public.game_questions
       where room_id = p_room and round_number = p_round and status = 'pending'
    ) x
   where g.id = x.id;

  perform public._log_event(p_room, 'plan_updated', jsonb_build_object('round', p_round, 'shuffled', true));
end;
$$;

-- =====================================================================
-- D. OʻYIN JARAYONI
-- =====================================================================
create or replace function public.start_game(p_room uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_team_size int;
  v_total int;
  v_bad int;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'lobby' then
    raise exception 'Oʻyin allaqachon boshlangan yoki yakunlangan' using errcode = 'P0001';
  end if;
  v_team_size := public._s_int(r.settings, 'team_size', 5);

  select count(*) into v_total
    from public.players where room_id = p_room and status = 'approved' and team_id is not null;
  if v_total = 0 then
    raise exception 'Kamida bitta tasdiqlangan oʻquvchi kerak' using errcode = 'P0001';
  end if;

  if not coalesce(p_force, false) then
    select count(*) into v_bad
      from public.teams t
     where t.room_id = p_room
       and (select count(*) from public.players p where p.team_id = t.id and p.status = 'approved') <> v_team_size;
    if v_bad > 0 then
      raise exception 'Har bir jamoada aynan % ta tasdiqlangan oʻquvchi boʻlishi kerak. Sinov uchun "Majburan boshlash"dan foydalaning.', v_team_size
        using errcode = 'P0001';
    end if;
    if exists (select 1 from public.players where room_id = p_room and status = 'pending') then
      raise exception 'Tasdiqlanmagan oʻquvchilar bor — ularni tasdiqlang yoki rad eting' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.game_questions where room_id = p_room and status = 'pending') then
    for i in 1..5 loop
      perform public._plan_round(p_room, i);
    end loop;
  end if;
  if not exists (select 1 from public.game_questions where room_id = p_room and status = 'pending') then
    raise exception 'Savollar rejasi boʻsh. Savollar bankiga savol qoʻshing.' using errcode = 'P0001';
  end if;

  update public.game_rooms
     set status = 'active', phase = 'round_intro', registration_open = false, started_at = now(),
         current_round = 1, current_game_question_id = null, question_deadline = null
   where id = p_room;

  perform public._log_event(p_room, 'game_started', jsonb_build_object('forced', coalesce(p_force, false), 'players', v_total));
  perform public._log_event(p_room, 'round_started', jsonb_build_object('round', 1));
  return jsonb_build_object('ok', true, 'players', v_total);
end;
$$;

create or replace function public.start_round(p_room uuid, p_round int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_round int;
  v_regen int;
begin
  r := public._lock_owned_room(p_room);
  if r.status = 'paused' then
    raise exception 'Oʻyin pauzada — avval davom ettiring' using errcode = 'P0001';
  end if;
  if r.status <> 'active' then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.game_questions where id = r.current_game_question_id and status = 'active') then
    raise exception 'Avval joriy savolni yakunlang' using errcode = 'P0001';
  end if;
  v_round := coalesce(p_round, r.current_round + 1);
  if v_round < 1 or v_round > 5 then
    raise exception 'Raund raqami 1–5 oraligʻida boʻlishi kerak' using errcode = '22023';
  end if;

  v_regen := 0;
  if v_round > r.current_round and r.current_round >= 1 then
    v_regen := public._s_int(r.settings, 'shield_regen_per_round', 15);
    update public.teams
       set shield = least(max_shield, shield + v_regen)
     where room_id = p_room
       and not (is_defeated and public._s_bool(r.settings, 'elimination_mode', false));
  end if;

  update public.game_rooms
     set current_round = v_round, phase = 'round_intro', current_game_question_id = null, question_deadline = null
   where id = p_room;

  perform public._log_event(p_room, 'round_started', jsonb_build_object('round', v_round, 'shield_regen', v_regen));
  return jsonb_build_object('round', v_round);
end;
$$;

create or replace function public.end_round(p_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  v_points jsonb;
begin
  r := public._lock_owned_room(p_room);
  if r.status not in ('active', 'paused') then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.game_questions where id = r.current_game_question_id and status = 'active') then
    raise exception 'Avval joriy savolni yakunlang' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_object_agg(t.id::text, coalesce(x.pts, 0)), '{}'::jsonb) into v_points
    from public.teams t
    left join (
      select a.team_id, sum(a.awarded_points) as pts
        from public.answers a
        join public.game_questions g on g.id = a.game_question_id
       where g.room_id = p_room and g.round_number = r.current_round
       group by a.team_id
    ) x on x.team_id = t.id
   where t.room_id = p_room;

  update public.game_rooms set phase = 'round_end', current_game_question_id = null where id = p_room;
  perform public._log_event(p_room, 'round_ended', jsonb_build_object('round', r.current_round, 'team_points', v_points));
  return v_points;
end;
$$;

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
  end if;

  update public.game_questions
     set status = 'active', question_type = q.question_type, question_text = q.question_text,
         options = q.options, image_url = q.image_url, input_spec = v_spec,
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

-- Javobni baholash, ball, energiya va jang zarbalari (ichki; qulflar chaqiruvchida)
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

  -- 1) Javoblar toʻgʻriligi va ballari
  update public.answers a
     set is_correct = public._check_answer(q.question_type, q.correct_answer, a.selected_answer),
         scored_at = now()
   where a.game_question_id = p_gq.id;

  update public.answers a
     set awarded_points = case
           when a.is_correct then v_base + case
             when v_speed then floor(v_base * v_ratio * greatest(0, 1 - a.response_ms / v_limit_ms))::int
             else 0 end
           else 0 end
   where a.game_question_id = p_gq.id;

  if v_team_first then
    update public.answers a
       set awarded_points = 0
     where a.game_question_id = p_gq.id
       and a.is_correct
       and exists (
         select 1 from public.answers b
          where b.game_question_id = a.game_question_id and b.team_id = a.team_id and b.is_correct
            and (b.submitted_at < a.submitted_at or (b.submitted_at = a.submitted_at and b.id < a.id))
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
  v_id uuid;
  v_resp int;
  v_cnt int;
  v_total int;
  v_grace int;
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

-- Savolni yopish. p_force = false: har qanday xona aʼzosi chaqirishi mumkin,
-- lekin server faqat vaqt tugagan yoki hamma javob bergan boʻlsa yopadi.
-- p_force = true: faqat oʻqituvchi ("Javobni ochish").
create or replace function public.finalize_question(p_gq uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  r public.game_rooms;
  gq public.game_questions;
  v_total int;
  v_grace int;
begin
  select room_id into v_room from public.game_questions where id = p_gq;
  if v_room is null then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;
  if coalesce(p_force, false) then
    if not public.owns_room(v_room) then
      raise exception 'Bu amal faqat oʻqituvchiga ruxsat etilgan' using errcode = '42501';
    end if;
  else
    if not public.can_view_room(v_room) then
      raise exception 'Bu xonaga kirish huquqingiz yoʻq' using errcode = '42501';
    end if;
    if not public.owns_room(v_room) then
      perform public._rate_limit('finalize_question', 20, 10);
    end if;
  end if;

  select * into r from public.game_rooms where id = v_room for update;
  select * into gq from public.game_questions where id = p_gq for update;

  if gq.status <> 'active' then
    return jsonb_build_object('finalized', false, 'status', gq.status);
  end if;

  if not coalesce(p_force, false) then
    if r.status <> 'active' then
      return jsonb_build_object('finalized', false, 'reason', 'paused');
    end if;
    select count(*) into v_total
      from public.players where room_id = v_room and status = 'approved' and team_id is not null;
    v_grace := public._s_int(r.settings, 'answer_grace_ms', 1000);
    if now() < gq.deadline + make_interval(secs => v_grace / 1000.0) and gq.answer_count < v_total then
      return jsonb_build_object('finalized', false, 'reason', 'running');
    end if;
  end if;

  return jsonb_build_object('finalized', true) || public._score_question(r, gq);
end;
$$;

create or replace function public.skip_question(p_gq uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  r public.game_rooms;
  gq public.game_questions;
begin
  select room_id into v_room from public.game_questions where id = p_gq;
  if v_room is null then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(v_room);
  select * into gq from public.game_questions where id = p_gq for update;
  if gq.status not in ('pending', 'active') then
    raise exception 'Bu savolni oʻtkazib yuborib boʻlmaydi' using errcode = 'P0001';
  end if;
  delete from public.answers where game_question_id = p_gq;
  update public.game_questions set status = 'skipped', closed_at = now(), answer_count = 0 where id = p_gq;
  if r.current_game_question_id = p_gq then
    update public.game_rooms
       set phase = 'idle', question_deadline = null, paused_remaining_ms = null, paused_open_ms = null
     where id = v_room;
  end if;
  perform public._log_event(v_room, 'question_skipped', jsonb_build_object('game_question_id', p_gq, 'round', gq.round_number));
end;
$$;

create or replace function public.restart_question(p_gq uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  r public.game_rooms;
  gq public.game_questions;
  v_disc interval;
  v_open timestamptz;
  v_deadline timestamptz;
begin
  select room_id into v_room from public.game_questions where id = p_gq;
  if v_room is null then
    raise exception 'Savol topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(v_room);
  select * into gq from public.game_questions where id = p_gq for update;

  if gq.status = 'active' then
    if r.status <> 'active' then
      raise exception 'Avval pauzani olib tashlang' using errcode = 'P0001';
    end if;
    delete from public.answers where game_question_id = p_gq;
    v_disc := greatest(interval '0', gq.answers_open_at - gq.started_at);
    v_open := now() + v_disc;
    v_deadline := v_open + make_interval(secs => gq.time_limit);
    update public.game_questions
       set answer_count = 0, started_at = now(), answers_open_at = v_open, deadline = v_deadline
     where id = p_gq;
    update public.game_rooms
       set question_deadline = v_deadline, current_question_started_at = now(), phase = 'question'
     where id = v_room;
  elsif gq.status = 'skipped' then
    if exists (select 1 from public.game_questions where id = r.current_game_question_id and status = 'active') then
      raise exception 'Joriy savol hali yakunlanmagan' using errcode = 'P0001';
    end if;
    update public.game_questions
       set status = 'pending', question_type = null, question_text = null, options = null, image_url = null,
           input_spec = null, started_at = null, answers_open_at = null, deadline = null, closed_at = null,
           answer_count = 0
     where id = p_gq;
  else
    raise exception 'Faqat faol yoki oʻtkazib yuborilgan savolni qayta boshlash mumkin' using errcode = 'P0001';
  end if;
  perform public._log_event(v_room, 'question_restarted', jsonb_build_object('game_question_id', p_gq));
end;
$$;

create or replace function public.pause_game(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  gq public.game_questions;
  v_rem int := null;
  v_open int := null;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'active' then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  select * into gq from public.game_questions where id = r.current_game_question_id;
  if found and gq.status = 'active' then
    v_rem := greatest(0, floor(extract(epoch from (gq.deadline - now())) * 1000))::int;
    v_open := greatest(0, floor(extract(epoch from (gq.answers_open_at - now())) * 1000))::int;
  end if;
  update public.game_rooms
     set status = 'paused', paused_at = now(), paused_remaining_ms = v_rem, paused_open_ms = v_open
   where id = p_room;
  perform public._log_event(p_room, 'game_paused', jsonb_build_object('remaining_ms', v_rem));
end;
$$;

create or replace function public.resume_game(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  gq public.game_questions;
  v_shift interval;
  v_deadline timestamptz := null;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'paused' then
    raise exception 'Oʻyin pauzada emas' using errcode = 'P0001';
  end if;
  v_shift := now() - coalesce(r.paused_at, now());
  select * into gq from public.game_questions where id = r.current_game_question_id for update;
  if found and gq.status = 'active' then
    -- pauza davomiyligicha muddatni surish (javob vaqtlari adolatli qoladi)
    v_deadline := greatest(now() + interval '1 second', gq.deadline + v_shift);
    update public.game_questions
       set deadline = v_deadline, answers_open_at = answers_open_at + v_shift
     where id = gq.id;
  end if;
  update public.game_rooms
     set status = 'active', paused_at = null, paused_remaining_ms = null, paused_open_ms = null,
         question_deadline = coalesce(v_deadline, question_deadline)
   where id = p_room;
  perform public._log_event(p_room, 'game_resumed');
end;
$$;

create or replace function public.adjust_timer(p_room uuid, p_seconds int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  gq public.game_questions;
  v_deadline timestamptz;
begin
  r := public._lock_owned_room(p_room);
  if p_seconds is null or p_seconds = 0 or p_seconds < -120 or p_seconds > 300 then
    raise exception 'Vaqt oʻzgarishi -120…300 soniya oraligʻida boʻlishi kerak' using errcode = '22023';
  end if;
  select * into gq from public.game_questions where id = r.current_game_question_id for update;
  if not found or gq.status <> 'active' then
    raise exception 'Faol savol yoʻq' using errcode = 'P0001';
  end if;

  if r.status = 'paused' then
    v_deadline := gq.deadline + make_interval(secs => p_seconds);
    update public.game_rooms
       set paused_remaining_ms = greatest(1000, coalesce(paused_remaining_ms, 0) + p_seconds * 1000)
     where id = p_room;
  else
    v_deadline := greatest(now() + interval '1 second', gq.deadline + make_interval(secs => p_seconds));
    update public.game_rooms set question_deadline = v_deadline where id = p_room;
  end if;
  update public.game_questions set deadline = v_deadline where id = gq.id;
  perform public._log_event(p_room, 'timer_adjusted', jsonb_build_object('seconds', p_seconds, 'deadline', v_deadline));
  return jsonb_build_object('deadline', v_deadline);
end;
$$;

-- =====================================================================
-- E. BALL TUZATISH, MAXSUS HODISALAR VA QOBILIYATLAR
-- =====================================================================
create or replace function public.adjust_score(
  p_room uuid,
  p_team uuid,
  p_player uuid,
  p_delta int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  pl public.players;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  r := public._lock_owned_room(p_room);
  if not exists (select 1 from public.teams where id = p_team and room_id = p_room) then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  if p_delta is null or p_delta = 0 or p_delta < -5000 or p_delta > 5000 then
    raise exception 'Ball oʻzgarishi -5000…5000 oraligʻida va 0 dan farqli boʻlishi kerak' using errcode = '22023';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    raise exception 'Sababni yozing (3–200 belgi)' using errcode = '22023';
  end if;
  if p_player is not null then
    select * into pl from public.players where id = p_player and room_id = p_room for update;
    if not found or pl.team_id is distinct from p_team then
      raise exception 'Oʻquvchi bu jamoada emas' using errcode = 'P0001';
    end if;
    update public.players set score = score + p_delta where id = p_player;
  end if;

  insert into public.score_adjustments (room_id, team_id, player_id, delta, reason, created_by)
  values (p_room, p_team, p_player, p_delta, v_reason, auth.uid());
  update public.teams set score = score + p_delta where id = p_team;

  perform public._log_event(p_room, 'score_adjusted', jsonb_build_object(
    'delta', p_delta, 'reason', v_reason, 'nickname', pl.nickname), p_team, p_player);
end;
$$;

create or replace function public.trigger_special_event(p_room uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  if r.status not in ('active', 'paused') then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if p_kind = 'energy_surge' then
    update public.teams set energy = least(public._s_int(r.settings, 'max_energy', 100), energy + 25)
     where room_id = p_room;
  elsif p_kind = 'meteor_storm' then
    update public.teams set shield = case when shield > 0 then greatest(1, shield - 5) else 0 end
     where room_id = p_room;
  elsif p_kind = 'shield_repair' then
    update public.teams set shield = least(max_shield, shield + 15)
     where room_id = p_room and not (is_defeated and public._s_bool(r.settings, 'elimination_mode', false));
  elsif p_kind = 'double_points' then
    update public.game_rooms set next_points_multiplier = 2 where id = p_room;
  else
    raise exception 'Nomaʼlum maxsus hodisa' using errcode = '22023';
  end if;
  perform public._log_event(p_room, 'special_event', jsonb_build_object('kind', p_kind));
end;
$$;

create or replace function public._apply_ability(r public.game_rooms, p_team uuid, p_ability text, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teams;
  opp public.teams;
  ab public.team_abilities;
  gq public.game_questions;
  v_cost int;
  v_details jsonb := '{}'::jsonb;
  v_amount int;
  v_hint text;
  v_secs int;
begin
  select * into t from public.teams where id = p_team and room_id = r.id for update;
  if not found then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  if r.status not in ('active', 'paused') then
    raise exception 'Qobiliyatlar faqat oʻyin davomida ishlatiladi' using errcode = 'P0001';
  end if;
  if coalesce(r.settings -> 'disabled_abilities', '[]'::jsonb) ? p_ability then
    raise exception 'Bu qobiliyat oʻqituvchi tomonidan oʻchirilgan' using errcode = 'P0001';
  end if;
  select * into ab from public.team_abilities where team_id = p_team and ability_type = p_ability for update;
  if not found or not ab.is_enabled then
    raise exception 'Bu qobiliyat mavjud emas' using errcode = 'P0001';
  end if;
  if ab.uses_left <= 0 then
    raise exception 'Bu qobiliyatdan foydalanish limiti tugagan' using errcode = 'P0001';
  end if;
  if ab.cooldown_until is not null and ab.cooldown_until > now() then
    raise exception 'Qobiliyat hali qayta zaryadlanmoqda' using errcode = 'P0001';
  end if;
  v_cost := coalesce((r.settings -> 'ability_costs' ->> p_ability)::int, 30);
  if t.energy < v_cost then
    raise exception 'Energiya yetarli emas (kerak: %, bor: %)', v_cost, t.energy using errcode = 'P0001';
  end if;
  select * into opp from public.teams where room_id = r.id and id <> t.id limit 1 for update;

  if p_ability = 'shield_boost' then
    if t.shield_boost_active then
      raise exception 'Qalqon kuchaytirgichi allaqachon faol' using errcode = 'P0001';
    end if;
    update public.teams set shield_boost_active = true where id = t.id;
    v_details := jsonb_build_object('block_ratio', public._s_num(r.settings, 'shield_boost_block', 0.6));
  elsif p_ability = 'double_attack' then
    if t.double_attack_active then
      raise exception 'Ikki karra zarba allaqachon faol' using errcode = 'P0001';
    end if;
    update public.teams set double_attack_active = true where id = t.id;
  elsif p_ability = 'time_freeze' then
    select * into gq from public.game_questions where id = r.current_game_question_id for update;
    if not found or gq.status <> 'active' or now() >= gq.deadline then
      raise exception 'Faol savol yoʻq — vaqtni muzlatib boʻlmaydi' using errcode = 'P0001';
    end if;
    v_secs := public._s_int(r.settings, 'time_freeze_seconds', 10);
    update public.game_questions set deadline = deadline + make_interval(secs => v_secs) where id = gq.id;
    if r.status = 'paused' then
      update public.game_rooms
         set paused_remaining_ms = coalesce(paused_remaining_ms, 0) + v_secs * 1000
       where id = r.id;
    else
      update public.game_rooms set question_deadline = gq.deadline + make_interval(secs => v_secs) where id = r.id;
    end if;
    v_details := jsonb_build_object('seconds', v_secs);
  elsif p_ability = 'energy_steal' then
    v_amount := least(public._s_int(r.settings, 'energy_steal_amount', 20), opp.energy);
    if v_amount <= 0 then
      raise exception 'Raqib jamoada oʻgʻirlash uchun energiya yoʻq' using errcode = 'P0001';
    end if;
    update public.teams set energy = energy - v_amount where id = opp.id;
    v_details := jsonb_build_object('amount', v_amount, 'from_team_id', opp.id);
  elsif p_ability = 'hint_scan' then
    select * into gq from public.game_questions where id = r.current_game_question_id;
    if not found or gq.status <> 'active' then
      raise exception 'Faol savol yoʻq — maslahatni ochib boʻlmaydi' using errcode = 'P0001';
    end if;
    select nullif(hint, '') into v_hint from public.questions where id = gq.question_id;
    if v_hint is null then
      raise exception 'Bu savol uchun maslahat kiritilmagan' using errcode = 'P0001';
    end if;
    insert into public.team_hints (room_id, team_id, game_question_id, hint)
    values (r.id, t.id, gq.id, v_hint)
    on conflict (team_id, game_question_id) do nothing;
    v_details := jsonb_build_object('game_question_id', gq.id);
  else
    raise exception 'Nomaʼlum qobiliyat' using errcode = '22023';
  end if;

  -- narx toʻlanadi (energy_steal uchun oʻgʻirlangan energiya qoʻshiladi)
  update public.teams
     set energy = least(public._s_int(r.settings, 'max_energy', 100),
                        greatest(0, energy - v_cost + coalesce((v_details ->> 'amount')::int, 0)))
   where id = t.id;
  update public.team_abilities
     set uses_left = uses_left - 1,
         cooldown_until = now() + make_interval(secs => public._s_int(r.settings, 'ability_cooldown_seconds', 30))
   where id = ab.id;
  if p_request is not null then
    update public.ability_requests set status = 'approved', resolved_at = now() where id = p_request;
  end if;

  perform public._log_event(r.id, 'ability_used',
    jsonb_build_object('ability', p_ability, 'cost', v_cost) || v_details, t.id);
  return jsonb_build_object('ability', p_ability, 'cost', v_cost) || v_details;
end;
$$;

create or replace function public.use_ability(p_room uuid, p_team uuid, p_ability text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  return public._apply_ability(r, p_team, p_ability, null);
end;
$$;

create or replace function public.request_ability(p_room uuid, p_ability text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  pl public.players;
  v_id uuid;
begin
  perform public._rate_limit('request_ability', 6, 60);
  select * into r from public.game_rooms where id = p_room;
  if not found then
    raise exception 'Xona topilmadi' using errcode = 'P0002';
  end if;
  select * into pl from public.players where room_id = p_room and user_id = auth.uid() and status = 'approved';
  if not found or pl.team_id is null then
    raise exception 'Siz bu oʻyinda ishtirokchi emassiz' using errcode = '42501';
  end if;
  if not public._s_bool(r.settings, 'ability_voting', false) then
    raise exception 'Qobiliyat soʻrash oʻqituvchi tomonidan yoqilmagan' using errcode = 'P0001';
  end if;
  if r.status not in ('active', 'paused') then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  if p_ability not in ('shield_boost', 'double_attack', 'time_freeze', 'energy_steal', 'hint_scan') then
    raise exception 'Nomaʼlum qobiliyat' using errcode = '22023';
  end if;
  if coalesce(r.settings -> 'disabled_abilities', '[]'::jsonb) ? p_ability then
    raise exception 'Bu qobiliyat oʻchirilgan' using errcode = 'P0001';
  end if;

  insert into public.ability_requests (room_id, team_id, player_id, ability_type)
  values (p_room, pl.team_id, pl.id, p_ability)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('created', false, 'message', 'Jamoangiz bu qobiliyatni allaqachon soʻragan');
  end if;
  perform public._log_event(p_room, 'ability_requested',
    jsonb_build_object('ability', p_ability, 'nickname', pl.nickname), pl.team_id, pl.id);
  return jsonb_build_object('created', true, 'id', v_id);
end;
$$;

create or replace function public.resolve_ability_request(p_request uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.ability_requests;
  r public.game_rooms;
begin
  select * into req from public.ability_requests where id = p_request;
  if not found then
    raise exception 'Soʻrov topilmadi' using errcode = 'P0002';
  end if;
  r := public._lock_owned_room(req.room_id);
  select * into req from public.ability_requests where id = p_request for update;
  if req.status <> 'pending' then
    raise exception 'Bu soʻrov allaqachon koʻrib chiqilgan' using errcode = 'P0001';
  end if;
  if p_approve then
    return public._apply_ability(r, req.team_id, req.ability_type, req.id);
  end if;
  update public.ability_requests set status = 'rejected', resolved_at = now() where id = p_request;
  perform public._log_event(req.room_id, 'ability_rejected', jsonb_build_object('ability', req.ability_type), req.team_id);
  return jsonb_build_object('rejected', true);
end;
$$;
