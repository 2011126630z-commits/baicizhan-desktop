import { useEffect, useMemo, useState } from "react";
import { api } from "../services/storage/db";
import { BarChart, LineChart } from "../components/charts";
import { EmptyState } from "../components/ui";
import { fmtMinutes } from "../utils/time";
import type { DailyStat } from "../types/models";

type Range = "today" | "7d" | "30d" | "all";

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: "today", label: "今日", days: 1 },
  { key: "7d", label: "7 天", days: 7 },
  { key: "30d", label: "30 天", days: 30 },
  { key: "all", label: "全部", days: 365 },
];

export function StatisticsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    void (async () => {
      const days = RANGES.find((r) => r.key === range)?.days ?? 7;
      setStats(await api.statsDaily(days));
      setStreak(await api.streak());
    })();
  }, [range]);

  const totals = useMemo(() => {
    const learned = stats.reduce((a, b) => a + b.learned, 0);
    const reviewed = stats.reduce((a, b) => a + b.reviewed, 0);
    const minutes = stats.reduce((a, b) => a + b.minutes, 0);
    const activeDays = stats.filter((d) => d.learned + d.reviewed > 0).length;
    const planned = activeDays * 20; // 完成率基于每日计划（默认 20，可在设置调整）
    const rate = planned > 0 ? Math.min(1, learned / planned) : 0;
    return { learned, reviewed, minutes, activeDays, rate };
  }, [stats]);

  const labels = stats.map((s) => s.date);

  return (
    <div>
      <div className="page-title">统计</div>
      <div className="page-sub">全部数据来自本地学习记录，真实可查</div>

      <div className="toolbar">
        {RANGES.map((r) => (
          <button key={r.key} className={`radio-pill ${range === r.key ? "active" : ""}`} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="stat-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{totals.learned}</div>
          <div className="lbl">学习单词数</div>
        </div>
        <div className="stat-card">
          <div className="num">{totals.reviewed}</div>
          <div className="lbl">复习单词数</div>
        </div>
        <div className="stat-card">
          <div className="num">{fmtMinutes(totals.minutes)}</div>
          <div className="lbl">学习时长</div>
        </div>
        <div className="stat-card">
          <div className="num">{streak}</div>
          <div className="lbl">连续学习天数</div>
        </div>
        <div className="stat-card">
          <div className="num">{Math.round(totals.rate * 100)}%</div>
          <div className="lbl">日均完成率</div>
        </div>
      </div>

      {stats.every((s) => s.learned + s.reviewed === 0) ? (
        <EmptyState icon="📊" text="这段时间还没有学习记录" />
      ) : (
        <>
          <div className="card">
            <h3>每日学习数量</h3>
            <LineChart
              labels={labels}
              series={[
                { name: "新学", color: "var(--primary)", data: stats.map((s) => s.learned) },
                { name: "复习", color: "var(--info)", data: stats.map((s) => s.reviewed) },
              ]}
            />
          </div>
          {stats.length <= 31 && (
            <div className="card">
              <h3>新学 vs 复习</h3>
              <BarChart
                labels={labels}
                series={[
                  { name: "新学", color: "var(--primary)", data: stats.map((s) => s.learned) },
                  { name: "复习", color: "var(--info)", data: stats.map((s) => s.reviewed) },
                ]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
