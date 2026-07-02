/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-registers.ts (ChuckRegisters)
   Panneau registres + flags + moniteur mémoire. Couvre : montage,
   show/hide/toggle, mise à jour des registres et des flags via
   chuck:cpu-updated, réactions cpu-reset/halted, masquage au changement
   de mode, moniteur (snapshot RAM + Go/adresse en $hex, 0x, décimal, repli
   $E000 sur saisie invalide).

   Range/canvas non requis ici ; le composant est pur DOM.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { bus } from '../core/bus.js';
import '../components/chuck-registers.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Regs extends HTMLElement {
  show(): void; hide(): void; toggle(): void;
}

function mount(): Regs {
  const el = document.createElement('chuck-registers') as Regs;
  document.body.appendChild(el);
  return el;
}

function cpu(over: Partial<Record<'A'|'X'|'Y'|'SP'|'PC'|'P', number>> = {}) {
  return { A: 0, X: 0, Y: 0, SP: 0xff, PC: 0xe000, P: 0, ...over } as any;
}

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckRegisters — montage & API', () => {
  it('rend les cartes registres et la barre', () => {
    const el = mount();
    const sr = el.shadowRoot!;
    expect(sr.getElementById('reg-a')).not.toBeNull();
    expect(sr.getElementById('reg-pc')).not.toBeNull();
    expect(sr.getElementById('goto-btn')).not.toBeNull();
  });

  it('show/hide/toggle bascule la classe visible', () => {
    const el = mount();
    el.show();
    expect(el.classList.contains('visible')).toBe(true);
    el.hide();
    expect(el.classList.contains('visible')).toBe(false);
    el.toggle();
    expect(el.classList.contains('visible')).toBe(true);
  });
});

describe('ChuckRegisters — mise à jour registres', () => {
  it('chuck:cpu-updated écrit les valeurs hex des registres', async () => {
    const el = mount();
    bus.emit('chuck:cpu-updated', cpu({ A: 0x2a, X: 0x10, PC: 0xe005 }));
    await flush();
    const sr = el.shadowRoot!;
    expect(sr.getElementById('reg-a')!.textContent).toBe('$2A');
    expect(sr.getElementById('reg-x')!.textContent).toBe('$10');
    expect(sr.getElementById('reg-pc')!.textContent).toBe('$E005');
  });

  it('reflète les flags actifs (N, Z, C)', async () => {
    const el = mount();
    // P = N + Z + C = 0x80 | 0x02 | 0x01
    bus.emit('chuck:cpu-updated', cpu({ P: 0x83 }));
    await flush();
    const sr = el.shadowRoot!;
    expect(sr.getElementById('flag-n')!.classList.contains('set')).toBe(true);
    expect(sr.getElementById('flag-z')!.classList.contains('set')).toBe(true);
    expect(sr.getElementById('flag-c')!.classList.contains('set')).toBe(true);
    expect(sr.getElementById('flag-v')!.classList.contains('set')).toBe(false);
  });

  it('désactive un flag qui repasse à 0', async () => {
    const el = mount();
    bus.emit('chuck:cpu-updated', cpu({ P: 0x02 })); // Z=1
    await flush();
    bus.emit('chuck:cpu-updated', cpu({ P: 0x00 })); // Z=0
    await flush();
    expect(el.shadowRoot!.getElementById('flag-z')!.classList.contains('set')).toBe(false);
  });

  it('cpu-reset et cpu-halted mettent aussi à jour les registres', async () => {
    const el = mount();
    bus.emit('chuck:cpu-reset', cpu({ A: 0x11 }));
    await flush();
    expect(el.shadowRoot!.getElementById('reg-a')!.textContent).toBe('$11');
    bus.emit('chuck:cpu-halted', cpu({ A: 0x22 }));
    await flush();
    expect(el.shadowRoot!.getElementById('reg-a')!.textContent).toBe('$22');
  });
});

describe('ChuckRegisters — masquage au changement de mode', () => {
  it('ide-free masque le panneau', async () => {
    const el = mount();
    el.show();
    bus.emit('chuck:ide-free', undefined);
    await flush();
    expect(el.classList.contains('visible')).toBe(false);
  });

  it('tutos-requested masque le panneau', async () => {
    const el = mount();
    el.show();
    bus.emit('chuck:tutos-requested', undefined);
    await flush();
    expect(el.classList.contains('visible')).toBe(false);
  });
});

describe('ChuckRegisters — moniteur mémoire', () => {
  function ramSnapshot(_el: Regs, fill: (ram: Uint8Array) => void) {
    const ram = new Uint8Array(65536);
    fill(ram);
    bus.emit('chuck:ram-snapshot' as any, { bytes: ram });
  }

  it('remplit le moniteur à partir d’un snapshot RAM', async () => {
    const el = mount();
    ramSnapshot(el, (ram) => { ram[0x0000] = 0xab; });
    await flush();
    const body = el.shadowRoot!.getElementById('monitor-body')!;
    expect(body.querySelectorAll('tr').length).toBe(256);
    expect(body.textContent).toContain('AB');
  });

  it('Go sur une adresse $hex affiche la page correspondante', async () => {
    const el = mount();
    ramSnapshot(el, (ram) => { ram[0x0300] = 0x7e; });
    await flush();
    const input = el.shadowRoot!.getElementById('goto-input') as HTMLInputElement;
    input.value = '$0300';
    (el.shadowRoot!.getElementById('goto-btn') as HTMLButtonElement).click();
    await flush();
    const body = el.shadowRoot!.getElementById('monitor-body')!;
    expect(body.textContent).toContain('$0300');
    expect(body.textContent).toContain('7E');
  });

  it('Go accepte le format 0x et le décimal court', async () => {
    const el = mount();
    ramSnapshot(el, () => {});
    await flush();
    const input = el.shadowRoot!.getElementById('goto-input') as HTMLInputElement;
    const body = el.shadowRoot!.getElementById('monitor-body')!;

    input.value = '0x0200';
    (el.shadowRoot!.getElementById('goto-btn') as HTMLButtonElement).click();
    await flush();
    expect(body.textContent).toContain('$0200');

    // Saisie décimale courte (< 3 caractères, non-hex ambiguë) → parsée en base 10.
    input.value = '16'; // décimal → $0010
    (el.shadowRoot!.getElementById('goto-btn') as HTMLButtonElement).click();
    await flush();
    expect(body.textContent).toContain('$0000'); // page de $0010
  });

  it('Go sur une saisie invalide se replie sur $E000', async () => {
    const el = mount();
    ramSnapshot(el, () => {});
    await flush();
    const input = el.shadowRoot!.getElementById('goto-input') as HTMLInputElement;
    input.value = 'nawak!!';
    (el.shadowRoot!.getElementById('goto-btn') as HTMLButtonElement).click();
    await flush();
    expect(el.shadowRoot!.getElementById('monitor-body')!.textContent).toContain('$E000');
  });
});