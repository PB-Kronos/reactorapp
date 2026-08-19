import { supabase } from "@/lib/supabase";

export type LeaderboardEntry = { id: string; display_name: string; points: number; last_seen: string };

async function currentUserId() {
  if (!supabase) return null;
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
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
  const { data, error } = await supabase.rpc("claim_player", { player_name: displayName });
  if (error) throw error;
  return data as LeaderboardEntry;
}

export async function getLeaderboard() {
  if (!supabase) return [] as LeaderboardEntry[];
  const { data, error } = await supabase.from("players")
    .select("id, display_name, points, last_seen").order("points", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []) as LeaderboardEntry[];
}

export async function addLeaderboardPoints(displayName: string, points: number) {
  const id = await currentUserId();
  if (!supabase || !id || points <= 0) return null;
  const { data: current, error: readError } = await supabase.from("players")
    .select("id, points").eq("owner_id", id).eq("display_name", displayName).single();
  if (readError) throw readError;
  const { data, error } = await supabase.from("players")
    .update({ points: Number(current.points || 0) + points, last_seen: new Date().toISOString() })
    .eq("id", current.id).select().single();
  if (error) throw error;
  return data as LeaderboardEntry;
}
