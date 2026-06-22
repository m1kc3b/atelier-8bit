/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-side-panel.ts
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import type { ValidationResult } from "../types/challenge.js";
import type {
  ContentItem,
  ContentBlock,
  ChallengeItem,
  TrackStepItem,
} from "../types/content.js";
import { isChallenge, isTrackStep } from "../types/content.js";
import { storage } from '../core/storage/storage-service.js';
import { renderMarkdown, renderMarkdownInline } from '../core/markdown.js';

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';
  :host { display:flex;flex-direction:column;background:var(--surface);overflow:hidden;height:100%; }
  .panel-header { height:34px;display:flex;align-items:center;padding:0 8px;gap:4px;background:var(--surface-2);border-bottom:1px solid var(--border);flex-shrink:0;user-select:none; }
  .panel-title { font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.07em;flex:1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .nav-btn { width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:5px;font-size:15px;font-weight:700;background:none;border:none;cursor:pointer;color:var(--text-muted);transition:background var(--t-fast),color var(--t-fast);flex-shrink:0; }
  .nav-btn:hover:not(:disabled) { background:var(--surface-3);color:var(--text); }
  .nav-btn:disabled { opacity:.2;cursor:default; }
  .nav-btn.success { color:var(--green); }
  .type-badge { font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 6px;border-radius:3px;flex-shrink:0; }
  .type-badge.challenge { background:var(--accent-dim);color:var(--accent); }
  .type-badge.lesson    { background:var(--cyan-dim);color:var(--cyan); }
  .type-badge.tip       { background:var(--amber-dim);color:var(--amber); }
  .type-badge.reference { background:var(--surface-3);color:var(--text-dim); }
  .body { flex:1;overflow-y:auto;padding:0;display:flex;flex-direction:column;min-height:0; }
  .item-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .item-header-left {
    flex: 1;
    min-width: 0;
  }

  .item-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  #validated-badge {
    font-size: 20px;
    flex-shrink: 0;
  }

  #validated-badge,
  .medal-badge {
    font-size: 28px; /* Ajuste cette valeur selon tes besoins */
    flex-shrink: 0;
    margin-left: 8px;
  }
  .item-title { font-size:18px;font-weight:700;color:var(--text);line-height:1.3; }
  .item-subtitle { font-size:12px;color:var(--text-muted);margin-top:3px; }
  .item-meta { display:flex;align-items:center;gap:8px;margin-top:6px;font-size:13px;color:var(--text-muted);font-family:var(--font-mono); }
  .blocks { display:flex;flex-direction:column;gap:0;padding:12px 0; }
  .block { padding:6px 16px; }
  .block-theory { font-size:14px;line-height:1.7;color:var(--text); }
  .block-theory h3 { font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-dim);margin:0 0 6px; }
  .block-theory strong { color:var(--text);font-weight:600; }
  .block-theory em { color:var(--text-dim);font-style:italic; }
  .block-theory code { font-family:var(--font-mono);font-size:11px;background:var(--surface-3);color:var(--cyan);padding:1px 5px;border-radius:3px; }
  .block-theory h2 { font-size:16px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px; }
  .block-theory ul { padding-left:16px;display:flex;flex-direction:column;gap:2px;margin:4px 0; }
  .block-theory p { margin:0 0 6px; }
  .block-theory p:last-child { margin-bottom:0; }
  pre { font-family:var(--font-mono);font-size:12px;line-height:1.6;background:var(--surface-2);color:var(--cyan);padding:12px;border-radius:6px;border:1px solid var(--border);overflow-x:auto;margin:8px 0;white-space:pre; }
  .block-code { padding:6px 16px; }
  .code-inner { background:var(--surface-2);border:1px solid var(--border);border-radius:6px;overflow:hidden; }
  .code-label { font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;padding:5px 10px;border-bottom:1px solid var(--border);background:var(--surface-3); }
  .code-body { font-family:var(--font-mono);font-size:11.5px;line-height:1.65;color:var(--text);padding:10px 12px;margin:0;overflow-x:auto;white-space:pre; }
  .code-caption { font-size:10px;color:var(--text-muted);padding:4px 10px 6px;font-style:italic; }
  .block-mission { margin:2px 16px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 6px 6px 0; }
  .block-mission h4 { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:0 0 5px; }
  .block-mission .mission-body { font-size:12.5px;line-height:1.65;color:var(--text-dim); }
  .block-mission .mission-body strong { color:var(--text);font-weight:600; }
  .block-mission .mission-body code { font-family:var(--font-mono);font-size:11px;background:var(--surface-3);color:var(--cyan);padding:1px 5px;border-radius:3px; }
  .block-tip { margin:2px 16px;padding:8px 12px;background:var(--amber-dim);border:1px solid rgba(251,191,36,.2);border-radius:6px;font-size:12px;line-height:1.6;color:var(--amber); }
  .block-tip code { font-family:var(--font-mono);font-size:11px;background:rgba(251,191,36,.15);padding:1px 4px;border-radius:3px; }
  .block-warning { margin:2px 16px;padding:8px 12px;background:var(--red-dim);border:1px solid rgba(248,113,113,.2);border-radius:6px;font-size:12px;line-height:1.6;color:var(--red); }
  .block-ref { margin:2px 16px;display:flex;align-items:flex-start;gap:8px;padding:7px 10px;background:var(--surface-3);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:0 5px 5px 0;font-size:11px;text-decoration:none;color:inherit;cursor:default;transition:background var(--t-fast); }
  .block-ref.has-url { cursor:pointer; }
  .block-ref.has-url:hover { background:var(--surface-4); }
  .block-ref .ref-icon { font-size:13px;flex-shrink:0;padding-top:1px; }
  .block-ref .ref-text { line-height:1.5; }
  .block-ref .ref-label { color:var(--text);font-weight:600; }
  .block-ref .ref-detail { color:var(--text-muted);font-size:10px;margin-top:1px; }
  .block-concepts { display:flex;flex-wrap:wrap;gap:5px; }
  .concept-tag { font-family:var(--font-mono);font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;background:var(--cyan-dim);color:var(--cyan);border:1px solid rgba(56,189,248,.2); }
  .block-table { overflow-x:auto; }
  .content-table { width:100%;border-collapse:collapse;font-size:11.5px; }
  .content-table th { text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);padding:5px 8px;border-bottom:1px solid var(--border); }
  .content-table td { padding:5px 8px;border-bottom:1px solid var(--border);color:var(--text-dim);font-family:var(--font-mono); }
  .content-table tr:last-child td { border-bottom:none; }
  .block-image img { width:100%;border-radius:6px;border:1px solid var(--border); }
  .block-image .img-caption { font-size:10px;color:var(--text-muted);text-align:center;margin-top:4px;font-style:italic; }
  .block-divider { padding:2px 0 !important; }
  .block-divider hr { border:none;border-top:1px solid var(--border);margin:4px 0; }
  .block-hints { display:flex;flex-direction:column;gap:5px; }
  .hints-label { font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px; }
  .hint-item { padding:7px 10px;background:var(--surface-3);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text-dim);cursor:pointer;transition:background var(--t-fast);user-select:none; }
  .hint-item:hover { background:var(--surface-4); }
  .hint-item.revealed { cursor:default;color:var(--amber);border-color:rgba(251,191,36,.2);background:var(--amber-dim); }
  .hint-text-hidden { display:none; }
  .hint-revealed .hint-placeholder { display:none; }
  .hint-revealed .hint-text-hidden { display:block; }
  .validation-zone { padding:12px 16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px;flex-shrink:0; }
  .feedback { padding:10px 12px;border-radius:6px;font-size:12px;line-height:1.5;display:none; }
  .feedback.success { display:block;background:var(--green-dim);border:1px solid rgba(61,214,140,.3);color:var(--green); }
  .feedback.failure { display:block;background:var(--red-dim);border:1px solid rgba(248,113,113,.3);color:var(--red); }
  .feedback .fb-title  { font-weight:700;margin-bottom:4px;font-size:13px; }
  .feedback .fb-detail { opacity:.85;font-family:var(--font-mono);font-size:11px; }
  .feedback .fb-cycles { margin-top:6px;font-size:10px;opacity:.65;font-family:var(--font-mono); }
  .validate-btn { display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;background:var(--green);color:#0a1a0a;font-weight:700;font-size:13px;font-family:var(--font-ui);border:none;border-radius:8px;cursor:pointer;transition:opacity .12s,transform .08s;width:100%; }
  .validate-btn:hover   { opacity:.88; }
  .validate-btn:active  { transform:scale(.98); }
  .validate-btn:disabled { opacity:.3;cursor:not-allowed;transform:none; }
  .validate-btn svg { width:16px;height:16px;flex-shrink:0; }
  .validate-btn.next-challenge {
    background: var(--green);
    color: #0a1a0a;
    font-size: 14px;
  }
  ::-webkit-scrollbar       { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--surface-4);border-radius:3px; }
  @keyframes pulse-success { 0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)} }
  .nav-btn.success { animation:pulse-success 0.5s ease-out; }
