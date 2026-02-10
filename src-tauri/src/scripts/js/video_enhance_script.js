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
        videoObserver: null,
        isHDRActive: false,
        usingCSSFilter: false
    };

    // Sharpening presets with different kernel strengths
    // For CSS filter: strength maps to kernel multiplier
    const sharpPresets = [
        { name: 'Sharpen Light', strength: 0.3, cssStrength: 0.5 },
        { name: 'Sharpen Medium', strength: 0.5, cssStrength: 1.0 },
        { name: 'Sharpen Strong', strength: 0.8, cssStrength: 1.5 },
        { name: 'Sharpen Extreme', strength: 1.2, cssStrength: 2.5 },
        { name: 'CAS (Adaptive)', strength: 0.6, cas: true, cssStrength: 1.2 }
    ];

    // HDR Detection Functions
    function isScreenHDRCapable() {
        return window.matchMedia('(dynamic-range: high)').matches;
    }

    // CSS/SVG filter approach for HDR - applies sharpening without capturing video frames
    function createSVGSharpenFilter(strength) {
        // Remove existing filter
        const existingFilter = document.getElementById('video-enhance-svg-filter');
        if (existingFilter) existingFilter.remove();

        // Sharpening kernel: center = 1 + 4*strength, edges = -strength
        // This is an unsharp mask convolution
        const center = 1 + 4 * strength;
        const edge = -strength;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'video-enhance-svg-filter';
        svg.setAttribute('style', 'position: absolute; width: 0; height: 0;');
        svg.innerHTML = `
            <defs>
                <filter id="sharpen-filter" color-interpolation-filters="sRGB">
                    <feConvolveMatrix
                        order="3"
                        kernelMatrix="0 ${edge} 0 ${edge} ${center} ${edge} 0 ${edge} 0"
                        preserveAlpha="true"
                    />
                </filter>
            </defs>
        `;
        document.body.appendChild(svg);
        return 'url(#sharpen-filter)';
    }

    function applyCSSFilter(video, preset) {
        const filterUrl = createSVGSharpenFilter(preset.cssStrength || preset.strength);
        video.style.filter = filterUrl;
        console.log('[VideoEnhance] Applied CSS filter:', filterUrl, 'to video:', video);
        console.log('[VideoEnhance] Video computed filter:', window.getComputedStyle(video).filter);
    }

    function removeCSSFilter(video) {
        if (video) {
            video.style.filter = '';
        }
        const existingFilter = document.getElementById('video-enhance-svg-filter');
        if (existingFilter) existingFilter.remove();
    }

    async function detectVideoHDR(video) {
        const result = {
            isHDR: false,
            colorSpace: null,
            detectionMethod: 'none'
        };

        // Method 1: requestVideoFrameCallback (Chrome/Edge)
        if ('requestVideoFrameCallback' in video) {
            try {
                const frameResult = await new Promise(resolve => {
                    const timeoutId = setTimeout(() => resolve(null), 1000);
                    video.requestVideoFrameCallback((now, metadata) => {
                        clearTimeout(timeoutId);
                        console.log('[VideoEnhance] requestVideoFrameCallback metadata:', metadata);
                        resolve(metadata);
                    });
                });
                if (frameResult?.colorSpace) {
                    const transfer = frameResult.colorSpace.transfer;
                    if (transfer === 'pq' || transfer === 'hlg' || transfer === 'smpte2084') {
                        result.isHDR = true;
                        result.colorSpace = frameResult.colorSpace;
                        result.detectionMethod = 'requestVideoFrameCallback';
                        return result;
                    }
                }
            } catch (e) {
                console.log('[VideoEnhance] requestVideoFrameCallback error:', e);
            }
        }

        // Method 2: Check video.getVideoPlaybackQuality for HDR hints
        if ('getVideoPlaybackQuality' in video) {
            const quality = video.getVideoPlaybackQuality();
            console.log('[VideoEnhance] VideoPlaybackQuality:', quality);
        }

        // Method 3: Check for WebKit-specific properties
        console.log('[VideoEnhance] Video element properties:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            webkitDecodedFrameCount: video.webkitDecodedFrameCount,
            webkitDroppedFrameCount: video.webkitDroppedFrameCount,
        });

        // Method 4: Check MediaSource/SourceBuffer for codec info if available
        if (video.srcObject || video.src) {
            console.log('[VideoEnhance] Video source:', video.src || 'srcObject');
        }

        // Method 5: Heuristic - 4K + HDR-capable screen likely means HDR content
        // This is a fallback assumption for HDR displays watching high-res content
        const is4K = video.videoWidth >= 3840 || video.videoHeight >= 2160;
        if (is4K) {
            console.log('[VideoEnhance] 4K content detected, assuming HDR on HDR-capable screen');
            result.isHDR = true;
            result.detectionMethod = 'heuristic-4k';
            return result;
        }

        return result;
    }

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

    // Fragment shader with unsharp mask sharpening (SDR - WebGL1)
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

    // WebGL2 vertex shader (GLSL ES 3.0)
    const vertexShaderSourceGL2 = `#version 300 es
        in vec2 a_position;
        in vec2 a_texCoord;
        out vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;

    // HDR fragment shader - highp precision, no clamping
    // Debug: set u_strength to 0.0 for passthrough to test if capture is the issue
    const fragmentShaderSourceHDR = `#version 300 es
        precision highp float;
        in vec2 v_texCoord;
        out vec4 fragColor;
        uniform sampler2D u_texture;
        uniform vec2 u_textureSize;
        uniform float u_strength;
        uniform int u_useCAS;

        void main() {
            vec2 texel = 1.0 / u_textureSize;
            vec4 center = texture(u_texture, v_texCoord);

            // Debug passthrough - if strength is 0, just output the texture as-is
            if (u_strength < 0.01) {
                fragColor = center;
                return;
            }

            if (u_useCAS == 1) {
                // CAS for HDR - same algorithm but without clamping
                vec4 a = texture(u_texture, v_texCoord + texel * vec2(-1.0, -1.0));
                vec4 b = texture(u_texture, v_texCoord + texel * vec2( 0.0, -1.0));
                vec4 c = texture(u_texture, v_texCoord + texel * vec2( 1.0, -1.0));
                vec4 d = texture(u_texture, v_texCoord + texel * vec2(-1.0,  0.0));
                vec4 e = center;
                vec4 f = texture(u_texture, v_texCoord + texel * vec2( 1.0,  0.0));
                vec4 g = texture(u_texture, v_texCoord + texel * vec2(-1.0,  1.0));
                vec4 h = texture(u_texture, v_texCoord + texel * vec2( 0.0,  1.0));
                vec4 i = texture(u_texture, v_texCoord + texel * vec2( 1.0,  1.0));

                vec4 mnRGB = min(min(min(d, e), min(f, b)), h);
                vec4 mxRGB = max(max(max(d, e), max(f, b)), h);
                mnRGB = min(min(min(mnRGB, a), min(c, g)), i);
                mxRGB = max(max(max(mxRGB, a), max(c, g)), i);

                // HDR-safe contrast calculation (avoid division by zero)
                vec4 ampRGB = (mxRGB - mnRGB) / (mxRGB + 0.001);
                ampRGB = sqrt(ampRGB);

                float peak = -1.0 / (8.0 - 3.0 * u_strength);
                vec4 wRGB = ampRGB * peak;
                vec4 rcpWeightRGB = 1.0 / (1.0 + 4.0 * wRGB);

                fragColor = (b * wRGB + d * wRGB + f * wRGB + h * wRGB + e) * rcpWeightRGB;
            } else {
                // Unsharp mask for HDR - no luminance scaling, preserve all values
                vec4 top = texture(u_texture, v_texCoord + texel * vec2(0.0, -1.0));
                vec4 left = texture(u_texture, v_texCoord + texel * vec2(-1.0, 0.0));
                vec4 right = texture(u_texture, v_texCoord + texel * vec2(1.0, 0.0));
                vec4 bottom = texture(u_texture, v_texCoord + texel * vec2(0.0, 1.0));

                vec4 edges = 4.0 * center - top - left - right - bottom;
                fragColor = center + edges * u_strength;
            }
            fragColor.a = center.a;
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

    function initWebGL(canvas, useHDR = false) {
        // Try WebGL2 first (required for HDR), fall back to WebGL1
        const contextOptions = {
            preserveDrawingBuffer: true,
            alpha: true,
            premultipliedAlpha: false,
            antialias: false,
            powerPreference: 'high-performance'
        };

        // Add color space for HDR if supported
        if (useHDR) {
            contextOptions.colorSpace = 'display-p3';
        }

        let gl = canvas.getContext('webgl2', contextOptions);
        const isWebGL2 = !!gl;

        if (!gl) {
            gl = canvas.getContext('webgl', contextOptions);
        }

        if (!gl) {
            console.error('WebGL not supported');
            return null;
        }

        // Check for HDR capability - requires WebGL2 + EXT_color_buffer_float
        let canDoHDR = false;
        if (isWebGL2 && useHDR) {
            const extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
            canDoHDR = !!extColorBufferFloat;

            // Try to set color spaces for HDR if available
            if (canDoHDR) {
                try {
                    // Disable automatic color space conversion during texture upload
                    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

                    if ('drawingBufferColorSpace' in gl) {
                        gl.drawingBufferColorSpace = 'display-p3';
                    }
                    if ('unpackColorSpace' in gl) {
                        gl.unpackColorSpace = 'display-p3';
                    }

                    console.log('[VideoEnhance] HDR color space config:', {
                        drawingBufferColorSpace: gl.drawingBufferColorSpace,
                        unpackColorSpace: gl.unpackColorSpace
                    });
                } catch (e) {
                    console.log('[VideoEnhance] Color space config error:', e);
                }
            }
        }

        // Select appropriate shaders based on HDR capability
        const vertexSrc = (isWebGL2 && canDoHDR) ? vertexShaderSourceGL2 : vertexShaderSource;
        const fragmentSrc = (isWebGL2 && canDoHDR) ? fragmentShaderSourceHDR : fragmentShaderSource;

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

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
            useCASLocation: gl.getUniformLocation(program, 'u_useCAS'),
            isHDR: canDoHDR,
            isWebGL2: isWebGL2,
            internalFormat: canDoHDR ? gl.RGBA16F : gl.RGBA,
            textureType: canDoHDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
        };
    }

    function renderFrame(video, glContext, preset) {
        const { gl, program, positionBuffer, texCoordBuffer, texture,
                positionLocation, texCoordLocation, textureLocation,
                textureSizeLocation, strengthLocation, useCASLocation,
                isHDR, internalFormat, textureType } = glContext;

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
        if (isHDR) {
            // HDR path: use RGBA16F floating-point texture
            // Ensure no color space conversion happens
            gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

            // Try VideoFrame API for better HDR data access (if available)
            if (typeof VideoFrame !== 'undefined') {
                try {
                    const frame = new VideoFrame(video, { timestamp: 0 });
                    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, gl.RGBA, textureType, frame);
                    frame.close();
                } catch (e) {
                    // Fallback to direct video upload
                    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, gl.RGBA, textureType, video);
                }
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, gl.RGBA, textureType, video);
            }
        } else {
            // SDR path: use standard 8-bit texture
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        }

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

    async function startEnhancement(video) {
        if (window.__videoEnhance.animationId) {
            cancelAnimationFrame(window.__videoEnhance.animationId);
        }

        // Detect HDR capability and content
        const screenHDR = isScreenHDRCapable();
        let videoHDRInfo = { isHDR: false };
        if (screenHDR) {
            videoHDRInfo = await detectVideoHDR(video);
        }
        const useHDR = screenHDR && videoHDRInfo.isHDR;

        console.log('[VideoEnhance] HDR Detection:', {
            screenHDR,
            videoHDR: videoHDRInfo.isHDR,
            colorSpace: videoHDRInfo.colorSpace,
            detectionMethod: videoHDRInfo.detectionMethod,
            useHDR
        });

        // Note: CSS SVG filters don't work reliably in WebKit for video elements.
        // For now, always use WebGL. HDR content will have tone mapping applied by the browser
        // during texture upload, which may cause some highlight clipping.
        // TODO: Revisit when WebKit adds better HDR canvas/WebGL support.
        if (useHDR) {
            console.log('[VideoEnhance] HDR detected - using WebGL path (CSS filters not supported in WebKit)');
            console.log('[VideoEnhance] Note: HDR highlights may appear slightly clipped');
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

        // Initialize WebGL with HDR flag
        const glContext = initWebGL(canvas, useHDR);
        if (!glContext) {
            console.error('Failed to initialize WebGL');
            canvas.remove();
            return false;
        }

        window.__videoEnhance.canvas = canvas;
        window.__videoEnhance.glContext = glContext;
        window.__videoEnhance.originalVideo = video;
        window.__videoEnhance.videoHidden = false;
        window.__videoEnhance.isHDRActive = glContext.isHDR;

        console.log('[VideoEnhance] WebGL initialized:', {
            isWebGL2: glContext.isWebGL2,
            isHDR: glContext.isHDR,
            textureFormat: glContext.isHDR ? 'RGBA16F' : 'RGBA8'
        });

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
        // Remove CSS filter if using HDR path
        if (window.__videoEnhance.usingCSSFilter) {
            removeCSSFilter(window.__videoEnhance.originalVideo);
            window.__videoEnhance.usingCSSFilter = false;
        }

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
        window.__videoEnhance.isHDRActive = false;
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
    async function toggleEnhancement() {
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

                const success = await startEnhancement(video);
                if (success) {
                    window.__videoEnhance.enabled = true;
                    window.__videoEnhance.savedEnabled = true;
                    const preset = sharpPresets[window.__videoEnhance.filterIndex];
                    const hdrIndicator = window.__videoEnhance.isHDRActive ? ' (HDR)' : '';
                    showNotification(`Enhancement: ${preset.name}${hdrIndicator}`);
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
            localStorage.setItem('video-enhance-enabled', window.__videoEnhance.enabled ? 'true' : 'false');
        } catch(e) {}

        return window.__videoEnhance.enabled;
    }

    // Cycle through presets
    async function cycleFilterStrength() {
        if (!window.__videoEnhance.enabled) {
            await toggleEnhancement();
            return;
        }

        window.__videoEnhance.filterIndex = (window.__videoEnhance.filterIndex + 1) % sharpPresets.length;
        const preset = sharpPresets[window.__videoEnhance.filterIndex];
        const hdrIndicator = window.__videoEnhance.isHDRActive ? ' (HDR)' : '';
        showNotification(`Filter: ${preset.name}${hdrIndicator}`);

        // Update CSS filter if using HDR path
        if (window.__videoEnhance.usingCSSFilter && window.__videoEnhance.originalVideo) {
            applyCSSFilter(window.__videoEnhance.originalVideo, preset);
        }

        // Save preference
        try {
            localStorage.setItem('video-filter-index', window.__videoEnhance.filterIndex.toString());
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
    async function autoEnableIfNeeded() {
        // Only auto-enable if saved preference is on AND we're not currently enhanced
        if (!window.__videoEnhance.enabled && window.__videoEnhance.savedEnabled) {
            const video = findVideoElement();
            if (video && video.readyState >= 2) {
                const success = await startEnhancement(video);
                if (success) {
                    window.__videoEnhance.enabled = true;
                    const preset = sharpPresets[window.__videoEnhance.filterIndex];
                    const hdrIndicator = window.__videoEnhance.isHDRActive ? ' (HDR)' : '';
                    showNotification(`Enhancement: ${preset.name}${hdrIndicator}`);
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
