/**
 * Renderer-Based DIN Generator
 * 
 * This module leverages the successful geometry processing logic from the renderer
 * to generate correct DIN files. The renderer successfully draws DDS and CFF2 formats
 * on canvas, so we extract that logic and apply it to DIN generation.
 */

class RendererBasedDinGenerator {
    constructor() {
        this.lineNumber = 10;
        this.currentTool = null;
        this.config = null;
        this.metadata = null;
    }

    /**
     * Generate DIN file content from unified geometry objects
     * @param {Array} geometries - Unified geometry objects from renderer
     * @param {Object} config - Postprocessor configuration
     * @param {Object} metadata - File metadata
     * @returns {String} DIN file content
     */
    generateDin(geometries, config, metadata = {}) {
        console.log('🔥 RendererBasedDinGenerator.generateDin() called');
        console.log('Processing', geometries.length, 'geometries');
        
        this.config = config;
        this.metadata = metadata;
        this.lineNumber = config.lineNumbers?.startNumber || 10;
        this.currentTool = null;

        // Get unit information
        const fileUnits = metadata.fileUnits || 'mm';
        const outputUnits = config.units?.system || 'mm';
        
        console.log(`File units: ${fileUnits}, Output units: ${outputUnits}`);

        const dinLines = [];
        
        // Add header
        dinLines.push(...this.generateHeader(metadata));
        
        // Process each geometry using renderer logic
        for (const geom of geometries) {
            const dinCommands = this.processGeometry(geom, fileUnits, outputUnits);
            dinLines.push(...dinCommands);
        }
        
        // Add footer
        dinLines.push(...this.generateFooter(metadata));
        
        return dinLines.join('\n');
    }

    /**
     * Process a single geometry object using renderer logic
     */
    processGeometry(geom, fileUnits, outputUnits) {
        const commands = [];
        
        // Convert coordinates from file units to output units
        const convertCoord = (value) => this.convertCoordinates(value, fileUnits, outputUnits);
        
        switch (geom.type) {
            case 'LINE':
                commands.push(...this.processLine(geom, convertCoord));
                break;
            case 'ARC':
                commands.push(...this.processArc(geom, convertCoord));
                break;
            default:
                console.warn(`Unsupported geometry type: ${geom.type}`);
                break;
        }
        
        return commands;
    }

    /**
     * Process a LINE geometry using renderer logic
     */
    processLine(geom, convertCoord) {
        const commands = [];
        
        // Convert coordinates
        const startX = convertCoord(geom.start.x);
        const startY = convertCoord(geom.start.y);
        const endX = convertCoord(geom.end.x);
        const endY = convertCoord(geom.end.y);
        
        // Move to start point
        commands.push(`${this.lineNumber} G00 X${startX.toFixed(4)} Y${startY.toFixed(4)}`);
        this.lineNumber += 10;
        
        // Check if this line has bridges
        if (geom.bridgeCount && geom.bridgeWidth) {
            // Process line with bridges
            commands.push(...this.processLineWithBridges(geom, convertCoord));
        } else {
            // Simple line cut
            commands.push(`${this.lineNumber} G01 X${endX.toFixed(4)} Y${endY.toFixed(4)}`);
            this.lineNumber += 10;
        }
        
        return commands;
    }

