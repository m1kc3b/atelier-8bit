/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-challenge-panel.ts
   Panneau latéral générique : défis, leçons, conseils, références.
   Le contenu est rendu à partir de blocs JSON typés (ContentItem).
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent }    from '../core/base-component.js';
import type { ValidationResult } from '../types/challenge.js';
import type {
  ContentItem, ContentBlock,
  ChallengeItem,
} from '../types/content.js';
import { isChallenge } from '../types/content.js';

// ── Styles ────────────────────────────────────────────────────

const STYLES = /* css */`
  @import '/src/styles/tokens.css';

  :host {
    display: flex;
    flex-direction: column;
    background: var(--surface);
    overflow: hidden;
    height: 100%;
  }

  /* ── Header ─────────────────────────────────────────────── */
  .panel-header {
    height: 34px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 4px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    user-select: none;
  }
  .panel-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: .07em;
    flex: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nav-btn {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 5px;
    font-size: 15px; font-weight: 700;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted);
    transition: background var(--t-fast), color var(--t-fast);
    flex-shrink: 0;
  }
  .nav-btn:hover:not(:disabled) { background: var(--surface-3); color: var(--text); }
  .nav-btn:disabled { opacity: .2; cursor: default; }
  .nav-btn.success  { color: var(--green); }

  /* ── Badge type ──────────────────────────────────────────── */
  .type-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .type-badge.challenge { background: var(--accent-dim); color: var(--accent); }
  .type-badge.lesson    { background: var(--cyan-dim);   color: var(--cyan);   }
  .type-badge.tip       { background: var(--amber-dim);  color: var(--amber);  }
  .type-badge.reference { background: var(--surface-3);  color: var(--text-dim); }

  /* ── Corps ───────────────────────────────────────────────── */
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ── Item header ─────────────────────────────────────────── */
  .item-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--border);
  }
  .item-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.3;
  }
  .item-subtitle {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 3px;
  }
  .item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 13px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  /* ── Blocs ───────────────────────────────────────────────── */
  .blocks {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 12px 0;
  }

  .block {
    padding: 6px 16px;
  }

  /* theory */
  .block-theory {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text);
  }
  .block-theory h3 {
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--text-dim);
    margin: 0 0 6px;
  }
  .block-theory strong { color: var(--text); font-weight: 600; }
  .block-theory em     { color: var(--text-dim); font-style: italic; }
  .block-theory code {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--surface-3);
    color: var(--cyan);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .block-theory h2 {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: .06em;
    margin: 8px 0 4px;
  }
  .block-theory ul {
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 4px 0;
  }
  .block-theory p { margin: 0 0 6px; }
  .block-theory p:last-child { margin-bottom: 0; }

  /* ── code ───────────────────────────────────────────────── */
  pre {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    background: var(--surface-2); /* Fond cohérent avec ton thème */
    color: var(--cyan);
    padding: 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    overflow-x: auto; /* Barre de défilement horizontale si nécessaire */
    margin: 8px 0;
    white-space: pre;
  }
  .block-code {
    padding: 6px 16px;
  }
  .code-inner {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .code-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 5px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-3);
  }
  .code-body {
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.65;
    color: var(--text);
    padding: 10px 12px;
    margin: 0;
    overflow-x: auto;
    white-space: pre;
  }
  .code-caption {
    font-size: 10px;
    color: var(--text-muted);
    padding: 4px 10px 6px;
    font-style: italic;
  }

  /* mission */
  .block-mission {
    margin: 2px 16px;
    padding: 10px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0;
  }
  .block-mission h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--accent);
    margin: 0 0 5px;
  }
  .block-mission .mission-body {
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--text-dim);
  }
  .block-mission .mission-body strong { color: var(--text); font-weight: 600; }
  .block-mission .mission-body code {
    font-family: var(--font-mono); font-size: 11px;
    background: var(--surface-3); color: var(--cyan);
    padding: 1px 5px; border-radius: 3px;
  }

  /* tip */
  .block-tip {
    margin: 2px 16px;
    padding: 8px 12px;
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,.2);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--amber);
  }
  .block-tip code {
    font-family: var(--font-mono); font-size: 11px;
    background: rgba(251,191,36,.15);
    padding: 1px 4px; border-radius: 3px;
  }

  /* warning */
  .block-warning {
    margin: 2px 16px;
    padding: 8px 12px;
    background: var(--red-dim);
    border: 1px solid rgba(248,113,113,.2);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--red);
  }

  /* ref */
  .block-ref {
    margin: 2px 16px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 10px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 0 5px 5px 0;
    font-size: 11px;
    text-decoration: none;
    color: inherit;
    cursor: default;
    transition: background var(--t-fast);
  }
  .block-ref.has-url { cursor: pointer; }
  .block-ref.has-url:hover { background: var(--surface-4); }
  .block-ref .ref-icon { font-size: 13px; flex-shrink: 0; padding-top: 1px; }
  .block-ref .ref-text { line-height: 1.5; }
  .block-ref .ref-label { color: var(--text); font-weight: 600; }
  .block-ref .ref-detail { color: var(--text-muted); font-size: 10px; margin-top: 1px; }

  /* concepts */
  .block-concepts {
    display: flex; flex-wrap: wrap; gap: 5px;
  }
  .concept-tag {
    font-family: var(--font-mono);
    font-size: 10px; font-weight: 600;
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--cyan-dim);
    color: var(--cyan);
    border: 1px solid rgba(56,189,248,.2);
  }

  /* table */
  .block-table { overflow-x: auto; }
  .content-table {
    width: 100%; border-collapse: collapse;
    font-size: 11.5px;
  }
  .content-table th {
    text-align: left;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--text-muted);
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
  }
  .content-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border);
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .content-table tr:last-child td { border-bottom: none; }

  /* image */
  .block-image img {
    width: 100%; border-radius: 6px;
    border: 1px solid var(--border);
  }
  .block-image .img-caption {
    font-size: 10px; color: var(--text-muted);
    text-align: center; margin-top: 4px;
    font-style: italic;
  }

  /* divider */
  .block-divider {
    padding: 2px 0 !important;
  }
  .block-divider hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 4px 0;
  }

  /* hints */
  .block-hints { display: flex; flex-direction: column; gap: 5px; }
  .hints-label {
    font-size: 10px; font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .08em;
    margin-bottom: 2px;
  }
  .hint-item {
    padding: 7px 10px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
    transition: background var(--t-fast);
    user-select: none;
  }
  .hint-item:hover { background: var(--surface-4); }
  .hint-item.revealed {
    cursor: default;
    color: var(--amber);
    border-color: rgba(251,191,36,.2);
    background: var(--amber-dim);
  }
  .hint-text-hidden { display: none; }
  .hint-revealed .hint-placeholder { display: none; }
  .hint-revealed .hint-text-hidden { display: block; }

  /* ── Zone de validation (challenges uniquement) ────────── */
  .validation-zone {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .feedback {
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.5;
    display: none;
  }
  .feedback.success {
    display: block;
    background: var(--green-dim);
    border: 1px solid rgba(61,214,140,.3);
    color: var(--green);
  }
  .feedback.failure {
    display: block;
    background: var(--red-dim);
    border: 1px solid rgba(248,113,113,.3);
    color: var(--red);
  }
  .feedback .fb-title  { font-weight: 700; margin-bottom: 4px; font-size: 13px; }
  .feedback .fb-detail { opacity: .85; font-family: var(--font-mono); font-size: 11px; }
  .feedback .fb-cycles { margin-top: 6px; font-size: 10px; opacity: .65; font-family: var(--font-mono); }

  .validate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 14px;
    background: var(--green);
    color: #0a1a0a;
    font-weight: 700;
    font-size: 13px;
    font-family: var(--font-ui);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity .12s, transform .08s;
    width: 100%;
  }
  .validate-btn:hover   { opacity: .88; }
  .validate-btn:active  { transform: scale(.98); }
  .validate-btn:disabled { opacity: .3; cursor: not-allowed; transform: none; }
  .validate-btn svg { width: 16px; height: 16px; flex-shrink: 0; }

  /* ── Scrollbar ────────────────────────────────────────── */
  ::-webkit-scrollbar       { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 3px; }

  /* ---------- Animations pour la validation réussie ---------- */

@keyframes pulse-success {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

@keyframes confetti-fall {
  0% {
    transform: translateY(-10px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100px) rotate(360deg);
    opacity: 0;
  }
}

/* Animation du bouton "Suivant" */
.next-btn.success {
  animation: pulse-success 0.5s ease-out;
  color: var(--green) !important;
}

/* Conteneur pour les confettis */
.feedback.success::after {
  content: "";
  position: absolute;
  top: -20px;
  left: 50%;
  width: 0;
  height: 0;
}

/* Confettis (créés via JavaScript) */
.confetti {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--green);
  border-radius: 50%;
  pointer-events: none;
  z-index: 100;
  animation: confetti-fall 1s linear forwards;
}
`;

