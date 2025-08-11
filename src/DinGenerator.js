/**
 * DIN File Generator
 * Converts DXF entities to DIN format using optimization algorithms
 */

const PathOptimizer = require('./PathOptimizer.js');

class DinGenerator {
    constructor() {
        this.optimizer = new PathOptimizer();
        this.currentTool = null;
        this.lineNumber = 1;
        this.config = null;
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
        this.lineNumber = config.lineNumbers?.startNumber || 10;
        this.currentTool = null;

        // Validate all entities can be mapped before processing
        const validationResult = this.validateEntityMappings(entities);
        if (!validationResult.valid) {
            throw new Error(`Cannot process file: ${validationResult.unmappedLayers.length} layers have no mapping rules: ${validationResult.unmappedLayers.join(', ')}`);
        }

        console.log(`DinGenerator: Processing ${entities.length} entities`);
        entities.forEach((entity, index) => {
            console.log(`Entity ${index}: ${entity.type} on layer '${entity.layer || 'unknown'}'`);
        });

        // Load tools with priority information
        const toolsWithPriority = this.loadToolsFromConfig(config);
        
        // Optimize entity order with full config access
        const optimizationSettings = {
            ...(config.optimization || {}),
            config: config  // Pass full config for priority phase access
        };
        
        // DEBUG: Log entities before optimization
        console.log('=== ENTITIES BEFORE OPTIMIZATION ===');
        entities.forEach((entity, index) => {
            console.log(`Entity ${index}:`, {
                type: entity.type,
                layer: entity.layer,
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                hasBridges: !!entity.bridges,
                bridgesLength: entity.bridges?.length
            });
        });
        console.log('=== END ENTITIES BEFORE OPTIMIZATION ===');
        
        const optimizedEntities = this.optimizer.optimizePaths(
            entities, 
            toolsWithPriority,
            optimizationSettings
        );
        
        // DEBUG: Log entities after optimization
        console.log('=== ENTITIES AFTER OPTIMIZATION ===');
        optimizedEntities.forEach((entity, index) => {
            console.log(`Optimized Entity ${index}:`, {
                type: entity.type,
                layer: entity.layer,
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                hasBridges: !!entity.bridges,
                bridgesLength: entity.bridges?.length
            });
        });
        console.log('=== END ENTITIES AFTER OPTIMIZATION ===');

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

        // 1. File information (with G253 F= format)
        if (config.header?.includeFileInfo) {
            if (config.header?.template) {
                const template = config.header.template
                    .replace('{filename}', filename)
                    .replace('{width}', metadata.width?.toFixed(1) || '0.0')
                    .replace('{height}', metadata.height?.toFixed(1) || '0.0')
                    .replace('{timestamp}', timestamp);
                
                lines.push(`{${template}}`);
            } else {
                // Fallback file information
                const width = metadata.width?.toFixed(1) || '0.0';
                const height = metadata.height?.toFixed(1) || '0.0';
                lines.push(`{${filename} / - Size: ${width} X ${height} / ${timestamp}}`);
            }
        }

        // 2. Program start marker (%1)
        if (config.header?.includeProgramStart !== false) {
            const programStart = config.header?.programStart || '%1';
            lines.push(programStart);
        }

        // 3. Drawing bounds (if enabled)
        if (config.header?.includeBounds && metadata.bounds) {
            const bounds = metadata.bounds;
            lines.push(`{ Bounds: X${bounds.minX.toFixed(1)} Y${bounds.minY.toFixed(1)} to X${bounds.maxX.toFixed(1)} Y${bounds.maxY.toFixed(1)} }`);
        }

        // 4. Operation count (Number of Sets)
        if (config.header?.includeSetCount && metadata.entityCount) {
            lines.push(`{Number of Sets: ${metadata.entityCount}}`);
        }

        // 5. File information again (with G253 F= format for machine)
        if (config.header?.includeFileInfo) {
            if (config.header?.template) {
                const template = config.header.template
                    .replace('{filename}', filename)
                    .replace('{width}', metadata.width?.toFixed(1) || '0.0')
                    .replace('{height}', metadata.height?.toFixed(1) || '0.0')
                    .replace('{timestamp}', timestamp);
                
                // Use German format for machine
                const germanTemplate = template
                    .replace('Size:', 'GROESSE:')
                    .replace('X', 'X');
                
                lines.push(`G253 F="${germanTemplate}"`);
            } else {
                // Fallback G253 format
                const width = metadata.width?.toFixed(1) || '0.0';
                const height = metadata.height?.toFixed(1) || '0.0';
                lines.push(`G253 F="${filename} / - GROESSE: ${width} X ${height} / ${timestamp}"`);
            }
        }

        // 6. Scaling parameters (if INCH machine selected)
        if (config.units?.feedInchMachine && config.units?.scalingHeader?.enabled) {
            if (config.units.scalingHeader.parameter) {
                lines.push(config.units.scalingHeader.parameter);
            }
            if (config.units.scalingHeader.scaleCommand) {
                lines.push(config.units.scalingHeader.scaleCommand);
            }
            if (config.units.scalingHeader.comment) {
                lines.push(`{ ${config.units.scalingHeader.comment} }`);
            }
        }

        return lines;
    }

