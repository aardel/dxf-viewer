// Test CF2 and DDS unit conversion
const Cf2Parser = require('../src/parsers/Cf2Parser');
const DdsParser = require('../src/parsers/DdsParser');
const { DinGenerator } = require('../src/DinGenerator.js');

// Test CF2 parser unit handling
console.log('=== Testing CF2 Parser ===');
const cf2Content = `L,1,SHEET,*,1.0,2.0,3.0,4.0
A,2,SHEET,*,5.0,6.0,7.0,8.0,9.0,10.0,-1`;

const cf2Parser = new Cf2Parser();
const cf2Entities = cf2Parser.parse(cf2Content);
console.log('CF2 entities count:', cf2Entities.length);
console.log('CF2 Line entity fileUnits:', cf2Entities[0].fileUnits);
console.log('CF2 Arc entity fileUnits:', cf2Entities[1].fileUnits);

// Test DDS parser unit handling
console.log('\n=== Testing DDS Parser ===');
const ddsContent = `LINE 1.0 2.0 3.0 4.0 0 0.050 0 0.0
ARC 5.0 6.0 7.0 8.0 9.0 10.0 2.0 0 0.050 0 0.0`;

const ddsParser = new DdsParser();
const ddsEntities = ddsParser.parse(ddsContent);
console.log('DDS entities count:', ddsEntities.length);
console.log('DDS Line entity fileUnits:', ddsEntities[0].fileUnits);
console.log('DDS Arc entity fileUnits:', ddsEntities[1].fileUnits);

// Test unit conversion in DinGenerator
console.log('\n=== Testing DinGenerator Conversion ===');
const dinGenerator = new DinGenerator();

// Test conversion function directly
const inchesToMm = dinGenerator.convertCoordinates(1, 'in', 'mm');
const mmToInches = dinGenerator.convertCoordinates(25.4, 'mm', 'in');
const noConversion = dinGenerator.convertCoordinates(10, 'mm', 'mm');

console.log('1 inch to mm:', inchesToMm, '(should be 25.4)');
console.log('25.4 mm to inches:', mmToInches, '(should be 1)');
console.log('10 mm to mm:', noConversion, '(should be 10)');

// Test with actual CF2 entities (inches to mm)
console.log('\n=== Testing CF2 to MM Conversion ===');
const testConfig = {
    units: { system: 'mm' },
    gcode: { rapidMove: 'G0', linearMove: 'G1' },
    laser: { laserOn: 'M3', laserOff: 'M5' },
    lineNumbers: { enabled: true, increment: 10 }
};

dinGenerator.config = testConfig;
dinGenerator.metadata = { fileUnits: 'mm' }; // This should be overridden by entity.fileUnits

const cf2LineEntity = cf2Entities[0]; // This has fileUnits: 'in'
console.log('CF2 Line original coordinates:', cf2LineEntity.start, 'to', cf2LineEntity.end);

// Simulate what generateLineDin would do
const fileUnits = cf2LineEntity.fileUnits || dinGenerator.metadata.fileUnits || 'mm';
const outputUnits = testConfig.units?.system || 'mm';
console.log('Detected units - File:', fileUnits, 'Output:', outputUnits);

const convertedStartX = dinGenerator.convertCoordinates(cf2LineEntity.start.x, fileUnits, outputUnits);
const convertedStartY = dinGenerator.convertCoordinates(cf2LineEntity.start.y, fileUnits, outputUnits);
const convertedEndX = dinGenerator.convertCoordinates(cf2LineEntity.end.x, fileUnits, outputUnits);
const convertedEndY = dinGenerator.convertCoordinates(cf2LineEntity.end.y, fileUnits, outputUnits);

console.log('Converted coordinates:');
console.log(`Start: ${cf2LineEntity.start.x}" → ${convertedStartX}mm, ${cf2LineEntity.start.y}" → ${convertedStartY}mm`);
console.log(`End: ${cf2LineEntity.end.x}" → ${convertedEndX}mm, ${cf2LineEntity.end.y}" → ${convertedEndY}mm`);

console.log('\n=== Test Complete ===');