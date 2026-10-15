from pathlib import Path
import re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
p=root/'index.html';old=p.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-pickup-timer-958ec3176abb.js','Build changed'
s=(root/asset.lstrip('/')).read_text()
a='"Возврат в ожидание через ",pickupSeconds," с"'
assert s.count(a)==1
s=s.replace(a,'"⏱ ",pickupSeconds," с"')
new='/assets/index-pickup-spacing-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/');target.write_text(s)
subprocess.run(['node','--check',str(target)],check=True)
assert p.read_text()==old
Path('/home/julcapp/display-index-before-pickup-spacing.html').write_text(old)
css=root/'pickup-fit.css'
Path('/home/julcapp/pickup-fit-before-spacing.css').write_bytes(css.read_bytes())
css.write_text(css.read_text()+"\n/* Keep content rows at their natural height; the timer must not compress headings. */\n.display-prepaid.pickup-screen{position:relative;grid-template-rows:auto auto auto;align-content:start;gap:20px}\n.pickup-screen-heading{min-height:max-content;padding-bottom:8px}\n.pickup-layout{align-self:start}\n.display-shell .pickup-screen .pickup-idle-countdown{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);width:68px;box-sizing:border-box;padding:10px 4px;margin:0!important;border:1px solid #c9ded6;border-radius:16px;background:#fff;color:#006653;font-size:18px!important;font-weight:800;text-align:center;line-height:1.4;z-index:2}\n@media(max-width:760px),(orientation:portrait){\n .display-shell .pickup-screen .pickup-idle-countdown{position:static;transform:none;align-self:center;width:auto;padding:8px 20px}\n}\n")
p.write_text(old.replace(asset,new))
print('Published',new)
