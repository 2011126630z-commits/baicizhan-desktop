use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use url::Url;

/// 官方根域：任何携带认证信息的请求只允许发往该域及其子域。
const OFFICIAL_ROOT: &str = "baicizhan.com";
const OFFICIAL_ORIGIN: &str = "https://www.baicizhan.com/";
/// 官方网页登录入口（2026-10-07 实测：页面存在且服务端登录逻辑在线）。
/// 注意：官网营销首页（/）没有指向该页面的链接，但该路由本身仍然有效。
const OFFICIAL_LOGIN_URL: &str = "https://www.baicizhan.com/login";
/// 官方网页版欢迎/体验页（同样保留：有"点此登录"入口）。
const OFFICIAL_HELLO_URL: &str = "https://www.baicizhan.com/hello";
const COOKIE_KEY: &str = "session.cookies";
const MAX_REDIRECTS: usize = 5;

/// 严格的主机白名单（安全关键）：
/// - 允许 `baicizhan.com` 与任意 `*.baicizhan.com`
/// - 拒绝 `evilbaicizhan.com`（后缀陷阱）
/// - 拒绝 `baicizhan.com.evil.com`（子域伪装）
/// - 拒绝 IP 字面量与任何第三方域名
pub fn is_allowed_official_host(host: &str) -> bool {
    let h = host.trim().trim_end_matches('.').to_ascii_lowercase();
    if h.is_empty() {
        return false;
    }
    h == OFFICIAL_ROOT || h.ends_with(&format!(".{OFFICIAL_ROOT}"))
}

/// 会话 Cookie 完整字段（按域名管理；绝不输出到日志/UI/报告）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CookieEntry {
    pub name: String,
    pub value: String,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub secure: Option<bool>,
    #[serde(default)]
    pub expires: Option<i64>,
    #[serde(default)]
    pub http_only: Option<bool>,
}

/// 兼容旧版本的简化 Cookie 载荷（前端采集用）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CookieData {
    pub name: String,
    pub value: String,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub secure: Option<bool>,
    #[serde(default)]
    pub expires: Option<i64>,
    #[serde(default)]
    pub http_only: Option<bool>,
}

pub struct HttpState {
    /// 内存中的会话 Cookie（同时持久化到 Windows 凭据管理器）
    pub cookies: Mutex<Vec<CookieEntry>>,
    client: reqwest::Client,
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Cookie 是否应发送给 target：
/// - domain：host-only 或后缀匹配（.example.com 形式）
/// - path：目标路径必须以 cookie path 为前缀
/// - secure / 过期：不满足则不发送
fn cookie_matches(c: &CookieEntry, host: &str, path: &str) -> bool {
    if let Some(exp) = c.expires {
        if exp > 0 && exp < now_unix() {
            return false;
        }
    }
    if c.value.is_empty() {
        return false;
    }
    let host_l = host.to_ascii_lowercase();
    let domain_ok = match c.domain.as_deref() {
        Some(d) if !d.trim().is_empty() => {
            let d = d.trim().trim_start_matches('.').to_ascii_lowercase();
            host_l == d || host_l.ends_with(&format!(".{d}"))
        }
        // 无域名信息的 Cookie 一律不发送（保守策略）
        _ => false,
    };
    if !domain_ok {
        return false;
    }
    let cp = c.path.as_deref().unwrap_or("/");
    if !path.starts_with(cp) {
        return false;
    }
    true
}

/// 为指定目标组装 Cookie 请求头（值绝不出现在日志中）
fn cookie_header_for(cookies: &[CookieEntry], host: &str, path: &str) -> Option<String> {
    let pairs: Vec<String> = cookies
        .iter()
        .filter(|c| cookie_matches(c, host, path))
        .map(|c| format!("{}={}", c.name, c.value))
        .collect();
    if pairs.is_empty() {
        None
    } else {
        Some(pairs.join("; "))
    }
}

impl HttpState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(10))
            .user_agent("BaicizhanDesktop/0.2.0 (personal study tool)")
            // 安全关键：逐跳检查重定向目标，离开官方域立即停止（不携带认证继续跳转）
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    return attempt.stop();
                }
                let host = attempt.url().host_str().unwrap_or_default();
                if is_allowed_official_host(host) {
                    attempt.follow()
                } else {
                    attempt.stop()
                }
            }))
            .build()
            .expect("reqwest client");
        HttpState {
            cookies: Mutex::new(load_cookies()),
            client,
        }
    }
}

