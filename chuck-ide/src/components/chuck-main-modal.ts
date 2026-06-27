import { ChuckComponent } from '../core/base-component.js';

export interface MainModalOptions {
  title?: string;
  showBackBtn?: boolean;
  dismissible?: boolean;
}

export class ChuckMainModal extends ChuckComponent {
  private _dismissible = true;

  protected render(): void {
    this.shadow.innerHTML = `<style>
      @import '/src/styles/tokens.css';

      :host { 
        position: fixed; inset: 0; z-index: 9000; display: none;
        align-items: center; justify-content: center;
        background: rgba(0, 0, 0, .8); font-family: var(--font-ui); 
      }
      :host(.open) { display: flex; }

      .modal { 
        position: relative; width: min(1100px, 94vw); height: min(760px, 92vh);
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 18px; display: flex; flex-direction: column;
        overflow: hidden; box-shadow: var(--modal-shadow); 
      }

      /* ── TOPBAR ────────────────────────────────────────── */
      .topbar { 
        display: flex; align-items: center; gap: 14px; padding: 16px 22px;
        border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface-2);
      }
      .topbar-title { 
        flex: 1; text-align: center; font-family: var(--font-mono);
        font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: .06em; 
      }
      .back-btn, .close-btn { 
        width: 26px; height: 26px; border-radius: 50%;
        background: var(--surface-3); border: none; color: var(--text-muted);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font-size: 13px; flex-shrink: 0; transition: background var(--t-fast), color var(--t-fast); 
      }
      .back-btn { display: none; }
      .back-btn.visible { display: flex; }
      .back-btn:hover { color: var(--text); background: var(--surface-4); }
      .close-btn:hover { background: var(--red); color: #fff; }

      /* ── BODY ─────────────────────────────────────────── */
      .modal-body { 
        flex: 1; min-height: 0; display: flex; flex-direction: column; 
        overflow-y: auto; padding: 20px;
      }

      /* ── BOTTOMBAR ────────────────────────────────────── */
      .bottombar { 
        display: flex; align-items: center; justify-content: flex-end; gap: 12px;
        padding: 14px 22px; border-top: 1px solid var(--border); 
        background: var(--surface-2); flex-shrink: 0; 
        text-align: center;
      }
      /* Cache la bottombar si aucun élément n'est injecté dedans */
      .bottombar:empty, .bottombar::slotted(:empty) { display: none; }
    </style>

    <div class="modal">
      <div class="topbar">
        <button class="back-btn" id="back-btn" title="Retour">←</button>
        <span class="topbar-title" id="modal-title">🕹️ L'Atelier 8-bit</span>
        <button class="close-btn" id="close-btn" title="Fermer (Échap)">✕</button>
      </div>

      <div class="modal-body" id="modal-body">
        <slot></slot>
      </div>

      <div class="bottombar" id="bottombar">
        <slot name="bottombar">
        <div class="stats-strip">
          <strong>Une machine, des contraintes, ton cerveau, et rien d'autre 😉</strong>
        </div>
        </slot>
      </div>
    </div>`;
  }

  protected setup(): void {
    this.shadow.getElementById('close-btn')!.addEventListener('click', () => {
      if (this._dismissible) this.close();
    });

    this.shadow.getElementById('back-btn')!.addEventListener('click', () => {
      this.emit('chuck:modal-back', undefined);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('open') && this._dismissible) {
        this.close();
      }
    });

    // Écoute globale optionnelle pour ouvrir des vues à la volée via le Bus
    this.sub('chuck:modal-open-view' as any, (p: { view: HTMLElement; options?: MainModalOptions }) => {
      this.setContent(p.view, p.options);
      this.open();
    });
  }

  /**
   * Injecte dynamiquement un composant dans le Body et configure la modale
   */
  public setContent(element: HTMLElement | string, options: MainModalOptions = {}): void {
    
    // Nettoyage du Light DOM actuel (sauf les éléments affectés aux slots spécifiques)
    const children = Array.from(this.children);
    children.forEach(child => {
      if (child.getAttribute('slot') !== 'bottombar') {
        child.remove();
      }
    });

    // Injection du nouveau contenu
    if (typeof element === 'string') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = element;
      this.appendChild(wrapper);
    } else {
      this.appendChild(element);
    }

    // Configuration des options graphiques
    this._dismissible = options.dismissible ?? true;
    
    const titleEl = this.shadow.getElementById('modal-title')!;
    titleEl.textContent = options.title ?? "🕹️ L'Atelier 8-bit";

    const backBtn = this.shadow.getElementById('back-btn')!;
    backBtn.classList.toggle('visible', !!options.showBackBtn);

    const closeBtn = this.shadow.getElementById('close-btn')!;
    closeBtn.style.display = this._dismissible ? '' : 'none';
  }

  /**
   * Injecte ou remplace le contenu de la bottombar
   */
  public setBottombar(element: HTMLElement | string | null): void {
    const currentBottom = this.querySelector('[slot="bottombar"]');
    if (currentBottom) currentBottom.remove();

    if (!element) return;

    if (typeof element === 'string') {
      const container = document.createElement('div');
      container.setAttribute('slot', 'bottombar');
      container.innerHTML = element;
      this.appendChild(container);
    } else {
      element.setAttribute('slot', 'bottombar');
      this.appendChild(element);
    }
  }

  public open(): void {
    this.classList.add('open');
    this.emit('chuck:modal-opened', undefined);
  }

  public close(): void {
    this.classList.remove('open');
    this.emit('chuck:modal-closed', undefined);
  }
}

customElements.define('chuck-main-modal', ChuckMainModal);