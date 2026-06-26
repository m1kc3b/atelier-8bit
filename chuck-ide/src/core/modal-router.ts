/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/modal-router.ts
   Router de la modale générique (chuck-main-modal).

   Mappe une clé de vue → composant + options de coquille, gère
   la pile de navigation (back) et le gate auth GitHub optionnel.
   Une seule modale est montée ; les vues sont des composants
   autonomes injectés dans son body.
   ───────────────────────────────────────────────────────────── */

import { bus, type ModalView } from "./bus.js";
import { authService } from "./auth/auth-service.js";
import type { MainModalOptions } from "../components/chuck-main-modal.js";

interface MainModalEl extends HTMLElement {
  setContent(el: HTMLElement | string, opts?: MainModalOptions): void;
  setBottombar(el: HTMLElement | string | null): void;
  open(): void;
  close(): void;
}

/** Définition d'une vue affichable dans la modale. */
interface ViewDef {
  /** Fabrique l'élément injecté dans le body (neuf à chaque affichage). */
  factory: (params?: Record<string, unknown>) => HTMLElement;
  /** Titre de la topbar. */
  title: string;
  /** La vue racine (welcome) n'a pas de bouton retour. */
  root?: boolean;
  /** Coquille non fermable (gate bloquante). Défaut : fermable. */
  dismissible?: boolean;
}

export class ModalRouter {
  private readonly _modal: MainModalEl;
  /** Pile des vues affichées — le sommet est la vue courante. */
  private readonly _stack: Array<{ view: ModalView; params?: Record<string, unknown> }> = [];

  private readonly _views: Record<ModalView, ViewDef> = {
    welcome: {
      title: "🕹️ L'Atelier 8-bit",
      root: true,
      factory: () => document.createElement("chuck-welcome-view"),
    },
    challenges: {
      title: "🏆 Les Tutos",
      factory: () => document.createElement("chuck-challenges-list"),
    },
    pong: {
      title: "🎮 Défis du mois",
      factory: () => {
        const el = document.createElement("chuck-track-roadmap");
        el.setAttribute("track-id", "pong");
        return el;
      },
    },
    help: {
      title: "❔ Aide",
      factory: () => document.createElement("chuck-help-modal"),
    },
  };

  constructor(modal: MainModalEl) {
    this._modal = modal;

    bus.on("chuck:modal-close", () => this.close());

    bus.on("chuck:modal-show", ({ view, params, gate }) => {
      void this.show(view, { params, gate });
    });

    // Le bouton « ← » de la coquille émet chuck:modal-back → on dépile.
    bus.on("chuck:modal-back", () => this.back());

    // Cliquer un tuto / une étape ferme la modale (l'IDE prend le relais).
    bus.on("chuck:goto-challenge", () => this.close());

    // ── Alias rétro-compat (retirés au chantier rename) ──────────
    bus.on("chuck:open-welcome", (p) => {
      const v = p?.view;
      void this.show(
        v === "challenges" ? "challenges" : v === "pong" ? "pong" : "welcome",
      );
    });
    bus.on("chuck:show-challenges", () => void this.show("challenges"));
    bus.on("chuck:show-pong", () => void this.show("pong"));
  }

  /**
   * Affiche une vue. Si `gate` est vrai et l'utilisateur non authentifié,
   * la vue n'est PAS affichée : on délègue à la gate GitHub (chuck:require-auth).
   * La pile n'est touchée qu'en cas d'affichage effectif.
   */
  async show(
    view: ModalView,
    opts: { params?: Record<string, unknown>; gate?: boolean; replace?: boolean } = {},
  ): Promise<void> {
    if (opts.gate && !authService.isAuthenticated()) {
      bus.emit("chuck:require-auth", { reason: "challenge" });
      return;
    }

    const def = this._views[view];

    // Vue racine (welcome) : on réinitialise la pile.
    if (def.root || opts.replace) {
      this._stack.length = 0;
    }
    this._stack.push({ view, params: opts.params });

    this._renderTop();
    this._modal.open();
  }

  /** Dépile une vue. Si la pile devient vide ou racine seule, reste affiché. */
  back(): void {
    if (this._stack.length > 1) this._stack.pop();
    this._renderTop();
  }

  close(): void {
    this._modal.close();
  }

  /** (Ré)injecte la vue au sommet de la pile dans la coquille. */
  private _renderTop(): void {
    const top = this._stack[this._stack.length - 1];
    if (!top) return;
    const def = this._views[top.view];
    const el = def.factory(top.params);

    this._modal.setContent(el, {
      title: def.title,
      showBackBtn: !def.root && this._stack.length > 1,
      dismissible: def.dismissible ?? true,
    });
  }
}