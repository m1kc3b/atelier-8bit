/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-track-roadmap.ts
   Écran roadmap générique d'un parcours guidé (ex. « Coder Pong »).

   Feuille de route : liste des étapes, avec verrou « compte requis »
   tant que l'utilisateur n'est pas inscrit. Cliquer sur une étape
   accessible bascule sur l'Atelier (éditeur + <chuck-side-panel>).

   100 % data-driven : l'en-tête (icône, nom, sous-titre), la frontière
   gratuit/premium et l'offre proviennent de la config du parcours,
   reçue via `chuck:track-steps`. Aucun littéral spécifique à Pong.

   Quel parcours afficher ? Via l'attribut `track-id` (ex. "pong"),
   posé par le conteneur (welcome-modal). Le composant ne retient que
   les `chuck:track-steps` correspondant à ce trackId.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { storage } from "../core/storage/storage-service.js";
import type { TrackStepListItem } from "../types/challenge.js";
import type { TrackConfig } from "../core/challenges/tracks-service.js";

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: transparent;
    overflow: hidden;
  }

  .head {
    padding: 28px 32px 18px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .head h1 { font-size: 22px; font-weight: 800; color: var(--text); margin: 0 0 6px; }
  .head p  { font-size: 13px; color: var(--text); margin: 0 0 14px; max-width: 560px; line-height: 1.55; }

  .progress-row { display: flex; align-items: center; gap: 10px; }
  .progress-track { flex: 1; height: 6px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width .3s; }
  .progress-label { font-size: 11px; font-weight: 700; color: var(--text-dim); white-space: nowrap; }

  /* ── Grille d'étapes — identique à l'écran Challenges ─────── */
  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 40px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
    align-content: start;
  }

  .card {
    position: relative;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    cursor: pointer;
    transition: border-color var(--t-fast), transform var(--t-fast);
  }
  .card:hover:not(.locked) { border-color: var(--accent); transform: translateY(-2px); }
  .card.current   { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent-dim); }
  .card.completed { border-color: rgba(61,214,140,.35); }
  .card.locked    { cursor: not-allowed; opacity: .5; pointer-events: none; }
  /* Premium : même rendu visuel qu'une étape verrouillée, mais cliquable
     (le clic ouvre le paywall au lieu de charger l'étape). */
  .card.premium   { cursor: pointer; opacity: .5; }
  .card.premium:hover { transform: none; border-color: var(--border); }

  .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .card-id { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-muted); }
  .card-status { font-size: 16px; line-height: 1; }

  .card-title { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 6px; line-height: 1.35; }

  .card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .tag {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    padding: 2px 7px; border-radius: 4px; background: var(--surface-3); color: var(--text-dim);
  }
  .tag.lock    { background: var(--surface-3); color: var(--text-muted); }

  /* ── État verrouillé (pas de compte) ─────────────────────── */
  .locked-box { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center;
                text-align: center; min-height: 280px; gap: 14px; max-width: 420px; margin: 0 auto; padding: 40px; }
  .locked-icon { font-size: 40px; }
  .locked-box h2 { font-size: 18px; font-weight: 800; color: var(--text); margin: 0; }
  .locked-box p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }
  .locked-box button {
    height: 40px; padding: 0 22px; border: none; border-radius: 8px; margin-top: 6px;
    background: var(--accent); color: #1a1206; font-weight: 700; font-size: 13px;
    font-family: var(--font-ui); cursor: pointer;
  }

  .all-done {
    grid-column: 1 / -1;
    padding: 16px 18px; border-radius: 10px;
    background: var(--accent-dim); border: 1px solid var(--accent);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .all-done span { font-size: 13px; font-weight: 700; color: var(--text); }
  .all-done button {
    height: 34px; padding: 0 16px; border: none; border-radius: 7px;
    background: var(--accent); color: #1a1206; font-weight: 700; font-size: 12.5px;
    font-family: var(--font-ui); cursor: pointer; flex-shrink: 0;
  }

  .empty { grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
`;

export class ChuckTrackRoadmap extends ChuckComponent {
  private _items: TrackStepListItem[] = [];
  private _config: TrackConfig | null = null;
  private _name = "Parcours guidé";

  static get observedAttributes(): string[] {
    return ["track-id"];
  }

  private get _trackId(): string {
    return this.getAttribute("track-id") ?? "";
  }

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="head">
        <h1 id="head-title">Parcours guidé</h1>
        <p id="head-sub"></p>
        <div class="progress-row" id="progress-row" style="display:none">
          <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
          <span class="progress-label" id="progress-label">0 / 0</span>
        </div>
      </div>
      <div class="grid" id="body">
        <div class="empty">Chargement…</div>
      </div>`;
  }

  protected setup(): void {
    this.sub("chuck:track-steps", ({ trackId, trackName, config, items }) => {
      // N'écoute que le parcours qui nous est assigné.
      if (this._trackId && trackId !== this._trackId) return;
      this._config = config;
      this._name = trackName;
      this._items = items;
      this._renderHead();
      this._renderBody();
    });
    // L'état d'auth peut changer après le rendu initial (ex: retour de la
    // gate d'inscription) — on réaffiche pour lever le verrou sans reload.
    this.sub("chuck:challenge-loaded", () => this._renderBody());
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._renderHead();
    this._renderBody();
  }

  attributeChangedCallback(): void {
    // Le conteneur a (re)pointé le composant sur un autre parcours.
    this._items = [];
    this._config = null;
    this._name = "Parcours guidé";
    if (this.shadow.childElementCount) {
      this._renderHead();
      this._renderBody();
    }
  }

  private _renderHead(): void {
    const title = this.shadow.getElementById("head-title");
    const sub = this.shadow.getElementById("head-sub");
    if (!title || !sub) return;
    const icon = this._config?.icon ? `${this._config.icon} ` : "";
    title.textContent = `${icon}${this._name}`;
    sub.textContent = this._config?.subtitle ?? "";
    sub.style.display = this._config?.subtitle ? "block" : "none";
  }

  private _renderBody(): void {
    const body = this.shadow.getElementById("body")!;
    const progressRow = this.shadow.getElementById("progress-row")!;

    if (!storage.isUnlocked()) {
      progressRow.style.display = "none";
      const icon = this._config?.icon ?? "🔒";
      body.innerHTML = `
        <div class="locked-box">
          <div class="locked-icon">🔒</div>
          <h2>Débloque ce parcours guidé</h2>
          <p>Crée ton compte gratuit pour accéder au parcours, sauvegarder tes scripts et suivre ta progression.</p>
          <button id="unlock-btn">Créer mon compte gratuit →</button>
        </div>`;
      void icon;
      this.shadow.getElementById("unlock-btn")?.addEventListener("click", () => {
        this.emit("chuck:require-auth", { reason: "pong" });
      });
      return;
    }

    if (this._items.length === 0) {
      progressRow.style.display = "none";
      const icon = this._config?.icon ?? "🎮";
      body.innerHTML = `
        <div class="locked-box">
          <div class="locked-icon">${icon}</div>
          <h2>Le parcours arrive très vite</h2>
          <p>Les étapes sont en cours de mise en ligne. Continue les défis en attendant !</p>
          <button id="goto-challenges">Voir les défis →</button>
        </div>`;
      this.shadow.getElementById("goto-challenges")?.addEventListener("click", () =>
        this.emit("chuck:show-challenges", undefined),
      );
      return;
    }

    const completedCount = this._items.filter((i) => i.completed).length;
    const allDone = completedCount === this._items.length;
    const pct = Math.round((completedCount / this._items.length) * 100);

    progressRow.style.display = "flex";
    this.shadow.getElementById("progress-fill")!.style.width = `${pct}%`;
    this.shadow.getElementById("progress-label")!.textContent =
      `${completedCount} / ${this._items.length} étapes`;

    const cards = this._items.map((item) => this._cardHtml(item)).join("");
    const doneBanner = allDone
      ? `<div class="all-done">
           <span>🎉 Parcours terminé !</span>
           <button id="replay-celebration">Revoir la célébration</button>
         </div>`
      : "";

    body.innerHTML = `${cards}${doneBanner}`;

    body.querySelectorAll<HTMLElement>(".card[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset["id"]);
        const item = this._items.find((i) => i.id === id);
        if (!item) return;
        // Étape premium : ouvrir le mur d'achat plutôt que de tenter de charger.
        if (item.premiumLocked) {
          this.emit("chuck:track-completed-request", { trackId: this._trackId });
          return;
        }
        // Verrou séquentiel : non cliquable (doublé par pointer-events:none).
        if (!item.accessible) return;
        this.emit("chuck:goto-challenge", { id });
      });
    });

    this.shadow.getElementById("replay-celebration")?.addEventListener("click", () => {
      this.emit("chuck:track-completed-request", { trackId: this._trackId });
    });
  }

  private _priceLabel(): string {
    if (!this._config || this._config.priceCents == null) return "Premium";
    const amount = (this._config.priceCents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const symbol = this._config.currency === "EUR" ? "€" : ` ${this._config.currency}`;
    return `${amount}${symbol}`;
  }

  private _cardHtml(item: TrackStepListItem): string {
    const classes = ["card"];
    // Premium : cliquable (ouvre le paywall) → PAS de .locked (pointer-events).
    if (item.premiumLocked) classes.push("premium");
    else if (!item.accessible) classes.push("locked");
    if (item.completed) classes.push("completed");
    if (item.current && !item.completed) classes.push("current");

    let status = "▶";
    if (item.completed) status = item.medal ?? "✅";
    else if (item.premiumLocked) status = "🔒";
    else if (!item.accessible) status = "🔒";

    const tags: string[] = [];
    if (item.premiumLocked) {
      const name = this._config?.premiumName ?? "Premium";
      tags.push(`<span class="tag lock">🔒 ${this._esc(name)} · ${this._esc(this._priceLabel())}</span>`);
    } else if (!item.accessible) {
      tags.push(`<span class="tag lock">Étape ${item.stepIndex - 1} requise</span>`);
    }

    const title = !item.accessible && !item.premiumLocked
      ? `Termine l'étape ${item.stepIndex - 1} pour débloquer celle-ci`
      : item.title;

    return `<div class="${classes.join(" ")}" data-id="${item.id}" title="${this._esc(title)}">
      <div class="card-top">
        <span class="card-id">Étape ${item.stepIndex}</span>
        <span class="card-status">${status}</span>
      </div>
      <div class="card-title">${this._esc(item.title)}</div>
      <div class="card-meta">${tags.join("")}</div>
    </div>`;
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}

customElements.define("chuck-track-roadmap", ChuckTrackRoadmap);