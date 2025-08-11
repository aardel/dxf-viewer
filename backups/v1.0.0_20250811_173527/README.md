# Lasercomb Studio V1.0.0

Professional CAD drawing viewer and analysis tool built with Electron and Three.js WebGL rendering. Supports DXF, DDS, and CFF2 file formats with advanced processing capabilities.

## Features

- **Multi-Format Support**: Complete parsing of DXF, DDS, and CFF2 files with unified processing
- **Batch Processing System**: Automatically monitors a directory for new files and processes them in the background
- **Global Import Filter**: Centralized system to define mapping rules from file properties to internal line types
- **Advanced Two-Level Path Optimization**: Intelligent cutting sequence with priority phases and travel distance optimization
- **Priority-Based Cutting Phases**: Configurable cutting phases (engraving → internal → borders) with line break support
- **Advanced Scaling System**: Dropdown scaling options with custom input validation
- **Enhanced Dimension Display**: Shows both original and scaled dimensions
- **Multi-Color Layer Support**: Visual layer management with color coding
- **3D Rendering**: WebGL-based rendering via Three.js for smooth performance
- **Layer Management**: Show/hide layers with visual feedback
- **Lascomb Studio Line Types**: Internal line type editor for creating and managing cutting operations
- **Line Type Mapping**: Map internal line types to machine tools
- **Tool Configuration**: XML-based tool profiles with H-code mapping
- **DIN File Generation**: G-code output with customizable postprocessors
- **Canvas Size Validation**: 3m × 3m size limits with warnings
- **Professional UI**: Clean, modern interface designed for CAD workflows

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Setup
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

## Building

```bash
# Build for all platforms
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux

# Create distribution packages
npm run dist
```

## Usage

1. **Launch Application**: Run `npm start` or `npm run dev`
2. **Open File**: Click "Open File" or drag & drop a DXF, DDS, or CFF2 file
3. **Scale & Units**: Use the Settings tab to configure scaling and units
4. **Layer Management**: Toggle layer visibility in the Import tab
5. **View Controls**: 
   - Mouse wheel: Zoom
   - Left drag: Pan
   - "Fit to View": Auto-zoom to drawing bounds

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

### 1. File Import
- Drag and drop or use "Open File" button
- Supported formats: DXF, DDS, CFF2
- Automatic format detection and processing

### 2. Internal Line Types (Lascomb Studio Line Types)
- Create and manage internal line types via "Manage Line Types" button
- Define cutting operations (CW, Pulse, Engraving, Milling)
- Set line widths, colors, and descriptions
- Save to XML configuration

### 3. Line Type Mapping
- Map internal line types to machine tools
- Configure cutting parameters
- Set up tool assignments

### 4. Global Import Filter
- Define mapping rules for all supported file types
- Map file properties to internal line types
- Support for exact key matching

### 5. Output Generation
- Generate DIN files with G-code
- Customizable postprocessors
- Priority-based cutting sequences

## Settings Configuration

### Display Units
- Choose between millimeters (mm) and inches (in)
- Affects UI display only, not geometry scaling
- Output units defined by postprocessor profile

### Scaling Factor
- Apply scaling for incorrectly exported files
- DXF-specific scaling options
- CFF2 uses internal SCALE value automatically

### Lascomb Studio Line Types
- Configure and manage internal line types
- Create custom cutting operations
- Set operation parameters

### Import Filters
- Manage global import filter for all supported file types
- Define mapping rules
- Configure processing parameters

### Machine Tools
- Import machine tool configurations from XML files
- Expand tool library
- Configure cutting parameters

## Current Status (2025-08-11)

### Recent Updates
- **Multi-Format Support**: Added DDS and CFF2 file format support alongside DXF
- **Unified Interface**: Single interface for all file formats with consistent processing
- **Internal Line Types Editor**: Dedicated editor for creating and managing cutting operations
- **Line Type Mapping**: Separate window for mapping internal line types to machine tools
- **Updated UI**: Removed obsolete features and streamlined interface
- **Configuration Management**: Enhanced profile-based configuration system

### Removed Features
- Configuration validation window (obsolete)
- Startup configuration issues check
- DXF-specific limitations in descriptions

### File Format Mapping
- **DXF**: `dxf|<Layer>|<ACI>` - Layer and AutoCAD Color Index based
- **DDS**: `dds|<Color>|<RawWidth>|<Unit>` - Color and width based with unit detection
- **CFF2**: `cff2|<Pen>-<Layer>` - Pen and layer based

### Cutting Optimization
- **Output with bridges**: DDS/CFF2 bridge support
- **Validate cutting widths**: Temporarily disabled (future implementation)
- **Rotary output**: Future development option
- **Manual priority breaks**: Always active based on line priority

## Development

### Project Structure
```
dxf2Laser/
├── electron/           # Electron main and renderer processes
├── src/               # Core application source
├── CONFIG/            # Configuration files and profiles
├── Sample files/      # Test files and examples
└── assets/           # Application assets and icons
```

### Key Components
- **DxfViewer.js**: Main viewer component with Three.js rendering
- **DxfParser.js**: File parsing and processing
- **PathOptimizer.js**: Cutting path optimization
- **DinGenerator.js**: DIN file generation
- **Line Types**: Internal line type management system

## License

[Add your license information here]

## Contributing

[Add contribution guidelines here]