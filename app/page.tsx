"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { listInsights, listLeagues, Insight, League } from "@/lib/store";

type ParsedInsight = Insight & {
  coverImage?: string;
  images?: string[];
  tags?: string[];
  content?: string;
};

// 热门标签
const TRENDING_TAGS = [
  { tag: "选秀策略", emoji: "🎯" },
  { tag: "球员分析", emoji: "📊" },
  { tag: "交易建议", emoji: "🔄" },
  { tag: "新手指南", emoji: "📚" },
  { tag: "Punt策略", emoji: "🎲" },
  { tag: "伤病更新", emoji: "🏥" },
  { tag: "每周推荐", emoji: "⭐" },
];

// 示例数据（当没有真实数据时显示）
const SAMPLE_POSTS: ParsedInsight[] = [
  {
    id: "sample-1",
    title: "2024-25 赛季首轮选秀策略深度分析",
    body: "",
    content: "详解如何在首轮做出最佳选择，避开常见陷阱...",
    author: "@Blueprint",
    createdAt: Date.now() - 86400000,
    heat: 328,
    coverImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=300&fit=crop",
    tags: ["选秀策略", "新手指南"],
  },
  {
    id: "sample-2",
    title: "Punt 助攻策略：如何构建顶级篮板阵容",
    body: "",
    content: "放弃助攻类别后，你可以专注于篮板和防守...",
    author: "@FantasyPro",
    createdAt: Date.now() - 172800000,
    heat: 256,
    coverImage: "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=400&h=500&fit=crop",
    tags: ["Punt策略", "球员分析"],
  },
  {
    id: "sample-3",
    title: "本周值得关注的 5 位潜力股",
    body: "",
    content: "这些球员可能在接下来几周大幅提升价值...",
    author: "@FantasyGuru",
    createdAt: Date.now() - 259200000,
    heat: 189,
    coverImage: "https://images.unsplash.com/photo-1504450758481-7338bbe75c8e?w=400&h=350&fit=crop",
    tags: ["每周推荐", "球员分析"],
  },
  {
    id: "sample-4",
    title: "新手必读：9-Cat 联赛入门完全指南",
    body: "",
    content: "从零开始了解 Fantasy 篮球的所有基础知识...",
    author: "@Rookie101",
    createdAt: Date.now() - 345600000,
    heat: 412,
    coverImage: "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=400&h=280&fit=crop",
    tags: ["新手指南"],
  },
  {
    id: "sample-5",
    title: "交易窗口期：哪些球员应该趁高卖出？",
    body: "",
    content: "分析当前市场，找出被高估的球员...",
    author: "@TradeKing",
    createdAt: Date.now() - 432000000,
    heat: 167,
    coverImage: "https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?w=400&h=450&fit=crop",
    tags: ["交易建议"],
  },
  {
    id: "sample-6",
    title: "伤病警报：关键球员复出时间表更新",
    body: "",
    content: "追踪重要球员的伤病恢复进度...",
    author: "@InjuryReport",
    createdAt: Date.now() - 518400000,
    heat: 234,
    coverImage: "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=400&h=320&fit=crop",
    tags: ["伤病更新"],
  },
];

