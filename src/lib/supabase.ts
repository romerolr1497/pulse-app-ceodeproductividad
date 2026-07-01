import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente único reutilizable. Si faltan las variables de entorno,
// la app sigue funcionando 100% offline (localStorage) sin sync.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: "pulse-auth",
        },
      })
    : null;

export const supabaseEnabled = Boolean(supabase);
