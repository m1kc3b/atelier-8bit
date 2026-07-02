/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-auth-gate.ts (ChuckAuthGate)
   Gate d'authentification bloquante. Couvre : rendu light+shadow DOM,
   open (copy par défaut / personnalisé, challengeId, dismissible ↔ bouton
   fermer), close (bloquée si non dismissible), signInWithGithub (redirectTo
   par défaut ?challenge=<id> / override, mapping erreur), isUnlocked.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const auth = { authed: false, signInErr: null as string | null };
const signInMock = vi.fn(async (_o?: any) => ({ error: auth.signInErr }));

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: {
    isAuthenticated: () => auth.authed,
    signInWithGithub: (o: any) => signInMock(o),
  },
}));

import { ChuckAuthGate } from '../components/chuck-auth-gate.js';

interface Gate extends HTMLElement {
  open(o?: any): void;
  close(): void;
  signInWithGithub(): Promise<void>;
}
function mount(): Gate {
  const el = document.createElement('chuck-auth-gate') as Gate;
  document.body.appendChild(el);
  return el;
}
const light = (el: Gate, id: string) => el.querySelector(`#${id}`) as HTMLElement;
const shadow = (el: Gate, id: string) => el.shadowRoot!.getElementById(id) as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  auth.authed = false;
  auth.signInErr = null;
  signInMock.mockClear();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckAuthGate — rendu', () => {
  it('projette le formulaire dans le light DOM (détectable par les password managers)', () => {
    const el = mount();
    expect(light(el, 'github-btn')).not.toBeNull();
    expect(light(el, 'title')).not.toBeNull();
  });

  it('rend la coquille (overlay + bouton fermer) dans le Shadow DOM', () => {
    const el = mount();
    expect(shadow(el, 'close-btn')).not.toBeNull();
  });

  it('démarre fermée', () => {
    const el = mount();
    expect(el.classList.contains('open')).toBe(false);
  });
});

describe('ChuckAuthGate — open', () => {
  it('ouvre avec le copy par défaut', () => {
    const el = mount();
    el.open();
    expect(el.classList.contains('open')).toBe(true);
    expect(light(el, 'title').textContent).toContain('Sauvegarde');
  });

  it('applique un titre et sous-titre personnalisés', () => {
    const el = mount();
    el.open({ title: 'Débloque Pong', sub: 'Connecte-toi pour jouer.' });
    expect(light(el, 'title').textContent).toBe('Débloque Pong');
    expect(light(el, 'sub').textContent).toBe('Connecte-toi pour jouer.');
  });

  it('masque le bouton fermer par défaut (gate bloquante)', () => {
    const el = mount();
    el.open();
    expect(shadow(el, 'close-btn').style.display).toBe('none');
  });

  it('affiche le bouton fermer si dismissible', () => {
    const el = mount();
    el.open({ dismissible: true });
    expect(shadow(el, 'close-btn').style.display).not.toBe('none');
  });
});

describe('ChuckAuthGate — close', () => {
  it('ne se ferme pas si non dismissible', () => {
    const el = mount();
    el.open();
    el.close();
    expect(el.classList.contains('open')).toBe(true);
  });

  it('se ferme si dismissible', () => {
    const el = mount();
    el.open({ dismissible: true });
    el.close();
    expect(el.classList.contains('open')).toBe(false);
  });

  it('le clic sur le bouton fermer respecte dismissible', () => {
    const el = mount();
    el.open({ dismissible: true });
    shadow(el, 'close-btn').click();
    expect(el.classList.contains('open')).toBe(false);
  });
});

describe('ChuckAuthGate — signInWithGithub', () => {
  it('redirectTo par défaut encode ?challenge=<challengeId>', async () => {
    const el = mount();
    el.open({ challengeId: 7 });
    await el.signInWithGithub();
    expect(signInMock).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/?challenge=7`,
    });
  });

  it('challengeId par défaut = 4', async () => {
    const el = mount();
    el.open();
    await el.signInWithGithub();
    expect(signInMock).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/?challenge=4`,
    });
  });

  it('respecte un redirectTo explicite', async () => {
    const el = mount();
    el.open({ redirectTo: 'https://x.io/cb' });
    await el.signInWithGithub();
    expect(signInMock).toHaveBeenCalledWith({ redirectTo: 'https://x.io/cb' });
  });

  it('le clic sur le bouton GitHub déclenche la connexion', async () => {
    const el = mount();
    el.open();
    light(el, 'github-btn').click();
    await Promise.resolve();
    expect(signInMock).toHaveBeenCalled();
  });

  it('n’émet pas d’exception si signInWithGithub renvoie une erreur', async () => {
    auth.signInErr = 'oauth ko';
    const el = mount();
    el.open();
    await expect(el.signInWithGithub()).resolves.toBeUndefined();
  });
});

describe('ChuckAuthGate.isUnlocked', () => {
  it('reflète l’état authentifié', () => {
    auth.authed = false;
    expect(ChuckAuthGate.isUnlocked()).toBe(false);
    auth.authed = true;
    expect(ChuckAuthGate.isUnlocked()).toBe(true);
  });
});