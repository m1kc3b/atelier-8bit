/* ─────────────────────────────────────────────────────────────
   Tests — core/super-admin.ts
   Couvre : état initial verrouillé, refresh() (pas de session → false ;
   is_super_admin=true → active ; ligne absente → false ; erreur RLS →
   false ; loaded passe à true), reset(), notifications onChange au
   changement de valeur uniquement.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSupabaseMock } from './helpers/supabase-mocks';

let sb = makeSupabaseMock();

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (sb.supabase as any)[p] }),
}));

import { superAdmin } from '../core/super-admin.js';

beforeEach(() => {
  superAdmin.reset();
});

describe('SuperAdmin', () => {
  it('démarre verrouillé et non chargé', () => {
    superAdmin.reset();
    expect(superAdmin.active).toBe(false);
    expect(superAdmin.loaded).toBe(false);
  });

  it('refresh sans session → verrouillé mais chargé', async () => {
    sb = makeSupabaseMock({ user: null });
    await superAdmin.refresh();
    expect(superAdmin.active).toBe(false);
    expect(superAdmin.loaded).toBe(true);
  });

  it('refresh avec is_super_admin=true → actif', async () => {
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { data: { is_super_admin: true } } } });
    await superAdmin.refresh();
    expect(superAdmin.active).toBe(true);
  });

  it('refresh avec is_super_admin=false → verrouillé', async () => {
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { data: { is_super_admin: false } } } });
    await superAdmin.refresh();
    expect(superAdmin.active).toBe(false);
  });

  it('refresh sans ligne profiles (data null) → verrouillé', async () => {
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { data: null } } });
    await superAdmin.refresh();
    expect(superAdmin.active).toBe(false);
  });

  it('refresh avec erreur RLS → verrouillé sans throw', async () => {
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { error: { message: 'rls' } } } });
    await expect(superAdmin.refresh()).resolves.toBeUndefined();
    expect(superAdmin.active).toBe(false);
  });

  it('notifie onChange uniquement quand active CHANGE', async () => {
    const cb = vi.fn();
    superAdmin.reset();
    const off = superAdmin.onChange(cb);

    // false → true : 1 notification
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { data: { is_super_admin: true } } } });
    await superAdmin.refresh();
    expect(cb).toHaveBeenCalledTimes(1);

    // true → true : aucune notification supplémentaire
    await superAdmin.refresh();
    expect(cb).toHaveBeenCalledTimes(1);

    off();
  });

  it('reset notifie si on était actif', async () => {
    sb = makeSupabaseMock({ user: { id: 'u1' }, tables: { profiles: { data: { is_super_admin: true } } } });
    await superAdmin.refresh();
    const cb = vi.fn();
    superAdmin.onChange(cb);
    superAdmin.reset();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(superAdmin.active).toBe(false);
    expect(superAdmin.loaded).toBe(false);
  });
});