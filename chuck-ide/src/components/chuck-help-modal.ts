/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-help-modal.ts
   Modale de formation : layout deux colonnes (sidebar TOC + contenu).
   TOC généré automatiquement depuis les h1/h2/h3 du Markdown.
   Recherche plein-texte. IntersectionObserver pour suivi de position.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from '../core/base-component.js';
import { renderDocs } from '../core/markdown.js';

// ── Structure TOC ─────────────────────────────────────────────

interface TocEntry {
  id:    string;
  level: number;   // 1 = h2, 2 = h3
  text:  string;
  isExercise: boolean;
}

// Chapitres de premier niveau — construits depuis les h2 du Markdown
// (reflète exactement la structure réelle de docs.md)
const CHAPTERS = [
  { label: '✦ Intro',    match: /chuck\s*ide/i },
  { label: 'Éditeur',    match: /l.éditeur/i },
  { label: 'Assembleur', match: /l.assembleur/i },
  { label: 'Émulateur',  match: /l.émulateur/i },
  { label: 'Défis',      match: /les\s+défis/i },
];

// ── Styles ────────────────────────────────────────────────────

const STYLES = /* css */`
  @import '/src/styles/tokens.css';

  /* ── Hôte ────────────────────────────────────────────────── */
  :host {
    position: fixed;
    z-index: 8000;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    width: min(1100px, 94vw);
    height: min(840px, 88vh);
    min-width: 360px;
    min-height: 280px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 32px 80px rgba(0,0,0,.65);
    display: none;
    flex-direction: column;
    overflow: hidden;
    resize: both;
    font-family: var(--font-ui);
  }
  :host(.open) { display: flex; }

  /* ── Titlebar ─────────────────────────────────────────────── */
  .titlebar {
    height: 38px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 10px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    cursor: grab;
    flex-shrink: 0;
    user-select: none;
  }
  .titlebar:active { cursor: grabbing; }

  .tb-icon  { font-size: 14px; opacity: .7; }
  .tb-title {
    font-size: 11px; font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase; letter-spacing: .08em;
    flex: 1;
  }

  /* Recherche dans la titlebar */
  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 8px;
    color: var(--text-muted);
    pointer-events: none;
  }
  .search-icon svg { width: 13px; height: 13px; }

  #search-input {
    height: 26px;
    width: 200px;
    padding: 0 10px 0 28px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: 5px;
    font-size: 12px;
    color: var(--text);
    font-family: var(--font-ui);
    outline: none;
    transition: border-color .12s, width .2s;
  }
  #search-input::placeholder { color: var(--text-muted); }
  #search-input:focus {
    border-color: var(--accent);
    width: 260px;
  }

  .search-count {
    margin-left: 6px;
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 40px;
  }

  .tb-close {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--surface-3);
    border: none; cursor: pointer;
    color: var(--text-muted); font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background var(--t-fast), color var(--t-fast);
    flex-shrink: 0;
  }
  .tb-close:hover { background: var(--red); color: #fff; }

  /* ── Navigation rapide (chapitres) ───────────────────────── */
  .chapter-bar {
    display: flex;
    gap: 1px;
    padding: 5px 10px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chapter-bar::-webkit-scrollbar { display: none; }

  .ch-btn {
    padding: 3px 9px;
    border-radius: 4px;
    border: none;
    background: none;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--t-fast), color var(--t-fast);
    font-family: var(--font-ui);
  }
  .ch-btn:hover  { background: var(--surface-3); color: var(--text); }
  .ch-btn.active { background: var(--accent-dim); color: var(--accent); }

  /* ── Layout deux colonnes ─────────────────────────────────── */
  .body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Sidebar TOC ──────────────────────────────────────────── */
  .sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 10px 0;
    background: var(--surface-2);
    scrollbar-width: thin;
    scrollbar-color: var(--surface-4) transparent;
  }
  .sidebar::-webkit-scrollbar { width: 4px; }
  .sidebar::-webkit-scrollbar-track { background: transparent; }
  .sidebar::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 2px; }

  .toc-section-label {
    padding: 10px 12px 4px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--text-muted);
  }
  .toc-section-label:first-child { padding-top: 4px; }

  .toc-link {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 12px;
    font-size: 11.5px;
    color: var(--text-dim);
    cursor: pointer;
    border-radius: 0;
    border-left: 2px solid transparent;
    transition: color var(--t-fast), background var(--t-fast), border-color var(--t-fast);
    line-height: 1.4;
    user-select: none;
  }
  .toc-link:hover { background: var(--surface-3); color: var(--text); }
  .toc-link.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-dim);
  }
  .toc-link.h3 {
    padding-left: 22px;
    font-size: 11px;
    color: var(--text-muted);
  }
  .toc-link.h3:hover { color: var(--text-dim); }
  .toc-link.h3.active { color: var(--accent); }

  /* Exercices dans le TOC */
  .toc-link.exercise {
    color: var(--amber);
    opacity: .7;
  }
  .toc-link.exercise:hover { opacity: 1; }
  .toc-link.exercise.active { border-left-color: var(--amber); background: var(--amber-dim); opacity: 1; }

  /* Zone de recherche vide */
  .toc-no-results {
    padding: 16px 12px;
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
  }

  /* ── Contenu ──────────────────────────────────────────────── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 36px;
    min-height: 0;
    font-size: 14.5px;
    line-height: 1.75;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-4) transparent;
  }
  .content::-webkit-scrollbar       { width: 5px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 3px; }

  .content h1 {
    font-size: 20px; font-weight: 800; color: var(--text);
    margin: 0 0 20px; padding-bottom: 10px;
    border-bottom: 2px solid var(--border);
  }
  .content h2 {
    font-size: 16px; font-weight: 700; color: var(--text);
    margin: 36px 0 10px; padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
    scroll-margin-top: 16px;
  }
  .content h3 {
    font-size: 12.5px; font-weight: 700; color: var(--accent);
    margin: 22px 0 8px;
    text-transform: uppercase; letter-spacing: .07em;
    scroll-margin-top: 16px;
  }
  /* Exercices en h3 */
  .content h3.exercise-heading {
    color: var(--amber);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .content h4 {
    font-size: 13px; font-weight: 600; color: var(--text);
    margin: 14px 0 5px;
  }
  .content p { color: var(--text); margin: 0 0 10px; }
  .content p:last-child { margin-bottom: 0; }
  .content strong { color: var(--text); font-weight: 600; }
  .content em     { color: var(--text); font-style: italic; }
  .content hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
  .content blockquote {
    margin: 12px 0; padding: 10px 16px;
    border-left: 3px solid var(--accent-dim);
    background: var(--surface-2); border-radius: 0 6px 6px 0;
    color: var(--text-dim); font-size: 13px;
  }
  .content blockquote strong { color: var(--accent); }
  .content code {
    font-family: var(--font-mono); font-size: 12.5px;
    background: var(--surface-3); color: var(--cyan);
    padding: 1px 5px; border-radius: 3px;
    border: 1px solid var(--border);
  }
  .content ul, .content ol {
    padding-left: 20px; margin: 6px 0;
    display: flex; flex-direction: column; gap: 4px;
  }
  .content li { font-size: 13.5px; line-height: 1.65; color: var(--text-dim); }

  /* Tables */
  .content table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
  .content th {
    text-align: left; font-weight: 700; font-size: 12px;
    text-transform: uppercase; letter-spacing: .06em;
    color: var(--text); padding: 7px 10px;
    border-bottom: 2px solid var(--border);
    background: var(--surface-2);
  }
  .content td {
    padding: 6px 10px; border-bottom: 1px solid var(--border);
    color: var(--text); font-size: 13px;
  }
  .content td strong { font-family: var(--font-ui); color: var(--text); }
  .content tr:last-child td { border-bottom: none; }
  .content tr:hover td { background: var(--surface-2); }

  /* Blocs de code */
  .code-block { 
    position: relative; 
    margin: 14px 0; 
    font-size: 15px; 
    line-height: 1.65;
    }
  .copy-btn {
    position: absolute; top: 8px; right: 8px;
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px;
    background: var(--surface-4); border: 1px solid var(--border);
    border-radius: 5px; font-size: 11px; font-weight: 600;
    color: var(--text); cursor: pointer;
    transition: background var(--t-fast), color var(--t-fast);
    font-family: var(--font-ui); z-index: 1;
  }
  .copy-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
  .copy-btn:hover  { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
  .copy-btn.copied { color: var(--green); border-color: var(--green); background: var(--green-dim); }

  .code-block pre {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent-dim);
    border-radius: 0 6px 6px 0;
    padding: 14px 16px;
    padding-right: 90px;
    overflow-x: auto; margin: 0;
    font-family: var(--font-mono);
    color: var(--text);
    white-space: pre;
  }

  /* Pas de bouton Copier, style plus discret */
  .content pre.pre-plain {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 16px;
    overflow-x: auto; margin: 14px 0;
    font-family: var(--font-mono);
    font-size: 14px; line-height: 1.6;
    color: var(--text-dim);
    white-space: pre;
  }

  /* Surlignage recherche */
  mark {
    background: var(--amber-dim);
    color: var(--amber);
    border-radius: 2px;
    padding: 0 1px;
  }

  /* Bandeau contextuel défi */
  .challenge-ctx {
    display: none;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--accent-dim);
    border-bottom: 1px solid rgba(124,106,247,.2);
    font-size: 11px;
    color: var(--accent);
    flex-shrink: 0;
  }
  .challenge-ctx.visible { display: flex; }
  .challenge-ctx strong  { font-weight: 700; }
  .challenge-ctx-close   {
    margin-left: auto;
    background: none; border: none;
    color: var(--accent); cursor: pointer; font-size: 13px; opacity: .7;
  }
  .challenge-ctx-close:hover { opacity: 1; }
`;

