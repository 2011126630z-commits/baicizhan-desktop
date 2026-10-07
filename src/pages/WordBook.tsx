import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Rows3, Star, Upload } from "lucide-react";
import { api } from "../services/storage/db";
import { StudyService } from "../services/study/StudyService";
import { EmptyState } from "../components/ui";
import { fmtDateCN, relativeTime } from "../utils/time";
import { toast } from "../stores/toast";
import type { WordWithProgress } from "../types/models";
import { playWordAudio } from "../services/audio/AudioService";

type Filter = "all" | "learned" | "unmastered" | "favorite" | "wrong" | "new";
type SortKey = "word" | "stage" | "wrong" | "lastSeen";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "learned", label: "已学" },
  { key: "unmastered", label: "未掌握" },
  { key: "new", label: "未学" },
  { key: "favorite", label: "收藏" },
  { key: "wrong", label: "高频错误" },
];

export function WordBookPage() {
  const [bookId, setBookId] = useState<string>("");
  const [bookName, setBookName] = useState("");
  const [books, setBooks] = useState<{ id: string; name: string; total: number }[]>([]);
  const [words, setWords] = useState<WordWithProgress[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("word");
  const [view, setView] = useState<"table" | "card">("table");
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (bid?: string) => {
    setLoading(true);
    try {
      const bookList = await api.bookList();
      setBooks(bookList.map((b) => ({ id: b.id, name: b.name, total: b.total })));
      const active = bookList.find((b) => b.active === 1);
      const target = bid ?? active?.id ?? bookList[0]?.id ?? "";
      setBookId(target);
      const b = bookList.find((x) => x.id === target);
      setBookName(b?.name ?? "");
      setWords(await api.wordList(target || undefined));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    let list = words;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((w) => w.word.toLowerCase().includes(s) || w.meanings.some((m) => m.includes(s)));
    }
    list = list.filter((w) => {
      switch (filter) {
        case "learned":
          return w.status !== "new";
        case "unmastered":
          return w.status === "learning";
        case "new":
          return w.status === "new";
        case "favorite":
          return w.favorite;
        case "wrong":
          return w.wrongCount > 0;
        default:
          return true;
      }
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "stage":
          return b.stage - a.stage;
        case "wrong":
          return b.wrongCount - a.wrongCount;
        case "lastSeen":
          return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
        default:
          return a.word.localeCompare(b.word);
      }
    });
    return sorted;
  }, [words, q, filter, sort]);

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const n = await StudyService.importCsvAsBook(file.name, text);
      toast.success(`导入成功：${n} 个单词`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败");
    }
  };

  const toggleFav = async (w: WordWithProgress) => {
    try {
      await api.favoriteToggle(w.id, w.bookId);
      setWords((ws) => ws.map((x) => (x.id === w.id ? { ...x, favorite: !x.favorite } : x)));
    } catch {
      toast.error("收藏失败");
    }
  };

  return (
    <div>
      <div className="page-title">单词书</div>
      <div className="page-sub">
        {bookName || "暂无词书"} · 共 {words.length} 词（词书与释义保存在本地数据库）
      </div>

      <div className="toolbar">
        <select
          className="input"
          value={bookId}
          onChange={(e) => void load(e.target.value)}
          style={{ width: 200 }}
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}（{b.total}）
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="搜索单词或释义…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 200 }}
        />
        <div className="radio-group">
          {FILTERS.map((f) => (
            <button key={f.key} className={`radio-pill ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="word">按字母</option>
          <option value="stage">按熟练度</option>
          <option value="wrong">按错误次数</option>
          <option value="lastSeen">按最后学习</option>
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setView(view === "table" ? "card" : "table")}>
          {view === "table" ? <Rows3 size={15} /> : <LayoutGrid size={15} />}
          {view === "table" ? "表格" : "卡片"}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={14} />
          导入 CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = "";
          }}
        />
      </div>

      {loading ? (
        <EmptyState icon="⏳" text="加载中…" />
      ) : shown.length === 0 ? (
        <EmptyState icon="📚" text="没有符合条件的单词">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            导入 CSV 词书（word,phonetic,pos,释义,例句,例句翻译）
          </button>
        </EmptyState>
      ) : view === "table" ? (
        <div className="card" style={{ padding: "6px 12px" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>单词</th>
                <th>音标</th>
                <th>释义</th>
                <th>状态</th>
                <th>错误</th>
                <th>最后学习</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.id}>
                  <td>
                    <button className="icon-btn" style={{ color: w.favorite ? "var(--star)" : undefined }} onClick={() => void toggleFav(w)}>
                      <Star size={15} fill={w.favorite ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="word-cell">{w.word}</td>
                  <td className="muted">{w.phonetic ?? "—"}</td>
                  <td className="muted" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.meanings.join("；")}
                  </td>
                  <td>
                    <span className={`tag ${w.status === "mastered" ? "tag-green" : w.status === "learning" ? "tag-blue" : "tag-gray"}`}>
                      {w.status === "mastered" ? "已掌握" : w.status === "learning" ? "学习中" : "未学"}
                    </span>
                  </td>
                  <td className="muted">{w.wrongCount}</td>
                  <td className="muted">{w.lastSeen ? fmtDateCN(new Date(w.lastSeen * 1000).toISOString().slice(0, 10)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="word-grid">
          {shown.map((w) => (
            <div key={w.id} className="w-card" onClick={() => void playWordAudio(w)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 16 }}>{w.word}</b>
                <button
                  className="icon-btn"
                  style={{ color: w.favorite ? "var(--star)" : undefined }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleFav(w);
                  }}
                >
                  <Star size={15} fill={w.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="muted" style={{ color: "var(--text-3)", fontSize: 12 }}>{w.phonetic ?? ""} {w.pos ?? ""}</div>
              <div style={{ fontSize: 13, margin: "6px 0" }}>{w.meanings.join("；")}</div>
              <div style={{ color: "var(--text-3)", fontSize: 11.5 }}>
                {w.status === "mastered" ? "已掌握" : w.status === "learning" ? "学习中" : "未学"}
                {w.lastSeen ? ` · ${relativeTime(w.lastSeen)}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
