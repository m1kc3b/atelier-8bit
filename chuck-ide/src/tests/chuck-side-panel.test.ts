/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-side-panel.ts (ChuckSidePanel)
   Composant central de l'IDE. Couvre : montage + rendu initial,
   chargement d'un défi via bus (chuck:challenge-loaded), navigation
   (chevrons prev/next, gating par validation), bascule mode défi,
   roadmap de parcours (chuck:track-steps), feedback succès/échec/timeout,
   et reset feedback.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* storage + authService sont des singletons importés par le composant. */
const store = { completed: new Set<number>() };
vi.mock('../infra/storage/storage-service.js', () => ({
  storage: {
    isCompleted: (id: number) => store.completed.has(id),
    getMedal: () => null,
  },
}));
vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: { isAuthenticated: () => true, getUser: () => ({ id: 'u', email: '' }) },
}));

import { bus } from '../core/bus.js';
import '../components/chuck-side-panel.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function mount(): HTMLElement & { loadContent(item: any): void } {
  const el = document.createElement('chuck-side-panel') as any;
  document.body.appendChild(el);
  return el;
}

function challenge(id: number, over: any = {}) {
  return { id, title: `Défi ${id}`, description: 'desc', template: 'LDA #1', assertions: [], hints: [], locked: false, ...over };
}

beforeEach(() => {
  document.body.innerHTML = '';
  store.completed.clear();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChuckSidePanel — montage', () => {
  it('rend l’en-tête et le corps vide au montage', () => {
    const el = mount();
    const sr = el.shadowRoot!;
    expect(sr.getElementById('panel-title')).not.toBeNull();
    expect(sr.getElementById('prev-btn')).not.toBeNull();
    expect(sr.getElementById('next-btn')).not.toBeNull();
    expect(sr.getElementById('body')!.textContent).toContain('Aucun contenu');
  });

  it('les chevrons sont désactivés sans contenu', () => {
    const el = mount();
    const prev = el.shadowRoot!.getElementById('prev-btn') as HTMLButtonElement;
    const next = el.shadowRoot!.getElementById('next-btn') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });
});

describe('ChuckSidePanel — chargement de contenu', () => {
  it('charge un défi via chuck:challenge-loaded et affiche son titre', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(3), track: undefined, code: '' });
    await flush();
    const title = el.shadowRoot!.getElementById('panel-title')!;
    expect(title.textContent).toContain('3');
  });

  it('prev désactivé sur le défi 1', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(1), track: undefined, code: '' });
    await flush();
    const prev = el.shadowRoot!.getElementById('prev-btn') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('prev actif au-delà du défi 1', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(4), track: undefined, code: '' });
    await flush();
    const prev = el.shadowRoot!.getElementById('prev-btn') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
  });

  it('next désactivé tant que le défi n’est pas validé', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(2), track: undefined, code: '' });
    await flush();
    const next = el.shadowRoot!.getElementById('next-btn') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('next actif quand le défi est validé', async () => {
    store.completed.add(2);
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(2), track: undefined, code: '' });
    await flush();
    const next = el.shadowRoot!.getElementById('next-btn') as HTMLButtonElement;
    expect(next.disabled).toBe(false);
  });

  it('loadContent (API publique) affiche le contenu', async () => {
    const el = mount();
    el.loadContent({
      type: 'challenge', id: 5, title: 'X', blocks: [], template: '', assertions: [],
      arena_name: undefined, locked: false,
    });
    await flush();
    expect(el.shadowRoot!.getElementById('panel-title')!.textContent).toContain('5');
  });
});

describe('ChuckSidePanel — navigation', () => {
  it('clic sur prev émet goto-challenge id-1', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(4), track: undefined, code: '' });
    await flush();
    const goto = vi.fn();
    bus.on('chuck:goto-challenge', goto);
    (el.shadowRoot!.getElementById('prev-btn') as HTMLButtonElement).click();
    expect(goto).toHaveBeenCalledWith({ id: 3 });
  });

  it('clic sur next (validé) émet goto-challenge id+1', async () => {
    store.completed.add(4);
    const el = mount();
    bus.emit('chuck:challenge-loaded', { challenge: challenge(4), track: undefined, code: '' });
    await flush();
    const goto = vi.fn();
    bus.on('chuck:goto-challenge', goto);
    (el.shadowRoot!.getElementById('next-btn') as HTMLButtonElement).click();
    expect(goto).toHaveBeenCalledWith({ id: 5 });
  });
});

