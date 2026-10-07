import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "../components/Sidebar";
import { StatusBar } from "../components/StatusBar";
import { useUi } from "../stores/toast";
import { matchHotkey } from "../utils/hotkeys";
import { hotkeysOf, useSettings } from "../stores/settings";

export function Layout() {
  const focusMode = useUi((s) => s.focusMode);
  const toggleFocus = useUi((s) => s.toggleFocus);
  const navigate = useNavigate();

  // 全局快捷键：F11/Ctrl+Shift+F 沉浸模式、Ctrl+K 搜索、Ctrl+, 设置
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "F11" || matchHotkey(e, "Ctrl+Shift+F")) {
        e.preventDefault();
        toggleFocus();
        return;
      }
      if (typing) return;
      const hk = hotkeysOf(useSettings.getState());
      if (matchHotkey(e, hk.search)) {
        e.preventDefault();
        navigate("/search");
      } else if (matchHotkey(e, hk.settings)) {
        e.preventDefault();
        navigate("/settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, toggleFocus]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", focusMode);
  }, [focusMode]);

  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
