// DinWriter: Exports unified geometry objects to DIN format, with optional bridge support
class DinWriter {
    /**
     * Export geometry objects to DIN format
     * @param {Array} geometries - Array of unified geometry objects
     * @param {Object} options - { outputBridges: boolean }
     * @returns {string} DIN file content
     */
    static export(geometries, options = { outputBridges: true }) {
        const lines = [];
        for (const geom of geometries) {
            if (geom.type === 'LINE') {
                lines.push(...this.exportLine(geom, options));
            } else if (geom.type === 'ARC') {
                lines.push(...this.exportArc(geom, options));
            }
            // Add more types as needed
        }
        return lines.join('\n');
    }

    static exportLine(line, options) {
        const out = [];
        if (options.outputBridges && line.bridgeCount > 0 && line.bridgeWidth > 0) {
            // Split line into segments with bridges (gaps)
            const { start, end, bridgeCount, bridgeWidth } = line;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx*dx + dy*dy);
            const cutLength = length - bridgeCount * bridgeWidth;
            const segmentLength = cutLength / (bridgeCount + 1);
            let pos = 0;
            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = {
                    x: start.x + (dx * pos / length),
                    y: start.y + (dy * pos / length)
                };
                pos += segmentLength;
                const segEnd = (i === bridgeCount)
                    ? end
                    : {
                        x: start.x + (dx * pos / length),
                        y: start.y + (dy * pos / length)
                    };
                out.push(`LINE ${segStart.x.toFixed(6)} ${segStart.y.toFixed(6)} ${segEnd.x.toFixed(6)} ${segEnd.y.toFixed(6)} ${line.color||0} ${line.kerfWidth||0} 0 0`);
                pos += bridgeWidth;
            }
        } else {
            out.push(`LINE ${line.start.x.toFixed(6)} ${line.start.y.toFixed(6)} ${line.end.x.toFixed(6)} ${line.end.y.toFixed(6)} ${line.color||0} ${line.kerfWidth||0} ${line.bridgeCount||0} ${line.bridgeWidth||0}`);
        }
        return out;
    }

    static exportArc(arc, options) {
        // For simplicity, do not split arcs for bridges in this stub
        return [
            `ARC ${arc.start?.x||0} ${arc.start?.y||0} ${arc.end?.x||0} ${arc.end?.y||0} ${arc.center?.x||0} ${arc.center?.y||0} ${arc.radius||0} ${arc.color||0} ${arc.kerfWidth||0} ${arc.bridgeCount||0} ${arc.bridgeWidth||0}`
        ];
    }
}

module.exports = DinWriter;
