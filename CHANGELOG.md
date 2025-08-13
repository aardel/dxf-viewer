# Changelog - DXF Viewer DIN Generator

## [Latest] - 2025-01-15

### 🔧 Major Fixes
- **Fixed arc direction inversion**: CF2/DDS clockwise=true now correctly generates G3 (CCW) for concave cuts
- **Fixed bridge processing for partial arcs**: Semicircle arcs with bridges now split correctly
- **Fixed duplicate G0 rapid moves**: Eliminated redundant moves in bridged arc processing
- **Fixed precision issues in inch files**: Increased from 3 to 5 decimal places for inches

### ✨ Enhancements
- **Smart geometric fallback**: When clockwise is undefined, calculate direction from arc sweep
- **Vertical semicircle heuristic**: Special handling for problematic semicircle orientations
- **Per-segment direction calculation**: Each bridge segment calculates optimal direction
- **Precision-aware duplicate detection**: Tighter epsilon tolerance for high-precision coordinates

### 🐛 Bug Fixes
- Arc crosses in CF2 visual renderer eliminated
- Machine toolpath now shows correct concave cuts
- Bridge gaps properly maintained in semicircle tabs
- No more coordinate rounding conflicts in inch-based files

### 🔍 Debug Improvements
- Comprehensive arc direction logging
- Bridge processing progress tracking
- Segment-by-segment direction confirmation
- Precision detection and unit handling logs

### 📊 Testing Status
- ✅ CF2 files: Visual and toolpath generation working correctly
- ✅ DDS files: Backward compatibility maintained  
- ✅ Bridge processing: Semicircle tabs split properly
- ✅ Inch precision: No duplicate moves, better accuracy
- ✅ MM files: Unchanged behavior, full compatibility

### 🔄 Backward Compatibility
- MM-based files continue using 3 decimal precision
- All existing configuration options preserved
- Debug logging can be disabled if needed
- No breaking changes to API or file formats

---

## Key Technical Changes

### Arc Direction Logic
```javascript
// OLD: Direct clockwise flag usage (wrong for CF2/DDS)
const isClockwise = entity.clockwise;

// NEW: Inverted logic + geometric fallback
const isClockwise = entity.clockwise !== undefined 
    ? !entity.clockwise  // INVERTED
    : (sweep < 0);       // Geometric calculation
```

### Bridge Processing
```javascript
// OLD: Only full circles got bridge processing
if (isFullCircle) { /* bridge logic */ }

// NEW: Both full and partial arcs get bridge processing
for (let i = 0; i <= bridgeCount; i++) {
    // Segment calculation with proper gaps
}
```

### Precision Handling
```javascript
// OLD: Fixed 3 decimals for all units
.toFixed(3)

// NEW: Variable precision based on units
const precision = isInches ? 5 : 3;
.toFixed(precision)
```

---

## Files Modified
- `src/DinGenerator.js` - Core DIN generation logic
- `DIN_GENERATOR_IMPROVEMENTS.md` - Technical documentation
- `CHANGELOG.md` - This file

## Commit History
- `e812afd` - Fix DIN generator arc direction and bridge processing
- `2b7f5af` - Add comprehensive documentation for DIN generator improvements

---

*This version represents a stable, production-ready state of the DIN generator with comprehensive arc handling improvements.*
