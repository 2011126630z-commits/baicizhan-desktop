import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { useStudy } from "../stores/study";
import { hotkeysOf, useSettings } from "../stores/settings";
import { matchHotkey } from "../utils/hotkeys";
import { WordCard } from "../components/WordCard";
import { EmptyState, KeyCap } from "../components/ui";
import { playWordAudio } from "../services/audio/AudioService";
import { useUi } from "../stores/toast";
import { hkLabel } from "../utils/hotkeys";

/** 背单词核心页面：键盘优先（Space 发音 / 1 认识 / 2 模糊 / 3 不认识 / Enter 下一步） */
export function StudyPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const {
    queue,
    idx,
    revealed,
    lastResult,
    paused,
    loading,
    mode,
    target,
    learnedToday,
    loadLearn,
    loadReview,
    answer,
    next,
    prev,
    current,
    togglePause,
    beginSession,
    endSession,
  } = useStudy();
  const autoPlay = settings.map["study.autoPlay"] !== "false";
  const [pressing, setPressing] = useState<string | null>(null);
  const toggleFocus = useUi((s) => s.toggleFocus);

  useEffect(() => {
    const isReview = window.location.hash.includes("mode=review");
    void (isReview ? loadReview() : loadLearn());
    beginSession();
    return () => {
      void endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const word = current();
  const done = queue.length > 0 && idx >= queue.length;

  // 自动发音
  useEffect(() => {
    if (word && autoPlay && !paused) {
      void playWordAudio(word);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id]);

  const flashPress = useCallback((key: string) => {
    setPressing(key);
    window.setTimeout(() => setPressing((p) => (p === key ? null : p)), 150);
    window.dispatchEvent(new CustomEvent("wordcard-press", { detail: key }));
  }, []);

  // 键盘处理
  useEffect(() => {
    const hk = hotkeysOf(useSettings.getState());
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (matchHotkey(e, hk.pause)) {
        e.preventDefault();
        togglePause();
        return;
      }
      if (paused || !word) return;
      if (matchHotkey(e, hk.play)) {
        e.preventDefault();
        flashPress("play");
        void playWordAudio(word);
      } else if (matchHotkey(e, hk.known)) {
        e.preventDefault();
        if (!revealed) {
          flashPress("known");
          void answer("known");
        }
      } else if (matchHotkey(e, hk.fuzzy)) {
        e.preventDefault();
        if (!revealed) {
          flashPress("fuzzy");
          void answer("fuzzy");
        }
      } else if (matchHotkey(e, hk.unknown)) {
        e.preventDefault();
        if (!revealed) {
          flashPress("unknown");
          void answer("unknown");
        }
      } else if (matchHotkey(e, hk.confirm) || e.key === "ArrowRight") {
        e.preventDefault();
        if (revealed) {
          flashPress("confirm");
          next();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (matchHotkey(e, hk.favorite)) {
        e.preventDefault();
        flashPress("fav");
        window.dispatchEvent(new CustomEvent("wordcard-press", { detail: "fav" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [word, revealed, paused, answer, next, prev, togglePause, flashPress]);

  const hk = hotkeysOf(settings);

  if (loading) {
    return <EmptyState icon="⏳" text="正在加载学习任务…" />;
  }

  if (done || (!word && queue.length === 0 && idx === 0)) {
    return (
      <div>
        <EmptyState
          icon={done ? "🎉" : "🌱"}
          text={
            done
              ? mode === "review"
                ? "本轮复习完成！"
                : `今日新词任务完成（${learnedToday}/${target}）`
              : "今天没有待学习的新词"
          }
        >
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn" onClick={() => navigate("/review")}>
              <RotateCcw size={15} />
              去复习
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/")}>
              返回首页
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  if (!word) {
    return <EmptyState icon="🌱" text="暂无可学内容，请在「单词书」导入词书或检查今日计划" />;
  }

  const progress = queue.length > 0 ? (idx / queue.length) * 100 : 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span className={`tag ${mode === "review" ? "tag-blue" : "tag-green"}`}>
          {mode === "review" ? "复习" : "新学"}
        </span>
        <div className="progress-line" style={{ flex: 1 }}>
          <div style={{ width: `${progress}%` }} />
        </div>
        <span style={{ color: "var(--text-3)", fontSize: 12.5 }}>
          {Math.min(idx + 1, queue.length)} / {queue.length}
        </span>
        <button className="btn-ghost btn" onClick={toggleFocus} title="沉浸模式（F11）">
          沉浸
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <WordCard word={word} revealed={revealed} result={lastResult} />

        {paused && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "color-mix(in srgb, var(--bg) 78%, transparent)",
              backdropFilter: "blur(2px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600 }}>已暂停</div>
            <button className="btn btn-primary" onClick={togglePause}>
              <Play size={15} />
              继续学习（{hkLabel(hk.pause)}）
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "16px 0 8px" }}>
        {!revealed ? (
          <>
            <button
              className={`answer-btn known ${pressing === "known" ? "pressing" : ""}`}
              onClick={() => {
                flashPress("known");
                void answer("known");
              }}
            >
              认识 <KeyCap label={hkLabel(hk.known)} />
            </button>
            <button
              className={`answer-btn fuzzy ${pressing === "fuzzy" ? "pressing" : ""}`}
              onClick={() => {
                flashPress("fuzzy");
                void answer("fuzzy");
              }}
            >
              模糊 <KeyCap label={hkLabel(hk.fuzzy)} />
            </button>
            <button
              className={`answer-btn unknown ${pressing === "unknown" ? "pressing" : ""}`}
              onClick={() => {
                flashPress("unknown");
                void answer("unknown");
              }}
            >
              不认识 <KeyCap label={hkLabel(hk.unknown)} />
            </button>
          </>
        ) : (
          <button
            className={`answer-btn known ${pressing === "confirm" ? "pressing" : ""}`}
            onClick={() => {
              flashPress("confirm");
              next();
            }}
          >
            <ArrowLeft size={0} />
            继续 <KeyCap label={hkLabel(hk.confirm)} />
          </button>
        )}
      </div>

      <div className="hint-row">
        <span>
          <KeyCap label={hkLabel(hk.play)} /> 发音
        </span>
        <span>
          <KeyCap label={hkLabel(hk.favorite)} /> 收藏
        </span>
        <span>
          ← / → 切换
        </span>
        <span>
          <KeyCap label={hkLabel(hk.pause)} /> 暂停
        </span>
        <span>
          <KeyCap label="F11" /> 沉浸模式
        </span>
      </div>
    </div>
  );
}
