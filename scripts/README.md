# Extension Publishing Scripts

Helper scripts for preparing and publishing the n8n Chrome extension.

## Scripts

### `pre-publish.sh`

Comprehensive pre-publish checklist that validates your extension is ready for the Chrome Web Store.

**Usage:**
```bash
./scripts/pre-publish.sh
```

**What it checks:**
- ✓ Store icon (128x128) exists - creates if missing
- ✓ manifest.json is valid JSON
- ✓ All required files are present
- ✓ File sizes are reasonable
- ⚠ Warns about console.log statements in production

**Example output:**
```
==========================================
Chrome Extension Pre-Publish Checks
==========================================

1. Checking store icon (128x128)...
✓ Store icon found: icons/store-icon-128.png
  Size: 128x128 (correct)

2. Validating manifest.json...
✓ manifest.json is valid JSON
  Version: 1.0.0

3. Checking required files...
  ✓ All 11 required files present

✓ Pre-publish checks complete!
```

### `check-store-icon.py`

Standalone script that checks for and creates the Chrome Web Store icon.

**Usage:**
```bash
./scripts/check-store-icon.py
```

**What it does:**
1. Checks if `icons/store-icon-128.png` exists
2. Verifies it's exactly 128x128 pixels
3. If missing or wrong size, generates a new icon with:
   - n8n branding (orange #FF6D5A)
   - Workflow sidebar visualization
   - Multi-instance indicators
   - Professional gradient background

**Can be used standalone:**
```bash
# Just check/create the icon
python3 scripts/check-store-icon.py

# Or make it executable and run directly
chmod +x scripts/check-store-icon.py
./scripts/check-store-icon.py
```

## Publishing Workflow

### Recommended workflow:

1. **Run pre-publish checks:**
   ```bash
   ./scripts/pre-publish.sh
   ```

2. **Publish extension:**
   ```bash
   # In Claude Code CLI:
   @publish-extension

   # Or manually:
   # - Commit changes: git commit -am "Release v1.0.0"
   # - Push: git push
   # - Create zip: scripts/create-package.sh (if you create one)
   ```

3. **Upload to Chrome Web Store:**
   - Go to: https://chrome.google.com/webstore/developer/dashboard
   - Upload the generated .zip file
   - Submit for review

## Integration with Agents

While the built-in `extension-publisher` agent cannot be modified directly, you can run these scripts before publishing:

```bash
# 1. Pre-publish checks (includes icon check)
./scripts/pre-publish.sh

# 2. Then publish
@publish-extension
```

## Requirements

- Python 3.x
- Pillow (PIL) library - auto-installed if missing
- Bash shell

## Troubleshooting

**"Module not found: PIL"**
```bash
pip3 install Pillow
```

**"Permission denied"**
```bash
chmod +x scripts/pre-publish.sh
chmod +x scripts/check-store-icon.py
```

**Icon looks wrong**
- The icon is automatically generated with n8n branding
- To customize, edit `check-store-icon.py` and adjust colors/layout
- Re-run to regenerate

## Files Created

After running these scripts, you'll have:
- `icons/store-icon-128.png` - Chrome Web Store icon (128x128)
- Pre-publish validation report in terminal

## Notes

- The store icon is automatically generated if missing
- Icon design shows:
  - Left sidebar with workflow items (your extension's core feature)
  - Connected workflow nodes (n8n branding)
  - Multi-instance indicators (three dots in top-right)
- All checks are non-destructive - they only create missing files
