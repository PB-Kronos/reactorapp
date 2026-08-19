import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The client is optional during local development so the simulator still runs
// before a Supabase project has been configured.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
