document.addEventListener('keydown', (event) => {
    // Check if Alt key is pressed and P key is pressed
    if (event.altKey && event.key === 'p') {
        event.preventDefault(); // Prevent default browser behavior
        console.debug('Alt+P shortcut detected for PiP toggle');

        const ev = new Event("toggle-pip")
        document.dispatchEvent(ev);
    }
});
document.addEventListener("toggle-pip", () => {

    onEvent();
})


function onEvent() {
    // Check if we're on the initial screen by looking for the confirmation container
    const isOnInitialScreen = document.querySelector('.confirmation-container') !== null;

    // Only proceed if we're NOT on the initial screen
    if (isOnInitialScreen) {
        console.debug('Ignoring toggle on initial screen');
        return;
    }
    const state = sessionStorage.getItem('pipState');
    const isPipEnabled = state === 'true';

    // Toggle the state
    const newPipState = !isPipEnabled;
    // Save the new state to session storage (clears on app restart)
    sessionStorage.setItem('pipState', newPipState.toString());
    console.log('PiP state toggled:', newPipState);
    tryInvoke(newPipState)

    const pipChange = new CustomEvent("pipChanged", {
        detail: {
            value: newPipState,
        },
    });
    document.dispatchEvent(pipChange);

}


function tryInvoke(value) {
    try {
        if (window.__TAURI_INTERNALS__) {
            // Safely get the current window label
            let windowLabel = null;
            try {
                // Check if metadata and currentWindow exist
                if (window.__TAURI_INTERNALS__.metadata?.currentWindow) {
                    windowLabel = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
                } else {
                    console.debug('Window metadata not available for PiP toggle, using null window label');
                }
            } catch (metadataErr) {
                console.warn('Could not access window metadata for PiP toggle:', metadataErr);
            }

            // Invoke the toggle_pip command
            window.__TAURI_INTERNALS__.invoke('toggle_pip', {
                windowLabel: windowLabel
            });

            console.debug('Invoked toggle_pip for window:', windowLabel);
        } else {
            console.error('__TAURI_INTERNALS__ is not available');
        }
    } catch (e) {
        console.error('Error invoking toggle_pip:', e);
    }
}