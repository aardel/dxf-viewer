// Test with real CF2 file 
const fs = require('fs');
const Cf2Parser = require('../src/parsers/Cf2Parser');
const { DinGenerator } = require('../src/DinGenerator.js');

console.log('=== Testing with TEST4.cf2 ===');

// Read the CF2 file
const cf2Content = fs.readFileSync('./Sample files/TEST4.cf2', 'utf8');
console.log('CF2 file size:', cf2Content.length, 'characters');

// Parse the file
const cf2Parser = new Cf2Parser();
const entities = cf2Parser.parse(cf2Content);
console.log('Parsed entities:', entities.length);

// Check units on some entities
const lines = entities.filter(e => e.type === 'LINE');
const arcs = entities.filter(e => e.type === 'ARC');
console.log('Lines:', lines.length, 'Arcs:', arcs.length);

if (lines.length > 0) {
    console.log('First line fileUnits:', lines[0].fileUnits);
    console.log('First line coordinates:', lines[0].start, 'to', lines[0].end);
}

if (arcs.length > 0) {
    console.log('First arc fileUnits:', arcs[0].fileUnits);
    console.log('First arc clockwise:', arcs[0].clockwise);
    console.log('First arc radius:', arcs[0].radius);
    console.log('First arc center:', arcs[0].center);
    console.log('First arc start/end:', arcs[0].start, 'to', arcs[0].end);
    
    // Check direction for a few arcs
    console.log('\nArc directions:');
    arcs.slice(0, 5).forEach((arc, i) => {
        console.log(`Arc ${i}: clockwise=${arc.clockwise}, radius=${arc.radius}, dir=${arc.properties.dir}`);
    });
}

// Test unit conversion
console.log('\n=== Testing Unit Conversion ===');
const dinGenerator = new DinGenerator();
const testConfig = {
    units: { system: 'mm' },
    gcode: { rapidMove: 'G0', linearMove: 'G1', cwArc: 'G2', ccwArc: 'G3' },
    laser: { laserOn: 'M3', laserOff: 'M5' },
    lineNumbers: { enabled: true, increment: 10 }
};

dinGenerator.config = testConfig;
dinGenerator.metadata = { fileUnits: 'mm' }; // This should be overridden

if (lines.length > 0) {
    console.log('\nLine unit conversion test:');
    const line = lines[0];
    const fileUnits = line.fileUnits || dinGenerator.metadata.fileUnits || 'mm';
    const outputUnits = testConfig.units?.system || 'mm';
    
    console.log(`Line fileUnits: ${fileUnits}, output: ${outputUnits}`);
    const convertedStartX = dinGenerator.convertCoordinates(line.start.x, fileUnits, outputUnits);
    const convertedStartY = dinGenerator.convertCoordinates(line.start.y, fileUnits, outputUnits);
    console.log(`Original: (${line.start.x}, ${line.start.y}) → Converted: (${convertedStartX}, ${convertedStartY})`);
}

if (arcs.length > 0) {
    console.log('\nArc unit conversion test:');
    const arc = arcs[0];
    const fileUnits = arc.fileUnits || dinGenerator.metadata.fileUnits || 'mm';
    const outputUnits = testConfig.units?.system || 'mm';
    
    console.log(`Arc fileUnits: ${fileUnits}, output: ${outputUnits}`);
    const convertedCenterX = dinGenerator.convertCoordinates(arc.center.x, fileUnits, outputUnits);
    const convertedCenterY = dinGenerator.convertCoordinates(arc.center.y, fileUnits, outputUnits);
    const convertedRadius = dinGenerator.convertCoordinates(Math.abs(arc.radius), fileUnits, outputUnits);
    console.log(`Original center: (${arc.center.x}, ${arc.center.y}) → Converted: (${convertedCenterX}, ${convertedCenterY})`);
    console.log(`Original radius: ${arc.radius} → Converted: ${convertedRadius}`);
}

console.log('\n=== Test Complete ===');