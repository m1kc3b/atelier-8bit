/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/setup.ts
   Setup global Vitest : mocks bus, storage, Web Components.
   ───────────────────────────────────────────────────────────── */

import { vi, beforeEach } from 'vitest';

// ── Mock des imports ES modules de l'IDE ─────────────────────
//  Les tests importent les classes directement via des mocks
//  (pas de vraies dépendances Vite/WASM en test unitaire).

// Mock storage-service
vi.mock('../core/storage/storage-service.js', () => ({
  storage: {
    isUnlocked: vi.fn(() => false),
    saveSession: vi.fn(),
    load: vi.fn(() => ({})),
    save: vi.fn(),
  },
}));

// Mock base-component  (fournit l'implémentation minimale pour les tests)
vi.mock('../core/base-component.js', () => ({
  ChuckComponent: class ChuckComponent extends HTMLElement {
    protected shadow: ShadowRoot;
    // private _unsubs: Array<() => void> = [];

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    protected sub(_event: string, _handler: (d: unknown) => void): void {
      // No-op en test — les tests injectent les events manuellement
    }

    protected emit(event: string, detail: unknown): void {
      this.dispatchEvent(new CustomEvent(event, { detail, bubbles: true }));
    }

    connectedCallback(): void {
      (this as unknown as { render: () => void }).render();
      (this as unknown as { setup: () => void }).setup();
    }

    protected render(): void {}
    protected setup(): void {}
    protected teardown(): void {}
  },
}));

// Mock chuck-display (makeDraggable / makeResizable)
vi.mock('./chuck-display.js', () => ({
  makeDraggable: vi.fn(),
  makeResizable: vi.fn(),
}));

// Polyfill customElements.define (jsdom le supporte nativement, mais
// on protège contre les re-définitions inter-tests)
const _defined = new Set<string>();
const _orig = customElements.define.bind(customElements);
customElements.define = (name: string, ctor: CustomElementConstructor, opts?: ElementDefinitionOptions) => {
  if (!_defined.has(name)) {
    _defined.add(name);
    _orig(name, ctor, opts);
  }
};

// Réinitialiser localStorage avant chaque test
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});