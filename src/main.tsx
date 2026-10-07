import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import App from "./App";
import { createRoot } from "react-dom/client";
import { api } from "./services/storage/db";
import { StudyService } from "./services/study/StudyService";
import { syncManager } from "./services/sync/SyncManager";
import { useAuth } from "./stores/auth";
import { useSettings, themeOf, fontSizeOf } from "./stores/settings";
import { useStudy } from "./stores/study";
import { useSync } from "./stores/sync";
import "./styles/global.css";

function Bootstrap() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await useSettings.getState().load();
        if (cancelled) return;
        await StudyService.ensureSeedData();
        await useAuth.getState().init();
        const today = await api.statsToday();
        const target = parseInt(useSettings.getState().get("study.dailyNew", "20"), 10) || 20;
        useStudy.setState({ learnedToday: today.learned, reviewedToday: today.reviewed, target });
        const raw = useSettings.getState().map["sync.lastSyncAt"];
        const v = raw ? parseInt(raw, 10) : 0;
        useSync.getState().setLastSyncAt(v > 0 ? v * 1000 : null);
        // 后台同步（不阻塞 UI）
        syncManager.start();
      } catch (e) {
        console.error("启动初始化失败", e);
      }
    })();

    return () => {
      cancelled = true;
      syncManager.stop();
    };
  }, []);

  // 主题应用
  useEffect(() => {
    const apply = () => {
      const t = themeOf(useSettings.getState());
      const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.body.dataset.fontsize = fontSizeOf(useSettings.getState());
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    const unsub = useSettings.subscribe(() => apply());
    return () => {
      mq.removeEventListener("change", apply);
      unsub();
    };
  }, []);

  return <App />;
}

createRoot(document.getElementById("root")!).render(<Bootstrap />);
