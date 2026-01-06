

<p align="center">
 <img src="./Assets/POT.svg" alt="PlexOnTauri Logo" width="128" height="128">
   <br/>
   Plex On Tauri
</p>
A lightweight, cross-platform desktop application that provides a dedicated Plex Media Player experience optimized for ARM-based devices (and works great on x86 too!).

---

<p align="center">
   <img src="https://github.com/user-attachments/assets/c198c3a7-f69f-4786-87e8-7d19a98f6a90" alt="PlexOnTauri Logo">
</p>

## Features

- **Native Desktop Experience**: Serves Plex Web Client in a native desktop application.
- **Fixes Plex Windows Arm's annoying bugs**: No more skipping, black screen and stuttery UI!
- **Optimized Performance**: Built with Tauri for minimal resource usage and fast startup times.
- **Change Plex Url**: Change the Plex URL to any Plex server you want. i.e tailscale VPN or local network
- **Picture in Picture Mode**: Toggle between full-screen and picture-in-picture mode with a simple keyboard shortcut (Alt + P).
- **Video Enhancement**: Real-time GPU-accelerated sharpening with multiple presets including Contrast Adaptive Sharpening (CAS). See [Video Enhancement Documentation](docs/video-enhancement.md).

![explorer_zNifHSnvI8](https://github.com/user-attachments/assets/5d544362-76cf-493c-a826-f240bd2dc3e7)

## Usage

1. Launch the Plex On Tauri application
2. Click "Continue to Plex" on the welcome screen
3. Log in to your Plex account
4. Ensure `Use alternate streaming protocol for video playback` is disabled. Settings > Plex Web > Debug > Use alternate streaming protocol for video playback
5. Enjoy your media!

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/yourusername/plexontauri/releases) page.

### Building from Source

1. Clone this repository
2. Make sure you have [Rust](https://www.rust-lang.org/tools/install) and [Node.js](https://nodejs.org/) installed
3. Install pnpm: `npm install -g pnpm`
4. Install dependencies: `pnpm install`
5. Build the application: `pnpm tauri build`

## Development

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Development Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm tauri dev
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
- [Plex](https://www.plex.tv/) for their amazing media server and player

---

<p align="center">
  Made with ❤️ for the Plex community
</p>
