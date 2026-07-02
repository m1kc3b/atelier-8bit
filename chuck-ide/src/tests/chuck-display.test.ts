/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-display.ts (ChuckDisplay)
   Écran Chuck-8. Couvre : montage + API show/hide/toggle, réactions
   au bus (run → live + visible, cpu-halted/stop → live off, cpu-reset →
   clear, changement de mode → hide), relais clavier (chuck:screen-key),
   fullRedraw sans throw, et les utilitaires exportés makeDraggable /
   makeResizable (drag met à jour left/top ; resize borne la taille min).

   Le contexte 2D est stubé (jsdom ne fournit pas de vrai canvas).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* Stub minimal du contexte 2D : le composant appelle getContext('2d'),
   createImageData, putImageData. jsdom renvoie null → on injecte un faux. */
function fakeCtx() {
  return {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  };
}
beforeEach(() => {
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => fakeCtx());
});

import { bus } from '../core/bus.js';
import '../components/chuck-display.js';
import { makeDraggable, makeResizable } from '../components/chuck-display.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Display extends HTMLElement {
  show(): void; hide(): void; toggle(): void;
  fullRedraw(ram: Uint8Array, mode: number): void;
}

function mount(): Display {
  const el = document.createElement('chuck-display') as Display;
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckDisplay — montage & API', () => {
  it('rend le canvas et la barre', () => {
    const el = mount();
    expect(el.shadowRoot!.getElementById('screen')).not.toBeNull();
    expect(el.shadowRoot!.getElementById('mode-badge')).not.toBeNull();
  });

  it('show/hide/toggle bascule la classe visible', () => {
    const el = mount();
    expect(el.classList.contains('visible')).toBe(false);
    el.show();
    expect(el.classList.contains('visible')).toBe(true);
    el.hide();
    expect(el.classList.contains('visible')).toBe(false);
    el.toggle();
    expect(el.classList.contains('visible')).toBe(true);
  });

  it('fullRedraw ne jette pas (modes texte et gfx)', () => {
    const el = mount();
    const ram = new Uint8Array(0x10000);
    expect(() => el.fullRedraw(ram, 0)).not.toThrow();
    expect(() => el.fullRedraw(ram, 1)).not.toThrow();
  });
});

describe('ChuckDisplay — réactions bus', () => {
  it('chuck:run affiche l’écran et passe en live', async () => {
    const el = mount();
    bus.emit('chuck:run', undefined);
    await flush();
    expect(el.classList.contains('visible')).toBe(true);
    const live = el.shadowRoot!.getElementById('live-badge') as HTMLElement;
    expect(live.style.display).not.toBe('none');
  });

  it('chuck:cpu-halted éteint le live', async () => {
    const el = mount();
    bus.emit('chuck:run', undefined);
    await flush();
    bus.emit('chuck:cpu-halted', undefined as any);
    await flush();
    const live = el.shadowRoot!.getElementById('live-badge') as HTMLElement;
    expect(live.style.display).toBe('none');
  });

  it('chuck:stop éteint le live', async () => {
    const el = mount();
    bus.emit('chuck:run', undefined);
    await flush();
    bus.emit('chuck:stop', undefined);
    await flush();
    const live = el.shadowRoot!.getElementById('live-badge') as HTMLElement;
    expect(live.style.display).toBe('none');
  });

  it('un changement de mode (ide-free) masque l’écran', async () => {
    const el = mount();
    el.show();
    bus.emit('chuck:ide-free', undefined);
    await flush();
    expect(el.classList.contains('visible')).toBe(false);
  });

  it('chuck:memory-data hors $4000 est ignoré (pas de throw)', async () => {
    mount();
    expect(() => bus.emit('chuck:memory-data', { address: 0x0000, bytes: new Uint8Array(4) } as any)).not.toThrow();
    await flush();
  });
});

describe('ChuckDisplay — relais clavier', () => {
  it('une frappe sur le canvas émet chuck:screen-key', async () => {
    const el = mount();
    const key = vi.fn();
    bus.on('chuck:screen-key', key);
    const canvas = el.shadowRoot!.getElementById('screen')!;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', bubbles: true }));
    expect(key).toHaveBeenCalled();
    expect(key.mock.calls.at(-1)![0]).toMatchObject({ down: true, key: 'z', code: 'KeyZ' });
  });

  it('laisse passer les raccourcis IDE (Ctrl+F5) sans émettre', () => {
    const el = mount();
    const key = vi.fn();
    bus.on('chuck:screen-key', key);
    const canvas = el.shadowRoot!.getElementById('screen')!;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', ctrlKey: true, bubbles: true }));
    expect(key).not.toHaveBeenCalled();
  });
});

describe('makeDraggable', () => {
  it('déplace l’hôte au drag du handle (met à jour left/top)', () => {
    const host = document.createElement('div');
    const handle = document.createElement('div');
    host.appendChild(handle);
    document.body.appendChild(host);
    Object.defineProperty(host, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(host, 'offsetHeight', { value: 80, configurable: true });

    makeDraggable(host, handle);
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 40, bubbles: true }));

    expect(host.style.left).not.toBe('');
    expect(host.style.top).not.toBe('');
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  it('ne démarre pas le drag si on clique un bouton dans le handle', () => {
    const host = document.createElement('div');
    const handle = document.createElement('div');
    const btn = document.createElement('button');
    handle.appendChild(btn);
    host.appendChild(handle);
    document.body.appendChild(host);

    makeDraggable(host, handle);
    btn.dispatchEvent(new MouseEvent('mousedown', { clientX: 5, clientY: 5, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 90, clientY: 90, bubbles: true }));
    expect(host.style.left).toBe('');
  });
});

describe('makeResizable', () => {
  it('redimensionne l’hôte en respectant la taille minimale', () => {
    const host = document.createElement('div');
    const handle = document.createElement('div');
    host.appendChild(handle);
    document.body.appendChild(host);
    Object.defineProperty(host, 'offsetWidth', { value: 300, configurable: true });
    Object.defineProperty(host, 'offsetHeight', { value: 200, configurable: true });

    makeResizable(host, handle);
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 300, clientY: 200, bubbles: true }));
    // Réduction extrême → borne min 200×160.
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0, bubbles: true }));
    expect(parseInt(host.style.width)).toBeGreaterThanOrEqual(200);
    expect(parseInt(host.style.height)).toBeGreaterThanOrEqual(160);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
});