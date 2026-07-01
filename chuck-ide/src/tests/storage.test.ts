/* ─────────────────────────────────────────────────────────────
   Tests — infra/storage/local-storage-adapter.ts
   Couvre : chargement initial (vide / corrompu / valide), session,
   isUnlocked, saveCompletion + persistance, getMedal/isCompleted,
   getAllProgress (copie défensive), getFullSnapshot (deep clone),
   clear, et la robustesse quand localStorage lève.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageAdapter } from '../infra/storage/local-storage-adapter.js';
import type { Medal } from '../infra/storage/types.js';

const KEY = 'chuck8_v3';

describe('LocalStorageAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('initialisation', () => {
    it('démarre sur une progression vide quand localStorage est vierge', () => {
      const a = new LocalStorageAdapter();
      expect(a.getAllProgress()).toEqual({});
      expect(a.getSession()).toBeNull();
    });

    it('repart propre si le JSON stocké est corrompu', () => {
      localStorage.setItem(KEY, '{ this is : not json');
      const a = new LocalStorageAdapter();
      expect(a.getAllProgress()).toEqual({});
    });

    it('recharge une progression valide existante', () => {
      const seed = {
        schemaVersion: 3,
        session: null,
        challenges: { 7: { challengeId: 7, completedAt: '2025-01-01T00:00:00Z', medal: '🥇', hintsUsed: 0 } },
        lastUpdated: '2025-01-01T00:00:00Z',
      };
      localStorage.setItem(KEY, JSON.stringify(seed));
      const a = new LocalStorageAdapter();
      expect(a.isCompleted(7)).toBe(true);
      expect(a.getMedal(7)).toBe('🥇');
    });
  });

  describe('session', () => {
    it('getSession retourne null par défaut', () => {
      expect(new LocalStorageAdapter().getSession()).toBeNull();
    });

    it('isUnlocked est false sans userId', () => {
      expect(new LocalStorageAdapter().isUnlocked()).toBe(false);
    });

    it('isUnlocked est true si une session avec userId est présente', () => {
      const seed = {
        schemaVersion: 3,
        session: { userId: 'u-123', createdAt: '2025-01-01T00:00:00Z' },
        challenges: {},
        lastUpdated: '2025-01-01T00:00:00Z',
      };
      localStorage.setItem(KEY, JSON.stringify(seed));
      expect(new LocalStorageAdapter().isUnlocked()).toBe(true);
    });
  });

  describe('saveCompletion', () => {
    it('enregistre la médaille et les indices, et renvoie l’entrée', () => {
      const a = new LocalStorageAdapter();
      const res = a.saveCompletion(3, '🥈', 2);
      expect(res.challengeId).toBe(3);
      expect(res.medal).toBe('🥈');
      expect(res.hintsUsed).toBe(2);
      expect(typeof res.completedAt).toBe('string');
    });

    it('persiste dans localStorage (relisible par une nouvelle instance)', () => {
      new LocalStorageAdapter().saveCompletion(5, '🥉', 1);
      const reloaded = new LocalStorageAdapter();
      expect(reloaded.isCompleted(5)).toBe(true);
      expect(reloaded.getMedal(5)).toBe('🥉');
      expect(reloaded.getProgress(5)?.hintsUsed).toBe(1);
    });

    it('écrase une complétion existante du même défi', () => {
      const a = new LocalStorageAdapter();
      a.saveCompletion(1, '🥉', 3);
      a.saveCompletion(1, '🥇', 0);
      expect(a.getMedal(1)).toBe('🥇');
      expect(a.getProgress(1)?.hintsUsed).toBe(0);
    });
  });

  describe('lecture de progression', () => {
    let a: LocalStorageAdapter;
    beforeEach(() => {
      a = new LocalStorageAdapter();
      a.saveCompletion(1, '🥇', 0);
      a.saveCompletion(2, '🥈', 1);
    });

    it('getProgress renvoie null pour un défi inconnu', () => {
      expect(a.getProgress(999)).toBeNull();
    });

    it('isCompleted est false pour un défi inconnu', () => {
      expect(a.isCompleted(999)).toBe(false);
    });

    it('getMedal renvoie null pour un défi inconnu', () => {
      expect(a.getMedal(999)).toBeNull();
    });

    it('getAllProgress renvoie une COPIE (muter le retour n’altère pas le cache)', () => {
      const snap = a.getAllProgress();
      delete (snap as Record<number, unknown>)[1];
      expect(a.isCompleted(1)).toBe(true);
    });

    it('getFullSnapshot renvoie un deep clone indépendant', () => {
      const snap = a.getFullSnapshot();
      snap.challenges[1].medal = '🥉' as Medal;
      expect(a.getMedal(1)).toBe('🥇');
    });
  });

  describe('clear', () => {
    it('efface le cache et la clé localStorage', () => {
      const a = new LocalStorageAdapter();
      a.saveCompletion(1, '🥇', 0);
      a.clear();
      expect(a.getAllProgress()).toEqual({});
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('robustesse', () => {
    it('n’explose pas si setItem lève (quota/refus)', () => {
      const a = new LocalStorageAdapter();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      expect(() => a.saveCompletion(1, '🥇', 0)).not.toThrow();
      // L’entrée reste néanmoins disponible en mémoire.
      expect(a.isCompleted(1)).toBe(true);
    });
  });
});