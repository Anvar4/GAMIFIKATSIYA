-- =====================================================================
-- 4-migratsiya: natijalar, mukofotlar, mijoz snapshot'i, huquqlar, realtime
-- =====================================================================

-- ---------------------------------------------------------------------
-- Natijalarni hisoblash (ichki)
-- ---------------------------------------------------------------------
create or replace function public._award(p_row jsonb, p_reason text)
returns jsonb
language sql
immutable
as $$
  select case when p_row is null then null else jsonb_build_object(
    'player_id', p_row ->> 'player_id',
    'nickname', p_row ->> 'nickname',
    'team_id', p_row ->> 'team_id',
    'reason', p_reason,
    'manual', false
  ) end;
$$;

create or replace function public._compute_results(p_room uuid, p_winner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qcount int;
  v_half int;
  v_final jsonb;
  v_players jsonb;
  v_rounds jsonb;
  v_fastest jsonb;
  v_awards jsonb := '{}'::jsonb;
  v_winner uuid;
  v_tie boolean := false;
  x jsonb;
  v_min_answers int;
begin
  select count(*) into v_qcount from public.game_questions where room_id = p_room and status = 'revealed';
  v_half := v_qcount / 2;

  select coalesce(jsonb_agg(jsonb_build_object(
           'team_id', t.id, 'name', t.name, 'color', t.color, 'spaceship_skin', t.spaceship_skin, 'slot', t.slot,
           'score', t.score, 'shield', t.shield, 'max_shield', t.max_shield, 'energy', t.energy,
           'correct_count', t.correct_count, 'answered_count', t.answered_count, 'possible_count', t.possible_count,
           'accuracy', case when t.possible_count > 0 then round(100.0 * t.correct_count / t.possible_count, 1) else 0 end,
           'best_streak', t.best_streak, 'is_defeated', t.is_defeated,
           'adjustments', coalesce((select sum(delta) from public.score_adjustments sa where sa.team_id = t.id), 0)
         ) order by t.score desc, t.shield desc), '[]'::jsonb)
    into v_final
    from public.teams t where t.room_id = p_room;

  if p_winner is not null then
    if not exists (select 1 from public.teams where id = p_winner and room_id = p_room) then
      raise exception 'Gʻolib jamoa topilmadi' using errcode = 'P0002';
    end if;
    v_winner := p_winner;
  else
    select id into v_winner from public.teams where room_id = p_room order by score desc, shield desc, slot limit 1;
    if (select count(*) from (select distinct score, shield from public.teams where room_id = p_room) d) = 1 then
      v_tie := true;
      v_winner := null;
    end if;
  end if;

  with gqs as (
    select id, round_number, started_at, row_number() over (order by started_at, id) as rn
      from public.game_questions
     where room_id = p_room and status = 'revealed'
  )
  select coalesce(jsonb_agg(s.obj order by (s.obj ->> 'score')::int desc, (s.obj ->> 'accuracy')::numeric desc), '[]'::jsonb)
    into v_players
    from (
      select jsonb_build_object(
               'player_id', p.id,
               'nickname', p.nickname,
               'team_id', p.team_id,
               'score', p.score,
               'correct', p.correct_count,
               'answered', p.answered_count,
               'possible', st.possible,
               'accuracy', case when st.possible > 0 then round(100.0 * p.correct_count / st.possible, 1) else 0 end,
               'avg_correct_ms', st.avg_correct_ms,
               'fastest_correct_ms', st.fastest_ms,
               'best_streak', p.best_streak,
               'strategy_points', st.strategy_points,
               'improvement', case when v_qcount >= 6 then st.improvement end,
               'round_points', st.round_points
             ) as obj
        from public.players p
        cross join lateral (
          select
            (select count(*) from gqs where p.approved_at is null or gqs.started_at >= p.approved_at) as possible,
            (select round(avg(a.response_ms)) from public.answers a where a.player_id = p.id and a.is_correct) as avg_correct_ms,
            (select min(a.response_ms) from public.answers a where a.player_id = p.id and a.is_correct) as fastest_ms,
            (select coalesce(sum(a.awarded_points), 0)
               from public.answers a join gqs on gqs.id = a.game_question_id
              where a.player_id = p.id and gqs.round_number in (4, 5)) as strategy_points,
            (select round(
                 100.0 * count(*) filter (where a.is_correct and gqs.rn > v_half) / greatest(1, v_qcount - v_half)
               - 100.0 * count(*) filter (where a.is_correct and gqs.rn <= v_half) / greatest(1, v_half), 1)
               from public.answers a join gqs on gqs.id = a.game_question_id
              where a.player_id = p.id) as improvement,
            (select coalesce(jsonb_object_agg(rp.round_number::text, rp.pts), '{}'::jsonb)
               from (select gqs.round_number, sum(a.awarded_points) as pts
                       from public.answers a join gqs on gqs.id = a.game_question_id
                      where a.player_id = p.id
                      group by gqs.round_number) rp) as round_points
        ) st
       where p.room_id = p_room and p.status = 'approved' and p.team_id is not null
    ) s;

  select coalesce(jsonb_agg(jsonb_build_object('round', rr.round_number, 'teams', rr.teams) order by rr.round_number), '[]'::jsonb)
    into v_rounds
    from (
      select g.round_number,
             jsonb_object_agg(t.id::text, coalesce((
               select sum(a.awarded_points) from public.answers a
                 join public.game_questions g2 on g2.id = a.game_question_id
                where g2.room_id = p_room and g2.round_number = g.round_number and a.team_id = t.id), 0)) as teams
        from (select distinct round_number from public.game_questions where room_id = p_room and status = 'revealed') g
       cross join public.teams t
       where t.room_id = p_room
       group by g.round_number
    ) rr;

  select jsonb_build_object('player_id', a.player_id, 'nickname', p.nickname, 'team_id', p.team_id,
                            'response_ms', a.response_ms, 'game_question_id', a.game_question_id)
    into v_fastest
    from public.answers a join public.players p on p.id = a.player_id
   where a.room_id = p_room and a.is_correct
   order by a.response_ms asc, a.submitted_at asc
   limit 1;

  -- -------- Mukofotlar (faqat yozib olingan oʻyin maʼlumotlari asosida) --------
  v_min_answers := greatest(2, ceil(v_qcount * 0.5)::int);

  -- GALAKTIK CHEMPION: eng koʻp ball (teng boʻlsa — aniqlik, keyin barqarorlik)
  select e into x from jsonb_array_elements(v_players) e
   where (e ->> 'score')::int > 0
   order by (e ->> 'score')::int desc, (e ->> 'accuracy')::numeric desc, (e ->> 'best_streak')::int desc
   limit 1;
  v_awards := v_awards || jsonb_build_object('galactic_champion',
    public._award(x, 'Eng yuqori shaxsiy ball: ' || coalesce(x ->> 'score', '0')));

  -- BILIMLAR USTASI: eng yuqori aniqlik (yetarli javoblar soni bilan)
  x := null;
  select e into x from jsonb_array_elements(v_players) e
   where (e ->> 'answered')::int >= v_min_answers and (e ->> 'correct')::int > 0
   order by (e ->> 'accuracy')::numeric desc, (e ->> 'correct')::int desc
   limit 1;
  v_awards := v_awards || jsonb_build_object('knowledge_master',
    public._award(x, 'Eng yuqori aniqlik: ' || coalesce(x ->> 'accuracy', '0') || '%'));

  -- TEZLIK USTASI: oʻrtacha toʻgʻri javob vaqti eng kichik (kamida 50% aniqlik bilan)
  x := null;
  select e into x from jsonb_array_elements(v_players) e
   where (e ->> 'correct')::int >= greatest(2, ceil(v_qcount * 0.3)::int)
     and (e ->> 'accuracy')::numeric >= 50
     and e ->> 'avg_correct_ms' is not null
   order by (e ->> 'avg_correct_ms')::numeric asc
   limit 1;
  v_awards := v_awards || jsonb_build_object('speed_master',
    public._award(x, 'Toʻgʻri javoblarning oʻrtacha vaqti: ' ||
      coalesce(round((x ->> 'avg_correct_ms')::numeric / 1000.0, 1)::text, '—') || ' s'));

  -- ENG YAXSHI STRATEG: "Hack the System" va "Galactic Boss" raundlaridagi ball
  x := null;
  select e into x from jsonb_array_elements(v_players) e
   where (e ->> 'strategy_points')::int > 0
   order by (e ->> 'strategy_points')::int desc, (e ->> 'accuracy')::numeric desc
   limit 1;
  v_awards := v_awards || jsonb_build_object('best_strategist',
    public._award(x, '4–5-raundlardagi ball: ' || coalesce(x ->> 'strategy_points', '0')));

  -- JAMOA OʻYINCHISI: eng faol ishtirok (javob berilgan savollar ulushi), keyin seriya
  x := null;
  select e into x from jsonb_array_elements(v_players) e
   where (e ->> 'answered')::int > 0
   order by ((e ->> 'answered')::numeric / greatest(1, (e ->> 'possible')::numeric)) desc,
            (e ->> 'best_streak')::int desc, (e ->> 'accuracy')::numeric desc
   limit 1;
  v_awards := v_awards || jsonb_build_object('team_player',
    public._award(x, 'Eng faol ishtirok: ' || coalesce(x ->> 'answered', '0') || '/' || coalesce(x ->> 'possible', '0') || ' savol'));

  -- ENG KOʻP OʻSGAN ISHTIROKCHI (kamida 6 ta savol oʻynalganda)
  x := null;
  if v_qcount >= 6 then
    select e into x from jsonb_array_elements(v_players) e
     where (e ->> 'improvement')::numeric > 0
     order by (e ->> 'improvement')::numeric desc
     limit 1;
  end if;
  v_awards := v_awards || jsonb_build_object('most_improved',
    public._award(x, 'Ikkinchi yarmida aniqlik +' || coalesce(x ->> 'improvement', '0') || ' foiz punktga oshdi'));

  return jsonb_build_object(
    'winner_team_id', v_winner,
    'is_tie', v_tie,
    'final_scores', v_final,
    'statistics', jsonb_build_object(
      'questions_played', v_qcount,
      'players', v_players,
      'rounds', v_rounds,
      'fastest_correct', v_fastest
    ),
    'awards', v_awards
  );
end;
$$;

create or replace function public.end_game(p_room uuid, p_winner uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  gq public.game_questions;
  v jsonb;
begin
  r := public._lock_owned_room(p_room);
  if r.status not in ('active', 'paused') then
    raise exception 'Oʻyin faol emas' using errcode = 'P0001';
  end if;
  select * into gq from public.game_questions where id = r.current_game_question_id for update;
  if found and gq.status = 'active' then
    perform public._score_question(r, gq);
  end if;

  v := public._compute_results(p_room, p_winner);

  insert into public.game_results (room_id, winner_team_id, is_tie, final_scores, statistics, awards, completed_at)
  values (p_room, (v ->> 'winner_team_id')::uuid, (v ->> 'is_tie')::boolean, v -> 'final_scores', v -> 'statistics', v -> 'awards', now())
  on conflict (room_id) do update
    set winner_team_id = excluded.winner_team_id, is_tie = excluded.is_tie, final_scores = excluded.final_scores,
        statistics = excluded.statistics, awards = excluded.awards, completed_at = excluded.completed_at;

  update public.game_rooms
     set status = 'finished', phase = 'finished', finished_at = now(), registration_open = false,
         winner_team_id = (v ->> 'winner_team_id')::uuid, question_deadline = null,
         paused_at = null, paused_remaining_ms = null, paused_open_ms = null
   where id = p_room;

  perform public._log_event(p_room, 'game_finished',
    jsonb_build_object('winner_team_id', v ->> 'winner_team_id', 'is_tie', (v ->> 'is_tie')::boolean));
  return v;
end;
$$;

-- Durangda oʻqituvchi gʻolibni tanlaydi (tie-breaker natijasi)
create or replace function public.set_winner(p_room uuid, p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'finished' then
    raise exception 'Gʻolibni faqat oʻyin yakunlangandan keyin belgilash mumkin' using errcode = 'P0001';
  end if;
  if p_team is not null and not exists (select 1 from public.teams where id = p_team and room_id = p_room) then
    raise exception 'Jamoa topilmadi' using errcode = 'P0002';
  end if;
  update public.game_results set winner_team_id = p_team, is_tie = (p_team is null) where room_id = p_room;
  update public.game_rooms set winner_team_id = p_team where id = p_room;
  perform public._log_event(p_room, 'winner_set', jsonb_build_object('winner_team_id', p_team), p_team);
end;
$$;

create or replace function public.set_award(p_room uuid, p_award text, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  pl public.players;
begin
  r := public._lock_owned_room(p_room);
  if r.status <> 'finished' then
    raise exception 'Mukofotlar oʻyin yakunlangandan keyin beriladi' using errcode = 'P0001';
  end if;
  if p_award not in ('galactic_champion', 'best_strategist', 'speed_master', 'knowledge_master', 'team_player', 'most_improved') then
    raise exception 'Nomaʼlum mukofot' using errcode = '22023';
  end if;
  if p_player is null then
    update public.game_results set awards = awards || jsonb_build_object(p_award, null) where room_id = p_room;
  else
    select * into pl from public.players where id = p_player and room_id = p_room;
    if not found then
      raise exception 'Oʻquvchi topilmadi' using errcode = 'P0002';
    end if;
    update public.game_results
       set awards = awards || jsonb_build_object(p_award, jsonb_build_object(
             'player_id', pl.id, 'nickname', pl.nickname, 'team_id', pl.team_id,
             'reason', 'Oʻqituvchi tomonidan tayinlandi', 'manual', true))
     where room_id = p_room;
  end if;
  perform public._log_event(p_room, 'award_set', jsonb_build_object('award', p_award, 'nickname', pl.nickname), pl.team_id, pl.id);
end;
$$;

-- ---------------------------------------------------------------------
-- Snapshot: rolga mos holat (oʻquvchiga maxfiy maʼlumot yuborilmaydi)
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
    'results', case when p_gq.status = 'revealed' then p_gq.results end
  );
  if p_owner then
    select * into q from public.questions where id = p_gq.question_id;
    v := v || jsonb_build_object('secret', jsonb_build_object(
      'correct_answer', q.correct_answer, 'explanation', q.explanation, 'hint', q.hint,
      'subject', q.subject, 'grade', q.grade, 'category', q.category, 'difficulty', q.difficulty));
  end if;
  return v;
end;
$$;

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
               'awarded_points', case when gq.status = 'revealed' then a.awarded_points end)
        from public.answers a where a.game_question_id = gq.id and a.player_id = me.id
    ) end,
    'answers', case when v_has_q and v_owner then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'player_id', a.player_id, 'team_id', a.team_id, 'selected_answer', a.selected_answer,
               'submitted_at', a.submitted_at, 'response_ms', a.response_ms,
               'is_correct', a.is_correct, 'awarded_points', a.awarded_points
             ) order by a.submitted_at), '[]'::jsonb)
        from public.answers a where a.game_question_id = gq.id
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

