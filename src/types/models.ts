export type SyncStatus = "synced" | "local" | "pending" | "failed" | "unsupported";

/**
 * 登录状态机（0.2.0）：
 * - logged_out：未登录（无会话）
 * - captured：已捕获官方 Cookie，但身份尚未验证
 * - verifying：正在验证会话
 * - logged_in：会话经官方页面验证通过
 * - expired：曾经验证通过，现在会话已失效
 * - offline：网络原因暂时无法验证（不等于失效）
 * - verification_failed：无法证明当前会话属于已登录账号
 */
export type SessionState =
  | "logged_out"
  | "captured"
  | "verifying"
  | "logged_in"
  | "expired"
  | "offline"
  | "verification_failed";

/** SessionProbe 的判定结果（来自 Rust 端真实探测） */
export interface SessionProbeResult {
  verdict: "verified" | "not_logged_in" | "unverified" | "offline" | "failed";
  httpStatus?: number | null;
  finalHost?: string | null;
  redirectedToLogin: boolean;
  loggedInMarkers: string[];
  loggedOutMarkers: string[];
  note: string;
  checkedAt: number;
}

/** 数据来源标记：官方 / 本地生成 / 用户导入 */
export type DataSourceKind = "official" | "local" | "imported";

export interface LocalDataSummary {
  records: number;
  pendingOps: number;
  unsupportedOps: number;
  failedOps: number;
  words: number;
  favorites: number;
}

export type WordStatus = "new" | "learning" | "mastered";
export type AnswerResult = "known" | "fuzzy" | "unknown";
export type StudyMode = "learn" | "review";

export interface Example {
  en: string;
  zh: string;
}

export interface Word {
  id: string;
  bookId: string;
  word: string;
  phonetic?: string | null;
  pos?: string | null;
  meanings: string[];
  examples: Example[];
  audioUrl?: string | null;
  source: string;
}

export interface WordWithProgress extends Word {
  status: WordStatus;
  stage: number;
  wrongCount: number;
  favorite: boolean;
  lastSeen?: number | null;
}

export interface Book {
  id: string;
  name: string;
  source: DataSourceKind | string; // official | local | imported
  total: number;
  active: number;
  syncedAt?: number | null;
}

export interface StudyRecord {
  id: string;
  wordId: string;
  word: string;
  bookId: string;
  ts: number;
  result: AnswerResult;
  mode: StudyMode;
  synced: boolean;
}

export interface DailyStat {
  date: string;
  learned: number;
  reviewed: number;
  minutes: number;
}

export interface Operation {
  id: string;
  opType: string;
  payload: string;
  status: "pending" | "synced" | "failed" | "unsupported";
  tries: number;
  note?: string | null;
  createdAt: number;
}

export type CapabilityKey =
  | "userProfile"
  | "currentBook"
  | "studyPlan"
  | "dailyProgress"
  | "wordContent"
  | "reviewList"
  | "studyWriteback"
  | "favorites"
  | "audio";

export interface CapabilityItem {
  status: "available" | "unavailable" | "unverified" | "failed";
  note?: string;
}

export interface CapabilityReport {
  checkedAt: number;
  loginChannel: "available";
  items: Record<CapabilityKey, CapabilityItem>;
}

export type DomainKey =
  | "session"
  | "profile"
  | "currentBook"
  | "studyPlan"
  | "dailyProgress"
  | "learnedWords"
  | "reviewWords"
  | "favorites"
  | "studyHistory"
  | "writeback";

export interface DomainState {
  status: SyncStatus | "idle";
  note?: string;
  at?: number;
}

export interface HttpResult {
  status: number;
  ok: boolean;
  body: string;
  finalUrl: string;
}

export interface CookieData {
  name: string;
  value: string;
  domain?: string | null;
  path?: string | null;
}
