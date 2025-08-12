### DXF workflow: parsing ➜ mapping ➜ validation ➜ DIN generation

This doc summarizes the current DXF pipeline end-to-end and the conventions the app uses. It reflects the latest changes where DXF layers are treated as color variants keyed by the import-rule "key" format.

### Key concepts

- **DXF variant model**
  - Each logical layer can have multiple color variants. We treat each variant as an independent processing unit.
  - Variant naming in the UI: `BaseLayerName (#RRGGBB)`
  - Raw variant id (used in some places): `BaseLayerName_RRGGBB`
  - `parentLayer`: base layer name (no color suffix)

- **Import rule key format (source of truth)**
  - DXF keys are always: `dxf|<BaseLayerName>|<RRGGBB>` (hex, uppercase, no leading `#`).
  - Rules are looked up in a global in-memory cache: `exactRulesCache.get('dxf|<Base>|<HEX>')`.
  - A rule with `enabled === false` means “NO OUTPUT”.

### High-level flow

1) Open DXF ➜ parse and build variant list
   - Entities are grouped by `(layer, color)` into per-variant rows.
   - Each row gets: `name` (raw id), `displayName` (`Base (#HEX)`), `parentLayer`, `colorHex`, `objectCount`, etc.

   ```12:29:electron/renderer/renderer.js
   if (viewer.parsedDxf?.entities?.length > 0) {
       // Group entities by (layer, color)
       const entityGroups = {};
       // ... builds entries with displayName `${layer} (#${colorHex})`
   }
   ```

2) Apply Import Filters
   - We call the main process to apply global rules and annotate rows with `lineTypeId` when a rule exists.
   - Results are stored in `window.currentLayerData` and rendered via the DXF table.

   ```1317:1423:electron/renderer/renderer.js
   function populateLayerTable(layers) { /* builds the DXF table with Output checkbox per variant */ }
   ```

3) User toggles Output (checkbox) per variant
   - Checkbox is the single source of truth for “should this variant be processed”.
   - For disabled rules (NO OUTPUT), the checkbox is forced off and disabled.

4) Validation before DIN
   - Entry point:
     ```2621:2635:electron/renderer/renderer.js
     function validateLayerMappings() { /* chooses DXF vs unified */ }
     ```
   - DXF path groups by base layer, then emits results per variant:
     - `includedLayers`: visible + mapped variants
     - `visibleUnmappedLayers`: visible + unmapped variants (per-variant)
     - `hiddenLayers`: all variants hidden (base-level info)
     - `hiddenVariants`: individual variants that are unchecked (informational)

     ```2637:2778:electron/renderer/renderer.js
     function validateDxfLayerMappings() { /* builds included/unmapped/hidden variants */ }
     ```

   - Confirmation/Warning modals use those lists:
     - If there are excluded items, the first modal shows a red note with the variant rows and counts.
     - If everything is OK, the confirmation shows only the green section.

     ```2990:3115:electron/renderer/renderer.js
     function showLayerProcessingConfirmation(validation) { /* red+green sections */ }
     ```

5) DIN generation
   - Flow:
     - `performDinGeneration()` ➜ re-validates ➜ extracts entities ➜ runs `DinGenerator` ➜ `saveDinFile()`.
     - Extraction respects visibility and mapping flags.

     ```6127:6160:electron/renderer/renderer.js
     function extractEntitiesFromViewer(respectVisibility = false) { /* uses checkbox state and mapping */ }
     ```

   - `saveDinFile()` computes `processedLayers` for the success dialog using per-variant rows:

     ```6544:6597:electron/renderer/renderer.js
     async function saveDinFile(...) { const processedLayers = getProcessedLayersInfo(); }
     ```

   - The success dialog now lists each processed variant and the command count:

     ```3133:3196:electron/renderer/renderer.js
     function showDinGenerationSuccessDialog(filePath, processedLayers, stats) { /* per-variant list */ }
     ```

### Rule resolution details (DXF)

- Lookup order for a variant (`Base`, `HEX`):
  1. `exactRulesCache.get('dxf|Base|HEX')` and `enabled !== false` and `lineTypeId` present ➜ mapped
  2. Otherwise unmapped

- The UI additionally marks NO OUTPUT rules as disabled and forces checkbox off.

### What “valid” means at validation time

- Valid when:
  - `includedLayers.length > 0`, and
  - `visibleUnmappedLayers.length === 0` (i.e., no checked row is unmapped)

- We still show a non-blocking red section for unchecked or NO OUTPUT variants so the operator knows what is excluded.

### Object counts shown to the user

- For each variant, `objectCount` is computed from grouped entities.
- Modal summaries add those counts:
  - Confirmation dialog:
    - yellow: total objects to be processed (sum of included)
    - red: total objects to be excluded (sum of hiddenVariants + visibleUnmapped)
  - Success dialog: per-variant list of processed items and a blue footer with total DIN commands.

### API surface (renderer)

- Validation/selectors
  - `validateLayerMappings()`
  - `validateDxfLayerMappings()`
  - `showLayerValidationWarning()`
  - `showLayerProcessingConfirmation()`

- Generation
  - `performDinGeneration()` ➜ `extractEntitiesFromViewer(true)` ➜ `saveDinFile()`
  - `getProcessedLayersInfo()` builds the per-variant list for the success dialog

### Gotchas / tips

- Always build/compare rule keys using `dxf|Base|HEX` (uppercase hex, no `#`).
- Don’t aggregate variants back into a base name for counts in the UI; show each variant row to match the left table.
- Visibility must read the Output checkbox from the DOM; never infer visibility purely from cached state.
- A rule with `enabled === false` is a “NO OUTPUT” rule and should disable the checkbox.

### Test checklist

- Load a DXF with multiple color variants for a single base layer.
- Create rules for some variants; leave at least one variant unmapped and one variant unchecked.
- Confirm dialogs:
  - Warning/confirmation dialog shows excluded section with the exact per-variant rows.
  - Success dialog lists the same per-variant rows that were included.
- Totals match object counts and DIN command count is shown in the blue footer.


