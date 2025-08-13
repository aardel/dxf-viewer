const fs = require('fs');
const path = require('path');

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

console.log('=== CF2 Horizontal Mirror Comparison Test ===');

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

// Compare bounding boxes
function getBoundingBox(geometries) {
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
    
    return { minX, maxX, minY, maxY };
}

const oldBounds = getBoundingBox(oldGeometries);
const newBounds = getBoundingBox(newGeometries);

console.log('\nBounding Box Comparison:');
console.log(`Old (with Y-inversion): X(${oldBounds.minX.toFixed(3)}, ${oldBounds.maxX.toFixed(3)}), Y(${oldBounds.minY.toFixed(3)}, ${oldBounds.maxY.toFixed(3)})`);
console.log(`New (no Y-inversion):   X(${newBounds.minX.toFixed(3)}, ${newBounds.maxX.toFixed(3)}), Y(${newBounds.minY.toFixed(3)}, ${newBounds.maxY.toFixed(3)})`);

// Show sample geometry comparison
console.log('\nSample Geometry Comparison (first 3 geometries):');
for (let i = 0; i < Math.min(3, oldGeometries.length, newGeometries.length); i++) {
    const old = oldGeometries[i];
    const new_ = newGeometries[i];
    
    console.log(`\nGeometry ${i} (${old.type}):`);
    console.log(`  Old start: (${old.start.x.toFixed(3)}, ${old.start.y.toFixed(3)})`);
    console.log(`  New start: (${new_.start.x.toFixed(3)}, ${new_.start.y.toFixed(3)})`);
    console.log(`  Old end:   (${old.end.x.toFixed(3)}, ${old.end.y.toFixed(3)})`);
    console.log(`  New end:   (${new_.end.x.toFixed(3)}, ${new_.end.y.toFixed(3)})`);
    if (old.center) {
        console.log(`  Old center: (${old.center.x.toFixed(3)}, ${old.center.y.toFixed(3)})`);
        console.log(`  New center: (${new_.center.x.toFixed(3)}, ${new_.center.y.toFixed(3)})`);
    }
}

// Expected values from CF2 file
const expectedMinX = 0.000;
const expectedMaxX = 6.155;
const expectedMinY = 0.000;
const expectedMaxY = 6.028;

const tolerance = 0.1;
const oldXMatch = Math.abs(oldBounds.minX - expectedMinX) < tolerance && Math.abs(oldBounds.maxX - expectedMaxX) < tolerance;
const oldYMatch = Math.abs(oldBounds.minY - expectedMinY) < tolerance && Math.abs(oldBounds.maxY - expectedMaxY) < tolerance;
const newXMatch = Math.abs(newBounds.minX - expectedMinX) < tolerance && Math.abs(newBounds.maxX - expectedMaxX) < tolerance;
const newYMatch = Math.abs(newBounds.minY - expectedMinY) < tolerance && Math.abs(newBounds.maxY - expectedMaxY) < tolerance;

console.log('\nOrientation Verification:');
console.log(`Old parser: X-axis ${oldXMatch ? 'PASS' : 'FAIL'}, Y-axis ${oldYMatch ? 'PASS' : 'FAIL'}`);
console.log(`New parser: X-axis ${newXMatch ? 'PASS' : 'FAIL'}, Y-axis ${newYMatch ? 'PASS' : 'FAIL'}`);

if (newXMatch && newYMatch && (!oldXMatch || !oldYMatch)) {
    console.log('\n✅ SUCCESS: New parser fixes horizontal mirroring issue');
    console.log('   Old parser had incorrect orientation, new parser matches expected values');
} else if (oldXMatch && oldYMatch && (!newXMatch || !newYMatch)) {
    console.log('\n❌ FAILED: New parser broke correct orientation');
    console.log('   Old parser was correct, new parser has issues');
} else if (newXMatch && newYMatch && oldXMatch && oldYMatch) {
    console.log('\n⚠️  WARNING: Both parsers seem correct - check if test is valid');
} else {
    console.log('\n❌ FAILED: Both parsers have orientation issues');
}
