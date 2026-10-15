import pathlib, hashlib, os, datetime, shutil
web=pathlib.Path('/var/www/admin.utimoshi.ru')
dist=pathlib.Path(__file__).resolve().parents[2]/'frontend/admin-console/dist'
if os.geteuid()!=0:raise SystemExit('Запустите в root-терминале.')
if hashlib.sha256((web/'index.html').read_bytes()).hexdigest() not in ['46dea862fb0f9499c8851cff11ec6f22523a40d69ad8e95c56ef92e13b6d6617', '20eae72b4a65dae1b166088a3d1532874a61fb78f5975aeccb28a7da024758ea']:raise SystemExit('Панель на сервере изменилась; нужна повторная сверка.')
index=(dist/'index.html').read_text()
if 'index-BYVWlGjV.js' not in index or 'index-Xhgx5soE.css' not in index:raise SystemExit('Не найдена проверенная сборка навигации.')
backup=pathlib.Path('/var/backups/soft-ice/admin-navigation-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700);shutil.copytree(web,backup/'web')
try:
 shutil.copytree(dist/'assets',web/'assets',dirs_exist_ok=True)
 shutil.copy2(dist/'index.html',web/'index.next.html')
 (web/'index.next.html').replace(web/'index.html')
 print('PASS: подсветка меню и поиск разделов установлены. Резервная копия:',backup)
except Exception:
 shutil.copytree(backup/'web',web,dirs_exist_ok=True)
 raise
