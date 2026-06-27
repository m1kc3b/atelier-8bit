/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/types.ts
   Contrat de données partagé frontend ↔ backend.
   Toutes les structures ici sont sérialisables en JSON.

   Le code source en cours n'est plus persisté (pas d'autosave ni de
   reprise d'éditeur) : on ne stocke que la complétion des défis.
   ───────────────────────────────────────────────────────────── */

// ── Session utilisateur ───────────────────────────────────────

/**
 * Ce qu'on sait de l'utilisateur. L'identité réelle vient de l'auth
 * (GitHub OAuth via authService) : userId est la source de vérité.
 */
export interface UserSession {
  /** Identifiant opaque côté serveur (auth.users.id) */
  userId:     string;
  /** Date de création de la session (ISO 8601) */
  createdAt:  string;
}

// ── Progression par défi ──────────────────────────────────────

export type Medal = '🥇' | '🥈' | '🥉';

/**
 * État de progression pour un défi donné.
 * Créé uniquement à la validation : on ne garde aucune trace tant que
 * le défi n'est pas complété.
 */
export interface ChallengeProgress {
  /** ID du défi (correspond à Challenge.id) */
  challengeId:   number;
  /** Date de validation (ISO 8601) */
  completedAt:   string;
  /** Médaille obtenue lors de la validation */
  medal:         Medal;
  /** Nombre d'indices utilisés lors de la validation */
  hintsUsed:     number;
}

// ── État global persisté ──────────────────────────────────────

/**
 * Racine du snapshot de progression.
 * Sérialisé dans localStorage (cache) et reflété côté backend.
 */
export interface UserProgress {
  /** Version du schéma — pour migrations futures */
  schemaVersion: number;
  /** Session courante (null si non connecté) */
  session:       UserSession | null;
  /** Map challengeId → progression */
  challenges:    Record<number, ChallengeProgress>;
  /** Timestamp du dernier write local (ISO 8601) */
  lastUpdated:   string;
}

// ── Interface du service ──────────────────────────────────────

/**
 * Contrat commun entre LocalStorageAdapter et SupabaseStorageAdapter.
 * Le reste du code n'importe que cette interface.
 */
export interface IStorageService {
  // ── Session ──────────────────────────────────────────────

  /** Retourne la session courante ou null */
  getSession(): UserSession | null;

  /** true si l'utilisateur est connecté */
  isUnlocked(): boolean;

  // ── Progression / complétion ─────────────────────────────

  /** Retourne la progression d'un défi ou null */
  getProgress(challengeId: number): ChallengeProgress | null;

  /** Retourne toute la map de progression */
  getAllProgress(): Record<number, ChallengeProgress>;

  /** Enregistre la complétion d'un défi avec sa médaille */
  saveCompletion(challengeId: number, medal: Medal, hintsUsed: number): ChallengeProgress;

  /** true si le défi a été validé */
  isCompleted(challengeId: number): boolean;

  /** Retourne la médaille pour un défi, ou null */
  getMedal(challengeId: number): Medal | null;

  // ── Utilitaires ──────────────────────────────────────────

  /** Retourne le snapshot complet (pour debug ou future sync) */
  getFullSnapshot(): UserProgress;

  /** Efface toutes les données (utile pour les tests ou le reset) */
  clear(): void;
}