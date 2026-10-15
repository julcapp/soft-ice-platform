import pathlib, os, hashlib, shutil, subprocess, datetime, urllib.request, urllib.error
candidate = pathlib.Path(__file__).resolve().parent.parent
live = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
web = pathlib.Path('/var/www/admin.utimoshi.ru')
expected = {'src/modules/operator_workspace/ServiceAccountAccess.js': '61ce6aa5c5a911ee6f4574ab7dad0cdb899a9a231da8eb1b25f6b1679b0c5dd9', 'src/api/v1/serviceAccountRoutes.js': 'e19ee8ca40158788ab9eefbf730f661e50fb59e9e1881c3c6537f21d23cb97d7'}
if os.geteuid() != 0: raise SystemExit('Запустите через sudo.')
for name, digest in expected.items():
    if hashlib.sha256((live / name).read_bytes()).hexdigest() != digest:
        raise SystemExit('Рабочий файл изменился: ' + name + '. Обновление остановлено.')
    subprocess.run(['node', '--check', str(candidate / name)], check=True)
dist = candidate.parent / 'frontend/admin-console/dist'
if not (dist / 'index.html').exists(): raise SystemExit('Панель не собрана.')
backup = pathlib.Path('/var/backups/soft-ice/staff-create-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
shutil.copytree(web, backup / 'admin-web')
for name in expected:
    dest = backup / 'backend' / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(live / name, dest)
try:
    for name in expected: shutil.copy2(candidate / name, live / name)
    shutil.copytree(dist, web, dirs_exist_ok=True)
    subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'], check=True)
    import time
    for attempt in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8800/health', timeout=2) as response:
                if response.status == 200: break
        except Exception: pass
        time.sleep(.5)
    else: raise RuntimeError('Служба не прошла проверку доступности.')
    try:
        urllib.request.urlopen('http://127.0.0.1:8800/api/v1/admin/service-access', timeout=5)
        raise RuntimeError('Маршрут доступен без входа.')
    except urllib.error.HTTPError as error:
        if error.code not in (401,403): raise RuntimeError('Маршрут доступа не прошёл проверку.')
    print('PASS: формы организации и сотрудников установлены. Резервная копия:', backup)
except Exception:
    for name in expected: shutil.copy2(backup / 'backend' / name, live / name)
    shutil.copytree(backup / 'admin-web', web, dirs_exist_ok=True)
    subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'])
    raise SystemExit('Обновление остановлено, прежние файлы возвращены.')
