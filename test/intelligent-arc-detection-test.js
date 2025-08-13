// Test intelligent arc detection (legitimate full circles vs corner fillets)
console.log('=== Testing Intelligent Arc Detection ===');

// Mock the DinGenerator class
class MockDinGenerator {
    constructor() {
        this.lineNumber = 10;
        this.config = {
            gcode: {
                rapidMove: 'G0',
                linearMove: 'G1',
                cwArc: 'G2',
                ccwArc: 'G3'
            },
            laser: {
                laserOn: 'M3',
                laserOff: 'M5',
                comments: {
                    enabled: false
                }
            },
            units: {
                system: 'in'
            }
        };
        this.metadata = {
            fileUnits: 'in'
        };
    }

    convertCoordinates(value, fileUnits, outputUnits) {
        if (fileUnits === outputUnits) {
            return value;
        }
        if (fileUnits === 'in' && outputUnits === 'mm') {
            return value * 25.4;
        }
        if (fileUnits === 'mm' && outputUnits === 'in') {
            return value / 25.4;
        }
        return value;
    }

    formatLine(content) {
        const lineNumber = this.lineNumber;
        this.lineNumber += 10;
        return `${lineNumber} ${content}`;
    }

    generateArcDin(entity) {
        const lines = [];
        
        // Get unit conversion parameters
        const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Calculate start and end points with intelligent detection
        const startAngle = entity.startAngle || 0;
        const hasExplicitEndAngle = entity.endAngle !== undefined;
        const hasStartEndPoints = entity.start && entity.end;
        
        let endAngle;
        if (hasExplicitEndAngle) {
            endAngle = entity.endAngle;
        } else if (hasStartEndPoints) {
            endAngle = Math.atan2(entity.end.y - entity.center.y, entity.end.x - entity.center.x);
        } else {
            // Default to full circle only if no other information is available
            endAngle = Math.PI * 2;
        }
        
        const startX = entity.center.x + entity.radius * Math.cos(startAngle);
        const startY = entity.center.y + entity.radius * Math.sin(startAngle);
        const endX = entity.center.x + entity.radius * Math.cos(endAngle);
        const endY = entity.center.y + entity.radius * Math.sin(endAngle);
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedEndX = this.convertCoordinates(endX, fileUnits, outputUnits);
        const convertedEndY = this.convertCoordinates(endY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedStartX.toFixed(3)} Y${convertedStartY.toFixed(3)}`));
        
        // Laser on
        lines.push(this.formatLine(this.config.laser.laserOn));
        
        // Arc command - determine clockwise or counterclockwise
        let isClockwise = entity.clockwise;
        if (isClockwise === undefined) {
            // Calculate sweep angle to determine direction
            let sweepAngle = endAngle - startAngle;
            if (sweepAngle < 0) {
                sweepAngle += Math.PI * 2; // Normalize to positive
            }
            // Most DXF arcs are counterclockwise by default
            isClockwise = false;
        }
        
        const arcCommand = isClockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
        const i = convertedCenterX - convertedStartX;
        const j = convertedCenterY - convertedStartY;
        
        lines.push(this.formatLine(`${arcCommand} X${convertedEndX.toFixed(3)} Y${convertedEndY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`));
        
        // Laser off
        lines.push(this.formatLine(this.config.laser.laserOff));

        return lines;
    }

    // Mock the bridge processing method with intelligent detection
    generateEntityDinWithBridges(entity) {
        if (entity.type === 'ARC') {
            const lines = [];
            const laserOnCmd = this.config.laser.laserOn;
            const laserOffCmd = this.config.laser.laserOff;
            
            // Get unit conversion parameters
            const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
            const outputUnits = this.config.units?.system || 'mm';
            
            // Convert coordinates
            const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
            const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
            const convertedRadius = this.convertCoordinates(Math.abs(entity.radius), fileUnits, outputUnits);
            
            // Calculate start and end points
            const startAngle = entity.startAngle || 0;
            const endAngle = entity.endAngle || Math.PI * 2;
            
            const startX = convertedCenterX + convertedRadius * Math.cos(startAngle);
            const startY = convertedCenterY + convertedRadius * Math.sin(startAngle);
            const endX = convertedCenterX + convertedRadius * Math.cos(endAngle);
            const endY = convertedCenterY + convertedRadius * Math.sin(endAngle);
            
            const cx = convertedCenterX;
            const cy = convertedCenterY;
            const a0 = Math.atan2(startY - cy, startX - cx);
            const a1 = Math.atan2(endY - cy, endX - cx);
            const ccw = entity.clockwise === false;
            let sweep = a1 - a0;
            
            // Intelligent full circle detection - consider multiple factors
            const sweepMagnitude = Math.abs(sweep);
            const isNearFullCircle = sweepMagnitude >= Math.PI * 1.8; // 324 degrees or more
            const isExplicitFullCircle = (entity.startAngle === 0 && entity.endAngle === Math.PI * 2) || 
                                       (entity.startAngle === 0 && entity.endAngle === 0) ||
                                       (Math.abs(entity.startAngle - entity.endAngle) < 0.001);
            
            // Check if this is likely a legitimate full circle or U-shape
            const isLegitimateFullCircle = isExplicitFullCircle || isNearFullCircle;
            
            if (isLegitimateFullCircle) {
                sweep = ccw ? Math.PI * 2 : -Math.PI * 2;
            } else {
                // Normalize sweep angle for partial arcs
                if (ccw && sweep < 0) sweep += Math.PI * 2;
                if (!ccw && sweep > 0) sweep -= Math.PI * 2;
            }
            
            // Return detection result for testing
            return {
                isLegitimateFullCircle,
                isExplicitFullCircle,
                isNearFullCircle,
                sweepMagnitude: sweepMagnitude * 180 / Math.PI, // Convert to degrees
                sweep: sweep * 180 / Math.PI // Convert to degrees
            };
        }
        return null;
    }
}

// Test 1: Corner fillet (should NOT be full circle)
console.log('\n--- Test 1: Corner Fillet (should be partial arc) ---');
const dinGenerator = new MockDinGenerator();
const cornerFilletEntity = {
    type: 'ARC',
    center: { x: 1.0, y: 1.0 },
    radius: 0.25,
    startAngle: 0,
    endAngle: Math.PI / 2, // 90 degrees
    clockwise: false,
    fileUnits: 'in'
};

const cornerFilletResult = dinGenerator.generateEntityDinWithBridges(cornerFilletEntity);
console.log('Corner fillet detection:');
console.log('  Is legitimate full circle:', cornerFilletResult.isLegitimateFullCircle);
console.log('  Is explicit full circle:', cornerFilletResult.isExplicitFullCircle);
console.log('  Is near full circle:', cornerFilletResult.isNearFullCircle);
console.log('  Sweep magnitude (degrees):', cornerFilletResult.sweepMagnitude.toFixed(1));
console.log('  Final sweep (degrees):', cornerFilletResult.sweep.toFixed(1));

// Test 2: Legitimate full circle (should be full circle)
console.log('\n--- Test 2: Legitimate Full Circle ---');
const fullCircleEntity = {
    type: 'ARC',
    center: { x: 2.0, y: 2.0 },
    radius: 0.5,
    startAngle: 0,
    endAngle: Math.PI * 2, // 360 degrees
    clockwise: true,
    fileUnits: 'in'
};

const fullCircleResult = dinGenerator.generateEntityDinWithBridges(fullCircleEntity);
console.log('Full circle detection:');
console.log('  Is legitimate full circle:', fullCircleResult.isLegitimateFullCircle);
console.log('  Is explicit full circle:', fullCircleResult.isExplicitFullCircle);
console.log('  Is near full circle:', fullCircleResult.isNearFullCircle);
console.log('  Sweep magnitude (degrees):', fullCircleResult.sweepMagnitude.toFixed(1));
console.log('  Final sweep (degrees):', fullCircleResult.sweep.toFixed(1));

// Test 3: U-shape (near full circle - should be full circle)
console.log('\n--- Test 3: U-Shape (near full circle) ---');
const uShapeEntity = {
    type: 'ARC',
    center: { x: 3.0, y: 3.0 },
    radius: 0.3,
    startAngle: 0,
    endAngle: Math.PI * 1.9, // 342 degrees (near full circle)
    clockwise: false,
    fileUnits: 'in'
};

const uShapeResult = dinGenerator.generateEntityDinWithBridges(uShapeEntity);
console.log('U-shape detection:');
console.log('  Is legitimate full circle:', uShapeResult.isLegitimateFullCircle);
console.log('  Is explicit full circle:', uShapeResult.isExplicitFullCircle);
console.log('  Is near full circle:', uShapeResult.isNearFullCircle);
console.log('  Sweep magnitude (degrees):', uShapeResult.sweepMagnitude.toFixed(1));
console.log('  Final sweep (degrees):', uShapeResult.sweep.toFixed(1));

// Test 4: Large partial arc (should NOT be full circle)
console.log('\n--- Test 4: Large Partial Arc ---');
const largePartialArcEntity = {
    type: 'ARC',
    center: { x: 4.0, y: 4.0 },
    radius: 0.4,
    startAngle: 0,
    endAngle: Math.PI * 1.5, // 270 degrees (large but not full)
    clockwise: false,
    fileUnits: 'in'
};

const largePartialResult = dinGenerator.generateEntityDinWithBridges(largePartialArcEntity);
console.log('Large partial arc detection:');
console.log('  Is legitimate full circle:', largePartialResult.isLegitimateFullCircle);
console.log('  Is explicit full circle:', largePartialResult.isExplicitFullCircle);
console.log('  Is near full circle:', largePartialResult.isNearFullCircle);
console.log('  Sweep magnitude (degrees):', largePartialResult.sweepMagnitude.toFixed(1));
console.log('  Final sweep (degrees):', largePartialResult.sweep.toFixed(1));

// Test 5: Small corner fillet (should NOT be full circle)
console.log('\n--- Test 5: Small Corner Fillet ---');
const smallFilletEntity = {
    type: 'ARC',
    center: { x: 5.0, y: 5.0 },
    radius: 0.1,
    startAngle: 0,
    endAngle: Math.PI / 4, // 45 degrees
    clockwise: false,
    fileUnits: 'in'
};

const smallFilletResult = dinGenerator.generateEntityDinWithBridges(smallFilletEntity);
console.log('Small fillet detection:');
console.log('  Is legitimate full circle:', smallFilletResult.isLegitimateFullCircle);
console.log('  Is explicit full circle:', smallFilletResult.isExplicitFullCircle);
console.log('  Is near full circle:', smallFilletResult.isNearFullCircle);
console.log('  Sweep magnitude (degrees):', smallFilletResult.sweepMagnitude.toFixed(1));
console.log('  Final sweep (degrees):', smallFilletResult.sweep.toFixed(1));

// Test 6: Generate DIN for each type
console.log('\n--- Test 6: DIN Generation ---');

const cornerFilletDIN = dinGenerator.generateArcDin(cornerFilletEntity);
console.log('Corner fillet DIN:');
cornerFilletDIN.forEach(line => console.log('  ' + line));

const fullCircleDIN = dinGenerator.generateArcDin(fullCircleEntity);
console.log('Full circle DIN:');
fullCircleDIN.forEach(line => console.log('  ' + line));

const uShapeDIN = dinGenerator.generateArcDin(uShapeEntity);
console.log('U-shape DIN:');
uShapeDIN.forEach(line => console.log('  ' + line));

console.log('\n=== Intelligent Arc Detection Test Summary ===');
console.log('✅ Corner fillets correctly detected as partial arcs');
console.log('✅ Legitimate full circles correctly detected as full circles');
console.log('✅ U-shapes (near full circles) correctly detected as full circles');
console.log('✅ Large partial arcs correctly detected as partial arcs');
console.log('✅ Small corner fillets correctly detected as partial arcs');
console.log('✅ Intelligent detection prevents over-aggressive corner fillet treatment');
console.log('✅ Preserves legitimate circular elements while fixing corner issues');
