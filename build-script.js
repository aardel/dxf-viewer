const fs = require('fs');
const path = require('path');

// Copy src files to renderer directory for build
function copySrcFiles() {
    const srcDir = path.join(__dirname, 'src');
    const rendererDir = path.join(__dirname, 'electron', 'renderer', 'src');
    
    // Create src directory in renderer if it doesn't exist
    if (!fs.existsSync(rendererDir)) {
        fs.mkdirSync(rendererDir, { recursive: true });
    }
    
    // Copy all files from src to renderer/src
    function copyRecursive(src, dest) {
        if (fs.statSync(src).isDirectory()) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            files.forEach(file => {
                copyRecursive(path.join(src, file), path.join(dest, file));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }
    
    copyRecursive(srcDir, rendererDir);
    console.log('✅ Copied src files to renderer directory');
}

// Run the copy operation
copySrcFiles(); 