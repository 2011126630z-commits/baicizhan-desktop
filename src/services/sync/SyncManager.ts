import { api } from "../storage/db";
import { useAuth } from "../../stores/auth";
import { useSettings } from "../../stores/settings";
import { useSync, type OverallSyncState } from "../../stores/sync";
import { toast } from "../../stores/toast";
import type { DomainKey, Operation, StudyRecord } from "../../types/models";
import { OfficialWebAdapter } from "../../adapters/OfficialWebAdapter";
import { localAdapter } from "../../adapters/LocalAdapter";
import { detectCapabilities, shouldRunDetection } from "./CapabilityDetector";

/**
 * SyncManager（0.2.0）：
 * - 会话状态一律来自真实 SessionProbe（绝不凭 Cookie 数量或 HTTP 200 判定登录）；
 * - 操作队列按类型（study_record / favorite）分批处理，各自独立标记状态；
 * - 只有官方渠道真正读写成功才更新时间戳并显示“已同步”，否则如实显示“暂不可用”；
 * - 本地数据始终实时保存，与官方状态严格分开展示。
 */
class SyncManager {
  private started = false;
  private syncing = false;
  private timer: number | null = null;
  private official = new OfficialWebAdapter(
    () => useSync.getState().capabilities,
    () => useAuth.getState().sessionState,
  );

