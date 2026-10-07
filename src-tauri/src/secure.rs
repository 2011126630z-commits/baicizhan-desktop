use keyring::Entry;

const SERVICE: &str = "BaicizhanDesktop";

/// 敏感信息（会话 Cookie 等）只存 Windows 凭据管理器，绝不写明文文件。
pub fn secure_set(key: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

pub fn secure_get(key: &str) -> Option<String> {
    let entry = Entry::new(SERVICE, key).ok()?;
    entry.get_password().ok()
}

pub fn secure_delete(key: &str) {
    if let Ok(entry) = Entry::new(SERVICE, key) {
        let _ = entry.delete_credential();
    }
}
