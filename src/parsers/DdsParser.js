// DDS Parser: Converts DDS file content to unified geometry objects
const { Line, Arc } = require('../core/Geometry');

class DdsParser {
    /**
     * Parse DDS file content (string) into unified geometry objects
     * @param {string} content
     * @returns {Array} Array of geometry objects (Line, Arc, etc.)
     */
    parse(content) {
        const lines = content.split(/\r?\n/);
        const geometries = [];
        const widths = [];
        
        for (const line of lines) {
            const tokens = line.trim().split(/\s+/);
            if (tokens[0] === 'LINE' && tokens.length >= 9) {
                const rawKerf = tokens[6];
                const kerfNum = parseFloat(rawKerf);
                if (!Number.isNaN(kerfNum) && kerfNum > 0) widths.push(kerfNum);
                const line = new Line({
                    start: { x: parseFloat(tokens[1]), y: parseFloat(tokens[2]) },
                    end: { x: parseFloat(tokens[3]), y: parseFloat(tokens[4]) },
                    color: parseInt(tokens[5]),
                    kerfWidth: kerfNum,
                    bridgeCount: parseInt(tokens[7]),
                    bridgeWidth: parseFloat(tokens[8]),
                    properties: { rawKerf }
                });
                geometries.push(line);
            } else if (tokens[0] === 'ARC' && tokens.length >= 12) {
                const rawKerf = tokens[9];
                const kerfNum = parseFloat(rawKerf);
                if (!Number.isNaN(kerfNum) && kerfNum > 0) widths.push(kerfNum);
                
                const startX = parseFloat(tokens[1]);
                const startY = parseFloat(tokens[2]);
                const endX = parseFloat(tokens[3]);
                const endY = parseFloat(tokens[4]);
                const centerX = parseFloat(tokens[5]);
                const centerY = parseFloat(tokens[6]);
                const radius = parseFloat(tokens[7]);
                
                // Validate radius
                if (radius === 0) {
                    console.warn('DDS: Zero radius arc detected, skipping:', tokens);
                    continue;
                }
                
                // Calculate start and end angles
                const startAngle = Math.atan2(startY - centerY, startX - centerX);
                const endAngle = Math.atan2(endY - centerY, endX - centerX);
                
                // Calculate sweep angle and normalize
                let sweepAngle = endAngle - startAngle;
                
                // Normalize sweep angle based on direction
                if (radius < 0) {
                    // CCW direction (negative radius)
                    while (sweepAngle >= 0) sweepAngle -= 2 * Math.PI;
                    while (sweepAngle < -2 * Math.PI) sweepAngle += 2 * Math.PI;
                } else {
                    // CW direction (positive radius)
                    while (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
                    while (sweepAngle > 2 * Math.PI) sweepAngle -= 2 * Math.PI;
                }
                
                // Check if this is effectively a full circle
                const isFullCircle = Math.abs(Math.abs(sweepAngle) - 2 * Math.PI) < 0.01;
                
                // Determine clockwise direction for DIN generation
                // DDS negative radius means CCW, so clockwise=false
                // DDS positive radius means CW, so clockwise=true
                const clockwise = (radius >= 0);
                
                const arc = new Arc({
                    start: { x: startX, y: startY },
                    end: { x: endX, y: endY },
                    center: { x: centerX, y: centerY },
                    radius: radius,
                    color: parseInt(tokens[8]),
                    kerfWidth: kerfNum,
                    bridgeCount: parseInt(tokens[10]),
                    bridgeWidth: parseFloat(tokens[11]),
                    clockwise: clockwise,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    properties: { 
                        rawKerf,
                        sweepAngle,
                        isFullCircle
                    }
                });
                geometries.push(arc);
            }
            // Ignore unsupported or malformed lines
        }
        
        // Detect units from median width (heuristic for 1–6 pt)
        let unitCode = 'unknown';
        if (widths.length) {
            const sorted = widths.slice().sort((a,b)=>a-b);
            const mid = Math.floor(sorted.length/2);
            const median = sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
            if (median >= 0.011 && median <= 0.095) unitCode = 'in';
            else if (median >= 0.30 && median <= 2.20) unitCode = 'mm';
        }
        
        // Attach unitCode to all geometries
        for (const g of geometries) {
            if (!g.properties) g.properties = {};
            g.properties.unitCode = unitCode;
            // Set fileUnits property directly for DinGenerator compatibility
            g.fileUnits = unitCode;
        }
        
        return geometries;
    }
}

module.exports = DdsParser;
