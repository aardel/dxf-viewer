# NC File Converter

A browser-based tool for converting numerical control (NC) files between metric (mm) and imperial (inch) units.

## Features

- **Unit Conversion**: Convert G-code files between millimeters and inches
- **Auto-detect Units**: Automatically detect the units used in your NC files
- **Customizable Tokens**: Define which tokens (X, Y, Z, I, J, etc.) should be converted
- **H-Function Mapping**: Map H functions to alternative functions for different machine operations
- **Live Preview**: See the conversion results with syntax highlighting
- **DXF Export**: Export your NC files as DXF for CAD software
- **Dark Mode**: Eye-friendly interface for low-light environments
- **Offline Use**: Runs entirely in the browser, no server required

## Installation

No installation required! This is a web-based application that runs entirely in your browser.

### Online Version

Access the online version at: [https://lasercomb.com/tools/nc-converter](https://lasercomb.com/tools/nc-converter)

### Local Installation

1. Download the code from GitHub:
   ```
   git clone https://github.com/aardel/nc-file-converter.git
   ```

2. Open `index.html` in any modern web browser.

## Usage

1. **Upload NC File**: 
   - Click on the file upload area or drag-and-drop a file
   - The application will attempt to auto-detect the units

2. **Convert File**:
   - Select conversion direction (inch to mm, mm to inch, or auto-detect)
   - The conversion happens automatically when a file is loaded

3. **Preview and Compare**:
   - Switch to the Preview tab to see the original and converted code
   - Blue highlights show converted tokens, red highlights show H functions that will be changed

4. **Map H Functions** (optional):
   - Switch to the H Functions tab to map H functions to alternatives
   - Click "Detect H Numbers" to scan your file for H functions

5. **Customize Settings** (optional):
   - Define precision for mm and inch values
   - Add or remove tokens to be converted
   - Manage H function definitions
   - Toggle dark mode

6. **Download or Export**:
   - Download the converted file
   - Export as DXF for CAD software

## Keyboard Shortcuts

- **Ctrl+O**: Open file dialog
- **Ctrl+S**: Save/download converted file
- **Ctrl+1**: Switch to Conversion tab
- **Ctrl+2**: Switch to Preview tab
- **Ctrl+3**: Switch to H Functions tab
- **Ctrl+4**: Switch to Settings tab

## Customization

### Tokens

By default, the following tokens are converted:
- X, Y (coordinates)
- I, J (arc centers)
- R (radius)
- Special tokens: Radius:, CylDia:, GROESSE:

You can add custom tokens in the Settings tab.

### H Functions

H functions are numbered commands used in some NC systems. The application includes definitions for common H functions and allows mapping between them.

## Technical Details

### File Structure

- `index.html`: Main HTML structure
- `css/styles.css`: CSS styles
- `js/`: JavaScript files
  - `constants.js`: Application constants
  - `ui-helpers.js`: UI utility functions
  - `settings.js`: Settings management
  - `file-handler.js`: File operations
  - `token-manager.js`: Token management
  - `h-functions.js`: H function handling
  - `conversion.js`: Unit conversion logic
  - `preview.js`: Preview functionality
  - `search.js`: Search in preview
  - `export.js`: File export functions
  - `version-check.js`: Update checking
  - `error-handler.js`: Error handling
  - `main.js`: Application initialization

### Supported Browsers

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 16+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This software may be freely distributed in its original, unmodified form.
See the LICENSE file for complete terms.

## Contact

Aaron Delia - aardel@gmail.com

Project Link: [https://github.com/aardel/nc-file-converter](https://github.com/aardel/nc-file-converter)

## Acknowledgements

- Developed by Lasercomb GmbH
- Special thanks to all contributors
