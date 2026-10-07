import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Pin, PinOff, Maximize2, X, Volume2 } from "lucide-react";
import { api } from "../services/storage/db";
import { playWordAudio } from "../services/audio/AudioService";
import { useSettings } from "../stores/settings";
import type { WordWithProgress } from "../types/models";

/** 小窗背词：置顶小窗中快速复习（本地复习队列） */
export function MiniPage() {
  const [queue, setQueue] = useState<WordWithProgress[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [done, setDone] = useState(0);
  const win = getCurrentWindow();
  const word = queue[idx] ?? null;

  useEffect(() => {
    void (async () => {
      setPinned(await win.isAlwaysOnTop());
      const q = await loadQueue();
      setQueue(q);
      if (q[0]) void playWordAudio(q[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 优先复习队列；没有待复习时回退到新词，保证小窗随时可用 */
  const loadQueue = async (): Promise<WordWithProgress[]> => {
    const due = await api.reviewDue(50);
    if (due.length > 0) return due;
    const books = await api.bookList();
    const active = books.find((b) => b.active === 1);
    if (!active) return [];
    const all = await api.wordList(active.id);
    return all.filter((w) => w.status === "new").slice(0, 20);
  };

  const submit = useCallback(
    async (result: "known" | "unknown") => {
      if (!word) return;
      if (!revealed) {
        try {
          await api.studySubmit({
            id: crypto.randomUUID(),
            wordId: word.id,
            word: word.word,
            bookId: word.bookId,
            ts: Math.floor(Date.now() / 1000),
            result,
            mode: word.status === "new" ? "learn" : "review",
            synced: false,
          });
        } catch {
          /* ignore */
        }
        setRevealed(true);
        setDone((d) => d + 1);
      } else {
        const nextIdx = idx + 1;
        if (nextIdx >= queue.length) {
          const q = await loadQueue();
          setQueue(q);
          setIdx(0);
          if (q[0]) void playWordAudio(q[0]);
        } else {
          setIdx(nextIdx);
          void playWordAudio(queue[nextIdx]);
        }
        setRevealed(false);
      }
    },
    [word, revealed, idx, queue],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === " ") {
        e.preventDefault();
        if (word) void playWordAudio(word);
      } else if (e.key === "1") {
        if (!revealed) void submit("known");
      } else if (e.key === "3") {
        if (!revealed) void submit("unknown");
      } else if (e.key === "Enter" && revealed) {
        void submit("known");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [word, revealed, submit]);

  const togglePin = async () => {
    const v = !pinned;
    setPinned(v);
    await win.setAlwaysOnTop(v);
    await api.setMiniAlwaysTop(v);
  };

  const closeMini = async () => {
    await win.close();
  };

  const backToMain = async () => {
    await api.showMainWindow();
    await win.close();
  };

  return (
    <div className="mini-root">
      <div className="mini-header" data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>
          小窗背词 · 已复习 {done}
        </span>
        <button className={`icon-btn ${pinned ? "active" : ""}`} title="置顶" onClick={() => void togglePin()}>
          {pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button className="icon-btn" title="返回完整模式" onClick={() => void backToMain()}>
          <Maximize2 size={14} />
        </button>
        <button className="icon-btn" title="关闭" onClick={() => void closeMini()}>
          <X size={14} />
        </button>
      </div>

      <div className="mini-body">
        {!word ? (
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>暂无待复习单词</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mini-word">{word.word}</span>
              <button className="icon-btn" onClick={() => void playWordAudio(word)}>
                <Volume2 size={15} />
              </button>
            </div>
            <div className="mini-meaning">
              {revealed ? word.meanings.join("；") : word.phonetic ?? ""}
            </div>
            <div className="mini-actions">
              {!revealed ? (
                <>
                  <button className="answer-btn known" onClick={() => void submit("known")}>
                    认识 <span className="kbd">1</span>
                  </button>
                  <button className="answer-btn unknown" onClick={() => void submit("unknown")}>
                    不认识 <span className="kbd">3</span>
                  </button>
                </>
              ) : (
                <button className="answer-btn known" onClick={() => void submit("known")}>
                  下一个 <span className="kbd">Enter</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
