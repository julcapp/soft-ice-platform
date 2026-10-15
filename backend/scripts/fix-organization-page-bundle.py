"""Guarded repair for the published organization page; preserves unrelated UI."""
from pathlib import Path
import re,hashlib,datetime,subprocess,shutil
root=Path('/home/julcapp/soft-ice-worktrees/display-product-v1')
public=Path('/var/www/admin.utimoshi.ru');index=public/'index.html';html=index.read_text()
asset=re.search(r'<script type="module"[^>]*src="([^"]+)',html).group(1)
s=(public/asset.lstrip('/')).read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='93fee12701b695fb52db089df8180edac796bb83c66120e0a8c099856031ae16','Published console changed; inspect again'
def patch(a,b):
 global s
 assert s.count(a)==1,'Bundle anchor mismatch: '+a[:80]
 s=s.replace(a,b)
patch('getOrganization:y0,getOrganizationLocations:v0','getOrganizationEvents:(u,s)=>Ga(`/${u}/events`,s),getOrganizationMetrics:(u,s)=>Ga(`/${u}/metrics`,s),getOrganization:y0,getOrganizationLocations:v0')
patch('return(m?Promise.all([s.getOrganization(', 'return Promise.resolve().then(()=>m?Promise.all([s.getOrganization(')
patch(':s.getOrganizations({signal:p.signal})).then(E=>g', ':s.getOrganizations({signal:p.signal})).then(E=>g')
# The second anchor is intentionally unchanged: the closing parenthesis now closes then().
old='cv.createRoot(document.getElementById("root")).render(l.createElement(l.StrictMode,null,l.createElement(TS,null)));'
boundary='class SoftIceAdminErrorBoundary extends l.Component{constructor(u){super(u);this.state={failed:false}}static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?l.createElement("main",{className:"card",role:"alert",style:{margin:24,padding:24}},l.createElement("h1",null,"Не удалось открыть раздел"),l.createElement("p",null,"Возникла ошибка интерфейса. Обновите страницу или вернитесь в главное меню."),l.createElement("button",{onClick:()=>window.location.reload()},"Повторить загрузку")," ",l.createElement("button",{onClick:()=>{window.location.hash="#dashboard";window.location.reload()}},"Главное меню")):this.props.children}}'
patch(old,boundary+'cv.createRoot(document.getElementById("root")).render(l.createElement(SoftIceAdminErrorBoundary,null,l.createElement(l.StrictMode,null,l.createElement(TS,null))));')
# A later publication had dropped the previously installed benefits entry. Restore its existing module.
if 'Акции и условия' not in s:
 module=public/'assets/customer-benefits-54ab9021ddc9.js';css=public/'assets/customer-benefits-97b23428f08d.css'
 assert module.is_file() and css.is_file(),'Benefits module missing'
 nav='{label:"Promotion Engine",href:"#promotions",managed:!0}'
 patch(nav,'{label:"Акции и условия",href:"#customer-benefits",managed:!0},'+nav)
 anchor='if(P)return l.createElement(ct,{navOpen:i,setNavOpen:d},l.createElement(Qe,{group:"Коммерция",title:"Promotion Engine"'
 route='if(g==="customer-benefits")return l.createElement(ct,{navOpen:i,setNavOpen:d},l.createElement("header",{className:"page-header"},l.createElement("h1",null,"Акции и условия"),l.createElement("p",null,"Версии правил, режимы начислений и сухой расчёт истории.")),l.createElement("div",{ref:window.softIceCustomerBenefitsRef}));'
 patch(anchor,route+anchor)
 html=html.replace('</head>','<link rel="stylesheet" href="/assets/'+css.name+'"><script src="/assets/'+module.name+'"></script></head>')
release=Path('/home/julcapp/org-page-repair-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));release.mkdir(mode=0o700)
new=release/'index-org-fixed.js';new.write_text(s);subprocess.run(['node','--check',str(new)],check=True)
(release/'index-before.html').write_text(index.read_text())
org=root/'frontend/admin-console/src/Organizations.jsx';source=org.read_text();(release/'Organizations.jsx').write_text(source)
a='const load=organizationId ? Promise.all([';b='const load=Promise.resolve().then(()=>organizationId ? Promise.all(['
assert source.count(a)==1 and source.count('clients.getOrganizations({signal:controller.signal});')==1
source=source.replace(a,b).replace('clients.getOrganizations({signal:controller.signal});','clients.getOrganizations({signal:controller.signal}));')
assert index.read_text()==(release/'index-before.html').read_text(),'Concurrent publication'
org.write_text(source)
name='index-org-fixed-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'.js';shutil.copyfile(new,public/'assets'/name)
updated=html.replace(asset,'/assets/'+name);temporary=public/'index-org-repair.tmp';temporary.write_text(updated);temporary.replace(index)
print('PUBLISHED',name,'BACKUP',release)