fn load_cookies() -> Vec<CookieEntry> {
    let raw = crate::secure::secure_get(COOKIE_KEY).unwrap_or_else(|| "[]".into());
    serde_json::from_str::<Vec<CookieEntry>>(&raw).unwrap_or_default()
}

pub fn save_cookies(cookies: &[CookieEntry]) -> Result<(), String> {
    crate::secure::secure_set(COOKIE_KEY, &serde_json::to_string(cookies).unwrap_or_default())
}

pub fn clear_cookies() {
    crate::secure::secure_delete(COOKIE_KEY);
}

pub fn has_cookies() -> bool {
    !load_cookies().is_empty()
}

/// 过滤：只保留官方域名的 Cookie（其余一律丢弃，避免任何第三方 Cookie 进入会话存储）
pub fn filter_official_cookies(cookies: Vec<CookieData>) -> Vec<CookieEntry> {
    cookies
        .into_iter()
        .filter_map(|c| {
            if c.name.trim().is_empty() || c.value.is_empty() {
                return None;
            }
            let domain_ok = c
                .domain
                .as_deref()
                .map(|d| {
                    let d = d.trim().trim_start_matches('.').to_ascii_lowercase();
                    d == OFFICIAL_ROOT || d.ends_with(&format!(".{OFFICIAL_ROOT}"))
                })
                .unwrap_or(false);
            if !domain_ok {
                return None;
            }
            Some(CookieEntry {
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path.or_else(|| Some("/".into())),
                secure: c.secure,
                expires: c.expires,
                http_only: c.http_only,
            })
        })
        .collect()
}

/// 用采集到的 Cookie 覆盖会话（登录成功后调用）。返回接受的 Cookie 数量。
pub fn replace_cookies(cookies: Vec<CookieData>) -> Result<usize, String> {
    let filtered = filter_official_cookies(cookies);
    if filtered.is_empty() {
        return Err("未检测到百词斩官方域名的会话信息（可能尚未登录，或仅为匿名统计 Cookie）".into());
    }
    save_cookies(&filtered)?;
    Ok(filtered.len())
}

/// 认证导航白名单（AUTH_NAVIGATION_ALLOWLIST）：
/// 决定登录窗口允许导航到哪些认证域。与 Cookie 白名单严格分开：
/// - 本函数只控制"登录窗口能不能打开该页面"；
/// - 百词斩 Cookie 的发送永远只走 is_allowed_official_host（第三方 OAuth 域 NEVER 收到百词斩 Cookie）。
pub fn is_allowed_auth_navigation(host: &str) -> bool {
    let h = host.trim().trim_end_matches('.').to_ascii_lowercase();
    if h.is_empty() {
        return false;
    }
    if is_allowed_official_host(&h) {
        return true;
    }
    const THIRD_PARTY: &[&str] = &[
        "weixin.qq.com", // 微信 OAuth（open.weixin.qq.com / login.weixin.qq.com）
        "weibo.com",     // 微博 OAuth
        "sina.com.cn",   // 微博登录（login.sina.com.cn）
        "renren.com",    // 人人 OAuth
        "qq.com",        // 微信流程辅助域
    ];
    THIRD_PARTY
        .iter()
        .any(|root| h == *root || h.ends_with(&format!(".{root}")))
}

