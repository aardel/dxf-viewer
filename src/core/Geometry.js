// Unified geometry model for DXF, DDS, CF2, etc.

class Geometry {
    constructor(type, options = {}) {
        this.type = type; // 'LINE', 'ARC', 'CIRCLE', 'POLYLINE', etc.
        this.layer = options.layer || null;
        this.color = options.color || null;
        this.kerfWidth = options.kerfWidth || null;
        this.bridgeCount = options.bridgeCount || 0;
        this.bridgeWidth = options.bridgeWidth || 0;
        this.properties = options.properties || {}; // For proprietary fields (CF2, etc.)
    }
}

class Line extends Geometry {
    constructor({ start, end, ...opts }) {
        super('LINE', opts);
        this.start = start; // {x, y}
        this.end = end;     // {x, y}
    }
}

class Arc extends Geometry {
    constructor({ start, end, center, radius, clockwise, ...opts }) {
        super('ARC', opts);
        this.start = start;
        this.end = end;
        this.center = center;
        this.radius = radius;
        this.clockwise = clockwise;
    }
}

class Polyline extends Geometry {
    constructor({ vertices, closed, ...opts }) {
        super('POLYLINE', opts);
        this.vertices = vertices; // Array of {x, y, bulge?}
        this.closed = closed || false;
    }
}

class Circle extends Geometry {
    constructor({ center, radius, ...opts }) {
        super('CIRCLE', opts);
        this.center = center;
        this.radius = radius;
    }
}

module.exports = {
    Geometry,
    Line,
    Arc,
    Polyline,
    Circle
};
