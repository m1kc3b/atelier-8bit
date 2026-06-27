/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-foundations-celebration.ts

   Célébration spéciale déclenchée à la validation du DERNIER challenge
   classique (fin des fondations). Remplace la célébration habituelle par
   une pop-up festive :
     - explosion de confettis en boucle, partant du centre DERRIÈRE la
       pop-up et projetée tout autour ;
     - une simulation de Pong qui tourne en continu à l'intérieur ;
     - un message invitant à enchaîner sur le parcours Pong ;
     - un bouton qui charge directement l'étape 1 du parcours.

   100 % piloté par l'event chuck:foundations-completed (le manager fournit
   l'id de l'étape 1 du parcours Pong ; aucun id codé en dur ici).

   Les boucles d'animation (confettis + Pong) tournent uniquement quand la
   pop-up est ouverte et sont arrêtées à la fermeture / au disconnect, pour
   ne pas consommer de CPU en arrière-plan.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";

const PALETTE = [
  "#5dcaa5", "#ef9f27", "#d4537e", "#378add",
  "#97c459", "#7f77dd", "#f0997b", "#f5c4b3",
];

const BURST_EVERY_MS = 1300;

interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; rot: number; vr: number; c: string; s: number; life: number;
}

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    position: fixed; inset: 0; z-index: 9650; display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,.82); font-family: var(--font-ui);
  }
  :host(.open) { display: flex; }

  .confetti {
    position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 1;
  }

  .modal {
    position: relative; z-index: 2; width: min(440px, 92vw);
    max-height: 92vh; overflow-y: auto;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 18px; padding: 28px 26px; text-align: center;
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

  .eyebrow {
    font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--text-muted); margin: 0 0 4px;
  }
  h1 { font-size: 22px; font-weight: 800; color: var(--text); margin: 8px 0 6px; }
  .lead {
    font-size: 13.5px; line-height: 1.6; color: var(--text-dim);
    margin: 0 0 18px;
  }
  .lead strong { color: var(--text); font-weight: 700; }

  .pong-frame {
    background: #0b0e0c; border-radius: 10px; padding: 10px; margin: 0 0 20px;
  }
  .pong-frame canvas { display: block; width: 100%; border-radius: 4px; }

  .start-btn {
    display: block; width: 100%; height: 48px; border: none; border-radius: 8px;
    background: var(--green); color: #04342c; font-weight: 800; font-size: 15px;
    font-family: var(--font-ui); cursor: pointer;
  }
  .start-btn:disabled { opacity: .5; cursor: default; }
  .start-btn .ti { vertical-align: -2px; margin-right: 6px; }

  .hint {
    display: block; margin-top: 12px; font-size: 12px; color: var(--text-muted);
  }
