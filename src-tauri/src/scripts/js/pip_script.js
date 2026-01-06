document.addEventListener('keydown', (event) => {
    // Check if Alt/Option key is pressed and P key is pressed
    // Use event.code to avoid issues with Alt/Option producing special characters (e.g., π on macOS)
    if (event.altKey && (event.code === 'KeyP' || event.key === 'p' || event.key === 'P')) {
        event.preventDefault(); // Prevent default browser behavior
        console.debug('Alt+P shortcut detected for PiP toggle');

        // Check if we're on the initial screen by looking for the confirmation container
        const isOnInitialScreen = document.querySelector('.confirmation-container') !== null;
        if (isOnInitialScreen) {
            console.debug('Ignoring toggle on initial screen');
            return;
        }

        togglePip();
    }
});

// Also listen for toggle-pip event for programmatic control
document.addEventListener("toggle-pip", () => {
    const isOnInitialScreen = document.querySelector('.confirmation-container') !== null;
    if (!isOnInitialScreen) {
        togglePip();
    }
});

function togglePip() {
    try {
        if (window.__TAURI_INTERNALS__) {
            // Safely get the current window label
            let windowLabel = null;
            try {
                if (window.__TAURI_INTERNALS__.metadata?.currentWindow) {
                    windowLabel = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
                } else {
                    console.debug('Window metadata not available for PiP toggle, using null window label');
                }
            } catch (metadataErr) {
                console.warn('Could not access window metadata for PiP toggle:', metadataErr);
            }

            // Invoke the toggle_pip command - Rust side tracks the state
            console.log('Invoking toggle_pip for window:', windowLabel);
            window.__TAURI_INTERNALS__.invoke('toggle_pip', {
                windowLabel: windowLabel
            }).then((newPipState) => {
                console.log('PiP toggled, new state:', newPipState);
                // Emit event for any listeners
                const pipChange = new CustomEvent("pipChanged", {
                    detail: { value: newPipState },
                });
                document.dispatchEvent(pipChange);

                // Focus is handled by Rust side via eval after window operations
            }).catch((err) => {
                console.error('toggle_pip error:', err);
            });
        } else {
            console.error('__TAURI_INTERNALS__ is not available');
        }
    } catch (e) {
        console.error('Error invoking toggle_pip:', e);
    }
}