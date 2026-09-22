-- Better Fit — Datenmodell für die Produktion auf Supabase (Postgres).
--
-- Lokal läuft Better Fit im eigenen Dienst (services/api/fit, Ablage fit.json)
-- mit derselben Regel: jede persönliche Zeile gehört genau einem Konto, und nur
-- dieses Konto liest und ändert sie. Hier setzt das Row Level Security durch.
--
-- Die App spricht nie mit dem Service-Role-Schlüssel; der bleibt im Backend.
-- Nährwerte, Mahlzeiten-Summen und Bestätigungen des Coaches schreibt nur das
-- Backend (Service Role), damit kein Client eigene Zahlen speichert.

-- ------------------------------------------------------------------ Katalog

create table public.food_catalog (
  id text primary key,                      -- z. B. 'swiss:123', 'usda:171287', 'off:7610...'
  source text not null check (source in ('swiss', 'usda', 'off', 'label', 'custom', 'mock')),
  source_id text not null,
  source_version text,
  owner_id uuid references auth.users (id) on delete cascade,  -- nur bei 'custom' und 'label'
  names jsonb not null,                     -- { de, fr, it, en }
  synonyms text[] not null default '{}',
  brand text,
  barcode text,
  state text check (state in ('raw', 'cooked', 'prepared')),
  kcal numeric not null check (kcal between 0 and 950),
  protein_g numeric not null check (protein_g between 0 and 100),
  carbs_g numeric not null check (carbs_g between 0 and 100),
  fat_g numeric not null check (fat_g between 0 and 100),
  fiber_g numeric check (fiber_g between 0 and 100),
  sugar_g numeric check (sugar_g between 0 and 100),
  salt_g numeric check (salt_g between 0 and 100),
  grams_per_piece numeric check (grams_per_piece > 0),
  grams_per_ml numeric check (grams_per_ml > 0),
  allergens text[] not null default '{}',
  shop_category text not null default 'other',
  quality numeric not null default 0.5,
  created_at timestamptz not null default now(),
  constraint macros_fit_weight check (protein_g + carbs_g + fat_g <= 105),
  constraint owner_only_for_own check ((source in ('custom', 'label')) = (owner_id is not null))
);
create index food_catalog_barcode on public.food_catalog (barcode) where barcode is not null;

-- Rohdaten der Quellen (Barcode-, USDA-, Open-Food-Facts-Antworten), getrennt
-- gehalten wegen der ODbL: Open Food Facts wird nie mit anderen Quellen vermischt.
create table public.food_source_records (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('swiss', 'usda', 'off')),
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (source, source_id)
);

-- ------------------------------------------------------------------ Person

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_date date not null,
  height_cm numeric not null check (height_cm between 120 and 230),
  weight_kg numeric not null check (weight_kg between 30 and 350),
  sex text not null default 'unspecified' check (sex in ('female', 'male', 'unspecified')),
  activity text not null check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  training_days_per_week int not null check (training_days_per_week between 0 and 7),
  diet text not null default 'omnivore' check (diet in ('omnivore', 'vegetarian', 'vegan', 'pescetarian')),
  allergies text[] not null default '{}',
  excluded_foods text[] not null default '{}',
  pregnant boolean not null default false,
  breastfeeding boolean not null default false,
  eating_disorder boolean not null default false,
  medical_condition boolean not null default false,
  household_size int not null default 1,
  budget text not null default 'medium',
  max_cook_minutes int not null default 45,
  equipment text[] not null default '{}',
  timezone text not null default 'Europe/Zurich',
  units text not null default 'metric',
  store_original_images boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  pace text not null check (pace in ('gentle', 'moderate')),
  kcal int not null, protein_g int not null, carbs_g int not null, fat_g int not null,
  training_day jsonb not null, rest_day jsonb not null,
  kcal_adjustment int not null default 0 check (kcal_adjustment between -300 and 300),
  safety_mode text not null default 'normal',
  valid_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  weight_kg numeric not null check (weight_kg between 30 and 350),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

