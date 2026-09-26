import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const normalizeSupabaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/, "").replace(/\/(?:rest\/v1|auth\/v1)$/i, "");

const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : rawUrl;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check .env.local",
  );
}

// Export the exact validated values used by the Supabase client so raw
// Edge Function requests cannot accidentally read a different env value.
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Force implicit (hash-based) flow so email confirmation +
    // magic-link redirects work even when the user opens the
    // link in a different browser / device / PWA window from
    // where they signed up. PKCE (the default in supabase-js
    // v2.40+) stores a code_verifier in localStorage at signup
    // and only exchanges successfully on that same origin —
    // breaks the common signup-on-desktop / click-link-on-
    // phone flow.
    flowType: "implicit",
  },
});
