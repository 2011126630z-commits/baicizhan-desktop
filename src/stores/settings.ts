import { create } from "zustand";
import { api } from "../services/storage/db";
import { DEFAULT_HOTKEYS, type HotkeyMap } from "../utils/hotkeys";

interface SettingsState {
  loaded: boolean;
  map: Record<string, string>;
  load: () => Promise<void>;
  set: (key: string, value: string) => Promise<void>;
  get: (key: string, def: string) => string;
}

export const useSettings = create<SettingsState>((set, get) => ({
  loaded: false,
  map: {},
  load: async () => {
    const all = await api.settingsAll();
    const map: Record<string, string> = {};
    for (const [k, v] of all) map[k] = v;
    set({ map, loaded: true });
  },
  set: async (key, value) => {
    set((s) => ({ map: { ...s.map, [key]: value } }));
    await api.settingsSet(key, value);
  },
  get: (key, def) => {
    const v = get().map[key];
    return v === undefined || v === "" ? def : v;
  },
}));

// ---- 便捷选择器 ----
export function themeOf(s: SettingsState): "light" | "dark" | "system" {
  const v = s.get("appearance.theme", "system");
  return v === "light" || v === "dark" ? v : "system";
}

export function fontSizeOf(s: SettingsState): "small" | "standard" | "large" {
  const v = s.get("appearance.fontSize", "standard");
  return v === "small" || v === "large" ? v : "standard";
}

export function dailyNewOf(s: SettingsState): number {
  const v = parseInt(s.get("study.dailyNew", "20"), 10);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 200) : 20;
}

export function hotkeysOf(s: SettingsState): HotkeyMap {
  try {
    const raw = s.map["hotkeys.map"];
    if (raw) return { ...DEFAULT_HOTKEYS, ...JSON.parse(raw) };
  } catch {
    /* 使用默认 */
  }
  return { ...DEFAULT_HOTKEYS };
}

export function boolOf(s: SettingsState, key: string, def: boolean): boolean {
  const v = s.map[key];
  if (v === undefined || v === "") return def;
  return v === "true";
}
