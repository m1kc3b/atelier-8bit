/* ─────────────────────────────────────────────────────────────
   Tests — features/defis/defi-manager.ts
   Couvre : init/destroy (abonnements bus), chargement défi+classement
   sur chuck:ide-defi, garde anti-réentrance (_loading), classement vide
   si pas de défi, soumission (verdicts : pas de défi / non connecté /
   code vide / accepté → log + re-ranking / refusé → log err).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// État mutable partagé piloté par les tests.
const state: {
  currentDefi: any;
  ranking: any[];
  submitResult: any;
  authed: boolean;
  userId: string | undefined;
} = { currentDefi: null, ranking: [], submitResult: null, authed: false, userId: undefined };

const defisServiceMock = {
  getCurrentDefi: vi.fn(async () => state.currentDefi),
  getRanking: vi.fn(async () => state.ranking),
  submit: vi.fn(async () => state.submitResult),
};

const authServiceMock = {
  isAuthenticated: vi.fn(() => state.authed),
  getUser: vi.fn(() => (state.authed ? { id: state.userId ?? 'me', email: '' } : null)),
  onChange: vi.fn(() => () => {}),
};

vi.mock('../features/defis/defis-service.js', () => ({
  defisService: new Proxy({}, { get: (_t, p) => (defisServiceMock as any)[p] }),
}));
vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: new Proxy({}, { get: (_t, p) => (authServiceMock as any)[p] }),
}));

import { bus } from '../core/bus.js';
import { DefiManager } from '../features/defis/defi-manager.js';

/** Attend la résolution des microtâches (les handlers bus sont async fire-and-forget). */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('DefiManager', () => {
  let mgr: DefiManager;

  beforeEach(() => {
    vi.clearAllMocks();
    state.currentDefi = null;
    state.ranking = [];
    state.submitResult = null;
    state.authed = false;
    state.userId = undefined;
    mgr = new DefiManager();
    mgr.init();
  });

  afterEach(() => {
    // Le bus est un singleton partagé : sans destroy(), les abonnements des
    // managers précédents s'accumulent et polluent les tests suivants.
    mgr.destroy();
  });

  describe('chargement sur chuck:ide-defi', () => {
    it('émet chuck:defi-loaded avec le défi courant', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'Juin', instructions: '' };
      const loaded = vi.fn();
      bus.on('chuck:defi-loaded', loaded);

      bus.emit('chuck:ide-defi', undefined);
      await flush();

      expect(loaded).toHaveBeenCalledWith({ defi: state.currentDefi });
      expect(mgr.current).toEqual(state.currentDefi);
    });

    it('émet le classement quand un défi existe', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      state.ranking = [{ rank: 1, userId: 'u1', displayName: 'Z', score: 9, prestige: false, isMe: false }];
      const ranking = vi.fn();
      bus.on('chuck:defi-ranking', ranking);

      bus.emit('chuck:ide-defi', undefined);
      await flush();

      expect(ranking).toHaveBeenCalledWith({ entries: state.ranking });
    });

    it('émet un classement vide quand aucun défi n’est publié', async () => {
      state.currentDefi = null;
      const ranking = vi.fn();
      bus.on('chuck:defi-ranking', ranking);

      bus.emit('chuck:ide-defi', undefined);
      await flush();

      expect(ranking).toHaveBeenCalledWith({ entries: [] });
      expect(defisServiceMock.getRanking).not.toHaveBeenCalled();
    });

    it('passe l’id du joueur courant au classement (surlignage isMe)', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      state.authed = true;
      state.userId = 'u-me';
      bus.emit('chuck:ide-defi', undefined);
      await flush();
      expect(defisServiceMock.getRanking).toHaveBeenCalledWith('d1', 'u-me');
    });

    it('réagit aussi à chuck:defis-requested', async () => {
      state.currentDefi = { id: 'd2', month: '2026-07', title: 'Y', instructions: '' };
      const loaded = vi.fn();
      bus.on('chuck:defi-loaded', loaded);
      bus.emit('chuck:defis-requested', undefined);
      await flush();
      expect(loaded).toHaveBeenCalled();
    });
  });

  describe('soumission', () => {
    it('refuse s’il n’y a aucun défi actif', async () => {
      const submitted = vi.fn();
      bus.on('chuck:defi-submitted', submitted);
      bus.emit('chuck:defi-submit', { source: 'LDA #1' });
      await flush();
      expect(submitted).toHaveBeenCalledWith({ result: { accepted: false, error: 'Aucun défi actif.' } });
      expect(defisServiceMock.submit).not.toHaveBeenCalled();
    });

    it('refuse si non connecté', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      bus.emit('chuck:ide-defi', undefined);
      await flush();
      state.authed = false;

      const submitted = vi.fn();
      bus.on('chuck:defi-submitted', submitted);
      bus.emit('chuck:defi-submit', { source: 'LDA #1' });
      await flush();

      expect(submitted.mock.calls.at(-1)?.[0].result.accepted).toBe(false);
      expect(defisServiceMock.submit).not.toHaveBeenCalled();
    });

    it('refuse un code vide', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      state.authed = true;
      bus.emit('chuck:ide-defi', undefined);
      await flush();

      const submitted = vi.fn();
      bus.on('chuck:defi-submitted', submitted);
      bus.emit('chuck:defi-submit', { source: '   ' });
      await flush();

      expect(submitted.mock.calls.at(-1)?.[0].result.error).toBe('Le code est vide.');
      expect(defisServiceMock.submit).not.toHaveBeenCalled();
    });

    it('soumission acceptée → verdict + log ok + re-classement', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      state.authed = true;
      state.submitResult = { accepted: true, rank: 2, cycles: 100, bytes: 40 };
      bus.emit('chuck:ide-defi', undefined);
      await flush();

      const submitted = vi.fn();
      const log = vi.fn();
      bus.on('chuck:defi-submitted', submitted);
      bus.on('chuck:log', log);
      defisServiceMock.getRanking.mockClear();

      bus.emit('chuck:defi-submit', { source: 'LDA #1' });
      await flush();

      expect(submitted).toHaveBeenCalledWith({ result: state.submitResult });
      expect(log.mock.calls.at(-1)?.[0].level).toBe('ok');
      // Re-classement après acceptation.
      expect(defisServiceMock.getRanking).toHaveBeenCalled();
    });

    it('soumission refusée → log err, pas de re-classement', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      state.authed = true;
      state.submitResult = { accepted: false, error: 'Échec test caché 3' };
      bus.emit('chuck:ide-defi', undefined);
      await flush();

      const log = vi.fn();
      bus.on('chuck:log', log);
      defisServiceMock.getRanking.mockClear();

      bus.emit('chuck:defi-submit', { source: 'LDA #1' });
      await flush();

      expect(log.mock.calls.at(-1)?.[0].level).toBe('err');
      expect(defisServiceMock.getRanking).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('désabonne tout : plus aucune réaction au bus', async () => {
      state.currentDefi = { id: 'd1', month: '2026-06', title: 'X', instructions: '' };
      mgr.destroy();
      defisServiceMock.getCurrentDefi.mockClear();
      bus.emit('chuck:ide-defi', undefined);
      await flush();
      expect(defisServiceMock.getCurrentDefi).not.toHaveBeenCalled();
    });
  });
});