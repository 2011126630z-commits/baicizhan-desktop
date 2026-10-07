import { api } from "../services/storage/db";
import type {
  DailyProgress,
  FetchResult,
  ProfileData,
  StudyDataProvider,
  TodayPlan,
} from "./types";
import { UNSUPPORTED_WRITE_NOTE } from "./types";
import type { BookSummary } from "./types";
import type { StudyRecord, WordWithProgress } from "../types/models";

/** 本地数据源：一切以本地 SQLite 为准，永远可用（离线兜底） */
export class LocalAdapter implements StudyDataProvider {
  readonly name = "local";

  async fetchProfile(): Promise<FetchResult<ProfileData>> {
    return { status: "local", data: { nickname: undefined } };
  }

  async fetchCurrentBook(): Promise<FetchResult<BookSummary>> {
    const books = await api.bookList();
    const active = books.find((b) => b.active === 1);
    if (!active) return { status: "local", note: "暂无词书" };
    return {
      status: "local",
      data: { id: active.id, name: active.name, total: active.total, source: active.source },
    };
  }

  async fetchTodayPlan(): Promise<FetchResult<TodayPlan>> {
    const due = await api.reviewDue(999);
    return { status: "local", data: { newCount: 0, reviewCount: due.length } };
  }

  async fetchDailyProgress(): Promise<FetchResult<DailyProgress>> {
    const s = await api.statsToday();
    return { status: "local", data: { learned: s.learned, reviewed: s.reviewed } };
  }

  async fetchReviewWords(): Promise<FetchResult<WordWithProgress[]>> {
    const words = await api.reviewDue(100);
    return { status: "local", data: words };
  }

  async searchWord(q: string): Promise<FetchResult<WordWithProgress[]>> {
    const words = await api.wordSearch(q);
    return { status: "local", data: words };
  }

  async pushStudyRecords(records: StudyRecord[]): Promise<FetchResult<null>> {
    return { status: "local", note: UNSUPPORTED_WRITE_NOTE };
  }

  async pushFavorites(items: { wordId: string; favorite: boolean }[]): Promise<FetchResult<null>> {
    return { status: "local", note: UNSUPPORTED_WRITE_NOTE };
  }
}

export const localAdapter = new LocalAdapter();
