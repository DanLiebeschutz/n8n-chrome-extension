#!/usr/bin/env python3
"""
Create minimal valid PNG files for Chrome extension icons.
No external dependencies needed - uses only Python standard library.
"""

def create_minimal_png(filename, size):
    """Create a minimal valid PNG file with n8n blue color."""

    # n8n blue color: RGB(74, 158, 255)
    r, g, b = 74, 158, 255

    # PNG file structure (minimal valid PNG)
    import struct
    import zlib

    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk (image header)
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)

    # IDAT chunk (image data) - solid color
    # Create scanlines (each row starts with filter byte 0)
    row = b'\x00' + bytes([r, g, b] * size)
    idat_data_raw = row * size
    idat_data = zlib.compress(idat_data_raw)
    idat_crc = zlib.crc32(b'IDAT' + idat_data) & 0xffffffff
    idat_chunk = struct.pack('>I', len(idat_data)) + b'IDAT' + idat_data + struct.pack('>I', idat_crc)

    # IEND chunk (end of file)
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)

    # Write PNG file
    with open(f'icons/{filename}', 'wb') as f:
        f.write(png_signature)
        f.write(ihdr_chunk)
        f.write(idat_chunk)
        f.write(iend_chunk)

    print(f"Created icons/{filename} ({size}x{size}) - n8n blue color")

if __name__ == '__main__':
    import os

    # Ensure icons directory exists
    os.makedirs('icons', exist_ok=True)

    # Create three icon sizes
    try:
        create_minimal_png('icon16.png', 16)
        create_minimal_png('icon48.png', 48)
        create_minimal_png('icon128.png', 128)

        print("\n✓ Icons created successfully!")
        print("✓ Extension is now ready to load in Chrome.")
        print("\nNext steps:")
        print("1. Go to chrome://extensions/")
        print("2. Click 'Retry' on the error dialog")
        print("3. Or remove and re-add the extension")

    except Exception as e:
        print(f"\n✗ Error creating icons: {e}")
        print("\nAlternative: Download icons from:")
        print("https://www.iconfinder.com/search?q=workflow&price=free")
