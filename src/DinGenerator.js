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
        console.error('🔥 FIRE LOG - DinGenerator.generateDin() CALLED - THIS SHOULD ALWAYS APPEAR 🔥');
        console.warn('⚠️ WARNING LOG - If you see this, DinGenerator is working');
        console.info('ℹ️ INFO LOG - generateDin method entered');
        console.log('📝 NORMAL LOG - Standard console log');
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
            // Get unit conversion parameters
            const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
            const outputUnits = this.config.units?.system || 'mm';
            
            // Convert coordinates
            const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
            const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
            const convertedRadius = this.convertCoordinates(Math.abs(entity.radius), fileUnits, outputUnits);
            
            // Calculate start and end points
            const startAngle = entity.startAngle || 0;
            const endAngle = entity.endAngle || Math.PI * 2;
            
            const startX = convertedCenterX + convertedRadius * Math.cos(startAngle);
            const startY = convertedCenterY + convertedRadius * Math.sin(startAngle);
            const endX = convertedCenterX + convertedRadius * Math.cos(endAngle);
            const endY = convertedCenterY + convertedRadius * Math.sin(endAngle);
            
            const cx = convertedCenterX;
            const cy = convertedCenterY;
            const a0 = Math.atan2(startY - cy, startX - cx);
            const a1 = Math.atan2(endY - cy, endX - cx);
            const ccw = entity.clockwise === false; // clockwise true means CW; ccw if false
            let sweep = a1 - a0;
            
            // Intelligent full circle detection - consider multiple factors
            const sweepMagnitude = Math.abs(sweep);
            const isNearFullCircle = sweepMagnitude >= Math.PI * 1.7; // 306 degrees or more (more inclusive)
            const isExplicitFullCircle = (entity.startAngle === 0 && entity.endAngle === Math.PI * 2) || 
                                       (entity.startAngle === 0 && entity.endAngle === 0) ||
                                       (Math.abs(entity.startAngle - entity.endAngle) < 0.001);
            
            // Check if this is likely a legitimate full circle or U-shape
            const isLegitimateFullCircle = isExplicitFullCircle || isNearFullCircle;
            
            if (isLegitimateFullCircle) {
                sweep = ccw ? Math.PI * 2 : -Math.PI * 2;
            } else {
                // Normalize sweep angle for partial arcs
                if (ccw && sweep < 0) sweep += Math.PI * 2;
                if (!ccw && sweep > 0) sweep -= Math.PI * 2;
            }
            
            const totalArcLen = convertedRadius * Math.abs(sweep);
            if (!isFinite(totalArcLen) || totalArcLen === 0) return [];

            const bridgeCount = entity.bridgeCount || 0;
            const bridgeWidth = entity.bridgeWidth || 0;
            const totalBridgeLength = bridgeCount * bridgeWidth;
            const drawableLen = totalArcLen - totalBridgeLength;
            
            if (drawableLen <= 0) return [];
            const segmentLen = drawableLen / (bridgeCount + 1);
            
            // For full circles, we need to ensure we complete the full arc
            const isFullCircle = Math.abs(sweep) >= Math.PI * 1.9;

            // Helper to get point at arc length L from start
            const pointAtLen = (len) => {
                const dir = ccw ? 1 : -1;
                const theta = a0 + dir * (len / convertedRadius);
                return { 
                    x: cx + convertedRadius * Math.cos(theta), 
                    y: cy + convertedRadius * Math.sin(theta) 
                };
            };

            // Move to start
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
            let cursor = 0;
            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                let segEnd;
                
                if (i < bridgeCount) {
                    // Regular segment
                    segEnd = segStart + segmentLen;
                } else {
                    // Last segment - go to the end of the arc
                    if (isFullCircle) {
                        // For full circles, go back to the start point
                        segEnd = totalArcLen;
                    } else {
                        // For partial arcs, go to the calculated end
                        segEnd = drawableLen;
                    }
                }
                
                const p2 = pointAtLen(segEnd);

                // Draw arc segment from current position to p2 using I/J from center
                lines.push(this.formatLine(laserOnCmd));
                // Compute I/J from current point (pointAtLen(segStart))
                const p1 = pointAtLen(segStart);
                const iVal = cx - p1.x;
                const jVal = cy - p1.y;
                const arcCmd = ccw ? this.config.gcode.ccwArc : this.config.gcode.cwArc;
                lines.push(this.formatLine(`${arcCmd} X${p2.x.toFixed(3)} Y${p2.y.toFixed(3)} I${iVal.toFixed(3)} J${jVal.toFixed(3)}`));
                lines.push(this.formatLine(laserOffCmd));

                if (i < bridgeCount) {
                    // Rapid over the bridge gap along arc
                    const gapEnd = segEnd + bridgeWidth;
                    const pg = pointAtLen(gapEnd);
                    lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${pg.x.toFixed(3)} Y${pg.y.toFixed(3)}`));
                    cursor = gapEnd;
                }
            }
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
        const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Convert coordinates
        const startX = this.convertCoordinates(entity.start.x, fileUnits, outputUnits);
        const startY = this.convertCoordinates(entity.start.y, fileUnits, outputUnits);
        const endX = this.convertCoordinates(entity.end.x, fileUnits, outputUnits);
        const endY = this.convertCoordinates(entity.end.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Cut to end position
        lines.push(this.formatLine(`${this.config.gcode.linearMove} X${endX.toFixed(3)} Y${endY.toFixed(3)}`));
        
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
        const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Calculate start and end points with intelligent detection
        const startAngle = entity.startAngle || 0;
        const hasExplicitEndAngle = entity.endAngle !== undefined;
        const hasStartEndPoints = entity.start && entity.end;
        
        let endAngle;
        if (hasExplicitEndAngle) {
            endAngle = entity.endAngle;
        } else if (hasStartEndPoints) {
            endAngle = Math.atan2(entity.end.y - entity.center.y, entity.end.x - entity.center.x);
        } else {
            // Default to full circle only if no other information is available
            endAngle = Math.PI * 2;
        }
        
        const startX = entity.center.x + entity.radius * Math.cos(startAngle);
        const startY = entity.center.y + entity.radius * Math.sin(startAngle);
        const endX = entity.center.x + entity.radius * Math.cos(endAngle);
        const endY = entity.center.y + entity.radius * Math.sin(endAngle);
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedEndX = this.convertCoordinates(endX, fileUnits, outputUnits);
        const convertedEndY = this.convertCoordinates(endY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedStartX.toFixed(3)} Y${convertedStartY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Arc command - determine clockwise or counterclockwise
        let isClockwise = entity.clockwise;
        if (isClockwise === undefined) {
            // Calculate sweep angle to determine direction
            let sweepAngle = endAngle - startAngle;
            if (sweepAngle < 0) {
                sweepAngle += Math.PI * 2; // Normalize to positive
            }
            // Most DXF arcs are counterclockwise by default
            isClockwise = false;
        }
        
        const arcCommand = isClockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
        const i = convertedCenterX - convertedStartX;
        const j = convertedCenterY - convertedStartY;
        
        lines.push(this.formatLine(`${arcCommand} X${convertedEndX.toFixed(3)} Y${convertedEndY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`));
        
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
        const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';
        
        // Start at rightmost point of circle (0 degrees)
        const startX = entity.center.x + entity.radius;
        const startY = entity.center.y;
        
        // Convert coordinates
        const convertedStartX = this.convertCoordinates(startX, fileUnits, outputUnits);
        const convertedStartY = this.convertCoordinates(startY, fileUnits, outputUnits);
        const convertedCenterX = this.convertCoordinates(entity.center.x, fileUnits, outputUnits);
        const convertedCenterY = this.convertCoordinates(entity.center.y, fileUnits, outputUnits);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedStartX.toFixed(3)} Y${convertedStartY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Full circle as 360-degree clockwise arc
        // I and J are the center offset from current position
        const i = convertedCenterX - convertedStartX;
        const j = convertedCenterY - convertedStartY;
        
        lines.push(this.formatLine(`${this.config.gcode.cwArc} X${convertedStartX.toFixed(3)} Y${convertedStartY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`));
        
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
        const fileUnits = entity.fileUnits || this.metadata.fileUnits || 'mm';
        const outputUnits = this.config.units?.system || 'mm';

        // Move to first vertex
        const firstVertex = entity.vertices[0];
        const convertedFirstX = this.convertCoordinates(firstVertex.x, fileUnits, outputUnits);
        const convertedFirstY = this.convertCoordinates(firstVertex.y, fileUnits, outputUnits);
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${convertedFirstX.toFixed(3)} Y${convertedFirstY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Cut to each subsequent vertex
        for (let i = 1; i < entity.vertices.length; i++) {
            const vertex = entity.vertices[i];
            const convertedX = this.convertCoordinates(vertex.x, fileUnits, outputUnits);
            const convertedY = this.convertCoordinates(vertex.y, fileUnits, outputUnits);
            lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedX.toFixed(3)} Y${convertedY.toFixed(3)}`));
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