/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-email-gate.ts
   Modale de capture email — bloque l'accès aux défis 4+.
   Non fermable sans valider l'email.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from '../core/base-component.js';
import { storage } from '../core/storage/storage-service.js';

const STYLES = /* css */`
  @import '/src/styles/tokens.css';

  :host {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99000;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(6px);
    align-items: center;
    justify-content: center;
  }

  :host(.open) { display: flex; }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 32px 80px rgba(0,0,0,.7);
    width: min(480px, 92vw);
    padding: 40px 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 0;
    animation: modal-in .25s cubic-bezier(.34,1.56,.64,1);
  }

  @keyframes modal-in {
    from { opacity: 0; transform: scale(.92) translateY(12px); }
    to   { opacity: 1; transform: scale(1)  translateY(0); }
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--accent);
    background: var(--accent-dim);
    padding: 4px 10px;
    border-radius: 20px;
    margin-bottom: 20px;
    width: fit-content;
  }

  .lock-icon {
    font-size: 28px;
    margin-bottom: 12px;
  }

  h2 {
    font-size: 24px;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 10px;
    line-height: 1.25;
  }

  .sub {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0 0 28px;
  }

  .sub strong { color: var(--text); font-weight: 600; }

  .perks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 28px;
    padding: 16px;
    background: var(--surface-2);
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .perk {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--text-dim);
  }

  .perk-icon {
    font-size: 16px;
    width: 24px;
    flex-shrink: 0;
    text-align: center;
  }

  .perk strong { color: var(--text); font-weight: 600; }

  .form-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .email-input {
    flex: 1;
    height: 44px;
    padding: 0 14px;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    font-family: var(--font-ui);
    outline: none;
    transition: border-color .15s;
  }

  .email-input::placeholder { color: var(--text-muted); }
  .email-input:focus { border-color: var(--accent); }
  .email-input.error { border-color: var(--red); }

  .submit-btn {
    height: 44px;
    padding: 0 20px;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    font-family: var(--font-ui);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity .12s, transform .08s;
    flex-shrink: 0;
  }

  .submit-btn:hover  { opacity: .88; }
  .submit-btn:active { transform: scale(.97); }
  .submit-btn:disabled { opacity: .4; cursor: not-allowed; }

  .error-msg {
    font-size: 12px;
    color: var(--red);
    min-height: 16px;
    margin-bottom: 4px;
  }

  .legal {
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    margin-top: 16px;
    line-height: 1.5;
  }

  .success-state {
    display: none;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    padding: 8px 0;
  }

  .success-state.visible { display: flex; }

  .success-icon {
    font-size: 48px;
    animation: pop .4s cubic-bezier(.34,1.56,.64,1);
  }

  @keyframes pop {
    from { transform: scale(0); }
    to   { transform: scale(1); }
  }

  .success-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--green);
    margin: 0;
  }

  .success-sub {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  .continue-btn {
    margin-top: 8px;
    height: 44px;
    padding: 0 32px;
    background: var(--green);
    color: #0a1a0a;
    font-weight: 700;
    font-size: 14px;
    font-family: var(--font-ui);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity .12s;
  }

  .continue-btn:hover { opacity: .88; }
`;

export class ChuckEmailGate extends ChuckComponent {
  private _pendingChallengeId = 4;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="gate-title">

        <div class="main-state" id="main-state">
          <div class="badge">🔒 Contenu exclusif</div>
          <div class="lock-icon">⚡</div>
          <h2 id="gate-title">La suite t'attend.</h2>
          <p class="sub">
            Tu viens de terminer les 3 premiers défis. Ce que tu vas découvrir ensuite est
            <strong>visuellement spectaculaire</strong> — boucles, couleurs, animations.<br><br>
            Laisse ton email pour continuer. Pas de spam, juste
            les mises à jour du club.
          </p>

          <div class="perks">
            <div class="perk">
              <span class="perk-icon">🎨</span>
              <span><strong>Défi 4</strong> — Pluie de pixels aléatoires en boucle</span>
            </div>
            <div class="perk">
              <span class="perk-icon">🌈</span>
              <span><strong>Défi 5</strong> — Arc-en-ciel 16 couleurs plein écran</span>
            </div>
            <div class="perk">
              <span class="perk-icon">⚔️</span>
              <span><strong>Défi 6</strong> — Boss : ton premier vrai écran de jeu</span>
            </div>
            <div class="perk">
              <span class="perk-icon">🏆</span>
              <span><strong>27 défis supplémentaires</strong> — jusqu'au Pong complet</span>
            </div>
          </div>

