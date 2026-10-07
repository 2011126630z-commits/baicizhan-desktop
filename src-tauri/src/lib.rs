mod commands;
mod db;
mod http_client;
mod secure;
mod tray;

use db::Db;
use http_client::HttpState;
use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 二次启动：聚焦已有主窗口
            tray::show_main(app);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) { log::LevelFilter::Debug } else { log::LevelFilter::Info })
                .max_file_size(10 * 1024 * 1024)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app".into()),
                    }),
                    #[cfg(debug_assertions)]
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                ])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(HttpState::new())
        .manage(commands::TtsState(std::sync::Mutex::new(None)))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let db = db::init_db(&data_dir.join("data.sqlite3"))
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            app.manage(db);

            tray::create_tray(app.handle())?;

            // 主窗口关闭行为：每次询问 / 最小化到托盘 / 直接退出（记忆选择）
            let handle = app.handle().clone();
            let db_arc = app.state::<Db>().0.clone();
            let main = app.get_webview_window("main").expect("main window");
            main.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let behavior = {
                        let conn = db_arc.lock().unwrap();
                        db::settings_get(&conn, "desktop.closeBehavior")
                            .unwrap_or_else(|| "ask".to_string())
                    };
                    match behavior.as_str() {
                        "tray" => {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "exit" => { /* 允许关闭：窗口全部关闭后应用退出 */ }
                        _ => {
                            api.prevent_close();
                            if let Some(w) = handle.get_webview_window("main") {
                                let _ = w.emit("app://close-requested", ());
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings_get,
            commands::settings_set,
            commands::settings_all,
            commands::book_list,
            commands::book_set_active,
            commands::book_import,
            commands::word_list,
            commands::word_search,
            commands::favorite_toggle,
            commands::review_due,
            commands::study_submit,
            commands::study_heartbeat,
            commands::record_recent,
            commands::stats_daily,
            commands::stats_today,
            commands::streak,
            commands::queue_list,
            commands::queue_mark,
            commands::speak,
            commands::session_save,
            commands::session_clear,
            commands::session_exists,
            commands::open_login_window,
            commands::close_login_window,
            commands::capture_login_cookies,
            commands::http_request,
            commands::show_main_window,
            commands::hide_main_window,
            commands::app_exit,
            commands::show_mini_window,
            commands::set_mini_always_top,
            commands::app_meta,
            commands::export_capabilities_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
