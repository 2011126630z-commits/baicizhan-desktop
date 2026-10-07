import { useAuth } from "../../stores/auth";
import { syncManager } from "../sync/SyncManager";
import { toast } from "../../stores/toast";

/** 登录相关流程封装：官方页面登录 → 会话捕获 → 能力检测 → 同步 */
export const AuthService = {
  async openOfficialLoginPage(): Promise<void> {
    await useAuth.getState().loginWithOfficialPage();
  },

  async confirmLogin(): Promise<boolean> {
    const r = await useAuth.getState().confirmLogin();
    if (r.ok) {
      // 只有通过 SessionProbe 验证才用 success；其余情况用 info（诚实提示中间状态）
      if (r.message.includes("登录成功")) toast.success(r.message);
      else toast.info(r.message);
      // 会话状态变化后立即重新检查（验证 + 能力检测 + 队列）
      await syncManager.syncAll("manual");
    } else {
      toast.error(r.message);
    }
    return r.ok;
  },

  async cancelLogin(): Promise<void> {
    await useAuth.getState().setLoginConfirming(false);
    const { api } = await import("../storage/db");
    await api.closeLoginWindow();
  },

  async logout(): Promise<void> {
    await useAuth.getState().logout();
    toast.info("已退出登录，本地学习数据仍会保留");
    await syncManager.syncAll("manual");
  },
};
