/**
 * Path Optimization Module for DIN File Generation
 * Implements various algorithms for optimizing cutting paths and tool sequences
 */

export class PathOptimizer {
    constructor(optimizationConfig = null) {
        this.config = optimizationConfig;
        this.debugMode = false;
    }

    /**
     * Main optimization function - applies two-level optimization strategy
     * Level 1: Primary Strategy (Priority Order with phases or simple priority list)
     * Level 2: Within-phase optimization (Closest Path First by default)
     * @param {Array} entities - Array of DXF entities to optimize
     * @param {Object} tools - Tool configuration object
     * @param {Object} settings - Optimization settings
     * @returns {Array} Optimized entity sequence
     */
    optimizePaths(entities, tools, settings = {}) {
        if (!entities || entities.length === 0) {
            return [];
        }

        // Default to Priority Order as primary strategy and Closest Path as secondary
        const primaryStrategy = settings.primaryStrategy || 'priority_order';
        const withinGroupOptimization = settings.withinGroupOptimization || 'closest_path';
        
        console.log(`Optimizing ${entities.length} entities with strategy: ${primaryStrategy} / ${withinGroupOptimization}`);

        // Step 1: Apply primary strategy - Priority Order with phases
        let groupedEntities;
        if (primaryStrategy === 'priority_order') {
            groupedEntities = this.groupByPriorityWithPhases(entities, tools, settings);
        } else {
            // Fallback to simple tool grouping
            groupedEntities = this.groupByTool(entities, tools, settings);
        }

        // Step 2: Apply within-group/phase optimization
        const optimizedGroups = groupedEntities.map(group => ({
            ...group,
            entities: this.optimizeWithinGroup(group.entities, withinGroupOptimization, settings)
        }));

        // Step 3: Flatten back to single array maintaining phase order
        return optimizedGroups.flatMap(group => group.entities);
    }

    /**
     * Group entities by tool requirements with priority phase support
     */
    groupByTool(entities, tools, settings) {
        // Check if priority phases are enabled and configured (always respect manual breaks now)
        if (settings.config?.optimization?.priority?.items) {
            return this.groupByPriorityPhases(entities, tools, settings);
        }
        
        // Fall back to simple tool grouping
        const toolGroups = new Map();
        
        entities.forEach(entity => {
            const requiredTool = this.getRequiredTool(entity, tools);
            const toolKey = requiredTool ? requiredTool.id : 'default';
            
            if (!toolGroups.has(toolKey)) {
                toolGroups.set(toolKey, {
                    tool: requiredTool,
                    entities: [],
                    priority: requiredTool ? requiredTool.priority || 0 : 999
                });
            }
            
            toolGroups.get(toolKey).entities.push(entity);
        });

        // Sort groups by tool priority if respect priority is enabled
        const groups = Array.from(toolGroups.values());
        
        if (settings.respectPriority !== false) {
            groups.sort((a, b) => a.priority - b.priority);
        }

        return groups;
    }

    /**
     * Group entities by priority with intelligent phase handling
     * - If line breaks exist: Create phases and optimize within each phase
     * - If no line breaks: Respect entire priority list as single sequence
     */
    groupByPriorityWithPhases(entities, tools, settings) {
        // Check if we have priority configuration
        if (!settings.config?.optimization?.priority?.items) {
            console.log('No priority configuration found, using simple tool grouping');
            return this.groupByTool(entities, tools, settings);
        }

        const priorityItems = settings.config.optimization.priority.items;
        
        // Check if there are any line breaks in the priority list
        const hasLineBreaks = priorityItems.some(item => item.value === '__LINE_BREAK__');
        
        if (hasLineBreaks) {
            console.log('Line breaks detected - using phase-based optimization');
            return this.groupByPriorityPhases(entities, tools, settings);
        } else {
            console.log('No line breaks - using single priority sequence');
            return this.groupByPrioritySequence(entities, tools, settings);
        }
    }

