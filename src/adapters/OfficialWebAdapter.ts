import { api } from "../services/storage/db";
import type { CapabilityReport, SessionState } from "../types/models";
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
 *   绝不伪造“同步成功”；
 * - 门控基于真实登录状态机（SessionProbe 验证结果），不再默认“已登录”。
 */
export class OfficialWebAdapter implements StudyDataProvider {
  readonly name = "official-web";

  constructor(
    private getCapabilities: () => CapabilityReport | null,
    private getSessionState: () => SessionState,
  ) {}

  /** 探测官方站点可达性（仅普通 GET；不用于判定登录状态） */
  async probeReachable(): Promise<{ ok: boolean; offline: boolean; note?: string }> {
    try {
      const r = await api.httpRequest("GET", OFFICIAL_HOME);
      return { ok: r.ok, offline: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const offline = /网络|超时|connect|离线/i.test(msg);
      return { ok: false, offline, note: msg };
    }
  }

  /** 会话门控：只有验证通过的登录会话才允许访问官方数据能力 */
  private gate(key: keyof CapabilityReport["items"]): FetchResult<never> | null {
    const session = this.getSessionState();
    if (session === "logged_out" || session === "expired" || session === "verification_failed") {
      return { status: "unsupported", note: "未登录（或会话未验证通过），官方数据不可用" };
    }
    if (session === "captured" || session === "verifying") {
      return { status: "pending", note: "会话已捕获但身份未验证，暂不请求官方数据" };
    }
    if (session === "offline") {
      return { status: "failed", note: "当前离线，无法访问官方数据" };
    }
    const caps = this.getCapabilities();
    if (!caps) {
      return { status: "pending", note: "尚未完成能力检测" };
    }
    const item = caps.items[key];
    if (item.status === "available") return null; // 放行
    return {
      status:
        item.status === "failed" ? "failed" : item.status === "unverified" ? "pending" : "unsupported",
      note: item.note,
    };
  }

  async fetchProfile(): Promise<FetchResult<ProfileData>> {
    const g = this.gate("userProfile");
    if (g) return g;
    return { status: "unsupported", note: "官方渠道暂无公开可用的用户资料接口" };
  }

  async fetchCurrentBook(): Promise<FetchResult<BookSummary>> {
    const g = this.gate("currentBook");
    if (g) return g;
    return { status: "unsupported", note: "官方渠道暂无公开可用的词书接口" };
  }

  async fetchTodayPlan(): Promise<FetchResult<TodayPlan>> {
    const g = this.gate("studyPlan");
    if (g) return g;
    return { status: "unsupported", note: "官方渠道暂无公开可用的学习计划接口" };
  }

  async fetchDailyProgress(): Promise<FetchResult<DailyProgress>> {
    const g = this.gate("dailyProgress");
    if (g) return g;
    return { status: "unsupported", note: "官方渠道暂无公开可用的进度接口" };
  }

  async fetchReviewWords(): Promise<FetchResult<WordWithProgress[]>> {
    const g = this.gate("reviewList");
    if (g) return g;
    return { status: "unsupported", note: "官方渠道暂无公开可用的复习列表接口" };
  }

  async searchWord(_q: string): Promise<FetchResult<WordWithProgress[]>> {
    const g = this.gate("wordContent");
    if (g) return g;
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
