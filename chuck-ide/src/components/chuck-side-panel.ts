/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-side-panel.ts
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import type { ValidationResult, TrackStepListItem } from "../types/challenge.js";
import type {
  ContentItem,
  ContentBlock,
  TrackStepItem,
} from "../types/content.js";
import { isChallenge, isTrackStep } from "../types/content.js";
import { storage } from '../infra/storage/storage-service.js';
import { renderMarkdown, renderMarkdownInline } from '../core/markdown.js';
import { authService } from '../features/auth/auth-service.js';
import { challengeToContentItem, trackStepToContentItem } from "../features/content/content-mappers.js";
import { STYLES } from "./side-panel/side-panel.styles.js";

export class ChuckSidePanel extends ChuckComponent {
  private _item: ContentItem | null = null;
  private _totalCount = 30;
  private _hintStates: boolean[] = [];
  /** Données du défi du mois (null = pas de défi à afficher). */
  private _defi: { title: string; instructionsHtml: string } | null = null;
  /** Classement du mois (vide = pas de classement). */
  private _ranking: Array<{
    rank: number;
    name: string;
    score: number;
    isMe: boolean;
    prestige: boolean;
  }> = [];
  /** Vue active du panneau : 'item' (défi/leçon/étape) ou 'defi' (arène). */
  private _mode: "item" | "defi" = "item";
  /** Roadmap du parcours courant (liste des étapes), par nom de parcours.
   *  Alimentée par chuck:track-steps ; affichée en tête quand une étape de
   *  parcours est ouverte, pour matérialiser la progression pas-à-pas. */
  private _trackSteps: TrackStepListItem[] = [];
  private _trackName: string | null = null;
  /** true pendant l'attente du verdict serveur d'une soumission. */
  private _submitting = false;
  /** Retour de la dernière soumission (succès/échec), null si aucun. */
  private _submitFeedback: { ok: boolean; text: string } | null = null;

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

    // Roadmap d'un parcours : la liste des étapes est émise par le
    // challenge-manager à l'entrée d'un parcours. On la mémorise pour
    // l'afficher en tête du panneau quand une étape est ouverte (vue Ikea
    // pas-à-pas). Si l'étape courante est déjà affichée, on re-render.
    this.sub("chuck:track-steps", ({ trackName, items }) => {
      this._trackName = trackName;
      this._trackSteps = items;
      if (this._mode === "item" && this._item && isTrackStep(this._item)) {
        this._renderItem();
      }
    });
    this.sub("chuck:challenge-success", ({ result, medal }) =>
      this._showFeedback({ ...result, medal }, true),
    );
    this.sub("chuck:challenge-failed", ({ result }) =>
      this._showFeedback(result, false),
    );
    this.sub("chuck:code-changed", () => this._resetFeedback());

