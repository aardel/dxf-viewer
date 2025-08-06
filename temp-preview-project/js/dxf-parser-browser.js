// DXF Parser Browser Bundle for NC File Converter
// Provides basic DXF parsing and SVG conversion functionality
(function() {
  'use strict';

  // Enhanced DXF parser for better entity detection
  function parseString(dxfString) {
    console.log('DXF Parser: Starting to parse DXF content');
    console.log('DXF content length:', dxfString.length);
    console.log('First 200 chars:', dxfString.substring(0, 200));
    
    const lines = dxfString.split(/\r\n|\r|\n/);
    const entities = [];
    const layers = new Set();
    const header = {};
    
    let currentSection = null;
    let currentEntity = null;
    let expectingValue = false;
    let lastGroupCode = null;
    
    console.log('Total lines in DXF:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!expectingValue) {
        // This should be a group code - handle leading spaces
        const groupCode = parseInt(line.trim());
        if (isNaN(groupCode)) {
          continue; // Skip invalid group codes
        }
        lastGroupCode = groupCode;
        expectingValue = true;
        continue;
      }
      
      // This is the value for the group code
      const value = line;
      expectingValue = false;
      
      // Handle sections
      if (lastGroupCode === 0) {
        if (value === 'SECTION') {
          // Next should be group code 2 with section name
          continue;
        } else if (value === 'ENDSEC') {
          console.log(`Exiting section: ${currentSection}`);
          if (currentSection === 'ENTITIES' && currentEntity) {
            entities.push(currentEntity);
            currentEntity = null;
          }
          currentSection = null;
          continue;
        } else if (value === 'EOF') {
          break;
        }
      } else if (lastGroupCode === 2) {
        // This is a section name after SECTION
        if (value === 'HEADER' || value === 'ENTITIES' || value === 'TABLES' || value === 'BLOCKS' || value === 'CLASSES') {
          currentSection = value;
          console.log(`Entering section: ${currentSection}`);
          continue;
        }
      }
      
      // Handle group code 0 entities in ENTITIES section
      if (lastGroupCode === 0 && currentSection === 'ENTITIES') {
        // Save previous entity
        if (currentEntity) {
          // Post-process polylines and splines to collect vertices
          if ((currentEntity.type === 'LWPOLYLINE' || currentEntity.type === 'POLYLINE' || currentEntity.type === 'SPLINE')) {
            console.log(`Completed ${currentEntity.type} with ${currentEntity.vertices.length} vertices (expected: ${currentEntity.vertexCount}), flag: ${currentEntity.flag}:`, currentEntity.vertices);
            
            // Add any remaining incomplete vertex
            if (currentEntity.currentVertex && 
                currentEntity.currentVertex.x !== undefined && 
                currentEntity.currentVertex.y !== undefined) {
              const vertex = {
                x: currentEntity.currentVertex.x,
                y: currentEntity.currentVertex.y
              };
              currentEntity.vertices.push(vertex);
              console.log(`${currentEntity.type}: Added final incomplete vertex:`, vertex);
            }
            
            // Ensure closed polylines have proper flag
            if (currentEntity.vertices.length >= 3 && currentEntity.flag === undefined) {
              // Check if first and last vertices are the same (auto-close)
              const first = currentEntity.vertices[0];
              const last = currentEntity.vertices[currentEntity.vertices.length - 1];
              if (first && last && Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
                currentEntity.flag = 1;
                console.log(`Auto-detected closed polyline for ${currentEntity.type}`);
              }
            }
          }
          entities.push(currentEntity);
          console.log('Added entity:', currentEntity.type, 'Color:', currentEntity.colorNumber, 'Flag:', currentEntity.flag);
        }
        
        // Start new entity
        currentEntity = { type: value, vertices: [], currentVertex: {} };
        console.log(`Starting new entity: ${value}`);
        
        // Skip non-entity objects
        if (!['LWPOLYLINE', 'POLYLINE', 'LINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'SPLINE', 'TEXT', 'MTEXT', 'POINT'].includes(value)) {
          console.log(`Skipping non-drawable entity: ${value}`);
          currentEntity = null;
        }
      } else if (currentSection === 'ENTITIES' && currentEntity) {
        // Parse entity properties
        switch (lastGroupCode) {
          case 8: // layer
            currentEntity.layer = value;
            layers.add(value);
            break;
          case 6: // linetype
            currentEntity.lineType = value;
            break;
          case 62: // color number
            currentEntity.colorNumber = parseInt(value);
            currentEntity.color = parseInt(value);
            break;
          case 10: // X coordinate (primary)
            currentEntity.x = parseFloat(value);
            // For polylines and splines, store X coordinate and check if we can make a vertex
            if (currentEntity.type === 'LWPOLYLINE' || currentEntity.type === 'POLYLINE' || currentEntity.type === 'SPLINE') {
              if (!currentEntity.currentVertex) currentEntity.currentVertex = {};
              currentEntity.currentVertex.x = parseFloat(value);
              console.log(`${currentEntity.type}: Got X coordinate:`, parseFloat(value));
            }
            break;
          case 20: // Y coordinate (primary)
            currentEntity.y = parseFloat(value);
            // For polylines and splines, store Y coordinate and complete the vertex
            if (currentEntity.type === 'LWPOLYLINE' || currentEntity.type === 'POLYLINE' || currentEntity.type === 'SPLINE') {
              if (!currentEntity.currentVertex) currentEntity.currentVertex = {};
              currentEntity.currentVertex.y = parseFloat(value);
              console.log(`${currentEntity.type}: Got Y coordinate:`, parseFloat(value));
              
              // If we have both x and y, add the vertex
              if (currentEntity.currentVertex.x !== undefined && currentEntity.currentVertex.y !== undefined) {
                const vertex = {
                  x: currentEntity.currentVertex.x,
                  y: currentEntity.currentVertex.y
                };
                currentEntity.vertices.push(vertex);
                console.log(`${currentEntity.type}: Added vertex ${currentEntity.vertices.length}:`, vertex);
                currentEntity.currentVertex = {}; // Reset for next vertex
              }
            }
            break;
          case 30: // Z coordinate (primary)
            currentEntity.z = parseFloat(value);
            break;
          case 11: // X coordinate (secondary)
            currentEntity.x1 = parseFloat(value);
            break;
          case 21: // Y coordinate (secondary)
            currentEntity.y1 = parseFloat(value);
            break;
          case 31: // Z coordinate (secondary)
            currentEntity.z1 = parseFloat(value);
            break;
          case 40: // radius or first value
            currentEntity.radius = parseFloat(value);
            break;
          case 50: // start angle
            currentEntity.startAngle = parseFloat(value);
            break;
          case 51: // end angle
            currentEntity.endAngle = parseFloat(value);
            break;
          case 70: // flags
            currentEntity.flag = parseInt(value);
            break;
          case 90: // vertex count for polylines
            currentEntity.vertexCount = parseInt(value);
            console.log(`${currentEntity.type}: Expected vertex count:`, parseInt(value));
            break;
        }
      }
    }
    
    // Add the last entity if it exists
    if (currentEntity) {
      // Post-process final polyline or spline if needed
      if ((currentEntity.type === 'LWPOLYLINE' || currentEntity.type === 'POLYLINE' || currentEntity.type === 'SPLINE')) {
        // Add any remaining incomplete vertex
        if (currentEntity.currentVertex && 
            currentEntity.currentVertex.x !== undefined && 
            currentEntity.currentVertex.y !== undefined) {
          const vertex = {
            x: currentEntity.currentVertex.x,
            y: currentEntity.currentVertex.y
          };
          currentEntity.vertices.push(vertex);
          console.log(`${currentEntity.type}: Added final incomplete vertex:`, vertex);
        }
        
        // Ensure closed polylines have proper flag
        if (currentEntity.vertices.length >= 3 && currentEntity.flag === undefined) {
          // Check if first and last vertices are the same (auto-close)
          const first = currentEntity.vertices[0];
          const last = currentEntity.vertices[currentEntity.vertices.length - 1];
          if (first && last && Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
            currentEntity.flag = 1;
            console.log(`Auto-detected closed polyline for ${currentEntity.type}`);
          }
        }
      }
      
      entities.push(currentEntity);
      console.log('Added final entity:', currentEntity.type, 'Color:', currentEntity.colorNumber, 'Flag:', currentEntity.flag);
    }
    
    console.log(`DXF Parser: Found ${entities.length} entities`);
    console.log('Entities:', entities);
    console.log('Layers:', Array.from(layers));
    
    return {
      entities: entities,
      layers: Array.from(layers),
      header: header
    };
  }
  
  // Convert parsed DXF to SVG
  function toSVG(dxf, options = {}) {
    const { width = 800, height = 600, originalData = null } = options;
    
    if (!dxf.entities || dxf.entities.length === 0) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; border: 1px solid #ccc;">
        <text x="10" y="30" fill="red" font-family="Arial, sans-serif" font-size="14">No entities found in DXF file</text>
        <text x="10" y="50" fill="#666" font-family="Arial, sans-serif" font-size="12">Make sure the file contains LINE, CIRCLE, or ARC entities</text>
      </svg>`;
    }
    
    // Calculate bounds using original data if provided (for consistent frame size)
    const boundsData = originalData && originalData.entities ? originalData : dxf;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundValidEntity = false;
    
    console.log('Calculating bounds for entities:', boundsData.entities);
    
    boundsData.entities.forEach((entity, index) => {
      console.log(`Entity ${index}:`, entity);
      
      if (entity.x !== undefined && entity.y !== undefined) {
        foundValidEntity = true;
        minX = Math.min(minX, entity.x);
        maxX = Math.max(maxX, entity.x);
        minY = Math.min(minY, entity.y);
        maxY = Math.max(maxY, entity.y);
        console.log(`Using primary coords: (${entity.x}, ${entity.y})`);
      }
      if (entity.x1 !== undefined && entity.y1 !== undefined) {
        foundValidEntity = true;
        minX = Math.min(minX, entity.x1);
        maxX = Math.max(maxX, entity.x1);
        minY = Math.min(minY, entity.y1);
        maxY = Math.max(maxY, entity.y1);
        console.log(`Using secondary coords: (${entity.x1}, ${entity.y1})`);
      }
      // For polylines, include all vertices in bounds
      if (entity.vertices && entity.vertices.length > 0) {
        foundValidEntity = true;
        console.log(`Processing ${entity.vertices.length} vertices for ${entity.type}:`);
        entity.vertices.forEach((vertex, vIndex) => {
          if (vertex.x !== undefined && vertex.y !== undefined) {
            minX = Math.min(minX, vertex.x);
            maxX = Math.max(maxX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxY = Math.max(maxY, vertex.y);
            console.log(`  Vertex ${vIndex}: (${vertex.x}, ${vertex.y})`);
          }
        });
      }
      // For circles, include radius in bounds
      if (entity.radius !== undefined && entity.x !== undefined && entity.y !== undefined) {
        minX = Math.min(minX, entity.x - entity.radius);
        maxX = Math.max(maxX, entity.x + entity.radius);
        minY = Math.min(minY, entity.y - entity.radius);
        maxY = Math.max(maxY, entity.y + entity.radius);
        console.log(`Circle bounds: center(${entity.x}, ${entity.y}) radius=${entity.radius}`);
      }
    });
    
    console.log(`Calculated bounds: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
    
    if (!foundValidEntity) {
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: white; border: 1px solid #ccc;">
        <text x="10" y="30" fill="red" font-family="Arial, sans-serif" font-size="14">No valid coordinates found</text>
        <text x="10" y="50" fill="#666" font-family="Arial, sans-serif" font-size="12">Entities found but no valid X,Y coordinates</text>
      </svg>`;
    }
    
    // Add padding (10% of the drawing size)
    const drawingWidth = maxX - minX;
    const drawingHeight = maxY - minY;
    const padding = Math.max(drawingWidth, drawingHeight) * 0.1;
    
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    // Calculate scale to fit the drawing in the SVG
    const scaleX = width / (maxX - minX);
    const scaleY = height / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);
    
    let svgContent = '';
    let entityCount = 0;
    
    dxf.entities.forEach(entity => {
      const color = getEntityColor(entity);
      
      switch (entity.type) {
        case 'LINE':
          if (entity.x !== undefined && entity.y !== undefined && 
              entity.x1 !== undefined && entity.y1 !== undefined) {
            svgContent += `<line x1="${entity.x.toFixed(2)}" y1="${entity.y.toFixed(2)}" x2="${entity.x1.toFixed(2)}" y2="${entity.y1.toFixed(2)}" stroke="${color}" stroke-width="${(maxX-minX) * 0.002}" />`;
            entityCount++;
          }
          break;
          
        case 'CIRCLE':
          if (entity.x !== undefined && entity.y !== undefined && entity.radius !== undefined) {
            svgContent += `<circle cx="${entity.x.toFixed(2)}" cy="${entity.y.toFixed(2)}" r="${entity.radius.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${(maxX-minX) * 0.002}" />`;
            entityCount++;
          }
          break;
          
        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (entity.vertices && entity.vertices.length > 1) {
            console.log(`Rendering ${entity.type} with ${entity.vertices.length} vertices:`, entity.vertices);
            let pathData = `M ${entity.vertices[0].x.toFixed(2)} ${entity.vertices[0].y.toFixed(2)}`;
            for (let i = 1; i < entity.vertices.length; i++) {
              pathData += ` L ${entity.vertices[i].x.toFixed(2)} ${entity.vertices[i].y.toFixed(2)}`;
            }
            
            // Check if polyline should be closed (flag 1 means closed)
            if (entity.flag === 1) {
              pathData += ' Z'; // Close the path
              console.log(`Closing ${entity.type} path`);
            }
            
            svgContent += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${(maxX-minX) * 0.002}" />`;
            entityCount++;
          } else if (entity.x !== undefined && entity.y !== undefined) {
            // Fallback for polylines that didn't collect vertices properly
            console.log(`${entity.type} has no vertices, rendering as point at (${entity.x}, ${entity.y})`);
            console.log(`Entity details:`, entity);
            console.log(`Expected vertices: ${entity.vertexCount}, Actual vertices: ${entity.vertices ? entity.vertices.length : 0}`);
            console.log(`Color: ${entity.colorNumber}, Flag: ${entity.flag}`);
            const r = (maxX - minX) * 0.01;
            svgContent += `<circle cx="${entity.x.toFixed(2)}" cy="${entity.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" stroke="${color}" stroke-width="${(maxX-minX) * 0.001}" />`;
            entityCount++;
          }
          break;
          
        case 'ARC':
          if (entity.x !== undefined && entity.y !== undefined && entity.radius !== undefined) {
            const cx = (entity.x - minX) * scale;
            const cy = height - (entity.y - minY) * scale; // Flip Y for SVG coordinates
            const r = entity.radius * scale;
            const startAngle = (entity.startAngle || 0) * Math.PI / 180;
            const endAngle = (entity.endAngle || 0) * Math.PI / 180;
            
            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy - r * Math.sin(startAngle); // Flip Y for SVG coordinates
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy - r * Math.sin(endAngle); // Flip Y for SVG coordinates
            
            const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
            const sweep = endAngle > startAngle ? 1 : 0;
            
            svgContent += `<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweep} ${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" stroke="${color}" stroke-width="2" />`;
            entityCount++;
          }
          break;
          
        case 'ELLIPSE':
          // Render proper ellipse using DXF ellipse parameters
          if (entity.x !== undefined && entity.y !== undefined) {
            console.log(`Rendering ELLIPSE at center (${entity.x}, ${entity.y})`);
            console.log(`ELLIPSE details:`, entity);
            
            // DXF ellipse parameters:
            // - Center point: entity.x, entity.y
            // - Major axis endpoint: entity.x1, entity.y1 (relative to center)
            // - Ratio of minor to major axis: entity.radius
            
            const centerX = entity.x;
            const centerY = entity.y;
            
            // Calculate major axis length from the endpoint vector
            const majorAxisX = entity.x1 || 26; // Default fallback
            const majorAxisY = entity.y1 || 0;
            const majorAxisLength = Math.sqrt(majorAxisX * majorAxisX + majorAxisY * majorAxisY);
            
            // Minor axis length = major axis * ratio
            const ratio = entity.radius || 0.5;
            const minorAxisLength = majorAxisLength * ratio;
            
            // Calculate rotation angle of major axis
            const rotationAngle = Math.atan2(majorAxisY, majorAxisX) * 180 / Math.PI;
            
            console.log(`ELLIPSE: center(${centerX}, ${centerY}), majorAxis=${majorAxisLength}, minorAxis=${minorAxisLength}, rotation=${rotationAngle}°`);
            
            svgContent += `<ellipse cx="${centerX.toFixed(2)}" cy="${centerY.toFixed(2)}" rx="${majorAxisLength.toFixed(2)}" ry="${minorAxisLength.toFixed(2)}" transform="rotate(${rotationAngle.toFixed(2)} ${centerX.toFixed(2)} ${centerY.toFixed(2)})" fill="none" stroke="${color}" stroke-width="${(maxX-minX) * 0.002}" stroke-dasharray="${majorAxisLength*0.1},${majorAxisLength*0.05}" />`;
            entityCount++;
          }
          break;
          
        case 'SPLINE':
          // Render spline using collected control points
          if (entity.vertices && entity.vertices.length > 1) {
            console.log(`Rendering SPLINE with ${entity.vertices.length} control points:`, entity.vertices);
            
            // For simple splines that form rectangles, we can simplify by using the bounding box
            // or connect the control points as a polyline
            let pathData = `M ${entity.vertices[0].x.toFixed(2)} ${entity.vertices[0].y.toFixed(2)}`;
            
            // For a rectangular spline, we might want to simplify to the corner points
            // Let's find the bounding corners from the control points
            if (entity.vertices.length > 10) {
              // This looks like a complex spline - let's extract corner points
              const minX = Math.min(...entity.vertices.map(v => v.x));
              const maxX = Math.max(...entity.vertices.map(v => v.x));
              const minY = Math.min(...entity.vertices.map(v => v.y));
              const maxY = Math.max(...entity.vertices.map(v => v.y));
              
              // Draw as rectangle using corner points
              pathData = `M ${minX.toFixed(2)} ${minY.toFixed(2)} L ${maxX.toFixed(2)} ${minY.toFixed(2)} L ${maxX.toFixed(2)} ${maxY.toFixed(2)} L ${minX.toFixed(2)} ${maxY.toFixed(2)} Z`;
              console.log(`Simplified SPLINE to rectangle: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
            } else {
              // Connect all control points
              for (let i = 1; i < entity.vertices.length; i++) {
                pathData += ` L ${entity.vertices[i].x.toFixed(2)} ${entity.vertices[i].y.toFixed(2)}`;
              }
            }
            
            svgContent += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${(maxX-minX) * 0.002}" stroke-dasharray="${(maxX-minX) * 0.01},${(maxX-minX) * 0.005}" />`;
            entityCount++;
          } else if (entity.x !== undefined && entity.y !== undefined) {
            // Fallback for splines with no control points
            console.log(`SPLINE has no control points, rendering as point at (${entity.x}, ${entity.y})`);
            const r = (maxX - minX) * 0.01;
            svgContent += `<circle cx="${entity.x.toFixed(2)}" cy="${entity.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" stroke="${color}" stroke-width="${(maxX-minX) * 0.001}" />`;
            entityCount++;
          }
          break;
          
        default:
          // Handle unknown entity types
          console.log(`Unknown entity type: ${entity.type} - Color: ${entity.colorNumber}`);
          console.log(`Entity details:`, entity);
          if (entity.x !== undefined && entity.y !== undefined) {
            console.log(`Rendering unknown entity as point at (${entity.x}, ${entity.y})`);
            const r = (maxX - minX) * 0.01;
            svgContent += `<circle cx="${entity.x.toFixed(2)}" cy="${entity.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" stroke="${color}" stroke-width="${(maxX-minX) * 0.001}" />`;
            entityCount++;
          }
          break;
      }
    });
    
    // Add coordinate system indicators
    const originX = (0 - minX) * scale;
    const originY = height - (0 - minY) * scale;
    
    // Add grid lines every 10 units in the original coordinate system
    let gridContent = '';
    const gridSpacing = 10;
    const gridScale = gridSpacing * scale;
    
    if (gridScale > 20) { // Only show grid if it's not too dense
      // Vertical grid lines
      for (let x = Math.ceil(minX / gridSpacing) * gridSpacing; x <= maxX; x += gridSpacing) {
        const screenX = (x - minX) * scale;
        gridContent += `<line x1="${screenX}" y1="0" x2="${screenX}" y2="${height}" stroke="#f0f0f0" stroke-width="0.5" />`;
      }
      
      // Horizontal grid lines
      for (let y = Math.ceil(minY / gridSpacing) * gridSpacing; y <= maxY; y += gridSpacing) {
        const screenY = height - (y - minY) * scale;
        gridContent += `<line x1="0" y1="${screenY}" x2="${width}" y2="${screenY}" stroke="#f0f0f0" stroke-width="0.5" />`;
      }
    }
    
    // Use the actual drawing bounds as viewBox for automatic scaling
    const viewBoxWidth = maxX - minX;
    const viewBoxHeight = maxY - minY;
    
    // Calculate aspect ratio and adjust dimensions to maintain it
    const aspectRatio = viewBoxWidth / viewBoxHeight;
    const containerAspectRatio = width / height;
    
    let finalWidth = width;
    let finalHeight = height;
    
    if (aspectRatio > containerAspectRatio) {
      // Drawing is wider than container - fit to width
      finalHeight = width / aspectRatio;
    } else {
      // Drawing is taller than container - fit to height  
      finalWidth = height * aspectRatio;
    }
    
    return `<svg width="${finalWidth}" height="${finalHeight}" xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-maxY} ${viewBoxWidth} ${viewBoxHeight}" style="background: white; border: 1px solid #ccc; max-width: 100%; max-height: 100%;">
      <g transform="scale(1,-1)">
        ${svgContent}
      </g>
      <text x="${minX + viewBoxWidth * 0.02}" y="${-minY - viewBoxHeight * 0.02}" fill="#666" font-family="Arial, sans-serif" font-size="${Math.min(viewBoxWidth, viewBoxHeight) * 0.03}">${entityCount} entities rendered</text>
    </svg>`;
  }
  
  // Get entity color based on color number
  function getEntityColor(entity) {
    const colorMap = {
      0: '#000000', // Black
      1: '#FF0000', // Red
      2: '#FFFF00', // Yellow
      3: '#00FF00', // Green
      4: '#00FFFF', // Cyan
      5: '#0000FF', // Blue
      6: '#FF00FF', // Magenta
      7: '#000000', // White -> Black for visibility
      8: '#808080', // Gray
      9: '#C0C0C0', // Light Gray
      
      // Extended color palette for higher numbers
      30: '#FF8000',  // Orange
      152: '#0080FF', // Light Blue  
      177: '#FF0080', // Pink
      242: '#8000FF', // Purple
      250: '#00FF80'  // Light Green
    };
    
    if (entity.colorNumber !== undefined && colorMap[entity.colorNumber]) {
      console.log(`Using color ${entity.colorNumber}: ${colorMap[entity.colorNumber]} for entity type: ${entity.type}`);
      return colorMap[entity.colorNumber];
    }
    
    // For unmapped colors, generate a color based on the number
    if (entity.colorNumber !== undefined) {
      const hue = (entity.colorNumber * 137.508) % 360; // Golden angle for good distribution
      const color = `hsl(${hue}, 70%, 50%)`;
      console.log(`Generated color for ${entity.colorNumber}: ${color} for entity type: ${entity.type}`);
      return color;
    }
    
    // Default to black for visibility
    console.log(`Using default black color for entity type: ${entity.type}`);
    return '#000000';
  }
  
  // Extract geometric data for laser processing
  function extractGeometry(dxf) {
    const paths = [];
    
    if (!dxf.entities) return paths;
    
    dxf.entities.forEach(entity => {
      switch (entity.type) {
        case 'LINE':
          if (entity.x !== undefined && entity.y !== undefined && 
              entity.x1 !== undefined && entity.y1 !== undefined) {
            paths.push({
              type: 'line',
              points: [
                { x: entity.x, y: entity.y },
                { x: entity.x1, y: entity.y1 }
              ],
              layer: entity.layer,
              color: entity.colorNumber
            });
          }
          break;
          
        case 'LWPOLYLINE':
          // Handle lightweight polylines - collect all vertices
          if (entity.vertices && entity.vertices.length > 1) {
            const points = entity.vertices.map(v => ({ x: v.x, y: v.y }));
            paths.push({
              type: 'polyline',
              points: points,
              layer: entity.layer,
              color: entity.colorNumber
            });
          }
          break;
          
        case 'POLYLINE':
          // Handle regular polylines
          if (entity.vertices && entity.vertices.length > 1) {
            const points = entity.vertices.map(v => ({ x: v.x, y: v.y }));
            paths.push({
              type: 'polyline',
              points: points,
              layer: entity.layer,
              color: entity.colorNumber
            });
          }
          break;
          
        case 'CIRCLE':
          if (entity.x !== undefined && entity.y !== undefined && entity.radius !== undefined) {
            // Convert circle to polyline approximation
            const segments = 32;
            const points = [];
            for (let i = 0; i <= segments; i++) {
              const angle = (i / segments) * 2 * Math.PI;
              points.push({
                x: entity.x + entity.radius * Math.cos(angle),
                y: entity.y + entity.radius * Math.sin(angle)
              });
            }
            paths.push({
              type: 'circle',
              points: points,
              layer: entity.layer,
              color: entity.colorNumber,
              center: { x: entity.x, y: entity.y },
              radius: entity.radius
            });
          }
          break;
          
        case 'ARC':
          if (entity.x !== undefined && entity.y !== undefined && entity.radius !== undefined) {
            const startAngle = (entity.startAngle || 0) * Math.PI / 180;
            const endAngle = (entity.endAngle || 0) * Math.PI / 180;
            const segments = 16;
            const points = [];
            
            for (let i = 0; i <= segments; i++) {
              const angle = startAngle + (endAngle - startAngle) * (i / segments);
              points.push({
                x: entity.x + entity.radius * Math.cos(angle),
                y: entity.y + entity.radius * Math.sin(angle)
              });
            }
            paths.push({
              type: 'arc',
              points: points,
              layer: entity.layer,
              color: entity.colorNumber,
              center: { x: entity.x, y: entity.y },
              radius: entity.radius,
              startAngle: entity.startAngle,
              endAngle: entity.endAngle
            });
          }
          break;
      }
    });
    
    return paths;
  }
  
  // Convert DXF geometry to G-code for laser cutting
  function toGCode(dxf, options = {}) {
    const {
      feedRate = 1000,
      laserOnCommand = 'M14',
      laserOffCommand = 'M15',
      units = 'mm' // mm or inch
    } = options;
    
    const paths = extractGeometry(dxf);
    let gcode = [];
    
    // Header
    gcode.push('G21'); // Metric units (or G20 for inches)
    gcode.push('G90'); // Absolute positioning
    gcode.push('G17'); // XY plane
    gcode.push('F' + feedRate); // Set feed rate
    gcode.push(laserOffCommand); // Laser off initially
    
    let currentPos = { x: 0, y: 0 };
    
    paths.forEach((path, pathIndex) => {
      if (path.points.length < 2) return;
      
      // Move to start of path (rapid move with laser off)
      const startPoint = path.points[0];
      if (Math.abs(startPoint.x - currentPos.x) > 0.001 || Math.abs(startPoint.y - currentPos.y) > 0.001) {
        gcode.push(laserOffCommand);
        gcode.push(`G0 X${startPoint.x.toFixed(3)} Y${startPoint.y.toFixed(3)}`);
        currentPos = { x: startPoint.x, y: startPoint.y };
      }
      
      // Start cutting
      gcode.push(laserOnCommand);
      
      // Cut the path
      for (let i = 1; i < path.points.length; i++) {
        const point = path.points[i];
        gcode.push(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)}`);
        currentPos = { x: point.x, y: point.y };
      }
      
      // Turn laser off after each path
      gcode.push(laserOffCommand);
    });
    
    // Footer
    gcode.push('M2'); // Program end
    
    return gcode.join('\n');
  }
  
  // Expose the API
  window.DxfParser = {
    parseString: parseString,
    toSVG: toSVG,
    extractGeometry: extractGeometry,
    toGCode: toGCode
  };
  
})();