    /**
     * Group entities by priority phases (respecting line breaks)
     */
    groupByPriorityPhases(entities, tools, settings) {
        const priorityItems = settings.config.optimization.priority.items;
        
        // Create priority phases separated by line breaks
        const phases = [];
        let currentPhase = [];
        
        priorityItems.forEach(item => {
            if (item.value === '__LINE_BREAK__') {
                if (currentPhase.length > 0) {
                    phases.push([...currentPhase]);
                    currentPhase = [];
                }
            } else {
                currentPhase.push(item);
            }
        });
        
        // Add the last phase if it has items
        if (currentPhase.length > 0) {
            phases.push(currentPhase);
        }
        
        console.log(`Created ${phases.length} priority phases:`, phases.map(phase => 
            phase.map(item => item.value).join(', ')
        ));
        
        // Group entities by phases
        const phaseGroups = [];
        
        phases.forEach((phase, phaseIndex) => {
            const phaseEntities = [];
            
            // Collect all entities that belong to tools in this phase
            entities.forEach(entity => {
                const requiredTool = this.getRequiredTool(entity, tools);
                if (requiredTool && phase.some(item => item.value === requiredTool.id)) {
                    phaseEntities.push(entity);
                }
            });
            
            if (phaseEntities.length > 0) {
                // Within each phase, group by individual tools and sort by phase priority
                const toolGroups = new Map();
                
                phaseEntities.forEach(entity => {
                    const requiredTool = this.getRequiredTool(entity, tools);
                    const toolKey = requiredTool ? requiredTool.id : 'default';
                    
                    if (!toolGroups.has(toolKey)) {
                        // Find the priority order within this phase
                        const phaseOrder = phase.findIndex(item => item.value === toolKey);
                        toolGroups.set(toolKey, {
                            tool: requiredTool,
                            entities: [],
                            priority: requiredTool ? requiredTool.priority || 0 : 999,
                            phase: phaseIndex + 1,
                            phaseOrder: phaseOrder >= 0 ? phaseOrder : 999
                        });
                    }
                    
                    toolGroups.get(toolKey).entities.push(entity);
                });
                
                // Sort tools within phase by their phase order
                const sortedToolGroups = Array.from(toolGroups.values())
                    .sort((a, b) => a.phaseOrder - b.phaseOrder);
                
                phaseGroups.push(...sortedToolGroups);
            }
        });
        
        return phaseGroups;
    }

    /**
     * Group entities by single priority sequence (no line breaks)
     */
    groupByPrioritySequence(entities, tools, settings) {
        const priorityItems = settings.config.optimization.priority.items;
        
        console.log('Priority sequence (no phases):', priorityItems.map(item => item.value).join(' → '));
        
        // Create a single group for each tool in priority order
        const toolGroups = [];
        
        priorityItems.forEach((item, index) => {
            if (item.value === '__LINE_BREAK__') return; // Skip any stray line breaks
            
            const toolEntities = entities.filter(entity => {
                const requiredTool = this.getRequiredTool(entity, tools);
                return requiredTool && requiredTool.id === item.value;
            });
            
            if (toolEntities.length > 0) {
                const requiredTool = Object.values(tools).find(tool => tool.id === item.value);
                toolGroups.push({
                    tool: requiredTool,
                    entities: toolEntities,
                    priority: index, // Use sequence position as priority
                    phase: 1, // Single phase
                    phaseOrder: index
                });
            }
        });
        
        return toolGroups;
    }

    /**
     * Group entities by tool requirements (fallback method)
     */
    groupByTool(entities, tools, settings) {
        const toolGroups = new Map();
        
        entities.forEach(entity => {
            const requiredTool = this.getRequiredTool(entity, tools);
            const toolKey = requiredTool ? requiredTool.id : 'default';
            
            if (!toolGroups.has(toolKey)) {
                toolGroups.set(toolKey, {
                    tool: requiredTool,
                    entities: [],
                    priority: requiredTool ? requiredTool.priority || 0 : 999
                });
            }
            
            toolGroups.get(toolKey).entities.push(entity);
        });
        
        // Sort by priority
        const groups = Array.from(toolGroups.values())
            .sort((a, b) => a.priority - b.priority);
        
        return groups;
    }

