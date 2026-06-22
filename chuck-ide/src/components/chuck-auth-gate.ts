import { ChuckComponent } from "../core/base-component.js";
import { authService } from "../core/auth/auth-service.js";

type Mode = "signin" | "signup";

/** Options d'ouverture de la gate. Le copy (title/sub) est fourni par
 *  l'appelant pour s'adapter au contexte (défi verrouillé, sauvegarde,
 *  nouveau projet, Pong, compte…). */
export interface AuthGateOpenOptions {
  /** Défi à charger après authentification. Défaut : 4. */
  challengeId?: number;
  /** Titre affiché en mode "signin". Défaut : copy générique. */
  title?: string;
  /** Sous-titre affiché en mode "signin". Défaut : copy générique. */
  sub?: string;
  /** Affiche le bouton de fermeture. Défaut : false (gate bloquante).
   *  Seule la connexion volontaire (clic « Mon compte ») doit passer true,
   *  sinon l'utilisateur pourrait poursuivre les défis sans jamais s'authentifier. */
  dismissible?: boolean;
}

/** Copy par défaut si l'appelant n'en fournit pas. */
const DEFAULT_GATE_COPY = {
  title: "Sauvegarde ta progression",
  sub: "Crée un compte pour retrouver tes réalisations et continuer.",
} as const;

export class ChuckAuthGate extends ChuckComponent {
  private _pendingChallengeId = 4;
  private _mode: Mode = "signin";
  /** true entre une connexion/inscription réussie et le close() qui suit,
   *  pour ne pas compter une conversion comme un abandon. */
  private _converted = false;

  protected render(): void {
    this.shadow.innerHTML = `<style>@import '/src/styles/tokens.css';
      :host { position:fixed; inset:0; z-index:9000; display:none;
              align-items:center; justify-content:center;
              background:rgba(0,0,0,.7); }
      :host(.open) { display:flex; }
      .modal { position:relative; width:360px; background:var(--surface);
               border:1px solid var(--border); border-radius:var(--modal-radius);
               padding:28px; font-family:var(--font-ui); }
      .close-btn { position:absolute; top:14px; right:14px; width:24px; height:24px;
                   border-radius:50%; background:var(--surface-3); border:none;
                   color:var(--text-muted); font-size:13px; display:flex;
                   align-items:center; justify-content:center; cursor:pointer;
                   transition:background var(--t-fast), color var(--t-fast); }
      .close-btn:hover { background:var(--red); color:#fff; }
      h2 { font-size:16px; margin-bottom:6px; color:var(--text); }
      p.sub { color:var(--text-dim); font-size:12px; margin-bottom:18px; }
      input { width:100%; height:36px; margin-bottom:10px; padding:0 10px;
              background:var(--surface-3); border:1px solid var(--border);
              border-radius:6px; color:var(--text); font-size:13px; }
      .forgot { text-align:right; margin:-4px 0 14px; }
      .forgot a { font-size:11px; color:var(--text-dim); cursor:pointer; }
      .forgot a:hover { color:var(--accent); }
      .error { color:var(--red); font-size:11px; min-height:14px; margin-bottom:8px; }
      button.submit { width:100%; height:38px; border-radius:6px; background:var(--accent);
                      color:#fff; font-weight:600; }
      .switch { text-align:center; margin-top:14px; font-size:12px; color:var(--text-dim); }
      .switch a { color:var(--accent); cursor:pointer; }
      .github-login-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width:100%; 
        height:38px;
        padding: 12px 24px;
        margin-top: 16px;
        background-color: #24292e; /* Couleur principale de GitHub */
        color: white;
        border: none;
        border-radius: 6px; /* Bordure légèrement arrondie */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-weight: 500;
        text-align: center;
        cursor: pointer;
        transition: background-color 0.2s ease, opacity 0.2s ease;
      }

      .github-login-button:hover {
        background-color: #1a1f2e; /* Couleur légèrement plus foncée au survol */
        opacity: 0.9;
      }

      .github-login-button:active {
        opacity: 0.8;
      }

      .github-login-button svg {
        width: 20px;
        height: 20px;
        fill: currentColor; /* Utilise la couleur du texte (blanc) */
      }
    </style>
    <div class="modal">
      <button class="close-btn" id="close-btn" title="Fermer">✕</button>
      <h2 id="title">Sauvegarde ta progression</h2>
      <p class="sub" id="sub">Crée un compte pour retrouver tes réalisations et continuer.</p>
      <form id="auth-form" autocomplete="on">
        <input id="email" name="email" type="email" placeholder="Email" autocomplete="username" required>
        <input id="password" name="password" type="password" placeholder="Mot de passe" autocomplete="current-password" required>
        <div class="forgot" id="forgot-wrap"><a id="forgot-link">Mot de passe oublié ?</a></div>
        <div class="error" id="error"></div>
        <button class="submit" type="submit" id="submit-btn">Se connecter</button>
      </form>

      <button id="github-btn" class="github-login-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="fill: white;">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
        Se connecter avec GitHub
      </button>

      <div class="switch">
        <span id="switch-text">Pas encore de compte ?</span>
        <a id="switch-link">Créer un compte</a>
      </div>
    </div>`;
  }

