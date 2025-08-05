# Lasercomb DXF Studio - Developer Documentation

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
12. [Build & Deployment](#build--deployment)
13. [Debugging](#debugging)
14. [Contributing](#contributing)

## 🎯 Overview

**Lasercomb DXF Studio** is a professional CAD drawing viewer and DIN file generator built with Electron, Three.js, and modern web technologies. The application provides advanced DXF file viewing, layer management, tool configuration, and G-code generation capabilities for laser cutting and CNC operations.

### Key Features
- **DXF File Viewer**: High-performance 3D rendering with Three.js
- **Layer Management**: Advanced layer filtering and visibility controls
- **Tool Configuration**: Comprehensive tool library management
- **DIN File Generation**: G-code output with customizable postprocessors
- **Import Filter System**: Global and file-specific import rules
- **Line Type Management**: Custom line type definitions and mappings
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
│  IPC Handlers   │           │   DXF Parser    │
└─────────────────┘           └─────────────────┘
```

## 📁 Project Structure

```
dxf-viewer/
├── src/                          # Core DXF processing and rendering
│   ├── DxfViewer.js             # Main DXF viewer component
│   ├── DxfScene.js              # Three.js scene management
│   ├── DxfWorker.js             # Web Worker for DXF parsing
│   ├── DinGenerator.js          # DIN file generation engine
│   ├── PathOptimizer.js         # Path optimization algorithms
│   ├── TextRenderer.js          # Text rendering system
│   ├── parser/                  # DXF parsing components
│   ├── math/                    # Mathematical utilities
│   └── patterns/                # Hatch pattern definitions
├── electron/                    # Electron application
│   ├── main/                    # Main process
│   │   ├── main.cjs            # Main process entry point
│   │   └── preload.cjs         # Preload script
│   └── renderer/                # Renderer process
│       ├── index.html          # Main application window
│       ├── renderer.js         # Renderer process logic
│       ├── global-import-filter.js
│       ├── unified-mapping.js
│       └── line-types-manager.js
├── CONFIG/                      # Configuration files
│   ├── profiles/               # XML profile configurations
│   ├── LineTypes/              # Line type definitions
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
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Git**: For version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aardel/dxf-viewer.git
   cd dxf-viewer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production build |
| `npm run dev` | Start development mode with hot reload |
| `npm run build` | Build for all platforms |
| `npm run build:win` | Build for Windows |
| `npm run build:mac` | Build for macOS |
| `npm run build:linux` | Build for Linux |
| `npm run dist` | Create distribution packages |

## 🔧 Core Components

### 1. DXF Viewer (`src/DxfViewer.js`)
The main DXF rendering component that handles:
- DXF file loading and parsing
- Three.js scene management
- Camera controls and viewport
- Layer visibility and filtering
- Entity rendering (lines, arcs, circles, text)

**Key Methods:**
```javascript
class DxfViewer {
    loadDxf(file)           // Load and parse DXF file
    setLayerVisibility()    // Control layer visibility
    fitToView()            // Auto-fit view to content
    exportImage()          // Export view as image
}
```

### 2. DXF Scene (`src/DxfScene.js`)
Manages the Three.js scene and entity rendering:
- Scene setup and management
- Entity batching and optimization
- Material management
- Geometry creation and caching

### 3. DIN Generator (`src/DinGenerator.js`)
Handles G-code generation for CNC operations:
- Tool path generation
- G-code command creation
- Postprocessor integration
- Priority-based tool ordering

**Key Methods:**
```javascript
class DinGenerator {
    generateDin(entities, config)    // Generate DIN file
    generateHeader(metadata)         // Create file header
    generateEntityCommands(entities) // Convert entities to G-code
    generateFooter()                 // Create file footer
}
```

### 4. Path Optimizer (`src/PathOptimizer.js`)
Optimizes cutting paths for efficiency:
- Traveling salesman problem solving
- Path clustering and grouping
- Tool change optimization
- Cutting order optimization

## ⚙️ Configuration System

### Profile Management
The application uses XML-based profiles for configuration:

**Profile Structure (`CONFIG/profiles/`):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Profile>
    <Tools>
        <Tool id="T1" name="1pt CW" hCode="H1" width="0.1"/>
    </Tools>
    <MappingWorkflow>
        <LineTypeToTool>
            <LineTypeMapping LineType="1pt CW" Tool="T1"/>
        </LineTypeToTool>
    </MappingWorkflow>
    <Priority mode="tool">
        <PriorityItem order="1" value="T1"/>
    </Priority>
    <OutputSettings>
        <DefaultPath>/path/to/output</DefaultPath>
        <FilenameFormat>{name}_{timestamp}</FilenameFormat>
    </OutputSettings>
</Profile>
```

### Line Types (`CONFIG/LineTypes/`)
Line type definitions in CSV format:
```csv
id,name,width,description
1,1pt CW,0.1,Continuous wave cutting
2,2pt CW,0.2,2-point continuous wave
```

### Import Filters (`CONFIG/import-filters/`)
JSON-based import filter rules:
```json
{
    "rules": [
        {
            "id": "1",
            "layerName": "CUT",
            "color": "255",
            "lineTypeId": "1",
            "description": "Cutting layer"
        }
    ]
}
```

## 🔄 IPC Communication

### Main Process Handlers (`electron/main/main.cjs`)

**File Operations:**
```javascript
ipcMain.handle('load-dxf-file', async (event, filePath) => {
    // Load and parse DXF file
});

ipcMain.handle('save-din-file', async (event, content, path) => {
    // Save DIN file to disk
});
```

**Configuration Management:**
```javascript
ipcMain.handle('load-profile', async (event, profileName) => {
    // Load XML profile
});

ipcMain.handle('save-profile', async (event, profileData) => {
    // Save profile configuration
});
```

**Import Filter Management:**
```javascript
ipcMain.handle('add-rule-to-global-import-filter', async (event, rule) => {
    // Add import filter rule
});

ipcMain.handle('delete-rule-from-global-import-filter', async (event, ruleId) => {
    // Delete import filter rule
});
```

### Renderer Process API (`electron/renderer/renderer.js`)

**File Loading:**
```javascript
const result = await window.electronAPI.loadDxfFile(filePath);
```

**Configuration:**
```javascript
const profile = await window.electronAPI.loadProfile('mtl.xml');
```

## 🎯 DIN File Generation

### Generation Process
1. **Entity Processing**: Convert DXF entities to cutting paths
2. **Tool Mapping**: Map line types to tools using configuration
3. **Priority Sorting**: Apply cutting priority rules
4. **Path Optimization**: Optimize tool paths for efficiency
5. **G-code Generation**: Generate final DIN file

### Postprocessor Integration
Custom postprocessors can be defined in `CONFIG/postprocessors/`:
```javascript
// Custom postprocessor example
function customPostprocessor(commands, config) {
    return commands.map(cmd => {
        // Apply custom transformations
        return modifiedCommand;
    });
}
```

### Output Format
Generated DIN files include:
- File header with metadata
- Tool setup commands
- Cutting paths with G-code
- Tool change commands
- File footer

## 🔍 Import Filter System

### Global Import Filter
Centralized import rules applied to all DXF files:
- Layer name matching
- Color-based filtering
- Line type assignment
- Rule consolidation from multiple profiles

### File-Specific Filters
Individual import filters for specific DXF files:
- Override global rules
- File-specific layer mappings
- Custom import configurations

### Filter Application Process
1. **Load Global Filter**: Read global import filter rules
2. **Apply Rules**: Match DXF layers to filter rules
3. **Transform Layers**: Apply line type and tool mappings
4. **Update UI**: Reflect changes in layer panel

## 🛠️ Tool Management

### Tool Library Structure
Tools are defined in XML profiles with properties:
- **Tool ID**: Unique identifier (T1, T2, etc.)
- **Name**: Human-readable name
- **H-Code**: Machine-specific H-code
- **Width**: Tool width/diameter
- **Description**: Tool description

### Tool Configuration Interface
- **Tool Library Manager**: Add, edit, delete tools
- **Import/Export**: XML-based tool library exchange
- **Validation**: Tool parameter validation
- **Default Tools**: Pre-configured tool sets

## 📏 Line Type Management

### Line Type Definition
Line types define cutting parameters:
- **ID**: Unique identifier
- **Name**: Human-readable name
- **Width**: Line width
- **Description**: Usage description

### Line Type Mapping
Line types are mapped to tools through:
- **Direct Mapping**: Line type → Tool
- **Layer Mapping**: Layer → Line Type → Tool
- **Color Mapping**: Color → Line Type → Tool

### Management Interface
- **Line Types Manager**: CRUD operations for line types
- **CSV Import/Export**: Bulk line type management
- **Validation**: Line type parameter validation

## 🏗️ Build & Deployment

### Build Configuration (`package.json`)
```json
{
    "build": {
        "appId": "com.lasercomb.dxf-studio",
        "productName": "Lasercomb DXF Studio",
        "directories": {
            "output": "dist"
        },
        "files": [
            "src/**/*",
            "electron/**/*",
            "assets/**/*"
        ]
    }
}
```

### Platform-Specific Builds
- **Windows**: NSIS installer
- **macOS**: DMG package
- **Linux**: AppImage format

### Build Process
1. **Prebuild**: Run build script for asset preparation
2. **Electron Builder**: Package application with dependencies
3. **Code Signing**: Sign application for distribution
4. **Distribution**: Create installers and packages

## 🐛 Debugging

### Development Mode
```bash
npm run dev
```
- Enables hot reload
- Shows developer tools
- Loads configuration from local `CONFIG/` directory

### Logging
The application uses `loglevel` for structured logging:
```javascript
import log from 'loglevel';

log.setLevel('debug');
log.debug('Debug message');
log.info('Info message');
log.warn('Warning message');
log.error('Error message');
```

### Debugging Tools
- **Electron DevTools**: Built-in debugging tools
- **Console Logging**: Comprehensive logging system
- **Error Tracking**: Detailed error reporting
- **Performance Monitoring**: Built-in performance tools

### Common Debugging Scenarios

#### DXF Loading Issues
```javascript
// Check DXF parsing
log.debug('DXF entities loaded:', entities.length);
log.debug('Layer count:', layers.length);
```

#### Configuration Issues
```javascript
// Verify profile loading
log.debug('Profile loaded:', profile);
log.debug('Tool count:', tools.length);
```

#### DIN Generation Issues
```javascript
// Check DIN generation process
log.debug('Entities to process:', entities.length);
log.debug('Tool mappings:', mappings);
```

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Code Style Guidelines
- **JavaScript**: ES6+ with modern syntax
- **CSS**: BEM methodology for class naming
- **HTML**: Semantic HTML5 structure
- **Comments**: JSDoc style documentation

### Testing
- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete workflows
- **Manual Testing**: Test user scenarios

### Documentation
- **Code Comments**: Inline documentation
- **API Documentation**: JSDoc comments
- **User Documentation**: User guides and tutorials
- **Developer Documentation**: This README

## 📄 License

This project is licensed under the **MPL-2.0** License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Check this README and inline documentation
- **Community**: Join the development community

### Contact
- **Author**: Aaron Delia <aaron@lasercomb.com>
- **Repository**: https://github.com/aardel/dxf-viewer
- **Issues**: https://github.com/aardel/dxf-viewer/issues

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Electron**: 28.0.0  
**Three.js**: 0.161.0 