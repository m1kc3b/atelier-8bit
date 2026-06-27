/* components/side-panel/side-panel.styles.ts — styles Shadow DOM du panneau latéral. */

export const STYLES = /* css */ `
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
  .all-validated {
    padding: 11px 14px; border-radius: 8px; text-align: center;
    background: var(--green-dim); border: 1px solid rgba(61,214,140,.3);
    color: var(--green); font-weight: 700; font-size: 13px;
  }
  ::-webkit-scrollbar       { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--surface-4);border-radius:3px; }
  @keyframes pulse-success { 0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)} }
  .nav-btn.success { animation:pulse-success 0.5s ease-out; }

  /* ── Mode « Défi du mois » : panneau scindé en deux ───────────── */
  .defi { display:flex; flex-direction:column; height:100%; min-height:0; }
  .defi-section { display:flex; flex-direction:column; min-height:0; }
  /* Haut : classement (hauteur bornée, défile) */
  .defi-rank { flex:0 1 42%; border-bottom:1px solid var(--border); }
  /* Bas : instructions (défile) + zone soumettre (fixe) */
  .defi-brief { flex:1 1 58%; }
  .defi-section-head {
    height:30px; display:flex; align-items:center; gap:6px; padding:0 12px;
    background:var(--surface-2); border-bottom:1px solid var(--border); flex-shrink:0;
    font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;
    color:var(--text-muted);
  }
  .defi-section-body { flex:1; overflow-y:auto; min-height:0; }
  .defi-empty {
    height:100%; min-height:120px; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:6px; padding:20px 18px; text-align:center;
  }
  .defi-empty .defi-empty-icon { font-size:22px; opacity:.5; }
  .defi-empty .defi-empty-title { font-size:12.5px; font-weight:600; color:var(--text-dim); }
  .defi-empty .defi-empty-hint { font-size:11px; color:var(--text-muted); line-height:1.5; }
  .defi-submit-zone {
    padding:12px 16px; border-top:1px solid var(--border);
    display:flex; flex-direction:column; gap:7px; flex-shrink:0;
  }
  .defi-submit-note { font-size:10.5px; color:var(--text-muted); line-height:1.45; text-align:center; }
  .defi-submit-btn {
    display:flex; align-items:center; justify-content:center; gap:8px;
    padding:11px 14px; background:var(--mode-defi, var(--amber)); color:#1a1206;
    font-weight:700; font-size:13px; font-family:var(--font-ui);
    border:none; border-radius:8px; cursor:pointer;
    transition:opacity .12s, transform .08s; width:100%;
  }
  .defi-submit-btn:hover:not(:disabled) { opacity:.88; }
  .defi-submit-btn:active:not(:disabled) { transform:scale(.98); }
  .defi-submit-btn:disabled { opacity:.35; cursor:not-allowed; transform:none; }
`;
