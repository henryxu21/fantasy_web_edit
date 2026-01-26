"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

// API 配置
const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";

// ESPN 默认 Fantasy 计分规则
const FANTASY_WEIGHTS = {
  pts: 1,
  reb: 1,
  ast: 1,
  stl: 2,
  blk: 2,
  fg3m: 1,
  tov: -1,
};

type PlayerStats = {
  id: number;
  name: string;
  team: string;
  position: string;
  gamesPlayed: number;
  totals: {
    min: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    pts: number;
  };
  averages: {
    min: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    fg_pct: number;
    fg3_pct: number;
    ft_pct: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    pts: number;
  };
  fpts: number;
  fptsAvg: number;
  rank: number;
  injury?: string;
};

type SortKey = "rank" | "name" | "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov" | "fptsAvg" | "gamesPlayed";

// 计算 Fantasy Points
function calculateFantasyPoints(stats: { pts: number; reb: number; ast: number; stl: number; blk: number; fg3m: number; tov: number }): number {
  return (
    stats.pts * FANTASY_WEIGHTS.pts +
    stats.reb * FANTASY_WEIGHTS.reb +
    stats.ast * FANTASY_WEIGHTS.ast +
    stats.stl * FANTASY_WEIGHTS.stl +
    stats.blk * FANTASY_WEIGHTS.blk +
    stats.fg3m * FANTASY_WEIGHTS.fg3m +
    stats.tov * FANTASY_WEIGHTS.tov
  );
}

// 获取最近 N 天的日期数组
function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

