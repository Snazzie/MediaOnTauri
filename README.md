

<p align="center">
 <img src="./Assets/icon.png" alt="MediaOnTauri Logo" width="128" height="128">
   <br/>
   Media On Tauri
   <br/>
   <a href="https://github.com/Snazzie/MediaOnTauri/releases/latest">
     <img src="https://img.shields.io/github/v/release/Snazzie/MediaOnTauri?style=flat-square&label=Latest%20Release" alt="Latest Release Version">
   </a>
   <br/><br/>
   <a href="https://github.com/Snazzie/MediaOnTauri/releases"><img src="https://img.shields.io/badge/x64-0078D4?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0wIDBoMTEuNHYxMS40SDBWMHptMTIuNiAwSDI0djExLjRIMTIuNlYwek0wIDEyLjZoMTEuNFYyNEgwVjEyLjZ6bTEyLjYgMEgyNFYyNEgxMi42VjEyLjZ6Ii8+PC9zdmc+" alt="Windows x64"></a>
   <a href="https://github.com/Snazzie/MediaOnTauri/releases"><img src="https://img.shields.io/badge/ARM64-0078D4?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0wIDBoMTEuNHYxMS40SDBWMHptMTIuNiAwSDI0djExLjRIMTIuNlYwek0wIDEyLjZoMTEuNFYyNEgwVjEyLjZ6bTEyLjYgMEgyNFYyNEgxMi42VjEyLjZ6Ii8+PC9zdmc+" alt="Windows ARM64"></a>
   <a href="https://github.com/Snazzie/MediaOnTauri/releases"><img src="https://img.shields.io/badge/Intel-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS Intel"></a>
   <a href="https://github.com/Snazzie/MediaOnTauri/releases"><img src="https://img.shields.io/badge/Apple%20Silicon-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS Apple Silicon"></a>
</p>
A lightweight Web Client wrapper with some extra features.

---

<p align="center">
   <img src="./Assets/Screenshots/app.jpg" alt="MediaOnTauri app screenshot">
</p>

## Features

- **Native Desktop Experience**: Serves Any Media Web Client in a native desktop application.
- **Fixes Plex Windows Arm's annoying bugs**: No more skipping, black screen and stuttery UI!
- **Optimized Performance**: Built with Tauri for minimal resource usage and fast startup times.
- **Change Url**: Change the URL to any web client server you want. i.e tailscale VPN or local network
- **Control Video Brightness** Change video brightness with `alt + [`and `alt + ]`.
- **Picture in Picture Mode**: Toggle between normal and picture-in-picture mode with a simple keyboard shortcut `alt + P`.
- **Video Enhancement**: Real-time GPU-accelerated sharpening with multiple presets including Contrast Adaptive Sharpening (CAS). See [Video Enhancement Documentation](docs/video-enhancement.md).
- **RTX VSR**: Works with NVIDIA RTX Super Resolution, making your media extra crisp.
- **RTX HDR**: Works with NVIDIA RTX HDR, making SDR content better looking on HDR monitors.

![explorer_zNifHSnvI8](./Assets/Screenshots/pip.jpg)

## Usage

1. Launch the application
2. Click "Continue to Web Client" on the welcome screen
3. Log in to your Plex account
4. If you're using plex, ensure `Use alternate streaming protocol for video playback` is disabled. Settings > Plex Web > Debug > Use alternate streaming protocol for video playback
5. Enjoy your media!

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/Snazzie/MediaOnTauri/releases) page.

### macOS

1. Download the `.dmg` file for your Mac:
   - **Apple Silicon** (M1/M2/M3/M4): `Media.On.Tauri_x.x.x_aarch64.dmg`
   - **Intel**: `Media.On.Tauri_x.x.x_x64.dmg`
2. Open the `.dmg` and drag "Media On Tauri" to your Applications folder
3. Since the app is not notarized, macOS will block it on first launch. To fix this, run:
   ```bash
   xattr -cr /Applications/Media\ On\ Tauri.app
   ```

### Building from Source

1. Clone this repository
2. Make sure you have [Rust](https://www.rust-lang.org/tools/install) and [Node.js](https://nodejs.org/) installed
3. Install dependencies: `npm install`
4. Build the application: `npm run tauri build`

## Development

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run tauri dev
```
### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) for providing the framework to build this application
