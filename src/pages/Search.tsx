import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { api } from "../services/storage/db";
import { EmptyState } from "../components/ui";
import { playWordAudio } from "../services/audio/AudioService";
import { Volume2 } from "lucide-react";

export function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<null | Awaited<ReturnType<typeof api.wordSearch>>>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const s = q.trim();
    if (!s) {
      setResults(null);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await api.wordSearch(s, 30));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="page-title">搜索</div>
      <div className="page-sub">查询单词、音标、释义与例句（当前数据源：本地词库）</div>

      <div style={{ position: "relative", marginBottom: 18 }}>
        <SearchIcon
          size={16}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }}
        />
        <input
          className="input"
          autoFocus
          placeholder="输入英文单词…（Ctrl+K 随时打开搜索）"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: "100%", maxWidth: 560, paddingLeft: 34, fontSize: 14.5, padding: "10px 12px 10px 34px" }}
        />
      </div>

      {results === null ? (
        <EmptyState icon="🔍" text="输入单词开始查询" />
      ) : results.length === 0 ? (
        <EmptyState icon="🤷" text={`本地词库中没有「${q}」`}>
          <p style={{ fontSize: 12.5, color: "var(--text-3)" }}>当前数据源暂不支持在线查询，可在「单词书」页面导入更多词汇。</p>
        </EmptyState>
      ) : (
        <div>
          {results.map((w) => (
            <div key={w.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ fontSize: 18 }}>{w.word}</b>
                <span style={{ color: "var(--text-2)" }}>{w.phonetic ?? ""}</span>
                {w.pos && <span className="word-pos">{w.pos}</span>}
                <span style={{ flex: 1 }} />
                <button className="speaker-btn" onClick={() => void playWordAudio(w)}>
                  <Volume2 size={16} />
                </button>
              </div>
              <div style={{ margin: "6px 0", color: "var(--text)" }}>{w.meanings.join("；")}</div>
              {w.examples.map((ex, i) => (
                <div key={i} style={{ color: "var(--text-2)", fontSize: 13 }}>
                  {ex.en} — {ex.zh}
                </div>
              ))}
            </div>
          ))}
          {searching && <p style={{ color: "var(--text-3)", fontSize: 12 }}>搜索中…</p>}
        </div>
      )}
    </div>
  );
}
