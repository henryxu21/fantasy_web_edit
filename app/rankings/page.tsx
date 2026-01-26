"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

// API 配置
const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";

// 类型定义
type BDLTeam = {
  id: number;
  abbreviation: string;
  full_name: string;
};

type BDLPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  team: BDLTeam;
};

type BDLInjury = {
  player: BDLPlayer;
  return_date: string;
  description: string;
  status: string;
};

type PlayerDisplay = {
  id: number;
  name: string;
  team: string;
  position: string;
  height: string;
  weight: string;
  jersey: string;
  injury?: string;
  injuryDesc?: string;
};

type SortKey = "name" | "team" | "position";

export default function PlayerRankingsPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<PlayerDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      // 1. 获取现役球员 (ALL-STAR 可用)
      const playersRes = await fetch(`${API_BASE}/players/active?per_page=100`, {
        headers: { Authorization: API_KEY },
      });
      
      if (!playersRes.ok) {
        throw new Error(`Players API Error: ${playersRes.status}`);
      }
      
      const playersData = await playersRes.json();
      const bdlPlayers: BDLPlayer[] = playersData.data || [];

      // 2. 获取伤病信息 (ALL-STAR 可用)
      let injuries: BDLInjury[] = [];
      try {
        const injuriesRes = await fetch(`${API_BASE}/player_injuries?per_page=100`, {
          headers: { Authorization: API_KEY },
        });
        if (injuriesRes.ok) {
          const injuriesData = await injuriesRes.json();
          injuries = injuriesData.data || [];
        }
      } catch (e) {
        console.log("Injuries fetch failed, continuing without injury data");
      }

      // 创建伤病映射
      const injuryMap = new Map<number, BDLInjury>();
      injuries.forEach(inj => {
        injuryMap.set(inj.player.id, inj);
      });

      // 3. 转换数据格式
      const displayPlayers: PlayerDisplay[] = bdlPlayers.map(p => {
        const injury = injuryMap.get(p.id);
        return {
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          team: p.team?.abbreviation || "FA",
          position: p.position || "N/A",
          height: p.height || "-",
          weight: p.weight ? `${p.weight} lbs` : "-",
          jersey: p.jersey_number || "-",
          injury: injury?.status,
          injuryDesc: injury?.description,
        };
      });

      setPlayers(displayPlayers);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // 获取所有球队列表
  const teams = useMemo(() => {
    const teamSet = new Set(players.map(p => p.team));
    return Array.from(teamSet).sort();
  }, [players]);

  // 过滤和排序
  const filteredPlayers = useMemo(() => {
    let result = players;

    // 搜索
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.team.toLowerCase().includes(term)
      );
    }

    // 位置过滤
    if (positionFilter !== "all") {
      result = result.filter(p => p.position.includes(positionFilter));
    }

    // 球队过滤
    if (teamFilter !== "all") {
      result = result.filter(p => p.team === teamFilter);
    }

    // 排序
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (sortOrder === "asc") {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });

    return result;
  }, [players, searchTerm, positionFilter, teamFilter, sortKey, sortOrder]);

  // 分页
  const paginatedPlayers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, page]);

  const totalPages = Math.ceil(filteredPlayers.length / pageSize);

  // 统计伤病数量
  const injuredCount = players.filter(p => p.injury).length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main className="page-content">
          <div className="loading-container">
            <div className="loading-spinner">🏀</div>
            <p>{t("正在加载球员数据...", "Loading player data...")}</p>
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
          <div className="page-header">
            <div className="header-info">
              <h1>🏀 {t("球员排名", "Player Rankings")}</h1>
              <p className="api-badge">
                ⚡ Powered by Ball Don't Lie API • {t("现役球员", "Active Players")}
              </p>
            </div>
            <button onClick={loadData} className="refresh-btn">
              🔄 {t("刷新", "Refresh")}
            </button>
          </div>

          {/* 过滤器 */}
          <div className="filters">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={t("搜索球员或球队...", "Search player or team...")}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
              className="filter-select"
            >
              <option value="all">{t("全部位置", "All Positions")}</option>
              <option value="G">{t("后卫 (G)", "Guard (G)")}</option>
              <option value="F">{t("前锋 (F)", "Forward (F)")}</option>
              <option value="C">{t("中锋 (C)", "Center (C)")}</option>
            </select>
            <select
              value={teamFilter}
              onChange={(e) => { setTeamFilter(e.target.value); setPage(1); }}
              className="filter-select"
            >
              <option value="all">{t("全部球队", "All Teams")}</option>
              {teams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* 统计信息 */}
          <div className="stats-bar">
            <span>👥 {filteredPlayers.length} {t("名球员", "players")}</span>
            <span>🏥 {injuredCount} {t("名伤病", "injured")}</span>
          </div>

          {/* 球员表格 */}
          <div className="table-container">
            <table className="players-table">
              <thead>
                <tr>
                  <th className="rank-col">#</th>
                  <th className="name-col" onClick={() => handleSort("name")}>
                    {t("球员", "Player")} <SortIcon column="name" />
                  </th>
                  <th onClick={() => handleSort("team")}>
                    {t("球队", "Team")} <SortIcon column="team" />
                  </th>
                  <th onClick={() => handleSort("position")}>
                    {t("位置", "Pos")} <SortIcon column="position" />
                  </th>
                  <th>{t("身高", "Height")}</th>
                  <th>{t("体重", "Weight")}</th>
                  <th>{t("球衣", "Jersey")}</th>
                  <th>{t("状态", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.map((player, index) => (
                  <tr key={player.id} className={player.injury ? "injured" : ""}>
                    <td className="rank-col">{(page - 1) * pageSize + index + 1}</td>
                    <td className="name-col">
                      <span className="player-name">{player.name}</span>
                    </td>
                    <td>
                      <span className="team-badge">{player.team}</span>
                    </td>
                    <td>{player.position}</td>
                    <td>{player.height}</td>
                    <td>{player.weight}</td>
                    <td>#{player.jersey}</td>
                    <td>
                      {player.injury ? (
                        <span className="injury-badge" title={player.injuryDesc}>
                          🏥 {player.injury}
                        </span>
                      ) : (
                        <span className="healthy-badge">✓ {t("健康", "Healthy")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← {t("上一页", "Prev")}
              </button>
              <span className="page-info">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t("下一页", "Next")} →
              </button>
            </div>
          )}

          {/* API 说明 */}
          <div className="api-note">
            <p>
              💡 {t(
                "ALL-STAR 订阅显示现役球员和伤病信息。升级到 GOAT 可获取详细统计数据。",
                "ALL-STAR tier shows active players & injuries. Upgrade to GOAT for detailed stats."
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
    background: #0a0a0a;
    padding: 24px 16px;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .header-info h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .api-badge {
    font-size: 13px;
    color: #22c55e;
    margin: 0;
  }

  .refresh-btn {
    padding: 10px 20px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 200px;
    max-width: 300px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
  }

  .search-icon {
    color: #666;
  }

  .search-box input {
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    outline: none;
  }

  .filter-select {
    padding: 10px 16px;
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
  }

  .stats-bar {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #888;
  }

  .table-container {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    overflow: hidden;
  }

  .players-table {
    width: 100%;
    border-collapse: collapse;
  }

  .players-table th {
    padding: 14px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    background: #1a1a1a;
    border-bottom: 1px solid #222;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .players-table th:hover {
    color: #f59e0b;
  }

  .sort-icon {
    margin-left: 4px;
    opacity: 0.3;
  }

  .sort-icon.active {
    opacity: 1;
    color: #f59e0b;
  }

  .players-table td {
    padding: 12px;
    border-bottom: 1px solid #1a1a1a;
    font-size: 14px;
    color: #ccc;
  }

  .players-table tr:hover {
    background: rgba(245, 158, 11, 0.05);
  }

  .players-table tr.injured {
    background: rgba(239, 68, 68, 0.05);
  }

  .rank-col {
    width: 50px;
    text-align: center;
    color: #666;
  }

  .name-col {
    min-width: 180px;
  }

  .player-name {
    font-weight: 600;
    color: #fff;
  }

  .team-badge {
    display: inline-block;
    padding: 4px 8px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .injury-badge {
    display: inline-block;
    padding: 4px 8px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border-radius: 4px;
    font-size: 12px;
  }

  .healthy-badge {
    color: #22c55e;
    font-size: 12px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
  }

  .pagination button {
    padding: 10px 20px;
    background: #111;
    border: 1px solid #222;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination button:hover:not(:disabled) {
    border-color: #f59e0b;
  }

  .page-info {
    font-size: 14px;
    color: #888;
  }

  .api-note {
    margin-top: 24px;
    padding: 16px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 8px;
    text-align: center;
  }

  .api-note p {
    font-size: 13px;
    color: #f59e0b;
    margin: 0;
  }

  .loading-container, .error-container {
    text-align: center;
    padding: 80px 20px;
  }

  .loading-spinner {
    font-size: 48px;
    animation: bounce 1s infinite;
    margin-bottom: 16px;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .error-container h2 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .error-container p {
    color: #888;
    margin: 0 0 16px 0;
  }

  .retry-btn {
    padding: 12px 24px;
    background: #f59e0b;
    border: none;
    border-radius: 8px;
    color: #000;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .table-container {
      overflow-x: auto;
    }

    .players-table {
      min-width: 600px;
    }

    .filters {
      flex-direction: column;
    }

    .search-box {
      max-width: none;
    }
  }
`;