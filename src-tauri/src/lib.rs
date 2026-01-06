mod handlers;
mod scripts;

use handlers::{
    adjust_zoom, drag_window, get_saved_zoom_level, is_pip_active, start_dragging,
    toggle_fullscreen, toggle_pip,
};

use scripts::script::init_script;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            toggle_fullscreen,
            adjust_zoom,
            get_saved_zoom_level,
            toggle_pip,
            is_pip_active,
            drag_window,
            start_dragging
        ])
        // Use the initialization script for all webviews
        .append_invoke_initialization_script(init_script())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
