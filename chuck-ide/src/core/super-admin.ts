/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/super-admin.ts

   Profil super-admin : court-circuite TOUS les verrous
   (gate compte, verrou séquentiel, mur premium parcours).

   Source de vérité : la colonne booléenne `is_super_admin` de la
   table `profiles` (Supabase), liée à auth.users.id. Lue une fois
   à l'auth, mise en cache pour les checks synchrones du rendu.
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./auth/auth-service.js";

class SuperAdmin {
  private _isAdmin = false;
  private _loaded = false;

  /** Valeur synchrone (cache) pour les checks de rendu. */
  get active(): boolean {
    return this._isAdmin;
  }

  /** À appeler après chaque changement d'auth. Recharge le flag depuis Supabase. */
  async refresh(): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        this._isAdmin = false;
        this._loaded = true;
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", userId)
        .maybeSingle();
      this._isAdmin = !error && data?.is_super_admin === true;
      this._loaded = true;
    } catch {
      this._isAdmin = false;
      this._loaded = true;
    }
  }

  get loaded(): boolean {
    return this._loaded;
  }

  reset(): void {
    this._isAdmin = false;
    this._loaded = false;
  }
}

export const superAdmin = new SuperAdmin();