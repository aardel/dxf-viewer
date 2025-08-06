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

3. **Start development mode** (CRITICAL: Always use for development)
   ```bash
   npm run dev
   ```

### 🚨 Critical Development Scripts

| Script | Purpose | Configuration Source | When to Use |
|--------|---------|---------------------|-------------|
| `npm run dev` | **Development mode** | App bundle (`CONFIG/`) | ✅ **Always for development** |
| `npm start` | **Production mode** | User data directory | ❌ Only for production testing |
| `npm run build` | **Build for distribution** | App bundle → User data | ✅ For final builds |

### ⚠️ Path Management - CRITICAL INFORMATION

The application uses **two different configuration systems** based on the mode:

#### Development Mode (`npm run dev`)
- **Configuration Source**: Local `CONFIG/` directory (app bundle)
- **Advantage**: Direct file access, no caching issues
- **Use Case**: All development work, configuration changes
- **Path Resolution**: `getProfilesDirectory()` returns `path.join(__dirname, '../../CONFIG/profiles')`

#### Production Mode (`npm start`)
- **Configuration Source**: User data directory (e.g., `~/Library/Application Support/Electron/`)
- **Advantage**: User-specific settings isolation
- **Use Case**: Production testing, final user experience
- **Path Resolution**: `getProfilesDirectory()` returns `path.join(userDataPath, 'CONFIG/profiles')`

### 🔧 Configuration File Locations

```bash
# Development Mode (npm run dev)
CONFIG/
├── profiles/mtl.xml          # ✅ Primary configuration
├── LineTypes/line-types.csv  # ✅ Line type definitions
├── import-filters/           # ✅ Import filter rules
└── tools/standard_tools.json # ✅ Tool definitions

# Production Mode (npm start)
~/Library/Application Support/Electron/CONFIG/  # macOS
%APPDATA%/Electron/CONFIG/                       # Windows
~/.config/Electron/CONFIG/                       # Linux
```

### 🚨 Common Pitfalls & Solutions

#### Problem: Configuration changes not reflected in UI
```bash
# WRONG: Using production mode for development
npm start  # ❌ Reads from user data directory

# CORRECT: Using development mode
npm run dev  # ✅ Reads from local CONFIG/ directory
```

#### Problem: Different paths between tools and settings
**This was the major caching issue we fixed.** Previously:
- Tools loaded from: `CONFIG/profiles/mtl.xml`
- Settings loaded from: `~/Library/Application Support/Electron/CONFIG/profiles/mtl.xml`

**Now fixed**: All handlers use `getProfilesDirectory()` for consistency.

#### Problem: Network volume path errors
**Fixed**: Updated default save path from `/Volumes/Public-1/Lasercomb` to `/Volumes/Public/Lasercomb`

### 🛠️ Development Workflow

1. **Always start with dev mode**:
   ```bash
   npm run dev
   ```

2. **Make configuration changes** in local `CONFIG/` directory

3. **Test immediately** - changes take effect without restart

4. **Before committing**, test production mode:
   ```bash
   # Clear any cached user data (if needed)
   rm -rf ~/Library/Application\ Support/Electron/CONFIG/
   
   # Test production mode
   npm start
   ```

5. **Build and test final package**:
   ```bash
   npm run build
   ```

### 🔄 Cache Management

#### Clear User Data Cache (if needed)
```bash
# macOS
rm -rf ~/Library/Application\ Support/Electron/
rm -rf ~/Library/Application\ Support/lasercomb-dxf-studio/

# Windows
rmdir /s "%APPDATA%\Electron"
rmdir /s "%APPDATA%\lasercomb-dxf-studio"

# Linux
rm -rf ~/.config/Electron/
rm -rf ~/.config/lasercomb-dxf-studio/
```

#### Force Configuration Refresh
```bash
# Method 1: Use development mode (always fresh)
npm run dev

# Method 2: Clear cache and restart
pkill -f "electron"
rm -rf ~/Library/Application\ Support/Electron/CONFIG/
npm start
```

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

## 📝 Recent Changes (August 2025)

### 🔧 Critical Path Management & Caching Fixes

#### **Configuration Path Consistency**
- **Fixed Dual Configuration Sources**: Resolved critical issue where app read tools from app bundle but output settings from user data directory
- **Unified Path Logic**: All configuration handlers now use `getProfilesDirectory()` for consistent dev/production paths
- **Development Mode Isolation**: `npm run dev` (with `--dev` flag) now reads all configs from app bundle directory
- **Production Mode Stability**: `npm start` properly uses user data directory for all configurations

#### **Cache Management Solutions**
- **Eliminated Configuration Caching Issues**: Fixed persistent old configuration values despite file updates
- **User Data Directory Cleanup**: Added proper cache clearing procedures for user data directories
- **XML File Synchronization**: Ensured both app bundle and user data XML files have consistent configurations

#### **Network Volume Support**
- **Fixed Network Drive Permissions**: Resolved `EACCES: permission denied` errors when saving to network volumes
- **Corrected Volume Path**: Updated default save path from `/Volumes/Public-1/Lasercomb` to `/Volumes/Public/Lasercomb`
- **Robust Directory Handling**: Improved directory existence checks and creation logic for network drives
- **Fallback Save Logic**: Maintains fallback to Downloads directory when network paths are inaccessible

#### **Development Workflow Improvements**
- **Proper Development Scripts**: 
  - `npm run dev`: Development mode with `--dev` flag (single config source)
  - `npm start`: Production mode (user data directory)
- **Configuration File Management**: Clear separation between development and production configuration handling
- **Build Process Integrity**: Ensures all configuration changes are properly included in builds