    /**
     * Process a LINE geometry with bridges
     */
    processLineWithBridges(geom, convertCoord) {
        const commands = [];
        
        const startX = convertCoord(geom.start.x);
        const startY = convertCoord(geom.start.y);
        const endX = convertCoord(geom.end.x);
        const endY = convertCoord(geom.end.y);
        
        // Calculate line length and direction
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return commands;
        
        const bridgeCount = geom.bridgeCount;
        const bridgeWidth = convertCoord(geom.bridgeWidth);
        
        // Calculate segment length (total length minus bridges)
        const totalBridgeLength = bridgeCount * bridgeWidth;
        const segmentLength = (length - totalBridgeLength) / (bridgeCount + 1);
        
        if (segmentLength <= 0) {
            // If bridges are too wide, just cut the line normally
            commands.push(`${this.lineNumber} G01 X${endX.toFixed(4)} Y${endY.toFixed(4)}`);
            this.lineNumber += 10;
            return commands;
        }
        
        // Calculate unit vector
        const unitX = dx / length;
        const unitY = dy / length;
        
        let currentX = startX;
        let currentY = startY;
        
        // Cut segments with bridges
        for (let i = 0; i <= bridgeCount; i++) {
            // Cut segment
            const segmentEndX = currentX + unitX * segmentLength;
            const segmentEndY = currentY + unitY * segmentLength;
            
            commands.push(`${this.lineNumber} G01 X${segmentEndX.toFixed(4)} Y${segmentEndY.toFixed(4)}`);
            this.lineNumber += 10;
            
            // Move to next segment start (bridge gap)
            if (i < bridgeCount) {
                const nextStartX = segmentEndX + unitX * bridgeWidth;
                const nextStartY = segmentEndY + unitY * bridgeWidth;
                
                commands.push(`${this.lineNumber} G00 X${nextStartX.toFixed(4)} Y${nextStartY.toFixed(4)}`);
                this.lineNumber += 10;
                
                currentX = nextStartX;
                currentY = nextStartY;
            }
        }
        
        return commands;
    }

    /**
     * Process an ARC geometry using renderer logic
     */
    processArc(geom, convertCoord) {
        const commands = [];
        
        // Convert coordinates
        const centerX = convertCoord(geom.center.x);
        const centerY = convertCoord(geom.center.y);
        const startX = convertCoord(geom.start.x);
        const startY = convertCoord(geom.start.y);
        const endX = convertCoord(geom.end.x);
        const endY = convertCoord(geom.end.y);
        const radius = convertCoord(geom.radius);
        
        // Calculate start and end angles (like renderer does)
        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const endAngle = Math.atan2(endY - centerY, endX - centerX);
        
        // Check if this is a full circle (like renderer logic)
        const isFullCircle = Math.abs(startX - endX) < 1e-6 && Math.abs(startY - endY) < 1e-6;
        
        // Move to start point
        commands.push(`${this.lineNumber} G00 X${startX.toFixed(4)} Y${startY.toFixed(4)}`);
        this.lineNumber += 10;
        
        if (isFullCircle) {
            // Full circle
            commands.push(`${this.lineNumber} G02 X${startX.toFixed(4)} Y${startY.toFixed(4)} I${(centerX - startX).toFixed(4)} J${(centerY - startY).toFixed(4)}`);
            this.lineNumber += 10;
        } else {
            // Check if this arc has bridges
            if (geom.bridgeCount && geom.bridgeWidth) {
                commands.push(...this.processArcWithBridges(geom, convertCoord));
            } else {
                // Simple arc
                commands.push(`${this.lineNumber} G02 X${endX.toFixed(4)} Y${endY.toFixed(4)} I${(centerX - startX).toFixed(4)} J${(centerY - startY).toFixed(4)}`);
                this.lineNumber += 10;
            }
        }
        
        return commands;
    }

