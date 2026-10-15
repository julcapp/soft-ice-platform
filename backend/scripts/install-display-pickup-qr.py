from pathlib import Path
import urllib.request,tarfile,io,re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
p=root/'index.html';old=p.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-pickup-back-89f171dd67fe.js','Build changed'
data=urllib.request.urlopen('https://registry.npmjs.org/jsqr/-/jsqr-1.4.0.tgz',timeout=30).read()
assert hashlib.sha256(data).hexdigest()=='b5299b37917a1fe7a8cab9dd5cc6b8accf82663add80abe5bf7761a921cc6602','Package checksum mismatch'
vendor=root/'assets';vendor.mkdir(exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(data)) as t:
 for a,b in [('package/dist/jsQR.js','jsQR-1.4.0.js'),('package/LICENSE','jsQR-LICENSE.txt')]:
  (vendor/b).write_bytes(t.extractfile(a).read())
wrapper=Path('/home/julcapp/pickup-qr-detector.js').read_bytes()
(root/'assets/pickup-qr-detector.js').write_bytes(wrapper)
s=(root/asset.lstrip('/')).read_text()
assert 'window.BarcodeDetector' in s
s=s.replace('window.BarcodeDetector','window.SoftIceQrDetector').replace('"BarcodeDetector"in window','"SoftIceQrDetector"in window')
new='/assets/index-pickup-qr-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/');target.write_text(s)
subprocess.run(['node','--check',str(target)],check=True)
subprocess.run(['node','--check',str(root/'assets/pickup-qr-detector.js')],check=True)
assert p.read_text()==old
Path('/home/julcapp/display-index-before-pickup-qr.html').write_text(old)
updated=old.replace(asset,new).replace('</head>','<script src="/assets/jsQR-1.4.0.js"></script><script src="/assets/pickup-qr-detector.js"></script></head>')
p.write_text(updated)
print('Published QR decoder',new)