    /**
     * Generate setup commands
     */
    generateSetupCommands() {
        const lines = [];
        
        if (this.config.header?.setupCommands) {
            this.config.header.setupCommands.forEach(command => {
                if (command.trim()) {
                    lines.push(this.formatLine(command.trim()));
                }
            });
        }

        return lines;
    }

    /**
     * Generate commands for all entities
     */
    generateEntityCommands(entities) {
        console.log('=== GENERATE ENTITY COMMANDS CALLED ===');
        console.log('Number of entities:', entities.length);
        
        const lines = [];
        
        const shouldHandleBridges = !!this.config?.bridges?.enabled;
        
        // DEBUG: Log bridge configuration
        console.log('=== DIN GENERATOR BRIDGE DEBUG ===');
        console.log('Bridge configuration:', {
            configBridges: this.config?.bridges,
            shouldHandleBridges: shouldHandleBridges,
            configOutputSettings: this.config?.outputSettings
        });
        console.log('=== END BRIDGE CONFIG DEBUG ===');

        entities.forEach(entity => {
            // Check if tool change is needed
            const requiredTool = this.getRequiredTool(entity);
            
            // If no tool is found, skip this entity completely
            if (!requiredTool) {
                console.log(`Skipping entity (${entity.type}) - no tool mapping found`);
                return; // Skip to next entity
            }
            
            // If tool is intentionally set to skip, skip this entity
            if (requiredTool.skip) {
                console.log(`Skipping entity (${entity.type}) - tool set to 'none' (construction/non-machined)`);
                return; // Skip to next entity
            }
            
            // Check if tool change is needed
            if (requiredTool.id !== this.currentTool?.id) {
                lines.push(...this.generateToolChange(requiredTool));
                this.currentTool = requiredTool;
            }

            // DEBUG: Log bridge condition check
            const bridgeCondition = shouldHandleBridges && (entity.type === 'LINE' || entity.type === 'ARC') && (entity.bridgeCount || 0) > 0 && (entity.bridgeWidth || 0) > 0;
            console.log(`Entity ${entity.type} bridge condition:`, {
                shouldHandleBridges,
                isLineOrArc: (entity.type === 'LINE' || entity.type === 'ARC'),
                bridgeCount: entity.bridgeCount || 0,
                bridgeWidth: entity.bridgeWidth || 0,
                bridgeCondition: bridgeCondition,
                entityBridgeData: {
                    bridgeCount: entity.bridgeCount,
                    bridgeWidth: entity.bridgeWidth,
                    bridges: entity.bridges
                }
            });
            
            // Generate entity-specific commands (with bridge splitting if enabled)
            if (bridgeCondition) {
                console.log(`✅ Using generateEntityDinWithBridges for ${entity.type}`);
                lines.push(...this.generateEntityDinWithBridges(entity));
            } else {
                console.log(`❌ Using generateEntityDin for ${entity.type}`);
                lines.push(...this.generateEntityDin(entity));
            }
        });

        return lines;
    }