/// SSRF / 越权防护：所有出站请求必须指向 https 的官方域名（含子域）。
pub fn validate_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "无效的 URL")?;
    if url.scheme() != "https" {
        return Err("仅允许 https 请求".into());
    }
    let host = url.host_str().ok_or("URL 缺少主机名")?.to_ascii_lowercase();
    // 拒绝任何 IP 字面量（IPv4/IPv6），官方接口均为域名
    if host.parse::<std::net::IpAddr>().is_ok() {
        return Err("不允许直接访问 IP 地址".into());
    }
    if !is_allowed_official_host(&host) {
        return Err(format!(
            "仅允许访问百词斩官方域名（baicizhan.com 及其子域），已拒绝: {host}"
        ));
    }
    Ok(url)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResult {
    pub status: u16,
    pub ok: bool,
    pub body: String,
    pub final_url: String,
    /// 是否被外部域重定向中断（安全事件，仅布尔，不含任何 Cookie/URL 敏感值之外的信息）
    pub redirect_blocked: bool,
}

/// 带 Cookie 的 GET/POST；响应中的 Set-Cookie 会按域名合并回本地会话并持久化。
/// 注意：Cookie 值绝不写入日志、错误信息或返回值。
pub async fn request(
    state: &HttpState,
    method: &str,
    url: &str,
    headers: &std::collections::BTreeMap<String, String>,
    body: Option<&str>,
) -> Result<HttpResult, String> {
    let url = validate_url(url)?;
    let m = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        _ => return Err("不支持的 HTTP 方法".into()),
    };
    let host = url.host_str().unwrap_or_default().to_string();
    let path = url.path().to_string();

    let cookie_header = {
        let cookies = state.cookies.lock().unwrap();
        cookie_header_for(&cookies, &host, &path)
    };

    let mut req = state.client.request(m, url.clone());
    if let Some(h) = cookie_header {
        req = req.header(reqwest::header::COOKIE, h);
    }
    for (k, v) in headers {
        let lower = k.to_ascii_lowercase();
        // 不允许覆盖 Cookie / Host
        if lower == "cookie" || lower == "host" {
            continue;
        }
        req = req.header(k.as_str(), v.as_str());
    }
    if let Some(b) = body {
        req = req.body(b.to_string());
    }

    let resp = req.send().await.map_err(|e| classify_reqwest_err(&e))?;
    let status = resp.status().as_u16();
    let final_url = resp.url().to_string();
    let final_host = resp.url().host_str().unwrap_or_default().to_string();
    let redirect_blocked = !is_allowed_official_host(&final_host);

    // 收集 Set-Cookie（含属性；值仅用于会话存储，不落日志）
    let mut new_entries: Vec<CookieEntry> = Vec::new();
    let mut removed: Vec<String> = Vec::new();
    for v in resp.headers().get_all(reqwest::header::SET_COOKIE) {
        if let Ok(s) = v.to_str() {
            if let Some(entry) = parse_set_cookie(&s, &host, &path) {
                if entry.value.is_empty() {
                    removed.push(entry.name);
                } else {
                    new_entries.push(entry);
                }
            }
        }
    }
    let body_text = resp.text().await.map_err(|e| classify_reqwest_err(&e))?;

    if !new_entries.is_empty() || !removed.is_empty() {
        let mut cookies = state.cookies.lock().unwrap();
        for name in removed {
            cookies.retain(|c| !(c.name == name && host_matches_cookie(&host, c)));
        }
        for e in new_entries {
            if let Some(existing) = cookies
                .iter_mut()
                .find(|c| c.name == e.name && c.domain == e.domain && c.path == e.path)
            {
                *existing = e;
            } else {
                cookies.push(e);
            }
        }
        let _ = save_cookies(&cookies);
    }

    Ok(HttpResult {
        status,
        ok: (200..300).contains(&status),
        body: body_text,
        final_url,
        redirect_blocked,
    })
}

