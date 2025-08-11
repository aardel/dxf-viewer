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
    static import(content, filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'dds') {
            const parser = new DdsParser();
            return parser.parse(content);
        } else if (ext === 'cf2') {
            const parser = new Cf2Parser();
            return parser.parse(content);
        } else if (ext === 'dxf') {
            const parser = new DxfUnifiedParser();
            return parser.parse(content);
        } else {
            throw new Error('Unsupported file type: ' + ext);
        }
    }
}

module.exports = UnifiedImporter;