export default function PlayerRankingsPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [statView, setStatView] = useState<"averages" | "totals">("averages");
  const [page, setPage] = useState(1);
  const [gamesLoaded, setGamesLoaded] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadData();
  }, []);

  async function fetchAPI(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: API_KEY },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    setLoadingStatus(t("获取最近比赛...", "Fetching recent games..."));

    try {
      // 1. 获取最近7天的已完成比赛
      const recentDates = getRecentDates(7);
      const allGames: any[] = [];

      for (const date of recentDates) {
        setLoadingStatus(t(`获取 ${date} 的比赛...`, `Fetching games for ${date}...`));
        
        const gamesRes = await fetchAPI("/games", { "dates[]": date, per_page: "50" });
        const finishedGames = (gamesRes.data || []).filter((g: any) => g.status === "Final");
        allGames.push(...finishedGames);

        // Rate limit: 60 requests/min for ALL-STAR
        await new Promise((r) => setTimeout(r, 200));
      }

      if (allGames.length === 0) {
        setError(t("最近没有已完成的比赛", "No finished games in recent days"));
        setLoading(false);
        return;
      }

      setGamesLoaded(allGames.length);
      setLoadingStatus(t(`找到 ${allGames.length} 场比赛，正在获取球员统计...`, `Found ${allGames.length} games, fetching player stats...`));

      // 2. 获取每场比赛的球员统计
      const playerStatsMap = new Map<number, {
        player: any;
        games: any[];
      }>();

      let gamesProcessed = 0;
      for (const game of allGames) {
        gamesProcessed++;
        setLoadingStatus(t(
          `处理比赛 ${gamesProcessed}/${allGames.length}: ${game.home_team.abbreviation} vs ${game.visitor_team.abbreviation}`,
          `Processing game ${gamesProcessed}/${allGames.length}: ${game.home_team.abbreviation} vs ${game.visitor_team.abbreviation}`
        ));

        try {
          const statsRes = await fetchAPI("/stats", { "game_ids[]": game.id.toString(), per_page: "100" });
          const stats = statsRes.data || [];

          for (const stat of stats) {
            const playerId = stat.player.id;
            if (!playerStatsMap.has(playerId)) {
              playerStatsMap.set(playerId, {
                player: stat.player,
                games: [],
              });
            }
            playerStatsMap.get(playerId)!.games.push({
              ...stat,
              team: stat.team,
            });
          }
        } catch (e) {
          console.error(`Failed to fetch stats for game ${game.id}:`, e);
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 300));
      }

      // 3. 获取伤病信息
      setLoadingStatus(t("获取伤病信息...", "Fetching injury data..."));
      let injuries: any[] = [];
      try {
        const injuriesRes = await fetchAPI("/player_injuries", { per_page: "100" });
        injuries = injuriesRes.data || [];
      } catch (e) {
        console.log("Could not fetch injuries");
      }

      const injuryMap = new Map<number, string>();
      injuries.forEach((inj) => {
        injuryMap.set(inj.player.id, inj.status);
      });

      // 4. 计算每个球员的统计数据
      setLoadingStatus(t("计算球员统计...", "Calculating player statistics..."));
      
      const playersData: PlayerStats[] = [];

      playerStatsMap.forEach(({ player, games }) => {
        if (games.length === 0) return;

        // 计算总数
        const totals = games.reduce(
          (acc, g) => ({
            min: acc.min + parseFloat(g.min || "0"),
            fgm: acc.fgm + (g.fgm || 0),
            fga: acc.fga + (g.fga || 0),
            fg3m: acc.fg3m + (g.fg3m || 0),
            fg3a: acc.fg3a + (g.fg3a || 0),
            ftm: acc.ftm + (g.ftm || 0),
            fta: acc.fta + (g.fta || 0),
            reb: acc.reb + (g.reb || 0),
            ast: acc.ast + (g.ast || 0),
            stl: acc.stl + (g.stl || 0),
            blk: acc.blk + (g.blk || 0),
            tov: acc.tov + (g.turnover || 0),
            pts: acc.pts + (g.pts || 0),
          }),
          { min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0 }
        );

        const gp = games.length;

        // 计算平均值
        const averages = {
          min: totals.min / gp,
          fgm: totals.fgm / gp,
          fga: totals.fga / gp,
          fg3m: totals.fg3m / gp,
          fg3a: totals.fg3a / gp,
          ftm: totals.ftm / gp,
          fta: totals.fta / gp,
          fg_pct: totals.fga > 0 ? (totals.fgm / totals.fga) * 100 : 0,
          fg3_pct: totals.fg3a > 0 ? (totals.fg3m / totals.fg3a) * 100 : 0,
          ft_pct: totals.fta > 0 ? (totals.ftm / totals.fta) * 100 : 0,
          reb: totals.reb / gp,
          ast: totals.ast / gp,
          stl: totals.stl / gp,
          blk: totals.blk / gp,
          tov: totals.tov / gp,
          pts: totals.pts / gp,
        };

        // 计算 Fantasy Points
        const fptsTotal = calculateFantasyPoints({
          pts: totals.pts,
          reb: totals.reb,
          ast: totals.ast,
          stl: totals.stl,
          blk: totals.blk,
          fg3m: totals.fg3m,
          tov: totals.tov,
        });

        const fptsAvg = fptsTotal / gp;

        // 获取最近一场比赛的球队
        const latestGame = games[games.length - 1];

        playersData.push({
          id: player.id,
          name: `${player.first_name} ${player.last_name}`,
          team: latestGame.team?.abbreviation || player.team?.abbreviation || "N/A",
          position: player.position || "N/A",
          gamesPlayed: gp,
          totals,
          averages,
          fpts: Math.round(fptsTotal * 10) / 10,
          fptsAvg: Math.round(fptsAvg * 10) / 10,
          rank: 0,
          injury: injuryMap.get(player.id),
        });
      });

      // 5. 按 Fantasy Points 平均值排序
      playersData.sort((a, b) => b.fptsAvg - a.fptsAvg);
      playersData.forEach((p, i) => {
        p.rank = i + 1;
      });

      setPlayers(playersData);
      setLoadingStatus("");
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const teams = useMemo(() => {
    const teamSet = new Set(players.map((p) => p.team));
    return Array.from(teamSet).filter(t => t !== "N/A").sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    let result = players;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term)
      );
    }

    if (positionFilter !== "all") {
      result = result.filter((p) => p.position.includes(positionFilter));
    }

    if (teamFilter !== "all") {
      result = result.filter((p) => p.team === teamFilter);
    }

    // 排序
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      
      if (sortKey === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sortKey === "rank" || sortKey === "gamesPlayed" || sortKey === "fptsAvg") {
        aVal = a[sortKey];
        bVal = b[sortKey];
      } else {
        aVal = statView === "averages" ? a.averages[sortKey as keyof typeof a.averages] : a.totals[sortKey as keyof typeof a.totals];
        bVal = statView === "averages" ? b.averages[sortKey as keyof typeof b.averages] : b.totals[sortKey as keyof typeof b.totals];
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [players, searchTerm, positionFilter, teamFilter, sortKey, sortOrder, statView]);

  const paginatedPlayers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, page]);

  const totalPages = Math.ceil(filteredPlayers.length / pageSize);
  const injuredCount = players.filter((p) => p.injury).length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  function InjuryBadge({ status }: { status?: string }) {
    if (!status) return null;
    const colors: Record<string, string> = {
      Out: "#ef4444",
      Doubtful: "#f97316",
      Questionable: "#eab308",
      Probable: "#22c55e",
      "Day-To-Day": "#f97316",
    };
    const color = colors[status] || "#888";
    return (
      <span className="injury-indicator" style={{ backgroundColor: color }} title={status}>
        {status.charAt(0)}
      </span>
    );
  }

  function formatStat(value: number, decimals: number = 1): string {
    return value.toFixed(decimals);
  }

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main className="page-content">
          <div className="loading-container">
            <div className="loading-spinner">🏀</div>
            <p className="loading-status">{loadingStatus}</p>
            <p className="loading-note">
              {t(
                "正在从 Ball Don't Lie API 获取真实比赛数据，请稍候...",
                "Fetching real game data from Ball Don't Lie API, please wait..."
              )}
            </p>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <Header />
        <main className="page-content">
          <div className="error-container">
            <h2>❌ {t("加载失败", "Failed to Load")}</h2>
            <p>{error}</p>
            <button onClick={loadData} className="retry-btn">
              {t("重试", "Retry")}
            </button>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="page-content">
        <div className="container">
          {/* 页面头部 */}
          <div className="page-header">
            <div className="header-left">
              <h1>🏀 {t("球员排名", "Player Rankings")}</h1>
              <div className="header-tabs">
                <button className="tab active">Stats</button>
                <button className="tab">Trending</button>
                <button className="tab">Schedule</button>
                <button className="tab">News</button>
              </div>
            </div>
            <div className="header-right">
              <div className="view-toggle">
                <button
                  className={statView === "totals" ? "active" : ""}
                  onClick={() => setStatView("totals")}
                >
                  Totals
                </button>
                <button
                  className={statView === "averages" ? "active" : ""}
                  onClick={() => setStatView("averages")}
                >
                  Averages
                </button>
              </div>
              <button onClick={loadData} className="refresh-btn">
                🔄 {t("刷新", "Refresh")}
              </button>
            </div>
          </div>

          {/* 数据来源信息 */}
          <div className="data-source-bar">
            <span className="live-indicator">⚡ LIVE DATA</span>
            <span>{t(`基于最近 ${gamesLoaded} 场已完成比赛`, `Based on ${gamesLoaded} recent finished games`)}</span>
            <span>{t(`${players.length} 名球员`, `${players.length} players`)}</span>
          </div>

          {/* 过滤器 */}
          <div className="filters">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={t("搜索球员...", "Search players...")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">{t("全部位置", "All Positions")}</option>
              <option value="G">Guard (G)</option>
              <option value="F">Forward (F)</option>
              <option value="C">Center (C)</option>
            </select>
            <select
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">{t("全部球队", "All Teams")}</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <div className="stats-info">
              <span>👥 {filteredPlayers.length} {t("球员", "players")}</span>
              <span>🏥 {injuredCount} {t("伤病", "injured")}</span>
            </div>
          </div>

          {/* 球员表格 */}
          <div className="table-container">
            <table className="players-table">
              <thead>
                <tr>
                  <th className="col-player" colSpan={2}>
                    <div className="th-content" onClick={() => handleSort("name")}>
                      PLAYER <SortIcon column="name" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("gamesPlayed")}>
                    <div className="th-content">
                      GP <SortIcon column="gamesPlayed" />
                    </div>
                  </th>
                  <th className="col-stat">MIN</th>
                  <th className="col-stat">FGM</th>
                  <th className="col-stat">FGA</th>
                  <th className="col-stat">FTM</th>
                  <th className="col-stat">FTA</th>
                  <th className="col-stat" onClick={() => handleSort("fg3m")}>
                    <div className="th-content">
                      3PM <SortIcon column="fg3m" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("reb")}>
                    <div className="th-content">
                      REB <SortIcon column="reb" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("ast")}>
                    <div className="th-content">
                      AST <SortIcon column="ast" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("stl")}>
                    <div className="th-content">
                      STL <SortIcon column="stl" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("blk")}>
                    <div className="th-content">
                      BLK <SortIcon column="blk" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("tov")}>
                    <div className="th-content">
                      TO <SortIcon column="tov" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("pts")}>
                    <div className="th-content">
                      PTS <SortIcon column="pts" />
                    </div>
                  </th>
                  <th className="col-fpts" onClick={() => handleSort("fptsAvg")}>
                    <div className="th-content">
                      FPTS <SortIcon column="fptsAvg" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.map((player) => {
                  const stats = statView === "averages" ? player.averages : player.totals;
                  return (
                    <tr key={player.id} className={player.injury ? "injured" : ""}>
                      <td className="col-rank">
                        <span className="rank">{player.rank}</span>
                      </td>
                      <td className="col-player-info">
                        <div className="player-avatar">
                          {player.name.charAt(0)}
                        </div>
                        <div className="player-details">
                          <div className="player-name">
                            {player.name}
                            <InjuryBadge status={player.injury} />
                          </div>
                          <div className="player-meta">
                            {player.team} • {player.position}
                          </div>
                        </div>
                      </td>
                      <td className="col-stat">{player.gamesPlayed}</td>
                      <td className="col-stat">{formatStat(stats.min)}</td>
                      <td className="col-stat">{formatStat(stats.fgm)}</td>
                      <td className="col-stat">{formatStat(stats.fga)}</td>
                      <td className="col-stat">{formatStat(stats.ftm)}</td>
                      <td className="col-stat">{formatStat(stats.fta)}</td>
                      <td className="col-stat">{formatStat(stats.fg3m)}</td>
                      <td className="col-stat">{formatStat(stats.reb)}</td>
                      <td className="col-stat">{formatStat(stats.ast)}</td>
                      <td className="col-stat">{formatStat(stats.stl)}</td>
                      <td className="col-stat">{formatStat(stats.blk)}</td>
                      <td className="col-stat negative">{formatStat(stats.tov)}</td>
                      <td className="col-stat highlight">{formatStat(stats.pts)}</td>
                      <td className="col-fpts">
                        <div className="fpts-cell">
                          <span className="fpts-total">{player.fpts}</span>
                          <span className="fpts-avg">{player.fptsAvg}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ← {t("上一页", "Prev")}
              </button>
              <div className="page-numbers">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = page - 2 + i;
                  if (pageNum < 1) pageNum = i + 1;
                  if (pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      className={pageNum === page ? "active" : ""}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                {t("下一页", "Next")} →
              </button>
            </div>
          )}

          {/* Fantasy 计分说明 */}
          <div className="scoring-note">
            <h4>⚡ Fantasy Scoring (ESPN Default)</h4>
            <p>PTS: +1 | REB: +1 | AST: +1 | STL: +2 | BLK: +2 | 3PM: +1 | TO: -1</p>
            <p className="data-info">
              {t(
                "📊 数据来源: Ball Don't Lie API (ALL-STAR) • 实时更新",
                "📊 Data Source: Ball Don't Lie API (ALL-STAR) • Live Updates"
              )}
            </p>
          </div>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page-content {
    min-height: calc(100vh - 60px);
    background: #f5f5f5;
    padding: 20px 16px;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    background: #fff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .header-left h1 {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 12px 0;
  }

  .header-tabs {
    display: flex;
    gap: 4px;
  }

  .header-tabs .tab {
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #666;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .header-tabs .tab.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    background: #f0f0f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .view-toggle button {
    padding: 8px 16px;
    border: none;
    background: none;
    font-size: 13px;
    cursor: pointer;
    color: #666;
  }

  .view-toggle button.active {
    background: #0066cc;
    color: white;
  }

  .refresh-btn {
    padding: 8px 16px;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .refresh-btn:hover {
    background: #e0e0e0;
  }

  .data-source-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: linear-gradient(90deg, #065f46 0%, #047857 100%);
    border-radius: 6px;
    margin-bottom: 16px;
    color: white;
    font-size: 13px;
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    min-width: 220px;
  }

  .search-icon {
    color: #999;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
    color: #333;
  }

  .filter-select {
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    color: #333;
    cursor: pointer;
  }

  .stats-info {
    display: flex;
    gap: 16px;
    margin-left: auto;
    font-size: 13px;
    color: #666;
  }

  .table-container {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow-x: auto;
  }

  .players-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
  }

  .players-table th {
    padding: 12px 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    white-space: nowrap;
  }

  .players-table th:hover {
    background: #f0f0f0;
  }

  .th-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .sort-icon {
    font-size: 10px;
    opacity: 0.3;
  }

  .sort-icon.active {
    opacity: 1;
    color: #0066cc;
  }

  .col-player {
    text-align: left !important;
    padding-left: 16px !important;
  }

  .players-table td {
    padding: 10px 8px;
    text-align: center;
    font-size: 13px;
    color: #333;
    border-bottom: 1px solid #f0f0f0;
  }

  .players-table tr:hover {
    background: #f8f9fa;
  }

  .players-table tr.injured {
    background: #fff8f8;
  }

  .col-rank {
    width: 40px;
    padding-left: 12px !important;
  }

  .rank {
    display: inline-block;
    width: 28px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    background: #f0f0f0;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #666;
  }

  .col-player-info {
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left !important;
    min-width: 180px;
  }

  .player-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .player-details {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .player-meta {
    font-size: 11px;
    color: #888;
    margin-top: 2px;
  }

  .injury-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 700;
    color: white;
  }

  .col-stat {
    min-width: 45px;
    color: #555;
  }

  .col-stat.highlight {
    font-weight: 600;
    color: #1a1a1a;
  }

  .col-stat.negative {
    color: #dc2626;
  }

  .col-fpts {
    min-width: 70px;
    background: #f0fdf4;
  }

  .fpts-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .fpts-total {
    font-size: 10px;
    color: #888;
  }

  .fpts-avg {
    font-weight: 700;
    color: #16a34a;
    font-size: 14px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
  }

  .pagination button {
    padding: 8px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination button:hover:not(:disabled) {
    border-color: #0066cc;
    color: #0066cc;
  }

  .page-numbers {
    display: flex;
    gap: 4px;
  }

  .page-numbers button {
    width: 36px;
    padding: 8px;
  }

  .page-numbers button.active {
    background: #0066cc;
    color: white;
    border-color: #0066cc;
  }

  .scoring-note {
    margin-top: 20px;
    padding: 16px 20px;
    background: #fff;
    border-radius: 8px;
    border-left: 4px solid #0066cc;
  }

  .scoring-note h4 {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px 0;
  }

  .scoring-note p {
    font-size: 13px;
    color: #666;
    margin: 0;
  }

  .scoring-note .data-info {
    margin-top: 8px;
    font-size: 12px;
    color: #16a34a;
    font-weight: 500;
  }

  .loading-container, .error-container {
    text-align: center;
    padding: 80px 20px;
    background: #fff;
    border-radius: 8px;
  }

  .loading-spinner {
    font-size: 48px;
    animation: bounce 1s infinite;
    margin-bottom: 16px;
  }

  .loading-status {
    font-size: 14px;
    color: #333;
    margin: 0 0 8px 0;
    font-weight: 500;
  }

  .loading-note {
    font-size: 12px;
    color: #888;
    margin: 0;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .retry-btn {
    padding: 12px 24px;
    background: #0066cc;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
    }

    .header-right {
      width: 100%;
      justify-content: space-between;
    }

    .data-source-bar {
      flex-direction: column;
      gap: 8px;
      text-align: center;
    }

    .filters {
      flex-direction: column;
    }

    .search-box, .filter-select {
      width: 100%;
    }

    .stats-info {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }
  }
`;