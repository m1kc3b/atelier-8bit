import { supabase, authService } from '../auth/auth-service.js';
import type { PublicProfile } from '../../types/defi.js';

/**
 * Accès au profil public d'un joueur — table `profiles`.
 *
 * Le profil public est la vitrine d'un compte : pseudo affiché dans les
 * classements de l'Arène, bio courte, palmarès défis. Il est exposé en
 * lecture à tous (page /u/{login}) mais éditable uniquement par son
 * propriétaire (RLS côté Supabase).
 *
 * Conventions du projet : supabase-js résout en { data, error } (jamais de
 * throw), on inspecte `res.error`. Lazy : aucun appel au boot, tout part à
 * l'ouverture de la modale compte ou d'une page profil.
 */
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
      .select('user_id, display_name, bio, defis_entered, best_rank')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[ProfileService] Échec du chargement du profil :', error);
      return null;
    }
    this._mineLoaded = true;
    this._mine = data ? this._map(data) : { userId: user.id, displayName: '' };
    return this._mine;
  }

  /** Profil public par identifiant de connexion GitHub (login), pour /u/{login}.
   *  Renvoie null si introuvable. */
  async getByLogin(login: string): Promise<PublicProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, bio, defis_entered, best_rank')
      .eq('github_login', login)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('[ProfileService] Profil introuvable :', error);
      return null;
    }
    return this._map(data);
  }

  /**
   * Met à jour le pseudo / la bio de l'utilisateur courant.
   * Upsert sur la clé user_id ; le backend (RLS) refuse toute écriture sur
   * une autre ligne. Renvoie l'erreur lisible ou null.
   */
  async updateMyProfile(patch: {
    displayName?: string;
    bio?: string;
  }): Promise<{ error: string | null }> {
    const user = authService.getUser();
    if (!user) return { error: 'Non connecté.' };

    const row: Record<string, unknown> = { user_id: user.id };
    if (patch.displayName !== undefined) row['display_name'] = patch.displayName;
    if (patch.bio !== undefined) row['bio'] = patch.bio;

    const { error } = await supabase
      .from('profiles')
      .upsert(row, { onConflict: 'user_id' });

    if (error) return { error: error.message };
    // Met à jour le cache local sans relire.
    if (this._mine) {
      if (patch.displayName !== undefined) this._mine.displayName = patch.displayName;
      if (patch.bio !== undefined) this._mine.bio = patch.bio;
    }
    return { error: null };
  }

  private _map(row: any): PublicProfile {
    return {
      userId: row.user_id,
      displayName: row.display_name ?? '',
      bio: row.bio ?? undefined,
      defisEntered: row.defis_entered ?? undefined,
      bestRank: row.best_rank ?? undefined,
    };
  }
}

export const profileService = new ProfileService();