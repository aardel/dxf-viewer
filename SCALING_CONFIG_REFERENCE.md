# Scaling Configuration Quick Reference

## XML Structure

The scaling configuration is now part of the unified XML profile system under the DIN file structure:

```xml
<DinFileStructure>
    <Header>
        <Element type="scaling" enabled="true">
            <Title>Scaling Commands</Title>
            <Icon>⚖️</Icon>
            <Config>
                <Commands>:P2027=25.4/P674
G75 X=P2027 Y=P2027</Commands>
                <Comment/>
            </Config>
        </Element>
    </Header>
</DinFileStructure>
```

## Key Points

### ✅ **Commands Format**
- **MUST be on separate lines** in the XML
- Each command should be on its own line
- Example:
  ```xml
  <Commands>:P2027=25.4/P674
  G75 X=P2027 Y=P2027</Commands>
  ```

### ✅ **Comment Handling**
- **Comments are disabled** by default (empty `<Comment/>`)
- No scaling comments are output in DIN files
- This prevents unwanted comment lines in the output

### ✅ **DIN Generator Logic**
- Commands are split by newlines and processed individually
- Each command is added as a separate line in the DIN output
- Comments are ignored (removed from output)

## Expected DIN Output

When scaling is enabled, the DIN file will contain:
```
:P2027=25.4/P674
G75 X=P2027 Y=P2027
```

**NOT:**
```
:P2027=25.4/P674 G75 X=P2027 Y=P2027
```

## Configuration Files

- **Primary Profile**: `CONFIG/profiles/pts.xml`
- **Secondary Profile**: `CONFIG/profiles/mtl.xml`
- **Legacy JSON**: All JSON postprocessor configs are deprecated and marked with `_DEPRECATED_` prefix

## UI Integration

The Output Manager UI saves scaling configuration directly to the XML profile:
- Scaling commands are saved to `config.structure.header[].config.commands`
- Scaling comments are saved to `config.structure.header[].config.comment` (but not used)
- Enabled/disabled state is saved to `config.structure.header[].enabled`

## Troubleshooting

### Issue: Commands on single line
**Cause**: Commands not properly separated by newlines in XML
**Fix**: Ensure each command is on its own line in the `<Commands>` element

### Issue: Comment appears in output
**Cause**: Comment logic was not properly disabled
**Fix**: Comments are now completely removed from DIN output

### Issue: Scaling not applied
**Cause**: Element not enabled or not found in structure
**Fix**: Check that `enabled="true"` and element type is `"scaling"`
