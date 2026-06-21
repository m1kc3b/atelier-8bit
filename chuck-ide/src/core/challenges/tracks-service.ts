import { supabase } from '../auth/auth-service.js';
import type { Challenge } from '../../types/challenge.js';

/**
 * Accès aux parcours guidés — tables `tracks` + `track_steps`.
 *
 * Chaque étape de parcours est convertie en `Challenge` pour que TOUT
 * l'aval (challenge-manager, side-panel, validation) continue de
 * fonctionner sans modification. La distinction « étape de parcours »
 * reste portée par `arena_name`, désormais alimenté par le nom de la
 * track plutôt que par une colonne sur `challenges`.
 *
 * Conséquence : `isPongArena(c)` (c.arena_name === 'Projet Pong') reste
 * valide pour les étapes de la track 'pong', sans toucher ses 6 sites
 * d'appel. Le hack historique `id ≥ 1000` n'est plus nécessaire.
 */

export interface TrackMeta {
  id: string;       // slug : 'pong', 'snake'…
  name: string;     // 'Projet Pong'
  position: number;
}

interface TrackRow {
  id: string;
  name: string;
  position: number | null;
}

interface TrackStepRow {
  id: number;
  track_id: string;
  step_index: number;
  title: string;
  description: string | null;
  template: string | null;
  assertions: unknown;
  max_cycles: number | null;
  hints: unknown;
  meta: unknown;
}

class TracksService {
  private _tracksCache: TrackMeta[] | null = null;
  private _stepsCache: Challenge[] | null = null;

  /** Liste des parcours (métadonnées), triés par position. */
  async getTracks(): Promise<TrackMeta[]> {
    if (this._tracksCache) return this._tracksCache;

    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('position', { ascending: true });

    if (error || !data) {
      console.warn('[TracksService] Échec du chargement des parcours :', error);
      return [];
    }

    this._tracksCache = (data as TrackRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position ?? 0,
    }));
    return this._tracksCache;
  }

  /**
   * Toutes les étapes de parcours, converties en `Challenge`.
   * `arena_name` = nom de la track (ex. 'Projet Pong').
   * Triées par (track position, step_index) puis renvoyées à plat.
   */
  async getAllSteps(): Promise<Challenge[]> {
    if (this._stepsCache) return this._stepsCache;

    const tracks = await this.getTracks();
    const nameById = new Map(tracks.map((t) => [t.id, t.name]));

    const { data, error } = await supabase
      .from('track_steps')
      .select('*')
      .order('step_index', { ascending: true });

    if (error || !data) {
      console.warn('[TracksService] Échec du chargement des étapes :', error);
      return [];
    }

    this._stepsCache = (data as TrackStepRow[]).map((row) => ({
      id: row.id,
      arena: undefined,
      arena_name: nameById.get(row.track_id) ?? row.track_id,
      locked: true, // une étape de parcours n'est jamais un défi libre
      title: row.title,
      description: row.description ?? '',
      template: row.template ?? '',
      assertions: (row.assertions as Challenge['assertions']) ?? [],
      maxCycles: row.max_cycles ?? undefined,
      hints: (row.hints as Challenge['hints']) ?? [],
      meta: (row.meta as Challenge['meta']) ?? undefined,
    })) as Challenge[];

    return this._stepsCache;
  }

  /** Étapes d'un parcours donné (par slug), triées par step_index. */
  async getStepsByTrack(trackId: string): Promise<Challenge[]> {
    const all = await this.getAllSteps();
    // arena_name a été résolu en nom ; on refiltre via le cache des tracks
    const tracks = await this.getTracks();
    const name = tracks.find((t) => t.id === trackId)?.name;
    if (!name) return [];
    return all.filter((c) => c.arena_name === name);
  }

  clearCache(): void {
    this._tracksCache = null;
    this._stepsCache = null;
  }
}

export const tracksService = new TracksService();