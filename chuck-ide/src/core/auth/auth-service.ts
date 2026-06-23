import { createClient, type Session } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export interface AuthUser {
  id: string;
  email: string;
}

class AuthService {
  private _session: Session | null = null;
  private _listeners = new Set<(user: AuthUser | null) => void>();

  constructor() {
    supabase.auth.getSession().then(({ data }) => {
      this._session = data.session;
      void import("../super-admin.js")
        .then(({ superAdmin }) => superAdmin.refresh())
        .catch(() => {});
      this._notify();
    });

    supabase.auth.onAuthStateChange((event, session) => {
      this._session = session;
      void import("../super-admin.js")
        .then(({ superAdmin }) =>
          session ? superAdmin.refresh() : superAdmin.reset(),
        )
        .catch(() => {});
      this._notify();
      if (event === "SIGNED_IN" && session?.user) {
        // Relie le visitor_id anonyme au compte (signup ET login).
        // Import dynamique : évite la dépendance circulaire avec
        // funnel-tracker (qui importe `supabase` depuis ce module).
        // Fire-and-forget : n'interrompt jamais le flux d'auth.
        const userId = session.user.id;
        void import("../funnel-tracker.js")
          .then(({ funnelTracker }) => funnelTracker.linkIdentity(userId))
          .catch(() => {
            /* module indisponible — ignore */
          });
      }
      if (event === "PASSWORD_RECOVERY") {
        this._recoveryListeners.forEach((cb) => cb());
      }
    });
  }

  private _notify(): void {
    const user = this.getUser();
    this._listeners.forEach((cb) => cb(user));
  }

  onChange(cb: (user: AuthUser | null) => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  getUser(): AuthUser | null {
    const u = this._session?.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  }

  isAuthenticated(): boolean {
    return !!this._session;
  }

  async signUp(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }

  async signInWithGithub(): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "https://atelier-8bit.fr"
      }
    })
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async updateEmail(newEmail: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error?.message ?? null };
  }

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }

  private _recoveryListeners = new Set<() => void>();

  /** Appelé quand l'utilisateur revient sur l'app via le lien de réinitialisation. */
  onPasswordRecovery(cb: () => void): () => void {
    this._recoveryListeners.add(cb);
    return () => this._recoveryListeners.delete(cb);
  }

  async resetPasswordForEmail(
    email: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: error?.message ?? null };
  }

  
}

export const authService = new AuthService();