  protected setup(): void {
    const switchLink = this.shadow.getElementById("switch-link")!;
    const forgotLink = this.shadow.getElementById("forgot-link")!;

    this.shadow.getElementById("auth-form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      this._submit();
    });
    this.shadow.getElementById("github-btn")!.addEventListener("click", () => this.signInWithGithub());
    switchLink.addEventListener("click", () => this._toggleMode());
    forgotLink.addEventListener("click", () => this._forgotPassword());

    this.shadow
      .getElementById("close-btn")!
      .addEventListener("click", () => this.close());

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && this.classList.contains("open")) {
          e.stopImmediatePropagation();
          e.preventDefault();
          if (this._dismissible) this.close();
        }
      },
      { capture: true },
    );
  }

  /** Sous-titre du contexte courant — restauré quand on revient en mode "signin". */
  private _contextSub: string = DEFAULT_GATE_COPY.sub;

  /** true si l'utilisateur a le droit de fermer sans s'authentifier. */
  private _dismissible = false;

  open(opts: AuthGateOpenOptions = {}): void {
    const { challengeId = 4, title, sub, dismissible = false } = opts;
    this._pendingChallengeId = challengeId;
    this._converted = false;

    const titleEl = this.shadow.getElementById("title")!;
    const subEl = this.shadow.getElementById("sub")!;
    titleEl.textContent = title ?? DEFAULT_GATE_COPY.title;
    subEl.textContent = sub ?? DEFAULT_GATE_COPY.sub;
    this._contextSub = sub ?? DEFAULT_GATE_COPY.sub;

    // Bouton fermer visible uniquement pour une connexion volontaire.
    this._dismissible = dismissible;
    const closeBtn = this.shadow.getElementById("close-btn") as HTMLElement;
    closeBtn.style.display = dismissible ? "" : "none";

    // Toujours rouvrir en mode "signin".
    this._mode = "signin";

    this.classList.add("open");
    this.emit("chuck:funnel-step", {
      step: "gate-shown",
      meta: { challengeId },
    });
  }

  close(): void {
    // Gate bloquante : seule une authentification réussie (_converted) peut
    // la fermer. Un clic « fermer » n'existe que si dismissible.
    if (!this._dismissible && !this._converted) return;

    this.classList.remove("open");
    if (!this._converted) {
      this.emit("chuck:funnel-step", {
        step: "gate-abandoned",
        meta: { challengeId: this._pendingChallengeId },
      });
    }
  }

  async signInWithGithub(): Promise<void> {
    const { error } = await authService.signInWithGithub();    
    if (error) {
      const errorEl = this.shadow.getElementById("error")!;
      errorEl.style.color = "var(--red)";
      errorEl.textContent = "";
      errorEl.textContent = error;
      return;
    }
  }

  static isUnlocked(): boolean {
    return authService.isAuthenticated();
  }

  private _toggleMode(): void {
    this._mode = this._mode === "signin" ? "signup" : "signin";
    const title = this.shadow.getElementById("title")!;
    const sub = this.shadow.getElementById("sub")!;
    const submitBtn = this.shadow.getElementById("submit-btn")!;
    const switchText = this.shadow.getElementById("switch-text")!;
    const switchLink = this.shadow.getElementById("switch-link")!;
    const forgotWrap = this.shadow.getElementById("forgot-wrap") as HTMLElement;

    if (this._mode === "signup") {
      title.textContent = "Crée ton compte";
      sub.textContent =
        "Gratuit. Ta progression et tes réalisations sont sauvegardées.";
      submitBtn.textContent = "S'inscrire";
      switchText.textContent = "Déjà un compte ?";
      switchLink.textContent = "Se connecter";
      forgotWrap.style.display = "none";
    } else {
      title.textContent = DEFAULT_GATE_COPY.title;
      sub.textContent = this._contextSub;
      submitBtn.textContent = "Se connecter";
      switchText.textContent = "Pas encore de compte ?";
      switchLink.textContent = "Créer un compte";
      forgotWrap.style.display = "block";
    }
  }

  private async _submit(): Promise<void> {
    const email = (
      this.shadow.getElementById("email") as HTMLInputElement
    ).value.trim();
    const password = (
      this.shadow.getElementById("password") as HTMLInputElement
    ).value;
    const errorEl = this.shadow.getElementById("error")!;
    errorEl.style.color = "var(--red)";
    errorEl.textContent = "";

    if (!email || !password) {
      errorEl.textContent = "Email et mot de passe requis.";
      return;
    }

    const { error } =
      this._mode === "signup"
        ? await authService.signUp(email, password)
        : await authService.signIn(email, password);

    if (error) {
      errorEl.textContent = error;
      return;
    }

    this._converted = true;
    this.emit("chuck:funnel-step", {
      step: "gate-converted",
      meta: { challengeId: this._pendingChallengeId, mode: this._mode },
    });
    this.close();
    this.emit("chuck:goto-challenge", { id: this._pendingChallengeId });
  }

  private async _forgotPassword(): Promise<void> {
    const email = (
      this.shadow.getElementById("email") as HTMLInputElement
    ).value.trim();
    const errorEl = this.shadow.getElementById("error")!;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.style.color = "var(--red)";
      errorEl.textContent = "Entre ton email ci-dessus avant de cliquer.";
      return;
    }

    const { error } = await authService.resetPasswordForEmail(email);
    errorEl.style.color = error ? "var(--red)" : "var(--green)";
    errorEl.textContent = error ?? "Email de réinitialisation envoyé.";
  }
}

customElements.define("chuck-auth-gate", ChuckAuthGate);
