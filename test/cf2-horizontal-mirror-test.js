const fs = require('fs');
const path = require('path');
const Cf2Parser = require('../src/parsers/Cf2Parser');

console.log('=== Testing CF2 Horizontal Mirror Fix ===');

// Read the test CF2 file
const cf2Content = fs.readFileSync('./Sample files/Unit tests/TEST.cf2', 'utf8');

// Parse with the fixed parser (no Y-axis inversion)
console.log('\n--- Fixed Parsing (no Y-axis inversion) ---');
const fixedParser = new Cf2Parser({ invertY: false });
const fixedGeometries = fixedParser.parse(cf2Content);

console.log(`Parsed ${fixedGeometries.length} geometries`);

// Check for some key geometries to verify orientation
let hasLines = false;
let hasArcs = false;
let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;

fixedGeometries.forEach((geom, idx) => {
    if (geom.type === 'LINE') {
        hasLines = true;
        minX = Math.min(minX, geom.start.x, geom.end.x);
        maxX = Math.max(maxX, geom.start.x, geom.end.x);
        minY = Math.min(minY, geom.start.y, geom.end.y);
        maxY = Math.max(maxY, geom.start.y, geom.end.y);
    } else if (geom.type === 'ARC') {
        hasArcs = true;
        minX = Math.min(minX, geom.start.x, geom.end.x, geom.center.x);
        maxX = Math.max(maxX, geom.start.x, geom.end.x, geom.center.x);
        minY = Math.min(minY, geom.start.y, geom.end.y, geom.center.y);
        maxY = Math.max(maxY, geom.start.y, geom.end.y, geom.center.y);
    }
    
    // Log first few geometries for inspection
    if (idx < 5) {
        console.log(`Geometry ${idx}: ${geom.type} - ${JSON.stringify({
            start: geom.start,
            end: geom.end,
            center: geom.center,
            layer: geom.layer
        })}`);
    }
});

console.log(`\nGeometry types found: Lines=${hasLines}, Arcs=${hasArcs}`);
console.log(`Bounding box: X(${minX.toFixed(3)}, ${maxX.toFixed(3)}), Y(${minY.toFixed(3)}, ${maxY.toFixed(3)})`);

// Verify that the bounding box matches expected values from the CF2 file
// The CF2 file has LL,0.000,0.000 and UR,6.155,6.028
const expectedMinX = 0.000;
const expectedMaxX = 6.155;
const expectedMinY = 0.000;
const expectedMaxY = 6.028;

const tolerance = 0.1;
const xMatch = Math.abs(minX - expectedMinX) < tolerance && Math.abs(maxX - expectedMaxX) < tolerance;
const yMatch = Math.abs(minY - expectedMinY) < tolerance && Math.abs(maxY - expectedMaxY) < tolerance;

console.log(`\nBounding box verification:`);
console.log(`X-axis match: ${xMatch ? 'PASS' : 'FAIL'} (expected ${expectedMinX}-${expectedMaxX}, got ${minX.toFixed(3)}-${maxX.toFixed(3)})`);
console.log(`Y-axis match: ${yMatch ? 'PASS' : 'FAIL'} (expected ${expectedMinY}-${expectedMaxY}, got ${minY.toFixed(3)}-${maxY.toFixed(3)})`);

if (xMatch && yMatch) {
    console.log('\n✅ CF2 horizontal mirror fix: SUCCESS - File loads with correct orientation');
} else {
    console.log('\n❌ CF2 horizontal mirror fix: FAILED - File still has orientation issues');
}
