// UnifiedImporter: Detects file type and dispatches to the correct parser
const DdsParser = require('./DdsParser');
const Cf2Parser = require('./Cf2Parser');

const DxfUnifiedParser = require('./DxfUnifiedParser');

class UnifiedImporter {
    /**
     * Import file content and return unified geometry objects
     * @param {string} content
     * @param {string} filename
     * @returns {Array} Array of geometry objects
     */
    static async import(content, filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'dds') {
            const parser = new DdsParser();
            return parser.parse(content);
        } else if (ext === 'cf2') {
            // CF2 files: Disable Y-axis inversion since the rendering system 
            // already handles coordinate transformation with proper Y-axis flipping
            const parser = new Cf2Parser({ invertY: false });
            return parser.parse(content);
        } else if (ext === 'dxf') {
            throw new Error('DXF support is temporarily disabled. Please use DDS or CF2 files.');
        } else {
            throw new Error('Unsupported file type: ' + ext + '. Only DDS and CF2 files are supported.');
        }
    }
}

module.exports = UnifiedImporter;
