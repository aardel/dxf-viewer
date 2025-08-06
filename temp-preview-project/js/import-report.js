// js/import-report.js

/**
 * Import Report Module for NC File Converter
 * Reads a DXF or DWG file (as text), parses it, and shows a popup report of all unique line/entity types.
 */

const ImportReport = {
  /**
   * Show a popup report of all unique entity types in a DXF/DWG file
   * @param {File} file - The file to analyze
   */
  showLineTypeReportFromFile: function(file) {
    if (!file) {
      alert('No file selected.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      const combos = new Set();
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '0' && lines[i+1]) {
          const type = lines[i+1].trim();
          // Look ahead for color (62), layer (8), linetype (6)
          let color = 'default', layer = 'default', linetype = 'default';
          for (let j = i+2; j < Math.min(i+20, lines.length); j++) {
            if (lines[j].trim() === '62' && lines[j+1]) color = lines[j+1].trim();
            if (lines[j].trim() === '8' && lines[j+1]) layer = lines[j+1].trim();
            if (lines[j].trim() === '6' && lines[j+1]) linetype = lines[j+1].trim();
          }
          combos.add(`${type} | color: ${color} | layer: ${layer} | linetype: ${linetype}`);
        }
      }
      if (combos.size === 0) {
        alert('No DXF/DWG entity types found in file.');
      } else {
        alert('Unique entity type/color/layer/linetype combinations found in file:\n' + Array.from(combos).sort().join('\n'));
      }
    };
    reader.onerror = () => {
      alert('Error reading file.');
    };
    reader.readAsText(file);
  }
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.ImportReport = ImportReport;
}