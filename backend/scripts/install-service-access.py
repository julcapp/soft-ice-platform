import datetime, hashlib, os, pathlib, re, shutil, subprocess, urllib.parse, urllib.request, urllib.error

candidate = pathlib.Path(__file__).resolve().parent.parent
live = pathlib.Path('/home/julcapp/soft-ice-worktrees/display-product-v1/backend')
web = pathlib.Path('/var/www/admin.utimoshi.ru')
base = '0318a848e4aea42976b541124762e2a2305becc6'
files = ['package.json', 'package-lock.json', 'src/main.js', 'src/api/v1/operatorWorkspaceRoutes.js', 'src/api/v1/adminAuthRoutes.js', 'src/api/v1/serviceWorkspaceRoutes.js', 'src/api/v1/serviceAccountRoutes.js', 'src/platform/security/AdminAuthService.js', 'src/platform/security/AdminSecurityDelivery.js', 'src/modules/operator_workspace/ServiceAccessPolicy.js', 'src/modules/operator_workspace/ServiceVisitService.js', 'src/modules/operator_workspace/ServiceAccountAccess.js', 'prisma/migrations/20261005000100_service_access_media_v1/migration.sql']

def run(args, env=None, data=None):
    result = subprocess.run(args, env=env, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Не выполнена команда ' + args[0] + '. Установка остановлена; секреты не выводятся.')
    return result.stdout

def status(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8800' + path, timeout=10) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code

backup = None
changed = False
swapped = False
try:
    if os.geteuid() != 0:
        raise RuntimeError('Запустите через sudo в терминале владельца.')
    if run(['git', '-c', 'safe.directory=' + str(live.parent), '-C', str(live.parent), 'rev-parse', 'HEAD']).decode().strip() != base:
        raise RuntimeError('Рабочий коммит изменился. Требуется повторная сверка версии.')
    for name in files:
        if not (candidate / name).is_file():
            raise RuntimeError('В проверяемой версии не хватает файла ' + name)
        original = subprocess.run(['git', '-c', 'safe.directory=' + str(live.parent), '-C', str(live.parent), 'show', base + ':backend/' + name], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        target = live / name
        if original.returncode == 0:
            if not target.is_file() or target.read_bytes() != original.stdout:
                raise RuntimeError('Рабочий файл изменился: ' + name + '. Перезапись отменена.')
        elif target.exists():
            raise RuntimeError('Новый файл уже существует на рабочем сервере: ' + name)
    dist = candidate.parent / 'frontend/admin-console/dist'
    if not (dist / 'index.html').is_file():
        raise RuntimeError('Админ-панель ещё не собрана.')
    envtext = pathlib.Path('/etc/soft-ice-platform-v036.env').read_text()
    match = re.search(r'^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$', envtext, re.M)
    if not match:
        raise RuntimeError('Конфигурация базы не найдена.')
    url = urllib.parse.urlparse(match.group(1).strip().strip('"\''))
    env = os.environ.copy()
    env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGDATABASE=url.path.lstrip('/'), PGUSER=urllib.parse.unquote(url.username), PGPASSWORD=urllib.parse.unquote(url.password))
    backup = pathlib.Path('/var/backups/soft-ice/service-access-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(parents=True, mode=0o700)
    dump_path = backup / 'database.dump'
    with dump_path.open('wb') as output:
        result = subprocess.run(['docker', 'exec', '-e', 'PGPASSWORD', 'utimoshi_postgres', 'pg_dump', '--host=127.0.0.1', '--username=' + env['PGUSER'], '--dbname=' + env['PGDATABASE'], '--format=custom'], env=env, stdout=output, stderr=subprocess.PIPE)
    if result.returncode or dump_path.stat().st_size == 0:
        raise RuntimeError('Не создана резервная копия PostgreSQL 16. Рабочие данные не изменены.')
    run(['docker', 'exec', '-i', 'utimoshi_postgres', 'pg_restore', '--list'], data=dump_path.read_bytes())
    shutil.copytree(web, backup / 'admin-web')
    for name in files:
        target = live / name
        if target.exists():
            dest = backup / 'backend-files' / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, dest)
    print('Резервная копия подготовлена:', backup, flush=True)
    present = run(['psql', '-Atc', '''SELECT to_regclass('public."ServiceVisit"') IS NOT NULL'''], env=env).decode().strip()
    migration_name = '20261005000100_service_access_media_v1'
    migration = (candidate / 'prisma/migrations' / migration_name / 'migration.sql').read_bytes()
    import uuid
    checksum = hashlib.sha256(migration).hexdigest()
    tracking = """
DO $tracking$ BEGIN
IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
VALUES ('%s','%s',NOW(),'%s',1);
END IF; END $tracking$;
""" % (uuid.uuid4(), checksum, migration_name)
    if present == 't':
        recorded = run(['psql', '-Atc', "SELECT checksum FROM _prisma_migrations WHERE migration_name='" + migration_name + "' AND finished_at IS NOT NULL AND rolled_back_at IS NULL"], env=env).decode().strip()
        if recorded != checksum:
            raise RuntimeError('Существующая миграция не совпадает с проверенной версией.')
        print('Ранее применённая миграция проверена и пропущена.', flush=True)
    else:
        run(['psql', '-v', 'ON_ERROR_STOP=1', '--single-transaction'], env=env, data=migration + tracking.encode())
        print('Добавляющая миграция применена.', flush=True)
    changed = True
    for name in files:
        target = live / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate / name, target)
    if (live / 'node_modules').exists():
        shutil.move(str(live / 'node_modules'), str(backup / 'previous-node-modules'))
        swapped = True
    shutil.copytree(candidate / 'node_modules', live / 'node_modules')
    run(['node', '--check', str(live / 'src/main.js')])
    shutil.copytree(dist, web, dirs_exist_ok=True)
    for folder in ['service-reports', 'user-content']:
        root = pathlib.Path('/var/lib/soft-ice/media') / folder
        root.mkdir(parents=True, exist_ok=True)
        root.chmod(0o750)
    run(['systemctl', 'stop', 'soft-ice-platform-v036.service'])
    run(['systemctl', 'restart', 'softice-display-backend-8800.service'])
    import time
    for attempt in range(20):
        try:
            if status('/health') == 200:
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        raise RuntimeError('Рабочая служба не прошла health-проверку.')
    if status('/api/v1/admin/auth/me') != 401 or status('/api/v1/service-workspace') != 401:
        raise RuntimeError('Проверка закрытого доступа не пройдена.')
    print('PASS: рабочая служба включена, health=200, служебные маршруты закрыты без входа.')
    print('Панель: https://admin.utimoshi.ru/ · Назначения: #service-access')
except Exception as error:
    print('Установка остановлена:', str(error), flush=True)
    if changed and backup:
        for name in files:
            target = live / name
            saved = backup / 'backend-files' / name
            if saved.exists():
                shutil.copy2(saved, target)
            elif target.exists():
                target.unlink()
        if swapped:
            shutil.rmtree(live / 'node_modules', ignore_errors=True)
            shutil.move(str(backup / 'previous-node-modules'), str(live / 'node_modules'))
        shutil.copytree(backup / 'admin-web', web, dirs_exist_ok=True)
        subprocess.run(['systemctl', 'restart', 'softice-display-backend-8800.service'])
        print('Файлы и зависимости возвращены. Добавляющая миграция сохранена; данные не удаляются.')
    raise SystemExit(1)
