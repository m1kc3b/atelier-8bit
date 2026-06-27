/* components/help-modal/help-modal.styles.ts — styles Shadow DOM de la doc. */

export const STYLES = /* css */`
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
