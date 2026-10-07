import { create } from "zustand";
import { api } from "../services/storage/db";
import type { AnswerResult, StudyMode, WordWithProgress } from "../types/models";
import { dailyNewOf, useSettings } from "./settings";

interface StudyState {
  mode: StudyMode;
  queue: WordWithProgress[];
  idx: number;
  revealed: boolean;
  lastResult: AnswerResult | null;
  paused: boolean;
  loading: boolean;
  learnedToday: number;
  reviewedToday: number;
  target: number;
  sessionStart: number | null;
  loadLearn: () => Promise<void>;
  loadReview: (words?: WordWithProgress[]) => Promise<void>;
  answer: (result: AnswerResult) => Promise<void>;
  next: () => void;
  prev: () => void;
  current: () => WordWithProgress | null;
  togglePause: () => void;
  beginSession: () => void;
  endSession: () => Promise<void>;
}

let heartbeatTimer: number | null = null;
let lastBeatAt = 0;

// 心跳期间按真实时间差上报，且定时器挂在 window 上以抵抗 Vite HMR 重复注册
declare global {
  interface Window {
    __bczHeartbeatTimer?: number;
    __bczLastBeatAt?: number;
  }
}

function startHeartbeat() {
  if (window.__bczHeartbeatTimer) window.clearInterval(window.__bczHeartbeatTimer);
  window.__bczLastBeatAt = Date.now();
  window.__bczHeartbeatTimer = window.setInterval(() => {
    const last = window.__bczLastBeatAt ?? Date.now();
    const now = Date.now();
    const secs = Math.floor((now - last) / 1000);
    if (secs >= 30) {
      window.__bczLastBeatAt = now;
      void api.studyHeartbeat(Math.min(600, secs));
    }
  }, 60_000);
  heartbeatTimer = window.__bczHeartbeatTimer;
}

function stopHeartbeat() {
  const t = window.__bczHeartbeatTimer ?? heartbeatTimer;
  if (t !== null && t !== undefined) window.clearInterval(t);
  window.__bczHeartbeatTimer = undefined;
  heartbeatTimer = null;
  // 上报不足一分钟的尾数（按秒），避免丢时长
  const last = window.__bczLastBeatAt;
  if (last) {
    const secs = Math.floor((Date.now() - last) / 1000);
    if (secs >= 5) void api.studyHeartbeat(secs);
    window.__bczLastBeatAt = undefined;
  }
}

export const useStudy = create<StudyState>((set, get) => ({
  mode: "learn",
  queue: [],
  idx: 0,
  revealed: false,
  lastResult: null,
  paused: false,
  loading: false,
  learnedToday: 0,
  reviewedToday: 0,
  target: 20,
  sessionStart: null,

  loadLearn: async () => {
    set({ loading: true, mode: "learn", queue: [], idx: 0, revealed: false, lastResult: null });
    try {
      const settings = useSettings.getState();
      const target = dailyNewOf(settings);
      const books = await api.bookList();
      const active = books.find((b) => b.active === 1);
      if (!active) {
        set({ loading: false, target });
        return;
      }
      const all = await api.wordList(active.id);
      const fresh = all.filter((w) => w.status === "new").slice(0, target);
      const today = await api.statsToday();
      set({
        queue: fresh,
        loading: false,
        target,
        learnedToday: today.learned,
        reviewedToday: today.reviewed,
        idx: 0,
        revealed: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadReview: async (words) => {
    set({ loading: true, mode: "review", queue: [], idx: 0, revealed: false, lastResult: null });
    try {
      const list = words ?? (await api.reviewDue(100));
      const today = await api.statsToday();
      set({ queue: list, loading: false, reviewedToday: today.reviewed, learnedToday: today.learned });
    } catch {
      set({ loading: false });
    }
  },

  answer: async (result) => {
    const { queue, idx, revealed, mode } = get();
    const w = queue[idx];
    if (!w || revealed) return;
    const record = {
      id: crypto.randomUUID(),
      wordId: w.id,
      word: w.word,
      bookId: w.bookId,
      ts: Math.floor(Date.now() / 1000),
      result,
      mode,
      synced: false,
    };
    try {
      const out = await api.studySubmit(record);
      set({
        revealed: true,
        lastResult: result,
        learnedToday: mode === "learn" ? out.learnedToday : get().learnedToday,
        reviewedToday: mode === "review" ? out.reviewedToday : get().reviewedToday,
      });
    } catch {
      // 本地提交失败也进入展示态，避免卡死；数据仍在 UI 上
      set({ revealed: true, lastResult: result });
    }
  },

  next: () => {
    const { idx, queue, revealed } = get();
    if (!revealed) return;
    if (idx + 1 >= queue.length) {
      set({ revealed: false, lastResult: null, idx: queue.length }); // 结束
      return;
    }
    set({ idx: idx + 1, revealed: false, lastResult: null });
  },

  prev: () => {
    const { idx } = get();
    if (idx > 0) set({ idx: idx - 1, revealed: false, lastResult: null });
  },

  current: () => {
    const { queue, idx } = get();
    return queue[idx] ?? null;
  },

  togglePause: () => set((s) => ({ paused: !s.paused })),

  beginSession: () => {
    if (get().sessionStart !== null) return;
    set({ sessionStart: Date.now() });
    startHeartbeat();
  },

  endSession: async () => {
    stopHeartbeat();
    set({ sessionStart: null });
  },
}));
