import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project configuration provided for Orange Vikings Load Engine
const DEFAULT_SUPABASE_URL = 'https://ukyvteijkvxmouoksdca.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GwVVn2UvUCo_R38qrHGukg__Qgs-FOL';

// Read from Vite environment variables first, falling back to project defaults
export const SUPABASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('your_key_here')
);

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'ov_supabase_auth_token',
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'orange-vikings-load-engine',
      },
    },
  }
);
