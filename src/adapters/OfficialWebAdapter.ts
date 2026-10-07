import { api } from "../services/storage/db";
import type { CapabilityReport } from "../types/models";
import type {
  BookSummary,
  DailyProgress,
  FetchResult,
  ProfileData,
  StudyDataProvider,
  TodayPlan,
} from "./types";
import { UNSUPPORTED_WRITE_NOTE } from "./types";
import type { StudyRecord, WordWithProgress } from "../types/models";

const OFFICIAL_HOME = "https://www.baicizhan.com/";

/**
 * 官方 Web 渠道适配器。
 *
 * 原则：
 * - 只使用官方网页正常登录产生的会话；
 * - 不破解签名、不绕过风控、不调用不可验证的私有接口；
 * - 官方渠道没有公开可用的数据能力时，一律诚实返回 unsupported，
 *   绝不伪造“同步成功”。
 */
export class OfficialWebAdapter implements StudyDataProvider {
  readonly name = "official-web";

  constructor(
    private getCapabilities: () => CapabilityReport | null,
    private hasSession: () => boolean,
  ) {}

  /** 探测官方站点会话是否有效（仅访问官方首页，普通 GET） */
  async probeSession(): Promise<{ ok: boolean; expired: boolean; offline: boolean; note?: string }> {
    if (!this.hasSession()) {
      return { ok: false, expired: false, offline: false, note: "未登录" };
    }
    try {
      const r = await api.httpRequest("GET", OFFICIAL_HOME);
      if (r.status === 401 || r.status === 403) {
        return { ok: false, expired: true, offline: false };
      }
      if (!r.ok) {
        return { ok: false, expired: false, offline: false, note: `官方站点返回 ${r.status}` };
      }
      return { ok: true, expired: false, offline: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const offline = /网络|超时|connect/i.test(msg);
      return { ok: false, expired: false, offline, note: msg };
    }
  }

  private gate(
    key: keyof CapabilityReport["items"],
  ): FetchResult<never> | null {
    const caps = this.getCapabilities();
    if (!this.hasSession()) {
      return { status: "unsupported", note: "未登录：登录后才能尝试获取官方数据" };
    }
    if (!caps) {
      return { status: "pending", note: "尚未完成能力检测" };
    }
    const item = caps.items[key];
    if (item.status === "available") return null; // 放行
    return {
      status: item.status === "failed" ? "failed" : item.status === "unverified" ? "pending" : "unsupported",
      note: item.note,
    };
  }

  async fetchProfile(): Promise<FetchResult<ProfileData>> {
    const g = this.gate("userProfile");
    if (g) return g;
    return { status: "pending", note: "官方渠道暂无可用接口" };
  }

  async fetchCurrentBook(): Promise<FetchResult<BookSummary>> {
    const g = this.gate("currentBook");
    if (g) return g;
    return { status: "pending", note: "官方渠道暂无可用接口" };
  }

  async fetchTodayPlan(): Promise<FetchResult<TodayPlan>> {
    const g = this.gate("studyPlan");
    if (g) return g;
    return { status: "pending", note: "官方渠道暂无可用接口" };
  }

  async fetchDailyProgress(): Promise<FetchResult<DailyProgress>> {
    const g = this.gate("dailyProgress");
    if (g) return g;
    return { status: "pending", note: "官方渠道暂无可用接口" };
  }

  async fetchReviewWords(): Promise<FetchResult<WordWithProgress[]>> {
    const g = this.gate("reviewList");
    if (g) return g;
    return { status: "pending", note: "官方渠道暂无可用接口" };
  }

  async searchWord(_q: string): Promise<FetchResult<WordWithProgress[]>> {
    const caps = this.getCapabilities();
    if (!caps || caps.items.wordContent.status !== "available") {
      return {
        status: "unsupported",
        note: "当前数据源暂不支持在线查询，可使用本地词库搜索",
      };
    }
    return { status: "unsupported", note: "当前数据源暂不支持在线查询" };
  }

  async pushStudyRecords(_records: StudyRecord[]): Promise<FetchResult<null>> {
    const g = this.gate("studyWriteback");
    if (g) return { ...g, data: null };
    return { status: "unsupported", note: UNSUPPORTED_WRITE_NOTE };
  }

  async pushFavorites(_items: { wordId: string; favorite: boolean }[]): Promise<FetchResult<null>> {
    const g = this.gate("favorites");
    if (g) return { ...g, data: null };
    return { status: "unsupported", note: "当前官方渠道暂不支持收藏回写（本地已保存）" };
  }
}
