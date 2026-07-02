/* ─────────────────────────────────────────────────────────────
   Tests — components/chuck-account-modal.ts (ChuckAccountModal)
   Modale compte : open/close, onglets, sauvegarde pseudo/pays/email/
   mot de passe (validations + feedback ok/err), déconnexion.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const H = vi.hoisted(() => {
  const authState = { user: { id: 'u1', email: 'a@b.c' } as any };
  return {
    authState,
    authMock: {
      getUser: () => authState.user,
      isAuthenticated: () => !!authState.user,
      onChange: () => () => {},
      updateEmail: vi.fn(async () => ({ error: null })),
      updatePassword: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => {}),
    },
    profileMock: {
      getMyProfile: vi.fn(async () => ({
        id: 'u1', githubLogin: 'octo', displayName: 'Octo', avatarUrl: null,
        country: 'FR', atpPoints: 10, challengesDone: 2,
      })),
      updateMyProfile: vi.fn(async () => ({ error: null })),
    },
    challengesMock: { getAll: vi.fn(async () => [{ id: 1, title: 'Un' }]) },
    storageProgress: {} as Record<number, any>,
  };
});
const { authState, authMock, profileMock } = H;

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: new Proxy({}, { get: (_t, p) => (H.authMock as any)[p] }),
}));
vi.mock('../features/profile/profile-service.js', () => ({
  profileService: new Proxy({}, { get: (_t, p) => (H.profileMock as any)[p] }),
}));
vi.mock('../features/challenges/challenges-service.js', () => ({
  challengesService: new Proxy({}, { get: (_t, p) => (H.challengesMock as any)[p] }),
}));
vi.mock('../infra/storage/storage-service.js', () => ({
  storage: { getAllProgress: () => H.storageProgress },
}));

import { bus } from '../core/bus.js';
import '../components/chuck-account-modal.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

interface Modal extends HTMLElement { open(): Promise<void>; close(): void; }
function mount(): Modal {
  const el = document.createElement('chuck-account-modal') as Modal;
  document.body.appendChild(el);
  return el;
}
const $ = (el: Modal, id: string) => el.shadowRoot!.getElementById(id) as HTMLElement;
async function openPublicTab(el: Modal) {
  await el.open();
  el.shadowRoot!.querySelector<HTMLButtonElement>('.tab-btn[data-tab="public"]')!.click();
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = '';
  authState.user = { id: 'u1', email: 'a@b.c' };
  vi.clearAllMocks();
  profileMock.getMyProfile.mockResolvedValue({
    id: 'u1', githubLogin: 'octo', displayName: 'Octo', avatarUrl: null,
    country: 'FR', atpPoints: 10, challengesDone: 2,
  } as any);
  profileMock.updateMyProfile.mockResolvedValue({ error: null } as any);
  authMock.updateEmail.mockResolvedValue({ error: null } as any);
  authMock.updatePassword.mockResolvedValue({ error: null } as any);
});
afterEach(() => { document.body.innerHTML = ''; });

describe('ChuckAccountModal — open/close', () => {
  it('open ajoute la classe open et affiche l’email', async () => {
    const el = mount();
    await el.open();
    expect(el.classList.contains('open')).toBe(true);
    expect($(el, 'header-email').textContent).toBe('a@b.c');
  });

  it('close retire la classe open', async () => {
    const el = mount();
    await el.open();
    el.close();
    expect(el.classList.contains('open')).toBe(false);
  });

  it('charge le profil public à l’ouverture', async () => {
    const el = mount();
    await el.open();
    expect(profileMock.getMyProfile).toHaveBeenCalled();
  });
});

describe('ChuckAccountModal — onglets', () => {
  it('bascule vers l’onglet public', async () => {
    const el = mount();
    await el.open();
    const publicTab = el.shadowRoot!.querySelector<HTMLButtonElement>('.tab-btn[data-tab="public"]')!;
    publicTab.click();
    await flush();
    expect(publicTab.classList.contains('active')).toBe(true);
  });
});

describe('ChuckAccountModal — sauvegarde pseudo', () => {
  it('refuse un pseudo trop court', async () => {
    const el = mount();
    await openPublicTab(el);
    ($(el, 'dname-input') as HTMLInputElement).value = 'a';
    $(el, 'save-dname-btn').click();
    await flush();
    expect($(el, 'dname-msg').className).toContain('err');
    expect(profileMock.updateMyProfile).not.toHaveBeenCalled();
  });

  it('sauvegarde un pseudo valide (feedback ok)', async () => {
    const el = mount();
    await openPublicTab(el);
    ($(el, 'dname-input') as HTMLInputElement).value = 'NewName';
    $(el, 'save-dname-btn').click();
    await flush();
    expect(profileMock.updateMyProfile).toHaveBeenCalledWith({ displayName: 'NewName' });
    expect($(el, 'dname-msg').className).toContain('ok');
  });

  it('affiche l’erreur serveur', async () => {
    profileMock.updateMyProfile.mockResolvedValue({ error: 'refusé' } as any);
    const el = mount();
    await openPublicTab(el);
    ($(el, 'dname-input') as HTMLInputElement).value = 'NewName';
    $(el, 'save-dname-btn').click();
    await flush();
    expect($(el, 'dname-msg').textContent).toBe('refusé');
    expect($(el, 'dname-msg').className).toContain('err');
  });
});

describe('ChuckAccountModal — sauvegarde pays', () => {
  it('refuse un code pays invalide', async () => {
    const el = mount();
    await openPublicTab(el);
    ($(el, 'country-input') as HTMLInputElement).value = 'FRANCE';
    $(el, 'save-country-btn').click();
    await flush();
    expect($(el, 'country-msg').className).toContain('err');
    expect(profileMock.updateMyProfile).not.toHaveBeenCalled();
  });

  it('accepte un code à 2 lettres', async () => {
    const el = mount();
    await openPublicTab(el);
    ($(el, 'country-input') as HTMLInputElement).value = 'us';
    $(el, 'save-country-btn').click();
    await flush();
    expect(profileMock.updateMyProfile).toHaveBeenCalledWith({ country: 'US' });
  });
});

describe('ChuckAccountModal — email & mot de passe', () => {
  it('sauvegarde l’email', async () => {
    const el = mount();
    await el.open();
    ($(el, 'email-input') as HTMLInputElement).value = 'new@x.io';
    $(el, 'save-email-btn').click();
    await flush();
    expect(authMock.updateEmail).toHaveBeenCalledWith('new@x.io');
    expect($(el, 'email-msg').className).toContain('ok');
  });

  it('refuse un mot de passe trop court', async () => {
    const el = mount();
    await el.open();
    ($(el, 'password-input') as HTMLInputElement).value = '123';
    $(el, 'save-password-btn').click();
    await flush();
    expect($(el, 'password-msg').className).toContain('err');
    expect(authMock.updatePassword).not.toHaveBeenCalled();
  });

  it('sauvegarde un mot de passe valide et vide le champ', async () => {
    const el = mount();
    await el.open();
    const input = $(el, 'password-input') as HTMLInputElement;
    input.value = 'hunter2';
    $(el, 'save-password-btn').click();
    await flush();
    expect(authMock.updatePassword).toHaveBeenCalledWith('hunter2');
    expect(input.value).toBe('');
  });
});

describe('ChuckAccountModal — déconnexion', () => {
  it('signOut ferme la modale et émet chuck:signed-out', async () => {
    const el = mount();
    await el.open();
    const signedOut = vi.fn();
    bus.on('chuck:signed-out', signedOut);
    $(el, 'signout-btn').click();
    await flush();
    expect(authMock.signOut).toHaveBeenCalled();
    expect(el.classList.contains('open')).toBe(false);
    expect(signedOut).toHaveBeenCalled();
  });
});