-- ------------------------------------------------------------------ Küche

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  servings int not null check (servings between 1 and 20),
  cooked_weight_g numeric,
  time_minutes int not null default 30,
  difficulty text not null default 'easy',
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  steps text[] not null default '{}',
  notes text not null default '',
  based_on text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null references public.food_catalog (id),
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'pinch')),
  grams numeric not null check (grams > 0 and grams <= 5000),
  optional boolean not null default false,
  position int not null default 0
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null references public.food_catalog (id),
  amount numeric not null check (amount >= 0),
  unit text not null,
  grams numeric,
  best_before date,
  confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  status text not null check (status in ('draft', 'confirmed', 'archived')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.meal_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('training', 'rest')),
  target jsonb not null
);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.meal_plan_days (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes (id) on delete set null,
  portions numeric not null default 1,
  skipped boolean not null default false,
  eaten_meal_id uuid
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.meal_plans (id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text references public.food_catalog (id),
  name text not null,
  amount numeric not null,
  unit text not null,
  shop_category text not null default 'other',
  basic boolean not null default false,
  done boolean not null default false
);

-- ------------------------------------------------------------------ Tagebuch

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  source text not null,
  kcal int not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null,
  kcal_min int, kcal_max int,
  analysis_id uuid,
  plan_entry_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null,
  name text not null,
  grams numeric not null check (grams between 1 and 3000),
  source text not null,
  per100 jsonb not null,                    -- Abschrift: spätere Importe ändern nichts rückwirkend
  kcal int not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null
);

-- Originalbilder nur bis zum Ende der Analyse (ohne Zustimmung), ohne EXIF.
create table public.meal_images_temp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null,
  storage_path text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int not null check (bytes <= 8000000),
  delete_after timestamptz not null default now() + interval '1 hour'
);

create table public.meal_analysis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model text, images int not null, input_tokens int, output_tokens int,
  duration_ms int, cost_chf numeric, status text not null, level text,
  corrections int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ Training

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null, goal text not null, experience text not null,
  days_per_week int not null, equipment text[] not null default '{}',
  template_id text not null,
  created_at timestamptz not null default now()
);

create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  day date not null,
  title text not null,
  status text not null check (status in ('planned', 'done', 'skipped', 'moved')),
  moved_from date,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.scheduled_workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null, position int not null default 0,
  target_sets int, target_reps text, rest_seconds int
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reps int not null check (reps between 1 and 100),
  weight_kg numeric check (weight_kg between 0 and 1000),
  rir int check (rir between 0 and 10),
  warmup boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ Coach

create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'coach')),
  text text not null,
  action_id uuid,
  created_at timestamptz not null default now()
);

-- Vorschlag -> Bestätigung -> atomare Änderung -> gespeichertes Ergebnis.
create table public.coach_tool_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool text not null,
  args jsonb not null,
  preview jsonb not null,
  status text not null check (status in ('proposed', 'confirmed', 'rejected', 'expired', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  model text,
  cost_chf numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ Row Level Security

alter table public.food_catalog enable row level security;
alter table public.food_source_records enable row level security;

-- Öffentliche Datensätze lesen alle Angemeldeten; eigene nur die Person selbst.
create policy food_catalog_read on public.food_catalog
  for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy food_catalog_insert_own on public.food_catalog
  for insert to authenticated with check (owner_id = auth.uid() and source in ('custom', 'label'));
create policy food_catalog_update_own on public.food_catalog
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy food_catalog_delete_own on public.food_catalog
  for delete to authenticated using (owner_id = auth.uid());
-- food_source_records: keine Policy -> nur die Service Role (Backend).

-- Jede persönliche Tabelle: nur die eigene Zeile, in allen vier Richtungen.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'goals', 'weight_entries', 'recipes', 'recipe_items', 'pantry_items',
    'meal_plans', 'meal_plan_days', 'meal_plan_entries', 'shopping_lists',
    'shopping_list_items', 'meals', 'meal_items', 'meal_images_temp',
    'meal_analysis_events', 'workout_plans', 'scheduled_workouts', 'workout_exercises',
    'workout_sets', 'coach_threads', 'coach_messages', 'coach_tool_actions', 'usage_ledger'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
      t || '_select_own', t);
  end loop;
end $$;

-- Was die Person direkt schreiben darf. Mahlzeiten, Nährwerte, Analyse-Ereignisse,
-- Coach-Aktionen und Kosten schreibt nur das Backend — dort wird gerechnet und bestätigt.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'weight_entries', 'recipes', 'recipe_items', 'pantry_items',
    'meal_plan_entries', 'shopping_list_items', 'workout_sets', 'coach_messages'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid())',
      t || '_delete_own', t);
  end loop;
end $$;

-- Kinderzeilen dürfen nur an eigene Eltern hängen.
create policy recipe_items_parent_own on public.recipe_items as restrictive
  for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
