import { load } from "@tauri-apps/plugin-store";
import { useEffect, useState } from "react";
import "./App.css";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

// Detect if running on macOS
const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
const modKey = isMac ? "⌘ Cmd" : "Ctrl";
const altKey = isMac ? "⌥ Option" : "Alt";

function App() {
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState("https://app.plex.tv/desktop");
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [tauriVersion, setTauriVersion] = useState<string | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState<{
        version: string;
        body: string;
    } | null>(null);
    const [updateStatus, setUpdateStatus] = useState<string | null>(null);

    // Load saved URL from store and set up initial window state when component mounts
    useEffect(() => {
        const initialize = async () => {
            try {
                // Load saved URL
                const store = await load("settings.json");
                const savedUrl = await store.get<string>("url");
                if (savedUrl) {
                    setUrl(savedUrl);
                }

                // Load saved zoom level
                const savedZoomLevel = await invoke<number>("get_saved_zoom_level");
                setZoomLevel(savedZoomLevel);

                // Get Tauri version
                const version = await getVersion();
                setTauriVersion(version);

                // Check for updates
                try {
                    const update = await check();
                    if (update) {
                        setUpdateAvailable({
                            version: update.version,
                            body: update.body || "",
                        });
                    }
                } catch {
                    // Silently fail - update check is not critical
                }
            } catch (err) {
                console.error("Failed during initialization:", err);
                // Make window visible even if there was an error
            }
        };

        initialize();
    }, []);

    useEffect(() => {
        const unlisten = listen<number>("zoom-level-changed", (event) => {
            setZoomLevel(event.payload);
        });

        return () => {
            unlisten.then((f) => f());
        };
    }, []);

    const saveUrl = async (url: string) => {
        try {
            const store = await load("settings.json");
            await store.set("url", url);
            await store.save();
            console.debug("URL saved successfully:", url);
        } catch (err) {
            console.error("Failed to save URL:", err);
        }
    };

    const installUpdate = async () => {
        try {
            setUpdateStatus("Downloading update...");
            const update = await check();
            if (update) {
                let downloaded = 0;
                let contentLength = 0;
                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case "Started":
                            contentLength = event.data.contentLength ?? 0;
                            setUpdateStatus("Downloading: 0%");
                            break;
                        case "Progress":
                            downloaded += event.data.chunkLength;
                            if (contentLength > 0) {
                                const percent = Math.round(
                                    (downloaded / contentLength) * 100,
                                );
                                setUpdateStatus(`Downloading: ${percent}%`);
                            }
                            break;
                        case "Finished":
                            setUpdateStatus("Installing...");
                            break;
                    }
                });
                setUpdateStatus("Restarting...");
                await relaunch();
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setUpdateStatus(`Update failed: ${errorMsg}`);
        }
    };

    const loadUrl = async () => {
        try {
            // Save URL to settings
            await saveUrl(url);

            window.location.href = url;

            console.debug("Navigated to Url in the current window");

            return () => {};
        } catch (err: unknown) {
            console.error("Failed to initialize Url:", err);
            setError(
                `Failed to initialize Url: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    };

    if (error) {
        return (
            <>
                <div className="app-bg" />
                <div className="launch-screen">
                    <div className="error-card">
                        <h2>Error Loading URL</h2>
                        <p>{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            type="button"
                            className="secondary-button"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="app-bg" />
            <div className="launch-screen">
                <div className="launch-card">
                    {/* Header */}
                    <div className="launch-header">
                        <h2 className="launch-title">Media On Tauri</h2>
                        {tauriVersion && (
                            <span className="version-badge">v{tauriVersion}</span>
                        )}
                        <a
                            className="github-link"
                            href="https://github.com/Snazzie/MediaOnTauri"
                            target="_blank"
                            aria-label="GitHub Repository"
                            rel="noreferrer"
                        >
                            github.com/Snazzie/MediaOnTauri
                        </a>
                    </div>

                    {/* Update banner */}
                    {updateAvailable && (
                        <div className="update-banner">
                            <p>Update available: v{updateAvailable.version}</p>
                            {updateStatus ? (
                                <p className="update-status">{updateStatus}</p>
                            ) : (
                                <button
                                    onClick={installUpdate}
                                    type="button"
                                    className="update-button"
                                >
                                    Install Update
                                </button>
                            )}
                            {isMac && (
                                <p className="gatekeeper-note">
                                    After updating, run in Terminal to bypass Gatekeeper:
                                    <code className="gatekeeper-command">
                                        xattr -cr /Applications/Media\ On\ Tauri.app
                                    </code>
                                </p>
                            )}
                        </div>
                    )}

                    <hr />

                    {/* Keyboard shortcuts */}
                    <div className="shortcuts-section">
                        <span className="section-label">Keyboard Shortcuts</span>
                        <div className="shortcut-row">
                            <span className="shortcut-keys">
                                <kbd>{modKey}</kbd>
                                <kbd>+ / -</kbd>
                            </span>
                            <span className="shortcut-desc">Adjust zoom level</span>
                        </div>
                        <div className="shortcut-row">
                            <span className="shortcut-keys">
                                <kbd>{altKey}</kbd>
                                <kbd>[ / ]</kbd>
                            </span>
                            <span className="shortcut-desc">Adjust video brightness</span>
                        </div>
                        <div className="shortcut-row">
                            <span className="shortcut-keys">
                                <kbd>{altKey}</kbd>
                                <kbd>P</kbd>
                            </span>
                            <span className="shortcut-desc">
                                Toggle Picture-in-Picture
                            </span>
                        </div>
                        <div className="shortcut-row">
                            <span className="shortcut-keys">
                                <kbd>{modKey}</kbd>
                                <kbd>Shift</kbd>
                                <kbd>E</kbd>
                            </span>
                            <span className="shortcut-desc">
                                Toggle video enhancement
                            </span>
                        </div>
                        <div className="shortcut-row">
                            <span className="shortcut-keys">
                                <kbd>{modKey}</kbd>
                                <kbd>Shift</kbd>
                                <kbd>F</kbd>
                            </span>
                            <span className="shortcut-desc">
                                Cycle enhancement presets
                            </span>
                        </div>
                        <p className="enhancement-note">
                            Presets: Light, Medium, Strong, Extreme, CAS (Adaptive)
                        </p>
                    </div>

                    <hr />

                    {/* URL input */}
                    <div className="url-section">
                        <span className="section-label">Web Client URL</span>
                        <input
                            id="url"
                            type="text"
                            className="url-input"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter Web Client URL"
                        />
                        <div className="url-examples">
                            <span className="url-example">
                                <span className="url-example-label">Default Plex: </span>
                                https://app.plex.tv/desktop
                            </span>
                            <span className="url-example">
                                <span className="url-example-label">Local Plex: </span>
                                http://192.168.1.100:32400/web
                            </span>
                            <span className="url-example">
                                <span className="url-example-label">Tailscale: </span>
                                http://plexserver:32400/web
                            </span>
                        </div>
                    </div>

                    <button onClick={loadUrl} type="button" className="primary-button">
                        Continue to Web Client
                    </button>
                </div>
            </div>

            <div className="zoom-display">Zoom: {(zoomLevel * 100).toFixed(0)}%</div>
        </>
    );
}

export default App;
