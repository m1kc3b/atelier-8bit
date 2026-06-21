/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/premium-product.ts

   Produit premium one-shot : « Pong Avancé » (99 €, accès à vie).
   Modèle de la stratégie §2/§3 — mur à deux étages :
     étage 1 : capture email (Buttondown) — signal tiède
     étage 2 : paiement (Stripe payment link) — signal fort

   hasPurchased() lit la table Supabase `purchases` (alimentée plus
   tard par un webhook Stripe). Tant que le webhook n'existe pas, la
   table est vide → hasPurchased() renvoie false, ce qui suffit pour
   MESURER la volonté de payer (clic « payer » tracké), comme prévu.
   ───────────────────────────────────────────────────────────── */

import { supabase } from "./auth/auth-service.js";

// ── À renseigner avant mise en ligne (cf. stratégie §3) ──────
// Endpoint d'inscription Buttondown (newsletter / embed subscribe).
export const BUTTONDOWN_ENDPOINT = "REMPLACER_PAR_ENDPOINT_BUTTONDOWN";
// Lien de paiement Stripe du produit Pong Avancé (99 €).
export const STRIPE_PAYMENT_LINK = "REMPLACER_PAR_STRIPE_PAYMENT_LINK";

/** Identifiant du produit premium (clé dans la table purchases). */
export const PRODUCT_PONG_ADVANCED = "pong-advanced" as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_PURCHASE_KEY = "chuck8_purchased_pong_advanced";

class PremiumProduct {
  private _purchasedCache: boolean | null = null;

  /**
   * true si l'utilisateur a acheté Pong Avancé.
   * Lit la table Supabase `purchases` pour l'utilisateur connecté.
   * Repli local (localStorage) : permet de débloquer immédiatement après
   * un retour de paiement réussi, avant que le webhook ait écrit en base.
   */
  async hasPurchased(): Promise<boolean> {
    if (this._purchasedCache === true) return true;

    // Repli local (retour Stripe immédiat)
    try {
      if (localStorage.getItem(LOCAL_PURCHASE_KEY) === "1") {
        this._purchasedCache = true;
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
        .eq("product", PRODUCT_PONG_ADVANCED)
        .maybeSingle();

      const owned = !error && !!data;
      this._purchasedCache = owned;
      return owned;
    } catch {
      // Réseau / table absente : on considère non-acheté (mur reste affiché).
      return false;
    }
  }

  /** Version synchrone best-effort (cache + localStorage) pour le rendu UI. */
  hasPurchasedSync(): boolean {
    if (this._purchasedCache === true) return true;
    try {
      return localStorage.getItem(LOCAL_PURCHASE_KEY) === "1";
    } catch {
      return false;
    }
  }

  /** Marque l'achat localement (retour Stripe). Le webhook fera foi ensuite. */
  markPurchasedLocally(): void {
    this._purchasedCache = true;
    try {
      localStorage.setItem(LOCAL_PURCHASE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  /**
   * Étage 1 du mur : capture l'email via Buttondown.
   * Fire-and-forget côté réseau, mais on remonte ok/erreur de validation.
   */
  async captureEmail(email: string): Promise<{ ok: boolean; error?: string }> {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      return { ok: false, error: "Adresse email invalide." };
    }
    if (BUTTONDOWN_ENDPOINT.startsWith("REMPLACER")) {
      // Endpoint pas encore configuré : on ne bloque pas l'utilisateur,
      // l'email est tout de même considéré comme capturé pour le funnel.
      return { ok: true };
    }
    try {
      await fetch(BUTTONDOWN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      return { ok: true };
    } catch {
      // L'échec réseau ne doit pas casser le funnel ; on considère capturé.
      return { ok: true };
    }
  }

  /** Étage 2 : URL de paiement Stripe (ou null si non configurée). */
  getPaymentLink(): string | null {
    return STRIPE_PAYMENT_LINK.startsWith("REMPLACER") ? null : STRIPE_PAYMENT_LINK;
  }
}

export const premiumProduct = new PremiumProduct();