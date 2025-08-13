/**
 * DIN File Generator
 * Converts DXF entities to DIN format using optimization algorithms
 */

import { PathOptimizer } from './PathOptimizer.js';

export class DinGenerator {
    constructor() {
        this.optimizer = new PathOptimizer();
        this.currentTool = null;
        this.lineNumber = 1;
        this.config = null;
    }

    /**
     * Convert coordinates from file units to output units
     * @param {number} value - Value in file units
     * @param {string} fileUnits - Source units (e.g., 'mm', 'in', 'pt')
     * @param {string} outputUnits - Target units (e.g., 'mm', 'in')
     * @returns {number} Converted value
     */
    convertCoordinates(value, fileUnits, outputUnits) {
        // If units are the same, no conversion needed
        if (fileUnits === outputUnits) {
            return value;
        }

        // Convert to mm first (internal standard)
        let valueInMm = value;
        switch (fileUnits) {
            case 'in':
                valueInMm = value * 25.4;
                break;
            case 'ft':
                valueInMm = value * 304.8;
                break;
            case 'pt':
                valueInMm = value * 0.3527777778; // 1 point = 0.3527777778 mm
                break;
            case 'cm':
                valueInMm = value * 10;
                break;
            case 'm':
                valueInMm = value * 1000;
                break;
            case 'mm':
            default:
                valueInMm = value;
                break;
        }

        // Convert from mm to output units
        switch (outputUnits) {
            case 'in':
                return valueInMm / 25.4;
            case 'ft':
                return valueInMm / 304.8;
            case 'pt':
                return valueInMm / 0.3527777778;
            case 'cm':
                return valueInMm / 10;
            case 'm':
                return valueInMm / 1000;
            case 'mm':
            default:
                return valueInMm;
        }
    }

    /**
     * Generate DIN file content from DXF entities
     * @param {Array} entities - DXF entities to convert
     * @param {Object} config - Postprocessor configuration
     * @param {Object} metadata - File metadata (filename, bounds, etc.)
     * @returns {String} DIN file content
     */
    generateDin(entities, config, metadata = {}) {
        console.error('🔥🔥🔥 FIRE LOG - DinGenerator.generateDin() CALLED - THIS SHOULD ALWAYS APPEAR 🔥🔥🔥');
        console.warn('⚠️⚠️⚠️ WARNING LOG - If you see this, DinGenerator is working ⚠️⚠️⚠️');
        console.info('ℹ️ℹ️ℹ️ INFO LOG - generateDin method entered ℹ️ℹ️ℹ️');
        console.log('📝📝📝 NORMAL LOG - Standard console log 📝📝📝');
        console.log('🎯 DIN GENERATOR IS WORKING! Our fixes are active!'); // User will see this in console
        this.config = config;
        this.metadata = metadata; // Store metadata for use in other methods
        this.lineNumber = config.lineNumbers?.startNumber || 10;
        this.currentTool = null;

        // Log unit conversion information
        const fileUnits = metadata.fileUnits || 'mm';
        const outputUnits = config.units?.system || 'mm';
        console.log(`🔥 DIN GENERATION DEBUG 🔥`);
        console.log(`File units: ${fileUnits}`);
        console.log(`Output units: ${outputUnits}`);
        console.log(`Unit conversion: ${fileUnits} → ${outputUnits}`);
        console.log(`Metadata:`, metadata);
        console.log(`Config units:`, config.units);
        console.log(`🔥 END DEBUG 🔥`);

        // Load tools with priority information
        const toolsWithPriority = this.loadToolsFromConfig(config);
        
        // Optimize entity order with full config access
        const optimizationSettings = {
            ...(config.optimization || {}),
            config: config  // Pass full config for priority phase access
        };
        
        const optimizedEntities = this.optimizer.optimizePaths(
            entities, 
            toolsWithPriority,
            optimizationSettings
        );

        // Generate DIN content
        const dinLines = [];
        
        // Add header (includes steps 1-5)
        dinLines.push(...this.generateHeader(metadata));
        
        // Add setup commands (step 6)
        dinLines.push(...this.generateSetupCommands());
        
        // Process entities
        dinLines.push(...this.generateEntityCommands(optimizedEntities));
        
        // Add footer
        dinLines.push(...this.generateFooter());

        // Join lines, preserving empty lines for line feeds
        const result = dinLines.join('\n');
        

        return result;
    }

    /**
     * Generate DIN header based on configuration
     * Follows the exact DIN format order:
     * 1. File information (with G253 F= format)
     * 2. Program start marker (%1)
     * 3. Drawing bounds (if enabled)
     * 4. Operation count (Number of Sets)
     * 5. File information again (with G253 F= format for machine)
     * 6. Scaling parameters (if INCH machine selected)
     * 7. Initial setup commands
     */
    generateHeader(metadata) {
        const lines = [];
        const config = this.config;
        const filename = metadata.filename || 'unknown.dxf';
        const timestamp = new Date().toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).replace(',', '');

