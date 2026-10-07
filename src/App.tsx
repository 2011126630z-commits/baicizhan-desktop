import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Layout } from "./app/Layout";
import { HomePage } from "./pages/Home";
import { StudyPage } from "./pages/Study";
import { ReviewPage } from "./pages/Review";
import { WordBookPage } from "./pages/WordBook";
import { SearchPage } from "./pages/Search";
import { StatisticsPage } from "./pages/Statistics";
import { SettingsPage } from "./pages/Settings";
import { MiniPage } from "./pages/Mini";
import { ToastHost } from "./components/ui";
import { CloseDialog } from "./components/CloseDialog";

/** 托盘「开始今日学习」跳转（必须在 Router 内部） */
function TrayEvents() {
  const navigate = useNavigate();
  useEffect(() => {
    const un = listen("tray://study", () => navigate("/study"));
    return () => {
      void un.then((f) => f());
    };
  }, [navigate]);
  return null;
}

/** 单词本（收藏/状态浏览）复用 WordBook 页面 */
const NotebookPage = WordBookPage;

export default function App() {
  return (
    <HashRouter>
      <TrayEvents />
      <Routes>
        <Route path="/mini" element={<MiniPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="wordbook" element={<WordBookPage />} />
          <Route path="notebook" element={<NotebookPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="stats" element={<StatisticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastHost />
      <CloseDialog />
    </HashRouter>
  );
}
