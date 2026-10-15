from pathlib import Path
import re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
index=root/'index.html'
old=index.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-Cdp_yafw.js','Active build changed'
p=root/asset.lstrip('/')
s=p.read_text()
a='if(!("BarcodeDetector"in window))throw new Error("QR_DETECTOR_UNAVAILABLE");const le=await((O=(L=window.BarcodeDetector).getSupportedFormats)==null?void 0:O.call(L));if(Array.isArray(le)&&!le.includes("qr_code"))throw new Error("QR_DETECTOR_UNAVAILABLE");'
b='let canScan=false;try{if("BarcodeDetector"in window){const f=await window.BarcodeDetector.getSupportedFormats?.();canScan=!Array.isArray(f)||f.includes("qr_code")}}catch{}'
assert s.count(a)==1
s=s.replace(a,b)
a='q.current=Re,Z.current=new window.BarcodeDetector({formats:["qr_code"]}),'
b='q.current=Re,Z.current=null,(()=>{try{if(canScan)Z.current=new window.BarcodeDetector({formats:["qr_code"]})}catch{}})(),'
assert s.count(a)==1
s=s.replace(a,b)
a='E({status:"active",error:null}),C.current=window.setTimeout(Y,250)'
b='E({status:"active",error:Z.current?null:"Камера включена. Распознавание QR недоступно в этом браузере; введите код вручную."}),C.current=window.setTimeout(Y,250)'
assert s.count(a)==1
s=s.replace(a,b)
new='/assets/index-camera-preview-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/')
target.write_text(s)
subprocess.run(['node','--check',str(target)],check=True)
assert index.read_text()==old,'Index changed'
Path('/home/julcapp/display-index-before-camera-preview.html').write_text(old)
index.write_text(old.replace(asset,new))
print('Published',new)
