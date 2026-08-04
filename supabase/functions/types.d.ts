/**
 * Minimal Deno / URL-import shims for editors that still typecheck these
 * files with the Node/TS language service. Prefer the Deno extension + enablePaths.
 */
declare namespace Deno {
  function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;

  const env: {
    get(key: string): string | undefined;
  };
}

/** Loose client shape used by our Edge Functions. */
interface EdgeSupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: (name: string) => any;
  removeChannel: (channel: unknown) => Promise<unknown> | unknown;
}

/** Matches the Deno URL import used in `_shared/supabase.ts`. */
declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export function createClient(
    url: string,
    key: string,
    options?: {
      auth?: { persistSession?: boolean; autoRefreshToken?: boolean };
    },
  ): EdgeSupabaseClient;
}
