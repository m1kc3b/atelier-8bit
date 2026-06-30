import { supabase, authService } from '../auth/auth-service.js';
import type { PublicProfile } from '../../types/defi.js';

/**
 * Accès au profil public d'un joueur — table `profiles`.
 *
 * Schéma canonique (aligné sur la vue `defi_rankings`) :
 *   id            uuid  PK = auth.users.id
 *   github_login  text  unique (URL /u/{login})
 *   display_name  text  pseudo public, éditable
 *   avatar_url    text  avatar GitHub (rempli au signup)
 *   country       text  ISO 3166-1 alpha-2, éditable (drapeau classement)
 *   atp_points    int   cumulé, écrit CÔTÉ SERVEUR
 *   challenges_done int validés, écrit CÔTÉ SERVEUR
 *
 * Le profil est exposé en lecture à tous (page /u/{login}) mais éditable
 * uniquement par son propriétaire (RLS). Le front n'écrit jamais les
 * compteurs (atp_points, challenges_done) : ils sont calculés par le
 * backend après scoring. Seuls display_name et country sont modifiables.
 *
 * Conventions du projet : supabase-js résout en { data, error } (jamais de
 * throw), on inspecte `res.error`. Lazy : aucun appel au boot, tout part à
 * l'ouverture de la modale compte ou d'une page profil.
 */

/** Colonnes publiques sélectionnées partout (lecture). */
const PROFILE_COLS =
  'id, github_login, display_name, avatar_url, country, atp_points, challenges_done';

interface ProfileRow {
  id: string;
  github_login: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  atp_points: number | null;
  challenges_done: number | null;
}

class ProfileService {
  /** Cache du profil courant (le mien), invalidé à la déconnexion. */
  private _mine: PublicProfile | null = null;
  private _mineLoaded = false;

  constructor() {
    authService.onChange(() => {
      this._mine = null;
      this._mineLoaded = false;
    });
  }

  /** Profil public de l'utilisateur connecté (null si non connecté). */
  async getMyProfile(): Promise<PublicProfile | null> {
    if (this._mineLoaded) return this._mine;
    const user = authService.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[ProfileService] Échec du chargement du profil :', error);
      return null;
    }
    this._mineLoaded = true;
    this._mine = data
      ? this._map(data as ProfileRow)
      : {
          id: user.id,
          githubLogin: '',
          displayName: '',
          atpPoints: 0,
          challengesDone: 0,
        };
    return this._mine;
  }

  /** Profil public par login GitHub, pour /u/{login}.
   *  Renvoie null si introuvable. */
  async getByLogin(login: string): Promise<PublicProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('github_login', login)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('[ProfileService] Profil introuvable :', error);
      return null;
    }
    return this._map(data as ProfileRow);
  }

  /**
   * Met à jour les champs éditables (pseudo / pays) de l'utilisateur courant.
   * Upsert sur la clé `id` ; la RLS refuse toute écriture sur une autre ligne.
   * Les compteurs (atp_points, challenges_done) ne sont JAMAIS écrits ici.
   * Renvoie l'erreur lisible ou null.
   */
  async updateMyProfile(patch: {
    displayName?: string;
    country?: string;
  }): Promise<{ error: string | null }> {
    const user = authService.getUser();
    if (!user) return { error: 'Non connecté.' };

    const row: Record<string, unknown> = { id: user.id };
    if (patch.displayName !== undefined) row['display_name'] = patch.displayName;
    if (patch.country !== undefined) row['country'] = patch.country;

    const { error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'id' });

    if (error) return { error: error.message };
    // Met à jour le cache local sans relire.
    if (this._mine) {
      if (patch.displayName !== undefined) this._mine.displayName = patch.displayName;
      if (patch.country !== undefined) this._mine.country = patch.country;
    }
    return { error: null };
  }

  private _map(row: ProfileRow): PublicProfile {
    return {
      id: row.id,
      githubLogin: row.github_login ?? '',
      displayName: row.display_name ?? '',
      avatarUrl: row.avatar_url ?? undefined,
      country: row.country ?? undefined,
      atpPoints: row.atp_points ?? 0,
      challengesDone: row.challenges_done ?? 0,
    };
  }
}

export const profileService = new ProfileService();