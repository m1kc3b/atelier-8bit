import { ChuckComponent } from '../core/base-component.js';
import { authService } from '../core/auth/auth-service.js';
import { challengesService } from '../core/challenges/challenges-service.js';
import { ChuckOnboardingTour } from './chuck-onboarding-tour.js';

type View = 'choice' | 'challenges' | 'pong';

export class ChuckWelcomeModal extends ChuckComponent {
  /** Nombre de défis — sert uniquement aux compteurs de la vue "choice". */
  private _challengeCount = 0;
  /** Vue courante, mémorisée pour réouverture via le bouton flottant. */
  private _currentView: View = 'choice';

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
      #body { flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
      #body > [hidden] { display:none !important; }
      #view-choice { flex:1; min-height:0; overflow-y:auto; }
      #modal-challenges, #modal-pong { flex:1; min-height:0; }

      /* ── Vue choix ─────────────────────────────────────── */
      .hero { text-align:center; padding:44px 40px 8px; }
      .hero-badge { display:inline-flex; align-items:center; gap:6px; font-size:11px;
                    font-weight:700; text-transform:uppercase; letter-spacing:.1em;
                    color:var(--accent); background:var(--accent-dim); padding:5px 12px;
                    border-radius:20px; margin-bottom:18px; }
      .hero h1 { font-size:30px; font-weight:800; color:var(--text); margin:0 0 14px; line-height:1.25; }
      .hero p { font-size:15px; color:var(--text); line-height:1.65; max-width:560px; margin:0 auto 34px; }
      .cta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:0 40px; margin-bottom:34px; }
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

      .cta-card.locked-hint { position:relative; }
      .lock-pill { font-size:10px; font-weight:700; color:var(--text-muted);
                   background:var(--surface-4); padding:2px 8px; border-radius:20px;
                   margin-left:auto; }

      @media (max-width: 640px) {
        .cta-grid { grid-template-columns:1fr; max-width:none; }
        .hero h1 { font-size:24px; }
        .hero { padding:32px 24px 8px; }
      }
    </style>
    <div class="modal">
      <div class="topbar">
        <button class="back-btn" id="back-btn" title="Retour">←</button>
        <span class="topbar-logo">🕹️ L'Atelier 8-bit</span>
      </div>
      <div id="body">
        <div id="view-choice"></div>
        <chuck-challenges-list id="modal-challenges" hidden></chuck-challenges-list>
        <chuck-pong-track id="modal-pong" hidden></chuck-pong-track>
      </div>
    </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById('back-btn')!.addEventListener('click', () => this._showView('choice'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open')) this.close();
    });

    // Navigation inter-vues émise par les composants enfants / l'IDE.
    this.sub('chuck:show-challenges', () => this._showView('challenges'));
    this.sub('chuck:show-pong', () => this._showView('pong'));
    this.sub('chuck:open-welcome', (p) => { void this.open(p?.view ?? this._currentView); });

    // Cliquer un défi / une étape ferme la modale (l'IDE prend le relais).
    this.sub('chuck:goto-challenge', () => this.close());
  }

  async open(view: View = 'choice'): Promise<void> {
    this.classList.add('open');
    if (this._challengeCount === 0) await this._loadChallengeCount();
    this._showView(view);
  }

  close(): void {
    this.classList.remove('open');
  }

  private async _loadChallengeCount(): Promise<void> {
    const list = await challengesService.getAll();
    this._challengeCount = list.length;
  }

  private _showView(view: View): void {
    this._currentView = view;
    const backBtn = this.shadow.getElementById('back-btn')!;
    const choiceEl = this.shadow.getElementById('view-choice')!;
    const challengesEl = this.shadow.getElementById('modal-challenges')!;
    const pongEl = this.shadow.getElementById('modal-pong')!;

    backBtn.classList.toggle('visible', view !== 'choice');
    choiceEl.toggleAttribute('hidden', view !== 'choice');
    challengesEl.toggleAttribute('hidden', view !== 'challenges');
    pongEl.toggleAttribute('hidden', view !== 'pong');

    if (view === 'choice') {
      choiceEl.innerHTML = this._renderChoices();
      this._bindChoiceEvents();
    }
  }

  private _renderChoices(): string {
    const authed = authService.isAuthenticated();
    const pongCta = authed ? 'Commencer →' : 'Créer un compte →';
    const pongLock = authed ? '' : `<span class="lock-pill">🔒 Compte requis</span>`;
    return `
      <div class="choice-view">
        <div class="hero">
          <h1>Apprends à programmer comme en 1980.</h1>
          <p>La rétro-informatique est le chemin le plus rapide pour comprendre comment les machines fonctionnent vraiment. Écris de l'assembleur 6502 pour un ordinateur 8-bit fictif, directement dans ton navigateur.</p>
        </div>
        <div class="cta-grid">
          <button class="cta-card" data-choice="free">
            <span class="cta-icon">🖥️</span>
            <strong>Mode libre</strong>
            <span>Programme sans contrainte, explore l'éditeur et l'émulateur à ton rythme.</span>
            <span class="cta-arrow">Commencer →</span>
          </button>
          <button class="cta-card" data-choice="challenges">
            <span class="cta-icon">🏆</span>
            <strong>Les Challenges</strong>
            <span>${this._challengeCount} défis progressifs, du premier LDA au pixel à l'écran.</span>
            <span class="cta-arrow">Explorer →</span>
          </button>
          <button class="cta-card locked-hint" data-choice="pong">
            <span class="cta-icon">🏓</span>
            <strong>Coder Pong ${pongLock}</strong>
            <span>Construis ton premier jeu vidéo en assembleur, étape par étape.</span>
            <span class="cta-arrow">${pongCta}</span>
          </button>
        </div>
        <div class="stats-strip">
          <span><strong>${this._challengeCount}</strong> défis</span>
          <span><strong>MOS 6502</strong> émulé en Rust/WASM</span>
          <span><strong>🥇🥈🥉</strong> système de médailles</span>
        </div>
      </div>`;
  }

  private _bindChoiceEvents(): void {
    const choiceEl = this.shadow.getElementById('view-choice')!;
    choiceEl.querySelector('[data-choice="free"]')?.addEventListener('click', () => {
      this.close();
      if (!ChuckOnboardingTour.hasBeenSeen()) {
        this.emit('chuck:start-tour', undefined);
      }
    });
    choiceEl.querySelector('[data-choice="challenges"]')?.addEventListener('click', () => {
      this._showView('challenges');
    });
    choiceEl.querySelector('[data-choice="pong"]')?.addEventListener('click', () => {
      if (!authService.isAuthenticated()) {
        this.emit('chuck:require-auth', { reason: 'pong' });
        return;
      }
      this._showView('pong');
    });
  }
}

customElements.define('chuck-welcome-modal', ChuckWelcomeModal);