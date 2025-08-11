# Lasercomb Studio V1.0.0 - Developer Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Development Setup](#development-setup)
5. [Core Components](#core-components)
6. [Configuration System](#configuration-system)
7. [IPC Communication](#ipc-communication)
8. [DIN File Generation](#din-file-generation)
9. [Import Filter System](#import-filter-system)
10. [Tool Management](#tool-management)
11. [Line Type Management](#line-type-management)
12. [Batch Monitor System](#batch-monitor-system)
13. [Build & Deployment](#build--deployment)
14. [Debugging](#debugging)
15. [Contributing](#contributing)

## 🎯 Overview

**Lasercomb Studio V1.0.0** is a professional CAD drawing viewer and DIN file generator built with Electron, Three.js, and modern web technologies. The application provides advanced multi-format file viewing (DXF/CFF2/DDS), layer management, tool configuration, and G-code generation capabilities for laser cutting and CNC operations.

### Key Features
- **Multi-Format Support**: DXF, DDS, and CFF2 file viewing with unified processing
- **High-Performance 3D Rendering**: Three.js-based visualization
- **Layer Management**: Advanced layer filtering and visibility controls
- **Tool Configuration**: Comprehensive tool library management
- **DIN File Generation**: G-code output with customizable postprocessors
- **Import Filter System**: Global and file-specific import rules
- **Lascomb Studio Line Types**: Internal line type editor and management
- **Line Type Mapping**: Map internal line types to machine tools
- **Priority Management**: Cutting priority configuration
- **Multi-Profile Support**: XML-based configuration profiles

## 🏗️ Architecture

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Desktop Framework**: Electron 28.0.0
- **3D Graphics**: Three.js 0.161.0
- **XML Processing**: @xmldom/xmldom 0.9.8
- **Font Rendering**: opentype.js 1.3.4
- **Path Optimization**: earcut 3.0.0
- **Logging**: loglevel 1.9.1

### Architecture Pattern
The application follows a **Model-View-Controller (MVC)** pattern with **Inter-Process Communication (IPC)** between the main and renderer processes:

```
┌─────────────────┐    IPC    ┌─────────────────┐
│   Main Process  │ ◄────────► │ Renderer Process│
│   (Node.js)     │           │   (Browser)     │
└─────────────────┘           └─────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐           ┌─────────────────┐
│  File System    │           │   Three.js      │
│  Configuration  │           │   UI Components │
│  IPC Handlers   │           │   Multi-Format  │
│  Batch Monitor  │           │   Parser        │
└─────────────────┘           └─────────────────┘
```

## 📁 Project Structure

```
dxf2Laser/
├── src/                          # Core processing and rendering
│   ├── DxfViewer.js             # Main viewer component
│   ├── DxfScene.js              # Three.js scene management
│   ├── DxfWorker.js             # Web Worker for file parsing
│   ├── DinGenerator.js          # DIN file generation engine
│   ├── PathOptimizer.js         # Path optimization algorithms
│   ├── TextRenderer.js          # Text rendering system
│   ├── parser/                  # Multi-format parsing components
│   │   ├── DxfParser.js        # DXF file parser
│   │   ├── DdsParser.js        # DDS file parser
│   │   └── Cf2Parser.js        # CFF2 file parser
│   ├── math/                    # Mathematical utilities
│   └── patterns/                # Hatch pattern definitions
├── electron/                    # Electron application
│   ├── main/                    # Main process
│   │   ├── main.cjs            # Main process entry point
│   │   └── preload.cjs         # Preload script
│   └── renderer/                # Renderer process
│       ├── index.html          # Main application window
│       ├── renderer.js         # Renderer process logic
│       ├── global-import-filter.html/.js
│       ├── line-types.html/.js # Internal line types editor
│       ├── line-type-mapping.html/.js # Line type mapping
│       ├── output-manager.html/.js
│       └── unified-mapping.html/.js
├── CONFIG/                      # Configuration files
│   ├── profiles/               # XML profile configurations
│   ├── LineTypes/              # Line type definitions
│   │   └── line-types.xml     # Internal line types
│   ├── import-filters/         # Import filter rules
│   ├── postprocessors/         # DIN postprocessor templates
│   ├── tools/                  # Tool library definitions
│   └── optimization/           # Optimization settings
├── assets/                     # Static assets
├── dist/                       # Build output
└── package.json               # Project configuration
```

## 🚀 Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/aardel/dxf2Laser.git
cd dxf2Laser

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or run normally
npm start
```

### Development Commands
```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux

# Create distribution packages
npm run dist
```

## 🔧 Core Components

### Multi-Format Parser System
The application now supports three file formats with unified processing:

#### DXF Parser (`src/parser/DxfParser.js`)
- Complete DXF file parsing
- Layer and color management
- Entity extraction (LINE, ARC, TEXT, HATCH)
- AutoCAD Color Index (ACI) support

#### DDS Parser (`src/parser/DdsParser.js`)
- Direct DDS format support
- Color and width-based processing
- Automatic unit detection (inches vs millimeters)
- Bridge support

#### CFF2 Parser (`src/parser/Cf2Parser.js`)
- CFF2 format with pen and layer support
- Color and width mapping
- Professional cutting operations

### Unified Interface
All file formats use the same interface with format-specific processing:
- **Unified Table**: Single table for all formats with format-specific columns
- **Global Import Filter**: Works across all supported formats
- **Consistent Processing**: Same workflow regardless of input format

### Internal Line Types System
New dedicated system for managing cutting operations:

#### Line Types Editor (`electron/renderer/line-types.html/.js`)
- Create and edit internal line types
- Define cutting operations (CW, Pulse, Engraving, Milling)
- Set line widths, colors, and descriptions
- Save to XML configuration

#### Line Type Mapping (`electron/renderer/line-type-mapping.html/.js`)
- Map internal line types to machine tools
- Configure cutting parameters
- Set up tool assignments

## ⚙️ Configuration System

### Profile-Based Configuration
XML-based profiles store all application settings:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Profile>
  <ProfileInfo>
    <Name>Default Profile</Name>
    <Description>Default configuration</Description>
    <Version>1.0</Version>
  </ProfileInfo>
  <Tools>
    <!-- Tool definitions -->
  </Tools>
  <LineTypeMappings>
    <!-- Line type to tool mappings -->
  </LineTypeMappings>
  <Optimization>
    <!-- Cutting optimization settings -->
  </Optimization>
  <OutputSettings>
    <!-- DIN generation settings -->
  </OutputSettings>
</Profile>
```

### Configuration Locations
- **Profiles**: `CONFIG/profiles/`
- **Line Types**: `CONFIG/LineTypes/line-types.xml`
- **Import Filters**: `CONFIG/import-filters/`
- **Postprocessors**: `CONFIG/postprocessors/`

## 🔄 IPC Communication

### Main Process Handlers
```javascript
// File operations
ipcMain.handle('show-open-dialog', ...)
ipcMain.handle('read-file', ...)
ipcMain.handle('save-din-file', ...)

// Configuration management
ipcMain.handle('load-xml-profile', ...)
ipcMain.handle('save-xml-profile', ...)
ipcMain.handle('get-current-profile', ...)

// Multi-format parsing
ipcMain.handle('parse-unified', ...)
ipcMain.handle('get-dxf-layers', ...)
ipcMain.handle('get-internal-line-types', ...)

// Line type management
ipcMain.handle('open-line-types-manager', ...)
ipcMain.handle('open-line-type-mapping', ...)
ipcMain.handle('save-line-types', ...)
```

### Renderer Process API
```javascript
// Exposed via preload script
window.electronAPI = {
  // File operations
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  
  // Configuration
  loadXmlProfile: (filename) => ipcRenderer.invoke('load-xml-profile', filename),
  saveXmlProfile: (filename, configData) => ipcRenderer.invoke('save-xml-profile', filename, configData),
  
  // Multi-format parsing
  parseUnified: (content, filename) => ipcRenderer.invoke('parse-unified', content, filename),
  
  // Line type management
  openLineTypesManager: () => ipcRenderer.invoke('open-line-types-manager'),
  openLineTypeMapping: () => ipcRenderer.invoke('open-line-type-mapping'),
  saveLineTypes: (lineTypes) => ipcRenderer.invoke('save-line-types', lineTypes),
}
```

## 📄 DIN File Generation

### Generation Process
1. **File Parsing**: Multi-format parser extracts entities
2. **Line Type Mapping**: Map file properties to internal line types
3. **Tool Assignment**: Assign line types to machine tools
4. **Path Optimization**: Optimize cutting sequence
5. **G-Code Generation**: Generate DIN file with postprocessor

### Postprocessor System
Customizable postprocessors for different machine types:
- **Default Metric**: Millimeters-based output
- **Default Inch**: Inches-based output
- **Custom**: User-defined postprocessors

## 🔍 Import Filter System

### Global Import Filter
Centralized system for mapping file properties to internal line types:

#### Format-Specific Keys
- **DXF**: `dxf|<Layer>|<ACI>`
- **DDS**: `dds|<Color>|<RawWidth>|<Unit>`
- **CFF2**: `cff2|<Pen>-<Layer>`

#### Filter Rules
```json
{
  "format": "dxf",
  "key": "dxf|LAYER1|1",
  "lineType": "2pt CW",
  "color": "#FF0000",
  "enabled": true,
  "source": "manual"
}
```

## 🛠️ Tool Management

### Tool Configuration
XML-based tool definitions with H-code mapping:

```xml
<Tool id="T1">
  <Name>Default Tool</Name>
  <Description>Default cutting tool</Description>
  <Width>1.0</Width>
  <HCode>H1</HCode>
  <Parameters>
    <Speed>1000</Speed>
    <Power>80</Power>
  </Parameters>
</Tool>
```

### Tool Library
- Import/export tool configurations
- H-code management
- Parameter validation

## 📏 Line Type Management

### Internal Line Types
XML-based line type definitions:

```xml
<LineType id="1">
  <Name>2pt CW</Name>
  <Description>2 point continuous wave</Description>
  <Type>laser</Type>
  <Width>2.0</Width>
  <Color>#FF0000</Color>
</LineType>
```

### Line Type Editor
- Create new line types
- Edit existing definitions
- Set operation parameters
- Color and width configuration

### Line Type Mapping
- Map internal line types to machine tools
- Configure cutting parameters
- Priority-based assignments

## 📊 Batch Monitor System

### Features
- **Directory Monitoring**: Watch for new files
- **Automatic Processing**: Process files in background
- **Status Tracking**: Monitor processing status
- **Error Handling**: Log and report errors

### Configuration
```json
{
  "watchDirectory": "/path/to/watch",
  "outputDirectory": "/path/to/output",
  "fileTypes": ["dxf", "dds", "cff2"],
  "autoProcess": true
}
```

## 🏗️ Build & Deployment

### Build Process
```bash
# Install dependencies
npm install

# Build for development
npm run build:dev

# Build for production
npm run build

# Create distribution packages
npm run dist
```

### Platform-Specific Builds
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Distribution
- **Windows**: `.exe` installer
- **macOS**: `.dmg` package
- **Linux**: `.AppImage` or `.deb` package

## 🐛 Debugging

### Development Tools
- **DevTools**: Available in development mode
- **Console Logging**: Comprehensive logging system
- **Error Tracking**: Detailed error reporting

### Common Issues
1. **File Parsing Errors**: Check file format compatibility
2. **Configuration Issues**: Verify XML profile syntax
3. **Performance Problems**: Monitor memory usage and rendering

### Debug Commands
```bash
# Enable verbose logging
DEBUG=* npm run dev

# Run with DevTools
npm run dev -- --devtools
```

## 🤝 Contributing

### Development Guidelines
1. **Code Style**: Follow existing code patterns
2. **Testing**: Test with multiple file formats
3. **Documentation**: Update documentation for changes
4. **Performance**: Monitor rendering performance

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

### Code Review Checklist
- [ ] Code follows project style
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Performance impact assessed
- [ ] Multi-format compatibility verified

## 📝 Recent Updates (2025-08-11)

### Major Changes
- **Multi-Format Support**: Added DDS and CFF2 file format support
- **Unified Interface**: Single interface for all file formats
- **Internal Line Types Editor**: Dedicated editor for cutting operations
- **Line Type Mapping**: Separate mapping interface
- **Updated UI**: Removed obsolete features and streamlined interface

### Removed Features
- Configuration validation window
- Startup configuration issues check
- DXF-specific limitations

### New Components
- `line-types-editor.js`: Internal line types editor
- `line-type-mapping.html/.js`: Line type mapping interface
- Multi-format parsers: DDS and CFF2 support

### Updated Architecture
- Unified file processing pipeline
- Enhanced configuration management
- Improved error handling
- Better performance optimization 