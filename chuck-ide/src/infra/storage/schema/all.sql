-- ════════════════════════════════════════════════════════════════
--  Atelier 8-bit — schéma Supabase complet  (chantier B3)
--
--  Modèle (post-A1) : TOUT est gratuit, accès gated par compte GitHub.
--  Aucune table d'achat, aucune colonne de prix.
--
--  Le SCORING est déterministe et SERVEUR (Edge Function `submit-defi`,
--  cf. bareme_deterministe.md) : le front envoie un source, lit un verdict.
--  Les cas de test, le seed et les budgets de cycles ne sont JAMAIS exposés
--  au client (colonnes protégées par RLS : aucune policy select pour eux).
--
--  Ordre des objets : extensions → contenu pédagogique (challenges, tracks,
--  track_steps) → arène (defis, defi_submissions, vue defi_rankings) →
--  télémétrie (funnel_events). La table `profiles` est livrée séparément
--  (01_profiles.sql / chantier A2) et doit être appliquée AVANT ce fichier
--  (defi_submissions et defi_rankings y font référence).
--
--  Idempotent : réexécutable (create if not exists / drop-create gardés).
--  Colonnes alignées au mot près sur le code front :
--    challenges        → challenges-service.ts
--    tracks/track_steps→ tracks-service.ts
--    defis             → defis-service.ts (getCurrentDefi)
--    defi_rankings     → defis-service.ts (getRanking : rank,user_id,
--                        display_name,score,cycles,bytes,prestige)
--    funnel_events     → funnel-tracker.ts
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;  -- gen_random_uuid()