  start() {
    if (this.started) return;
    this.started = true;

    window.addEventListener("online", () => {
      useSync.getState().setOnline(true);
      void this.syncAll("auto");
    });
    window.addEventListener("offline", () => {
      useSync.getState().setOnline(false);
      useSync.getState().setOverall("offline");
    });
    useSync.getState().setOnline(navigator.onLine);
    useSync.getState().loadCapabilities(useSettings.getState().map["capabilities.report"] ?? null);
    const rawSyncAt = useSettings.getState().map["official.syncAt"];
    const v = rawSyncAt ? parseInt(rawSyncAt, 10) : 0;
    useSync.getState().setOfficialSyncAt(v > 0 ? v * 1000 : null);

    window.setTimeout(() => void this.syncAll("auto"), 1500);
    this.timer = window.setInterval(() => {
      if (this.syncing) return;
      if (useSettings.getState().get("sync.auto", "true") !== "true") return;
      const intervalMin = parseInt(useSettings.getState().get("sync.intervalMin", "30"), 10) || 30;
      const last = useSync.getState().lastAttemptAt ?? 0;
      if (Date.now() - last >= intervalMin * 60 * 1000) {
        void this.syncAll("auto");
      }
    }, 60 * 1000);
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  async syncAll(trigger: "auto" | "manual"): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    const sync = useSync.getState();
    sync.setRunning(true);
    sync.setLastAttemptAt(Date.now());
    let overall: OverallSyncState = "local";

    try {
      // 0) 本地数据摘要（实时、真实）
      try {
        const summary = await api.localDataSummary();
        sync.setLocalSummary(summary);
      } catch {
        /* 摘要失败不影响主流程 */
      }

      // 1) 会话：有会话则执行真实验证（SessionProbe），无会话则本地模式
      const auth = useAuth.getState();
      const exists = await api.sessionExists();
      if (!exists) {
        auth.setSession("logged_out", "未登录：本地数据正常保存");
        sync.setDomain("session", { status: "pending", note: "未登录：使用本地模式" });
        for (const k of [
          "profile",
          "currentBook",
          "studyPlan",
          "dailyProgress",
          "reviewWords",
          "writeback",
        ] as DomainKey[]) {
          sync.setDomain(k, { status: "unsupported", note: "未登录，官方数据不可用" });
        }
        overall = "local";
      } else {
        if (auth.sessionState !== "logged_in" || trigger === "manual") {
          const probe = await auth.verifySession();
          if (probe?.verdict === "offline") {
            overall = "offline";
            sync.setOnline(false);
          }
        }
        const now = useAuth.getState().sessionState;
        if (now === "logged_in") {
          sync.setDomain("session", { status: "synced", note: "会话已通过官方页面验证" });
          overall = "account_ok";
        } else if (now === "captured") {
          sync.setDomain("session", {
            status: "pending",
            note: "会话已捕获，官方页面未提供身份标记（身份未验证）",
          });
          overall = "account_ok";
        } else if (now === "offline") {
          sync.setDomain("session", { status: "failed", note: "离线：无法验证会话（不等于失效）" });
          overall = "offline";
        } else if (now === "expired") {
          sync.setDomain("session", { status: "failed", note: "登录状态已失效，请重新登录" });
          overall = "error";
        } else {
          sync.setDomain("session", {
            status: "failed",
            note: useAuth.getState().sessionNote || "会话验证失败",
          });
          overall = "error";
        }
      }

      // 2) 能力检测（仅在会话验证通过后执行真实检测；其余状态如实标记）
      if (overall !== "offline" && (await shouldRunDetection())) {
        try {
          await detectCapabilities();
        } catch {
          /* 检测失败不阻塞 */
        }
      }

      // 3) 数据域状态（来源：能力报告 + 本地事实）
      const caps = useSync.getState().capabilities;
      const setDomainFromCaps = (key: DomainKey, capKey: keyof NonNullable<typeof caps>["items"], localNote: string) => {
        const item = caps?.items[capKey];
        if (item?.status === "available") {
          sync.setDomain(key, { status: "pending", note: "能力可用，等待接入（见 official-web-capabilities.md）" });
        } else {
          sync.setDomain(key, {
            status: item?.status === "failed" ? "failed" : "unsupported",
            note: item?.note ?? localNote,
          });
        }
      };
      setDomainFromCaps("profile", "userProfile", "账号信息暂无官方渠道，昵称为本地设置");
      setDomainFromCaps("currentBook", "currentBook", "词书来自本地数据库");
      setDomainFromCaps("studyPlan", "studyPlan", "学习计划为本地设置");
      setDomainFromCaps("dailyProgress", "dailyProgress", "进度来自本地记录");
      setDomainFromCaps("reviewWords", "reviewList", "复习队列为本地 SRS 生成");
      sync.setDomain("learnedWords", { status: "local", note: "本地完整记录" });
      sync.setDomain("studyHistory", { status: "local", note: "本地完整记录" });

      // 4) 操作队列（按类型分批、独立标记）
      const didOfficialSync = await this.processQueue(overall === "offline");
      if (didOfficialSync && overall !== "offline") {
        overall = "synced";
      }

      // 5) 结束状态
      sync.setOverall(overall);
      if (trigger === "manual") {
        if (overall === "local") toast.info("当前为本地模式：本地数据已保存，官方同步暂不可用");
        else if (overall === "offline") toast.warn("当前离线：本地数据正常，显示本地内容");
        else if (overall === "error") toast.warn("账号状态异常，请到「设置 → 同步」查看详情");
        else if (overall === "synced") toast.success("官方数据已同步");
        else toast.info("账号状态已更新：详见「设置 → 同步」");
      }
    } finally {
      useSync.getState().setRunning(false);
      this.syncing = false;
    }
  }

