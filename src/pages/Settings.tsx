import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { api } from "../services/storage/db";
import { useAuth } from "../stores/auth";
import { useSettings } from "../stores/settings";
import { useSync } from "../stores/sync";
import { syncManager } from "../services/sync/SyncManager";
import { AuthService } from "../services/auth/AuthService";
import { findConflicts, HOTKEY_LABELS, hkLabel, type HotkeyMap, DEFAULT_HOTKEYS, eventHotkey } from "../utils/hotkeys";
import { Modal, Spinner, Toggle } from "../components/ui";
import { SyncBadge } from "../components/SyncBadge";
import { toast } from "../stores/toast";
import { fmtDateTime } from "../utils/time";
import type { CapabilityKey } from "../types/models";

const SECTIONS = [
  { key: "account", label: "账户" },
  { key: "sync", label: "同步" },
  { key: "study", label: "学习" },
  { key: "hotkeys", label: "快捷键" },
  { key: "display", label: "显示" },
  { key: "desktop", label: "桌面行为" },
  { key: "about", label: "关于" },
];

const CAP_LABELS: Record<CapabilityKey, string> = {
  userProfile: "账号信息",
  currentBook: "当前词书",
  studyPlan: "学习计划",
  dailyProgress: "今日进度",
  wordContent: "单词内容",
  reviewList: "复习列表",
  studyWriteback: "学习记录回写",
  favorites: "收藏同步",
  audio: "发音音频",
};

export function SettingsPage() {
  const [params] = useSearchParams();
  const [section, setSection] = useState(params.get("section") ?? "account");

  useEffect(() => {
    const s = params.get("section");
    if (s) setSection(s);
  }, [params]);

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-title">设置</div>
      <div className="page-sub">所有设置保存在本地数据库，不上传任何数据</div>

      <div className="toolbar">
        {SECTIONS.map((s) => (
          <button key={s.key} className={`radio-pill ${section === s.key ? "active" : ""}`} onClick={() => setSection(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "account" && <AccountSection />}
      {section === "sync" && <SyncSection />}
      {section === "study" && <StudySection />}
      {section === "hotkeys" && <HotkeySection />}
      {section === "display" && <DisplaySection />}
      {section === "desktop" && <DesktopSection />}
      {section === "about" && <AboutSection />}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="label">{label}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---------- 账户 ---------- */

function AccountSection() {
  const { sessionState, loginConfirming } = useAuth();
  const nickname = useSettings((s) => s.map["account.nickname"] ?? "");
  const [name, setName] = useState(nickname);
  const [loginModal, setLoginModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const stateLabel =
    sessionState === "logged_in" ? "已登录（官方会话有效）" : sessionState === "expired" ? "登录状态已失效，请重新登录" : sessionState === "checking" ? "检查中…" : "未登录";

  return (
    <>
      <SectionCard title="账户">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--primary-soft)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {name ? name[0] : "词"}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{name || "未设置昵称"}</div>
            <div style={{ fontSize: 12.5, color: sessionState === "logged_in" ? "var(--primary)" : "var(--text-3)" }}>{stateLabel}</div>
          </div>
        </div>

        <Row label="昵称" desc="仅本地显示使用">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 160 }} />
            <button
              className="btn"
              onClick={async () => {
                await useSettings.getState().set("account.nickname", name.trim());
                toast.success("已保存");
              }}
            >
              保存
            </button>
          </div>
        </Row>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {sessionState === "logged_in" ? (
            <button className="btn btn-danger" onClick={() => void AuthService.logout()}>
              退出登录
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setLoginModal(true);
                  await AuthService.openOfficialLoginPage();
                }}
              >
                登录百词斩账号
              </button>
              {sessionState === "expired" && <span style={{ fontSize: 12.5, color: "var(--warn)", alignSelf: "center" }}>请重新登录</span>}
            </>
          )}
        </div>
      </SectionCard>

      <Modal open={loginModal} title="官方登录流程" onClose={() => setLoginModal(false)} width={480}>
        <ol style={{ fontSize: 13.5, color: "var(--text-2)", paddingLeft: 20, lineHeight: 2 }}>
          <li>已为你打开百词斩官方网页登录窗口</li>
          <li>请在官方页面中完成登录（账号密码 / 扫码 / 短信，均由官方处理）</li>
          <li>登录成功后，回到这里点击「我已完成登录」</li>
        </ol>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "10px 0 16px" }}>
          桌面版不读取、不记录、不上传你的密码；只保存登录后的会话（Windows 凭据管理器加密存储）。
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            className="btn"
            onClick={async () => {
              setLoginModal(false);
              await AuthService.cancelLogin();
            }}
          >
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              const ok = await AuthService.confirmLogin();
              setConfirming(false);
              if (ok) setLoginModal(false);
            }}
          >
            {confirming ? <Spinner /> : null}
            我已完成登录
          </button>
        </div>
      </Modal>
    </>
  );
}

