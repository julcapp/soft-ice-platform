"""Add only an isolated read-only demo route/files; never replace the display index."""
from pathlib import Path
import tarfile,hashlib,datetime,os,grp,subprocess,shutil,urllib.request,urllib.error,time,json
root=Path('/home/julcapp/soft-ice-worktrees/display-product-v1');archive=Path('/home/julcapp/supplier-display-demo.tgz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()==os.environ['SUPPLIER_DEMO_BUNDLE_SHA']
main=root/'backend/src/main.js';original=main.read_bytes();assert hashlib.sha256(original).hexdigest()=='d481ca3c1e1719aa62e9c87cb294f3aa62ed74e44e58dc38e856f9f4ef1848f0','Runtime changed: inspect before deployment'
indexes=[Path('/var/www/display.utimoshi.ru/index.html'),Path('/var/www/admin.utimoshi.ru/index.html')];index_hashes=[hashlib.sha256(p.read_bytes()).hexdigest() for p in indexes]
release=Path('/home/julcapp/supplier-demo-release-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));release.mkdir(mode=0o755)
stage=release/'stage';stage.mkdir()
with tarfile.open(archive) as t:
 for m in t.getmembers():assert m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts
 t.extractall(stage)
(release/'main-before.js').write_bytes(original)
router=root/'backend/src/supplier_demo/router.js';web=root/'backend/public/supplier-demo';assert not router.exists() and not web.exists(),'Demo already exists; use reviewed update deployment'
router.parent.mkdir(parents=True,mode=0o755);web.mkdir(parents=True,mode=0o755)
try:
 router.write_bytes((stage/'router.js').read_bytes());router.chmod(0o640);os.chown(router,-1,grp.getgrnam('softice-runtime').gr_gid)
 shutil.copytree(stage/'web',web,dirs_exist_ok=True)
 for p in web.rglob('*'):p.chmod(0o755 if p.is_dir() else 0o644)
 subprocess.run(['node','--check',str(router)],check=True)
 s=original.decode();a="  app.use('/health', createHealthRouter(options.health));";assert s.count(a)==1
 updated=s.replace(a,a+"\n  app.use('/api/supplier-demo', require('./supplier_demo/router').createSupplierDemoRouter());")
 assert main.read_bytes()==original,'Concurrent main update';main.write_text(updated)
 subprocess.run(['node','--check',str(main)],check=True);subprocess.run(['sudo','systemctl','restart','softice-display-backend-8800.service'],check=True)
 base='http://127.0.0.1:8800/api/supplier-demo/'
 ready=False
 for i in range(20):
  try:
   r=urllib.request.urlopen(base,timeout=2);assert r.status==200;assert "connect-src 'none'" in r.headers['Content-Security-Policy'];ready=True;break
  except (urllib.error.URLError,TimeoutError):time.sleep(.3)
 assert ready
 for endpoint in ['','api/payments','api/dispense','api/orders']:
  try:urllib.request.urlopen(urllib.request.Request(base+endpoint,method='POST'),timeout=5);raise RuntimeError('Demo accepted write')
  except urllib.error.HTTPError as e:assert e.code==403
 assert index_hashes==[hashlib.sha256(p.read_bytes()).hexdigest() for p in indexes],'A public index changed concurrently'
 subprocess.run(['systemctl','is-active','softice-display-backend-8800.service'],check=True)
 print('SUPPLIER_DEMO_PUBLISHED',json.dumps({'release':str(release),'path':'/api/supplier-demo/','displayIndexUnchanged':True,'adminIndexUnchanged':True,'writes':403}))
except Exception:
 if main.read_text()==locals().get('updated'):main.write_bytes(original);subprocess.run(['sudo','systemctl','restart','softice-display-backend-8800.service'])
 raise
