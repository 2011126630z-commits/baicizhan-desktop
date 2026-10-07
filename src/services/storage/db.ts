import { cmd } from "../../utils/invoke";
import type {
  Book,
  CapabilityReport,
  CookieData,
  DailyStat,
  HttpResult,
  Operation,
  StudyRecord,
  Word,
  WordWithProgress,
} from "../../types/models";

export interface BookImportPayload {
  book: Book;
  words: Word[];
}

export const api = {
  // 设置
  settingsAll: () => cmd<[string, string][]>("settings_all"),
  settingsSet: (key: string, value: string) => cmd<void>("settings_set", { key, value }),

  // 词书与单词
  bookList: () => cmd<Book[]>("book_list"),
  bookImport: (payload: BookImportPayload) => cmd<number>("book_import", { payload }),
  bookSetActive: (id: string) => cmd<void>("book_set_active", { id }),
  wordList: (bookId?: string | null) => cmd<WordWithProgress[]>("word_list", { bookId: bookId ?? null }),
  wordSearch: (q: string, limit = 50) => cmd<WordWithProgress[]>("word_search", { q, limit }),
  favoriteToggle: (wordId: string, bookId: string) =>
    cmd<boolean>("favorite_toggle", { wordId, bookId }),
  reviewDue: (limit = 100) => cmd<WordWithProgress[]>("review_due", { limit }),

  // 学习记录与统计
  studySubmit: (record: StudyRecord) =>
    cmd<{ accepted: boolean; learnedToday: number; reviewedToday: number }>("study_submit", { record }),
  studyHeartbeat: (seconds: number) => cmd<void>("study_heartbeat", { seconds }),
  recordRecent: (limit = 50) => cmd<StudyRecord[]>("record_recent", { limit }),
  statsDaily: (days: number) => cmd<DailyStat[]>("stats_daily", { days }),
  statsToday: () => cmd<DailyStat>("stats_today"),
  streak: () => cmd<number>("streak"),

  // 操作队列
  queueList: (status?: string | null) => cmd<Operation[]>("queue_list", { status: status ?? null }),
  queueMark: (ids: string[], status: Operation["status"], note?: string | null) =>
    cmd<void>("queue_mark", { ids, status, note: note ?? null }),

  // 发音
  speak: (text: string) => cmd<void>("speak", { text }),

  // 会话与登录
  sessionSave: (cookies: CookieData[]) => cmd<void>("session_save", { cookies }),
  sessionClear: () => cmd<void>("session_clear"),
  sessionExists: () => cmd<boolean>("session_exists"),
  openLoginWindow: () => cmd<void>("open_login_window"),
  closeLoginWindow: () => cmd<void>("close_login_window"),
  captureLoginCookies: () => cmd<number>("capture_login_cookies"),

  // 网络（经 Rust 端，带 SSRF 防护）
  httpRequest: (
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string,
  ) => cmd<HttpResult>("http_request", { method, url, headers: headers ?? null, body: body ?? null }),

  // 窗口与应用
  showMainWindow: () => cmd<void>("show_main_window"),
  hideMainWindow: () => cmd<void>("hide_main_window"),
  appExit: () => cmd<void>("app_exit"),
  showMiniWindow: () => cmd<void>("show_mini_window"),
  setMiniAlwaysTop: (flag: boolean) => cmd<void>("set_mini_always_top", { flag }),
  appMeta: () => cmd<{ version: string; buildTime: string; arch: string; os: string }>("app_meta"),
  exportCapabilitiesReport: (md: string) => cmd<string[]>("export_capabilities_report", { md }),
};
