/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-pong-track.ts
   Écran "🏓 Coder Pong" — Choix 3 depuis l'accueil.

   Feuille de route du parcours guidé : liste des étapes (même
   principe que <chuck-challenges-list>), avec verrou "compte requis"
   tant que l'utilisateur n'est pas inscrit. Cliquer sur une étape
   accessible bascule sur l'Atelier (éditeur + <chuck-side-panel>),
   exactement comme pour un défi classique.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { setView } from "../core/router.js";
import { storage } from "../core/storage/storage-service.js";
import type { PongStepListItem } from "../types/challenge.js";

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface);
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

  .body { flex: 1; overflow-y: auto; padding: 24px 32px 40px; }

  /* ── État verrouillé (pas de compte) ─────────────────────── */
  .locked-box { display: flex; flex-direction: column; align-items: center; justify-content: center;
                text-align: center; height: 100%; gap: 14px; max-width: 420px; margin: 0 auto; }
  .locked-icon { font-size: 40px; }
  .locked-box h2 { font-size: 18px; font-weight: 800; color: var(--text); margin: 0; }
  .locked-box p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0; }
  .locked-box button {
    height: 40px; padding: 0 22px; border: none; border-radius: 8px; margin-top: 6px;
    background: var(--accent); color: #1a1206; font-weight: 700; font-size: 13px;
    font-family: var(--font-ui); cursor: pointer;
  }

  /* ── Roadmap ──────────────────────────────────────────────── */
  .roadmap { display: flex; flex-direction: column; gap: 10px; max-width: 640px; }

  .step-card {
    display: flex; align-items: center; gap: 14px;
    padding: 16px 18px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 10px; cursor: pointer; transition: border-color var(--t-fast), transform var(--t-fast);
  }
  .step-card:hover:not(.locked) { border-color: var(--accent); transform: translateY(-1px); }
  .step-card.current   { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent-dim); }
  .step-card.completed { border-color: rgba(61,214,140,.35); }
  .step-card.locked    { cursor: not-allowed; opacity: .5; }

  .step-num {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; font-family: var(--font-mono);
    background: var(--surface-3); color: var(--text-dim);
  }
  .step-card.current .step-num   { background: var(--accent-dim); color: var(--accent); }
  .step-card.completed .step-num { background: var(--green-dim); color: var(--green); }

  .step-text { flex: 1; min-width: 0; }
  .step-title { font-size: 14px; font-weight: 700; color: var(--text); }
  .step-sub   { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
  .step-status { font-size: 18px; flex-shrink: 0; }

  .all-done {
    margin-top: 16px; padding: 16px 18px; border-radius: 10px;
    background: var(--accent-dim); border: 1px solid var(--accent);
    display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 640px;
  }
  .all-done span { font-size: 13px; font-weight: 700; color: var(--text); }
  .all-done button {
    height: 34px; padding: 0 16px; border: none; border-radius: 7px;
    background: var(--accent); color: #1a1206; font-weight: 700; font-size: 12.5px;
    font-family: var(--font-ui); cursor: pointer; flex-shrink: 0;
  }

  .empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
`;

export class ChuckPongTrack extends ChuckComponent {
  private _items: PongStepListItem[] = [];

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="head">
        <h1>🏓 Coder Pong</h1>
        <p>Construis ton premier jeu vidéo en assembleur 6502, étape par étape — raquettes, balle, collisions, score.</p>
        <div class="progress-row" id="progress-row" style="display:none">
          <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
          <span class="progress-label" id="progress-label">0 / 0</span>
        </div>
      </div>
      <div class="body" id="body">
        <div class="empty">Chargement…</div>
      </div>`;
  }

  protected setup(): void {
    this.sub("chuck:pong-steps", ({ items }) => {
      this._items = items;
      this._renderBody();
    });
    // L'état d'auth peut changer après le rendu initial (ex: retour de la
    // gate d'inscription) — on réaffiche pour lever le verrou sans reload.
    this.sub("chuck:challenge-loaded", () => this._renderBody());
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._renderBody();
  }

  private _renderBody(): void {
    const body = this.shadow.getElementById("body")!;
    const progressRow = this.shadow.getElementById("progress-row")!;

    if (!storage.isUnlocked()) {
      progressRow.style.display = "none";
      body.innerHTML = `
        <div class="locked-box">
          <div class="locked-icon">🔒</div>
          <h2>Débloque le projet guidé Pong</h2>
          <p>Crée ton compte gratuit pour accéder au parcours guidé, sauvegarder tes scripts et suivre ta progression.</p>
          <button id="unlock-btn">Créer mon compte gratuit →</button>
        </div>`;
      this.shadow.getElementById("unlock-btn")?.addEventListener("click", () => {
        this.emit("chuck:require-auth", { reason: "pong" });
      });
      return;
    }

    if (this._items.length === 0) {
      progressRow.style.display = "none";
      body.innerHTML = `
        <div class="locked-box">
          <div class="locked-icon">🏓</div>
          <h2>Le parcours arrive très vite</h2>
          <p>Les étapes du projet Pong sont en cours de mise en ligne. Continue les défis en attendant !</p>
          <button id="goto-challenges">Voir les défis →</button>
        </div>`;
      this.shadow.getElementById("goto-challenges")?.addEventListener("click", () =>
        setView("challenges"),
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
           <span>🎉 Parcours Pong terminé !</span>
           <button id="replay-celebration">Revoir la célébration</button>
         </div>`
      : "";

    body.innerHTML = `<div class="roadmap">${cards}</div>${doneBanner}`;

    body.querySelectorAll<HTMLElement>(".step-card[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset["id"]);
        const item = this._items.find((i) => i.id === id);
        if (!item || !item.accessible) return;
        setView("atelier");
        this.emit("chuck:goto-challenge", { id });
      });
    });

    this.shadow.getElementById("replay-celebration")?.addEventListener("click", () => {
      this.emit("chuck:pong-completed", { stepCount: this._items.length });
    });
  }

  private _cardHtml(item: PongStepListItem): string {
    const classes = ["step-card"];
    if (!item.accessible) classes.push("locked");
    if (item.completed) classes.push("completed");
    if (item.current && !item.completed) classes.push("current");

    let status = "▶";
    if (item.completed) status = item.medal ?? "✅";
    else if (!item.accessible) status = "🔒";

    const subtitle = item.accessible
      ? "Raquettes · balle · score"
      : `Termine l'étape ${item.stepIndex - 1} pour débloquer celle-ci`;

    return `<div class="${classes.join(" ")}" data-id="${item.id}">
      <div class="step-num">${item.stepIndex}</div>
      <div class="step-text">
        <div class="step-title">${this._esc(item.title)}</div>
        <div class="step-sub">${this._esc(subtitle)}</div>
      </div>
      <div class="step-status">${status}</div>
    </div>`;
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}

customElements.define("chuck-pong-track", ChuckPongTrack);
