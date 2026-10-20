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

// Safe storage adapter: prevents unhandled exceptions when running inside
// sandboxed or cross-origin iframes where window.localStorage might throw SecurityError
function createSafeStorageAdapter() {
  const memoryStore = new Map<string, string>();
  return {
    getItem: (key: string): string | null => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch {
        // Storage access blocked by iframe policy
      }
      return memoryStore.get(key) || null;
    },
    setItem: (key: string, value: string): void => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Storage access blocked by iframe policy
      }
      memoryStore.set(key, value);
    },
    removeItem: (key: string): void => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      } catch {
        // Storage access blocked by iframe policy
      }
      memoryStore.delete(key);
    },
  };
}

// Instantiate client with resilient settings
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Prevents iframe hash routing crashes
      storage: createSafeStorageAdapter(),
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
