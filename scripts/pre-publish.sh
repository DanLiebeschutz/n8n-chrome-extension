#!/bin/bash
# Pre-publish checks for Chrome Extension
# Run this before publishing to ensure everything is ready

set -e  # Exit on error

echo "=========================================="
echo "Chrome Extension Pre-Publish Checks"
echo "=========================================="
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# 1. Check for store icon
echo "1. Checking store icon (128x128)..."
python3 "$SCRIPT_DIR/check-store-icon.py"
if [ $? -ne 0 ]; then
    echo "✗ Store icon check failed"
    exit 1
fi
echo ""

# 2. Verify manifest.json exists and is valid
echo "2. Validating manifest.json..."
if [ ! -f "manifest.json" ]; then
    echo "✗ manifest.json not found"
    exit 1
fi

# Check if it's valid JSON
python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ manifest.json is valid JSON"
else
    echo "✗ manifest.json is invalid JSON"
    exit 1
fi

# Get version from manifest
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
echo "  Version: $VERSION"
echo ""

# 3. Check required files
echo "3. Checking required files..."
REQUIRED_FILES=(
    "manifest.json"
    "icons/icon16.png"
    "icons/icon48.png"
    "icons/icon128.png"
    "icons/store-icon-128.png"
    "popup/popup.html"
    "popup/popup.js"
    "popup/popup.css"
    "content/content.js"
    "content/content.css"
    "background/service-worker.js"
)

ALL_FOUND=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (missing)"
        ALL_FOUND=false
    fi
done

if [ "$ALL_FOUND" = false ]; then
    echo ""
    echo "✗ Some required files are missing"
    exit 1
fi
echo ""

# 4. Review CLAUDE.md for accuracy
echo "4. Checking CLAUDE.md..."
if [ ! -f "CLAUDE.md" ]; then
    echo "  ⚠ Warning: CLAUDE.md not found"
else
    # Check if CLAUDE.md mentions "hardcoded" (outdated)
    if grep -i "hardcoded" CLAUDE.md > /dev/null 2>&1; then
        echo "  ⚠ WARNING: CLAUDE.md contains 'hardcoded' - may be outdated!"
        echo "    Please review CLAUDE.md to ensure it reflects current architecture"
    else
        echo "  ✓ CLAUDE.md exists"
    fi

    # Get last modified date
    if command -v stat > /dev/null 2>&1; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            CLAUDE_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d" CLAUDE.md)
        else
            CLAUDE_MODIFIED=$(stat -c "%y" CLAUDE.md | cut -d' ' -f1)
        fi
        echo "    Last modified: $CLAUDE_MODIFIED"
    fi

    echo ""
    echo "  📝 REMINDER: Review CLAUDE.md before publishing!"
    echo "     Ensure it accurately reflects:"
    echo "     - Current architecture and features"
    echo "     - Multi-instance support (if applicable)"
    echo "     - Any recent major changes"
fi
echo ""

# 5. Check for common issues
echo "5. Checking for common issues..."

# Check for console.log in production files (optional warning)
if grep -r "console\.log" popup/*.js content/*.js background/*.js 2>/dev/null | grep -v "\/\/" | head -1 > /dev/null; then
    echo "  ⚠ Warning: console.log statements found (consider removing for production)"
else
    echo "  ✓ No console.log in main files"
fi

# Check file sizes (warn if any file is unusually large)
LARGE_FILES=$(find . -name "*.js" -o -name "*.css" | xargs ls -l | awk '$5 > 100000 {print $9, $5}')
if [ -n "$LARGE_FILES" ]; then
    echo "  ⚠ Warning: Large files detected:"
    echo "$LARGE_FILES" | while read line; do
        echo "    $line"
    done
else
    echo "  ✓ All files are reasonably sized"
fi
echo ""

# 6. Summary
echo "=========================================="
echo "✓ Pre-publish checks complete!"
echo "=========================================="
echo ""
echo "Extension is ready for publishing:"
echo "  • Store icon: icons/store-icon-128.png"
echo "  • Version: $VERSION"
echo "  • All required files present"
echo ""
echo "Next steps:"
echo "  1. Run: @publish-extension (or use extension-publisher agent)"
echo "  2. Upload generated .zip to Chrome Web Store"
echo ""
