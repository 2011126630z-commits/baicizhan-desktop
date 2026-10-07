import { create } from "zustand";
import type { CapabilityReport, DomainKey, DomainState } from "../types/models";

export type OverallSyncState = "idle" | "syncing" | "ok" | "offline" | "error" | "local";

interface SyncState {
  running: boolean;
  online: boolean;
  overall: OverallSyncState;
  lastSyncAt: number | null;
  lastAttemptAt: number | null;
  domains: Record<DomainKey, DomainState>;
  capabilities: CapabilityReport | null;
  /** 启动初始化（设置/种子数据/会话）是否完成——页面据此决定何时从本地库读数据 */
  bootstrapped: boolean;
  setBootstrapped: (v: boolean) => void;
  setRunning: (v: boolean) => void;
  setOnline: (v: boolean) => void;
  setOverall: (v: OverallSyncState) => void;
  setLastSyncAt: (ts: number | null) => void;
  setLastAttemptAt: (ts: number) => void;
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
  lastSyncAt: null,
  lastAttemptAt: null,
  domains: emptyDomains(),
  capabilities: null,
  bootstrapped: false,
  setBootstrapped: (v) => set({ bootstrapped: v }),
  setRunning: (v) => set({ running: v }),
  setOnline: (v) => set({ online: v }),
  setOverall: (v) => set({ overall: v }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),  setLastAttemptAt: (ts) => set({ lastAttemptAt: ts }),
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
