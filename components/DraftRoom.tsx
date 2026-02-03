"use client";

import { useEffect, useMemo, useState } from "react";
import {
  supabase,
  pickPlayer,
  getCurrentDraftingTeam,
  subscribeToDraftRoom,
  type DraftPick,
  type DraftSettings,
  type Team,
} from "@/lib/supabase";
import { getPlayers, type Player } from "@/lib/store";

export default function DraftRoom({ leagueId, myTeam }: { leagueId: string; myTeam: Team }) {
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [draftedIds, setDraftedIds] = useState<(number | string)[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pickingId, setPickingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    const channel = subscribeToDraftRoom(leagueId, () => {
      load();
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: settings }, { data: teamsData }, { data: picksData }] = await Promise.all([
        supabase.from("draft_settings").select("*").eq("league_id", leagueId).single(),
        supabase.from("teams").select("*").eq("league_id", leagueId).order("draft_position", { ascending: true }),
        supabase
          .from("draft_picks")
          .select("*")
          .eq("league_id", leagueId)
          .order("overall_pick", { ascending: true }),
      ]);

      setDraftSettings(settings || null);
      setTeams(teamsData || []);
      setPicks(picksData || []);
      setDraftedIds((picksData || []).map((p: any) => p.player_id));

      const current = await getCurrentDraftingTeam(leagueId);
      setCurrentTeam(current || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }

  const allPlayers = useMemo<Player[]>(() => getPlayers(), []);
  const availablePlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allPlayers
      .filter((p) => !draftedIds.includes(p.id))
      .filter((p) => (term ? p.name.toLowerCase().includes(term) : true))
      .slice(0, 50);
  }, [allPlayers, draftedIds, search]);

  const isMyTurn = currentTeam?.id === myTeam.id;

  async function handlePick(player: Player) {
    if (!isMyTurn) return;
    setPickingId(player.id);
    setError(null);
    try {
      await pickPlayer(leagueId, myTeam.id, {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Pick failed");
    } finally {
      setPickingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>🏀 选秀房间</h2>
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>🏀 选秀房间</h2>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
            {draftSettings ? (
              <>
                第 {draftSettings.current_round} 轮 · 进行到第 {draftSettings.current_pick} 位
              </>
            ) : (
              "等待设置"
            )}
          </div>
        </div>
        <div style={{
          padding: "8px 12px",
          borderRadius: 8,
          background: isMyTurn ? "#dcfce7" : "#f1f5f9",
          color: isMyTurn ? "#166534" : "#475569",
          fontWeight: 600,
          fontSize: 13,
        }}>
          {isMyTurn ? "轮到你选了" : `当前: ${currentTeam?.team_name || "等待"}`}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ background: "white", padding: 16, borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>可选球员</h3>
            <input
              placeholder="搜索球员..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {availablePlayers.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {p.team} · {p.position}
                  </div>
                </div>
                <button
                  onClick={() => handlePick(p)}
                  disabled={!isMyTurn || (pickingId !== null && String(pickingId) === String(p.id))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: !isMyTurn ? "#e2e8f0" : "#f59e0b",
                    color: !isMyTurn ? "#94a3b8" : "#111",
                    cursor: !isMyTurn ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {pickingId === p.id ? "选择中..." : "选中"}
                </button>
              </div>
            ))}
            {availablePlayers.length === 0 && (
              <div style={{ color: "#94a3b8", padding: "8px 0" }}>没有匹配球员</div>
            )}
          </div>
        </div>

        <div style={{ background: "white", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>选秀记录</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
            {picks.length === 0 && <div style={{ color: "#94a3b8" }}>暂无选秀记录</div>}
            {picks.map((pick) => (
              <div key={pick.id} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{pick.player_name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  R{pick.round} · P{pick.pick_number} · {pick.player_team} {pick.player_position}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: "8px 0" }}>已加入队伍</h4>
            <div style={{ display: "grid", gap: 6 }}>
              {teams.map((team) => (
                <div key={team.id} style={{ fontSize: 13, color: "#475569" }}>
                  #{team.draft_position} {team.team_name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
