#!/usr/bin/env python3
"""
Pre-publish script for n8n Chrome Extension
Checks for store icon (128x128) and creates it if missing
"""

import os
from pathlib import Path

def create_store_icon():
    """Create a 128x128 store icon for Chrome Web Store"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Installing Pillow...")
        os.system("pip3 install Pillow -q")
        from PIL import Image, ImageDraw

    print("Creating store icon...")

    size = 128
    img = Image.new('RGB', (size, size), '#FFFFFF')
    draw = ImageDraw.Draw(img)

    # n8n brand colors
    n8n_orange = '#FF6D5A'
    n8n_dark = '#1A1A1A'
    sidebar_bg = '#F5F5F5'
    node_color = '#4A9EFF'

    # Draw gradient background
    for y in range(size):
        intensity = int(245 - (y / size) * 10)
        color = (intensity, intensity, intensity)
        draw.rectangle([0, y, size, y+1], fill=color)

    # Draw sidebar on the left
    sidebar_width = 36
    draw.rectangle([0, 0, sidebar_width, size], fill=sidebar_bg)
    draw.rectangle([0, 0, sidebar_width, size], outline=n8n_dark, width=2)

    # Draw workflow items in sidebar
    node_height = 8
    node_width = 24
    node_gap = 12
    start_y = 20

    for i in range(5):
        y = start_y + i * (node_height + node_gap)
        x = (sidebar_width - node_width) // 2
        color = n8n_orange if i % 2 == 0 else node_color
        draw.rounded_rectangle([x, y, x + node_width, y + node_height], radius=2, fill=color)

    # Draw workflow nodes
    nodes = [(60, 35), (95, 35), (60, 70), (95, 70), (78, 95)]
    node_radius = 10

    # Draw connections
    connections = [(0, 1), (0, 2), (1, 3), (2, 4), (3, 4)]
    for start, end in connections:
        x1, y1 = nodes[start]
        x2, y2 = nodes[end]
        draw.line([x1, y1, x2, y2], fill=n8n_dark, width=2)

    # Draw nodes
    for x, y in nodes:
        draw.ellipse([x-node_radius, y-node_radius, x+node_radius, y+node_radius],
                     fill='#FFFFFF', outline=n8n_orange, width=3)
        draw.ellipse([x-3, y-3, x+3, y+3], fill=n8n_orange)

    # Multi-instance indicators (three dots in top right)
    indicators = [(size-15, 12), (size-15, 24), (size-15, 36)]
    for i, (x, y) in enumerate(indicators):
        color = n8n_orange if i == 0 else '#CCCCCC'
        draw.ellipse([x-4, y-4, x+4, y+4], fill=color, outline=n8n_dark, width=1)

    return img

def check_and_create_icon():
    """Check if store icon exists, create if missing"""
    # Get project root (parent of scripts directory)
    project_root = Path(__file__).parent.parent
    icon_path = project_root / 'icons' / 'store-icon-128.png'

    print("Checking for store icon...")
    print(f"Looking for: {icon_path}")

    if icon_path.exists():
        # Verify dimensions
        try:
            from PIL import Image
            img = Image.open(icon_path)
            if img.size == (128, 128):
                print(f"✓ Store icon found: {icon_path}")
                print(f"  Size: {img.size[0]}x{img.size[1]} (correct)")
                return True
            else:
                print(f"⚠ Store icon exists but wrong size: {img.size[0]}x{img.size[1]}")
                print("  Creating new icon with correct dimensions...")
        except Exception as e:
            print(f"⚠ Error reading existing icon: {e}")
            print("  Creating new icon...")
    else:
        print("✗ Store icon not found")
        print("  Creating new icon...")

    # Create the icon
    img = create_store_icon()

    # Ensure icons directory exists
    icon_path.parent.mkdir(parents=True, exist_ok=True)

    # Save the icon
    img.save(icon_path)
    print(f"✓ Created store icon: {icon_path}")
    print(f"  Size: 128x128 pixels")
    print(f"  File size: {icon_path.stat().st_size / 1024:.1f} KB")

    return True

if __name__ == '__main__':
    print("=" * 60)
    print("Chrome Extension Store Icon Check")
    print("=" * 60)
    print()

    try:
        success = check_and_create_icon()
        print()
        if success:
            print("✓ Store icon ready for Chrome Web Store upload")
            exit(0)
        else:
            print("✗ Failed to prepare store icon")
            exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
