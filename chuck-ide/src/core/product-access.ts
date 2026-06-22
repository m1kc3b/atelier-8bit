/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/product-access.ts

   Accès premium par parcours (généralise l'ancien premium-product
   « Pong Avancé » unique). Chaque parcours premium est identifié par
   son slug (trackId) ; l'achat est la clé `product` dans la table
   Supabase `purchases`.

   Le PAIEMENT est géré côté backend : le front ne stocke aucun lien
   Stripe et n'ouvre aucune URL. Le paywall émet une intention d'achat
   (chuck:track-purchase-requested { trackId }) que le backend traite.

   hasPurchased(trackId) lit `purchases` (alimentée par le backend). Tant
   que la table est vide, renvoie false — ce qui suffit pour MESURER la
   volonté de payer (clic « acheter » tracké via le funnel).
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./auth/auth-service.js";

const LOCAL_PURCHASE_PREFIX = "chuck8_purchased_";

class ProductAccess {
  /** Cache par trackId : true si possédé. */
  private _cache = new Map<string, boolean>();

  private _localKey(trackId: string): string {
    return `${LOCAL_PURCHASE_PREFIX}${trackId}`;
  }

  /**
   * true si l'utilisateur a acheté le parcours `trackId`.
   * Lit la table Supabase `purchases` (product = trackId).
   * Repli local (localStorage) : débloque immédiatement après un retour
   * de paiement, avant que le backend ait écrit en base.
   */
  async hasPurchased(trackId: string): Promise<boolean> {
    if (this._cache.get(trackId) === true) return true;

    try {
      if (localStorage.getItem(this._localKey(trackId)) === "1") {
        this._cache.set(trackId, true);
        return true;
      }
    } catch {
      /* localStorage indisponible — on continue vers Supabase */
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return false;

      const { data, error } = await supabase
        .from("purchases")
        .select("product")
        .eq("user_id", userId)
        .eq("product", trackId)
        .maybeSingle();

      const owned = !error && !!data;
      this._cache.set(trackId, owned);
      return owned;
    } catch {
      return false;
    }
  }

  /** Version synchrone best-effort (cache + localStorage) pour le rendu UI. */
  hasPurchasedSync(trackId: string): boolean {
    if (this._cache.get(trackId) === true) return true;
    try {
      return localStorage.getItem(this._localKey(trackId)) === "1";
    } catch {
      return false;
    }
  }

  /** Marque l'achat localement (retour paiement). Le backend fera foi ensuite. */
  markPurchasedLocally(trackId: string): void {
    this._cache.set(trackId, true);
    try {
      localStorage.setItem(this._localKey(trackId), "1");
    } catch {
      /* ignore */
    }
  }

  clearCache(): void {
    this._cache.clear();
  }
}

export const productAccess = new ProductAccess();