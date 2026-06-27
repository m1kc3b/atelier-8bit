import { createClient, type Session } from "@supabase/supabase-js";
import { bus } from "../../core/bus";

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
      void import("../../core/super-admin")
        .then(({ superAdmin }) => superAdmin.refresh())
        .catch(() => {});
      this._notify();
    });

    supabase.auth.onAuthStateChange((event, session) => {
      this._session = session;
      void import("../../core/super-admin")
        .then(({ superAdmin }) =>
          session ? superAdmin.refresh() : superAdmin.reset(),
        )
        .catch(() => {});
      this._notify();
      if (event === "SIGNED_IN" && session?.user) {
        // Seule étape « entrée de funnel » conservée : la connexion.
        // Fire-and-forget — n'interrompt jamais le flux d'auth.
        bus.emit("chuck:funnel-step", {
          step: "signed-in",
          meta: { userId: session.user.id },
        });
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

  async signInWithGithub(
    opts: { redirectTo?: string } = {},
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: opts.redirectTo ?? window.location.origin,
      },
    });
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
}

export const authService = new AuthService();