import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bookmark,
  Home,
  Library,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/storage/db";

export function Sidebar() {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const due = await api.reviewDue(999);
        if (alive) setDueCount(due.length);
      } catch {
        /* ignore */
      }
    };
    void refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const items = [
    { to: "/", icon: Home, label: "今日学习", end: true },
    { to: "/study", icon: Zap, label: "背单词" },
    { to: "/review", icon: RotateCcw, label: "复习", badge: dueCount },
    { to: "/wordbook", icon: Library, label: "单词书" },
    { to: "/notebook", icon: Bookmark, label: "单词本" },
    { to: "/search", icon: Search, label: "搜索" },
    { to: "/stats", icon: BarChart3, label: "统计" },
  ];

  return (
    <aside className="sidebar">
      <div className="logo">
        <img src="/icon.svg" alt="logo" />
        <span className="name">百词斩桌面版</span>
        <span className="badge">非官方</span>
      </div>
      {items.map(({ to, icon: Icon, label, end, badge }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
          <Icon size={17} strokeWidth={2} />
          <span>{label}</span>
          {badge ? <span className="nav-badge">{badge > 99 ? "99+" : badge}</span> : null}
        </NavLink>
      ))}
      <div className="nav-spacer" />
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
        <SettingsIcon size={17} strokeWidth={2} />
        <span>设置</span>
      </NavLink>
    </aside>
  );
}
