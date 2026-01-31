// app/api/nba-stats/route.ts
// 后台预取并缓存 NBA 数据，用户访问时直接返回缓存数据

import { NextResponse } from "next/server";

const API_BASE = "https://api.balldontlie.io/v1";
const API_KEY = "14fd7de0-c9c0-40d3-bbeb-e8c86a61d56a";

// Fantasy 计分规则
const FANTASY_WEIGHTS = {
  pts: 1,
  reb: 1,
  ast: 1,
  stl: 2,
  blk: 2,
  fg3m: 1,
  tov: -1,
};

// 内存缓存 (生产环境建议用 Redis/Upstash)
let cachedData: {
  players: any[];
  gamesLoaded: number;
  lastUpdated: string;
  isUpdating: boolean;
} = {
  players: [],
  gamesLoaded: 0,
  lastUpdated: "",
  isUpdating: false,
};

// 获取最近 N 天的日期
function getRecentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split("T")[0]);
  }
  return dates;
}

// API 请求封装
async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: API_KEY },
    next: { revalidate: 0 }, // 不使用 Next.js 缓存
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// 计算 Fantasy Points
function calculateFantasyPoints(stats: any): number {
  return (
    (stats.pts || 0) * FANTASY_WEIGHTS.pts +
    (stats.reb || 0) * FANTASY_WEIGHTS.reb +
    (stats.ast || 0) * FANTASY_WEIGHTS.ast +
    (stats.stl || 0) * FANTASY_WEIGHTS.stl +
    (stats.blk || 0) * FANTASY_WEIGHTS.blk +
    (stats.fg3m || 0) * FANTASY_WEIGHTS.fg3m +
    (stats.tov || 0) * FANTASY_WEIGHTS.tov
  );
}

// 后台刷新数据
async function refreshData() {
  if (cachedData.isUpdating) {
    console.log("Already updating, skip...");
    return;
  }

  cachedData.isUpdating = true;
  console.log("Starting data refresh...");

  try {
    // 1. 获取最近 5 天的已完成比赛
    const recentDates = getRecentDates(5);
    const allGames: any[] = [];

    for (const date of recentDates) {
      const gamesRes = await fetchAPI("/games", { "dates[]": date, per_page: "50" });
      const finishedGames = (gamesRes.data || []).filter((g: any) => g.status === "Final");
      allGames.push(...finishedGames);
      await new Promise((r) => setTimeout(r, 200)); // Rate limit
    }

    if (allGames.length === 0) {
      console.log("No finished games found");
      cachedData.isUpdating = false;
      return;
    }

    console.log(`Found ${allGames.length} finished games`);

    // 2. 获取每场比赛的球员统计
    const playerStatsMap = new Map<number, { player: any; games: any[] }>();

    for (const game of allGames) {
      try {
        const statsRes = await fetchAPI("/stats", { "game_ids[]": game.id.toString(), per_page: "100" });
        const stats = statsRes.data || [];

        for (const stat of stats) {
          const playerId = stat.player.id;
          if (!playerStatsMap.has(playerId)) {
            playerStatsMap.set(playerId, { player: stat.player, games: [] });
          }
          playerStatsMap.get(playerId)!.games.push({ ...stat, team: stat.team });
        }
      } catch (e) {
        console.error(`Failed to fetch stats for game ${game.id}`);
      }
      await new Promise((r) => setTimeout(r, 300)); // Rate limit
    }

    // 3. 获取伤病信息
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

    // 4. 计算球员数据
    const playersData: any[] = [];

    playerStatsMap.forEach(({ player, games }) => {
      if (games.length === 0) return;

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

      const fptsTotal = calculateFantasyPoints(totals);
      const fptsAvg = fptsTotal / gp;
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

    // 5. 排序
    playersData.sort((a, b) => b.fptsAvg - a.fptsAvg);
    playersData.forEach((p, i) => {
      p.rank = i + 1;
    });

    // 6. 更新缓存
    cachedData = {
      players: playersData,
      gamesLoaded: allGames.length,
      lastUpdated: new Date().toISOString(),
      isUpdating: false,
    };

    console.log(`Data refresh complete: ${playersData.length} players`);
  } catch (error) {
    console.error("Error refreshing data:", error);
    cachedData.isUpdating = false;
  }
}

// GET: 返回缓存数据
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  // 如果没有数据或者强制刷新，开始后台刷新
  if (cachedData.players.length === 0 || forceRefresh) {
    // 异步刷新，不阻塞响应
    refreshData();

    // 如果完全没有数据，等待第一次加载
    if (cachedData.players.length === 0) {
      return NextResponse.json({
        status: "loading",
        message: "Data is being loaded for the first time, please wait...",
        players: [],
        gamesLoaded: 0,
        lastUpdated: null,
      });
    }
  }

  // 检查数据是否过期 (超过 30 分钟自动后台刷新)
  if (cachedData.lastUpdated) {
    const lastUpdate = new Date(cachedData.lastUpdated).getTime();
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    if (now - lastUpdate > thirtyMinutes && !cachedData.isUpdating) {
      // 后台刷新，不阻塞
      refreshData();
    }
  }

  return NextResponse.json({
    status: "success",
    players: cachedData.players,
    gamesLoaded: cachedData.gamesLoaded,
    lastUpdated: cachedData.lastUpdated,
    isUpdating: cachedData.isUpdating,
  });
}

// POST: 手动触发刷新
export async function POST() {
  if (cachedData.isUpdating) {
    return NextResponse.json({
      status: "already_updating",
      message: "Data refresh is already in progress",
    });
  }

  // 后台刷新
  refreshData();

  return NextResponse.json({
    status: "refresh_started",
    message: "Data refresh started in background",
  });
}
