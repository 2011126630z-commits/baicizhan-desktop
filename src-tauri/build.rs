fn main() {
    // 记录构建时间，供“关于”页面展示
    let build_time = chrono_build_time();
    println!("cargo:rustc-env=BUILD_TIME={}", build_time);
    tauri_build::build();
}

fn chrono_build_time() -> String {
    // 不依赖 chrono（build-dependencies 只有 tauri-build），用 std 计算本地时间
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let days = now.div_euclid(86_400);
    let secs = now.rem_euclid(86_400);
    // 从 1970-01-01 推算日期（UTC）
    let mut year = 1970i64;
    let mut remaining_days = days;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
        let ylen = if leap { 366 } else { 365 };
        if remaining_days >= ylen {
            remaining_days -= ylen;
            year += 1;
        } else {
            break;
        }
    }
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let month_lens = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut month = 1;
    for len in month_lens {
        if remaining_days < len {
            break;
        }
        remaining_days -= len;
        month += 1;
    }
    let day = remaining_days + 1;
    let hour = secs / 3600;
    let minute = (secs % 3600) / 60;
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02} UTC",
        year, month, day, hour, minute
    )
}
