/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/local-storage-adapter.ts
   Cache localStorage de IStorageService (complétion seule).

   - Clé unique "chuck8_v3" → UserProgress JSON
   - Plus d'autosave de code ni de session email : la migration v1/v2
     historique est retirée (schéma v3, repart propre).
   ───────────────────────────────────────────────────────────── */

import type {
  IStorageService,
  UserProgress,
  UserSession,
  ChallengeProgress,
  Medal,
} from './types.js';

// ── Constantes ────────────────────────────────────────────────

const STORAGE_KEY = 'chuck8_v3';
const SCHEMA_VERSION = 3;

// ── Helpers ───────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function emptyProgress(): UserProgress {
  return {
    schemaVersion: SCHEMA_VERSION,
    session:       null,
    challenges:    {},
    lastUpdated:   now(),
  };
}

// ── Adaptateur ────────────────────────────────────────────────

export class LocalStorageAdapter implements IStorageService {

  private _cache: UserProgress;

  constructor() {
    this._cache = this._load();
  }

  // ── Lecture / écriture interne ────────────────────────────

  private _load(): UserProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as UserProgress;
      }
    } catch {
      // localStorage indisponible ou JSON corrompu
    }
    return emptyProgress();
  }

  private _persist(): void {
    this._cache.lastUpdated = now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._cache));
    } catch {
      console.warn('[StorageService] Impossible d\'écrire dans localStorage');
    }
  }

  // ── IStorageService — Session ─────────────────────────────

  getSession(): UserSession | null {
    return this._cache.session;
  }

  isUnlocked(): boolean {
    return !!this._cache.session?.userId;
  }

  // ── IStorageService — Progression ─────────────────────────

  getProgress(challengeId: number): ChallengeProgress | null {
    return this._cache.challenges[challengeId] ?? null;
  }

  getAllProgress(): Record<number, ChallengeProgress> {
    return { ...this._cache.challenges };
  }

  saveCompletion(challengeId: number, medal: Medal, hintsUsed: number): ChallengeProgress {
    const updated: ChallengeProgress = {
      challengeId,
      completedAt: now(),
      medal,
      hintsUsed,
    };
    this._cache.challenges[challengeId] = updated;
    this._persist();
    return updated;
  }

  isCompleted(challengeId: number): boolean {
    return !!this._cache.challenges[challengeId]?.completedAt;
  }

  getMedal(challengeId: number): Medal | null {
    return this._cache.challenges[challengeId]?.medal ?? null;
  }

  // ── IStorageService — Utilitaires ─────────────────────────

  getFullSnapshot(): UserProgress {
    return JSON.parse(JSON.stringify(this._cache)) as UserProgress;
  }

  clear(): void {
    this._cache = emptyProgress();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}