        // Get file and output units for proper conversion
        const fileUnits = metadata.fileUnits || 'mm';
        const outputUnits = config.units?.system || 'mm';

        // Convert dimensions to output units
        let convertedWidth = this.convertCoordinates(metadata.width || 0, fileUnits, outputUnits);
        let convertedHeight = this.convertCoordinates(metadata.height || 0, fileUnits, outputUnits);
        
        // If width/height are 0 but bounds exist, calculate size from bounds
        if ((convertedWidth === 0 || convertedHeight === 0) && metadata.bounds) {
            const bounds = metadata.bounds;
            const boundsWidth = Math.abs(bounds.maxX - bounds.minX);
            const boundsHeight = Math.abs(bounds.maxY - bounds.minY);
            
            convertedWidth = this.convertCoordinates(boundsWidth, fileUnits, outputUnits);
            convertedHeight = this.convertCoordinates(boundsHeight, fileUnits, outputUnits);
        }
        
        // Convert bounds to output units
        let convertedBounds = null;
        if (metadata.bounds) {
            convertedBounds = {
                minX: this.convertCoordinates(metadata.bounds.minX || 0, fileUnits, outputUnits),
                minY: this.convertCoordinates(metadata.bounds.minY || 0, fileUnits, outputUnits),
                maxX: this.convertCoordinates(metadata.bounds.maxX || 0, fileUnits, outputUnits),
                maxY: this.convertCoordinates(metadata.bounds.maxY || 0, fileUnits, outputUnits)
            };
        }

        // 1. File information (with G253 F= format)
        if (config.header?.includeFileInfo) {
            if (config.header?.template) {
                const template = config.header.template
                    .replace('{filename}', filename)
                    .replace('{width}', convertedWidth.toFixed(1))
                    .replace('{height}', convertedHeight.toFixed(1))
                    .replace('{timestamp}', timestamp);
                lines.push(this.formatLine(template));
            } else {
                lines.push(this.formatLine(`G253 F=${filename}`));
            }
        }

        // 2. Program start marker
        if (config.header?.includeProgramStart) {
            lines.push(this.formatLine('%1'));
        }

        // 3. Drawing bounds (if enabled)
        if (config.header?.includeBounds && convertedBounds) {
            lines.push(this.formatLine(`G253 X${convertedBounds.minX.toFixed(3)} Y${convertedBounds.minY.toFixed(3)} X${convertedBounds.maxX.toFixed(3)} Y${convertedBounds.maxY.toFixed(3)}`));
        }

        // 4. Operation count (Number of Sets)
        if (config.header?.includeOperationCount) {
            const entityCount = metadata.entityCount || 0;
            lines.push(this.formatLine(`G253 N=${entityCount}`));
        }

        // 5. File information again (with G253 F= format for machine)
        if (config.header?.includeFileInfo) {
            lines.push(this.formatLine(`G253 F=${filename}`));
        }

        // 6. Scaling parameters (if INCH machine selected)
        if (config.units?.system === 'in' && config.header?.includeScaling) {
            lines.push(this.formatLine('G253 S=25.4'));
        }