-- ════════════════════════════════════════════════════════════════
--  1. CHALLENGES — défis fondamentaux séquentiels (tutos gratuits)
--     Source : features/challenges/challenges-service.ts
-- ════════════════════════════════════════════════════════════════
create table if not exists public.challenges (
  id          integer primary key,           -- id stable (= ?challenge=N)
  title       text    not null,
  description text    not null default '',
  template    text    not null default '',
  assertions  jsonb   not null default '[]'::jsonb,
  max_cycles  integer,
  hints       jsonb   not null default '[]'::jsonb,
  meta        jsonb,
  locked      boolean not null default false, -- nécessite un compte (gate GitHub)
  position    integer,                        -- ordre d'affichage (= id par défaut)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.challenges is
  'Défis fondamentaux séquentiels. Contenu pédagogique gratuit, lu en clair.';

drop trigger if exists challenges_touch on public.challenges;
create trigger challenges_touch
  before update on public.challenges
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
--  2. TRACKS — parcours guidés (métadonnées de présentation)
--     Source : features/challenges/tracks-service.ts (post-A1 : plus
--     aucune colonne premium / prix / free_steps).
-- ════════════════════════════════════════════════════════════════
create table if not exists public.tracks (
  id         text    primary key,            -- slug : 'pong', 'snake'…
  name       text    not null,               -- 'Projet Pong' (= arena_name)
  position   integer not null default 0,
  icon       text,                           -- emoji header roadmap
  subtitle   text,                           -- sous-titre header
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tracks is
  'Parcours guidés (gratuits). Métadonnées de présentation uniquement.';

drop trigger if exists tracks_touch on public.tracks;
create trigger tracks_touch
  before update on public.tracks
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
--  3. TRACK_STEPS — étapes d'un parcours (mêmes champs qu'un challenge)
--     Source : features/challenges/tracks-service.ts (getAllSteps)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.track_steps (
  id          integer primary key,           -- id stable (= ?parcours=N)
  track_id    text    not null references public.tracks (id) on delete cascade,
  step_index  integer not null,              -- ordre 1-based dans le parcours
  title       text    not null,
  description text    not null default '',
  template    text    not null default '',
  assertions  jsonb   not null default '[]'::jsonb,
  max_cycles  integer,
  hints       jsonb   not null default '[]'::jsonb,
  meta        jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (track_id, step_index)
);

comment on table public.track_steps is
  'Étapes de parcours. Convertit en Challenge côté front via arena_name = tracks.name.';

create index if not exists track_steps_track_idx
  on public.track_steps (track_id, step_index);

drop trigger if exists track_steps_touch on public.track_steps;
create trigger track_steps_touch
  before update on public.track_steps
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
--  4. DEFIS — Arène mensuelle (énoncé visible + données serveur cachées)
--     Source front : features/defis/defis-service.ts (getCurrentDefi
--     lit id, month, title, instructions, template, opens_at, closes_at).
--     Les colonnes seed / test_cases / poids sont SERVEUR uniquement.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.defis (
  id            uuid primary key default gen_random_uuid(),
  month         text not null unique,         -- 'YYYY-MM'
  title         text not null,
  instructions  text not null default '',     -- énoncé Markdown (visible)
  template      text,                          -- code de départ (visible)
  opens_at      timestamptz,
  closes_at     timestamptz,

  -- ── Données SERVEUR (jamais exposées au client — cf. RLS plus bas) ──
  seed          bigint not null default 0,     -- LFSR seed du mois
  test_cases    jsonb  not null default '[]'::jsonb,  -- cas cachés [{entrees,sortie,budget}]
  weight_cycles real   not null default 0.7,   -- w_c (barème §5)
  weight_bytes  real   not null default 0.3,   -- w_o
  -- Régime des opcodes cachés (barème §6) : 'prestige' (badge, hors score)
  -- ou 'counted' (comptés comme instructions normales).
  hidden_opcode_mode text not null default 'prestige'
                     check (hidden_opcode_mode in ('prestige', 'counted')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (weight_cycles >= 0 and weight_bytes >= 0)
);

comment on table public.defis is
  'Défi mensuel. Colonnes énoncé visibles ; seed/test_cases/poids réservés au serveur.';
comment on column public.defis.test_cases is
  'CACHÉ. Jamais lu par le client (RLS expose seulement les colonnes publiques via une vue).';

drop trigger if exists defis_touch on public.defis;
create trigger defis_touch
  before update on public.defis
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
--  5. DEFI_SUBMISSIONS — soumissions notées (écrites par l'Edge Function)
--     Le client n'écrit JAMAIS ici en direct (aucune policy insert/update
--     pour authenticated). La fonction `submit-defi` (service_role) :
--       - assemble + exécute le source sur les cas cachés
--       - mesure cycles + bytes, valide, calcule prestige
--       - upsert la MEILLEURE soumission par (defi_id, user_id)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.defi_submissions (
  id          uuid primary key default gen_random_uuid(),
  defi_id     uuid not null references public.defis (id)    on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  cycles      integer not null,               -- meilleure perf valide
  bytes       integer not null,
  prestige    boolean not null default false, -- opcode caché employé
  accepted    boolean not null default true,  -- a passé tous les cas cachés
  source      text,                           -- source soumis (archive/audit)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- une seule ligne (la meilleure) par joueur et par défi
  unique (defi_id, user_id)
);

comment on table public.defi_submissions is
  'Meilleure soumission valide par (defi,joueur). Écrite EXCLUSIVEMENT par submit-defi (service_role).';

create index if not exists defi_submissions_defi_idx
  on public.defi_submissions (defi_id);
create index if not exists defi_submissions_rank_idx
  on public.defi_submissions (defi_id, cycles, bytes);

drop trigger if exists defi_submissions_touch on public.defi_submissions;
create trigger defi_submissions_touch
  before update on public.defi_submissions
  for each row execute function public.touch_updated_at();


-- ════════════════════════════════════════════════════════════════
--  6. DEFI_RANKINGS — vue de classement relatif
--     Score = w_c·(best_cycles/cycles) + w_o·(best_bytes/bytes)  (barème §5)
--     best_* = meilleur GLOBAL parmi les soumissions valides du défi.
--     Le rang est calculé par window function, score décroissant.
--     Colonnes EXACTES attendues par defis-service.getRanking :
--       rank, defi_id, user_id, display_name, score, cycles, bytes, prestige
-- ════════════════════════════════════════════════════════════════
drop view if exists public.defi_rankings;
create view public.defi_rankings
with (security_invoker = true) as
with bests as (
  select
    s.defi_id,
    min(s.cycles)::numeric as best_cycles,
    min(s.bytes)::numeric  as best_bytes
  from public.defi_submissions s
  where s.accepted
  group by s.defi_id
),
scored as (
  select
    s.defi_id,
    s.user_id,
    coalesce(nullif(p.display_name, ''), p.github_login, 'Anonyme') as display_name,
    s.cycles,
    s.bytes,
    s.prestige,
    -- defis.weight_* pondère ; perf = best/mesuré ∈ ]0,1]
    ( d.weight_cycles * (b.best_cycles / nullif(s.cycles, 0))
    + d.weight_bytes  * (b.best_bytes  / nullif(s.bytes, 0)) )
      / nullif(d.weight_cycles + d.weight_bytes, 0) as score
  from public.defi_submissions s
  join public.defis    d on d.id = s.defi_id
  join public.profiles p on p.id = s.user_id
  join bests           b on b.defi_id = s.defi_id
  where s.accepted
)
select
  row_number() over (
    partition by defi_id
    order by score desc, cycles asc, bytes asc
  )::integer as rank,
  defi_id,
  user_id,
  display_name,
  round(score::numeric, 6)::float8 as score,
  cycles,
  bytes,
  prestige
