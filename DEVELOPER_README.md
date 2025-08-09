# Lasercomb Studio - Developer Documentation

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

**Lasercomb Studio** is a professional CAD drawing viewer and DIN file generator built with Electron, Three.js, and modern web technologies. The application provides advanced DXF/CFF2/DDS file viewing, layer management, tool configuration, and G-code generation capabilities for laser cutting and CNC operations.

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
Advanced two-level optimization system for laser cutting workflows:

**Level 1: Primary Strategy**
- **Priority Order (Default)**: Follows XML priority configuration with phase support
  - **With Line Breaks**: Creates cutting phases (e.g., engraving → internal → borders)
  - **Without Line Breaks**: Respects priority sequence as single workflow
- **Tool Grouped**: Minimizes tool changes by grouping similar operations

**Level 2: Within-Phase Optimization**
- **Closest Path First (Default)**: Optimizes travel distance within each phase
- **Zig-Zag**: Horizontal or vertical scanning patterns
- **Spiral**: Inward or outward spiral cutting patterns
- **Sequential**: Left-to-right or bottom-to-top patterns

**Key Features:**
- Intelligent phase detection from XML `__LINE_BREAK__` entries
- Dynamic priority configuration support
- Travel distance minimization within cutting phases
- Automatic tool change optimization
- Backward compatible with existing configurations

**Usage Example:**
```javascript
const optimizer = new PathOptimizer();
const optimizedEntities = optimizer.optimizePaths(entities, tools, {
    primaryStrategy: 'priority_order',        // Level 1
    withinGroupOptimization: 'closest_path',  // Level 2
    config: profileConfig                     // XML configuration
});
```

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

## 🔄 Batch Monitor System ✅ COMPLETED

The DXF Batch Monitor provides automated processing of DXF files using a "silent processing" approach that reuses the exact same workflows as manual operation.

### Core Concept
The system implements the user's brilliant "stupid thinking" approach: **"open the files in the same way we open with open dxf button but silently somehow be processed with the same way, we simply check the layer status as attached and proceed with the output only if it says all layers mapped"**

### Architecture

**Silent Processing Pipeline:**
```
DXF File → Load Silently → Apply Global Filters → Validate Layer Mappings → Generate DIN → Save
     ↓              ↓                    ↓                       ↓              ↓
  File Watch    Same Logic        Same Validation        Same Generation    Same Save
```

**Key Components:**
1. **Batch Monitor Window** (`/electron/renderer/batch-monitor.js`)
   - Separate Electron window for monitoring
   - File system watching with stability detection
   - Processing queue management
   - Real-time logging and statistics

2. **Silent Processing Functions** (`/electron/renderer/renderer.js`)
   - `loadDxfFileSilently()` - Simulates "Open DXF" workflow
   - `checkLayerMappingStatus()` - Uses existing validation logic
   - `generateDinFileSilently()` - Simulates "Generate DIN" workflow
   - `processDxfFileSilently()` - Complete end-to-end processing

3. **IPC Communication** (`/electron/main/main.cjs`)
   - `process-dxf-file-silently` handler bridges batch monitor and main window
   - Enables cross-window function execution

### Processing Logic

**File Detection & Queuing:**
- Monitors input folder for new `.dxf` files
- 10-second stability wait to ensure complete file transfer
- Automatic queue management with processing status

**Layer Validation (Smart Filtering):**
```javascript
// Only process files where ALL layers are mapped
const isReady = totalLayers > 0 && 
               mappedLayers > 0 && 
               mappedLayers === totalLayers;
```

**Processing Outcomes:**
- ✅ **Success**: All layers mapped → DIN file generated
- ⚠️ **Skipped**: Incomplete mappings → File ignored (by design)
- ❌ **Error**: Technical failure → Logged with details

### Global Import Filters Integration

The system leverages existing global import filters (`/CONFIG/import-filters/global_import_filter.json`) to automatically map layer names to line types:

```json
{
  "rules": [
    {
      "id": 2,
      "pattern": "^ACXTEMP",
      "lineType": "Fine Cut",
      "enabled": true
    },
    {
      "id": 3,
      "pattern": "_0000FF$",
      "lineType": "2pt CW", 
      "enabled": true
    }
  ]
}
```

### Implementation Success ✅

**Problem Solved:**
- ❌ Initial: `window.processDxfFileSilently is not a function`
- ❌ Context: `require is not defined` 
- ❌ Validation: UI dependency preventing silent operation

**Solution Implemented:**
- ✅ **IPC Communication**: Batch monitor → Main process → Main window execution
- ✅ **Context-Aware File Saving**: Uses `window.electronAPI.saveDinFile()`
- ✅ **UI-Independent Validation**: Direct layer data analysis without DOM elements
- ✅ **100% Consistency**: Same validation logic as manual operation

### Usage Workflow

1. **Setup**: Tools → Batch Monitor
2. **Configure**: Set input and output folders
3. **Start**: Click "Start Monitoring" 
4. **Automatic**: Drop DXF files in input folder
5. **Results**: Only properly mapped files generate DIN outputs

### File Processing Examples

**test.dxf (SUCCESS):**
```
Applied rule 4 to layer NAME_009800
Applied rule 3 to layer GA_DIE_0000FF
Applied rule 4 to layer GRIP_00FF7F
Applied rule 2 to layer ACXTEMP_009800
Filter applied: 4 matched, 0 unmatched
✅ All layers mapped → test.din generated
```

**geometry test.dxf (SKIPPED):**
```
No matching rule found for layer Layer 1_231F20
No matching rule found for layer Layer 1_1C75BC
Filter applied: 0 matched, 5 unmatched
⚠️ Incomplete mappings → File skipped
```

This ensures only files that would succeed in manual processing are automatically processed - exactly as intended!

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

## 🚨 Known Issues

### Global Import Filter Refresh
**Issue**: When closing the Global Import Filter Manager window, the layer mappings in the main window may not refresh automatically to reflect changes (add/edit/delete rules).

**Symptoms**:
- Layer count statistics don't update (e.g., "4 layers 2 mapped, 2 unmapped" remains unchanged)
- Layer cards still show old line type assignments or mapping states
- No console logs showing "Received refresh-global-filter-data message" or file reload

**Current Status**: 
- ✅ **Adding rules via + button works correctly** (triggers refresh)
- ⚠️ **Manual Global Import Filter Manager operations** may not trigger refresh
- 🔧 **Partial implementation exists** - IPC messaging and file reload logic implemented

**Workarounds**:
1. **Manual file reload**: Close and reopen the DXF file
2. **Use + button**: Use the + button on layer cards when possible
3. **Switch tabs**: Navigate away and back to Import tab

**Technical Details**:
- Global Import Filter Manager needs `beforeunload` event handler

### ✅ FIXED: Global Import Filter Edit/Delete Bug
**Issue**: ~~Edit and Delete operations on Global Import Filter rules failed with "Rule not found" error~~

**Root Cause**: ~~ID type mismatch - existing rules had numeric IDs from JSON, but JavaScript passed string IDs~~

**Fix Applied**: Enhanced backend IPC handlers to handle both numeric and string ID types with flexible comparison logic

**Status**: 🎉 **RESOLVED** - Edit and delete operations now work correctly for all rule types
- Main window expects `refresh-global-filter-data` IPC message
- File reload mechanism implemented in renderer.js (lines ~2537-2560)

**Priority**: Low (functionality works, UI refresh issue only)

**Last Updated**: August 6, 2025

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