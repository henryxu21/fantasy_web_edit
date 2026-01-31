import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey.trim());

export async function POST(request: Request) {
  try {
    const { leagueId, teamName, userId } = await request.json();

    if (!leagueId || !teamName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Check league exists and is not full
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("*, teams:teams(count)")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    const currentTeams = league.teams[0]?.count || 0;
    if (currentTeams >= league.max_teams) {
      return NextResponse.json(
        { error: "League is full" },
        { status: 400 }
      );
    }

    // 2. Check if already joined
    const { data: existingTeam } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .single();

    if (existingTeam) {
      return NextResponse.json(
        { error: "Already joined this league" },
        { status: 400 }
      );
    }

    // 3. Create team
    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .insert({
        league_id: leagueId,
        user_id: userId,
        team_name: teamName,
        draft_position: currentTeams + 1,
      })
      .select()
      .single();

    if (teamError) {
      return NextResponse.json(
        { error: teamError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ team });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
