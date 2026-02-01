"use server";

import { createClient } from "@supabase/supabase-js";

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getLeagueById(leagueId: string) {
  const { data, error } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, league: data };
}

export async function getTeamsByLeagueId(leagueId: string) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("league_id", leagueId)
    .order("draft_position", { ascending: true });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, teams: data || [] };
}

export async function joinLeagueAction(leagueId: string, teamName: string, userId: string) {
  // Check if league exists and has space
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return { ok: false as const, error: "League not found" };
  }

  // Get current team count
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("league_id", leagueId);

  const currentCount = teams?.length || 0;

  if (currentCount >= league.max_teams) {
    return { ok: false as const, error: "League is full" };
  }

  // Check if user already has a team in this league
  const existingTeam = teams?.find((t) => t.user_id === userId);
  if (existingTeam) {
    return { ok: false as const, error: "Already in this league" };
  }

  // Create the team
  const { data: newTeam, error: teamError } = await supabaseAdmin
    .from("teams")
    .insert({
      league_id: leagueId,
      user_id: userId,
      team_name: teamName,
      draft_position: currentCount + 1,
    })
    .select()
    .single();

  if (teamError) {
    return { ok: false as const, error: teamError.message };
  }

  return { ok: true as const, team: newTeam };
}

export async function startDraftAction(leagueId: string, userId: string) {
  // Check if user is commissioner
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (leagueError || !league) {
    return { ok: false as const, error: "League not found" };
  }

  if (league.commissioner_id !== userId) {
    return { ok: false as const, error: "Only commissioner can start draft" };
  }

  // Update league status
  const { error: updateError } = await supabaseAdmin
    .from("leagues")
    .update({ status: "drafting" })
    .eq("id", leagueId);

  if (updateError) {
    return { ok: false as const, error: updateError.message };
  }

  // Update draft settings
  await supabaseAdmin
    .from("draft_settings")
    .update({ started_at: new Date().toISOString() })
    .eq("league_id", leagueId);

  return { ok: true as const };
}
