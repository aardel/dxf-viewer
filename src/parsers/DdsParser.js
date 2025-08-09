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
        for (const line of lines) {
            const tokens = line.trim().split(/\s+/);
            if (tokens[0] === 'LINE' && tokens.length >= 9) {
                geometries.push(new Line({
                    start: { x: parseFloat(tokens[1]), y: parseFloat(tokens[2]) },
                    end: { x: parseFloat(tokens[3]), y: parseFloat(tokens[4]) },
                    color: parseInt(tokens[5]),
                    kerfWidth: parseFloat(tokens[6]),
                    bridgeCount: parseInt(tokens[7]),
                    bridgeWidth: parseFloat(tokens[8])
                }));
            } else if (tokens[0] === 'ARC' && tokens.length >= 12) {
                geometries.push(new Arc({
                    start: { x: parseFloat(tokens[1]), y: parseFloat(tokens[2]) },
                    end: { x: parseFloat(tokens[3]), y: parseFloat(tokens[4]) },
                    center: { x: parseFloat(tokens[5]), y: parseFloat(tokens[6]) },
                    radius: parseFloat(tokens[7]),
                    color: parseInt(tokens[8]),
                    kerfWidth: parseFloat(tokens[9]),
                    bridgeCount: parseInt(tokens[10]),
                    bridgeWidth: parseFloat(tokens[11]),
                    clockwise: parseFloat(tokens[7]) < 0 ? false : true
                }));
            }
            // Ignore unsupported or malformed lines
        }
        return geometries;
    }
}

module.exports = DdsParser;
