/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-onboarding-tour.ts
   Mini tutoriel pas-à-pas affiché quand l'utilisateur choisit
   "Mode libre" à l'accueil :
     1) Clique sur Assembler
     2) Clique sur Run
     3) Le programme s'exécute → fenêtre Registres & Débogueur
   Ne bloque rien : overlay pointer-events:none, seule la bulle
   de texte est cliquable (bouton "Passer" / "Compris").
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";

type StepId = "assemble" | "run" | "debug";

interface Step {
  id: StepId;
  text: string;
  getTarget: () => Element | null;
}

const STYLES = /* css */ `
  @import '/src/styles/tokens.css';

  :host {
    position: fixed;
    inset: 0;
    z-index: 8700;
    display: none;
    pointer-events: none;
    font-family: var(--font-ui);
  }
  :host(.open) { display: block; }

  .ring {
    position: fixed;
    opacity: 1;
    border: 2px solid var(--accent);
    border-radius: 10px;
    box-shadow: 0 0 0 4px rgba(124,106,247,.18), 0 0 24px rgba(124,106,247,.35);
    transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease, opacity .2s ease;
    pointer-events: none;
  }

  .bubble {
    position: fixed;
    width: 250px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--modal-radius);
    box-shadow: var(--modal-shadow);
    padding: 14px 16px;
    pointer-events: auto;
    transition: top .25s ease, left .25s ease;
  }
  .bubble::before {
    content: '';
    position: absolute;
    top: -7px; left: 18px;
    width: 12px; height: 12px;
    background: var(--surface);
    border-left: 1px solid var(--border);
    border-top: 1px solid var(--border);
    transform: rotate(45deg);
  }
  .step-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: var(--accent); margin-bottom: 6px;
  }
  .bubble p { font-size: 12.5px; line-height: 1.55; color: var(--text); margin: 0 0 10px; }
  .bubble-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .skip {
    font-size: 11px; color: var(--text-muted); cursor: pointer; background: none;
    border: none; padding: 0; text-decoration: underline;
  }
  .skip:hover { color: var(--text-dim); }
  .done-btn {
    padding: 7px 12px; border-radius: 6px;
    background: var(--accent); color: #fff; font-weight: 600; font-size: 11.5px;
    border: none; cursor: pointer; flex-shrink: 0;
  }
`;

const SEEN_KEY = "chuck8_tour_seen";

const STEPS: Step[] = [
  {
    id: "assemble",
    text: "Clique sur <strong>Assembler</strong> pour compiler ton code.",
    getTarget: () =>
      document
        .getElementById("toolbar")
        ?.shadowRoot?.querySelector('[data-action="assemble"]') ?? null,
  },
  {
    id: "run",
    text: "Clique sur <strong>Run</strong> pour exécuter le programme.",
    getTarget: () =>
      document
        .getElementById("toolbar")
        ?.shadowRoot?.querySelector('[data-action="run"]') ?? null,
  },
  {
    id: "debug",
    text: "Le programme s'exécute ! Suis les registres et la mémoire en direct dans la fenêtre Débogueur.",
    getTarget: () => document.getElementById("modal-registers"),
  },
];

export class ChuckOnboardingTour extends ChuckComponent {
  private _stepIndex = 0;
  private _raf = 0;
  private readonly _onResize = (): void => this._position();

  /** true si l'utilisateur a déjà passé ou terminé le tuto une fois. */
  static hasBeenSeen(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="ring" id="ring"></div>
      <div class="bubble" id="bubble">
        <div class="step-label" id="step-label"></div>
        <p id="step-text"></p>
        <div class="bubble-actions">
          <button class="skip" id="skip-btn">Passer le tuto</button>
          <button class="done-btn" id="done-btn" style="display:none">Compris →</button>
        </div>
      </div>`;
  }

  protected setup(): void {
    this.shadow
      .getElementById("skip-btn")!
      .addEventListener("click", () => this._end());
    this.shadow
      .getElementById("done-btn")!
      .addEventListener("click", () => this._end());

    this.sub("chuck:start-tour", () => this.start());
    this.sub("chuck:assembled", () => {
      if (this._isOpen() && STEPS[this._stepIndex]?.id === "assemble")
        this._next();
    });
    this.sub("chuck:run", () => {
      if (this._isOpen() && STEPS[this._stepIndex]?.id === "run")
        this._next();
    });

    window.addEventListener("resize", this._onResize);
  }

  protected teardown(): void {
    window.removeEventListener("resize", this._onResize);
    cancelAnimationFrame(this._raf);
  }

  start(): void {
    this._stepIndex = 0;
    this.classList.add("open");
    this._renderStep();
  }

  private _isOpen(): boolean {
    return this.classList.contains("open");
  }

  private _next(): void {
    if (this._stepIndex >= STEPS.length - 1) return;
    this._stepIndex++;
    this._renderStep();
  }

  private _end(): void {
    this.classList.remove("open");
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* localStorage indisponible — pas bloquant */
    }
  }

  private _renderStep(): void {
    const step = STEPS[this._stepIndex]!;
    const label = this.shadow.getElementById("step-label")!;
    const text = this.shadow.getElementById("step-text")!;
    const doneBtn = this.shadow.getElementById("done-btn") as HTMLButtonElement;

    label.textContent = `Étape ${this._stepIndex + 1} / ${STEPS.length}`;
    text.innerHTML = step.text;
    doneBtn.style.display = step.id === "debug" ? "block" : "none";

    if (step.id === "debug") {
      // main.ts ouvre la fenêtre Registres (ensureOpen) sur ce même événement
      // chuck:run — on laisse un court délai pour que sa classe .visible
      // soit posée avant de mesurer sa position.
      setTimeout(() => this._position(), 80);
      setTimeout(() => {
        if (this._isOpen() && STEPS[this._stepIndex]?.id === "debug")
          this._end();
      }, 9000);
    } else {
      this._position();
    }
  }

  private _position(): void {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => {
      const step = STEPS[this._stepIndex];
      const target = step?.getTarget();
      const ring = this.shadow.getElementById("ring") as HTMLElement;
      const bubble = this.shadow.getElementById("bubble") as HTMLElement;
      if (!target) {
        ring.style.opacity = "0";
        return;
      }

      const r = target.getBoundingClientRect();
      ring.style.opacity = "1";
      ring.style.top = `${r.top - 4}px`;
      ring.style.left = `${r.left - 4}px`;
      ring.style.width = `${r.width + 8}px`;
      ring.style.height = `${r.height + 8}px`;

      const bubbleW = 250;
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - bubbleW - 8,
      );
      let top = r.bottom + 14;
      if (top + 140 > window.innerHeight) top = Math.max(8, r.top - 150);

      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    });
  }
}

customElements.define("chuck-onboarding-tour", ChuckOnboardingTour);