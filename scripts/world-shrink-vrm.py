"""
Thu nhỏ texture bên trong file .vrm/.glb (VRM 0.x an toàn): giữ nguyên JSON/extension, chỉ thay img nhúng
và dựng lại vùng BIN. Texture 4096² tốn ~90 MB GPU mỗi tấm -> hạ xuống tối đa 1024² cho điện thoại.

Dùng: python scripts/world-shrink-vrm.py <vào.vrm> <ra.vrm> [--max 1024]
"""
import io
import json
import struct
import sys

from PIL import Image


def shrink(src: str, dst: str, max_size: int = 1024) -> None:
    data = open(src, "rb").read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2, "không phải GLB v2"
    off = 12
    json_len, json_type = struct.unpack_from("<I4s", data, off)
    assert json_type == b"JSON"
    gltf = json.loads(data[off + 8 : off + 8 + json_len])
    off += 8 + json_len
    bin_len, bin_type = struct.unpack_from("<I4s", data, off)
    assert bin_type == b"BIN\x00"
    bin_data = data[off + 8 : off + 8 + bin_len]

    image_views = {img["bufferView"]: img for img in gltf.get("images", []) if "bufferView" in img}
    new_bin = bytearray()
    before = after = 0
    for i, view in enumerate(gltf["bufferViews"]):
        chunk = bin_data[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
        if i in image_views:
            img_meta = image_views[i]
            im = Image.open(io.BytesIO(chunk))
            before += len(chunk)
            if max(im.size) > max_size:
                im.thumbnail((max_size, max_size), Image.LANCZOS)
            buf = io.BytesIO()
            if img_meta.get("mimeType") == "image/jpeg":
                im.convert("RGB").save(buf, "JPEG", quality=88, optimize=True)
            else:
                im.save(buf, "PNG", optimize=True)
            chunk = buf.getvalue()
            after += len(chunk)
        while len(new_bin) % 4:
            new_bin.append(0)
        view["byteOffset"] = len(new_bin)
        view["byteLength"] = len(chunk)
        new_bin.extend(chunk)
    while len(new_bin) % 4:
        new_bin.append(0)
    gltf["buffers"][0]["byteLength"] = len(new_bin)

    js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(new_bin)
    out = struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(new_bin), b"BIN\x00") + bytes(new_bin)
    open(dst, "wb").write(out)
    print(f"{src} -> {dst}: img {before/1e6:.1f} MB -> {after/1e6:.1f} MB, file {len(data)/1e6:.1f} MB -> {len(out)/1e6:.1f} MB")


if __name__ == "__main__":
    args = sys.argv[1:]
    mx = 1024
    if "--max" in args:
        i = args.index("--max")
        mx = int(args[i + 1])
        del args[i : i + 2]
    shrink(args[0], args[1], mx)
