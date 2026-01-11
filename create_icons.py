#!/usr/bin/env python3
"""
Simple script to create placeholder icons for the Chrome extension.
Creates three PNG files with the n8n blue color (#4a9eff).
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("PIL/Pillow not installed. Install with: pip3 install Pillow")
    print("Or create icons manually using any image editor.")
    exit(1)

# n8n brand color
N8N_BLUE = (74, 158, 255)

def create_icon(size, filename):
    """Create a simple square icon with n8n blue background and white 'n8n' text."""
    # Create image with n8n blue background
    img = Image.new('RGB', (size, size), N8N_BLUE)
    draw = ImageDraw.Draw(img)

    # Try to add 'n8n' text in white
    try:
        # Calculate font size based on icon size
        font_size = size // 3

        # Try to use a system font
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except:
                # Fall back to default font
                font = ImageFont.load_default()

        # Draw text in center
        text = "n8n"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((size - text_width) // 2, (size - text_height) // 2 - bbox[1])

        draw.text(position, text, fill=(255, 255, 255), font=font)
    except Exception as e:
        print(f"Could not add text to {size}x{size} icon: {e}")
        # Icon will just be solid blue color

    # Save image
    img.save(f'icons/{filename}')
    print(f"Created icons/{filename} ({size}x{size})")

if __name__ == '__main__':
    import os

    # Ensure icons directory exists
    os.makedirs('icons', exist_ok=True)

    # Create three icon sizes
    create_icon(16, 'icon16.png')
    create_icon(48, 'icon48.png')
    create_icon(128, 'icon128.png')

    print("\nIcons created successfully!")
    print("The extension is now ready to load in Chrome.")
