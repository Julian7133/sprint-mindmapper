use crate::window;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Manager};

/// Event name the frontend bridge listens to for File-menu actions.
pub const MENU_EVENT: &str = "auramindmap://menu";

/// Return the currently focused webview window, falling back to the "main"
/// window. `Manager::get_focused_window` requires the `unstable` feature, so we
/// derive focus from `webview_windows()` + `is_focused()` instead.
fn focused_webview<R: tauri::Runtime>(app: &AppHandle<R>) -> Option<tauri::WebviewWindow<R>> {
    let mut fallback = None;
    for (label, win) in app.webview_windows() {
        if label == "main" {
            fallback = Some(win.clone());
        }
        if win.is_focused().unwrap_or(false) {
            return Some(win);
        }
    }
    fallback
}

/// Build the native macOS menu bar. On macOS the first submenu becomes the
/// application menu; all items must live inside submenus.
pub fn build(app: &App) -> tauri::Result<()> {
    let app_menu = SubmenuBuilder::new(app, "AuraMindmap")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let new_map = tauri::menu::MenuItemBuilder::with_id("new-map", "New Map")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_folder = tauri::menu::MenuItemBuilder::with_id("open-folder", "Open Folder…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let new_window = tauri::menu::MenuItemBuilder::with_id("new-window", "New Window")
        .accelerator("CmdOrCtrl+Shift+N")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_map)
        .item(&open_folder)
        .separator()
        .item(&new_window)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text("toggle-fullscreen", "Toggle Full Screen")
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        // "Zoom" / "Bring All to Front" are standard macOS Window-menu items but
        // are not exposed by Tauri 2.11.5's builder, so we add them as custom
        // items and implement their behaviour in `handle`.
        .text("zoom-window", "Zoom")
        .text("front-window", "Bring All to Front")
        .separator()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
        .build()?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn handle(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "new-map" => emit(app, "new-file"),
        "open-folder" => emit(app, "open-folder"),
        "new-window" => {
            // Rust-owned so the OS can spawn a real native window without
            // frontend window-creation permissions.
            let _ = window::open_new_window(app.clone(), None);
        }
        "toggle-fullscreen" => {
            if let Some(win) = focused_webview(app) {
                let is_fullscreen = win.is_fullscreen().unwrap_or(false);
                let _ = win.set_fullscreen(!is_fullscreen);
            }
        }
        "zoom-window" => {
            if let Some(win) = focused_webview(app) {
                let is_maximized = win.is_maximized().unwrap_or(false);
                if is_maximized {
                    let _ = win.unmaximize();
                } else {
                    let _ = win.maximize();
                }
            }
        }
        "front-window" => {
            for (_label, win) in app.webview_windows() {
                let _ = win.set_focus();
            }
        }
        _ => {}
    }
}

fn emit(app: &tauri::AppHandle, action: &str) {
    let payload = serde_json::json!({ "action": action });
    if let Some(win) = focused_webview(app) {
        let _ = win.emit(MENU_EVENT, &payload);
        return;
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit(MENU_EVENT, &payload);
        return;
    }
    let _ = app.emit(MENU_EVENT, &payload);
}
