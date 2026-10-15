from pathlib import Path
import re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
p=root/'index.html';old=p.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-pickup-spacing-2f48c5f499f6.js','Build changed'
s=(root/asset.lstrip('/')).read_text()
a='pickupTimeout.current=()=>{ee();m()}'
assert s.count(a)==1
s=s.replace(a,'pickupTimeout.current=()=>{ee();s()}')
new='/assets/index-pickup-back-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/');target.write_text(s)
subprocess.run(['node','--check',str(target)],check=True)
assert p.read_text()==old
Path('/home/julcapp/display-index-before-pickup-back.html').write_text(old)
p.write_text(old.replace(asset,new))
print('Published',new)
