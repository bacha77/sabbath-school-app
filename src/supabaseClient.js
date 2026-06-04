import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "your-actual-anon-public-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const isPlaceholder = SUPABASE_URL.includes("your-project-id");