from scored;

comment on view public.defi_rankings is
  'Classement relatif par défi (score 0.7·cycles + 0.3·octets normalisés). Recalculé à la lecture.';


-- ════════════════════════════════════════════════════════════════
--  7. FUNNEL_EVENTS — télémétrie minimale
--     Source : infra/tracking/funnel-tracker.ts (insert {step, meta, user_id})
-- ════════════════════════════════════════════════════════════════
create table if not exists public.funnel_events (
  id         bigint generated always as identity primary key,
  step       text        not null,           -- 'signed-in' | 'tutorial-step'
  meta       jsonb,
  user_id    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_step_idx
  on public.funnel_events (step, created_at);


-- ════════════════════════════════════════════════════════════════
--  8. RLS — Row Level Security
-- ════════════════════════════════════════════════════════════════

-- ── Contenu pédagogique : lecture publique, écriture admin only ───
alter table public.challenges  enable row level security;
alter table public.tracks      enable row level security;
alter table public.track_steps enable row level security;

drop policy if exists "challenges readable"  on public.challenges;
create policy "challenges readable"  on public.challenges  for select using (true);

drop policy if exists "tracks readable"      on public.tracks;
create policy "tracks readable"      on public.tracks      for select using (true);

drop policy if exists "track_steps readable" on public.track_steps;
create policy "track_steps readable" on public.track_steps for select using (true);
-- (Pas de policy insert/update/delete → réservé au service_role / dashboard.)


-- ── Defis : exposer UNIQUEMENT les colonnes publiques ─────────────
-- On n'autorise PAS de select direct sur public.defis (il contient seed +
-- test_cases). Le client lit une vue restreinte ; le serveur lit la table.
alter table public.defis enable row level security;
-- Aucune policy select pour authenticated/anon → table fermée au client.

-- Vue publique : seulement les colonnes de l'énoncé (cf. getCurrentDefi).
drop view if exists public.defis_public;
create view public.defis_public
with (security_invoker = false) as   -- définie par le owner : contourne le RLS fermé de defis
select id, month, title, instructions, template, opens_at, closes_at
from public.defis;

comment on view public.defis_public is
  'Projection publique de defis (énoncé seul). seed/test_cases jamais exposés.';

grant select on public.defis_public to anon, authenticated;


-- ── Soumissions : lecture publique (pour la vue), écriture serveur only ──
alter table public.defi_submissions enable row level security;

drop policy if exists "submissions readable" on public.defi_submissions;
create policy "submissions readable"
  on public.defi_submissions for select using (true);
-- Aucune policy insert/update/delete pour authenticated : seul le
-- service_role (Edge Function submit-defi) écrit ici.


-- ── Funnel : insert authentifié, pas de lecture client ────────────
alter table public.funnel_events enable row level security;

drop policy if exists "funnel auth insert" on public.funnel_events;
create policy "funnel auth insert"
  on public.funnel_events for insert to authenticated with check (true);
-- Pas de policy select → les events ne sont lisibles que côté service_role.


-- ════════════════════════════════════════════════════════════════
--  9. NOTE — defis-service lit la table 'defis' ; bascule vers la vue
--     Le code actuel fait `.from('defis')`. Avec le RLS ci-dessus, la table
--     est fermée au client : il faut pointer getCurrentDefi() sur la vue
--     'defis_public'. Voir le patch defis-service.ts livré avec ce schéma.
-- ════════════════════════════════════════════════════════════════