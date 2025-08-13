const fs = require('fs');
const path = require('path');

// Simulate the rendering transformation that happens in the main application
function simulateRenderingTransform(geometries, canvasWidth = 800, canvasHeight = 600) {
    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    geometries.forEach(geom => {
        if (geom.type === 'LINE') {
            minX = Math.min(minX, geom.start.x, geom.end.x);
            maxX = Math.max(maxX, geom.start.x, geom.end.x);
            minY = Math.min(minY, geom.start.y, geom.end.y);
            maxY = Math.max(maxY, geom.start.y, geom.end.y);
        } else if (geom.type === 'ARC') {
            minX = Math.min(minX, geom.start.x, geom.end.x, geom.center.x);
            maxX = Math.max(maxX, geom.start.x, geom.end.x, geom.center.x);
            minY = Math.min(minY, geom.start.y, geom.end.y, geom.center.y);
            maxY = Math.max(maxY, geom.start.y, geom.end.y, geom.center.y);
        }
    });
    
    const geoW = maxX - minX;
    const geoH = maxY - minY;
    const pad = 20;
    const sx = (canvasWidth - 2 * pad) / Math.max(geoW, 1e-6);
    const sy = (canvasHeight - 2 * pad) / Math.max(geoH, 1e-6);
    const scale = Math.max(0.0001, Math.min(sx, sy)) * 0.98;
    
    // This is the key transformation from the rendering system
    const offsetX = (canvasWidth - geoW * scale) / 2 - minX * scale;
    const offsetY = (canvasHeight + geoH * scale) / 2 + minY * scale; // Note the + geoH * scale
    
    // Transform a point from model coordinates to canvas coordinates
    function modelToCanvas(x, y) {
        return {
            x: offsetX + x * scale,
            y: offsetY - y * scale  // Note the negative sign - this is the Y-axis flip
        };
    }
    
    // Transform geometries to canvas coordinates
    return geometries.map(geom => {
        if (geom.type === 'LINE') {
            return {
                type: 'LINE',
                start: modelToCanvas(geom.start.x, geom.start.y),
                end: modelToCanvas(geom.end.x, geom.end.y),
                layer: geom.layer
            };
        } else if (geom.type === 'ARC') {
            return {
                type: 'ARC',
                start: modelToCanvas(geom.start.x, geom.start.y),
                end: modelToCanvas(geom.end.x, geom.end.y),
                center: modelToCanvas(geom.center.x, geom.center.y),
                layer: geom.layer
            };
        }
        return geom;
    });
}

// Create a simple CF2Parser class for comparison (old behavior)
class OldCf2Parser {
    constructor(options = {}) {
        this.invertY = options.invertY || false;
        this.boundingBox = null;
    }

    parse(content) {
        if (!content || typeof content !== 'string') return [];

        const lines = content.split(/\r?\n/);
        const geometries = [];

        // First pass: extract bounding box for Y-axis inversion
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());
            const type = parts[0];

            if (type === 'LL' && parts.length >= 3) {
                if (!this.boundingBox) this.boundingBox = {};
                this.boundingBox.minX = parseFloat(parts[1]);
                this.boundingBox.minY = parseFloat(parts[2]);
            } else if (type === 'UR' && parts.length >= 3) {
                if (!this.boundingBox) this.boundingBox = {};
                this.boundingBox.maxX = parseFloat(parts[1]);
                this.boundingBox.maxY = parseFloat(parts[2]);
            }
        }

        // Helper function to invert Y coordinate if needed
        const transformY = (y) => {
            if (this.invertY && this.boundingBox && 
                this.boundingBox.minY !== undefined && this.boundingBox.maxY !== undefined) {
                return this.boundingBox.maxY + this.boundingBox.minY - y;
            }
            return y;
        };

        // Second pass: parse geometry with coordinate transformation
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());
            const type = parts[0];

            if (type === 'L' && parts.length >= 8) {
                const pen = parts[1];
                const layer = parts[2];
                const x1 = parseFloat(parts[4]);
                const y1 = transformY(parseFloat(parts[5]));
                const x2 = parseFloat(parts[6]);
                const y2 = transformY(parseFloat(parts[7]));

                geometries.push({
                    type: 'LINE',
                    start: { x: x1, y: y1 },
                    end: { x: x2, y: y2 },
                    layer: `${pen}-${layer}`
                });
            } else if (type === 'A' && parts.length >= 11) {
                const pen = parts[1];
                const layer = parts[2];
                const x1 = parseFloat(parts[4]);
                const y1 = transformY(parseFloat(parts[5]));
                const x2 = parseFloat(parts[6]);
                const y2 = transformY(parseFloat(parts[7]));
                const cx = parseFloat(parts[8]);
                const cy = transformY(parseFloat(parts[9]));

                geometries.push({
                    type: 'ARC',
                    start: { x: x1, y: y1 },
                    end: { x: x2, y: y2 },
                    center: { x: cx, y: cy },
                    layer: `${pen}-${layer}`
                });
            }
        }

        return geometries;
    }
}