// ── Classe principale ─────────────────────────────────────────

export class ChuckHelpModal extends ChuckComponent {
  private _ready        = false;
  private _tocEntries: TocEntry[] = [];
  private _observer:   IntersectionObserver | null = null;
  private _activeId    = '';
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;
  private _ctxChallengeId: number | null = null;

  // ── Rendu initial ─────────────────────────────────────────

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>

      <!-- Titlebar -->
      <div class="titlebar" id="titlebar">
        <span class="tb-icon">📖</span>
        <span class="tb-title">Documentation - Chuck IDE</span>

        <div class="search-wrap">
          <span class="search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input id="search-input" type="text" placeholder="Rechercher…" autocomplete="off" spellcheck="false">
        </div>
        <span class="search-count" id="search-count"></span>

        <button class="tb-close" id="close-btn" title="Fermer (Échap)">✕</button>
      </div>

      <!-- Bandeau contextuel défi -->
      <div class="challenge-ctx" id="challenge-ctx">
        <span>📍</span>
        <span id="challenge-ctx-text"></span>
        <button class="challenge-ctx-close" id="challenge-ctx-close">✕</button>
      </div>

      <!-- Navigation chapitres rapide -->
      <nav class="chapter-bar" id="chapter-bar">
        ${CHAPTERS.map((c, i) =>
          `<button class="ch-btn${i === 0 ? ' active' : ''}" data-idx="${i}">${c.label}</button>`
        ).join('')}
      </nav>

