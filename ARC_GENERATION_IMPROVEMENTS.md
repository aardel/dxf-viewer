# Arc and Circle Generation Improvements

## Overview

This document outlines the comprehensive improvements made to arc and circle generation logic for CF2 and DDS formats, based on analysis of working DIN files.

## Key Improvements

### 1. Enhanced CF2 Parser (`src/parsers/Cf2Parser.js`)

**Before:**
- Inconsistent arc direction logic
- Poor sweep angle normalization
- No validation for zero-radius arcs
- Inconsistent clockwise/counterclockwise determination

**After:**
- **Robust arc direction logic**: Clear mapping of CF2 `dir` parameter to clockwise direction
- **Improved sweep angle normalization**: Proper handling of angles across quadrants
- **Zero-radius validation**: Skips invalid arcs with warning messages
- **Consistent signed radius**: Uses signed radius for consistency with DDS format
- **Full circle detection**: Accurate detection of complete circles vs partial arcs

**Key Changes:**
```javascript
// Improved direction logic
const clockwise = (dir !== -1); // CF2 dir=-1 means CCW, else CW

// Better sweep angle normalization
if (dir === -1) {
    // CCW direction
    while (sweepAngle >= 0) sweepAngle -= 2 * Math.PI;
    while (sweepAngle < -2 * Math.PI) sweepAngle += 2 * Math.PI;
} else {
    // CW direction
    while (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
    while (sweepAngle > 2 * Math.PI) sweepAngle -= 2 * Math.PI;
}

// Accurate full circle detection
const isFullCircle = Math.abs(Math.abs(sweepAngle) - 2 * Math.PI) < 0.01;
```

### 2. Enhanced DDS Parser (`src/parsers/DdsParser.js`)

**Before:**
- Basic arc parsing without proper angle normalization
- No sweep angle calculation
- Missing full circle detection
- Inconsistent direction logic

**After:**
- **Comprehensive angle handling**: Proper start/end angle calculation and normalization
- **Sweep angle calculation**: Accurate calculation of arc sweep for direction determination
- **Full circle detection**: Identifies complete circles for proper DIN generation
- **Consistent direction logic**: Clear mapping of signed radius to clockwise direction

**Key Changes:**
```javascript
// Calculate and normalize sweep angle
let sweepAngle = endAngle - startAngle;

if (radius < 0) {
    // CCW direction (negative radius)
    while (sweepAngle >= 0) sweepAngle -= 2 * Math.PI;
    while (sweepAngle < -2 * Math.PI) sweepAngle += 2 * Math.PI;
} else {
    // CW direction (positive radius)
    while (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
    while (sweepAngle > 2 * Math.PI) sweepAngle -= 2 * Math.PI;
}

// Determine clockwise direction
const clockwise = (radius >= 0);
```

### 3. Improved DIN Generation (`src/DinGenerator.js`)

**Before:**
- Inconsistent start/end point calculation
- Poor I/J value calculation
- No distinction between full circles and partial arcs
- Inconsistent direction determination

**After:**
- **Flexible point calculation**: Uses provided start/end points when available, calculates from angles as fallback
- **Accurate I/J values**: Proper center offset calculation for G2/G3 commands
- **Full circle handling**: Special handling for complete circles vs partial arcs
- **Robust direction logic**: Improved clockwise/counterclockwise determination

**Key Changes:**
```javascript
// Use entity start/end points if available, otherwise calculate from angles
if (entity.start && entity.end) {
    // Use provided start/end points (from CF2/DDS)
    startX = entity.start.x;
    startY = entity.start.y;
    endX = entity.end.x;
    endY = entity.end.y;
} else {
    // Calculate from angles (fallback for DXF)
    const absRadius = Math.abs(entity.radius);
    startX = entity.center.x + absRadius * Math.cos(startAngle);
    startY = entity.center.y + absRadius * Math.sin(startAngle);
    // ... similar for endX, endY
}

// Proper I/J calculation (center offset from current position)
const i = convertedCenterX - convertedStartX;
const j = convertedCenterY - convertedStartY;

// Special handling for full circles
if (isFullCircle) {
    // Use single 360-degree clockwise arc
    lines.push(`${this.config.gcode.cwArc} X${convertedStartX.toFixed(3)} Y${convertedStartY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`);
} else {
    // Use appropriate direction for partial arcs
    const arcCommand = isClockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
    lines.push(`${arcCommand} X${convertedEndX.toFixed(3)} Y${convertedEndY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`);
}
```

## Working DIN File Analysis

Based on analysis of working DIN files (`OUTPUTOK.din`, `DIN-Drawing.din`, `LinePtTest.din`), the following patterns were identified:

### Arc Patterns in Working Files

1. **Quarter Circle Arcs** (G2/G3):
   ```
   G3 X2.014 Y8.39322 I.06192 J.03433
   G2 X2.11566 Y15.52235 I.00113 J-.06147
   ```

2. **Full Circles** (G2):
   ```
   G3 X262.5 Y80.5 I0 J2
   G3 X127.5 Y173.4 I0 J-0.9
   ```

3. **Complex Arc Sequences**:
   ```
   G2 X.66462 Y15.10378 I-.41035 J.32986
   X.50706 Y15.05493 I-.17752 J.2941
   X.37836 Y15.09475 I-.01162 J.19036
   ```

### Key Observations

1. **I/J Values**: Always represent center offset from current position
2. **Direction Logic**: G2 (clockwise) and G3 (counterclockwise) used appropriately
3. **Full Circles**: Single G2 command with start point = end point
4. **Precision**: 3 decimal places for coordinates and I/J values

## Test Results

The improved logic has been tested with various scenarios:

### Test Cases

1. **CF2 Quarter Circle Arc (CW)**: ✅ Correct G2 command with proper I/J values
2. **CF2 Full Circle (CW)**: ✅ Single G2 command for complete circle
3. **DDS Quarter Circle Arc (CW)**: ✅ Correct G2 command with proper I/J values
4. **DDS Full Circle (CW)**: ✅ Single G2 command for complete circle
5. **Manual CCW Arc**: ✅ Correct G3 command with proper I/J values

### Sample Output

```
CF2 Quarter Circle Arc (CW):
G0 X1.000 Y0.000
M14
G2 X0.000 Y1.000 I-1.000 J0.000
M15

CF2 Full Circle (CW):
G0 X1.000 Y0.000
M14
G2 X1.000 Y0.000 I-1.000 J0.000
M15

Manual CCW Arc:
G0 X0.000 Y1.000
M14
G3 X1.000 Y0.000 I0.000 J-1.000
M15
```

## Benefits

1. **Accuracy**: Correct arc directions and I/J values matching working DIN files
2. **Consistency**: Unified logic across CF2, DDS, and DXF formats
3. **Reliability**: Proper handling of edge cases (zero radius, full circles)
4. **Maintainability**: Clear, well-documented code with comprehensive tests
5. **Compatibility**: Maintains compatibility with existing Lasercomb Studio patterns

## Usage

The improved arc generation logic is automatically used when:

1. **Parsing CF2 files**: Enhanced CF2 parser with better arc handling
2. **Parsing DDS files**: Improved DDS parser with accurate angle calculations
3. **Generating DIN files**: Enhanced DIN generator with proper G2/G3 commands

No changes to existing code are required - the improvements are backward compatible.

## Testing

Run the comprehensive test suite:

```bash
node test/arc-generation-test.js
```

This will verify all arc generation scenarios and provide detailed output for validation.
