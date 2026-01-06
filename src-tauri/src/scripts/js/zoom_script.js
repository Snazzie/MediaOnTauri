// Add keyboard shortcut listeners for zoom control
document.addEventListener('keydown', (event) => {
    // Check if Ctrl key (Windows/Linux) or Cmd key (Mac) is pressed
    if (event.ctrlKey || event.metaKey) {
        try {
            if (window.__TAURI_INTERNALS__) {
                // Safely get the current window label
                let windowLabel = null;
                try {
                    // Check if metadata and currentWindow exist
                    if (window.__TAURI_INTERNALS__.metadata?.currentWindow) {
                        windowLabel = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
                    } else {
                        console.debug('Window metadata not available for keyboard shortcut, using null window label');
                    }
                } catch (metadataErr) {
                    console.warn('Could not access window metadata for keyboard shortcut:', metadataErr);
                }

                // Check for Ctrl + Plus (zoom in)
                if (event.key === '+' || event.key === '=' || event.keyCode === 107 || event.keyCode === 187) {
                    event.preventDefault(); // Prevent default browser zoom
                    console.debug('Zoom in shortcut detected');

                    // Invoke the adjust_zoom command with zoom_in=true
                    window.__TAURI_INTERNALS__.invoke('adjust_zoom', {
                        zoomIn: true,
                        windowLabel: windowLabel
                    });
                    console.debug('Invoked adjust_zoom with zoom in for window:', windowLabel);
                }

                // Check for Ctrl + Minus (zoom out)
                else if (event.key === '-' || event.keyCode === 109 || event.keyCode === 189) {
                    event.preventDefault(); // Prevent default browser zoom
                    console.debug('Zoom out shortcut detected');

                    // Invoke the adjust_zoom command with zoom_in=false
                    window.__TAURI_INTERNALS__.invoke('adjust_zoom', {
                        zoomIn: false,
                        windowLabel: windowLabel
                    });
                    console.debug('Invoked adjust_zoom with zoom out for window:', windowLabel);
                }
            } else {
                console.error('__TAURI_INTERNALS__ is not available');
            }
        } catch (e) {
            console.error('Error invoking adjust_zoom:', e);
        }
    }
});

// Apply the saved zoom level when the window loads
if (window.__TAURI_INTERNALS__) {
    try {
        // Safely get the current window label
        let windowLabel = null;
        try {
            // Check if metadata and currentWindow exist
            if (window.__TAURI_INTERNALS__.metadata?.currentWindow) {
                windowLabel = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
                console.debug('Initializing zoom level for window:', windowLabel);
            } else {
                console.debug('Window metadata not available, using null window label');
            }
        } catch (metadataErr) {
            console.warn('Could not access window metadata:', metadataErr);
        }

        // Create a function to apply the saved zoom level
        const applyZoomLevel = () => {
            // Invoke a special command to get the current zoom level and apply it
            window.__TAURI_INTERNALS__.invoke('get_saved_zoom_level', {
                windowLabel: windowLabel
            }).then(zoomLevel => {
                console.debug('Retrieved saved zoom level:', zoomLevel);
            }).catch(err => {
                console.error('Error getting saved zoom level:', err);
            });
        };

        // Apply zoom level when the document is fully loaded
        if (document.readyState === 'complete') {
            applyZoomLevel();
        } else {
            window.addEventListener('load', applyZoomLevel);
        }
    } catch (e) {
        console.error('Error initializing zoom level:', e);
    }
}
