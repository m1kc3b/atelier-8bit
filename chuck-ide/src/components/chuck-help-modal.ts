/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-help-modal.ts
   Modale de formation : layout deux colonnes (sidebar TOC + contenu).
   TOC généré automatiquement depuis les h1/h2/h3 du Markdown.
   Recherche plein-texte. IntersectionObserver pour suivi de position.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from '../core/base-component.js';
import { renderDocs } from '../core/markdown.js';
import { STYLES } from './help-modal/help-modal.styles.js';

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