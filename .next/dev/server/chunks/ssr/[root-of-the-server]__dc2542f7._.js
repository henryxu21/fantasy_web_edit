module.exports = [
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/fantasy-web/lib/supabase.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createLeague",
    ()=>createLeague,
    "getCurrentDraftingTeam",
    ()=>getCurrentDraftingTeam,
    "getCurrentUser",
    ()=>getCurrentUser,
    "getDraftedPlayerIds",
    ()=>getDraftedPlayerIds,
    "getSnakeDraftOrder",
    ()=>getSnakeDraftOrder,
    "isMyTurn",
    ()=>isMyTurn,
    "joinLeague",
    ()=>joinLeague,
    "pickPlayer",
    ()=>pickPlayer,
    "startDraft",
    ()=>startDraft,
    "subscribeToDraftRoom",
    ()=>subscribeToDraftRoom,
    "subscribeToLeague",
    ()=>subscribeToLeague,
    "subscribeToTeamRoster",
    ()=>subscribeToTeamRoster,
    "supabase",
    ()=>supabase
]);
// lib/supabase.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/fantasy-web/node_modules/@supabase/supabase-js/dist/index.mjs [app-ssr] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://yjdlllhntfxvgvjgdnsw.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "sb_publishable_CU0R3BJg1YnxAYcLlwwNfw_NI6cHvnP");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
}
function getSnakeDraftOrder(round, numTeams, position) {
    if (round % 2 === 1) {
        // 奇数轮：正序
        return position;
    } else {
        // 偶数轮：倒序
        return numTeams - position + 1;
    }
}
async function getCurrentDraftingTeam(leagueId) {
    // 1. 获取选秀设置
    const { data: draftSettings, error: settingsError } = await supabase.from('draft_settings').select('*').eq('league_id', leagueId).single();
    if (settingsError || !draftSettings) return null;
    // 2. 获取所有队伍
    const { data: teams, error: teamsError } = await supabase.from('teams').select('*').eq('league_id', leagueId).order('draft_position', {
        ascending: true
    });
    if (teamsError || !teams) return null;
    // 3. 计算当前应该选秀的位置
    const pickPosition = getSnakeDraftOrder(draftSettings.current_round, teams.length, draftSettings.current_pick);
    // 4. 找到对应的队伍
    return teams.find((t)=>t.draft_position === pickPosition);
}
async function isMyTurn(leagueId, teamId) {
    const currentTeam = await getCurrentDraftingTeam(leagueId);
    return currentTeam?.id === teamId;
}
async function getDraftedPlayerIds(leagueId) {
    const { data, error } = await supabase.from('draft_picks').select('player_id').eq('league_id', leagueId);
    if (error) throw error;
    return data?.map((p)=>p.player_id) || [];
}
function subscribeToDraftRoom(leagueId, onUpdate) {
    const channel = supabase.channel(`draft_room_${leagueId}`).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'draft_picks',
        filter: `league_id=eq.${leagueId}`
    }, onUpdate).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'draft_settings',
        filter: `league_id=eq.${leagueId}`
    }, onUpdate).subscribe();
    return channel;
}
function subscribeToLeague(leagueId, onUpdate) {
    const channel = supabase.channel(`league_${leagueId}`).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leagues',
        filter: `id=eq.${leagueId}`
    }, onUpdate).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `league_id=eq.${leagueId}`
    }, onUpdate).subscribe();
    return channel;
}
function subscribeToTeamRoster(teamId, onUpdate) {
    const channel = supabase.channel(`team_roster_${teamId}`).on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_rosters',
        filter: `team_id=eq.${teamId}`
    }, onUpdate).subscribe();
    return channel;
}
async function createLeague(data) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    const { data: league, error } = await supabase.from('leagues').insert({
        name: data.name,
        commissioner_id: user.id,
        max_teams: data.max_teams || 10,
        draft_type: data.draft_type || 'snake'
    }).select().single();
    if (error) throw error;
    // 创建选秀设置
    await supabase.from('draft_settings').insert({
        league_id: league.id,
        draft_type: data.draft_type || 'snake'
    });
    return league;
}
async function joinLeague(leagueId, teamName) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    // 1. 检查联赛是否存在和是否已满
    const { data: league, error: leagueError } = await supabase.from('leagues').select('*, teams:teams(count)').eq('id', leagueId).single();
    if (leagueError) throw leagueError;
    if (!league) throw new Error('League not found');
    const currentTeams = league.teams[0]?.count || 0;
    if (currentTeams >= league.max_teams) {
        throw new Error('League is full');
    }
    // 2. 检查是否已加入
    const { data: existingTeam } = await supabase.from('teams').select('id').eq('league_id', leagueId).eq('user_id', user.id).single();
    if (existingTeam) {
        throw new Error('Already joined this league');
    }
    // 3. 创建队伍
    const { data: team, error: teamError } = await supabase.from('teams').insert({
        league_id: leagueId,
        user_id: user.id,
        team_name: teamName,
        draft_position: currentTeams + 1
    }).select().single();
    if (teamError) throw teamError;
    return team;
}
async function startDraft(leagueId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    // 1. 检查是否是管理员
    const { data: league, error: leagueError } = await supabase.from('leagues').select('commissioner_id').eq('id', leagueId).single();
    if (leagueError) throw leagueError;
    if (league.commissioner_id !== user.id) {
        throw new Error('Only commissioner can start the draft');
    }
    // 2. 更新联赛状态
    await supabase.from('leagues').update({
        status: 'drafting'
    }).eq('id', leagueId);
    // 3. 更新选秀设置
    await supabase.from('draft_settings').update({
        started_at: new Date().toISOString()
    }).eq('league_id', leagueId);
}
async function pickPlayer(leagueId, teamId, player) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    // 1. 检查是否轮到该队伍
    const currentTeam = await getCurrentDraftingTeam(leagueId);
    if (!currentTeam || currentTeam.id !== teamId) {
        throw new Error('Not your turn to pick');
    }
    // 2. 检查球员是否已被选
    const { data: existingPick } = await supabase.from('draft_picks').select('id').eq('league_id', leagueId).eq('player_id', player.id).single();
    if (existingPick) {
        throw new Error('Player already drafted');
    }
    // 3. 获取选秀设置
    const { data: draftSettings } = await supabase.from('draft_settings').select('*').eq('league_id', leagueId).single();
    if (!draftSettings) throw new Error('Draft settings not found');
    // 4. 获取队伍数量
    const { count: teamCount } = await supabase.from('teams').select('*', {
        count: 'exact',
        head: true
    }).eq('league_id', leagueId);
    const numTeams = teamCount || 0;
    // 5. 计算overall pick
    const overallPick = (draftSettings.current_round - 1) * numTeams + getSnakeDraftOrder(draftSettings.current_round, numTeams, draftSettings.current_pick);
    // 6. 记录选秀（使用事务）
    const { data: pick, error: pickError } = await supabase.from('draft_picks').insert({
        league_id: leagueId,
        team_id: teamId,
        player_id: player.id,
        player_name: player.name,
        player_team: player.team,
        player_position: player.position,
        round: draftSettings.current_round,
        pick_number: draftSettings.current_pick,
        overall_pick: overallPick
    }).select().single();
    if (pickError) throw pickError;
    // 7. 添加到阵容
    await supabase.from('team_rosters').insert({
        team_id: teamId,
        player_id: player.id,
        player_name: player.name,
        player_team: player.team,
        player_position: player.position,
        acquisition_type: 'draft'
    });
    // 8. 更新选秀进度
    let newPick = draftSettings.current_pick + 1;
    let newRound = draftSettings.current_round;
    if (newPick > numTeams) {
        newPick = 1;
        newRound = newRound + 1;
    }
    const updateData = {
        current_pick: newPick,
        current_round: newRound
    };
    // 检查是否完成
    if (newRound > draftSettings.total_rounds) {
        updateData.completed_at = new Date().toISOString();
        // 更新联赛状态为active
        await supabase.from('leagues').update({
            status: 'active'
        }).eq('id', leagueId);
    }
    await supabase.from('draft_settings').update(updateData).eq('league_id', leagueId);
    return pick;
}
}),
"[project]/fantasy-web/app/league/new/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NewLeaguePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/fantasy-web/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/fantasy-web/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/fantasy-web/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/fantasy-web/lib/supabase.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function NewLeaguePage() {
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const [name, setName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [submitting, setSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!name.trim()) {
            setError("请输入联赛名称");
            return;
        }
        if (name.trim().length < 2) {
            setError("联赛名称至少 2 个字符");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            // 直接插入数据，使用测试用户ID
            const testUserId = "test-user-" + Date.now();
            const { data: league, error: createError } = await __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('leagues').insert({
                name: name.trim(),
                commissioner_id: testUserId,
                max_teams: 10,
                draft_type: 'snake'
            }).select().single();
            if (createError) throw createError;
            // 创建选秀设置
            await __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('draft_settings').insert({
                league_id: league.id,
                draft_type: 'snake'
            });
            alert('联赛创建成功！ID: ' + league.id);
            // 跳转到联赛页面
            router.push(`/league/${league.id}`);
        } catch (err) {
            console.error('Create league error:', err);
            setError(err.message || "创建失败");
            setSubmitting(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            minHeight: '100vh',
            background: '#0a0a0a',
            padding: '24px 16px'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            style: {
                maxWidth: '500px',
                margin: '0 auto'
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '16px',
                    padding: '32px'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            textAlign: 'center',
                            marginBottom: '32px'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    fontSize: '48px',
                                    marginBottom: '16px'
                                },
                                children: "🏆"
                            }, void 0, false, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                style: {
                                    fontSize: '24px',
                                    fontWeight: '700',
                                    color: '#f59e0b',
                                    margin: '0 0 8px 0'
                                },
                                children: "创建联赛"
                            }, void 0, false, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 86,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                style: {
                                    fontSize: '14px',
                                    color: '#666',
                                    margin: 0
                                },
                                children: "创建你的 Fantasy 篮球联赛"
                            }, void 0, false, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 94,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                        lineNumber: 81,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: handleSubmit,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    marginBottom: '24px'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        style: {
                                            display: 'block',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            color: '#fff',
                                            marginBottom: '8px'
                                        },
                                        children: "联赛名称"
                                    }, void 0, false, {
                                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                        lineNumber: 106,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        value: name,
                                        onChange: (e)=>setName(e.target.value),
                                        placeholder: "例如：2024 Fantasy 联赛",
                                        maxLength: 50,
                                        disabled: submitting,
                                        style: {
                                            width: '100%',
                                            padding: '14px 16px',
                                            background: '#1a1a1a',
                                            border: '1px solid #333',
                                            borderRadius: '10px',
                                            color: '#fff',
                                            fontSize: '15px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                        lineNumber: 115,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        style: {
                                            fontSize: '12px',
                                            color: '#666',
                                            textAlign: 'right',
                                            marginTop: '4px'
                                        },
                                        children: [
                                            name.length,
                                            "/50"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                        lineNumber: 134,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 105,
                                columnNumber: 13
                            }, this),
                            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    padding: '12px 16px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '8px',
                                    color: '#fca5a5',
                                    fontSize: '14px',
                                    marginBottom: '24px'
                                },
                                children: error
                            }, void 0, false, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 146,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    display: 'flex',
                                    gap: '12px',
                                    marginTop: '8px'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>router.back(),
                                        disabled: submitting,
                                        style: {
                                            flex: 1,
                                            padding: '14px',
                                            background: 'transparent',
                                            border: '1px solid #333',
                                            borderRadius: '10px',
                                            color: '#888',
                                            fontSize: '15px',
                                            cursor: 'pointer'
                                        },
                                        children: "取消"
                                    }, void 0, false, {
                                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                        lineNumber: 165,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "submit",
                                        disabled: submitting || !name.trim(),
                                        style: {
                                            flex: 2,
                                            padding: '14px',
                                            background: submitting || !name.trim() ? '#666' : '#f59e0b',
                                            border: 'none',
                                            borderRadius: '10px',
                                            color: '#000',
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer'
                                        },
                                        children: submitting ? '创建中...' : '创建联赛'
                                    }, void 0, false, {
                                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                        lineNumber: 182,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                                lineNumber: 160,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                        lineNumber: 103,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$fantasy$2d$web$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: '24px',
                            padding: '12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#60a5fa'
                        },
                        children: "⚠️ 测试模式：使用临时用户ID创建联赛"
                    }, void 0, false, {
                        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                        lineNumber: 203,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/fantasy-web/app/league/new/page.tsx",
                lineNumber: 75,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/fantasy-web/app/league/new/page.tsx",
            lineNumber: 71,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/fantasy-web/app/league/new/page.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__dc2542f7._.js.map