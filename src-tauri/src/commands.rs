use crate::db::{self, Book, DailyStat, Db, Operation, StudyRecord, Word, WordWithProgress};
use crate::http_client::{self, CookieData, HttpState};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct TtsState(pub Mutex<Option<tts::Tts>>);

// ---------- 设置 ----------

#[tauri::command]
pub fn settings_get(db: State<Db>, key: String) -> Option<String> {
    let conn = db.0.lock().unwrap();
    db::settings_get(&conn, &key)
}

#[tauri::command]
pub fn settings_set(db: State<Db>, key: String, value: String) {
    let conn = db.0.lock().unwrap();
    db::settings_set(&conn, &key, &value);
}

#[tauri::command]
pub fn settings_all(db: State<Db>) -> Vec<(String, String)> {
    let conn = db.0.lock().unwrap();
    db::settings_all(&conn)
}

// ---------- 词书与单词 ----------

#[tauri::command]
pub fn book_list(db: State<Db>) -> Vec<Book> {
    let conn = db.0.lock().unwrap();
    db::book_list(&conn)
}

#[tauri::command]
pub fn book_set_active(db: State<Db>, id: String) -> Result<(), String> {
    let mut conn = db.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("UPDATE books SET active = 0", []).map_err(|e| e.to_string())?;
    tx.execute("UPDATE books SET active = 1 WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct BookImportPayload {
    pub book: Book,
    pub words: Vec<Word>,
}

#[tauri::command]
pub fn book_import(db: State<Db>, payload: BookImportPayload) -> Result<usize, String> {
    let mut conn = db.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO books(id, name, source, total, active, synced_at)
         VALUES(?1, ?2, ?3, 0, ?4, NULL)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, source = excluded.source",
        params![payload.book.id, payload.book.name, payload.book.source, payload.book.active],
    )
    .map_err(|e| e.to_string())?;
    if payload.book.active == 1 {
        tx.execute("UPDATE books SET active = 0 WHERE id != ?1", params![payload.book.id])
            .map_err(|e| e.to_string())?;
    }
    for w in &payload.words {
        let meanings = serde_json::to_string(&w.meanings).unwrap_or_else(|_| "[]".into());
        let examples = serde_json::to_string(&w.examples).unwrap_or_else(|_| "[]".into());
        tx.execute(
            "INSERT OR REPLACE INTO words(id, book_id, word, phonetic, pos, meanings, examples, audio_url, source)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![w.id, w.book_id, w.word, w.phonetic, w.pos, meanings, examples, w.audio_url, w.source],
        )
        .map_err(|e| e.to_string())?;
    }
    let count: i64 = tx
        .query_row("SELECT COUNT(*) FROM words WHERE book_id = ?1", params![payload.book.id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    tx.execute("UPDATE books SET total = ?1 WHERE id = ?2", params![count, payload.book.id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count as usize)
}

#[tauri::command]
pub fn word_list(db: State<Db>, book_id: Option<String>) -> Vec<WordWithProgress> {
    let conn = db.0.lock().unwrap();
    db::word_list(&conn, book_id.as_deref())
}

#[tauri::command]
pub fn word_search(db: State<Db>, q: String, limit: Option<i64>) -> Vec<WordWithProgress> {
    let conn = db.0.lock().unwrap();
    db::word_search(&conn, &q, limit.unwrap_or(50))
}

#[tauri::command]
pub fn favorite_toggle(db: State<Db>, word_id: String, book_id: String) -> Result<bool, String> {
    let conn = db.0.lock().unwrap();
    let cur: Option<i64> = conn
        .query_row(
            "SELECT favorite FROM word_progress WHERE word_id = ?1",
            params![word_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let new_val = match cur {
        Some(v) => if v != 0 { 0 } else { 1 },
        None => 1,
    };
    conn.execute(
        "INSERT INTO word_progress(word_id, book_id, favorite) VALUES(?1, ?2, ?3)
         ON CONFLICT(word_id) DO UPDATE SET favorite = ?3",
        params![word_id, book_id, new_val],
    )
    .map_err(|e| e.to_string())?;
    // 收藏变更进入队列（能否回写由 SyncManager 依据能力决定）
    let payload = serde_json::json!({ "wordId": word_id, "favorite": new_val == 1 });
    conn.execute(
        "INSERT OR REPLACE INTO op_queue(id, op_type, payload, status, tries, created_at)
         VALUES(?1, 'favorite', ?2, 'pending', 0, ?3)",
        params![format!("fav-{word_id}"), payload.to_string(), chrono::Utc::now().timestamp()],
    )
    .map_err(|e| e.to_string())?;
    Ok(new_val == 1)
}

#[tauri::command]
pub fn review_due(db: State<Db>, limit: Option<i64>) -> Vec<WordWithProgress> {
    let conn = db.0.lock().unwrap();
    db::review_due(&conn, limit.unwrap_or(100))
}

// ---------- 学习记录与统计 ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitOutcome {
    pub accepted: bool,
    pub learned_today: i64,
    pub reviewed_today: i64,
}

#[tauri::command]
pub fn study_submit(db: State<Db>, record: StudyRecord) -> Result<SubmitOutcome, String> {
    let mut conn = db.0.lock().unwrap();
    let (accepted, learned, reviewed) = db::study_submit(&mut conn, &record)?;
    Ok(SubmitOutcome {
        accepted,
        learned_today: learned,
        reviewed_today: reviewed,
    })
}

#[tauri::command]
pub fn study_heartbeat(db: State<Db>, seconds: i64) {
    let conn = db.0.lock().unwrap();
    let secs = seconds.clamp(0, 600);
    let today = db::today_str();
    conn.execute(
        "INSERT INTO daily_stats(date, minutes) VALUES(?1, ?2)
         ON CONFLICT(date) DO UPDATE SET minutes = minutes + ?2",
        params![today, secs],
    )
    .ok();
}

#[tauri::command]
pub fn record_recent(db: State<Db>, limit: Option<i64>) -> Vec<StudyRecord> {
    let conn = db.0.lock().unwrap();
    let limit = limit.unwrap_or(50);
    conn.prepare("SELECT id, word_id, word, book_id, ts, result, mode, synced FROM study_records ORDER BY ts DESC LIMIT ?1")
        .and_then(|mut s| {
            s.query_map(params![limit], |r| {
                Ok(StudyRecord {
                    id: r.get(0)?,
                    word_id: r.get(1)?,
                    word: r.get(2)?,
                    book_id: r.get(3)?,
                    ts: r.get(4)?,
                    result: r.get(5)?,
                    mode: r.get(6)?,
                    synced: r.get::<_, i64>(7)? != 0,
                })
            })
            .map(|it| it.filter_map(|x| x.ok()).collect())
        })
        .unwrap_or_default()
}

#[tauri::command]
pub fn stats_daily(db: State<Db>, days: i64) -> Vec<DailyStat> {
    let conn = db.0.lock().unwrap();
    let today = chrono::Local::now().date_naive();
    let mut out = Vec::new();
    for i in (0..days).rev() {
        let d = today - chrono::Duration::days(i);
        let ds = d.format("%Y-%m-%d").to_string();
        let (learned, reviewed, minutes) = conn
            .query_row(
                "SELECT learned, reviewed, minutes FROM daily_stats WHERE date = ?1",
                params![ds],
                |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
            )
            .unwrap_or((0, 0, 0));
        out.push(DailyStat { date: ds, learned, reviewed, minutes });
    }
    out
}

#[tauri::command]
pub fn stats_today(db: State<Db>) -> DailyStat {
    let conn = db.0.lock().unwrap();
    let today = db::today_str();
    let (learned, reviewed, minutes) = conn
        .query_row(
            "SELECT learned, reviewed, minutes FROM daily_stats WHERE date = ?1",
            params![today],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
        )
        .unwrap_or((0, 0, 0));
    DailyStat { date: today, learned, reviewed, minutes }
}

#[tauri::command]
pub fn streak(db: State<Db>) -> i64 {
    let conn = db.0.lock().unwrap();
    db::streak_days(&conn)
}

// ---------- 操作队列 ----------

#[tauri::command]
pub fn queue_list(db: State<Db>, status: Option<String>) -> Vec<Operation> {
    let conn = db.0.lock().unwrap();
    let sql = match status.as_deref() {
        Some(_) => "SELECT id, op_type, payload, status, tries, note, created_at FROM op_queue WHERE status = ?1 ORDER BY created_at ASC",
        None => "SELECT id, op_type, payload, status, tries, note, created_at FROM op_queue ORDER BY created_at ASC",
    };
    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapper = |r: &rusqlite::Row| {
        Ok(Operation {
            id: r.get(0)?,
            op_type: r.get(1)?,
            payload: r.get(2)?,
            status: r.get(3)?,
            tries: r.get(4)?,
            note: r.get(5)?,
            created_at: r.get(6)?,
        })
    };
    let rows = match status.as_deref() {
        Some(st) => stmt.query_map(params![st], mapper),
        None => stmt.query_map([], mapper),
    };
    rows.map(|it| it.filter_map(|r| r.ok()).collect()).unwrap_or_default()
}

#[tauri::command]
pub fn queue_mark(db: State<Db>, ids: Vec<String>, status: String, note: Option<String>) {
    let conn = db.0.lock().unwrap();
    for id in ids {
        conn.execute(
            "UPDATE op_queue SET status = ?1, note = ?2 WHERE id = ?3",
            params![status, note, id],
        )
        .ok();
    }
}

/// 官方回写真正成功后才调用：把学习记录标记 synced，保证队列与记录状态一致。
#[tauri::command]
pub fn mark_study_records_synced(db: State<Db>, ids: Vec<String>) -> Result<usize, String> {
    let conn = db.0.lock().unwrap();
    let mut updated = 0usize;
    for id in ids {
        updated += conn
            .execute(
                "UPDATE study_records SET synced = 1 WHERE id = ?1",
                params![id],
            )
            .map_err(|e| e.to_string())?;
    }
    Ok(updated)
}

// ---------- 本地数据摘要（设置 → 同步页展示用；与官方状态严格分开） ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDataSummary {
    pub records: i64,
    pub pending_ops: i64,
    pub unsupported_ops: i64,
    pub failed_ops: i64,
    pub words: i64,
    pub favorites: i64,
}

#[tauri::command]
pub fn local_data_summary(db: State<Db>) -> LocalDataSummary {
    let conn = db.0.lock().unwrap();
    let count = |sql: &str| -> i64 { conn.query_row(sql, [], |r| r.get(0)).unwrap_or(0) };
    LocalDataSummary {
        records: count("SELECT COUNT(*) FROM study_records"),
        pending_ops: count("SELECT COUNT(*) FROM op_queue WHERE status = 'pending'"),
        unsupported_ops: count("SELECT COUNT(*) FROM op_queue WHERE status = 'unsupported'"),
        failed_ops: count("SELECT COUNT(*) FROM op_queue WHERE status = 'failed'"),
        words: count("SELECT COUNT(*) FROM words"),
        favorites: count("SELECT COUNT(*) FROM word_progress WHERE favorite = 1"),
    }
}

// ---------- 官方数据缓存（仅当官方 READ 真正成功时写入） ----------

#[tauri::command]
pub fn official_cache_put(db: State<Db>, key: String, payload: String) -> Result<(), String> {
    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO official_cache(key, payload, synced_at) VALUES(?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, synced_at = excluded.synced_at",
        params![key, payload, chrono::Utc::now().timestamp()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn official_cache_get(db: State<Db>, key: String) -> Option<(String, i64)> {
    let conn = db.0.lock().unwrap();
    conn.query_row(
        "SELECT payload, synced_at FROM official_cache WHERE key = ?1",
        params![key],
        |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)),
    )
    .optional()
    .ok()
    .flatten()
}

// ---------- 发音（本地 TTS） ----------

#[tauri::command]
pub fn speak(state: State<TtsState>, text: String) -> Result<(), String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Ok(());
    }
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        *guard = Some(tts::Tts::default().map_err(|e| format!("语音初始化失败: {e}"))?);
    }
    guard
        .as_mut()
        .unwrap()
        .speak(&text, true)
        .map(|_| ())
        .map_err(|e| format!("语音播放失败: {e}"))
}

// ---------- 会话 ----------

#[tauri::command]
pub fn session_save(cookies: Vec<CookieData>) -> Result<usize, String> {
    http_client::replace_cookies(cookies)
}

#[tauri::command]
pub fn session_clear(http: State<HttpState>) {
    http_client::clear_cookies();
    http.cookies.lock().unwrap().clear();
}

#[tauri::command]
pub fn session_exists() -> bool {
    http_client::has_cookies()
}

/// 登录真实性验证：携带会话访问官方页面并分析登录特征。
/// 找不到可靠证据即返回 unverified（“会话已捕获，身份未验证”），绝不把 200 当作已登录。
#[tauri::command]
pub async fn verify_session(http: State<'_, HttpState>) -> Result<http_client::SessionProbeResult, String> {
    let result = http_client::probe_session(&http).await;
    // 只记录 verdict 与状态码，绝不记录会话内容
    log::info!(
        "session probe: verdict={} status={:?}",
        result.verdict,
        result.http_status
    );
    Ok(result)
}

// ---------- 官方登录窗口 ----------
// 注意：凡是在命令里创建/操作 WebviewWindow 的都必须用 async 命令，
// 因为同步命令运行在主线程，builder.build() 会在主线程等待自身从而死锁。

/// 简单 percent-decode（用于展示 redirect_uri 解码后的值；不处理 + 号）
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// 捕获微信 OAuth 调试信息（仅参数结构；URL 中不含 Cookie/密码/code）；
/// state 只记录长度与前 8 位（CSRF 一次性值，不完整留存）。
fn capture_wechat_oauth_debug(app: &AppHandle, url: &tauri::Url) {
    let query: std::collections::HashMap<String, String> = url
        .query_pairs()
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    let redirect_raw = query.get("redirect_uri").cloned().unwrap_or_default();
    let decoded = percent_decode(&redirect_raw);
    let double_encoded = redirect_raw.contains("%253A") || redirect_raw.contains("%252F");
    let state_preview = query
        .get("state")
        .map(|s| s.chars().take(8).collect::<String>())
        .unwrap_or_default();
    let info = serde_json::json!({
        "sourcePage": http_client::official_login_url(),
        "oAuthHost": url.host_str().unwrap_or_default(),
        "appid": query.get("appid").cloned().unwrap_or_default(),
        "redirectUriRaw": redirect_raw,
        "redirectUriDecoded": decoded,
        "responseType": query.get("response_type").cloned().unwrap_or_default(),
        "scope": query.get("scope").cloned().unwrap_or_default(),
        "statePreview": state_preview,
        "stateLength": query.get("state").map(|s| s.len()).unwrap_or(0),
        "doubleEncoded": double_encoded,
        "clientModified": false,
        "capturedAt": chrono::Utc::now().timestamp(),
    });
    if let Some(db) = app.try_state::<Db>() {
        if let Ok(conn) = db.0.lock() {
            db::settings_set(&conn, "auth.wechatOAuthDebug", &info.to_string());
        }
    }
}

#[tauri::command]
pub async fn open_login_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    // 直接打开官方登录路由（实测存在且服务端登录逻辑在线；营销首页无该入口链接）
    let url: tauri::Url = http_client::official_login_url()
        .parse()
        .map_err(|e| format!("{e}"))?;
    let app_for_nav = app.clone();
    tauri::WebviewWindowBuilder::new(&app, "login", tauri::WebviewUrl::External(url))
        .title("百词斩 · 官方登录（请在官方页面完成登录）")
        .inner_size(1020.0, 780.0)
        .center()
        .resizable(true)
        // 认证导航白名单：只允许官方域与已知 OAuth 提供方页面；
        // 与 Cookie 白名单严格独立（第三方域永远拿不到百词斩 Cookie）。
        .on_navigation(move |u| {
            let host = u.host_str().unwrap_or_default();
            let ok = http_client::is_allowed_auth_navigation(host);
            if !ok {
                log::warn!("login window blocked navigation to non-auth host: {host}");
            }
            // 微信 OAuth 调试：记录参数结构（用于对照测试，不含凭据）
            if host.ends_with("weixin.qq.com") && u.path().contains("connect") {
                capture_wechat_oauth_debug(&app_for_nav, u);
            }
            ok
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_login_window(app: AppHandle) {
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.close();
    }
}

/// 用户在官方页面完成登录后点击确认：从官方域读取会话 Cookie（只取会话，不碰密码）
#[tauri::command]
pub async fn capture_login_cookies(app: AppHandle, http: State<'_, HttpState>) -> Result<usize, String> {
    let window = app
        .get_webview_window("login")
        .ok_or("登录窗口已关闭，请重新打开")?;
    let target: tauri::Url = http_client::official_origin().parse().map_err(|e| format!("{e}"))?;
    let cookies = window
        .cookies_for_url(target)
        .map_err(|e| format!("读取登录会话失败: {e}"))?;
    let list: Vec<CookieData> = cookies
        .iter()
        .map(|c| CookieData {
            name: c.name().to_string(),
            value: c.value().to_string(),
            domain: c.domain().map(|s| s.to_string()),
            path: c.path().map(|s| s.to_string()),
            secure: None,
            expires: None,
            http_only: None,
        })
        .collect();
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.close();
    }
    // replace_cookies 内部会过滤：非百词斩官方域名的 Cookie 一律丢弃；
    // 若过滤后为空则返回错误（未登录或仅匿名 Cookie），前端不会显示“登录成功”。
    let accepted = http_client::replace_cookies(list)?;
    let _ = http; // 会话统一存放于 HttpState（下次请求自动生效）
    Ok(accepted)
}

// ---------- HTTP（供适配器使用，内置 SSRF 防护） ----------

#[tauri::command]
pub async fn http_request(
    http: State<'_, HttpState>,
    method: String,
    url: String,
    headers: Option<BTreeMap<String, String>>,
    body: Option<String>,
) -> Result<http_client::HttpResult, String> {
    let empty = BTreeMap::new();
    let headers = headers.as_ref().unwrap_or(&empty);
    http_client::request(&http, &method, &url, headers, body.as_deref()).await
}

// ---------- 窗口管理 ----------

#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    crate::tray::show_main(&app);
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn show_mini_window(app: AppHandle, db: State<'_, Db>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("mini") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }
    let always_top = db::settings_get(&db.0.lock().unwrap(), "desktop.miniAlwaysTop")
        .map(|v| v == "true")
        .unwrap_or(false);
    let w = tauri::WebviewWindowBuilder::new(&app, "mini", tauri::WebviewUrl::App("index.html#/mini".into()))
        .title("小窗背词")
        .inner_size(400.0, 280.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(always_top)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    // 确保小窗浮到主窗口之上（用户点「小窗背词」就是希望它立刻可见）
    let _ = w.set_focus();
    Ok(())
}

#[tauri::command]
pub fn set_mini_always_top(app: AppHandle, db: State<Db>, flag: bool) {
    {
        let conn = db.0.lock().unwrap();
        db::settings_set(&conn, "desktop.miniAlwaysTop", if flag { "true" } else { "false" });
    }
    if let Some(w) = app.get_webview_window("mini") {
        let _ = w.set_always_on_top(flag);
    }
}

// ---------- 应用信息与能力报告 ----------

#[tauri::command]
pub fn app_meta() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "buildTime": option_env!("BUILD_TIME").unwrap_or("dev"),
        "arch": std::env::consts::ARCH,
        "os": "windows",
    })
}

#[tauri::command]
pub fn export_capabilities_report(app: AppHandle, md: String) -> Result<Vec<String>, String> {
    let mut written = Vec::new();
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let p1 = data_dir.join("capabilities.md");
    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    std::fs::write(&p1, &md).map_err(|e| e.to_string())?;
    written.push(p1.to_string_lossy().to_string());
    // 开发模式下同时写入项目 docs/，方便入库（cwd 可能是 src-tauri 或项目根目录）
    if cfg!(debug_assertions) {
        if let Ok(cwd) = std::env::current_dir() {
            let base = if cwd.file_name().map(|n| n == "src-tauri").unwrap_or(false) {
                cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd.clone())
            } else {
                cwd.clone()
            };
            let docs = base.join("docs").join("capabilities.md");
            if std::fs::create_dir_all(docs.parent().unwrap_or(&base)).is_ok() {
                if std::fs::write(&docs, &md).is_ok() {
                    written.push(docs.to_string_lossy().to_string());
                }
            }
        }
    }
    Ok(written)
}
