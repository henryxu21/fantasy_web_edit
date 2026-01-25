"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  isLeagueMember,
  joinLeague,
  leaveLeague,
  listInsights,
  League,
  LeagueMember,
  Insight,
} from "@/lib/store";

export default function LeagueDetailPage() {
  const { t } = useLang();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    setUser(getSessionUser());
    loadLeague();
  }, [slug]);

  async function loadLeague() {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) {
      setLoading(false);
      return;
    }

    setLeague(leagueData);

    // 加载成员
    const membersData = await getLeagueMembers(leagueData.id);
    setMembers(membersData);

    // 检查当前用户是否是成员
    const memberStatus = await isLeagueMember(leagueData.id);
    setIsMember(memberStatus);

    // 加载联赛相关的帖子
    const allInsights = await listInsights();
    const leagueInsights = allInsights.filter(
      (i) => i.league_slug === slug
    );
    setInsights(leagueInsights);

    setLoading(false);
  }

  async function handleJoin() {
    if (!user) {
      alert(t("请先登录", "Please login first"));
      router.push("/auth/login");
      return;
    }

    setJoining(true);
    const res = await joinLeague(league!.id);

    if (res.ok) {
      setIsMember(true);
      // 重新加载成员列表
      const membersData = await getLeagueMembers(league!.id);
      setMembers(membersData);
    } else {
      alert(res.error || t("加入失败", "Failed to join"));
    }
    setJoining(false);
  }

  async function handleLeave() {
    if (!confirm(t("确定要退出联赛吗？", "Are you sure you want to leave?"))) {
      return;
    }

    setJoining(true);
    const res = await leaveLeague(league!.id);

    if (res.ok) {
      setIsMember(false);
      const membersData = await getLeagueMembers(league!.id);
      setMembers(membersData);
    } else {
      alert(res.error || t("退出失败", "Failed to leave"));
    }
    setJoining(false);
  }

  const isOwner = user && league && league.owner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    if (member.user?.username) return member.user.username;
    if (member.user?.name) return member.user.name;
    return "Anonymous";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main className="league-detail-page">
          <div className="loading">
            <p>{t("加载中...", "Loading...")}</p>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app">
        <Header />
        <main className="league-detail-page">
          <div className="not-found">
            <div className="icon">😕</div>
            <h2>{t("联赛不存在", "League Not Found")}</h2>
            <p>{t("该联赛可能已被删除", "This league may have been deleted")}</p>
            <Link href="/league" className="back-btn">
              {t("返回联赛列表", "Back to Leagues")}
            </Link>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="league-detail-page">
        <div className="container">
          {/* 联赛头部 */}
          <div className="league-header">
            <div className="header-content">
              <div className="league-icon">🏆</div>
              <div className="league-info">
                <h1>{league.name}</h1>
                <div className="league-meta">
                  <span className="badge">
                    {league.visibility === "public" ? t("公开", "Public") : t("私密", "Private")}
                  </span>
                  <span className="members-count">
                    👥 {members.length} {t("成员", "members")}
                  </span>
                  <span className="date">
                    {t("创建于", "Created")} {formatDate(league.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="header-actions">
              {!isMember ? (
                <button
                  className="join-btn"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? t("加入中...", "Joining...") : t("加入联赛", "Join League")}
                </button>
              ) : isOwner ? (
                <span className="owner-badge">{t("创建者", "Owner")}</span>
              ) : (
                <button
                  className="leave-btn"
                  onClick={handleLeave}
                  disabled={joining}
                >
                  {joining ? t("退出中...", "Leaving...") : t("退出联赛", "Leave")}
                </button>
              )}
            </div>
          </div>

          <div className="content-grid">
            {/* 左侧：成员列表 */}
            <div className="members-section">
              <h2>{t("成员", "Members")} ({members.length})</h2>
              <div className="members-list">
                {members.map((member) => {
                  const name = getMemberName(member);
                  return (
                    <div key={member.id} className="member-item">
                      <div className="member-avatar">
                        {name[0]?.toUpperCase()}
                      </div>
                      <div className="member-info">
                        <span className="member-name">{name}</span>
                        {member.role === "owner" && (
                          <span className="role-badge">{t("创建者", "Owner")}</span>
                        )}
                      </div>
                      <span className="join-date">
                        {formatDate(member.joined_at)}
                      </span>
                    </div>
                  );
                })}

                {members.length === 0 && (
                  <div className="no-members">
                    <p>{t("还没有成员", "No members yet")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：联赛帖子 */}
            <div className="posts-section">
              <div className="section-header">
                <h2>{t("联赛动态", "League Posts")} ({insights.length})</h2>
                {isMember && (
                  <Link href={`/insights/new?league=${slug}`} className="new-post-btn">
                    + {t("发布", "Post")}
                  </Link>
                )}
              </div>

              <div className="posts-list">
                {insights.length === 0 ? (
                  <div className="no-posts">
                    <div className="icon">📝</div>
                    <p>{t("还没有帖子", "No posts yet")}</p>
                    {isMember && (
                      <Link href={`/insights/new?league=${slug}`} className="post-btn">
                        {t("发布第一篇", "Create First Post")}
                      </Link>
                    )}
                  </div>
                ) : (
                  insights.map((insight) => (
                    <Link
                      href={`/insights/${insight.id}`}
                      key={insight.id}
                      className="post-item"
                    >
                      <div className="post-content">
                        <h3>{insight.title}</h3>
                        <p>{insight.body?.slice(0, 100)}...</p>
                      </div>
                      <div className="post-meta">
                        <span>❤️ {insight.heat || 0}</span>
                        <span>{formatDate(insight.created_at)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-detail-page {
    min-height: 100vh;
    background: #0a0a0a;
    padding: 24px 16px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* 联赛头部 */
  .league-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    background: linear-gradient(135deg, #1a237e 0%, #0d1442 100%);
    border: 1px solid #283593;
    border-radius: 16px;
    margin-bottom: 24px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .league-icon {
    font-size: 48px;
    width: 80px;
    height: 80px;
    background: rgba(255,255,255,0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .league-info h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px 0;
  }

  .league-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .badge {
    padding: 4px 12px;
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
  }

  .members-count, .date {
    font-size: 14px;
    color: #90caf9;
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .join-btn {
    padding: 12px 28px;
    background: #f59e0b;
    border: none;
    border-radius: 24px;
    color: #000;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .join-btn:hover:not(:disabled) {
    background: #fbbf24;
    transform: scale(1.05);
  }

  .join-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .leave-btn {
    padding: 12px 24px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 24px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
  }

  .leave-btn:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
  }

  .owner-badge {
    padding: 10px 20px;
    background: rgba(245, 158, 11, 0.2);
    border-radius: 24px;
    color: #f59e0b;
    font-size: 14px;
    font-weight: 500;
  }

  /* 内容区 */
  .content-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
  }

  /* 成员区 */
  .members-section {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 20px;
    height: fit-content;
  }

  .members-section h2 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 16px 0;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #1a1a1a;
    border-radius: 10px;
  }

  .member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .member-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .member-name {
    font-size: 14px;
    color: #fff;
    font-weight: 500;
  }

  .role-badge {
    padding: 2px 8px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    font-size: 11px;
    border-radius: 8px;
  }

  .join-date {
    font-size: 12px;
    color: #666;
  }

  .no-members {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  /* 帖子区 */
  .posts-section {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 20px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .new-post-btn {
    padding: 8px 16px;
    background: #f59e0b;
    color: #000;
    font-size: 13px;
    font-weight: 600;
    border-radius: 16px;
    text-decoration: none;
  }

  .posts-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .post-item {
    display: block;
    padding: 16px;
    background: #1a1a1a;
    border: 1px solid #222;
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .post-item:hover {
    border-color: #f59e0b;
  }

  .post-content h3 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .post-content p {
    font-size: 14px;
    color: #888;
    margin: 0;
    line-height: 1.5;
  }

  .post-meta {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    font-size: 13px;
    color: #666;
  }

  .no-posts {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .no-posts .icon {
    font-size: 40px;
    margin-bottom: 12px;
  }

  .no-posts p {
    margin: 0 0 16px 0;
  }

  .post-btn {
    display: inline-block;
    padding: 10px 24px;
    background: #f59e0b;
    color: #000;
    font-weight: 600;
    border-radius: 20px;
    text-decoration: none;
  }

  /* 加载和错误状态 */
  .loading, .not-found {
    text-align: center;
    padding: 80px 20px;
  }

  .not-found .icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .not-found h2 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .not-found p {
    color: #666;
    margin: 0 0 24px 0;
  }

  .back-btn {
    display: inline-block;
    padding: 12px 24px;
    background: #f59e0b;
    color: #000;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .league-header {
      flex-direction: column;
      gap: 20px;
      text-align: center;
    }

    .header-content {
      flex-direction: column;
    }

    .content-grid {
      grid-template-columns: 1fr;
    }
  }
`;