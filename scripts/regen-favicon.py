from PIL import Image, ImageDraw
import os, struct, io

logo = Image.open(r"apps\app\public\salaya-logo.png").convert("RGBA")
icon = logo.crop((0, 0, 290, 299))
icon = icon.crop(icon.getbbox())
print("raw icon", icon.size)

BG = (10, 11, 14, 255)
pub = r"apps\app\public"
app = r"apps\app\app"


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return m


def make_icon(size: int, pad_ratio: float = 0.06, radius_ratio: float = 0.2) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    pad = max(1, int(size * pad_ratio))
    inner = size - pad * 2
    iw, ih = icon.size
    scale = min(inner / iw, inner / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = icon.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    mask = rounded_mask(size, int(size * radius_ratio))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0))
    out.putalpha(mask)
    return out


def make_opaque(size: int, pad_ratio: float = 0.04) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    pad = max(1, int(size * pad_ratio))
    inner = size - pad * 2
    iw, ih = icon.size
    scale = min(inner / iw, inner / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = icon.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


master = make_icon(512, pad_ratio=0.05, radius_ratio=0.2)
master.save(os.path.join(pub, "salaya-icon.png"))
master.save(os.path.join(pub, "icon-512.png"))
master.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(pub, "icon-192.png"))
master.save(os.path.join(app, "icon.png"))

for s, name in [
    (16, "favicon-16x16.png"),
    (32, "favicon-32x32.png"),
    (48, "favicon-48x48.png"),
]:
    make_opaque(s, pad_ratio=0.03).save(os.path.join(pub, name))

make_opaque(180, pad_ratio=0.06).save(os.path.join(pub, "apple-touch-icon.png"))
make_opaque(180, pad_ratio=0.06).save(os.path.join(app, "apple-icon.png"))

make_opaque(192, pad_ratio=0.16).save(os.path.join(pub, "icon-maskable-192.png"))
make_opaque(512, pad_ratio=0.16).save(os.path.join(pub, "icon-maskable-512.png"))

sizes = [16, 32, 48]
pngs = [png_bytes(make_opaque(s, pad_ratio=0.03)) for s in sizes]
num = len(sizes)
header = struct.pack("<HHH", 0, 1, num)
offset = 6 + 16 * num
entries = b""
data = b""
for s, png in zip(sizes, pngs):
    entries += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(png), offset)
    data += png
    offset += len(png)
ico = header + entries + data
open(os.path.join(app, "favicon.ico"), "wb").write(ico)
open(os.path.join(pub, "favicon.ico"), "wb").write(ico)
print("done", len(ico))
