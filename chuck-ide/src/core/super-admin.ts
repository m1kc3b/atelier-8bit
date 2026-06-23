/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/super-admin.ts

   Profil super-admin : court-circuite TOUS les verrous
   (gate compte, verrou séquentiel, mur premium parcours).

   Source de vérité : la colonne booléenne `is_super_admin` de la
   table `profiles` (Supabase), liée à auth.users.id.

   ATTENTION TIMING : refresh() est asynchrone (réseau), les gardes
   qui lisent `active` sont synchrones. Garde-fous :
     1. main.ts fait `await superAdmin.refresh()` AVANT le 1er render.
     2. onChange() re-render si le flag bascule après coup.
     3. refresh() lit la session via getSession() (local, instantané)
        plutôt que getUser() (réseau), pour ne pas rater une session
        tout juste restaurée au boot.
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./auth/auth-service.js";

/** Passe à true pour voir la raison exacte d'un blocage dans la console. */
const DEBUG = false;

class SuperAdmin {
  private _isAdmin = false;
  private _loaded = false;
  private _listeners = new Set<() => void>();

  /** Valeur synchrone (cache) pour les checks de rendu. */
  get active(): boolean {
    return this._isAdmin;
  }

  /** true une fois qu'un refresh() (ou reset()) a établi la valeur. */
  get loaded(): boolean {
    return this._loaded;
  }

  /** Notifié quand `active` CHANGE. Retourne un désabonnement. */
  onChange(cb: () => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /** Recharge le flag depuis Supabase. Loggue la raison si DEBUG. */
  async refresh(): Promise<void> {
    const prev = this._isAdmin;

    // getSession() lit le token en cache local (pas de réseau) : si la
    // session vient d'être restaurée au boot, elle est déjà là, alors que
    // getUser() peut renvoyer null le temps de l'aller-retour réseau.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    if (!userId) {
      this._isAdmin = false;
      this._loaded = true;
      if (DEBUG) console.warn("[super-admin] pas de session active → verrouillé");
      if (this._isAdmin !== prev) this._notify();
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      // RLS bloque le SELECT, ou la table n'existe pas, ou réseau.
      this._isAdmin = false;
      if (DEBUG)
        console.error(
          "[super-admin] échec lecture profiles (RLS ? table ?) :",
          error.message ?? error,
        );
    } else if (data == null) {
      // Pas de ligne profiles pour cet user : backfill/trigger manquant.
      this._isAdmin = false;
      if (DEBUG)
        console.warn(
          `[super-admin] aucune ligne profiles pour id=${userId} ` +
            "(backfill manquant ?) → verrouillé",
        );
    } else {
      this._isAdmin = data.is_super_admin === true;
      if (DEBUG)
        console.info(
          `[super-admin] is_super_admin=${this._isAdmin} pour id=${userId}`,
        );
    }

    this._loaded = true;
    if (this._isAdmin !== prev) this._notify();
  }

  /** Remise à zéro (déconnexion). */
  reset(): void {
    const prev = this._isAdmin;
    this._isAdmin = false;
    this._loaded = false;
    if (DEBUG) console.info("[super-admin] reset (déconnexion)");
    if (prev) this._notify();
  }

  private _notify(): void {
    this._listeners.forEach((cb) => cb());
  }
}

export const superAdmin = new SuperAdmin();