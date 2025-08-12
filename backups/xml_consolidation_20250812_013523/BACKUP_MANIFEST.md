# XML Consolidation Backup Manifest

**Backup Date:** 2025-08-12 01:35:23  
**Purpose:** Backup before consolidating dual configuration system (XML + JSON) to single XML system

## Current System State

### Dual Configuration System (Current)
- **XML Profiles**: Machine settings, tools, line types, basic output settings
- **JSON Postprocessor Configs**: DIN file structure, line number formatting, scaling settings
- **Problem**: Two systems not synchronized, causing configuration issues

### Issues Being Addressed
1. Line numbers starting from 10 instead of 1
2. Scaling comments not being output despite UI showing enabled
3. Settings changes not persisting between UI and actual DIN generation
4. Configuration confusion between XML and JSON systems

## Files Backed Up

### Configuration Files
- `CONFIG/profiles/` - XML profile definitions
- `CONFIG/postprocessors/` - JSON postprocessor configurations
- `CONFIG/import-filters/` - Global import filter settings
- `CONFIG/LineTypes/` - Line type definitions
- `CONFIG/mappings/` - Line type to tool mappings
- `CONFIG/optimization/` - Path optimization settings
- `CONFIG/tools/` - Tool definitions

### Application Code
- `electron/` - Main application code (main process + renderer)
- `src/` - Core application logic and DIN generation
- `package.json` - Dependencies and scripts
- `package-lock.json` - Locked dependency versions

## Planned Changes

### Phase 1: Extend XML Schema
- Add DIN file structure elements to XML profiles
- Add line number formatting settings to XML profiles
- Add scaling configuration to XML profiles

### Phase 2: Update Output Manager
- Modify to save settings directly to XML instead of JSON
- Remove JSON postprocessor config dependency
- Update UI to read from XML profiles

### Phase 3: Update DIN Generator
- Simplify to read only from XML profiles
- Remove JSON config loading logic
- Ensure all settings come from single source

### Phase 4: Cleanup
- Remove JSON postprocessor config system
- Remove dual configuration loading logic
- Update documentation

## Rollback Instructions

To rollback to this state:
1. Stop the application
2. Copy all files from this backup directory back to the project root
3. Restart the application

## Notes

- This backup preserves the current dual-system approach
- All configuration files are preserved as-is
- Application code is preserved as-is
- No data loss during this consolidation process
