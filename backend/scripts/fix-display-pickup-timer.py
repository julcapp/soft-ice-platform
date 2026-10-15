from pathlib import Path
import re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
p=root/'index.html'
old=p.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-camera-preview-32d99d483407.js','Build changed'
s=(root/asset.lstrip('/')).read_text()
a='};R.useEffect(()=>()=>{var V,L;(V=v.current)==null||V.abort()'
assert s.count(a)==1
s=s.replace(a,'};'+"const[pickupSeconds,setPickupSeconds]=R.useState(30),pickupTimeout=R.useRef(null);pickupTimeout.current=()=>{ee();m()};R.useEffect(()=>{if(p.status!==\"input\")return;let deadline=Date.now()+30000;setPickupSeconds(30);const tick=window.setInterval(()=>{const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));setPickupSeconds(remaining);if(!remaining){window.clearInterval(tick);pickupTimeout.current()}},250);return()=>window.clearInterval(tick)},[p.status,p.error,o,w.status]);"+'R.useEffect(()=>()=>{var V,L;(V=v.current)==null||V.abort()')
a='c.createElement("div",{className:"pickup-layout"}'
assert s.count(a)==1
s=s.replace(a,'c.createElement("p",{className:"pickup-idle-countdown"},"Возврат в ожидание через ",pickupSeconds," с"),'+a)
new='/assets/index-pickup-timer-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/')
target.write_text(s)
subprocess.run(['node','--check',str(target)],check=True)
assert p.read_text()==old
Path('/home/julcapp/display-index-before-pickup-timer.html').write_text(old)
css=root/'pickup-fit.css'
Path('/home/julcapp/pickup-fit-before-timer.css').write_bytes(css.read_bytes())
css.write_text(css.read_text()+"\n.display-shell .pickup-screen .pickup-footer-actions button,.display-shell .pickup-screen .display-nav button{background:#00866f!important;color:#fff!important;border:2px solid #006653!important;box-shadow:0 4px 12px #00866f30;font-weight:800}\n.pickup-idle-countdown{font-size:16px!important;color:#57605d;margin:0!important;grid-column:1/-1}\n")
p.write_text(old.replace(asset,new))
print('Published',new)
