export interface HotkeyMap {
  play: string; // 发音
  known: string; // 认识
  fuzzy: string; // 模糊
  unknown: string; // 不认识
  confirm: string; // 下一步/确认
  favorite: string; // 收藏
  pause: string; // 暂停
  search: string; // 搜索
  settings: string; // 设置
}

export const DEFAULT_HOTKEYS: HotkeyMap = {
  play: "Space",
  known: "1",
  fuzzy: "2",
  unknown: "3",
  confirm: "Enter",
  favorite: "Ctrl+D",
  pause: "Escape",
  search: "Ctrl+K",
  settings: "Ctrl+,",
};

export const HOTKEY_LABELS: Record<keyof HotkeyMap, string> = {
  play: "播放发音",
  known: "认识",
  fuzzy: "模糊",
  unknown: "不认识",
  confirm: "下一步 / 确认",
  favorite: "收藏单词",
  pause: "暂停学习",
  search: "打开搜索",
  settings: "打开设置",
};

/** 将键盘事件规范化为热键字符串，如 "Ctrl+D"、"Space"、"1" */
export function eventHotkey(e: KeyboardEvent): string {
  const key = e.key;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let base = key;
  if (key === " ") base = "Space";
  else if (key === "Escape") base = "Escape";
  else if (key === "Enter") base = "Enter";
  else if (key.length === 1) base = key.toUpperCase();
  else base = key; // ArrowUp / Tab / F11 等
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) {
    // 只按了修饰键本身
    return "";
  }
  return [...parts, base].join("+");
}

export function matchHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const pressed = eventHotkey(e);
  if (!pressed || !hotkey) return false;
  return normalize(pressed) === normalize(hotkey);
}

function normalize(h: string): string {
  return h
    .split("+")
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .sort((a, b) => sortKey(a) - sortKey(b))
    .join("+");
}

function sortKey(p: string): number {
  const order = ["Ctrl", "Alt", "Shift", "Space", "Enter", "Escape"];
  const i = order.indexOf(p);
  return i === -1 ? 10 : i;
}

export function hkLabel(h: string): string {
  const map: Record<string, string> = {
    Space: "空格",
    Enter: "回车",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ",": ",",
  };
  return h
    .split("+")
    .map((p) => map[p] ?? p)
    .join(" + ");
}

/** 检测快捷键冲突，返回冲突的动作名列表 */
export function findConflicts(map: HotkeyMap): string[] {
  const seen = new Map<string, string[]>();
  (Object.keys(map) as (keyof HotkeyMap)[]).forEach((k) => {
    const n = normalize(map[k]);
    if (!seen.has(n)) seen.set(n, []);
    seen.get(n)!.push(k);
  });
  const conflicts: string[] = [];
  seen.forEach((v) => {
    if (v.length > 1) conflicts.push(...v);
  });
  return conflicts;
}
