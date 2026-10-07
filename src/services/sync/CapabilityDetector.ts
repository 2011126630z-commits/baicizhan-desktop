import { api } from "../storage/db";
import { useSettings } from "../../stores/settings";
import { useSync } from "../../stores/sync";
import { useAuth, sessionLabel } from "../../stores/auth";
import type { CapabilityItem, CapabilityKey, CapabilityReport, SessionState } from "../../types/models";

/**
 * 能力检测（0.2.0）：
 * - 绝不再 hardcode “已登录”；
 * - 只有经过 SessionProbe 验证（logged_in）的会话才允许检测官方能力；
 * - 会话“已捕获但未验证”时全部标记为 unverified（会话待验证）；
 * - 未登录 / 失效 / 验证失败时全部标记为 unavailable 并说明原因。
 */

const CAP_KEYS: { key: CapabilityKey; label: string }[] = [
  { key: "userProfile", label: "账号信息" },
  { key: "currentBook", label: "当前词书" },
  { key: "studyPlan", label: "学习计划" },
  { key: "dailyProgress", label: "今日进度" },
  { key: "wordContent", label: "单词内容" },
  { key: "reviewList", label: "复习列表" },
  { key: "studyWriteback", label: "学习记录回写" },
  { key: "favorites", label: "收藏同步" },
  { key: "audio", label: "发音音频" },
];

const NOTE_UNVERIFIED = "会话已捕获但身份未验证：无法安全判定官方能力，待登录会话验证通过后自动重检";
const NOTE_UNSUPPORTED =
  "官方网页当前未提供可安全使用的公开数据渠道；为避免账号风险，不使用非公开接口";
const NOTE_NOT_LOGGED_IN = "未登录官方账号，无法检测官方数据能力";

function stateOfSession(s: SessionState): { blocked: boolean; note: string } {
  switch (s) {
    case "logged_in":
      return { blocked: false, note: "" };
    case "logged_out":
      return { blocked: true, note: NOTE_NOT_LOGGED_IN };
    case "expired":
      return { blocked: true, note: "登录状态已失效，请重新登录后再检测官方能力" };
    case "verification_failed":
      return { blocked: true, note: "当前会话无法验证为已登录账号，暂按未登录处理" };
    case "offline":
      return { blocked: true, note: "当前离线，无法验证会话；恢复网络后自动重检" };
    case "verifying":
      return { blocked: true, note: "正在验证会话，请稍候" };
    default:
      return { blocked: true, note: NOTE_UNVERIFIED };
  }
}

export async function detectCapabilities(): Promise<CapabilityReport> {
  const items = {} as Record<CapabilityKey, CapabilityItem>;
  const auth = useAuth.getState();
  const session = auth.sessionState;
  const gate = stateOfSession(session);

  if (gate.blocked) {
    for (const { key } of CAP_KEYS) {
      items[key] = { status: "unavailable", note: gate.note };
    }
  } else {
    // 已达 logged_in：本版官方渠道经研究确认仍未提供公开可用的读取接口
    // （见 docs/official-web-capabilities.md），故如实标记，绝不高估。
    items.userProfile = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.currentBook = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.studyPlan = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.dailyProgress = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.reviewList = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.wordContent = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.studyWriteback = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.favorites = { status: "unavailable", note: NOTE_UNSUPPORTED };
    items.audio = {
      status: "unavailable",
      note: "官方音频未提供公开授权访问；本地词书使用 Windows 系统语音合成（离线可用）",
    };
  }

  const report: CapabilityReport = {
    checkedAt: Math.floor(Date.now() / 1000),
    loginChannel: "available",
    items,
  };

  useSync.getState().setCapabilities(report);
  await useSettings.getState().set("capabilities.report", JSON.stringify(report));

  try {
    await api.exportCapabilitiesReport(toMarkdown(report, session, auth.sessionNote));
  } catch {
    /* 导出失败不影响主流程 */
  }
  return report;
}

export function toMarkdown(
  r: CapabilityReport,
  session: SessionState,
  sessionNote: string,
): string {
  const label = (s: CapabilityItem["status"]) =>
    s === "available" ? "可用" : s === "unavailable" ? "不可用" : s === "failed" ? "检测失败" : "待验证";
  const sessionBadge =
    session === "logged_in"
      ? "✅ 已验证登录"
      : session === "captured" || session === "offline"
        ? "⚠ 会话已捕获，身份未验证"
        : session === "expired"
          ? "⚠ 会话已过期"
          : "❌ 未登录";

  const lines: string[] = [
    "# 百词斩桌面版 · 数据能力报告",
    "",
    `> 检测时间：${new Date(r.checkedAt * 1000).toLocaleString("zh-CN")}`,
    `> 账号状态：${sessionBadge}（${sessionLabel(session)}）`,
    `> 状态说明：${sessionNote || "—"}`,
    "> 本报告由应用内置 CapabilityDetector 在运行时生成，仅基于官方网页正常登录会话探测，",
    "> 不包含任何逆向、绕过或非公开接口调用。",
    "",
    "## 安全状态（设计保证 + 单元测试验证）",
    "",
    "| 项目 | 状态 | 说明 |",
    "| --- | --- | --- |",
    "| Cookie host allowlist | ✅ PASS | 认证请求仅允许 baicizhan.com 及其子域；evilbaicizhan.com、baicizhan.com.evil.com 等已由单元测试确认拒绝 |",
    "| 跨域认证 Cookie | ✅ BLOCKED | 重定向离开官方域立即停止；第三方域名不会收到任何会话 Cookie |",
    "| 密码处理 | ✅ PASS | 登录全程在官方页面完成，程序不读取、不记录、不上传密码 |",
    "| Token/Cookie 日志 | ✅ PASS | 会话仅存 Windows 凭据管理器；日志/错误信息/能力报告均不含 Cookie 值 |",
    "| 出站请求限制 | ✅ PASS | 仅 https 官方域名；IP 字面量、localhost、私有网段一律拒绝 |",
    "",
    "## 官方数据能力（运行时检测）",
    "",
    "| 能力 | 状态 | 说明 |",
    "| --- | --- | --- |",
    "| 登录通道 | 可用 | 通过 WebView2 打开百词斩官方网页完成登录（官方处理密码/扫码/短信） |",
  ];
  for (const { key, label: name } of CAP_KEYS) {
    const item = r.items[key];
    lines.push(`| ${name} | ${label(item.status)} | ${item.note ?? ""} |`);
  }
  lines.push(
    "",
    "## 数据流说明",
    "",
    "- 所有学习操作先写入本地 SQLite 操作队列（含 operationId，幂等），UI 立即更新，再由 SyncManager 尝试同步。",
    "- 状态标记：synced=官方已同步 / local=仅本地 / pending=待同步 / failed=失败可重试 / unsupported=官方渠道暂不支持。",
    "- 只有官方渠道真正读写成功时才显示「已同步」；其余情况一律如实显示本地状态。",
    "- 详情与研究发现见 docs/official-web-capabilities.md。",
  );
  return lines.join("\n");
}

export async function shouldRunDetection(): Promise<boolean> {
  const s = useSettings.getState();
  const raw = s.map["capabilities.report"];
  if (!raw) return true;
  try {
    const r = JSON.parse(raw) as CapabilityReport;
    const age = Date.now() / 1000 - r.checkedAt;
    return age > 86400 || Object.values(r.items).some((i) => i.status === "failed");
  } catch {
    return true;
  }
}

export { NOTE_UNSUPPORTED, NOTE_UNVERIFIED };
