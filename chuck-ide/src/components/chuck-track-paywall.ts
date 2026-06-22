/* ─────────────────────────────────────────────────────────────
   Chuck IDE — components/chuck-track-paywall.ts

   Mur premium générique d'un parcours guidé (Étape 4 du funnel).
   Affiché à la fin des étapes gratuites d'un parcours : félicite
   l'utilisateur, puis présente l'offre premium du parcours.

   Mur à UN seul étage : bouton « acheter » → émet une intention
   d'achat (chuck:track-purchase-requested { trackId }) traitée par
   le backend. Aucun lien Stripe ni capture email côté front.

   100 % data-driven : titre, accroche, nom/prix/perks de l'offre
   proviennent de la config du parcours reçue via chuck:track-completed.

   Émet les étapes funnel : premium-wall-shown, premium-pay-clicked.
   ───────────────────────────────────────────────────────────── */

import { ChuckComponent } from "../core/base-component.js";
import type { TrackConfig, TrackPerk } from "../core/challenges/tracks-service.js";

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
  .stage-msg { font-size: 11.5px; min-height: 14px; margin-bottom: 10px; }
  .stage-msg.ok  { color: var(--green); }
  .stage-msg.err { color: var(--red); }

  .secondary-link {
    display: block; margin-top: 4px; font-size: 12px; color: var(--text-muted); cursor: pointer;
  }
  .secondary-link:hover { color: var(--text); }
`;

export class ChuckTrackPaywall extends ChuckComponent {
  private _trackId = "";
  private _trackName = "";
  private _config: TrackConfig | null = null;

  protected render(): void {
    this.shadow.innerHTML = `<style>${STYLES}</style>
      <div class="modal">
        <button class="close-btn" id="close-btn" title="Fermer">✕</button>
        <div class="trophy">🏆</div>
        <h1 id="title">Parcours terminé — bravo !</h1>
        <p class="lead" id="lead"></p>

        <div class="offer-card">
          <h2>
            <span id="offer-name">Premium</span>
            <span class="price" id="offer-price"></span>
          </h2>
          <ul id="offer-perks"></ul>
        </div>

        <div id="stage-zone"></div>

        <span class="secondary-link" id="goto-track">Revoir le parcours</span>
      </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById("close-btn")!.addEventListener("click", () => this.close());
    this.shadow.getElementById("goto-track")!.addEventListener("click", () => {
      this.close();
      this.emit("chuck:open-welcome", { view: "pong" });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.classList.contains("open")) this.close();
    });

    this.sub("chuck:track-completed", ({ trackId, config, trackName }) => {
      this._trackId = trackId;
      this._trackName = trackName;
      this._config = config;
      this.open();
    });
  }

  open(): void {
    this._renderOffer();
    this._renderStage();
    this.classList.add("open");

    // Funnel : le mur premium est affiché.
    this.emit("chuck:funnel-step", {
      step: "premium-wall-shown",
      meta: { trackId: this._trackId },
    });
  }

  close(): void {
    this.classList.remove("open");
  }

  private _priceLabel(): string {
    const c = this._config;
    if (!c || c.priceCents == null) return "";
    const amount = (c.priceCents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    const symbol = c.currency === "EUR" ? "€" : ` ${c.currency}`;
    return `${amount}${symbol}`;
  }

  private _renderOffer(): void {
    const title = this.shadow.getElementById("title")!;
    const lead = this.shadow.getElementById("lead")!;
    const name = this.shadow.getElementById("offer-name")!;
    const price = this.shadow.getElementById("offer-price")!;
    const perks = this.shadow.getElementById("offer-perks")!;
    const c = this._config;

    title.textContent = `${this._trackName || "Parcours"} — partie gratuite terminée !`;
    lead.textContent = c?.premiumTagline ?? "";
    name.textContent = `🎮 ${c?.premiumName ?? "Premium"}`;
    const p = this._priceLabel();
    price.innerHTML = p ? `${this._esc(p)} <small>· accès à vie</small>` : "";

    const list = (c?.premiumPerks ?? []) as TrackPerk[];
    perks.innerHTML = list
      .map(
        (perk) =>
          `<li><span class="ico">${this._esc(perk.ico)}</span><span>${this._esc(perk.text)}</span></li>`,
      )
      .join("");
  }

  /** Mur à un seul étage : bouton « acheter » → intention backend. */
  private _renderStage(): void {
    const zone = this.shadow.getElementById("stage-zone")!;
    const label = this._priceLabel();
    zone.innerHTML = `
      <button class="pay-btn" id="pay-btn">Débloquer ${label ? `pour ${this._esc(label)} ` : ""}→</button>
      <div class="stage-hint">🔒 Paiement sécurisé</div>
      <div class="stage-msg" id="pay-msg"></div>`;

    const payBtn = this.shadow.getElementById("pay-btn") as HTMLButtonElement;
    payBtn.addEventListener("click", () => {
      // Funnel : clic acheter (signal FORT — la vraie question de la stratégie).
      this.emit("chuck:funnel-step", {
        step: "premium-pay-clicked",
        meta: { trackId: this._trackId },
      });
      // Le backend prend le relais (création session paiement, etc.).
      this.emit("chuck:track-purchase-requested", { trackId: this._trackId });

      const msg = this.shadow.getElementById("pay-msg");
      if (msg) {
        msg.className = "stage-msg ok";
        msg.textContent = "Redirection vers le paiement…";
      }
    });
  }

  private _esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
}

customElements.define("chuck-track-paywall", ChuckTrackPaywall);