    // ── Mode « Défi du mois » : panneau scindé (classement / brief) ──
    // Les données réelles arrivent par le bus depuis le defi-manager :
    //  - chuck:ide-defi    → bascule en vue défi (état courant ré-rendu)
    //  - chuck:defi-loaded → énoncé du mois (ou null)
    //  - chuck:defi-ranking→ classement relatif (recalculé serveur)
    //  - chuck:defi-submitted → verdict après soumission
    this.sub("chuck:ide-defi", () => {
      this._item = null;
      this._mode = "defi";
      this._renderDefi();
    });
    this.sub("chuck:defi-loaded", ({ defi }) => {
      this._defi = defi
        ? { title: defi.title, instructionsHtml: this._md(defi.instructions) }
        : null;
      // Injecte le template du défi dans l'éditeur si présent et éditeur vide.
      if (defi?.template) this._maybeSeedEditor(defi.template);
      if (this._mode === "defi") this._renderDefi();
    });
    this.sub("chuck:defi-ranking", ({ entries }) => {
      this._ranking = entries.map((e) => ({
        rank: e.rank,
        name: e.displayName,
        score: e.score,
        isMe: e.isMe ?? false,
        prestige: e.prestige ?? false,
      }));
      if (this._mode === "defi") this._renderDefi();
    });
    this.sub("chuck:defi-submitted", ({ result }) => {
      this._submitting = false;
      this._submitFeedback = result.accepted
        ? {
            ok: true,
            text:
              `✓ Acceptée — rang ${result.rank ?? "?"}` +
              (result.score != null ? ` · score ${result.score.toFixed(3)}` : ""),
          }
        : { ok: false, text: `✗ ${result.error ?? "Soumission refusée."}` };
      if (this._mode === "defi") this._renderDefi();
    });
  }

  loadContent(item: ContentItem): void {
    this._loadItem(item);
  }

  private _loadItem(item: ContentItem): void {
    this._item = item;
    this._mode = "item";
    this._hintStates = [];
    this._renderItem();
    this._updateNav();
  }

  /** Injecte le template du défi dans l'éditeur uniquement s'il est vide,
   *  pour ne jamais écraser le travail en cours du joueur. */
  private _maybeSeedEditor(template: string): void {
    const editor = document.getElementById("editor") as
      | (HTMLElement & { getSource?(): string; setSource?(s: string): void })
      | null;
    if (!editor?.setSource) return;
    const current = editor.getSource?.() ?? "";
    if (current.trim().length === 0) editor.setSource(template);
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
    const isLastChallenge = isChallenge(item) && item.id >= this._totalCount;

    let validationHtml = "";
    if (isChallenge(item) || isTrackStep(item)) {
      const verb = isTrackStep(item) ? "l'étape" : "le défi";
      if (isAlreadyValidated) {
        const label = isTrackStep(item)
          ? isLastTrackStep
            ? "🎉 Revoir la célébration"
            : "Étape suivante →"
          : isLastChallenge
            ? null
            : "Défi suivant →";
        const buttonHtml = label
          ? `<button class="validate-btn next-challenge" id="validate-btn">
            ${label}
          </button>`
          : `<div class="all-validated">🎉 Tous les défis sont validés !</div>`;
        validationHtml = `
        <div class="validation-zone">
          <div class="feedback" id="feedback"></div>
          ${buttonHtml}
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
    ${isTrackStep(item) ? this._trackRoadmapHtml(item.id) : ""}
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

    // Navigation directe depuis la roadmap : ne saute que vers une étape
    // accessible (déjà validée ou immédiatement suivante). Le manager résout
    // l'ordre réel (step_index), donc on émet l'id de l'étape ciblée.
    this.shadow.querySelectorAll<HTMLElement>(".roadmap-step[data-step-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset["stepId"]);
        const step = this._trackSteps.find((s) => s.id === id);
        if (!step || !step.accessible || step.current) return;
        this.emit("chuck:goto-challenge", { id });
      });
    });

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

  /** Bandeau de progression d'un parcours : pastilles d'étapes cliquables.
   *  N'affiche rien tant que la roadmap n'est pas connue ou ne correspond pas
   *  à l'étape courante (évite d'afficher une roadmap d'un autre parcours). */
  private _trackRoadmapHtml(currentId: number): string {
    const steps = this._trackSteps;
    if (steps.length === 0) return "";
    // Sécurité : l'étape courante doit appartenir à cette roadmap.
    if (!steps.some((s) => s.id === currentId)) return "";

    const done = steps.filter((s) => s.completed).length;
    const dots = steps
      .map((s) => {
        const classes = ["roadmap-step"];
        if (s.completed) classes.push("done");
        if (s.id === currentId) classes.push("current");
        if (!s.accessible) classes.push("locked");
        const label = s.completed
          ? s.medal ?? "✓"
          : s.id === currentId
            ? "▶"
            : !s.accessible
              ? "🔒"
              : s.stepIndex;
        const title = this._esc(`Étape ${s.stepIndex} — ${s.title}`);
        return `<button class="${classes.join(" ")}" data-step-id="${s.id}" title="${title}">${label}</button>`;
      })
      .join("");

    const name = this._trackName ? this._esc(this._trackName) : "Parcours";
    return `
    <div class="roadmap">
      <div class="roadmap-head">
        <span class="roadmap-name">🎮 ${name}</span>
        <span class="roadmap-count">${done} / ${steps.length}</span>
      </div>
      <div class="roadmap-track">${dots}</div>
    </div>`;
  }

  /** Rendu du mode « Défi du mois » : haut = classement, bas = brief + soumettre. */
  private _renderDefi(): void {
    const headerTitle = this.shadow.getElementById("panel-title");
    if (headerTitle) headerTitle.textContent = "Défi du mois";
    // Pas de navigation séquentielle en mode défi : chevrons désactivés.
    const prev = this.shadow.getElementById("prev-btn") as HTMLButtonElement | null;
    const next = this.shadow.getElementById("next-btn") as HTMLButtonElement | null;
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;

    // ── Haut : classement ────────────────────────────────────────
    const rankBody = this._ranking.length
      ? `<table class="content-table defi-rank-table">
           <thead><tr><th>#</th><th>Joueur</th><th>Score</th></tr></thead>
           <tbody>${this._ranking
             .map(
               (r) =>
                 `<tr class="${r.isMe ? "is-me" : ""}">
                    <td>${r.rank}</td>
                    <td>${this._esc(r.name)}${r.prestige ? ' <span class="prestige" title="Opcode caché">★</span>' : ""}</td>
                    <td>${r.score.toFixed(3)}</td>
                  </tr>`,
             )
             .join("")}</tbody>
         </table>`
      : `<div class="defi-empty">
           <div class="defi-empty-icon">🏁</div>
           <div class="defi-empty-title">Pas encore de classement</div>
           <div class="defi-empty-hint">Sois le premier à soumettre une solution ce mois-ci.</div>
         </div>`;

    // ── Bas : instructions du défi ───────────────────────────────
    const briefBody = this._defi
      ? `<div class="item-header">
           <div class="item-header-left">
             <span class="type-badge challenge">🏆 Défi du mois</span>
             <div class="item-title" style="margin-top:6px">${this._esc(this._defi.title)}</div>
           </div>
         </div>
         <div class="blocks"><div class="block block-theory">${this._defi.instructionsHtml}</div></div>`
      : `<div class="defi-empty">
           <div class="defi-empty-icon">📭</div>
           <div class="defi-empty-title">Pas de défi à afficher</div>
           <div class="defi-empty-hint">Le défi du mois n'est pas encore disponible. Reviens bientôt.</div>
         </div>`;

    // ── Bouton soumettre : visible toujours, actif si connecté (GitHub) ──
    // Le défi du mois est gratuit : seule la connexion GitHub est requise
    // pour soumettre un score (rattachement au profil public + classement).
    const canSubmit =
      !!this._defi &&
      authService.isAuthenticated();
    const submitNote = !authService.isAuthenticated()
      ? "Connecte-toi avec GitHub pour soumettre ton score."
      : !this._defi
        ? "Aucun défi actif pour le moment."
        : "";

    const feedbackHtml = this._submitFeedback
      ? `<div class="defi-submit-feedback ${this._submitFeedback.ok ? "ok" : "err"}">${this._esc(
          this._submitFeedback.text,
        )}</div>`
      : "";

    const btnDisabled = !canSubmit || this._submitting;
    const submitZone = `
      <div class="defi-submit-zone">
        ${submitNote ? `<div class="defi-submit-note">${submitNote}</div>` : ""}
        ${feedbackHtml}
        <button class="defi-submit-btn" id="defi-submit-btn" ${btnDisabled ? "disabled" : ""}>
          ${
            this._submitting
              ? `<span class="defi-spinner"></span> Scoring serveur…`
              : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg> Soumettre`
          }
        </button>
      </div>`;

    this.shadow.getElementById("body")!.innerHTML = `
      <div class="defi">
        <div class="defi-section defi-rank">
          <div class="defi-section-head">🏆 Classement</div>
          <div class="defi-section-body">${rankBody}</div>
        </div>
        <div class="defi-section defi-brief">
          <div class="defi-section-head">📋 Instructions</div>
          <div class="defi-section-body">${briefBody}</div>
          ${submitZone}
        </div>
      </div>`;

    this.shadow
      .getElementById("defi-submit-btn")
      ?.addEventListener("click", () => {
        if (!canSubmit || this._submitting) return;
        const editor = document.getElementById("editor") as
          | (HTMLElement & { getSource?(): string })
          | null;
        const source = editor?.getSource?.() ?? "";
        if (!source.trim()) {
          this._submitFeedback = { ok: false, text: "✗ Le code est vide." };
          this._renderDefi();
          return;
        }
        // Soumission au scoring serveur (déterministe, cas cachés). Le front
        // ne calcule rien : il transmet et attend le verdict via le bus.
        this._submitting = true;
        this._submitFeedback = null;
        this._renderDefi();
        this.emit("chuck:defi-submit", { source });
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