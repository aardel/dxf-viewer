# Postprocessors Directory

## ⚠️ DEPRECATED JSON CONFIGURATION FILES

All JSON postprocessor configuration files in this directory have been **DEPRECATED** and are no longer used by the application.

### What Changed

- **Old System**: JSON postprocessor config files (e.g., `pts.xml.json`, `default_metric.json`)
- **New System**: Unified XML profiles in `CONFIG/profiles/` directory

### Deprecated Files

The following files are marked with `_DEPRECATED_` prefix and can be safely deleted:

- `_DEPRECATED_pts_copy.xml.json`
- `_DEPRECATED_pts.xml.json`
- `_DEPRECATED_mtl.xml.json`
- `_DEPRECATED_MTL_Flatbed.json`
- `_DEPRECATED_default_inch.json`
- `_DEPRECATED_default_metric.json`
- `_DEPRECATED_mtl.json`

### Migration

All configuration settings have been migrated to XML profiles:

- **Machine Settings**: Tools, line types, units, etc.
- **DIN File Structure**: Header/footer elements, line numbers, scaling
- **Custom Fields**: Company, operator, material, thickness
- **Bridges**: Laser off across gaps settings
- **Optimization**: Priority settings, path optimization

### Current Active Profiles

- `pts.xml` - Primary profile with complete configuration
- `mtl.xml` - Secondary profile with complete configuration

### Next Steps

1. **Safe to Delete**: The `_DEPRECATED_*.json` files can be deleted after confirming everything works correctly
2. **Backup**: These files serve as a backup of the old configuration system
3. **Reference**: Keep them temporarily for reference during the transition period

---

**Note**: The application now uses a unified XML-based configuration system that eliminates the synchronization issues between JSON and XML configurations.
