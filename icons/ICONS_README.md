# Extension Icons

The Chrome extension requires three icon files in this directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Quick Setup Options

### Option 1: Use create_icons.py Script (Recommended)

If you have Python and Pillow installed:

```bash
# Install Pillow (if needed)
pip3 install Pillow

# Run the script from the extension root directory
python3 create_icons.py
```

This will create three icons with n8n's blue color (#4a9eff) and white "n8n" text.

### Option 2: Online Icon Generator

1. Visit: https://www.favicon-generator.org/
2. Upload any image or create a simple design
3. Download the generated icons
4. Rename and place them in this `icons/` folder

### Option 3: Manual Creation

Use any image editor (Photoshop, GIMP, Preview, etc.) to create three PNG files:

- Background color: #4a9eff (n8n blue)
- Text: "n8n" in white
- Sizes: 16x16, 48x48, 128x128 pixels

### Option 4: Simple Colored Squares

For a quick test, you can create solid colored squares:

**Using ImageMagick** (if installed):
```bash
convert -size 16x16 xc:#4a9eff icon16.png
convert -size 48x48 xc:#4a9eff icon48.png
convert -size 128x128 xc:#4a9eff icon128.png
```

**Using macOS Preview**:
1. Open Preview
2. File → New from Clipboard (or create blank)
3. Tools → Adjust Size → Set dimensions
4. Fill with blue color (#4a9eff)
5. Export as PNG

## Notes

- Icons are required before loading the extension in Chrome
- The extension will work fine with simple placeholder icons
- You can update icons later without reinstalling the extension
