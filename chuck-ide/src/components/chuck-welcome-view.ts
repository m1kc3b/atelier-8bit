/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-welcome-view.ts
   Vue d'accueil (hero + 3 choix), injectée dans chuck-main-modal.
   Ne porte aucune coquille : topbar/close/back sont gérés par la modale.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { challengesService } from "../core/challenges/challenges-service.js";
import { ChuckOnboardingTour } from "./chuck-onboarding-tour.js";

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host { display:flex; flex-direction:column; height:100%; min-height:0; }

  .choice-view { display:flex; flex-direction:column; min-height:100%; flex:1; }

  .hero { text-align:center; padding:44px 40px 8px; }
  .hero h1 { font-size:30px; font-weight:800; color:var(--text); margin:0 0 14px; line-height:1.25; }
  .hero p { font-size:15px; color:var(--text); line-height:1.65; max-width:560px; margin:0 auto 34px; }

  .cta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:0 40px; margin-bottom:34px; }
  .cta-card {
    color:var(--text-black);
    position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:9px;
    padding:22px 18px 22px 21px; border:1px solid var(--border);
    border-left:3px solid var(--card, var(--accent));
    border-radius:14px; cursor:pointer; text-align:left;
    transition:border-color var(--t-fast), background var(--t-fast), transform .12s;
  }
  .cta-card[data-choice="free"]       { --card:var(--mode-free);       --card-dim:var(--mode-free-dim); }
  .cta-card[data-choice="challenges"] { --card:var(--mode-challenges); --card-dim:var(--mode-challenges-dim); }
  .cta-card[data-choice="pong"]       { --card:var(--mode-pong);       --card-dim:var(--mode-pong-dim); }
  .cta-card:hover { border-color:var(--card); color:var(--text); background:var(--card-dim); transform:translateY(-2px); }
  .cta-card strong { font-size:13.5px; }
  .cta-card span { font-size:11.5px; line-height:1.55; }
  .cta-arrow { margin-top:4px; font-size:11.5px; color:var(--card, var(--accent)); opacity:0; transition:opacity var(--t-fast); }
  .cta-card:hover .cta-arrow { opacity:1; }

  .cta-icon { display:inline-block; width:50px; height:50px; }
  .cta-icon img { display:block; width:100%; height:auto; }

  .stats-strip { margin-top:auto; display:flex; justify-content:center; gap:26px;
                 padding:18px 40px 8px; border-top:1px solid var(--border); flex-wrap:wrap;
                 font-family:var(--font-mono); font-size:13px; color:var(--accent); letter-spacing:.06em; }
  .stats-strip strong { font-weight:700; }

  @media (max-width: 640px) {
    .cta-grid { grid-template-columns:1fr; }
    .hero h1 { font-size:24px; }
    .hero { padding:32px 24px 8px; }
  }
`;

export class ChuckWelcomeView extends ChuckComponent {
  private _challengeCount = 0;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style><div id="root"></div>`;
  }

  protected setup(): void {
    this._renderChoices();
    this._bindEvents();
    // Le compteur n'est qu'un nombre affiché : chargé en arrière-plan.
    if (this._challengeCount === 0) {
      void challengesService.getAll().then((list) => {
        this._challengeCount = list.length;
        if (this.isConnected) {
          this._renderChoices();
          this._bindEvents();
        }
      });
    }
  }

  private _renderChoices(): void {
    const root = this.shadow.getElementById("root")!;
    root.innerHTML = `
      <div class="choice-view">
        <div class="hero">
          <h1>Programme comme en 1980</h1>
          <p>Écris de l’assembleur sur un ordinateur 8-bit fictif, directement dans ton navigateur, pour te reconnecter à la réalité physique du code, comprendre enfin comment la machine fonctionne, et développer une intuition système solide.</p>
        </div>
        <div class="cta-grid">
          <button class="cta-card" data-choice="free">
            <picture class="cta-icon">
              <source srcset="/images/mode_libre.gif" type="image/webp">
              <img src="/images/pencil.gif" alt="✏" width="32" height="32">
            </picture>
            <strong>Mode libre</strong>
            <span>Programme sans contrainte, explore l'éditeur et l'émulateur à ton rythme.</span>
            <span class="cta-arrow">Commencer →</span>
          </button>

          <button class="cta-card" data-choice="challenges">
            <picture class="cta-icon">
              <source srcset="/images/tutos.gif" type="image/webp">
              <img src="/images/pencil.gif" alt="✏" width="32" height="32">
            </picture>
            <strong>Les Tutos</strong>
            <span>${this._challengeCount} tutos progressifs, du premier LDA au pixel à l'écran.</span>
            <span class="cta-arrow">Explorer →</span>
          </button>

          <button class="cta-card" data-choice="pong">
            <picture class="cta-icon">
              <source srcset="/images/defis.gif" type="image/webp">
              <img src="/images/pencil.gif" alt="✏" width="32" height="32">
            </picture>
            <strong>Défis du mois</strong>
            <span>Construis ton premier jeu vidéo en assembleur, étape par étape.</span>
            <span class="cta-arrow">Explorer →</span>
          </button>
        </div>
      </div>`;
  }

  private _bindEvents(): void {
    const root = this.shadow.getElementById("root")!;

    root.querySelector('[data-choice="free"]')?.addEventListener("click", () => {
      this.emit("chuck:ide-free", undefined);
      if (!ChuckOnboardingTour.hasBeenSeen()) {
        this.emit("chuck:start-tour", undefined);
      }
    });

    // Liste des tutos : accès libre (le gate s'applique AU LANCEMENT d'un tuto).
    root.querySelector('[data-choice="challenges"]')?.addEventListener("click", () => {
      this.emit("chuck:modal-show", { view: "challenges" });
    });

    // Défis du mois : accès libre, side-panel comme les challenges.
    root.querySelector('[data-choice="pong"]')?.addEventListener("click", () => {
      this.emit("chuck:modal-show", { view: "pong" });
    });
  }

}

customElements.define("chuck-welcome-view", ChuckWelcomeView);