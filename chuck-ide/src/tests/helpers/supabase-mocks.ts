/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/helpers/supabase-mock.ts
   Fabrique de mocks pour le client supabase-js.

   supabase-js ne throw JAMAIS : chaque appel terminal résout en
   { data, error }. Ce helper reproduit fidèlement le query-builder
   chaînable (from().select().eq()...maybeSingle()) ainsi que
   functions.invoke() et auth.*, en laissant les tests injecter le
   { data, error } final.
   ───────────────────────────────────────────────────────────── */

import { vi, type Mock } from 'vitest';

export interface TableResult {
  data?: unknown;
  error?: unknown;
}

/**
 * Construit un query-builder chaînable dont CHAQUE méthode intermédiaire
 * (select, eq, lte, order, limit, …) renvoie le builder lui-même, et dont
 * les méthodes terminales (maybeSingle, single) + le builder lui-même
 * (thenable) résolvent vers `result`.
 *
 * Cela couvre les deux styles utilisés dans le code :
 *   await supabase.from(t).select().eq(...)              (builder = thenable)
 *   await supabase.from(t).select().eq(...).maybeSingle()
 */
export function makeQueryBuilder(result: TableResult): any {
  const resolved = { data: result.data ?? null, error: result.error ?? null };

  const builder: any = {};
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'order', 'limit', 'range', 'in', 'is', 'match', 'filter',
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  // Terminaux explicites
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolved));
  builder.single = vi.fn(() => Promise.resolve(resolved));
  // Le builder est lui-même « thenable » : `await builder` résout `resolved`.
  builder.then = (onFulfilled: (v: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled);

  return builder;
}

export interface SupabaseMockOptions {
  /** Map nom de table → résultat terminal. */
  tables?: Record<string, TableResult>;
  /** Résultat de functions.invoke(). */
  invoke?: TableResult;
  /** Utilisateur renvoyé par auth.getUser()/getSession(). */
  user?: { id: string; email?: string } | null;
}

export interface SupabaseMock {
  supabase: {
    from: Mock;
    functions: { invoke: Mock };
    auth: {
      getUser: Mock;
      getSession: Mock;
      onAuthStateChange: Mock;
      signInWithOAuth: Mock;
      signOut: Mock;
      updateUser: Mock;
    };
  };
  /** Accès aux builders créés, indexés par table, pour les assertions. */
  builders: Record<string, any>;
}

/** Fabrique un objet `supabase` mocké complet. */
export function makeSupabaseMock(opts: SupabaseMockOptions = {}): SupabaseMock {
  const tables = opts.tables ?? {};
  const builders: Record<string, any> = {};

  const from = vi.fn((table: string) => {
    const b = makeQueryBuilder(tables[table] ?? { data: null, error: null });
    builders[table] = b;
    return b;
  });

  const invokeResult = {
    data: opts.invoke?.data ?? null,
    error: opts.invoke?.error ?? null,
  };

  const user = opts.user ?? null;

  return {
    supabase: {
      from,
      functions: { invoke: vi.fn(() => Promise.resolve(invokeResult)) },
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: user ? { user } : null }, error: null }),
        ),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
        updateUser: vi.fn(() => Promise.resolve({ error: null })),
      },
    },
    builders,
  };
}

/** authService mocké minimal, configurable. */
export function makeAuthServiceMock(user: { id: string; email?: string } | null = null) {
  let _user = user;
  const listeners = new Set<(u: typeof _user) => void>();
  return {
    getUser: vi.fn(() => _user),
    isAuthenticated: vi.fn(() => _user != null),
    onChange: vi.fn((cb: (u: typeof _user) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }),
    signInWithGithub: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve()),
    updateEmail: vi.fn(() => Promise.resolve({ error: null })),
    updatePassword: vi.fn(() => Promise.resolve({ error: null })),
    /** Helper de test : bascule l'utilisateur et notifie les abonnés. */
    __setUser(u: typeof _user) {
      _user = u;
      listeners.forEach((cb) => cb(_user));
    },
  };
}