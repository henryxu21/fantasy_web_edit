"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getSessionUser, listLeagues, listInsights, League, Insight } from "@/lib/store";

export default function UserProfilePage() {
  const { t } = useLang();
  const params = useParams();
  const username = params.username as string;
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "leagues">("posts");
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [userInsights, setUserInsights] = useState<Insight[]>([]);

  useEffect(() => {
    const user = getSessionUser();
    setCurrentUser(user);
    
    // 检查是否是自己的主页
    const isOwn = user && user.username === username;
    setIsOwnProfile(!!isOwn);
    
    // 获取该用户的帖子 - 匹配 author 字段
    const allInsights = listInsights();
    const filtered = allInsights.filter(i => {
      const authorName = i.author.replace("@", "").toLowerCase();
      return authorName === username.toLowerCase();
    });
    setUserInsights(filtered.sort((a, b) => b.createdAt - a.createdAt));
    
    // 获取该用户的联赛
    if (user && isOwn) {
      const allLeagues = listLeagues();
      const userOwnedLeagues = allLeagues.filter(l => l.ownerId === user.id);
      setUserLeagues(userOwnedLeagues);
    }
  }, [username]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // 解析帖子获取封面图
  const parseInsight = (insight: Insight) => {
    let coverImage: string | undefined;
    let tags: string[] | undefined;
    
    try {
      const parsed = JSON.parse(insight.body);
      if (parsed.metadata) {
        coverImage = parsed.metadata.coverImage;
        tags = parsed.metadata.tags;
      }
    } catch {
      // Body is plain text
    }
    
    return { ...insight, coverImage, tags };
  };

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        {/* Profile Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            borderRadius: "50%", 
            background: "linear-gradient(135deg, #f59e0b, #d97706)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#000"
          }}>
            {username[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>@{username}</h1>
            <p style={{ color: "var(--text-muted)" }}>
              {isOwnProfile ? t("这是你的个人主页", "This is your profile") : t("用户主页", "User Profile")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button 
            className={`toggle-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            {t("帖子", "Posts")} ({userInsights.length})
          </button>
          <button 
            className={`toggle-btn ${activeTab === "leagues" ? "active" : ""}`}
            onClick={() => setActiveTab("leagues")}
          >
            {t("联赛", "Leagues")} ({userLeagues.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === "posts" ? (
          <div>
            {userInsights.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                  {isOwnProfile ? t("你还没有发布任何帖子", "You haven't posted anything yet") : t("该用户还没有发布帖子", "This user hasn't posted anything yet")}
                </p>
                {isOwnProfile && (
                  <Link href="/insights/new" className="btn btn-primary">{t("发布第一篇帖子", "Create Your First Post")}</Link>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {userInsights.map(insight => {
                  const parsed = parseInsight(insight);
                  return (
                    <Link 
                      key={insight.id} 
                      href={`/insights/${insight.id}`} 
                      style={{ 
                        background: "var(--bg-card)", 
                        border: "1px solid var(--border-color)", 
                        borderRadius: 12, 
                        overflow: "hidden",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "transform 0.2s, box-shadow 0.2s"
                      }}
                    >
                      {/* Cover Image */}
                      <div style={{
                        height: 140,
                        background: parsed.coverImage 
                          ? `url(${parsed.coverImage}) center/cover`
                          : "linear-gradient(135deg, #1e293b, #334155)"
                      }}>
                        <div style={{ padding: 8, display: "flex", justifyContent: "flex-end" }}>
                          <span style={{ 
                            background: "rgba(0,0,0,0.6)", 
                            padding: "4px 8px", 
                            borderRadius: 12, 
                            fontSize: 12 
                          }}>
                            🔥 {insight.heat}
                          </span>
                        </div>
                      </div>
                      {/* Content */}
                      <div style={{ padding: 16 }}>
                        <h3 style={{ fontSize: 16, marginBottom: 8, lineHeight: 1.4 }}>{insight.title}</h3>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>
                          <span>{formatDate(insight.createdAt)}</span>
                          {parsed.tags && parsed.tags[0] && (
                            <span style={{ color: "var(--accent)" }}>#{parsed.tags[0]}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {userLeagues.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                  {isOwnProfile ? t("你还没有创建任何联赛", "You haven't created any leagues") : t("该用户还没有联赛", "This user has no leagues")}
                </p>
                {isOwnProfile && (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <Link href="/league/new" className="btn btn-primary">{t("创建联赛", "Create League")}</Link>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {userLeagues.map(league => (
                  <Link 
                    key={league.id} 
                    href={`/league/${league.slug}`} 
                    style={{ 
                      background: "var(--bg-card)", 
                      border: "1px solid var(--border-color)", 
                      borderRadius: 12, 
                      padding: 20,
                      textDecoration: "none",
                      color: "inherit",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <h3 style={{ marginBottom: 4 }}>{league.name}</h3>
                      <div style={{ display: "flex", gap: 12, color: "var(--text-muted)", fontSize: 14 }}>
                        <span>{league.visibility === "public" ? t("公开", "Public") : t("私人", "Private")}</span>
                        <span>{formatDate(league.createdAt)}</span>
                      </div>
                    </div>
                    <span style={{ color: "var(--accent)" }}>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
