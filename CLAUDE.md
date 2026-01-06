# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plex On Tauri is a lightweight desktop application that wraps the Plex Web Client in a native window using Tauri 2. It provides a dedicated Plex Media Player experience optimized for ARM-based devices while also working on x86.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (runs both Vite frontend and Tauri backend)
pnpm tauri dev

# Build production application
pnpm tauri build

# Build frontend only (TypeScript + Vite)
pnpm build
```

## Architecture

### Frontend (React + Vite)
- **Entry point**: `src/main.tsx` → `src/App.tsx`
- **Purpose**: Displays a welcome screen where users configure the Plex URL, then navigates the webview to Plex
- **Settings persistence**: Uses `@tauri-apps/plugin-store` to save/load user preferences to `settings.json`

### Backend (Rust + Tauri)
- **Entry point**: `src-tauri/src/main.rs` → `src-tauri/src/lib.rs`
- **Handlers**: `src-tauri/src/handlers/` - Tauri commands exposed to frontend
  - `pip.rs` - Picture-in-Picture mode toggle and state management
  - `toggle_fullscreen.rs` - Fullscreen toggling
  - `zoom.rs` - Zoom level adjustment and persistence
  - `window_drag.rs` - Window dragging support
- **Scripts**: `src-tauri/src/scripts/` - JavaScript injected into all webviews
  - `script.rs` - Combines all scripts via `init_script()`
  - Individual scripts handle keyboard shortcuts (fullscreen, zoom, PiP overlay, video enhancement)
  - `video_enhance_script.rs` - WebGL-based video sharpening with multiple presets

### Key Features Implementation
- **Picture-in-Picture (Alt+P)**: Stores window state before entering PiP, resizes to 30% width x 20% height, positions bottom-right, removes decorations, enables always-on-top
- **Zoom controls (Cmd/Ctrl +/-)**: Persisted via Tauri store plugin
- **Video Enhancement (Cmd/Ctrl+Shift+E)**: GPU-accelerated sharpening using WebGL canvas overlay. Presets cycle with Cmd/Ctrl+Shift+F. Uses localStorage for persistence across navigations.
- **Window state restoration**: Uses `tauri-plugin-window-state` for desktop platforms

### Configuration
- **Tauri config**: `src-tauri/tauri.conf.json` - Window settings, CSP rules for Plex domains, bundle settings
- **CSP**: Allows connections to `*.plex.tv` domains for the web client to function