    /**
     * Group entities by cutting priority
     */
    groupByPriority(entities, settings) {
        const priorityGroups = new Map();
        
        entities.forEach(entity => {
            const priority = this.getEntityPriority(entity, settings);
            
            if (!priorityGroups.has(priority)) {
                priorityGroups.set(priority, {
                    tool: null,
                    entities: [],
                    priority: priority
                });
            }
            
            priorityGroups.get(priority).entities.push(entity);
        });

        // Sort by priority
        return Array.from(priorityGroups.values()).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Optimize entities within a single group
     */
    optimizeWithinGroup(entities, algorithm, settings) {
        if (!entities || entities.length <= 1) {
            return entities;
        }

        switch (algorithm) {
            case 'closest_path':
                return this.optimizeClosestPath(entities, settings);
            case 'zigzag_horizontal':
                return this.optimizeZigZag(entities, 'horizontal', settings);
            case 'zigzag_vertical':
                return this.optimizeZigZag(entities, 'vertical', settings);
            case 'spiral_out':
                return this.optimizeSpiral(entities, 'outward', settings);
            case 'spiral_in':
                return this.optimizeSpiral(entities, 'inward', settings);
            case 'left_to_right':
                return this.optimizeLeftToRight(entities, settings);
            case 'bottom_to_top':
                return this.optimizeBottomToTop(entities, settings);
            case 'no_optimization':
                return entities;
            default:
                console.warn(`Unknown optimization algorithm: ${algorithm}`);
                return entities;
        }
    }

    /**
     * Closest path first optimization (greedy nearest neighbor)
     */
    optimizeClosestPath(entities, settings) {
        if (entities.length <= 1) return entities;

        const result = [];
        const remaining = [...entities];
        
        // Start with the leftmost entity
        let current = this.findLeftmostEntity(remaining);
        remaining.splice(remaining.indexOf(current), 1);
        result.push(current);

        // Greedy nearest neighbor
        while (remaining.length > 0) {
            const currentPos = this.getEntityEndPosition(current);
            let nearest = null;
            let minDistance = Infinity;

            remaining.forEach(entity => {
                const startPos = this.getEntityStartPosition(entity);
                const endPos = this.getEntityEndPosition(entity);
                
                // Check both start and end positions
                const distToStart = this.calculateDistance(currentPos, startPos);
                const distToEnd = this.calculateDistance(currentPos, endPos);
                
                const minDist = Math.min(distToStart, distToEnd);
                if (minDist < minDistance) {
                    minDistance = minDist;
                    nearest = entity;
                    // Reverse entity if end is closer than start
                    if (distToEnd < distToStart && settings.allowReverse !== false) {
                        entity._reversed = true;
                    }
                }
            });

            if (nearest) {
                remaining.splice(remaining.indexOf(nearest), 1);
                result.push(nearest);
                current = nearest;
            } else {
                break;
            }
        }

        return result;
    }

    /**
     * Zig-zag pattern optimization
     */
    optimizeZigZag(entities, direction, settings) {
        const grouped = this.groupEntitiesByPosition(entities, direction, settings.groupSpacing || 5.0);
        const result = [];

        grouped.forEach((group, index) => {
            // Sort each group
            if (direction === 'horizontal') {
                group.sort((a, b) => this.getEntityCenterX(a) - this.getEntityCenterX(b));
            } else {
                group.sort((a, b) => this.getEntityCenterY(a) - this.getEntityCenterY(b));
            }

            // Reverse every other group for zig-zag pattern
            if (settings.reverseAlternate !== false && index % 2 === 1) {
                group.reverse();
            }

            result.push(...group);
        });

        return result;
    }

    /**
     * Spiral pattern optimization
     */
    optimizeSpiral(entities, direction, settings) {
        const center = this.calculateBoundingBoxCenter(entities);
        const sorted = [...entities];

        // Sort by distance from center and angle
        sorted.sort((a, b) => {
            const posA = this.getEntityCenterPosition(a);
            const posB = this.getEntityCenterPosition(b);
            
            const distA = this.calculateDistance(center, posA);
            const distB = this.calculateDistance(center, posB);
            
            const angleA = Math.atan2(posA.y - center.y, posA.x - center.x);
            const angleB = Math.atan2(posB.y - center.y, posB.x - center.x);

            if (direction === 'outward') {
                // Sort by distance first, then by angle
                const distDiff = distA - distB;
                return Math.abs(distDiff) > 1.0 ? distDiff : angleA - angleB;
            } else {
                // Inward spiral - reverse distance sort
                const distDiff = distB - distA;
                return Math.abs(distDiff) > 1.0 ? distDiff : angleA - angleB;
            }
        });

        return sorted;
    }

    /**
     * Left to right optimization
     */
    optimizeLeftToRight(entities, settings) {
        return [...entities].sort((a, b) => {
            const tolerance = settings.tolerance || 1.0;
            const xA = this.getEntityCenterX(a);
            const xB = this.getEntityCenterX(b);
            
            // If X positions are close, sort by Y
            if (Math.abs(xA - xB) < tolerance && settings.groupByY !== false) {
                return this.getEntityCenterY(a) - this.getEntityCenterY(b);
            }
            
            return xA - xB;
        });
    }

    /**
     * Bottom to top optimization
     */
    optimizeBottomToTop(entities, settings) {
        return [...entities].sort((a, b) => {
            const tolerance = settings.tolerance || 1.0;
            const yA = this.getEntityCenterY(a);
            const yB = this.getEntityCenterY(b);
            
            // If Y positions are close, sort by X
            if (Math.abs(yA - yB) < tolerance && settings.groupByX !== false) {
                return this.getEntityCenterX(a) - this.getEntityCenterX(b);
            }
            
            return yA - yB;
        });
    }

    // Utility methods for entity analysis

    getRequiredTool(entity, tools) {
        // Use the same tool determination logic as the DIN generator
        // This should match the logic in DinGenerator.getRequiredTool()
        
        // For now, use the entity's lineTypeId to determine the tool
        // This is a simplified version - in a full implementation, this would use
        // the same mapping workflow as the DIN generator
        
        if (entity.lineTypeId) {
            // Map line type ID to tool using the same logic as DIN generator
            const lineTypeMap = {
                '1': 'T22', '2': 'T2', '3': 'T3', '4': 'T4',
                '5': 'T12', '6': 'T13', '7': 'T14', '8': 'T22',
                '9': 'T22', '10': 'T22', '11': 'T20', '12': 'T21',
                '13': 'T22', '14': 'T2', '15': 'T3', '16': 'T4',
                '17': 'T33', '18': 'T2', '19': 'T22', '20': 'T20',
                '21': 'T21', '22': 'T33', '23': 'T40', '24': 'T40',
                '25': 'T40', '26': 'T40', '27': 'T40', '28': 'T40',
                '29': 'T40', '30': 'T40'
            };
            
            const toolId = lineTypeMap[entity.lineTypeId];
            if (toolId && tools[toolId]) {
                return { id: toolId, ...tools[toolId] };
            }
        }
        
        // Fallback to first available tool
        return Object.entries(tools)[0] ? { id: Object.keys(tools)[0], ...Object.values(tools)[0] } : null;
    }

    getEntityPriority(entity, settings) {
        // Determine entity priority based on layer, type, etc.
        if (entity.layer && settings.layerPriorities) {
            return settings.layerPriorities[entity.layer] || 50;
        }
        
        // Default priorities by entity type
        const typePriorities = {
            'CIRCLE': 10,
            'ARC': 15,
            'LINE': 20,
            'POLYLINE': 25,
            'SPLINE': 30,
            'TEXT': 40,
            'HATCH': 50
        };
        
        return typePriorities[entity.type] || 99;
    }

    getEntityStartPosition(entity) {
        switch (entity.type) {
            case 'LINE':
                return { x: entity.start.x, y: entity.start.y };
            case 'ARC':
            case 'CIRCLE':
                return { x: entity.center.x + entity.radius, y: entity.center.y };
            case 'POLYLINE':
                return entity.vertices && entity.vertices.length > 0 ? entity.vertices[0] : { x: 0, y: 0 };
            default:
                return this.getEntityCenterPosition(entity);
        }
    }

    getEntityEndPosition(entity) {
        switch (entity.type) {
            case 'LINE':
                return { x: entity.end.x, y: entity.end.y };
            case 'ARC':
            case 'CIRCLE':
                return { x: entity.center.x + entity.radius, y: entity.center.y };
            case 'POLYLINE':
                return entity.vertices && entity.vertices.length > 0 ? 
                       entity.vertices[entity.vertices.length - 1] : { x: 0, y: 0 };
            default:
                return this.getEntityCenterPosition(entity);
        }
    }

    getEntityCenterPosition(entity) {
        if (entity.center) {
            return { x: entity.center.x, y: entity.center.y };
        }
        
        if (entity.start && entity.end) {
            return {
                x: (entity.start.x + entity.end.x) / 2,
                y: (entity.start.y + entity.end.y) / 2
            };
        }

        if (entity.vertices && entity.vertices.length > 0) {
            const bounds = this.calculateEntityBounds(entity);
            return {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2
            };
        }

        return { x: 0, y: 0 };
    }

    getEntityCenterX(entity) {
        return this.getEntityCenterPosition(entity).x;
    }

    getEntityCenterY(entity) {
        return this.getEntityCenterPosition(entity).y;
    }

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    findLeftmostEntity(entities) {
        return entities.reduce((leftmost, entity) => {
            return this.getEntityCenterX(entity) < this.getEntityCenterX(leftmost) ? entity : leftmost;
        });
    }

    groupEntitiesByPosition(entities, direction, spacing) {
        const groups = [];
        const sorted = [...entities];

        // Sort by primary axis
        if (direction === 'horizontal') {
            sorted.sort((a, b) => this.getEntityCenterY(a) - this.getEntityCenterY(b));
        } else {
            sorted.sort((a, b) => this.getEntityCenterX(a) - this.getEntityCenterX(b));
        }

        let currentGroup = [];
        let lastPosition = null;

        sorted.forEach(entity => {
            const position = direction === 'horizontal' ? 
                           this.getEntityCenterY(entity) : this.getEntityCenterX(entity);

            if (lastPosition === null || Math.abs(position - lastPosition) <= spacing) {
                currentGroup.push(entity);
            } else {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = [entity];
            }

            lastPosition = position;
        });

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    calculateBoundingBoxCenter(entities) {
        const bounds = this.calculateBounds(entities);
        return {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        };
    }

    calculateBounds(entities) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        entities.forEach(entity => {
            const entityBounds = this.calculateEntityBounds(entity);
            minX = Math.min(minX, entityBounds.minX);
            minY = Math.min(minY, entityBounds.minY);
            maxX = Math.max(maxX, entityBounds.maxX);
            maxY = Math.max(maxY, entityBounds.maxY);
        });

        return { minX, minY, maxX, maxY };
    }

    calculateEntityBounds(entity) {
        switch (entity.type) {
            case 'LINE':
                return {
                    minX: Math.min(entity.start.x, entity.end.x),
                    minY: Math.min(entity.start.y, entity.end.y),
                    maxX: Math.max(entity.start.x, entity.end.x),
                    maxY: Math.max(entity.start.y, entity.end.y)
                };
            case 'CIRCLE':
                return {
                    minX: entity.center.x - entity.radius,
                    minY: entity.center.y - entity.radius,
                    maxX: entity.center.x + entity.radius,
                    maxY: entity.center.y + entity.radius
                };
            case 'ARC':
                // Simplified arc bounds - should be more precise in production
                return {
                    minX: entity.center.x - entity.radius,
                    minY: entity.center.y - entity.radius,
                    maxX: entity.center.x + entity.radius,
                    maxY: entity.center.y + entity.radius
                };
            case 'POLYLINE':
                if (!entity.vertices || entity.vertices.length === 0) {
                    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
                }
                
                let minX = entity.vertices[0].x, minY = entity.vertices[0].y;
                let maxX = entity.vertices[0].x, maxY = entity.vertices[0].y;
                
                entity.vertices.forEach(vertex => {
                    minX = Math.min(minX, vertex.x);
                    minY = Math.min(minY, vertex.y);
                    maxX = Math.max(maxX, vertex.x);
                    maxY = Math.max(maxY, vertex.y);
                });
                
                return { minX, minY, maxX, maxY };
            default:
                return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
    }

    // Debug and analysis methods
    
    generateOptimizationReport(originalEntities, optimizedEntities, settings) {
        const report = {
            originalCount: originalEntities.length,
            optimizedCount: optimizedEntities.length,
            strategy: settings.primaryStrategy,
            algorithm: settings.withinGroupOptimization,
            totalDistance: this.calculateTotalDistance(optimizedEntities),
            toolChanges: this.countToolChanges(optimizedEntities),
            estimatedTime: this.estimateProcessingTime(optimizedEntities, settings)
        };

        return report;
    }

    calculateTotalDistance(entities) {
        let totalDistance = 0;
        
        for (let i = 1; i < entities.length; i++) {
            const prevEnd = this.getEntityEndPosition(entities[i - 1]);
            const currentStart = this.getEntityStartPosition(entities[i]);
            totalDistance += this.calculateDistance(prevEnd, currentStart);
        }
        
        return totalDistance;
    }

    countToolChanges(entities) {
        let toolChanges = 0;
        let currentTool = null;
        
        entities.forEach(entity => {
            const requiredTool = entity._requiredTool;
            if (requiredTool && requiredTool !== currentTool) {
                if (currentTool !== null) {
                    toolChanges++;
                }
                currentTool = requiredTool;
            }
        });
        
        return toolChanges;
    }

    estimateProcessingTime(entities, settings) {
        // Simplified time estimation
        const cuttingTime = entities.length * 2.0; // 2 seconds per entity
        const toolChangeTime = this.countToolChanges(entities) * 5.0; // 5 seconds per tool change
        const rapidMoveTime = this.calculateTotalDistance(entities) / 1000; // 1000 mm/min rapid
        
        return cuttingTime + toolChangeTime + rapidMoveTime;
    }
}

export default PathOptimizer;