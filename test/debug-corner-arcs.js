// Debug corner arc issues in TEST4.cf2
const fs = require('fs');
const Cf2Parser = require('../src/parsers/Cf2Parser');

console.log('=== Debugging Corner Arc Issues ===');

// Read the CF2 file
const cf2Content = fs.readFileSync('./Sample files/TEST4.cf2', 'utf8');

// Parse the file
const cf2Parser = new Cf2Parser();
const entities = cf2Parser.parse(cf2Content);

const arcs = entities.filter(e => e.type === 'ARC');
console.log('Found', arcs.length, 'arcs');

// Look for small corner arcs (likely the problematic ones)
console.log('\n=== Small Radius Arcs (likely corners) ===');
const smallArcs = arcs.filter(arc => Math.abs(arc.radius) < 0.1); // Less than 0.1 inch radius
console.log('Small arcs found:', smallArcs.length);

smallArcs.forEach((arc, i) => {
    console.log(`\nSmall Arc ${i}:`);
    console.log(`  Radius: ${arc.radius}`);
    console.log(`  Clockwise: ${arc.clockwise}`);
    console.log(`  Direction: ${arc.properties.dir}`);
    console.log(`  Start: (${arc.start.x}, ${arc.start.y})`);
    console.log(`  End: (${arc.end.x}, ${arc.end.y})`);
    console.log(`  Center: (${arc.center.x}, ${arc.center.y})`);
    
    // Calculate distance from center to start/end to verify radius
    const distToStart = Math.sqrt((arc.start.x - arc.center.x)**2 + (arc.start.y - arc.center.y)**2);
    const distToEnd = Math.sqrt((arc.end.x - arc.center.x)**2 + (arc.end.y - arc.center.y)**2);
    console.log(`  Calc radius to start: ${distToStart.toFixed(6)}`);
    console.log(`  Calc radius to end: ${distToEnd.toFixed(6)}`);
    console.log(`  Radius match: ${Math.abs(distToStart - Math.abs(arc.radius)) < 0.0001 ? 'OK' : 'ERROR'}`);
    
    // Calculate sweep angle
    const startAngle = Math.atan2(arc.start.y - arc.center.y, arc.start.x - arc.center.x);
    const endAngle = Math.atan2(arc.end.y - arc.center.y, arc.end.x - arc.center.x);
    let sweepAngle = endAngle - startAngle;
    
    // Normalize based on direction
    if (arc.properties.dir === -1) {
        while (sweepAngle >= 0) sweepAngle -= 2 * Math.PI;
        while (sweepAngle < -2 * Math.PI) sweepAngle += 2 * Math.PI;
    } else {
        while (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
        while (sweepAngle > 2 * Math.PI) sweepAngle -= 2 * Math.PI;
    }
    
    console.log(`  Start angle: ${(startAngle * 180 / Math.PI).toFixed(2)}°`);
    console.log(`  End angle: ${(endAngle * 180 / Math.PI).toFixed(2)}°`);
    console.log(`  Sweep angle: ${(sweepAngle * 180 / Math.PI).toFixed(2)}°`);
    console.log(`  Expected small corner: ${Math.abs(sweepAngle * 180 / Math.PI) < 120 ? 'YES' : 'NO'}`);
});

// Look for large radius arcs (might be full circles or corrupted corners)
console.log('\n=== Large Radius Arcs (might be corrupted) ===');
const largeArcs = arcs.filter(arc => Math.abs(arc.radius) > 1.0); // Greater than 1 inch radius
console.log('Large arcs found:', largeArcs.length);

largeArcs.slice(0, 3).forEach((arc, i) => {
    console.log(`\nLarge Arc ${i}:`);
    console.log(`  Radius: ${arc.radius}`);
    console.log(`  Start: (${arc.start.x}, ${arc.start.y})`);
    console.log(`  End: (${arc.end.x}, ${arc.end.y})`);
    console.log(`  Center: (${arc.center.x}, ${arc.center.y})`);
    
    // Check if start and end are very close (might be nearly full circle)
    const startEndDist = Math.sqrt((arc.end.x - arc.start.x)**2 + (arc.end.y - arc.start.y)**2);
    console.log(`  Start-End distance: ${startEndDist.toFixed(6)}`);
    console.log(`  Likely full circle: ${startEndDist < 0.01 ? 'YES' : 'NO'}`);
});

console.log('\n=== Analysis Complete ===');