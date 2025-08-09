const fs = require('fs');
const path = require('path');

const entityFiles = [
    '3dface.js', 'attdef.js', 'attribute.js', 'dimension.js', 'ellipse.js', 
    'hatch.js', 'insert.js', 'mtext.js', 'point.js', 'solid.js', 'spline.js'
];

const basePath = '/Users/aarondelia/Nextcloud2/Programing/dxf2Laser/src/parser/entities';

entityFiles.forEach(filename => {
    const filePath = path.join(basePath, filename);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace the export function declaration
        content = content.replace('module.exports = function EntityParser() {}', 'function EntityParser() {}');
        
        // Add module.exports at the end if not present
        if (!content.includes('module.exports = EntityParser')) {
            content = content.trim() + '\n\nmodule.exports = EntityParser;\n';
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`Fixed ${filename}`);
    } catch (error) {
        console.error(`Error fixing ${filename}:`, error.message);
    }
});

console.log('Done fixing entity parser files!');
