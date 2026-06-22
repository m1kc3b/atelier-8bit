/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-pong-celebration.ts

   Mur premium du parcours « Coder Pong » (Étape 4 du funnel).
   Affiché à la fin de Pong Light (les PONG_FREE_STEPS étapes gratuites) :
   félicite l'utilisateur, puis présente l'offre « Pong Avancé » (99 €,
   accès à vie) — modèle one-shot de la stratégie §2/§3.

   Mur à deux étages :
     étage 1 : capture email (Buttondown)  — signal tiède
     étage 2 : paiement (Stripe)            — signal fort

   Émet les étapes funnel : premium-wall-shown, premium-email-captured,
   premium-pay-clicked (cf. core/funnel-tracker.ts).
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { premiumProduct } from "../core/premium-product.js";

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    position: fixed; inset: 0; z-index: 9600; display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,.82); font-family: var(--font-ui);
  }
  :host(.open) { display: flex; }

  .modal {
    position: relative; width: min(480px, 92vw); max-height: 90vh; overflow-y: auto;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px; padding: 36px 32px; text-align: center;
    box-shadow: var(--modal-shadow);
  }
  .close-btn {
    position: absolute; top: 14px; right: 14px; width: 26px; height: 26px;
    border-radius: 50%; background: var(--surface-3); border: none;
    color: var(--text-muted); cursor: pointer; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background var(--t-fast), color var(--t-fast);
  }
  .close-btn:hover { background: var(--red); color: #fff; }

  .trophy { font-size: 52px; animation: bounce 1.4s ease-in-out infinite; }
  @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

  h1 { font-size: 22px; font-weight: 800; color: var(--text); margin: 14px 0 8px; }
  .lead { font-size: 13.5px; color: var(--text-dim); line-height: 1.6; margin: 0 0 24px; }

  .offer-card {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; text-align: left; margin-bottom: 22px;
  }
  .offer-card h2 {
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
    color: var(--accent); margin: 0 0 4px;
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  }
  .offer-card .price { font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: 0; text-transform: none; }
  .offer-card .price small { font-size: 11px; color: var(--text-muted); font-weight: 600; }
  .offer-card ul { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .offer-card li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--text); line-height: 1.45; }
  .offer-card li .ico { flex-shrink: 0; }

  .stage-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .stage-form input {
    height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface-3); color: var(--text); font-size: 13px; font-family: var(--font-ui);
  }
  .stage-form button {
    height: 42px; border: none; border-radius: 8px; background: var(--accent);
    color: #1a1206; font-weight: 700; font-size: 13.5px; font-family: var(--font-ui); cursor: pointer;
  }
  .stage-form button:disabled { opacity: .5; cursor: default; }
  .stage-msg { font-size: 11.5px; min-height: 14px; }
  .stage-msg.ok  { color: var(--green); }
  .stage-msg.err { color: var(--red); }

  .pay-btn {
    display: block; width: 100%; height: 46px; border: none; border-radius: 8px;
    background: var(--green); color: #06281a; font-weight: 800; font-size: 14px;
    font-family: var(--font-ui); cursor: pointer; margin-bottom: 12px;
  }
  .pay-btn:disabled { opacity: .5; cursor: default; }

  .stage-hint {
    display: flex; align-items: center; gap: 6px; justify-content: center;
    font-size: 11.5px; color: var(--text-muted); margin-bottom: 14px;
  }

  .secondary-link {
    display: block; margin-top: 4px; font-size: 12px; color: var(--text-muted); cursor: pointer;
  }
  .secondary-link:hover { color: var(--text); }
