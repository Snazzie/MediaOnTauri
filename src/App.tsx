import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import "./App.css";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Detect if running on macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘ Cmd' : 'Ctrl';
const altKey = isMac ? '⌥ Option' : 'Alt';

function App() {
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState("https://app.plex.tv/desktop");
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [tauriVersion, setTauriVersion] = useState<string | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body: string } | null>(null);
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
                        setUpdateAvailable({ version: update.version, body: update.body || "" });
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
                                const percent = Math.round((downloaded / contentLength) * 100);
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
            <div className="error-container">
                <h2>Error Loading Url</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} type="button">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="confirmation-container">
                <h2>Welcome to Media On Tauri</h2>
                {tauriVersion && <p>App Version: {tauriVersion}</p>}
                {updateAvailable && (
                    <div className="update-banner">
                        <p>Update available: v{updateAvailable.version}</p>
                        {updateStatus ? (
                            <p className="update-status">{updateStatus}</p>
                        ) : (
                            <button onClick={installUpdate} type="button" className="update-button">
                                Install Update
                            </button>
                        )}
                        {isMac && (
                            <p className="gatekeeper-note">
                                After updating, run in Terminal to bypass Gatekeeper:
                                <code className="gatekeeper-command">xattr -cr /Applications/Media\ On\ Tauri.app</code>
                            </p>
                        )}
                    </div>
                )}
                <p>
                    Repository:{" "}
                    <a
                        href="https://github.com/Snazzie/MediaOnTauri"
                        target="_blank"
                        aria-label="GitHub Repository"
                        rel="noreferrer"
                    >
                        https://github.com/Snazzie/MediaOnTauri
                    </a>
                </p>
                <div className="zoom-level-display">
                    Zoom: {(zoomLevel * 100).toFixed(0)}%
                </div>
                <div className="keyboard-shortcuts">
                    <h3>Keyboard Shortcuts</h3>
                    <table className="shortcuts-table">
                        <tbody>
                            <tr>
                                <td className="shortcut-key">{modKey} + / -</td>
                                <td>Adjust zoom level</td>
                            </tr>
                            <tr>
                                <td className="shortcut-key">{altKey} + [ / ]</td>
                                <td>Adjust video brightness</td>
                            </tr>
                            <tr>
                                <td className="shortcut-key">{altKey} + P</td>
                                <td>Toggle Picture-in-Picture mode</td>
                            </tr>
                            <tr>
                                <td className="shortcut-key">{modKey} + Shift + E</td>
                                <td>Toggle video enhancement</td>
                            </tr>
                            <tr>
                                <td className="shortcut-key">{modKey} + Shift + F</td>
                                <td>Cycle enhancement presets</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="enhancement-note">
                        Enhancement presets: Light, Medium, Strong, Extreme, CAS (Adaptive)
                    </p>
                </div>

                <div className="url-input-container">
                    <label htmlFor="url">Web Client URL:</label>
                    <input
                        id="url"
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter Web Client URL"
                    />
                </div>

                <p className="url-help-text">
                    Examples: <br />- Default Plex: https://app.plex.tv/desktop <br />-
                    Local Plex: http://192.168.1.100:32400/web <br />- Tailscale:
                    http://plexserver:32400/web
                </p>
                <button onClick={loadUrl} type="button">
                    Continue to Web Client
                </button>
            </div>

            {error && (
                <div className="error-container">
                    <h2>Error Loading Plex</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} type="button">
                        Retry
                    </button>
                </div>
            )}
        </>
    );
}

export default App;
