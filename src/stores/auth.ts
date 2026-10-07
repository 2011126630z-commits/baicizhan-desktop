import { create } from "zustand";
import { api } from "../services/storage/db";
import type { SessionProbeResult, SessionState } from "../types/models";
import { useSettings } from "./settings";

interface AuthState {
  sessionState: SessionState;
  /** 状态说明（人类可读，来自真实探测结果） */
  sessionNote: string;
  lastProbe: SessionProbeResult | null;
  loginConfirming: boolean;
  init: () => Promise<void>;
  setSession: (s: SessionState, note?: string) => void;
  setLoginConfirming: (v: boolean) => void;
  loginWithOfficialPage: () => Promise<void>;
  confirmLogin: () => Promise<{ ok: boolean; message: string }>;
  /** 携带会话访问官方页面，验证登录身份（绝不把 HTTP 200 当作已登录） */
  verifySession: () => Promise<SessionProbeResult | null>;
  logout: () => Promise<void>;
}

function verdictToState(v: SessionProbeResult["verdict"], prev: SessionState): SessionState {
  switch (v) {
    case "verified":
      return "logged_in";
    case "not_logged_in":
      return prev === "logged_in" ? "expired" : "verification_failed";
    case "offline":
      return "offline";
    case "failed":
      return "verification_failed";
    default:
      return "captured"; // unverified：会话已捕获，身份未验证
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  sessionState: "logged_out",
  sessionNote: "",
  lastProbe: null,
  loginConfirming: false,

  init: async () => {
    const exists = await api.sessionExists();
    if (!exists) {
      set({ sessionState: "logged_out", sessionNote: "本地没有已保存的会话" });
      await useSettings.getState().set("auth.sessionState", "logged_out");
      return;
    }
    // 有会话 ≠ 已登录：先标记为“已捕获、待验证”，由后台 SessionProbe 决定真实状态
    set({
      sessionState: "captured",
      sessionNote: "已恢复本地会话，等待验证账号身份",
    });
  },

  setSession: (s, note) => {
    set({ sessionState: s, sessionNote: note ?? get().sessionNote });
    void useSettings.getState().set("auth.sessionState", s);
  },

  setLoginConfirming: (v) => set({ loginConfirming: v }),

  loginWithOfficialPage: async () => {
    set({ loginConfirming: true });
    await api.openLoginWindow();
  },

  /** 用户在官方页面完成登录后调用：读取官方域会话 Cookie（不接触密码） */
  confirmLogin: async () => {
    try {
      const n = await api.captureLoginCookies();
      if (n === 0) {
        set({ loginConfirming: false });
        return { ok: false, message: "未检测到百词斩官方域名的会话，请先在官方页面完成登录" };
      }
      // 关键：捕获成功只代表“拿到 Cookie”，不代表“已登录”。
      set({
        sessionState: "captured",
        sessionNote: `已捕获 ${n} 项官方会话，正在验证账号身份…`,
      });
      await useSettings.getState().set("auth.sessionState", "captured");
      await api.closeLoginWindow();
      // 立即执行真实身份验证
      const probe = await get().verifySession();
      if (probe?.verdict === "verified") {
        return { ok: true, message: "登录成功：已通过官方页面验证账号身份" };
      }
      if (probe?.verdict === "not_logged_in") {
        return {
          ok: false,
          message: "未检测到已登录的百词斩账号：官方页面仍显示未登录状态，请确认在官方页面已完成登录",
        };
      }
      if (probe?.verdict === "offline") {
        return { ok: true, message: "会话已保存；当前网络无法验证身份，联网后会自动验证" };
      }
      return {
        ok: true,
        message: "会话已保存；官方页面未提供可验证身份的标记，暂显示为「会话待验证」",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ sessionState: "verification_failed", sessionNote: msg });
      return { ok: false, message: msg };
    } finally {
      set({ loginConfirming: false });
    }
  },

  verifySession: async () => {
    const prev = get().sessionState;
    set({ sessionState: "verifying", sessionNote: "正在通过官方页面验证会话…" });
    try {
      const probe = await api.verifySession();
      const next = verdictToState(probe.verdict, prev);
      set({ sessionState: next, sessionNote: probe.note, lastProbe: probe });
      await useSettings.getState().set("auth.sessionState", next);
      return probe;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ sessionState: "verification_failed", sessionNote: msg });
      return null;
    }
  },

  logout: async () => {
    await api.sessionClear();
    await useSettings.getState().set("auth.sessionState", "logged_out");
    set({ sessionState: "logged_out", sessionNote: "已退出登录", lastProbe: null });
  },
}));

/** 是否处于“会话可用但未验证身份”的中间态 */
export function isSessionUsable(s: SessionState): boolean {
  return s === "logged_in" || s === "captured" || s === "offline";
}

export function sessionLabel(s: SessionState): string {
  switch (s) {
    case "logged_out":
      return "未登录";
    case "captured":
      return "会话待验证";
    case "verifying":
      return "验证中…";
    case "logged_in":
      return "已验证登录";
    case "expired":
      return "会话已过期";
    case "offline":
      return "离线（未验证）";
    case "verification_failed":
      return "身份未验证";
  }
}
