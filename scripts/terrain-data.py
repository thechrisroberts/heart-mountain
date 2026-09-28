#!/usr/bin/env python3
"""Download real Mapzen Terrarium DEM and USGS NAIP imagery for Heart Mountain.

Run from the project root with `python3 scripts/terrain-data.py`. Only Python's
standard library is required. Elevation grids are north-to-south rows of
west-to-east unsigned 16-bit little-endian metres, including both bounds.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
from pathlib import Path
import struct
import time
import urllib.parse
import urllib.request
import zlib

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CACHE = ROOT / ".terrain-cache"
R = 6378137.0
TILE_SIZE = 256
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
IMAGE_URL = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage"
REGIONS = {
    "region": dict(bounds=(-110.12, 44.35, -108.85, 45.15), samples=1025, zoom=11,
                   elevation="height.bin", imagery="imagery.jpg", metadata="metadata.json",
                   image_max=4000),
    "heart": dict(bounds=(-109.19, 44.61, -109.05, 44.74), samples=513, zoom=13,
                  elevation="heart-height.bin", imagery="heart-imagery.jpg",
                  metadata="heart-metadata.json", image_max=3000),
}


def download(url: str, destination: Path) -> bytes:
    last_error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "HeartMountainTerrain/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
            destination.parent.mkdir(parents=True, exist_ok=True)
            temp = destination.with_suffix(destination.suffix + ".tmp")
            temp.write_bytes(data)
            temp.replace(destination)
            return data
        except Exception as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Could not download {url}: {last_error}")


def mercator(lon: float, lat: float) -> tuple[float, float]:
    return R * math.radians(lon), R * math.asinh(math.tan(math.radians(lat)))


def tile_coordinates(lon: float, lat: float, zoom: int) -> tuple[float, float]:
    size = 2 ** zoom
    return (lon + 180) / 360 * size, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * size


def decode_png_rgb(raw: bytes) -> bytes:
    """Decode 8-bit RGB/RGBA PNG tiles, including all PNG scanline filters."""
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Tile is not PNG")
    pos = 8
    compressed = bytearray()
    width = height = color_type = None
    while pos < len(raw):
        length = struct.unpack_from(">I", raw, pos)[0]
        kind = raw[pos + 4:pos + 8]
        chunk = raw[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunk)
            if (width, height, depth, compression, filtering, interlace) != (256, 256, 8, 0, 0, 0):
                raise ValueError("Unexpected Terrarium PNG format")
        elif kind == b"IDAT":
            compressed.extend(chunk)
        elif kind == b"IEND":
            break
    if color_type not in (2, 6):
        raise ValueError(f"Unsupported Terrarium PNG color type {color_type}")
    channels = 3 if color_type == 2 else 4
    stride = width * channels
    pixels = zlib.decompress(compressed)
    rgb = bytearray(width * height * 3)
    previous = bytearray(stride)
    offset = 0
    for row in range(height):
        filt = pixels[offset]
        scan = bytearray(pixels[offset + 1:offset + 1 + stride])
        offset += 1 + stride
        if filt == 1:
            for k in range(stride):
                scan[k] = (scan[k] + (scan[k - channels] if k >= channels else 0)) & 255
        elif filt == 2:
            for k in range(stride):
                scan[k] = (scan[k] + previous[k]) & 255
        elif filt == 3:
            for k in range(stride):
                scan[k] = (scan[k] + ((scan[k - channels] if k >= channels else 0) + previous[k]) // 2) & 255
        elif filt == 4:
            for k in range(stride):
                a = scan[k - channels] if k >= channels else 0
                b = previous[k]
                c = previous[k - channels] if k >= channels else 0
                p = a + b - c
                da, db, dc = abs(p - a), abs(p - b), abs(p - c)
                scan[k] = (scan[k] + (a if da <= db and da <= dc else b if db <= dc else c)) & 255
        elif filt != 0:
            raise ValueError(f"Unsupported PNG filter {filt}")
        target = row * width * 3
        if channels == 3:
            rgb[target:target + width * 3] = scan
        else:
            for col in range(width):
                rgb[target + col * 3:target + col * 3 + 3] = scan[col * 4:col * 4 + 3]
        previous = scan
    return bytes(rgb)


def fetch_tile(key: tuple[int, int, int]) -> tuple[tuple[int, int, int], bytes]:
    z, x, y = key
    destination = CACHE / str(z) / str(x) / f"{y}.png"
    raw = destination.read_bytes() if destination.exists() else download(TILE_URL.format(z=z, x=x, y=y), destination)
    return key, decode_png_rgb(raw)


def fetch_tiles(bounds: tuple[float, float, float, float], zoom: int) -> dict[tuple[int, int, int], bytes]:
    west, south, east, north = bounds
    tx0, ty0 = tile_coordinates(west, north, zoom)
    tx1, ty1 = tile_coordinates(east, south, zoom)
    # One pixel of margin accommodates bilinear sampling of pixel centres.
    xs = range(math.floor(tx0 - 1 / TILE_SIZE), math.floor(tx1 + 1 / TILE_SIZE) + 1)
    ys = range(math.floor(ty0 - 1 / TILE_SIZE), math.floor(ty1 + 1 / TILE_SIZE) + 1)
    keys = [(zoom, x, y) for y in ys for x in xs]
    print(f"Downloading/reading {len(keys)} DEM tiles at zoom {zoom}", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        return dict(pool.map(fetch_tile, keys))


def elevation_at(tiles: dict[tuple[int, int, int], bytes], zoom: int, pixel_x: int, pixel_y: int) -> float:
    tile_x, col = divmod(pixel_x, TILE_SIZE)
    tile_y, row = divmod(pixel_y, TILE_SIZE)
    rgb = tiles[zoom, tile_x, tile_y]
    pos = (row * TILE_SIZE + col) * 3
    return rgb[pos] * 256 + rgb[pos + 1] + rgb[pos + 2] / 256 - 32768


def sample_dem(tiles: dict[tuple[int, int, int], bytes], bounds: tuple[float, float, float, float],
               samples: int, zoom: int, path: Path) -> tuple[int, int]:
    west, south, east, north = bounds
    tx0, ty0 = tile_coordinates(west, north, zoom)
    tx1, ty1 = tile_coordinates(east, south, zoom)
    minimum, maximum = 65535, 0
    output = bytearray(samples * samples * 2)
    for row in range(samples):
        py = (ty0 + (ty1 - ty0) * row / (samples - 1)) * TILE_SIZE - 0.5
        iy = math.floor(py)
        fy = py - iy
        for col in range(samples):
            px = (tx0 + (tx1 - tx0) * col / (samples - 1)) * TILE_SIZE - 0.5
            ix = math.floor(px)
            fx = px - ix
            a = elevation_at(tiles, zoom, ix, iy)
            b = elevation_at(tiles, zoom, ix + 1, iy)
            c = elevation_at(tiles, zoom, ix, iy + 1)
            d = elevation_at(tiles, zoom, ix + 1, iy + 1)
            value = round((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
            value = max(0, min(65535, value))
            minimum, maximum = min(minimum, value), max(maximum, value)
            struct.pack_into("<H", output, (row * samples + col) * 2, value)
    path.write_bytes(output)
    return minimum, maximum


def get_imagery(bounds3857: tuple[float, float, float, float], filename: str, max_side: int) -> dict:
    west, south, east, north = bounds3857
    width_m, height_m = east - west, north - south
    scale = max_side / max(width_m, height_m)
    width, height = round(width_m * scale), round(height_m * scale)
    params = {
        "bbox": ",".join(f"{v:.9f}" for v in bounds3857),
        "bboxSR": "3857", "imageSR": "3857", "size": f"{width},{height}",
        "format": "jpg", "interpolation": "RSP_BilinearInterpolation",
        "adjustAspectRatio": "false", "f": "json",
    }
    url = IMAGE_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "HeartMountainTerrain/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.load(response)
    if "error" in result:
        raise RuntimeError(f"USGS exportImage error: {result['error']}")
    extent = result.get("extent") or {}
    actual = [extent.get(k) for k in ("xmin", "ymin", "xmax", "ymax")]
    if any(v is None for v in actual) or max(abs(a-b) for a,b in zip(actual, bounds3857)) > 1.0:
        raise RuntimeError(f"USGS returned misaligned extent {actual}, requested {bounds3857}")
    if result.get("width") != width or result.get("height") != height:
        raise RuntimeError(f"USGS returned unexpected dimensions: {result}")
    image_url = result.get("href")
    if not image_url:
        raise RuntimeError(f"USGS returned no image URL: {result}")
    image = download(image_url, DATA / filename)
    if not image.startswith(b"\xff\xd8"):
        raise RuntimeError("USGS imagery response is not a JPEG")
    return {"width": width, "height": height, "extent3857": dict(zip(("west", "south", "east", "north"), actual))}


def build_region(name: str) -> None:
    spec = REGIONS[name]
    west, south, east, north = spec["bounds"]
    mx0, my0 = mercator(west, south)
    mx1, my1 = mercator(east, north)
    center_lat = (north + south) / 2
    cos_lat = math.cos(math.radians(center_lat))
    DATA.mkdir(parents=True, exist_ok=True)
    tiles = fetch_tiles(spec["bounds"], spec["zoom"])
    minimum, maximum = sample_dem(tiles, spec["bounds"], spec["samples"], spec["zoom"], DATA / spec["elevation"])
    print(f"{name}: DEM ready, {minimum}–{maximum} m", flush=True)
    metadata = {
        "width": spec["samples"], "height": spec["samples"],
        "bounds": dict(zip(("west", "south", "east", "north"), (west, south, east, north))),
        "mercator": dict(zip(("west", "south", "east", "north"), (mx0, my0, mx1, my1))),
        "metersPerUnit": 1000, "centerLat": center_lat,
        "groundWidthKm": (mx1 - mx0) * cos_lat / 1000,
        "groundHeightKm": (my1 - my0) * cos_lat / 1000,
        "minElevation": minimum, "maxElevation": maximum,
        "elevationFile": spec["elevation"], "imageryFile": spec["imagery"],
        "heightEncoding": "uint16 little-endian metres, north-to-south rows, west-to-east columns",
        "heightSource": "Mapzen elevation tiles (Terrarium encoding), AWS public elevation-tiles-prod",
        "imagerySource": "USGS, USDA, The National Map: Orthoimagery (NAIP); public domain",
        "imagery": None,
    }
    metadata_path = DATA / spec["metadata"]
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    imagery = get_imagery((mx0, my0, mx1, my1), spec["imagery"], spec["image_max"])
    metadata["imagery"] = imagery
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"{name}: imagery ready {imagery['width']}×{imagery['height']}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("region", nargs="*", choices=REGIONS, help="Default: both regions")
    args = parser.parse_args()
    for selected in args.region or REGIONS:
        build_region(selected)