    /**
     * Generate tool change commands
     */
    generateToolChange(tool) {
        const lines = [];
        const config = this.config;



        // Clean up tool properties - remove extra whitespace and newlines
        const cleanHCode = tool.hCode ? tool.hCode.trim().replace(/\s+/g, ' ') : null;
        const cleanName = tool.name ? tool.name.trim().replace(/\s+/g, ' ') : null;



        // Create properly formatted tool change command
        if (cleanHCode) {
            const comment = cleanName ? `{${cleanName}}` : '';
            const toolChangeCommand = `${cleanHCode} M6 ${comment}`;
    
            lines.push(this.formatLine(toolChangeCommand));
        } else {
            // Fallback if H-code not available
            if (cleanName) {
                lines.push(this.formatLine(`M6 {${cleanName}}`));
            } else {
                lines.push(this.formatLine('M6'));
            }
        }
        return lines;
    }

    /**
     * Generate DIN commands for a specific entity
     */
    generateEntityDin(entity) {
        const lines = [];

        switch (entity.type) {
            case 'LINE':
                lines.push(...this.generateLineDin(entity));
                break;
            case 'ARC':
                lines.push(...this.generateArcDin(entity));
                break;
            case 'CIRCLE':
                lines.push(...this.generateCircleDin(entity));
                break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
                lines.push(...this.generatePolylineDin(entity));
                break;
            default:
                console.warn(`Unsupported entity type: ${entity.type}`);
        }

        return lines;
    }

