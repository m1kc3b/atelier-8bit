/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-public-profile.ts
   Page publique d'un joueur : /u/{github_login}

   Vitrine en lecture seule du compte (pseudo, bio, palmarès défis).
   Servi par le même index.html que l'IDE (SPA fallback Cloudflare) : le
   bootstrap (main.ts) détecte le path /u/... et monte ce composant en
   plein écran à la place de l'atelier. Chargé en import dynamique — aucun
   coût tant qu'on n'ouvre pas une page profil.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import { profileService } from "../features/profile/profile-service.js";
import type { PublicProfile } from "../types/defi.js";

export class ChuckPublicProfile extends ChuckComponent {
  private _login = "";
  private _profile: PublicProfile | null = null;
  private _state: "loading" | "ready" | "notfound" = "loading";

  /** Attribut `login` = segment d'URL après /u/. */
  static get observedAttributes(): string[] {
    return ["login"];
  }

  attributeChangedCallback(name: string, _old: string, val: string): void {
    if (name === "login" && val && val !== this._login) {
      this._login = val;
      void this._load();
    }
  }

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="wrap" id="wrap">${this._body()}</div>`;
    this.shadow
      .getElementById("home-btn")
      ?.addEventListener("click", () => {
        window.location.href = "/";
      });
  }

  protected setup(): void {
    // login peut être passé en attribut avant connexion : déclenche le load.
    const attr = this.getAttribute("login");
    if (attr && !this._login) {
      this._login = attr;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    this._state = "loading";
    this._rerender();
    const profile = await profileService.getByLogin(this._login);
    this._profile = profile;
    this._state = profile ? "ready" : "notfound";
    this._rerender();
  }

  private _rerender(): void {
    const wrap = this.shadow.getElementById("wrap");
    if (wrap) wrap.innerHTML = this._body();
    this.shadow
      .getElementById("home-btn")
      ?.addEventListener("click", () => {
        window.location.href = "/";
      });
  }

  private _body(): string {
    if (this._state === "loading") {
      return `<div class="card"><div class="muted">Chargement du profil…</div></div>`;
    }
    if (this._state === "notfound" || !this._profile) {
      return `<div class="card">
        <div class="icon">🕵️</div>
        <div class="title">Profil introuvable</div>
        <div class="muted">Aucun joueur connu sous « ${this._esc(this._login)} ».</div>
        <button class="home" id="home-btn">Retour à l'atelier</button>
      </div>`;
    }

    const p = this._profile;
    const name = p.displayName || this._login;
    const stats: string[] = [];
    if (p.defisEntered != null)
      stats.push(`<div class="stat"><span class="num">${p.defisEntered}</span><span class="lbl">défis</span></div>`);
    if (p.bestRank != null)
      stats.push(`<div class="stat"><span class="num">#${p.bestRank}</span><span class="lbl">meilleur rang</span></div>`);

    return `<div class="card">
      <div class="avatar">${this._esc(name.charAt(0).toUpperCase())}</div>
      <div class="title">${this._esc(name)}</div>
      <div class="handle">@${this._esc(this._login)}</div>
      ${p.bio ? `<div class="bio">${this._esc(p.bio)}</div>` : ""}
      ${stats.length ? `<div class="stats">${stats.join("")}</div>` : ""}
      <button class="home" id="home-btn">Retour à l'atelier</button>
    </div>`;
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

const STYLES = `
  @import url('/src/styles/tokens.css');
  :host {
    position:fixed; inset:0; z-index:8000; display:flex;
    align-items:center; justify-content:center;
    background:var(--bg, #0d0f14); font-family:var(--font-ui);
  }
  .card {
    width:380px; max-width:90vw; padding:32px 28px;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--modal-radius, 14px); text-align:center;
    box-shadow:var(--modal-shadow, 0 20px 60px rgba(0,0,0,.5));
  }
  .avatar {
    width:72px; height:72px; margin:0 auto 16px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:30px; font-weight:800; color:#1a1206;
    background:var(--mode-defi, var(--amber, #f5b428));
  }
  .icon { font-size:34px; margin-bottom:10px; }
  .title { font-size:19px; font-weight:700; color:var(--text); }
  .handle { font-size:12px; color:var(--text-muted); margin-top:2px; }
  .bio { font-size:13px; color:var(--text-dim); margin-top:14px; line-height:1.5; }
  .stats { display:flex; gap:24px; justify-content:center; margin-top:22px; }
  .stat { display:flex; flex-direction:column; gap:2px; }
  .stat .num { font-size:20px; font-weight:800; color:var(--accent, #38BDF8); }
  .stat .lbl { font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
  .muted { font-size:13px; color:var(--text-muted); margin-top:8px; }
  .home {
    margin-top:24px; padding:9px 18px; border-radius:8px; cursor:pointer;
    background:var(--surface-3); border:1px solid var(--border);
    color:var(--text-dim); font-size:12px; font-family:var(--font-ui);
  }
  .home:hover { color:var(--text); border-color:var(--accent, #38BDF8); }
`;

customElements.define("chuck-public-profile", ChuckPublicProfile);