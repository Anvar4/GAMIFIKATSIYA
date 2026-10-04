-- =====================================================================
-- 2-migratsiya: Row Level Security
-- Barcha yozish amallari SECURITY DEFINER RPC funksiyalar orqali bajariladi.
-- Mijozlar jadvallarga toʻgʻridan-toʻgʻri faqat oʻqish huquqiga ega
-- (savollar banki bundan mustasno — uni oʻqituvchi tahrirlaydi).
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.game_rooms        enable row level security;
alter table public.teams             enable row level security;
alter table public.players           enable row level security;
alter table public.questions         enable row level security;
alter table public.game_questions    enable row level security;
alter table public.answers           enable row level security;
alter table public.game_events       enable row level security;
alter table public.team_abilities    enable row level security;
alter table public.ability_requests  enable row level security;
alter table public.team_hints        enable row level security;
alter table public.score_adjustments enable row level security;
alter table public.game_results      enable row level security;
alter table public.rate_limits       enable row level security;

-- profiles: faqat oʻz profili
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- game_rooms: egasi (oʻqituvchi) yoki xona aʼzosi
create policy game_rooms_select on public.game_rooms
  for select to authenticated
  using (public.can_view_room(id));

-- teams
create policy teams_select on public.teams
  for select to authenticated
  using (public.can_view_room(room_id));

-- players: xona aʼzolari va har kim oʻz yozuvini
create policy players_select on public.players
  for select to authenticated
  using (user_id = auth.uid() or public.can_view_room(room_id));

-- questions: faqat oʻqituvchilar (toʻgʻri javoblar shu yerda saqlanadi!)
create policy questions_select on public.questions
  for select to authenticated
  using (public.is_instructor());
create policy questions_insert on public.questions
  for insert to authenticated
  with check (public.is_instructor() and (created_by is null or created_by = auth.uid()));
create policy questions_update on public.questions
  for update to authenticated
  using (public.is_instructor())
  with check (public.is_instructor());
create policy questions_delete on public.questions
  for delete to authenticated
  using (public.is_instructor());

-- game_questions: oʻquvchilar faqat boshlangan savollarni koʻradi
-- (va bu qatorlarda toʻgʻri javob faqat ochilgandan keyin paydo boʻladi)
create policy game_questions_select on public.game_questions
  for select to authenticated
  using (
    public.owns_room(room_id)
    or (public.is_room_member(room_id) and status <> 'pending')
  );

-- answers: oʻqituvchi hammasini, oʻquvchi faqat oʻzinikini
create policy answers_select on public.answers
  for select to authenticated
  using (
    public.owns_room(room_id)
    or player_id in (select id from public.players where user_id = auth.uid())
  );

-- game_events: xona aʼzolari (hodisalarda maxfiy maʼlumot saqlanmaydi)
create policy game_events_select on public.game_events
  for select to authenticated
  using (public.can_view_room(room_id));

-- team_abilities
create policy team_abilities_select on public.team_abilities
  for select to authenticated
  using (public.can_view_room(room_id));

-- ability_requests: oʻqituvchi yoki oʻsha jamoa aʼzolari
create policy ability_requests_select on public.ability_requests
  for select to authenticated
  using (public.owns_room(room_id) or team_id = public.my_team_in_room(room_id));

-- team_hints: oʻqituvchi yoki oʻsha jamoa aʼzolari
create policy team_hints_select on public.team_hints
  for select to authenticated
  using (public.owns_room(room_id) or team_id = public.my_team_in_room(room_id));

-- score_adjustments: faqat oʻqituvchi
create policy score_adjustments_select on public.score_adjustments
  for select to authenticated
  using (public.owns_room(room_id));

-- game_results
create policy game_results_select on public.game_results
  for select to authenticated
  using (public.can_view_room(room_id));

-- rate_limits: hech kimga ochiq emas (siyosat yoʻq)

-- anon roli umuman jadval maʼlumotlarini koʻrmaydi
revoke all on all tables in schema public from anon;

-- Qoʻshimcha himoya: authenticated roli jadvallarga toʻgʻridan-toʻgʻri
-- yoza olmaydi (savollar banki bundan mustasno). Oʻyin holati faqat RPC orqali oʻzgaradi.
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.questions to authenticated;
revoke all on public.rate_limits from authenticated;
