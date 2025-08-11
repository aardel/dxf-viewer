#!/bin/bash

# Lasercomb Studio V1.0.0 Backup Script
# Creates local backups and prepares for GitHub commits

echo "🔄 Lasercomb Studio V1.0.0 - Backup and Version Control"
echo "=================================================="

# Get current timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups/v1.0.0_${TIMESTAMP}"

echo "📅 Timestamp: ${TIMESTAMP}"
echo "📁 Backup Directory: ${BACKUP_DIR}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo ""
echo "📋 Creating backup of current state..."

# Copy essential files and directories
echo "  📁 Copying source code..."
cp -r src "${BACKUP_DIR}/"
cp -r electron "${BACKUP_DIR}/"
cp -r CONFIG "${BACKUP_DIR}/"
cp -r assets "${BACKUP_DIR}/"

# Copy configuration files
echo "  📄 Copying configuration files..."
cp package.json "${BACKUP_DIR}/"
cp package-lock.json "${BACKUP_DIR}/"
cp README.md "${BACKUP_DIR}/"
cp DEVELOPER_README.md "${BACKUP_DIR}/"
cp build-script.js "${BACKUP_DIR}/"
cp loglevel-wrapper.js "${BACKUP_DIR}/"

# Copy sample files
echo "  📂 Copying sample files..."
cp -r "Sample files" "${BACKUP_DIR}/"

# Create backup manifest
echo "  📝 Creating backup manifest..."
cat > "${BACKUP_DIR}/BACKUP_MANIFEST.md" << EOF
# Lasercomb Studio V1.0.0 Backup Manifest

**Backup Date:** $(date)
**Timestamp:** ${TIMESTAMP}
**Version:** 1.0.0

## What's Included

### Core Application
- \`src/\` - Core processing and rendering components
- \`electron/\` - Electron main and renderer processes
- \`assets/\` - Application assets and icons

### Configuration
- \`CONFIG/\` - All configuration files and profiles
- \`package.json\` - Project configuration
- \`package-lock.json\` - Dependency lock file

### Documentation
- \`README.md\` - Main project documentation
- \`DEVELOPER_README.md\` - Developer documentation
- \`build-script.js\` - Build configuration
- \`loglevel-wrapper.js\` - Logging configuration

### Sample Files
- \`Sample files/\` - Test files and examples

## Recent Updates (2025-08-11)

### Major Features
- ✅ Multi-Format Support: DXF, DDS, and CFF2 file formats
- ✅ Unified Interface: Single interface for all file formats
- ✅ Internal Line Types Editor: Dedicated editor for cutting operations
- ✅ Line Type Mapping: Separate mapping interface
- ✅ Updated UI: Removed obsolete features and streamlined interface

### Removed Features
- ❌ Configuration validation window (obsolete)
- ❌ Startup configuration issues check
- ❌ DXF-specific limitations in descriptions

### New Components
- \`line-types-editor.js\` - Internal line types editor
- \`line-type-mapping.html/.js\` - Line type mapping interface
- Multi-format parsers: DDS and CFF2 support

### Updated Architecture
- Unified file processing pipeline
- Enhanced configuration management
- Improved error handling
- Better performance optimization

## File Format Support

### DXF Files
- Complete parsing with layers, colors, text, hatching, and geometric entities
- AutoCAD Color Index (ACI) support
- Layer-based organization

### DDS Files
- Direct DDS format support
- Color and width-based processing
- Automatic unit detection (inches vs millimeters)

### CFF2 Files
- CFF2 format with pen and layer support
- Color and width mapping
- Professional cutting operations

## Workflow

1. **File Import**: Drag and drop or use "Open File" button
2. **Internal Line Types**: Create and manage cutting operations
3. **Line Type Mapping**: Map internal line types to machine tools
4. **Global Import Filter**: Define mapping rules for all file types
5. **Output Generation**: Generate DIN files with G-code

## Configuration

### Profile-Based Configuration
XML-based profiles store all application settings in \`CONFIG/profiles/\`

### Line Types
Internal line types managed in \`CONFIG/LineTypes/line-types.xml\`

### Import Filters
Global import filter rules in \`CONFIG/import-filters/\`

## Build Information

- **Node.js**: 16+
- **Electron**: 28.0.0
- **Three.js**: 0.161.0
- **Platforms**: Windows, macOS, Linux

## Backup Verification

To restore from this backup:
1. Copy all files to a new directory
2. Run \`npm install\` to install dependencies
3. Run \`npm run dev\` to start in development mode
4. Run \`npm run build\` to build for production

EOF

echo ""
echo "✅ Backup completed successfully!"
echo "📁 Backup location: ${BACKUP_DIR}"
echo ""

# Check Git status
echo "🔍 Checking Git status..."
if [ -d ".git" ]; then
    echo "  📊 Git repository found"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "  ⚠️  Uncommitted changes detected:"
        git status --short
        
        echo ""
        echo "🚀 Preparing for GitHub commit..."
        
        # Add all changes
        git add .
        
        # Create commit
        COMMIT_MESSAGE="Lasercomb Studio V1.0.0 - Multi-Format Support and UI Updates

Major Updates:
- Added DDS and CFF2 file format support
- Created Internal Line Types Editor
- Implemented Line Type Mapping interface
- Unified interface for all file formats
- Removed obsolete configuration validation
- Updated UI and streamlined interface
- Enhanced documentation

File Format Support:
- DXF: Complete parsing with layers and colors
- DDS: Direct format support with unit detection
- CFF2: Pen and layer support for cutting operations

New Components:
- line-types-editor.js: Internal line types editor
- line-type-mapping.html/.js: Line type mapping interface
- Multi-format parsers for DDS and CFF2

Architecture Updates:
- Unified file processing pipeline
- Enhanced configuration management
- Improved error handling
- Better performance optimization

Version: 1.0.0
Date: $(date)"
        
        git commit -m "$COMMIT_MESSAGE"
        
        echo ""
        echo "✅ Changes committed successfully!"
        echo "📝 Commit message: Lasercomb Studio V1.0.0 - Multi-Format Support and UI Updates"
        echo ""
        echo "🚀 Ready to push to GitHub:"
        echo "   git push origin main"
        
    else
        echo "  ✅ No uncommitted changes"
        echo "  📊 Repository is clean"
    fi
else
    echo "  ⚠️  No Git repository found"
    echo "  💡 To initialize Git repository:"
    echo "     git init"
    echo "     git add ."
    echo "     git commit -m 'Initial commit'"
fi

echo ""
echo "🎉 Backup and version control process completed!"
echo "📁 Local backup: ${BACKUP_DIR}"
echo "📝 Documentation updated"
echo "🔧 Configuration files updated"
echo ""
echo "Next steps:"
echo "1. Review the backup in: ${BACKUP_DIR}"
echo "2. Push to GitHub: git push origin main"
echo "3. Create release tag: git tag v1.0.0"
echo "4. Push tags: git push origin --tags"
echo ""
echo "✨ Lasercomb Studio V1.0.0 is ready for distribution!"
