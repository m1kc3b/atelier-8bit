/* ─────────────────────────────────────────────────────────────
   Tests — infra/tracking/funnel-tracker.ts
   Couvre : track() (insert Supabase avec step/meta/user_id, meta null
   par défaut, user_id null si déconnecté), robustesse fire-and-forget
   (une erreur réseau/RLS n'est jamais propagée), start() idempotent et
   branchement au bus (chuck:funnel-step → track).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* supabase est un singleton importé + FunnelTracker.start() lit
   supabase.auth.getUser() ; on mocke via Proxy pour différer l'accès. */
const supa = {
  from: vi.fn(),
  auth: { getUser: vi.fn() },
};
let insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));

vi.mock('../features/auth/auth-service', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (supa as any)[p] }),
}));

import { bus } from '../core/bus.js';
import { funnelTracker } from '../infra/tracking/funnel-tracker.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  supa.from.mockImplementation(() => ({ insert: insertMock }));
  supa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
});

describe('FunnelTracker.track', () => {
  it('insère dans funnel_events avec step, meta et user_id', async () => {
    funnelTracker.track('signed-in', { source: 'github' });
    await flush();

    expect(supa.from).toHaveBeenCalledWith('funnel_events');
    expect(insertMock).toHaveBeenCalledWith({
      step: 'signed-in',
      meta: { source: 'github' },
      user_id: 'u-1',
    });
  });

  it('meta absent → null', async () => {
    funnelTracker.track('tutorial-step');
    await flush();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'tutorial-step', meta: null }),
    );
  });

  it('user_id null si aucun utilisateur connecté', async () => {
    supa.auth.getUser.mockResolvedValue({ data: { user: null } });
    funnelTracker.track('tutorial-step');
    await flush();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null }),
    );
  });

  it('fire-and-forget : ne jette jamais même si getUser rejette', async () => {
    supa.auth.getUser.mockRejectedValue(new Error('réseau'));
    expect(() => funnelTracker.track('signed-in')).not.toThrow();
    await flush();
    // L'insert n'a pas eu lieu, mais aucune exception n'a fui.
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('fire-and-forget : ne jette jamais si insert rejette', async () => {
    insertMock.mockRejectedValue(new Error('RLS refuse'));
    expect(() => funnelTracker.track('signed-in')).not.toThrow();
    await flush();
    expect(insertMock).toHaveBeenCalled();
  });
});

describe('FunnelTracker.start', () => {
  it('branche chuck:funnel-step → track (insert déclenché)', async () => {
    funnelTracker.start();
    bus.emit('chuck:funnel-step', { step: 'signed-in', meta: { userId: 'u-1' } });
    await flush();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'signed-in' }),
    );
  });

  it('est idempotent : un second start() ne double pas l’abonnement', async () => {
    // start() a déjà été appelé au test précédent (singleton) ; un nouvel
    // appel ne doit pas re-souscrire. On vérifie qu'un seul insert part.
    funnelTracker.start();
    funnelTracker.start();
    bus.emit('chuck:funnel-step', { step: 'tutorial-step' });
    await flush();
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});