  /** 队列分批处理：study_record 与 favorite 各自独立标记，避免互相污染。
   *  返回值：是否发生了真正成功的官方同步。 */
  private async processQueue(offline: boolean): Promise<boolean> {
    const sync = useSync.getState();
    const pending = await api.queueList("pending");
    if (pending.length === 0) {
      sync.setDomain("writeback", { status: "local", note: "没有待同步操作（本地数据已保存）" });
      return false;
    }
    if (offline) {
      sync.setDomain("writeback", {
        status: "pending",
        note: `${pending.length} 条操作保存在本地（离线，联网后自动重试）`,
      });
      return false;
    }

    const studyOps: { op: Operation; rec: StudyRecord }[] = [];
    const favOps: { op: Operation; payload: { wordId: string; favorite: boolean } }[] = [];
    for (const op of pending) {
      try {
        const payload = JSON.parse(op.payload);
        if (op.opType === "study_record") studyOps.push({ op, rec: payload as StudyRecord });
        else if (op.opType === "favorite") favOps.push({ op, payload });
      } catch {
        await api.queueMark([op.id], "failed", "队列数据损坏");
      }
    }

    const notes: string[] = [];

    // --- study_record 批次 ---
    if (studyOps.length > 0) {
      const r = await this.official.pushStudyRecords(studyOps.map((x) => x.rec));
      const ids = studyOps.map((x) => x.op.id);
      if (r.status === "unsupported" || r.status === "local") {
        await api.queueMark(ids, "unsupported", r.note ?? "官方渠道暂不支持回写");
        notes.push(`学习记录 ${ids.length} 条：本地记录，暂未同步至百词斩`);
      } else if (r.status === "failed") {
        await api.queueMark(ids, "failed", r.note ?? "回写失败");
        notes.push(`学习记录 ${ids.length} 条回写失败（可重试）`);
      } else if (r.status === "synced") {
        // 只有官方确认成功后才同时更新队列与学习记录
        await api.queueMark(ids, "synced", null);
        try {
          await api.markStudyRecordsSynced(studyOps.map((x) => x.rec.id));
        } catch {
          /* 记录标记失败下次同步纠正 */
        }
        notes.push(`学习记录 ${ids.length} 条已同步至百词斩`);
        await this.markOfficialSync();
      } else {
        // pending 等其他状态：保持不动，等待下次
        notes.push(`学习记录 ${ids.length} 条待同步`);
      }
    }

    // --- favorite 批次（独立处理，失败不影响上面结果） ---
    if (favOps.length > 0) {
      const r = await this.official.pushFavorites(favOps.map((x) => x.payload));
      const ids = favOps.map((x) => x.op.id);
      if (r.status === "unsupported" || r.status === "local") {
        await api.queueMark(ids, "unsupported", r.note ?? "官方渠道暂不支持收藏回写");
        notes.push(`收藏变更 ${ids.length} 条：本地已保存，暂未同步`);
      } else if (r.status === "failed") {
        await api.queueMark(ids, "failed", r.note ?? "收藏回写失败");
        notes.push(`收藏变更 ${ids.length} 条回写失败（可重试）`);
      } else if (r.status === "synced") {
        await api.queueMark(ids, "synced", null);
        notes.push(`收藏变更 ${ids.length} 条已同步`);
        await this.markOfficialSync();
      } else {
        notes.push(`收藏变更 ${ids.length} 条待同步`);
      }
    }

    const anySynced = notes.some((n) => n.includes("已同步至百词斩") || n.includes("条已同步"));
    sync.setDomain("writeback", {
      status: anySynced ? "synced" : notes.some((n) => n.includes("失败")) ? "failed" : "unsupported",
      note: notes.join("；") || "没有待同步操作",
    });
    return anySynced;
  }

  /** 仅在官方数据真正同步成功时调用 */
  private async markOfficialSync(): Promise<void> {
    const ts = Date.now();
    useSync.getState().setOfficialSyncAt(ts);
    await useSettings.getState().set("official.syncAt", String(Math.floor(ts / 1000)));
  }

  /** 重试失败/不支持的操作（用户手动触发） */
  async retryQueue(): Promise<void> {
    const all = await api.queueList(null);
    const retryIds = all
      .filter((op) => op.status === "failed" || op.status === "unsupported")
      .map((op) => op.id);
    if (retryIds.length > 0) await api.queueMark(retryIds, "pending", null);
    await this.syncAll("manual");
  }

  /** 供 UI 手动触发会话验证 */
  async reverifySession(): Promise<void> {
    await useAuth.getState().verifySession();
    await this.syncAll("manual");
  }

  /** 本地适配器透出（保持接口完整性） */
  get local() {
    return localAdapter;
  }
}

export const syncManager = new SyncManager();
