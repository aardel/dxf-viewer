// DxfParserCJS.js - CommonJS wrapper for ES6 DxfParser
// This file provides a CommonJS interface for the ES6 DxfParser module

let DxfParser = null;
let DxfArrayScanner = null;
let AUTO_CAD_COLOR_INDEX = null;
let Face = null;
let Arc = null;
let AttDef = null;
let Attribute = null;
let Circle = null;
let Dimension = null;
let Ellipse = null;
let Insert = null;
let Line = null;
let LWPolyline = null;
let MText = null;
let Point = null;
let Polyline = null;
let Solid = null;
let Spline = null;
let Text = null;
let Hatch = null;
let dimStyleCodes = null;
let log = null;

// Initialize the ES6 modules
async function initializeModules() {
    if (DxfParser) return; // Already initialized
    
    try {
        const [
            DxfParserModule,
            DxfArrayScannerModule,
            AutoCadColorIndexModule,
            FaceModule,
            ArcModule,
            AttDefModule,
            AttributeModule,
            CircleModule,
            DimensionModule,
            EllipseModule,
            InsertModule,
            LineModule,
            LWPolylineModule,
            MTextModule,
            PointModule,
            PolylineModule,
            SolidModule,
            SplineModule,
            TextModule,
            HatchModule,
            DimStyleCodesModule,
            logModule
        ] = await Promise.all([
            import('../parser/DxfParser.js'),
            import('../parser/DxfArrayScanner.js'),
            import('../parser/AutoCadColorIndex.js'),
            import('../parser/entities/3dface.js'),
            import('../parser/entities/arc.js'),
            import('../parser/entities/attdef.js'),
            import('../parser/entities/attribute.js'),
            import('../parser/entities/circle.js'),
            import('../parser/entities/dimension.js'),
            import('../parser/entities/ellipse.js'),
            import('../parser/entities/insert.js'),
            import('../parser/entities/line.js'),
            import('../parser/entities/lwpolyline.js'),
            import('../parser/entities/mtext.js'),
            import('../parser/entities/point.js'),
            import('../parser/entities/polyline.js'),
            import('../parser/entities/solid.js'),
            import('../parser/entities/spline.js'),
            import('../parser/entities/text.js'),
            import('../parser/entities/hatch.js'),
            import('../parser/DimStyleCodes.js'),
            import('loglevel')
        ]);

        DxfParser = DxfParserModule.default;
        DxfArrayScanner = DxfArrayScannerModule.default;
        AUTO_CAD_COLOR_INDEX = AutoCadColorIndexModule.default;
        Face = FaceModule.default;
        Arc = ArcModule.default;
        AttDef = AttDefModule.default;
        Attribute = AttributeModule.default;
        Circle = CircleModule.default;
        Dimension = DimensionModule.default;
        Ellipse = EllipseModule.default;
        Insert = InsertModule.default;
        Line = LineModule.default;
        LWPolyline = LWPolylineModule.default;
        MText = MTextModule.default;
        Point = PointModule.default;
        Polyline = PolylineModule.default;
        Solid = SolidModule.default;
        Spline = SplineModule.default;
        Text = TextModule.default;
        Hatch = HatchModule.default;
        dimStyleCodes = DimStyleCodesModule.default;
        log = logModule.default;
    } catch (error) {
        console.error('Failed to initialize ES6 modules:', error);
        throw error;
    }
}

// Create a synchronous wrapper that initializes modules if needed
function createDxfParser() {
    if (!DxfParser) {
        throw new Error('DxfParser not initialized. Call initializeModules() first.');
    }
    return new DxfParser();
}

// Export the initialization function and the parser constructor
module.exports = {
    initializeModules,
    createDxfParser
};
