# Video Enhancement

Media on Tauri includes real-time video enhancement using WebGL shaders. This feature applies GPU-accelerated sharpening filters to improve video clarity without modifying the source stream.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Windows/Linux) | Toggle enhancement on/off |
| `Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Windows/Linux) | Cycle through presets |

## Sharpening Presets

### 1. Sharpen Light (Strength: 0.3)
Subtle sharpening for high-quality sources. Enhances fine details without introducing artifacts. Best for:
- 1080p and 4K content
- Content with minimal compression artifacts
- When you want a slight clarity boost

### 2. Sharpen Medium (Strength: 0.5)
Balanced sharpening suitable for most content. Provides noticeable improvement without being aggressive. Best for:
- 720p to 1080p content
- Streaming content with moderate compression
- General everyday viewing

### 3. Sharpen Strong (Strength: 0.8)
Aggressive sharpening for softer sources. Significantly enhances edge definition. Best for:
- 480p to 720p content
- Older or heavily compressed media
- Content that appears soft or blurry

### 4. Sharpen Extreme (Strength: 1.2)
Maximum sharpening intensity. May introduce visible halos around edges. Best for:
- Very low resolution content
- Extremely soft or blurry sources
- When maximum clarity is needed regardless of artifacts

### 5. CAS - Contrast Adaptive Sharpening (Strength: 0.6)
Contrast Adaptive Sharpening applies sharpening selectively based on local contrast, reducing artifacts in uniform areas while enhancing edges. Best for:
- All resolutions
- Content with varying detail levels
- When you want intelligent, adaptive sharpening

*Note: This is a custom GLSL implementation inspired by CAS principles.*

## How It Works

### Unsharp Mask (Presets 1-4)
The standard sharpening presets use an unsharp mask algorithm:
1. Samples the center pixel and its 4 neighbors (top, bottom, left, right)
2. Calculates edges using Laplacian edge detection: `edges = 4 * center - neighbors`
3. Adds edges back to the original: `output = center + edges * strength`

### Contrast Adaptive Sharpening (Preset 5)
CAS uses a more sophisticated approach:
1. Samples the center pixel and all 8 neighbors (3x3 grid)
2. Calculates local minimum and maximum values
3. Determines sharpening amount based on local contrast
4. Areas with high contrast get more sharpening
5. Uniform areas receive minimal processing to avoid noise amplification

## Persistence

Your enhancement preference (on/off state and selected preset) is automatically saved and restored:
- Settings persist across page navigations
- Settings persist when videos change
- Enhancement auto-enables when a new video starts (if previously enabled)

## Troubleshooting

### Enhancement not turning on
- Ensure a video is currently playing
- Check browser console for WebGL errors
- Try refreshing the page

### Visual artifacts (halos, ringing)
- Switch to a lower strength preset
- Try the CAS preset for adaptive sharpening

### Performance issues
- CAS is slightly more GPU-intensive than standard presets
- On older hardware, try Sharpen Light or Medium
