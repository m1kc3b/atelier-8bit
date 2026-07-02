/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-toolbar.ts (ChuckToolbar)
   Barre de contrôle IDE : assemble / run / step / reset / debug /
   hexdump / disassemble / account + slider vitesse + états.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authState = { authed: false };
const authListeners = new Set<(u: any) => void>();
vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: {
    isAuthenticated: () => authState.authed,
    onChange: (cb: (u: any) => void) => { authListeners.add(cb); return () => authListeners.delete(cb); },
  },
}));

import { bus } from '../core/bus.js';
import '../components/chuck-toolbar.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Toolbar extends HTMLElement {}
function mount(): Toolbar {
  const el = document.createElement('chuck-toolbar') as Toolbar;
  document.body.appendChild(el);
  return el;
}
function btn(el: Toolbar, action: string) {
  return el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
}

beforeEach(() => {
  document.body.innerHTML = '';
  authState.authed = false;
  authListeners.clear();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckToolbar — montage', () => {
  it('rend tous les boutons d’action', () => {
    const el = mount();
    for (const a of ['assemble', 'run', 'step', 'reset', 'debug', 'hexdump', 'disassemble', 'account']) {
      expect(btn(el, a)).not.toBeNull();
    }
  });

  it('état initial idle : run/step/reset désactivés, assemble actif', () => {
    const el = mount();
    expect(btn(el, 'assemble').disabled).toBe(false);
    expect(btn(el, 'run').disabled).toBe(true);
    expect(btn(el, 'step').disabled).toBe(true);
    expect(btn(el, 'reset').disabled).toBe(true);
  });
});

describe('ChuckToolbar — assemble', () => {
  it('émet chuck:assemble avec le source de l’éditeur', () => {
    const editor = document.createElement('div');
    editor.id = 'editor';
    (editor as any).getSource = () => 'LDA #1';
    document.body.appendChild(editor);

    const el = mount();
    const asm = vi.fn();
    bus.on('chuck:assemble', asm);
    btn(el, 'assemble').click();
    expect(asm).toHaveBeenCalledWith({ source: 'LDA #1' });
  });

  it('émet source vide si aucun éditeur présent', () => {
    const el = mount();
    const asm = vi.fn();
    bus.on('chuck:assemble', asm);
    btn(el, 'assemble').click();
    expect(asm).toHaveBeenCalledWith({ source: '' });
  });
});

describe('ChuckToolbar — transitions d’état', () => {
  it('chuck:assembled active run et reset', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    expect(btn(el, 'run').disabled).toBe(false);
    expect(btn(el, 'reset').disabled).toBe(false);
  });

  it('run depuis assembled émet chuck:run et passe en Stop', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    const run = vi.fn();
    bus.on('chuck:run', run);
    btn(el, 'run').click();
    expect(run).toHaveBeenCalled();
    expect(btn(el, 'run').querySelector('span')!.textContent).toBe('Stop');
  });

  it('re-clic sur run (running) émet chuck:stop', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    btn(el, 'run').click(); // → running
    const stop = vi.fn();
    bus.on('chuck:stop', stop);
    btn(el, 'run').click(); // → stop
    expect(stop).toHaveBeenCalled();
  });

  it('chuck:code-changed repasse à idle', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    bus.emit('chuck:code-changed', undefined as any);
    await flush();
    expect(btn(el, 'run').disabled).toBe(true);
  });

  it('chuck:assemble-err repasse à idle', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    bus.emit('chuck:assemble-err', { line: 3, err: 'x' } as any);
    await flush();
    expect(btn(el, 'run').disabled).toBe(true);
  });
});

describe('ChuckToolbar — debug', () => {
  it('active le mode debug depuis assembled (émet chuck:debug enabled)', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any);
    await flush();
    const dbg = vi.fn();
    bus.on('chuck:debug', dbg);
    btn(el, 'debug').click();
    expect(dbg).toHaveBeenCalledWith({ enabled: true });
    expect(el.shadowRoot!.getElementById('btn-debug')!.classList.contains('active')).toBe(true);
  });
});

describe('ChuckToolbar — actions simples', () => {
  it('reset émet chuck:reset', async () => {
    const el = mount();
    bus.emit('chuck:assembled', undefined as any); // reset actif
    await flush();
    const reset = vi.fn();
    bus.on('chuck:reset', reset);
    btn(el, 'reset').click();
    expect(reset).toHaveBeenCalled();
  });

  it('hexdump et disassemble émettent leurs events', () => {
    const el = mount();
    const hex = vi.fn(); const dis = vi.fn();
    bus.on('chuck:hexdump', hex);
    bus.on('chuck:disassemble', dis);
    // Ces boutons sont désactivés en idle : on force un état actif.
    bus.emit('chuck:assembled', undefined as any);
    btn(el, 'hexdump').click();
    btn(el, 'disassemble').click();
    expect(hex).toHaveBeenCalled();
    expect(dis).toHaveBeenCalled();
  });

  it('account émet chuck:open-account', () => {
    const el = mount();
    const acc = vi.fn();
    bus.on('chuck:open-account', acc);
    btn(el, 'account').click();
    expect(acc).toHaveBeenCalled();
  });
});

describe('ChuckToolbar — vitesse & auth', () => {
  it('le slider émet chuck:speed', () => {
    const el = mount();
    const speed = vi.fn();
    bus.on('chuck:speed', speed);
    const slider = el.shadowRoot!.getElementById('speed-slider') as HTMLInputElement;
    slider.value = '75';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(speed).toHaveBeenCalledWith({ value: 75 });
  });

  it('reflète l’état connecté sur le bouton compte', () => {
    authState.authed = true;
    const el = mount();
    expect(el.shadowRoot!.getElementById('btn-account')!.classList.contains('signed-in')).toBe(true);
  });

  it('met à jour le bouton compte quand l’auth change', async () => {
    const el = mount();
    expect(el.shadowRoot!.getElementById('btn-account')!.classList.contains('signed-in')).toBe(false);
    authListeners.forEach((cb) => cb({ id: 'u', email: '' }));
    await flush();
    expect(el.shadowRoot!.getElementById('btn-account')!.classList.contains('signed-in')).toBe(true);
  });
});