// ── Composant ─────────────────────────────────────────────────

export class ChuckChallengePanel extends ChuckComponent {
  private _item:        ContentItem | null = null;
  private _totalCount   = 30;
  private _hintStates:  boolean[]          = [];

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
    <div class="panel-header">
      <button class="nav-btn" id="prev-btn" title="Précédent" disabled>‹</button>
      <span class="panel-title" id="panel-title">Panneau</span>
      <button class="nav-btn" id="next-btn" title="Suivant" disabled>›</button>
    </div>
    <div class="body" id="body">
      <div style="padding:20px 16px;color:var(--text-muted);font-style:italic;font-size:12px">
        Aucun contenu chargé.
      </div>
    </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById('prev-btn')!
      .addEventListener('click', () => {
        if (!this._item) return;
        this.emit('chuck:goto-challenge', { id: this._item.id - 1 });
      });

    this.shadow.getElementById('next-btn')!
      .addEventListener('click', () => {
        if (!this._item) return;
        this.emit('chuck:goto-challenge', { id: this._item.id + 1 });
      });

    // Écoute du chargement d'un item (challenge ou autre)
    this.sub('chuck:challenge-loaded', ({ challenge }) => {
      const item = challengeToContentItem(challenge as any);
      this._loadItem(item);
    });

