# Configuration Files

This folder contains configuration files that can be modified by users to customize the application behavior.

## ✅ No Server Required!

**The application now uses embedded CSV data, so no local server is needed!** You can open the HTML file directly in your browser.

## Files

### `line-types.csv`
Contains all the line type definitions used by the application.

#### CSV Format
The file uses comma-separated values with the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `id` | Unique identifier for the line type | `H1`, `H2`, `CUSTOM_001` |
| `name` | Display name (should match width) | `1pt`, `2pt`, `0.5pt` |
| `description` | Detailed description | `1 point`, `Fast Engrave` |
| `lineType` | Category grouping | `laser`, `pulse`, `engraving`, `milling`, `steel` |
| `processMethod` | Processing method | `laser_cut`, `laser_engrave`, `steel_cutting`, `milling` |
| `width` | Line width in points | `1`, `2`, `0.5`, `1.5` |
| `color` | Hex color code | `#FF0000`, `#00FF00` |
| `icon` | Unicode icon | `✂️`, `⚡`, `📝`, `🔧`, `🔪` |

#### Process Methods Available
- `laser_cut` - Laser cutting operations
- `laser_engrave` - Laser engraving operations  
- `steel_cutting` - Steel cutting operations
- `milling` - Milling operations

#### Line Type Categories
- `laser` - Standard laser cutting
- `pulse` - Pulsed laser operations
- `engraving` - Engraving operations
- `milling` - Milling operations
- `steel` - Steel cutting operations

## How to Modify Line Types

### Method 1: Direct JavaScript Editing (Quick)
1. Open `js/csv-loader.js` in any text editor
2. Find the `EMBEDDED_CSV_DATA` variable
3. Modify the CSV content directly
4. Save the file and refresh the browser
5. Click "🔄 Reload CSV" in the application

### Method 2: CSV File + Update Script (Recommended)
1. Edit `config/line-types.csv` in any text editor or spreadsheet
2. Save the CSV file
3. Run the update script: `node update-embedded-csv.js`
4. Refresh the browser
5. Click "🔄 Reload CSV" in the application

### Method 3: Export + Edit + Import
1. Click "📥 Export CSV" in the application to download current settings
2. Edit the downloaded CSV file
3. Copy the content and paste it into the `EMBEDDED_CSV_DATA` variable in `js/csv-loader.js`
4. Save and refresh the browser
5. Click "🔄 Reload CSV" in the application

#### Adding New Line Types
1. Add a new row to the CSV file
2. Use a unique `id` (e.g., `CUSTOM_001`)
3. Set appropriate values for all columns
4. Follow one of the modification methods above

#### Notes
- The `name` field should reflect the width (e.g., `2pt` for 2-point width)
- Colors should be valid hex codes (e.g., `#FF0000` for red)
- Icons should be valid Unicode characters
- Width values are in points (pt) and will be converted to millimeters automatically
- Changes take effect immediately when you click "🔄 Reload CSV"

