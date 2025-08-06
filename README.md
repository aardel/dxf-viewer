# Lasercomb DXF Studio

Professional CAD drawing viewer and analysis tool built with Electron and Three.js WebGL rendering.

## ✨ Features

### Core Capabilities
- **Professional DXF Support**: Complete parsing of DXF files with layers, colors, text, hatching, and geometric entities
- **Advanced 2D Visualization**: Interactive DIN file preview with step-by-step execution
- **Enhanced Dimension Display**: Shows both original and scaled dimensions
- **Multi-Color Layer Support**: Visual layer management with color coding
- **3D Rendering**: WebGL-based rendering via Three.js for smooth performance

### Advanced Features (v1.1.0)
- **🎬 Interactive DIN Preview**: Real-time visualization of cutting operations with play/pause controls
- **🎨 Color-Coded Operations**: Visual distinction between cutting, rapid moves, and arc operations  
- **⚡ Speed Control**: Adjustable playback speed (0.5x to 5x) for detailed analysis
- **📐 Pan & Zoom**: Interactive canvas manipulation for detailed inspection
- **🎯 Step Navigation**: Direct jump to specific operations in the cutting sequence

### Professional Tools
- **Layer Management**: Show/hide layers with visual feedback
- **Import Filters**: Map DXF properties to internal line types
- **Line Type Management**: Configure internal line type systems  
- **Canvas Size Validation**: 3m × 3m size limits with warnings
- **Tool Configuration**: Comprehensive tool library with 18+ predefined tools
- **Network Volume Support**: Seamless saving to network-mounted drives

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/aardel/dxf-viewer.git
cd dxf-viewer

# Install dependencies
npm install

# Run in development mode (recommended)
npm run dev

# Run in production mode (for testing)
npm start
```

> **💡 Development Tip**: Always use `npm run dev` during development for immediate configuration updates and proper debugging.

## Building

```bash
# Build for all platforms
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux
```

## 📚 Documentation

- **[DEVELOPER_README.md](DEVELOPER_README.md)** - Comprehensive development guide
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Essential commands and troubleshooting
- **[CLAUDE.md](CLAUDE.md)** - AI-assisted development session log

# Create distribution packages
npm run dist
```

## Usage

1. **Launch Application**: Run `npm start` or `npm run dev`
2. **Open DXF File**: Click "Open DXF File" or drag & drop a DXF file
3. **Scale & Units**: Use the Settings tab to configure scaling and units
4. **Layer Management**: Toggle layer visibility in the Import tab
5. **View Controls**: 
   - Mouse wheel: Zoom
   - Left drag: Pan
   - "Fit to View": Auto-zoom to drawing bounds

## Application Structure

```
lasercomb-dxf-studio/
├── electron/              # Desktop application
│   ├── main/             # Electron main process
│   │   ├── main.cjs      # App startup & window management  
│   │   └── preload.cjs   # Secure API bridge
│   └── renderer/         # Desktop UI (where we work)
│       ├── index.html    # Main application window
│       ├── renderer.js   # UI logic & DXF integration
│       ├── styles.css    # Professional styling
│       └── *.html/.js/.css # Additional UI components
├── src/                  # Core DXF parsing engine
│   ├── DxfViewer.js     # Main viewer class
│   ├── DxfParser.js     # DXF file parser
│   └── parser/entities/ # Individual entity parsers
├── assets/              # Application icons & resources
├── CONFIG/              # User configuration storage
│   ├── LineTypes/       # Line type definitions
│   └── import-filters/  # DXF import mapping profiles
└── Sample files/        # Test DXF files
```

## Development

The application consists of:
- **Core Library** (`src/`): DXF parsing and Three.js rendering
- **Desktop App** (`electron/`): Electron wrapper with enhanced UI
- **Configuration** (`CONFIG/`): User settings and profiles

All UI enhancements and professional features are developed in the `electron/renderer/` directory.

## License

Mozilla Public License 2.0

## Credits

Built on the open-source dxf-viewer library by Artyom Lebedev.
Enhanced for professional CAD workflows by Lasercomb GmbH.