describe('ChuckSidePanel — parcours', () => {
  it('charge une étape de parcours (chevrons désactivés)', async () => {
    const el = mount();
    bus.emit('chuck:challenge-loaded', {
      challenge: challenge(10, { arena_name: 'Projet Pong' }),
      code: '',
      track: { trackId: 'pong', stepIndex: 1, stepCount: 3 },
    });
    await flush();
    const title = el.shadowRoot!.getElementById('panel-title')!;
    expect(title.textContent).toContain('Étape 1');
    const prev = el.shadowRoot!.getElementById('prev-btn') as HTMLButtonElement;
    const next = el.shadowRoot!.getElementById('next-btn') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
  });

  it('affiche la roadmap quand chuck:track-steps précède le chargement de l’étape', async () => {
    const el = mount();
    bus.emit('chuck:track-steps', {
      trackId: 'pong', trackName: 'Projet Pong',
      config: { icon: '🏓', subtitle: null },
      items: [
        { id: 10, stepIndex: 1, stepCount: 2, title: 'A', completed: false, medal: null, accessible: true, current: true },
        { id: 11, stepIndex: 2, stepCount: 2, title: 'B', completed: false, medal: null, accessible: false, current: false },
      ],
    });
    bus.emit('chuck:challenge-loaded', {
      challenge: challenge(10, { arena_name: 'Projet Pong' }),
      code: '',
      track: { trackId: 'pong', stepIndex: 1, stepCount: 2 },
    });
    await flush();
    expect(el.shadowRoot!.querySelector('.roadmap')).not.toBeNull();
    expect(el.shadowRoot!.textContent).toContain('Projet Pong');
  });
});

describe('ChuckSidePanel — mode défi', () => {
  it('bascule en vue défi sur chuck:ide-defi', async () => {
    const el = mount();
    bus.emit('chuck:ide-defi', undefined);
    bus.emit('chuck:defi-loaded', { defi: { title: 'Juin', instructions: 'Énoncé', month: '2026-06', id: 'd1' } as any });
    await flush();
    expect(el.shadowRoot!.textContent).toContain('Juin');
  });

  it('affiche le classement reçu', async () => {
    const el = mount();
    bus.emit('chuck:ide-defi', undefined);
    bus.emit('chuck:defi-ranking', {
      entries: [
        { rank: 1, userId: 'u1', displayName: 'Alice', score: 95, prestige: true, isMe: false },
        { rank: 2, userId: 'u2', displayName: 'Moi', score: 80, prestige: false, isMe: true },
      ],
    });
    await flush();
    expect(el.shadowRoot!.textContent).toContain('Alice');
    expect(el.shadowRoot!.textContent).toContain('Moi');
  });
});

describe('ChuckSidePanel — feedback', () => {
  function loadAndValidate() {
    bus.emit('chuck:challenge-loaded', { challenge: challenge(2), track: undefined, code: '' });
  }

  it('feedback succès affiche la médaille et les cycles', async () => {
    const el = mount();
    loadAndValidate();
    await flush();
    bus.emit('chuck:challenge-success', {
      result: { success: true, failures: [], cycles: 42, timeout: false },
      medal: '🥇',
    });
    await flush();
    const fb = el.shadowRoot!.getElementById('feedback')!;
    expect(fb.className).toContain('success');
    expect(fb.textContent).toContain('42');
    expect(fb.textContent).toContain('🥇');
  });

  it('feedback échec liste les assertions en échec', async () => {
    const el = mount();
    loadAndValidate();
    await flush();
    bus.emit('chuck:challenge-failed', {
      result: {
        success: false,
        failures: [{ message: 'A attendu 42, obtenu 0' } as any],
        cycles: 10, timeout: false,
      },
    });
    await flush();
    const fb = el.shadowRoot!.getElementById('feedback')!;
    expect(fb.className).toContain('failure');
    expect(fb.textContent).toContain('A attendu 42');
  });

  it('feedback timeout affiche le message dédié', async () => {
    const el = mount();
    loadAndValidate();
    await flush();
    bus.emit('chuck:challenge-failed', {
      result: { success: false, failures: [], cycles: 100000, timeout: true },
    });
    await flush();
    const fb = el.shadowRoot!.getElementById('feedback')!;
    expect(fb.textContent!.toLowerCase()).toContain('timeout');
  });

  it('chuck:code-changed réinitialise le feedback', async () => {
    const el = mount();
    loadAndValidate();
    await flush();
    bus.emit('chuck:challenge-failed', {
      result: { success: false, failures: [{ message: 'x' } as any], cycles: 10, timeout: false },
    });
    await flush();
    bus.emit('chuck:code-changed', { source: 'LDA #2' } as any);
    await flush();
    const fb = el.shadowRoot!.getElementById('feedback');
    if (fb) expect(fb.className.trim()).toBe('feedback');
  });
});