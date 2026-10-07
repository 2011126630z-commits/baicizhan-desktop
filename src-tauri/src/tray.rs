use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "打开百词斩桌面版", true, None::<&str>)?;
    let study = MenuItem::with_id(app, "study", "开始今日学习", true, None::<&str>)?;
    let mini = MenuItem::with_id(app, "mini", "小窗背词", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &study, &mini, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("百词斩桌面版")
        .on_menu_event(|app, ev| match ev.id.as_ref() {
            "open" => show_main(app),
            "study" => {
                show_main(app);
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.emit("tray://study", ());
                }
            }
            "mini" => {
                let _ = crate::commands::show_mini_window(app.clone(), app.state::<crate::db::Db>());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = ev
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
