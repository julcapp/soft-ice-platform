#!/usr/bin/env python3
import argparse, datetime, os, pathlib, shutil, subprocess, tempfile
ROOT=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1')
PATCH=pathlib.Path('/home/julcapp/customer-account-runtime.patch')
WEB=pathlib.Path('/var/www/admin.utimoshi.ru')
SERVICE='softice-display-backend-8800.service'
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--rehearse',action='store_true');args=p.parse_args()
def run(command,**kw):return subprocess.run(command,cwd=ROOT,check=True,**kw)
run(['git','apply','--check',str(PATCH)])
print('PASS: патч совместим с текущими файлами сервера.')
if not args.apply and not args.rehearse:raise SystemExit(0)
if args.apply and os.geteuid()!=0:raise SystemExit('Для установки запустите команду в root-терминале.')
# Validate/install build tools before any source or database mutation.
front=ROOT/'frontend/admin-console'
if not (front/'node_modules/.bin/vite').exists():
 lock=front/'package-lock.json'
 command=['npm','ci','--include=dev'] if lock.exists() else ['npm','install','--include=dev','--package-lock=false']
 subprocess.run(command,cwd=front,check=True)
if not (front/'node_modules/.bin/vite').exists():raise SystemExit('Vite отсутствует: изменения не применены.')
# Rehearse the frontend patch and build on an isolated copy of live sources.
with tempfile.TemporaryDirectory(prefix='softice-account-check-') as folder:
 stage=pathlib.Path(folder); stagefront=stage/'frontend/admin-console'
 shutil.copytree(front,stagefront,ignore=shutil.ignore_patterns('node_modules','dist'))
 (stagefront/'node_modules').symlink_to(front/'node_modules',target_is_directory=True)
 subprocess.run(['git','apply','--unsafe-paths','--include=frontend/admin-console/*',str(PATCH)],cwd=stage,check=True)
 subprocess.run(['npm','run','build'],cwd=stagefront,check=True)
if not args.apply:print('PASS: сборка на копии серверных исходников проверена.');raise SystemExit(0)
backup=pathlib.Path('/var/backups/soft-ice/customer-accounts-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700)
files=[line[6:] for line in PATCH.read_text().splitlines() if line.startswith('+++ b/')]
for name in files:
 source=ROOT/name
 if source.exists():
  dest=backup/'source'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
shutil.copytree(WEB,backup/'web')
env=os.environ.copy()
for line in pathlib.Path('/etc/softice/display-backend.env').read_text().splitlines():
 if line.strip() and not line.lstrip().startswith('#') and '=' in line:
  key,value=line.split('=',1);env[key.strip()]=value.strip().strip('\"').strip("'")
def backend(command):subprocess.run(command,cwd=ROOT/'backend',env=env,check=True,stdout=subprocess.DEVNULL)
def health():run(['curl','--fail','--silent','--retry','8','--retry-connrefused','--retry-delay','1','http://127.0.0.1:8800/health'],stdout=subprocess.DEVNULL)
try:
 run(['git','apply',str(PATCH)])
 backend(['./node_modules/.bin/prisma','db','execute','--file','prisma/migrations/20261012000100_customer_account_controls/migration.sql','--schema','prisma/schema.prisma'])
 backend(['npm','run','prisma:generate'])
 subprocess.run(['npm','run','build'],cwd=ROOT/'frontend/admin-console',check=True)
 run(['systemctl','restart',SERVICE]);health()
 dist=ROOT/'frontend/admin-console/dist'
 shutil.copytree(dist/'assets',WEB/'assets',dirs_exist_ok=True)
 shutil.copy2(dist/'index.html',WEB/'index.next.html');(WEB/'index.next.html').replace(WEB/'index.html')
 print('PASS: управление учётными записями установлено. Резервная копия:',backup)
except Exception:
 for name in files:
  source=backup/'source'/name;target=ROOT/name
  if source.exists():shutil.copy2(source,target)
  elif target.exists():target.unlink()
 shutil.copytree(backup/'web',WEB,dirs_exist_ok=True)
 backend(['npm','run','prisma:generate']);run(['systemctl','restart',SERVICE]);health()
 print('Установка отменена, файлы восстановлены; добавленные столбцы БД сохранены.')
 raise
