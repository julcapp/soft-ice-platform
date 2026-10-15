"""Add the standalone page to the deployed console, preserving its existing bundle.
Run as julcapp with the unpacked UI release directory as argv[1].
"""
from pathlib import Path
import hashlib, sys, datetime, re
release=Path(sys.argv[1])
public=Path('/var/www/admin.utimoshi.ru')
index=public/'index.html'
html=index.read_text()
original='index-CBD-yIe0.js'
bundle_refs=re.findall(r'/assets/(index-(?:CBD-yIe0|benefits-[a-f0-9]{12})\.js)',html)
assert len(bundle_refs)==1, 'Unexpected deployed index; inspect before publishing'
previous_bundle=bundle_refs[0]
s=(public/'assets'/original).read_text()
nav='{label:"Promotion Engine",href:"#promotions",managed:!0}'
route='if(P)return l.createElement(ct,{navOpen:i,setNavOpen:d},l.createElement(Qe,{group:"Коммерция",title:"Promotion Engine"'
assert s.count(nav)==1 and s.count(route)==1, 'Unexpected original console bundle'
s=s.replace(nav,'{label:"Акции и условия",href:"#customer-benefits",managed:!0},'+nav)
s=s.replace(route,'if(g==="customer-benefits")return l.createElement(ct,{navOpen:i,setNavOpen:d},l.createElement("header",{className:"page-header"},l.createElement("h1",null,"Акции и условия"),l.createElement("p",null,"Версии правил, режимы начислений и сухой расчёт истории.")),l.createElement("div",{ref:window.softIceCustomerBenefitsRef}));'+route)
assert 'Центр сообщений' in s and 'Планировщик' in s
names={}
for source,stem in [('customer-benefits.js','customer-benefits'),('customer-benefits.css','customer-benefits')]:
 data=(release/source).read_bytes(); name=stem+'-'+hashlib.sha256(data).hexdigest()[:12]+Path(source).suffix
 (public/'assets'/name).write_bytes(data); names[Path(source).suffix]=name
patched='index-benefits-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js'
(public/'assets'/patched).write_text(s)
backup=Path('/home/julcapp')/('admin-index-before-benefits-ui-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.html')
backup.write_text(html)
html=html.replace('/assets/'+previous_bundle,'/assets/'+patched)
html=re.sub(r'<link rel="stylesheet" href="/assets/customer-benefits-[a-f0-9]{12}\.css">','',html)
html=re.sub(r'<script src="/assets/customer-benefits-[a-f0-9]{12}\.js"></script>','',html)
html=html.replace('</head>','<link rel="stylesheet" href="/assets/'+names['.css']+'"><script src="/assets/'+names['.js']+'"></script></head>')
index.write_text(html)
print('PUBLISHED',patched,names,'BACKUP',str(backup))