    /**
     * Process an ARC geometry with bridges
     */
    processArcWithBridges(geom, convertCoord) {
        const commands = [];
        
        const centerX = convertCoord(geom.center.x);
        const centerY = convertCoord(geom.center.y);
        const startX = convertCoord(geom.start.x);
        const startY = convertCoord(geom.start.y);
        const endX = convertCoord(geom.end.x);
        const endY = convertCoord(geom.end.y);
        const radius = convertCoord(geom.radius);
        
        // Calculate start and end angles
        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const endAngle = Math.atan2(endY - centerY, endX - centerX);
        
        // Normalize angles
        let normalizedEndAngle = endAngle;
        if (normalizedEndAngle <= startAngle) {
            normalizedEndAngle += 2 * Math.PI;
        }
        
        const totalAngle = normalizedEndAngle - startAngle;
        const bridgeCount = geom.bridgeCount;
        const bridgeAngle = convertCoord(geom.bridgeWidth) / radius; // Convert bridge width to angle
        
        // Calculate segment angle
        const totalBridgeAngle = bridgeCount * bridgeAngle;
        const segmentAngle = (totalAngle - totalBridgeAngle) / (bridgeCount + 1);
        
        if (segmentAngle <= 0) {
            // If bridges are too wide, just cut the arc normally
            commands.push(`${this.lineNumber} G02 X${endX.toFixed(4)} Y${endY.toFixed(4)} I${(centerX - startX).toFixed(4)} J${(centerY - startY).toFixed(4)}`);
            this.lineNumber += 10;
            return commands;
        }
        
        let currentAngle = startAngle;
        
        // Cut arc segments with bridges
        for (let i = 0; i <= bridgeCount; i++) {
            // Calculate segment end angle
            const segmentEndAngle = currentAngle + segmentAngle;
            
            // Calculate segment end point
            const segmentEndX = centerX + radius * Math.cos(segmentEndAngle);
            const segmentEndY = centerY + radius * Math.sin(segmentEndAngle);
            
            // Cut arc segment
            commands.push(`${this.lineNumber} G02 X${segmentEndX.toFixed(4)} Y${segmentEndY.toFixed(4)} I${(centerX - (centerX + radius * Math.cos(currentAngle))).toFixed(4)} J${(centerY - (centerY + radius * Math.sin(currentAngle))).toFixed(4)}`);
            this.lineNumber += 10;
            
            // Move to next segment start (bridge gap)
            if (i < bridgeCount) {
                const nextStartAngle = segmentEndAngle + bridgeAngle;
                const nextStartX = centerX + radius * Math.cos(nextStartAngle);
                const nextStartY = centerY + radius * Math.sin(nextStartAngle);
                
                commands.push(`${this.lineNumber} G00 X${nextStartX.toFixed(4)} Y${nextStartY.toFixed(4)}`);
                this.lineNumber += 10;
                
                currentAngle = nextStartAngle;
            }
        }
        
        return commands;
    }

    /**
     * Convert coordinates from file units to output units
     */
    convertCoordinates(value, fileUnits, outputUnits) {
        // If units are the same, no conversion needed
        if (fileUnits === outputUnits) {
            return value;
        }

        // Convert to mm first (internal standard)
        let valueInMm = value;
        switch (fileUnits) {
            case 'in':
                valueInMm = value * 25.4;
                break;
            case 'ft':
                valueInMm = value * 304.8;
                break;
            case 'pt':
                valueInMm = value * 0.3527777778;
                break;
            case 'cm':
                valueInMm = value * 10;
                break;
            case 'm':
                valueInMm = value * 1000;
                break;
            case 'mm':
            default:
                valueInMm = value;
                break;
        }

        // Convert from mm to output units
        switch (outputUnits) {
            case 'in':
                return valueInMm / 25.4;
            case 'ft':
                return valueInMm / 304.8;
            case 'pt':
                return valueInMm / 0.3527777778;
            case 'cm':
                return valueInMm / 10;
            case 'm':
                return valueInMm / 1000;
            case 'mm':
            default:
                return valueInMm;
        }
    }

    /**
     * Generate DIN header
     */
    generateHeader(metadata) {
        const lines = [];
        
        // Basic header
        lines.push('(DIN file generated by RendererBasedDinGenerator)');
        lines.push('(File: ' + (metadata.filename || 'unknown') + ')');
        lines.push('(Units: ' + (this.config.units?.system || 'mm') + ')');
        lines.push('');
        
        // Program start
        lines.push(`${this.lineNumber} G21`); // Metric units
        this.lineNumber += 10;
        lines.push(`${this.lineNumber} G90`); // Absolute positioning
        this.lineNumber += 10;
        lines.push(`${this.lineNumber} G00 Z5.0000`); // Rapid to safe height
        this.lineNumber += 10;
        
        return lines;
    }

    /**
     * Generate DIN footer
     */
    generateFooter(metadata) {
        const lines = [];
        
        // Program end
        lines.push(`${this.lineNumber} G00 Z5.0000`); // Rapid to safe height
        this.lineNumber += 10;
        lines.push(`${this.lineNumber} G00 X0.0000 Y0.0000`); // Return to origin
        this.lineNumber += 10;
        lines.push(`${this.lineNumber} M30`); // Program end
        this.lineNumber += 10;
        
        return lines;
    }
}

module.exports = { RendererBasedDinGenerator };
