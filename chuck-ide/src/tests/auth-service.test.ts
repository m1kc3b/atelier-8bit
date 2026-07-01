/* ─────────────────────────────────────────────────────────────
   Tests — features/auth/auth-service.ts
   Couvre : getUser (null sans session, dérivation id/email), 
   isAuthenticated, onChange (abonnement + désabonnement), 
   signInWithGithub (redirectTo par défaut + override, mapping d’erreur),
   signOut, updateEmail/updatePassword (mapping d’erreur).
   Le client supabase-js est entièrement mocké au niveau du module.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* AuthService appelle getSession() + onAuthStateChange() DÈS l'import : le
   mock du SDK doit donc être prêt avant. On le construit dans vi.hoisted
   (exécuté en premier) et on capture le callback onAuthStateChange pour
   pouvoir simuler des transitions d'état d'auth depuis les tests. */
const H = vi.hoisted(() => {
  const state: { cb: ((e: string, s: any) => void) | null; session: any } = { cb: null, session: null };
  const authApi = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: state.session } })),
    onAuthStateChange: vi.fn((cb: (e: string, s: any) => void) => {
      state.cb = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    updateUser: vi.fn(() => Promise.resolve({ error: null })),
  };
  return { state, authApi };
});

const authApi = H.authApi;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: H.authApi, from: vi.fn() })),
}));

// super-admin est importé dynamiquement par auth-service : on le neutralise.
vi.mock('../core/super-admin', () => ({
  superAdmin: { refresh: vi.fn(), reset: vi.fn() },
}));

import { authService } from '../features/auth/auth-service.js';

/** Simule un changement d’état d’auth émis par Supabase. */
function emitAuth(event: string, session: any) {
  H.state.session = session;
  H.state.cb?.(event, session);
}

beforeEach(() => {
  vi.clearAllMocks();
  emitAuth('SIGNED_OUT', null);
});

describe('AuthService.getUser / isAuthenticated', () => {
  it('null et non authentifié sans session', () => {
    expect(authService.getUser()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('dérive {id,email} d’une session active', () => {
    emitAuth('SIGNED_IN', { user: { id: 'u1', email: 'a@b.c' } });
    expect(authService.getUser()).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('email vide si absent de la session', () => {
    emitAuth('SIGNED_IN', { user: { id: 'u2' } });
    expect(authService.getUser()).toEqual({ id: 'u2', email: '' });
  });
});

describe('AuthService.onChange', () => {
  it('notifie le listener au changement d’état', () => {
    const cb = vi.fn();
    const off = authService.onChange(cb);
    emitAuth('SIGNED_IN', { user: { id: 'u1', email: 'a@b.c' } });
    expect(cb).toHaveBeenCalledWith({ id: 'u1', email: 'a@b.c' });
    off();
  });

  it('le désabonnement stoppe les notifications', () => {
    const cb = vi.fn();
    const off = authService.onChange(cb);
    off();
    emitAuth('SIGNED_IN', { user: { id: 'u1', email: 'a@b.c' } });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('AuthService.signInWithGithub', () => {
  it('utilise window.location.origin par défaut comme redirectTo', async () => {
    await authService.signInWithGithub();
    expect(authApi.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        options: expect.objectContaining({ redirectTo: window.location.origin }),
      }),
    );
  });

  it('respecte un redirectTo explicite', async () => {
    await authService.signInWithGithub({ redirectTo: 'https://x.io/cb' });
    expect(authApi.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ redirectTo: 'https://x.io/cb' }) }),
    );
  });

  it('mappe une erreur OAuth en { error: message }', async () => {
    authApi.signInWithOAuth.mockResolvedValueOnce({ error: { message: 'oauth fail' } } as any);
    expect(await authService.signInWithGithub()).toEqual({ error: 'oauth fail' });
  });

  it('renvoie { error: null } en cas de succès', async () => {
    expect(await authService.signInWithGithub()).toEqual({ error: null });
  });
});

describe('AuthService mutations', () => {
  it('signOut appelle supabase.auth.signOut', async () => {
    await authService.signOut();
    expect(authApi.signOut).toHaveBeenCalledTimes(1);
  });

  it('updateEmail mappe l’erreur', async () => {
    authApi.updateUser.mockResolvedValueOnce({ error: { message: 'bad email' } } as any);
    expect(await authService.updateEmail('x@y.z')).toEqual({ error: 'bad email' });
  });

  it('updatePassword renvoie null en succès', async () => {
    expect(await authService.updatePassword('hunter2')).toEqual({ error: null });
  });
});