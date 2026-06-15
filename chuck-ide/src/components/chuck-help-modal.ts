/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-help-modal.ts
   Modale d'aide : affiche formation.md en Markdown.
   Draggable, redimensionnable, ouverte via chuck:open-help.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from '../core/base-component.js';

// ── Rendu Markdown ─────────────────────────────────────────────
function renderMd(raw: string): string {
  // 1. Extraire les blocs de code AVANT tout traitement
  //    → placeholders \x00CODEn\x00 pour éviter double-transformation
  const codeBlocks: string[] = [];
  let s = raw.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const escaped = code.trimEnd()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const idx = codeBlocks.length;
    codeBlocks.push(escaped);
    return `\x00CODE${idx}\x00`;
  });

  // 2. Échapper le reste du HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Code inline (ne touchera plus les blocs <pre>)
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 4. Titres
  s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  s = s.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

  // 5. Séparateur
  s = s.replace(/^---$/gm, '<hr>');

  // 6. Blockquote
  s = s.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 7. Gras / italique
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,         '<em>$1</em>');

  // 8. Tableaux
  s = s.replace(
    /(\|.+\|\n)((?:\|[-:| ]+\|\n))((?:\|.+\|\n?)*)/g,
    (_, head, _sep, body) => {
      const parseRow = (r: string) =>
        r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headers = parseRow(head);
      const rows    = body.trim().split('\n').filter(Boolean).map(parseRow);
      const th = headers.map((h: string) => `<th>${h}</th>`).join('');
      const tr = rows.map((row: string[]) =>
        `<tr>${row.map((c: string) => `<td>${c}</td>`).join('')}</tr>`
      ).join('');
      return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
    }
  );

  // 9. Listes
  s = s.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  s = s.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`);
  s = s.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // 10. Paragraphes
  s = s.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^(\x00CODE|\<(h[1-6]|ul|ol|li|hr|table|blockquote))/.test(block)) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 11. Réinjecter les blocs de code avec bouton Copier
  s = s.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    const code = codeBlocks[Number(i)] ?? '';
    // Encoder le texte brut en base64 pour l'attribut data-code
    const plain = code
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const b64 = btoa(unescape(encodeURIComponent(plain)));
    return `<div class="code-block">
      <button class="copy-btn" data-code="${b64}" title="Copier dans l'éditeur">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copier
      </button>
      <pre>${code}</pre>
    </div>`;
  });

  return s;
}

// ── Styles ────────────────────────────────────────────────────
const STYLES = /* css */`
  @import '/src/styles/tokens.css';

  :host {
    position: fixed;
    z-index: 8000;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    width: min(1000px, 90vw);
    height: min(800px, 80vh);
    min-width: 340px;
    min-height: 240px;
    background: var(--surface-4);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 24px 64px rgba(0,0,0,.55);
    display: none;
    flex-direction: column;
    overflow: hidden;
    resize: both;
    font-family: var(--font-ui);
  }

  :host(.open) { display: flex; }

  .titlebar {
    height: 36px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    cursor: grab;
    flex-shrink: 0;
    user-select: none;
  }
  .titlebar:active { cursor: grabbing; }
  .tb-icon  { font-size: 15px; }
  .tb-title {
    font-size: 12px; font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase; letter-spacing: .07em;
    flex: 1;
  }
  .tb-close {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--surface-3);
    border: none; cursor: pointer;
    color: var(--text-muted); font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background var(--t-fast);
  }
  .tb-close:hover { background: var(--red); color: #fff; }

  .toc-bar {
    display: flex; gap: 2px;
    padding: 6px 12px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0; flex-wrap: wrap;
  }
  .toc-btn {
    padding: 3px 10px; border-radius: 4px;
    border: none; background: none;
    font-size: 11px; font-weight: 600;
    color: var(--text-muted); cursor: pointer;
    transition: background var(--t-fast), color var(--t-fast);
    white-space: nowrap;
  }
  .toc-btn:hover  { background: var(--surface-3); color: var(--text); }
  .toc-btn.active { background: var(--accent-dim); color: var(--accent); }

  .content {
    flex: 1; overflow-y: auto;
    padding: 24px 32px; min-height: 0;
    font-size: 15px; line-height: 1.75;
  }
  .content h1 {
    font-size: 22px; font-weight: 800; color: var(--text);
    margin: 0 0 16px; padding-bottom: 8px;
    border-bottom: 2px solid var(--border);
  }
  .content h2 {
    font-size: 17px; font-weight: 700; color: var(--text);
    margin: 28px 0 10px; padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }
  .content h3 {
    font-size: 13px; font-weight: 700; color: var(--accent);
    margin: 18px 0 6px;
    text-transform: uppercase; letter-spacing: .06em;
  }
  .content h4 {
    font-size: 13px; font-weight: 600; color: var(--text-dim);
    margin: 12px 0 4px;
  }
  .content p { color: var(--text); margin: 0 0 10px; }
  .content p:last-child { margin-bottom: 0; }
  .content strong { color: var(--text); font-weight: 600; }
  .content em     { color: var(--text-dim); font-style: italic; }
  .content hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
  .content blockquote {
    margin: 10px 0; padding: 8px 14px;
    border-left: 3px solid var(--cyan-dim);
    background: var(--surface-3); border-radius: 0 5px 5px 0;
    color: var(--text-dim); font-size: 13px; font-style: italic;
  }
  .content code {
    font-family: var(--font-mono); font-size: 13px;
    background: var(--surface-3); color: var(--text);
    padding: 1px 5px; border-radius: 3px;
    border: 2px solid var(--cyan-dim);
  }

  /* Bloc de code avec bouton Copier */
  .code-block {
    position: relative;
    margin: 12px 0;
  }
  .copy-btn {
    position: absolute;
    top: 8px; right: 8px;
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px;
    background: var(--surface-4);
    border: 1px solid var(--border);
    border-radius: 5px;
    font-size: 11px; font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: background var(--t-fast), color var(--t-fast);
    font-family: var(--font-ui);
    z-index: 1;
  }
  .copy-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
  .copy-btn:hover { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
  .copy-btn.copied { color: var(--green); border-color: var(--green); background: var(--green-dim); }

  .content pre {
    background: var(--surface-3);
    border: 2px solid var(--cyan-dim);
    border-radius: 6px;
    padding: 14px 16px;
    padding-right: 80px; /* espace pour le bouton */
    overflow-x: auto;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 14px; line-height: 1.65;
    color: var(--cyan); /* couleur uniforme pour tout le code */
    white-space: pre;
  }

  .content ul, .content ol {
    padding-left: 20px; margin: 6px 0;
    display: flex; flex-direction: column; gap: 3px;
  }
  .content li { font-size: 13.5px; line-height: 1.65; color: var(--text-dim); }
  .content table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0; }
  .content th {
    text-align: left; font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: .06em;
    color: var(--text-muted); padding: 6px 10px;
    border-bottom: 2px solid var(--border);
  }
  .content td {
    padding: 5px 10px; border-bottom: 1px solid var(--border);
    color: var(--text-dim); font-family: var(--font-mono); font-size: 12px;
  }
  .content tr:last-child td { border-bottom: none; }

  .content::-webkit-scrollbar       { width: 5px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 3px; }
`;

const CHAPTERS = [
  { label: '📖 Intro',         keyword: 'chuck-8' },
  { label: '1 · La Machine',   keyword: 'chapitre-1' },
  { label: '2 · Le Langage',   keyword: 'chapitre-2' },
  { label: '3 · Le Système',   keyword: 'chapitre-3' },
  { label: '4 · Les Patterns', keyword: 'chapitre-4' },
  { label: '5 · Les Projets',  keyword: 'chapitre-5' },
  { label: '⚡ Référence',     keyword: 'annexe' },
];

export class ChuckHelpModal extends ChuckComponent {
  private _ready = false;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="titlebar" id="titlebar">
        <span class="tb-icon">?</span>
        <span class="tb-title">Formation — Manuel Chuck-8</span>
        <button class="tb-close" id="close-btn" title="Fermer">✕</button>
      </div>
      <nav class="toc-bar" id="toc-bar">
        ${CHAPTERS.map((c, i) =>
          `<button class="toc-btn${i === 0 ? ' active' : ''}"
                   data-keyword="${c.keyword}">${c.label}</button>`
        ).join('')}
      </nav>
      <div class="content" id="content">
        <p style="color:var(--text-muted);font-style:italic">Chargement…</p>
      </div>`;
  }

  protected setup(): void {
    this._loadMd();

    this.shadow.getElementById('close-btn')!
      .addEventListener('click', () => this.close());

    this.shadow.getElementById('toc-bar')!
      .addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.toc-btn') as HTMLElement | null;
        if (!btn) return;
        this._scrollToKeyword(btn.dataset['keyword'] ?? '');
        this.shadow.querySelectorAll('.toc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });

    // Délégation : boutons Copier dans le contenu
    this.shadow.getElementById('content')!
      .addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.copy-btn') as HTMLElement | null;
        if (!btn) return;
        const b64  = btn.dataset['code'] ?? '';
        let text = decodeURIComponent(escape(atob(b64)));

        // Vérification et ajout de ".org $E000" au début si absent
        const comment = `; ══════════════════════════════════════════════════\n;  CHUCK-8 COMPUTER\n;  Ce code copié/coller depuis Formation\n; ══════════════════════════════════════════════════\n\n`;
        const directive = '.org $E000\n\n\n';
        if (!text.includes('.org $E000')) {
          text = comment + directive + text;
        }

        // Copier dans le presse-papier ET dans l'éditeur
        navigator.clipboard.writeText(text).catch(() => {});
        // Tenter d'injecter dans l'éditeur Chuck-IDE
        const editor = document.getElementById('editor') as
          (HTMLElement & { setSource?(s: string): void }) | null;
        if (editor?.setSource) editor.setSource(text);
        // Feedback visuel
        btn.classList.add('copied');
        btn.textContent = '✓ Copié';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg> Copier`;
        }, 2000);
      });

    this._makeDraggable(
      this.shadow.getElementById('titlebar')!,
      this as unknown as HTMLElement,
    );

    this.sub('chuck:open-help' as any, ({ lessonId }: { lessonId?: number }) => {
      this.open(lessonId);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open')) this.close();
    });
  }

  open(lessonId?: number): void {
    this.classList.add('open');
    if (lessonId !== undefined && this._ready)
      this._scrollToLesson(lessonId);
  }

  close():  void { this.classList.remove('open'); }
  toggle(): void {
    if (this.classList.contains('open')) this.close();
    else this.open();
  }

  private async _loadMd(): Promise<void> {
    try {
      const res  = await fetch('/formation.md');
      const text = await res.text();
      const html = renderMd(text);
      const content = this.shadow.getElementById('content')!;
      content.innerHTML = html;
      // Poser les id sur les titres pour la navigation
      content.querySelectorAll('h1,h2,h3').forEach(el => {
        const slug = el.textContent!
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        (el as HTMLElement).id = slug;
      });
      this._ready = true;
    } catch {
      this.shadow.getElementById('content')!.innerHTML =
        `<p style="color:var(--red)">Erreur de chargement de la formation.</p>`;
    }
  }

  private _scrollToKeyword(keyword: string): void {
    const content = this.shadow.getElementById('content')!;
    const el = Array.from(content.querySelectorAll('h1,h2,h3,h4'))
      .find(h => (h as HTMLElement).id.includes(keyword)) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _scrollToLesson(lessonId: number): void {
    const map: Record<number, string> = {
      100: 'chuck-8',
      101: 'chapitre-1', 102: 'chapitre-1', 103: 'chapitre-1',
      104: 'chapitre-1', 105: 'chapitre-1', 106: 'chapitre-1', 107: 'chapitre-1',
      108: 'chapitre-2', 109: 'chapitre-2', 110: 'chapitre-2',
      111: 'chapitre-2', 112: 'chapitre-2', 113: 'chapitre-2', 114: 'chapitre-2',
      115: 'chapitre-3', 116: 'chapitre-3', 117: 'chapitre-3',
      118: 'chapitre-3', 119: 'chapitre-3', 120: 'chapitre-3', 121: 'chapitre-3',
      122: 'chapitre-4', 123: 'chapitre-4', 124: 'chapitre-4',
      125: 'chapitre-4', 126: 'chapitre-4',
      127: 'chapitre-5', 128: 'chapitre-5', 129: 'chapitre-5',
      130: 'annexe',
    };
    const kw = map[lessonId];
    if (kw) this._scrollToKeyword(kw);
  }

  private _makeDraggable(handle: HTMLElement, target: HTMLElement): void {
    let ox = 0, oy = 0;
    handle.addEventListener('mousedown', (e) => {
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
}

customElements.define('chuck-help-modal', ChuckHelpModal);