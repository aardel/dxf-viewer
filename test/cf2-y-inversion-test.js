// Test CF2 Y-axis inversion to fix circle/cross alignment and corner arcs
const fs = require('fs');
const Cf2Parser = require('../src/parsers/Cf2Parser');

console.log('=== Testing CF2 Y-Axis Inversion ===');

// Read the test CF2 file
const cf2Content = fs.readFileSync('./Sample files/Unit tests/TEST.cf2', 'utf8');

// Parse with normal orientation
console.log('\n--- Normal Parsing (Y-axis normal) ---');
const normalParser = new Cf2Parser({ invertY: false });
const normalEntities = normalParser.parse(cf2Content);
console.log('Bounding box:', normalParser.boundingBox);
console.log('Total entities:', normalEntities.length);

// Parse with Y-axis inverted
console.log('\n--- Y-Inverted Parsing ---');
const invertedParser = new Cf2Parser({ invertY: true });
const invertedEntities = invertedParser.parse(cf2Content);
console.log('Bounding box:', invertedParser.boundingBox);
console.log('Total entities:', invertedEntities.length);

// Compare some specific entities that should be affected
console.log('\n=== Comparing Circle Entities ===');

// Find some small arcs that form circles (likely the ones with cross alignment issues)
const normalArcs = normalEntities.filter(e => e.type === 'ARC').slice(0, 5);
const invertedArcs = invertedEntities.filter(e => e.type === 'ARC').slice(0, 5);

normalArcs.forEach((normalArc, i) => {
    const invertedArc = invertedArcs[i];
    console.log(`\nArc ${i}:`);
    console.log(`  Normal:   center(${normalArc.center.x.toFixed(3)}, ${normalArc.center.y.toFixed(3)}) clockwise=${normalArc.clockwise}`);
    console.log(`  Inverted: center(${invertedArc.center.x.toFixed(3)}, ${invertedArc.center.y.toFixed(3)}) clockwise=${invertedArc.clockwise}`);
    
    // Calculate the Y difference
    const yDiff = Math.abs(normalArc.center.y - invertedArc.center.y);
    console.log(`  Y difference: ${yDiff.toFixed(3)} (should be significant if inversion working)`);
    console.log(`  Direction flipped: ${normalArc.clockwise !== invertedArc.clockwise ? 'YES' : 'NO'}`);
});

// Compare some lines to see coordinate transformation
console.log('\n=== Comparing Line Entities ===');
const normalLines = normalEntities.filter(e => e.type === 'LINE').slice(0, 3);
const invertedLines = invertedEntities.filter(e => e.type === 'LINE').slice(0, 3);

normalLines.forEach((normalLine, i) => {
    const invertedLine = invertedLines[i];
    console.log(`\nLine ${i}:`);
    console.log(`  Normal:   start(${normalLine.start.x.toFixed(3)}, ${normalLine.start.y.toFixed(3)}) end(${normalLine.end.x.toFixed(3)}, ${normalLine.end.y.toFixed(3)})`);
    console.log(`  Inverted: start(${invertedLine.start.x.toFixed(3)}, ${invertedLine.start.y.toFixed(3)}) end(${invertedLine.end.x.toFixed(3)}, ${invertedLine.end.y.toFixed(3)})`);
    
    const startYDiff = Math.abs(normalLine.start.y - invertedLine.start.y);
    const endYDiff = Math.abs(normalLine.end.y - invertedLine.end.y);
    console.log(`  Y differences: start=${startYDiff.toFixed(3)}, end=${endYDiff.toFixed(3)}`);
});

// Check specific coordinates that should help identify the issue
console.log('\n=== Coordinate Analysis ===');
console.log('File bounding box: LL(0,0) to UR(6.155, 6.028)');
console.log('If Y-inversion fixes the issue, inverted Y coordinates should be:');
console.log('  newY = maxY + minY - originalY = 6.028 + 0 - originalY = 6.028 - originalY');

// Find an entity near the middle to verify transformation
const middleY = 3.014; // roughly middle of 6.028
console.log(`\nLooking for entities near middle Y (${middleY})...`);

normalArcs.forEach((arc, i) => {
    if (Math.abs(arc.center.y - middleY) < 1.0) {
        const expectedInvertedY = 6.028 - arc.center.y;
        const actualInvertedY = invertedArcs[i].center.y;
        console.log(`Arc ${i}: normal Y=${arc.center.y.toFixed(3)}, expected inverted=${expectedInvertedY.toFixed(3)}, actual inverted=${actualInvertedY.toFixed(3)}`);
        console.log(`  Inversion correct: ${Math.abs(actualInvertedY - expectedInvertedY) < 0.001 ? 'YES' : 'NO'}`);
    }
});

console.log('\n=== Test Complete ===');
console.log('If the Y-axis inversion is working correctly:');
console.log('1. Y coordinates should be significantly different between normal and inverted');
console.log('2. Arc directions (clockwise) should be flipped');
console.log('3. Circles should align with crosses when inverted parsing is used');