`;

export class ChuckPongCelebration extends ChuckComponent {
  private _stepCount = 3;
  /** false = étage email (1), true = étage paiement (2) */
  private _emailCaptured = false;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="modal">
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
        <div class="trophy">🏆</div>
        <h1>Pong Light terminé — bravo !</h1>
        <p class="lead" id="lead"></p>

        <div class="offer-card">
          <h2>
            <span>🎮 Pong Avancé</span>
            <span class="price">99 € <small>· accès à vie</small></span>
          </h2>
          <ul>
            <li><span class="ico">🎯</span><span>Collision balle ↔ raquette : la balle a enfin un adversaire</span></li>
            <li><span class="ico">🤖</span><span>IA adverse qui suit la balle, difficulté dosée</span></li>
            <li><span class="ico">🔢</span><span>Score, son, et la boucle de jeu complète avec écrans</span></li>
            <li><span class="ico">🧠</span><span>La machine à états réutilisable dans tous tes projets</span></li>
          </ul>
        </div>

        <div id="stage-zone"></div>

        <span class="secondary-link" id="goto-pong">Revoir le parcours Pong</span>
      </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById("close-btn")!.addEventListener("click", () => this.close());
    this.shadow.getElementById("goto-pong")!.addEventListener("click", () => {
      this.close();
      this.emit("chuck:open-welcome", { view: "pong" });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.classList.contains("open")) this.close();
    });

    this.sub("chuck:pong-completed", ({ stepCount }) => {
      this._stepCount = stepCount;
      this.open();
    });
  }

  open(): void {
    const lead = this.shadow.getElementById("lead")!;
    lead.textContent =
      `Tu as une raquette jouable et une balle qui rebondit — mais aucun enjeu : ` +
      `pas de collision, pas de score, pas de victoire. C'est exactement là que ` +
      `commence Pong Avancé.`;
    this._emailCaptured = false;
    this._renderStage();
    this.classList.add("open");

    // Funnel : le mur premium est affiché.
    this.emit("chuck:funnel-step", {
      step: "premium-wall-shown",
      meta: { stepCount: this._stepCount },
    });
  }

  close(): void {
    this.classList.remove("open");
  }

  /** Rend l'étage courant : email (1) puis paiement (2). */
  private _renderStage(): void {
    const zone = this.shadow.getElementById("stage-zone")!;

    if (!this._emailCaptured) {
      // ── Étage 1 : capture email ────────────────────────────
      zone.innerHTML = `
        <form class="stage-form" id="email-form">
          <input type="email" id="email-input" placeholder="ton@email.com" required>
          <button type="submit" id="email-submit">Débloquer l'accès à Pong Avancé →</button>
          <div class="stage-msg" id="email-msg"></div>
        </form>
        <div class="stage-hint">🔒 Paiement sécurisé à l'étape suivante</div>`;

      const form = this.shadow.getElementById("email-form") as HTMLFormElement;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = this.shadow.getElementById("email-input") as HTMLInputElement;
        const btn = this.shadow.getElementById("email-submit") as HTMLButtonElement;
        const msg = this.shadow.getElementById("email-msg")!;
        btn.disabled = true;
        const result = await premiumProduct.captureEmail(input.value);
        btn.disabled = false;
        if (!result.ok) {
          msg.className = "stage-msg err";
          msg.textContent = result.error ?? "Une erreur est survenue.";
          return;
        }
        // Funnel : email capturé (signal tiède).
        this.emit("chuck:funnel-step", {
          step: "premium-email-captured",
          meta: {},
        });
        this._emailCaptured = true;
        this._renderStage();
      });
      return;
    }

    // ── Étage 2 : paiement ───────────────────────────────────
    const link = premiumProduct.getPaymentLink();
    zone.innerHTML = `
      <button class="pay-btn" id="pay-btn">Payer 99 € et débloquer →</button>
      <div class="stage-msg ok" id="pay-msg">✓ Email enregistré. Dernière étape : le paiement.</div>`;

    const payBtn = this.shadow.getElementById("pay-btn") as HTMLButtonElement;
    payBtn.addEventListener("click", () => {
      // Funnel : clic payer (signal FORT — la vraie question de la stratégie).
      this.emit("chuck:funnel-step", {
        step: "premium-pay-clicked",
        meta: {},
      });
      if (link) {
        window.open(link, "_blank", "noopener");
      } else {
        // Lien Stripe pas encore configuré : on a tout de même tracé l'intention.
        const msg = this.shadow.getElementById("pay-msg")!;
        msg.className = "stage-msg ok";
        msg.textContent = "Merci ! Le paiement sera bientôt disponible — tu seras prévenu par email.";
      }
    });
  }
}

customElements.define("chuck-pong-celebration", ChuckPongCelebration);