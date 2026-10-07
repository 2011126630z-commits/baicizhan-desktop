import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BookOpen, LogIn, Maximize2, Play, RefreshCw } from "lucide-react";
import { api } from "../services/storage/db";
import { useAuth } from "../stores/auth";
import { useSettings } from "../stores/settings";
import { useStudy } from "../stores/study";
import { useSync } from "../stores/sync";
import { AuthService } from "../services/auth/AuthService";
import { toast } from "../stores/toast";
import { EmptyState, ProgressRing } from "../components/ui";
import { fmtDateCN, fmtMinutes, greeting } from "../utils/time";
import type { Book, DailyStat } from "../types/models";
import { UNSUPPORTED_WRITE_NOTE } from "../adapters/types";

export function HomePage() {
  const navigate = useNavigate();
  const sessionState = useAuth((s) => s.sessionState);
  const bootstrapped = useSync((s) => s.bootstrapped);
  const nickname = useSettings((s) => s.map["account.nickname"] ?? "");
  const [today, setToday] = useState({ learned: 0, reviewed: 0, minutes: 0 });
  const [target, setTarget] = useState(20);
  const [streak, setStreak] = useState(0);
  const [book, setBook] = useState<Book | null>(null);
  const [learnedInBook, setLearnedInBook] = useState(0);
  const [recent, setRecent] = useState<DailyStat[]>([]);

  useEffect(() => {
    if (!bootstrapped) return;
    void (async () => {
      try {
        const s = await api.statsToday();
        setToday({ learned: s.learned, reviewed: s.reviewed, minutes: s.minutes });
        const t = parseInt(useSettings.getState().get("study.dailyNew", "20"), 10);
        setTarget(Number.isFinite(t) && t > 0 ? t : 20);
        setStreak(await api.streak());
        const books = await api.bookList();
        const active = books.find((b) => b.active === 1) ?? null;
        setBook(active);
        if (active) {
          const words = await api.wordList(active.id);
          setLearnedInBook(words.filter((w) => w.status !== "new").length);
        }
        setRecent((await api.statsDaily(7)).slice().reverse());
      } catch {
        /* 首页数据加载失败不阻塞 */
      }
    })();
  }, [bootstrapped]);

  const percent = target > 0 ? Math.min(1, today.learned / target) : 0;
  const remaining = Math.max(0, target - today.learned);
  const total = book?.total ?? 0;
  const leftWords = Math.max(0, total - learnedInBook);
  const daysLeft = leftWords > 0 && target > 0 ? Math.ceil(leftWords / target) : 0;
  const finishDate =
    daysLeft > 0
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + daysLeft);
          return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
        })()
      : "已完成";

  return (
    <div>
      <div className="page-title">
        {greeting()}
        {nickname ? `，${nickname}` : ""}
      </div>
      <div className="page-sub">
        {new Date().getMonth() + 1}月{new Date().getDate()}日 · 坚持就是胜利
      </div>

      {sessionState === "expired" && (
        <div className="banner warn">
          <span>登录状态已失效，请重新登录以恢复官方数据同步。</span>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => void AuthService.openOfficialLoginPage()}>
            重新登录
          </button>
        </div>
      )}

      {sessionState === "logged_out" && (
        <div className="banner info">
          <LogIn size={16} />
          <span>登录百词斩账号后可尝试同步官方学习数据；未登录也可以使用本地词书学习。</span>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => navigate("/settings?section=account")}>
            去登录
          </button>
        </div>
      )}

      <div className="card">
        <div className="home-hero">
          <ProgressRing percent={percent} size={132}>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{Math.round(percent * 100)}%</div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>今日完成率</div>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span className="chip">
                新词 <b>{today.learned}</b>/{target}
              </span>
              <span className="chip">
                复习 <b>{today.reviewed}</b>
              </span>
              <span className="chip">
                连续 <b>{streak}</b> 天
              </span>
              <span className="chip">
                时长 <b>{fmtMinutes(today.minutes)}</b>
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-lg" onClick={() => navigate("/study")}>
                <Play size={17} />
                {remaining > 0 ? `继续学习（还剩 ${remaining} 个新词）` : "开始复习"}
              </button>
              <button
                className="btn btn-lg"
                onClick={() => {
                  void api
                    .showMiniWindow()
                    .then(() => toast.info("小窗背词已打开"))
                    .catch((e) => toast.error(String(e.message ?? e)));
                }}
              >
                <Maximize2 size={15} />
                小窗背词
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={16} />
          当前词书
        </h3>
        {book ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <b style={{ fontSize: 15 }}>{book.name}</b>
              <span className={`tag ${book.source === "official" ? "tag-green" : "tag-gray"}`}>
                {book.source === "official" ? "官方同步" : "本地词书"}
              </span>
            </div>
            <div className="progress-line" style={{ marginBottom: 8 }}>
              <div style={{ width: total > 0 ? `${(learnedInBook / total) * 100}%` : "0%" }} />
            </div>
            <div style={{ color: "var(--text-2)", fontSize: 12.5 }}>
              已学 {learnedInBook} / {total} 词 · 预计完成：{finishDate}
            </div>
          </div>
        ) : (
          <EmptyState icon="📚" text="还没有词书" />
        )}
      </div>

      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={15} />
          最近 7 天
        </h3>
        {recent.length > 0 ? (
          <div>
            {recent.map((d) => (
              <div
                key={d.date}
                style={{ display: "flex", gap: 16, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
              >
                <span style={{ width: 64, color: "var(--text-2)" }}>{fmtDateCN(d.date)}</span>
                <span>
                  新学 <b>{d.learned}</b>
                </span>
                <span>
                  复习 <b>{d.reviewed}</b>
                </span>
                <span>
                  学习 <b>{fmtMinutes(d.minutes)}</b>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="📝" text="还没有学习记录，从今天开始吧" />
        )}
      </div>

      <p style={{ color: "var(--text-3)", fontSize: 11.5, marginTop: 14, textAlign: "center" }}>
        {UNSUPPORTED_WRITE_NOTE}
      </p>
    </div>
  );
}
