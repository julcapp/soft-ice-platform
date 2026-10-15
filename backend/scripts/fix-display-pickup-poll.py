from pathlib import Path
import re,hashlib,subprocess
root=Path('/var/www/display.utimoshi.ru')
p=root/'index.html';old=p.read_text()
asset=re.search(r'src="(/assets/[^"]+\.js)"',old).group(1)
assert asset=='/assets/index-pickup-qr-f73377755ca2.js','Build changed'
s=(root/asset.lstrip('/')).read_text()
a='R.useEffect(()=>{if(!p.attemptId||!["transmitting","preparing"].includes(p.status))return;'
start=s.index(a)+len(a)
end=s.index('},[p.status,p.attemptId,r]);',start)
poll=s[start:end]
opener='const V=window.setTimeout(async()=>{'
tail='},1400);return()=>window.clearTimeout(V)'
assert poll.startswith(opener) and poll.endswith(tail)
body=poll[len(opener):-len(tail)]
replacement='return window.SoftIceStartPickupPolling(async()=>{'+body+'},1400)'
s=s[:start]+replacement+s[end:]
new='/assets/index-pickup-poll-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
target=root/new.lstrip('/');target.write_text(s)
helper=root/'assets/pickup-status-poller.js'
helper.write_bytes(Path('/home/julcapp/pickup-status-poller.js').read_bytes())
subprocess.run(['node','--check',str(target)],check=True)
subprocess.run(['node','--check',str(helper)],check=True)
assert p.read_text()==old
Path('/home/julcapp/display-index-before-pickup-poll.html').write_text(old)
p.write_text(old.replace(asset,new).replace('</head>','<script src="/assets/pickup-status-poller.js"></script></head>'))
print('Published continuous status poll',new)
