"""Write solid, opaque placeholder AppIcon PNGs (RGB, no alpha channel).

App Store uploads reject a missing icon and an iOS icon with any transparency.
Replace these with real art, still opaque. Stdlib only: python3 scripts/make-icon.py
"""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "App/Assets.xcassets/AppIcon.appiconset"
RGB = bytes((0x33, 0x66, 0xCC))
SIZES = (16, 32, 64, 128, 256, 512, 1024)


def chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data))
    )


def png(size: int) -> bytes:
    # Colour type 2 is truecolour without alpha, so the image can't be transparent.
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    rows = (b"\0" + RGB * size) * size
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


for s in SIZES:
    (OUT / f"icon-{s}.png").write_bytes(png(s))
