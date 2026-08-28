import { supabase } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabaseTimeout";

export type LeaderboardEntry = {
  id: string;
  display_name: string;
  points: number;
  points_unit1: number;
  points_unit2: number;
  last_seen: string;
};

async function currentUserId() {
  if (!supabase) return null;
  let { data: { user } } = await withSupabaseTimeout(supabase.auth.getUser(), "Supabase session check");
  if (!user) {
    const { data, error } = await withSupabaseTimeout(supabase.auth.signInAnonymously(), "Anonymous Supabase sign-in");
    if (error) throw error;
    user = data.user;
  }
  return user?.id || null;
}

export async function ensureLeaderboardPlayer(displayName: string) {
  const id = await currentUserId();
  if (!supabase || !id) return null;
  // A public Unit 2 name is intentionally portable across browsers. The RPC
  // moves that nickname to the current anonymous identity while preserving its
  // score; it is not a password-protected account system.
  const { data, error } = await withSupabaseTimeout(supabase.rpc("claim_player", { player_name: displayName }), "Player profile setup");
  if (error) throw error;
  return data as LeaderboardEntry;
}

export async function getLeaderboard() {
  if (!supabase) return [] as LeaderboardEntry[];
  const { data, error } = await withSupabaseTimeout(supabase.from("players")
    .select("id, display_name, points, points_unit1, points_unit2, last_seen").order("points", { ascending: false }).limit(100), "Leaderboard request");
  if (error) throw error;
  return (data || []) as LeaderboardEntry[];
}

export async function addLeaderboardPoints(displayName: string, unitNumber: 1 | 2, points: number) {
  const id = await currentUserId();
  if (!supabase || !id || points <= 0) return null;
  const { data: current, error: readError } = await withSupabaseTimeout(supabase.from("players")
    .select("id, points, points_unit1, points_unit2").eq("owner_id", id).eq("display_name", displayName).single(), "Player score lookup");
  if (readError) throw readError;
  const unitColumn = unitNumber === 1 ? "points_unit1" : "points_unit2";
  const { data, error } = await withSupabaseTimeout(supabase.from("players")
    .update({
      points: Number(current.points || 0) + points,
      [unitColumn]: Number(current[unitColumn] || 0) + points,
      last_seen: new Date().toISOString(),
    })
    .eq("id", current.id).select().single(), "Player score update");
  if (error) throw error;
  return data as LeaderboardEntry;
}
