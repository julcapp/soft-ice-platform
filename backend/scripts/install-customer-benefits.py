"""Initial backend deployment only. Publish console with publish-customer-benefits-ui.py.
Requires a reviewed bundle SHA in BENEFITS_BUNDLE_SHA and exact pre-release sources.
"""
from pathlib import Path
import tarfile,hashlib,shutil,subprocess,os,grp,re,json,datetime,urllib.request,urllib.error
root=Path('/home/julcapp/soft-ice-worktrees/display-product-v1')
archive=Path('/home/julcapp/customer-benefits-bundle.tgz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()==os.environ['BENEFITS_BUNDLE_SHA'],'Bundle checksum mismatch'
release=Path('/home/julcapp/benefits-release-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
release.mkdir(mode=0o700)
stage=release/'stage';stage.mkdir()
with tarfile.open(archive) as tar:
 for member in tar.getmembers():
  assert member.isfile() and not member.name.startswith('/') and '..' not in Path(member.name).parts
 tar.extractall(stage)
guards={
'backend/src/api/v1/index.js':'9d9ff524a487d81cdeecef33519df066e86b1281088059a3610b6c28b78a03ec',
'backend/src/runtimeDependencies.js':'676b9c6d5ffe1885e7365a610ce845b42946a5c60caa716b7a184f55e9a55d35',
'backend/src/modules/machine_dispense/MachineDispenseService.js':'7e42534a02e9aee342506049e6ed5e6d14e4795c16aceaa2303f4f70680ba6bb',
'backend/prisma/schema.prisma':'2d3ed7849279c75fbb08fbd9067e29ae140fe208ed4c39165d10ce30fad23e1b'}
for rel,sha in guards.items():
 assert hashlib.sha256((root/rel).read_bytes()).hexdigest()==sha,'Concurrent source change: '+rel
backup=release/'backup';backup.mkdir()
for rel in guards:
 dest=backup/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/rel,dest)
web=Path('/var/www/admin.utimoshi.ru');old_index=(web/'index.html').read_text()
(backup/'admin-index.html').write_text(old_index)
changed=[];created=[];database_ready=False
def write(rel,content):
 p=root/rel
 if not p.exists():created.append(rel)
 p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(content)
 changed.append(rel)
 if rel.startswith('backend/') and p.stat().st_uid==os.geteuid():
  if rel.startswith('backend/src/'):os.chown(p,-1,grp.getgrnam('softice-runtime').gr_gid)
  os.chmod(p,0o640)
def patch(rel,a,b):
 p=root/rel;s=p.read_text();assert s.count(a)==1,'Patch anchor mismatch: '+rel;write(rel,s.replace(a,b))
try:
 for rel in ['backend/src/modules/customer_benefits/BenefitRules.js','backend/src/modules/customer_benefits/CustomerBenefitService.js','backend/src/api/v1/customerBenefitRoutes.js','backend/prisma/migrations/20261015040000_customer_benefit_rules/migration.sql','backend/scripts/customer-benefit-database.cjs']:
  assert not (root/rel).exists() or (root/rel).read_text()==(stage/rel).read_text(),'New file differs: '+rel
  write(rel,(stage/rel).read_text())
 patch('backend/src/api/v1/index.js',"  router.use('/admin/promotions'","  router.use('/admin/customer-benefits', require('./customerBenefitRoutes').createCustomerBenefitRouter(runtimeDependencies));\n  router.use('/admin/promotions'")
 patch('backend/src/runtimeDependencies.js','  paymentService.machineDispense = machineDispenseService;',"  machineDispenseService.customerBenefits = new (require('./modules/customer_benefits/CustomerBenefitService').CustomerBenefitService)({ prisma });\n  paymentService.machineDispense = machineDispenseService;")
 patch('backend/src/modules/machine_dispense/MachineDispenseService.js','failureInjector = async () => {} }) { Object.assign(this, { repository, inventory, orderDomain, provider, clock, failureInjector });','failureInjector = async () => {}, customerBenefits = null }) { Object.assign(this, { repository, inventory, orderDomain, provider, clock, failureInjector, customerBenefits });')
 patch('backend/src/modules/machine_dispense/MachineDispenseService.js','failureInjector:this.failureInjector});const result=','failureInjector:this.failureInjector,customerBenefits:this.customerBenefits});const result=')
 patch('backend/src/modules/machine_dispense/MachineDispenseService.js',"      await this.fact(repo,updated,'DISPENSED',{});","      if(attempt.operationType==='CUSTOMER_SALE'&&this.customerBenefits)await this.customerBenefits.completeOrder(tx,attempt.orderId);\n      await this.fact(repo,updated,'DISPENSED',{});")
 schema=(root/'backend/prisma/schema.prisma').read_text()
 for model,field in [('Customer','benefitPostings CustomerBenefitPosting[]'),('Order','benefitPostings CustomerBenefitPosting[]'),('BonusTransaction','benefitPosting CustomerBenefitPosting?')]:
  anchor='model '+model+' {\n';assert schema.count(anchor)==1;schema=schema.replace(anchor,anchor+'  '+field+'\n')
 source=(stage/'backend/prisma/schema.prisma').read_text()
 write('backend/prisma/schema.prisma',schema+'\nmodel CustomerBenefitPolicyVersion'+source.split('model CustomerBenefitPolicyVersion',1)[1])
 for rel in changed:
  if rel.endswith(('.js','.cjs')):subprocess.run(['node','--check',str(root/rel)],check=True)
 subprocess.run(['node',str(root/'backend/scripts/customer-benefit-database.cjs')],check=True)
 database_ready=True
 subprocess.run(['sudo','systemctl','restart','softice-display-backend-8800.service'],check=True)
 subprocess.run(['systemctl','is-active','softice-display-backend-8800.service'],check=True)
 # Wait via short HTTP retries, never use an insecure authenticated fallback.
 import time
 ready=False
 for attempt in range(15):
  try:
   urllib.request.urlopen('http://127.0.0.1:8800/api/v1/admin/customer-benefits',timeout=2)
   raise RuntimeError('Unauthenticated benefits endpoint unexpectedly allowed')
  except urllib.error.HTTPError as e:
   if e.code==401:ready=True;break
   raise
  except (urllib.error.URLError,TimeoutError):time.sleep(.4)
 assert ready,'Backend did not become ready'
 print('BENEFITS_BACKEND_RELEASE',json.dumps({'backup':str(release),'mode':'DRAFT_DEMO','historicalPosting':False},ensure_ascii=False))
except Exception:
 for rel in set(changed):
  original=backup/rel
  if original.exists() and not(database_ready and rel=='backend/prisma/schema.prisma'):shutil.copyfile(original,root/rel)
  elif not original.exists() and not database_ready and (root/rel).exists():(root/rel).unlink()
 (web/'index.html').write_text(old_index)
 if database_ready:subprocess.run(['sudo','systemctl','restart','softice-display-backend-8800.service'])
 print('SOURCE_ROLLBACK; additive benefits tables retained if migration committed')
 raise
