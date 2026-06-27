import { ChuckComponent } from "../core/base-component.js";
import { authService } from "../features/auth/auth-service.js";

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
  /** URL de retour après OAuth. Défaut : origine + ?challenge=<challengeId>. */
  redirectTo?: string;
}

/** Copy par défaut si l'appelant n'en fournit pas. */
const DEFAULT_GATE_COPY = {
  title: "Sauvegarde ta progression",
  sub: "Crée un compte pour retrouver tes réalisations et continuer.",
} as const;

export class ChuckAuthGate extends ChuckComponent {
  private _pendingChallengeId = 4;
  private _redirectTo: string | null = null;

  /** Le formulaire est rendu dans le LIGHT DOM (projeté via <slot>) pour que
   *  Proton Pass et les autres gestionnaires de mots de passe puissent détecter
   *  et remplir les champs — ils ne traversent pas le Shadow DOM. La coquille
   *  (overlay + carte) est rendue dans le Shadow DOM. */
  private _shadowEl<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.shadow.getElementById(id) as T;
  }
  private _lightEl<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.querySelector(`#${id}`) as T;
  }

  /** CSS des éléments projetés (light DOM) : ::slotted ne pouvant styler que
   *  les enfants directs projetés, les règles des champs/boutons internes au
   *  <form> sont injectées une seule fois dans <head>. Déterministe, avec
   *  fallback sur chaque var(). */
  private static _stylesInjected = false;
  private static _injectLightStyles(): void {
    if (ChuckAuthGate._stylesInjected) return;
    ChuckAuthGate._stylesInjected = true;
    const style = document.createElement("style");
    style.id = "chuck-auth-gate-light-styles";
    style.textContent = `
      chuck-auth-gate form#auth-form { margin:0; }
      chuck-auth-gate #auth-form input { width:100%; height:36px; margin-bottom:10px; padding:0 10px;
              background:var(--surface-3, #272727); border:1px solid var(--border, #2a2a2a);
              border-radius:6px; color:var(--text, #e2e2e2); font-size:13px; box-sizing:border-box; }
      chuck-auth-gate .forgot { text-align:right; margin:-4px 0 14px; }
      chuck-auth-gate .forgot a { font-size:11px; color:var(--text-dim, #bebbbb); cursor:pointer; }
      chuck-auth-gate .forgot a:hover { color:var(--accent, #7c6af7); }
      chuck-auth-gate .error { color:var(--red, #f87171); font-size:11px; min-height:14px; margin-bottom:8px; }
      chuck-auth-gate button.submit { width:100%; height:38px; border-radius:6px;
                      background:var(--accent, #7c6af7); color:#fff; font-weight:600;
                      border:none; cursor:pointer; }
      chuck-auth-gate .switch { text-align:center; margin-top:14px; font-size:12px; color:var(--text-dim, #bebbbb); }
      chuck-auth-gate .switch a { color:var(--accent, #7c6af7); cursor:pointer; }
      chuck-auth-gate .github-login-button {
        display:inline-flex; align-items:center; justify-content:center; gap:8px;
        width:100%; height:38px; padding:12px 24px; margin-top:16px;
        background-color:#24292e; color:white; border:none; border-radius:6px;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        font-weight:500; text-align:center; cursor:pointer;
        transition:background-color .2s ease, opacity .2s ease; }
      chuck-auth-gate .github-login-button:hover { background-color:#1a1f2e; opacity:.9; }
      chuck-auth-gate .github-login-button:active { opacity:.8; }
      chuck-auth-gate .github-login-button svg { width:20px; height:20px; fill:currentColor; }
    `;
    document.head.appendChild(style);
  }

  protected render(): void {
    ChuckAuthGate._injectLightStyles();

    // Coquille dans le Shadow DOM : overlay + carte + <slot> qui projette le
    // formulaire light DOM (visible pour les gestionnaires de mots de passe).
    this.shadow.innerHTML = `<style>
      :host { position:fixed; inset:0; z-index:9800; display:none;
              align-items:center; justify-content:center;
              background:rgba(0,0,0,.7); }
      :host(.open) { display:flex; }
      .modal { position:relative; width:360px;
               background:var(--surface, #161616);
               border:1px solid var(--border, #2a2a2a);
               border-radius:var(--modal-radius, 10px);
               padding:28px; font-family:var(--font-ui, 'Inter', sans-serif); box-sizing:border-box; }
      .close-btn { position:absolute; top:14px; right:14px; width:24px; height:24px;
                   border-radius:50%; background:var(--surface-3, #272727); border:none;
                   color:var(--text-muted, #8f8e8e); font-size:13px; display:flex;
                   align-items:center; justify-content:center; cursor:pointer;
                   transition:background var(--t-fast, .1s ease), color var(--t-fast, .1s ease); }
      .close-btn:hover { background:var(--red, #f87171); color:#fff; }
      ::slotted(h2) { font-size:16px; margin:0 0 6px; color:var(--text, #e2e2e2); }
      ::slotted(p.sub) { color:var(--text-dim, #bebbbb); font-size:12px; margin:0 0 18px; }
      /* Les champs et boutons projetés sont stylés via le <style> light DOM
         injecté dans <head> (::slotted ne traverse pas les sous-arbres). */
    </style>
    <div class="modal">
      <button class="close-btn" id="close-btn" title="Fermer">\u2715</button>
      <slot></slot>
    </div>`;

    // Formulaire dans le LIGHT DOM (projeté via le <slot> ci-dessus).
    this.innerHTML = `
      <h2 id="title">Sauvegarde ta progression</h2>
      <p class="sub" id="sub">Cr\u00e9e un compte pour retrouver tes r\u00e9alisations et continuer.</p>
      

      <button id="github-btn" class="github-login-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="fill: white;">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
        Se connecter avec GitHub
      </button>`;
  }

  protected setup(): void {
    this._lightEl("github-btn").addEventListener("click", () => this.signInWithGithub());

    this._shadowEl("close-btn").addEventListener("click", () => this.close());

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

  /** true si l'utilisateur a le droit de fermer sans s'authentifier. */
  private _dismissible = false;

  open(opts: AuthGateOpenOptions = {}): void {
    const { challengeId = 4, title, sub, dismissible = false } = opts;
    this._pendingChallengeId = challengeId;
    this._redirectTo = opts.redirectTo ?? null;

    const titleEl = this._lightEl("title");
    const subEl = this._lightEl("sub");
    titleEl.textContent = title ?? DEFAULT_GATE_COPY.title;
    subEl.textContent = sub ?? DEFAULT_GATE_COPY.sub;

    // Bouton fermer visible uniquement pour une connexion volontaire.
    this._dismissible = dismissible;
    const closeBtn = this._shadowEl("close-btn");
    closeBtn.style.display = dismissible ? "" : "none";

    this.classList.add("open");
  }

  close(): void {
    // Gate bloquante : seule une authentification réussie (redirection OAuth)
    // peut la fermer. Un clic « fermer » n'existe que si dismissible.
    if (!this._dismissible) return;
    this.classList.remove("open");
  }

  async signInWithGithub(): Promise<void> {
    // Au retour OAuth la page est rechargée : on encode le tuto à lancer
    // dans l'URL de retour (?challenge=<id>), relue au boot par le manager.
    const redirectTo =
      this._redirectTo ??
      `${window.location.origin}/?challenge=${this._pendingChallengeId}`;

    const { error } = await authService.signInWithGithub({ redirectTo });
    if (error) {
      const errorEl = this._lightEl("error");
      if (errorEl) {
        errorEl.style.color = "var(--red)";
        errorEl.textContent = error;
      }
      return;
    }
  }

  static isUnlocked(): boolean {
    return authService.isAuthenticated();
  }
}

customElements.define("chuck-auth-gate", ChuckAuthGate);