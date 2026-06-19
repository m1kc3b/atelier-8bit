/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/helpers.ts
   Utilitaires partagés : bus simulé, création de composants,
   émission d'événements Bus typés.
   ───────────────────────────────────────────────────────────── */


// ── Bus simulé ────────────────────────────────────────────────
// Reproduit l'API de EventBus sans dépendance externe.

export type BusListener = (detail: unknown) => void;

export class MockBus {
  private listeners: Map<string, BusListener[]> = new Map();
  public emitted: Array<{ event: string; detail: unknown }> = [];

  emit(event: string, detail: unknown): void {
    this.emitted.push({ event, detail });
    this.listeners.get(event)?.forEach(fn => fn(detail));
  }

  on(event: string, handler: BusListener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
    return () => {
      const arr = this.listeners.get(event) ?? [];
      this.listeners.set(event, arr.filter(h => h !== handler));
    };
  }

  /** Réinitialise l'historique des émissions */
  reset(): void {
    this.emitted = [];
    this.listeners.clear();
  }

  /** Filtre les émissions par nom d'événement */
  emittedFor(event: string): unknown[] {
    return this.emitted.filter(e => e.event === event).map(e => e.detail);
  }

  /** Vérifie qu'un événement a été émis (avec détail optionnel) */
  wasEmitted(event: string, detail?: unknown): boolean {
    return this.emitted.some(e => {
      if (e.event !== event) return false;
      if (detail === undefined) return true;
      return JSON.stringify(e.detail) === JSON.stringify(detail);
    });
  }
}

export const mockBus = new MockBus();

// ── Helpers DOM ───────────────────────────────────────────────

/**
 * Monte un élément custom dans le body et attend son connectedCallback.
 * Retourne l'élément casté dans le bon type.
 */
export function mountElement<T extends HTMLElement>(tagName: string): T {
  const el = document.createElement(tagName) as T;
  document.body.appendChild(el);
  return el;
}

/** Démonte proprement un élément du DOM */
export function unmountElement(el: HTMLElement): void {
  el.parentElement?.removeChild(el);
}

/**
 * Simule un clic sur un bouton dans le shadow DOM d'un composant.
 */
export function clickShadowBtn(host: HTMLElement, selector: string): void {
  const root = host.shadowRoot!;
  const btn  = root.querySelector<HTMLButtonElement>(selector);
  if (!btn) throw new Error(`Bouton introuvable : ${selector}`);
  btn.click();
}

/**
 * Définit la valeur d'un input dans le shadow DOM et déclenche 'input'.
 */
export function setShadowInput(host: HTMLElement, selector: string, value: string): void {
  const root  = host.shadowRoot!;
  const input = root.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Input introuvable : ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Envoie un CustomEvent sur le document (simule le bus global
 * pour les composants qui écoutent sur document).
 */
export function dispatchBusEvent(event: string, detail: unknown): void {
  document.dispatchEvent(new CustomEvent(event, { detail, bubbles: true }));
}

/** Attend un tick de microtâche (utile après setTimeout 0). */
export const nextTick = () => new Promise(r => setTimeout(r, 0));