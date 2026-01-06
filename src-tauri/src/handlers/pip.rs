use once_cell::sync::Lazy;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime};

// Track PIP state
static IS_PIP: Lazy<AtomicBool> = Lazy::new(|| AtomicBool::new(false));

// Command to check if PIP mode is active
#[tauri::command]
pub fn is_pip_active() -> bool {
    IS_PIP.load(Ordering::Relaxed)
}

// Structure to store window state
#[derive(Debug, Clone)]
struct WindowState {
    size: Option<tauri::Size>,
    position: Option<tauri::Position>,
    always_on_top: bool,
    decorations: bool,
    maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            size: Some(tauri::Size::Logical(LogicalSize {
                width: 800.0,
                height: 600.0,
            })),
            position: Some(tauri::Position::Logical(LogicalPosition { x: 0.0, y: 0.0 })),
            always_on_top: false,
            decorations: true,
            maximized: false,
        }
    }
}

// Store the previous window state
static PREVIOUS_WINDOW_STATE: Lazy<Mutex<WindowState>> =
    Lazy::new(|| Mutex::new(WindowState::default()));

#[tauri::command]
pub fn toggle_pip<R: Runtime>(
    app_handle: AppHandle<R>,
    window_label: Option<String>,
) -> Result<bool, String> {
    let window = app_handle
        .get_webview_window(window_label.as_deref().unwrap_or("main"))
        .ok_or("Window not found")?;

    let is_pip = IS_PIP.load(Ordering::Relaxed);

    if is_pip {
        // Restore normal view from saved state
        let saved_state = PREVIOUS_WINDOW_STATE.lock().map_err(|e| e.to_string())?;

        // Restore size
        if let Some(size) = &saved_state.size {
            window
                .set_size(size.clone())
                .map_err(|e| format!("Failed to restore size: {}", e))?;
        }

        // Restore position
        if let Some(position) = &saved_state.position {
            window
                .set_position(position.clone())
                .map_err(|e| format!("Failed to restore position: {}", e))?;
        }

        // Restore always-on-top state
        let _ = window.set_always_on_top(saved_state.always_on_top);

        // Restore decorations
        window
            .set_decorations(saved_state.decorations)
            .map_err(|e| format!("Failed to restore decorations: {}", e))?;

        // Make sure window is visible and focused
        window
            .show()
            .map_err(|e| format!("Failed to show window: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;

        // Restore maximized state if it was maximized before
        if saved_state.maximized {
            println!("Restoring maximized state");
            window
                .maximize()
                .map_err(|e| format!("Failed to restore maximized state: {}", e))?;
        } else {
            println!("Window was not maximized before, not restoring maximized state");
        }
    } else {
        // Save current window state before entering PIP mode
        let mut current_state = WindowState::default();

        // Save current size
        if let Ok(size) = window.inner_size() {
            current_state.size = Some(tauri::Size::Physical(size));
        }

        // Save current position
        if let Ok(position) = window.outer_position() {
            current_state.position = Some(tauri::Position::Physical(position));
        }

        // Save always-on-top state
        if let Ok(always_on_top) = window.is_always_on_top() {
            current_state.always_on_top = always_on_top;
        }

        // Save decorations state
        if let Ok(decorations) = window.is_decorated() {
            current_state.decorations = decorations;
        }

        // Save maximized state
        if let Ok(maximized) = window.is_maximized() {
            current_state.maximized = maximized;
            println!("Saved maximized state: {}", maximized);
        }

        // Store the current state
        *PREVIOUS_WINDOW_STATE.lock().map_err(|e| e.to_string())? = current_state;

        // Enter PIP mode
        let monitor = window
            .current_monitor()
            .map_err(|e| format!("Failed to get monitor: {}", e))?
            .ok_or("No monitor found")?;

        use tauri::{PhysicalPosition, PhysicalSize};

        let screen_size = *monitor.size(); // Dereference to get owned PhysicalSize
        let pip_width = (screen_size.width as f64 * 0.3) as i32;
        let pip_height = (screen_size.height as f64 * 0.2) as i32;
        let pip_size = PhysicalSize {
            width: pip_width as u32,
            height: pip_height as u32,
        };

        window
            .set_size(pip_size)
            .map_err(|e| format!("Failed to set PIP size: {}", e))?;
        let _ = window.set_always_on_top(true);
        window
            .set_position(tauri::Position::Physical(PhysicalPosition {
                x: (screen_size.width as i32 - pip_width - 50).max(0), // Right edge with 50px margin
                y: (screen_size.height as i32 - pip_height - 150).max(0), // Bottom edge with 150px margin
            }))
            .map_err(|e| format!("Failed to set PIP position: {}", e))?;

        window
            .set_decorations(false)
            .map_err(|e| format!("Failed to hide decorations: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show window: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
    }

    let new_pip_state = !is_pip;
    IS_PIP.store(new_pip_state, Ordering::Relaxed);

    // Emit event to frontend
    let _ = window.emit("pip-state-changed", new_pip_state);

    Ok(new_pip_state)
}
