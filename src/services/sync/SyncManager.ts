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
 * SyncManager：登录校验、能力检测、数据同步、操作队列的唯一入口。
 * 策略：启动后先显示本地缓存，后台静默同步；失败不阻塞 UI，可重试。
 */
class SyncManager {
  private started = false;
  private syncing = false;
  private timer: number | null = null;
  private official = new OfficialWebAdapter(
    () => useSync.getState().capabilities,
    () => useAuth.getState().sessionState === "logged_in",
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

    // 启动 1.5s 后台同步，不阻塞首屏；之后每分钟检查是否到达同步间隔
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
    let overall: OverallSyncState = "ok";

    try {
      // 1. 会话有效性（只探测，绝不自动重登，避免无限循环）
      const exists = await api.sessionExists();
      let logged = false;
      if (!exists) {
        useAuth.getState().setSession("logged_out");
        sync.setDomain("session", { status: "pending", note: "未登录：使用本地模式" });
        for (const k of ["profile", "currentBook", "studyPlan", "dailyProgress", "reviewWords", "writeback"] as DomainKey[]) {
          sync.setDomain(k, { status: "unsupported", note: "未登录，官方数据不可用" });
        }
        overall = "local";
      } else {
        const probe = await this.official.probeSession();
        if (probe.ok) {
          useAuth.getState().setSession("logged_in");
          logged = true;
          sync.setDomain("session", { status: "synced", note: "官方登录会话有效" });
        } else if (probe.expired) {
          useAuth.getState().setSession("expired");
          sync.setDomain("session", { status: "failed", note: "登录状态已失效，请重新登录" });
          overall = "error";
        } else if (probe.offline) {
          sync.setDomain("session", { status: "failed", note: "当前离线 · 显示上次同步内容" });
          sync.setOnline(false);
          overall = "offline";
        } else {
          sync.setDomain("session", { status: "failed", note: probe.note ?? "会话探测失败" });
          overall = "error";
        }
      }

      // 2. 能力检测（24h 一次或失败重测；离线时跳过）
      if (overall !== "offline" && (await shouldRunDetection())) {
        try {
          await detectCapabilities();
        } catch {
          /* 检测失败不阻塞 */
        }
      }

      // 3. 数据域同步（能力门控：未开放的能力诚实标注）
      const caps = useSync.getState().capabilities;

      const gate = (supported: boolean, unverifiedNote: string) =>
        !logged
          ? { status: "unsupported" as const, note: "未登录，官方数据不可用" }
          : !caps
            ? { status: "pending" as const, note: "尚未完成能力检测" }
            : supported
              ? null
              : { status: "pending" as const, note: unverifiedNote };

      // profile
      try {
        const r = await localAdapter.fetchProfile();
        void r;
        const g = gate(true, "");
        sync.setDomain("profile", g ?? { status: "pending", note: "官方渠道暂无公开接口，昵称为本地设置" });
      } catch {
        sync.setDomain("profile", { status: "failed", note: "获取失败" });
      }

      // currentBook
      try {
        const r = await this.official.fetchCurrentBook();
        sync.setDomain("currentBook", { status: r.status, note: r.note ?? "词书来自本地数据库" });
      } catch {
        sync.setDomain("currentBook", { status: "failed", note: "获取失败" });
      }

      // studyPlan
      try {
        const r = await this.official.fetchTodayPlan();
        sync.setDomain("studyPlan", { status: r.status, note: r.note ?? "学习计划为本地计划" });
      } catch {
        sync.setDomain("studyPlan", { status: "failed", note: "获取失败" });
      }

      // dailyProgress / reviewWords
      try {
        const r = await this.official.fetchDailyProgress();
        sync.setDomain("dailyProgress", { status: r.status, note: r.note ?? "进度来自本地记录" });
      } catch {
        sync.setDomain("dailyProgress", { status: "failed", note: "获取失败" });
      }
      try {
        const r = await this.official.fetchReviewWords();
        sync.setDomain("reviewWords", { status: r.status, note: r.note ?? "复习队列为本地算法生成" });
      } catch {
        sync.setDomain("reviewWords", { status: "failed", note: "获取失败" });
      }

      // learnedWords / studyHistory：本地永远完整
      sync.setDomain("learnedWords", { status: "local", note: "本地完整记录" });
      sync.setDomain("studyHistory", { status: "local", note: "本地完整记录" });

      // 4. 操作队列回写
      await this.processQueue(overall === "offline", logged);

      // 5. 完成标记（仅真正完成一次官方同步时才记录时间）
      if (overall === "ok") {
        sync.setLastSyncAt(Date.now());
        await useSettings.getState().set("sync.lastSyncAt", String(Math.floor(Date.now() / 1000)));
      }
      sync.setOverall(overall);
      if (trigger === "manual") {
        if (overall === "ok") toast.success("同步完成");
        else if (overall === "offline") toast.warn("当前离线，显示本地缓存内容");
        else toast.warn("同步未全部完成，可稍后重试");
      }
    } finally {
      useSync.getState().setRunning(false);
      this.syncing = false;
    }
  }

