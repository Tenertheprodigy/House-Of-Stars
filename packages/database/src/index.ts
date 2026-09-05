import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-only factory. Never import this from a Client Component. */
export function createServiceRoleClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Browser-safe factory; use only the public anon key. */
export function createBrowserClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createClient(url, anonKey);
}
