import { useNavigate } from "react-router-dom";
import { useSync } from "../stores/sync";
import { useAuth, sessionLabel } from "../stores/auth";
import { fmtDateTime } from "../utils/time";

/**
 * 三行式真实状态展示（0.2.0）：
 * 本地数据 / 百词斩账号 / 官方学习同步 —— 三者严格分开，绝不把本地保存说成“已同步”。
 */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const overall = useSync((s) => s.overall);
  const officialSyncAt = useSync((s) => s.officialSyncAt);
  const online = useSync((s) => s.online);
  const pendingOps = useSync((s) => s.localSummary?.pendingOps ?? 0);
  const sessionState = useAuth((s) => s.sessionState);

  const goSettings = () => navigate("/settings?section=sync");

  const localText = `本地数据：已保存${pendingOps > 0 ? `（待同步 ${pendingOps} 条）` : ""}`;
  const accountText = `百词斩账号：${sessionLabel(sessionState)}`;
  const officialText = officialSyncAt
    ? `官方学习同步：已同步 · ${fmtDateTime(officialSyncAt)}`
    : "官方学习同步：暂不可用";

  if (compact) {
    const dot =
      !online
        ? "var(--warn)"
        : sessionState === "logged_in"
          ? "var(--primary)"
          : sessionState === "captured" || sessionState === "verifying"
            ? "var(--info)"
            : sessionState === "expired" || sessionState === "verification_failed"
              ? "var(--danger)"
              : "var(--text-3)";
    const shortAccount =
      sessionState === "logged_in"
        ? "已登录"
        : sessionState === "captured"
          ? "待验证"
          : sessionState === "expired"
            ? "已过期"
            : "未登录";
    return (
      <span
        onClick={goSettings}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        title={`${localText}\n${accountText}\n${officialText}`}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, display: "inline-block" }} />
        <span>本地已保存</span>
        <span style={{ color: "var(--text-3)" }}>·</span>
        <span>百词斩：{online ? shortAccount : "离线"}</span>
      </span>
    );
  }

  const row = (label: string, value: string, color?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "3px 0" }}>
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span style={{ color: color ?? "var(--text)" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ fontSize: 12.5, cursor: "pointer" }} onClick={goSettings} title="点击查看同步详情">
      {row("本地数据", pendingOps > 0 ? `已保存 · ${pendingOps} 条待同步` : "已保存", "var(--primary)")}
      {row(
        "百词斩账号",
        online ? sessionLabel(sessionState) : `${sessionLabel(sessionState)} · 离线`,
        sessionState === "logged_in"
          ? "var(--primary)"
          : sessionState === "captured" || sessionState === "verifying"
            ? "var(--info)"
            : sessionState === "expired" || sessionState === "verification_failed"
              ? "var(--danger)"
              : "var(--text-2)",
      )}
      {row(
        "官方学习同步",
        officialSyncAt ? `已同步 · ${fmtDateTime(officialSyncAt)}` : "暂不可用",
        officialSyncAt ? "var(--primary)" : "var(--text-3)",
      )}
      {overall === "offline" && (
        <div style={{ color: "var(--warn)", fontSize: 11.5, marginTop: 2 }}>当前离线 · 显示本地内容</div>
      )}
    </div>
  );
}
