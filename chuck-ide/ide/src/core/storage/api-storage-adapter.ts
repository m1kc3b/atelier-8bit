/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/storage/api-storage-adapter.ts
   Implémentation de IStorageService sur API REST.

   STATUT : stub — non utilisé en production.
   À activer quand le backend existe en passant STORAGE_MODE='api'
   dans storage-service.ts.

   Stratégie :
   - L'interface reste synchrone (compatible IStorageService).
   - Les appels réseau se font en fire-and-forget via _fire().
   - L'autosave du code reste local (trop fréquent pour le réseau).
   - En cas d'erreur réseau, le cache local fait foi, aucune perte.
   ───────────────────────────────────────────────────────────── */

import type {
  IStorageService,
  UserProgress,
  UserSession,
  ChallengeProgress,
  Medal,
} from './types.js';
import { LocalStorageAdapter } from './local-storage-adapter.js';

// ── Configuration ─────────────────────────────────────────────

const API_BASE = '/api/v1'; // À remplacer par l'URL de prod

// ── Helpers ───────────────────────────────────────────────────

/**
 * Lance une requête fetch en arrière-plan sans bloquer l'appelant.
 * Les erreurs sont silencieuses — le cache local fait foi.
 */
function fire(input: RequestInfo, init?: RequestInit): void {
  fetch(input, init).catch(err =>
    console.warn('[ApiStorage] Requête échouée (ignorée) :', err),
  );
}

function authHeader(session: UserSession | null): HeadersInit {
  return session?.sessionToken
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.sessionToken}` }
    : { 'Content-Type': 'application/json' };
}

// ── Adaptateur ────────────────────────────────────────────────

/**
 * Délègue toutes les opérations au LocalStorageAdapter (cache local)
 * et envoie les événements importants à l'API en fire-and-forget.
 *
 * Implémente IStorageService de façon synchrone — les appelants
 * n'ont pas besoin d'await. La valeur retournée vient toujours
 * du cache local immédiatement.
 */
export class ApiStorageAdapter implements IStorageService {

  /** Cache local — source de vérité immédiate */
  private _local: LocalStorageAdapter;

  constructor() {
    this._local = new LocalStorageAdapter();
    // Tenter de récupérer la progression depuis l'API au démarrage
    this._syncFromApi();
  }

  // ── Session ───────────────────────────────────────────────

  getSession(): UserSession | null {
    return this._local.getSession();
  }

  saveSession(email: string): UserSession {
    // 1. Sauvegarder localement — retour immédiat
    const session = this._local.saveSession(email);

    // 2. Notifier le backend en arrière-plan
    fire(`${API_BASE}/users/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email,
        // Envoyer la progression accumulée en mode anonyme
        progress: this._local.getFullSnapshot(),
      }),
    });

    // Note : l'enrichissement sessionToken/userId se fera lors de
    // la prochaine _syncFromApi() ou d'un refresh de page.
    return session;
  }

  isUnlocked(): boolean {
    return this._local.isUnlocked();
  }

  // ── Code source (autosave — reste local) ──────────────────

  loadCode(challengeId: number): string | null {
    return this._local.loadCode(challengeId);
  }

  saveCode(challengeId: number, code: string): void {
    // L'autosave reste purement local (trop fréquent pour l'API)
    this._local.saveCode(challengeId, code);
  }

  // ── Progression ───────────────────────────────────────────

  getProgress(challengeId: number): ChallengeProgress | null {
    return this._local.getProgress(challengeId);
  }

  getAllProgress(): Record<number, ChallengeProgress> {
    return this._local.getAllProgress();
  }

  saveCompletion(challengeId: number, medal: Medal, hintsUsed: number): ChallengeProgress {
    // 1. Sauvegarder localement — retour immédiat
    const progress = this._local.saveCompletion(challengeId, medal, hintsUsed);

    // 2. Notifier le backend en arrière-plan
    fire(`${API_BASE}/progress/complete`, {
      method:  'POST',
      headers: authHeader(this._local.getSession()),
      body:    JSON.stringify({ challengeId, medal, hintsUsed }),
    });

    return progress;
  }

  isCompleted(challengeId: number): boolean {
    return this._local.isCompleted(challengeId);
  }

  getMedal(challengeId: number): Medal | null {
    return this._local.getMedal(challengeId);
  }

  // ── Utilitaires ───────────────────────────────────────────

  getFullSnapshot(): UserProgress {
    return this._local.getFullSnapshot();
  }

  clear(): void {
    this._local.clear();
    // TODO: DELETE /api/v1/progress si nécessaire
  }

  // ── Sync depuis l'API ──────────────────────────────────────

  /**
   * Récupère la progression depuis le serveur et écrase le cache local
   * si la version serveur est plus récente.
   * Fire-and-forget : les erreurs sont silencieuses.
   */
  private _syncFromApi(): void {
    const session = this._local.getSession();
    if (!session?.sessionToken) return;

    fetch(`${API_BASE}/progress`, {
      headers: authHeader(session),
    })
      .then(res => res.ok ? res.json() : null)
      .then((serverProgress: UserProgress | null) => {
        if (!serverProgress) return;
        const local    = this._local.getFullSnapshot();
        const serverTs = new Date(serverProgress.lastUpdated).getTime();
        const localTs  = new Date(local.lastUpdated).getTime();
        if (serverTs > localTs) {
          // TODO: exposer _import() sur LocalStorageAdapter pour écraser
          // le cache local avec la version serveur.
          console.info('[ApiStorage] Version serveur plus récente — sync à implémenter.');
        }
      })
      .catch(() => {
        console.warn('[ApiStorage] Sync initiale échouée, mode local activé.');
      });
  }
}