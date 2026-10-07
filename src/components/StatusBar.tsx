import { useEffect, useState } from "react";
import { api } from "../services/storage/db";
import { useStudy } from "../stores/study";
import { SyncBadge } from "./SyncBadge";

function useStreak(refreshKey: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    void api
      .streak()
      .then(setN)
      .catch(() => {});
  }, [refreshKey]);
  return n;
}

export function StatusBar() {
  const { learnedToday, reviewedToday, target } = useStudy();
  const streak = useStreak(learnedToday * 1000 + reviewedToday);

  return (
    <footer className="status-bar">
      <span>
        今日 <b>{learnedToday}</b>/{target} 词
      </span>
      <span className="sep">|</span>
      <span>
        已复习 <b>{reviewedToday}</b>
      </span>
      <span className="sep">|</span>
      <span>
        连续 <b>{streak}</b> 天
      </span>
      <span style={{ flex: 1 }} />
      <SyncBadge />
    </footer>
  );
}
