#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


DEFAULT_SOURCE = (
    Path(__file__).resolve().parents[2] / "assets" / "art" / "source" / "TilesetFloor.png"
)
DEFAULT_OUTPUT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Slice a tileset image into 16x16 tiles named with x/y coordinates."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Source image path (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--tile-size",
        type=int,
        default=16,
        help="Tile width and height in pixels (default: 16)",
    )
    parser.add_argument(
        "--keep-empty",
        action="store_true",
        help="Also export fully transparent tiles.",
    )
    return parser.parse_args()


def is_empty_tile(tile: Image.Image) -> bool:
    alpha = tile.getchannel("A")
    return alpha.getbbox() is None


def main() -> None:
    args = parse_args()
    source = args.source.expanduser().resolve()
    output = args.output.expanduser().resolve()
    tile_size = args.tile_size

    if not source.exists():
        raise FileNotFoundError(f"Source image not found: {source}")

    output.mkdir(parents=True, exist_ok=True)

    with Image.open(source).convert("RGBA") as image:
        columns = image.width // tile_size
        rows = image.height // tile_size
        exported = 0
        skipped = 0

        for y in range(rows):
            for x in range(columns):
                left = x * tile_size
                top = y * tile_size
                tile = image.crop((left, top, left + tile_size, top + tile_size))

                if not args.keep_empty and is_empty_tile(tile):
                    skipped += 1
                    continue

                tile_path = output / f"tile_x{x:02d}_y{y:02d}.png"
                tile.save(tile_path)
                exported += 1

    print(f"source={source}")
    print(f"output={output}")
    print(f"tile_size={tile_size}")
    print(f"exported={exported}")
    print(f"skipped_empty={skipped}")


if __name__ == "__main__":
    main()
