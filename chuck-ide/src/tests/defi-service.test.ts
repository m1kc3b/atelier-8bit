/* ─────────────────────────────────────────────────────────────
   Tests — features/defis/defis-service.ts
   Couvre : getCurrentDefi (mapping, cache, null sur error/absence),
   getRanking (mapping, isMe, fallbacks, tableau vide sur error),
   submit (verdict serveur normalisé, erreur réseau), clearCache.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSupabaseMock } from './helpers/supabase-mocks';

let sb = makeSupabaseMock();

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (sb.supabase as any)[p] }),
  authService: { getUser: () => null, isAuthenticated: () => false, onChange: () => () => {} },
}));

import { defisService } from '../features/defis/defis-service.js';

beforeEach(() => {
  defisService.clearCache();
});

describe('DefisService.getCurrentDefi', () => {
  it('mappe la ligne DB → Defi (camelCase, defaults)', async () => {
    sb = makeSupabaseMock({
      tables: {
        defis: {
          data: {
            id: 'd1', month: '2026-06', title: 'Juin', instructions: 'Énoncé',
            template: 'LDA #1', opens_at: '2026-06-01T00:00:00Z', closes_at: '2026-06-30T00:00:00Z',
          },
        },
      },
    });
    const defi = await defisService.getCurrentDefi();
    expect(defi).toMatchObject({
      id: 'd1', month: '2026-06', title: 'Juin', instructions: 'Énoncé',
      template: 'LDA #1', opensAt: '2026-06-01T00:00:00Z', closesAt: '2026-06-30T00:00:00Z',
    });
  });

  it('renvoie null quand aucun défi publié (data null)', async () => {
    sb = makeSupabaseMock({ tables: { defis: { data: null } } });
    expect(await defisService.getCurrentDefi()).toBeNull();
  });

  it('renvoie null en cas d’erreur Supabase (sans throw)', async () => {
    sb = makeSupabaseMock({ tables: { defis: { error: { message: 'boom' } } } });
    expect(await defisService.getCurrentDefi()).toBeNull();
  });

  it('met en cache (un seul appel réseau pour deux lectures)', async () => {
    sb = makeSupabaseMock({
      tables: { defis: { data: { id: 'd1', month: '2026-06', title: 'X' } } },
    });
    await defisService.getCurrentDefi();
    await defisService.getCurrentDefi();
    expect(sb.supabase.from).toHaveBeenCalledTimes(1);
  });

  it('instructions/template absents → defaults (string vide / undefined)', async () => {
    sb = makeSupabaseMock({
      tables: { defis: { data: { id: 'd1', month: '2026-06', title: 'X' } } },
    });
    const defi = await defisService.getCurrentDefi();
    expect(defi?.instructions).toBe('');
    expect(defi?.template).toBeUndefined();
  });
});

describe('DefisService.getRanking', () => {
  it('mappe les lignes et marque isMe pour le joueur courant', async () => {
    sb = makeSupabaseMock({
      tables: {
        defi_rankings: {
          data: [
            { rank: 1, user_id: 'u1', display_name: 'Alice', score: 95, cycles: 100, bytes: 30, prestige: true },
            { rank: 2, user_id: 'u2', display_name: null, score: '80', cycles: null, bytes: null, prestige: null },
          ],
        },
      },
    });
    const rows = await defisService.getRanking('d1', 'u2');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rank: 1, userId: 'u1', displayName: 'Alice', score: 95, prestige: true, isMe: false });
    expect(rows[1]).toMatchObject({ rank: 2, displayName: 'Anonyme', score: 80, prestige: false, isMe: true });
  });

  it('renvoie [] en cas d’erreur', async () => {
    sb = makeSupabaseMock({ tables: { defi_rankings: { error: { message: 'x' } } } });
    expect(await defisService.getRanking('d1')).toEqual([]);
  });

  it('renvoie [] si data null', async () => {
    sb = makeSupabaseMock({ tables: { defi_rankings: { data: null } } });
    expect(await defisService.getRanking('d1')).toEqual([]);
  });

  it('score non numérique non parsable → 0', async () => {
    sb = makeSupabaseMock({
      tables: { defi_rankings: { data: [{ rank: 1, user_id: 'u', display_name: 'Z', score: 'abc' }] } },
    });
    const rows = await defisService.getRanking('d1');
    expect(rows[0].score).toBe(0);
  });
});

describe('DefisService.submit', () => {
  it('normalise un verdict accepté', async () => {
    sb = makeSupabaseMock({ invoke: { data: { accepted: true, rank: 3, score: 88, cycles: 120, bytes: 40 } } });
    const r = await defisService.submit('d1', 'LDA #1');
    expect(r).toMatchObject({ accepted: true, rank: 3, score: 88, cycles: 120, bytes: 40 });
  });

  it('accepted devient false si la fonction ne renvoie pas true strict', async () => {
    sb = makeSupabaseMock({ invoke: { data: { accepted: 'yes' } } });
    const r = await defisService.submit('d1', 'LDA #1');
    expect(r.accepted).toBe(false);
  });

  it('mappe une erreur réseau/fonction en résultat refusé', async () => {
    sb = makeSupabaseMock({ invoke: { error: { message: 'Function not found' } } });
    const r = await defisService.submit('d1', 'LDA #1');
    expect(r.accepted).toBe(false);
    expect(r.error).toBe('Function not found');
  });

  it('data null → objet refusé sans planter', async () => {
    sb = makeSupabaseMock({ invoke: { data: null } });
    const r = await defisService.submit('d1', 'LDA #1');
    expect(r.accepted).toBe(false);
  });
});

describe('DefisService.clearCache', () => {
  it('force une relecture du défi après invalidation', async () => {
    sb = makeSupabaseMock({ tables: { defis: { data: { id: 'd1', month: '2026-06', title: 'X' } } } });
    await defisService.getCurrentDefi();
    defisService.clearCache();
    await defisService.getCurrentDefi();
    expect(sb.supabase.from).toHaveBeenCalledTimes(2);
  });
});