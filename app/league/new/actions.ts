"use server";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create regular client to get auth session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function createLeagueAction(name: string) {
  // Get the current user from cookies/session
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  let userId: string | null = null;

  if (accessToken && refreshToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    userId = user?.id || null;
  }

  // If no authenticated user, try to get from session
  if (!userId) {
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id || null;
  }

  // If still no user, generate a guest user ID for testing
  if (!userId) {
    // For now, create a UUID-like ID for testing
    userId = crypto.randomUUID();
  }

  // Use admin client to insert (bypasses RLS)
  const { data: league, error } = await supabaseAdmin
    .from("leagues")
    .insert({
      name: name.trim(),
      commissioner_id: userId,
      max_teams: 10,
      draft_type: "snake",
    })
    .select()
    .single();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  // Create draft settings
  await supabaseAdmin.from("draft_settings").insert({
    league_id: league.id,
    draft_type: "snake",
  });

  return { ok: true as const, league };
}
