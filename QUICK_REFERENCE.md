# Lasercomb DXF Studio - Quick Reference

## 🎯 Path Optimization System

### Two-Level Optimization Strategy

**Level 1: Primary Strategy (Default: Priority Order)**
- **Priority Order**: Follows XML priority configuration
  - With line breaks: Creates cutting phases
  - Without line breaks: Single priority sequence
- **Tool Grouped**: Minimizes tool changes

**Level 2: Within-Phase Optimization (Default: Closest Path First)**
- **Closest Path First**: Shortest travel distance
- **Zig-Zag**: Horizontal/vertical scanning
- **Spiral**: Inward/outward patterns
- **Sequential**: Left-to-right, bottom-to-top

### Laser Cutting Workflow (Priority Phases)

```
Phase 1: T20 (Engraving)     ← Fine details first
         ↓ __LINE_BREAK__
Phase 2: T2  (Internal Cuts) ← Internal features
         ↓ __LINE_BREAK__  
Phase 3: T22 (Border Cuts)   ← Borders last
```

### Configuration

**XML Priority Setup:**
```xml
<Priority mode="tool">
    <PriorityItem order="1" value="T20"/>    <!-- Engraving -->
    <PriorityItem order="4" value="__LINE_BREAK__"/>
    <PriorityItem order="5" value="T2"/>     <!-- Internal -->
    <PriorityItem order="11" value="__LINE_BREAK__"/>
    <PriorityItem order="12" value="T22"/>   <!-- Borders -->
</Priority>
```

**UI Settings:**
- Primary Strategy: "Priority Order (Follow cutting sequence)"
- Path Optimization: "Closest Path First"

## 🛠️ Tool Management

### Tool Priority Configuration
1. Open `CONFIG/profiles/mtl.xml`
2. Edit `<Priority>` section
3. Use `__LINE_BREAK__` for cutting phases
4. Restart application to reload

### Common Tool Types
- **T20**: Fast Engrave (engraving, text)
- **T2**: 2pt CW (general cutting)
- **T22**: Fine Cut (precision borders)
- **T12**: 2pt Puls (pulsed cutting)

## 📁 File Operations

### DXF Processing Workflow
1. **Load DXF**: File → Open DXF
2. **Configure Tools**: Set layer-to-tool mappings
3. **Set Priority**: Configure cutting sequence
4. **Generate DIN**: Process → Generate DIN
5. **Export**: Save to output directory

### Import Filter System
- **Global Filters**: Apply to all DXF files
- **File-Specific**: Override global rules
- **Layer Mapping**: Map layers to tools/line types

## ⚡ Quick Actions

### Keyboard Shortcuts
- `Ctrl+O`: Open DXF file
- `Ctrl+G`: Generate DIN file
- `Ctrl+S`: Save current settings
- `F5`: Refresh display

### Common Settings
- **Units**: Metric (mm) / Imperial (inches)
- **Precision**: Decimal places for coordinates
- **Output Format**: DIN/G-code customization

## 🔧 Troubleshooting

### Optimization Issues
- **Wrong cutting order**: Check priority configuration
- **Missing line breaks**: Add `__LINE_BREAK__` entries
- **Poor path efficiency**: Try different path optimization

### Tool Problems
- **Tool not found**: Check XML tool definitions
- **Wrong H-code**: Verify tool mapping
- **Missing operations**: Check layer visibility

### Performance Tips
- Use priority phases for complex files
- Enable closest path optimization
- Limit entity count for large files
- Use appropriate precision settings