          <div class="error-msg" id="error-msg"></div>
          <div class="form-row">
            <input
              type="email"
              class="email-input"
              id="email-input"
              placeholder="ton@email.com"
              autocomplete="email"
              inputmode="email"
            >
            <button class="submit-btn" id="submit-btn">Continuer →</button>
          </div>

          <p class="legal">
            En continuant, tu rejoins la liste du club Atelier 8-bit.<br>
            Pas de spam. Désinscription en un clic.
          </p>
        </div>

        <div class="success-state" id="success-state">
          <div class="success-icon">🎉</div>
          <h2 class="success-title">Accès débloqué !</h2>
          <p class="success-sub">Bienvenue dans la suite. 27 défis t'attendent.</p>
          <button class="continue-btn" id="continue-btn">Lancer le défi 4 →</button>
        </div>

      </div>`;
  }

  protected setup(): void {
    const input      = this.shadow.getElementById('email-input')  as HTMLInputElement;
    const submitBtn  = this.shadow.getElementById('submit-btn')   as HTMLButtonElement;
    const errorMsg   = this.shadow.getElementById('error-msg')!;
    const continueBtn = this.shadow.getElementById('continue-btn') as HTMLButtonElement;

    // Valider au clic
    submitBtn.addEventListener('click', () => this._submit());

    // Valider à l'entrée
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
      errorMsg.textContent = '';
      input.classList.remove('error');
    });

    // Continuer après succès
    continueBtn.addEventListener('click', () => {
      this.close();
      this.emit('chuck:goto-challenge', { id: this._pendingChallengeId });
    });

    // Empêcher la fermeture avec Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this._shake();
      }
    }, { capture: true });

    // Empêcher la fermeture en cliquant en dehors
    // (le fond est dans :host, pas dans .modal)
  }

  // ── API publique ──────────────────────────────────────────────
  open(pendingChallengeId = 4): void {
    this._pendingChallengeId = pendingChallengeId;
    this.classList.add('open');
    setTimeout(() => {
      (this.shadow.getElementById('email-input') as HTMLInputElement)?.focus();
    }, 300);
  }

  close(): void { this.classList.remove('open'); }

  static isUnlocked(): boolean {
    return storage.isUnlocked();
  }

  // ── Validation ────────────────────────────────────────────────
  private _submit(): void {
    const input    = this.shadow.getElementById('email-input') as HTMLInputElement;
    const errorMsg = this.shadow.getElementById('error-msg')!;
    const email    = input.value.trim();

    if (!email || !this._validEmail(email)) {
      errorMsg.textContent = 'Entre une adresse email valide pour continuer.';
      input.classList.add('error');
      this._shake();
      return;
    }

    // Sauvegarde locale
    try { storage.saveSession(email); } catch {}

    // TODO: envoyer l'email vers un backend / webhook
    // fetch('/api/subscribe', { method: 'POST', body: JSON.stringify({ email }) })

    // Afficher l'état succès
    this.shadow.getElementById('main-state')!.style.display = 'none';
    const success = this.shadow.getElementById('success-state')!;
    success.classList.add('visible');
    setTimeout(() =>
      (this.shadow.getElementById('continue-btn') as HTMLButtonElement)?.focus()
    , 100);
  }

  private _validEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private _shake(): void {
    const modal = this.shadow.querySelector('.modal') as HTMLElement | null;
    if (!modal) return;
    modal.style.animation = 'none';
    modal.offsetHeight; // reflow
    modal.style.animation = 'shake .3s ease';
    // On ajoute l'animation shake si elle n'existe pas encore dans le CSS
    if (!this.shadow.querySelector('#shake-style')) {
      const s = document.createElement('style');
      s.id = 'shake-style';
      s.textContent = `@keyframes shake {
        0%,100%{transform:translateX(0)}
        20%{transform:translateX(-8px)}
        40%{transform:translateX(8px)}
        60%{transform:translateX(-5px)}
        80%{transform:translateX(5px)}
      }`;
      this.shadow.appendChild(s);
    }
  }
}

customElements.define('chuck-email-gate', ChuckEmailGate);