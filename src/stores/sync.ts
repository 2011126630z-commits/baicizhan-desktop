import { create } from "zustand";
import type { CapabilityReport, DomainKey, DomainState, LocalDataSummary } from "../types/models";

/**
 * 三行式状态（0.2.0）：
 * 1) 本地数据：SQLite 已保存（永远真实）
 * 2) 百词斩账号：登录/验证状态（来自 SessionProbe）
 * 3) 官方学习同步：仅在官方渠道真正读写成功时才显示“已同步”，否则“暂不可用”
 */
export type OverallSyncState = "idle" | "checking" | "local" | "account_ok" | "synced" | "offline" | "error";

interface SyncState {
  running: boolean;
  online: boolean;
  overall: OverallSyncState;
  /** 本地数据摘要（学习记录条数、待同步数等） */
  localSummary: LocalDataSummary | null;
  /** 最近一次“官方数据真正同步成功”的时间（没有真实同步时保持 null，绝不显示假时间） */
  officialSyncAt: number | null;
  lastAttemptAt: number | null;
  domains: Record<DomainKey, DomainState>;
  capabilities: CapabilityReport | null;
  bootstrapped: boolean;
  setBootstrapped: (v: boolean) => void;
  setRunning: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  setOverall: (v: OverallSyncState) => void;
  setOfficialSyncAt: (ts: number | null) => void;
  setLastAttemptAt: (ts: number) => void;
  setLocalSummary: (s: LocalDataSummary | null) => void;
  setDomain: (key: DomainKey, st: DomainState) => void;
  setCapabilities: (r: CapabilityReport) => void;
  loadCapabilities: (raw: string | null) => void;
}

const emptyDomains = (): Record<DomainKey, DomainState> => {
  const keys: DomainKey[] = [
    "session",
    "profile",
    "currentBook",
    "studyPlan",
    "dailyProgress",
    "learnedWords",
    "reviewWords",
    "favorites",
    "studyHistory",
    "writeback",
  ];
  return Object.fromEntries(keys.map((k) => [k, { status: "idle" as const }])) as Record<
    DomainKey,
    DomainState
  >;
};

export const useSync = create<SyncState>((set) => ({
  running: false,
  online: true,
  overall: "idle",
  localSummary: null,
  officialSyncAt: null,
  lastAttemptAt: null,
  domains: emptyDomains(),
  capabilities: null,
  bootstrapped: false,
  setBootstrapped: (v) => set({ bootstrapped: v }),
  setRunning: (v) => set({ running: v }),
  setOnline: (v) => set({ online: v }),
  setOverall: (v) => set({ overall: v }),
  setOfficialSyncAt: (ts) => set({ officialSyncAt: ts }),
  setLastAttemptAt: (ts) => set({ lastAttemptAt: ts }),
  setLocalSummary: (s) => set({ localSummary: s }),
  setDomain: (key, st) => set((s) => ({ domains: { ...s.domains, [key]: { ...st, at: Date.now() } } })),
  setCapabilities: (r) => set({ capabilities: r }),
  loadCapabilities: (raw) => {
    if (!raw) return;
    try {
      set({ capabilities: JSON.parse(raw) });
    } catch {
      /* 忽略损坏数据 */
    }
  },
}));
