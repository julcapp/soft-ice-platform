import pathlib, hashlib, os, datetime, shutil
web=pathlib.Path('/var/www/admin.utimoshi.ru')
dist=pathlib.Path(__file__).resolve().parents[2]/'frontend/admin-console/dist'
if os.geteuid()!=0:raise SystemExit('Запустите в root-терминале.')
if hashlib.sha256((web/'index.html').read_bytes()).hexdigest()!='5f5835e471bf6324e277bcb5f3dc6dfe9abccd4a565011b8407114479f6d81bf':raise SystemExit('Панель на сервере изменилась; нужна повторная сверка.')
index=(dist/'index.html').read_text()
if 'index-bMkeNb28.js' not in index or 'index-nL04FEtj.css' not in index:raise SystemExit('Не найдена проверенная сборка навигации.')
backup=pathlib.Path('/var/backups/soft-ice/service-device-form-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True,mode=0o700);shutil.copytree(web,backup/'web')
try:
 shutil.copytree(dist/'assets',web/'assets',dirs_exist_ok=True)
 shutil.copy2(dist/'index.html',web/'index.next.html')
 (web/'index.next.html').replace(web/'index.html')
 print('PASS: форма регистрации смартфона установлена. Резервная копия:',backup)
except Exception:
 shutil.copytree(backup/'web',web,dirs_exist_ok=True)
 raise
