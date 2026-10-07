export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtDateCN(date: string): string {
  const [_, m, d] = date.split("-");
  if (!m || !d) return date;
  return `${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

function toDate(ts: number): Date {
  // Rust 端为秒级时间戳，前端可能产生毫秒
  return ts > 1e11 ? new Date(ts) : new Date(ts * 1000);
}

export function fmtTime(ts?: number | null): string {
  if (!ts) return "—";
  const t = toDate(ts);
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

export function fmtDateTime(ts?: number | null): string {
  if (!ts) return "—";
  const t = toDate(ts);
  return `${t.getMonth() + 1}月${t.getDate()}日 ${String(t.getHours()).padStart(2, "0")}:${String(
    t.getMinutes(),
  ).padStart(2, "0")}`;
}

export function relativeTime(ts?: number | null): string {
  if (!ts) return "从未";
  const t = toDate(ts).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 13) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`;
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分`;
}
