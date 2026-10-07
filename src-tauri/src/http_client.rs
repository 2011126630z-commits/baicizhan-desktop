use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Mutex;
use std::time::Duration;
use url::Url;

/// 会话 Cookie（仅 name/value），持久化在 Windows 凭据管理器中。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CookieData {
    pub name: String,
    pub value: String,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
}

pub struct HttpState {
    /// cookie name -> value（仅针对官方站点会话使用）
    pub cookies: Mutex<BTreeMap<String, String>>,
    client: reqwest::Client,
}

const COOKIE_KEY: &str = "session.cookies";
const OFFICIAL_ORIGIN: &str = "https://www.baicizhan.com/";

impl HttpState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(10))
            .user_agent("BaicizhanDesktop/0.1.0 (personal study tool)")
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .expect("reqwest client");
        let cookies = load_cookies();
        HttpState {
            cookies: Mutex::new(cookies),
            client,
        }
    }
}

fn load_cookies() -> BTreeMap<String, String> {
    let raw = crate::secure::secure_get(COOKIE_KEY).unwrap_or_else(|| "[]".into());
    let list: Vec<CookieData> = serde_json::from_str(&raw).unwrap_or_default();
    list.into_iter()
        .filter(|c| !c.value.is_empty())
        .map(|c| (c.name, c.value))
        .collect()
}

pub fn save_cookies(cookies: &BTreeMap<String, String>) -> Result<(), String> {
    let list: Vec<CookieData> = cookies
        .iter()
        .map(|(k, v)| CookieData {
            name: k.clone(),
            value: v.clone(),
            domain: Some("baicizhan.com".into()),
            path: Some("/".into()),
        })
        .collect();
    crate::secure::secure_set(COOKIE_KEY, &serde_json::to_string(&list).unwrap_or_default())
}

pub fn clear_cookies() {
    crate::secure::secure_delete(COOKIE_KEY);
}

pub fn has_cookies() -> bool {
    !load_cookies().is_empty()
}

/// 用新采集到的 Cookie 覆盖会话（登录成功后调用）
pub fn replace_cookies(cookies: Vec<CookieData>) -> Result<(), String> {
    let mut map = BTreeMap::new();
    for c in cookies {
        if !c.name.is_empty() && !c.value.is_empty() {
            map.insert(c.name, c.value);
        }
    }
    save_cookies(&map)?;
    Ok(())
}

/// SSRF 防护：仅允许 https 的公网域名（拒绝 IP 直连、内网、环回、保留地址）。
pub fn validate_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "无效的 URL")?;
    if url.scheme() != "https" {
        return Err("仅允许 https 请求".into());
    }
    let host = url.host_str().ok_or("URL 缺少主机名")?.to_lowercase();
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".lan")
        || !host.contains('.')
    {
        return Err(format!("不允许访问该主机: {host}"));
    }
    // 拒绝任何 IP 字面量（IPv4/IPv6），官方接口均为域名
    if host.parse::<std::net::IpAddr>().is_ok() {
        return Err("不允许直接访问 IP 地址".into());
    }
    Ok(url)
}

#[derive(Debug, Serialize)]
pub struct HttpResult {
    pub status: u16,
    pub ok: bool,
    pub body: String,
    #[serde(rename = "finalUrl")]
    pub final_url: String,
}

/// 带 Cookie 的 GET/POST；响应中的 Set-Cookie 会合并回本地会话并持久化。
pub async fn request(
    state: &HttpState,
    method: &str,
    url: &str,
    headers: &BTreeMap<String, String>,
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
    let cookie_header = {
        let cookies = state.cookies.lock().unwrap();
        if cookies.is_empty() {
            None
        } else {
            Some(
                cookies
                    .iter()
                    .map(|(k, v)| format!("{k}={v}"))
                    .collect::<Vec<_>>()
                    .join("; "),
            )
        }
    };
    let mut req = state.client.request(m, url.clone());
    if let Some(h) = cookie_header {
        req = req.header(reqwest::header::COOKIE, h);
    }
    for (k, v) in headers {
        // 不允许覆盖 Cookie / Host
        let lower = k.to_lowercase();
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

    // 收集 Set-Cookie（解析 name=value；expires/删除标记按值清空处理）
    let mut new_pairs: Vec<(String, String)> = Vec::new();
    for v in resp.headers().get_all(reqwest::header::SET_COOKIE) {
        if let Ok(s) = v.to_str() {
            if let Some(pair) = s.split(';').next() {
                if let Some((n, val)) = pair.split_once('=') {
                    new_pairs.push((n.trim().to_string(), val.trim().to_string()));
                }
            }
        }
    }
    let body = resp.text().await.map_err(|e| classify_reqwest_err(&e))?;

    if !new_pairs.is_empty() {
        let mut cookies = state.cookies.lock().unwrap();
        for (n, v) in new_pairs {
            if v.is_empty() {
                cookies.remove(&n);
            } else {
                cookies.insert(n, v);
            }
        }
        let _ = save_cookies(&cookies);
    }

    Ok(HttpResult {
        status,
        ok: (200..300).contains(&status),
        body,
        final_url,
    })
}

fn classify_reqwest_err(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "请求超时，请检查网络后重试".into()
    } else if e.is_connect() {
        "网络连接失败，当前可能处于离线状态".into()
    } else {
        format!("网络请求失败: {e}")
    }
}

pub fn official_origin() -> &'static str {
    OFFICIAL_ORIGIN
}
