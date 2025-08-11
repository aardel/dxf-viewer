# Lasercomb Studio V1.0.0 Backup Manifest

**Backup Date:** Mon Aug 11 17:35:27 CEST 2025
**Timestamp:** 20250811_173527
**Version:** 1.0.0

## What's Included

### Core Application
- `src/` - Core processing and rendering components
- `electron/` - Electron main and renderer processes
- `assets/` - Application assets and icons

### Configuration
- `CONFIG/` - All configuration files and profiles
- `package.json` - Project configuration
- `package-lock.json` - Dependency lock file

### Documentation
- `README.md` - Main project documentation
- `DEVELOPER_README.md` - Developer documentation
- `build-script.js` - Build configuration
- `loglevel-wrapper.js` - Logging configuration

### Sample Files
- `Sample files/` - Test files and examples

## Recent Updates (2025-08-11)

### Major Features
- ✅ Multi-Format Support: DXF, DDS, and CFF2 file formats
- ✅ Unified Interface: Single interface for all file formats
- ✅ Internal Line Types Editor: Dedicated editor for cutting operations
- ✅ Line Type Mapping: Separate mapping interface
- ✅ Updated UI: Removed obsolete features and streamlined interface

### Removed Features
- ❌ Configuration validation window (obsolete)
- ❌ Startup configuration issues check
- ❌ DXF-specific limitations in descriptions

### New Components
- `line-types-editor.js` - Internal line types editor
- `line-type-mapping.html/.js` - Line type mapping interface
- Multi-format parsers: DDS and CFF2 support

### Updated Architecture
- Unified file processing pipeline
- Enhanced configuration management
- Improved error handling
- Better performance optimization

## File Format Support

### DXF Files
- Complete parsing with layers, colors, text, hatching, and geometric entities
- AutoCAD Color Index (ACI) support
- Layer-based organization

### DDS Files
- Direct DDS format support
- Color and width-based processing
- Automatic unit detection (inches vs millimeters)

### CFF2 Files
- CFF2 format with pen and layer support
- Color and width mapping
- Professional cutting operations

## Workflow

1. **File Import**: Drag and drop or use "Open File" button
2. **Internal Line Types**: Create and manage cutting operations
3. **Line Type Mapping**: Map internal line types to machine tools
4. **Global Import Filter**: Define mapping rules for all file types
5. **Output Generation**: Generate DIN files with G-code

## Configuration

### Profile-Based Configuration
XML-based profiles store all application settings in `CONFIG/profiles/`

### Line Types
Internal line types managed in `CONFIG/LineTypes/line-types.xml`

### Import Filters
Global import filter rules in `CONFIG/import-filters/`

## Build Information

- **Node.js**: 16+
- **Electron**: 28.0.0
- **Three.js**: 0.161.0
- **Platforms**: Windows, macOS, Linux

## Backup Verification

To restore from this backup:
1. Copy all files to a new directory
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start in development mode
4. Run `npm run build` to build for production

