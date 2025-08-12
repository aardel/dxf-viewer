// DxfUnifiedParser: Wraps the existing DXF parser to output unified geometry objects
const { Line, Arc, Polyline, Circle } = require('../core/Geometry');
const { initializeModules, createDxfParser } = require('./DxfParserCJS');

class DxfUnifiedParser {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the parser modules
     */
    async initialize() {
        if (!this.initialized) {
            await initializeModules();
            this.initialized = true;
        }
    }

    /**
     * Parse DXF file content (string) into unified geometry objects
     * @param {string} content
     * @returns {Array} Array of geometry objects (Line, Arc, Polyline, Circle, etc.)
     */
    async parse(content) {
        await this.initialize();
        
        const parser = createDxfParser();
        const dxf = parser.parseSync(content);
        const geometries = [];
        if (!dxf || !dxf.entities) return geometries;
        for (const entity of dxf.entities) {
            switch (entity.type) {
                case 'LINE':
                    geometries.push(new Line({
                        start: entity.start,
                        end: entity.end,
                        layer: entity.layer,
                        color: entity.color,
                        kerfWidth: null // DXF does not have kerf/bridge info
                    }));
                    break;
                case 'ARC':
                    geometries.push(new Arc({
                        center: entity.center,
                        radius: entity.radius,
                        start: null, // Optionally calculate from angles if needed
                        end: null,
                        layer: entity.layer,
                        color: entity.color,
                        clockwise: false // DXF arcs are usually CCW, can be calculated
                    }));
                    break;
                case 'CIRCLE':
                    geometries.push(new Circle({
                        center: entity.center,
                        radius: entity.radius,
                        layer: entity.layer,
                        color: entity.color
                    }));
                    break;
                case 'POLYLINE':
                case 'LWPOLYLINE':
                    geometries.push(new Polyline({
                        vertices: entity.vertices,
                        closed: entity.closed,
                        layer: entity.layer,
                        color: entity.color
                    }));
                    break;
                // Add more entity types as needed
            }
        }
        return geometries;
    }
}

module.exports = DxfUnifiedParser;
