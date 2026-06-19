/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/local-storage-adapter.ts
   Implémentation de IStorageService sur localStorage.

   Caractéristiques :
   - Clé unique "chuck8_v2" → UserProgress JSON
   - Migration automatique depuis les anciennes clés v1
   - Suppression du doublon "validatedChallenges"
   - Prêt pour être remplacé par ApiStorageAdapter
   ───────────────────────────────────────────────────────────── */

import type {
  IStorageService,
  UserProgress,
  UserSession,
  ChallengeProgress,
  Medal,
} from './types.js';

// ── Constantes ────────────────────────────────────────────────

/** Clé unique dans localStorage pour v2 */
const STORAGE_KEY_V2 = 'chuck8_v2';

/** Version courante du schéma de données */
const SCHEMA_VERSION = 1;

// ── Anciennes clés v1 (pour migration) ───────────────────────
const V1_EMAIL_KEY     = 'chuck8_email_unlocked';
const V1_COMPLETED_KEY = 'chuck8_completed';
const V1_CODE_PREFIX   = 'chuck8_challenge_';
const V1_VALIDATED_KEY = 'validatedChallenges'; // doublon dans ChuckPanel

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
      const raw = localStorage.getItem(STORAGE_KEY_V2);
      if (raw) {
        const parsed = JSON.parse(raw) as UserProgress;
        // Migrations futures : if (parsed.schemaVersion < X) { ... }
        return parsed;
      }
    } catch {
      // localStorage indisponible ou JSON corrompu
    }

    // Pas de données v2 → tenter la migration depuis v1
    return this._migrateFromV1();
  }

  private _persist(): void {
    this._cache.lastUpdated = now();
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(this._cache));
    } catch {
      console.warn('[StorageService] Impossible d\'écrire dans localStorage');
    }
  }

  // ── Migration v1 → v2 ─────────────────────────────────────

  /**
   * Lit les anciennes clés éparpillées et les fusionne dans
   * la nouvelle structure UserProgress, puis supprime les vieilles clés.
   */
  private _migrateFromV1(): UserProgress {
    const progress = emptyProgress();
    let hasMigrated = false;

    try {
      // 1. Email / session
      const email = localStorage.getItem(V1_EMAIL_KEY);
      if (email) {
        progress.session = {
          email,
          createdAt: now(), // date exacte inconnue, on met maintenant
        };
        hasMigrated = true;
      }

      // 2. Completions (chuck8_completed → { [id]: { medal, hintsUsed } })
      const rawCompleted = localStorage.getItem(V1_COMPLETED_KEY);
      if (rawCompleted) {
        const oldCompleted = JSON.parse(rawCompleted) as Record<
          string,
          { medal: Medal; hintsUsed: number }
        >;
        for (const [idStr, data] of Object.entries(oldCompleted)) {
          const id = Number(idStr);
          if (!isNaN(id)) {
            progress.challenges[id] = {
              challengeId:  id,
              code:         '', // sera écrasé ci-dessous si code sauvegardé
              savedAt:      now(),
              completedAt:  now(),
              medal:        data.medal,
              hintsUsed:    data.hintsUsed,
            };
          }
        }
        hasMigrated = true;
      }

      // 3. Codes source (chuck8_challenge_N)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(V1_CODE_PREFIX)) continue;
        const idStr = key.slice(V1_CODE_PREFIX.length);
        const id    = Number(idStr);
        if (isNaN(id)) continue;
        const code  = localStorage.getItem(key) ?? '';
        if (!progress.challenges[id]) {
          progress.challenges[id] = {
            challengeId: id,
            code,
            savedAt:     now(),
          };
        } else {
          progress.challenges[id]!.code = code;
        }
        hasMigrated = true;
      }

      // 4. Supprimer les anciennes clés après migration réussie
      if (hasMigrated) {
        this._cleanV1Keys();
        console.info('[StorageService] Migration v1 → v2 effectuée.');
      }
    } catch (e) {
      console.warn('[StorageService] Erreur lors de la migration v1 → v2 :', e);
    }

    return progress;
  }

  /**
   * Supprime toutes les clés v1 de localStorage.
   * Appelé uniquement après une migration réussie.
   */
  private _cleanV1Keys(): void {
    try {
      // Supprimer les clés fixes
      localStorage.removeItem(V1_EMAIL_KEY);
      localStorage.removeItem(V1_COMPLETED_KEY);
      localStorage.removeItem(V1_VALIDATED_KEY);

      // Supprimer les clés dynamiques chuck8_challenge_N
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(V1_CODE_PREFIX)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Pas critique si on ne peut pas nettoyer
    }
  }

  // ── IStorageService — Session ─────────────────────────────

  getSession(): UserSession | null {
    return this._cache.session;
  }

  saveSession(email: string): UserSession {
    const session: UserSession = {
      email,
      createdAt: this._cache.session?.createdAt ?? now(),
      // userId et sessionToken renseignés par ApiStorageAdapter
    };
    this._cache.session = session;
    this._persist();
    return session;
  }

  isUnlocked(): boolean {
    return !!this._cache.session?.email;
  }

  // ── IStorageService — Code source ─────────────────────────

  loadCode(challengeId: number): string | null {
    const p = this._cache.challenges[challengeId];
    return p?.code ?? null;
  }

  saveCode(challengeId: number, code: string): void {
    const existing = this._cache.challenges[challengeId];
    this._cache.challenges[challengeId] = {
      challengeId,
      code,
      savedAt:      now(),
      // Préserver les données de complétion si elles existent
      completedAt:  existing?.completedAt,
      medal:        existing?.medal,
      hintsUsed:    existing?.hintsUsed,
      attempts:     existing?.attempts,
    };
    this._persist();
  }

  // ── IStorageService — Progression ─────────────────────────

  getProgress(challengeId: number): ChallengeProgress | null {
    return this._cache.challenges[challengeId] ?? null;
  }

  getAllProgress(): Record<number, ChallengeProgress> {
    return { ...this._cache.challenges };
  }

  saveCompletion(challengeId: number, medal: Medal, hintsUsed: number): ChallengeProgress {
    const existing = this._cache.challenges[challengeId];
    const updated: ChallengeProgress = {
      challengeId,
      code:        existing?.code ?? '',
      savedAt:     existing?.savedAt ?? now(),
      completedAt: now(),
      medal,
      hintsUsed,
      attempts:    (existing?.attempts ?? 0) + 1,
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
      localStorage.removeItem(STORAGE_KEY_V2);
    } catch {}
  }
}