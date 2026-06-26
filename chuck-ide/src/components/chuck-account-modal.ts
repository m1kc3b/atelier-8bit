import { ChuckComponent } from "../core/base-component.js";
import { authService } from "../core/auth/auth-service.js";
import { challengesService } from "../core/challenges/challenges-service.js";
import { storage } from "../core/storage/storage-service.js";

type Tab = "profile" | "medals";

export class ChuckAccountModal extends ChuckComponent {
  private _tab: Tab = "profile";
  private _challengeTitles = new Map<number, string>();

  protected render(): void {
    this.shadow.innerHTML = `<style>@import '/src/styles/tokens.css';
      :host { position:fixed; inset:0; z-index:9000; display:none;
              align-items:center; justify-content:center;
              background:rgba(0,0,0,.7); font-family:var(--font-ui); }
      :host(.open) { display:flex; }
      .modal { position:relative; width:520px; max-height:80vh;
               background:var(--surface); border:1px solid var(--border);
               border-radius:var(--modal-radius); display:flex; flex-direction:column;
               overflow:hidden; box-shadow:var(--modal-shadow); }
      .header { display:flex; align-items:center; padding:16px 20px;
                border-bottom:1px solid var(--border); flex-shrink:0; }
      .header h2 { font-size:15px; color:var(--text); flex:1; }
      .header .email { font-size:11px; color:var(--text-muted); margin-right:12px; }
      .close-btn { width:24px; height:24px; border-radius:50%; background:var(--surface-3);
                   border:none; color:var(--text-muted); font-size:13px; display:flex;
                   align-items:center; justify-content:center; cursor:pointer;
                   transition:background var(--t-fast), color var(--t-fast); flex-shrink:0; }
      .close-btn:hover { background:var(--red); color:#fff; }
      .tabs { display:flex; gap:4px; padding:10px 20px 0; border-bottom:1px solid var(--border); flex-shrink:0; }
      .tab-btn { padding:8px 12px; font-size:12px; color:var(--text-muted); background:none;
                 border:none; border-bottom:2px solid transparent; cursor:pointer; }
      .tab-btn:hover { color:var(--text); }
      .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
      .body { padding:20px; overflow-y:auto; flex:1; }
      .field { margin-bottom:14px; }
      .field label { display:block; font-size:11px; color:var(--text-dim); margin-bottom:6px; }
      .field .row { display:flex; gap:8px; }
      .field input { flex:1; height:34px; padding:0 10px; background:var(--surface-3);
                     border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:13px; }
      button.action { padding:7px 14px; border-radius:6px; background:var(--accent);
                      color:#fff; font-size:12px; font-weight:600; border:none; cursor:pointer; flex-shrink:0; }
      button.action:hover { opacity:.9; }
      .msg { font-size:11px; margin-top:6px; min-height:14px; }
      .msg.ok { color:var(--green); }
      .msg.err { color:var(--red); }
      .signout { margin-top:20px; padding-top:16px; border-top:1px solid var(--border); }
      .signout button { width:100%; padding:9px; border-radius:6px; background:var(--surface-3);
                         border:1px solid var(--border); color:var(--text-dim); font-size:12px; cursor:pointer; }
      .signout button:hover { color:var(--red); border-color:var(--red); }
      .empty { color:var(--text-muted); font-size:12px; text-align:center; padding:30px 0; }
      .medal-row {
        display:flex; align-items:center; gap:10px; padding:10px 0;
        border-bottom:1px solid var(--border);
      }
      .medal-row:last-child { border-bottom:none; }
      .medal-icon { font-size:16px; width:24px; text-align:center; flex-shrink:0; }
      .medal-title { flex:1; font-size:13px; color:var(--text); }
      .medal-summary { display:flex; gap:16px; padding:0 0 18px; font-size:12px; color:var(--text-dim); flex-wrap:wrap; }
      .medal-summary span { font-weight:700; color:var(--text); }
    </style>
    <div class="modal">
      <div class="header">
        <h2>Mon compte</h2>
        <span class="email" id="header-email"></span>
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="profile">Profil</button>
        <button class="tab-btn" data-tab="medals">Mes médailles</button>
      </div>
      <div class="body" id="body"></div>
    </div>`;
  }

