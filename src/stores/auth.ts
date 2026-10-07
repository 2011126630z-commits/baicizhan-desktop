import { create } from "zustand";
import { api } from "../services/storage/db";
import type { SessionState } from "../types/models";
import { useSettings } from "./settings";

interface AuthState {
  sessionState: SessionState;
  loginConfirming: boolean;
  init: () => Promise<void>;
  setSession: (s: SessionState) => void;
  setLoginConfirming: (v: boolean) => void;
  loginWithOfficialPage: () => Promise<void>;
  confirmLogin: () => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  sessionState: "logged_out",
  loginConfirming: false,

  init: async () => {
    const exists = await api.sessionExists();
    const saved = useSettings.getState().get("auth.sessionState", "logged_out");
    // 有会话则先按“已登录”展示，真实有效性由 SyncManager 后台校验
    set({ sessionState: exists ? (saved === "expired" ? "expired" : "logged_in") : "logged_out" });
  },

  setSession: (s) => {
    set({ sessionState: s });
    void useSettings.getState().set("auth.sessionState", s);
  },

  setLoginConfirming: (v) => set({ loginConfirming: v }),

  loginWithOfficialPage: async () => {
    set({ loginConfirming: true });
    await api.openLoginWindow();
  },

  /** 用户在官方页面完成登录后调用：读取会话 Cookie 并安全保存 */
  confirmLogin: async () => {
    try {
      const n = await api.captureLoginCookies();
      if (n === 0) {
        return { ok: false, message: "未检测到登录会话，请先在官方页面完成登录" };
      }
      set({ sessionState: "logged_in" });
      await useSettings.getState().set("auth.sessionState", "logged_in");
      await api.closeLoginWindow();
      return { ok: true, message: "登录成功（会话已安全保存到 Windows 凭据管理器）" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    } finally {
      set({ loginConfirming: false });
    }
  },

  logout: async () => {
    await api.sessionClear();
    await useSettings.getState().set("auth.sessionState", "logged_out");
    set({ sessionState: "logged_out" });
  },
}));
