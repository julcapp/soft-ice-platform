#!/usr/bin/env python3
import argparse,datetime,os,pathlib,shutil,subprocess,tempfile
root=pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1')
front=root/'frontend/admin-console';patch=pathlib.Path('/home/julcapp/customer-card-navigation.patch');web=pathlib.Path('/var/www/admin.utimoshi.ru')
p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');args=p.parse_args()
subprocess.run(['git','apply','--check',str(patch)],cwd=root,check=True)
with tempfile.TemporaryDirectory(prefix='softice-card-navigation-') as folder:
 stage=pathlib.Path(folder);target=stage/'frontend/admin-console'
 shutil.copytree(front,target,ignore=shutil.ignore_patterns('node_modules','dist'))
 (target/'node_modules').symlink_to(front/'node_modules',target_is_directory=True)
 subprocess.run(['git','apply','--unsafe-paths',str(patch)],cwd=stage,check=True)
 subprocess.run(['npm','run','build'],cwd=target,check=True)
 print('PASS: переход с сохранением проверен на копии серверных исходников.')
 if not args.apply:raise SystemExit(0)
 if os.geteuid()!=0:raise SystemExit('Для публикации запустите --apply в root-терминале.')
 backup=pathlib.Path('/var/backups/soft-ice/card-navigation-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'));backup.mkdir(parents=True,mode=0o700)
 names=[line[6:] for line in patch.read_text().splitlines() if line.startswith('+++ b/')]
 for name in names:
  dest=backup/'source'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,dest)
 shutil.copytree(web,backup/'web')
 try:
  subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
  shutil.copytree(target/'dist/assets',web/'assets',dirs_exist_ok=True)
  shutil.copy2(target/'dist/index.html',web/'index.next.html');(web/'index.next.html').replace(web/'index.html')
  print('PASS: кнопка назад и выбор сохранения установлены. Резервная копия:',backup)
 except Exception:
  for name in names:shutil.copy2(backup/'source'/name,root/name)
  shutil.copytree(backup/'web',web,dirs_exist_ok=True)
  raise
