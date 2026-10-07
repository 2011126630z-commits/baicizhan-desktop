import type { StudyRecord, SyncStatus, WordWithProgress } from "../types/models";

export interface FetchResult<T> {
  /** synced=官方已同步 local=仅本地 pending=待同步 failed=失败(可重试) unsupported=官方渠道暂不支持 */
  status: SyncStatus;
  data?: T;
  note?: string;
}

export interface ProfileData {
  nickname?: string;
  avatar?: string;
}

export interface BookSummary {
  id: string;
  name: string;
  total: number;
  progress?: number;
  source: string;
}

export interface TodayPlan {
  newCount: number;
  reviewCount: number;
}

export interface DailyProgress {
  learned: number;
  reviewed: number;
}

/** 学习数据提供方统一接口：官方渠道变化时只换实现，不改 UI */
export interface StudyDataProvider {
  readonly name: string;
  fetchProfile(): Promise<FetchResult<ProfileData>>;
  fetchCurrentBook(): Promise<FetchResult<BookSummary>>;
  fetchTodayPlan(): Promise<FetchResult<TodayPlan>>;
  fetchDailyProgress(): Promise<FetchResult<DailyProgress>>;
  fetchReviewWords(): Promise<FetchResult<WordWithProgress[]>>;
  searchWord(q: string): Promise<FetchResult<WordWithProgress[]>>;
  /** 学习结果回写：官方渠道不支持时必须返回 unsupported，绝不伪造成功 */
  pushStudyRecords(records: StudyRecord[]): Promise<FetchResult<null>>;
  pushFavorites(items: { wordId: string; favorite: boolean }[]): Promise<FetchResult<null>>;
}

export const UNSUPPORTED_WRITE_NOTE = "当前官方渠道暂不支持学习结果回写，记录已保存在本地";
