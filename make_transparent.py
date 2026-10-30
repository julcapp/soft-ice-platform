from PIL import Image, ImageFilter
from collections import deque

src = r"C:\Users\julcapp\Documents\GitHub\soft-ice-worktrees\display-product-v1\frontend\miniapp\public\media\ice\UT-ICE-Hero-001.png"
dst = r"C:\Users\julcapp\Documents\GitHub\soft-ice-worktrees\display-product-v1\frontend\miniapp\public\media\ice\UT-ICE-Hero-001-transparent.png"

im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()
seen = bytearray(w * h)
q = deque()

def candidate(x, y):
    r, g, b, _ = px[x, y]
    return min(r, g, b) >= 242 and max(r, g, b) - min(r, g, b) <= 18

def push(x, y):
    i = y * w + x
    if not seen[i] and candidate(x, y):
        seen[i] = 1
        q.append((x, y))

for x in range(w):
    push(x, 0); push(x, h - 1)
for y in range(h):
    push(0, y); push(w - 1, y)

while q:
    x, y = q.popleft()
    if x: push(x - 1, y)
    if x + 1 < w: push(x + 1, y)
    if y: push(x, y - 1)
    if y + 1 < h: push(x, y + 1)

alpha = Image.new("L", (w, h), 255)
a = alpha.load()
for y in range(h):
    off = y * w
    for x in range(w):
        if seen[off + x]:
            a[x, y] = 0

alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
im.putalpha(alpha)
box = alpha.getbbox()
if box:
    im = im.crop((max(0, box[0]-8), max(0, box[1]-8), min(w, box[2]+8), min(h, box[3]+8)))
im.save(dst, optimize=True)
print(dst, im.size)
