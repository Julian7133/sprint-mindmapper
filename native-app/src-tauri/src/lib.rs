mod fs;
mod menu;
mod window;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fs::list_markdown,
            fs::read_text_file,
            fs::write_text_file,
            fs::delete_file,
            fs::path_exists,
            fs::open_markmap_in_default_app,
            window::open_new_window,
        ])
        .setup(|app| {
            menu::build(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| menu::handle(app, event))
        .run(tauri::generate_context!())
        .expect("error while running AuraMindmap");
}