  protected setup(): void {
    this.shadow
      .getElementById("close-btn")!
      .addEventListener("click", () => this.close());
    this.shadow
      .querySelectorAll<HTMLButtonElement>(".tab-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () =>
          this._switchTab(btn.dataset["tab"] as Tab),
        );
      });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.classList.contains("open")) this.close();
    });
  }

  async open(): Promise<void> {
    this._tab = "profile";
    this.classList.add("open");
    const user = authService.getUser();
    (this.shadow.getElementById("header-email") as HTMLElement).textContent =
      user?.email ?? "";
    this._resetTabs();
    await this._loadData();
    this._renderBody();
  }

  close(): void {
    this.classList.remove("open");
  }

  private _resetTabs(): void {
    this.shadow
      .querySelectorAll<HTMLButtonElement>(".tab-btn")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset["tab"] === "profile");
      });
  }

  private async _loadData(): Promise<void> {
    if (this._challengeTitles.size === 0) {
      const list = await challengesService.getAll();
      for (const c of list) this._challengeTitles.set(c.id, c.title);
    }
  }

  private _switchTab(tab: Tab): void {
    this._tab = tab;
    this.shadow
      .querySelectorAll<HTMLButtonElement>(".tab-btn")
      .forEach((btn) => {
        btn.classList.toggle("active", btn.dataset["tab"] === tab);
      });
    this._renderBody();
  }

  private _renderBody(): void {
    const body = this.shadow.getElementById("body")!;
    if (this._tab === "profile") body.innerHTML = this._renderProfile();
    else body.innerHTML = this._renderMedals();
    this._bindBodyEvents();
  }

  // ── Profil ──────────────────────────────────────────────
  private _renderProfile(): string {
    const user = authService.getUser();
    return `
      <div class="field">
        <label>Adresse email</label>
        <div class="row">
          <input id="email-input" type="email" value="${user?.email ?? ""}">
          <button class="action" id="save-email-btn">Mettre à jour</button>
        </div>
        <div class="msg" id="email-msg"></div>
      </div>
      <div class="field">
        <label>Nouveau mot de passe</label>
        <div class="row">
          <input id="password-input" type="password" placeholder="••••••••">
          <button class="action" id="save-password-btn">Mettre à jour</button>
        </div>
        <div class="msg" id="password-msg"></div>
      </div>
      <div class="signout">
        <button id="signout-btn">Se déconnecter</button>
      </div>`;
  }

  // ── Médailles ───────────────────────────────────────────
  private _renderMedals(): string {
    const progress = storage.getAllProgress();
    const entries = Object.values(progress)
      .filter((p) => !!p.medal)
      .sort((a, b) => a.challengeId - b.challengeId);

    const counts: Record<string, number> = { "🥇": 0, "🥈": 0, "🥉": 0 };
    entries.forEach((e) => {
      if (e.medal) counts[e.medal] = (counts[e.medal] ?? 0) + 1;
    });

    const summary = `
      <div class="medal-summary">
        <div>🥇 <span>${counts["🥇"]}</span></div>
        <div>🥈 <span>${counts["🥈"]}</span></div>
        <div>🥉 <span>${counts["🥉"]}</span></div>
        <div><span>${entries.length}</span> défi(s) validé(s)</div>
      </div>`;

    if (entries.length === 0) {
      return (
        summary + `<div class="empty">Aucun défi validé pour le moment.</div>`
      );
    }

    const rows = entries
      .map((e) => {
        const title =
          this._challengeTitles.get(e.challengeId) ?? `Défi #${e.challengeId}`;
        return `
        <div class="medal-row">
          <span class="medal-icon">${e.medal}</span>
          <span class="medal-title">${title}</span>
        </div>`;
      })
      .join("");

    return summary + rows;
  }

  // ── Events du body (re-bindés à chaque render) ──────────
  private _bindBodyEvents(): void {
    const body = this.shadow.getElementById("body")!;

    body
      .querySelector("#save-email-btn")
      ?.addEventListener("click", () => this._saveEmail());
    body
      .querySelector("#save-password-btn")
      ?.addEventListener("click", () => this._savePassword());
    body
      .querySelector("#signout-btn")
      ?.addEventListener("click", () => this._signOut());
  }

  private async _saveEmail(): Promise<void> {
    const input = this.shadow.getElementById("email-input") as HTMLInputElement;
    const msg = this.shadow.getElementById("email-msg")!;
    const { error } = await authService.updateEmail(input.value.trim());
    msg.className = "msg " + (error ? "err" : "ok");
    msg.textContent = error ?? "Email de confirmation envoyé.";
  }

  private async _savePassword(): Promise<void> {
    const input = this.shadow.getElementById(
      "password-input",
    ) as HTMLInputElement;
    const msg = this.shadow.getElementById("password-msg")!;
    if (input.value.length < 6) {
      msg.className = "msg err";
      msg.textContent = "6 caractères minimum.";
      return;
    }
    const { error } = await authService.updatePassword(input.value);
    msg.className = "msg " + (error ? "err" : "ok");
    msg.textContent = error ?? "Mot de passe mis à jour.";
    input.value = "";
  }

  private async _signOut(): Promise<void> {
    await authService.signOut();
    this.close();
    this.emit("chuck:signed-out", undefined);
  }
}

customElements.define("chuck-account-modal", ChuckAccountModal);