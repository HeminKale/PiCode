import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | undefined {
  if (!supabaseUrl || !supabasePublishableKey || typeof window === "undefined") return undefined;
  browserClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}

export function supabaseBrowserConfigurationError(): string | undefined {
  if (!supabaseUrl) return "NEXT_PUBLIC_SUPABASE_URL is not configured.";
  if (!supabasePublishableKey) return "Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  return undefined;
}