fn host_matches_cookie(host: &str, c: &CookieEntry) -> bool {
    match c.domain.as_deref() {
        Some(d) if !d.trim().is_empty() => {
            let d = d.trim().trim_start_matches('.').to_ascii_lowercase();
            host.to_ascii_lowercase() == d || host.to_ascii_lowercase().ends_with(&format!(".{d}"))
        }
        _ => false,
    }
}

/// 解析 Set-Cookie 行（name=value; Domain=...; Path=...; Secure; HttpOnly; Expires=...）
fn parse_set_cookie(raw: &str, default_host: &str, default_path: &str) -> Option<CookieEntry> {
    let mut parts = raw.split(';');
    let head = parts.next()?;
    let (name, value) = head.split_once('=')?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return None;
    }
    let mut entry = CookieEntry {
        name,
        value: value.trim().to_string(),
        domain: Some(default_host.to_string()),
        path: Some(default_path.to_string()),
        secure: None,
        expires: None,
        http_only: None,
    };
    for attr in parts {
        let attr = attr.trim();
        let (k, v) = match attr.split_once('=') {
            Some((k, v)) => (k.trim().to_ascii_lowercase(), v.trim().to_string()),
            None => (attr.to_ascii_lowercase(), String::new()),
        };
        match k.as_str() {
            "domain" => {
                if !v.is_empty() {
                    entry.domain = Some(v);
                }
            }
            "path" => {
                if !v.is_empty() {
                    entry.path = Some(v);
                }
            }
            "secure" => entry.secure = Some(true),
            "httponly" => entry.http_only = Some(true),
            "max-age" => {
                if let Ok(secs) = v.parse::<i64>() {
                    entry.expires = Some(if secs <= 0 { 1 } else { now_unix() + secs });
                }
            }
            "expires" => {
                if entry.expires.is_none() {
                    // 简化处理：无法精确解析时标记为会话 Cookie（expires=None）
                }
            }
            _ => {}
        }
    }
    // 只接受官方域名的 Set-Cookie
    let domain_ok = entry
        .domain
        .as_deref()
        .map(|d| {
            let d = d.trim().trim_start_matches('.').to_ascii_lowercase();
            d == OFFICIAL_ROOT || d.ends_with(&format!(".{OFFICIAL_ROOT}"))
        })
        .unwrap_or(false);
    if !domain_ok {
        return None;
    }
    Some(entry)
}

fn classify_reqwest_err(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "请求超时，请检查网络后重试".into()
    } else if e.is_connect() {
        "网络连接失败（当前离线或无法访问百词斩官网）".into()
    } else {
        format!("网络请求失败: {e}")
    }
}

pub fn official_origin() -> &'static str {
    OFFICIAL_ORIGIN
}

pub fn official_login_url() -> &'static str {
    OFFICIAL_LOGIN_URL
}

pub fn official_hello_url() -> &'static str {
    OFFICIAL_HELLO_URL
}

// ---------------------------------------------------------------------------
// SessionProbe：登录真实性验证
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionProbeResult {
    /// verified | not_logged_in | unverified | offline | failed
    pub verdict: String,
    pub http_status: Option<u16>,
    pub final_host: Option<String>,
    pub redirected_to_login: bool,
    pub logged_in_markers: Vec<String>,
    pub logged_out_markers: Vec<String>,
    pub note: String,
    pub checked_at: i64,
}

const LOGGED_IN_MARKERS: &[&str] = &[
    "退出登录",
    "个人中心",
    "我的词书",
    "退出账号",
    "user-center",
    "usercenter",
    "logout",
];

const LOGGED_OUT_MARKERS: &[&str] = &[
    "立即登录",
    "登录/注册",
    "注册/登录",
    "请先登录",
    "去登录",
    "passport.baicizhan.com/login",
];

