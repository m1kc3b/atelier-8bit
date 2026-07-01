/* ─────────────────────────────────────────────────────────────
   Tests — features/profile/profile-service.ts
   Couvre : getMyProfile (null si déconnecté, mapping, profil par défaut
   si absent, cache, invalidation au changement d’auth), getByLogin,
   updateMyProfile (refus si déconnecté, n’écrit jamais les compteurs,
   patch display_name/country, maj du cache local).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Le constructeur de ProfileService appelle authService.onChange() DÈS
   l'import : les mocks doivent donc exister avant cet import. On les crée
   dans vi.hoisted (exécuté en tout premier) et on les expose via h.* —
   réassignables par chaque test. */
const h = vi.hoisted(() => {
  const makeQueryBuilder = (result: { data?: unknown; error?: unknown }) => {
    const resolved = { data: result.data ?? null, error: result.error ?? null };
    const b: any = {};
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => { (b['__' + m] ||= []).push(args); return b; };
    }
    b.maybeSingle = () => Promise.resolve(resolved);
    b.single = () => Promise.resolve(resolved);
    b.then = (f: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(f);
    return b;
  };
  const makeSupa = (tables: Record<string, { data?: unknown; error?: unknown }> = {}) => {
    const builders: Record<string, any> = {};
    const inner = (t: string) => (builders[t] = makeQueryBuilder(tables[t] ?? { data: null }));
    const from: any = (t: string) => { from.calls++; return inner(t); };
    from.calls = 0;
    return { from, builders };
  };

  let user: { id: string; email?: string } | null = null;
  const listeners = new Set<(u: typeof user) => void>();
  const auth = {
    getUser: () => user,
    isAuthenticated: () => user != null,
    onChange: (cb: (u: typeof user) => void) => { listeners.add(cb); return () => listeners.delete(cb); },
    __setUser(u: typeof user) { user = u; listeners.forEach((cb) => cb(user)); },
  };

  return { supa: makeSupa(), makeSupa, auth };
});

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (h.supa as any)[p] }),
  authService: new Proxy({}, { get: (_t, p) => (h.auth as any)[p] }),
}));

import { profileService } from '../features/profile/profile-service.js';

beforeEach(() => {
  h.auth.__setUser(null); // invalide aussi le cache via onChange
});

/** Remplace le supa courant par un nouveau jeu de tables. */
function setTables(tables: Record<string, { data?: unknown; error?: unknown }>) {
  h.supa = h.makeSupa(tables);
}

describe('ProfileService.getMyProfile', () => {
  it('renvoie null si non connecté', async () => {
    expect(await profileService.getMyProfile()).toBeNull();
  });

  it('mappe la ligne DB → PublicProfile', async () => {
    setTables({
      profiles: {
        data: {
          id: 'u1', github_login: 'octocat', display_name: 'Octo',
          avatar_url: 'http://a/v.png', country: 'FR', atp_points: 120, challenges_done: 7,
        },
      },
    });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    const p = await profileService.getMyProfile();
    expect(p).toMatchObject({
      id: 'u1', githubLogin: 'octocat', displayName: 'Octo',
      avatarUrl: 'http://a/v.png', country: 'FR', atpPoints: 120, challengesDone: 7,
    });
  });

  it('forge un profil vide par défaut si aucune ligne (data null)', async () => {
    setTables({ profiles: { data: null } });
    h.auth.__setUser({ id: 'u-new', email: 'n@x.y' });
    const p = await profileService.getMyProfile();
    expect(p).toMatchObject({ id: 'u-new', githubLogin: '', displayName: '', atpPoints: 0, challengesDone: 0 });
  });

  it('renvoie null en cas d’erreur Supabase', async () => {
    setTables({ profiles: { error: { message: 'rls' } } });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    expect(await profileService.getMyProfile()).toBeNull();
  });

  it('met en cache puis l’invalide au changement d’auth', async () => {
    setTables({ profiles: { data: { id: 'u1', github_login: 'a', display_name: 'A' } } });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    await profileService.getMyProfile();
    const callsAfterFirst = h.supa.from.calls;
    await profileService.getMyProfile();
    expect(h.supa.from.calls).toBe(callsAfterFirst); // cache hit, pas de 2e appel
    h.auth.__setUser(null); // invalide le cache
    expect(await profileService.getMyProfile()).toBeNull();
  });
});

describe('ProfileService.getByLogin', () => {
  it('mappe un profil public par login', async () => {
    setTables({
      profiles: { data: { id: 'u9', github_login: 'linus', display_name: 'Linus', atp_points: 50, challenges_done: 3 } },
    });
    const p = await profileService.getByLogin('linus');
    expect(p).toMatchObject({ githubLogin: 'linus', displayName: 'Linus', atpPoints: 50, challengesDone: 3 });
  });

  it('renvoie null si introuvable', async () => {
    setTables({ profiles: { data: null } });
    expect(await profileService.getByLogin('ghost')).toBeNull();
  });
});

describe('ProfileService.updateMyProfile', () => {
  it('refuse si non connecté', async () => {
    const res = await profileService.updateMyProfile({ displayName: 'X' });
    expect(res.error).toBe('Non connecté.');
  });

  it('upsert sur id avec onConflict, sans jamais écrire les compteurs', async () => {
    setTables({ profiles: { data: null } });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    const res = await profileService.updateMyProfile({ displayName: 'Neo', country: 'US' });
    expect(res.error).toBeNull();

    const builder = h.supa.builders['profiles'];
    const [row, opts] = builder.__upsert[0];
    expect(row).toMatchObject({ id: 'u1', display_name: 'Neo', country: 'US' });
    expect(row).not.toHaveProperty('atp_points');
    expect(row).not.toHaveProperty('challenges_done');
    expect(opts).toEqual({ onConflict: 'id' });
  });

  it('n’inclut que les champs fournis dans le patch', async () => {
    setTables({ profiles: { data: null } });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    await profileService.updateMyProfile({ country: 'JP' });
    const [row] = h.supa.builders['profiles'].__upsert[0];
    expect(row).toMatchObject({ id: 'u1', country: 'JP' });
    expect(row).not.toHaveProperty('display_name');
  });

  it('remonte l’erreur Supabase', async () => {
    setTables({ profiles: { error: { message: 'denied' } } });
    h.auth.__setUser({ id: 'u1', email: 'o@x.y' });
    const res = await profileService.updateMyProfile({ displayName: 'X' });
    expect(res.error).toBe('denied');
  });
});