/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/super-admin.ts

   Profil super-admin : court-circuite TOUS les verrous
   (gate compte, verrou séquentiel, mur premium parcours).

   Source de vérité : la colonne booléenne `is_super_admin` de la
   table `profiles` (Supabase), liée à auth.users.id. Lue à l'auth,
   mise en cache pour les checks SYNCHRONES du rendu (isUnlocked,
   hasPurchasedSync, isTrackStepAccessible…).

   ATTENTION TIMING : refresh() est un appel réseau asynchrone, alors
   que les gardes qui lisent `active` sont synchrones. Deux garde-fous :
     1. main.ts fait `await superAdmin.refresh()` AVANT le premier
        render, donc `active` est correct dès le boot.
     2. onChange() permet à l'UI de se ré-émettre si le flag bascule
        après coup (login/logout en cours de session).
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./auth/auth-service.js";

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

  /** Notifié à chaque fois que `active` CHANGE de valeur. Retourne un
   *  désabonnement. Utilisé par challenge-manager pour re-render. */
  onChange(cb: () => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /** Recharge le flag depuis Supabase. À appeler après chaque
   *  changement d'auth. Notifie les abonnés si la valeur a changé. */
  async refresh(): Promise<void> {
    const prev = this._isAdmin;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        this._isAdmin = false;
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_super_admin")
          .eq("id", userId)
          .maybeSingle();
        this._isAdmin = !error && data?.is_super_admin === true;
      }
    } catch {
      this._isAdmin = false;
    }
    this._loaded = true;
    if (this._isAdmin !== prev) this._notify();
  }

  /** Remise à zéro (déconnexion). Notifie si la valeur a changé. */
  reset(): void {
    const prev = this._isAdmin;
    this._isAdmin = false;
    this._loaded = false;
    if (prev) this._notify();
  }

  private _notify(): void {
    this._listeners.forEach((cb) => cb());
  }
}

export const superAdmin = new SuperAdmin();