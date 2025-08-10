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
                geometries.push(new Line({
                    start: { x: parseFloat(tokens[1]), y: parseFloat(tokens[2]) },
                    end: { x: parseFloat(tokens[3]), y: parseFloat(tokens[4]) },
                    color: parseInt(tokens[5]),
                    kerfWidth: kerfNum,
                    bridgeCount: parseInt(tokens[7]),
                    bridgeWidth: parseFloat(tokens[8]),
                    properties: { rawKerf }
                }));
            } else if (tokens[0] === 'ARC' && tokens.length >= 12) {
                const rawKerf = tokens[9];
                const kerfNum = parseFloat(rawKerf);
                if (!Number.isNaN(kerfNum) && kerfNum > 0) widths.push(kerfNum);
                geometries.push(new Arc({
                    start: { x: parseFloat(tokens[1]), y: parseFloat(tokens[2]) },
                    end: { x: parseFloat(tokens[3]), y: parseFloat(tokens[4]) },
                    center: { x: parseFloat(tokens[5]), y: parseFloat(tokens[6]) },
                    radius: parseFloat(tokens[7]),
                    color: parseInt(tokens[8]),
                    kerfWidth: kerfNum,
                    bridgeCount: parseInt(tokens[10]),
                    bridgeWidth: parseFloat(tokens[11]),
                    clockwise: parseFloat(tokens[7]) < 0 ? false : true,
                    properties: { rawKerf }
                }));
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
        }
        return geometries;
    }
}

module.exports = DdsParser;
