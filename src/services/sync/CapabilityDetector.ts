import { api } from "../storage/db";
import { useSettings } from "../../stores/settings";
import { useSync } from "../../stores/sync";
import type { CapabilityItem, CapabilityKey, CapabilityReport } from "../../types/models";
import { errMsg } from "../../utils/invoke";
import { OfficialWebAdapter } from "../../adapters/OfficialWebAdapter";

/**
 * 能力检测：只用官方网页正常渠道探测当前会话能安全获得哪些数据。
 * 结果写入设置与 docs/capabilities.md（开发模式），绝不做危险逆向。
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

const adapter = new OfficialWebAdapter(
  () => useSync.getState().capabilities,
  () => true,
);

export async function detectCapabilities(): Promise<CapabilityReport> {
  const items = {} as Record<CapabilityKey, CapabilityItem>;
  const noteUnverified = "已登录，但官方网页未提供公开可验证的数据接口，待官方渠道开放后再验证";
  const noteUnsupported = "官方网页未提供该能力的公开渠道；为避免账号风险，不使用非公开接口";

  let sessionOk = false;
  let offline = false;
  let sessionNote: string | undefined;

  try {
    const probe = await adapter.probeSession();
    sessionOk = probe.ok;
    offline = probe.offline;
    sessionNote = probe.note;
  } catch (e) {
    sessionNote = errMsg(e);
    offline = true;
  }

  if (offline) {
    for (const { key } of CAP_KEYS) {
      items[key] = { status: "failed", note: "网络不可用，能力检测未完成（恢复联网后自动重试）" };
    }
  } else if (!sessionOk) {
    for (const { key } of CAP_KEYS) {
      items[key] = { status: "unavailable", note: sessionNote ?? "未登录官方账号，无法获取官方数据" };
    }
  } else {
    items.userProfile = { status: "unverified", note: noteUnverified };
    items.currentBook = { status: "unverified", note: noteUnverified };
    items.studyPlan = { status: "unverified", note: noteUnverified };
    items.dailyProgress = { status: "unverified", note: noteUnverified };
    items.reviewList = { status: "unverified", note: noteUnverified };
    items.wordContent = { status: "unavailable", note: noteUnsupported };
    items.studyWriteback = { status: "unavailable", note: noteUnsupported };
    items.favorites = { status: "unavailable", note: noteUnsupported };
    items.audio = {
      status: "unverified",
      note: "官方音频未验证；本地词书使用 Windows 系统语音合成（离线可用）",
    };
  }

  const report: CapabilityReport = {
    checkedAt: Math.floor(Date.now() / 1000),
    loginChannel: "available",
    items,
  };

  useSync.getState().setCapabilities(report);
  await useSettings.getState().set("capabilities.report", JSON.stringify(report));

  // 导出 markdown（写入应用数据目录；开发模式同时写入项目 docs/）
  try {
    await api.exportCapabilitiesReport(toMarkdown(report));
  } catch {
    /* 导出失败不影响主流程 */
  }
  return report;
}

export function toMarkdown(r: CapabilityReport): string {
  const label = (s: CapabilityItem["status"]) =>
    s === "available" ? "可用" : s === "unavailable" ? "不可用" : s === "failed" ? "检测失败" : "待验证";
  const lines: string[] = [
    "# 百词斩桌面版 · 数据能力报告",
    "",
    `> 检测时间：${new Date(r.checkedAt * 1000).toLocaleString("zh-CN")}`,
    "> 本报告由应用内置 CapabilityDetector 在运行时生成，仅基于官方网页正常登录会话探测，不包含任何逆向或绕过行为。",
    "",
    "| 能力 | 状态 | 说明 |",
    "| --- | --- | --- |",
    `| 登录 | ${r.loginChannel === "available" ? "可用" : "不可用"} | 通过 WebView2 打开百词斩官方网页，在官方页面完成登录（桌面端不接触密码） |`,
  ];
  for (const { key, label: name } of CAP_KEYS) {
    const item = r.items[key];
    lines.push(`| ${name} | ${label(item.status)} | ${item.note ?? ""} |`);
  }
  lines.push(
    "",
    "## 数据流说明",
    "",
    "- 所有学习操作先写入本地 SQLite 操作队列（含 operationId，幂等），UI 立即更新，再由 SyncManager 决定同步去向。",
    "- 状态标记：synced=官方已同步 / local=仅本地 / pending=待同步 / failed=失败可重试 / unsupported=官方渠道暂不支持。",
    "- 界面上 unsupported 永远不会显示为 synced。",
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
    // 超过 24 小时或上次为失败结果时重测
    return age > 86400 || Object.values(r.items).some((i) => i.status === "failed");
  } catch {
    return true;
  }
}
