/* components/editor/editor.styles.ts — styles Shadow DOM de l'éditeur. */

export const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  /* ── Tab bar ─────────────────────────────────────────────── */
  .tab-bar {
    height: 34px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 16px;
    height: 100%;
    font-size: 12px;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    cursor: default;
    user-select: none;
    position: relative;
  }
  .tab.active { color: var(--text); background: var(--bg); }
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 1px;
    background: var(--mode-color);
  }
  .tab-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--mode-color); opacity: .7; }

  .tab-export {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: 3px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-ui);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .tab-export:hover { background: var(--surface-3); color: var(--text); }

  /* ── CodeMirror host ─────────────────────────────────────── */
  #cm-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  #cm-host .cm-editor {
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  /* ── Console ─────────────────────────────────────────────── */
  .console-strip {
    height: var(--console-h);
    min-height: 60px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .console-header {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .console-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--text-muted);
  }
  .console-clear {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-muted);
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    background: none;
    border: none;
    font-family: var(--font-ui);
    transition: background var(--t-fast), color var(--t-fast);
  }
  .console-clear:hover { background: var(--surface-3); color: var(--text); }
  .console-output {
    flex: 1;
    overflow-y: auto;
    padding: 6px 14px 8px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.6;
  }
  .log      { display: block; }
  .log-ok   { color: var(--green); }
  .log-err  { color: var(--red); }
  .log-info { color: var(--cyan); }
  .log-hex  { color: var(--amber); }
  .log-dim  { color: var(--text-muted); }
  /* Message de lancement d'un mode : la couleur (du mode actif) est FIGÉE
     inline au moment de l'écriture par _log() — voir chuck-editor _log().
     Pas de color ici : éviterait que tous les anciens messages se recolorent. */
  .log-mode { font-weight: 700; }

  .tab-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  }

  ::-webkit-scrollbar       { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface-4); border-radius: 3px; }
`;