create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- =====================================================================
-- Huquqlar: barcha funksiyalarni yopamiz, keyin faqat ochiq RPC'larni ochamiz
-- =====================================================================
revoke execute on all functions in schema public from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on all functions in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on all functions in schema public from authenticated';
  end if;
end;
$$;

-- RLS siyosatlari ishlatadigan yordamchilar
grant execute on function public.is_instructor() to authenticated;
grant execute on function public.owns_room(uuid) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.can_view_room(uuid) to authenticated;
grant execute on function public.my_team_in_room(uuid) to authenticated;
grant execute on function public.default_room_settings() to authenticated;
grant execute on function public.server_time() to authenticated;

-- Oʻqituvchi RPC'lari (ichida owns_room / is_instructor tekshiriladi)
grant execute on function public.create_room(text, jsonb) to authenticated;
grant execute on function public.update_room_settings(uuid, jsonb) to authenticated;
grant execute on function public.update_team(uuid, text, text, text) to authenticated;
grant execute on function public.set_registration(uuid, boolean) to authenticated;
grant execute on function public.reset_room(uuid) to authenticated;
grant execute on function public.archive_room(uuid) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
grant execute on function public.approve_player(uuid, uuid) to authenticated;
grant execute on function public.approve_all_players(uuid) to authenticated;
grant execute on function public.reject_player(uuid) to authenticated;
grant execute on function public.kick_player(uuid) to authenticated;
grant execute on function public.assign_player_team(uuid, uuid) to authenticated;
grant execute on function public.auto_balance_teams(uuid) to authenticated;
grant execute on function public.plan_rounds_auto(uuid, int) to authenticated;
grant execute on function public.set_round_questions(uuid, int, uuid[], int, int) to authenticated;
grant execute on function public.update_game_question(uuid, int, int) to authenticated;
grant execute on function public.shuffle_round(uuid, int) to authenticated;
grant execute on function public.start_game(uuid, boolean) to authenticated;
grant execute on function public.start_round(uuid, int) to authenticated;
grant execute on function public.end_round(uuid) to authenticated;
grant execute on function public.start_question(uuid, uuid, int) to authenticated;
grant execute on function public.skip_question(uuid) to authenticated;
grant execute on function public.restart_question(uuid) to authenticated;
grant execute on function public.pause_game(uuid) to authenticated;
grant execute on function public.resume_game(uuid) to authenticated;
grant execute on function public.adjust_timer(uuid, int) to authenticated;
grant execute on function public.adjust_score(uuid, uuid, uuid, int, text) to authenticated;
grant execute on function public.trigger_special_event(uuid, text) to authenticated;
grant execute on function public.use_ability(uuid, uuid, text) to authenticated;
grant execute on function public.resolve_ability_request(uuid, boolean) to authenticated;
grant execute on function public.end_game(uuid, uuid) to authenticated;
grant execute on function public.set_winner(uuid, uuid) to authenticated;
grant execute on function public.set_award(uuid, text, uuid) to authenticated;

-- Oʻquvchi va umumiy RPC'lar
grant execute on function public.lookup_room(text) to authenticated;
grant execute on function public.join_room(text, text, uuid) to authenticated;
grant execute on function public.submit_answer(uuid, text) to authenticated;
grant execute on function public.finalize_question(uuid, boolean) to authenticated;
grant execute on function public.request_ability(uuid, text) to authenticated;
grant execute on function public.get_room_snapshot(uuid) to authenticated;

-- =====================================================================
-- Realtime: mijozlar faqat hodisalar jurnaliga obuna boʻladi (RLS bilan
-- filtrlanadi) va har bir hodisadan keyin xavfsiz snapshot'ni qayta oladi.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_events'
    ) then
      execute 'alter publication supabase_realtime add table public.game_events';
    end if;
  end if;
end;
$$;