  /** 队列处理：登录且官方支持回写时推送；不支持时诚实标记 unsupported；离线/未登录保留 pending */
  private async processQueue(offline: boolean, logged: boolean): Promise<void> {
    const sync = useSync.getState();
    const pending = await api.queueList("pending");
    if (pending.length === 0) {
      sync.setDomain("writeback", { status: "synced", note: "没有待同步的操作" });
      return;
    }
    if (offline) {
      sync.setDomain("writeback", {
        status: "pending",
        note: `${pending.length} 条操作待同步（离线，恢复网络后自动重试）`,
      });
      return;
    }
    if (!logged) {
      sync.setDomain("writeback", {
        status: "pending",
        note: `${pending.length} 条操作保存在本地队列（登录官方账号后再尝试同步）`,
      });
      return;
    }

    const records: StudyRecord[] = [];
    const favItems: { wordId: string; favorite: boolean }[] = [];
    for (const op of pending) {
      try {
        const payload = JSON.parse(op.payload);
        if (op.opType === "study_record") records.push(payload as StudyRecord);
        else if (op.opType === "favorite") favItems.push(payload);
      } catch {
        await api.queueMark([op.id], "failed", "队列数据损坏");
      }
    }

    const handled: string[] = [];
    let note = "";
    let status: Operation["status"] = "synced";

    if (records.length > 0) {
      const r = await this.official.pushStudyRecords(records);
      if (r.status === "unsupported" || r.status === "local") {
        status = "unsupported";
        note = r.note ?? "官方渠道暂不支持回写";
      } else if (r.status === "failed") {
        status = "failed";
        note = r.note ?? "回写失败";
      } else {
        handled.push(...records.map((x) => x.id));
      }
    }
    if (favItems.length > 0) {
      const r = await this.official.pushFavorites(favItems);
      if (r.status === "unsupported" || r.status === "local") {
        status = status === "synced" ? "unsupported" : status;
        note = note || r.note || "官方渠道暂不支持收藏回写";
      } else if (r.status === "failed") {
        status = "failed";
        note = r.note ?? "回写失败";
      }
    }

    // 官方渠道不支持回写时，把所有 pending 标为 unsupported（诚实展示，不再反复尝试）
    if (status !== "synced") {
      await api.queueMark(
        pending.filter((op) => op.status === "pending").map((op) => op.id),
        status,
        note,
      );
      sync.setDomain("writeback", { status, note: `${pending.length} 条：${note}` });
    } else if (handled.length > 0) {
      await api.queueMark(handled, "synced", null);
      sync.setDomain("writeback", { status: "synced", note: `已同步 ${handled.length} 条` });
    }
  }

  /** 重试失败/不支持的操作（用户手动触发，如官方渠道恢复后） */
  async retryQueue(): Promise<void> {
    const all = await api.queueList(null);
    const retryIds = all.filter((op) => op.status === "failed" || op.status === "unsupported").map((op) => op.id);
    if (retryIds.length > 0) await api.queueMark(retryIds, "pending", null);
    await this.syncAll("manual");
  }
}

export const syncManager = new SyncManager();
