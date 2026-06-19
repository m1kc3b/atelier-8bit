import { supabase } from '../auth/auth-service.js';
import type { Challenge } from '../../types/challenge.js';

class ChallengesService {
  private _cache: Challenge[] | null = null;

  async getAll(): Promise<Challenge[]> {
    if (this._cache) return this._cache;

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data) {
      console.warn('[ChallengesService] Échec du chargement :', error);
      return [];
    }

    this._cache = data.map((row) => ({
      id: row.id,
      arena: row.arena ?? undefined,
      arena_name: row.arena_name ?? undefined,
      locked: row.locked ?? false,
      title: row.title,
      description: row.description ?? '',
      template: row.template ?? '',
      assertions: row.assertions ?? [],
      maxCycles: row.max_cycles ?? undefined,
      hints: row.hints ?? [],
      meta: row.meta ?? undefined,
    })) as Challenge[];

    return this._cache;
  }

  async getById(id: number): Promise<Challenge | null> {
    const all = await this.getAll();
    return all.find((c) => c.id === id) ?? null;
  }

  /** Invalide le cache — utile après une mise à jour des défis côté admin. */
  clearCache(): void {
    this._cache = null;
  }
}

export const challengesService = new ChallengesService();