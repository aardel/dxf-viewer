// UnifiedExporter: Dispatches unified geometry objects to the correct writer/exporter
const DinWriter = require('../writers/DinWriter');
// TODO: Implement writers for DDS, DXF, CF2

class UnifiedExporter {
    /**
     * Export unified geometry objects to a specific format
     * @param {Array} geometries
     * @param {string} format - 'din', 'dds', 'dxf', 'cf2'
     * @param {Object} options - writer options (e.g., { outputBridges: true })
     * @returns {string} Exported file content
     */
    static export(geometries, format, options = {}) {
        if (format === 'din') {
            return DinWriter.export(geometries, options);
        } else if (format === 'dds') {
            // TODO: Implement DDS writer
            throw new Error('DDS writer integration pending');
        } else if (format === 'cf2') {
            // TODO: Implement CF2 writer
            throw new Error('CF2 writer integration pending');
        } else if (format === 'dxf') {
            // TODO: Implement DXF writer
            throw new Error('DXF writer integration pending');
        } else {
            throw new Error('Unsupported export format: ' + format);
        }
    }
}

module.exports = UnifiedExporter;
