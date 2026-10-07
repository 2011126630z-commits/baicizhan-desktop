import { useNavigate } from "react-router-dom";
import { useSync, type OverallSyncState } from "../stores/sync";
import { fmtTime } from "../utils/time";

const LABELS: Record<OverallSyncState, string> = {
  idle: "待同步",
  syncing: "正在同步…",
  ok: "同步完成",
  offline: "离线 · 本地缓存",
  error: "同步异常",
  local: "本地模式 · 未登录",
};

const COLORS: Record<OverallSyncState, string> = {
  idle: "var(--text-3)",
  syncing: "var(--info)",
  ok: "var(--primary)",
  offline: "var(--warn)",
  error: "var(--danger)",
  local: "var(--text-3)",
};

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const overall = useSync((s) => s.overall);
  const lastSyncAt = useSync((s) => s.lastSyncAt);
  const navigate = useNavigate();
  return (
    <span
      onClick={() => navigate("/settings?section=sync")}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
      title={lastSyncAt ? `最后同步：${fmtTime(lastSyncAt)}` : "尚未同步"}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: COLORS[overall],
          display: "inline-block",
        }}
      />
      <span>{LABELS[overall]}</span>
      {!compact && lastSyncAt && overall === "ok" && (
        <span style={{ color: "var(--text-3)" }}>· {fmtTime(lastSyncAt)}</span>
      )}
    </span>
  );
}