// Import the new parser
const NewCf2Parser = require('../src/parsers/Cf2Parser');

console.log('=== CF2 Rendering Transformation Comparison Test ===');

// Read the test CF2 file
const cf2Content = fs.readFileSync('./Sample files/Unit tests/TEST.cf2', 'utf8');

// Parse with old behavior (Y-axis inversion enabled)
console.log('\n--- Old Parsing (Y-axis inversion enabled) ---');
const oldParser = new OldCf2Parser({ invertY: true });
const oldGeometries = oldParser.parse(cf2Content);

// Parse with new behavior (no Y-axis inversion)
console.log('\n--- New Parsing (no Y-axis inversion) ---');
const newParser = new NewCf2Parser({ invertY: false });
const newGeometries = newParser.parse(cf2Content);

console.log(`\nGeometry counts: Old=${oldGeometries.length}, New=${newGeometries.length}`);

// Apply rendering transformation to both sets
console.log('\n--- Applying Rendering Transformation ---');
const oldRendered = simulateRenderingTransform(oldGeometries);
const newRendered = simulateRenderingTransform(newGeometries);

// Compare the rendered coordinates
console.log('\nRendered Coordinates Comparison (first 5 geometries):');
for (let i = 0; i < Math.min(5, oldRendered.length, newRendered.length); i++) {
    const old = oldRendered[i];
    const new_ = newRendered[i];
    
    console.log(`\nGeometry ${i} (${old.type}):`);
    console.log(`  Old start: (${old.start.x.toFixed(1)}, ${old.start.y.toFixed(1)})`);
    console.log(`  New start: (${new_.start.x.toFixed(1)}, ${new_.start.y.toFixed(1)})`);
    console.log(`  Old end:   (${old.end.x.toFixed(1)}, ${old.end.y.toFixed(1)})`);
    console.log(`  New end:   (${new_.end.x.toFixed(1)}, ${new_.end.y.toFixed(1)})`);
    if (old.center) {
        console.log(`  Old center: (${old.center.x.toFixed(1)}, ${old.center.y.toFixed(1)})`);
        console.log(`  New center: (${new_.center.x.toFixed(1)}, ${new_.center.y.toFixed(1)})`);
    }
}

// Check if the rendered coordinates are significantly different
let significantDifference = false;
for (let i = 0; i < Math.min(10, oldRendered.length, newRendered.length); i++) {
    const old = oldRendered[i];
    const new_ = newRendered[i];
    
    const startDiff = Math.abs(old.start.x - new_.start.x) + Math.abs(old.start.y - new_.start.y);
    const endDiff = Math.abs(old.end.x - new_.end.x) + Math.abs(old.end.y - new_.end.y);
    
    if (startDiff > 10 || endDiff > 10) { // More than 10 pixels difference
        significantDifference = true;
        break;
    }
}

console.log(`\nSignificant rendering difference detected: ${significantDifference ? 'YES' : 'NO'}`);

if (significantDifference) {
    console.log('\n✅ SUCCESS: The fix addresses the horizontal mirroring issue');
    console.log('   The old parser with Y-axis inversion + rendering transformation');
    console.log('   produces different visual output than the new parser');
} else {
    console.log('\n⚠️  WARNING: No significant difference detected');
    console.log('   This might indicate the fix is not working as expected');
}

// Show a specific example of the difference
if (oldRendered.length > 0 && newRendered.length > 0) {
    const old = oldRendered[0];
    const new_ = newRendered[0];
    
    console.log('\nSpecific Example (first geometry):');
    console.log(`Old rendered start: (${old.start.x.toFixed(1)}, ${old.start.y.toFixed(1)})`);
    console.log(`New rendered start: (${new_.start.x.toFixed(1)}, ${new_.start.y.toFixed(1)})`);
    
    const xDiff = Math.abs(old.start.x - new_.start.x);
    const yDiff = Math.abs(old.start.y - new_.start.y);
    
    console.log(`Difference: X=${xDiff.toFixed(1)}px, Y=${yDiff.toFixed(1)}px`);
    
    if (yDiff > xDiff && yDiff > 50) {
        console.log('✅ This shows the Y-axis inversion was causing the horizontal mirroring');
    } else {
        console.log('⚠️  The difference pattern is not as expected');
    }
}
