import type {
  IStorageService,
  UserProgress,
  UserSession,
  ChallengeProgress,
  Medal,
} from './types.js';
import { LocalStorageAdapter } from './local-storage-adapter.js';
import { supabase, authService } from '../auth/auth-service.js';
import { superAdmin } from "../super-admin.js";

function fire(promise: PromiseLike<unknown>): void {
  Promise.resolve(promise)
    .then((res: any) => {
      if (res && res.error) {
        console.error('[SupabaseStorage] erreur Supabase :', res.error);
      }
    })
    .catch((err) =>
      console.error('[SupabaseStorage] requête échouée :', err),
    );
}

export class SupabaseStorageAdapter implements IStorageService {
  private _local: LocalStorageAdapter;

  constructor() {
    this._local = new LocalStorageAdapter();
    authService.onChange((user) => { if (user) this._syncFromSupabase(); });
    if (authService.isAuthenticated()) this._syncFromSupabase();
  }

  getSession(): UserSession | null {
    const user = authService.getUser();
    if (!user) return this._local.getSession();
    return { userId: user.id, createdAt: new Date().toISOString() };
  }

  isUnlocked(): boolean {
    return superAdmin.active || authService.isAuthenticated();
  }

  getProgress(challengeId: number): ChallengeProgress | null {
    return this._local.getProgress(challengeId);
  }

  getAllProgress(): Record<number, ChallengeProgress> {
    return this._local.getAllProgress();
  }

  saveCompletion(challengeId: number, medal: Medal, hintsUsed: number): ChallengeProgress {
    const updated = this._local.saveCompletion(challengeId, medal, hintsUsed);
    const user = authService.getUser();
    if (user) {
      fire(supabase.from('challenge_progress').upsert({
        user_id:      user.id,
        challenge_id: challengeId,
        medal,
        hints_used:   hintsUsed ?? 0,
        completed_at: updated.completedAt,
      }, { onConflict: 'user_id,challenge_id' }));
    }
    return updated;
  }

  isCompleted(challengeId: number): boolean { return this._local.isCompleted(challengeId); }
  getMedal(challengeId: number): Medal | null { return this._local.getMedal(challengeId); }
  getFullSnapshot(): UserProgress { return this._local.getFullSnapshot(); }
  clear(): void { this._local.clear(); }

  private async _syncFromSupabase(): Promise<void> {
    const user = authService.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('challenge_progress')
      .select('*')
      .eq('user_id', user.id);
    if (error || !data) return;

    const serverIds = new Set<number>();

    // Serveur → local : recopie toute complétion serveur absente en local.
    for (const row of data) {
      serverIds.add(row.challenge_id);
      if (row.completed_at && row.medal && !this._local.isCompleted(row.challenge_id)) {
        this._local.saveCompletion(row.challenge_id, row.medal, row.hints_used ?? 0);
      }
    }

    // Local → serveur : pousse les complétions locales que le serveur ignore
    // (défis validés avant connexion, p. ex. les premiers steps gratuits).
    const rows: any[] = [];
    for (const local of Object.values(this._local.getAllProgress())) {
      if (serverIds.has(local.challengeId)) continue;
      rows.push({
        user_id:      user.id,
        challenge_id: local.challengeId,
        medal:        local.medal,
        hints_used:   local.hintsUsed ?? 0,
        completed_at: local.completedAt,
      });
    }
    if (rows.length) {
      fire(supabase.from('challenge_progress').upsert(rows, { onConflict: 'user_id,challenge_id' }));
    }
  }
}