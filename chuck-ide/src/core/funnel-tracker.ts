/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/funnel-tracker.ts
   Collecteur d'événements du funnel.

   Chaque franchissement d'étape est :
     1. journalisé en localStorage (lecture locale via funnelTracker.dump())
     2. inséré dans la table Supabase `funnel_events` (fire-and-forget)

   Un `visitor_id` anonyme persistant relie les étapes d'un même
   visiteur, y compris AVANT toute création de compte.

   Schéma Supabase attendu (cf. funnel_events.sql, à exécuter une fois) :

     create table if not exists funnel_events (
       id          bigint generated always as identity primary key,
       visitor_id  text        not null,
       step        text        not null,
       meta        jsonb,
       user_id     uuid,
       created_at  timestamptz not null default now()
     );
     alter table funnel_events enable row level security;
     create policy "anon insert" on funnel_events
       for insert to anon, authenticated with check (true);

   Aucune policy SELECT n'est exposée : la lecture des ratios se fait
   côté admin (SQL console / service role), pas depuis le client.
   ───────────────────────────────────────────────────────────── */

import { bus } from "./bus.js";
import { supabase } from "./auth/auth-service.js";

/** Étapes tracées — alignées sur la stratégie §4. */
export type FunnelStep =
  | "gate-shown"
  | "gate-converted"
  | "gate-abandoned"
  | "pong-basic-started"
  | "pong-basic-completed"
  | "premium-wall-shown"
  | "premium-email-captured"
  | "premium-pay-clicked";

interface FunnelRecord {
  step: FunnelStep;
  meta?: Record<string, unknown>;
  at: string; // ISO 8601
}

const VISITOR_KEY = "chuck:visitor-id";
const LOG_KEY = "chuck:funnel-log";
const LOG_MAX = 500; // garde-fou — on ne laisse pas le log enfler indéfiniment

class FunnelTracker {
  private _visitorId: string | null = null;
  private _started = false;

  /** À appeler une fois au démarrage (main.ts). Idempotent. */
  start(): void {
    if (this._started) return;
    this._started = true;

    this._visitorId = this._ensureVisitorId();

    bus.on("chuck:funnel-step", ({ step, meta }) => {
      this.track(step, meta);
    });
  }

  /** Identifiant anonyme persistant (par navigateur). */
  get visitorId(): string {
    return this._visitorId ?? this._ensureVisitorId();
  }

  /** Enregistre une étape : localStorage + insert distant fire-and-forget. */
  track(step: FunnelStep, meta?: Record<string, unknown>): void {
    const record: FunnelRecord = { step, meta, at: new Date().toISOString() };
    this._appendLocal(record);
    this._insertRemote(record);
  }

  /** Dump du log local — debug / vérification en dev. */
  dump(): FunnelRecord[] {
    return this._readLocal();
  }

  /** Efface le log local (tests / reset). Ne touche pas le visitor_id. */
  clearLocal(): void {
    try {
      localStorage.removeItem(LOG_KEY);
    } catch {
      /* localStorage indisponible — ignore */
    }
  }

  // ── Interne ────────────────────────────────────────────────

  private _ensureVisitorId(): string {
    try {
      const existing = localStorage.getItem(VISITOR_KEY);
      if (existing) {
        this._visitorId = existing;
        return existing;
      }
      const id = this._uuid();
      localStorage.setItem(VISITOR_KEY, id);
      this._visitorId = id;
      return id;
    } catch {
      // localStorage indisponible (mode privé strict) : id éphémère en mémoire
      const id = this._visitorId ?? this._uuid();
      this._visitorId = id;
      return id;
    }
  }

  private _uuid(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    // Repli simple si crypto.randomUUID indisponible
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  private _appendLocal(record: FunnelRecord): void {
    const log = this._readLocal();
    log.push(record);
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch {
      /* quota / indisponible — ignore */
    }
  }

  private _readLocal(): FunnelRecord[] {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as FunnelRecord[]) : [];
    } catch {
      return [];
    }
  }

  /** Insert distant — fire-and-forget : aucune erreur ne remonte au flux UI. */
  private _insertRemote(record: FunnelRecord): void {
    const visitorId = this.visitorId;
    void (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("funnel_events").insert({
          visitor_id: visitorId,
          step: record.step,
          meta: record.meta ?? null,
          user_id: userData.user?.id ?? null,
        });
      } catch {
        // Réseau / RLS / table absente : on n'interrompt jamais le funnel.
      }
    })();
  }
}

export const funnelTracker = new FunnelTracker();

// Pratique en dev : window.__funnel.dump()
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__funnel = funnelTracker;
}