    // Leçon de formation
    this.sub('chuck:content-loaded' as any, ({ item }: { item: ContentItem }) => {
      this._loadItem(item);
    });

    this.sub('chuck:challenge-success', ({ result }) => this._showFeedback(result, true));
    this.sub('chuck:challenge-failed',  ({ result }) => this._showFeedback(result, false));
    this.sub('chuck:code-changed',      ()           => this._resetFeedback());
  }

  // ── API publique : charger un ContentItem directement ────────
  loadContent(item: ContentItem): void {
    this._loadItem(item);
  }

  // ── Chargement ────────────────────────────────────────────────
  private _loadItem(item: ContentItem): void {
    this._item       = item;
    this._hintStates = [];
    this._renderItem();
    this._updateNav();
  }

  // ── Navigation ────────────────────────────────────────────────
  private _updateNav(): void {
    const prev = this.shadow.getElementById('prev-btn') as HTMLButtonElement;
    const next = this.shadow.getElementById('next-btn') as HTMLButtonElement;
    if (!this._item) return;
    prev.disabled = this._item.id <= 1;
    next.disabled = this._item.id >= this._totalCount;
    next.classList.remove('success');
  }

  // ── Rendu principal ───────────────────────────────────────────
  private _renderItem(): void {
    if (!this._item) return;
    const item = this._item;

    // Titre dans le header
    const headerTitle = this.shadow.getElementById('panel-title')!;
    const pos = item.type === 'challenge'
      ? `${item.id} / ${this._totalCount}`
      : `${item.id}`;
    headerTitle.textContent = pos;

    // Badge type
    const badgeLabel: Record<string, string> = {
      challenge: '⚔ Défi', lesson: '📖 Leçon',
      tip: '💡 Conseil', reference: '🔗 Référence',
    };

    // Meta line
    const metaItems: string[] = [];
    if ('meta' in item && item.meta?.estimatedMinutes) {
      metaItems.push(`~${item.meta.estimatedMinutes} min`);
    }
    if (item.type === 'challenge' && item.arena_name) {
      metaItems.push(item.arena_name);
    }
    const metaHtml = metaItems.length
      ? `<div class="item-meta">${metaItems.join(' · ')}</div>`
      : '';

    const subtitleHtml = 'subtitle' in item && item.subtitle
      ? `<div class="item-subtitle">${this._esc(item.subtitle)}</div>`
      : '';

    // Blocs
    const blocksHtml = (item.blocks ?? [])
      .map((b, i) => this._renderBlock(b, i))
      .join('');

    // Zone de validation (challenges uniquement)
    const validationHtml = isChallenge(item) ? `
      <div class="validation-zone">
        <div class="feedback" id="feedback"></div>
        <button class="validate-btn" id="validate-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Valider le défi
        </button>
      </div>` : '';

    this.shadow.getElementById('body')!.innerHTML = `
      <div class="item-header">
        <span class="type-badge ${item.type}">${badgeLabel[item.type] ?? item.type}</span>
        <div class="item-title" style="margin-top:6px">${this._esc(item.title)}</div>
        ${subtitleHtml}
        ${metaHtml}
      </div>
      <div class="blocks">${blocksHtml}</div>
      ${validationHtml}
    `;

    // Binding bouton valider
    this.shadow.getElementById('validate-btn')
      ?.addEventListener('click', () => this._validate());

    // Binding hints
    this.shadow.querySelectorAll('.hint-item[data-hint]').forEach(el => {
      el.addEventListener('click', () => {
        const i = parseInt((el as HTMLElement).dataset['hint'] ?? '0', 10);
        if (!this._hintStates[i]) {
          this._hintStates[i] = true;
          el.classList.add('hint-revealed');
          el.classList.add('revealed');
        }
      });
    });
  }

  // ── Rendu d'un bloc ───────────────────────────────────────────
  private _renderBlock(block: ContentBlock, idx: number): string {
    switch (block.kind) {

      case 'theory': return `
        <div class="block block-theory">
          ${block.title ? `<h3>${this._esc(block.title)}</h3>` : ''}
          ${this._md(block.content)}
        </div>`;

      case 'code': return `
        <div class="block-code">
          <div class="code-inner">
            ${block.label ? `<div class="code-label">${this._esc(block.label)}</div>` : ''}
            <pre class="code-body">${this._esc(block.content)}</pre>
            ${block.label ? '' : ''}
          </div>
          ${block.lang && !block.label ? `<div class="code-caption">${this._esc(block.lang)}</div>` : ''}
        </div>`;

      case 'mission': return `
        <div class="block-mission">
          <h4>${block.title ? this._esc(block.title) : '🎯 Mission'}</h4>
          <div class="mission-body">${this._md(block.content)}</div>
        </div>`;

      case 'tip': return `
        <div class="block block-tip">
          💡 ${this._mdInline(block.content)}
        </div>`;

      case 'warning': return `
        <div class="block block-warning">
          ⚠️ ${this._mdInline(block.content)}
        </div>`;

      case 'ref': {
        const icon   = block.icon ?? '📖';
        const cls    = block.url ? 'block-ref has-url' : 'block-ref';
        const tag    = block.url ? 'a' : 'div';
        const href   = block.url ? `href="${this._esc(block.url)}" target="_blank" rel="noopener"` : '';
        return `
        <${tag} class="${cls}" ${href}>
          <span class="ref-icon">${icon}</span>
          <div class="ref-text">
            <div class="ref-label">${this._esc(block.label)}</div>
            ${block.detail ? `<div class="ref-detail">${this._esc(block.detail)}</div>` : ''}
          </div>
        </${tag}>`;
      }

      case 'concepts': return `
        <div class="block block-concepts">
          ${block.items.map(c => `<span class="concept-tag">${this._esc(c)}</span>`).join('')}
        </div>`;

      case 'table': return `
        <div class="block block-table">
          <table class="content-table">
            <thead><tr>${block.headers.map(h =>
              `<th>${this._esc(String(h))}</th>`).join('')}</tr></thead>
            <tbody>${block.rows.map(row =>
              `<tr>${row.map(cell =>
                `<td>${this._esc(String(cell))}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>`;

      case 'image': return `
        <div class="block block-image">
          <img src="${this._esc(block.src)}" alt="${this._esc(block.alt)}" loading="lazy">
          ${block.caption ? `<div class="img-caption">${this._esc(block.caption)}</div>` : ''}
        </div>`;

      case 'divider': return `
        <div class="block block-divider"><hr></div>`;

      case 'hints': {
        const hintsHtml = block.items.map((h, i) => {
          this._hintStates[idx * 100 + i] = false;
          return `
          <div class="hint-item" data-hint="${idx * 100 + i}">
            <span class="hint-placeholder" style="color:var(--text-muted);font-style:italic">
              💡 Indice ${i + 1} — cliquer pour révéler
            </span>
            <span class="hint-text-hidden">${this._esc(h)}</span>
          </div>`;
        }).join('');
        return `
        <div class="block block-hints">
          <div class="hints-label">Indices</div>
          ${hintsHtml}
        </div>`;
      }

      default: return '';
    }
  }

  // ── Validation ────────────────────────────────────────────────
  private _validate(): void {
    const editor = document.getElementById('editor') as
      (HTMLElement & { getSource?(): string }) | null;
    const source = editor?.getSource?.() ?? '';
    if (!source.trim()) return;

    const btn = this.shadow.getElementById('validate-btn') as HTMLButtonElement;
    btn.disabled    = true;
    btn.textContent = 'Validation…';

    requestAnimationFrame(() => {
      this.emit('chuck:validate', { source });
      btn.disabled  = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Valider le défi`;
    });
  }

  // ── Feedback ──────────────────────────────────────────────────
  private _showFeedback(result: ValidationResult, success: boolean): void {
    const el   = this.shadow.getElementById('feedback');
    const next = this.shadow.getElementById('next-btn') as HTMLButtonElement | null;
    if (!el) return;

    if (success) {
      el.className = 'feedback success';
      el.innerHTML = `
        <div class="fb-title">✓ Défi réussi !</div>
        <div class="fb-cycles">${result.cycles} cycle(s) CPU</div>`;
      if (next && this._item && this._item.id < this._totalCount) {
        next.disabled = false;
        next.classList.add('success');
        // Réinitialise l'animation après 0.5s pour permettre une réutilisation
        setTimeout(() => next.classList.remove('success'), 500);
      }
      // Création des confettis
      this._createConfetti(el);
    } else {
      const details = result.timeout
        ? 'Programme non terminé (timeout).'
        : result.failures.map(f => `• ${f.message}`).join('<br>');
      el.className = 'feedback failure';
      el.innerHTML = `
        <div class="fb-title">✗ Défi échoué</div>
        <div class="fb-detail">${details}</div>
        ${result.cycles ? `<div class="fb-cycles">${result.cycles} cycle(s)</div>` : ''}`;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private _createConfetti(parent: HTMLElement): void {
  const rect = parent.getBoundingClientRect();
  const container = this.shadow.querySelector('.body') as HTMLElement;

  for (let i = 0; i < 15; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${rect.left + rect.width / 2 + (Math.random() * 40 - 20)}px`;
    confetti.style.top = `${rect.top}px`;
    confetti.style.background = [
      'var(--green)',
      'var(--cyan)',
      'var(--amber)',
      '#fff'
    ][Math.floor(Math.random() * 4)];

    // Taille aléatoire entre 6px et 10px
    confetti.style.width = `${6 + Math.random() * 4}px`;
    confetti.style.height = confetti.style.width;

    // Animation aléatoire
    confetti.style.animationDuration = `${0.8 + Math.random() * 0.4}s`;
    confetti.style.animationDelay = `${Math.random() * 0.2}s`;

    container.appendChild(confetti);

    // Supprime le confetti après l'animation
    setTimeout(() => confetti.remove(), 1000);
  }
}

  private _resetFeedback(): void {
    const el   = this.shadow.getElementById('feedback');
    const next = this.shadow.getElementById('next-btn') as HTMLButtonElement | null;
    if (el)   el.className = 'feedback';
    if (next) { next.classList.remove('success'); this._updateNav(); }
  }

  // ── Markdown ──────────────────────────────────────────────────
  private _md(s: string): string {
    const esc = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.)/s, '<p>$1')
      .replace(/(.)$/s, '$1</p>');
  }

  // Markdown inline (pas de blocs)
  private _mdInline(s: string): string {
    const esc = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  private _esc(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

customElements.define('chuck-challenge-panel', ChuckChallengePanel);

// ── Adaptateur : ancien format Challenge → ContentItem ─────────
// Permet la compatibilité avec le challenges.json v3 existant

function challengeToContentItem(c: any): ContentItem {
  const blocks: import('../types/content.js').ContentBlock[] = [];

  // Description → bloc theory
  if (c.description) {
    blocks.push({ kind: 'theory', content: c.description });
  }

  // Référence Zaks → bloc ref
  if (c.meta?.zaks) {
    blocks.push({
      kind:   'ref',
      icon:   '📖',
      label:  `${c.meta.zaks.chapter}, p. ${c.meta.zaks.page}`,
      detail: c.meta.zaks.topic,
    });
  }

  // Concepts → bloc concepts
  if (c.meta?.concepts?.length) {
    blocks.push({ kind: 'concepts', items: c.meta.concepts });
  }

  // Hints → bloc hints
  if (c.hints?.length) {
    blocks.push({
      kind:  'hints',
      items: c.hints.map((h: any) => h.text ?? h),
    });
  }

  return {
    type:        'challenge',
    id:          c.id,
    arena:       c.arena,
    arena_name:  c.arena_name,
    title:       c.title,
    blocks,
    template:    c.template ?? '',
    assertions:  c.assertions ?? [],
    maxCycles:   c.maxCycles,
    meta:        c.meta,
  } as ChallengeItem;
}