### 🛠️ Tool Loading & Management Fixes

#### **Tool Display Corrections**
- **Fixed "null" Tool Values**: Resolved issue where tools displayed as "null" instead of proper names
- **XML Parsing Priority**: Tool loading now prioritizes XML data over corrupted postprocessor config
- **Consistent Tool Loading**: All 18 tools now load correctly with proper IDs, names, and types

#### **Configuration System Enhancements**
- **Unified Profile Handling**: Standardized how different configuration components access profile data
- **Error-Resistant Loading**: Improved fallback mechanisms when configuration files are corrupted
- **Validation & Recovery**: Enhanced configuration validation with automatic recovery procedures

### 🎨 Advanced Visualization System (Implemented)

#### **2D Canvas Visualization**
- **Complete Implementation**: 686-line `AdvancedVisualization` class with interactive controls
- **Interactive Playback**: Step-by-step execution with play/pause, speed controls
- **Visual Feedback**: Color-coded cutting types, pan/zoom capabilities, tool path visualization
- **Entity Rendering**: Comprehensive support for lines, arcs, circles, polylines with proper scaling

#### **User Interface Integration**
- **Modal-Based Preview**: Seamless integration with existing DIN generation workflow
- **Progress Tracking**: Visual step counter and progress indicators
- **Control Interface**: Professional control panel with speed adjustment and navigation

### 🔄 IPC Communication Enhancements

#### **Standardized Handlers**
Updated IPC handlers to use consistent path logic:
```javascript
// Before: Hardcoded paths
const profilePath = path.join(__dirname, '..', '..', 'CONFIG', 'profiles', profileName);

// After: Consistent path resolution
const profilesDir = getProfilesDirectory();
const profilePath = path.join(profilesDir, profileName);
```

#### **Key Updated Handlers**
- `get-tools-from-profile`: Now uses `getProfilesDirectory()`
- `get-line-type-mappings-from-profile`: Consistent path resolution
- `save-line-type-mappings-to-profile`: Unified save logic
- `update-output-settings-only`: Proper path handling

### 📊 Layer Processing Improvements

#### **Object Count Accuracy**
- **Fixed Object Count Display**: Layer validation dialog shows accurate counts by aggregating color variants
- **Eliminated Duplicate Listings**: Resolved layers appearing multiple times due to color variations
- **Enhanced Visual Design**: Improved warning colors and success feedback

#### **Validation Enhancements**
- **Comprehensive Layer Data**: Enhanced layer details with entity type summaries
- **Color Breakdown**: Detailed color information for each layer
- **Progress Feedback**: Improved status messages throughout processing

### 🔐 Security & File System Improvements

#### **Permission Handling**
- **Cross-Platform Compatibility**: Improved file operations for Windows, macOS, and Linux
- **Network Share Support**: Proper handling of SMB shares, Nextcloud, and other network volumes
- **Error Recovery**: Graceful fallback when permission issues arise

#### **File System Robustness**
- **Directory Creation Logic**: Enhanced directory existence checks before operations
- **Path Validation**: Improved path validation and sanitization
- **Error Logging**: Comprehensive error reporting for debugging

### 🚀 Development Best Practices

#### **Path Management Guidelines**
1. **Always use `getProfilesDirectory()`** for configuration file access
2. **Use `npm run dev`** for development to avoid caching issues
3. **Test both dev and production modes** before releases
4. **Clear user data caches** when configuration changes are not reflected

#### **Configuration Best Practices**
1. **Single Source of Truth**: All configuration changes in app bundle during development
2. **Consistent API Usage**: Use standardized IPC handlers for all configuration operations
3. **Validation First**: Always validate configuration before applying changes
4. **Backup Strategy**: Maintain configuration backups during updates

#### **Testing Procedures**
1. **Development Testing**: Use `npm run dev` for all feature development
2. **Production Testing**: Test `npm start` before building
3. **Cache Testing**: Verify configuration changes persist after restart
4. **Network Testing**: Test network volume functionality across platforms

### 🔍 Debugging Enhancements

#### **Configuration Debugging**
- **Path Logging**: Added comprehensive path logging for configuration operations
- **Cache Status**: Debug information for configuration cache states
- **XML Validation**: Enhanced XML parsing error reporting

#### **Development Tools**
- **Console Logging**: Structured logging for configuration operations
- **Error Tracking**: Detailed error reporting for file system operations
- **Performance Monitoring**: Path resolution and configuration loading metrics

### 📋 Migration Notes

#### **For Developers**
- **Switch to `npm run dev`**: Use development mode for all development work
- **Update Path Logic**: Replace hardcoded paths with `getProfilesDirectory()` calls
- **Test Configuration Changes**: Verify changes in both dev and production modes

#### **For Users**
- **Configuration Migration**: Existing configurations will be automatically migrated
- **Network Path Updates**: Network volume paths may need reconfiguration
- **Cache Clearing**: Initial startup may recreate configuration caches

### 🎯 Future Enhancements (Planned)

#### **Advanced Features**
- **Real-time Configuration Sync**: Live configuration updates across components
- **Enhanced Network Support**: Improved network volume detection and handling
- **Configuration Versioning**: Version control for configuration files
- **Advanced Caching**: Smart caching with change detection

#### **Development Tools**
- **Configuration Validator**: Standalone tool for validating XML configurations
- **Path Analyzer**: Tool for analyzing and optimizing configuration paths
- **Migration Assistant**: Automated migration tool for configuration updates

---

**Last Updated**: August 6, 2025  
**Version**: 1.1.0 (Pre-release)  
**Critical Fixes**: Path management, caching, network volumes, tool loading  
**Status**: Ready for production use 