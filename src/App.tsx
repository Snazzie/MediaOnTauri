import { useState, useEffect } from "react";
import { load } from "@tauri-apps/plugin-store";
import "./App.css";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// Detect if running on macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘ Cmd' : 'Ctrl';
const altKey = isMac ? '⌥ Option' : 'Alt';

function App() {
	const [error, setError] = useState<string | null>(null);
	const [plexUrl, setPlexUrl] = useState("https://app.plex.tv/desktop");
	const [zoomLevel, setZoomLevel] = useState(1.0);

	// Load saved URL from store and set up initial window state when component mounts
	useEffect(() => {
		const initialize = async () => {
			try {
				// Load saved URL
				const store = await load("settings.json");
				const savedUrl = await store.get<string>("plexUrl");
				if (savedUrl) {
					setPlexUrl(savedUrl);
				}

				// Load saved zoom level
				const savedZoomLevel = await invoke<number>("get_saved_zoom_level");
				setZoomLevel(savedZoomLevel);
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
			await store.set("plexUrl", url);
			await store.save();
			console.log("URL saved successfully:", url);
		} catch (err) {
			console.error("Failed to save URL:", err);
		}
	};

	const loadPlex = async () => {
		try {
			// Save URL to settings
			await saveUrl(plexUrl);

			window.location.href = plexUrl;

			console.log("Navigated to Plex in the current window");

			return () => {};
		} catch (err: unknown) {
			console.error("Failed to initialize Plex:", err);
			setError(
				`Failed to initialize Plex: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	};

	if (error) {
		return (
			<div className="error-container">
				<h2>Error Loading Plex</h2>
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
				<h2>Welcome to Plex on Tauri</h2>
				<p>This application will load Plex in the current window.</p>

				<div className="keyboard-shortcuts">
					<h3>Keyboard Shortcuts</h3>
					<table className="shortcuts-table">
						<tbody>
							<tr>
								<td className="shortcut-key">{modKey} + / -</td>
								<td>Adjust zoom level</td>
							</tr>
							<tr>
								<td className="shortcut-key">{altKey} + P</td>
								<td>Toggle Picture-in-Picture mode</td>
							</tr>
							<tr>
								<td className="shortcut-key">{modKey} + Shift + E</td>
								<td>Toggle video enhancement (WebGL sharpening)</td>
							</tr>
							<tr>
								<td className="shortcut-key">{modKey} + Shift + F</td>
								<td>Cycle enhancement presets</td>
							</tr>
						</tbody>
					</table>
					<p className="enhancement-note">
						Video enhancement presets: Light, Medium, Strong, Extreme, CAS (Adaptive)
					</p>
				</div>

				<div className="zoom-level-display">
					Current Zoom: {(zoomLevel * 100).toFixed(0)}%
				</div>

				<div className="url-input-container">
					<label htmlFor="plex-url">Plex Client URL:</label>
					<input
						id="plex-url"
						type="text"
						value={plexUrl}
						onChange={(e) => setPlexUrl(e.target.value)}
						placeholder="Enter Plex Client URL"
					/>
				</div>

				<p className="url-help-text">
					Examples: <br />- Default Plex: https://app.plex.tv/desktop <br />-
					Local Plex: http://192.168.1.100:32400/web <br />- Tailscale:
					http://plexserver:32400/web
				</p>
				<button onClick={loadPlex} type="button">
					Continue to Plex
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
