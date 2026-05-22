import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://lzfqofifjdzcqnglugrc.supabase.co";
const fallbackKey = "sb_publishable_5r9HRrvDMa7YUkpog7GDPQ_evbzqPSR";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackUrl;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || fallbackKey;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  // Surface a helpful warning early in dev without breaking SSR.
  // eslint-disable-next-line no-console
  console.warn("Using fallback Supabase public config because VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing.");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});