use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::{Arc, Mutex};

pub struct Db(pub Arc<Mutex<Connection>>);

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Book {
    pub id: String,
    pub name: String,
    pub source: String,
    pub total: i64,
    pub active: i64,
    #[serde(rename = "syncedAt")]
    pub synced_at: Option<i64>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Example {
    pub en: String,
    pub zh: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Word {
    pub id: String,
    #[serde(rename = "bookId")]
    pub book_id: String,
    pub word: String,
    pub phonetic: Option<String>,
    pub pos: Option<String>,
    pub meanings: Vec<String>,
    pub examples: Vec<Example>,
    #[serde(rename = "audioUrl")]
    pub audio_url: Option<String>,
    pub source: String,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct WordWithProgress {
    #[serde(flatten)]
    pub word: Word,
    pub status: String,
    pub stage: i64,
    #[serde(rename = "wrongCount")]
    pub wrong_count: i64,
    pub favorite: bool,
    #[serde(rename = "lastSeen")]
    pub last_seen: Option<i64>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct StudyRecord {
    pub id: String,
    #[serde(rename = "wordId")]
    pub word_id: String,
    pub word: String,
    #[serde(rename = "bookId")]
    pub book_id: String,
    pub ts: i64,
    pub result: String, // known | fuzzy | unknown
    pub mode: String,   // learn | review
    pub synced: bool,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct DailyStat {
    pub date: String,
    pub learned: i64,
    pub reviewed: i64,
    pub minutes: i64,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct Operation {
    pub id: String,
    #[serde(rename = "opType")]
    pub op_type: String,
    pub payload: String,
    pub status: String, // pending | synced | failed | unsupported
    pub tries: i64,
    pub note: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

pub fn init_db(path: &Path) -> Result<Db, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "journal_mode", "WAL").ok();
    conn.pragma_update(None, "synchronous", "NORMAL").ok();
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    Ok(Db(Arc::new(Mutex::new(conn))))
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local',
  total INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER
);
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  word TEXT NOT NULL,
  phonetic TEXT,
  pos TEXT,
  meanings TEXT NOT NULL DEFAULT '[]',
  examples TEXT NOT NULL DEFAULT '[]',
  audio_url TEXT,
  source TEXT NOT NULL DEFAULT 'local'
);
CREATE INDEX IF NOT EXISTS idx_words_book ON words(book_id);
CREATE INDEX IF NOT EXISTS idx_words_text ON words(word);
CREATE TABLE IF NOT EXISTS word_progress (
  word_id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  favorite INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_progress_book ON word_progress(book_id);
CREATE TABLE IF NOT EXISTS study_records (
  id TEXT PRIMARY KEY,
  word_id TEXT NOT NULL,
  word TEXT NOT NULL,
  book_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  result TEXT NOT NULL,
  mode TEXT NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_records_ts ON study_records(ts);
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  learned INTEGER NOT NULL DEFAULT 0,
  reviewed INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS op_queue (
  id TEXT PRIMARY KEY,
  op_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tries INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL
);
"#;

// 所有查询一律使用 rusqlite params! 宏参数绑定，不拼接 SQL。

pub fn settings_get(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    )
    .optional()
    .ok()
    .flatten()
}

pub fn settings_set(conn: &Connection, key: &str, value: &str) {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .ok();
}

pub fn settings_all(conn: &Connection) -> Vec<(String, String)> {
    let mut stmt = match conn.prepare("SELECT key, value FROM settings") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .ok();
    rows.map(|it| it.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

pub fn row_to_word(r: &rusqlite::Row) -> rusqlite::Result<Word> {
    let meanings_raw: String = r.get("meanings")?;
    let examples_raw: String = r.get("examples")?;
    Ok(Word {
        id: r.get("id")?,
        book_id: r.get("book_id")?,
        word: r.get("word")?,
        phonetic: r.get("phonetic")?,
        pos: r.get("pos")?,
        meanings: serde_json::from_str(&meanings_raw).unwrap_or_default(),
        examples: serde_json::from_str(&examples_raw).unwrap_or_default(),
        audio_url: r.get("audio_url")?,
        source: r.get("source")?,
    })
}

pub fn row_to_word_wp(r: &rusqlite::Row) -> rusqlite::Result<WordWithProgress> {
    let word = row_to_word(r)?;
    Ok(WordWithProgress {
        word,
        status: r.get("status")?,
        stage: r.get("stage")?,
        wrong_count: r.get("wrong_count")?,
        favorite: r.get::<_, i64>("favorite")? != 0,
        last_seen: r.get("last_seen")?,
    })
}

const WORD_WP_SELECT: &str = "SELECT w.id, w.book_id, w.word, w.phonetic, w.pos, w.meanings, w.examples, w.audio_url, w.source,
  COALESCE(p.status, 'new') AS status, COALESCE(p.stage, 0) AS stage, COALESCE(p.wrong_count, 0) AS wrong_count,
  COALESCE(p.favorite, 0) AS favorite, p.last_seen AS last_seen
  FROM words w LEFT JOIN word_progress p ON p.word_id = w.id";

pub fn word_list(conn: &Connection, book_id: Option<&str>) -> Vec<WordWithProgress> {
    let sql = match book_id {
        Some(_) => format!("{WORD_WP_SELECT} WHERE w.book_id = ?1 ORDER BY w.word COLLATE NOCASE"),
        None => format!("{WORD_WP_SELECT} ORDER BY w.word COLLATE NOCASE"),
    };
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let mapper = |r: &rusqlite::Row| row_to_word_wp(r);
    let rows = match book_id {
        Some(b) => stmt.query_map(params![b], mapper),
        None => stmt.query_map([], mapper),
    };
    rows.map(|it| it.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

pub fn word_search(conn: &Connection, q: &str, limit: i64) -> Vec<WordWithProgress> {
    let like = format!("%{}%", q.replace('%', "").replace('_', ""));
    let sql = format!(
        "{WORD_WP_SELECT} WHERE w.word LIKE ?1 ORDER BY (w.word = ?2) DESC, LENGTH(w.word) ASC, w.word COLLATE NOCASE LIMIT ?3"
    );
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map(params![like, q, limit], |r| row_to_word_wp(r))
        .map(|it| it.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

pub fn book_list(conn: &Connection) -> Vec<Book> {
    conn.prepare("SELECT id, name, source, total, active, synced_at FROM books ORDER BY active DESC, name")
        .map(|mut s| {
            s.query_map([], |r| {
                Ok(Book {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    source: r.get(2)?,
                    total: r.get(3)?,
                    active: r.get(4)?,
                    synced_at: r.get(5)?,
                })
            })
            .map(|it| it.filter_map(|x| x.ok()).collect())
            .unwrap_or_default()
        })
        .unwrap_or_default()
}

#[allow(dead_code)]
pub fn active_book(conn: &Connection) -> Option<Book> {
    conn.query_row(
        "SELECT id, name, source, total, active, synced_at FROM books WHERE active = 1 LIMIT 1",
        [],
        |r| {
            Ok(Book {
                id: r.get(0)?,
                name: r.get(1)?,
                source: r.get(2)?,
                total: r.get(3)?,
                active: r.get(4)?,
                synced_at: r.get(5)?,
            })
        },
    )
    .optional()
    .ok()
    .flatten()
}

/// 学习提交：幂等（以 record.id 即 operationId 为准）。
/// 返回 (accepted, learned_today, reviewed_today)
pub fn study_submit(conn: &mut Connection, rec: &StudyRecord) -> Result<(bool, i64, i64), String> {
    let today = today_str();
    let inserted;
    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        inserted = tx
            .execute(
                "INSERT OR IGNORE INTO study_records(id, word_id, word, book_id, ts, result, mode, synced)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)",
                params![rec.id, rec.word_id, rec.word, rec.book_id, rec.ts, rec.result, rec.mode],
            )
            .map_err(|e| e.to_string())?;
        if inserted == 0 {
            // 重复提交（operationId 已存在）——幂等接受，不重复计数
            let learned = stat_of(&tx, &today, "learned");
            let reviewed = stat_of(&tx, &today, "reviewed");
            tx.commit().map_err(|e| e.to_string())?;
            return Ok((false, learned, reviewed));
        }

        // 更新进度（SRS 简化：known +1，fuzzy 不变，unknown -2 且错误数 +1）
        // 只要答过题就标记为 learning（答错的词必须进入复习队列）
        let stage_delta: i64 = match rec.result.as_str() {
            "known" => 1,
            "unknown" => -2,
            _ => 0,
        };
        tx.execute(
            "INSERT INTO word_progress(word_id, book_id, stage, wrong_count, last_seen, status)
             VALUES(?1, ?2, MAX(0, ?3), CASE WHEN ?4 = 'unknown' THEN 1 ELSE 0 END, ?5,
                    CASE WHEN MAX(0, ?3) >= 4 THEN 'mastered' ELSE 'learning' END)
             ON CONFLICT(word_id) DO UPDATE SET
               stage = MAX(0, word_progress.stage + ?3),
               wrong_count = wrong_count + CASE WHEN ?4 = 'unknown' THEN 1 ELSE 0 END,
               last_seen = ?5,
               status = CASE WHEN MAX(0, word_progress.stage + ?3) >= 4 THEN 'mastered' ELSE 'learning' END",
            params![rec.word_id, rec.book_id, stage_delta, rec.result, rec.ts],
        )
        .map_err(|e| e.to_string())?;

        let col = if rec.mode == "review" { "reviewed" } else { "learned" };
        // 列名来自内部常量（learned/reviewed），值仍为绑定参数
        let sql = format!(
            "INSERT INTO daily_stats(date, {col}) VALUES(?1, 1)
             ON CONFLICT(date) DO UPDATE SET {col} = {col} + 1"
        );
        tx.execute(&sql, params![today]).map_err(|e| e.to_string())?;

        // 进入同步队列（先本地持久化，再由 SyncWorker 决定去向）
        let payload = serde_json::to_string(rec).unwrap_or_else(|_| "{}".into());
        tx.execute(
            "INSERT OR IGNORE INTO op_queue(id, op_type, payload, status, tries, created_at)
             VALUES(?1, 'study_record', ?2, 'pending', 0, ?3)",
            params![rec.id, payload, rec.ts],
        )
        .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }
    let learned = stat_of(conn, &today, "learned");
    let reviewed = stat_of(conn, &today, "reviewed");
    Ok((true, learned, reviewed))
}

fn stat_of(conn: &Connection, date: &str, col: &str) -> i64 {
    let sql = format!("SELECT {col} FROM daily_stats WHERE date = ?1");
    conn.query_row(&sql, params![date], |r| r.get::<_, i64>(0))
        .unwrap_or(0)
}

pub fn today_str() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// 到期复习词：已学（stage>0 或有记录）且距上次学习超过间隔。
pub fn review_due(conn: &Connection, limit: i64) -> Vec<WordWithProgress> {
    let now = chrono::Utc::now().timestamp();
    let sql = format!(
        "{WORD_WP_SELECT} JOIN study_records sr ON sr.word_id = w.id
         WHERE COALESCE(p.stage, 0) >= 0 AND p.status != 'new'
           AND (p.last_seen IS NULL OR p.last_seen + (MAX(1, p.stage) * 86400) <= ?1)
         GROUP BY w.id ORDER BY p.last_seen ASC LIMIT ?2"
    );
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map(params![now, limit], |r| row_to_word_wp(r))
        .map(|it| it.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

pub fn streak_days(conn: &Connection) -> i64 {
    let mut stmt = match conn.prepare("SELECT date FROM daily_stats WHERE learned + reviewed > 0 ORDER BY date DESC") {
        Ok(s) => s,
        Err(_) => return 0,
    };
    let dates: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map(|it| it.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();
    if dates.is_empty() {
        return 0;
    }
    let today = today_str();
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();
    if dates[0] != today && dates[0] != yesterday {
        return 0;
    }
    let mut streak = 1i64;
    let mut prev = chrono::NaiveDate::parse_from_str(&dates[0], "%Y-%m-%d").ok();
    for d in dates.iter().skip(1) {
        let cur = chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok();
        if let (Some(c), Some(p)) = (cur, prev) {
            if (p - c).num_days() == 1 {
                streak += 1;
                prev = Some(c);
            } else {
                break;
            }
        } else {
            break;
        }
    }
    streak
}
