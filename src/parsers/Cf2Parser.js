// CF2/CFF2 Parser: Converts CF2/CFF2 file content to unified geometry objects
const { Line, Arc } = require('../core/Geometry');

class Cf2Parser {
    constructor(options = {}) {
        // CF2 files: No Y-axis inversion needed since rendering system handles coordinate transformation
        this.invertY = false; // Always false - rendering system handles Y-axis flipping
        this.boundingBox = null;
    }

    /**
     * Parse CF2/CFF2 file content (string) into unified geometry objects
     * Expected format (per CAD VIEWER implementation):
     * - LL,x,y          → lower-left of bounding box (optional)
     * - UR,x,y          → upper-right of bounding box (optional)
     * - L,pen,layer,*,x1,y1,x2,y2[,bridgeCount,bridgeWidth]
     * - A,pen,layer,*,x1,y1,x2,y2,cx,cy,dir[,bridgeCount,bridgeWidth]
     * Notes:
     * - pen is in points (pt). We store as kerfWidth in points for now
     * - dir: -1 indicates CCW (negative radius); any other value indicates CW (positive radius)
     * @param {string} content
     * @returns {Array<Line|Arc>}
     */
    parse(content) {
        if (!content || typeof content !== 'string') return [];

        const lines = content.split(/\r?\n/);
        const geometries = [];

        // First pass: extract bounding box (for reference only)
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());
            const type = parts[0];

            if (type === 'LL' && parts.length >= 3) {
                // Lower-left of bounding box
                if (!this.boundingBox) this.boundingBox = {};
                this.boundingBox.minX = parseFloat(parts[1]);
                this.boundingBox.minY = parseFloat(parts[2]);
            } else if (type === 'UR' && parts.length >= 3) {
                // Upper-right of bounding box  
                if (!this.boundingBox) this.boundingBox = {};
                this.boundingBox.maxX = parseFloat(parts[1]);
                this.boundingBox.maxY = parseFloat(parts[2]);
            }
        }

        // Second pass: parse geometry without coordinate transformation
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const parts = line.split(',').map(p => p.trim());
            const type = parts[0];

            if (type === 'L') {
                // L,pen,layer,*,x1,y1,x2,y2[,bridgeCount,bridgeWidth]
                if (parts.length >= 8) {
                    const pen = parts[1];
                    const layer = parts[2];
                    const x1 = parseFloat(parts[4]);
                    const y1 = parseFloat(parts[5]);
                    const x2 = parseFloat(parts[6]);
                    const y2 = parseFloat(parts[7]);
                    const bridgeCount = parts[8] !== undefined ? parseInt(parts[8], 10) : 0;
                    const bridgeWidth = parts[9] !== undefined ? parseFloat(parts[9]) : 0;

                    geometries.push(new Line({
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                        layer: `${pen}-${layer}`,
                        color: null,
                        kerfWidth: isFinite(Number(pen)) ? Number(pen) : null, // store pen (pt) as kerfWidth for now
                        bridgeCount: isFinite(bridgeCount) ? bridgeCount : 0,
                        bridgeWidth: isFinite(bridgeWidth) ? bridgeWidth : 0,
                        fileUnits: 'in', // CF2 files are typically in inches
                        properties: { 
                            pen, 
                            cff2Layer: layer,
                            unitCode: 'in' // Keep for backward compatibility
                        }
                    }));
                }
            } else if (type === 'A') {
                // A,pen,layer,*,x1,y1,x2,y2,cx,cy,dir[,bridgeCount,bridgeWidth]
                if (parts.length >= 11) {
                    const pen = parts[1];
                    const layer = parts[2];
                    const x1 = parseFloat(parts[4]);
                    const y1 = parseFloat(parts[5]);
                    const x2 = parseFloat(parts[6]);
                    const y2 = parseFloat(parts[7]);
                    const cx = parseFloat(parts[8]);
                    const cy = parseFloat(parts[9]);
                    const dir = parseInt(parts[10], 10); // -1 = CCW, else = CW
                    const bridgeCount = parts[11] !== undefined ? parseInt(parts[11], 10) : 0;
                    const bridgeWidth = parts[12] !== undefined ? parseFloat(parts[12]) : 0;

                    // Calculate radius and validate
                    const rUnsigned = Math.hypot(x1 - cx, y1 - cy);
                    if (rUnsigned === 0) {
                        console.warn('CF2: Zero radius arc detected, skipping:', parts);
                        continue;
                    }

                    // Determine arc properties
                    const startAngle = Math.atan2(y1 - cy, x1 - cx);
                    const endAngle = Math.atan2(y2 - cy, x2 - cx);
                    
                    // Calculate sweep angle and normalize
                    let sweepAngle = endAngle - startAngle;
                    
                    // Normalize sweep angle based on direction
                    if (dir === -1) {
                        // CCW direction
                        while (sweepAngle >= 0) sweepAngle -= 2 * Math.PI;
                        while (sweepAngle < -2 * Math.PI) sweepAngle += 2 * Math.PI;
                    } else {
                        // CW direction
                        while (sweepAngle <= 0) sweepAngle += 2 * Math.PI;
                        while (sweepAngle > 2 * Math.PI) sweepAngle -= 2 * Math.PI;
                    }
                    
                    // Check if this is effectively a full circle
                    const isFullCircle = Math.abs(Math.abs(sweepAngle) - 2 * Math.PI) < 0.01;
                    
                    // Determine clockwise direction for DIN generation
                    // CF2 dir=-1 means CCW, so clockwise=false
                    // CF2 dir≠-1 means CW, so clockwise=true
                    const clockwise = (dir !== -1);
                    
                    // Use signed radius for consistency with DDS format
                    const signedRadius = clockwise ? rUnsigned : -rUnsigned;

                    geometries.push(new Arc({
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                        center: { x: cx, y: cy },
                        radius: signedRadius,
                        clockwise,
                        startAngle: startAngle,
                        endAngle: endAngle,
                        layer: `${pen}-${layer}`,
                        color: null,
                        kerfWidth: isFinite(Number(pen)) ? Number(pen) : null, // pen (pt)
                        bridgeCount: isFinite(bridgeCount) ? bridgeCount : 0,
                        bridgeWidth: isFinite(bridgeWidth) ? bridgeWidth : 0,
                        fileUnits: 'in', // CF2 files are typically in inches
                        properties: { 
                            pen, 
                            cff2Layer: layer, 
                            dir,
                            sweepAngle,
                            isFullCircle,
                            unitCode: 'in' // Keep for backward compatibility
                        }
                    }));
                }
            } else if (type === 'LL' || type === 'UR') {
                // Bounding box hints are ignored at geometry level; renderer can compute bounds
                continue;
            } else {
                // Unknown/unsupported record; ignore
                continue;
            }
        }

        return geometries;
    }
}

module.exports = Cf2Parser;