        return lines;
    }

    /**
     * Generate setup commands
     */
    generateSetupCommands() {
        const lines = [];
        const config = this.config;

        // Add initial setup commands from configuration
        if (config.setup?.commands && Array.isArray(config.setup.commands)) {
            config.setup.commands.forEach(command => {
                lines.push(this.formatLine(command));
            });
        }

        return lines;
    }

    /**
     * Generate entity commands
     */
    generateEntityCommands(entities) {
        const lines = [];

        entities.forEach(entity => {
            // Add tool change if needed
            if (entity.lineType && entity.lineType !== this.currentTool) {
                const toolChange = this.generateToolChange(entity.lineType);
                if (toolChange) {
                    lines.push(...toolChange);
                }
                this.currentTool = entity.lineType;
            }

            // Generate entity-specific DIN commands
            const entityLines = this.generateEntityDin(entity);
            lines.push(...entityLines);
        });

        return lines;
    }

    /**
     * Generate tool change command
     */
    generateToolChange(lineType) {
        const lines = [];
        const config = this.config;

        // Find tool mapping for this line type
        if (config.mappingWorkflow?.lineTypeToTool) {
            const mapping = config.mappingWorkflow.lineTypeToTool.find(m => m.lineType === lineType);
            if (mapping && mapping.tool) {
                const toolId = mapping.tool;
                lines.push(this.formatLine(`T${toolId}`));
            }
        }

        return lines;
    }

    /**
     * Generate DIN for a single entity
     */
    generateEntityDin(entity) {
        // Check if entity has bridge properties that need processing
        const hasBridges = (entity.bridgeCount && entity.bridgeCount > 0) || 
                          (entity.bridgeWidth && entity.bridgeWidth > 0);
        
        if (hasBridges) {
            return this.generateEntityDinWithBridges(entity);
        }
        
        switch (entity.type) {
            case 'LINE':
                return this.generateLineDin(entity);
            case 'ARC':
                return this.generateArcDin(entity);
            case 'CIRCLE':
                return this.generateCircleDin(entity);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.generatePolylineDin(entity);
            default:
                console.warn(`Unsupported entity type: ${entity.type}`);
                return [];
        }
    }

    /**
     * Generate DIN for entities with bridge gaps
     */
    generateEntityDinWithBridges(entity) {
        const lines = [];
        const laserOnCmd = this.config.laser?.comments?.enabled
            ? `${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`
            : this.config.laser.laserOn;
        const laserOffCmd = this.config.laser?.comments?.enabled
            ? `${this.config.laser.laserOff} { ${this.config.laser.comments.offCommand || 'LASER OFF'} }`
            : this.config.laser.laserOff;

        if (entity.type === 'LINE') {
            // Get unit conversion parameters
            const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
            const outputUnits = this.config.units?.system || 'mm';
            
            // Convert coordinates
            const startX = this.convertCoordinates(entity.start.x, fileUnits, outputUnits);
            const startY = this.convertCoordinates(entity.start.y, fileUnits, outputUnits);
            const endX = this.convertCoordinates(entity.end.x, fileUnits, outputUnits);
            const endY = this.convertCoordinates(entity.end.y, fileUnits, outputUnits);
            
            const lineVecX = endX - startX;
            const lineVecY = endY - startY;
            const totalLen = Math.hypot(lineVecX, lineVecY);
            if (!isFinite(totalLen) || totalLen === 0) return [];
            const ux = lineVecX / totalLen;
            const uy = lineVecY / totalLen;

            const bridgeCount = entity.bridgeCount || 0;
            const bridgeWidth = entity.bridgeWidth || 0;
            const totalBridgeLength = bridgeCount * bridgeWidth;
            const drawableLen = totalLen - totalBridgeLength;
            if (drawableLen <= 0) return [];
            const segmentLen = drawableLen / (bridgeCount + 1);

            // Move to start
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
            let cursor = 0;
            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                const segEnd = (i < bridgeCount) ? segStart + segmentLen : drawableLen;
                const p2 = {
                    x: startX + ux * segEnd,
                    y: startY + uy * segEnd
                };

                // Draw line segment
                lines.push(this.formatLine(laserOnCmd));
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${p2.x.toFixed(3)} Y${p2.y.toFixed(3)}`));
                lines.push(this.formatLine(laserOffCmd));

                if (i < bridgeCount) {
                    // Rapid over the bridge gap
                    const gapEnd = segEnd + bridgeWidth;
                    const pg = {
                        x: startX + ux * gapEnd,
                        y: startY + uy * gapEnd
                    };
                    lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${pg.x.toFixed(3)} Y${pg.y.toFixed(3)}`));
                    cursor = gapEnd;
                }
            }
            return lines;
        }

        if (entity.type === 'ARC') {
            console.log('=== ARC ENTITY DEBUG IN generateEntityDinWithBridges ===');
            console.log('Entity:', entity);
            console.log('Bridge data:', {
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                bridges: entity.bridges
            });
            
            // Get unit conversion parameters
            const fileUnits = this.metadata.fileUnits || 'mm';
            const outputUnits = this.config.units?.system || 'mm';
            
            // Approximate splitting along arc length using entity.center, radius, start/end angles
            const cx = entity.center?.x;
            const cy = entity.center?.y;
            if (cx === undefined || cy === undefined || entity.radius === undefined) {
                console.log('❌ ARC ENTITY MISSING REQUIRED DATA - returning empty');
                return [];
            }
            
            // Convert coordinates for calculations
            const convertedCx = this.convertCoordinates(cx, fileUnits, outputUnits);
            const convertedCy = this.convertCoordinates(cy, fileUnits, outputUnits);
            const convertedRadius = this.convertCoordinates(entity.radius, fileUnits, outputUnits);

            // Convert start and end coordinates
            const convertedStartX = this.convertCoordinates(entity.start.x, fileUnits, outputUnits);
            const convertedStartY = this.convertCoordinates(entity.start.y, fileUnits, outputUnits);
            const convertedEndX = this.convertCoordinates(entity.end.x, fileUnits, outputUnits);
            const convertedEndY = this.convertCoordinates(entity.end.y, fileUnits, outputUnits);
            
            // Calculate angles from converted start and end points
            const a0 = Math.atan2(convertedStartY - convertedCy, convertedStartX - convertedCx);
            const a1 = Math.atan2(convertedEndY - convertedCy, convertedEndX - convertedCx);
            let sweep = a1 - a0;
            
            console.log('=== ARC ANGLE CALCULATION ===');
            console.log('entity.start:', entity.start);
            console.log('entity.end:', entity.end);
            console.log('a0 (start angle):', a0);
            console.log('a1 (end angle):', a1);
            console.log('initial sweep:', sweep);
            console.log('entity.clockwise:', entity.clockwise);
            console.log('entity.radius:', entity.radius);
            
            // Full circle detection - only true if start/end are EXACTLY the same
            // AND sweep angle is close to 2π (360 degrees)
            const startEndDistance = Math.sqrt(
                Math.pow(convertedStartX - convertedEndX, 2) + 
                Math.pow(convertedStartY - convertedEndY, 2)
            );
            
            // Calculate initial sweep angle
            let arcSweep = a1 - a0;
            
            // Normalize sweep angle
            if (arcSweep < -Math.PI) arcSweep += 2 * Math.PI;
            if (arcSweep > Math.PI) arcSweep -= 2 * Math.PI;
            
            // True full circle: start/end points are the same (sweep will be 0 for true circles)
            const isFullCircle = startEndDistance < 0.0001;
            
            console.log('=== ARC DETECTION DEBUG ===');
            console.log('Start/end distance:', startEndDistance);
            console.log('Arc sweep (radians):', arcSweep);
            console.log('Arc sweep (degrees):', arcSweep * 180 / Math.PI);
            console.log('Is full circle:', isFullCircle);
            console.log('=== END ARC DETECTION ===');
            
            if (isFullCircle) {
                // For full circles, set sweep to full 2π in correct direction
                const ccw = !entity.clockwise;
                arcSweep = ccw ? Math.PI * 2 : -Math.PI * 2;
                console.log('🔄 Full circle detected, setting sweep to:', arcSweep);
            } else {
                // For partial arcs, normalize sweep based on clockwise direction
                if (!entity.clockwise && arcSweep > 0) arcSweep -= Math.PI * 2;
                if (entity.clockwise && arcSweep < 0) arcSweep += Math.PI * 2;
            }
            
            // Use the clockwise flag from the parser - INVERTED for correct arc direction
            // CF2/DDS clockwise=true should generate CCW arcs (G3) for concave cuts
            // If clockwise is undefined (common for fillets or exporter-minimal arcs),
            // derive direction from the geometric sweep sign between start and end.
            // Positive sweep => CCW, negative sweep => CW
            let ccw = (entity.clockwise !== undefined)
                    ? entity.clockwise
                    : (arcSweep > 0);
            // Targeted fix: half-circles with vertical chord sometimes come inverted from source.
            // If sweep is ~π and chord is nearly vertical, flip direction.
            // Robust vertical-chord detection (machine uses inches often → looser tol)
            const chordDx = Math.abs(convertedStartX - convertedEndX);
            const chordDy = Math.abs(convertedStartY - convertedEndY);
            const chordAngle = Math.atan2(convertedEndY - convertedStartY, convertedEndX - convertedStartX);
            const isVerticalByAngle = Math.abs(Math.cos(chordAngle)) < 0.05; // ~±3°
            const verticalChord = (chordDx < 5e-3 && chordDy > 5e-3) || isVerticalByAngle;
            const isSemiCircle = Math.abs(Math.abs(arcSweep) - Math.PI) < 5e-3;
            if ((entity.bridgeCount || 0) === 0 && isSemiCircle && verticalChord) {
                ccw = !ccw;
                console.log('🩹 Heuristic applied: vertical semicircle without bridges -> flipped ccw to', ccw);
            }
            console.log('🔄 Arc direction: entity.clockwise =', entity.clockwise, 'sweep=', arcSweep, '-> ccw =', ccw, '-> will use', ccw ? 'G3 (CCW)' : 'G2 (CW)');
            
            const totalArcLen = convertedRadius * Math.abs(arcSweep);
            if (!isFinite(totalArcLen) || totalArcLen === 0) {
                console.log('❌ totalArcLen invalid:', totalArcLen, 'sweep:', arcSweep);
                return [];
            }

            const bridgeCount = entity.bridgeCount || 0;
            const bridgeWidth = entity.bridgeWidth || 0;
            const totalBridgeLength = bridgeCount * bridgeWidth;
            const drawableLen = totalArcLen - totalBridgeLength;
            
            console.log('=== ARC BRIDGE CALCULATION ===');
            console.log('totalArcLen:', totalArcLen);
            console.log('bridgeCount:', bridgeCount);
            console.log('bridgeWidth:', bridgeWidth);
            console.log('totalBridgeLength:', totalBridgeLength);
            console.log('drawableLen:', drawableLen);
            console.log('segmentLen will be:', drawableLen / (bridgeCount + 1));
            
            if (drawableLen <= 0) {
                console.log('❌ drawableLen <= 0, returning empty');
                return [];
            }
            const segmentLen = drawableLen / (bridgeCount + 1);
            
            // Use the same full circle detection logic for bridge processing
            const isFullCircleForBridges = isFullCircle;
            console.log('Is full circle for bridges:', isFullCircleForBridges, 'sweep:', arcSweep);
            
            console.log('✅ Bridge processing will generate segments. segmentLen:', segmentLen);

            // Helper to get point at arc length L from start (using converted coordinates)
            const pointAtLen = (len) => {
                const dir = ccw ? 1 : -1;
                const theta = a0 + dir * (len / convertedRadius);
                return { 
                    x: convertedCx + convertedRadius * Math.cos(theta), 
                    y: convertedCy + convertedRadius * Math.sin(theta) 
                };
            };

            // For both full and partial arcs: Use bridge processing to split drawable segments
            // Move to start (using converted coordinates)
            // Use higher precision for inches to avoid rounding conflicts
            const isInches = this.config.units === 'inches' || entity.fileUnits === 'in';
            const precision = isInches ? 5 : 3; // 5 decimals for inches, 3 for mm
            const multiplier = Math.pow(10, precision);
            const roundN = (n) => Math.round(n * multiplier) / multiplier;
            const epsilon = isInches ? 1e-8 : 1e-6; // Tighter epsilon for higher precision
            let lastX = convertedStartX;
            let lastY = convertedStartY;
            let lastOutX = roundN(convertedStartX);
            let lastOutY = roundN(convertedStartY);
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${lastOutX.toFixed(precision)} Y${lastOutY.toFixed(precision)}`));

            let cursor = 0;
            console.log('🔄 Starting bridge processing loop for', bridgeCount + 1, 'segments (fullCircle=', isFullCircleForBridges, ')');

            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                let segEnd;
                
                if (i < bridgeCount) {
                    // Regular segment
                    segEnd = segStart + segmentLen;
                } else {
                    // Last segment - end at drawableLen for partial arcs, totalArcLen for full circles
                    segEnd = isFullCircleForBridges ? totalArcLen : drawableLen;
                }
                
                console.log(`Segment ${i}: start=${segStart.toFixed(3)}, end=${segEnd.toFixed(3)}`);
                const p2 = pointAtLen(segEnd);

                // Get start point of this segment
                const p1 = pointAtLen(segStart);
                
                // Skip arc command if start and end points are the same (would create full circle)
                const dx = Math.abs(p2.x - p1.x);
                const dy = Math.abs(p2.y - p1.y);
                if (dx > 1e-6 || dy > 1e-6) {
                    // Ensure machine is at the correct start position (avoid duplicate rapids at output precision)
                    const p1rx = roundN(p1.x);
                    const p1ry = roundN(p1.y);
                    if (Math.abs(p1rx - lastOutX) > epsilon || Math.abs(p1ry - lastOutY) > epsilon) {
                        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${p1rx.toFixed(precision)} Y${p1ry.toFixed(precision)}`));
                        lastX = p1.x; lastY = p1.y;
                        lastOutX = p1rx; lastOutY = p1ry;
                    }
                    lines.push(this.formatLine(laserOnCmd));
                    
                    // Compute I/J from the ACTUAL machine position (p1) to center (using converted coords)
                    const iVal = convertedCx - p1.x;
                    const jVal = convertedCy - p1.y;
                    // Determine segment direction strictly from geometry (start->end around center)
                    const v1x = p1.x - convertedCx;
                    const v1y = p1.y - convertedCy;
                    const v2x = p2.x - convertedCx;
                    const v2y = p2.y - convertedCy;
                    const cross = v1x * v2y - v1y * v2x; // >0 => CCW, <0 => CW
                    const segmentCcw = cross > 0;
                    const arcCmd = segmentCcw ? this.config.gcode.ccwArc : this.config.gcode.cwArc;

                    console.log(`  ↳ segment dir by cross=${cross.toFixed(6)} => ${segmentCcw ? 'G3 (CCW)' : 'G2 (CW)'}`);

                    const p2rx = roundN(p2.x);
                    const p2ry = roundN(p2.y);
                    lines.push(this.formatLine(`${arcCmd} X${p2rx.toFixed(precision)} Y${p2ry.toFixed(precision)} I${iVal.toFixed(precision)} J${jVal.toFixed(precision)}`));

                    lastX = p2.x; lastY = p2.y;
                    lastOutX = p2rx; lastOutY = p2ry;
                    lines.push(this.formatLine(laserOffCmd));
                } else {
                    console.log(`⚠️ Skipping arc segment ${i}: start and end points are the same (${p1.x.toFixed(3)}, ${p1.y.toFixed(3)})`);
                }

                if (i < bridgeCount) {
                    // Rapid over the bridge gap along arc
                    const gapEnd = segEnd + bridgeWidth;
                    const pg = pointAtLen(gapEnd);
                    // Rapid over gap (avoid duplicate rapid if already at pg at output precision)
                    const pgrx = roundN(pg.x);
                    const pgry = roundN(pg.y);
                    if (Math.abs(pgrx - lastOutX) > epsilon || Math.abs(pgry - lastOutY) > epsilon) {
                        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${pgrx.toFixed(precision)} Y${pgry.toFixed(precision)}`));
                        lastX = pg.x; lastY = pg.y;
                        lastOutX = pgrx; lastOutY = pgry;
                    }
                    cursor = gapEnd;
                }
            }

            // Add final move to end point for partial arcs (not full circles)
            // Only if the last segment didn't already end at the correct position
            if (!isFullCircleForBridges) {
                const endrx = roundN(convertedEndX);
                const endry = roundN(convertedEndY);
                if (Math.abs(endrx - lastOutX) > epsilon || Math.abs(endry - lastOutY) > epsilon) {
                    lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${endrx.toFixed(precision)} Y${endry.toFixed(precision)}`));
                    console.log('✅ Added final move to end point after bridge segments:', entity.end, 'from', {x: lastOutX, y: lastOutY});                                                         
                } else {
                    console.log('✅ Skipped final move - already at end point:', {x: lastOutX, y: lastOutY}, 'target:', {x: endrx, y: endry});                                                      
                }
            }
            
            console.log('✅ Bridge processing completed. Generated', lines.length, 'lines');
            return lines;
        }

        if (entity.type === 'CIRCLE') {
            // For circles, we'll split into multiple arc segments
            const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
            const outputUnits = this.config.units?.system || 'mm';
            
            const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
            const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
            const convertedRadius = this.convertCoordinates(Math.abs(entity.radius), fileUnits, outputUnits);
            
            const bridgeCount = entity.bridgeCount || 0;
            const bridgeWidth = entity.bridgeWidth || 0;
            const totalBridgeLength = bridgeCount * bridgeWidth;
            const circumference = 2 * Math.PI * convertedRadius;
            const drawableLen = circumference - totalBridgeLength;
            
            if (drawableLen <= 0) return [];
            const segmentLen = drawableLen / (bridgeCount + 1);
            
            // Start at rightmost point (0 degrees)
            const startX = convertedCenterX + convertedRadius;
            const startY = convertedCenterY;
            
            // Move to start
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
            let cursor = 0;
            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                const segEnd = (i < bridgeCount) ? segStart + segmentLen : drawableLen;
                const endAngle = segEnd / convertedRadius;
                const endX = convertedCenterX + convertedRadius * Math.cos(endAngle);
                const endY = convertedCenterY + convertedRadius * Math.sin(endAngle);

                // Draw arc segment
                lines.push(this.formatLine(laserOnCmd));
                const iVal = convertedCenterX - (convertedCenterX + convertedRadius * Math.cos(segStart / convertedRadius));
                const jVal = convertedCenterY - (convertedCenterY + convertedRadius * Math.sin(segStart / convertedRadius));
                lines.push(this.formatLine(`${this.config.gcode.cwArc} X${endX.toFixed(3)} Y${endY.toFixed(3)} I${iVal.toFixed(3)} J${jVal.toFixed(3)}`));
                lines.push(this.formatLine(laserOffCmd));

                if (i < bridgeCount) {
                    // Rapid over the bridge gap
                    const gapEnd = segEnd + bridgeWidth;
                    const gapAngle = gapEnd / convertedRadius;
                    const gapX = convertedCenterX + convertedRadius * Math.cos(gapAngle);
                    const gapY = convertedCenterY + convertedRadius * Math.sin(gapAngle);
                    lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${gapX.toFixed(3)} Y${gapY.toFixed(3)}`));
                    cursor = gapEnd;
                }
            }
            return lines;
        }

        // Fallback to regular processing for other entity types
        return this.generateEntityDin(entity);
    }

    /**
     * Generate DIN for LINE entity
     */
    generateLineDin(entity) {
        const lines = [];
        
        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Use higher precision for inches to avoid rounding conflicts
        const isInches = this.config.units === 'inches' || entity.fileUnits === 'in';
        const precision = isInches ? 5 : 3;
        
        // Convert coordinates
        const startX = this.convertCoordinates(entity.start.x, fileUnits, outputUnits);
        const startY = this.convertCoordinates(entity.start.y, fileUnits, outputUnits);
        const endX = this.convertCoordinates(entity.end.x, fileUnits, outputUnits);
        const endY = this.convertCoordinates(entity.end.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(precision)} Y${startY.toFixed(precision)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Cut to end position
        lines.push(this.formatLine(`${this.config.gcode.linearMove} X${endX.toFixed(precision)} Y${endY.toFixed(precision)}`));
        
        // Laser off
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOff} { ${this.config.laser.comments.offCommand || 'LASER OFF'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOff));
        }

        return lines;
    }

    /**
     * Generate DIN for ARC entity
     */
    generateArcDin(entity) {
        const lines = [];
        
        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Use higher precision for inches to avoid rounding conflicts
        const isInches = this.config.units === 'inches' || entity.fileUnits === 'in';
        const precision = isInches ? 5 : 3;
        
        // Use actual start and end points from entity (don't recalculate from angles)
        const startX = entity.start ? entity.start.x : (entity.center.x + entity.radius * Math.cos(entity.startAngle || 0));
        const startY = entity.start ? entity.start.y : (entity.center.y + entity.radius * Math.sin(entity.startAngle || 0));
        const endX = entity.end ? entity.end.x : (entity.center.x + entity.radius * Math.cos(entity.endAngle || Math.PI * 2));
        const endY = entity.end ? entity.end.y : (entity.center.y + entity.radius * Math.sin(entity.endAngle || Math.PI * 2));
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedEndX = this.convertCoordinates(endX, fileUnits, outputUnits);
        const convertedEndY = this.convertCoordinates(endY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedStartX.toFixed(precision)} Y${convertedStartY.toFixed(precision)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Use the standardized clockwise flag from the parser - INVERTED for correct cuts
        // CF2/DDS clockwise=true should generate CCW arcs (G3) for concave cuts
        // If clockwise is undefined, derive from start/end sweep relative to center
        // Positive sweep => CCW (so isClockwise=false), negative sweep => CW
        let isClockwise;
        if (entity.clockwise !== undefined) {
            isClockwise = !entity.clockwise;
        } else {
            const a0 = Math.atan2(convertedStartY - convertedCenterY, convertedStartX - convertedCenterX);
            const a1 = Math.atan2(convertedEndY - convertedCenterY, convertedEndX - convertedCenterX);
            let sweep = a1 - a0;
            if (sweep <= -Math.PI) sweep += 2 * Math.PI;
            if (sweep > Math.PI) sweep -= 2 * Math.PI;
            isClockwise = sweep < 0; // negative sweep means CW
            // Targeted fix: vertical semicircle without bridges may be inverted
            const chordDx = Math.abs(convertedStartX - convertedEndX);
            const chordDy = Math.abs(convertedStartY - convertedEndY);
            const chordAngle = Math.atan2(convertedEndY - convertedStartY, convertedEndX - convertedStartX);
            const isVerticalByAngle = Math.abs(Math.cos(chordAngle)) < 0.05;
            const verticalChord = (chordDx < 5e-3 && chordDy > 5e-3) || isVerticalByAngle;
            const isSemiCircle = Math.abs(Math.abs(sweep) - Math.PI) < 5e-3;
            if ((entity.bridgeCount || 0) === 0 && verticalChord && isSemiCircle) {
                isClockwise = !isClockwise;
                console.log('🩹 Heuristic applied (non-bridge): vertical semicircle -> flipped isClockwise to', isClockwise);
            }
        }
        console.log('🔄 Non-bridge arc: entity.clockwise =', entity.clockwise, 'computed isClockwise =', isClockwise, '-> will use', isClockwise ? 'G2 (CW)' : 'G3 (CCW)');
        
        const arcCommand = isClockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
        const i = convertedCenterX - convertedStartX;
        const j = convertedCenterY - convertedStartY;
        
        lines.push(this.formatLine(`${arcCommand} X${convertedEndX.toFixed(precision)} Y${convertedEndY.toFixed(precision)} I${i.toFixed(precision)} J${j.toFixed(precision)}`));
        
        // Laser off
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOff} { ${this.config.laser.comments.offCommand || 'LASER OFF'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOff));
        }

        return lines;
    }

    /**
     * Generate DIN for CIRCLE entity
     */
    generateCircleDin(entity) {
        const lines = [];
        
        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Use higher precision for inches to avoid rounding conflicts
        const isInches = this.config.units === 'inches' || entity.fileUnits === 'in';
        const precision = isInches ? 5 : 3;
        
        // Start at rightmost point of circle
        const startX = entity.center.x + entity.radius;
        const startY = entity.center.y;
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedStartX.toFixed(precision)} Y${convertedStartY.toFixed(precision)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Full circle as 360-degree arc
        const convertedRadius = this.convertCoordinates(entity.radius, fileUnits, outputUnits);
        const i = -convertedRadius;
        const j = 0;
        
        lines.push(this.formatLine(`${this.config.gcode.cwArc} X${convertedStartX.toFixed(precision)} Y${convertedStartY.toFixed(precision)} I${i.toFixed(precision)} J${j.toFixed(precision)}`));
        
        // Laser off
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOff} { ${this.config.laser.comments.offCommand || 'LASER OFF'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOff));
        }

        return lines;
    }

    /**
     * Generate DIN for POLYLINE entity
     */
    generatePolylineDin(entity) {
        const lines = [];
        
        if (!entity.vertices || entity.vertices.length < 2) {
            return lines;
        }

        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Use higher precision for inches to avoid rounding conflicts
        const isInches = this.config.units === 'inches' || entity.fileUnits === 'in';
        const precision = isInches ? 5 : 3;

        // Move to first vertex
        const firstVertex = entity.vertices[0];
        const convertedFirstX = this.convertCoordinates(firstVertex.x, fileUnits, outputUnits);
        const convertedFirstY = this.convertCoordinates(firstVertex.y, fileUnits, outputUnits);
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedFirstX.toFixed(precision)} Y${convertedFirstY.toFixed(precision)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Cut to each subsequent vertex
        for (let i = 1; i < entity.vertices.length; i++) {
            const prevVertex = entity.vertices[i - 1];
            const vertex = entity.vertices[i];
            
            // Convert coordinates
            const convertedVertexX = this.convertCoordinates(vertex.x, fileUnits, outputUnits);
            const convertedVertexY = this.convertCoordinates(vertex.y, fileUnits, outputUnits);
            
            // Check if previous vertex has a bulge value (indicating an arc segment)
            if (prevVertex.bulge && Math.abs(prevVertex.bulge) > 0.001) {
                // Generate arc command using bulge value
                const arcData = this.calculateArcFromBulge(prevVertex, vertex, prevVertex.bulge);
                if (arcData) {
                    const arcCommand = arcData.clockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;

                    // Convert arc center coordinates
                    const convertedI = this.convertCoordinates(arcData.i, fileUnits, outputUnits);
                    const convertedJ = this.convertCoordinates(arcData.j, fileUnits, outputUnits);
                    lines.push(this.formatLine(`${arcCommand} X${convertedVertexX.toFixed(precision)} Y${convertedVertexY.toFixed(precision)} I${convertedI.toFixed(precision)} J${convertedJ.toFixed(precision)}`));
                } else {
                    // Fallback to linear move if arc calculation fails
                    lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedVertexX.toFixed(precision)} Y${convertedVertexY.toFixed(precision)}`));
                }
            } else {
                // Standard linear move
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedVertexX.toFixed(precision)} Y${convertedVertexY.toFixed(precision)}`));
            }
        }
        
        // Close polyline if specified
        if (entity.closed && entity.vertices.length > 2) {
            lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedFirstX.toFixed(precision)} Y${convertedFirstY.toFixed(precision)}`));
        }
        
        // Laser off
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOff} { ${this.config.laser.comments.offCommand || 'LASER OFF'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOff));
        }

        return lines;
    }

    /**
     * Calculate arc parameters from DXF bulge value
     * @param {Object} startVertex - Start vertex with x, y coordinates
     * @param {Object} endVertex - End vertex with x, y coordinates  
     * @param {Number} bulge - DXF bulge value
     * @returns {Object|null} Arc parameters {i, j, clockwise} or null if invalid
     */
    calculateArcFromBulge(startVertex, endVertex, bulge) {
        try {
            if (Math.abs(bulge) < 0.001) return null;
            
            const startX = startVertex.x;
            const startY = startVertex.y;
            const endX = endVertex.x;
            const endY = endVertex.y;
            
            // Calculate chord length and midpoint
            const chordLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
            if (chordLength < 0.001) return null; // Invalid chord
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            // Calculate radius from bulge
            const radius = (chordLength / 2) * (1 + bulge ** 2) / (2 * Math.abs(bulge));
            
            // Calculate sagitta (height of arc segment)
            const sagitta = Math.abs(bulge) * chordLength / 2;
            
            // Calculate center point
            const chordAngle = Math.atan2(endY - startY, endX - startX);
            const perpAngle = chordAngle + (bulge > 0 ? Math.PI / 2 : -Math.PI / 2);
            
            const centerDistance = radius - sagitta;
            const centerX = midX + centerDistance * Math.cos(perpAngle);
            const centerY = midY + centerDistance * Math.sin(perpAngle);
            
            // Calculate I, J values (relative to start point)
            const i = centerX - startX;
            const j = centerY - startY;
            
            // Determine arc direction (bulge > 0 = counterclockwise, bulge < 0 = clockwise)
            const clockwise = bulge < 0;
            
            return { i, j, clockwise, centerX, centerY, radius };
            
        } catch (error) {
            console.warn('Error calculating arc from bulge:', error);
            return null;
        }
    }

    /**
     * Generate footer commands
     */
    generateFooter() {
        const lines = [];
        const config = this.config;

        // Add footer commands from configuration
        if (config.footer?.commands && Array.isArray(config.footer.commands)) {
            config.footer.commands.forEach(command => {
                lines.push(this.formatLine(command));
            });
        }

        return lines;
    }

    /**
     * Format a line with line number
     */
    formatLine(content) {
        const lineNumber = this.lineNumber;
        this.lineNumber += 10;
        return `${lineNumber} ${content}`;
    }

    /**
     * Load tools from configuration
     */
    loadToolsFromConfig(config) {
        const tools = [];
        
        if (config.tools && Array.isArray(config.tools)) {
            config.tools.forEach(tool => {
                tools.push({
                    id: tool.id || tool.ID,
                    name: tool.name || tool.Name,
                    priority: tool.priority || tool.Priority || 0
                });
            });
        }
        
        return tools.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Validate DIN content
     */
    validateDin(content) {
        const issues = [];
        
        if (!content || content.trim().length === 0) {
            issues.push('Empty DIN content');
        }
        
        // Check for basic G-code commands
        const hasG0 = content.includes('G0') || content.includes('G00');
        const hasG1 = content.includes('G1') || content.includes('G01');
        
        if (!hasG0 && !hasG1) {
            issues.push('No movement commands found');
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
}