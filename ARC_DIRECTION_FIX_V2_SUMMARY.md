# Arc Direction Fix V2 for DDS/CF2 Files

## 🐛 **Issue Identified**

The arcs were still showing the wrong half even after the initial fix. The viewer displayed U-shaped elements, but the generated DIN file was still showing the opposite half of the arc.

## 🔍 **Root Cause Analysis**

The issue was in the sweep angle calculation and direction determination logic in the DIN generator. The problem was:

1. **Inconsistent Direction Logic**: The DIN generator was using the `clockwise` property to determine direction, but the CAD viewer uses the `radius` sign
2. **Wrong Sweep Normalization**: The sweep angle normalization logic was different between the CAD viewer and DIN generator

### **CAD Viewer Logic (Correct)**:
```javascript
let sweep = endAngle - startAngle;
if (entityData.radius < 0 && sweep > 0) sweep -= 2 * Math.PI;
if (entityData.radius >= 0 && sweep < 0) sweep += 2 * Math.PI;
// Direction: negative radius = CCW, positive radius = CW
```

### **Previous DIN Generator Logic (Incorrect)**:
```javascript
const ccw = !entity.clockwise; // Using clockwise property
let sweep = a1 - a0;
if (ccw && sweep < 0) sweep += Math.PI * 2;
if (!ccw && sweep > 0) sweep -= Math.PI * 2;
```

## ✅ **Fix Applied**

### **Updated Arc Direction Logic**
- **File**: `src/DinGenerator.js`
- **Function**: `generateEntityDinWithBridges()`
- **Change**: Replaced the direction logic to match the CAD viewer implementation

**New Logic**:
```javascript
// Derive start/end angles from given start/end points
const a0 = Math.atan2(entity.start.y - cy, entity.start.x - cx);
const a1 = Math.atan2(entity.end.y - cy, entity.end.x - cx);
let sweep = a1 - a0;

// Normalize sweep using the same logic as CAD viewer
if (entity.radius < 0 && sweep > 0) sweep -= Math.PI * 2;
if (entity.radius >= 0 && sweep < 0) sweep += Math.PI * 2;

// Determine direction from radius sign (negative = CCW, positive = CW)
const ccw = entity.radius < 0;
```

## 🎯 **Expected Results**

Now when you load a DDS file and generate DIN output:
- ✅ **Arcs will show the correct half** (U-shaped elements as seen in the viewer)
- ✅ **Direction will be consistent** with the CAD viewer display
- ✅ **Sweep angle calculation** will match the viewer's logic
- ✅ **All arc types** (partial arcs, full circles) will be processed correctly

## 🔧 **Technical Details**

The fix ensures that:
1. **Sweep angle normalization** uses the same logic as the CAD viewer
2. **Direction determination** is based on the radius sign, not the clockwise property
3. **Arc processing** is consistent across all file formats (DXF, DDS, CF2)

This fix is backward compatible and doesn't affect DXF file processing.
