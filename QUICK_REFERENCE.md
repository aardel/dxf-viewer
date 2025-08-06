# Quick Developer Reference

## 🚀 Essential Commands

### Development
```bash
npm run dev          # Development mode (recommended)
npm start           # Production mode testing
npm run build       # Build for distribution
```

### Key Differences
- **Development Mode** (`npm run dev`): Uses app bundle CONFIG files, immediate updates
- **Production Mode** (`npm start`): Uses user data CONFIG files, cached behavior

## 🔧 Critical Files

### Configuration
- `CONFIG/profiles/mtl.xml` - Primary tool/settings configuration (development)
- `~/Library/Application Support/Electron/CONFIG/profiles/mtl.xml` - User data (production)

### Core Modules
- `electron/main/main.cjs` - Backend IPC handlers
- `electron/renderer/renderer.js` - Frontend main logic
- `electron/renderer/src/advanced-visualization.js` - DIN preview system

## 🐛 Common Issues & Quick Fixes

### Tools Show "null"
- **Cause**: Corrupted postprocessor config
- **Fix**: Already resolved - XML data takes priority

### Network Volume Save Fails
- **Cause**: Incorrect path or permissions
- **Fix**: Already resolved - corrected to `/Volumes/Public/Lasercomb`

### Configuration Changes Don't Apply
- **Cause**: Using production mode with cached user data
- **Fix**: Use `npm run dev` for development

### Path Issues
- **Cause**: Hardcoded paths vs dynamic resolution
- **Fix**: All handlers now use `getProfilesDirectory()`

## 📊 Debug Commands

### Check Current Configuration
```javascript
// In renderer console
window.electronAPI.debugGetProfilesDirectory()
```

### Verify Tool Loading
```javascript
// In renderer console
const tools = window.rendererInstance.getCurrentToolSet();
console.log(tools);
```

### Network Volume Test
```bash
ls -la /Volumes/Public/Lasercomb
```

## 📁 Important Directories

```
CONFIG/
├── profiles/mtl.xml          # Main configuration
├── tools/standard_tools.json # Tool definitions
├── LineTypes/line-types.xml  # Line type mappings
└── postprocessors/           # Output formats

electron/
├── main/main.cjs            # Backend
└── renderer/                # Frontend
    ├── renderer.js          # Main UI logic
    └── src/
        └── advanced-visualization.js  # DIN preview

~/Library/Application Support/Electron/CONFIG/  # User data (production)
```

## 🔄 Workflow Best Practices

1. **Always use `npm run dev` for development**
2. **Test network volume saves periodically**
3. **Backup CONFIG files before major changes**
4. **Use browser DevTools for frontend debugging**
5. **Check main process logs for backend issues**

## 📈 Recent Improvements (v1.1.0)

- ✅ Advanced 2D DIN preview visualization
- ✅ Fixed tool loading ("null" values resolved)
- ✅ Network volume save support
- ✅ Unified configuration path management
- ✅ Comprehensive debugging infrastructure

---
*Last updated: August 6, 2025*
