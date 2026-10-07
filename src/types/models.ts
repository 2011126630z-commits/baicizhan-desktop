export type SyncStatus = "synced" | "local" | "pending" | "failed" | "unsupported";
export type SessionState = "logged_out" | "logged_in" | "expired" | "checking";
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
  source: string; // local | official
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
