// app/league/[slug]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  supabase,
  joinLeague,
  startDraft,
  subscribeToLeague,
  type League,
  type Team
} from "@/lib/supabase";
import { getSessionUser, getLeagueMembers, type LeagueMember } from "@/lib/store";
import DraftRoom from "@/components/DraftRoom";

// 先导入选秀房间组件（稍后创建）
// import DraftRoom from "@/components/DraftRoom";

export default function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const leagueId = slug;
  
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    init();
  }, []);

  // 订阅联赛更新
  useEffect(() => {
    if (!leagueId) return;

    const channel = subscribeToLeague(leagueId, () => {
      loadLeagueInfo();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  async function init() {
    try {
      const user = getSessionUser();
      setCurrentUser(user);
    } catch (err) {
      console.error("Auth error:", err);
    }
    try {
      await loadLeagueInfo();
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeagueInfo() {
    try {
      // 1. 获取联赛信息
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();

      if (leagueError) throw leagueError;
      setLeague(leagueData);

      // 2. 获取所有队伍
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)
        .order('draft_position', { ascending: true });

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // 2.5 获取成员列表（用于首页显示）
      const membersData = await getLeagueMembers(leagueId);
      setMembers(membersData);

      // 3. 找到我的队伍
      const user = getSessionUser();
      if (user) {
        const myTeamData = teamsData?.find(t => t.user_id === user.id);
        setMyTeam(myTeamData || null);
      }

      // 4. 加载最近聊天消息
      const { data: msgData } = await supabase
        .from("league_messages")
        .select("*")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (msgData && msgData.length > 0) {
        const userIds = [...new Set(msgData.map((m: any) => m.user_id))];
        const { data: users } = await supabase
          .from("users")
          .select("id, name, username, avatar_url")
          .in("id", userIds);

        const withUsers = msgData.map((m: any) => ({
          ...m,
          user: users?.find((u) => u.id === m.user_id),
        }));
        setMessages(withUsers);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load league:", err);
    }
  }

  async function handleJoinDraft() {
    if (!teamName.trim()) {
      alert("请输入队伍名称");
      return;
    }

    setJoining(true);
    
    try {
      const team = await joinLeague(leagueId, teamName.trim());
      setMyTeam(team);
      setShowJoinModal(false);
      setTeamName("");
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Join error:", err);
      alert(err.message || "加入失败");
    } finally {
      setJoining(false);
    }
  }

  async function handleStartDraft() {
    if (!confirm("确定开始选秀吗？")) {
      return;
    }

    setStarting(true);
    
    try {
      await startDraft(leagueId);
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Start draft error:", err);
      alert(err.message || "开始选秀失败");
    } finally {
      setStarting(false);
    }
  }

  async function handlePostMessage() {
    if (!currentUser || !league || !newMessage.trim()) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("league_messages")
      .insert({
        league_id: league.id,
        user_id: currentUser.id,
        title: null,
        body: newMessage.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMessages([
        {
          ...data,
          user: { name: currentUser.name, username: currentUser.username },
        },
        ...messages,
      ]);
      setNewMessage("");
    }
    setPosting(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🏀</div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>❌ 联赛未找到</h2>
        <p>League ID: {leagueId}</p>
      </div>
    );
  }

  // 如果选秀已开始且用户已加入，显示选秀房间
  if (league.status === "drafting" && myTeam) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: '#f5f7fa',
        padding: '24px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <Link
            href={`/league/${leagueId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid #e2e8f0',
              color: '#334155',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← 返回联赛主页
          </Link>
        </div>
        <DraftRoom leagueId={leagueId} myTeam={myTeam} />
      </div>
    );
  }

  const isCommissioner = currentUser?.id === league.commissioner_id;
  const canStartDraft = isCommissioner && teams.length >= 2 && league.status === 'draft_pending';

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#f5f7fa',
      padding: '24px'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <Link
          href="/league"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            color: '#334155',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← 返回公开联赛
        </Link>
      </div>
      {/* 联赛头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '16px',
        color: 'white',
        marginBottom: '24px',
        boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontSize: '64px' }}>🏆</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: '0 0 12px 0', fontSize: '32px' }}>{league.name}</h1>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ 
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                fontSize: '13px'
              }}>
                {league.season} 赛季
              </span>
              <span style={{ 
                padding: '6px 14px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '20px',
                fontSize: '13px'
              }}>
                {league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}
              </span>
              <span style={{ 
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                background: league.status === 'draft_pending' ? '#fbbf24' : 
                           league.status === 'drafting' ? '#10b981' : '#3b82f6',
                color: league.status === 'draft_pending' ? '#78350f' : 'white'
              }}>
                {league.status === "draft_pending" && "准备中"}
                {league.status === "drafting" && "选秀中"}
                {league.status === "active" && "进行中"}
              </span>
            </div>
            {isCommissioner && (
              <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.9 }}>
                👑 联盟管理员
              </div>
            )}
          </div>
          
          {!myTeam ? (
            <button 
              onClick={() => setShowJoinModal(true)}
              style={{
                padding: '12px 28px',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ 加入联赛
            </button>
          ) : (
            <div style={{
              padding: '12px 28px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              ✅ 已加入
            </div>
          )}
        </div>
      </div>

      {/* 联赛公告 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
        borderLeft: '4px solid #3b82f6',
        color: '#0f172a'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>📢 联赛公告</h3>
        <p style={{ margin: 0, color: '#334155', lineHeight: 1.6 }}>
          欢迎来到联赛！准备好开始你的Fantasy 篮球之旅了吗?
        </p>
        {canStartDraft && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#fef3c7',
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '14px',
            fontWeight: 500
          }}>
            💡 提示：已有{teams.length}支队伍加入，可以开始选秀了！
          </div>
        )}
      </div>

      {/* 参赛队伍 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
            👥 参赛队伍 ({teams.length}/{league.max_teams})
          </h3>
          {canStartDraft && (
            <button 
              onClick={handleStartDraft}
              disabled={starting}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: starting ? 'not-allowed' : 'pointer',
                opacity: starting ? 0.6 : 1
              }}
            >
              {starting ? "⏳ 开始中..." : "🚀 开始选秀"}
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {teams.map((team) => (
            <div 
              key={team.id} 
              style={{
                background: myTeam?.id === team.id ? 
                  'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : '#f8fafc',
                padding: '20px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                border: myTeam?.id === team.id ? '2px solid #3b82f6' : '2px solid transparent'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '18px'
              }}>
                #{team.draft_position}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '16px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {team.team_name}
                  {myTeam?.id === team.id && (
                    <span style={{
                      padding: '2px 8px',
                      background: '#3b82f6',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}>
                      你
                    </span>
                  )}
                  {team.user_id === league.commissioner_id && (
                    <span style={{ fontSize: '14px' }}>👑</span>
                  )}
                </div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  {league.status === "draft_pending" ? "等待选秀" : `${team.wins}-${team.losses}`}
                </div>
              </div>
            </div>
          ))}
          
          {/* 空位 */}
          {Array.from({ length: league.max_teams - teams.length }).map((_, i) => (
            <div 
              key={`empty-${i}`}
              onClick={() => !myTeam && setShowJoinModal(true)}
              style={{
                background: '#f1f5f9',
                border: '2px dashed #cbd5e1',
                padding: '20px',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: myTeam ? 'default' : 'pointer',
                flexDirection: 'column',
                gap: '8px',
                color: '#64748b'
              }}
            >
              <span style={{ fontSize: '32px' }}>➕</span>
              <span style={{ fontSize: '14px', color: '#64748b' }}>等待加入</span>
            </div>
          ))}
        </div>
      </div>

      {/* 成员列表 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>👥 成员</h3>
          <Link href={`/league/${leagueId}/members`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            查看全部 →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {members.slice(0, 8).map((m) => {
            const name = m.user?.username || m.user?.name || "Anonymous";
            return (
              <div key={m.id} style={{
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{name}</div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    {m.team_name || "队伍"}
                  </div>
                </div>
                {m.role === "owner" && <span style={{ fontSize: '14px' }}>👑</span>}
              </div>
            );
          })}
          {members.length === 0 && (
            <div style={{ color: '#94a3b8' }}>暂无成员</div>
          )}
        </div>
      </div>

      {/* 聊天框 */}
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>💬 联赛聊天</h3>
          <Link href={`/league/${leagueId}/board`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
            进入讨论区 →
          </Link>
        </div>

        <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
          {messages.length === 0 && (
            <div style={{ color: '#94a3b8' }}>暂无聊天，快发第一条吧！</div>
          )}
          {messages.map((msg) => {
            const name = msg.user?.username || msg.user?.name || "Anonymous";
            return (
              <div key={msg.id} style={{
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{name}</div>
                <div style={{ color: '#334155' }}>{msg.body}</div>
              </div>
            );
          })}
        </div>

        {currentUser ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="说点什么..."
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px'
              }}
            />
            <button
              onClick={handlePostMessage}
              disabled={posting || !newMessage.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: posting || !newMessage.trim() ? '#cbd5f5' : '#6366f1',
                color: 'white',
                fontWeight: 600,
                cursor: posting || !newMessage.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {posting ? "发送中..." : "发送"}
            </button>
          </div>
        ) : (
          <div style={{ color: '#94a3b8' }}>请先登录后发言</div>
        )}
      </div>

      {myTeam && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>🧩 我的阵容</h3>
            <p style={{ margin: 0, color: '#64748b' }}>
              管理你的球员阵容，添加或移除球员
            </p>
          </div>
          <Link
            href={`/league/${leagueId}/roster`}
            style={{
              padding: '10px 18px',
              background: '#f59e0b',
              borderRadius: '10px',
              color: '#111',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            管理阵容
          </Link>
        </div>
      )}

      {/* 加入联赛弹窗 */}
      {showJoinModal && (
        <div 
          onClick={() => setShowJoinModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px' }}>➕ 加入联赛</h3>
              <button 
                onClick={() => setShowJoinModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', color: '#64748b' }}>
                请为你的队伍起个名字
              </p>
              
              <input
                type="text"
                placeholder="输入队伍名称..."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={50}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && teamName.trim()) {
                    handleJoinDraft();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '8px'
              }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 600 }}>📋 你将获得:</p>
                <ul style={{ margin: 0, paddingLeft: '24px' }}>
                  <li style={{ marginBottom: '8px', color: '#64748b' }}>
                    一个独特的选秀位置 (#{teams.length + 1})
                  </li>
                  <li style={{ marginBottom: '8px', color: '#64748b' }}>
                    13个球员名额
                  </li>
                  <li style={{ color: '#64748b' }}>
                    参与所有周赛
                  </li>
                </ul>
              </div>
            </div>
            
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => setShowJoinModal(false)}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  color: '#64748b',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button 
                onClick={handleJoinDraft}
                disabled={joining || !teamName.trim()}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: joining || !teamName.trim() ? 'not-allowed' : 'pointer',
                  opacity: joining || !teamName.trim() ? 0.5 : 1
                }}
              >
                {joining ? "加入中..." : "确认加入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
