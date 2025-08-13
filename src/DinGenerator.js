/**
 * DIN File Generator
 * Converts DXF entities to DIN format using optimization algorithms
 */

import PathOptimizer from './PathOptimizer.js';

class DinGenerator {
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
        console.log(`Unit conversion: ${fileUnits} → ${outputUnits}`);

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

        // 6. Scaling parameters (from DIN file structure)
        if (config.structure?.header) {
            const scalingElement = config.structure.header.find(el => el.type === 'scaling');
            if (scalingElement && scalingElement.enabled && scalingElement.config) {
                // Add scaling commands
                if (scalingElement.config.commands) {
                    const commands = scalingElement.config.commands.split('\n').filter(cmd => cmd.trim());
                    commands.forEach(command => {
                        if (command.trim()) {
                            lines.push(command.trim());
                        }
                    });
                }
                // Note: Scaling comment is removed as per user request
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
                const bridgeLines = this.generateEntityDinWithBridges(entity);
                console.log(`Generated ${bridgeLines.length} lines for bridged entity`);
                lines.push(...bridgeLines);
            } else {
                console.log(`❌ Using generateEntityDin for ${entity.type}`);
                const entityLines = this.generateEntityDin(entity);
                console.log(`Generated ${entityLines.length} lines for normal entity`);
                lines.push(...entityLines);
            }
        });

        console.log(`=== GENERATE ENTITY COMMANDS COMPLETE ===`);
        console.log(`Total lines generated: ${lines.length}`);
        console.log('First few lines:', lines.slice(0, 5));
        console.log('Last few lines:', lines.slice(-5));
        
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
            console.log('=== LINE ENTITY DEBUG IN generateEntityDinWithBridges ===');
            console.log('Entity:', entity);
            console.log('Start:', entity.start);
            console.log('End:', entity.end);
            console.log('Bridge data:', {
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                bridges: entity.bridges
            });
            
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
            
            console.log('=== LINE BRIDGE CALCULATION ===');
            console.log('totalLen:', totalLen);
            console.log('bridgeCount:', bridgeCount);
            console.log('bridgeWidth:', bridgeWidth);
            console.log('totalBridgeLength:', totalBridgeLength);
            console.log('drawableLen:', drawableLen);
            console.log('segmentLen:', segmentLen);

            // Move to start
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${start.x.toFixed(3)} Y${start.y.toFixed(3)}`));
            let cursor = 0;

            for (let i = 0; i <= bridgeCount; i++) {
                const segStart = cursor;
                let segEnd;
                
                if (i < bridgeCount) {
                    // Regular segment
                    segEnd = segStart + segmentLen;
                } else {
                    // Last segment - go to the end of the line
                    segEnd = totalLen;
                }
                
                console.log(`LINE Segment ${i}: start=${segStart.toFixed(3)}, end=${segEnd.toFixed(3)}, totalLen=${totalLen.toFixed(3)}`);
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

            console.log('✅ LINE Bridge processing completed. Generated', lines.length, 'lines');
            return lines;
        }

        if (entity.type === 'ARC') {
            // DEBUG: Log the arc entity structure
            console.log('=== ARC ENTITY DEBUG IN generateEntityDinWithBridges ===');
            console.log('Entity:', entity);
            console.log('Center:', entity.center);
            console.log('Radius:', entity.radius);
            console.log('Start:', entity.start);
            console.log('End:', entity.end);
            console.log('Clockwise:', entity.clockwise);
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

        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
            console.log('=== POLYLINE ENTITY DEBUG IN generateEntityDinWithBridges ===');
            console.log('Entity:', entity);
            console.log('Vertices:', entity.vertices);
            console.log('Closed:', entity.closed);
            console.log('Bridge data:', {
                bridgeCount: entity.bridgeCount,
                bridgeWidth: entity.bridgeWidth,
                bridges: entity.bridges
            });
            
            if (!entity.vertices || entity.vertices.length < 2) {
                console.log('❌ POLYLINE has insufficient vertices');
                return [];
            }

            // For now, we'll process each segment of the polyline individually
            // This is a simplified approach - in a more sophisticated implementation,
            // we would need to handle bridges across the entire polyline path
            
            const firstVertex = entity.vertices[0];
            lines.push(this.formatLine(`${this.config.gcode.rapidMove} X${firstVertex.x.toFixed(3)} Y${firstVertex.y.toFixed(3)}`));
            
            // Process each segment
            for (let i = 1; i < entity.vertices.length; i++) {
                const prevVertex = entity.vertices[i - 1];
                const vertex = entity.vertices[i];
                
                // Check if previous vertex has a bulge value (indicating an arc segment)
                if (prevVertex.bulge && Math.abs(prevVertex.bulge) > 0.001) {
                    // For arc segments, we'll use the regular arc processing
                    // This is a simplified approach - ideally we'd handle bridges on arc segments too
                    const arcData = this.calculateArcFromBulge(prevVertex, vertex, prevVertex.bulge);
                    if (arcData) {
                        lines.push(this.formatLine(laserOnCmd));
                        const arcCommand = arcData.clockwise ? this.config.gcode.cwArc : this.config.gcode.ccwArc;
                        lines.push(this.formatLine(`${arcCommand} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)} I${arcData.i.toFixed(3)} J${arcData.j.toFixed(3)}`));
                        lines.push(this.formatLine(laserOffCmd));
                    } else {
                        // Fallback to linear move
                        lines.push(this.formatLine(laserOnCmd));
                        lines.push(this.formatLine(`${this.config.gcode.linearMove} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)}`));
                        lines.push(this.formatLine(laserOffCmd));
                    }
                } else {
                    // For line segments, we'll use the regular line processing
                    // This is a simplified approach - ideally we'd handle bridges on line segments too
                    lines.push(this.formatLine(laserOnCmd));
                    lines.push(this.formatLine(`${this.config.gcode.linearMove} X${vertex.x.toFixed(3)} Y${vertex.y.toFixed(3)}`));
                    lines.push(this.formatLine(laserOffCmd));
                }
            }
            
            // Close polyline if specified
            if (entity.closed && entity.vertices.length > 2) {
                lines.push(this.formatLine(laserOnCmd));
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${firstVertex.x.toFixed(3)} Y${firstVertex.y.toFixed(3)}`));
                lines.push(this.formatLine(laserOffCmd));
            }
            
            console.log('✅ POLYLINE Bridge processing completed. Generated', lines.length, 'lines');
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
        
        // Get unit conversion parameters
        const fileUnits = this.metadata.fileUnits || 'mm';
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
        
        // Start at rightmost point of circle
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
        
        // Full circle as 360-degree arc
        const convertedRadius = this.convertCoordinates(entity.radius, fileUnits, outputUnits);
        const i = -convertedRadius;
        const j = 0;
        
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
        const fileUnits = this.metadata.fileUnits || 'mm';
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
                    lines.push(this.formatLine(`${arcCommand} X${convertedVertexX.toFixed(3)} Y${convertedVertexY.toFixed(3)} I${convertedI.toFixed(3)} J${convertedJ.toFixed(3)}`));
                } else {
                    // Fallback to linear move if arc calculation fails
                    lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedVertexX.toFixed(3)} Y${convertedVertexY.toFixed(3)}`));
                }
            } else {
                // Standard linear move
                lines.push(this.formatLine(`${this.config.gcode.linearMove} X${convertedVertexX.toFixed(3)} Y${convertedVertexY.toFixed(3)}`));
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

        
        if (toolId && toolId !== 'none') {
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
        
        console.warn(`No tool mapping found for line type: ${lineType}, skipping entity`);
        return null; // Skip this entity
    }

    /**
     * Determine line type from entity layer and color (Step 1 of workflow)
     */
    determineLineType(entity) {
        console.log(`Determining line type for entity:`, {
            type: entity.type,
            layer: entity.layer,
            lineType: entity.lineType,
            lineTypeId: entity.lineTypeId
        });
        
        // Priority 1: Use actual line type from DXF if available
        if (entity.lineType && entity.lineType !== 'BYLAYER' && entity.lineType !== 'CONTINUOUS') {
            console.log(`Using DXF line type: ${entity.lineType}`);
            return entity.lineType;
        }
        
        // Priority 2: Convert line type ID to name if available
        if (entity.lineTypeId) {
            const lineTypeName = this.getLineTypeNameFromId(entity.lineTypeId);
            if (lineTypeName) {
                console.log(`Converted lineTypeId ${entity.lineTypeId} to: ${lineTypeName}`);
                return lineTypeName;
            }
        }
        
        // Priority 3: Entity type override for special cases
        if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
            return 'engraving';
        }
        if (entity.type === 'DIMENSION' || entity.type === 'LEADER') {
            return 'construction';
        }

        // Priority 2: Layer to line type mapping
        if (entity.layer && this.config.mappingWorkflow?.layerToLineType) {
            const layerMappings = this.config.mappingWorkflow.layerToLineType;
            
            // Check for exact layer name match first
            const mappings = Array.isArray(layerMappings) ? layerMappings : Object.values(layerMappings || {});
            for (const mapping of mappings) {
                if (mapping.layer && mapping.layer.toUpperCase() === entity.layer.toUpperCase()) {
                    return mapping.lineType;
                }
            }
            
            // No fallback mapping - rely only on configured mappings
        }

        // Priority 3: Color to line type mapping
        if (entity.color !== undefined && this.config.mappingWorkflow?.colorToLineType) {
            const colorMappings = this.config.mappingWorkflow.colorToLineType;
            
            // Check configured color mappings
            const mappings = Array.isArray(colorMappings) ? colorMappings : Object.values(colorMappings || {});
            for (const mapping of mappings) {
                if (mapping.color && parseInt(mapping.color) === entity.color) {
                    return mapping.lineType;
                }
            }
            
            // No fallback color mappings - rely only on configured mappings
        }

        // No mapping found - this will trigger a user notification
        console.warn(`No line type mapping found for entity on layer: ${entity.layer}`);
        return null;
    }

    /**
     * Get tool from line type (Step 2 of workflow)
     */
    getToolFromLineType(lineType) {
        if (!this.config.mappingWorkflow?.lineTypeToTool) {
            console.warn('No mappingWorkflow.lineTypeToTool found in config');
            return null;
        }

        const lineTypeMappings = this.config.mappingWorkflow.lineTypeToTool;
        const mappings = Array.isArray(lineTypeMappings) ? lineTypeMappings : Object.values(lineTypeMappings || {});
        
        console.log(`Looking for line type: "${lineType}"`);
        console.log(`Available mappings:`, mappings);
        
        for (const mapping of mappings) {
            console.log(`Checking mapping: "${mapping.lineType}" === "${lineType}"`);
            if (mapping.lineType && mapping.lineType === lineType) {
                console.log(`Found match! Tool: ${mapping.tool}`);
                return mapping.tool;
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
        if (this.config.lineTypes && Array.isArray(this.config.lineTypes)) {
            const lineType = this.config.lineTypes.find(lt => lt.id === lineTypeId);
            if (lineType) {
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
}

export default DinGenerator;