export default function HomePage() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<"insights" | "leagues">("insights");
  const [insights, setInsights] = useState<ParsedInsight[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 加载帖子
    const rawInsights = listInsights();
    const parsed = rawInsights.map((item): ParsedInsight => {
      let coverImage: string | undefined;
      let images: string[] | undefined;
      let tags: string[] | undefined;
      let content = item.body;

      try {
        const parsedBody = JSON.parse(item.body);
        if (parsedBody.content) {
          content = parsedBody.content;
          coverImage = parsedBody.metadata?.coverImage;
          images = parsedBody.metadata?.images;
          tags = parsedBody.metadata?.tags;
        }
      } catch {}

      return { ...item, coverImage, images, tags, content };
    });

    // 如果没有真实帖子，使用示例数据
    const finalInsights = parsed.length > 0 ? parsed : SAMPLE_POSTS;
    setInsights(finalInsights.sort((a, b) => b.createdAt - a.createdAt));

    // 加载联赛
    setLeagues(listLeagues());
    setIsLoading(false);
  }, []);

  const filteredInsights = selectedTag 
    ? insights.filter(i => i.tags?.includes(selectedTag))
    : insights;

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return t("刚刚", "Just now");
    if (hours < 24) return `${hours}${t("小时前", "h ago")}`;
    if (days < 7) return `${days}${t("天前", "d ago")}`;
    return new Date(timestamp).toLocaleDateString();
  };

  // 为瀑布流分配列
  const getColumns = () => {
    const left: ParsedInsight[] = [];
    const right: ParsedInsight[] = [];
    filteredInsights.forEach((item, index) => {
      if (index % 2 === 0) left.push(item);
      else right.push(item);
    });
    return { left, right };
  };

  const { left, right } = getColumns();

  const renderCard = (item: ParsedInsight, index: number) => {
    const hasImage = item.coverImage || (item.images && item.images.length > 0);
    const displayImage = item.coverImage || item.images?.[0];
    const isSample = item.id.startsWith("sample-");
    
    return (
      <Link 
        href={isSample ? "#" : `/insights/${item.id}`} 
        key={item.id} 
        className="feed-card"
        style={{ animationDelay: `${index * 0.05}s` }}
      >
        {hasImage && (
          <div className="card-image">
            <img src={displayImage} alt={item.title} loading="lazy" />
            <div className="image-overlay" />
          </div>
        )}
        <div className="card-content">
          <h3 className="card-title">{item.title}</h3>
          {item.content && (
            <p className="card-excerpt">
              {item.content.slice(0, 60)}{item.content.length > 60 ? "..." : ""}
            </p>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="card-tags">
              {item.tags.slice(0, 2).map(tag => (
                <span key={tag} className="card-tag">#{tag}</span>
              ))}
            </div>
          )}
          <div className="card-footer">
            <div className="card-author">
              <div className="author-avatar">{item.author[1]?.toUpperCase() || "?"}</div>
              <span className="author-name">{item.author}</span>
            </div>
            <div className="card-stats">
              <span className="stat-item">❤️ {item.heat}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="app">
      <Header />

      <main className="home-page">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              {t("发现最佳", "Discover the Best")}
              <br />
              <span className="hero-highlight">{t("Fantasy 篮球策略", "Fantasy Basketball Strategies")}</span>
            </h1>
            <p className="hero-desc">
              {t("与数千玩家一起分享洞见、交流策略、赢得冠军", "Join thousands of players sharing insights, strategies, and winning championships")}
            </p>
            <div className="hero-actions">
              <Link href="/insights/new" className="btn btn-primary btn-lg">
                ✍️ {t("分享洞见", "Share Insight")}
              </Link>
              <Link href="/league/new" className="btn btn-ghost btn-lg">
                �� {t("创建联赛", "Create League")}
              </Link>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="stat-number">{insights.length > 0 ? insights.length : "1.2K"}</span>
              <span className="stat-label">{t("篇洞见", "Insights")}</span>
            </div>
            <div className="hero-stat">
              <span className="stat-number">{leagues.length > 0 ? leagues.length : "380"}</span>
              <span className="stat-label">{t("个联赛", "Leagues")}</span>
            </div>
            <div className="hero-stat">
              <span className="stat-number">5.8K</span>
              <span className="stat-label">{t("位玩家", "Players")}</span>
            </div>
          </div>
        </section>

        {/* Trending Tags */}
        <section className="tags-section">
          <div className="tags-header">
            <h2 className="tags-title">🔥 {t("热门话题", "Trending Topics")}</h2>
          </div>
          <div className="tags-scroll">
            <button 
              className={`tag-pill ${selectedTag === null ? "active" : ""}`}
              onClick={() => setSelectedTag(null)}
            >
              {t("全部", "All")}
            </button>
            {TRENDING_TAGS.map(({ tag, emoji }) => (
              <button 
                key={tag}
                className={`tag-pill ${selectedTag === tag ? "active" : ""}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                {emoji} {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === "insights" ? "active" : ""}`}
            onClick={() => setActiveTab("insights")}
          >
            �� {t("洞见", "Insights")}
          </button>
          <button 
            className={`tab-btn ${activeTab === "leagues" ? "active" : ""}`}
            onClick={() => setActiveTab("leagues")}
          >
            🏆 {t("联赛", "Leagues")}
          </button>
        </div>

        {/* Content */}
        {activeTab === "insights" ? (
          <section className="feed-section">
            {filteredInsights.length === 0 ? (
              <div className="empty-feed">
                <div className="empty-icon">📝</div>
                <h3>{t("暂无相关内容", "No content found")}</h3>
                <p>{t("成为第一个分享洞见的人！", "Be the first to share an insight!")}</p>
                <Link href="/insights/new" className="btn btn-primary">
                  {t("发布洞见", "Share Insight")}
                </Link>
              </div>
            ) : (
              <div className="masonry-grid">
                <div className="masonry-column">
                  {left.map((item, index) => renderCard(item, index * 2))}
                </div>
                <div className="masonry-column">
                  {right.map((item, index) => renderCard(item, index * 2 + 1))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="leagues-section">
            {leagues.length === 0 ? (
              <div className="empty-feed">
                <div className="empty-icon">🏀</div>
                <h3>{t("暂无联赛", "No leagues yet")}</h3>
                <p>{t("创建你的第一个联赛！", "Create your first league!")}</p>
                <Link href="/league/new" className="btn btn-primary">
                  {t("创建联赛", "Create League")}
                </Link>
              </div>
            ) : (
              <div className="leagues-grid">
                {leagues.map(league => (
                  <Link href={`/league/${league.slug}`} key={league.id} className="league-card">
                    <div className="league-icon">🏀</div>
                    <div className="league-info">
                      <h3 className="league-name">{league.name}</h3>
                      <div className="league-meta">
                        <span className="league-badge">{league.visibility === "public" ? t("公开", "Public") : t("私人", "Private")}</span>
                        <span>{formatTime(league.createdAt)}</span>
                      </div>
                    </div>
                    <div className="league-arrow">→</div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <style jsx>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px 60px;
        }

        /* Hero Section */
        .hero-section {
          padding: 48px 0;
          text-align: center;
        }
        .hero-title {
          font-size: 36px;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 16px;
        }
        .hero-highlight {
          background: linear-gradient(135deg, #f59e0b, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-desc {
          font-size: 16px;
          color: var(--text-muted);
          max-width: 500px;
          margin: 0 auto 24px;
        }
        .hero-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn-lg {
          padding: 14px 28px;
          font-size: 16px;
        }
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 48px;
          margin-top: 48px;
          padding-top: 32px;
          border-top: 1px solid var(--border-color);
        }
        .hero-stat {
          text-align: center;
        }
        .stat-number {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: var(--accent);
        }
        .stat-label {
          font-size: 14px;
          color: var(--text-muted);
        }

        /* Tags Section */
        .tags-section {
          margin-bottom: 24px;
        }
        .tags-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .tags-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
        }
        .tags-scroll::-webkit-scrollbar {
          display: none;
        }
        .tag-pill {
          flex-shrink: 0;
          padding: 8px 16px;
          border-radius: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .tag-pill:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .tag-pill.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #000;
          font-weight: 600;
        }

        /* Tab Navigation */
        .tab-nav {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 12px;
        }
        .tab-btn {
          padding: 10px 20px;
          border-radius: 20px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          background: var(--accent);
          color: #000;
          font-weight: 600;
        }

        /* Masonry Grid */
        .masonry-grid {
          display: flex;
          gap: 16px;
        }
        .masonry-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Feed Card */
        .feed-card {
          display: block;
          background: var(--bg-card);
          border-radius: 16px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          border: 1px solid var(--border-color);
          transition: all 0.3s ease;
          animation: fadeInUp 0.5s ease forwards;
          opacity: 0;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .feed-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border-color: var(--accent);
        }
        .card-image {
          position: relative;
          width: 100%;
          overflow: hidden;
        }
        .card-image img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.3s ease;
        }
        .feed-card:hover .card-image img {
          transform: scale(1.05);
        }
        .image-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(transparent, rgba(0,0,0,0.3));
        }
        .card-content {
          padding: 16px;
        }
        .card-title {
          font-size: 15px;
          font-weight: 600;
          line-height: 1.4;
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-excerpt {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .card-tag {
          font-size: 12px;
          color: var(--accent);
          background: rgba(245, 158, 11, 0.1);
          padding: 2px 8px;
          border-radius: 10px;
        }
        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-author {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .author-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: #000;
        }
        .author-name {
          font-size: 12px;
          color: var(--text-muted);
        }
        .card-stats {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* Empty State */
        .empty-feed {
          text-align: center;
          padding: 80px 20px;
          background: var(--bg-card);
          border-radius: 16px;
          border: 1px solid var(--border-color);
        }
        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        .empty-feed h3 {
          font-size: 20px;
          margin-bottom: 8px;
        }
        .empty-feed p {
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        /* Leagues Grid */
        .leagues-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .league-card {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 20px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }
        .league-card:hover {
          border-color: var(--accent);
          transform: translateX(4px);
        }
        .league-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        .league-info {
          flex: 1;
        }
        .league-name {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .league-meta {
          display: flex;
          gap: 12px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .league-badge {
          color: var(--accent);
        }
        .league-arrow {
          font-size: 20px;
          color: var(--text-muted);
        }

        @media (max-width: 640px) {
          .hero-title {
            font-size: 28px;
          }
          .hero-stats {
            gap: 24px;
          }
          .stat-number {
            font-size: 24px;
          }
          .masonry-grid {
            gap: 12px;
          }
        }
      `}</style>
    </div>
  );
}