      <!-- Body : sidebar + contenu -->
      <div class="body">
        <nav class="sidebar" id="sidebar">
          <div class="toc-no-results" id="toc-loading" style="display:block">Chargement…</div>
        </nav>
        <div class="content" id="content"></div>
      </div>`;
  }

  // ── Setup ─────────────────────────────────────────────────

  protected setup(): void {
    this._loadMd();

    // Fermeture
    this.shadow.getElementById('close-btn')!
      .addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.classList.contains('open')) this.close();
    });

    // Navigation chapitres rapide
    this.shadow.getElementById('chapter-bar')!
      .addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.ch-btn');
        if (!btn) return;
        const idx = Number(btn.dataset['idx']);
        this._jumpToChapter(idx);
        this._setActiveChapterBtn(idx);
      });

    // Clic dans le TOC sidebar
    this.shadow.getElementById('sidebar')!
      .addEventListener('click', e => {
        const link = (e.target as HTMLElement).closest<HTMLElement>('.toc-link');
        if (!link) return;
        const id = link.dataset['id'] ?? '';
        this._scrollToId(id);
      });

    // Boutons Copier
    this.shadow.getElementById('content')!
      .addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.copy-btn');
        if (!btn) return;
        this._handleCopy(btn);
      });

    // Recherche
    this.shadow.getElementById('search-input')!
      .addEventListener('input', () => {
        if (this._searchTimer) clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this._doSearch(), 180);
      });

    // Bandeau contextuel — fermeture
    this.shadow.getElementById('challenge-ctx-close')!
      .addEventListener('click', () => {
        this._ctxChallengeId = null;
        this.shadow.getElementById('challenge-ctx')!.classList.remove('visible');
      });

    // Bus
    this.sub('chuck:open-help' as any, ({ lessonId }: { lessonId?: number }) => {
      this.open(lessonId);
    });

    // Quand un défi est chargé, mémoriser le contexte pour le bandeau
    this.sub('chuck:challenge-loaded' as any, ({ challenge }: { challenge: { id: number; title: string } }) => {
      this._ctxChallengeId = challenge.id;
    });

    // Draggable
    this._makeDraggable(
      this.shadow.getElementById('titlebar')!,
      this as unknown as HTMLElement,
    );
  }

  // ── API publique ─────────────────────────────────────────

  open(lessonId?: number): void {
    this.classList.add('open');
    if (lessonId !== undefined && this._ready) {
      this._scrollToLesson(lessonId);
    }
    // Afficher le bandeau défi si pertinent
    if (this._ctxChallengeId !== null) {
      this._showChallengeCtx(this._ctxChallengeId);
    }
  }

  close():  void { this.classList.remove('open'); }
  toggle(): void {
    if (this.classList.contains('open')) this.close();
    else this.open();
  }

  // ── Chargement Markdown ───────────────────────────────────

  private async _loadMd(): Promise<void> {
    try {
      const res  = await fetch('/docs.md');
      const text = await res.text();
      const html = renderDocs(text);

      const content = this.shadow.getElementById('content')!;
      content.innerHTML = html;

      // Assigner des IDs stables aux titres
      this._assignIds(content);

      // Construire le TOC
      this._buildToc(content);

      // IntersectionObserver pour suivre la position
      this._setupObserver(content);

      this._ready = true;

      // Masquer le loading
      const loading = this.shadow.getElementById('toc-loading');
      if (loading) loading.style.display = 'none';

      // Appliquer le style exercices aux h3 correspondants
      content.querySelectorAll('h3').forEach(el => {
        if (el.textContent?.includes('📝 Exercice')) {
          el.classList.add('exercise-heading');
        }
      });

    } catch {
      this.shadow.getElementById('content')!.innerHTML =
        `<p style="color:var(--red);padding:20px">Erreur de chargement de la documentation.</p>`;
    }
  }

  // ── IDs stables sur les titres ────────────────────────────

  private _assignIds(content: HTMLElement): void {
    let idx = 0;
    content.querySelectorAll('h1,h2,h3,h4').forEach(el => {
      (el as HTMLElement).id = `sec-${idx++}`;
    });
  }

  // ── Construction du TOC ───────────────────────────────────

  private _buildToc(content: HTMLElement): void {
    const entries: TocEntry[] = [];
    content.querySelectorAll('h2,h3').forEach(el => {
      const level = el.tagName === 'H2' ? 1 : 2;
      const text  = el.textContent ?? '';
      const isExercise = text.includes('📝 Exercice');
      entries.push({ id: (el as HTMLElement).id, level, text, isExercise });
    });
    this._tocEntries = entries;
    this._renderToc(entries);
  }

  private _renderToc(entries: TocEntry[]): void {
    const sidebar = this.shadow.getElementById('sidebar')!;
    if (entries.length === 0) {
      sidebar.innerHTML = '<div class="toc-no-results">Aucun résultat</div>';
      return;
    }

    let html = '';
    let currentChapter = '';

    for (const e of entries) {
      if (e.level === 1) {
        // H2 → potentiellement nouveau chapitre
        const chLabel = this._chapterLabel(e.text);
        if (chLabel !== currentChapter) {
          currentChapter = chLabel;
          html += `<div class="toc-section-label">${chLabel}</div>`;
        }
        html += `<div class="toc-link h2${e.isExercise ? ' exercise' : ''}" data-id="${e.id}">
          ${this._tocText(e.text, e.level)}
        </div>`;
      } else {
        html += `<div class="toc-link h3${e.isExercise ? ' exercise' : ''}" data-id="${e.id}">
          ${this._tocText(e.text, e.level)}
        </div>`;
      }
    }

    sidebar.innerHTML = html;
  }

  // Extrait un label de chapitre depuis le texte d'un h2
  private _chapterLabel(text: string): string {
    const m = text.match(/^(Chapitre\s+\d+|Annexe\s+[A-Z]|Avant de commencer)/i);
    if (m) return m[0];
    return text.slice(0, 30);
  }

  // Texte à afficher dans le TOC (tronqué si trop long)
  private _tocText(text: string, level: number): string {
    const max   = level === 1 ? 40 : 36;
    const clean = text.replace(/^#+\s*/, '').trim();
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
  }

  // ── IntersectionObserver ─────────────────────────────────

  private _setupObserver(content: HTMLElement): void {
    if (this._observer) this._observer.disconnect();

    this._observer = new IntersectionObserver(
      entries => {
        // Premier heading visible → activer dans le TOC
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._setActiveToc((entry.target as HTMLElement).id);
            break;
          }
        }
      },
      { root: content, rootMargin: '0px 0px -60% 0px', threshold: 0 }
    );

    content.querySelectorAll('h2,h3').forEach(h => this._observer!.observe(h));
  }

  private _setActiveToc(id: string): void {
    if (id === this._activeId) return;
    this._activeId = id;

    const sidebar = this.shadow.getElementById('sidebar')!;
    sidebar.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));

    const active = sidebar.querySelector<HTMLElement>(`.toc-link[data-id="${id}"]`);
    if (active) {
      active.classList.add('active');
      // Auto-scroll du TOC pour garder le lien visible
      active.scrollIntoView({ block: 'nearest' });

      // Mettre à jour le bouton chapitre actif
      this._syncChapterBar(id);
    }
  }

  // Met à jour le bouton de la chapter-bar selon le heading visible
  private _syncChapterBar(id: string): void {
    const sidebar = this.shadow.getElementById('sidebar')!;
    const link    = sidebar.querySelector<HTMLElement>(`.toc-link[data-id="${id}"]`);
    if (!link) return;

    const label = link.textContent?.trim() ?? '';
    const idx   = CHAPTERS.findIndex(c => c.match.test(label));
    if (idx >= 0) this._setActiveChapterBtn(idx);
  }

  // ── Navigation ───────────────────────────────────────────

  private _scrollToId(id: string): void {
    const el = this.shadow.getElementById('content')!
      .querySelector<HTMLElement>(`#${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _jumpToChapter(idx: number): void {
    const pattern = CHAPTERS[idx]?.match;
    if (!pattern) return;

