import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import "./App.css";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { LuExternalLink } from "react-icons/lu";
interface UrlEntry {
    url: string;
    icon: string;
    name: string;
    id: string; // Unique identifier for each entry
}

function App() {
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState("https://app.plex.tv/desktop");
    const [urlEntries, setUrlEntries] = useState<UrlEntry[]>([]);
    const [newUrlName, setNewUrlName] = useState("");
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [tauriVersion, setTauriVersion] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isControlsModalOpen, setIsControlsModalOpen] = useState(false);

    // Generate a unique ID
    const generateId = (): string => {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    };

    // Load saved URLs from store and set up initial window state when component mounts
    useEffect(() => {
        const initialize = async () => {
            try {
                // Load saved URL
                const store = await load("settings.json");
                const savedUrl = await store.get<string>("url");
                if (savedUrl) {
                    setUrl(savedUrl);
                }

                // Load saved URL entries and ensure they have IDs
                const savedUrlEntries = await store.get<UrlEntry[]>("urlEntries");
                if (savedUrlEntries && savedUrlEntries.length > 0) {
                    // Migrate old entries to include IDs if they don't have them
                    const migratedEntries = savedUrlEntries.map((entry) => {
                        if (!entry.id) {
                            return {
                                ...entry,
                                id: generateId(),
                            };
                        }
                        return entry;
                    });

                    setUrlEntries(migratedEntries);

                    // If we had to add IDs, save the updated entries
                    if (
                        migratedEntries.some(
                            (entry) => !savedUrlEntries.find((e) => e.id === entry.id),
                        )
                    ) {
                        await saveUrlEntries(migratedEntries);
                    }
                }

                // Load saved zoom level
                const savedZoomLevel = await invoke<number>("get_saved_zoom_level");
                setZoomLevel(savedZoomLevel);

                // Get Tauri version
                const version = await getVersion();
                setTauriVersion(version);
            } catch (err) {
                console.error("Failed during initialization:", err);
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

    const saveUrlEntries = async (entries: UrlEntry[]) => {
        try {
            const store = await load("settings.json");
            await store.set("urlEntries", entries);
            await store.save();
            console.debug("URL entries saved successfully:", entries);
        } catch (err) {
            console.error("Failed to save URL entries:", err);
        }
    };

    const fetchFavicon = async (url: string): Promise<string> => {
        try {
            // Extract domain from URL
            const urlObj = new URL(url);
            const domain = urlObj.hostname;

            // Try to fetch favicon from Google's favicon service
            const iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

            // Use standard fetch API to get the icon
            const response = await fetch(iconUrl);

            if (response.status === 200) {
                // Convert response to blob
                const blob = await response.blob();

                // Create a FileReader to read the blob as data URL
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(reader.result as string);
                    };
                    reader.readAsDataURL(blob);
                });
            }

            return ""; // Return empty string if favicon couldn't be fetched
        } catch (err) {
            console.error("Failed to fetch favicon:", err);
            return "";
        }
    };

    const addUrlEntry = async () => {
        if (!url) return;

        try {
            // Generate a default name if none provided
            const name = newUrlName || new URL(url).hostname;

            // Fetch favicon
            const icon = await fetchFavicon(url);

            // Create new entry with unique ID
            const newEntry: UrlEntry = {
                url,
                icon,
                name,
                id: generateId(),
            };

            // Add to state
            const updatedEntries = [...urlEntries, newEntry];
            setUrlEntries(updatedEntries);

            // Save to store
            await saveUrlEntries(updatedEntries);

            // Reset input fields
            setNewUrlName("");

            // Close the modal
            setIsAddModalOpen(false);
        } catch (err) {
            console.error("Failed to add URL entry:", err);
        }
    };

    // State for editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");

    // Start editing an entry
    const startEditing = (entry: UrlEntry) => {
        setEditingId(entry.id);
        setEditName(entry.name);
        setEditUrl(entry.url);
    };

    // Cancel editing
    const cancelEditing = () => {
        setEditingId(null);
        setEditName("");
        setEditUrl("");
    };

    // Save edited entry
    const saveEditedEntry = async () => {
        if (!editingId || !editUrl) return;

        try {
            // Find the entry being edited
            const updatedEntries = urlEntries.map((entry) => {
                if (entry.id === editingId) {
                    // Only fetch a new favicon if the URL changed
                    if (entry.url !== editUrl) {
                        // Fetch new favicon asynchronously and update later
                        fetchFavicon(editUrl).then((newIcon) => {
                            const entriesWithNewIcon = urlEntries.map((e) =>
                                e.id === editingId ? { ...e, icon: newIcon } : e,
                            );
                            setUrlEntries(entriesWithNewIcon);
                            saveUrlEntries(entriesWithNewIcon);
                        });
                    }

                    return {
                        ...entry,
                        name: editName || new URL(editUrl).hostname,
                        url: editUrl,
                    };
                }
                return entry;
            });

            // Update state
            setUrlEntries(updatedEntries);

            // Save to store
            await saveUrlEntries(updatedEntries);

            // Reset editing state
            cancelEditing();
        } catch (err) {
            console.error("Failed to save edited entry:", err);
        }
    };

    const removeUrlEntry = async (id: string) => {
        try {
            const updatedEntries = urlEntries.filter((entry) => entry.id !== id);
            setUrlEntries(updatedEntries);
            await saveUrlEntries(updatedEntries);
        } catch (err) {
            console.error("Failed to remove URL entry:", err);
        }
    };

    const loadUrl = async (urlToLoad: string = url) => {
        try {
            // Save URL to settings
            await saveUrl(urlToLoad);

            window.location.href = urlToLoad;

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
                {tauriVersion && <p>App Version: {tauriVersion}</p>}

                <div className="zoom-level-display">
                    Zoom: {(zoomLevel * 100).toFixed(0)}%
                </div>

                <div className="buttons-row">
                    <button
                        onClick={() => setIsControlsModalOpen(true)}
                        type="button"
                        className="controls-btn"
                        title="Show Keyboard Controls"
                    >
                        See Controls
                    </button>

                    <button
                        onClick={() =>
                            window.open(
                                "https://github.com/Snazzie/MediaOnTauri",
                                "_blank",
                            )
                        }
                        type="button"
                        className="repo-btn"
                        title="GitHub Repository"
                    >
                        Repository <LuExternalLink className="external-link-icon" />
                    </button>

                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        type="button"
                        className="add-url-btn"
                        title="Add New URL"
                    >
                        +
                    </button>
                </div>

                {isControlsModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Keyboard Controls</h3>
                            <div className="controls">
                                <p className="control-instruction">
                                    Use <kbd>Ctrl</kbd> + <kbd>+</kbd> and <kbd>Ctrl</kbd>{" "}
                                    + <kbd>-</kbd> to adjust zoom.
                                </p>
                                <p className="control-instruction">
                                    Use <kbd>Alt</kbd> + <kbd>[</kbd> and <kbd>Alt</kbd> +{" "}
                                    <kbd>]</kbd> to adjust video brightness.
                                </p>
                                <p className="control-instruction">
                                    Use <kbd>Alt</kbd> + <kbd>P</kbd> to toggle Picture In
                                    Picture mode.
                                </p>
                            </div>
                            <div className="modal-actions">
                                <button
                                    onClick={() => setIsControlsModalOpen(false)}
                                    type="button"
                                    className="close-btn"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isAddModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Add New Web Client</h3>
                            <div className="modal-form">
                                <label htmlFor="url">Web Client URL:</label>
                                <input
                                    id="url"
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="Enter Web Client URL"
                                />
                                <label htmlFor="urlName">Name (optional):</label>
                                <input
                                    id="urlName"
                                    type="text"
                                    value={newUrlName}
                                    onChange={(e) => setNewUrlName(e.target.value)}
                                    placeholder="Name (optional)"
                                />
                                <p className="url-help-text">
                                    Examples: <br />- Default Plex:
                                    https://app.plex.tv/desktop <br />- Local Plex:
                                    http://192.168.1.100:32400/web <br />- Tailscale:
                                    http://plexserver:32400/web
                                </p>
                                <div className="modal-actions">
                                    <button
                                        onClick={() => setIsAddModalOpen(false)}
                                        type="button"
                                        className="cancel-btn"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addUrlEntry}
                                        type="button"
                                        className="confirm-add-btn"
                                        disabled={!url}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {urlEntries.length > 0 && (
                    <div className="saved-urls-container">
                        <h3>Saved URLs</h3>
                        <div className="url-grid">
                            {urlEntries.map((entry) => (
                                <div key={entry.id} className="url-card">
                                    {editingId === entry.id ? (
                                        // Edit mode
                                        <div className="edit-form">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) =>
                                                    setEditName(e.target.value)
                                                }
                                                placeholder="Name"
                                                className="edit-input"
                                            />
                                            <input
                                                type="text"
                                                value={editUrl}
                                                onChange={(e) =>
                                                    setEditUrl(e.target.value)
                                                }
                                                placeholder="URL"
                                                className="edit-input"
                                            />
                                            <div className="edit-actions">
                                                <button
                                                    onClick={saveEditedEntry}
                                                    className="save-edit-btn"
                                                    type="button"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="cancel-edit-btn"
                                                    type="button"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // View mode
                                        <div
                                            onClick={() => loadUrl(entry.url)}
                                            className="url-card-content"
                                        >
                                            <div className="url-icon">
                                                {entry.icon ? (
                                                    <img
                                                        src={entry.icon}
                                                        alt={entry.name}
                                                    />
                                                ) : (
                                                    <div className="default-icon">
                                                        {entry.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="url-info">
                                                <div className="url-name">
                                                    {entry.name}
                                                </div>
                                                <div className="url-address">
                                                    {entry.url}
                                                </div>
                                            </div>
                                            <div className="url-card-actions">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startEditing(entry);
                                                    }}
                                                    className="edit-url-btn"
                                                    type="button"
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeUrlEntry(entry.id);
                                                    }}
                                                    className="remove-url-btn"
                                                    type="button"
                                                    title="Remove"
                                                >
                                                    ❌
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="instruction-text">
                    Click on a card to load that web client
                </p>
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
