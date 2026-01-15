#!/usr/bin/env python3
"""
Convert screenshot to Chrome Web Store formats
Usage: ./convert-screenshot.py <input-image>
"""
import sys
from PIL import Image

def convert_screenshot(input_path):
    """Convert screenshot to Chrome Web Store formats"""
    
    print(f"Loading image: {input_path}")
    img = Image.open(input_path)
    
    # Convert to RGB (remove alpha channel if present)
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        print("  Converting from RGBA/transparent to RGB...")
        # Create white background
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    print(f"  Original size: {img.size[0]}x{img.size[1]}")
    
    # Create store-assets directory
    import os
    os.makedirs('store-assets', exist_ok=True)
    
    # 1. Resize to 1280x800 (maintaining aspect ratio, then crop/pad)
    print("
Creating 1280x800 versions...")
    img_1280 = resize_and_fit(img, 1280, 800)
    
    # Save as 24-bit PNG
    img_1280.save('store-assets/screenshot-1280x800.png', 'PNG')
    print("  ✓ screenshot-1280x800.png")
    
    # Save as JPEG
    img_1280.save('store-assets/screenshot-1280x800.jpg', 'JPEG', quality=95)
    print("  ✓ screenshot-1280x800.jpg")
    
    # 2. Resize to 640x400
    print("
Creating 640x400 versions...")
    img_640 = resize_and_fit(img, 640, 400)
    
    # Save as 24-bit PNG
    img_640.save('store-assets/screenshot-640x400.png', 'PNG')
    print("  ✓ screenshot-640x400.png")
    
    # Save as JPEG
    img_640.save('store-assets/screenshot-640x400.jpg', 'JPEG', quality=95)
    print("  ✓ screenshot-640x400.jpg")
    
    print("
✓ All screenshots created successfully!")
    print("  Location: store-assets/")

def resize_and_fit(img, target_w, target_h):
    """Resize image to fit target dimensions, maintaining aspect ratio"""
    # Calculate aspect ratios
    img_aspect = img.size[0] / img.size[1]
    target_aspect = target_w / target_h
    
    if img_aspect > target_aspect:
        # Image is wider - fit to width
        new_w = target_w
        new_h = int(target_w / img_aspect)
    else:
        # Image is taller - fit to height
        new_h = target_h
        new_w = int(target_h * img_aspect)
    
    # Resize with high-quality resampling
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Create canvas with white background
    canvas = Image.new('RGB', (target_w, target_h), (255, 255, 255))
    
    # Center the resized image
    x = (target_w - new_w) // 2
    y = (target_h - new_h) // 2
    canvas.paste(resized, (x, y))
    
    return canvas

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: ./convert-screenshot.py <input-image>")
        sys.exit(1)
    
    convert_screenshot(sys.argv[1])
