import { ChuckComponent } from '../core/base-component.js';
import { authService } from '../core/auth/auth-service.js';
import { storage } from '../core/storage/storage-service.js';
import { challengesService } from '../core/challenges/challenges-service.js';

type View = 'choice' | 'list';

interface ChallengeRow {
  id: number;
  title: string;
  locked: boolean;
}

export class ChuckWelcomeModal extends ChuckComponent {
  private _challenges: ChallengeRow[] = [];

  protected render(): void {
    this.shadow.innerHTML = `<style>@import '/src/styles/tokens.css';
      :host { position:fixed; inset:0; z-index:9500; display:none;
              align-items:center; justify-content:center;
              background:rgba(0,0,0,.8); font-family:var(--font-ui); }
      :host(.open) { display:flex; }
      .modal { position:relative; width:min(1100px, 94vw); height:min(760px, 92vh);
               background:var(--surface); border:1px solid var(--border);
               border-radius:18px; display:flex; flex-direction:column;
               overflow:hidden; box-shadow:var(--modal-shadow); }
      .topbar { display:flex; align-items:center; gap:10px; padding:16px 22px;
                border-bottom:1px solid var(--border); flex-shrink:0; }
      .topbar-logo { flex:1; text-align:center; font-family:var(--font-mono);
                     font-size:13px; font-weight:700; color:var(--accent); letter-spacing:.06em; }
      .back-btn, .close-btn { width:26px; height:26px; border-radius:50%;
                               background:var(--surface-3); border:none; color:var(--text-muted);
                               cursor:pointer; display:flex; align-items:center; justify-content:center;
                               font-size:13px; flex-shrink:0; transition:background var(--t-fast), color var(--t-fast); }
      .back-btn { display:none; }
      .back-btn.visible { display:flex; }
      .back-btn:hover { color:var(--text); }
      .close-btn:hover { background:var(--red); color:#fff; }
      #body { flex:1; overflow-y:auto; }

      /* ── Vue choix ─────────────────────────────────────── */
      .hero { text-align:center; padding:44px 40px 8px; }
      .hero-badge { display:inline-flex; align-items:center; gap:6px; font-size:11px;
                    font-weight:700; text-transform:uppercase; letter-spacing:.1em;
                    color:var(--accent); background:var(--accent-dim); padding:5px 12px;
                    border-radius:20px; margin-bottom:18px; }
      .hero h1 { font-size:30px; font-weight:800; color:var(--text); margin:0 0 14px; line-height:1.25; }
      .hero p { font-size:15px; color:var(--text); line-height:1.65; max-width:560px; margin:0 auto 34px; }
      .cta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:0 40px; margin-bottom:34px; }
      .cta-grid.two-cols { grid-template-columns:repeat(2,1fr); max-width:600px; margin:0 auto 34px; }
      .cta-card { display:flex; flex-direction:column; align-items:flex-start; gap:9px;
                  padding:22px 18px; background:var(--surface-3); border:1px solid var(--border);
                  border-radius:14px; cursor:pointer; text-align:left;
                  transition:border-color var(--t-fast), background var(--t-fast), transform .12s; }
      .cta-card:hover { border-color:var(--accent); background:var(--accent-dim); transform:translateY(-2px); }
      .cta-icon { font-size:24px; }
      .cta-card strong { font-size:13.5px; color:var(--text); }
      .cta-card span { font-size:11.5px; color:var(--text-muted); line-height:1.55; }
      .cta-arrow { margin-top:4px; font-size:11.5px; color:var(--accent); opacity:0; transition:opacity var(--t-fast); }
      .cta-card:hover .cta-arrow { opacity:1; }
      .choice-view { display:flex; flex-direction:column; min-height:100%; }
      .stats-strip { margin-top:auto; display:flex; justify-content:center; gap:26px; padding:18px 40px 8px;
               border-top:1px solid var(--border); font-size:11px; color:var(--text-muted); flex-wrap:wrap; }
      .stats-strip strong { color:var(--text-dim); font-weight:700; }

      /* ── Vue liste ─────────────────────────────────────── */
      .list-header { padding:26px 36px 16px; }
      .list-header h2 { font-size:19px; color:var(--text); margin-bottom:10px; }
      .progress-bar { height:6px; background:var(--surface-3); border-radius:4px; overflow:hidden; }
      .progress-fill { height:100%; background:var(--accent); border-radius:4px; }
      .progress-label { font-size:11px; color:var(--text-dim); margin-top:6px; }
      .challenge-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr));
                         gap:10px; padding:0 36px 36px; }
      .challenge-card { display:flex; align-items:center; gap:10px; padding:13px 14px;
                         background:var(--surface-3); border:1px solid var(--border); border-radius:10px;
                         cursor:pointer; transition:border-color var(--t-fast), background var(--t-fast); }
      .challenge-card:hover { border-color:var(--accent); background:var(--accent-dim); }
      .challenge-card.locked { opacity:.45; }
      .challenge-icon { font-size:16px; width:22px; text-align:center; flex-shrink:0; }
      .challenge-card-text { flex:1; min-width:0; }
      .challenge-card-title { font-size:12.5px; color:var(--text); white-space:nowrap;
                               overflow:hidden; text-overflow:ellipsis; }
      .challenge-card-id { font-size:10px; color:var(--text-muted); }

      @media (max-width: 640px) {
        .cta-grid, .cta-grid.two-cols { grid-template-columns:1fr; max-width:none; }
        .hero h1 { font-size:24px; }
        .hero { padding:32px 24px 8px; }
      }
    </style>
    <div class="modal">
      <div class="topbar">
        <button class="back-btn" id="back-btn" title="Retour">←</button>
        <span class="topbar-logo">👾 CHUCK IDE</span>
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
      </div>
      <div id="body"></div>
    </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById('back-btn')!.addEventListener('click', () => this._showView('choice'));
    this.shadow.getElementById('close-btn')!.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open')) this.close();
    });
  }

  async open(view: View = 'choice'): Promise<void> {
    this.classList.add('open');
    if (this._challenges.length === 0) await this._loadChallenges();
    this._showView(view);
  }

  close(): void {
    this.classList.remove('open');
  }

  private async _loadChallenges(): Promise<void> {
    const list = await challengesService.getAll();
    this._challenges = list.map((c) => ({ id: c.id, title: c.title, locked: !!c.locked }));
  }

  private _showView(view: View): void {
    const backBtn = this.shadow.getElementById('back-btn')!;
    const body = this.shadow.getElementById('body')!;
    backBtn.classList.toggle('visible', view === 'list');
    body.innerHTML = view === 'choice' ? this._renderChoices() : this._renderList();
    if (view === 'choice') this._bindChoiceEvents();
    else this._bindListEvents();
  }

  private _completedCount(): number {
    const progress = storage.getAllProgress();
    return Object.values(progress).filter((p) => !!p.medal).length;
  }

  private _renderChoices(): string {
  const showLogin = !authService.isAuthenticated();
  const gridClass = showLogin ? 'cta-grid' : 'cta-grid two-cols';
  return `
    <div class="choice-view">
      <div class="hero">
        <span class="hero-badge">🕹️ L'Atelier 8-bit</span>
        <h1>Apprends à programmer comme en 1980.</h1>
        <p>La rétro-informatique est le chemin le plus rapide pour comprendre comment les machines fonctionnent vraiment. Écris de l'assembleur 6502 pour un ordinateur 8-bit fictif, directement dans ton navigateur.</p>
      </div>
      <div class="${gridClass}">
        <button class="cta-card" data-choice="free">
          <span class="cta-icon">🖥️</span>
          <strong>Mode libre</strong>
          <span>Programme sans contrainte, explore l'éditeur et l'émulateur à ton rythme.</span>
          <span class="cta-arrow">Commencer →</span>
        </button>
        ${showLogin ? `
        <button class="cta-card" data-choice="login">
          <span class="cta-icon">🔑</span>
          <strong>Se connecter</strong>
          <span>Sauvegarde tes projets et ta progression sur tous tes appareils.</span>
          <span class="cta-arrow">Se connecter →</span>
        </button>` : ''}
        <button class="cta-card" data-choice="challenges">
          <span class="cta-icon">🏆</span>
          <strong>Voir les défis</strong>
          <span>${this._challenges.length} défis progressifs, du premier LDA au pixel à l'écran.</span>
          <span class="cta-arrow">Explorer →</span>
        </button>
      </div>
      <div class="stats-strip">
        <span><strong>${this._challenges.length}</strong> défis</span>
        <span><strong>MOS 6502</strong> émulé en Rust/WASM</span>
        <span><strong>🥇🥈🥉</strong> système de médailles</span>
      </div>
    </div>`;
}

  private _bindChoiceEvents(): void {
    const body = this.shadow.getElementById('body')!;
    body.querySelector('[data-choice="free"]')?.addEventListener('click', () => this.close());
    body.querySelector('[data-choice="login"]')?.addEventListener('click', () => {
      this.close();
      this.emit('chuck:require-auth', { reason: 'challenge' });
    });
    body.querySelector('[data-choice="challenges"]')?.addEventListener('click', () => this._showView('list'));
  }

  private _renderList(): string {
    if (this._challenges.length === 0) {
      return `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:60px 0">
        Impossible de charger la liste des défis.
      </div>`;
    }
    const progress = storage.getAllProgress();
    const unlocked = storage.isUnlocked();
    const completed = this._completedCount();
    const pct = Math.round((completed / this._challenges.length) * 100);

    const cards = this._challenges.map((c) => {
      const medal = progress[c.id]?.medal;
      const isLocked = c.locked && !unlocked && !medal;
      const icon = medal ?? (isLocked ? '🔒' : '▶');
      return `
        <div class="challenge-card${isLocked ? ' locked' : ''}" data-id="${c.id}">
          <span class="challenge-icon">${icon}</span>
          <div class="challenge-card-text">
            <div class="challenge-card-title">${c.title}</div>
            <div class="challenge-card-id">Défi #${c.id}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="list-header">
        <h2>Tous les défis</h2>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-label">${completed} / ${this._challenges.length} défis complétés</div>
      </div>
      <div class="challenge-grid">${cards}</div>`;
  }

  private _bindListEvents(): void {
    const body = this.shadow.getElementById('body')!;
    body.querySelectorAll<HTMLElement>('.challenge-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset['id']);
        this.close();
        this.emit('chuck:goto-challenge', { id });
      });
    });
  }
}

customElements.define('chuck-welcome-modal', ChuckWelcomeModal);