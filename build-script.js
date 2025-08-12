const fs = require('fs');
const path = require('path');

// Build script for dxf2Laser
// Note: With single source of truth implementation, no file copying is needed
// The renderer now imports directly from ../../src/

console.log('✅ Build script completed - using single source of truth from src/ directory');
console.log('📁 All source files are now accessed directly from src/ directory');
console.log('🚀 No file duplication needed - renderer imports from ../../src/'); 