/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/types.ts
   Contrat de données partagé frontend ↔ backend.
   Toutes les structures ici sont sérialisables en JSON.
   ───────────────────────────────────────────────────────────── */

// ── Session utilisateur ───────────────────────────────────────

/**
 * Ce qu'on sait de l'utilisateur.
 * En local, seul `email` et `createdAt` sont renseignés.
 * Quand le backend existe, il ajoute `userId` + `sessionToken`.
 */
export interface UserSession {
  /** Email saisi dans la gate (identifiant humain) */
  email:         string;
  /** Date de création de la session (ISO 8601) */
  createdAt:     string;
  /** Futur : identifiant opaque côté serveur */
  userId?:       string;
  /** Futur : JWT ou token de session retourné par l'API */
  sessionToken?: string;
}

// ── Progression par défi ──────────────────────────────────────

export type Medal = '🥇' | '🥈' | '🥉';

/**
 * État de progression pour un défi donné.
 * Existe dès le premier autosave, même si le défi n'est pas validé.
 */
export interface ChallengeProgress {
  /** ID du défi (correspond à Challenge.id) */
  challengeId:   number;
  /** Dernier code source sauvegardé (autosave) */
  code:          string;
  /** Timestamp du dernier autosave (ISO 8601) */
  savedAt:       string;
  /** Renseigné uniquement si le défi a été validé */
  completedAt?:  string;
  /** Médaille obtenue lors de la validation */
  medal?:        Medal;
  /** Nombre d'indices utilisés lors de la validation */
  hintsUsed?:    number;
  /** Futur : nombre de tentatives (analytics) */
  attempts?:     number;
}

// ── État global persisté ──────────────────────────────────────

/**
 * Racine du snapshot de progression.
 * C'est ce qui est sérialisé dans localStorage (clé unique)
 * et ce que le backend recevra / renverra.
 */
export interface UserProgress {
  /** Version du schéma — pour migrations futures */
  schemaVersion: number;
  /** Session courante (null si l'utilisateur n'a pas encore saisi son email) */
  session:       UserSession | null;
  /** Map challengeId → progression */
  challenges:    Record<number, ChallengeProgress>;
  /**
   * Timestamp du dernier write local (ISO 8601).
   * Permet de détecter les conflits lors d'une future sync.
   */
  lastUpdated:   string;
}

// ── Interface du service ──────────────────────────────────────

/**
 * Contrat commun entre LocalStorageAdapter et ApiStorageAdapter.
 * Le reste du code n'importe que cette interface.
 */
export interface IStorageService {
  // ── Session ──────────────────────────────────────────────

  /** Retourne la session courante ou null */
  getSession(): UserSession | null;

  /**
   * Enregistre l'email de l'utilisateur et crée la session.
   * Remplace un éventuel token partiel persisté en mode anonyme.
   */
  saveSession(email: string): UserSession;

  /** true si une session avec email existe */
  isUnlocked(): boolean;

  // ── Code source (autosave) ───────────────────────────────

  /** Retourne le dernier code sauvegardé pour ce défi, ou null */
  loadCode(challengeId: number): string | null;

  /** Sauvegarde le code source (appelé par l'autosave) */
  saveCode(challengeId: number, code: string): void;

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