/* ---------- 同步 ---------- */

function SyncSection() {
  const sync = useSync();
  const settingsMap = useSettings((s) => s.map);
  const autoSync = settingsMap["sync.auto"] !== "false";
  const interval = settingsMap["sync.intervalMin"] || "30";
  const caps = sync.capabilities;

  const capBadge = (status?: string) => {
    const map: Record<string, { cls: string; text: string }> = {
      available: { cls: "tag-green", text: "可用" },
      unverified: { cls: "tag-blue", text: "待验证" },
      unavailable: { cls: "tag-red", text: "暂不支持" },
      failed: { cls: "tag-orange", text: "检测失败" },
    };
    const m = map[status ?? "unavailable"] ?? map.unavailable;
    return <span className={`tag ${m.cls}`}>{m.text}</span>;
  };

  return (
    <>
      <SectionCard title="同步状态">
        <Row label="最后同步" desc={sync.lastSyncAt ? undefined : "尚未成功同步过"}>
          {sync.lastSyncAt ? fmtDateTime(sync.lastSyncAt) : "—"}
        </Row>
        <Row label="当前状态">
          <SyncBadge />
        </Row>
        <Row label="网络状态">
          {sync.online ? "在线" : "离线 · 显示上次同步内容"}
        </Row>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={sync.running} onClick={() => void syncManager.syncAll("manual")}>
            {sync.running ? <Spinner /> : null}
            立即同步
          </button>
          <button className="btn" onClick={() => void syncManager.retryQueue()}>
            重试未同步操作
          </button>
        </div>
      </SectionCard>

      <SectionCard title="自动同步">
        <Row label="自动同步" desc="启动时与每隔一段时间后台静默同步">
          <Toggle
            on={autoSync}
            onChange={(v) => void useSettings.getState().set("sync.auto", String(v))}
          />
        </Row>
        <Row label="同步间隔">
          <select className="input" value={interval} onChange={(e) => void useSettings.getState().set("sync.intervalMin", e.target.value)} style={{ width: 120 }}>
            <option value="15">15 分钟</option>
            <option value="30">30 分钟</option>
            <option value="60">60 分钟</option>
          </select>
        </Row>
      </SectionCard>

      <SectionCard title="数据能力（运行时检测）">
        <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 10 }}>
          以下能力由 CapabilityDetector 通过官方网页正常渠道检测。标记「暂不支持」的功能不会伪装成已同步。
        </p>
        {CAP_LABELS && Object.entries(CAP_LABELS).map(([k, label]) => {
          const item = caps?.items[k as CapabilityKey];
          return (
            <Row key={k} label={label} desc={item?.note ?? "尚未检测"}>
              {capBadge(item?.status)}
            </Row>
          );
        })}
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <button
            className="btn"
            onClick={async () => {
              try {
                const { toMarkdown } = await import("../services/sync/CapabilityDetector");
                if (!caps) {
                  toast.warn("还没有能力报告，请先登录并同步一次");
                  return;
                }
                const paths = await api.exportCapabilitiesReport(toMarkdown(caps));
                toast.success(`已导出：${paths.join(" , ")}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "导出失败");
              }
            }}
          >
            导出能力报告
          </button>
        </div>
      </SectionCard>
    </>
  );
}

/* ---------- 学习 ---------- */

function StudySection() {
  const s = useSettings();
  const dailyNew = parseInt(s.get("study.dailyNew", "20"), 10) || 20;
  return (
    <SectionCard title="学习偏好">
      <Row label="每日新词数" desc="每天计划学习的新单词数量">
        <input
          className="input"
          type="number"
          min={5}
          max={200}
          value={dailyNew}
          style={{ width: 90 }}
          onChange={(e) => void s.set("study.dailyNew", String(Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 20))))}
        />
      </Row>
      <Row label="自动播放发音" desc="进入单词时自动朗读">
        <Toggle on={s.map["study.autoPlay"] !== "false"} onChange={(v) => void s.set("study.autoPlay", String(v))} />
      </Row>
      <Row label="显示中文释义" desc="答题后显示中文释义">
        <Toggle on={s.map["study.showChinese"] !== "false"} onChange={(v) => void s.set("study.showChinese", String(v))} />
      </Row>
      <Row label="显示例句" desc="答题后显示例句与翻译">
        <Toggle on={s.map["study.showExample"] !== "false"} onChange={(v) => void s.set("study.showExample", String(v))} />
      </Row>
      <Row label="发音方式" desc="官方音频不可用时使用 Windows 系统语音（离线可用）">
        <span className="tag tag-gray">本地 TTS</span>
      </Row>
    </SectionCard>
  );
}

/* ---------- 快捷键 ---------- */

function HotkeySection() {
  const s = useSettings();
  const raw = s.map["hotkeys.map"];
  const map: HotkeyMap = raw ? { ...DEFAULT_HOTKEYS, ...JSON.parse(raw) } : { ...DEFAULT_HOTKEYS };
  const [capturing, setCapturing] = useState<keyof HotkeyMap | null>(null);
  const conflicts = findConflicts(map);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const hk = eventHotkey(e);
      if (!hk) return;
      const next = { ...map, [capturing]: hk };
      void s.set("hotkeys.map", JSON.stringify(next));
      setCapturing(null);
      if (findConflicts(next).length > 0) toast.warn("注意：该快捷键与其他操作冲突");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, map, s]);

  return (
    <SectionCard title="快捷键">
      <p style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 10 }}>
        点击右侧按键开始录制，按 Esc 取消。{conflicts.length > 0 && <span style={{ color: "var(--warn)" }}> 当前存在冲突：{conflicts.join("、")}</span>}
      </p>
      {(Object.keys(HOTKEY_LABELS) as (keyof HotkeyMap)[]).map((k) => (
        <Row key={k} label={HOTKEY_LABELS[k]}>
          <button className={`btn ${capturing === k ? "btn-primary" : ""}`} onClick={() => setCapturing(k)}>
            {capturing === k ? "按下新按键…" : hkLabel(map[k])}
          </button>
        </Row>
      ))}
      <div style={{ marginTop: 10 }}>
        <button
          className="btn"
          onClick={async () => {
            await s.set("hotkeys.map", JSON.stringify(DEFAULT_HOTKEYS));
            toast.success("已恢复默认快捷键");
          }}
        >
          恢复默认
        </button>
      </div>
    </SectionCard>
  );
}

/* ---------- 显示 ---------- */

function DisplaySection() {
  const s = useSettings();
  const theme = s.get("appearance.theme", "system");
  const fontSize = s.get("appearance.fontSize", "standard");
  return (
    <SectionCard title="显示">
      <Row label="主题">
        <div className="radio-group">
          {[
            { v: "light", t: "浅色" },
            { v: "dark", t: "深色" },
            { v: "system", t: "跟随系统" },
          ].map((o) => (
            <button key={o.v} className={`radio-pill ${theme === o.v ? "active" : ""}`} onClick={() => void s.set("appearance.theme", o.v)}>
              {o.t}
            </button>
          ))}
        </div>
      </Row>
      <Row label="字体大小">
        <div className="radio-group">
          {[
            { v: "small", t: "小" },
            { v: "standard", t: "标准" },
            { v: "large", t: "大" },
          ].map((o) => (
            <button key={o.v} className={`radio-pill ${fontSize === o.v ? "active" : ""}`} onClick={() => void s.set("appearance.fontSize", o.v)}>
              {o.t}
            </button>
          ))}
        </div>
      </Row>
    </SectionCard>
  );
}

/* ---------- 桌面行为 ---------- */

function DesktopSection() {
  const s = useSettings();
  const [autoStart, setAutoStart] = useState(false);
  const closeBehavior = s.get("desktop.closeBehavior", "ask");
  const notify = s.map["desktop.notifyEnabled"] === "true";

  useEffect(() => {
    void isEnabled()
      .then(setAutoStart)
      .catch(() => {});
  }, []);

  return (
    <SectionCard title="桌面行为">
      <Row label="开机自动启动" desc="默认关闭；开启后登录 Windows 时自动运行">
        <Toggle
          on={autoStart}
          onChange={async (v) => {
            try {
              if (v) await enable();
              else await disable();
              setAutoStart(v);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "设置失败");
            }
          }}
        />
      </Row>
      <Row label="关闭窗口时" desc="关闭主窗口的行为">
        <select className="input" value={closeBehavior} onChange={(e) => void s.set("desktop.closeBehavior", e.target.value)} style={{ width: 170 }}>
          <option value="ask">每次询问</option>
          <option value="tray">最小化到托盘</option>
          <option value="exit">直接退出</option>
        </select>
      </Row>
      <Row label="小窗背词默认置顶">
        <Toggle on={s.map["desktop.miniAlwaysTop"] === "true"} onChange={(v) => void s.set("desktop.miniAlwaysTop", String(v))} />
      </Row>
      <Row label="学习提醒通知" desc="默认关闭；开启后在你设置的时刻提醒未完成任务（不打扰原则）">
        <Toggle
          on={notify}
          onChange={async (v) => {
            await s.set("desktop.notifyEnabled", String(v));
            if (v) {
              let granted = await isPermissionGranted();
              if (!granted) granted = (await requestPermission()) === "granted";
              if (granted) {
                sendNotification({ title: "百词斩桌面版", body: "学习提醒已开启（示例通知）" });
              } else {
                toast.warn("系统未授予通知权限");
                await s.set("desktop.notifyEnabled", "false");
              }
            }
          }}
        />
      </Row>
    </SectionCard>
  );
}

/* ---------- 关于 ---------- */

function AboutSection() {
  const [meta, setMeta] = useState<{ version: string; buildTime: string; arch: string } | null>(null);
  useEffect(() => {
    void api
      .appMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  return (
    <SectionCard title="关于">
      <div style={{ lineHeight: 2.2, fontSize: 13.5 }}>
        <div>
          <b>百词斩桌面版</b> <span className="tag tag-gray">非官方</span>
        </div>
        <div style={{ color: "var(--text-2)" }}>版本：{meta?.version ?? "…"}</div>
        <div style={{ color: "var(--text-2)" }}>构建时间：{meta?.buildTime ?? "…"}</div>
        <div style={{ color: "var(--text-2)" }}>架构：Windows {meta?.arch ?? "…"}</div>
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.8 }}>
          非百词斩官方 Windows 客户端，本项目仅作为个人桌面学习工具。
          登录通过百词斩官方网页完成；官方渠道未开放的数据会在界面中如实标注「暂不支持」，
          不会伪造同步结果。学习数据仅保存在本地。
        </p>
      </div>
    </SectionCard>
  );
}