    const content = this.shadow.getElementById('content')!;
    const headings = Array.from(content.querySelectorAll<HTMLElement>('h2'));
    const target   = headings.find(h => pattern.test(h.textContent ?? ''));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _setActiveChapterBtn(idx: number): void {
    this.shadow.getElementById('chapter-bar')!
      .querySelectorAll('.ch-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
  }

  // ── Map lessonId → heading de chapitre ───────────────────

  private _scrollToLesson(lessonId: number): void {
    // Les IDs de leçon 100+ correspondent aux chapitres
    const chapterIdx: Record<number, number> = {
      100: 0,  // Intro / Avant de commencer
      101: 1, 102: 1, 103: 1,                           // Chap 0
      104: 2, 105: 2, 106: 2, 107: 2,                  // Chap 1
      108: 3, 109: 3, 110: 3, 111: 3, 112: 3,          // Chap 2
      113: 4, 114: 4,                                    // Chap 3
      115: 5, 116: 5, 117: 5,                            // Chap 4
      118: 6, 119: 6, 120: 6,                            // Chap 5
      121: 7, 122: 7,                                    // Chap 6
      123: 8,                                            // Chap 7
      124: 9,                                            // Chap 8
      125: 10,                                           // Chap 9
      126: 11, 127: 11,                                  // Chap 10
      128: 12, 129: 12, 130: 12,                         // Annexes
    };
    const idx = chapterIdx[lessonId];
    if (idx !== undefined) {
      this._jumpToChapter(idx);
      this._setActiveChapterBtn(idx);
    }
  }

  // ── Bandeau contextuel défi ───────────────────────────────

  private _showChallengeCtx(challengeId: number): void {
    const ctx  = this.shadow.getElementById('challenge-ctx')!;
    const text = this.shadow.getElementById('challenge-ctx-text')!;
    text.innerHTML = `Tu consultes la formation depuis le <strong>défi ${challengeId}</strong>`;
    ctx.classList.add('visible');
  }

  // ── Recherche ─────────────────────────────────────────────

  private _doSearch(): void {
    const q = (this.shadow.getElementById('search-input') as HTMLInputElement)
      .value.trim().toLowerCase();
    const countEl = this.shadow.getElementById('search-count')!;

    // Effacer les anciens marquages
    const content = this.shadow.getElementById('content')!;
    this._clearMarks(content);

    if (!q) {
      countEl.textContent = '';
      // Restaurer le TOC complet
      this._renderToc(this._tocEntries);
      return;
    }

    // Filtrer le TOC
    const filtered = this._tocEntries.filter(e =>
      e.text.toLowerCase().includes(q)
    );
    this._renderToc(filtered);

    // Surligner dans le contenu
    const count = this._highlightText(content, q);
    countEl.textContent = count > 0 ? `${count} résultat${count > 1 ? 's' : ''}` : 'Aucun résultat';

    // Scroller vers le premier résultat
    const firstMark = content.querySelector('mark');
    if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private _clearMarks(root: HTMLElement): void {
    root.querySelectorAll('mark').forEach(m => {
      const text = document.createTextNode(m.textContent ?? '');
      m.replaceWith(text);
    });
    // Normaliser pour fusionner les text nodes adjacents
    root.normalize();
  }

  private _highlightText(root: HTMLElement, q: string): number {
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement?.tagName ?? '';
        // Ne pas toucher aux attributs, code dans les pre, boutons
        if (['SCRIPT','STYLE','BUTTON'].includes(parent)) return NodeFilter.FILTER_REJECT;
        if (node.textContent?.toLowerCase().includes(q)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      }
    });

    const nodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) nodes.push(node);

