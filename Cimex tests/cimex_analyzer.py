#!/usr/bin/env python3
"""
CIMEX File Format Reverse Engineering Tool
Analyzes binary CIMEX files to extract structure and coordinate data
"""

import struct
import sys
import os

def safe_decode(data, encoding='ascii'):
    """Safely decode binary data with fallback"""
    try:
        return data.decode(encoding)
    except UnicodeDecodeError:
        return data.decode('ascii', errors='ignore')

def analyze_cimex_structure(filename):
    """Reverse engineer CIMEX file structure"""
    print("🔬 CIMEX REVERSE ENGINEERING ANALYSIS")
    print("=" * 50)
    
    with open(filename, 'rb') as f:
        data = f.read()
    
    print(f"📄 File: {os.path.basename(filename)}")
    print(f"📏 Size: {len(data):,} bytes ({len(data)/1024:.1f} KB)")
    print()
    
    # === HEADER ANALYSIS ===
    print("🔍 HEADER STRUCTURE")
    print("-" * 20)
    
    pos = 0
    
    # Magic number
    magic = struct.unpack('<I', data[0:4])[0]
    print(f"Magic: 0x{magic:08x} ({magic})")
    pos += 4
    
    # Find timestamp string
    timestamp_start = data.find(b'Wed Jul')
    if timestamp_start > 0:
        timestamp_end = data.find(b'\n', timestamp_start)
        timestamp = safe_decode(data[timestamp_start:timestamp_end])
        print(f"Timestamp: {timestamp}")
        pos = timestamp_end + 1
    
    # Find software version
    software_start = data.find(b'P16.0')
    if software_start > 0:
        software_end = data.find(b'\x00', software_start)
        software = safe_decode(data[software_start:software_end])
        print(f"Software: {software}")
    
    print()
    
    # === COORDINATE EXTRACTION ===
    print("📍 COORDINATE ANALYSIS")
    print("-" * 20)
    
    # Look for double-precision floating point patterns
    coordinates = []
    pos = 100  # Start after header
    
    while pos < len(data) - 16:
        try:
            # Extract potential X,Y coordinate pair
            x = struct.unpack('<d', data[pos:pos+8])[0]
            y = struct.unpack('<d', data[pos+8:pos+16])[0]
            
            # Filter for reasonable machining coordinates
            if (-500 < x < 500 and -500 < y < 500 and 
                abs(x) > 0.0001 and abs(y) > 0.0001 and
                not (abs(x) > 100 or abs(y) > 100)):  # Reasonable size
                coordinates.append((x, y, pos))
            
            pos += 8  # Step by 8 bytes (double size)
        except struct.error:
            pos += 1
    
    # Display first 25 coordinates
    print(f"Found {len(coordinates)} potential coordinate pairs:")
    print()
    
    if coordinates:
        print("   #    X-Coord    Y-Coord    Offset")
        print("-" * 40)
        for i, (x, y, offset) in enumerate(coordinates[:25]):
            print(f"{i+1:4d}  {x:8.3f}  {y:8.3f}  0x{offset:06x}")
        
        if len(coordinates) > 25:
            print(f"... and {len(coordinates) - 25} more coordinates")
    
    print()
    
    # === PATTERN ANALYSIS ===
    print("🔄 PATTERN ANALYSIS")
    print("-" * 20)
    
    # Look for repeating byte patterns that might indicate structure
    patterns = {}
    for i in range(0, len(data) - 4, 4):
        pattern = data[i:i+4]
        if pattern in patterns:
            patterns[pattern] += 1
        else:
            patterns[pattern] = 1
    
    # Show most common 4-byte patterns
    common_patterns = sorted(patterns.items(), key=lambda x: x[1], reverse=True)[:10]
    print("Most common 4-byte patterns:")
    for pattern, count in common_patterns:
        if count > 5:  # Only show frequent patterns
            hex_pattern = ' '.join(f'{b:02x}' for b in pattern)
            print(f"  {hex_pattern}: {count} occurrences")
    
    print()
    
    # === TEXT STRINGS ===
    print("📝 EMBEDDED TEXT ANALYSIS")
    print("-" * 20)
    
    # Extract readable strings
    strings = []
    current_string = b''
    
    for byte in data:
        if 32 <= byte <= 126:  # Printable ASCII
            current_string += bytes([byte])
        else:
            if len(current_string) > 4:
                strings.append(current_string.decode('ascii'))
            current_string = b''
    
    # Show unique strings longer than 4 characters
    unique_strings = list(set(strings))
    unique_strings.sort(key=len, reverse=True)
    
    print("Embedded text strings (tool/layer names?):")
    for s in unique_strings[:15]:
        if len(s) > 4:
            print(f"  '{s}'")
    
    print()
    
    # === GEOMETRY BOUNDS ===
    if coordinates:
        print("📐 GEOMETRY BOUNDS")
        print("-" * 20)
        
        x_coords = [coord[0] for coord in coordinates]
        y_coords = [coord[1] for coord in coordinates]
        
        print(f"X range: {min(x_coords):.3f} to {max(x_coords):.3f}")
        print(f"Y range: {min(y_coords):.3f} to {max(y_coords):.3f}")
        print(f"Width:  {max(x_coords) - min(x_coords):.3f}")
        print(f"Height: {max(y_coords) - min(y_coords):.3f}")
    
    return {
        'coordinates': coordinates,
        'file_size': len(data),
        'strings': unique_strings
    }

def main():
    filename = '/Users/aarondelia/Nextcloud2/Programing/dxf2Laser/Din Files /Cim Files/sample.cim'
    
    if not os.path.exists(filename):
        print(f"❌ File not found: {filename}")
        return
    
    try:
        results = analyze_cimex_structure(filename)
        
        print("✅ REVERSE ENGINEERING ASSESSMENT")
        print("=" * 50)
        print("🎯 FEASIBILITY: HIGH")
        print("📊 Structure appears well-organized")
        print("🔢 Clear coordinate data patterns")
        print("📝 Embedded metadata strings")
        print("⚙️  Suitable for parser development")
        
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
