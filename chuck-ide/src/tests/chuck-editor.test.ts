/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-editor.ts (ChuckEditor)
   CodeMirror 6 dans le Shadow DOM. Couvre : montage + API publique
   (getSource/setSource/getBreakpoints), émission chuck:code-changed et
   chuck:cursor-moved, réactions au bus (challenge-loaded → nom d'onglet
   + source, ide-free → demo, defi-loaded → template si éditeur vierge,
   log console), effacement console, teardown (destroy).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* CodeMirror touche des API DOM absentes de jsdom (getClientRects sur les
   Range, execCommand). On les stub pour éviter le bruit « unhandled error » ;
   elles n'affectent aucune logique testée ici. */
if (!('execCommand' in document)) {
  (document as any).execCommand = () => false;
}
const _origGetClientRects = Range.prototype.getClientRects;
Range.prototype.getClientRects = function () {
  try {
    return _origGetClientRects?.call(this) ?? ([] as unknown as DOMRectList);
  } catch {
    return [] as unknown as DOMRectList;
  }
};
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
}

import { bus } from '../core/bus.js';
import '../components/chuck-editor.js';
import { DEFAULT_SOURCE } from '../features/asm/default-source.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Editor extends HTMLElement {
  getSource(): string;
  setSource(s: string): void;
  getBreakpoints(): number[];
}

function mount(): Editor {
  const el = document.createElement('chuck-editor') as Editor;
  document.body.appendChild(el);
  return el;
}

function challenge(id: number, over: any = {}) {
  return { id, title: `Défi ${id}`, description: '', template: '', assertions: [], hints: [], locked: false, ...over };
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.dataset.mode = 'free';
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChuckEditor — montage', () => {
  it('rend la barre d’onglet, l’hôte CodeMirror et la console', () => {
    const el = mount();
    const sr = el.shadowRoot!;
    expect(sr.getElementById('tab-label')).not.toBeNull();
    expect(sr.getElementById('cm-host')).not.toBeNull();
    expect(sr.getElementById('output')).not.toBeNull();
  });

  it('charge le source de démonstration par défaut', () => {
    const el = mount();
    expect(el.getSource().length).toBeGreaterThan(0);
    expect(el.getSource()).toBe(DEFAULT_SOURCE);
  });
});

describe('ChuckEditor — API publique', () => {
  it('setSource remplace le contenu, getSource le relit', () => {
    const el = mount();
    el.setSource('LDA #$2A\nBRK');
    expect(el.getSource()).toBe('LDA #$2A\nBRK');
  });

  it('getBreakpoints est vide par défaut', () => {
    const el = mount();
    expect(el.getBreakpoints()).toEqual([]);
  });
});

describe('ChuckEditor — émissions', () => {
  it('émet chuck:code-changed quand le document change', async () => {
    const el = mount();
    const changed = vi.fn();
    bus.on('chuck:code-changed', changed);
    el.setSource('NOP');
    await flush();
    expect(changed).toHaveBeenCalled();
  });

  it('émet chuck:cursor-moved (ligne/colonne) au chargement d’un défi', async () => {
    mount();
    const cursor = vi.fn();
    bus.on('chuck:cursor-moved', cursor);
    bus.emit('chuck:challenge-loaded', { challenge: challenge(1), code: 'LDA #1', track: undefined });
    await flush();
    expect(cursor).toHaveBeenCalled();
    const payload = cursor.mock.calls.at(-1)![0];
    expect(payload).toHaveProperty('line');
    expect(payload).toHaveProperty('col');
  });
});

describe('ChuckEditor — réactions bus', () => {
  it('challenge-loaded (défi) : nom d’onglet defi_NN.asm + source injectée', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(7), code: 'LDA #7', track: undefined });
    await flush();
    expect(el.shadowRoot!.getElementById('tab-label')!.textContent).toBe('defi_07.asm');
    expect(el.getSource()).toBe('LDA #7');
  });

  it('challenge-loaded (parcours) : nom d’onglet trackId_id.asm', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', {
      challenge: challenge(3),
      code: '; step',
      track: { trackId: 'pong', stepIndex: 1, stepCount: 5 },
    });
    await flush();
    expect(el.shadowRoot!.getElementById('tab-label')!.textContent).toBe('pong_3.asm');
  });

  it('ide-free : recharge demo.asm et le source de démonstration', async () => {
    const el = mount();
    el.setSource('POLLUTION');
    bus.emit('chuck:ide-free', undefined);
    await flush();
    expect(el.shadowRoot!.getElementById('tab-label')!.textContent).toBe('demo.asm');
    expect(el.getSource()).toBe(DEFAULT_SOURCE);
  });

  it('defi-loaded : injecte le template si l’éditeur est resté vierge (démo)', async () => {
    const el = mount();
    bus.emit('chuck:defi-loaded', {
      defi: { id: 'd1', month: '2026-06', title: 'Juin', instructions: '', template: 'CLC\nBRK' } as any,
    });
    await flush();
    expect(el.getSource()).toBe('CLC\nBRK');
    expect(el.shadowRoot!.getElementById('tab-label')!.textContent).toBe('defi_2026-06.asm');
  });

  it('defi-loaded : n’écrase pas le travail en cours du joueur', async () => {
    const el = mount();
    el.setSource('MON CODE PERSO');
    bus.emit('chuck:defi-loaded', {
      defi: { id: 'd1', month: '2026-06', title: 'Juin', instructions: '', template: 'CLC' } as any,
    });
    await flush();
    expect(el.getSource()).toBe('MON CODE PERSO');
  });

  it('chuck:log écrit une ligne dans la console', async () => {
    const el = mount();
    bus.emit('chuck:log', { text: 'Assemblé.', level: 'ok' });
    await flush();
    expect(el.shadowRoot!.getElementById('output')!.textContent).toContain('Assemblé.');
  });
});

describe('ChuckEditor — console', () => {
  it('le bouton Effacer vide la console puis logge la confirmation', async () => {
    const el = mount();
    bus.emit('chuck:log', { text: 'ligne', level: 'info' });
    await flush();
    (el.shadowRoot!.getElementById('clear-btn') as HTMLButtonElement).click();
    await flush();
    const out = el.shadowRoot!.getElementById('output')!;
    expect(out.textContent).not.toContain('ligne');
    expect(out.textContent).toContain('effacée');
  });
});

describe('ChuckEditor — teardown', () => {
  it('détruit la vue CodeMirror au démontage sans erreur', () => {
    const el = mount();
    expect(() => el.remove()).not.toThrow();
  });
});