/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/funnel-tracker.ts
   Collecteur d'événements minimal.

   Sous le funnel actuel (GitHub OAuth obligatoire, pas de mode anonyme)
   on ne trace que :
     - la connexion ('signed-in')
     - le franchissement des étapes de tuto ('tutorial-step')

   Chaque événement est inséré dans la table Supabase `funnel_events`
   (fire-and-forget). Plus de visitor_id anonyme ni de pont
   visitor_id → user_id : le user_id (auth) est la seule clé.

   Schéma Supabase attendu :

     create table if not exists funnel_events (
       id          bigint generated always as identity primary key,
       step        text        not null,
       meta        jsonb,
       user_id     uuid,
       created_at  timestamptz not null default now()
     );
     alter table funnel_events enable row level security;
     create policy "auth insert" on funnel_events
       for insert to authenticated with check (true);
   ───────────────────────────────────────────────────────────── */

import { bus } from "../../core/bus";
import { supabase } from "../../features/auth/auth-service";

/** Étapes tracées sous le funnel actuel. */
export type FunnelStep =
  | "signed-in"
  | "tutorial-step";

class FunnelTracker {
  private _started = false;

  /** À appeler une fois au démarrage (main.ts). Idempotent. */
  start(): void {
    if (this._started) return;
    this._started = true;

    bus.on("chuck:funnel-step", ({ step, meta }) => {
      this.track(step, meta);
    });
  }

  /** Enregistre une étape : insert Supabase fire-and-forget. */
  track(step: FunnelStep, meta?: Record<string, unknown>): void {
    void (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("funnel_events").insert({
          step,
          meta: meta ?? null,
          user_id: userData.user?.id ?? null,
        });
      } catch {
        // Réseau / RLS / table absente : on n'interrompt jamais le flux UI.
      }
    })();
  }
}

export const funnelTracker = new FunnelTracker();