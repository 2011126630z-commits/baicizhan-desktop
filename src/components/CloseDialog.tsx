import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Modal, Toggle } from "./ui";
import { api } from "../services/storage/db";
import { useSettings } from "../stores/settings";

/** 主窗口关闭拦截对话框：关闭程序 / 最小化到托盘（可记住选择） */
export function CloseDialog() {
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listen("app://close-requested", () => setOpen(true)).then((f) => (unlisten = f));
    return () => {
      unlisten?.();
    };
  }, []);

  const choose = async (mode: "exit" | "tray") => {
    setOpen(false);
    if (remember) {
      await useSettings.getState().set("desktop.closeBehavior", mode);
    }
    if (mode === "exit") {
      await api.appExit();
    } else {
      await api.hideMainWindow();
    }
  };

  return (
    <Modal open={open} title="关闭百词斩桌面版" onClose={() => setOpen(false)}>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 14 }}>
        选择关闭窗口时的行为。选择「最小化到托盘」后，程序会继续在系统托盘运行，方便随时开始学习。
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Toggle on={remember} onChange={setRemember} />
        <span style={{ fontSize: 13 }}>记住我的选择，不再询问</span>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn" onClick={() => void choose("tray")}>
          最小化到托盘
        </button>
        <button className="btn btn-primary" onClick={() => void choose("exit")}>
          退出程序
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 12 }}>
        提示：之后可在「设置 → 桌面行为」中修改。
      </p>
    </Modal>
  );
}
