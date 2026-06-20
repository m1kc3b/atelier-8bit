/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-pong-track.ts
   Écran "🏓 Coder Pong" — Choix 3 depuis l'accueil.
   STUB : le tutoriel guidé (étapes à droite / IDE à gauche,
   réutilisant <chuck-side-panel>) reste à construire — hors
   périmètre de cette implémentation, qui ne couvre que le Choix 2.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { setView } from "../core/router.js";
import { storage } from "../core/storage/storage-service.js";

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';
  :host { display: flex; align-items: center; justify-content: center; height: 100%; background: var(--surface); }
  .box { text-align: center; max-width: 420px; padding: 40px; }
  .icon { font-size: 40px; margin-bottom: 14px; }
  h1 { font-size: 20px; font-weight: 800; color: var(--text); margin: 0 0 10px; }
  p { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0 0 22px; }
  button {
    height: 40px; padding: 0 22px; border: none; border-radius: 8px;
    background: var(--accent); color: #1a1206; font-weight: 700; font-size: 13px;
    font-family: var(--font-ui); cursor: pointer;
  }
`;

export class ChuckPongTrack extends ChuckComponent {
  protected render(): void {
    const unlocked = storage.isUnlocked();
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="box">
        <div class="icon">🏓</div>
        <h1>${unlocked ? "Le projet Pong arrive bientôt" : "Débloque le projet guidé Pong"}</h1>
        <p>${unlocked
          ? "Le parcours guidé (raquettes, balle, score…) est en cours de construction. Continue les défis en attendant."
          : "Termine les premiers défis et crée ton compte gratuit pour débloquer le projet Pong."}</p>
        <button id="cta">Voir les défis →</button>
      </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById("cta")?.addEventListener("click", () => setView("challenges"));
  }
}

customElements.define("chuck-pong-track", ChuckPongTrack);