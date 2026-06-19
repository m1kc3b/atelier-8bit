import type {
  IStorageService,
  UserProgress,
  UserSession,
  ChallengeProgress,
  Medal,
} from './types.js';
import { LocalStorageAdapter } from './local-storage-adapter.js';
import { supabase, authService } from '../auth/auth-service.js';

function fire(promise: PromiseLike<unknown>): void {
  Promise.resolve(promise).catch((err) =>
    console.warn('[SupabaseStorage] requête échouée (ignorée) :', err),
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
    return { email: user.email, createdAt: new Date().toISOString(), userId: user.id };
  }

  saveSession(email: string): UserSession {
    // Conservé pour compat avec l'interface — l'auth réelle passe par
    // authService.signIn / signUp, appelés depuis chuck-auth-gate.ts.
    return this._local.saveSession(email);
  }

  isUnlocked(): boolean {
    return authService.isAuthenticated();
  }

  loadCode(challengeId: number): string | null {
    return this._local.loadCode(challengeId);
  }

  saveCode(challengeId: number, code: string): void {
    this._local.saveCode(challengeId, code);
    const user = authService.getUser();
    if (!user) return;
    fire(supabase.from('challenge_progress').upsert({
      user_id: user.id,
      challenge_id: challengeId,
      code,
      saved_at: new Date().toISOString(),
    }));
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
        user_id: user.id,
        challenge_id: challengeId,
        code: updated.code,
        medal,
        hints_used: hintsUsed,
        completed_at: updated.completedAt,
        saved_at: new Date().toISOString(),
      }));
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
    for (const row of data) {
      const local    = this._local.getProgress(row.challenge_id);
      const serverTs = new Date(row.saved_at).getTime();
      const localTs  = local ? new Date(local.savedAt).getTime() : 0;
      if (serverTs > localTs) {
        this._local.saveCode(row.challenge_id, row.code);
        if (row.medal) this._local.saveCompletion(row.challenge_id, row.medal, row.hints_used ?? 0);
      }
    }
  }
}