    for (const textNode of nodes) {
      const text  = textNode.textContent ?? '';
      const lower = text.toLowerCase();
      let last = 0;
      const frag = document.createDocumentFragment();

      let i = lower.indexOf(q);
      while (i !== -1) {
        frag.append(document.createTextNode(text.slice(last, i)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(i, i + q.length);
        frag.append(mark);
        last = i + q.length;
        count++;
        i = lower.indexOf(q, last);
      }
      frag.append(document.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
    }

    return count;
  }

  // ── Copier un bloc de code ────────────────────────────────

  private _handleCopy(btn: HTMLElement): void {
    const b64  = btn.dataset['code'] ?? '';
    let text   = decodeURIComponent(escape(atob(b64)));

    const comment   = `; ══════════════════════════════════════════════════\n;  CHUCK-8 — Exemple de la formation\n; ══════════════════════════════════════════════════\n\n`;
    const directive = '.org $E000\n\n';
    if (!text.includes('.org $E000') && !text.includes('.org $e000')) {
      text = comment + directive + text;
    }

    navigator.clipboard.writeText(text).catch(() => {});
    const editor = document.getElementById('editor') as
      (HTMLElement & { setSource?(s: string): void }) | null;
    if (editor?.setSource) editor.setSource(text);

    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg> Copié !`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg> Copier`;
    }, 2000);
  }

  // ── Draggable ─────────────────────────────────────────────

  private _makeDraggable(handle: HTMLElement, target: HTMLElement): void {
    let ox = 0, oy = 0;
    handle.addEventListener('mousedown', e => {
      // Ne pas dragger si on clique sur la recherche ou le bouton fermer
      if ((e.target as HTMLElement).closest('input,button')) return;
      e.preventDefault();
      const r = target.getBoundingClientRect();
      target.style.left = `${r.left}px`;
      target.style.top  = `${r.top}px`;
      target.style.transform = 'none';
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      const move = (ev: MouseEvent) => {
        target.style.left = `${ev.clientX - ox}px`;
        target.style.top  = `${ev.clientY - oy}px`;
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  // ── Teardown ──────────────────────────────────────────────

  protected teardown(): void {
    this._observer?.disconnect();
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }
}

customElements.define('chuck-help-modal', ChuckHelpModal);