/// 登录状态探测（只使用官方网页的正常访问流程）：
/// 1) 携带会话访问官方首页；
/// 2) 检查是否被重定向到登录域；
/// 3) 检查响应中的登录/未登录特征标记。
/// 找不到可靠证据时返回 unverified —— 语义为“会话已捕获，身份未验证”，
/// 绝不把 HTTP 200 直接当作“已登录”。
pub async fn probe_session(state: &HttpState) -> SessionProbeResult {
    let mut result = SessionProbeResult {
        verdict: "unverified".into(),
        http_status: None,
        final_host: None,
        redirected_to_login: false,
        logged_in_markers: vec![],
        logged_out_markers: vec![],
        note: String::new(),
        checked_at: now_unix(),
    };

    let has_session = {
        let cookies = state.cookies.lock().unwrap();
        !cookies.is_empty()
    };
    if !has_session {
        result.verdict = "not_logged_in".into();
        result.note = "本地没有已捕获的会话".into();
        return result;
    }

    let url = match Url::parse(OFFICIAL_ORIGIN) {
        Ok(u) => u,
        Err(_) => {
            result.verdict = "failed".into();
            result.note = "官方地址解析失败".into();
            return result;
        }
    };

    let host = url.host_str().unwrap_or_default().to_string();
    let path = url.path().to_string();
    let cookie_header = {
        let cookies = state.cookies.lock().unwrap();
        cookie_header_for(&cookies, &host, &path)
    };
    let mut req = state.client.get(url.clone());
    if let Some(h) = cookie_header {
        req = req.header(reqwest::header::COOKIE, h);
    }
    req = req.header(reqwest::header::ACCEPT, "text/html,application/xhtml+xml");

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let msg = classify_reqwest_err(&e);
            result.verdict = if e.is_connect() || e.is_timeout() {
                "offline".into()
            } else {
                "failed".into()
            };
            result.note = msg;
            return result;
        }
    };

    result.http_status = Some(resp.status().as_u16());
    let final_url = resp.url().clone();
    let final_host = final_url.host_str().unwrap_or_default().to_string();
    result.final_host = Some(final_host.clone());
    result.redirected_to_login = final_host.starts_with("passport.")
        || final_url.path().to_ascii_lowercase().contains("login");

    let html = resp.text().await.unwrap_or_default();
    result.logged_in_markers = LOGGED_IN_MARKERS
        .iter()
        .filter(|m| html.contains(**m))
        .map(|m| (*m).to_string())
        .collect();
    result.logged_out_markers = LOGGED_OUT_MARKERS
        .iter()
        .filter(|m| html.contains(**m))
        .map(|m| (*m).to_string())
        .collect();

    if result.redirected_to_login {
        result.verdict = "not_logged_in".into();
        result.note = "访问官方页面时被重定向到登录入口，会话可能已失效".into();
    } else if !result.logged_in_markers.is_empty() && result.logged_out_markers.is_empty() {
        result.verdict = "verified".into();
        result.note = "官方页面返回了登录用户特征".into();
    } else if !result.logged_out_markers.is_empty() && result.logged_in_markers.is_empty() {
        result.verdict = "not_logged_in".into();
        result.note = "官方页面呈现未登录状态入口".into();
    } else {
        result.verdict = "unverified".into();
        result.note =
            "会话已捕获，但官方 SPA 页面未提供可验证身份的标记，暂无法证明账号身份".into();
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_allowlist_accepts_official() {
        assert!(is_allowed_official_host("baicizhan.com"));
        assert!(is_allowed_official_host("www.baicizhan.com"));
        assert!(is_allowed_official_host("passport.baicizhan.com"));
        assert!(is_allowed_official_host("BAICIZHAN.COM"));
        assert!(is_allowed_official_host("www.baicizhan.com."));
    }

    #[test]
    fn host_allowlist_rejects_evil() {
        assert!(!is_allowed_official_host("evilbaicizhan.com"));
        assert!(!is_allowed_official_host("baicizhan.com.evil.com"));
        assert!(!is_allowed_official_host("notbaicizhan.com"));
        assert!(!is_allowed_official_host("baicizhan.org"));
        assert!(!is_allowed_official_host("example.com"));
        assert!(!is_allowed_official_host("github.com"));
        assert!(!is_allowed_official_host("localhost"));
        assert!(!is_allowed_official_host("127.0.0.1"));
        assert!(!is_allowed_official_host(""));
    }

    #[test]
    fn url_validation_blocks_third_party() {
        assert!(validate_url("https://www.baicizhan.com/").is_ok());
        assert!(validate_url("https://passport.baicizhan.com/login").is_ok());
        assert!(validate_url("https://example.com/").is_err());
        assert!(validate_url("https://github.com/").is_err());
        assert!(validate_url("https://evilbaicizhan.com/").is_err());
        assert!(validate_url("https://baicizhan.com.evil.com/").is_err());
        assert!(validate_url("http://www.baicizhan.com/").is_err()); // 非 https
        assert!(validate_url("https://127.0.0.1/").is_err());
        assert!(validate_url("https://localhost/").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn cookie_domain_matching() {
        let c = CookieEntry {
            name: "sid".into(),
            value: "x".into(),
            domain: Some(".baicizhan.com".into()),
            path: Some("/".into()),
            secure: Some(true),
            expires: None,
            http_only: None,
        };
        assert!(cookie_matches(&c, "www.baicizhan.com", "/"));
        assert!(cookie_matches(&c, "baicizhan.com", "/learn"));
        assert!(!cookie_matches(&c, "evilbaicizhan.com", "/"));
        assert!(!cookie_matches(&c, "example.com", "/"));
        let host_only = CookieEntry {
            domain: Some("www.baicizhan.com".into()),
            ..c.clone()
        };
        assert!(cookie_matches(&host_only, "www.baicizhan.com", "/"));
        assert!(!cookie_matches(&host_only, "api.baicizhan.com", "/"));
        let scoped = CookieEntry {
            path: Some("/user".into()),
            ..c.clone()
        };
        assert!(cookie_matches(&scoped, "www.baicizhan.com", "/user/profile"));
        assert!(!cookie_matches(&scoped, "www.baicizhan.com", "/learn"));
        let expired = CookieEntry {
            expires: Some(1),
            ..c.clone()
        };
        assert!(!cookie_matches(&expired, "www.baicizhan.com", "/"));
        let no_domain = CookieEntry {
            domain: None,
            ..c.clone()
        };
        assert!(!cookie_matches(&no_domain, "www.baicizhan.com", "/"));
    }

    #[test]
    fn auth_navigation_allowlist() {
        // 官方域与第三方 OAuth 域允许导航
        assert!(is_allowed_auth_navigation("www.baicizhan.com"));
        assert!(is_allowed_auth_navigation("passport.baicizhan.com"));
        assert!(is_allowed_auth_navigation("open.weixin.qq.com"));
        assert!(is_allowed_auth_navigation("login.sina.com.cn"));
        assert!(is_allowed_auth_navigation("graph.renren.com"));
        // 其他一律拒绝
        assert!(!is_allowed_auth_navigation("example.com"));
        assert!(!is_allowed_auth_navigation("evilbaicizhan.com"));
        assert!(!is_allowed_auth_navigation("evil-weixin.qq.com.attacker.com"));
        assert!(!is_allowed_auth_navigation("weixin.qq.com.evil.com"));
        assert!(!is_allowed_auth_navigation(""));
    }

    #[test]
    fn official_cookie_filter() {
        let input = vec![
            CookieData {
                name: "sid".into(),
                value: "v".into(),
                domain: Some(".baicizhan.com".into()),
                path: None,
                secure: None,
                expires: None,
                http_only: None,
            },
            CookieData {
                name: "tracking".into(),
                value: "v".into(),
                domain: Some(".example.com".into()),
                path: None,
                secure: None,
                expires: None,
                http_only: None,
            },
            CookieData {
                name: "evil".into(),
                value: "v".into(),
                domain: Some("evilbaicizhan.com".into()),
                path: None,
                secure: None,
                expires: None,
                http_only: None,
            },
        ];
        let out = filter_official_cookies(input);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].name, "sid");
    }
}
