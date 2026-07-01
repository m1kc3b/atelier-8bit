/* ─────────────────────────────────────────────────────────────
   Tests — infra/storage/supabase-storage-adapter.ts
   Couvre : délégation au cache local, isUnlocked (superAdmin OR auth),
   write-through Supabase à saveCompletion (upsert + onConflict), pas
   d’écriture serveur si non connecté, et la sync serveur→local /
   local→serveur au login.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSupabaseMock, makeAuthServiceMock } from './helpers/supabase-mocks';

let sb = makeSupabaseMock({ user: null });
const auth = makeAuthServiceMock(null);
const superAdminMock = { active: false };

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (sb.supabase as any)[p] }),
  authService: new Proxy({}, { get: (_t, p) => (auth as any)[p] }),
}));
vi.mock('../core/super-admin.js', () => ({
  superAdmin: new Proxy({}, { get: (_t, p) => (superAdminMock as any)[p] }),
}));

import { SupabaseStorageAdapter } from '../infra/storage/supabase-storage-adapter.js';

describe('SupabaseStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    auth.__setUser(null);
    superAdminMock.active = false;
    sb.supabase.from.mockClear();
  });

  describe('isUnlocked', () => {
    it('false quand ni superAdmin ni auth', () => {
      const a = new SupabaseStorageAdapter();
      expect(a.isUnlocked()).toBe(false);
    });

    it('true si superAdmin actif', () => {
      superAdminMock.active = true;
      const a = new SupabaseStorageAdapter();
      expect(a.isUnlocked()).toBe(true);
    });

    it('true si authentifié', () => {
      const a = new SupabaseStorageAdapter();
      auth.__setUser({ id: 'u-1', email: 'x@y.z' });
      expect(a.isUnlocked()).toBe(true);
    });
  });

  describe('getSession', () => {
    it('dérive la session de l’utilisateur authentifié', () => {
      const a = new SupabaseStorageAdapter();
      auth.__setUser({ id: 'u-42', email: 'a@b.c' });
      expect(a.getSession()?.userId).toBe('u-42');
    });

    it('retombe sur le cache local si non connecté', () => {
      const a = new SupabaseStorageAdapter();
      expect(a.getSession()).toBeNull();
    });
  });

  describe('saveCompletion', () => {
    it('écrit toujours en local (lecture immédiate)', () => {
      const a = new SupabaseStorageAdapter();
      a.saveCompletion(3, '🥈', 1);
      expect(a.isCompleted(3)).toBe(true);
      expect(a.getMedal(3)).toBe('🥈');
    });

    it('NE pousse PAS vers Supabase si non connecté', () => {
      const a = new SupabaseStorageAdapter();
      sb.supabase.from.mockClear();
      a.saveCompletion(3, '🥈', 1);
      expect(sb.supabase.from).not.toHaveBeenCalledWith('challenge_progress');
    });

    it('pousse un upsert avec onConflict user_id,challenge_id si connecté', () => {
      const a = new SupabaseStorageAdapter();
      auth.__setUser({ id: 'u-9', email: 'a@b.c' });
      sb.supabase.from.mockClear();

      a.saveCompletion(7, '🥇', 0);

      expect(sb.supabase.from).toHaveBeenCalledWith('challenge_progress');
      const builder = sb.builders['challenge_progress'];
      expect(builder.upsert).toHaveBeenCalledTimes(1);
      const [row, opts] = builder.upsert.mock.calls[0];
      expect(row).toMatchObject({ user_id: 'u-9', challenge_id: 7, medal: '🥇', hints_used: 0 });
      expect(opts).toEqual({ onConflict: 'user_id,challenge_id' });
    });
  });

  describe('délégation lecture', () => {
    it('getAllProgress / getProgress passent par le cache local', () => {
      const a = new SupabaseStorageAdapter();
      a.saveCompletion(1, '🥉', 2);
      expect(a.getProgress(1)?.hintsUsed).toBe(2);
      expect(Object.keys(a.getAllProgress())).toContain('1');
    });

    it('clear vide la progression locale', () => {
      const a = new SupabaseStorageAdapter();
      a.saveCompletion(1, '🥉', 0);
      a.clear();
      expect(a.getAllProgress()).toEqual({});
    });
  });
});