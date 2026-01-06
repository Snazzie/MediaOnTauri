(function() {
    'use strict';

    // Video Enhancement State
    window.__videoEnhance = {
        enabled: false,
        savedEnabled: false,
        filterIndex: 0,
        canvas: null,
        gl: null,
        program: null,
        animationId: null,
        originalVideo: null,
        videoObserver: null
    };

    // Sharpening presets with different kernel strengths
    const sharpPresets = [
        { name: 'Sharpen Light', strength: 0.3 },
        { name: 'Sharpen Medium', strength: 0.5 },
        { name: 'Sharpen Strong', strength: 0.8 },
        { name: 'Sharpen Extreme', strength: 1.2 },
        { name: 'CAS (Adaptive)', strength: 0.6, cas: true }
    ];

    // Vertex shader - simple passthrough
    const vertexShaderSource = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;

    // Fragment shader with unsharp mask sharpening
    const fragmentShaderSource = `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_texture;
        uniform vec2 u_textureSize;
        uniform float u_strength;
        uniform int u_useCAS;

        void main() {
            vec2 texel = 1.0 / u_textureSize;

            // Sample center and neighbors
            vec4 center = texture2D(u_texture, v_texCoord);

            if (u_useCAS == 1) {
                // Contrast Adaptive Sharpening (simplified)
                vec4 a = texture2D(u_texture, v_texCoord + texel * vec2(-1.0, -1.0));
                vec4 b = texture2D(u_texture, v_texCoord + texel * vec2( 0.0, -1.0));
                vec4 c = texture2D(u_texture, v_texCoord + texel * vec2( 1.0, -1.0));
                vec4 d = texture2D(u_texture, v_texCoord + texel * vec2(-1.0,  0.0));
                vec4 e = center;
                vec4 f = texture2D(u_texture, v_texCoord + texel * vec2( 1.0,  0.0));
                vec4 g = texture2D(u_texture, v_texCoord + texel * vec2(-1.0,  1.0));
                vec4 h = texture2D(u_texture, v_texCoord + texel * vec2( 0.0,  1.0));
                vec4 i = texture2D(u_texture, v_texCoord + texel * vec2( 1.0,  1.0));

                // Find min and max of cross pattern
                vec4 mnRGB = min(min(min(d, e), min(f, b)), h);
                vec4 mxRGB = max(max(max(d, e), max(f, b)), h);

                // Also include corners
                mnRGB = min(min(min(mnRGB, a), min(c, g)), i);
                mxRGB = max(max(max(mxRGB, a), max(c, g)), i);

                // Sharpening amount based on local contrast
                vec4 ampRGB = clamp(min(mnRGB, 1.0 - mxRGB) / mxRGB, 0.0, 1.0);
                ampRGB = sqrt(ampRGB);

                // Apply adaptive sharpening
                float peak = -1.0 / (8.0 - 3.0 * u_strength);
                vec4 wRGB = ampRGB * peak;
                vec4 rcpWeightRGB = 1.0 / (1.0 + 4.0 * wRGB);

                gl_FragColor = clamp((b * wRGB + d * wRGB + f * wRGB + h * wRGB + e) * rcpWeightRGB, 0.0, 1.0);
            } else {
                // Standard unsharp mask sharpening
                vec4 top    = texture2D(u_texture, v_texCoord + texel * vec2( 0.0, -1.0));
                vec4 left   = texture2D(u_texture, v_texCoord + texel * vec2(-1.0,  0.0));
                vec4 right  = texture2D(u_texture, v_texCoord + texel * vec2( 1.0,  0.0));
                vec4 bottom = texture2D(u_texture, v_texCoord + texel * vec2( 0.0,  1.0));

                // Laplacian edge detection
                vec4 edges = 4.0 * center - top - left - right - bottom;

                // Add edges back to original (unsharp mask)
                gl_FragColor = clamp(center + edges * u_strength, 0.0, 1.0);
            }
        }
    `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    function initWebGL(canvas) {
        const gl = canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
            powerPreference: 'high-performance'
        });

        if (!gl) {
            console.error('WebGL not supported');
            return null;
        }

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        if (!vertexShader || !fragmentShader) return null;

        const program = createProgram(gl, vertexShader, fragmentShader);
        if (!program) return null;

        // Set up geometry (full-screen quad)
        const positions = new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1,  1,  1, -1,   1, 1
        ]);
        const texCoords = new Float32Array([
            0, 1,  1, 1,  0, 0,
            0, 0,  1, 1,  1, 0
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        // Create texture for video
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return {
            gl,
            program,
            positionBuffer,
            texCoordBuffer,
            texture,
            positionLocation: gl.getAttribLocation(program, 'a_position'),
            texCoordLocation: gl.getAttribLocation(program, 'a_texCoord'),
            textureLocation: gl.getUniformLocation(program, 'u_texture'),
            textureSizeLocation: gl.getUniformLocation(program, 'u_textureSize'),
            strengthLocation: gl.getUniformLocation(program, 'u_strength'),
            useCASLocation: gl.getUniformLocation(program, 'u_useCAS')
        };
    }

    function renderFrame(video, glContext, preset) {
        const { gl, program, positionBuffer, texCoordBuffer, texture,
                positionLocation, texCoordLocation, textureLocation,
                textureSizeLocation, strengthLocation, useCASLocation } = glContext;

        if (video.readyState < 2) {
            // Not enough data - clear to transparent
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return;
        }

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(program);

        // Update texture with current video frame
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

        // Set uniforms
        gl.uniform1i(textureLocation, 0);
        gl.uniform2f(textureSizeLocation, video.videoWidth, video.videoHeight);
        gl.uniform1f(strengthLocation, preset.strength);
        gl.uniform1i(useCASLocation, preset.cas ? 1 : 0);

        // Set up position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Set up texcoord attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function startEnhancement(video) {
        if (window.__videoEnhance.animationId) {
            cancelAnimationFrame(window.__videoEnhance.animationId);
        }

        // Create canvas overlay
        const canvas = document.createElement('canvas');
        canvas.id = 'video-enhance-canvas';

        // Match video dimensions - use the actual displayed size
        const updateCanvasSize = () => {
            // Get the video's computed style to match its exact display
            const computedStyle = window.getComputedStyle(video);
            const displayWidth = parseFloat(computedStyle.width);
            const displayHeight = parseFloat(computedStyle.height);

            // Canvas internal resolution matches video source
            canvas.width = video.videoWidth || displayWidth;
            canvas.height = video.videoHeight || displayHeight;

            // Canvas display size matches video display size exactly
            // Start with visibility hidden until we have a frame to render
            const isHidden = !window.__videoEnhance.videoHidden;
            canvas.style.cssText = `
                position: absolute;
                top: ${computedStyle.top || '0'};
                left: ${computedStyle.left || '0'};
                width: ${displayWidth}px;
                height: ${displayHeight}px;
                pointer-events: none;
                z-index: 1;
                object-fit: ${computedStyle.objectFit || 'contain'};
                background: transparent;
                ${isHidden ? 'visibility: hidden;' : ''}
            `;
        };
        updateCanvasSize();

        // Position canvas over video
        const videoParent = video.parentElement;
        if (videoParent) {
            const parentStyle = window.getComputedStyle(videoParent);
            if (parentStyle.position === 'static') {
                videoParent.style.position = 'relative';
            }
            videoParent.appendChild(canvas);
        }

        // Initialize WebGL
        const glContext = initWebGL(canvas);
        if (!glContext) {
            console.error('Failed to initialize WebGL');
            canvas.remove();
            return false;
        }

        window.__videoEnhance.canvas = canvas;
        window.__videoEnhance.glContext = glContext;
        window.__videoEnhance.originalVideo = video;
        window.__videoEnhance.videoHidden = false;

        // Render loop - uses a flag to track if this specific enhancement is active
        let isActive = true;
        window.__videoEnhance.stopRender = () => { isActive = false; };

        function render() {
            if (!isActive) return;

            const preset = sharpPresets[window.__videoEnhance.filterIndex];

            // Show canvas once we have valid frames (but don't hide video - let it show as background)
            if (video.readyState >= 2 && !window.__videoEnhance.videoHidden) {
                window.__videoEnhance.canvas.style.visibility = 'visible';
                window.__videoEnhance.videoHidden = true;
            }

            renderFrame(video, glContext, preset);
            window.__videoEnhance.animationId = requestAnimationFrame(render);
        }

        // Handle video resize
        const resizeObserver = new ResizeObserver(updateCanvasSize);
        resizeObserver.observe(video);
        window.__videoEnhance.resizeObserver = resizeObserver;

        // Start rendering
        render();
        return true;
    }

    function stopEnhancement() {
        // Stop the render loop first
        if (window.__videoEnhance.stopRender) {
            window.__videoEnhance.stopRender();
            window.__videoEnhance.stopRender = null;
        }

        if (window.__videoEnhance.animationId) {
            cancelAnimationFrame(window.__videoEnhance.animationId);
            window.__videoEnhance.animationId = null;
        }

        if (window.__videoEnhance.canvas) {
            window.__videoEnhance.canvas.remove();
            window.__videoEnhance.canvas = null;
        }

        if (window.__videoEnhance.originalVideo) {
            window.__videoEnhance.originalVideo = null;
        }

        if (window.__videoEnhance.resizeObserver) {
            window.__videoEnhance.resizeObserver.disconnect();
            window.__videoEnhance.resizeObserver = null;
        }

        window.__videoEnhance.glContext = null;
        window.__videoEnhance.videoHidden = false;
    }

    // Find video element
    function findVideoElement() {
        // Direct video elements
        const video = document.querySelector('video');
        if (video) return video;

        // Check shadow DOM
        for (const el of document.querySelectorAll('*')) {
            if (el.shadowRoot) {
                const shadowVideo = el.shadowRoot.querySelector('video');
                if (shadowVideo) return shadowVideo;
            }
        }
        return null;
    }

    // Toggle enhancement
    function toggleEnhancement() {
        // If currently enabled, turn off
        if (window.__videoEnhance.enabled) {
            window.__videoEnhance.enabled = false;
            window.__videoEnhance.savedEnabled = false;
            stopEnhancement();
            showNotification('Enhancement: OFF');
        } else {
            // Try to turn on
            const video = findVideoElement();
            if (video) {
                // Stop any existing enhancement first
                stopEnhancement();

                const success = startEnhancement(video);
                if (success) {
                    window.__videoEnhance.enabled = true;
                    window.__videoEnhance.savedEnabled = true;
                    const preset = sharpPresets[window.__videoEnhance.filterIndex];
                    showNotification(`Enhancement: ${preset.name}`);
                } else {
                    window.__videoEnhance.enabled = false;
                    window.__videoEnhance.savedEnabled = false;
                    showNotification('Enhancement: Failed (WebGL error)');
                }
            } else {
                showNotification('Enhancement: No video found');
            }
        }

        // Save preference
        try {
            localStorage.setItem('plex-video-enhance-enabled', window.__videoEnhance.enabled ? 'true' : 'false');
        } catch(e) {}

        return window.__videoEnhance.enabled;
    }

    // Cycle through presets
    function cycleFilterStrength() {
        if (!window.__videoEnhance.enabled) {
            toggleEnhancement();
            return;
        }

        window.__videoEnhance.filterIndex = (window.__videoEnhance.filterIndex + 1) % sharpPresets.length;
        const preset = sharpPresets[window.__videoEnhance.filterIndex];
        showNotification(`Filter: ${preset.name}`);

        // Save preference
        try {
            localStorage.setItem('plex-video-filter-index', window.__videoEnhance.filterIndex.toString());
        } catch(e) {}
    }

    // Show notification
    function showNotification(message) {
        let notification = document.getElementById('video-enhance-notification');

        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'video-enhance-notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.85);
                color: #e5a00d;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                font-weight: 600;
                z-index: 999999;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                border: 1px solid rgba(229, 160, 13, 0.3);
            `;
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.opacity = '1';

        if (notification._timeout) {
            clearTimeout(notification._timeout);
        }

        notification._timeout = setTimeout(() => {
            notification.style.opacity = '0';
        }, 2000);
    }

    // Auto-enable enhancement if it was previously on
    function autoEnableIfNeeded() {
        // Only auto-enable if saved preference is on AND we're not currently enhanced
        if (!window.__videoEnhance.enabled && window.__videoEnhance.savedEnabled) {
            const video = findVideoElement();
            if (video && video.readyState >= 2) {
                const success = startEnhancement(video);
                if (success) {
                    window.__videoEnhance.enabled = true;
                    const preset = sharpPresets[window.__videoEnhance.filterIndex];
                    showNotification(`Enhancement: ${preset.name}`);
                }
            }
        }
    }

    // Watch for video elements being added to the page
    function setupVideoObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
                        // Video added, try to auto-enable after a short delay
                        setTimeout(autoEnableIfNeeded, 500);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        window.__videoEnhance.videoObserver = observer;
    }

    // Initialize
    function init() {
        // Load saved preferences
        try {
            const savedIndex = localStorage.getItem('video-filter-index');
            if (savedIndex) {
                window.__videoEnhance.filterIndex = parseInt(savedIndex, 10) || 0;
            }

            const savedEnabled = localStorage.getItem('video-enhance-enabled');
            if (savedEnabled === 'true') {
                window.__videoEnhance.savedEnabled = true;
            }
        } catch(e) {}

        // Set up observer to detect when videos are added
        setupVideoObserver();

        // Also check periodically for videos (in case observer misses them)
        setInterval(autoEnableIfNeeded, 2000);

        // Keyboard shortcuts - Cmd on Mac, Ctrl on Windows/Linux
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const modKey = e.metaKey || e.ctrlKey;

            // Cmd/Ctrl+Shift+E to toggle enhancement
            if (modKey && e.shiftKey && key === 'e') {
                e.preventDefault();
                e.stopPropagation();
                toggleEnhancement();
                return;
            }
            // Cmd/Ctrl+Shift+F to cycle filter strength
            if (modKey && e.shiftKey && key === 'f') {
                e.preventDefault();
                e.stopPropagation();
                cycleFilterStrength();
                return;
            }
        }, true);
    }

    // Expose functions globally
    window.toggleVideoEnhancement = toggleEnhancement;
    window.cycleVideoFilter = cycleFilterStrength;
    window.setVideoEnhancement = (enabled) => {
        if (enabled !== window.__videoEnhance.enabled) {
            toggleEnhancement();
        }
    };

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