    /**
     * Generate DIN for LINE/ARC entities honoring bridge gaps by splitting motion
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
            const start = entity.start;
            const end = entity.end;
            const lineVecX = end.x - start.x;
            const lineVecY = end.y - start.y;
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
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`));
            let cursor = 0;

            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                const segEnd = (i < bridgeCount) ? (segStart + segmentLen) : drawableLen;
                const p1x = start.x + ux * segStart;
                const p1y = start.y + uy * segStart;
                const p2x = start.x + ux * segEnd;
                const p2y = start.y + uy * segEnd;

                // Draw segment
                lines.push(this.formatLine(laserOnCmd));
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${p2x.toFixed(3)} Y${p2y.toFixed(3)}`));
                lines.push(this.formatLine(laserOffCmd));

                // Skip bridge by rapid move over gap (keep laser off)
                if (i < bridgeCount) {
                    const gapStart = segEnd;
                    const gapEnd = gapStart + bridgeWidth;
                    const g1x = start.x + ux * gapStart;
                    const g1y = start.y + uy * gapStart;
                    const g2x = start.x + ux * gapEnd;
                    const g2y = start.y + uy * gapEnd;
                    lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${g2x.toFixed(3)} Y${g2y.toFixed(3)}`));
                    cursor = gapEnd;
                }
            }

            return lines;
        }

        if (entity.type === 'ARC') {
            // Approximate splitting along arc length using entity.center, radius, start/end angles
            const cx = entity.center?.x;
            const cy = entity.center?.y;
            if (cx === undefined || cy === undefined || entity.radius === undefined) return [];

            // Derive start/end angles from given start/end points
            const a0 = Math.atan2(entity.start.y - cy, entity.start.x - cx);
            const a1 = Math.atan2(entity.end.y - cy, entity.end.x - cx);
            const ccw = entity.clockwise === false; // clockwise true means CW; ccw if false
            let sweep = a1 - a0;
            if (ccw && sweep < 0) sweep += Math.PI * 2;
            if (!ccw && sweep > 0) sweep -= Math.PI * 2;
            const totalArcLen = Math.abs(entity.radius) * Math.abs(sweep);
            if (!isFinite(totalArcLen) || totalArcLen === 0) return [];

            const bridgeCount = entity.bridgeCount || 0;
            const bridgeWidth = entity.bridgeWidth || 0;
            const totalBridgeLength = bridgeCount * bridgeWidth;
            const drawableLen = totalArcLen - totalBridgeLength;
            if (drawableLen <= 0) return [];
            const segmentLen = drawableLen / (bridgeCount + 1);

            // Helper to get point at arc length L from start
            const pointAtLen = (len) => {
                const dir = ccw ? 1 : -1;
                const theta = a0 + dir * (len / Math.abs(entity.radius));
                return { x: cx + Math.abs(entity.radius) * Math.cos(theta), y: cy + Math.abs(entity.radius) * Math.sin(theta) };
            };

            // Move to start
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${entity.start.x.toFixed(3)} Y${entity.start.y.toFixed(3)}`));
            let cursor = 0;
            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                const segEnd = (i < bridgeCount) ? (segStart + segmentLen) : drawableLen;
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

        // Fallback
        return this.generateEntityDin(entity);
    }

    /**
     * Generate DIN for LINE entity
     */
    generateLineDin(entity) {
        const lines = [];
        
        // Validate that start and end points exist
        if (!entity.start || !entity.end || 
            entity.start.x === undefined || entity.start.y === undefined ||
            entity.end.x === undefined || entity.end.y === undefined) {
            console.warn('LINE entity missing start or end coordinates:', entity);
            return [];
        }
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${entity.start.x.toFixed(3)} Y${entity.start.y.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Cut to end position
        lines.push(this.formatLine(`${this.config.gcode.linearMove} X${entity.end.x.toFixed(3)} Y${entity.end.y.toFixed(3)}`));
        
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
        
        // Validate that center point and radius exist
        if (!entity.center || entity.center.x === undefined || entity.center.y === undefined || 
            entity.radius === undefined) {
            console.warn('ARC entity missing center coordinates or radius:', entity);
            return [];
        }
        
        // Calculate start and end points
        const startAngle = entity.startAngle || 0;
        const endAngle = entity.endAngle || Math.PI * 2;
        
        const startX = entity.center.x + entity.radius * Math.cos(startAngle);
        const startY = entity.center.y + entity.radius * Math.sin(startAngle);
        const endX = entity.center.x + entity.radius * Math.cos(endAngle);
        const endY = entity.center.y + entity.radius * Math.sin(endAngle);
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Arc command - determine clockwise or counterclockwise
        // In DXF, if startAngle > endAngle, it's typically a clockwise arc
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
        const i = entity.center.x - startX;
        const j = entity.center.y - startY;
        
        lines.push(this.formatLine(`${arcCommand} X${endX.toFixed(3)} Y${endY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`));
        
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
        
        // Validate that center point and radius exist
        if (!entity.center || entity.center.x === undefined || entity.center.y === undefined || 
            entity.radius === undefined) {
            console.warn('CIRCLE entity missing center coordinates or radius:', entity);
            return [];
        }
        
        // Start at rightmost point of circle
        const startX = entity.center.x + entity.radius;
        const startY = entity.center.y;
        
        // Move to start position
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${startX.toFixed(3)} Y${startY.toFixed(3)}`));
        
        // Laser on
        if (this.config.laser?.comments?.enabled) {
            lines.push(this.formatLine(`${this.config.laser.laserOn} { ${this.config.laser.comments.onCommand || 'LASER ON'} }`));
        } else {
            lines.push(this.formatLine(this.config.laser.laserOn));
        }
        
        // Full circle as 360-degree arc
        const i = -entity.radius;
        const j = 0;
        
        lines.push(this.formatLine(`${this.config.gcode.cwArc} X${startX.toFixed(3)} Y${startY.toFixed(3)} I${i.toFixed(3)} J${j.toFixed(3)}`));
        
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
            console.warn('POLYLINE entity has insufficient vertices:', entity);
            return lines;
        }

        // Validate first vertex coordinates
        const firstVertex = entity.vertices[0];
        if (!firstVertex || firstVertex.x === undefined || firstVertex.y === undefined) {
            console.warn('POLYLINE entity has invalid first vertex coordinates:', entity);
            return lines;
        }

        // Move to first vertex
        lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${firstVertex.x.toFixed(3)} Y${firstVertex.y.toFixed(3)}`));
        
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
            
            // Validate vertex coordinates
            if (!vertex || vertex.x === undefined || vertex.y === undefined) {
                console.warn(`POLYLINE vertex ${i} has invalid coordinates:`, vertex);
                continue;
            }
            
