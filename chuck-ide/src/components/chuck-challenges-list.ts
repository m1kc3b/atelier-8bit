/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-challenges-list.ts
   Écran "🏆 Les Challenges" — Choix 2 depuis l'accueil.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import type { ChallengeListItem } from "../types/challenge.js";

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
  .head p  { font-size: 13px; color: var(--text); margin: 0 0 14px; }

  .progress-row { display: flex; align-items: center; gap: 10px; }
  .progress-track { flex: 1; height: 6px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
  .progress-fill { height: 100%; background: var(--green); border-radius: 4px; transition: width .3s; }
  .progress-label { font-size: 11px; font-weight: 700; color: var(--text-dim); white-space: nowrap; }

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

  .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .card-id { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-muted); }
  .card-status { font-size: 16px; line-height: 1; }

  .card-title { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 6px; line-height: 1.35; }

  .card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .tag {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    padding: 2px 7px; border-radius: 4px; background: var(--surface-3); color: var(--text-dim);
  }
  .tag.email { background: var(--amber-dim); color: var(--amber); }
  .tag.lock  { background: var(--surface-3); color: var(--text-muted); }

  .empty { padding: 40px; text-align: center; color: var(--text-muted); font-size: 13px; }
`;

export class ChuckChallengesList extends ChuckComponent {
  private _items: ChallengeListItem[] = [];

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="head">
        <h1>🏆 Les Challenges</h1>
        <p>Des mini-défis progressifs — écris le bon code, clique <strong>Run</strong>, débloque la suite.</p>
        <div class="progress-row">
          <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
          <span class="progress-label" id="progress-label">0 / 0</span>
        </div>
      </div>
      <div class="grid" id="grid">
        <div class="empty">Chargement des défis…</div>
      </div>`;
  }

  protected setup(): void {
    this.sub("chuck:challenges-list", ({ items }) => {
      this._items = items;
      this._renderGrid();
    });
  }

  private _renderGrid(): void {
    const grid  = this.shadow.getElementById("grid")!;
    const fill  = this.shadow.getElementById("progress-fill")!;
    const label = this.shadow.getElementById("progress-label")!;

    if (!this._items.length) {
      grid.innerHTML = `<div class="empty">Aucun défi disponible.</div>`;
      return;
    }

    const completedCount = this._items.filter((i) => i.completed).length;
    const pct = Math.round((completedCount / this._items.length) * 100);
    fill.style.width = `${pct}%`;
    label.textContent = `${completedCount} / ${this._items.length}`;

    grid.innerHTML = this._items.map((item) => this._cardHtml(item)).join("");

    grid.querySelectorAll<HTMLElement>(".card[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.id);
        const item = this._items.find((i) => i.id === id);
        if (!item || item.sequentialLocked) return;
        this.emit("chuck:goto-challenge", { id });
      });
    });
  }

  private _cardHtml(item: ChallengeListItem): string {
    const classes = ["card"];
    if (item.sequentialLocked) classes.push("locked");
    if (item.completed) classes.push("completed");
    if (item.current && !item.completed) classes.push("current");

    let status = "▶";
    if (item.completed) status = item.medal ?? "✅";
    else if (item.sequentialLocked) status = "🔒";
    else if (item.emailLocked) status = "📧";

    const tags: string[] = [];
    if (item.arenaName) tags.push(`<span class="tag">${this._esc(item.arenaName)}</span>`);
    if (item.estimatedMinutes) tags.push(`<span class="tag">~${item.estimatedMinutes} min</span>`);
    if (item.sequentialLocked) tags.push(`<span class="tag lock">Défi ${item.id - 1} requis</span>`);
    else if (item.emailLocked) tags.push(`<span class="tag email">Inscription requise</span>`);

    const title = item.sequentialLocked
      ? `Termine le défi ${item.id - 1} pour débloquer celui-ci`
      : item.title;

    return `<div class="${classes.join(" ")}" data-id="${item.id}" title="${this._esc(title)}">
      <div class="card-top">
        <span class="card-id">#${item.id}</span>
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

customElements.define("chuck-challenges-list", ChuckChallengesList);