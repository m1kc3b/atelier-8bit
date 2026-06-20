/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-pong-celebration.ts

   Écran de célébration final du parcours guidé "Coder Pong"
   (Étape 3 du funnel) : félicite l'utilisateur et fait le pont
   vers l'offre payante du Club Atelier 8-Bit (Étape 4).
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { setView } from "../core/router.js";
import { clubWaitlist } from "../core/club-waitlist.js";

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

  .club-card {
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; text-align: left; margin-bottom: 22px;
  }
  .club-card h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
                   color: var(--accent); margin: 0 0 12px; }
  .club-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .club-card li { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--text); line-height: 1.45; }
  .club-card li .ico { flex-shrink: 0; }

  .waitlist-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .waitlist-form input {
    height: 40px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface-3); color: var(--text); font-size: 13px; font-family: var(--font-ui);
  }
  .waitlist-form button {
    height: 42px; border: none; border-radius: 8px; background: var(--accent);
    color: #1a1206; font-weight: 700; font-size: 13.5px; font-family: var(--font-ui); cursor: pointer;
  }
  .waitlist-form button:disabled { opacity: .5; cursor: default; }
  .waitlist-msg { font-size: 11.5px; min-height: 14px; }
  .waitlist-msg.ok  { color: var(--green); }
  .waitlist-msg.err { color: var(--red); }

  .joined-box {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 14px; background: var(--green-dim); border: 1px solid rgba(61,214,140,.3);
    border-radius: 10px; margin-bottom: 14px; font-size: 13px; color: var(--green); font-weight: 600;
  }

  .secondary-link {
    display: block; margin-top: 4px; font-size: 12px; color: var(--text-muted); cursor: pointer;
  }
  .secondary-link:hover { color: var(--text); }
`;

export class ChuckPongCelebration extends ChuckComponent {
  private _stepCount = 5;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="modal">
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
        <div class="trophy">🏆</div>
        <h1>Pong terminé — bravo !</h1>
        <p class="lead" id="lead"></p>

        <div class="club-card">
          <h2>👾 Club Atelier 8-Bit</h2>
          <ul>
            <li><span class="ico">🔴</span><span>2 lives hebdomadaires — Live Coding &amp; Q&amp;A</span></li>
            <li><span class="ico">🏁</span><span>Défi communautaire mensuel</span></li>
            <li><span class="ico">💬</span><span>Accès au serveur Discord privé des passionnés</span></li>
          </ul>
        </div>

        <div id="waitlist-zone"></div>

        <span class="secondary-link" id="goto-pong">Revoir le parcours Pong</span>
      </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById("close-btn")!.addEventListener("click", () => this.close());
    this.shadow.getElementById("goto-pong")!.addEventListener("click", () => {
      this.close();
      setView("pong");
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
    lead.textContent = `Tu as validé les ${this._stepCount} étapes du projet guidé et codé ton premier jeu vidéo en assembleur 6502. La suite logique : rejoindre les autres passionnés du Club.`;
    this._renderWaitlistZone();
    this.classList.add("open");
  }

  close(): void {
    this.classList.remove("open");
  }

  private _renderWaitlistZone(): void {
    const zone = this.shadow.getElementById("waitlist-zone")!;

    if (clubWaitlist.hasJoined()) {
      zone.innerHTML = `
        <div class="joined-box">✓ Tu es sur la liste d'attente du Club — on te préviendra à l'ouverture.</div>`;
      return;
    }

    zone.innerHTML = `
      <form class="waitlist-form" id="waitlist-form">
        <input type="email" id="waitlist-email" placeholder="ton@email.com" required>
        <button type="submit" id="waitlist-submit">Rejoindre la liste d'attente du Club →</button>
        <div class="waitlist-msg" id="waitlist-msg"></div>
      </form>`;

    const form = this.shadow.getElementById("waitlist-form") as HTMLFormElement;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = this.shadow.getElementById("waitlist-email") as HTMLInputElement;
      const btn = this.shadow.getElementById("waitlist-submit") as HTMLButtonElement;
      const msg = this.shadow.getElementById("waitlist-msg")!;
      btn.disabled = true;
      const result = await clubWaitlist.join(input.value);
      btn.disabled = false;
      if (!result.ok) {
        msg.className = "waitlist-msg err";
        msg.textContent = result.error ?? "Une erreur est survenue.";
        return;
      }
      this._renderWaitlistZone();
    });
  }
}

customElements.define("chuck-pong-celebration", ChuckPongCelebration);
