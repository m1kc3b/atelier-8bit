-- ════════════════════════════════════════════════════════════════
--  Atelier 8-bit — schéma canonique `profiles`  (chantier A2)
--
--  Vitrine publique d'un compte joueur. PK = auth.users.id.
--  Alimentée à la connexion GitHub (trigger on_auth_user_created) ;
--  les compteurs atp_points / challenges_done sont écrits par le
--  backend (scoring), jamais par le client. display_name et country
--  sont les seuls champs éditables par le propriétaire.
--
--  Idempotent : réexécutable sans erreur (drop/create gardés).
-- ════════════════════════════════════════════════════════════════

-- ── Table ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  github_login    text unique,
  display_name    text,
  avatar_url      text,
  country         text check (country is null or country ~ '^[A-Z]{2}$'),
  atp_points      integer not null default 0,
  challenges_done integer not null default 0,
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'Profil public joueur (PK = auth.users.id). atp_points/challenges_done écrits côté serveur uniquement.';

-- Recherche par login (page /u/{login}).
create index if not exists profiles_github_login_idx
  on public.profiles (github_login);

-- ── updated_at automatique ────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Création du profil à l'inscription GitHub ─────────────────────
-- Les métadonnées OAuth GitHub arrivent dans raw_user_meta_data :
--   user_name  → login GitHub        avatar_url → avatar
--   full_name / name → nom affiché par défaut
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, github_login, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'user_name',
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ───────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Lecture publique (page /u/{login} + classements anonymes).
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- Le propriétaire peut éditer SA ligne, mais pas toucher aux compteurs
-- ni aux flags : on restreint en pratique via une fonction d'update
-- côté client qui n'envoie que display_name/country (cf. profile-service).
-- La policy autorise l'update de sa propre ligne ; la protection des
-- colonnes serveur (atp_points, challenges_done, is_super_admin) est
-- assurée par un trigger de garde ci-dessous.
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert : réservé au trigger (security definer). Aucune policy insert
-- pour les clients → ils ne peuvent pas forger une ligne.

-- ── Garde : empêcher le client de modifier les colonnes serveur ───
-- Si la session n'est pas service_role, on fige atp_points,
-- challenges_done et is_super_admin à leurs anciennes valeurs.
create or replace function public.guard_profile_server_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.atp_points     := old.atp_points;
    new.challenges_done := old.challenges_done;
    new.is_super_admin := old.is_super_admin;
    new.github_login   := old.github_login;  -- login figé après signup
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_server_columns on public.profiles;
create trigger profiles_guard_server_columns
  before update on public.profiles
  for each row execute function public.guard_profile_server_columns();