            // Check if previous vertex has a bulge value (indicating an arc segment)
            if (prevVertex.bulge && Math.abs(prevVertex.bulge) > 0.001) {
                // Generate arc command using bulge value
                const arcData = this.calculateArcFromBulge(prevVertex, vertex, prevVertex.bulge);
                if (arcData) {
                    const arcCommand = arcData.clockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
                    lines.push(this.formatLine(`${arcCommand} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)} I${arcData.i.toFixed(3)} J${arcData.j.toFixed(3)}`));
                } else {
                    // Fallback to linear move if arc calculation fails
                    lines.push(this.formatLine(`${this.config.gcode.linearMove} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)}`));
                }
            } else {
                // Standard linear move
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)}`));
            }
        }
        
        // Close polyline if specified
        if (entity.closed && entity.vertices.length > 2) {
            lines.push(this.formatLine(`${this.config.gcode.linearMove} X${firstVertex.x.toFixed(3)} Y${firstVertex.y.toFixed(3)}`));
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
        
        // Return to home position
        if (this.config.gcode?.homeCommand) {
            lines.push(this.formatLine(this.config.gcode.homeCommand));
        }
        
        // Program end
        if (this.config.gcode?.programEnd) {
            // Handle both string and array formats
            if (Array.isArray(this.config.gcode.programEnd)) {
                this.config.gcode.programEnd.forEach(command => {
                    if (command.trim()) {
                        lines.push(this.formatLine(command));
                    }
                });
            } else {
                lines.push(this.formatLine(this.config.gcode.programEnd));
            }
        }

        // Add a line feed after the last program end command
        if (lines.length > 0) {
            lines.push(''); // Empty line for line feed
        }

        return lines;
    }

    /**
     * Format a line with line numbers if enabled
     */
    formatLine(command) {
        // Always add line numbers for DIN files
        const format = this.config.lineNumbers?.format || 'N{number}';
        const lineNumber = format.replace('{number}', this.lineNumber);
        this.lineNumber += this.config.lineNumbers?.increment || 1;
        
        // Clean command - remove all newlines and extra whitespace, but preserve single spaces
        const cleanCommand = command.trim().replace(/\s+/g, ' ').replace(/\s+$/, '');
        
        // Ensure line number and command are on the same line with proper spacing
        const result = `${lineNumber} ${cleanCommand}`;

        return result;
    }

    /**
     * Get required tool for entity based on 2-step workflow mapping
     */
    getRequiredTool(entity) {
        // Check for mapping workflow in the correct location
        if (!this.config.mappingWorkflow && !this.config.lineTypeMappings) {
            console.warn('No mapping configuration found in config');
            return null;
        }

        // Step 1: Layer/Color → Line Type
        const lineType = this.determineLineType(entity);

        // Handle null line type - this means no mapping was found
        if (lineType === null) {
            console.warn(`No line type mapping found for layer: ${entity.layer}. Please create an import filter rule for this layer.`);
            return null;
        }
        
        // Step 2: Line Type → Tool
        const toolId = this.getToolFromLineType(lineType);

        // Check if no tool mapping was found at all
        if (!toolId) {
            console.warn(`No tool mapping found for line type: ${lineType}, skipping entity`);
            return null; // Skip this entity
        }
        
        // Check if tool is 'none' - this means skip the entity (valid mapping)
        if (toolId === 'none') {
            console.log(`Tool mapping is 'none' for line type: ${lineType}, skipping entity as intended`);
            return { skip: true }; // Special object to indicate intentional skip
        }
        
        // Normal tool mapping
        const toolName = this.getToolName(toolId);
        const toolHCode = this.getToolHCode(toolId);
        
        if (toolHCode) {
            return {
                id: toolId,
                name: toolName,
                hCode: toolHCode
            };
        } else {
            console.warn(`No H-code found for tool ${toolId}, skipping entity`);
            return null;
        }
    }

    /**
     * Determine line type from entity layer and color (Step 1 of workflow)
     */
    determineLineType(entity) {
        console.log(`Determining line type for entity:`, {
            type: entity.type,
            layer: entity.layer,
            color: entity.color,
            lineType: entity.lineType,
            lineTypeId: entity.lineTypeId
        });
        
        // Priority 1: Check global import filter for layer mapping
        if (entity.layer && this.config.globalImportFilter && this.config.globalImportFilter.rules) {
            const rules = this.config.globalImportFilter.rules;
            
            // Find matching rule by layer name
            const layerRule = rules.find(rule => 
                rule.layerName && rule.layerName.toUpperCase() === entity.layer.toUpperCase()
            );
            
            if (layerRule && layerRule.lineTypeId) {
                // Convert lineTypeId to line type name
                const lineTypeName = this.getLineTypeNameFromId(layerRule.lineTypeId);
                if (lineTypeName) {
                    console.log(`Found global import filter mapping: ${entity.layer} -> lineTypeId: ${layerRule.lineTypeId} -> ${lineTypeName}`);
                    return lineTypeName;
                } else {
                    console.warn(`LineTypeId ${layerRule.lineTypeId} not found in line types library`);
                }
            }
        }
        
        // Priority 2: Use actual line type from DXF if available
        if (entity.lineType && entity.lineType !== 'BYLAYER' && entity.lineType !== 'CONTINUOUS') {
            console.log(`Using DXF line type: ${entity.lineType}`);
            return entity.lineType;
        }
        
        // Priority 3: Convert line type ID to name if available
        if (entity.lineTypeId) {
            const lineTypeName = this.getLineTypeNameFromId(entity.lineTypeId);
            if (lineTypeName) {
                console.log(`Converted lineTypeId ${entity.lineTypeId} to: ${lineTypeName}`);
                return lineTypeName;
            }
        }
        
        // Priority 4: Entity type override for special cases
        if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
            return 'engraving';
        }
        if (entity.type === 'DIMENSION' || entity.type === 'LEADER') {
            return 'construction';
        }

        // Priority 5: Fallback to legacy layer mapping (for backward compatibility)
        if (entity.layer && this.config.mappingWorkflow && this.config.mappingWorkflow.layerToLineType) {
            const layerMappings = this.config.mappingWorkflow.layerToLineType;
            
            // Direct lookup for simple key-value mapping
            if (layerMappings[entity.layer]) {
                console.log(`Found legacy layer mapping: ${entity.layer} -> ${layerMappings[entity.layer]}`);
                return layerMappings[entity.layer];
            }
            
            // Check for exact layer name match in array format (legacy)
            const mappings = Array.isArray(layerMappings) ? layerMappings : Object.values(layerMappings || {});
            for (const mapping of mappings) {
                if (mapping.layer && mapping.layer.toUpperCase() === entity.layer.toUpperCase()) {
                    console.log(`Found array layer mapping: ${entity.layer} -> ${mapping.lineType}`);
                    return mapping.lineType;
                }
            }
        }

        // Priority 6: Color to line type mapping (fallback)
        if (entity.color !== undefined && this.config.mappingWorkflow && this.config.mappingWorkflow.colorToLineType) {
            const colorMappings = this.config.mappingWorkflow.colorToLineType;
            
            // Direct lookup for simple key-value mapping
            if (colorMappings[entity.color]) {
                console.log(`Found color mapping: ${entity.color} -> ${colorMappings[entity.color]}`);
                return colorMappings[entity.color];
            }
            
            // Check configured color mappings in array format (legacy)
            const mappings = Array.isArray(colorMappings) ? colorMappings : Object.values(colorMappings || {});
            for (const mapping of mappings) {
                if (mapping.color && parseInt(mapping.color) === entity.color) {
                    console.log(`Found array color mapping: ${entity.color} -> ${mapping.lineType}`);
                    return mapping.lineType;
                }
            }
        }

        // No mapping found - this is intentional, no automatic fallbacks
        console.warn(`No line type mapping found for entity on layer: ${entity.layer}`);
        console.warn(`Please create an import filter rule for this layer.`);
        return null;
    }

    /**
     * Get tool from line type (Step 2 of workflow)
     */
    getToolFromLineType(lineType) {
        // Handle Global Import Filter workflow - map line type names to tools
        const lineTypeToToolMap = {
            // Engraving tools
            'Fast Engrave': 'T20',
            'Nozzle Engrave': 'T33', 
            'Engrave': 'T20',
            
            // Cutting tools
            '1pt CW': 'T1',
            '2pt CW': 'T2', 
            '3pt CW': 'T3',
            '4pt CW': 'T4',
            'Fine Cut CW': 'T22',
            'Fine Cut Pulse': 'T22',
            'Cut CW': 'T2',
            
            // Pulsing tools  
            '1pt Puls': 'T12',
            '2pt Puls': 'T12',
            '3pt Puls': 'T13', 
            '4pt Puls': 'T14',
            '1.5pt Puls': 'T12',
            
            // Bridge tools
            '2pt Bridge': 'T2',
            '3pt Bridge': 'T3',
            '4pt Bridge': 'T4',
            
            // Milling tools
            'Milling 1': 'T100',
            'Milling 2': 'T101',
            'Milling 3': 'T102',
            'Milling 4': 'T103',
            'Milling 5': 'T104',
            'Milling 6': 'T105',
            'Milling 7': 'T106', 
            'Milling 8': 'T107',
            
            // Special tools
            'Groove': 'T3',
            'Pulse_1': 'T12',
            'Pulse_2': 'T13',
            'Piercing': 'T35'
        };
        
        console.log(`Looking for tool mapping for line type: "${lineType}"`);
        
        // Direct lookup in the line type to tool map
        if (lineTypeToToolMap[lineType]) {
            console.log(`Found direct line type mapping: ${lineType} -> ${lineTypeToToolMap[lineType]}`);
            return lineTypeToToolMap[lineType];
        }
        
        // Fallback to legacy mapping workflow if available
        if (this.config.mappingWorkflow?.lineTypeToTool) {
            const lineTypeMappings = this.config.mappingWorkflow.lineTypeToTool;
            
            console.log(`Trying legacy mappings for: "${lineType}"`);
            console.log(`Available legacy mappings:`, lineTypeMappings);
            
            // Direct lookup for simple key-value mapping
            if (lineTypeMappings[lineType]) {
                console.log(`Found legacy direct mapping: ${lineType} -> ${lineTypeMappings[lineType].tool}`);
                return lineTypeMappings[lineType].tool;
            }
            
            // Legacy support: check array format
            const mappings = Array.isArray(lineTypeMappings) ? lineTypeMappings : Object.values(lineTypeMappings || {});
            for (const mapping of mappings) {
                if (mapping.lineType && mapping.lineType === lineType) {
                    console.log(`Found legacy array match! Tool: ${mapping.tool}`);
                    return mapping.tool;
                }
            }
        }
        
        console.warn(`No tool mapping found for line type: ${lineType}`);
        return null;
    }

    /**
     * Get line type name from ID
     */
    getLineTypeNameFromId(lineTypeId) {
        // Use line types from config if available (CSV data)
        if (this.config.lineTypesLibrary && Array.isArray(this.config.lineTypesLibrary)) {
            const lineType = this.config.lineTypesLibrary.find(lt => lt.id === lineTypeId || lt.id === String(lineTypeId));
            if (lineType) {
                console.log(`Found line type for ID ${lineTypeId}: ${lineType.name}`);
                return lineType.name;
            }
        }
        
        // Fallback to hardcoded map if CSV data not available
        const lineTypeMap = {
            '1': '1pt CW',
            '2': '2pt CW',
            '3': '3pt CW',
            '4': '4pt CW',
            '5': '2pt Puls',
            '6': '3pt Puls',
            '7': '4pt Puls',
            '8': '1.5pt CW',
            '9': '1pt Puls',
            '10': '1.5pt Puls',
            '11': 'Fast Engrave',
            '12': 'Fine Cut Pulse',
            '13': 'Fine Cut CW',
            '14': '2pt Bridge',
            '15': '3pt Bridge',
            '16': '4pt Bridge',
            '17': 'Nozzle Engrave',
            '18': 'Groove',
            '19': 'Cut CW',
            '20': 'Pulse_1',
            '21': 'Pulse_2',
            '22': 'Engrave',
            '23': 'Milling 1',
            '24': 'Milling 2',
            '25': 'Milling 3',
            '26': 'Milling 4',
            '27': 'Milling 5',
            '28': 'Milling 6',
            '29': 'Milling 7',
            '30': 'Milling 8'
        };
        const result = lineTypeMap[lineTypeId] || null;

        return result;
    }

    /**
     * Get tool name from tool ID
     */
    getToolName(toolId) {
        // Get tool name from configuration only
        if (this.config.tools && this.config.tools[toolId] && this.config.tools[toolId].name) {
            return this.config.tools[toolId].name;
        }
        
        console.warn(`No tool name found for tool ID: ${toolId}`);
        return toolId;
    }

    /**
     * Get H-code for tool ID
     */
    getToolHCode(toolId) {
        // Get H-code from configuration only
        if (this.config.tools && this.config.tools[toolId] && this.config.tools[toolId].hCode) {
            return this.config.tools[toolId].hCode;
        }
        
        console.warn(`No H-code found for tool ID: ${toolId}`);
        return null;
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
     * Load tools from configuration with priority information
     */
    loadToolsFromConfig(config) {
        const tools = config.tools || {};
        
        // Add priority information to tools if available
        if (config.optimization?.priority?.items) {
            const priorityItems = config.optimization.priority.items;
            
            // Create a map of tool ID to priority order
            const priorityMap = new Map();
            priorityItems.forEach(item => {
                if (item.value && item.value !== '__LINE_BREAK__') {
                    priorityMap.set(item.value, item.order);
                }
            });
            
            // Add priority to each tool
            Object.keys(tools).forEach(toolId => {
                if (priorityMap.has(toolId)) {
                    tools[toolId].priority = priorityMap.get(toolId);
                } else {
                    tools[toolId].priority = 999; // Default low priority
                }
            });
        }
        

        return tools;
    }

    /**
     * Generate preview of DIN file (first 50 lines)
     */
    generatePreview(entities, config, metadata) {
        const fullDin = this.generateDin(entities, config, metadata);
        const lines = fullDin.split('\n');
        
        if (lines.length <= 50) {
            return fullDin;
        }
        
        const preview = lines.slice(0, 45);
        preview.push('...');
        preview.push(`{ ${lines.length - 45} more lines`);
        preview.push(...lines.slice(-3));
        
        return preview.join('\n');
    }

    /**
     * Validate DIN output
     */
    validateDin(dinContent) {
        const lines = dinContent.split('\n');
        const issues = [];
        
        // Check for basic DIN structure
        const hasLaserOn = lines.some(line => line.includes('M14'));
        const hasLaserOff = lines.some(line => line.includes('M15'));
        const hasMovement = lines.some(line => line.includes('G0') || line.includes('G1'));
        
        if (!hasLaserOn) issues.push('Warning: No laser ON commands found');
        if (!hasLaserOff) issues.push('Warning: No laser OFF commands found');
        if (!hasMovement) issues.push('Error: No movement commands found');
        
        // Check for balanced laser on/off commands
        const laserOnCount = lines.filter(line => line.includes('M14')).length;
        const laserOffCount = lines.filter(line => line.includes('M15')).length;
        
        if (laserOnCount !== laserOffCount) {
            issues.push(`Warning: Unbalanced laser commands (${laserOnCount} ON, ${laserOffCount} OFF)`);
        }
        
        return {
            valid: issues.filter(issue => issue.startsWith('Error')).length === 0,
            issues: issues,
            stats: {
                totalLines: lines.length,
                laserOnCommands: laserOnCount,
                laserOffCommands: laserOffCount,
                movementCommands: lines.filter(line => line.includes('G0') || line.includes('G1')).length
            }
        };
    }

    /**
     * Validate that all entities in the file can be mapped to tools
     * Returns validation result with unmapped layers
     */
    validateEntityMappings(entities) {
        const unmappedLayers = new Set();
        
        for (const entity of entities) {
            const lineType = this.determineLineType(entity);
            if (!lineType) {
                unmappedLayers.add(entity.layer || 'unknown');
                continue;
            }
            
            const tool = this.getToolFromLineType(lineType);
            if (!tool) {
                unmappedLayers.add(entity.layer || 'unknown');
            }
        }
        
        return {
            valid: unmappedLayers.size === 0,
            unmappedLayers: Array.from(unmappedLayers)
        };
    }
}

module.exports = DinGenerator;