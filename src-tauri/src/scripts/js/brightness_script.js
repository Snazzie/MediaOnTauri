let brightnessOverlay = null;
let overlayTimeout = null;

function showBrightnessOverlay(value) {
    if (!brightnessOverlay) {
        brightnessOverlay = document.createElement('div');
        brightnessOverlay.id = 'brightness-overlay';
        Object.assign(brightnessOverlay.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: '10000',
            opacity: '0',
            transition: 'opacity 0.3s ease-in-out',
            pointerEvents: 'none', // Allow clicks to pass through
            fontSize: '2em'
        });
        document.body.appendChild(brightnessOverlay);
    }

    brightnessOverlay.textContent = `Video Brightness: ${Math.round(value * 100)}%`;
    brightnessOverlay.style.opacity = '1';

    if (overlayTimeout) {
        clearTimeout(overlayTimeout);
    }

    overlayTimeout = setTimeout(() => {
        brightnessOverlay.style.opacity = '0';
    }, 2000); // Hide after 2 seconds
}


document.addEventListener('keydown', (event) => {
    const video = document.querySelector('video');
    if (!video) return;

    let currentBrightness = 1;
    const filter = video.style.filter;
    const brightnessMatch = filter.match(/brightness\(([^)]+)\)/);

    if (brightnessMatch?.[1]) {
        currentBrightness = Number.parseFloat(brightnessMatch[1]);
    }

    let newBrightness = currentBrightness;

    // Use event.code to avoid issues with Alt/Option producing special characters on macOS
    if (event.altKey && (event.code === 'BracketLeft' || event.key === '[')) {
        // Decrease brightness
        newBrightness = Math.max(0.1, currentBrightness - 0.1);
        event.preventDefault(); // Prevent default browser action
    } else if (event.altKey && (event.code === 'BracketRight' || event.key === ']')) {
        // Increase brightness
        newBrightness = currentBrightness + 0.1;
        event.preventDefault(); // Prevent default browser action
    }

    if (newBrightness !== currentBrightness) {
        // Update the filter property, preserving other filters if any
        const newFilter = brightnessMatch
            ? filter.replace(brightnessMatch[0], `brightness(${newBrightness})`)
            : `${filter} brightness(${newBrightness})`;

        video.style.filter = newFilter;

        // Also apply to the video enhancement canvas if it exists
        const enhanceCanvas = document.getElementById('video-enhance-canvas');
        if (enhanceCanvas) {
            enhanceCanvas.style.filter = `brightness(${newBrightness})`;
        }

        showBrightnessOverlay(newBrightness);
    }
});
