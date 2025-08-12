// CF2/CFF2 Parser: Converts CF2/CFF2 file content to unified geometry objects
const { Line, Arc } = require('../core/Geometry');

class Cf2Parser {
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
                        properties: { pen, cff2Layer: layer }
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

                    const rUnsigned = Math.hypot(x1 - cx, y1 - cy);
                    const signedRadius = (dir === -1 ? -rUnsigned : rUnsigned);
                    const clockwise = signedRadius >= 0; // match DDS parser convention

                    geometries.push(new Arc({
                        start: { x: x1, y: y1 },
                        end: { x: x2, y: y2 },
                        center: { x: cx, y: cy },
                        radius: signedRadius,
                        clockwise,
                        layer: `${pen}-${layer}`,
                        color: null,
                        kerfWidth: isFinite(Number(pen)) ? Number(pen) : null, // pen (pt)
                        bridgeCount: isFinite(bridgeCount) ? bridgeCount : 0,
                        bridgeWidth: isFinite(bridgeWidth) ? bridgeWidth : 0,
                        properties: { pen, cff2Layer: layer, dir }
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
