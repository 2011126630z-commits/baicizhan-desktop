import { useEffect, useRef, useState } from "react";
import { Star, Volume2 } from "lucide-react";
import type { WordWithProgress } from "../types/models";
import { playWordAudio } from "../services/audio/AudioService";
import { api } from "../services/storage/db";
import { hkLabel } from "../utils/hotkeys";
import { hotkeysOf, useSettings } from "../stores/settings";

/** 单词展示大卡片：答题前只显示单词，答题后显示释义例句 */
export function WordCard({ word, revealed, result }: { word: WordWithProgress; revealed: boolean; result: string | null }) {
  const settings = useSettings();
  const showChinese = settings.map["study.showChinese"] !== "false";
  const showExample = settings.map["study.showExample"] !== "false";
  const [favorite, setFavorite] = useState(word.favorite);
  const [pressing, setPressing] = useState<string | null>(null);
  const wordRef = useRef(word);

  useEffect(() => {
    wordRef.current = word;
    setFavorite(word.favorite);
  }, [word]);

  const press = (key: string) => {
    setPressing(key);
    window.setTimeout(() => setPressing((p) => (p === key ? null : p)), 160);
  };

  // 键盘触发动画：监听自定义事件（Study 页在按键时派发）
  useEffect(() => {
    const h = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      press(key);
    };
    window.addEventListener("wordcard-press", h);
    return () => window.removeEventListener("wordcard-press", h);
  }, []);

  const toggleFav = async () => {
    try {
      const v = await api.favoriteToggle(wordRef.current.id, wordRef.current.bookId);
      setFavorite(v);
    } catch {
      /* ignore */
    }
  };

  const hotkeys = hotkeysOf(settings);

  return (
    <div className="word-stage">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="word-text">{word.word}</span>
        <button
          className={`speaker-btn ${pressing === "play" ? "pressing" : ""}`}
          title={`发音（${hkLabel(hotkeys.play)}）`}
          onClick={() => {
            press("play");
            void playWordAudio(word);
          }}
        >
          <Volume2 size={18} />
        </button>
        <button
          className={`icon-btn ${favorite ? "active" : ""}`}
          title={`收藏（${hkLabel(hotkeys.favorite)}）`}
          style={favorite ? { color: "var(--star)" } : undefined}
          onClick={() => {
            press("fav");
            void toggleFav();
          }}
        >
          <Star size={20} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      {(word.phonetic || word.pos) && (
        <div className="word-phonetic">
          {word.phonetic && <span>{word.phonetic}</span>}
          {word.pos && <span className="word-pos">{word.pos}</span>}
        </div>
      )}

      {revealed && showChinese && (
        <div className="word-meanings">
          {result === "unknown" && <span style={{ color: "var(--danger)", marginRight: 8 }}>没记住</span>}
          {result === "fuzzy" && <span style={{ color: "var(--warn)", marginRight: 8 }}>有点模糊</span>}
          {result === "known" && <span style={{ color: "var(--primary)", marginRight: 8 }}>认识</span>}
          {word.meanings.join("；")}
        </div>
      )}

      {revealed && showExample && word.examples.length > 0 && (
        <div className="word-examples">
          {word.examples.slice(0, 2).map((ex, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="en">{ex.en}</div>
              <div className="zh">{ex.zh}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