`;

export class ChuckSidePanel extends ChuckComponent {
  private _item: ContentItem | null = null;
  private _totalCount = 30;
  private _hintStates: boolean[] = [];

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
    <div class="panel-header">
      <button class="nav-btn" id="prev-btn" title="Précédent" disabled>‹</button>
      <span class="panel-title" id="panel-title">Panneau</span>
      <button class="nav-btn" id="next-btn" title="Suivant" disabled>›</button>
    </div>
    <div class="body" id="body">
      <div style="padding:20px 16px;color:var(--text-muted);font-style:italic;font-size:12px">Aucun contenu chargé.</div>
    </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById("prev-btn")!.addEventListener("click", () => {
      if (!this._item) return;
      this.emit("chuck:goto-challenge", { id: this._item.id - 1 });
    });
    this.shadow.getElementById("next-btn")!.addEventListener("click", () => {
      if (!this._item) return;
      this._emitNext();
    });

    this.sub("chuck:challenge-loaded", ({ challenge, track }) => {
      const item = track
        ? trackStepToContentItem(challenge as any, track.trackId, track.stepIndex, track.stepCount)
        : challengeToContentItem(challenge as any);
      this._loadItem(item);
    });
    
    this.sub("chuck:challenges-count" as any, ({ count }: { count: number }) => {
      this._totalCount = count;
      this._updateNav();
    });

    this.sub(
      "chuck:content-loaded" as any,
      ({ item }: { item: ContentItem }) => {
        this._loadItem(item);
      },
    );
    this.sub("chuck:challenge-success", ({ result, medal }) =>
      this._showFeedback({ ...result, medal }, true),
    );
    this.sub("chuck:challenge-failed", ({ result }) =>
      this._showFeedback(result, false),
    );
    this.sub("chuck:code-changed", () => this._resetFeedback());
  }

  loadContent(item: ContentItem): void {
    this._loadItem(item);
  }

  private _loadItem(item: ContentItem): void {
    this._item = item;
    this._hintStates = [];
    this._renderItem();
    this._updateNav();
  }

  private _updateNav(): void {
    const prev = this.shadow.getElementById("prev-btn") as HTMLButtonElement;
    const next = this.shadow.getElementById("next-btn") as HTMLButtonElement;
    if (!this._item) return;

    if (isTrackStep(this._item)) {
      // Navigation linéaire dédiée (bouton "Étape suivante" dans la zone
      // de validation) — les chevrons du header restent désactivés.
      prev.disabled = true;
      next.disabled = true;
      return;
    }

    prev.disabled = this._item.id <= 1;

    // Désactiver "next" sauf si le défi est validé
    const isValidated = this._isChallengeValidated(this._item.id);
    next.disabled = !isValidated || this._item.id >= this._totalCount;
  }

  private _renderItem(): void {
    if (!this._item) return;
    const item = this._item;

    // Vérifiez si le défi est déjà validé (à adapter selon votre logique de sauvegarde)
    const isAlreadyValidated = this._isChallengeValidated(item.id);

    const headerTitle = this.shadow.getElementById("panel-title")!;
    headerTitle.textContent = isTrackStep(item)
      ? `Étape ${item.stepIndex} / ${item.stepCount}`
      : item.type === "challenge"
        ? `${item.id} / ${this._totalCount}`
        : `${item.id}`;

    const badgeLabel: Record<string, string> = {
      challenge: "⚔ Défi",
      lesson: "📖 Leçon",
      tip: "💡 Conseil",
      reference: "🔗 Référence",
      "track-step": "🎮 Parcours",
    };

    const metaItems: string[] = [];
    if ("meta" in item && item.meta?.estimatedMinutes)
      metaItems.push(`~${item.meta.estimatedMinutes} min`);
    if (item.type === "challenge" && item.arena_name)
      metaItems.push(item.arena_name);
    const metaHtml = metaItems.length
      ? `<div class="item-meta">${metaItems.join(" · ")}</div>`
      : "";

    const subtitleHtml =
      "subtitle" in item && item.subtitle
        ? `<div class="item-subtitle">${this._esc(item.subtitle)}</div>`
        : "";

    const blocksHtml = (item.blocks ?? [])
      .map((b, i) => this._renderBlock(b, i))
      .join("");

    const isLastTrackStep = isTrackStep(item) && item.stepIndex >= item.stepCount;

    let validationHtml = "";
    if (isChallenge(item) || isTrackStep(item)) {
      const verb = isTrackStep(item) ? "l'étape" : "le défi";
      if (isAlreadyValidated) {
        const label = isTrackStep(item)
          ? isLastTrackStep
            ? "🎉 Revoir la célébration"
            : "Étape suivante →"
          : "Défi suivant →";
        validationHtml = `
        <div class="validation-zone">
          <div class="feedback" id="feedback"></div>
          <button class="validate-btn next-challenge" id="validate-btn">
            ${label}
          </button>
        </div>`;
      } else {
        validationHtml = `
        <div class="validation-zone">
          <div class="feedback" id="feedback"></div>
          <button class="validate-btn" id="validate-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Valider ${verb}
          </button>
        </div>`;
      }
    }

    const earnedMedal = storage.getMedal(item.id) ?? "🥇";
    const medalHtml = isAlreadyValidated
      ? `<span id="validated-badge" class="medal-badge">${earnedMedal}</span>`
      : "";

    this.shadow.getElementById("body")!.innerHTML = `
    <div class="item-header">
      <div class="item-header-left">
        <span class="type-badge ${item.type}">${badgeLabel[item.type] ?? item.type}</span>
        <div class="item-title" style="margin-top:6px">${this._esc(item.title)}</div>
        ${subtitleHtml}${metaHtml}
      </div>
      <div class="item-header-right">
        ${medalHtml}
      </div>
    </div>
    <div class="blocks">${blocksHtml}</div>
    ${validationHtml}`;

    // --- Gestion du clic sur le bouton "Défi/Étape suivant(e)" ---
    const validateBtn = this.shadow.getElementById("validate-btn");
    if (validateBtn) {
      if (isAlreadyValidated) {
        validateBtn.addEventListener("click", () => {
          if (isLastTrackStep) {
            this.emit("chuck:track-completed-request", {
              trackId: (this._item as TrackStepItem).trackId,
            });
            return;
          }
          this._emitNext();
        });
      } else {
        validateBtn.addEventListener("click", () => this._validate());
      }
    }

    this.shadow.querySelectorAll(".hint-item[data-hint]").forEach((el) => {
      el.addEventListener("click", () => {
        const i = parseInt((el as HTMLElement).dataset["hint"] ?? "0", 10);
        if (!this._hintStates[i]) {
          this._hintStates[i] = true;
          el.classList.add("hint-revealed", "revealed");
        }
      });
    });
  }

  private _renderBlock(block: ContentBlock, idx: number): string {
    switch (block.kind) {
      case "theory":
        return `
        <div class="block block-theory">
          ${block.title ? `<h3>${this._esc(block.title)}</h3>` : ""}
          ${this._md(block.content)}
        </div>`;
      case "code":
        return `
        <div class="block-code">
          <div class="code-inner">
            ${block.label ? `<div class="code-label">${this._esc(block.label)}</div>` : ""}
            <pre class="code-body">${this._esc(block.content)}</pre>
          </div>
          ${block.lang && !block.label ? `<div class="code-caption">${this._esc(block.lang)}</div>` : ""}
        </div>`;
      case "mission":
        return `
        <div class="block-mission">
          <h4>${block.title ? this._esc(block.title) : "🎯 Mission"}</h4>
          <div class="mission-body">${this._md(block.content)}</div>
        </div>`;
      case "tip":
        return `
        <div class="block block-tip">💡 ${this._mdInline(block.content)}</div>`;
      case "warning":
        return `
        <div class="block block-warning">⚠️ ${this._mdInline(block.content)}</div>`;
      case "ref": {
        const icon = block.icon ?? "📖";
        const cls = block.url ? "block-ref has-url" : "block-ref";
        const tag = block.url ? "a" : "div";
        const href = block.url
          ? `href="${this._esc(block.url)}" target="_blank" rel="noopener"`
          : "";
        return `<${tag} class="${cls}" ${href}>
          <span class="ref-icon">${icon}</span>
          <div class="ref-text">
            <div class="ref-label">${this._esc(block.label)}</div>
            ${block.detail ? `<div class="ref-detail">${this._esc(block.detail)}</div>` : ""}
          </div></${tag}>`;
      }
      case "concepts":
        return `
        <div class="block block-concepts">
          ${block.items.map((c) => `<span class="concept-tag">${this._esc(c)}</span>`).join("")}
        </div>`;
      case "table":
        return `
        <div class="block block-table">
          <table class="content-table">
            <thead><tr>${block.headers.map((h) => `<th>${this._esc(String(h))}</th>`).join("")}</tr></thead>
            <tbody>${block.rows
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${this._esc(String(cell))}</td>`).join("")}</tr>`,
              )
              .join("")}</tbody>
          </table>
        </div>`;
      case "image":
        return `
        <div class="block block-image">
          <img src="${this._esc(block.src)}" alt="${this._esc(block.alt)}" loading="lazy">
          ${block.caption ? `<div class="img-caption">${this._esc(block.caption)}</div>` : ""}
        </div>`;
      case "divider":
        return `<div class="block block-divider"><hr></div>`;
      case "hints": {
        const hintsHtml = block.items
          .map((h, i) => {
            this._hintStates[idx * 100 + i] = false;
            return `<div class="hint-item" data-hint="${idx * 100 + i}">
            <span class="hint-placeholder" style="color:var(--text-muted);font-style:italic">💡 Indice ${i + 1} — cliquer pour révéler</span>
            <span class="hint-text-hidden">${this._esc(h)}</span>
          </div>`;
          })
          .join("");
        return `<div class="block block-hints"><div class="hints-label">Indices</div>${hintsHtml}</div>`;
      }
      default:
        return "";
    }
  }

  // ── Validation ────────────────────────────────────────────────
  /** Navigation « suivant » : track-aware. Les étapes de parcours sont
   *  résolues par le manager dans l'ordre step_index (ids non contigus) ;
   *  les défis classiques restent en id+1 (ids contigus). */
  private _emitNext(): void {
    if (!this._item) return;
    if (isTrackStep(this._item)) {
      this.emit("chuck:goto-next-track-step", { fromId: this._item.id });
    } else {
      this.emit("chuck:goto-challenge", { id: this._item.id + 1 });
    }
  }

  private _validate(): void {
    const editor = document.getElementById("editor") as
      | (HTMLElement & { getSource?(): string })
      | null;
    const source = editor?.getSource?.() ?? "";
    if (!source.trim()) return;

    const btn = this.shadow.getElementById("validate-btn") as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Validation…";

    // Compter les hints révélés
    const hintsUsed = Object.values(this._hintStates).filter(Boolean).length;

    requestAnimationFrame(() => {
      this.emit("chuck:validate", { source, hintsUsed });
      btn.disabled = false;
      const verb = this._item && isTrackStep(this._item) ? "l'étape" : "le défi";
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Valider ${verb}`;
    });
  }

  // ── Feedback ──────────────────────────────────────────────────
  private _showFeedback(
    result: ValidationResult & { medal?: string },
    success: boolean,
  ): void {
    const el = this.shadow.getElementById("feedback");
    const next = this.shadow.getElementById(
      "next-btn",
    ) as HTMLButtonElement | null;
    if (!el) return;

    if (success) {
      const medal = result.medal ?? "🥇";
      const item = this._item;
      const pongLast = item && isTrackStep(item) && item.stepIndex >= item.stepCount;

      el.className = "feedback success";
      el.innerHTML = `
      <div class="fb-title">${medal} ${item && isTrackStep(item) ? "Étape" : "Défi"} réussi${item && isTrackStep(item) ? "e" : ""} !</div>
      <div class="fb-cycles">${result.cycles} cycle(s) CPU</div>`;

      // Masquer le bouton "Valider le défi/l'étape"
      const btn = this.shadow.getElementById(
        "validate-btn",
      ) as HTMLButtonElement | null;
      if (btn) {
        btn.style.display = "none";
      }

      if (item && isTrackStep(item)) {
        if (pongLast) {
          // Dernière étape : pont direct vers l'écran de célébration.
          this.emit("chuck:track-completed-request", { trackId: item.trackId });
        } else if (item.stepIndex < item.stepCount) {
          const nextBtn = document.createElement("button");
          nextBtn.id = "next-challenge-btn";
          nextBtn.className = "validate-btn next-challenge";
          nextBtn.innerHTML = `Étape suivante →`;
          nextBtn.style.cssText = "background: var(--green); margin-top: 4px;";
          nextBtn.addEventListener("click", () => {
            this.emit("chuck:goto-next-track-step", { fromId: this._item!.id });
          });
          el.insertAdjacentElement("afterend", nextBtn);
        }
      } else if (this._item && this._item.id < this._totalCount) {
        // Ajouter le bouton "Défi suivant" si ce n'est pas le dernier défi
        const nextBtn = document.createElement("button");
        nextBtn.id = "next-challenge-btn";
        nextBtn.className = "validate-btn next-challenge";
        nextBtn.innerHTML = `Défi suivant →`;
        nextBtn.style.cssText = "background: var(--green); margin-top: 4px;";
        nextBtn.addEventListener("click", () => {
          this.emit("chuck:goto-challenge", { id: this._item!.id + 1 });
        });
        el.insertAdjacentElement("afterend", nextBtn);
      }

      // Ajouter la médaille dans item-header-right
      const itemHeaderRight = this.shadow.querySelector(".item-header-right");
      if (itemHeaderRight && !this.shadow.getElementById("validated-badge")) {
        const badge = document.createElement("span");
        badge.id = "validated-badge";
        badge.textContent = medal;
        badge.className = "medal-badge";
        itemHeaderRight.appendChild(badge);
      }

      // Activer le bouton "next-btn" dans le header (défis classiques uniquement —
      // les chevrons restent désactivés pour les étapes Pong, cf. _updateNav)
      if (
        next &&
        this._item &&
        isChallenge(this._item) &&
        this._item.id < this._totalCount
      ) {
        next.disabled = false;
        next.classList.add("success");
        setTimeout(() => next.classList.remove("success"), 600);
      }

      this._celebrate();
    } else {
      const details = result.timeout
        ? "Programme non terminé (timeout)."
        : result.failures.map((f) => `• ${f.message}`).join("<br>");
      el.className = "feedback failure";
      el.innerHTML = `
      <div class="fb-title">✗ Défi échoué</div>
      <div class="fb-detail">${details}</div>
      ${result.cycles ? `<div class="fb-cycles">${result.cycles} cycle(s)</div>` : ""}`;
    }

    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Célébration plein écran ───────────────────────────────────
  private _celebrate(): void {
    const canvas = document.createElement("canvas");
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;" +
      "pointer-events:none;z-index:99999";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    const COLORS = [
      "#3BDB8C",
      "#38BDF8",
      "#FACC15",
      "#FB923C",
      "#F472B6",
      "#A78BFA",
      "#FF6B6B",
    ];

    interface P {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      w: number;
      h: number;
      rot: number;
      rotV: number;
      opacity: number;
      g: number;
    }

    // Origine en bas-centre, jaillissement vers le haut
    const cx = W / 2;
    const oy = H * 0.78;
    const particles: P[] = [];

    for (let i = 0; i < 150; i++) {
      // Angle centré vers le haut, éventail de 200°
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 10 + Math.random() * 14;
      particles.push({
        x: cx + (Math.random() - 0.5) * 120,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        w: 7 + Math.random() * 8,
        h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.28,
        opacity: 1,
        g: 0.28 + Math.random() * 0.14,
      });
    }

    let frame = 0;
    const FADE_START = 60;

    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;

      for (const p of particles) {
        p.vy += p.g;
        p.vx *= 0.988;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        if (frame > FADE_START) p.opacity = Math.max(0, p.opacity - 0.022);
        if (p.opacity <= 0 || p.y > H + 40) continue;
        alive = true;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.w / p.h > 1.5) {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      frame++;
      if (alive) requestAnimationFrame(tick);
      else canvas.remove();
    };

    requestAnimationFrame(tick);
  }

  private _resetFeedback(): void {
    const el = this.shadow.getElementById("feedback");
    const next = this.shadow.getElementById(
      "next-btn",
    ) as HTMLButtonElement | null;
    const btn = this.shadow.getElementById(
      "validate-btn",
    ) as HTMLButtonElement | null;
    const badge = this.shadow.getElementById("validated-badge");
    const nextChallenge = this.shadow.getElementById("next-challenge-btn");

    if (el) el.className = "feedback";
    if (btn) btn.style.display = "";
    if (badge) badge.remove();
    if (nextChallenge) nextChallenge.remove();
    if (next) {
      next.classList.remove("success");
      this._updateNav();
    }
  }

  private _isChallengeValidated(challengeId: number): boolean {
    return storage.isCompleted(challengeId);
  }

  // ── Markdown ──────────────────────────────────────────────────
  // Rendu délégué à la librairie `marked` (cf. core/markdown.ts).
  private _md(s: string): string {
    return renderMarkdown(s);
  }

  private _mdInline(s: string): string {
    return renderMarkdownInline(s);
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

customElements.define("chuck-side-panel", ChuckSidePanel);

function challengeToContentItem(c: any): ContentItem {
  const blocks: import("../types/content.js").ContentBlock[] = [];
  if (c.description) blocks.push({ kind: "theory", content: c.description });
  if (c.meta?.zaks)
    blocks.push({
      kind: "ref",
      icon: "📖",
      label: `${c.meta.zaks.chapter}, p. ${c.meta.zaks.page}`,
      detail: c.meta.zaks.topic,
    });
  if (c.meta?.concepts?.length)
    blocks.push({ kind: "concepts", items: c.meta.concepts });
  if (c.hints?.length)
    blocks.push({ kind: "hints", items: c.hints.map((h: any) => h.text ?? h) });

  return {
    type: "challenge",
    id: c.id,
    arena: c.arena,
    arena_name: c.arena_name,
    title: c.title,
    blocks,
    template: c.template ?? "",
    assertions: c.assertions ?? [],
    maxCycles: c.maxCycles,
    meta: c.meta,
  } as ChallengeItem;
}

function trackStepToContentItem(
  c: any,
  trackId: string,
  stepIndex: number,
  stepCount: number,
): TrackStepItem {
  const blocks: import("../types/content.js").ContentBlock[] = [];
  if (c.description) blocks.push({ kind: "theory", content: c.description });
  if (c.meta?.concepts?.length)
    blocks.push({ kind: "concepts", items: c.meta.concepts });
  if (c.hints?.length)
    blocks.push({ kind: "hints", items: c.hints.map((h: any) => h.text ?? h) });

  return {
    type: "track-step",
    id: c.id,
    trackId,
    title: c.title,
    subtitle: c.arena_name,
    blocks,
    stepIndex,
    stepCount,
  };
}