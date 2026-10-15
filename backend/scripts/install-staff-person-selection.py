import pathlib, os, hashlib, shutil, subprocess, datetime, urllib.request, urllib.error
candidate = pathlib.Path(__file__).resolve().parent.parent
live = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
web = pathlib.Path('/var/www/admin.utimoshi.ru')
expected = {'src/modules/operator_workspace/ServiceAccountAccess.js': '40fe5411aff49b1df055360257bd402bab513ebc0a07eda797e03744d12fc6ca', 'src/api/v1/serviceAccountRoutes.js': '4c6f45436c28a1d9b0dab5995047940d1ce8ca69cb2bd901b9a9d565a81766b7', 'src/modules/organization/OrganizationService.js': 'a8e5556114f7428171ef289808990e9b95c4530e07ca126c1007665cacbc5968'}
new_files = ['src/platform/validation/personName.js']
for name in new_files:
    if (live / name).exists(): raise SystemExit('Новый файл уже существует: ' + name)
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
    for name in list(expected) + new_files:
        (live / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate / name, live / name)
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
    print('PASS: выбор сотрудника, совмещение ролей, ФИО и показ пароля установлены. Резервная копия:', backup)
except Exception:
    for name in new_files: (live / name).unlink(missing_ok=True)
    for name in expected: shutil.copy2(backup / 'backend' / name, live / name)
    shutil.copytree(backup / 'admin-web', web, dirs_exist_ok=True)
    subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'])
    raise SystemExit('Обновление остановлено, прежние файлы возвращены.')
