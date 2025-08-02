# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DXF Viewer is a JavaScript library for viewing DXF (Drawing Exchange Format) files in web browsers using WebGL via Three.js. The project provides high-performance rendering of CAD drawings with support for layers, blocks, text, hatching, and various geometric entities.

## Architecture

### Core Components

- **DxfViewer** (`src/DxfViewer.js`): Main viewer class that manages Three.js renderer, camera, scene, and user interactions
- **DxfFetcher** (`src/DxfFetcher.js`): Handles fetching and basic parsing of DXF files from URLs
- **DxfScene** (`src/DxfScene.js`): Processes parsed DXF data into renderable geometry batches
- **DxfWorker** (`src/DxfWorker.js`): Web worker wrapper for off-loading heavy processing
- **BatchingKey** (`src/BatchingKey.js`): Key system for organizing geometry into efficient rendering batches

### Parser System

- **DxfParser** (`src/parser/DxfParser.js`): Main DXF file parser with entity handler registration
- **Entity Handlers** (`src/parser/entities/`): Individual parsers for each DXF entity type (lines, arcs, circles, text, etc.)
- **DxfArrayScanner** (`src/parser/DxfArrayScanner.js`): Low-level DXF file scanning utilities

### Rendering Pipeline

1. **Parse**: DXF file is parsed into entity objects
2. **Scene Processing**: Entities are converted into geometry batches for efficient rendering
3. **Batching**: Similar entities are grouped by material, layer, and rendering properties
4. **Instancing**: Repeated geometries (blocks) use instanced rendering for performance
5. **Rendering**: Three.js WebGL renderer displays the scene

### Key Features

- **Performance Optimized**: Geometry batching, instanced rendering, and web worker support
- **Layer Management**: Full layer support with show/hide capabilities
- **Text Rendering**: Multi-font support with lazy loading using OpenType.js
- **Hatching**: Pattern-based hatching with imperial/metric pattern libraries
- **Block Support**: DXF block definitions with instanced rendering
- **Material System**: Efficient material management with color correction

## Development Commands

### Main Library
```bash
# No build step required - ES modules used directly
# No test suite available in package.json

# Development server for examples (required for full-viewer.html)
npm run serve                 # Uses Python HTTP server on port 8001
npm run serve:node           # Uses Node.js http-server on port 8001

# Manual alternatives
python3 -m http.server 8001
npx http-server -p 8001
```

### Electron Desktop App
```bash
# Development (from project root)
npm run electron:dev          # Run in development mode
npm run electron              # Run normally

# Building
npm run electron:build        # Build for all platforms
npm run electron:build-win    # Windows only
npm run electron:build-mac    # macOS only
npm run electron:build-linux  # Linux only
```

## Testing

The project includes two HTML viewers for testing:
- `full-viewer.html`: Complete DXF support, requires local server
- `standalone.html`: Basic DXF support (LINE entities only), works without server

Both support drag & drop DXF files for testing. Use the local server commands above to run `full-viewer.html`.

## Common Development Patterns

### Adding New Entity Support
1. Create entity handler in `src/parser/entities/`
2. Register handler in `src/parser/DxfParser.js`
3. Add scene processing logic in `src/DxfScene.js` if needed

### Performance Considerations
- Geometry is batched by layer, color, and material properties
- Large blocks are flattened if total instance vertices < 1024
- 16-bit indices used for indexed geometry (64K vertex limit per batch)
- Web workers prevent UI blocking during processing

### Material System
- Materials are cached and reused based on MaterialKey
- Color correction ensures visibility against background
- Point rendering uses separate material pipeline
- Instanced materials support transform attributes

## File Structure

- `src/`: Main library source code
  - `parser/`: DXF parsing system with entity handlers
  - `patterns/`: Hatch pattern definitions (imperial/metric)
  - `math/`: Mathematical utilities (Matrix2, etc.)
- `electron/`: Desktop application wrapper
  - `main/`: Electron main process files
  - `renderer/`: Electron renderer UI files
- `full-viewer.html`: Full-featured web viewer (requires server)
- `standalone.html`: Basic web viewer (works without server)

## Dependencies

- **three**: WebGL rendering engine
- **opentype.js**: Font parsing and text rendering
- **earcut**: Polygon triangulation for hatching
- **loglevel**: Logging utilities

The project uses ES modules and requires a modern browser with WebGL support.

## Project Type and Build System

This is a pure ES module library with no build step required. The main entry point is `src/index.js` which exports the core classes. The project supports both:

1. **Direct browser usage**: Import ES modules directly from `src/` 
2. **NPM package**: Published as "dxf-viewer" with proper ES module exports
3. **Electron wrapper**: Desktop app in `electron/` directory

No bundling, transpilation, or build tools are used for the core library.