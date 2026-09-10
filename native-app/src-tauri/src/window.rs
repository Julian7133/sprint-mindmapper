use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Open a new native window. This is the native counterpart to the M1
/// "detached tab" model: when `file` is set, the new window boots showing
/// only that map (the frontend bridge reads the injected value and rewrites
/// the URL's `?file=` query before app.js boots).
#[tauri::command]
pub fn open_new_window(app: tauri::AppHandle, file: Option<String>) -> Result<(), String> {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let label = format!("auramindmap-{ts}");

    let script = match file {
        Some(f) => {
            let encoded = serde_json::to_string(&f).map_err(|e| e.to_string())?;
            format!("window.__amDetachFile = {encoded};")
        }
        None => "window.__amDetachFile = null;".to_string(),
    };

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title("AuraMindmap")
        .inner_size(1100.0, 760.0)
        .min_inner_size(800.0, 600.0)
        .initialization_script(&script)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
