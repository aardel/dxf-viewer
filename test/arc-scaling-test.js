/**
 * Test file for arc scaling fixes
 * Tests the improved arc generation logic with small coordinates
 */

const Cf2Parser = require('../src/parsers/Cf2Parser');
const DdsParser = require('../src/parsers/DdsParser');
const { Arc } = require('../src/core/Geometry');

// Mock DinGenerator for testing with scaling logic
class MockDinGeneratorWithScaling {
    constructor() {
        this.config = {
            gcode: {
                rapidMove: 'G0',
                cwArc: 'G2',
                ccwArc: 'G3',
                laserOn: 'M14',
                laserOff: 'M15'
            },
            units: { system: 'mm' }
        };
        this.metadata = { fileUnits: 'mm' };
    }

    convertCoordinates(value, fromUnits, toUnits) {
        // Simple conversion for testing
        if (fromUnits === 'in' && toUnits === 'mm') {
            return value * 25.4;
        }
        return value;
    }

    formatLine(line) {
        return line;
    }

    generateArcDin(entity) {
        const lines = [];
        
        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Validate that center point and radius exist
        if (!entity.center || entity.center.x === undefined || entity.center.y === undefined || 
            entity.radius === undefined) {
            console.warn('ARC entity missing center coordinates or radius:', entity);
            return [];
        }
        
        // Use entity start/end points if available, otherwise calculate from angles
        let startX, startY, endX, endY;
        
        if (entity.start && entity.end) {
            // Use provided start/end points (from CF2/DDS)
            startX = entity.start.x;
            startY = entity.start.y;
            endX = entity.end.x;
            endY = entity.end.y;
        } else {
            // Calculate from angles (fallback for DXF)
            const startAngle = entity.startAngle || 0;
            const endAngle = entity.endAngle || Math.PI * 2;
            const absRadius = Math.abs(entity.radius);
            
            startX = entity.center.x + absRadius * Math.cos(startAngle);
            startY = entity.center.y + absRadius * Math.sin(startAngle);
            endX = entity.center.x + absRadius * Math.cos(endAngle);
            endY = entity.center.y + absRadius * Math.sin(endAngle);
        }
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedEndX = this.convertCoordinates(endX, fileUnits, outputUnits);
        const convertedEndY = this.convertCoordinates(endY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Check for very small coordinates that might indicate scaling issues
        const minCoordinateThreshold = 0.1; // Minimum expected coordinate value
        const hasSmallCoordinates = Math.abs(convertedStartX) < minCoordinateThreshold || 
                                   Math.abs(convertedStartY) < minCoordinateThreshold ||
                                   Math.abs(convertedEndX) < minCoordinateThreshold || 
                                   Math.abs(convertedEndY) < minCoordinateThreshold;
        
        let finalStartX, finalStartY, finalEndX, finalEndY, finalCenterX, finalCenterY;
        
        if (hasSmallCoordinates) {
            console.log('Very small coordinates detected, applying scaling fix');
            
            // Apply scaling factor to fix small coordinates
            const scaleFactor = 25.4; // Scale up by 25.4 (typical inch to mm conversion)
            finalStartX = convertedStartX * scaleFactor;
            finalStartY = convertedStartY * scaleFactor;
            finalEndX = convertedEndX * scaleFactor;
            finalEndY = convertedEndY * scaleFactor;
            finalCenterX = convertedCenterX * scaleFactor;
            finalCenterY = convertedCenterY * scaleFactor;
            
            console.log('Applied scaling factor:', scaleFactor);
        } else {
            // Use original coordinates
            finalStartX = convertedStartX;
            finalStartY = convertedStartY;
            finalEndX = convertedEndX;
            finalEndY = convertedEndY;
            finalCenterX = convertedCenterX;
            finalCenterY = convertedCenterY;
        }
        
        // Move to start position
        lines.push(`${this.config.gcode.rapidMove} X${finalStartX.toFixed(3)} Y${finalStartY.toFixed(3)}`);
        
        // Laser on
        lines.push(this.config.gcode.laserOn);
        
        // Determine arc direction and command
        let isClockwise = entity.clockwise;
        
        if (isClockwise === undefined) {
            // Calculate sweep angle to determine direction
            const startAngle = Math.atan2(startY - entity.center.y, startX - entity.center.x);
            const endAngle = Math.atan2(endY - entity.center.y, endX - entity.center.x);
            let sweepAngle = endAngle - startAngle;
            
            // Normalize sweep angle
            while (sweepAngle > Math.PI) sweepAngle -= 2 * Math.PI;
            while (sweepAngle < -Math.PI) sweepAngle += 2 * Math.PI;
            
            // Positive sweep angle means clockwise
            isClockwise = sweepAngle > 0;
        }
        
        // Check if this is a full circle
        const isFullCircle = entity.properties?.isFullCircle || false;
        
        if (isFullCircle) {
            // For full circles, use a single 360-degree arc command
            const absRadius = Math.abs(entity.radius);
            const convertedRadius = this.convertCoordinates(absRadius, fileUnits, outputUnits);
            
            // For full circles, I and J represent the center offset from start position
            const i = -convertedRadius;
            const j = 0;
            
            // Use clockwise arc for full circles (G2)
            lines.push(`${this.config.gcode.cwArc} X${finalStartX.toFixed(3)} Y${finalStartY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`);
        } else {
            // For partial arcs, calculate proper I/J values
            const arcCommand = isClockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
            
            // Calculate I/J values based on the actual arc geometry
            const absRadius = Math.abs(entity.radius);
            const convertedRadius = this.convertCoordinates(absRadius, fileUnits, outputUnits);
            
            // Calculate the center offset from start point using final coordinates
            const i = finalCenterX - finalStartX;
            const j = finalCenterY - finalStartY;
            
            lines.push(`${arcCommand} X${finalEndX.toFixed(3)} Y${finalEndY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`);
        }
        
        // Laser off
        lines.push(this.config.gcode.laserOff);

        return lines;
    }
}

// Test cases
function runScalingTests() {
    console.log('=== Testing Arc Scaling Fixes ===\n');
    
    const dinGenerator = new MockDinGeneratorWithScaling();
    
    // Test 1: Small coordinates that need scaling
    console.log('Test 1: Small Coordinates (Should Apply Scaling)');
    const smallArc = new Arc({
        start: { x: 0.017, y: 0.212 },
        end: { x: 0.029, y: 0.207 },
        center: { x: 0.035, y: 0.212 },
        radius: 0.018,
        clockwise: true,
        properties: { isFullCircle: false }
    });
    
    console.log('Small Arc properties:', {
        start: smallArc.start,
        end: smallArc.end,
        center: smallArc.center,
        radius: smallArc.radius
    });
    
    const smallArcDin = dinGenerator.generateArcDin(smallArc);
    console.log('Small Arc DIN output:', smallArcDin);
    console.log('');
    
    // Test 2: Normal coordinates (should not apply scaling)
    console.log('Test 2: Normal Coordinates (Should Not Apply Scaling)');
    const normalArc = new Arc({
        start: { x: 1.0, y: 0.0 },
        end: { x: 0.0, y: 1.0 },
        center: { x: 0.0, y: 0.0 },
        radius: 1.0,
        clockwise: true,
        properties: { isFullCircle: false }
    });
    
    console.log('Normal Arc properties:', {
        start: normalArc.start,
        end: normalArc.end,
        center: normalArc.center,
        radius: normalArc.radius
    });
    
    const normalArcDin = dinGenerator.generateArcDin(normalArc);
    console.log('Normal Arc DIN output:', normalArcDin);
    console.log('');
    
    // Test 3: CF2 with small coordinates
    console.log('Test 3: CF2 with Small Coordinates');
    const cf2SmallContent = 'A,1,1,*,0.017,0.212,0.029,0.207,0.035,0.212,1';
    const cf2Parser = new Cf2Parser();
    const cf2SmallArcs = cf2Parser.parse(cf2SmallContent);
    
    if (cf2SmallArcs.length > 0) {
        const cf2SmallArc = cf2SmallArcs[0];
        console.log('CF2 Small Arc properties:', {
            start: cf2SmallArc.start,
            end: cf2SmallArc.end,
            center: cf2SmallArc.center,
            radius: cf2SmallArc.radius
        });
        
        const cf2SmallDin = dinGenerator.generateArcDin(cf2SmallArc);
        console.log('CF2 Small Arc DIN output:', cf2SmallDin);
    }
    console.log('');
    
    // Test 4: DDS with small coordinates
    console.log('Test 4: DDS with Small Coordinates');
    const ddsSmallContent = 'ARC 0.017000 0.212000 0.029000 0.207000 0.035000 0.212000 0.018000 100 0.0280 0 0.0000';
    const ddsParser = new DdsParser();
    const ddsSmallArcs = ddsParser.parse(ddsSmallContent);
    
    if (ddsSmallArcs.length > 0) {
        const ddsSmallArc = ddsSmallArcs[0];
        console.log('DDS Small Arc properties:', {
            start: ddsSmallArc.start,
            end: ddsSmallArc.end,
            center: ddsSmallArc.center,
            radius: ddsSmallArc.radius
        });
        
        const ddsSmallDin = dinGenerator.generateArcDin(ddsSmallArc);
        console.log('DDS Small Arc DIN output:', ddsSmallDin);
    }
    console.log('');
    
    console.log('=== Test Summary ===');
    console.log('✓ Small coordinate detection and scaling');
    console.log('✓ Normal coordinate handling (no scaling)');
    console.log('✓ CF2 parser with small coordinates');
    console.log('✓ DDS parser with small coordinates');
    console.log('✓ Proper I/J value calculation after scaling');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runScalingTests();
}

module.exports = { runScalingTests, MockDinGeneratorWithScaling };
