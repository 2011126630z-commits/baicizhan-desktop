import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { api } from "../services/storage/db";
import { useStudy } from "../stores/study";
import { useSync } from "../stores/sync";
import { EmptyState } from "../components/ui";
import { fmtDateCN } from "../utils/time";
import type { WordWithProgress } from "../types/models";

type Filter = "all" | "hard" | "favorite" | "recentWrong";

const FILTERS: { key: Filter; label: string; note: string }[] = [
  { key: "all", label: "全部", note: "本地复习队列（SRS 到期）" },
  { key: "hard", label: "易错", note: "本地分类：未掌握的词" },
  { key: "favorite", label: "收藏", note: "本地收藏" },
  { key: "recentWrong", label: "近期错词", note: "本地分类：7 天内答错的词" },
];

export function ReviewPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [words, setWords] = useState<WordWithProgress[]>([]);
  const [recentWrongIds, setRecentWrongIds] = useState<Set<string>>(new Set());
  const [reviewedToday, setReviewedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const startReview = useStudy((s) => s.loadReview);
  const bootstrapped = useSync((s) => s.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) return;
    void (async () => {
      try {
        const due = await api.reviewDue(999);
        const books = await api.bookList();
        const active = books.find((b) => b.active === 1);
        const all = active ? await api.wordList(active.id) : [];
        const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
        const records = await api.recordRecent(500);
        const ids = new Set(records.filter((r) => r.result === "unknown" && r.ts >= weekAgo).map((r) => r.wordId));
        setRecentWrongIds(ids);
        // 展示用列表：全部=到期；易错=未掌握；收藏；近期错词
        const byFilter: Record<Filter, WordWithProgress[]> = {
          all: due,
          hard: all.filter((w) => w.status !== "new" && w.status !== "mastered"),
          favorite: all.filter((w) => w.favorite),
          recentWrong: all.filter((w) => ids.has(w.id)),
        };
        setWords(byFilter[filter === "all" ? "all" : filter]);
        const today = await api.statsToday();
        setReviewedToday(today.reviewed);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, bootstrapped]);

  const summary = useMemo(() => {
    const total = words.length;
    return { total, done: reviewedToday, remaining: Math.max(0, total) };
  }, [words, reviewedToday]);

  if (loading) return <EmptyState icon="⏳" text="加载中…" />;

  return (
    <div>
      <div className="page-title">复习</div>
      <div className="page-sub">复习队列为本地 SRS 算法生成（官方渠道暂不支持获取官方复习列表）</div>

      <div className="stat-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{summary.total}</div>
          <div className="lbl">当前筛选待复习</div>
        </div>
        <div className="stat-card">
          <div className="num">{summary.done}</div>
          <div className="lbl">今日已复习</div>
        </div>
        <div className="stat-card">
          <div className="num">{summary.remaining}</div>
          <div className="lbl">剩余</div>
        </div>
      </div>

      <div className="toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`radio-pill ${filter === f.key ? "active" : ""}`}
            title={f.note}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          disabled={words.length === 0}
          onClick={async () => {
            await startReview(words);
            navigate("/study?mode=review");
          }}
        >
          <Play size={15} />
          开始复习（{words.length}）
        </button>
      </div>

      <div className="card" style={{ padding: "6px 12px" }}>
        {words.length === 0 ? (
          <EmptyState icon="✅" text="该分类下没有需要复习的单词" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>单词</th>
                <th>音标</th>
                <th>释义</th>
                <th>状态</th>
                <th>错误次数</th>
                <th>最后学习</th>
              </tr>
            </thead>
            <tbody>
              {words.slice(0, 100).map((w) => (
                <tr key={w.id}>
                  <td className="word-cell">{w.word}</td>
                  <td className="muted">{w.phonetic ?? "—"}</td>
                  <td className="muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.meanings.join("；")}
                  </td>
                  <td>
                    <span className={`tag ${w.status === "mastered" ? "tag-green" : w.status === "learning" ? "tag-blue" : "tag-gray"}`}>
                      {w.status === "mastered" ? "已掌握" : w.status === "learning" ? "学习中" : "新词"}
                    </span>
                  </td>
                  <td className="muted">{w.wrongCount}</td>
                  <td className="muted">{w.lastSeen ? fmtDateCN(new Date(w.lastSeen * 1000).toISOString().slice(0, 10)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