`;

export class ChuckFoundationsCelebration extends ChuckComponent {
  private _firstPongStepId: number | null = null;

  private _confetti!: HTMLCanvasElement;
  private _cctx!: CanvasRenderingContext2D;
  private _pong!: HTMLCanvasElement;
  private _pctx!: CanvasRenderingContext2D;

  private _parts: Particle[] = [];
  private _confettiRAF = 0;
  private _pongRAF = 0;
  private _lastBurst = -Infinity;

  // État de la simulation Pong.
  private _bx = 0; private _by = 0; private _bvx = 0; private _bvy = 0;
  private _lY = 0; private _rY = 0;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <canvas class="confetti" id="confetti"></canvas>
      <div class="modal">
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
        <p class="eyebrow">Fondations terminées</p>
        <h1 id="title">18 challenges. Bravo !</h1>
        <p class="lead">
          Tu maîtrises la machine. Place à ton premier vrai jeu : assemble
          toutes les briques dans le parcours <strong>Pong</strong>.
        </p>
        <div class="pong-frame">
          <canvas id="pong" width="372" height="208"></canvas>
        </div>
        <button class="start-btn" id="start-btn">
          <i class="ti ti-player-play" aria-hidden="true"></i>Ouvrir l'étape 1 du parcours Pong
        </button>
        <span class="hint">8 étapes · de zéro à un jeu jouable</span>
      </div>`;
  }

  protected setup(): void {
    this._confetti = this.shadow.getElementById("confetti") as HTMLCanvasElement;
    this._cctx = this._confetti.getContext("2d")!;
    this._pong = this.shadow.getElementById("pong") as HTMLCanvasElement;
    this._pctx = this._pong.getContext("2d")!;

    this.shadow.getElementById("close-btn")!
      .addEventListener("click", () => this.close());

    const startBtn = this.shadow.getElementById("start-btn") as HTMLButtonElement;
    startBtn.addEventListener("click", () => {
      if (this._firstPongStepId == null) {
        // Repli : le parcours n'est pas résolu — on ouvre la présentation Pong.
        this.emit("chuck:open-welcome", undefined);
      } else {
        this.emit("chuck:goto-challenge", { id: this._firstPongStepId });
      }
      this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.classList.contains("open")) this.close();
    });

    this.sub("chuck:foundations-completed", ({ firstPongStepId }) => {
      this._firstPongStepId = firstPongStepId;
      this.open();
    });
  }

  protected teardown(): void {
    this._stopLoops();
  }

  open(): void {
    this.classList.add("open");
    this._resizeConfetti();
    this._resetPong();
    this._lastBurst = -Infinity;
    this._parts = [];
    this._startLoops();
  }

  close(): void {
    this.classList.remove("open");
    this._stopLoops();
  }

  // ── Boucles d'animation ───────────────────────────────────

  private _startLoops(): void {
    const conf = (t: number) => {
      this._stepConfetti(t);
      this._confettiRAF = requestAnimationFrame(conf);
    };
    const pong = () => {
      this._stepPong();
      this._pongRAF = requestAnimationFrame(pong);
    };
    this._confettiRAF = requestAnimationFrame(conf);
    this._pongRAF = requestAnimationFrame(pong);
  }

  private _stopLoops(): void {
    if (this._confettiRAF) cancelAnimationFrame(this._confettiRAF);
    if (this._pongRAF) cancelAnimationFrame(this._pongRAF);
    this._confettiRAF = 0;
    this._pongRAF = 0;
  }

  // ── Confettis : explosion radiale en boucle ───────────────

  private _resizeConfetti(): void {
    const r = this._confetti.getBoundingClientRect();
    this._confetti.width = r.width;
    this._confetti.height = r.height;
  }

  private _emit(ox: number, oy: number, n: number, power: number): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = power * (0.5 + Math.random());
      this._parts.push({
        x: ox, y: oy,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 2.5 + Math.random() * 4.5,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.5,
        c: PALETTE[(Math.random() * PALETTE.length) | 0],
        s: Math.random() > 0.5 ? 1 : 0.5,
        life: 1,
      });
    }
  }

  private _bigBurst(): void {
    const w = this._confetti.width;
    const h = this._confetti.height;
    const ox = w / 2;
    const oy = h / 2;
    this._emit(ox, oy, 260, 16);
    this._emit(ox, oy, 160, 9);
    window.setTimeout(() => {
      if (!this.classList.contains("open")) return;
      this._emit(ox + w * 0.18, oy - h * 0.06, 120, 12);
      this._emit(ox - w * 0.18, oy - h * 0.04, 120, 12);
    }, 120);
    window.setTimeout(() => {
      if (!this.classList.contains("open")) return;
      this._emit(ox, oy + h * 0.04, 120, 11);
    }, 260);
  }

  private _stepConfetti(t: number): void {
    if (t - this._lastBurst > BURST_EVERY_MS) {
      this._bigBurst();
      this._lastBurst = t;
    }
    const cx = this._cctx;
    cx.clearRect(0, 0, this._confetti.width, this._confetti.height);
    for (let i = this._parts.length - 1; i >= 0; i--) {
      const p = this._parts[i];
      p.vx *= 0.97; p.vy *= 0.97; p.vy += 0.16;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.009;
      if (p.life <= 0 || p.y > this._confetti.height + 24) {
        this._parts.splice(i, 1);
        continue;
      }
      cx.save();
      cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      cx.fillRect(-p.r, -p.r * p.s, p.r * 2, p.r * 2 * p.s);
      cx.restore();
    }
  }

  // ── Simulation Pong ───────────────────────────────────────

  private _resetPong(): void {
    const H = this._pong.height;
    const W = this._pong.width;
    this._bx = W / 2; this._by = H / 2;
    this._bvx = 2.6; this._bvy = 1.8;
    this._lY = H / 2 - 22; this._rY = H / 2 - 22;
  }

  private _aim(y: number, target: number, ph: number): number {
    const c = y + ph / 2;
    if (target < c - 6) return y - 2.4;
    if (target > c + 6) return y + 2.4;
    return y;
  }

  private _stepPong(): void {
    const px = this._pctx;
    const W = this._pong.width;
    const H = this._pong.height;
    const pad = 7;
    const ph = 44;
    const br = 5;

    px.fillStyle = "#0b0e0c";
    px.fillRect(0, 0, W, H);
    px.strokeStyle = "#1c2a22";
    px.setLineDash([5, 7]);
    px.beginPath(); px.moveTo(W / 2, 0); px.lineTo(W / 2, H); px.stroke();
    px.setLineDash([]);

    this._bx += this._bvx; this._by += this._bvy;
    if (this._by < br || this._by > H - br) this._bvy = -this._bvy;
    if (this._bx - br < pad + 8 && this._by > this._lY && this._by < this._lY + ph) {
      this._bvx = Math.abs(this._bvx);
      this._bvy += (this._by - (this._lY + ph / 2)) * 0.04;
    }
    if (this._bx + br > W - pad - 8 && this._by > this._rY && this._by < this._rY + ph) {
      this._bvx = -Math.abs(this._bvx);
      this._bvy += (this._by - (this._rY + ph / 2)) * 0.04;
    }
    if (this._bx < 0 || this._bx > W) {
      this._bx = W / 2; this._by = H / 2;
      this._bvx = (Math.random() > 0.5 ? 1 : -1) * 2.6;
      this._bvy = (Math.random() - 0.5) * 3;
    }
    this._lY = Math.max(0, Math.min(H - ph, this._aim(this._lY, this._bvx < 0 ? this._by : H / 2, ph)));
    this._rY = Math.max(0, Math.min(H - ph, this._aim(this._rY, this._bvx > 0 ? this._by : H / 2, ph)));

    px.fillStyle = "#5dffba";
    px.fillRect(pad, this._lY, 5, ph);
    px.fillRect(W - pad - 5, this._rY, 5, ph);
    px.beginPath(); px.arc(this._bx, this._by, br, 0, 6.29); px.fill();
  }
}

customElements.define("chuck-foundations-celebration", ChuckFoundationsCelebration);